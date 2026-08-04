// ================= SınavRotası — Admin Paneli =================
// Bağımsız sayfa: app.js'e dokunmaz, aynı supabaseClient.js'i paylaşır.
// Erişim: sadece profiles.is_admin = true olan kullanıcılar (RLS zaten
// veritabanı seviyesinde yazmayı engelliyor; buradaki kontrol sadece UX içindir).

const KADRO_LABELS = { memur: 'Memur', sef: 'Şef', sayman: 'Sayman', 'sube-mudur': 'Şube Müdürü' };
function kadroLabel(k) { return KADRO_LABELS[k] || k; }

let activeTab = 'questions';           // 'questions' | 'denemeler' | 'topics'

// ---- Sorular sekmesi state'i ----
let currentTopicId = null;
let currentTopicTitle = '';
let topicsById = {};                    // id -> topic row
let childrenByParent = {};              // parent_id -> [topic row]
let categoriesCache = [];
let topicOptionsFlat = [];              // [{id,title,depth}] — modal <select> için ağaç sırasıyla
let editingQuestionId = null;

// ---- Denemeler sekmesi state'i ----
let currentKadro = null;                // null => tüm kadrolar
let kadroRows = [];                     // exam_kadrolar satırları
let editingDenemeId = null;

// ---- Konular sekmesi state'i ----
const TOPIC_TYPE_LABELS = { topic: 'Konu', document: 'Kanun / Belge', section: 'Bölüm' };
let manageCategoryId = null;            // Konular sekmesinde seçili kategori
let manageParentId = null;              // null => kategori kökü
let editingTopicId = null;
let newTopicParentId = null;            // "+ Ekle" tıklandığında hedef parent
let newTopicCategoryId = null;
let editingCategoryId = null;

// ========================= 1) Giriş / admin kontrolü =========================
async function boot() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const { data: profile, error } = await supabaseClient
    .from('profiles').select('is_admin').eq('id', session.user.id).maybeSingle();

  if (error || !profile?.is_admin) {
    document.getElementById('authGate').textContent = 'Bu sayfaya erişim yetkiniz yok.';
    return;
  }

  document.getElementById('adminEmail').textContent = session.user.email || '';
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('adminApp').classList.add('ready');

  document.querySelectorAll('.tabs button').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  await Promise.all([loadTopics(), loadKadrolar()]);
  switchTab('questions');
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
});

// ========================= 2) Sekme geçişi =========================
function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  if (tab === 'questions') {
    document.getElementById('mainActions').innerHTML =
      '<button class="btn secondary" id="bulkQuestionBtn" type="button">+ Toplu Soru Ekle</button>' +
      '<button class="btn" id="newQuestionBtn" type="button">+ Yeni Soru</button>';
    document.getElementById('newQuestionBtn').addEventListener('click', () => openQuestionModal(null));
    document.getElementById('bulkQuestionBtn').addEventListener('click', () => openBulkModal());
    renderTopicTree();
    if (currentTopicId) {
      document.getElementById('mainTitle').textContent = currentTopicTitle;
      loadQuestions();
    } else {
      document.getElementById('mainTitle').textContent = 'Bir konu seçin';
      document.getElementById('mainSub').textContent = '';
      document.getElementById('content').innerHTML = '<div class="empty-state">Soldan bir konu seçerek sorularını görüntüleyin.</div>';
    }
  } else if (tab === 'denemeler') {
    document.getElementById('mainActions').innerHTML =
      '<button class="btn" id="newDenemeBtn" type="button">+ Yeni Deneme</button>';
    document.getElementById('newDenemeBtn').addEventListener('click', () => openDenemeModal(null));
    renderKadroSidebar();
    document.getElementById('mainTitle').textContent = currentKadro ? `${kadroLabel(currentKadro)} denemeleri` : 'Tüm denemeler';
    document.getElementById('mainSub').textContent = '';
    loadDenemeler();
  } else {
    document.getElementById('mainActions').innerHTML =
      '<button class="btn" id="newCategoryBtn" type="button">+ Yeni Kategori</button>';
    document.getElementById('newCategoryBtn').addEventListener('click', () => openCategoryModal(null));
    renderCategorySidebar();
    if (manageCategoryId) {
      renderManageContent();
    } else {
      document.getElementById('mainTitle').textContent = 'Bir kategori seçin';
      document.getElementById('mainSub').textContent = '';
      document.getElementById('content').innerHTML = '<div class="empty-state">Soldan bir kategori seçin, ya da yeni bir kategori oluşturun.</div>';
    }
  }
}

// ========================= 3) Konu ağacı (paylaşılan veri) =========================
async function loadTopics() {
  const [{ data: categories, error: catErr }, { data: topics, error: topicErr }] = await Promise.all([
    supabaseClient.from('categories').select('id,title,subtitle,sort_order').order('sort_order'),
    supabaseClient.from('topics').select('id,category_id,parent_id,type,title,document_number,article_range,question_count,kadrolar,sort_order').order('sort_order')
  ]);

  if (catErr || topicErr) {
    document.getElementById('sidePanel').innerHTML = `<div class="empty-state">Konular yüklenemedi: ${escapeHtml((catErr || topicErr).message)}</div>`;
    return;
  }

  categoriesCache = categories;
  topicsById = {};
  childrenByParent = {};
  const byCategory = {};
  topics.forEach(t => {
    topicsById[t.id] = t;
    if (t.parent_id) {
      (childrenByParent[t.parent_id] = childrenByParent[t.parent_id] || []).push(t);
    } else {
      (byCategory[t.category_id] = byCategory[t.category_id] || []).push(t);
    }
  });

  // Modal <select> için düz, ağaç sıralı liste
  topicOptionsFlat = [];
  categories.forEach(cat => {
    function walk(list, depth) {
      (list || []).forEach(t => {
        topicOptionsFlat.push({ id: t.id, title: t.title, depth });
        walk(childrenByParent[t.id], depth + 1);
      });
    }
    walk(byCategory[cat.id], 0);
  });

  window.__byCategory = byCategory; // renderTopicTree içinde kullanılacak
}

function collectDescendantTopicIds(rootId) {
  const ids = [rootId];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop();
    (childrenByParent[cur] || []).forEach(child => { ids.push(child.id); stack.push(child.id); });
  }
  return ids;
}

