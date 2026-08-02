const STORAGE_KEY = 'sinavrotasi-study-progress-v2';
const CATALOGUE_URL = 'categorytopics.json';
const DEFAULT_DAILY_GOAL = 20;
const DAILY_GOAL_MIN = 1;
const DAILY_GOAL_MAX = 500;
const QUESTION_TIME_LIMIT = 60;

const ROLES = [
  { key: 'memur', label: 'Memur' },
  { key: 'sef', label: 'Şef' },
  { key: 'sayman', label: 'Sayman' },
  { key: 'sube-mudur', label: 'Şube Müdürü' }
];

const ROLE_ICONS = { memur: 'idcard', sef: 'clipboard', sayman: 'calculator', 'sube-mudur': 'landmark' };

// --- BİLGİ KARTLARI KATALOĞU ---
const CARD_CATEGORY_ORDER = ['general-legislation', 'meb-legislation', 'general-culture'];

const CARD_CATALOGUE = {
  'general-legislation': {
    title: 'Genel Mevzuat',
    description: 'Kanunlar ve temel mevzuat kartları',
    icon: 'scale', iconClass: '',
    documents: [
      { id: 'anayasa', title: 'T.C. Anayasası', cardFile: 'cards/anayasa.json' },
      { id: '657-sayili-kanun', title: '657 Sayılı Devlet Memurları Kanunu', cardFile: 'cards/657.json' },
      { id: '4483-sayili-kanun', title: '4483 Sayılı Memurlar ve Diğer Kamu Görevlilerinin Yargılanması Hakkında Kanun', cardFile: 'cards/4483.json' },
      { id: '5442-sayili-kanun', title: '5442 Sayılı İl İdaresi Kanunu', cardFile: 'cards/5442.json' },
      { id: '4982-sayili-kanun', title: '4982 Sayılı Bilgi Edinme Hakkı Kanunu', cardFile: 'cards/4982.json' },
      { id: '3071-sayili-kanun', title: '3071 Sayılı Dilekçe Hakkının Kullanılmasına Dair Kanun', cardFile: 'cards/3071.json' }
    ]
  },
  'meb-legislation': {
    title: 'MEB Mevzuatı', description: 'Millî Eğitim Bakanlığı mevzuat kartları',
    icon: 'schoolbook', iconClass: 'red', documents: []
  },
  'general-culture': {
    title: 'Genel Kültür', description: 'Tarih, coğrafya ve güncel bilgi kartları',
    icon: 'landmark', iconClass: 'blue', documents: []
  }
};

const cardDecks = new Map();

const state = {
  view: 'home',
  catalogue: null,
  catalogueError: '',
  activeCategoryKey: null,
  activeDocument: null,
  navStack: [],
  questionBanks: new Map(),
  quiz: null,
  cardStudy: null,
  expandedMistakeGroup: null
};

// Rota Ayarları State'i
const routeSettings = {
  mode: 'Sana Özel Karma',
  questions: 20,
  time: 'Süreli'
};

const app = document.getElementById('app');
const scrollArea = document.getElementById('scroll-area');
const toast = document.getElementById('toast');
const navButtons = [...document.querySelectorAll('[data-nav]')];

// Konu Paneli (Topic Sheet) Elementleri
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

// Rota Paneli (Route Sheet) Elementleri
const routeSheet = document.getElementById('routeSheet');
const closeRouteSheetButton = document.getElementById('closeRouteSheet');
const startRouteButton = document.getElementById('startRouteButton');
const summaryMode = document.getElementById('summaryMode');
const summaryDuration = document.getElementById('summaryDuration');

// Arama Paneli Elementleri
const openSearchButton = document.getElementById('openSearchButton');
const searchSheet = document.getElementById('searchSheet');
const closeSearchSheetButton = document.getElementById('closeSearchSheet');
const searchInput = document.getElementById('searchInput');
const searchResultsList = document.getElementById('searchResultsList');

let timerInterval = null;
let progress = loadProgress();

const iconPaths = {
  alertX: '<circle cx="12" cy="12" r="9"/><path d="m9.5 9.5 5 5m0-5-5 5"/>',
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
  refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  statTopics: '<rect x="4.5" y="4.5" width="15" height="15" rx="4"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>',
  statQuestions: '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.7 2.7 5.3-5.7"/>',
  statTrials: '<path d="M12 3.2 13.7 5l2.5-.5.6 2.5 2.4.9-.9 2.4 1.7 1.9-1.7 1.9.9 2.4-2.4.9-.6 2.5-2.5-.5-1.7 1.8-1.7-1.8-2.5.5-.6-2.5-2.4-.9.9-2.4L4 12.2l1.7-1.9-.9-2.4 2.4-.9.6-2.5 2.5.5Z"/><path d="M9 13.5 12.5 21l1-4"/><path d="m15 13.5-1.8 3.7"/>',
  idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 15.5c.7-1 2-1.5 3-1.5s2.3.5 3 1.5"/><path d="M15 9h3M15 12h3M15 15h3"/>',
  clipboard: '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1Z"/><path d="m9.5 11 1.5 1.5L14.5 9M9.5 15 11 16.5 14.5 13"/>',
  calculator: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01"/><path d="M8 19h8"/>',
  squareCheck: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 2.5 2.5L16 9"/>',
  circleCheckBig: '<circle cx="12" cy="12" r="10"/><path d="m8 12 2.5 2.5L16 9"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 21.5l-5-3-5 3 1.5-8.6"/>',
};

