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
let actualQuestionCounts = {};          // topic_id -> questions tablosundaki gerçek soru sayısı
let collapsedTopicIds = new Set();      // ağaç her yeniden çizildiğinde daralt/genişlet durumunun kaybolmaması için
let topicOptionsFlat = [];              // [{id,title,depth}] — modal <select> için ağaç sırasıyla
let editingQuestionId = null;

// ---- Sorular: toplu seçim state'i ----
let selectMode = false;
let selectedQuestionIds = new Set();
let currentQuestionsCache = [];         // o an ekranda listelenen sorular (dışa aktarma/toplu işlemler için)

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

// ---- Bildirimler sekmesi state'i ----
let feedbackStatusFilter = 'open';      // 'open' | 'resolved' | 'retracted' | 'all'
let feedbackRowsCache = [];

// ---- Kullanıcılar sekmesi state'i ----
let userSearchQuery = '';
let userRowsCache = [];

// ---- Toast bildirimleri (alert() yerine) ----
const adminToastEl = document.getElementById('adminToast');
function showToast(message, isError = false) {
  if (!adminToastEl) { window.alert(message); return; } // güvenlik ağı: element yoksa eski davranışa düş
  adminToastEl.textContent = message;
  adminToastEl.classList.toggle('error', isError);
  adminToastEl.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => adminToastEl.classList.remove('show'), 3200);
}

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

  initSidebarResize();
  await Promise.all([loadTopics(), loadKadrolar()]);
  switchTab('questions');
}

// ========================= 1b) Sol paneli sürükleyerek genişletme =========================
function initSidebarResize() {
  const sidebar = document.querySelector('.sidebar');
  const handle = document.getElementById('sidebarResizeHandle');
  if (!sidebar || !handle) return;

  const saved = parseInt(localStorage.getItem('sr_sidebar_width') || '', 10);
  if (saved && saved >= 220 && saved <= 560) sidebar.style.width = saved + 'px';

  let startX = 0, startWidth = 0, dragging = false;

  handle.addEventListener('mousedown', (e) => {
    dragging = true;
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    handle.classList.add('dragging');
    document.body.classList.add('sidebar-resizing');
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const next = Math.min(560, Math.max(220, startWidth + (e.clientX - startX)));
    sidebar.style.width = next + 'px';
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.classList.remove('sidebar-resizing');
    localStorage.setItem('sr_sidebar_width', Math.round(sidebar.getBoundingClientRect().width));
  });
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
    selectMode = false;
    selectedQuestionIds.clear();
    document.getElementById('mainActions').innerHTML =
      '<input type="text" id="questionIdSearch" class="id-search-input" placeholder="Soru ID ile bul…">' +
      '<button class="btn secondary" id="questionIdSearchBtn" type="button">Bul</button>' +
      '<button class="btn secondary" id="selectQuestionsBtn" type="button">Soruları Seç</button>' +
      '<button class="btn secondary" id="bulkQuestionBtn" type="button">+ Toplu Soru Ekle</button>' +
      '<button class="btn" id="newQuestionBtn" type="button">+ Yeni Soru</button>';
    document.getElementById('newQuestionBtn').addEventListener('click', () => openQuestionModal(null));
    document.getElementById('bulkQuestionBtn').addEventListener('click', () => openBulkModal());
    document.getElementById('selectQuestionsBtn').addEventListener('click', () => toggleSelectMode());
    document.getElementById('questionIdSearchBtn').addEventListener('click', () => {
      const val = document.getElementById('questionIdSearch').value.trim();
      if (val) searchQuestionById(val);
    });
    document.getElementById('questionIdSearch').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) searchQuestionById(val);
    });
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
  } else if (tab === 'topics') {
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
  } else if (tab === 'feedback') {
    document.getElementById('mainActions').innerHTML = `
      <select id="feedbackStatusSelect" class="btn secondary" style="cursor:pointer;">
        <option value="open">Açık</option>
        <option value="resolved">Çözüldü</option>
        <option value="retracted">Geri Alınan</option>
        <option value="all">Tümü</option>
      </select>`;
    const sel = document.getElementById('feedbackStatusSelect');
    sel.value = feedbackStatusFilter;
    sel.addEventListener('change', (e) => {
      feedbackStatusFilter = e.target.value;
      loadFeedback();
    });
    document.getElementById('mainTitle').textContent = 'Soru Bildirimleri';
    document.getElementById('mainSub').textContent = '';
    document.getElementById('content').innerHTML = '<div class="empty-state">Yükleniyor…</div>';
    loadFeedback();
  } else if (tab === 'users') {
    document.getElementById('mainActions').innerHTML =
      '<input type="text" id="userSearchInput" class="id-search-input" placeholder="E-posta ile ara…">' +
      '<button class="btn secondary" id="userSearchBtn" type="button">Ara</button>';
    document.getElementById('userSearchInput').value = userSearchQuery;
    document.getElementById('userSearchBtn').addEventListener('click', () => {
      userSearchQuery = document.getElementById('userSearchInput').value.trim();
      loadUsers();
    });
    document.getElementById('userSearchInput').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      userSearchQuery = e.target.value.trim();
      loadUsers();
    });
    document.getElementById('mainTitle').textContent = 'Kullanıcılar';
    document.getElementById('mainSub').textContent = '';
    document.getElementById('content').innerHTML = '<div class="empty-state">Yükleniyor…</div>';
    loadUsers();
  }
}