function renderTopicTree() {
  const panel = document.getElementById('sidePanel');
  const byCategory = window.__byCategory || {};

  if (!categoriesCache.length) {
    panel.innerHTML = '<div class="empty-state">Henüz kategori yok.</div>';
    return;
  }

  panel.innerHTML = '';
  categoriesCache.forEach(cat => {
    const block = document.createElement('div');
    block.className = 'cat-block';
    const title = document.createElement('div');
    title.className = 'cat-title';
    title.textContent = cat.title;
    block.appendChild(title);

    // Yeni: Ağacı iç içe (nested) oluşturacak recursive fonksiyon
    function buildNode(list, depth, parentContainer) {
      (list || []).forEach(t => {
        const hasChildren = childrenByParent[t.id] && childrenByParent[t.id].length > 0;

        const wrapper = document.createElement('div');
        wrapper.className = 'tree-node-wrapper';

        const node = document.createElement('div');
        node.className = `tree-node depth-${depth}${t.id === currentTopicId ? ' active' : ''}`;
        node.dataset.topicId = t.id;

        // Alt konusu varsa ok işareti, yoksa boşluk ekle
        const iconHtml = hasChildren 
          ? `<span class="toggle-icon">▼</span>` 
          : `<span class="toggle-spacer"></span>`;
        
        node.innerHTML = `${iconHtml}<span class="node-title">${escapeHtml(t.title)}</span>${t.question_count != null ? `<span class="qcount">${t.question_count}</span>` : ''}`;

        // Tıklama event'i: Ok ikonuna tıklanırsa aç/kapat, metne tıklanırsa konuyu seç
        node.addEventListener('click', (e) => {
          if (e.target.classList.contains('toggle-icon')) {
            e.stopPropagation();
            wrapper.classList.toggle('collapsed');
          } else {
            selectTopic(t.id, t.title);
          }
        });

        wrapper.appendChild(node);

        if (hasChildren) {
          const childrenContainer = document.createElement('div');
          childrenContainer.className = 'tree-children';
          buildNode(childrenByParent[t.id], depth + 1, childrenContainer);
          wrapper.appendChild(childrenContainer);
        }

        parentContainer.appendChild(wrapper);
      });
    }

    buildNode(byCategory[cat.id], 0, block);
    panel.appendChild(block);
  });
}

function selectTopic(topicId, title) {
  currentTopicId = topicId;
  currentTopicTitle = title;
  document.querySelectorAll('.tree-node').forEach(n => n.classList.toggle('active', n.dataset.topicId === topicId));
  document.getElementById('mainTitle').textContent = title;
  loadQuestions();
}

// ========================= 4) Sorular listesi =========================
async function loadQuestions() {
  const contentEl = document.getElementById('content');
  contentEl.innerHTML = '<div class="empty-state">Yükleniyor…</div>';

  const { data: questions, error } = await supabaseClient
    .from('questions')
    .select('id,prompt,options,answer_index,explanation,sort_order')
    .eq('topic_id', currentTopicId)
    .order('sort_order');

  if (error) {
    contentEl.innerHTML = `<div class="empty-state">Sorular yüklenemedi: ${escapeHtml(error.message)}</div>`;
    return;
  }

  document.getElementById('mainSub').textContent = `${questions.length} soru`;

  if (!questions.length) {
    contentEl.innerHTML = '<div class="empty-state">Bu konuda henüz soru yok. "Yeni Soru" ile ekleyin.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'q-table';
  table.innerHTML = `
    <thead><tr><th style="width:44%">Soru</th><th style="width:38%">Şıklar</th><th></th></tr></thead>
    <tbody></tbody>`;
  const tbody = table.querySelector('tbody');

  questions.forEach(q => {
    const tr = document.createElement('tr');
    const optionsHtml = (q.options || []).map((opt, i) =>
      `<div class="${i === q.answer_index ? 'correct' : ''}">${i === q.answer_index ? '✓ ' : ''}${escapeHtml(opt)}</div>`
    ).join('');
    tr.innerHTML = `
      <td class="q-prompt">${escapeHtml(q.prompt)}</td>
      <td class="q-options">${optionsHtml}</td>
      <td class="row-actions">
        <button type="button" class="edit">Düzenle</button>
        <button type="button" class="del">Sil</button>
      </td>`;
    tr.querySelector('.edit').addEventListener('click', () => openQuestionModal(q));
    tr.querySelector('.del').addEventListener('click', () => deleteQuestion(q.id));
    tbody.appendChild(tr);
  });

  contentEl.innerHTML = '';
  contentEl.appendChild(table);
}

async function deleteQuestion(id) {
  if (!confirm('Bu soruyu silmek istediğinize emin misiniz?')) return;
  const { error } = await supabaseClient.from('questions').delete().eq('id', id);
  if (error) { alert('Silinemedi: ' + error.message); return; }
  loadQuestions();
}

// ========================= 5) Soru ekle/düzenle modalı =========================
const modalBackdrop = document.getElementById('modalBackdrop');
const questionForm = document.getElementById('questionForm');
const formError = document.getElementById('formError');
const fTopicSelect = document.getElementById('fTopic');

document.getElementById('modalCancelBtn').addEventListener('click', closeQuestionModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeQuestionModal(); });

function populateTopicSelect(selectedId) {
  fTopicSelect.innerHTML = topicOptionsFlat.map(t =>
    `<option value="${t.id}">${' '.repeat(t.depth)}${escapeHtml(t.title)}</option>`
  ).join('');
  if (selectedId) fTopicSelect.value = selectedId;
}

function openQuestionModal(question) {
  editingQuestionId = question ? question.id : null;
  document.getElementById('modalTitle').textContent = question ? 'Soruyu Düzenle' : 'Yeni Soru';
  formError.classList.remove('show');

  // DÜZELTME: düzenlerken sorunun kendi topic_id'sini kullan, currentTopicId'i değil.
  // Böylece bu modal ileride "tüm sorular" gibi farklı bir listeden çağrılsa bile
  // yanlış konuyu seçili göstermez.
  populateTopicSelect(question ? question.topic_id : (currentTopicId || (topicOptionsFlat[0] && topicOptionsFlat[0].id)));

  document.getElementById('fPrompt').value = question?.prompt || '';
  document.getElementById('fExplanation').value = question?.explanation || '';
  for (let i = 0; i < 4; i++) {
    document.getElementById(`fOpt${i}`).value = question?.options?.[i] || '';
  }
  const correctIndex = question?.answer_index ?? 0;
  const radio = questionForm.querySelector(`input[name=fCorrect][value="${correctIndex}"]`);
  if (radio) radio.checked = true;

  modalBackdrop.classList.add('open');
  document.getElementById('fPrompt').focus();
}