function svg(name, className = 'ui-icon') {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || ''}</svg>`;
}

function escapeHtml(value = '') {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
  return { userId: null, answers: 0, correctAnswers: 0, dailyAnswers: {}, completedSections: {}, completedTests: [], flaggedQuestions: {}, reportedQuestions: {}, selectedRole: null, purchasedRoles: [], wrongQuestions: {}, dailyGoal: DEFAULT_DAILY_GOAL };
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return defaultProgress();
    const parsedGoal = Number(saved.dailyGoal);
    const safeGoal = Number.isFinite(parsedGoal) && parsedGoal >= DAILY_GOAL_MIN && parsedGoal <= DAILY_GOAL_MAX ? Math.round(parsedGoal) : DEFAULT_DAILY_GOAL;
    return { ...defaultProgress(), ...saved, dailyAnswers: saved.dailyAnswers || {}, completedSections: saved.completedSections || {}, completedTests: Array.isArray(saved.completedTests) ? saved.completedTests : [], flaggedQuestions: saved.flaggedQuestions || {}, reportedQuestions: saved.reportedQuestions || {}, purchasedRoles: Array.isArray(saved.purchasedRoles) ? saved.purchasedRoles : [], wrongQuestions: saved.wrongQuestions || {}, dailyGoal: safeGoal };
  } catch (error) {
    return defaultProgress();
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  updateHeader();
  if (state.view === 'home' || state.view === 'wrong' || state.view === 'profile' || state.view === 'mistakes') render();
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

function getDailyGoal() {
  const value = Number(progress.dailyGoal);
  return Number.isFinite(value) && value >= DAILY_GOAL_MIN && value <= DAILY_GOAL_MAX ? value : DEFAULT_DAILY_GOAL;
}

function setDailyGoal(rawValue) {
  const parsed = Math.round(Number(rawValue));
  if (!Number.isFinite(parsed) || parsed < DAILY_GOAL_MIN || parsed > DAILY_GOAL_MAX) {
    showToast(`Lütfen ${DAILY_GOAL_MIN} ile ${DAILY_GOAL_MAX} arasında bir sayı gir.`);
    return false;
  }
  progress.dailyGoal = parsed;
  saveProgress();
  showToast(`Günlük hedef ${parsed} soru olarak güncellendi.`);
  return true;
}

function getStats() {
  const completedSections = Object.keys(progress.completedSections).length;
  const completedMocks = progress.completedTests.filter(test => test.kind === 'mock').length;
  const todayAnswers = Number(progress.dailyAnswers[dateKey()] || 0);
  const dailyGoal = getDailyGoal();
  return {
    completedSections,
    solvedQuestions: Number(progress.answers || 0),
    completedMocks,
    streak: getStreak(),
    todayAnswers,
    dailyGoal,
    dailyPercentage: Math.min(100, Math.round((todayAnswers / dailyGoal) * 100)),
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
  return String(value).toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function looksLikeDocument(title) {
  return /sayılı|kanunu|yönetmeliği|kararnamesi|khk/i.test(title);
}

function normalizeItem(item) {
  if (typeof item !== 'string') return item;
  return { id: slugify(item), title: item, type: looksLikeDocument(item) ? 'document' : 'topic', contentStatus: 'planned', questionCount: 0, articleCount: 0, children: [] };
}

function getCategory(categoryKey) {
  return state.catalogue && state.catalogue[categoryKey];
}

function getCategoryItems(categoryKey) {
  const category = getCategory(categoryKey);
  const role = progress.selectedRole;
  return category ? (category.topics || []).map(normalizeItem).filter(item => !role || !item.kadrolar || item.kadrolar.includes(role)) : [];
}

function isRolePurchased(role = progress.selectedRole) {
  return !role || progress.purchasedRoles.includes(role);
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
  const purchased = isRolePurchased();
  return getCategories().flatMap(([categoryKey]) => getCategoryItems(categoryKey)
    .map((item, index) => ({ item, categoryKey, index }))
    .filter(entry => (entry.item.type === 'document' || entry.item.type === 'topic') && entry.item.questionFile && (purchased || entry.index === 0)));
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
  const categories = getCategories().filter(([key]) => getCategoryItems(key).length > 0).map(([key]) => {
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
      ${statCard('squareCheck', '', stats.completedSections, 'Konu<br>Tamamlandı', 'wrong')}
      ${statCard('circleCheckBig', 'accent', stats.solvedQuestions, 'Soru<br>Çözüldü', 'wrong')}
      ${statCard('award', 'amber', stats.completedMocks, 'Deneme<br>Tamamlandı', 'bank')}
      ${statCard('flame', 'accent', stats.streak, 'Günlük<br>Seri', 'wrong')}
    </div>
    <div class="section-head"><h3>Test Kategorileri</h3></div>
    <section class="categories">${categories}</section>
    
    <!-- BUGÜNKÜ ROTA BUTONU -->
    <button class="cta-btn" id="openRouteSheetButton" type="button">
      <div class="cta-icon">${svg('target')}</div><div><strong>Bugünkü Rota</strong><span>Önerilen planı gör veya özelleştir</span></div><span class="chevron-w">${svg('arrow')}</span>
    </button>
  </section>`;
}

function bankView() {
  const stats = getStats();
  const activeDocuments = getActiveDocuments();
  const recentTests = progress.completedTests.slice(-3).reverse();
  return `<section class="screen content-screen">
    <div class="page-heading"><span>DENEMELER</span><h2>Hızlı denemeler</h2><p>Aktif soru bankalarından oluşan denemelerle performansını ölç.</p></div>
    <article class="practice-card">
      <div class="practice-card-icon">${svg('trophy')}</div>
      <div><span>KARMA MEVZUAT</span><h3>20 soruluk hızlı deneme</h3><p>${activeDocuments.length ? `${activeDocuments.length} aktif paketten dengeli rastgele seçilir.` : 'Aktif soru paketi bulunmuyor.'}</p></div>
      <button class="reader-primary" id="startMockButton" type="button" ${activeDocuments.length ? '' : 'disabled'}>Başlat</button>
    </article>
    <div class="metric-strip"><div><strong>${stats.completedMocks}</strong><span>Tamamlanan deneme</span></div><div><strong>%${stats.accuracy}</strong><span>Genel doğruluk</span></div></div>
    <section class="recent-tests"><h3>Son testler</h3>${recentTests.length ? recentTests.map(test => `<article><div><strong>${escapeHtml(test.title)}</strong><span>${test.score}/${test.total} doğru</span></div><small>${test.kind === 'mock' ? 'Deneme' : 'Konu testi'}</small></article>`).join('') : '<div class="empty-inline">Henüz tamamlanan bir test yok.</div>'}</section>
  </section>`;
}

function studiesView() {
  const stats = getStats();
  return `<section class="screen content-screen">
    <div class="page-heading"><span>ÇALIŞMALARIM</span><h2>İlerlemen</h2><p>Bu değerler cevapların ve tamamladığın testlerle otomatik güncellenir.</p></div>
    <div class="study-grid">
      <article><span>Çözülen soru</span><strong>${stats.solvedQuestions}</strong></article>
      <article><span>Doğruluk oranı</span><strong>%${stats.accuracy}</strong></article>
      <article><span>Tamamlanan bölüm</span><strong>${stats.completedSections}</strong></article>
      <article><span>Günlük seri</span><strong>${stats.streak} gün</strong></article>
    </div>
  </section>`;
}

function getWrongQuestionsGrouped() {
  const map = new Map();
  Object.values(progress.wrongQuestions).forEach(q => {
    const catKey = q.categoryKey || 'other';
    const docKey = q.documentId || 'other-doc';
    if (!map.has(catKey)) map.set(catKey, new Map());
    const docMap = map.get(catKey);
    if (!docMap.has(docKey)) docMap.set(docKey, { documentId: docKey, documentTitle: q.documentTitle || 'Diğer Sorular', questions: [] });
    docMap.get(docKey).questions.push(q);
  });
  return map;
}

function getMistakeDocuments(categoryKey) {
  const grouped = getWrongQuestionsGrouped();
  const docMap = grouped.get(categoryKey);
  if (!docMap) return [];
  let list = [...docMap.values()];
  if (categoryKey !== 'other' && getCategory(categoryKey)) {
    const allowedIds = new Set(getCategoryItems(categoryKey).map(item => item.id));
    list = list.filter(doc => allowedIds.has(doc.documentId));
  }
  return list.sort((a, b) => b.questions.length - a.questions.length);
}

function mistakeCategoryMeta(categoryKey) {
  if (categoryKey === 'other' || !getCategory(categoryKey)) return { title: 'Diğer Sorular', icon: 'book', iconClass: '' };
  return categoryCardMeta(categoryKey);
}

