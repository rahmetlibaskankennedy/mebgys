const STORAGE_KEY = 'sinavrotasi-study-progress-v3';
const CATALOGUE_URL = 'categoryTopics.json';
const DAILY_GOAL = 20;
const QUESTION_TIME_LIMIT = 45;

// Uygulama Durumu (State)
const state = {
  view: 'home',
  catalogue: null,
  catalogueError: '',
  activeCategoryKey: null,
  activeDocument: null,
  questionBanks: new Map(),
  quiz: null
};

// Rota Ayarları
const routeSettings = {
  mode: 'Sana Özel Karma',
  questions: 20,
  time: 'Süreli'
};

// DOM Elemanları
const app = document.getElementById('app');
const scrollArea = document.getElementById('scroll-area');
const toast = document.getElementById('toast');
const navButtons = [...document.querySelectorAll('[data-nav]')];

// Sheet Elemanları
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

const routeSheet = document.getElementById('routeSheet');
const routeBackdrop = document.getElementById('routeBackdrop');
const closeRouteSheetButton = document.getElementById('closeRouteSheet');
const startRouteButton = document.getElementById('startRouteButton');

let timerInterval = null;
let progress = loadProgress();

// SVG İkon Kütüphanesi
const iconPaths = {
  scale: '<path d="M12 3v18"/><path d="M6 6h12"/><path d="m6 6-4 7h8L6 6Z"/><path d="m18 6-4 7h8l-4-7Z"/><path d="M8 21h8"/>',
  landmark: '<path d="m3 10 9-6 9 6"/><path d="M5 10h14"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/><path d="M4 18h16M3 22h18"/>',
  schoolbook: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M8 4v16"/><path d="M12 8h4M12 12h4"/><path d="m14 15 .7 1.4 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2L14 15Z"/>',
  gavel: '<path d="m14 13-7.5 7.5a1 1 0 0 1-3-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6 4 4-6 6-4-4Z"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
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
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function haptic(duration = 18) {
  if ('vibrate' in navigator) navigator.vibrate(duration);
}

// İlerleme ve Veri Saklama
function defaultProgress() {
  return {
    answers: 0,
    correctAnswers: 0,
    dailyAnswers: {},
    completedSections: {},
    completedTests: [],
    wrongQuestions: []
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
      completedTests: Array.isArray(saved.completedTests) ? saved.completedTests : [],
      wrongQuestions: Array.isArray(saved.wrongQuestions) ? saved.wrongQuestions : []
    };
  } catch (error) {
    return defaultProgress();
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  updateHeader();
  if (state.view === 'home' || state.view === 'wrong' || state.view === 'studies') {
    render();
  }
}

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
  const completedMocks = progress.completedTests.filter(t => t.kind === 'mock').length;
  const todayAnswers = Number(progress.dailyAnswers[dateKey()] || 0);
  const accuracy = progress.answers ? Math.round((progress.correctAnswers / progress.answers) * 100) : 0;
  const dailyPercentage = Math.min(100, Math.round((todayAnswers / DAILY_GOAL) * 100));

  return {
    completedSections,
    solvedQuestions: Number(progress.answers || 0),
    completedMocks,
    streak: getStreak(),
    todayAnswers,
    dailyPercentage,
    accuracy
  };
}

function updateHeader() {
  const stats = getStats();
  const circlePath = document.querySelector('.circular-chart .circle');
  const percentageText = document.querySelector('.circular-chart .percentage');
  const goalSubtext = document.querySelector('.daily-goal-subtext');
  const streakText = document.querySelector('.streak-text');

  if (circlePath) {
    circlePath.setAttribute('stroke-dasharray', `${stats.dailyPercentage}, 100`);
  }
  if (percentageText) {
    percentageText.textContent = `${stats.dailyPercentage}%`;
  }
  if (goalSubtext) {
    goalSubtext.textContent = `${stats.todayAnswers} / ${DAILY_GOAL} Soru`;
  }
  if (streakText) {
    streakText.textContent = `${stats.streak} Gün`;
  }
}