function closeQuestionModal() {
  modalBackdrop.classList.remove('open');
  questionForm.reset();
  editingQuestionId = null;
}

questionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.remove('show');

  const topicId = fTopicSelect.value;
  const prompt = document.getElementById('fPrompt').value.trim();
  const options = [0, 1, 2, 3].map(i => document.getElementById(`fOpt${i}`).value.trim());
  const explanation = document.getElementById('fExplanation').value.trim();
  const answerIndex = Number(questionForm.querySelector('input[name=fCorrect]:checked').value);

  if (!topicId || !prompt || options.some(o => !o)) {
    formError.textContent = 'Konu, soru metni ve tüm şıklar zorunludur.';
    formError.classList.add('show');
    return;
  }

  const saveBtn = document.getElementById('modalSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Kaydediliyor…';

  let error;
  if (editingQuestionId) {
    ({ error } = await supabaseClient
      .from('questions')
      .update({ topic_id: topicId, prompt, options, answer_index: answerIndex, explanation: explanation || null })
      .eq('id', editingQuestionId));
  } else {
    const id = `${topicId}-${Date.now().toString(36)}`;
    ({ error } = await supabaseClient
      .from('questions')
      .insert({ id, topic_id: topicId, prompt, options, answer_index: answerIndex, explanation: explanation || null }));
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Kaydet';

  if (error) {
    formError.textContent = 'Kaydedilemedi: ' + error.message;
    formError.classList.add('show');
    return;
  }

  closeQuestionModal();
  const topic = topicsById[topicId];
  selectTopic(topicId, topic ? topic.title : currentTopicTitle);
});

// ========================= 5b) Toplu soru ekleme modalı =========================
const bulkModalBackdrop = document.getElementById('bulkModalBackdrop');
const bulkForm = document.getElementById('bulkForm');
const bulkError = document.getElementById('bulkError');
const bTopicSelect = document.getElementById('bTopic');
const bSubtopicField = document.getElementById('bSubtopicField');
const bSubtopicSelect = document.getElementById('bSubtopic');
const bJsonInput = document.getElementById('bJson');
const bFileInput = document.getElementById('bFile');

document.getElementById('bulkModalCancelBtn').addEventListener('click', closeBulkModal);
bulkModalBackdrop.addEventListener('click', (e) => { if (e.target === bulkModalBackdrop) closeBulkModal(); });
document.getElementById('bulkTemplateLink').addEventListener('click', (e) => { e.preventDefault(); downloadBulkTemplate(); });
bTopicSelect.addEventListener('change', () => populateBulkSubtopics(bTopicSelect.value));

// bTopic: sadece kök konular (her kategorinin altındaki üst düzey topic/document'lar), kategoriye göre gruplu.
// bSubtopic: seçilen kök konunun varsa doğrudan alt konuları (bölümler). Yoksa alan gizlenir.
function populateBulkTopicRoots(selectedRootId) {
  const byCategory = window.__byCategory || {};
  bTopicSelect.innerHTML = categoriesCache.map(cat => {
    const roots = byCategory[cat.id] || [];
    if (!roots.length) return '';
    const opts = roots.map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');
    return `<optgroup label="${escapeHtml(cat.title)}">${opts}</optgroup>`;
  }).join('');
  if (selectedRootId) bTopicSelect.value = selectedRootId;
}

function populateBulkSubtopics(rootId) {
  const children = childrenByParent[rootId] || [];
  if (!children.length) {
    bSubtopicField.style.display = 'none';
    bSubtopicSelect.innerHTML = '';
    return;
  }
  bSubtopicSelect.innerHTML = children.map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');
  bSubtopicField.style.display = '';
}

function openBulkModal() {
  bulkError.classList.remove('show');
  bJsonInput.value = '';
  bFileInput.value = '';

  // Şu an seçili konu bir alt bölümse (parent_id var), önce üst konuyu, sonra alt konuyu seçili getir.
  const current = currentTopicId ? topicsById[currentTopicId] : null;
  const rootId = current && current.parent_id ? current.parent_id : currentTopicId;

  populateBulkTopicRoots(rootId);
  populateBulkSubtopics(bTopicSelect.value);
  if (current && current.parent_id) bSubtopicSelect.value = current.id;

  bulkModalBackdrop.classList.add('open');
}

function closeBulkModal() {
  bulkModalBackdrop.classList.remove('open');
  bulkForm.reset();
  bSubtopicField.style.display = 'none';
}

function selectedBulkTopicId() {
  return (bSubtopicField.style.display !== 'none' && bSubtopicSelect.value) ? bSubtopicSelect.value : bTopicSelect.value;
}


// Excel şablonunu tarayıcıda oluşturup indirir (SheetJS).
function downloadBulkTemplate() {
  const rows = [
    ['Soru', 'Şık A', 'Şık B', 'Şık C', 'Şık D', 'Doğru Şık', 'Açıklama'],
    ['657 sayılı DMK kaç yılında kabul edilmiştir?', '1965', '1970', '1975', '1980', 'A', 'Opsiyonel açıklama buraya yazılabilir.']
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sorular');
  XLSX.writeFile(wb, 'soru-sablonu.xlsx');
}

const ANSWER_LETTER_MAP = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 };