function getMistakeCategories() {
  const grouped = getWrongQuestionsGrouped();
  return [...grouped.keys()].map(key => {
    const docs = getMistakeDocuments(key);
    const count = docs.reduce((sum, d) => sum + d.questions.length, 0);
    if (!count) return null;
    const meta = mistakeCategoryMeta(key);
    return { key, title: meta.title, icon: meta.icon, iconClass: meta.iconClass, count };
  }).filter(Boolean).sort((a, b) => b.count - a.count);
}

function mistakesView() {
  const totalCount = Object.keys(progress.wrongQuestions).length;
  if (!totalCount) {
    return `<section class="screen content-screen">
      <div class="page-heading"><span>TEKRAR HAVUZU</span><h2>Yanlışlarım</h2><p>Daha önce yanlış yaptığın tüm sorular burada birikir.</p></div>
      <div class="empty-inline">Henüz yanlış yaptığın bir soru yok.</div>
    </section>`;
  }
  const categories = getMistakeCategories();
  return `<section class="screen content-screen">
    <div class="page-heading"><span>TEKRAR HAVUZU</span><h2>Yanlışlarım</h2><p>Daha önce yanlış yaptığın tüm sorular burada birikir.</p></div>
    <article class="practice-card">
      <div class="practice-card-icon">${svg('flame')}</div>
      <div><span>TEKRAR HAVUZU</span><h3>${totalCount} soru</h3><p>Tüm yanlış sorularını sırasıyla tekrar çöz.</p></div>
      <button class="reader-primary" id="startWrongPoolButton" type="button">Başlat</button>
    </article>
    <div class="section-head" style="margin-top:18px"><h3>Yanlışlarım</h3></div>
    <section class="categories">
      ${categories.map(cat => `<article class="category" role="button" tabindex="0" data-open-mistake-category="${cat.key}">
        <div class="cat-icon ${cat.iconClass}">${svg(cat.icon)}</div>
        <div class="cat-copy"><h4>${escapeHtml(cat.title)}</h4><small>${cat.count} soru</small></div>
        <div class="chevron">${svg('arrow')}</div>
      </article>`).join('')}
    </section>
  </section>`;
}

function openMistakeCategorySheet(categoryKey) {
  clearInterval(timerInterval);
  topicSheet.classList.add('open');
  topicBackdrop.classList.add('open');
  renderMistakeCategoryLevel(categoryKey);
}

function renderMistakeCategoryLevel(categoryKey) {
  resetSheetClasses();
  const meta = mistakeCategoryMeta(categoryKey);
  const docs = getMistakeDocuments(categoryKey);
  const total = docs.reduce((sum, d) => sum + d.questions.length, 0);
  applySheetHeader({ title: meta.title, subtitle: `${total} yanlış soru`, eyebrow: 'YANLIŞLARIM', icon: meta.icon, iconClass: meta.iconClass });
  topicBreadcrumbWrap.innerHTML = '';
  setSheetProgress(`${docs.length} konu`, 0);
  if (!docs.length) {
    topicList.innerHTML = `<div class="empty-inline">Bu kategoride yanlış sorun yok.</div>`;
    topicSheet.scrollTop = 0;
    return;
  }
  topicList.innerHTML = docs.map((doc, index) => `
    <article class="topic-item" data-mistake-doc-index="${index}" role="button" tabindex="0">
      <div class="topic-number">${String(index + 1).padStart(2, '0')}</div>
      <div class="topic-copy"><h4>${escapeHtml(doc.documentTitle)}</h4><p>${doc.questions.length} yanlış soru</p></div>
      <div class="topic-arrow">${svg('arrow')}</div>
    </article>`).join('');
  topicList.querySelectorAll('[data-mistake-doc-index]').forEach(element => {
    const open = () => renderMistakeDocument(categoryKey, docs[Number(element.dataset.mistakeDocIndex)]);
    element.addEventListener('click', open);
    element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') open(); });
  });
  topicSheet.scrollTop = 0;
}

function renderMistakeDocument(categoryKey, doc) {
  topicSheet.classList.add('document-flow');
  const meta = mistakeCategoryMeta(categoryKey);
  applySheetHeader({ title: doc.documentTitle, subtitle: `${doc.questions.length} yanlış soru`, eyebrow: 'YANLIŞLARIM', icon: 'book', iconClass: meta.iconClass });
  renderBreadcrumb(meta.title, () => renderMistakeCategoryLevel(categoryKey));
  setSheetProgress(`${doc.questions.length} soru`, 0);
  topicList.innerHTML = `
    <button class="reader-primary" id="startMistakeDocButton" type="button" style="width:100%;margin-bottom:14px">Bu konudaki ${doc.questions.length} soruyu çöz</button>
    <div class="quiz-result-list">
      ${doc.questions.map(q => `<article class="quiz-result-item"><p>${escapeHtml(q.prompt)}</p><small>Doğru cevap: ${escapeHtml(q.options[q.answerIndex])}</small></article>`).join('')}
    </div>`;
  document.getElementById('startMistakeDocButton').addEventListener('click', () => startMistakeDocumentQuiz(categoryKey, doc));
  topicSheet.scrollTop = 0;
}

function startMistakeDocumentQuiz(categoryKey, doc) {
  if (!doc.questions.length) return showToast('Bu konuda tekrar edilecek soru yok.');
  startQuiz({
    questions: doc.questions,
    kind: 'wrong-group',
    title: doc.documentTitle,
    subtitle: `${doc.questions.length} soru • tekrar`,
    returnView: () => renderMistakeCategoryLevel(categoryKey)
  });
}

function startWrongPool() {
  const questions = Object.values(progress.wrongQuestions);
  if (!questions.length) return showToast('Tekrar edilecek soru yok.');
  topicSheet.classList.add('open');
  topicBackdrop.classList.add('open');
  startQuiz({
    questions,
    kind: 'wrong-pool',
    title: 'Yanlışlarım',
    subtitle: `${questions.length} soru • tekrar havuzu`,
    returnView: closeTopicSheet
  });
}

// --- BİLGİ KARTLARI (KARTLARIM) EKRANLARI ---
function cardsView() {
  return `<section class="screen content-screen">
    <div class="page-heading"><span>KARTLARIM</span><h2>Bilgi Kartları</h2><p>Kategorini seç, soru-cevap kartlarıyla hızlı tekrar yap.</p></div>
    <section class="categories">
      ${CARD_CATEGORY_ORDER.map(key => {
        const meta = CARD_CATALOGUE[key];
        const activeCount = meta.documents.filter(d => d.cardFile).length;
        const metaText = meta.documents.length ? `${meta.documents.length} kaynak • ${activeCount} aktif set` : 'İçerik yakında eklenecek';
        return `<article class="category" role="button" tabindex="0" data-open-card-category="${key}">
          <div class="cat-icon ${meta.iconClass}">${svg(meta.icon)}</div>
          <div class="cat-copy"><h4>${escapeHtml(meta.title)}</h4><p>${escapeHtml(meta.description)}</p><small>${metaText}</small></div>
          <div class="chevron">${svg('arrow')}</div>
        </article>`;
      }).join('')}
    </section>
  </section>`;
}