// Katalog ve İçerik Yönetimi
async function loadCatalogue() {
  try {
    const response = await fetch(CATALOGUE_URL);
    if (!response.ok) throw new Error(`Katalog yüklenemedi: HTTP ${response.status}`);
    state.catalogue = await response.json();
    state.catalogueError = '';
  } catch (err) {
    state.catalogueError = err.message || 'Katalog yüklenirken hata oluştu.';
  }
  render();
}

function getCategories() {
  return state.catalogue ? Object.entries(state.catalogue) : [];
}

function getCategory(categoryKey) {
  return state.catalogue && state.catalogue[categoryKey];
}

function getCategoryItems(categoryKey) {
  const cat = getCategory(categoryKey);
  return cat ? cat.topics || [] : [];
}

function getActiveDocuments() {
  return getCategories().flatMap(([categoryKey]) =>
    getCategoryItems(categoryKey)
      .filter(item => item.questionFile)
      .map(item => ({ item, categoryKey }))
  );
}

// Navigasyon
function setNav(name) {
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.nav === name));
}

window.go = function go(view) {
  state.view = view;
  setNav(view);
  render();
  if (scrollArea) scrollArea.scrollTop = 0;
};

// Görünüm Şablonları (Views)
function loadingView() {
  return `
    <section class="screen neutral-screen">
      <div class="empty-state">
        <span class="empty-state-icon">${svg('refresh')}</span>
        <h3>İçerikler Yükleniyor</h3>
        <p>Müfredat ve testler hazırlanıyor...</p>
      </div>
    </section>
  `;
}

function errorView() {
  return `
    <section class="screen neutral-screen">
      <div class="empty-state empty-state-error">
        <span class="empty-state-icon">${svg('book')}</span>
        <h3>Bağlantı Hatası</h3>
        <p>${escapeHtml(state.catalogueError || 'Katalog verisi yüklenemedi.')}</p>
        <button class="reader-primary" id="retryLoadButton" type="button">Tekrar Dene</button>
      </div>
    </section>
  `;
}

function statCard(icon, colorClass, number, label, target) {
  return `
    <button class="stat stat-button" data-stat-target="${target}" type="button">
      <span class="stat-icon ${colorClass}">${svg(icon)}</span>
      <strong>${number}</strong>
      <span>${label}</span>
    </button>
  `;
}

function homeView() {
  if (!state.catalogue) return state.catalogueError ? errorView() : loadingView();

  const stats = getStats();
  const categories = getCategories().map(([key, cat]) => {
    const topics = cat.topics || [];
    const activePackages = topics.filter(t => t.questionFile).length;
    const metaText = activePackages > 0
      ? `${topics.length} Konu • ${activePackages} Aktif Test`
      : `${topics.length} Konu Hazırlanıyor`;

    return `
      <article class="category" role="button" tabindex="0" data-open-category="${key}">
        <div class="cat-icon ${cat.iconClass || ''}">${svg(cat.icon || 'book')}</div>
        <div class="cat-copy">
          <h4>${escapeHtml(cat.title)}</h4>
          <p>${escapeHtml(cat.subtitle || '')}</p>
          <small>${metaText}</small>
        </div>
        <div class="chevron">${svg('arrow')}</div>
      </article>
    `;
  }).join('');

  return `
    <section class="screen home-screen">
      <div class="stats">
        ${statCard('book', '', stats.completedSections, 'Konu<br>Tamamlandı', 'wrong')}
        ${statCard('target', 'accent', stats.solvedQuestions, 'Soru<br>Çözüldü', 'wrong')}
        ${statCard('trophy', 'amber', stats.completedMocks, 'Deneme<br>Tamamlandı', 'bank')}
        ${statCard('flame', 'accent', stats.streak, 'Günlük<br>Seri', 'wrong')}
      </div>

      <div class="section-head">
        <h3>Test Kategorileri</h3>
      </div>

      <section class="categories">
        ${categories}
      </section>

      <button class="cta-btn" id="openRouteSheetButton" type="button">
        <div class="cta-icon">${svg('target')}</div>
        <div>
          <strong>Bugünkü Rota</strong>
          <span>Kişiselleştirilmiş soru setini başlat</span>
        </div>
        <span class="chevron-w">${svg('arrow')}</span>
      </button>
    </section>
  `;
}