function answerToIndex(raw, optionCount) {
  const v = String(raw ?? '').trim();
  if (v === '') return NaN;
  if (v.toUpperCase() in ANSWER_LETTER_MAP) return ANSWER_LETTER_MAP[v.toUpperCase()];
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

// Excel/CSV dosyasını okuyup soru satırlarına çevirir.
// Beklenen sütunlar: Soru, Şık A, Şık B, Şık C, Şık D, Doğru Şık, Açıklama
function excelRowsToQuestions(sheetRows, topicId) {
  if (!sheetRows.length) throw new Error('Excel dosyasında veri satırı bulunamadı.');

  return sheetRows.map((row, i) => {
    const n = i + 2; // 1. satır başlık, veri Excel'de 2. satırdan başlar
    const prompt = String(row['Soru'] || '').trim();
    const options = ['Şık A', 'Şık B', 'Şık C', 'Şık D', 'Şık E', 'Şık F']
      .map(k => (row[k] != null ? String(row[k]).trim() : ''))
      .filter(o => o !== '');
    const answerIndex = answerToIndex(row['Doğru Şık'], options.length);
    const explanation = row['Açıklama'] ? String(row['Açıklama']).trim() : null;

    if (!prompt) throw new Error(`Satır ${n}: "Soru" sütunu boş olamaz.`);
    if (options.length < 2) throw new Error(`Satır ${n}: en az 2 dolu şık sütunu (Şık A, Şık B, ...) gerekli.`);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      throw new Error(`Satır ${n}: "Doğru Şık" değeri geçersiz (A-${String.fromCharCode(65 + options.length - 1)} veya 0-${options.length - 1} olmalı).`);
    }

    return {
      id: `${topicId}-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      topic_id: topicId,
      prompt,
      options,
      answer_index: answerIndex,
      explanation
    };
  });
}

function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve(rows);
      } catch (err) {
        reject(new Error('Dosya okunamadı: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsArrayBuffer(file);
  });
}

// Beklenen JSON formatı (gelişmiş/opsiyonel yol), her eleman:
// { "prompt": "...", "options": ["A","B","C","D"], "answerIndex": 0, "explanation": "..." (opsiyonel) }
function parseBulkQuestionsJson(raw, topicId) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error('Geçersiz JSON: ' + e.message);
  }
  if (!Array.isArray(parsed)) throw new Error('JSON bir dizi ([...]) olmalı.');
  if (!parsed.length) throw new Error('Dizi boş.');

  return parsed.map((q, i) => {
    const n = i + 1;
    if (!q || typeof q !== 'object') throw new Error(`#${n}: geçersiz soru nesnesi.`);
    const prompt = String(q.prompt || '').trim();
    const options = Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [];
    const answerIndex = Number(q.answerIndex ?? q.answer_index);
    const explanation = q.explanation ? String(q.explanation).trim() : null;

    if (!prompt) throw new Error(`#${n}: "prompt" zorunlu.`);
    if (options.length < 2 || options.some(o => !o)) throw new Error(`#${n}: "options" en az 2 dolu şık içermeli.`);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
      throw new Error(`#${n}: "answerIndex" geçerli bir şık indeksi olmalı (0-${options.length - 1}).`);
    }

    return {
      id: `${topicId}-${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      topic_id: topicId,
      prompt,
      options,
      answer_index: answerIndex,
      explanation
    };
  });
}

bulkForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  bulkError.classList.remove('show');

  const topicId = selectedBulkTopicId();
  const file = bFileInput.files[0];

  let rows;
  try {
    if (file) {
      const sheetRows = await readExcelFile(file);
      rows = excelRowsToQuestions(sheetRows, topicId);
    } else if (bJsonInput.value.trim()) {
      rows = parseBulkQuestionsJson(bJsonInput.value, topicId);
    } else {
      throw new Error('Bir Excel dosyası seçin veya JSON alanına soruları yapıştırın.');
    }
  } catch (err) {
    bulkError.textContent = err.message;
    bulkError.classList.add('show');
    return;
  }

  const saveBtn = document.getElementById('bulkModalSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Kaydediliyor…';

  const { error } = await supabaseClient.from('questions').insert(rows);

  saveBtn.disabled = false;
  saveBtn.textContent = 'Kaydet';

  if (error) {
    bulkError.textContent = 'Kaydedilemedi: ' + error.message;
    bulkError.classList.add('show');
    return;
  }

  const topicLabel = topicsById[topicId] ? topicsById[topicId].title : topicId;
  closeBulkModal();
  if (currentTopicId === topicId) loadQuestions();
  else alert(`${rows.length} soru "${topicLabel}" konusuna eklendi.`);
});



// ========================= 6) Denemeler: kadro sidebar + liste =========================
async function loadKadrolar() {
  const { data, error } = await supabaseClient.from('exam_kadrolar').select('kadro,duration_minutes').order('kadro');
  if (error) { kadroRows = []; return; }
  kadroRows = data;
}

function renderKadroSidebar() {
  const panel = document.getElementById('sidePanel');
  panel.innerHTML = '';

  const allNode = document.createElement('div');
  allNode.className = `tree-node${currentKadro === null ? ' active' : ''}`;
  allNode.textContent = 'Tüm Kadrolar';
  allNode.addEventListener('click', () => selectKadro(null));
  panel.appendChild(allNode);

  const block = document.createElement('div');
  block.className = 'cat-block';
  const title = document.createElement('div');
  title.className = 'cat-title';
  title.textContent = 'Kadrolar';
  block.appendChild(title);

  kadroRows.forEach(k => {
    const node = document.createElement('div');
    node.className = `tree-node${currentKadro === k.kadro ? ' active' : ''}`;
    node.textContent = `${kadroLabel(k.kadro)} (${k.duration_minutes} dk)`;
    node.addEventListener('click', () => selectKadro(k.kadro));
    block.appendChild(node);
  });
  panel.appendChild(block);
}

function selectKadro(kadro) {
  currentKadro = kadro;
  renderKadroSidebar();
  document.getElementById('mainTitle').textContent = kadro ? `${kadroLabel(kadro)} denemeleri` : 'Tüm denemeler';
  loadDenemeler();
}

async function loadDenemeler() {
  const contentEl = document.getElementById('content');
  contentEl.innerHTML = '<div class="empty-state">Yükleniyor…</div>';

  let query = supabaseClient
    .from('denemeler')
    .select('id,title,kadro,duration_minutes,is_published,sort_order,deneme_questions(count)')
    .order('sort_order');
  if (currentKadro) query = query.eq('kadro', currentKadro);

  const { data: denemeler, error } = await query;
  if (error) {
    contentEl.innerHTML = `<div class="empty-state">Denemeler yüklenemedi: ${escapeHtml(error.message)}</div>`;
    return;
  }

  document.getElementById('mainSub').textContent = `${denemeler.length} deneme`;

  if (!denemeler.length) {
    contentEl.innerHTML = '<div class="empty-state">Henüz deneme yok. "Yeni Deneme" ile oluşturun.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'q-table';
  table.innerHTML = `
    <thead><tr><th>Başlık</th><th>Kadro</th><th>Süre</th><th>Soru</th><th>Durum</th><th></th></tr></thead>
    <tbody></tbody>`;
  const tbody = table.querySelector('tbody');

  denemeler.forEach(d => {
    const qCount = d.deneme_questions?.[0]?.count ?? 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(d.title)}</td>
      <td>${kadroLabel(d.kadro)}</td>
      <td>${d.duration_minutes} dk</td>
      <td>${qCount}</td>
      <td><span class="badge ${d.is_published ? 'yes' : 'no'}">${d.is_published ? 'Yayında' : 'Taslak'}</span></td>
      <td class="row-actions">
        <button type="button" class="edit">Düzenle</button>
        <button type="button" class="del">Sil</button>
      </td>`;
    tr.querySelector('.edit').addEventListener('click', () => openDenemeModal(d));
    tr.querySelector('.del').addEventListener('click', () => deleteDeneme(d.id, d.title));
    tbody.appendChild(tr);
  });

  contentEl.innerHTML = '';
  contentEl.appendChild(table);
}

async function deleteDeneme(id, title) {
  if (!confirm(`"${title}" denemesini silmek istediğinize emin misiniz? Bu işlemi geri alamazsınız.`)) return;
  const { error } = await supabaseClient.from('denemeler').delete().eq('id', id);
  if (error) { alert('Silinemedi: ' + error.message); return; }
  loadDenemeler();
}

// ========================= 7) Deneme ekle/düzenle modalı =========================
const denemeModalBackdrop = document.getElementById('denemeModalBackdrop');
const denemeForm = document.getElementById('denemeForm');
const denemeFormError = document.getElementById('denemeFormError');
const dKadroSelect = document.getElementById('dKadro');
const dDurationInput = document.getElementById('dDuration');
const regenerateBtn = document.getElementById('regenerateBtn');

document.getElementById('denemeModalCancelBtn').addEventListener('click', closeDenemeModal);
denemeModalBackdrop.addEventListener('click', (e) => { if (e.target === denemeModalBackdrop) closeDenemeModal(); });

dKadroSelect.addEventListener('change', () => {
  const row = kadroRows.find(k => k.kadro === dKadroSelect.value);
  if (row && !editingDenemeId) dDurationInput.value = row.duration_minutes;
});

function openDenemeModal(deneme) {
  editingDenemeId = deneme ? deneme.id : null;
  denemeFormError.classList.remove('show');
  document.getElementById('denemeQuestionInfo').textContent = '';

  document.getElementById('denemeModalTitle').textContent = deneme ? 'Denemeyi Düzenle' : 'Yeni Deneme';
  dKadroSelect.innerHTML = kadroRows.map(k => `<option value="${k.kadro}">${kadroLabel(k.kadro)}</option>`).join('');

  document.getElementById('dTitle').value = deneme?.title || '';
  dKadroSelect.value = deneme?.kadro || currentKadro || (kadroRows[0] && kadroRows[0].kadro) || '';
  dKadroSelect.disabled = !!deneme;
  dDurationInput.value = deneme?.duration_minutes ?? (kadroRows.find(k => k.kadro === dKadroSelect.value)?.duration_minutes || 75);
  document.getElementById('dPublished').checked = !!deneme?.is_published;

  regenerateBtn.style.display = deneme ? 'inline-block' : 'none';
  document.getElementById('denemeModalSaveBtn').textContent = deneme ? 'Kaydet' : 'Oluştur ve Soruları Çek';

  if (deneme) {
    document.getElementById('denemeQuestionInfo').textContent =
      'Sorular kadroya göre kılavuz sırasıyla otomatik çekilmişti. Havuz güncellendiyse "Soruları Yeniden Oluştur" ile tazeleyebilirsiniz.';
  } else {
    document.getElementById('denemeQuestionInfo').textContent =
      'Kaydedince sorular, seçilen kadronun sınav planındaki konu sırasına göre soru havuzundan otomatik seçilecek.';
  }

  denemeModalBackdrop.classList.add('open');
  document.getElementById('dTitle').focus();
}

function closeDenemeModal() {
  denemeModalBackdrop.classList.remove('open');
  denemeForm.reset();
  editingDenemeId = null;
}

regenerateBtn.addEventListener('click', async () => {
  if (!editingDenemeId) return;
  if (!confirm('Bu denemenin mevcut soruları silinip kadronun sınav planına göre yeniden çekilecek. Devam edilsin mi?')) return;

  regenerateBtn.disabled = true;
  regenerateBtn.textContent = 'Oluşturuluyor…';
  try {
    const kadro = dKadroSelect.value;

    // DÜZELTME: önce eski soruları yedekle, yeni soruları ÜRETMEDEN ÖNCE SİLME.
    // generateDenemeQuestions() içindeki sorgular başarısız olursa (ör. sınav
    // planı eksikse) eski sorular kaybolmasın diye önce mevcut satırları
    // hafızada tutuyoruz; insert başarılı olduktan sonra eskileri temizliyoruz.
    const { data: oldRows, error: fetchErr } = await supabaseClient
      .from('deneme_questions')
      .select('id')
      .eq('deneme_id', editingDenemeId);
    if (fetchErr) throw fetchErr;

    const summary = await generateDenemeQuestions(editingDenemeId, kadro, { skipInsertIfEmpty: true });

    // Yeni sorular üretilebildiyse (ya da bilinçli olarak boş sonuç kabul edildiyse)
    // şimdi eski satırları sil.
    if (oldRows && oldRows.length) {
      const oldIds = oldRows.map(r => r.id);
      const { error: delErr } = await supabaseClient.from('deneme_questions').delete().in('id', oldIds);
      if (delErr) throw delErr;
    }

    reportGenerationSummary(summary);
  } catch (err) {
    alert('Sorular yeniden oluşturulamadı, mevcut sorular korundu: ' + err.message);
  } finally {
    regenerateBtn.disabled = false;
    regenerateBtn.textContent = 'Soruları Yeniden Oluştur';
  }
});

denemeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  denemeFormError.classList.remove('show');

  const title = document.getElementById('dTitle').value.trim();
  const kadro = dKadroSelect.value;
  const duration = Number(dDurationInput.value);
  const isPublished = document.getElementById('dPublished').checked;

  if (!title || !kadro || !duration) {
    denemeFormError.textContent = 'Başlık, kadro ve süre zorunludur.';
    denemeFormError.classList.add('show');
    return;
  }

  const saveBtn = document.getElementById('denemeModalSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Kaydediliyor…';

  let insertedId = null;
  try {
    if (editingDenemeId) {
      const { error } = await supabaseClient
        .from('denemeler')
        .update({ title, duration_minutes: duration, is_published: isPublished })
        .eq('id', editingDenemeId);
      if (error) throw error;
      closeDenemeModal();
      loadDenemeler();
    } else {
      const { data: inserted, error } = await supabaseClient
        .from('denemeler')
        .insert({ title, kadro, duration_minutes: duration, is_published: isPublished })
        .select('id')
        .single();
      if (error) throw error;
      insertedId = inserted.id;

      saveBtn.textContent = 'Sorular çekiliyor…';
      const summary = await generateDenemeQuestions(insertedId, kadro);
      closeDenemeModal();
      loadDenemeler();
      reportGenerationSummary(summary);
    }
  } catch (err) {
    // DÜZELTME: deneme kaydı oluşturuldu ama soru çekme başarısız olduysa,
    // yarım kalmış (0 sorulu) denemeyi geride bırakmamak için sil.
    if (insertedId) {
      await supabaseClient.from('denemeler').delete().eq('id', insertedId).then(
        () => {}, () => {}
      ).catch(() => {});
    }
    denemeFormError.textContent = 'Kaydedilemedi: ' + err.message;
    denemeFormError.classList.add('show');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingDenemeId ? 'Kaydet' : 'Oluştur ve Soruları Çek';
  }
});