function openCardCategorySheet(categoryKey) {
  const category = CARD_CATALOGUE[categoryKey];
  if (!category) return showToast('Kategori bulunamadı.');
  clearInterval(timerInterval);
  topicSheet.classList.add('open');
  topicBackdrop.classList.add('open');
  renderCardCategoryLevel(categoryKey);
}

function renderCardCategoryLevel(categoryKey) {
  const category = CARD_CATALOGUE[categoryKey];
  resetSheetClasses();
  applySheetHeader({ title: category.title, subtitle: 'Çalışmak istediğin kaynağı seç.', eyebrow: 'BİLGİ KARTLARI', icon: category.icon, iconClass: category.iconClass });
  topicBreadcrumbWrap.innerHTML = '';
  setSheetProgress('Bir kaynak seç', 0);
  if (!category.documents.length) {
    topicList.innerHTML = `<section class="empty-state content-plan"><span class="empty-state-icon">${svg('book')}</span><h3>Bu kategori için kart seti hazırlanıyor</h3><p>Kaynaklar eklendiğinde burada otomatik olarak görünecek.</p></section>`;
    topicSheet.scrollTop = 0;
    return;
  }
  topicList.innerHTML = category.documents.map((doc, index) => {
    const info = doc.cardFile ? 'Aktif kart seti' : 'Yakında eklenecek';
    return `<article class="topic-item ${doc.cardFile ? '' : 'is-disabled'}" data-card-doc-index="${index}" role="button" tabindex="0">
      <div class="topic-number">${String(index + 1).padStart(2, '0')}</div>
      <div class="topic-copy"><h4>${escapeHtml(doc.title)}</h4><p>${info}</p></div>
      <div class="topic-arrow">${svg('arrow')}</div>
    </article>`;
  }).join('');
  topicList.querySelectorAll('[data-card-doc-index]').forEach(element => {
    const open = () => {
      const doc = category.documents[Number(element.dataset.cardDocIndex)];
      if (!doc.cardFile) return showToast('Bu kaynak için kart seti henüz eklenmedi.');
      openCardDeck(doc, categoryKey);
    };
    element.addEventListener('click', open);
    element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') open(); });
  });
  topicSheet.scrollTop = 0;
}

async function loadCardDeck(doc) {
  if (!doc.cardFile) throw new Error('Bu kaynak için kart seti henüz eklenmedi.');
  if (cardDecks.has(doc.id)) return cardDecks.get(doc.id);
  const response = await fetch(doc.cardFile, { cache: 'no-store' });
  if (!response.ok) throw new Error('Kart dosyası okunamadı.');
  const data = await response.json();
  const cards = Array.isArray(data.cards) ? data.cards : [];
  cardDecks.set(doc.id, cards);
  return cards;
}

async function openCardDeck(doc, categoryKey) {
  try {
    showToast('Kartlar hazırlanıyor…');
    const cards = await loadCardDeck(doc);
    if (!cards.length) return showToast('Bu kaynak için henüz kart bulunmuyor.');
    state.cardStudy = { doc, categoryKey, cards: shuffle(cards), index: 0, flipped: false };
    renderCardStudy();
  } catch (error) {
    showToast(error.message || 'Kartlar yüklenemedi.');
  }
}

function renderCardStudy() {
  const study = state.cardStudy;
  if (!study) return;
  topicSheet.classList.add('document-flow', 'card-study-active');
  topicSheet.classList.remove('quiz-active');
  const category = CARD_CATALOGUE[study.categoryKey];
  applySheetHeader({ title: study.doc.title, subtitle: `${study.index + 1} / ${study.cards.length}`, eyebrow: 'BİLGİ KARTLARI', icon: 'gavel', iconClass: category.iconClass });
  renderBreadcrumb(category.title, () => { state.cardStudy = null; topicSheet.classList.remove('card-study-active'); renderCardCategoryLevel(study.categoryKey); });
  setSheetProgress('', Math.round(((study.index + 1) / study.cards.length) * 100));
  const current = study.cards[study.index];
  topicList.innerHTML = `
    <div class="card-study-wrap">
      <div class="flip-card ${study.flipped ? 'flipped' : ''}" id="flipCard">
        <div class="flip-card-inner">
          <div class="flip-card-face flip-card-front">
            <span class="flip-card-label">${escapeHtml(category.title)}</span>
            <span class="flip-card-q-mark">?</span>
            <p class="flip-card-text">${escapeHtml(current.question)}</p>
            <span class="flip-card-hint">Kartı çevirmek için tıkla</span>
          </div>
          <div class="flip-card-face flip-card-back">
            <p class="flip-card-text">${escapeHtml(current.answer)}</p>
            <span class="flip-card-hint">Kartı geri çevirmek için tıkla</span>
          </div>
        </div>
      </div>
      <div class="card-study-nav">
        <button class="card-nav-btn" id="cardPrevButton" type="button" ${study.index === 0 ? 'disabled' : ''}>${svg('arrowLeft')}</button>
        <span class="card-nav-count">${study.index + 1} / ${study.cards.length}</span>
        <button class="card-nav-btn" id="cardNextButton" type="button" ${study.index === study.cards.length - 1 ? 'disabled' : ''}>${svg('arrowRight')}</button>
      </div>
    </div>`;
  document.getElementById('flipCard').addEventListener('click', () => {
    study.flipped = !study.flipped;
    haptic(12);
    renderCardStudy();
  });
  document.getElementById('cardPrevButton')?.addEventListener('click', () => {
    if (study.index > 0) { study.index -= 1; study.flipped = false; renderCardStudy(); }
  });
  document.getElementById('cardNextButton')?.addEventListener('click', () => {
    if (study.index < study.cards.length - 1) { study.index += 1; study.flipped = false; renderCardStudy(); }
  });
  topicSheet.scrollTop = 0;
}

function profileView() {
  const stats = getStats();
  const user = window.currentUser;
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Aday';
  const email = user?.email || '';
  const initial = fullName.trim().charAt(0).toUpperCase() || '?';
  return `<section class="screen content-screen"><div class="page-heading"><span>PROFİL</span><h2>${escapeHtml(fullName)}</h2><p>${escapeHtml(email)}</p></div><article class="profile-summary"><div class="profile-summary-avatar">${escapeHtml(initial)}</div><div><strong>Hedef: MEB GYS</strong><span>${stats.solvedQuestions} soru • %${stats.accuracy} doğruluk</span></div></article>
  <section class="profile-goal-card">
    <div class="profile-goal-head"><span>GÜNLÜK ÇALIŞMA HEDEFİ</span><strong>${stats.dailyGoal} soru / gün</strong></div>
    <p class="profile-goal-desc">Her gün çözmek istediğin soru sayısını belirle, ana sayfadaki ilerleme halkası buna göre hesaplanır.</p>
    <div class="profile-goal-edit">
      <input type="number" id="profileDailyGoalInput" class="goal-edit-input" min="${DAILY_GOAL_MIN}" max="${DAILY_GOAL_MAX}" step="1" inputmode="numeric" value="${stats.dailyGoal}" aria-label="Günlük hedef soru sayısı">
      <button class="reader-primary" id="profileDailyGoalSaveButton" type="button">Kaydet</button>
    </div>
  </section>
  <div class="profile-notice">İstatistikler şu an cihazında saklanır; hesap bazlı senkronizasyon yakında eklenecek.</div><section class="profile-account-actions"><button class="reset-progress" id="resetProgressButton" type="button">İlerleme verisini sıfırla</button><button class="signout-btn" id="signOutButton" type="button">${svg('lock')}<span>Çıkış Yap</span></button></section></section>`;
}