// ========================= 3) Konu ağacı (paylaşılan veri) =========================
async function loadTopics() {
  const [{ data: categories, error: catErr }, { data: topics, error: topicErr }, { data: questionRows, error: qErr }] = await Promise.all([
    supabaseClient.from('categories').select('id,title,subtitle,sort_order').order('sort_order'),
    supabaseClient.from('topics').select('id,category_id,parent_id,type,title,document_number,article_range,question_count,kadrolar,sort_order,summary,key_points').order('sort_order'),
    supabaseClient.from('questions').select('topic_id')
  ]);

  if (catErr || topicErr || qErr) {
    document.getElementById('sidePanel').innerHTML = `<div class="empty-state">Konular yüklenemedi: ${escapeHtml((catErr || topicErr || qErr).message)}</div>`;
    return;
  }

  // topics tablosundaki question_count yerine, questions tablosundaki gerçek satır sayısını hesapla
  actualQuestionCounts = {};
  (questionRows || []).forEach(q => {
    actualQuestionCounts[q.topic_id] = (actualQuestionCounts[q.topic_id] || 0) + 1;
  });

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

  // Her konu için, altındaki tüm alt konuların soru sayılarını da toplayan
  // "toplam" haritayı hesapla. Ağaçtaki rozetler ve Konular sekmesindeki
  // sayılar artık bunu kullanıyor; böylece alt konusu olan bir üst konu da
  // gerçek (kümülatif) soru sayısını gösteriyor.
  computeAggregatedCounts();

  window.__byCategory = byCategory; // renderTopicTree içinde kullanılacak
}