// ========================= 8) Konular sekmesi: kategori + konu ağacı yönetimi =========================
function renderCategorySidebar() {
  const panel = document.getElementById('sidePanel');
  panel.innerHTML = '';

  if (!categoriesCache.length) {
    panel.innerHTML = '<div class="empty-state">Henüz kategori yok. "+ Yeni Kategori" ile oluşturun.</div>';
    return;
  }

  const block = document.createElement('div');
  block.className = 'cat-block';
  categoriesCache.forEach(cat => {
    const node = document.createElement('div');
    node.className = `tree-node${cat.id === manageCategoryId ? ' active' : ''}`;
    node.textContent = cat.title;
    node.addEventListener('click', () => selectManageCategory(cat.id));
    block.appendChild(node);
  });
  panel.appendChild(block);
}

function selectManageCategory(categoryId) {
  manageCategoryId = categoryId;
  manageParentId = null;
  renderCategorySidebar();
  renderManageContent();
}

// Kökten (kategori) verilen konuya kadar olan zinciri döner.
function getBreadcrumbChain(topicId) {
  const chain = [];
  let cur = topicId ? topicsById[topicId] : null;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parent_id ? topicsById[cur.parent_id] : null;
  }
  return chain;
}

function openManageNode(topicId) {
  manageParentId = topicId;
  renderManageContent();
}