function render() {
  const views = { home: homeView, bank: bankView, wrong: studiesView, mistakes: mistakesView, cards: cardsView, profile: profileView };
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
  app.querySelectorAll('[data-open-card-category]').forEach(element => {
    element.addEventListener('click', () => openCardCategorySheet(element.dataset.openCardCategory));
    element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') openCardCategorySheet(element.dataset.openCardCategory); });
  });
  app.querySelectorAll('[data-stat-target]').forEach(element => element.addEventListener('click', () => window.go(element.dataset.statTarget)));
  
  // Rota panelini açma butonu
  document.getElementById('openRouteSheetButton')?.addEventListener('click', openRouteSheet);
  
  document.getElementById('startMockButton')?.addEventListener('click', startMixedMock);
  document.getElementById('startWrongPoolButton')?.addEventListener('click', startWrongPool);
  app.querySelectorAll('[data-open-mistake-category]').forEach(element => {
  element.addEventListener('click', () => openMistakeCategorySheet(element.dataset.openMistakeCategory));
  element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') openMistakeCategorySheet(element.dataset.openMistakeCategory); });
    });
  document.getElementById('resetProgressButton')?.addEventListener('click', resetProgress);
  document.getElementById('signOutButton')?.addEventListener('click', () => window.signOut());

  const profileGoalInput = document.getElementById('profileDailyGoalInput');
  const profileGoalSaveButton = document.getElementById('profileDailyGoalSaveButton');
  profileGoalSaveButton?.addEventListener('click', () => { if (profileGoalInput) setDailyGoal(profileGoalInput.value); });
  profileGoalInput?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); profileGoalSaveButton?.click(); } });
}

function updateHeader() {
  const stats = getStats();
  const roleBadge = document.getElementById('userRoleBadge');
  if (roleBadge) roleBadge.textContent = ROLES.find(r => r.key === progress.selectedRole)?.label || '';
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
  total.textContent = stats.dailyGoal;
  progressFill.style.width = `${stats.dailyPercentage}%`;
  message.textContent = stats.dailyPercentage >= 100 ? 'Günlük hedefini tamamladın. Harika iş!' : stats.todayAnswers ? 'Hedefine düzenli biçimde yaklaşıyorsun.' : 'İlk soruyla günlük hedefini başlat.';
}

function resetProgress() {
  if (!window.confirm('Tüm yerel çalışma ilerlemesi sıfırlansın mı?')) return;
  progress = defaultProgress();
  saveProgress();
  showToast('İlerleme verisi sıfırlandı.');
}

// --- ROTA PANELİ YÖNETİMİ ---
function openRouteSheet() {
  searchSheet.classList.remove('open');
  routeSheet.classList.add('open');
  topicBackdrop.classList.add('open');
}

function closeRouteSheet() {
  routeSheet.classList.remove('open');
  if (!topicSheet.classList.contains('open')) {
    topicBackdrop.classList.remove('open');
  }
}

function updateRouteSummary() {
  startRouteButton.textContent = `${routeSettings.questions} Soruluk Rotayı Başlat`;
  if (routeSettings.time === 'Süresiz') {
    summaryDuration.textContent = 'Süresiz';
  } else {
    summaryDuration.textContent = `${routeSettings.questions} dakika`; // artık soru sayısı = dakika
  }
}

function bindRouteSheetEvents() {
  document.querySelectorAll('#modeGrid .mode-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modeGrid .mode-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      routeSettings.mode = btn.dataset.mode;
      summaryMode.textContent = routeSettings.mode;
    });
  });

  document.querySelectorAll('#questionChoices .choice').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#questionChoices .choice').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      routeSettings.questions = Number(btn.dataset.questions);
      updateRouteSummary();
    });
  });

  document.querySelectorAll('#timeChoices .choice').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#timeChoices .choice').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      routeSettings.time = btn.dataset.time;
      updateRouteSummary();
    });
  });

  closeRouteSheetButton?.addEventListener('click', closeRouteSheet);
  
  startRouteButton?.addEventListener('click', () => {
  routeSheet.classList.remove('open');
  startSmartPractice();
  });
}

// --- ARAMA PANELİ YÖNETİMİ ---
function openSearchSheet() {
  routeSheet.classList.remove('open');
  searchSheet.classList.add('open');
  topicBackdrop.classList.add('open');
  window.setTimeout(() => searchInput.focus(), 300);
  runSearch('');
}

function closeSearchSheet() {
  searchSheet.classList.remove('open');
  searchInput.value = '';
  searchResultsList.innerHTML = '';
  if (!topicSheet.classList.contains('open') && !routeSheet.classList.contains('open')) {
    topicBackdrop.classList.remove('open');
  }
}

function collectSearchIndex() {
  const index = [];
  getCategories().forEach(([categoryKey, category]) => {
    getCategoryItems(categoryKey).forEach(item => {
      index.push({ type: item.type, title: item.title, categoryKey, categoryTitle: category.title, item, icon: item.type === 'document' ? 'gavel' : 'book' });
      (item.children || []).forEach(section => {
        index.push({ type: 'section', title: section.title, categoryKey, categoryTitle: category.title, item, section, icon: 'gavel', context: item.title });
        (section.children || []).forEach(article => {
          const label = article.summary || article.title || '';
          if (label) index.push({ type: 'article', title: label, categoryKey, categoryTitle: category.title, item, section, article, icon: 'book', context: `${item.title} • ${section.title}` });
        });
      });
    });
  });
  return index;
}

function runSearch(query) {
  if (!state.catalogue) {
    searchResultsList.innerHTML = '<div class="empty-inline">İçerikler henüz yüklenmedi.</div>';
    return;
  }
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    searchResultsList.innerHTML = '<div class="empty-inline">Aramak için en az 2 karakter yaz.</div>';
    return;
  }
  const needle = trimmed.toLocaleLowerCase('tr-TR');
  const results = collectSearchIndex().filter(entry => entry.title.toLocaleLowerCase('tr-TR').includes(needle)).slice(0, 30);
  searchResultsList.innerHTML = results.length ? results.map((result, index) => `
    <article class="topic-item" data-search-index="${index}" role="button" tabindex="0">
      <div class="topic-number">${svg(result.icon)}</div>
      <div class="topic-copy"><h4>${escapeHtml(result.title)}</h4><p>${escapeHtml(result.context || result.categoryTitle)}</p></div>
      <div class="topic-arrow">${svg('arrow')}</div>
    </article>`).join('') : '<div class="empty-inline">Sonuç bulunamadı.</div>';
  searchResultsList.querySelectorAll('[data-search-index]').forEach(element => {
    const open = () => openSearchResult(results[Number(element.dataset.searchIndex)]);
    element.addEventListener('click', open);
    element.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') open(); });
  });
}

