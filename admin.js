// ================= SınavRotası — Admin Paneli =================
// Bağımsız sayfa: app.js'e dokunmaz, aynı supabaseClient.js'i paylaşır.
// Erişim: sadece profiles.is_admin = true olan kullanıcılar (RLS zaten
// veritabanı seviyesinde yazmayı engelliyor; buradaki kontrol sadece UX içindir).

const KADRO_LABELS = { memur: 'Memur', sef: 'Şef', sayman: 'Sayman', 'sube-mudur': 'Şube Müdürü' };
function kadroLabel(k) { return KADRO_LABELS[k] || k; }

let activeTab = 'questions';           // 'questions' | 'denemeler'

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
      '<button class="btn" id="newQuestionBtn" type="button">+ Yeni Soru</button>';
    document.getElementById('newQuestionBtn').addEventListener('click', () => openQuestionModal(null));
    renderTopicTree();
    if (currentTopicId) {
      document.getElementById('mainTitle').textContent = currentTopicTitle;
      loadQuestions();
    } else {
      document.getElementById('mainTitle').textContent = 'Bir konu seçin';
      document.getElementById('mainSub').textContent = '';
      document.getElementById('content').innerHTML = '<div class="empty-state">Soldan bir konu seçerek sorularını görüntüleyin.</div>';
    }
  } else {
    document.getElementById('mainActions').innerHTML =
      '<button class="btn" id="newDenemeBtn" type="button">+ Yeni Deneme</button>';
    document.getElementById('newDenemeBtn').addEventListener('click', () => openDenemeModal(null));
    renderKadroSidebar();
    document.getElementById('mainTitle').textContent = currentKadro ? `${kadroLabel(currentKadro)} denemeleri` : 'Tüm denemeler';
    document.getElementById('mainSub').textContent = '';
    loadDenemeler();
  }
}

// ========================= 3) Konu ağacı (paylaşılan veri) =========================
async function loadTopics() {
  const [{ data: categories, error: catErr }, { data: topics, error: topicErr }] = await Promise.all([
    supabaseClient.from('categories').select('id,title,sort_order').order('sort_order'),
    supabaseClient.from('topics').select('id,category_id,parent_id,type,title,question_count,sort_order').order('sort_order')
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

    function appendChildren(list, depth) {
      (list || []).forEach(t => {
        const node = document.createElement('div');
        node.className = `tree-node depth-${depth}${t.id === currentTopicId ? ' active' : ''}`;
        node.dataset.topicId = t.id;
        node.innerHTML = `${escapeHtml(t.title)}${t.question_count != null ? `<span class="qcount">${t.question_count}</span>` : ''}`;
        node.addEventListener('click', () => selectTopic(t.id, t.title));
        block.appendChild(node);
        appendChildren(childrenByParent[t.id], depth + 1);
      });
    }
    appendChildren(byCategory[cat.id], 0);
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
    `<option value="${t.id}">${'　'.repeat(t.depth)}${escapeHtml(t.title)}</option>`
  ).join('');
  if (selectedId) fTopicSelect.value = selectedId;
}

function openQuestionModal(question) {
  editingQuestionId = question ? question.id : null;
  document.getElementById('modalTitle').textContent = question ? 'Soruyu Düzenle' : 'Yeni Soru';
  formError.classList.remove('show');

  populateTopicSelect(question ? currentTopicId : (currentTopicId || (topicOptionsFlat[0] && topicOptionsFlat[0].id)));

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
    await supabaseClient.from('deneme_questions').delete().eq('deneme_id', editingDenemeId);
    const kadro = dKadroSelect.value;
    const summary = await generateDenemeQuestions(editingDenemeId, kadro);
    reportGenerationSummary(summary);
  } catch (err) {
    alert('Sorular yeniden oluşturulamadı: ' + err.message);
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

      saveBtn.textContent = 'Sorular çekiliyor…';
      const summary = await generateDenemeQuestions(inserted.id, kadro);
      closeDenemeModal();
      loadDenemeler();
      reportGenerationSummary(summary);
    }
  } catch (err) {
    denemeFormError.textContent = 'Kaydedilemedi: ' + err.message;
    denemeFormError.classList.add('show');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = editingDenemeId ? 'Kaydet' : 'Oluştur ve Soruları Çek';
  }
});

// ========================= 8) Otomatik soru çekme (kılavuz sırasına göre) =========================
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

    const picked = shuffle(pool).slice(0, item.question_count);
    if (picked.length < item.question_count) {
      shortfalls.push({ title: et.title, needed: item.question_count, got: picked.length });
    }
    picked.forEach(q => {
      runningOrder += 1;
      rows.push({
        deneme_id: denemeId, prompt: q.prompt, options: q.options,
        answer_index: q.answer_index, sort_order: runningOrder
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