function bankView() {
  const stats = getStats();
  const activeDocs = getActiveDocuments();

  return `
    <section class="screen content-screen">
      <div class="page-heading">
        <span>DENEMELER</span>
        <h2>Hızlı Deneme Sınavları</h2>
        <p>Müfredat geneline yayılmış sorulardan oluşan karma denemeler.</p>
      </div>

      <article class="practice-card">
        <div class="practice-card-icon">${svg('trophy')}</div>
        <div>
          <span>KARMA DENEME</span>
          <h3>20 Soruluk Karma Test</h3>
          <p>${activeDocs.length ? `${activeDocs.length} aktif konudan rastgele derlenir.` : 'Aktif soru bulunamadı.'}</p>
        </div>
        <button class="reader-primary" id="startMockButton" type="button" ${activeDocs.length ? '' : 'disabled'}>Denemeyi Başlat</button>
      </article>

      <div class="metric-strip">
        <div><strong>${stats.completedMocks}</strong><span>Bitirilen Deneme</span></div>
        <div><strong>%${stats.accuracy}</strong><span>Genel Doğruluk</span></div>
      </div>
    </section>
  `;
}

function studiesView() {
  const stats = getStats();
  const recent = progress.completedTests.slice(-4).reverse();

  return `
    <section class="screen content-screen">
      <div class="page-heading">
        <span>ÇALIŞMALARIM</span>
        <h2>İlerleme Raporu</h2>
        <p>Çözdüğünüz sorulara göre anlık güncellenen başarım tablonuz.</p>
      </div>

      <div class="study-grid">
        <article><span>Toplam Soru</span><strong>${stats.solvedQuestions}</strong></article>
        <article><span>Başarı Oranı</span><strong>%${stats.accuracy}</strong></article>
        <article><span>Tamamlanan Bölüm</span><strong>${stats.completedSections}</strong></article>
        <article><span>Aktif Seri</span><strong>${stats.streak} Gün</strong></article>
      </div>

      <section class="recent-tests">
        <h3>Son Çözülen Testler</h3>
        ${recent.length ? recent.map(t => `
          <article>
            <div>
              <strong>${escapeHtml(t.title)}</strong>
              <span>${t.score} / ${t.total} Doğru</span>
            </div>
            <small>${t.kind === 'mock' ? 'Karma Deneme' : 'Konu Testi'}</small>
          </article>
        `).join('') : '<div class="empty-inline">Henüz kayıtlı test bulunmuyor.</div>'}
      </section>

      <button class="reset-progress" id="resetProgressButton" type="button">Tüm İlerlemeyi Sıfırla</button>
    </section>
  `;
}

function wrongView() {
  const wrongs = progress.wrongQuestions || [];

  return `
    <section class="screen content-screen">
      <div class="page-heading">
        <span>YANLIŞLARIM</span>
        <h2>Hata Havuzu</h2>
        <p>Yanlış cevapladığınız soruları tekrar çözerek pekiştirin.</p>
      </div>

      <article class="practice-card">
        <div class="practice-card-icon">${svg('refresh')}</div>
        <div>
          <span>TEKRAR TESTİ</span>
          <h3>Yanlış Yapılan Sorular</h3>
          <p>${wrongs.length} adet tekrar edilmeyi bekleyen soru var.</p>
        </div>
        <button class="reader-primary" id="startWrongTestButton" type="button" ${wrongs.length ? '' : 'disabled'}>Tekrara Başla</button>
      </article>
    </section>
  `;
}

