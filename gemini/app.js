const STORAGE_KEY = 'sinavrotasi-study-progress-v2';
const CATALOGUE_URL = 'categoryTopics.json';
const DAILY_GOAL = 20;
const QUESTION_TIME_LIMIT = 45;

const state = {
  view: 'home',
  catalogue: null,
  catalogueError: '',
  activeCategoryKey: null,
  activeDocument: null,
  navStack: [],
  questionBanks: new Map(),
  quiz: null
};

const app = document.getElementById('app');
const scrollArea = document.getElementById('scroll-area');
const toast = document.getElementById('toast');
const navButtons = [...document.querySelectorAll('[data-nav]')];
const topicSheet = document.getElementById('topicSheet');
const topicBackdrop = document.getElementById('topicBackdrop');
const closeTopicSheetButton = document.getElementById('closeTopicSheet');
const topicSheetTitle = document.getElementById('topicSheetTitle');
const topicSheetSubtitle = document.getElementById('topicSheetSubtitle');
const topicEyebrow = document.getElementById('topicEyebrow');
const topicHeadingIcon = document.getElementById('topicHeadingIcon');
const topicList = document.getElementById('topicList');
const topicProgressText = document.getElementById('topicProgressText');
const topicProgressBar = document.getElementById('topicProgressBar');
const topicBreadcrumbWrap = document.getElementById('topicBreadcrumbWrap');
let timerInterval = null;
let progress = loadProgress();

const iconPaths = {
  scale: '<path d="M12 3v18"/><path d="M6 6h12"/><path d="m6 6-4 7h8L6 6Z"/><path d="m18 6-4 7h8l-4-7Z"/><path d="M8 21h8"/>',
  landmark: '<path d="m3 10 9-6 9 6"/><path d="M5 10h14"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/><path d="M4 18h16M3 22h18"/>',
  schoolbook: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M8 4v16"/><path d="M12 8h4M12 12h4"/><path d="m14 15 .7 1.4 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2L14 15Z"/>',
  gavel: '<path d="m14 13-7.5 7.5a1 1 0 0 1-3-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6 4 4-6 6-4-4Z"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 2 5-6"/>',
  refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"/>'
};

function svg(name, className = 'ui-icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>`;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function haptic(duration = 18) {
  if ('vibrate' in navigator) navigator.vibrate(duration);
}