function renderManageContent() {
  const contentEl = document.getElementById('content');
  const category = categoriesCache.find(c => c.id === manageCategoryId);
  if (!category) { contentEl.innerHTML = '<div class="empty-state">Kategori bulunamadı.</div>'; return; }

  const chain = getBreadcrumbChain(manageParentId);
  document.getElementById('mainTitle').textContent = chain.length ? chain[chain.length - 1].title : category.title;
  document.getElementById('mainSub').textContent = '';

  const breadcrumb = document.createElement('div');
  breadcrumb.className = 'breadcrumb';
  const rootLink = document.createElement('a');
  rootLink.textContent = category.title;
  rootLink.addEventListener('click', () => openManageNode(null));
  breadcrumb.appendChild(rootLink);
  chain.forEach(node => {
    breadcrumb.appendChild(document.createTextNode(' › '));
    const a = document.createElement('a');
    a.textContent = node.title;
    a.addEventListener('click', () => openManageNode(node.id));
    breadcrumb.appendChild(a);
  });

  const headerRow = document.createElement('div');
  headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;';
  headerRow.appendChild(breadcrumb);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';
  if (!manageParentId) {
    const editCatBtn = document.createElement('button');
    editCatBtn.className = 'btn secondary small';
    editCatBtn.type = 'button';
    editCatBtn.textContent = 'Kategoriyi Düzenle';
    editCatBtn.addEventListener('click', () => openCategoryModal(category));
    actions.appendChild(editCatBtn);
  }
  const addBtn = document.createElement('button');
  addBtn.className = 'btn small';
  addBtn.type = 'button';
  addBtn.textContent = manageParentId ? '+ Alt Konu/Bölüm Ekle' : '+ Yeni Konu Ekle';
  addBtn.addEventListener('click', () => openTopicModal(null, manageParentId, manageCategoryId));
  actions.appendChild(addBtn);
  headerRow.appendChild(actions);

  const children = Object.values(topicsById)
    .filter(t => t.category_id === manageCategoryId && (t.parent_id || null) === (manageParentId || null))
    .sort((a, b) => a.sort_order - b.sort_order);

  const list = document.createElement('div');
  list.className = 'manage-list';

  if (!children.length) {
    list.innerHTML = '<div class="empty-state">Burada henüz bir alt konu/bölüm yok.</div>';
  } else {
    children.forEach(t => {
      const row = document.createElement('div');
      row.className = 'manage-row';

      const title = document.createElement('div');
      title.className = 'mr-title';
      title.innerHTML = `<span class="type-badge">${TOPIC_TYPE_LABELS[t.type] || t.type}</span> ${escapeHtml(t.title)}`;
      row.appendChild(title);

      const metaParts = [];
      if (t.article_range) metaParts.push(t.article_range);
      if (t.question_count != null) metaParts.push(`${t.question_count} soru hedefi`);
      if (metaParts.length) {
        const meta = document.createElement('div');
        meta.className = 'mr-meta';
        meta.textContent = metaParts.join(' • ');
        row.appendChild(meta);
      }

      const rowActions = document.createElement('div');
      rowActions.className = 'mr-actions';
      const editBtn = document.createElement('button');
      editBtn.type = 'button'; editBtn.textContent = 'Düzenle';
      editBtn.addEventListener('click', (e) => { e.stopPropagation(); openTopicModal(t, t.parent_id, t.category_id); });
      const delBtn = document.createElement('button');
      delBtn.type = 'button'; delBtn.className = 'del'; delBtn.textContent = 'Sil';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteTopicNode(t.id, t.title); });
      rowActions.appendChild(editBtn);
      rowActions.appendChild(delBtn);
      row.appendChild(rowActions);

      row.addEventListener('click', () => openManageNode(t.id));
      list.appendChild(row);
    });
  }

  contentEl.innerHTML = '';
  contentEl.appendChild(headerRow);
  contentEl.appendChild(list);
}