function quizView() {
  if (!state.quiz) return homeView();

  const q = state.quiz.questions[state.quiz.currentIndex];
  const total = state.quiz.questions.length;
  const currentNum = state.quiz.currentIndex + 1;

  if (!q) {
    return `<section class="screen neutral-screen"><div class="empty-state"><h3>Soru Bulunamadı</h3><button onclick="go('home')" class="reader-primary">Ana Sayfaya Dön</button></div></section>`;
  }

  const options = q.options.map((opt, idx) => {
    let stateClass = '';
    if (state.quiz.answered) {
      if (idx === q.answer) stateClass = 'correct';
      else if (idx === state.quiz.selectedOption) stateClass = 'wrong';
    }

    return `
      <button class="quiz-option ${stateClass}" data-option-index="${idx}" ${state.quiz.answered ? 'disabled' : ''} type="button">
        <span class="option-prefix">${String.fromCharCode(65 + idx)}</span>
        <span class="option-text">${escapeHtml(opt)}</span>
      </button>
    `;
  }).join('');

  return `
    <section class="screen quiz-screen">
      <div class="quiz-header">
        <button class="icon-btn" id="quitQuizButton" type="button">${svg('back')}</button>
        <div class="quiz-title-wrap">
          <span>${escapeHtml(state.quiz.title)}</span>
          <small>Soru ${currentNum} / ${total}</small>
        </div>
        ${state.quiz.timeRemaining !== null ? `<div class="quiz-timer">${svg('clock')} <span>${state.quiz.timeRemaining}s</span></div>` : ''}
      </div>

      <div class="quiz-progress-bar">
        <div class="quiz-progress-fill" style="width: ${(currentNum / total) * 100}%"></div>
      </div>

      <div class="quiz-body">
        <div class="question-box">
          <p>${escapeHtml(q.question)}</p>
        </div>

        <div class="quiz-options">
          ${options}
        </div>
      </div>

      ${state.quiz.answered ? `
        <div class="quiz-footer">
          <button class="reader-primary" id="nextQuestionButton" type="button">
            ${currentNum === total ? 'Testi Bitir' : 'Sonraki Soru'}
          </button>
        </div>
      ` : ''}
    </section>
  `;
}

// Render Ana Fonksiyonu
function render() {
  if (!app) return;

  switch (state.view) {
    case 'home':
      app.innerHTML = homeView();
      break;
    case 'bank':
      app.innerHTML = bankView();
      break;
    case 'studies':
      app.innerHTML = studiesView();
      break;
    case 'wrong':
      app.innerHTML = wrongView();
      break;
    case 'quiz':
      app.innerHTML = quizView();
      break;
    default:
      app.innerHTML = homeView();
  }

  updateHeader();
  bindViewEvents();
}

// Etkileşimler & Event Listener'lar
function bindViewEvents() {
  const retryBtn = document.getElementById('retryLoadButton');
  if (retryBtn) retryBtn.onclick = () => loadCatalogue();

  const routeBtn = document.getElementById('openRouteSheetButton');
  if (routeBtn) routeBtn.onclick = () => openRouteSheet();

  const mockBtn = document.getElementById('startMockButton');
  if (mockBtn) mockBtn.onclick = () => startMockQuiz();

  const wrongTestBtn = document.getElementById('startWrongTestButton');
  if (wrongTestBtn) wrongTestBtn.onclick = () => startWrongQuiz();

  const resetBtn = document.getElementById('resetProgressButton');
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (confirm('Tüm ilerlemeniz sıfırlanacaktır. Emin misiniz?')) {
        progress = defaultProgress();
        saveProgress();
        showToast('İlerleme sıfırlandı.');
      }
    };
  }

  // Kategori Tıklamaları
  document.querySelectorAll('[data-open-category]').forEach(el => {
    el.onclick = () => openCategorySheet(el.dataset.openCategory);
  });

  // İstatistik Kartı Tıklamaları
  document.querySelectorAll('[data-stat-target]').forEach(el => {
    el.onclick = () => window.go(el.dataset.statTarget);
  });

  // Quiz Butonları
  const quitBtn = document.getElementById('quitQuizButton');
  if (quitBtn) {
    quitBtn.onclick = () => {
      if (confirm('Testten çıkmak istediğinize emin misiniz?')) {
        stopTimer();
        window.go('home');
      }
    };
  }

  const nextBtn = document.getElementById('nextQuestionButton');
  if (nextBtn) {
    nextBtn.onclick = () => handleNextQuestion();
  }

  document.querySelectorAll('.quiz-option').forEach(btn => {
    btn.onclick = () => handleAnswer(parseInt(btn.dataset.optionIndex, 10));
  });
}