// actualQuestionCounts (sadece o konunun DOĞRUDAN sahip olduğu sorular) üzerinden,
// her konu için kendisi + tüm alt konularının toplamını hesaplar.
let aggregatedQuestionCounts = {};
function computeAggregatedCounts() {
  aggregatedQuestionCounts = {};
  function sumFor(id) {
    if (aggregatedQuestionCounts[id] !== undefined) return aggregatedQuestionCounts[id];
    let total = actualQuestionCounts[id] || 0;
    (childrenByParent[id] || []).forEach(child => { total += sumFor(child.id); });
    aggregatedQuestionCounts[id] = total;
    return total;
  }
  Object.keys(topicsById).forEach(id => sumFor(id));
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
        wrapper.className = `tree-node-wrapper${collapsedTopicIds.has(t.id) ? ' collapsed' : ''}`;

        const node = document.createElement('div');
        node.className = `tree-node depth-${depth}${t.id === currentTopicId ? ' active' : ''}`;
        node.dataset.topicId = t.id;

        // Alt konusu varsa ok işareti, yoksa boşluk ekle
        const iconHtml = hasChildren 
          ? `<span class="toggle-icon">▼</span>` 
          : `<span class="toggle-spacer"></span>`;

        // DÜZELTME: rozet artık sadece bu konuya DOĞRUDAN bağlı soru sayısını değil,
        // altındaki tüm alt konuların soru sayısını da içeren toplamı gösteriyor.
        const displayCount = aggregatedQuestionCounts[t.id] || 0;
        node.innerHTML = `${iconHtml}<span class="node-title">${escapeHtml(t.title)}</span>${displayCount > 0 ? `<span class="qcount">${displayCount}</span>` : ''}`;

        // Tıklama event'i: Ok ikonuna tıklanırsa aç/kapat + o konuyu da aktif hale getir (metne tıklamakla aynı davranış)
        node.addEventListener('click', (e) => {
          if (e.target.classList.contains('toggle-icon')) {
            e.stopPropagation();
            wrapper.classList.toggle('collapsed');
            if (wrapper.classList.contains('collapsed')) collapsedTopicIds.add(t.id);
            else collapsedTopicIds.delete(t.id);
          }
          selectTopic(t.id, t.title);
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
  selectMode = false;
  selectedQuestionIds.clear();
  document.querySelectorAll('.tree-node').forEach(n => n.classList.toggle('active', n.dataset.topicId === topicId));
  document.getElementById('mainTitle').textContent = title;
  loadQuestions();
}

// ========================= 4) Sorular listesi =========================
async function loadQuestions() {
  const contentEl = document.getElementById('content');
  contentEl.innerHTML = '<div class="empty-state">Yükleniyor…</div>';

  // DÜZELTME: bir konu seçildiğinde artık sadece o konuya DOĞRUDAN bağlı sorular
  // değil, altındaki tüm alt konulara (bölümlere) ait sorular da gösteriliyor.
  // Önceden alt konusu olan üst konulara tıklandığında liste hep boş görünüyordu,
  // çünkü sorular genelde en alttaki (leaf) alt konulara ekleniyor.
  const topicIds = collectDescendantTopicIds(currentTopicId);

  const { data: questions, error } = await supabaseClient
    .from('questions')
    .select('id,prompt,options,answer_index,explanation,sort_order,topic_id')
    .in('topic_id', topicIds)
    .order('sort_order');

  if (error) {
    contentEl.innerHTML = `<div class="empty-state">Sorular yüklenemedi: ${escapeHtml(error.message)}</div>`;
    return;
  }

  currentQuestionsCache = questions || [];
  // artık var olmayan sorular seçili kalmasın
  const validIds = new Set(currentQuestionsCache.map(q => q.id));
  selectedQuestionIds.forEach(id => { if (!validIds.has(id)) selectedQuestionIds.delete(id); });

  // Sol ağaçtaki rozet, questions tablosuna canlı sorgu atmak yerine bu cache'den
  // beslendiği için, bu konunun alt ağacı için sayıları burada güncelleyip
  // (önce bu alt ağacı sıfırlayıp gerçek dağılımla dolduruyoruz, sonra toplamları
  // yeniden hesaplıyoruz) ağacı yeniden çiziyoruz.
  if (currentTopicId) {
    topicIds.forEach(id => { actualQuestionCounts[id] = 0; });
    currentQuestionsCache.forEach(q => {
      actualQuestionCounts[q.topic_id] = (actualQuestionCounts[q.topic_id] || 0) + 1;
    });
    computeAggregatedCounts();
    renderTopicTree();
  }

  document.getElementById('mainSub').textContent = `${currentQuestionsCache.length} soru`;

  renderQuestionsTable();
}

// Telegram üzerinden gelen soru bildirimlerinde (veya başka bir kaynaktan)
// elde edilen soru ID'siyle direkt o soruyu bulup düzenleme modalını açar.
// Tam ID eşleşmesi bulunamazsa, ID içinde geçen sorular arasında ilk eşleşeni
// açar (parça ID yapıştırılmış olma ihtimaline karşı).
async function searchQuestionById(rawId) {
  const id = rawId.trim();
  const searchBtn = document.getElementById('questionIdSearchBtn');
  if (searchBtn) { searchBtn.disabled = true; searchBtn.textContent = 'Aranıyor…'; }

  const { data: exactMatch, error } = await supabaseClient
    .from('questions')
    .select('id,prompt,options,answer_index,explanation,sort_order,topic_id')
    .eq('id', id)
    .maybeSingle();

  let question = exactMatch;

  if (!question && !error) {
    const { data: partialMatches } = await supabaseClient
      .from('questions')
      .select('id,prompt,options,answer_index,explanation,sort_order,topic_id')
      .ilike('id', `%${id}%`)
      .limit(1);
    question = (partialMatches && partialMatches[0]) || null;
  }

  if (searchBtn) { searchBtn.disabled = false; searchBtn.textContent = 'Bul'; }

  if (error) {
    showToast('Arama sırasında hata oluştu: ' + error.message, true);
    return;
  }
  if (!question) {
    showToast(`"${id}" ile eşleşen bir soru bulunamadı.`, true);
    return;
  }

  const topic = topicsById[question.topic_id];
  const topicTitle = topic ? topic.title : question.topic_id;

  // İlgili konuyu seç, listeyi o bağlamda göster, sonra soruyu doğrudan
  // düzenleme modalında aç.
  selectTopic(question.topic_id, topicTitle);
  openQuestionModal(question);

  const searchInput = document.getElementById('questionIdSearch');
  if (searchInput) searchInput.value = '';
}

function toggleSelectMode() {
  selectMode = !selectMode;
  if (!selectMode) selectedQuestionIds.clear();
  renderQuestionsTable();
}

function renderQuestionsTable() {
  const contentEl = document.getElementById('content');
  const questions = currentQuestionsCache;
  const selectBtn = document.getElementById('selectQuestionsBtn');
  if (selectBtn) {
    selectBtn.textContent = selectMode ? 'Seçimi Bitir' : 'Soruları Seç';
    selectBtn.classList.toggle('secondary', !selectMode);
  }

  if (!questions.length) {
    contentEl.innerHTML = currentTopicId
      ? '<div class="empty-state">Bu konuda henüz soru yok. "Yeni Soru" ile ekleyin.</div>'
      : '<div class="empty-state">Soldan bir konu seçerek sorularını görüntüleyin.</div>';
    return;
  }

  contentEl.innerHTML = '';

  if (selectMode) contentEl.appendChild(buildBulkBar());

  // Seçili konunun doğrudan alt konuları varsa, hangi sorunun hangi alt konuya
  // ait olduğunu görebilmek için tabloya bir "Alt Konu" sütunu ekliyoruz.
  const hasChildTopics = (childrenByParent[currentTopicId] || []).length > 0;

  const table = document.createElement('table');
  table.className = 'q-table';
  table.innerHTML = `
    <thead><tr>
      ${selectMode ? '<th class="q-check"><input type="checkbox" id="selectAllCheck"></th>' : ''}
      <th style="width:${selectMode ? '34%' : '38%'}">Soru</th>
      <th style="width:30%">Şıklar</th>
      ${hasChildTopics ? '<th style="width:14%">Alt Konu</th>' : ''}
      <th></th>
    </tr></thead>
    <tbody></tbody>`;
  const tbody = table.querySelector('tbody');

  questions.forEach(q => {
    const tr = document.createElement('tr');
    tr.classList.toggle('selected', selectedQuestionIds.has(q.id));
    const optionsHtml = (q.options || []).map((opt, i) =>
      `<div class="${i === q.answer_index ? 'correct' : ''}">${i === q.answer_index ? '✓ ' : ''}${escapeHtml(opt)}</div>`
    ).join('');
    const subtopicTitle = hasChildTopics ? ((topicsById[q.topic_id] && topicsById[q.topic_id].title) || '') : '';
    tr.innerHTML = `
      ${selectMode ? `<td class="q-check"><input type="checkbox" class="row-check" ${selectedQuestionIds.has(q.id) ? 'checked' : ''}></td>` : ''}
      <td class="q-prompt">${escapeHtml(q.prompt)}</td>
      <td class="q-options">${optionsHtml}</td>
      ${hasChildTopics ? `<td style="font-size:12px;color:var(--muted);">${escapeHtml(subtopicTitle)}</td>` : ''}
      <td class="row-actions">
        <button type="button" class="edit">Düzenle</button>
        <button type="button" class="del">Sil</button>
      </td>`;
    tr.querySelector('.edit').addEventListener('click', () => openQuestionModal(q));
    tr.querySelector('.del').addEventListener('click', () => deleteQuestion(q.id));
    if (selectMode) {
      tr.querySelector('.row-check').addEventListener('change', (e) => {
        if (e.target.checked) selectedQuestionIds.add(q.id); else selectedQuestionIds.delete(q.id);
        tr.classList.toggle('selected', e.target.checked);
        updateBulkBar();
      });
    }
    tbody.appendChild(tr);
  });

  contentEl.appendChild(table);

  if (selectMode) {
    const selectAll = document.getElementById('selectAllCheck');
    selectAll.checked = questions.length > 0 && selectedQuestionIds.size === questions.length;
    selectAll.addEventListener('change', (e) => {
      if (e.target.checked) questions.forEach(q => selectedQuestionIds.add(q.id));
      else selectedQuestionIds.clear();
      renderQuestionsTable();
    });
  }
}

async function deleteQuestion(id) {
  if (!confirm('Bu soruyu silmek istediğinize emin misiniz?')) return;
  const { error } = await supabaseClient.from('questions').delete().eq('id', id);
  if (error) { showToast('Silinemedi: ' + error.message, true); return; }
  loadQuestions();
}

// ========================= 4b) Toplu seçim çubuğu =========================
function buildBulkBar() {
  const bar = document.createElement('div');
  bar.className = 'bulk-bar';
  bar.id = 'bulkBar';
  bar.innerHTML = `
    <label class="select-all"><input type="checkbox" id="bulkBarSelectAll"> Tümünü seç</label>
    <span class="bulk-count" id="bulkCount"></span>
    <div class="bulk-bar-actions">
      <button type="button" class="danger" id="bulkDeleteBtn">Seçileni Sil</button>
      <span class="bulk-sep"></span>
      <button type="button" id="bulkExportExcel">Excel</button>
      <button type="button" id="bulkExportPdf">PDF</button>
      <button type="button" id="bulkExportWord">Word</button>
    </div>`;

  bar.querySelector('#bulkBarSelectAll').addEventListener('change', (e) => {
    if (e.target.checked) currentQuestionsCache.forEach(q => selectedQuestionIds.add(q.id));
    else selectedQuestionIds.clear();
    renderQuestionsTable();
  });
  bar.querySelector('#bulkDeleteBtn').addEventListener('click', bulkDeleteQuestions);
  bar.querySelector('#bulkExportExcel').addEventListener('click', () => exportQuestionsExcel(getExportQuestions()));
  bar.querySelector('#bulkExportPdf').addEventListener('click', () => exportQuestionsPDF(getExportQuestions()));
  bar.querySelector('#bulkExportWord').addEventListener('click', () => exportQuestionsWord(getExportQuestions()));

  queueMicrotask(updateBulkBar);
  return bar;
}

function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  if (!bar) return;
  const n = selectedQuestionIds.size;
  const total = currentQuestionsCache.length;
  bar.querySelector('#bulkCount').textContent = n > 0 ? `${n} / ${total} seçili` : `Hiçbir soru seçilmedi — dışa aktarma tüm listeyi (${total} soru) kapsar`;
  bar.querySelector('#bulkDeleteBtn').disabled = n === 0;
  const selectAll = bar.querySelector('#bulkBarSelectAll');
  if (selectAll) selectAll.checked = total > 0 && n === total;
}

// Seçili sorular varsa onları, yoksa ekrandaki tüm listeyi döndürür.
function getExportQuestions() {
  if (selectedQuestionIds.size > 0) {
    return currentQuestionsCache.filter(q => selectedQuestionIds.has(q.id));
  }
  return currentQuestionsCache;
}

async function bulkDeleteQuestions() {
  const ids = Array.from(selectedQuestionIds);
  if (!ids.length) return;
  if (!confirm(`${ids.length} soruyu kalıcı olarak silmek istediğinize emin misiniz?`)) return;
  const { error } = await supabaseClient.from('questions').delete().in('id', ids);
  if (error) { showToast('Silinemedi: ' + error.message, true); return; }
  selectedQuestionIds.clear();
  loadQuestions();
}

// ========================= 4c) Dışa aktarma: Excel / PDF / Word =========================
function reportBaseName() {
  const topicPart = currentTopicTitle ? slugify(currentTopicTitle) : 'sorular';
  const datePart = new Date().toISOString().slice(0, 10);
  return `${topicPart}-rapor-${datePart}`;
}

function answerLetter(i) { return ['A', 'B', 'C', 'D', 'E', 'F'][i] || ''; }

function exportQuestionsExcel(questions) {
  if (!questions.length) { showToast('Dışa aktarılacak soru yok.', true); return; }
  const rows = [['No', 'Soru', 'Şık A', 'Şık B', 'Şık C', 'Şık D', 'Doğru Şık', 'Açıklama']];
  questions.forEach((q, i) => {
    const opts = q.options || [];
    rows.push([
      i + 1,
      q.prompt || '',
      opts[0] || '', opts[1] || '', opts[2] || '', opts[3] || '',
      answerLetter(q.answer_index),
      q.explanation || ''
    ]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 5 }, { wch: 50 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sorular');
  XLSX.writeFile(wb, `${reportBaseName()}.xlsx`);
}

// Rapor için ortak, gizli bir HTML bloğu üretir (PDF ve Word'de aynı görünüm kullanılır).
function buildReportHtml(questions) {
  const title = currentTopicTitle || 'Sorular';
  const dateStr = new Date().toLocaleDateString('tr-TR');
  const items = questions.map((q, i) => {
    const opts = (q.options || []).map((opt, oi) => {
      const isCorrect = oi === q.answer_index;
      return `<div style="padding:3px 0; ${isCorrect ? 'color:#2E6B4C; font-weight:600;' : 'color:#3a3a3a;'}">${isCorrect ? '✓ ' : answerLetter(oi) + ') '}${escapeHtml(opt)}</div>`;
    }).join('');
    const explanation = q.explanation
      ? `<div style="margin-top:6px; font-size:12.5px; color:#6b6b6b;"><b>Açıklama:</b> ${escapeHtml(q.explanation)}</div>` : '';
    return `
      <div style="margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid #ddd;">
        <div style="font-weight:700; font-size:14.5px; margin-bottom:6px;">${i + 1}. ${escapeHtml(q.prompt)}</div>
        <div style="font-size:13px; padding-left:6px;">${opts}</div>
        ${explanation}
      </div>`;
  }).join('');

  return `
    <div style="font-family: Calibri, Arial, sans-serif; color:#201D17; width:720px; padding:24px;">
      <div style="border-bottom:2px solid #A9843F; padding-bottom:10px; margin-bottom:18px;">
        <div style="font-size:19px; font-weight:700;">SınavRotası — Soru Raporu</div>
        <div style="font-size:12.5px; color:#7A7462; margin-top:4px;">${escapeHtml(title)} • ${questions.length} soru • ${dateStr}</div>
      </div>
      ${items}
    </div>`;
}

async function exportQuestionsPDF(questions) {
  if (!questions.length) { showToast('Dışa aktarılacak soru yok.', true); return; }
  if (!window.html2canvas || !window.jspdf) { showToast('PDF kütüphaneleri yüklenemedi. İnternet bağlantınızı kontrol edin.', true); return; }

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-9999px';
  container.style.background = '#ffffff';
  container.innerHTML = buildReportHtml(questions);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210, pageHeight = 297, margin = 10;
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const usableHeight = pageHeight - margin * 2;

    let heightLeft = imgHeight;
    let position = margin;
    const imgData = canvas.toDataURL('image/png');

    doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      doc.addPage();
      doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    doc.save(`${reportBaseName()}.pdf`);
  } catch (err) {
    showToast('PDF oluşturulamadı: ' + err.message, true);
  } finally {
    document.body.removeChild(container);
  }
}

function exportQuestionsWord(questions) {
  if (!questions.length) { showToast('Dışa aktarılacak soru yok.', true); return; }
  const bodyHtml = buildReportHtml(questions);
  const html = `<!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>SınavRotası Rapor</title></head>
    <body>${bodyHtml}</body></html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportBaseName()}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ========================= 5) Soru ekle/düzenle modalı =========================
const modalBackdrop = document.getElementById('modalBackdrop');
const questionForm = document.getElementById('questionForm');
const formError = document.getElementById('formError');
const fTopicSelect = document.getElementById('fTopic');
const fSubtopicField = document.getElementById('fSubtopicField');
const fSubtopicSelect = document.getElementById('fSubtopic');
const fOptionsContainer = document.getElementById('fOptionsContainer');
const fAddOptionBtn = document.getElementById('fAddOptionBtn');
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6; // toplu Excel/JSON içe aktarma da en fazla 6 şıka (A-F) kadar destekliyor

document.getElementById('modalCancelBtn').addEventListener('click', closeQuestionModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeQuestionModal(); });

// DÜZELTME: "Soru Ekle/Düzenle" modalındaki KONU alanı artık, Toplu Soru Ekle
// modalındakiyle aynı iki kademeli mantığı kullanıyor: fTopic sadece kök konuları
// (her kategorinin üst düzey konu/belgelerini) listeler; kökün alt konuları varsa
// ikinci bir "Alt konu / bölüm" seçimi açılır. Böylece 30+ satırlık tek bir uzun
// flat liste yerine, iki kısa ve sade seçim kutusu gösterilir.
function populateFormTopicRoots(selectedRootId) {
  const byCategory = window.__byCategory || {};
  fTopicSelect.innerHTML = categoriesCache.map(cat => {
    const roots = byCategory[cat.id] || [];
    if (!roots.length) return '';
    const opts = roots.map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');
    return `<optgroup label="${escapeHtml(cat.title)}">${opts}</optgroup>`;
  }).join('');
  if (selectedRootId) fTopicSelect.value = selectedRootId;
}

function populateFormSubtopics(rootId) {
  const children = childrenByParent[rootId] || [];
  if (!children.length) {
    fSubtopicField.style.display = 'none';
    fSubtopicSelect.innerHTML = '';
    return;
  }
  fSubtopicSelect.innerHTML = children.map(t => `<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');
  fSubtopicField.style.display = '';
}

function selectedFormTopicId() {
  return (fSubtopicField.style.display !== 'none' && fSubtopicSelect.value) ? fSubtopicSelect.value : fTopicSelect.value;
}

fTopicSelect.addEventListener('change', () => populateFormSubtopics(fTopicSelect.value));

// DÜZELTME: Şık sayısı artık sabit 4 değil, dinamik (min 2, max 6). Soru kaçtane
// şıka sahipse düzenlerken o kadar satır gösterilir; yeni soru eklerken varsayılan
// olarak 4 boş satırla başlanır ve "+ Şık Ekle" / satır başındaki "×" ile
// çoğaltılıp azaltılabilir.
function renderOptionRows(options, correctIndex) {
  fOptionsContainer.innerHTML = '';
  options.forEach((val, i) => addOptionRow(val, i === correctIndex));
  refreshOptionLabels();
}

function addOptionRow(value = '', checked = false) {
  const rows = fOptionsContainer.querySelectorAll('.option-row');
  if (rows.length >= MAX_OPTIONS) return;
  const index = rows.length;
  const row = document.createElement('div');
  row.className = 'option-row';
  row.innerHTML = `
    <input type="radio" name="fCorrect" value="${index}" ${checked ? 'checked' : ''}>
    <input type="text" class="fOpt" required placeholder="Şık">
    <button type="button" class="opt-remove" title="Şıkkı kaldır">×</button>
  `;
  row.querySelector('.fOpt').value = value;
  row.querySelector('.opt-remove').addEventListener('click', () => removeOptionRow(row));
  fOptionsContainer.appendChild(row);
  refreshOptionLabels();
}

function removeOptionRow(row) {
  const rows = fOptionsContainer.querySelectorAll('.option-row');
  if (rows.length <= MIN_OPTIONS) return; // en az 2 şık kalmalı
  const wasChecked = row.querySelector('input[type=radio]').checked;
  row.remove();
  refreshOptionLabels();
  if (wasChecked) {
    const first = fOptionsContainer.querySelector('input[type=radio]');
    if (first) first.checked = true;
  }
}

// Satır sırası değiştikçe (ekleme/kaldırma) radio value'larını 0..n-1 olacak
// şekilde yeniden numaralandırır, placeholder'ları A/B/C... ile günceller ve
// "+ Şık Ekle" / "×" butonlarının aktif/pasif durumunu ayarlar.
function refreshOptionLabels() {
  const rows = fOptionsContainer.querySelectorAll('.option-row');
  rows.forEach((row, i) => {
    row.querySelector('input[type=radio]').value = i;
    row.querySelector('.fOpt').placeholder = `${String.fromCharCode(65 + i)} şıkkı`;
    row.querySelector('.opt-remove').disabled = rows.length <= MIN_OPTIONS;
  });
  fAddOptionBtn.disabled = rows.length >= MAX_OPTIONS;
}

fAddOptionBtn.addEventListener('click', () => addOptionRow());

function openQuestionModal(question) {
  editingQuestionId = question ? question.id : null;
  document.getElementById('modalTitle').textContent = question ? 'Soruyu Düzenle' : 'Yeni Soru';
  formError.classList.remove('show');

  // DÜZELTME: düzenlerken sorunun kendi topic_id'sini kullan, currentTopicId'i değil.
  // Böylece bu modal ileride "tüm sorular" gibi farklı bir listeden çağrılsa bile
  // yanlış konuyu seçili göstermez. Konu bir alt konu (section) ise, önce üst
  // konuyu (kökü) sonra alt konuyu seçili getiriyoruz.
  const targetTopicId = question ? question.topic_id : (currentTopicId || (topicOptionsFlat[0] && topicOptionsFlat[0].id));
  const targetTopic = targetTopicId ? topicsById[targetTopicId] : null;
  const rootId = targetTopic && targetTopic.parent_id ? targetTopic.parent_id : targetTopicId;

  populateFormTopicRoots(rootId);
  populateFormSubtopics(rootId);
  if (targetTopic && targetTopic.parent_id) fSubtopicSelect.value = targetTopic.id;

  document.getElementById('fPrompt').value = question?.prompt || '';
  document.getElementById('fExplanation').value = question?.explanation || '';
  const existingOptions = question?.options?.length ? question.options : ['', '', '', ''];
  const correctIndex = question?.answer_index ?? 0;
  renderOptionRows(existingOptions, correctIndex);

  modalBackdrop.classList.add('open');
  document.getElementById('fPrompt').focus();
}

function closeQuestionModal() {
  modalBackdrop.classList.remove('open');
  questionForm.reset();
  fSubtopicField.style.display = 'none';
  editingQuestionId = null;
}

questionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.remove('show');

  const topicId = selectedFormTopicId();
  const prompt = document.getElementById('fPrompt').value.trim();
  const options = Array.from(fOptionsContainer.querySelectorAll('.fOpt')).map(el => el.value.trim());
  const explanation = document.getElementById('fExplanation').value.trim();
  const answerIndex = Number(questionForm.querySelector('input[name=fCorrect]:checked').value);

  if (!topicId || !prompt || options.length < MIN_OPTIONS || options.some(o => !o)) {
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
  // Kaydedilen soru, o an ekranda açık olan konunun alt ağacına dahilse (aynı
  // konu ya da onun bir alt konusuysa), o konunun bağlamında kal; değilse
  // sorunun asıl ait olduğu konuyu aç. Böylece "Yönetimde Etik" (üst) açıkken
  // bir alt konuya soru eklenirse, ekran üst konuda kalıp yeni soruyu da gösterir.
  if (currentTopicId && collectDescendantTopicIds(currentTopicId).includes(topicId)) {
    loadQuestions();
  } else {
    selectTopic(topicId, topic ? topic.title : currentTopicTitle);
  }
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
  if (currentTopicId && collectDescendantTopicIds(currentTopicId).includes(topicId)) loadQuestions();
  else showToast(`${rows.length} soru "${topicLabel}" konusuna eklendi.`);
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
  if (error) { showToast('Silinemedi: ' + error.message, true); return; }
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
    showToast('Sorular yeniden oluşturulamadı, mevcut sorular korundu: ' + err.message, true);
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

    const delCatBtn = document.createElement('button');
    delCatBtn.className = 'btn danger small';
    delCatBtn.type = 'button';
    delCatBtn.textContent = 'Kategoriyi Sil';
    delCatBtn.addEventListener('click', () => deleteCategory(category));
    actions.appendChild(delCatBtn);
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
      // DÜZELTME: burada da toplam (alt konular dahil) soru sayısını gösteriyoruz,
      // aksi halde alt konusu olan bir üst konu "0 soru mevcut" gibi yanıltıcı görünüyordu.
      const actualCount = aggregatedQuestionCounts[t.id] || 0;
      metaParts.push(`${actualCount} soru mevcut`);
      if (t.question_count != null) metaParts.push(`${t.question_count} hedef`);
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
  document.getElementById('tSummary').value = topic?.summary || '';
  document.getElementById('tKeyPoints').value = (topic?.key_points || []).join('\n');

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
  const summary = document.getElementById('tSummary').value.trim();
  const keyPoints = document.getElementById('tKeyPoints').value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

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
    kadrolar,
    summary: summary || null,
    key_points: keyPoints
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
  if (error) { showToast('Silinemedi: ' + error.message, true); return; }

  if (manageParentId === id) manageParentId = null;
  if (currentTopicWasAffected) {
    currentTopicId = null;
    currentTopicTitle = '';
  }
  await refreshTopicsAndRerender();
}

async function deleteCategory(category) {
  const topicCount = Object.values(topicsById).filter(t => t.category_id === category.id).length;
  const warn = topicCount
    ? `"${category.title}" silinirse içindeki ${topicCount} konu/bölüm ve tüm soruları da silinecek. Emin misiniz?`
    : `"${category.title}" kategorisini silmek istediğinize emin misiniz?`;
  if (!confirm(warn)) return;

  const affectedIds = Object.values(topicsById).filter(t => t.category_id === category.id).map(t => t.id);
  const currentTopicWasAffected = currentTopicId && affectedIds.includes(currentTopicId);

  const { error } = await supabaseClient.from('categories').delete().eq('id', category.id);
  if (error) { showToast('Silinemedi: ' + error.message, true); return; }

  if (manageCategoryId === category.id) { manageCategoryId = null; manageParentId = null; }
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
    showToast(`${total} soru başarıyla çekildi.`);
    return;
  }
  const lines = shortfalls.map(s => `• ${s.title}: ${s.needed} isteniyordu, havuzda ${s.got} bulundu`).join('\n');
  showToast(`${total} soru çekildi. Ancak bazı konularda soru havuzu yetersiz:\n\n${lines}`);
}

// ========================= 9) Bildirimler sekmesi =========================
async function loadFeedback() {
  let query = supabaseClient
    .from('question_feedback')
    .select('id, question_id, user_display, message, status, created_at, resolved_at, questions(prompt, topic_id)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (feedbackStatusFilter !== 'all') {
    query = query.eq('status', feedbackStatusFilter);
  }

  const { data, error } = await query;
  if (error) {
    document.getElementById('content').innerHTML =
      `<div class="empty-state">Bildirimler yüklenemedi: ${escapeHtml(error.message)}</div>`;
    return;
  }
  feedbackRowsCache = data || [];
  document.getElementById('mainSub').textContent = `${feedbackRowsCache.length} kayıt`;
  renderFeedbackTable();
}

function feedbackStatusBadge(status) {
  const map = {
    open: '<span class="badge no" style="background:#fde68a;color:#92400e;">Açık</span>',
    resolved: '<span class="badge yes">Çözüldü</span>',
    retracted: '<span class="badge no">Geri Alındı</span>',
  };
  return map[status] || escapeHtml(status);
}

function renderFeedbackTable() {
  const contentEl = document.getElementById('content');
  const rows = feedbackRowsCache;

  if (!rows.length) {
    contentEl.innerHTML = '<div class="empty-state">Bu filtrede bildirim yok.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'q-table';
  table.innerHTML = `
    <thead><tr>
      <th style="width:14%">Tarih</th>
      <th style="width:12%">Kullanıcı</th>
      <th style="width:34%">Soru</th>
      <th style="width:22%">Not</th>
      <th style="width:10%">Durum</th>
      <th></th>
    </tr></thead>
    <tbody></tbody>`;
  const tbody = table.querySelector('tbody');

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const dt = new Date(row.created_at);
    const dateStr = dt.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const promptText = row.questions?.prompt || `(soru bulunamadı: ${row.question_id || '-'})`;
    tr.innerHTML = `
      <td style="font-size:12px;color:var(--muted);">${dateStr}</td>
      <td style="font-size:12px;">${escapeHtml(row.user_display || '-')}</td>
      <td class="q-prompt">${escapeHtml(promptText)}</td>
      <td style="font-size:12px;">${escapeHtml(row.message || '-')}</td>
      <td>${feedbackStatusBadge(row.status)}</td>
      <td class="row-actions">
        ${row.question_id ? '<button type="button" class="edit">Soruyu Aç</button>' : ''}
        ${row.status === 'open' ? '<button type="button" class="resolve">Çözüldü</button>' : ''}
        <button type="button" class="del">Sil</button>
      </td>`;

    if (row.question_id) {
      tr.querySelector('.edit').addEventListener('click', async () => {
        const { data: q, error } = await supabaseClient.from('questions').select('*').eq('id', row.question_id).maybeSingle();
        if (error || !q) { showToast('Soru bulunamadı, silinmiş olabilir.', true); return; }
        currentTopicId = q.topic_id;
        openQuestionModal(q);
      });
    }
    const resolveBtn = tr.querySelector('.resolve');
    if (resolveBtn) {
      resolveBtn.addEventListener('click', async () => {
        const { error } = await supabaseClient.from('question_feedback')
          .update({ status: 'resolved', resolved_at: new Date().toISOString() })
          .eq('id', row.id);
        if (error) { showToast('Güncellenemedi: ' + error.message, true); return; }
        loadFeedback();
      });
    }
    tr.querySelector('.del').addEventListener('click', async () => {
      if (!confirm('Bu bildirim kalıcı olarak silinsin mi?')) return;
      const { error } = await supabaseClient.from('question_feedback').delete().eq('id', row.id);
      if (error) { showToast('Silinemedi: ' + error.message, true); return; }
      loadFeedback();
    });

    tbody.appendChild(tr);
  });

  contentEl.innerHTML = '';
  contentEl.appendChild(table);
}

// ========================= 10) Kullanıcılar sekmesi (premium yönetimi) =========================
// NOT: auth.users tablosu istemciye hiç açılmıyor; e-posta/premium bilgisi
// sadece admin_search_users() RPC'si üzerinden (is_admin() kontrollü) geliyor.
async function loadUsers() {
  const { data, error } = await supabaseClient.rpc('admin_search_users', { p_query: userSearchQuery });
  if (error) {
    document.getElementById('content').innerHTML =
      `<div class="empty-state">Kullanıcılar yüklenemedi: ${escapeHtml(error.message)}</div>`;
    return;
  }
  userRowsCache = data || [];
  document.getElementById('mainSub').textContent = userSearchQuery
    ? `"${userSearchQuery}" için ${userRowsCache.length} sonuç`
    : `${userRowsCache.length} kullanıcı (ilk 30)`;
  renderUsersTable();
}

function renderUsersTable() {
  const contentEl = document.getElementById('content');
  const rows = userRowsCache;

  if (!rows.length) {
    contentEl.innerHTML = '<div class="empty-state">Kullanıcı bulunamadı.</div>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'q-table';
  table.innerHTML = `
    <thead><tr>
      <th style="width:34%">E-posta</th>
      <th style="width:12%">Admin</th>
      <th style="width:14%">Premium</th>
      <th style="width:20%">Bitiş</th>
      <th></th>
    </tr></thead>
    <tbody></tbody>`;
  const tbody = table.querySelector('tbody');

  rows.forEach(row => {
    const tr = document.createElement('tr');
    const untilStr = row.premium_until
      ? new Date(row.premium_until).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : (row.is_premium ? 'Süresiz' : '-');
    tr.innerHTML = `
      <td>${escapeHtml(row.email || '-')}</td>
      <td>${row.is_admin ? '<span class="badge yes">Admin</span>' : ''}</td>
      <td>${row.is_premium ? '<span class="badge yes">Premium</span>' : '<span class="badge no">Ücretsiz</span>'}</td>
      <td style="font-size:12px;color:var(--muted);">${escapeHtml(untilStr)}</td>
      <td class="row-actions">
        <button type="button" class="grant30">+30 Gün</button>
        <button type="button" class="grant-forever">Süresiz Yap</button>
        ${row.is_premium ? '<button type="button" class="revoke del">Kaldır</button>' : ''}
      </td>`;

    tr.querySelector('.grant30').addEventListener('click', async () => {
      const until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabaseClient.rpc('admin_set_premium', { p_user_id: row.id, p_is_premium: true, p_premium_until: until });
      if (error) { showToast('Güncellenemedi: ' + error.message, true); return; }
      showToast(`${row.email} — 30 günlük premium verildi.`);
      loadUsers();
    });
    tr.querySelector('.grant-forever').addEventListener('click', async () => {
      if (!confirm(`${row.email} kullanıcısına süresiz premium verilsin mi?`)) return;
      const { error } = await supabaseClient.rpc('admin_set_premium', { p_user_id: row.id, p_is_premium: true, p_premium_until: null });
      if (error) { showToast('Güncellenemedi: ' + error.message, true); return; }
      showToast(`${row.email} — süresiz premium verildi.`);
      loadUsers();
    });
    const revokeBtn = tr.querySelector('.revoke');
    if (revokeBtn) {
      revokeBtn.addEventListener('click', async () => {
        if (!confirm(`${row.email} kullanıcısının premium erişimi kaldırılsın mı?`)) return;
        const { error } = await supabaseClient.rpc('admin_set_premium', { p_user_id: row.id, p_is_premium: false, p_premium_until: null });
        if (error) { showToast('Güncellenemedi: ' + error.message, true); return; }
        showToast(`${row.email} — premium kaldırıldı.`);
        loadUsers();
      });
    }

    tbody.appendChild(tr);
  });

  contentEl.innerHTML = '';
  contentEl.appendChild(table);
}

// ========================= yardımcı =========================
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

boot();