async function refreshTopicsAndRerender() {
  await loadTopics();
  if (activeTab === 'questions') { renderTopicTree(); }
  else if (activeTab === 'topics') { renderCategorySidebar(); if (manageCategoryId) renderManageContent(); }
}

// Türkçe karakterleri sadeleştirip URL/ID dostu bir slug üretir.
function slugify(str) {
  const map = { 'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u' };
  return String(str).toLowerCase().replace(/[çğıöşü]/g, c => map[c] || c)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'konu';
}

// ---- Konu ekle/düzenle modalı ----
const topicModalBackdrop = document.getElementById('topicModalBackdrop');
const topicForm = document.getElementById('topicForm');
const topicFormError = document.getElementById('topicFormError');
const tKadroGroup = document.getElementById('tKadroGroup');

tKadroGroup.innerHTML = Object.keys(KADRO_LABELS).map(k =>
  `<label><input type="checkbox" value="${k}" checked> ${kadroLabel(k)}</label>`
).join('');

document.getElementById('topicModalCancelBtn').addEventListener('click', closeTopicModal);
topicModalBackdrop.addEventListener('click', (e) => { if (e.target === topicModalBackdrop) closeTopicModal(); });

function openTopicModal(topic, parentId, categoryId) {
  editingTopicId = topic ? topic.id : null;
  newTopicParentId = parentId || null;
  newTopicCategoryId = categoryId;
  topicFormError.classList.remove('show');

  document.getElementById('topicModalTitle').textContent = topic ? 'Konuyu Düzenle' : 'Yeni Konu';
  document.getElementById('tTitle').value = topic?.title || '';
  document.getElementById('tType').value = topic?.type || (parentId ? 'section' : 'topic');
  document.getElementById('tDocNumber').value = topic?.document_number || '';
  document.getElementById('tArticleRange').value = topic?.article_range || '';
  document.getElementById('tQuestionCount').value = topic?.question_count ?? '';

  const selectedKadrolar = topic?.kadrolar || Object.keys(KADRO_LABELS);
  tKadroGroup.querySelectorAll('input').forEach(cb => { cb.checked = selectedKadrolar.includes(cb.value); });

  const chain = getBreadcrumbChain(parentId);
  document.getElementById('topicParentHint').textContent = chain.length
    ? `Konum: ${chain.map(c => c.title).join(' › ')}`
    : 'Bu, kategori kökünde üst düzey bir konu olacak.';

  topicModalBackdrop.classList.add('open');
  document.getElementById('tTitle').focus();
}

function closeTopicModal() {
  topicModalBackdrop.classList.remove('open');
  topicForm.reset();
  editingTopicId = null;
}

topicForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  topicFormError.classList.remove('show');

  const title = document.getElementById('tTitle').value.trim();
  const type = document.getElementById('tType').value;
  const documentNumber = document.getElementById('tDocNumber').value.trim();
  const articleRange = document.getElementById('tArticleRange').value.trim();
  const questionCountRaw = document.getElementById('tQuestionCount').value;
  const kadrolar = Array.from(tKadroGroup.querySelectorAll('input:checked')).map(cb => cb.value);

  if (!title) {
    topicFormError.textContent = 'Başlık zorunludur.';
    topicFormError.classList.add('show');
    return;
  }

  const saveBtn = document.getElementById('topicModalSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Kaydediliyor…';

  const payload = {
    title,
    type,
    document_number: documentNumber || null,
    article_range: articleRange || null,
    question_count: questionCountRaw === '' ? null : Number(questionCountRaw),
    kadrolar
  };

  let error;
  if (editingTopicId) {
    ({ error } = await supabaseClient.from('topics').update(payload).eq('id', editingTopicId));
  } else {
    // Yeni konuya benzersiz bir id ver. source_file'ı da aynı değere eşitliyoruz;
    // böylece uygulama tarafı bu konuyu "içerik paketi aktif" olarak görüp
    // sorularını (questions.topic_id üzerinden) doğrudan çekebiliyor —
    // yani kod değişikliği gerekmeden admin panelinden eklenen her konu
    // otomatik olarak çalışılabilir hale geliyor.
    const id = `t-${slugify(title)}-${Date.now().toString(36).slice(-5)}`;
    const siblings = Object.values(topicsById).filter(t =>
      t.category_id === newTopicCategoryId && (t.parent_id || null) === (newTopicParentId || null));
    const sortOrder = siblings.length ? Math.max(...siblings.map(s => s.sort_order)) + 1 : 0;

    ({ error } = await supabaseClient.from('topics').insert({
      id,
      category_id: newTopicCategoryId,
      parent_id: newTopicParentId,
      source_file: id,
      sort_order: sortOrder,
      ...payload
    }));
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Kaydet';

  if (error) {
    topicFormError.textContent = 'Kaydedilemedi: ' + error.message;
    topicFormError.classList.add('show');
    return;
  }

  closeTopicModal();
  await refreshTopicsAndRerender();
});

async function deleteTopicNode(id, title) {
  const childCount = (childrenByParent[id] || []).length;
  const warn = childCount
    ? `"${title}" silinirse altındaki ${childCount} alt konu/bölüm ve tüm soruları da silinecek. Emin misiniz?`
    : `"${title}" ve varsa içindeki tüm sorular silinecek. Emin misiniz?`;
  if (!confirm(warn)) return;

  // DÜZELTME: silinecek konu (ve tüm alt konuları) şu anda "Sorular" sekmesinde
  // seçili olan konuyu kapsıyorsa, eskimiş (stale) referansı temizle. Aksi halde
  // kullanıcı "Sorular" sekmesine dönünce artık var olmayan bir topic_id için
  // sorgu atılır ve başlıkta silinmiş konunun adı görünmeye devam eder.
  const affectedIds = collectDescendantTopicIds(id);
  const currentTopicWasAffected = currentTopicId && affectedIds.includes(currentTopicId);

  const { error } = await supabaseClient.from('topics').delete().eq('id', id);
  if (error) { alert('Silinemedi: ' + error.message); return; }

  if (manageParentId === id) manageParentId = null;
  if (currentTopicWasAffected) {
    currentTopicId = null;
    currentTopicTitle = '';
  }
  await refreshTopicsAndRerender();
}

// ---- Kategori ekle/düzenle modalı ----
const categoryModalBackdrop = document.getElementById('categoryModalBackdrop');
const categoryForm = document.getElementById('categoryForm');
const categoryFormError = document.getElementById('categoryFormError');