// Topic Modal (Sheet)
function openCategorySheet(categoryKey) {
  const cat = getCategory(categoryKey);
  if (!cat) return;

  state.activeCategoryKey = categoryKey;
  if (topicSheetTitle) topicSheetTitle.textContent = cat.title;
  if (topicSheetSubtitle) topicSheetSubtitle.textContent = cat.subtitle || '';
  if (topicEyebrow) topicEyebrow.textContent = 'Kategori Detayı';

  const topics = getCategoryItems(categoryKey);
  if (topicList) {
    topicList.innerHTML = topics.map(item => `
      <div class="topic-item">
        <div class="topic-item-info">
          <strong>${escapeHtml(item.title)}</strong>
          <small>${item.questionCount || 20} Soru ${item.questionFile ? '• Hazır' : '• Hazırlanıyor'}</small>
        </div>
        <button class="topic-start-btn" data-start-topic="${item.id}" ${item.questionFile ? '' : 'disabled'}>
          Başlat
        </button>
      </div>
    `).join('');

    topicList.querySelectorAll('[data-start-topic]').forEach(btn => {
      btn.onclick = () => {
        const topicId = btn.dataset.startTopic;
        const topic = topics.find(t => t.id === topicId);
        if (topic) {
          closeCategorySheet();
          startTopicQuiz(topic);
        }
      };
    });
  }

  if (topicSheet) topicSheet.classList.add('open');
  if (topicBackdrop) topicBackdrop.classList.add('open');
}

function closeCategorySheet() {
  if (topicSheet) topicSheet.classList.remove('open');
  if (topicBackdrop) topicBackdrop.classList.remove('open');
}

// Route Modal (Sheet)
function openRouteSheet() {
  if (routeSheet) routeSheet.classList.add('open');
  if (routeBackdrop) routeBackdrop.classList.add('open');
}

function closeRouteSheet() {
  if (routeSheet) routeSheet.classList.remove('open');
  if (routeBackdrop) routeBackdrop.classList.remove('open');
}

// Quiz Mantığı
async function fetchQuestionsForTopic(topic) {
  if (state.questionBanks.has(topic.questionFile)) {
    return state.questionBanks.get(topic.questionFile);
  }
  try {
    const res = await fetch(topic.questionFile);
    if (!res.ok) throw new Error('Soru dosyası bulunamadı');
    const data = await res.json();
    const questions = Array.isArray(data) ? data : data.questions || [];
    state.questionBanks.set(topic.questionFile, questions);
    return questions;
  } catch (e) {
    showToast('Sorular yüklenirken hata oluştu.');
    return [];
  }
}

async function startTopicQuiz(topic) {
  const questions = await fetchQuestionsForTopic(topic);
  if (!questions.length) return;

  state.quiz = {
    title: topic.title,
    questions: [...questions].sort(() => Math.random() - 0.5).slice(0, 20),
    currentIndex: 0,
    answers: [],
    selectedOption: null,
    answered: false,
    kind: 'topic',
    timeRemaining: QUESTION_TIME_LIMIT
  };

  window.go('quiz');
  startTimer();
}

async function startMockQuiz() {
  const activeDocs = getActiveDocuments();
  if (!activeDocs.length) return;

  let allQuestions = [];
  for (const doc of activeDocs) {
    const qs = await fetchQuestionsForTopic(doc.item);
    allQuestions = allQuestions.concat(qs);
  }

  if (!allQuestions.length) {
    showToast('Deneme için soru yüklenemedi.');
    return;
  }

  state.quiz = {
    title: 'Karma Deneme Sınavı',
    questions: allQuestions.sort(() => Math.random() - 0.5).slice(0, 20),
    currentIndex: 0,
    answers: [],
    selectedOption: null,
    answered: false,
    kind: 'mock',
    timeRemaining: QUESTION_TIME_LIMIT
  };

  window.go('quiz');
  startTimer();
}