function openSearchResult(result) {
  closeSearchSheet();
  topicSheet.classList.add('open');
  topicBackdrop.classList.add('open');
  if (result.type === 'section' || result.type === 'article') {
    renderSummary(result.item, result.categoryKey);
  } else if (result.item.type === 'document') {
    renderDocumentHub(result.item, result.categoryKey);
  } else {
    renderTopicPlan(result.item, result.categoryKey);
  }
}

openSearchButton?.addEventListener('click', openSearchSheet);
closeSearchSheetButton?.addEventListener('click', closeSearchSheet);
searchInput?.addEventListener('input', () => runSearch(searchInput.value));

function resetSheetClasses() {
  topicSheet.classList.remove('document-flow', 'quiz-active', 'card-study-active');
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
  state.cardStudy = null;
  resetSheetClasses();
  topicSheet.classList.remove('open');
  if (!routeSheet.classList.contains('open')) {
    topicBackdrop.classList.remove('open');
  }
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
  refreshVisibleQuestionCounts(items, () => { if (state.activeCategoryKey === categoryKey && !state.activeDocument) renderCategoryLevel(categoryKey); });
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
  topicSheet.classList.remove('quiz-active', 'card-study-active');
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
  refreshVisibleQuestionCounts([documentItem], () => { if (state.activeDocument === documentItem) renderDocumentHub(documentItem, categoryKey); });
}

function modeCard(mode, icon, title, description, enabled) {
  return `<button class="document-mode-card ${enabled ? '' : 'is-disabled'}" data-document-mode="${mode}" type="button" ${enabled ? '' : 'disabled'}><span class="document-mode-icon">${svg(icon)}</span><strong>${title}</strong><small>${description}</small></button>`;
}