function defaultProgress() {
  return {
    answers: 0,
    correctAnswers: 0,
    dailyAnswers: {},
    completedSections: {},
    completedTests: []
  };
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return defaultProgress();
    return {
      ...defaultProgress(),
      ...saved,
      dailyAnswers: saved.dailyAnswers || {},
      completedSections: saved.completedSections || {},
      completedTests: Array.isArray(saved.completedTests) ? saved.completedTests : []
    };
  } catch (error) {
    return defaultProgress();
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  updateHeader();
  if (state.view === 'home' || state.view === 'wrong') render();
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStreak() {
  let streak = 0;
  const cursor = new Date();
  while (progress.dailyAnswers[dateKey(cursor)] > 0) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getStats() {
  const completedSections = Object.keys(progress.completedSections).length;
  const completedMocks = progress.completedTests.filter(test => test.kind === 'mock').length;
  const todayAnswers = Number(progress.dailyAnswers[dateKey()] || 0);
  return {
    completedSections,
    solvedQuestions: Number(progress.answers || 0),
    completedMocks,
    streak: getStreak(),
    todayAnswers,
    dailyPercentage: Math.min(100, Math.round((todayAnswers / DAILY_GOAL) * 100)),
    accuracy: progress.answers ? Math.round((progress.correctAnswers / progress.answers) * 100) : 0
  };
}

function setNav(name) {
  navButtons.forEach(button => button.classList.toggle('active', button.dataset.nav === name));
}

window.go = function go(view) {
  state.view = view;
  setNav(view);
  render();
  scrollArea.scrollTop = 0;
};

function getCategories() {
  return state.catalogue ? Object.entries(state.catalogue) : [];
}

function slugify(value) {
  return String(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function looksLikeDocument(title) {
  return /sayılı|kanunu|yönetmeliği|kararnamesi|khk/i.test(title);
}

function normalizeItem(item) {
  if (typeof item !== 'string') return item;
  return {
    id: slugify(item),
    title: item,
    type: looksLikeDocument(item) ? 'document' : 'topic',
    contentStatus: 'planned',
    questionCount: 0,
    articleCount: 0,
    children: []
  };
}

function getCategory(categoryKey) {
  return state.catalogue && state.catalogue[categoryKey];
}

function getCategoryItems(categoryKey) {
  const category = getCategory(categoryKey);
  return category ? (category.topics || []).map(normalizeItem) : [];
}

function getDocumentProgress(documentItem) {
  const sections = documentItem.children || [];
  if (!sections.length) return 0;
  const completed = sections.filter(section => progress.completedSections[section.id]).length;
  return Math.round((completed / sections.length) * 100);
}

function getCategoryProgress(categoryKey) {
  const items = getCategoryItems(categoryKey).filter(item => item.type === 'document' && item.children && item.children.length);
  if (!items.length) return 0;
  const values = items.map(getDocumentProgress);
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function getActiveDocuments() {
  return getCategories().flatMap(([categoryKey]) => getCategoryItems(categoryKey)
    .filter(item => item.type === 'document' && item.questionFile)
    .map(item => ({ item, categoryKey })));
}

function categoryCardMeta(categoryKey) {
  const presets = {
    'general-legislation': { title: 'Mevzuat', description: 'Kanunlar, yönetmelikler ve resmi düzenlemeler', icon: 'scale', iconClass: '' },
    'general-culture': { title: 'Genel Kültür', description: 'Tarih, coğrafya, vatandaşlık ve güncel bilgiler', icon: 'landmark', iconClass: 'blue' },
    'meb-legislation': { title: 'MEB Mevzuatı', description: 'Millî Eğitim Bakanlığı mevzuat ve yönergeleri', icon: 'schoolbook', iconClass: 'red' }
  };
  return presets[categoryKey] || { title: getCategory(categoryKey)?.title || 'Konu', description: getCategory(categoryKey)?.subtitle || '', icon: 'book', iconClass: '' };
}

function loadingView() {
  return `<section class="screen neutral-screen"><div class="empty-state"><span class="empty-state-icon">${svg('refresh')}</span><h3>İçerikler hazırlanıyor</h3><p>Konu ve soru bankası yükleniyor.</p></div></section>`;
}

function errorView() {
  return `<section class="screen neutral-screen"><div class="empty-state empty-state-error"><span class="empty-state-icon">${svg('book')}</span><h3>İçerikler yüklenemedi</h3><p>${escapeHtml(state.catalogueError || 'categoryTopics.json dosyasını kontrol et.')}</p><button class="reader-primary" id="retryLoadButton" type="button">Tekrar Dene</button></div></section>`;
}

function statCard(icon, colorClass, number, label, target) {
  return `<button class="stat stat-button" data-stat-target="${target}" type="button"><span class="stat-icon ${colorClass}">${svg(icon)}</span><strong>${number}</strong><span>${label}</span></button>`;
}

function homeView() {
  if (!state.catalogue) return state.catalogueError ? errorView() : loadingView();
  const stats = getStats();
  const categories = getCategories().map(([key]) => {
    const meta = categoryCardMeta(key);
    const topics = getCategoryItems(key);
    const activePackages = topics.filter(item => item.questionFile).length;
    const metaText = activePackages ? `${topics.length} başlık • ${activePackages} aktif paket` : `${topics.length} başlık • içerik planlanıyor`;
    return `<article class="category" role="button" tabindex="0" data-open-category="${key}">
      <div class="cat-icon ${meta.iconClass}">${svg(meta.icon)}</div>
      <div class="cat-copy"><h4>${escapeHtml(meta.title)}</h4><p>${escapeHtml(meta.description)}</p><small>${metaText}</small></div>
      <div class="chevron">${svg('arrow')}</div>
    </article>`;
  }).join('');

  return `<section class="screen home-screen">
    <div class="stats">
      ${statCard('book', '', stats.completedSections, 'Konu<br>Tamamlandı', 'wrong')}
      ${statCard('target', 'accent', stats.solvedQuestions, 'Soru<br>Çözüldü', 'wrong')}
      ${statCard('trophy', 'amber', stats.completedMocks, 'Deneme<br>Tamamlandı', 'bank')}
      ${statCard('flame', 'accent', stats.streak, 'Günlük<br>Seri', 'wrong')}
    </div>
    <div class="section-head"><h3>Test Kategorileri</h3></div>
    <section class="categories">${categories}</section>
    <button class="cta-btn" id="smartPracticeButton" type="button">
      <div class="cta-icon">${svg('target')}</div><div><strong>Pratiğe Başla</strong><span>Aktif soru bankalarından rastgele çöz</span></div><span class="chevron-w">${svg('arrow')}</span>
    </button>
  </section>`;
}

function bankView() {
  const stats = getStats();
  const activeDocuments = getActiveDocuments();
  return `<section class="screen content-screen">
    <div class="page-heading"><span>DENEMELER</span><h2>Hızlı denemeler</h2><p>Aktif soru bankalarından oluşan denemelerle performansını ölç.</p></div>
    <article class="practice-card">
      <div class="practice-card-icon">${svg('trophy')}</div>
      <div><span>KARMA MEVZUAT</span><h3>20 soruluk hızlı deneme</h3><p>${activeDocuments.length ? `${activeDocuments.length} aktif paketten dengeli rastgele seçilir.` : 'Aktif soru paketi bulunmuyor.'}</p></div>
      <button class="reader-primary" id="startMockButton" type="button" ${activeDocuments.length ? '' : 'disabled'}>Başlat</button>
    </article>
    <div class="metric-strip"><div><strong>${stats.completedMocks}</strong><span>Tamamlanan deneme</span></div><div><strong>%${stats.accuracy}</strong><span>Genel doğruluk</span></div></div>
  </section>`;
}

function studiesView() {
  const stats = getStats();
  const recentTests = progress.completedTests.slice(-3).reverse();
  return `<section class="screen content-screen">
    <div class="page-heading"><span>ÇALIŞMALARIM</span><h2>İlerlemen</h2><p>Bu değerler cevapların ve tamamladığın testlerle otomatik güncellenir.</p></div>
    <div class="study-grid">
      <article><span>Çözülen soru</span><strong>${stats.solvedQuestions}</strong></article>
      <article><span>Doğruluk oranı</span><strong>%${stats.accuracy}</strong></article>
      <article><span>Tamamlanan bölüm</span><strong>${stats.completedSections}</strong></article>
      <article><span>Günlük seri</span><strong>${stats.streak} gün</strong></article>
    </div>
    <section class="recent-tests"><h3>Son testler</h3>${recentTests.length ? recentTests.map(test => `<article><div><strong>${escapeHtml(test.title)}</strong><span>${test.score}/${test.total} doğru</span></div><small>${test.kind === 'mock' ? 'Deneme' : 'Konu testi'}</small></article>`).join('') : '<div class="empty-inline">Henüz tamamlanan bir test yok.</div>'}</section>
    <button class="reset-progress" id="resetProgressButton" type="button">İlerleme verisini sıfırla</button>
  </section>`;
}

function libraryView() {
  if (!state.catalogue) return loadingView();
  const groups = getCategories().map(([categoryKey, category]) => {
    const documents = getCategoryItems(categoryKey).filter(item => item.type === 'document');
    if (!documents.length) return '';
    return `<section class="library-group"><div class="library-group-head"><span>${escapeHtml(category.title)}</span><small>${documents.length} kaynak</small></div>${documents.map(item => {
      const available = item.questionFile ? 'Aktif soru paketi' : 'İçerik planlanıyor';
      return `<button class="library-item" data-open-document="${item.id}" data-category-key="${categoryKey}" type="button"><span class="library-item-icon">${svg('gavel')}</span><span><strong>${escapeHtml(item.title)}</strong><small>${available}</small></span>${svg('arrow')}</button>`;
    }).join('')}</section>`;
  }).join('');
  return `<section class="screen content-screen"><div class="page-heading"><span>KİTAPLIK</span><h2>Mevzuat kaynakları</h2><p>Her kaynak aynı çalışma akışını kullanır; içerik paketi eklendiğinde otomatik etkinleşir.</p></div>${groups}</section>`;
}

function profileView() {
  const stats = getStats();
  return `<section class="screen content-screen"><div class="page-heading"><span>PROFİL</span><h2>Ahmet Yılmaz</h2><p>Çalışma özeti</p></div><article class="profile-summary"><div class="profile-summary-avatar">A</div><div><strong>Hedef: MEB GYS</strong><span>${stats.solvedQuestions} soru • %${stats.accuracy} doğruluk</span></div></article><div class="profile-notice">İstatistikler cihazında saklanır. Aynı tarayıcıda kaldığın sürece çalışma ilerlemen korunur.</div></section>`;
}

function render() {
  const views = { home: homeView, bank: bankView, wrong: studiesView, laws: libraryView, profile: profileView };
  app.innerHTML = (views[state.view] || homeView)();
  bindViewEvents();
  updateHeader();
}

function bindViewEvents() {
  if (state.catalogueError) document.getElementById('retryLoadButton')?.addEventListener('click', loadCatalogue);
  app.querySelectorAll('[data-open-category]').forEach(element => {
    element.addEventListener('click', () => openTopicSheet(element.dataset.openCategory));
    element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') openTopicSheet(element.dataset.openCategory); });
  });
  app.querySelectorAll('[data-stat-target]').forEach(element => element.addEventListener('click', () => window.go(element.dataset.statTarget)));
  document.getElementById('smartPracticeButton')?.addEventListener('click', startSmartPractice);
  document.getElementById('startMockButton')?.addEventListener('click', startMixedMock);
  document.getElementById('resetProgressButton')?.addEventListener('click', resetProgress);
  app.querySelectorAll('[data-open-document]').forEach(element => element.addEventListener('click', () => {
    openDocumentFromLibrary(element.dataset.categoryKey, element.dataset.openDocument);
  }));
}

function updateHeader() {
  const stats = getStats();
  const ring = document.getElementById('dailyGoalCircle');
  const percent = document.getElementById('dailyGoalPercent');
  const solved = document.getElementById('dailySolvedCount');
  const total = document.getElementById('dailyGoalTotal');
  const progressFill = document.getElementById('dailyProgressFill');
  const message = document.getElementById('dailyGoalMessage');
  if (!ring || !percent || !solved || !total || !progressFill || !message) return;
  ring.setAttribute('stroke-dasharray', `${stats.dailyPercentage}, 100`);
  percent.textContent = `%${stats.dailyPercentage}`;
  solved.textContent = stats.todayAnswers;
  total.textContent = DAILY_GOAL;
  progressFill.style.width = `${stats.dailyPercentage}%`;
  message.textContent = stats.dailyPercentage >= 100 ? 'Günlük hedefini tamamladın. Harika iş!' : stats.todayAnswers ? 'Hedefine düzenli biçimde yaklaşıyorsun.' : 'İlk soruyla günlük hedefini başlat.';
}

function resetProgress() {
  if (!window.confirm('Tüm yerel çalışma ilerlemesi sıfırlansın mı?')) return;
  progress = defaultProgress();
  saveProgress();
  showToast('İlerleme verisi sıfırlandı.');
}

function resetSheetClasses() {
  topicSheet.classList.remove('document-flow', 'quiz-active');
}

function openTopicSheet(categoryKey) {
  const category = getCategory(categoryKey);
  if (!category) return showToast('Kategori bulunamadı.');
  clearInterval(timerInterval);
  state.activeCategoryKey = categoryKey;
  state.activeDocument = null;
  state.navStack = [{ kind: 'category', categoryKey }];
  topicSheet.classList.add('open');
  topicBackdrop.classList.add('open');
  renderCategoryLevel(categoryKey);
}

function closeTopicSheet() {
  clearInterval(timerInterval);
  state.quiz = null;
  resetSheetClasses();
  topicSheet.classList.remove('open');
  topicBackdrop.classList.remove('open');
}

function applySheetHeader({ title, subtitle, eyebrow, icon = 'book', iconClass = '' }) {
  topicSheetTitle.textContent = title;
  topicSheetSubtitle.textContent = subtitle;
  topicEyebrow.textContent = eyebrow;
  topicHeadingIcon.className = `topic-heading-icon ${iconClass}`.trim();
  topicHeadingIcon.innerHTML = svg(icon);
}

function renderBreadcrumb(label, onClick) {
  topicBreadcrumbWrap.innerHTML = `<button class="topic-breadcrumb" id="sheetBackButton" type="button">${svg('back')}<span>${escapeHtml(label)}</span></button>`;
  document.getElementById('sheetBackButton').addEventListener('click', () => { haptic(14); onClick(); });
}

function setSheetProgress(label, percentage, completedLabel = 'tamamlandı') {
  topicProgressText.textContent = percentage ? `%${percentage} ${completedLabel}` : label;
  topicProgressBar.style.width = `${percentage}%`;
}

function renderCategoryLevel(categoryKey) {
  const category = getCategory(categoryKey);
  if (!category) return;
  resetSheetClasses();
  const meta = categoryCardMeta(categoryKey);
  applySheetHeader({ title: category.title, subtitle: category.subtitle, eyebrow: 'KONU KATEGORİSİ', icon: meta.icon, iconClass: meta.iconClass });
  topicBreadcrumbWrap.innerHTML = '';
  const progressPercent = getCategoryProgress(categoryKey);
  setSheetProgress('Henüz çalışılmadı', progressPercent);
  const items = getCategoryItems(categoryKey);
  topicList.innerHTML = items.map((item, index) => {
    const isDocument = item.type === 'document';
    const isComplete = isDocument && getDocumentProgress(item) === 100;
    const info = isDocument ? `${item.articleCount || 0} madde • ${item.questionCount || 0} soru` : 'Konu anlatımı ve soru bankası';
    return `<article class="topic-item ${isComplete ? 'completed' : ''}" data-topic-index="${index}" role="button" tabindex="0"><div class="topic-number">${String(index + 1).padStart(2, '0')}</div><div class="topic-copy"><h4>${escapeHtml(item.title)}</h4><p>${info}</p></div>${isDocument && item.articleCount ? `<span class="article-range">${item.contentStatus === 'sample' ? 'ÖRNEK SET' : 'MEVZUAT'}</span>` : ''}<div class="topic-arrow">${svg('arrow')}</div></article>`;
  }).join('');
  topicList.querySelectorAll('[data-topic-index]').forEach(element => {
    const open = () => {
      const item = items[Number(element.dataset.topicIndex)];
      if (item.type === 'document') renderDocumentHub(item, categoryKey);
      else renderTopicPlan(item, categoryKey);
    };
    element.addEventListener('click', open);
    element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') open(); });
  });
  topicSheet.scrollTop = 0;
}

function statusLabel(documentItem) {
  if (documentItem.contentStatus === 'sample') return 'ÖRNEK İÇERİK AKTİF';
  if (documentItem.questionFile) return 'İÇERİK PAKETİ AKTİF';
  return 'İÇERİK PLANLANIYOR';
}

function renderDocumentHub(documentItem, categoryKey) {
  state.activeDocument = documentItem;
  state.activeCategoryKey = categoryKey;
  topicSheet.classList.add('document-flow');
  topicSheet.classList.remove('quiz-active');
  applySheetHeader({ title: documentItem.title, subtitle: documentItem.questionFile ? `${documentItem.articleCount || 0} madde • ${documentItem.questionCount || 0} soru` : 'İçerik yapısı hazır, kaynak paketi bekleniyor', eyebrow: 'MEVZUAT ÇALIŞMA MERKEZİ', icon: 'gavel', iconClass: categoryCardMeta(categoryKey).iconClass });
  renderBreadcrumb(getCategory(categoryKey).title, () => renderCategoryLevel(categoryKey));
  const documentProgress = getDocumentProgress(documentItem);
  setSheetProgress('Henüz çalışılmadı', documentProgress);
  const isActive = Boolean(documentItem.questionFile);
  const sectionsReady = Boolean(documentItem.children && documentItem.children.length);
  topicList.innerHTML = `<section class="document-overview-card">
      <div class="document-overview-top"><span class="document-number">${escapeHtml(documentItem.documentNumber || 'KONU')}</span><span class="document-status ${isActive ? '' : 'is-pending'}">${statusLabel(documentItem)}</span></div>
      <h4>${escapeHtml(documentItem.title)}</h4><p>${isActive ? 'Bölüm bazında çalışabilir, rastgele test çözebilir ve kritik notlarla hızlı tekrar yapabilirsin.' : 'Bu başlık için akış hazır. Bölüm ve soru verisi eklendiğinde kartlar otomatik olarak aktifleşir.'}</p>
      <div class="document-stats"><span><strong>${documentItem.articleCount || 0}</strong> madde</span><span><strong>${documentItem.questionCount || 0}</strong> soru</span><span><strong>%${documentProgress}</strong> ilerleme</span></div>
    </section>
    <div class="document-mode-grid">
      ${modeCard('sections', 'book', 'Madde Madde Çalış', 'Bölüm ve madde listesinden istediğin yere git.', sectionsReady)}
      ${modeCard('random', 'target', 'Rastgele 20 Soru', 'Kanunun tamamından rastgele sorular çöz.', isActive)}
      ${modeCard('truefalse', 'check', 'Doğru / Yanlış', 'İçerik paketi eklendiğinde çalışır.', Boolean(documentItem.trueFalseFile))}
      ${modeCard('summary', 'trophy', 'Özet ve Kritik Noktalar', 'Sınavda öne çıkan maddeleri hızlı tekrar et.', sectionsReady)}
    </div>`;
  topicList.querySelectorAll('[data-document-mode]').forEach(button => button.addEventListener('click', () => {
    if (button.disabled) return showToast('Bu mod, ilgili içerik paketi eklendiğinde açılacak.');
    haptic(18);
    const mode = button.dataset.documentMode;
    if (mode === 'sections') renderSections(documentItem, categoryKey);
    if (mode === 'random') openRandomQuiz(documentItem, categoryKey);
    if (mode === 'summary') renderSummary(documentItem, categoryKey);
    if (mode === 'truefalse') showToast('Doğru / yanlış soru paketi yakında eklenecek.');
  }));
  topicSheet.scrollTop = 0;
}

function modeCard(mode, icon, title, description, enabled) {
  return `<button class="document-mode-card ${enabled ? '' : 'is-disabled'}" data-document-mode="${mode}" type="button" ${enabled ? '' : 'disabled'}><span class="document-mode-icon">${svg(icon)}</span><strong>${title}</strong><small>${description}</small></button>`;
}

function renderTopicPlan(item, categoryKey) {
  topicSheet.classList.add('document-flow');
  applySheetHeader({ title: item.title, subtitle: 'İçerik şablonu hazır', eyebrow: 'KONU ÇALIŞMA MERKEZİ', icon: 'book', iconClass: categoryCardMeta(categoryKey).iconClass });
  renderBreadcrumb(getCategory(categoryKey).title, () => renderCategoryLevel(categoryKey));
  setSheetProgress('Henüz çalışılmadı', 0);
  topicList.innerHTML = `<section class="empty-state content-plan"><span class="empty-state-icon">${svg('book')}</span><h3>Bu konu için altyapı hazır</h3><p>Bölümler, özetler ve soru bankası JSON ile eklendiğinde bu ekran otomatik olarak kanun akışına dönüşür.</p><div class="plan-points"><span>${svg('check')} Bölüm bazlı çalışma</span><span>${svg('check')} Rastgele test</span><span>${svg('check')} İlerleme takibi</span></div></section>`;
  topicSheet.scrollTop = 0;
}

function renderSections(documentItem, categoryKey) {
  topicSheet.classList.add('document-flow');
  applySheetHeader({ title: 'Bölüm Seçimi', subtitle: 'Bir bölüme dokunarak karma sorularla başla.', eyebrow: 'MADDE MADDE ÇALIŞ', icon: 'gavel', iconClass: categoryCardMeta(categoryKey).iconClass });
  renderBreadcrumb(documentItem.title, () => renderDocumentHub(documentItem, categoryKey));
  setSheetProgress('Henüz çalışılmadı', getDocumentProgress(documentItem));
  const sections = documentItem.children || [];
  topicList.innerHTML = `<div class="document-section-head"><span>BÖLÜM TESTLERİ</span><strong>Bölüme tıkla, test başlasın</strong></div><div class="document-section-list">${sections.map((section, index) => {
    const completed = progress.completedSections[section.id];
    return `<article class="document-section-item ${completed ? 'completed' : ''}" data-section-index="${index}" role="button" tabindex="0"><span class="document-section-number">${completed ? svg('check') : String(index + 1).padStart(2, '0')}</span><div><h4>${escapeHtml(section.title)}</h4><p>${escapeHtml(section.articleRange || `${(section.children || []).length} madde`)}</p></div><span class="document-section-arrow">›</span></article>`;
  }).join('')}</div>`;
  topicList.querySelectorAll('[data-section-index]').forEach(element => {
    const open = () => openSectionQuiz(documentItem, sections[Number(element.dataset.sectionIndex)], categoryKey);
    element.addEventListener('click', open);
    element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') open(); });
  });
  topicSheet.scrollTop = 0;
}

function renderSummary(documentItem, categoryKey) {
  topicSheet.classList.add('document-flow');
  applySheetHeader({ title: 'Özet ve Kritik Noktalar', subtitle: documentItem.title, eyebrow: 'HIZLI TEKRAR', icon: 'trophy', iconClass: categoryCardMeta(categoryKey).iconClass });
  renderBreadcrumb(documentItem.title, () => renderDocumentHub(documentItem, categoryKey));
  setSheetProgress('Henüz çalışılmadı', getDocumentProgress(documentItem));
  const sections = documentItem.children || [];
  topicList.innerHTML = `<div class="summary-list">${sections.map(section => `<section class="summary-section"><h4>${escapeHtml(section.title)}</h4>${(section.children || []).map(article => `<article class="summary-item"><span>${escapeHtml(article.articleLabel || 'Madde')}</span><h5>${escapeHtml(article.summary || article.title || '')}</h5>${(article.keyPoints || []).length ? `<ul>${article.keyPoints.slice(0, 3).map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>` : ''}</article>`).join('')}</section>`).join('')}</div>`;
  topicSheet.scrollTop = 0;
}

async function loadQuestionBank(documentItem) {
  if (!documentItem.questionFile) throw new Error('Bu başlık için soru bankası henüz tanımlanmamış.');
  if (state.questionBanks.has(documentItem.id)) return state.questionBanks.get(documentItem.id);
  const response = await fetch(documentItem.questionFile, { cache: 'no-store' });
  if (!response.ok) throw new Error('Soru dosyası okunamadı.');
  const data = await response.json();
  const questions = Array.isArray(data.questions) ? data.questions : [];
  state.questionBanks.set(documentItem.id, questions);
  return questions;
}

function shuffle(list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
  return items;
}

async function openSectionQuiz(documentItem, section, categoryKey) {
  try {
    showToast('Sorular hazırlanıyor…');
    const bank = await loadQuestionBank(documentItem);
    const questions = bank.filter(question => question.sectionId === section.id);
    if (!questions.length) return showToast('Bu bölüm için henüz soru bulunmuyor.');
    startQuiz({
      questions,
      documentItem,
      section,
      kind: 'section',
      title: section.title,
      subtitle: `${documentItem.title} • ${section.articleRange || 'Karma sorular'}`,
      returnView: () => renderSections(documentItem, categoryKey)
    });
  } catch (error) {
    showToast(error.message || 'Sorular yüklenemedi.');
  }
}

async function openRandomQuiz(documentItem, categoryKey) {
  try {
    showToast('Rastgele test hazırlanıyor…');
    const bank = await loadQuestionBank(documentItem);
    if (!bank.length) return showToast('Bu başlık için henüz soru bulunmuyor.');
    startQuiz({
      questions: shuffle(bank).slice(0, Math.min(20, bank.length)),
      documentItem,
      kind: 'random',
      title: documentItem.title,
      subtitle: `Rastgele ${Math.min(20, bank.length)} soru`,
      returnView: () => renderDocumentHub(documentItem, categoryKey)
    });
  } catch (error) {
    showToast(error.message || 'Sorular yüklenemedi.');
  }
}

async function startSmartPractice() {
  const activeDocuments = getActiveDocuments();
  if (!activeDocuments.length) return showToast('Henüz aktif soru paketi bulunmuyor.');
  const selected = activeDocuments[Math.floor(Math.random() * activeDocuments.length)];
  openTopicSheet(selected.categoryKey);
  renderDocumentHub(selected.item, selected.categoryKey);
  await openRandomQuiz(selected.item, selected.categoryKey);
}

async function startMixedMock() {
  const activeDocuments = getActiveDocuments();
  if (!activeDocuments.length) return showToast('Henüz aktif soru paketi bulunmuyor.');
  try {
    showToast('Deneme hazırlanıyor…');
    const banks = await Promise.all(activeDocuments.map(({ item }) => loadQuestionBank(item)));
    const questions = shuffle(banks.flat()).slice(0, Math.min(20, banks.flat().length));
    if (!questions.length) return showToast('Deneme için soru bulunamadı.');
    topicSheet.classList.add('open');
    topicBackdrop.classList.add('open');
    startQuiz({
      questions,
      kind: 'mock',
      title: 'Karma Mevzuat Denemesi',
      subtitle: `${questions.length} soru • aktif paketlerden rastgele`,
      returnView: closeTopicSheet
    });
  } catch (error) {
    showToast(error.message || 'Deneme hazırlanamadı.');
  }
}

function startQuiz({ questions, documentItem = null, section = null, kind, title, subtitle, returnView }) {
  clearInterval(timerInterval);
  state.quiz = {
    questions: shuffle(questions).map(question => ({ ...question, userSelected: null, timeLeft: QUESTION_TIME_LIMIT, answerRecorded: false })),
    sourceQuestions: questions,
    documentItem,
    section,
    kind,
    title,
    subtitle,
    returnView,
    index: 0,
    completionRecorded: false
  };
  renderQuiz();
}

function recordAnswer(question, selected) {
  if (question.answerRecorded) return;
  question.answerRecorded = true;
  progress.answers += 1;
  if (selected === question.answerIndex) progress.correctAnswers += 1;
  const today = dateKey();
  progress.dailyAnswers[today] = Number(progress.dailyAnswers[today] || 0) + 1;
  saveProgress();
}

function quizScore(quiz) {
  return quiz.questions.filter(question => question.userSelected === question.answerIndex).length;
}

function renderQuiz() {
  const quiz = state.quiz;
  if (!quiz) return;
  topicSheet.classList.add('quiz-active');
  const current = quiz.questions[quiz.index];
  const total = quiz.questions.length;
  const letters = ['A', 'B', 'C', 'D', 'E'];
  topicList.innerHTML = `<div class="quiz-modern-container"><div class="quiz-modern-topbar"><button id="quizBackButton" type="button" aria-label="Geri">${svg('back')}</button><h2>${quiz.kind === 'mock' ? 'Deneme' : 'Mevzuat'}</h2><button type="button" aria-label="Yer işareti">${svg('bookmark')}</button></div><div class="quiz-modern-progress-area"><div class="quiz-modern-progress-info">Soru ${quiz.index + 1} / ${total}<div class="quiz-modern-progress-bar"><div class="quiz-modern-progress-fill" style="width:${Math.round(((quiz.index + 1) / total) * 100)}%"></div></div></div><div class="quiz-modern-timer" id="quizTimer">${svg('clock')} 00:${String(current.timeLeft).padStart(2, '0')}</div></div><div class="quiz-modern-card"><span class="quiz-modern-badge">${escapeHtml(quiz.subtitle)}</span><h3 class="quiz-modern-question">${escapeHtml(current.prompt)}</h3><div class="quiz-modern-options">${current.options.map((option, index) => {
    let className = 'quiz-modern-option';
    if (current.userSelected !== null) {
      if (index === current.answerIndex) className += ' correct';
      else if (index === current.userSelected) className += ' wrong';
    }
    return `<button class="${className}" data-answer-index="${index}" type="button"><span class="quiz-modern-option-letter">${letters[index] || index + 1}</span><span class="quiz-modern-option-text">${escapeHtml(option)}</span></button>`;
  }).join('')}</div></div><div class="quiz-modern-footer"><button class="quiz-modern-btn quiz-modern-btn-prev" id="quizPrevButton" type="button" ${quiz.index === 0 ? 'disabled' : ''}>${svg('arrowLeft')} Önceki</button><button class="quiz-modern-btn quiz-modern-btn-next" id="quizNextButton" type="button">${quiz.index === total - 1 ? 'Sonucu Gör' : 'Sonraki'} ${svg('arrowRight')}</button></div></div>`;
  topicSheet.scrollTop = 0;
  bindQuizEvents();
  startQuizTimer();
}

function startQuizTimer() {
  clearInterval(timerInterval);
  const quiz = state.quiz;
  const current = quiz?.questions[quiz.index];
  const timer = document.getElementById('quizTimer');
  if (!current || !timer || current.userSelected !== null || current.timeLeft <= 0) return;
  timerInterval = window.setInterval(() => {
    if (!state.quiz || state.quiz !== quiz) return clearInterval(timerInterval);
    if (current.timeLeft <= 0 || current.userSelected !== null) return clearInterval(timerInterval);
    current.timeLeft -= 1;
    timer.innerHTML = `${svg('clock')} 00:${String(current.timeLeft).padStart(2, '0')}`;
    if (current.timeLeft === 0) {
      clearInterval(timerInterval);
      showToast('Bu sorunun süresi doldu.');
    }
  }, 1000);
}

function bindQuizEvents() {
  const quiz = state.quiz;
  document.getElementById('quizBackButton').addEventListener('click', () => {
    clearInterval(timerInterval);
    const returnView = quiz.returnView;
    state.quiz = null;
    topicSheet.classList.remove('quiz-active');
    returnView();
  });
  topicList.querySelectorAll('[data-answer-index]').forEach(button => button.addEventListener('click', () => {
    const current = quiz.questions[quiz.index];
    if (current.userSelected !== null) return;
    const selected = Number(button.dataset.answerIndex);
    current.userSelected = selected;
    recordAnswer(current, selected);
    haptic(selected === current.answerIndex ? 20 : 28);
    renderQuiz();
  }));
  document.getElementById('quizPrevButton').addEventListener('click', () => {
    if (quiz.index < 1) return;
    clearInterval(timerInterval);
    quiz.index -= 1;
    renderQuiz();
  });
  document.getElementById('quizNextButton').addEventListener('click', () => {
    clearInterval(timerInterval);
    if (quiz.index < quiz.questions.length - 1) {
      quiz.index += 1;
      renderQuiz();
    } else {
      renderQuizResult();
    }
  });
}

function recordQuizCompletion(quiz) {
  if (quiz.completionRecorded) return;
  quiz.completionRecorded = true;
  const score = quizScore(quiz);
  progress.completedTests.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: quiz.title,
    kind: quiz.kind,
    documentId: quiz.documentItem?.id || null,
    sectionId: quiz.section?.id || null,
    score,
    total: quiz.questions.length,
    completedAt: new Date().toISOString()
  });
  if (quiz.section?.id) progress.completedSections[quiz.section.id] = new Date().toISOString();
  saveProgress();
}

function renderQuizResult() {
  clearInterval(timerInterval);
  const quiz = state.quiz;
  if (!quiz) return;
  recordQuizCompletion(quiz);
  topicSheet.classList.remove('quiz-active');
  topicSheet.classList.add('document-flow');
  const score = quizScore(quiz);
  const total = quiz.questions.length;
  const percentage = total ? Math.round((score / total) * 100) : 0;
  applySheetHeader({ title: quiz.title, subtitle: 'Test tamamlandı', eyebrow: 'SONUÇ', icon: 'trophy', iconClass: 'red' });
  topicBreadcrumbWrap.innerHTML = '';
  setSheetProgress('Henüz yanıtlanmış soru yok', percentage, 'başarı');
  const wrongAnswers = quiz.questions.filter(question => question.userSelected !== null && question.userSelected !== question.answerIndex);
  topicList.innerHTML = `<section class="quiz-result-card"><strong>${score} / ${total}</strong><span>Doğru cevap • %${percentage} başarı</span></section>${wrongAnswers.length ? `<div class="quiz-result-list"><span class="quiz-result-list-title">YANLIŞ YAPILAN SORULAR</span>${wrongAnswers.map(question => `<article class="quiz-result-item"><p>${escapeHtml(question.prompt)}</p><small>Doğru cevap: ${escapeHtml(question.options[question.answerIndex])}</small></article>`).join('')}</div>` : '<p class="quiz-result-perfect">Tebrikler, yanıtladığın soruların tamamı doğru!</p>'}<div class="quiz-result-actions"><button class="reader-secondary" id="quizRetryButton" type="button">Tekrar Dene</button><button class="reader-primary" id="quizReturnButton" type="button">Listeye Dön</button></div>`;
  document.getElementById('quizRetryButton').addEventListener('click', () => {
    const retry = { ...quiz, questions: quiz.sourceQuestions };
    startQuiz({ questions: retry.questions, documentItem: retry.documentItem, section: retry.section, kind: retry.kind, title: retry.title, subtitle: retry.subtitle, returnView: retry.returnView });
  });
  document.getElementById('quizReturnButton').addEventListener('click', () => {
    const returnView = quiz.returnView;
    state.quiz = null;
    returnView();
  });
  topicSheet.scrollTop = 0;
}

function openDocumentFromLibrary(categoryKey, documentId) {
  const item = getCategoryItems(categoryKey).find(candidate => candidate.id === documentId);
  if (!item) return;
  topicSheet.classList.add('open');
  topicBackdrop.classList.add('open');
  renderDocumentHub(item, categoryKey);
}

navButtons.forEach(button => button.addEventListener('click', () => window.go(button.dataset.nav)));
closeTopicSheetButton.addEventListener('click', closeTopicSheet);
topicBackdrop.addEventListener('click', closeTopicSheet);

async function loadCatalogue() {
  state.catalogueError = '';
  state.catalogue = null;
  render();
  try {
    const response = await fetch(CATALOGUE_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('categoryTopics.json dosyası okunamadı.');
    const data = await response.json();
    if (!data || typeof data !== 'object') throw new Error('Konu verisi geçerli değil.');
    state.catalogue = data;
  } catch (error) {
    state.catalogueError = error.message || 'Konu verisi yüklenemedi.';
  }
  render();
}

render();
loadCatalogue();