function startWrongQuiz() {
  if (!progress.wrongQuestions.length) return;

  state.quiz = {
    title: 'Yanlış Sorular Tekrarı',
    questions: [...progress.wrongQuestions].slice(0, 20),
    currentIndex: 0,
    answers: [],
    selectedOption: null,
    answered: false,
    kind: 'wrong',
    timeRemaining: QUESTION_TIME_LIMIT
  };

  window.go('quiz');
  startTimer();
}

function handleAnswer(index) {
  if (!state.quiz || state.quiz.answered) return;

  stopTimer();
  haptic(25);

  const q = state.quiz.questions[state.quiz.currentIndex];
  const isCorrect = index === q.answer;

  state.quiz.selectedOption = index;
  state.quiz.answered = true;
  state.quiz.answers.push({ question: q, userSelected: index, correct: isCorrect });

  // İlerleme Kaydı
  progress.answers += 1;
  const today = dateKey();
  progress.dailyAnswers[today] = (progress.dailyAnswers[today] || 0) + 1;

  if (isCorrect) {
    progress.correctAnswers += 1;
    // Yanlış listesinden çıkar
    progress.wrongQuestions = progress.wrongQuestions.filter(item => item.id !== q.id);
  } else {
    // Yanlış listesine ekle
    if (!progress.wrongQuestions.some(item => item.id === q.id)) {
      progress.wrongQuestions.push(q);
    }
  }

  saveProgress();
  render();
}

function handleNextQuestion() {
  if (!state.quiz) return;

  if (state.quiz.currentIndex + 1 < state.quiz.questions.length) {
    state.quiz.currentIndex += 1;
    state.quiz.selectedOption = null;
    state.quiz.answered = false;
    state.quiz.timeRemaining = QUESTION_TIME_LIMIT;
    render();
    startTimer();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  stopTimer();
  const correctCount = state.quiz.answers.filter(a => a.correct).length;
  const total = state.quiz.questions.length;

  progress.completedTests.push({
    title: state.quiz.title,
    score: correctCount,
    total: total,
    kind: state.quiz.kind,
    date: new Date().toISOString()
  });

  saveProgress();
  alert(`Test Tamamlandı!\n\nDoğru: ${correctCount}\nYanlış: ${total - correctCount}\nBaşarı: %${Math.round((correctCount / total) * 100)}`);
  
  state.quiz = null;
  window.go('studies');
}

function startTimer() {
  stopTimer();
  timerInterval = setInterval(() => {
    if (!state.quiz || state.quiz.answered) return;
    if (state.quiz.timeRemaining > 0) {
      state.quiz.timeRemaining -= 1;
      const timerEl = document.querySelector('.quiz-timer span');
      if (timerEl) timerEl.textContent = `${state.quiz.timeRemaining}s`;
    } else {
      handleAnswer(-1); // Zaman doldu
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Global Event Bağlantıları
function initEvents() {
  navButtons.forEach(btn => {
    btn.onclick = () => window.go(btn.dataset.nav);
  });

  if (closeTopicSheetButton) closeTopicSheetButton.onclick = closeCategorySheet;
  if (topicBackdrop) topicBackdrop.onclick = closeCategorySheet;

  if (closeRouteSheetButton) closeRouteSheetButton.onclick = closeRouteSheet;
  if (routeBackdrop) routeBackdrop.onclick = closeRouteSheet;

  if (startRouteButton) {
    startRouteButton.onclick = () => {
      closeRouteSheet();
      startMockQuiz();
    };
  }
}

// Başlatıcı
function init() {
  initEvents();
  loadCatalogue();
}

document.addEventListener('DOMContentLoaded', init);