function renderTopicPlan(item, categoryKey) {
  topicSheet.classList.add('document-flow');
  const isActive = Boolean(item.questionFile);
  applySheetHeader({ title: item.title, subtitle: isActive ? `${item.questionCount || 0} soru • aktif soru bankası` : 'İçerik şablonu hazır', eyebrow: 'KONU ÇALIŞMA MERKEZİ', icon: 'book', iconClass: categoryCardMeta(categoryKey).iconClass });
  renderBreadcrumb(getCategory(categoryKey).title, () => renderCategoryLevel(categoryKey));
  setSheetProgress('Henüz çalışılmadı', isActive && progress.completedSections[item.id] ? 100 : 0);
  if (!isActive) {
    topicList.innerHTML = `<section class="empty-state content-plan"><span class="empty-state-icon">${svg('book')}</span><h3>Bu konu için altyapı hazır</h3><p>Soru bankası JSON ile eklendiğinde bu ekran otomatik olarak çalışma akışına dönüşür.</p><div class="plan-points"><span>${svg('check')} Konu geneli test</span><span>${svg('check')} Karışık soru havuzu</span><span>${svg('check')} İlerleme takibi</span></div></section>`;
    topicSheet.scrollTop = 0;
    return;
  }
  const completed = Boolean(progress.completedSections[item.id]);
  topicList.innerHTML = `<section class="document-overview-card">
      <div class="document-overview-top"><span class="document-number">KONU</span><span class="document-status">AKTİF SORU BANKASI</span></div>
      <h4>${escapeHtml(item.title)}</h4><p>Konunun tamamından karışık sorularla çalış, ilerlemen otomatik kaydedilir.</p>
      <div class="document-stats"><span><strong>${item.questionCount || 0}</strong> soru</span><span><strong>%${completed ? 100 : 0}</strong> ilerleme</span></div>
    </section>
    <div class="document-mode-grid">
      ${modeCard('topic-quiz', 'target', `${Math.min(20, item.questionCount || 20)} Soruluk Test`, 'Konunun tüm soru havuzundan karışık test başlat.', true)}
      ${modeCard('topic-all', 'book', 'Tüm Soruları Çöz', 'Bankadaki bütün soruları sırayla çöz.', true)}
    </div>`;
  topicList.querySelectorAll('[data-document-mode]').forEach(button => button.addEventListener('click', async () => {
    haptic(18);
    const mode = button.dataset.documentMode;
    try {
      showToast('Sorular hazırlanıyor…');
      const bank = tagQuestions(await loadQuestionBank(item), item, categoryKey);
      if (!bank.length) return showToast('Bu konu için henüz soru bulunmuyor.');
      const questions = mode === 'topic-quiz' ? shuffle(bank).slice(0, Math.min(20, bank.length)) : bank;
      startQuiz({
        questions,
        documentItem: item,
        section: { id: item.id, title: item.title },
        kind: 'topic',
        title: item.title,
        subtitle: `${questions.length} soru`,
        returnView: () => renderTopicPlan(item, categoryKey)
      });
    } catch (error) {
      showToast(error.message || 'Sorular yüklenemedi.');
    }
  }));
  topicSheet.scrollTop = 0;
  refreshVisibleQuestionCounts([item], () => { if (state.activeDocument === item) renderTopicPlan(item, categoryKey); });
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

async function refreshVisibleQuestionCounts(items, onUpdate) {
  const targets = (items || []).filter(item => item && item.questionFile);
  if (!targets.length) return;
  const results = await Promise.allSettled(targets.map(async item => {
    const bank = await loadQuestionBank(item);
    return { item, count: bank.length };
  }));
  let changed = false;
  results.forEach(result => {
    if (result.status !== 'fulfilled') return;
    const { item, count } = result.value;
    if (item.questionCount !== count) {
      item.questionCount = count;
      changed = true;
    }
  });
  if (changed) onUpdate();
}

function shuffle(list) {
  const items = list.slice();
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
  return items;
}

function tagQuestions(bank, documentItem, categoryKey) {
  return bank.map(question => ({
    ...question,
    documentId: documentItem.id,
    documentTitle: documentItem.title,
    categoryKey: categoryKey || null
  }));
}

async function openSectionQuiz(documentItem, section, categoryKey) {
  try {
    showToast('Sorular hazırlanıyor…');
    const bank = tagQuestions(await loadQuestionBank(documentItem), documentItem, categoryKey);
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
    const bank = tagQuestions(await loadQuestionBank(documentItem), documentItem, categoryKey);
    if (!bank.length) return showToast('Bu başlık için henüz soru bulunmuyor.');
    startQuiz({
      questions: shuffle(bank).slice(0, Math.min(20, bank.length)),
      documentItem,
      kind: 'random',
      title: documentItem.title,
      subtitle: `Rastgele 20 soru`,
      returnView: () => renderDocumentHub(documentItem, categoryKey)
    });
  } catch (error) {
    showToast(error.message || 'Sorular yüklenemedi.');
  }
}

async function startSmartPractice() {
  const activeDocuments = getActiveDocuments();
  if (!activeDocuments.length) {
    closeRouteSheet();
    return showToast('Henüz aktif soru paketi bulunmuyor.');
  }
  
  const selected = activeDocuments[Math.floor(Math.random() * activeDocuments.length)];
  
  try {
    showToast('Rota hazırlanıyor…');
    const bank = tagQuestions(await loadQuestionBank(selected.item), selected.item, selected.categoryKey);
    if (!bank.length) {
      closeRouteSheet();
      return showToast('Bu başlık için henüz soru bulunmuyor.');
    }
    
    topicSheet.classList.add('open');
    topicBackdrop.classList.add('open');
    
    startQuiz({
      questions: shuffle(bank).slice(0, Math.min(routeSettings.questions, bank.length)),
      documentItem: selected.item,
      kind: 'route',
      title: 'Bugünkü Rota',
      subtitle: `${routeSettings.mode} • ${routeSettings.questions} Soru`,
      returnView: closeTopicSheet
    });
  } catch (error) {
    closeRouteSheet();
    showToast(error.message || 'Sorular yüklenemedi.');
  }
}

async function startMixedMock() {
  const activeDocuments = getActiveDocuments();
  if (!activeDocuments.length) return showToast('Henüz aktif soru paketi bulunmuyor.');
  try {
    showToast('Deneme hazırlanıyor…');
    const banks = await Promise.all(activeDocuments.map(async ({ item, categoryKey }) =>
    tagQuestions(await loadQuestionBank(item), item, categoryKey)
      ));
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

  const isTimed = routeSettings.time === 'Süreli' || kind !== 'route';
  const totalTime = isTimed ? questions.length * QUESTION_TIME_LIMIT : 9999;

  state.quiz = {
    questions: shuffle(questions).map(question => ({ ...question, userSelected: null, answerRecorded: false })),
    sourceQuestions: questions,
    documentItem,
    section,
    kind,
    title,
    subtitle,
    isTimed,
    timeLeft: totalTime,   // <-- tek, teste ait sayaç
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
  if (selected === question.answerIndex) {
    progress.correctAnswers += 1;
    delete progress.wrongQuestions[question.id];
  } else {
    progress.wrongQuestions[question.id] = {
      id: question.id,
      prompt: question.prompt,
      options: question.options,
      answerIndex: question.answerIndex,
      sectionId: question.sectionId || null,
      documentId: question.documentId || null,
      documentTitle: question.documentTitle || null,
      categoryKey: question.categoryKey || null
    };
  }
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
  
const timerDisplay = quiz.isTimed ?
  `<div class="quiz-premium-timer" id="quizTimer">${svg('clock')} ${String(Math.floor(quiz.timeLeft / 60)).padStart(2, '0')}:${String(quiz.timeLeft % 60).padStart(2, '0')}</div>` :
  `<div class="quiz-premium-timer" style="color:#1f9d62;">Süresiz</div>`;

  const titleText = quiz.kind === 'mock' ? 'Deneme' : quiz.kind === 'route' ? 'Rota' : 'MEB GYS';

  topicList.innerHTML = `
    <div class="quiz-premium-layout">
      <div class="quiz-premium-header">
        <div class="quiz-premium-topbar">
          <button id="quizBackButton" type="button" aria-label="Geri">${svg('back')}</button>
          <div class="quiz-premium-titles">
            <h2>${escapeHtml(titleText)}</h2>
            <span>${escapeHtml(quiz.title)}</span>
          </div>
          <div class="quiz-premium-top-actions">
            ${timerDisplay}
            <button type="button" id="quizGridTopButton" aria-label="Soru haritası">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
          </div>
        </div>
        
        <div class="quiz-premium-progress">
          <span class="progress-text"><strong>${quiz.index + 1}</strong> / ${total}</span>
          <div class="progress-track">
            <div class="progress-fill" style="width:${Math.round(((quiz.index + 1) / total) * 100)}%"></div>
            <div class="progress-handle" style="left:${Math.round(((quiz.index + 1) / total) * 100)}%"></div>
          </div>
        </div>
      </div>

      <div class="quiz-premium-card-wrapper">
        <div class="quiz-premium-card">
          <div class="quiz-card-header">
            <span class="quiz-badge">${escapeHtml(quiz.subtitle)}</span>
            <div class="quiz-card-actions">
              <button type="button" class="action-btn ${progress.flaggedQuestions[current.id] ? 'active' : ''}" id="quizBookmarkButton">${svg('bookmark')}<span>${progress.flaggedQuestions[current.id] ? 'İşaretli' : 'Soruyu İşaretle'}</span></button>
              <button type="button" class="action-btn ${progress.reportedQuestions[current.id] ? 'active' : ''}" id="quizReportButton" ${progress.reportedQuestions[current.id] ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                <span>${progress.reportedQuestions[current.id] ? 'Bildirildi' : 'Soruyu Bildir'}</span>
              </button>
            </div>
          </div>

          <h3 class="quiz-question-text">${escapeHtml(current.prompt)}</h3>

          <div class="quiz-options">
            ${current.options.map((option, index) => {
              let className = 'quiz-option';
              let iconHtml = '';
              const answered = current.userSelected !== null;
              if (answered && index === current.answerIndex) {
                className += ' correct';
                iconHtml = `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
              } else if (current.userSelected === index) {
                className += ' wrong';
                iconHtml = `<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
              } else if (current.userSelected === index) {
                className += ' selected';
              }
              return `
              <button class="${className}" data-answer-index="${index}" type="button" ${answered ? 'disabled' : ''}>
                <span class="quiz-option-letter">${letters[index] || index + 1}</span>
                <span class="quiz-option-text">${escapeHtml(option)}</span>
                ${iconHtml}
              </button>`;
            }).join('')}
          </div>
          
          <div class="quiz-hint">
            <div class="hint-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2v1"/><path d="M12 7a5 5 0 1 0 5 5c0 1.5-1 3-3 4H10c-2-1-3-2.5-3-4a5 5 0 1 0 5-5z"/></svg>
            </div>
            <div class="hint-text">
              <strong>İpucu</strong>
              <span>Doğru cevabı düşünmeden önce sorudaki anahtar kelimelere odaklanın.</span>
            </div>
            <div class="hint-arrow">${svg('arrowRight')}</div>
          </div>
        </div>
      </div>

      <div class="quiz-premium-footer">
        <button class="footer-btn btn-prev" id="quizPrevButton" type="button" ${quiz.index === 0 ? 'disabled' : ''}>
          ${svg('arrowLeft')} Önceki
        </button>
        <button class="footer-btn btn-grid" id="quizGridButton" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          Sorular
        </button>
        <button class="footer-btn btn-next" id="quizNextButton" type="button">
          ${quiz.index === total - 1 ? 'Sonucu Gör' : 'Sonraki Soru'} ${svg('arrowRight')}
        </button>
      </div>
      <div class="quiz-nav-overlay" id="quizNavOverlay">
        <div class="quiz-nav-sheet">
          <div class="quiz-nav-head"><strong>Sorular</strong><button type="button" id="quizNavClose" aria-label="Kapat">×</button></div>
          <div class="quiz-nav-grid" id="quizNavGrid"></div>
        </div>
      </div>
    </div>`;
    
  topicSheet.scrollTop = 0;
  bindQuizEvents();
  if(quiz.isTimed) startQuizTimer();
}

function startQuizTimer() {
  clearInterval(timerInterval);
  const quiz = state.quiz;
  const timer = document.getElementById('quizTimer');
  if (!quiz || !timer || quiz.timeLeft <= 0) return;
  timerInterval = window.setInterval(() => {
    if (!state.quiz || state.quiz !== quiz) return clearInterval(timerInterval);
    if (quiz.timeLeft <= 0) return clearInterval(timerInterval);
    quiz.timeLeft -= 1;
    const m = String(Math.floor(quiz.timeLeft / 60)).padStart(2, '0');
    const s = String(quiz.timeLeft % 60).padStart(2, '0');
    timer.innerHTML = `${svg('clock')} ${m}:${s}`;
    if (quiz.timeLeft === 0) {
      clearInterval(timerInterval);
      showToast('Sınavın süresi doldu.');
      renderQuizResult();
    }
  }, 1000);
}

function toggleQuestionFlag(question) {
  if (progress.flaggedQuestions[question.id]) {
    delete progress.flaggedQuestions[question.id];
    showToast('İşaret kaldırıldı.');
  } else {
    progress.flaggedQuestions[question.id] = true;
    showToast('Soru işaretlendi.');
  }
  haptic(14);
  saveProgress();
  renderQuiz();
}

function reportQuestion(question) {
  if (progress.reportedQuestions[question.id]) return;
  progress.reportedQuestions[question.id] = true;
  haptic(14);
  saveProgress();
  showToast('Bildirimin alındı, teşekkürler.');
  renderQuiz();
}

function openQuizNav() {
  const quiz = state.quiz;
  const overlay = document.getElementById('quizNavOverlay');
  const grid = document.getElementById('quizNavGrid');
  if (!overlay || !grid) return;
  grid.innerHTML = quiz.questions.map((question, index) => {
    let className = 'quiz-nav-cell';
    if (index === quiz.index) className += ' current';
    else if (question.userSelected !== null) className += question.userSelected === question.answerIndex ? ' answered-correct' : ' answered-wrong';
    if (progress.flaggedQuestions[question.id]) className += ' flagged';
    return `<button class="${className}" data-jump-index="${index}" type="button">${index + 1}</button>`;
  }).join('');
  grid.querySelectorAll('[data-jump-index]').forEach(button => button.addEventListener('click', () => {
    clearInterval(timerInterval);
    quiz.index = Number(button.dataset.jumpIndex);
    overlay.classList.remove('open');
    renderQuiz();
  }));
  overlay.classList.add('open');
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
    haptic(selected === current.answerIndex ? 16 : [12, 40, 12]);
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
  document.getElementById('quizBookmarkButton')?.addEventListener('click', () => toggleQuestionFlag(quiz.questions[quiz.index]));
  document.getElementById('quizReportButton')?.addEventListener('click', () => reportQuestion(quiz.questions[quiz.index]));
  document.getElementById('quizGridButton')?.addEventListener('click', openQuizNav);
  document.getElementById('quizGridTopButton')?.addEventListener('click', openQuizNav);
  document.getElementById('quizNavClose')?.addEventListener('click', () => document.getElementById('quizNavOverlay')?.classList.remove('open'));
  document.getElementById('quizNavOverlay')?.addEventListener('click', event => { if (event.target.id === 'quizNavOverlay') event.currentTarget.classList.remove('open'); });
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

navButtons.forEach(button => button.addEventListener('click', () => window.go(button.dataset.nav)));
closeTopicSheetButton.addEventListener('click', closeTopicSheet);
topicBackdrop.addEventListener('click', () => {
  closeTopicSheet();
  closeRouteSheet();
  closeSearchSheet();
});

async function loadCatalogue() {
  state.catalogueError = '';
  state.catalogue = null;
  render();
  try {
    const response = await fetch(CATALOGUE_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('categoryTopics.json dosyasını okunamadı.');
    const data = await response.json();
    if (!data || typeof data !== 'object') throw new Error('Konu verisi geçerli değil.');
    state.catalogue = data;
    render();
  } catch (error) {
    state.catalogueError = error.message || 'Konu verisi yüklenemedi.';
    render();
  }
}

bindRouteSheetEvents();

// --- KADRO SEÇİM KAPISI ---
const roleGate = document.getElementById('roleGate');
const roleGateList = document.getElementById('roleGateList');
const roleGateContinue = document.getElementById('roleGateContinue');
let pendingRoleSelection = null;

function renderRoleGate() {
  roleGateList.innerHTML = ROLES.map(role => `
    <button class="role-gate-item" data-role-key="${role.key}" type="button">
      <span class="role-gate-item-icon">${svg(ROLE_ICONS[role.key] || 'book')}</span>
      <strong>${escapeHtml(role.label)}</strong>
      <span class="role-gate-item-arrow">${svg('arrow')}</span>
    </button>`).join('');
  roleGateList.querySelectorAll('[data-role-key]').forEach(button => {
    button.addEventListener('click', () => {
      pendingRoleSelection = button.dataset.roleKey;
      roleGateList.querySelectorAll('.role-gate-item').forEach(el => el.classList.toggle('selected', el === button));
      roleGateContinue.disabled = false;
      roleGateContinue.classList.add('enabled');
      haptic(14);
    });
  });
}

function openRoleGate() {
  pendingRoleSelection = null;
  renderRoleGate();
  roleGateContinue.disabled = true;
  roleGateContinue.classList.remove('enabled');
  roleGate.setAttribute('aria-hidden', 'false');
}

function closeRoleGate() {
  roleGate.setAttribute('aria-hidden', 'true');
}

roleGateContinue?.addEventListener('click', async () => {
  if (!pendingRoleSelection) return;
  progress.selectedRole = pendingRoleSelection;
  saveProgress();

  const { error } = await supabaseClient
  .from('profiles')
  .update({ role: pendingRoleSelection })
  .eq('id', window.currentUser.id);
if (error) console.error('Kadro sunucuya kaydedilemedi:', error);

  closeRoleGate();
  initializeApp();
});

let appInitialized = false;
function initializeApp() {
  if (appInitialized) return;
  appInitialized = true;
  render();
  loadCatalogue();
}

let authHandledOnce = false;
function handleAuthenticated() {
  if (authHandledOnce) return;
  authHandledOnce = true;

  const currentUserId = window.currentUser?.id || null;
  if (progress.userId !== currentUserId) {
    progress = defaultProgress();
    progress.userId = currentUserId;
  }
  if (window.currentUserRole && !progress.selectedRole) {
    progress.selectedRole = window.currentUserRole;
  }
  saveProgress();

  if (!progress.selectedRole) {
    openRoleGate();
  } else {
    initializeApp();
  }
}

document.addEventListener('sinavrotasi:authenticated', handleAuthenticated);
if (window.currentUserAuthReady) handleAuthenticated();
