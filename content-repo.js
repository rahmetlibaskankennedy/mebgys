// content-repo.js
// Statik JSON dosyalarının (categorytopics.json, sorular/*.json, cards/*.json,
// exam-blueprint/*.json) yerini alır. app.js'in geri kalanı değişmesin diye
// her fonksiyon, ilgili JSON dosyasıyla AYNI ŞEKLİ döndürür.
//
// Eşleme mantığı: her topics/card_decks satırı, geldiği orijinal dosya yolunu
// `source_file` sütununda taşır (ör. 'sorular/questions-657.json'). app.js hâlâ
// bu yol string'lerini kullanıyor (categorytopics.json'daki questionFile alanı
// gibi); biz de bu string'i anahtar olarak kullanıp Supabase'den karşılığını
// buluyoruz. Admin panelinde içerik id üzerinden düzenlenir, bu dosya yolları
// sadece app.js'in eski arayüzüyle uyumluluk için var.

const ContentRepo = (() => {
  const client = supabaseClient;

  function mapQuestionRow(row) {
    return { id: row.id, prompt: row.prompt, options: row.options, answerIndex: row.answer_index };
  }

  // ---- categorytopics.json karşılığı -------------------------------------
  async function fetchCatalogue() {
    const [{ data: categories, error: catErr }, { data: topics, error: topicErr }] = await Promise.all([
      client.from('categories').select('*').order('sort_order'),
      client.from('topics').select('*').order('sort_order')
    ]);
    if (catErr) throw catErr;
    if (topicErr) throw topicErr;

    const byParent = new Map();
    topics.forEach(t => {
      const key = t.parent_id || `root:${t.category_id}`;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(t);
    });

    function buildNode(row) {
      const node = { id: row.id, type: row.type, title: row.title };
      if (row.document_number) node.documentNumber = row.document_number;
      if (row.article_range) node.articleRange = row.article_range;
      if (row.article_count != null) node.articleCount = row.article_count;
      if (row.question_count != null) node.questionCount = row.question_count;
      if (row.kadrolar?.length) node.kadrolar = row.kadrolar;
      if (row.source_file) node.questionFile = row.source_file;
      const children = byParent.get(row.id);
      if (children?.length) node.children = children.map(buildNode);
      return node;
    }

    const result = {};
    categories.forEach(cat => {
      const topLevel = byParent.get(`root:${cat.id}`) || [];
      result[cat.id] = {
        title: cat.title,
        subtitle: cat.subtitle,
        icon: cat.icon,
        iconClass: cat.icon_class,
        topics: topLevel.map(buildNode)
      };
    });
    return result;
  }

  // ---- sorular/*.json ve taxonomy'nin 'sorular'/'cards' (quiz) kaynakları --
  // documentItem.questionFile ya da (kart pratiği) topic.questionFile ile
  // çağrılır; hangi tablodan geldiğine bakmaksızın aynı {questions:[...]} şeklini döner.
  async function fetchQuestionsByPath(path) {
    const { data: topic } = await client.from('topics').select('id, title').eq('source_file', path).maybeSingle();
    if (topic) {
      const { data, error } = await client.from('questions').select('*').eq('topic_id', topic.id).order('sort_order');
      if (error) throw error;
      return { topicId: topic.id, title: topic.title, questions: data.map(mapQuestionRow) };
    }
    const { data: deck } = await client.from('card_decks').select('id, title').eq('source_file', path).eq('deck_type', 'quiz').maybeSingle();
    if (deck) {
      const { data, error } = await client.from('card_questions').select('*').eq('deck_id', deck.id).order('sort_order');
      if (error) throw error;
      return { topicId: deck.id, title: deck.title, questions: data.map(mapQuestionRow) };
    }
    throw new Error(`Soru kaynağı bulunamadı: ${path}`);
  }

  // ---- cards/*.json (flip flashcard) karşılığı ----------------------------
  // loadCardDeck(doc) -> doc.cardFile ile çağrılır; {cards:[{question,answer}]} döner.
  async function fetchFlashcardsByPath(path) {
    const { data: deck, error: deckErr } = await client.from('card_decks').select('id').eq('source_file', path).eq('deck_type', 'flashcard').maybeSingle();
    if (deckErr) throw deckErr;
    if (!deck) throw new Error(`Kart destesi bulunamadı: ${path}`);
    const { data, error } = await client.from('flashcards').select('question, answer').eq('deck_id', deck.id).order('sort_order');
    if (error) throw error;
    return { cards: data };
  }

  // ---- exam-blueprint/topics-taxonomy.json karşılığı -----------------------
  async function fetchExamTaxonomy() {
    const { data: examTopics, error } = await client
      .from('exam_topics')
      .select('topic_id, title, category_id, status, question_source, linked_topic_id, card_deck_id, topics!exam_topics_linked_topic_id_fkey(source_file), card_decks!exam_topics_card_deck_id_fkey(source_file)')
      .order('sort_order');
    if (error) throw error;
    const topics = {};
    examTopics.forEach(t => {
      const questionFile = t.question_source === 'cards' ? t.card_decks?.source_file : t.topics?.source_file;
      topics[t.topic_id] = {
        title: t.title,
        category: t.category_id,
        questionFile,
        status: t.status
      };
    });
    return { topics };
  }

  // ---- exam-blueprint/exam-blueprint.json karşılığı ------------------------
  async function fetchExamBlueprint() {
    const [{ data: kadrolar, error: kErr }, { data: items, error: iErr }] = await Promise.all([
      client.from('exam_kadrolar').select('*'),
      client.from('exam_blueprint_items').select('*').order('sort_order')
    ]);
    if (kErr) throw kErr;
    if (iErr) throw iErr;
    const byKadro = new Map();
    items.forEach(item => {
      if (!byKadro.has(item.kadro)) byKadro.set(item.kadro, []);
      byKadro.get(item.kadro).push({ topicId: item.topic_id, count: item.question_count });
    });
    const result = {};
    kadrolar.forEach(k => {
      result[k.kadro] = { durationMinutes: k.duration_minutes, topics: byKadro.get(k.kadro) || [] };
    });
    return result;
  }

  return { fetchCatalogue, fetchQuestionsByPath, fetchFlashcardsByPath, fetchExamTaxonomy, fetchExamBlueprint };
})();
