// ================= SınavRotası — Admin Paneli =================
// Bağımsız sayfa: app.js'e dokunmaz, aynı supabaseClient.js'i paylaşır.
// Erişim: sadece profiles.is_admin = true olan kullanıcılar (RLS zaten
// veritabanı seviyesinde yazmayı engelliyor; buradaki kontrol sadece UX içindir).

let currentTopicId = null;
let currentTopicTitle = '';
let topicsById = {};   // id -> topic row
let editingQuestionId = null; // null => yeni soru, dolu => düzenleme

// ---------- 1) Giriş / admin kontrolü ----------
async function boot() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }
  const { data: profile, error } = await supabaseClient
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !profile?.is_admin) {
    document.getElementById('authGate').textContent = 'Bu sayfaya erişim yetkiniz yok.';
    return;
  }

  document.getElementById('adminEmail').textContent = session.user.email || '';
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('adminApp').classList.add('ready');

  loadTree();
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
});

// ---------- 2) Sol panel: kategori / konu ağacı ----------
async function loadTree() {
  const treeEl = document.getElementById('tree');

  const [{ data: categories, error: catErr }, { data: topics, error: topicErr }] = await Promise.all([
    supabaseClient.from('categories').select('id,title,sort_order').order('sort_order'),
    supabaseClient.from('topics').select('id,category_id,parent_id,type,title,question_count,sort_order').order('sort_order')
  ]);

  if (catErr || topicErr) {
    treeEl.innerHTML = `<div class="empty-state">Konular yüklenemedi: ${(catErr || topicErr).message}</div>`;
    return;
  }

  topicsById = {};
  topics.forEach(t => { topicsById[t.id] = t; });

  // Her kategori altında kök konuları (parent_id null) derinlik sırasıyla diz
  const byCategory = {};
  const byParent = {};
  topics.forEach(t => {
    if (t.parent_id) {
      (byParent[t.parent_id] = byParent[t.parent_id] || []).push(t);
    } else {
      (byCategory[t.category_id] = byCategory[t.category_id] || []).push(t);
    }
  });

  function renderNode(t, depth) {
    const node = document.createElement('div');
    node.className = `topic-node depth-${depth}`;
    node.dataset.topicId = t.id;
    node.innerHTML = `${escapeHtml(t.title)}${t.question_count != null ? `<span class="qcount">${t.question_count}</span>` : ''}`;
    node.addEventListener('click', () => selectTopic(t.id, t.title));
    return node;
  }

  treeEl.innerHTML = '';
  if (!categories.length) {
    treeEl.innerHTML = '<div class="empty-state">Henüz kategori yok.</div>';
    return;
  }

  categories.forEach(cat => {
    const block = document.createElement('div');
    block.className = 'cat-block';
    const title = document.createElement('div');
    title.className = 'cat-title';
    title.textContent = cat.title;
    block.appendChild(title);

    function appendChildren(parentList, depth) {
      (parentList || []).forEach(t => {
        block.appendChild(renderNode(t, depth));
        appendChildren(byParent[t.id], depth + 1);
      });
    }
    appendChildren(byCategory[cat.id], 0);
    treeEl.appendChild(block);
  });
}

function selectTopic(topicId, title) {
  currentTopicId = topicId;
  currentTopicTitle = title;
  document.querySelectorAll('.topic-node').forEach(n => n.classList.toggle('active', n.dataset.topicId === topicId));
  document.getElementById('selectedTopicTitle').textContent = title;
  document.getElementById('newQuestionBtn').disabled = false;
  loadQuestions();
}

// ---------- 3) Sağ panel: sorular ----------
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

  document.getElementById('selectedTopicSub').textContent = `${questions.length} soru`;

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
  if (error) {
    alert('Silinemedi: ' + error.message);
    return;
  }
  loadQuestions();
}

// ---------- 4) Ekle / düzenle modalı ----------
const modalBackdrop = document.getElementById('modalBackdrop');
const questionForm = document.getElementById('questionForm');
const formError = document.getElementById('formError');

document.getElementById('newQuestionBtn').addEventListener('click', () => openQuestionModal(null));
document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

function openQuestionModal(question) {
  editingQuestionId = question ? question.id : null;
  document.getElementById('modalTitle').textContent = question ? 'Soruyu Düzenle' : 'Yeni Soru';
  formError.classList.remove('show');

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

function closeModal() {
  modalBackdrop.classList.remove('open');
  questionForm.reset();
  editingQuestionId = null;
}

questionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.remove('show');

  const prompt = document.getElementById('fPrompt').value.trim();
  const options = [0, 1, 2, 3].map(i => document.getElementById(`fOpt${i}`).value.trim());
  const explanation = document.getElementById('fExplanation').value.trim();
  const answerIndex = Number(questionForm.querySelector('input[name=fCorrect]:checked').value);

  if (!prompt || options.some(o => !o)) {
    formError.textContent = 'Soru metni ve tüm şıklar zorunludur.';
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
      .update({ prompt, options, answer_index: answerIndex, explanation: explanation || null })
      .eq('id', editingQuestionId));
  } else {
    const id = `${currentTopicId}-${Date.now().toString(36)}`;
    ({ error } = await supabaseClient
      .from('questions')
      .insert({ id, topic_id: currentTopicId, prompt, options, answer_index: answerIndex, explanation: explanation || null }));
  }

  saveBtn.disabled = false;
  saveBtn.textContent = 'Kaydet';

  if (error) {
    formError.textContent = 'Kaydedilemedi: ' + error.message;
    formError.classList.add('show');
    return;
  }

  closeModal();
  loadQuestions();
});

// ---------- yardımcı ----------
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

boot();