document.getElementById('categoryModalCancelBtn').addEventListener('click', closeCategoryModal);
categoryModalBackdrop.addEventListener('click', (e) => { if (e.target === categoryModalBackdrop) closeCategoryModal(); });

function openCategoryModal(category) {
  editingCategoryId = category ? category.id : null;
  categoryFormError.classList.remove('show');
  document.getElementById('categoryModalTitle').textContent = category ? 'Kategoriyi Düzenle' : 'Yeni Kategori';
  document.getElementById('cTitle').value = category?.title || '';
  document.getElementById('cSubtitle').value = category?.subtitle || '';
  categoryModalBackdrop.classList.add('open');
  document.getElementById('cTitle').focus();
}

function closeCategoryModal() {
  categoryModalBackdrop.classList.remove('open');
  categoryForm.reset();
  editingCategoryId = null;
}

categoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  categoryFormError.classList.remove('show');

  const title = document.getElementById('cTitle').value.trim();
  const subtitle = document.getElementById('cSubtitle').value.trim();
  if (!title) {
    categoryFormError.textContent = 'Başlık zorunludur.';
    categoryFormError.classList.add('show');
    return;
  }

  const saveBtn = document.getElementById('categoryModalSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Kaydediliyor…';

  let error, newId = editingCategoryId;
  if (editingCategoryId) {
    ({ error } = await supabaseClient.from('categories').update({ title, subtitle: subtitle || null }).eq('id', editingCategoryId));
  } else {
    let base = slugify(title);
    if (categoriesCache.some(c => c.id === base)) base = `${base}-${Date.now().toString(36).slice(-4)}`;
    newId = base;
    const sortOrder = categoriesCache.length ? Math.max(...categoriesCache.map(c => c.sort_order || 0)) + 1 : 0;
    ({ error } = await supabaseClient.from('categories').insert({ id: newId, title, subtitle: subtitle || null, sort_order: sortOrder }));
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Kaydet';

  if (error) {
    categoryFormError.textContent = 'Kaydedilemedi: ' + error.message;
    categoryFormError.classList.add('show');
    return;
  }

  const wasNew = !editingCategoryId;
  closeCategoryModal();
  await refreshTopicsAndRerender();
  if (wasNew) selectManageCategory(newId);
});

// ========================= 9) Otomatik soru çekme (kılavuz sırasına göre) =========================
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Aynı kadro+konu için bu havuzdaki her sorunun daha önceki denemelerde
// (deneme_questions.kadro/topic_id/source_question_id üzerinden) kaç kez
// kullanıldığını döndürür. "Torba" mantığının hafızası burası.
async function fetchUsageCounts(kadro, topicId) {
  const { data, error } = await supabaseClient
    .from('deneme_questions')
    .select('source_question_id')
    .eq('kadro', kadro)
    .eq('topic_id', topicId);
  if (error) throw error;
  const counts = new Map();
  (data || []).forEach(r => {
    if (!r.source_question_id) return;
    counts.set(r.source_question_id, (counts.get(r.source_question_id) || 0) + 1);
  });
  return counts;
}

// Havuzdan `count` kadar soru seçer: önce hiç kullanılmamış (used=0) olanlar,
// onlar yetmezse en az kullanılmış olanlar önceliklendirilir. Aynı kullanım
// sayısına sahip sorular arasında rastgele sıralanır — böylece bir önceki
// deneme oluşturma mantığındaki rastgelelik korunur, ama artık "torba"
// tükenmeden hiçbir soru tekrar etmez.
function pickLeastUsed(pool, usageCounts, count) {
  const withMeta = pool.map(q => ({ q, used: usageCounts.get(q.id) || 0, rand: Math.random() }));
  withMeta.sort((a, b) => (a.used - b.used) || (a.rand - b.rand));
  return withMeta.slice(0, count).map(x => x.q);
}

async function generateDenemeQuestions(denemeId, kadro) {
  const { data: items, error } = await supabaseClient
    .from('exam_blueprint_items')
    .select('topic_id, question_count, sort_order, exam_topics(title, question_source, linked_topic_id, card_deck_id)')
    .eq('kadro', kadro)
    .order('sort_order');
  if (error) throw error;
  if (!items.length) throw new Error('Bu kadro için sınav planı (exam_blueprint_items) tanımlı değil.');

  const rows = [];
  const shortfalls = [];
  let runningOrder = 0;

  for (const item of items) {
    const et = item.exam_topics;
    if (!et) { shortfalls.push({ title: item.topic_id, needed: item.question_count, got: 0 }); continue; }

    let pool = [];
    if (et.question_source === 'cards') {
      const { data, error: qErr } = await supabaseClient
        .from('card_questions')
        .select('id,prompt,options,answer_index')
        .eq('deck_id', et.card_deck_id);
      if (qErr) throw qErr;
      pool = data;
    } else {
      const ids = collectDescendantTopicIds(et.linked_topic_id);
      const { data, error: qErr } = await supabaseClient
        .from('questions')
        .select('id,prompt,options,answer_index')
        .in('topic_id', ids);
      if (qErr) throw qErr;
      pool = data;
    }

    const usageCounts = await fetchUsageCounts(kadro, item.topic_id);
    const picked = pickLeastUsed(pool, usageCounts, item.question_count);
    if (picked.length < item.question_count) {
      shortfalls.push({ title: et.title, needed: item.question_count, got: picked.length });
    }
    picked.forEach(q => {
      runningOrder += 1;
      rows.push({
        deneme_id: denemeId, prompt: q.prompt, options: q.options,
        answer_index: q.answer_index, sort_order: runningOrder,
        kadro, topic_id: item.topic_id, source_question_id: q.id
      });
    });
  }

  if (rows.length) {
    const { error: insErr } = await supabaseClient.from('deneme_questions').insert(rows);
    if (insErr) throw insErr;
  }

  return { total: rows.length, shortfalls };
}

function reportGenerationSummary({ total, shortfalls }) {
  if (!shortfalls.length) {
    alert(`${total} soru başarıyla çekildi.`);
    return;
  }
  const lines = shortfalls.map(s => `• ${s.title}: ${s.needed} isteniyordu, havuzda ${s.got} bulundu`).join('\n');
  alert(`${total} soru çekildi. Ancak bazı konularda soru havuzu yetersiz:\n\n${lines}`);
}

// ========================= yardımcı =========================
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

boot();
