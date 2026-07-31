const STORAGE_KEY = 'sinavrotasi-study-progress-v3';
const CATALOGUE_URL = 'categoryTopics.json';
const DAILY_GOAL = 20;
const QUESTION_TIME_LIMIT = 45;

const state = {
  view: 'home',
  catalogue: null,
  catalogueError: '',
  activeCategoryKey: null,
  activeDocument: null,
  questionBanks: new Map(),
  quiz: null
};

const routeSettings = {
  mode: 'Sana Özel Karma',
  questions: 20,
  time: 'Süreli'
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

const routeSheet = document.getElementById('routeSheet');
const closeRouteSheetButton = document.getElementById('closeRouteSheet');
const startRouteButton = document.getElementById('startRouteButton');

let timerInterval = null;
let progress = loadProgress();

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

  if (circlePath) circlePath.setAttribute('stroke-dasharray', `${stats.dailyPercentage}, 100`);
  if (percentageText) percentageText.textContent = `${stats.dailyPercentage}%`;
  if (goalSubtext) goalSubtext.textContent = `${stats.todayAnswers}/${DAILY_GOAL} Soru`;
  if (streakText) streakText.textContent = `${stats.streak} Gün`;
}

function setNav(name) {
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.nav === name));
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

function getCategory(key) {
  return state.catalogue && state.catalogue[key];
}

function getCategoryItems(key) {
  const cat = getCategory(key);
  return cat ? cat.topics || [] : [];
}

function categoryCardMeta(key) {
  const presets = {
    'general-legislation': { title: 'Genel Mevzuat', description: 'Anayasa, 657, 4483 ve kamu yönetimi kanunları', icon: 'scale', iconClass: '' },
    'general-culture': { title: 'Türkçe ve Genel Kültür', description: 'Dilbilgisi, Tarih, Coğrafya, Yurttaşlık ve Güncel', icon: 'landmark', iconClass: 'blue' },
    'meb-legislation': { title: 'MEB Mevzuatı', description: '1739, 222, CBK 1 ve MEB yönetmelikleri', icon: 'schoolbook', iconClass: 'red' }
  };
  return presets[key] || { title: getCategory(key)?.title || 'Kategori', description: getCategory(key)?.subtitle || '', icon: 'book', iconClass: '' };
}

function getActiveDocuments() {
  return getCategories().flatMap(([catKey]) =>
    getCategoryItems(catKey)
      .filter(item => item.questionFile)
      .map(item => ({ item, catKey }))
  );
}

async function fetchQuestionBank(questionFile) {
  if (state.questionBanks.has(questionFile)) {
    return state.questionBanks.get(questionFile);
  }
  try {
    const response = await fetch(questionFile);
    if (!response.ok) throw new Error('Soru dosyası yüklenemedi.');
    const data = await response.json();
    state.questionBanks.set(questionFile, data);
    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function preloadAllQuestionBanks() {
  const activeDocs = getActiveDocuments();
  for (const doc of activeDocs) {
    if (doc.item.questionFile) {
      await fetchQuestionBank(doc.item.questionFile);
    }
  }
}

function homeView() {
  if (!state.catalogue) {
    return state.catalogueError ? errorView() : loadingView();
  }
  const stats = getStats();
  const categories = getCategories().map(([key]) => {
    const meta = categoryCardMeta(key);
    const topics = getCategoryItems(key);
    const activeCount = topics.filter(t => t.questionFile).length;
    const metaText = `${topics.length} Başlık • ${activeCount} Aktif Soru Paketi`;

    return `<article class="category" role="button" tabindex="0" data-open-category="${key}">
      <div class="cat-icon ${meta.iconClass}">${svg(meta.icon)}</div>
      <div class="cat-copy">
        <h4>${escapeHtml(meta.title)}</h4>
        <p>${escapeHtml(meta.description)}</p>
        <small>${metaText}</small>
      </div>
      <div class="chevron">${svg('arrow')}</div>
    </article>`;
  }).join('');

  return `<section class="screen home-screen">
    <div class="stats">
      ${statCard('book', '', stats.completedSections, 'Tamamlanan<br>Konu', 'studies')}
      ${statCard('target', 'accent', stats.solvedQuestions, 'Çözülen<br>Soru', 'studies')}
      ${statCard('trophy', 'amber', stats.completedMocks, 'Tamamlanan<br>Deneme', 'bank')}
      ${statCard('flame', 'accent', stats.streak, 'Günlük<br>Seri', 'studies')}
    </div>
    <div class="section-head"><h3>Test Kategorileri</h3></div>
    <section class="categories">${categories}</section>
    
    <button class="cta-btn" id="openRouteSheetButton" type="button">
      <div class="cta-icon">${svg('target')}</div>
      <div><strong>Bugünkü Rota</strong><span>Performansına göre özelleştirilmiş çalışmayı başlat</span></div>
      <span class="chevron-w">${svg('arrow')}</span>
    </button>
  </section>`;
}

function statCard(icon, colorClass, number, label, targetView) {
  return `<button class="stat stat-button" data-go-view="${targetView}" type="button">
    <span class="stat-icon ${colorClass}">${svg(icon)}</span>
    <strong>${number}</strong>
    <span>${label}</span>
  </button>`;
}

function bankView() {
  const stats = getStats();
  const activeDocs = getActiveDocuments();

  return `<section class="screen content-screen">
    <div class="page-heading">
      <span>DENEMELER VE TESTLER</span>
      <h2>Genel Denemeler</h2>
      <p>Aktif tüm konulardan oluşturulan karma deneme sınavı.</p>
    </div>
    <article class="practice-card">
      <div class="practice-card-icon">${svg('trophy')}</div>
      <div>
        <span>MEB GYS KARMA DENEME</span>
        <h3>20 Soruluk Deneme Sınavı</h3>
        <p>${activeDocs.length ? `${activeDocs.length} aktif mevzuat ve konudan rastgele soru seçilir.` : 'Soru paketi bulunamadı.'}</p>
      </div>
      <button class="reader-primary" id="startMockButton" type="button" ${activeDocs.length ? '' : 'disabled'}>Denemeyi Başlat</button>
    </article>
    <div class="metric-strip">
      <div><strong>${stats.completedMocks}</strong><span>Bitirilen Deneme</span></div>
      <div><strong>%${stats.accuracy}</strong><span>Genel Başarı</span></div>
    </div>
  </section>`;
}

function studiesView() {
  const stats = getStats();
  const recentTests = progress.completedTests.slice(-5).reverse();

  return `<section class="screen content-screen">
    <div class="page-heading">
      <span>ÇALIŞMA ANALİZİ</span>
      <h2>İlerleme Durumu</h2>
      <p>Çözdüğünüz sorular ve test sonuçları anlık olarak analiz edilir.</p>
    </div>
    <div class="study-grid">
      <article><span>Toplam Çözülen</span><strong>${stats.solvedQuestions} Soru</strong></article>
      <article><span>Doğruluk Oranı</span><strong>%${stats.accuracy}</strong></article>
      <article><span>Tamamlanan Konu</span><strong>${stats.completedSections} Bölüm</strong></article>
      <article><span>Günlük Çalışma Serisi</span><strong>${stats.streak} Gün</strong></article>
    </div>
    <section class="recent-tests">
      <h3>Son Tamamlanan Testler</h3>
      ${recentTests.length ? recentTests.map(t => `<article class="test-log-item">
        <div>
          <strong>${escapeHtml(t.title)}</strong>
          <span>${t.score} / ${t.total} Doğru (${Math.round((t.score / t.total) * 100)}%)</span>
        </div>
        <small>${t.kind === 'mock' ? 'Karma Deneme' : 'Konu Testi'}</small>
      </article>`).join('') : '<div class="empty-inline">Henüz tamamlanan test bulunmuyor.</div>'}
    </section>
    <button class="reset-progress" id="resetProgressButton" type="button">Çalışma Geçmişini Sıfırla</button>
  </section>`;
}

function wrongView() {
  const wrongCount = progress.wrongQuestions ? progress.wrongQuestions.length : 0;

  return `<section class="screen content-screen">
    <div class="page-heading">
      <span>YANLIŞLARIM</span>
      <h2>Yanlış Yapılan Sorular</h2>
      <p>Hatalı yanıtladığınız soruları tekrar çözerek zayıf konularınızı pekiştirin.</p>
    </div>
    <article class="practice-card">
      <div class="practice-card-icon red">${svg('refresh')}</div>
      <div>
        <span>TEKRAR HAVUZU</span>
        <h3>${wrongCount} Yanlış Soru</h3>
        <p>${wrongCount > 0 ? 'Hatalı cevaplanan sorulardan oluşan özel tekrar testi.' : 'Harika! Havuzda tekrar edilecek yanlış soru yok.'}</p>
      </div>
      <button class="reader-primary" id="startWrongQuizButton" type="button" ${wrongCount > 0 ? '' : 'disabled'}>Tekrar Testini Başlat</button>
    </article>
  </section>`;
}

function quizView() {
  if (!state.quiz) return homeView();

  const q = state.quiz.questions[state.quiz.currentIndex];
  const total = state.quiz.questions.length;
  const current = state.quiz.currentIndex + 1;
  const answered = state.quiz.answers[state.quiz.currentIndex] !== undefined;
  const selectedIndex = state.quiz.answers[state.quiz.currentIndex];

  const optionLetters = ['A', 'B', 'C', 'D', 'E'];

  return `<section class="screen quiz-screen">
    <header class="quiz-header">
      <button class="quiz-back-btn" id="exitQuizButton" type="button">${svg('back')}</button>
      <div class="quiz-meta">
        <span>${escapeHtml(state.quiz.title)}</span>
        <small>Soru ${current} / ${total}</small>
      </div>
      <div class="quiz-timer">${svg('clock')}<span id="timerText">${state.quiz.timeLeft}s</span></div>
    </header>

    <main class="quiz-body">
      <div class="question-card">
        <p class="question-prompt">${escapeHtml(q.prompt)}</p>
        <div class="options-list">
          ${q.options.map((opt, idx) => {
            let className = 'option-btn';
            if (answered) {
              if (idx === q.answerIndex) className += ' correct';
              else if (idx === selectedIndex) className += ' wrong';
              else className += ' disabled';
            }
            return `<button class="${className}" data-option-index="${idx}" ${answered ? 'disabled' : ''} type="button">
              <span class="opt-badge">${optionLetters[idx]}</span>
              <span class="opt-text">${escapeHtml(opt)}</span>
            </button>`;
          }).join('')}
        </div>
      </div>
    </main>

    <footer class="quiz-footer">
      ${answered ? `<button class="reader-primary" id="nextQuestionButton" type="button">
        ${current === total ? 'Testi Bitir' : 'Sonraki Soru'}
      </button>` : `<div class="quiz-hint">Lütfen bir şık seçiniz</div>`}
    </footer>
  </section>`;
}

function loadingView() {
  return `<section class="screen neutral-screen">
    <div class="empty-state">
      <span class="empty-state-icon">${svg('refresh')}</span>
      <h3>Müfredat ve Sorular Yükleniyor</h3>
      <p>Lütfen bekleyiniz...</p>
    </div>
  </section>`;
}

function errorView() {
  return `<section class="screen neutral-screen">
    <div class="empty-state empty-state-error">
      <span class="empty-state-icon">${svg('book')}</span>
      <h3>Veriler Yüklenemedi</h3>
      <p>${escapeHtml(state.catalogueError || 'Kılavuz dosyası okunamadı.')}</p>
      <button class="reader-primary" id="retryLoadButton" type="button">Tekrar Deneyin</button>
    </div>
  </section>`;
}

function render() {
  updateHeader();

  if (state.view === 'home') app.innerHTML = homeView();
  else if (state.view === 'bank') app.innerHTML = bankView();
  else if (state.view === 'studies') app.innerHTML = studiesView();
  else if (state.view === 'wrong') app.innerHTML = wrongView();
  else if (state.view === 'quiz') app.innerHTML = quizView();
  else app.innerHTML = homeView();

  bindViewEvents();
}

function bindViewEvents() {
  document.querySelectorAll('[data-open-category]').forEach(el => {
    el.addEventListener('click', () => openCategorySheet(el.dataset.openCategory));
  });

  document.querySelectorAll('[data-go-view]').forEach(el => {
    el.addEventListener('click', () => go(el.dataset.goView));
  });

  const openRouteBtn = document.getElementById('openRouteSheetButton');
  if (openRouteBtn) openRouteBtn.addEventListener('click', openRouteSheet);

  const mockBtn = document.getElementById('startMockButton');
  if (mockBtn) mockBtn.addEventListener('click', startMockQuiz);

  const resetBtn = document.getElementById('resetProgressButton');
  if (resetBtn) resetBtn.addEventListener('click', resetProgress);

  const retryBtn = document.getElementById('retryLoadButton');
  if (retryBtn) retryBtn.addEventListener('click', initApp);

  const startWrongBtn = document.getElementById('startWrongQuizButton');
  if (startWrongBtn) startWrongBtn.addEventListener('click', startWrongQuiz);

  if (state.view === 'quiz') {
    const exitBtn = document.getElementById('exitQuizButton');
    if (exitBtn) exitBtn.addEventListener('click', exitQuiz);

    const nextBtn = document.getElementById('nextQuestionButton');
    if (nextBtn) nextBtn.addEventListener('click', nextQuestion);

    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => selectAnswer(parseInt(btn.dataset.optionIndex, 10)));
    });
  }
}

async function openCategorySheet(catKey) {
  state.activeCategoryKey = catKey;
  const category = getCategory(catKey);
  if (!category) return;

  const meta = categoryCardMeta(catKey);
  topicEyebrow.textContent = meta.title;
  topicSheetTitle.textContent = category.title;
  topicSheetSubtitle.textContent = category.subtitle;
  topicHeadingIcon.className = `cat-icon ${meta.iconClass}`;
  topicHeadingIcon.innerHTML = svg(meta.icon);

  const topics = getCategoryItems(catKey);
  topicList.innerHTML = topics.map(item => {
    const isDoc = item.type === 'document';
    const subText = isDoc ? `${item.children ? item.children.length : 0} Alt Bölüm • ${item.questionCount || 20} Soru` : `${item.questionCount || 20} Soru`;

    return `<div class="topic-item" data-topic-id="${item.id}" role="button" tabindex="0">
      <div class="topic-item-icon">${svg(isDoc ? 'gavel' : 'book')}</div>
      <div class="topic-item-content">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${subText}</small>
      </div>
      <button class="topic-start-btn" type="button">Başlat</button>
    </div>`;
  }).join('');

  topicList.querySelectorAll('.topic-item').forEach(el => {
    el.addEventListener('click', () => {
      const topicId = el.dataset.topicId;
      const selected = topics.find(t => t.id === topicId);
      if (selected) {
        closeSheet(topicSheet, topicBackdrop);
        startTopicQuiz(selected);
      }
    });
  });

  openSheet(topicSheet, topicBackdrop);
}

function openRouteSheet() {
  openSheet(routeSheet, topicBackdrop);
}

function openSheet(sheetEl, backdropEl) {
  if (sheetEl) sheetEl.classList.add('active');
  if (backdropEl) backdropEl.classList.add('active');
}

function closeSheet(sheetEl, backdropEl) {
  if (sheetEl) sheetEl.classList.remove('active');
  if (backdropEl) backdropEl.classList.remove('active');
}

async function startTopicQuiz(item) {
  if (!item.questionFile) {
    showToast('Bu konu için soru seti hazırlanıyor.');
    return;
  }

  showToast('Soru bankası yükleniyor...');
  const bank = await fetchQuestionBank(item.questionFile);

  if (!bank || !bank.questions || !bank.questions.length) {
    showToast('Soru bulunamadı.');
    return;
  }

  state.quiz = {
    title: item.title,
    questions: bank.questions,
    currentIndex: 0,
    answers: {},
    correctCount: 0,
    kind: 'topic',
    timeLeft: QUESTION_TIME_LIMIT
  };

  go('quiz');
  startTimer();
}

async function startMockQuiz() {
  const activeDocs = getActiveDocuments();
  if (!activeDocs.length) return;

  showToast('Deneme sınavı hazırlanıyor...');
  let allQuestions = [];

  for (const doc of activeDocs) {
    const bank = await fetchQuestionBank(doc.item.questionFile);
    if (bank && bank.questions) {
      allQuestions = allQuestions.concat(bank.questions);
    }
  }

  if (!allQuestions.length) {
    showToast('Deneme için soru çekilemedi.');
    return;
  }

  allQuestions.sort(() => Math.random() - 0.5);
  const selectedQuestions = allQuestions.slice(0, 20);

  state.quiz = {
    title: 'Karma Mevzuat Denemesi',
    questions: selectedQuestions,
    currentIndex: 0,
    answers: {},
    correctCount: 0,
    kind: 'mock',
    timeLeft: QUESTION_TIME_LIMIT
  };

  go('quiz');
  startTimer();
}

function startWrongQuiz() {
  if (!progress.wrongQuestions || !progress.wrongQuestions.length) return;

  state.quiz = {
    title: 'Yanlış Sorular Tekrarı',
    questions: [...progress.wrongQuestions],
    currentIndex: 0,
    answers: {},
    correctCount: 0,
    kind: 'wrong',
    timeLeft: QUESTION_TIME_LIMIT
  };

  go('quiz');
  startTimer();
}

function startTimer() {
  stopTimer();
  state.quiz.timeLeft = QUESTION_TIME_LIMIT;
  timerInterval = setInterval(() => {
    if (!state.quiz) {
      stopTimer();
      return;
    }
    state.quiz.timeLeft -= 1;
    const timerText = document.getElementById('timerText');
    if (timerText) timerText.textContent = `${state.quiz.timeLeft}s`;

    if (state.quiz.timeLeft <= 0) {
      selectAnswer(-1); // Zaman doldu, cevapsız geçildi
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
}

function selectAnswer(index) {
  if (!state.quiz || state.quiz.answers[state.quiz.currentIndex] !== undefined) return;

  stopTimer();
  haptic(25);

  const q = state.quiz.questions[state.quiz.currentIndex];
  state.quiz.answers[state.quiz.currentIndex] = index;

  const isCorrect = index === q.answerIndex;
  if (isCorrect) {
    state.quiz.correctCount += 1;
    // Eğer önceden yanlış yapılmışsa havuzdan çıkar
    if (progress.wrongQuestions) {
      progress.wrongQuestions = progress.wrongQuestions.filter(wq => wq.id !== q.id);
    }
  } else {
    // Yanlış havuzuna ekle
    if (!progress.wrongQuestions) progress.wrongQuestions = [];
    if (!progress.wrongQuestions.some(wq => wq.id === q.id)) {
      progress.wrongQuestions.push(q);
    }
  }

  // İlerleme İstatistiklerini Güncelle
  progress.answers += 1;
  if (isCorrect) progress.correctAnswers += 1;

  const today = dateKey();
  progress.dailyAnswers[today] = (progress.dailyAnswers[today] || 0) + 1;

  saveProgress();
  render();
}

function nextQuestion() {
  if (!state.quiz) return;

  if (state.quiz.currentIndex < state.quiz.questions.length - 1) {
    state.quiz.currentIndex += 1;
    go('quiz');
    startTimer();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  stopTimer();
  const score = state.quiz.correctCount;
  const total = state.quiz.questions.length;

  progress.completedTests.push({
    title: state.quiz.title,
    score,
    total,
    kind: state.quiz.kind,
    date: new Date().toISOString()
  });

  saveProgress();
  showToast(`Test Tamamlandı! Doğru: ${score}/${total}`);
  state.quiz = null;
  go('studies');
}

function exitQuiz() {
  if (confirm('Testten çıkmak istediğinize emin misiniz? İlerlemeniz kaydedilmeyecek.')) {
    stopTimer();
    state.quiz = null;
    go('home');
  }
}

function resetProgress() {
  if (confirm('Tüm çalışma ve istatistik verileriniz sıfırlanacaktır. Onaylıyor musunuz?')) {
    progress = defaultProgress();
    saveProgress();
    showToast('İlerleme verileri sıfırlandı.');
    go('home');
  }
}

async function initApp() {
  try {
    const res = await fetch(CATALOGUE_URL);
    if (!res.ok) throw new Error('Kılavuz verisi çekilemedi.');
    state.catalogue = await res.json();
    await preloadAllQuestionBanks();
  } catch (err) {
    state.catalogueError = err.message;
  } finally {
    render();
  }
}

// Global Event Listeners & Sheet Kapatma
if (closeTopicSheetButton) closeTopicSheetButton.addEventListener('click', () => closeSheet(topicSheet, topicBackdrop));
if (closeRouteSheetButton) closeRouteSheetButton.addEventListener('click', () => closeSheet(routeSheet, topicBackdrop));
if (topicBackdrop) topicBackdrop.addEventListener('click', () => {
  closeSheet(topicSheet, topicBackdrop);
  closeSheet(routeSheet, topicBackdrop);
});

navButtons.forEach(btn => {
  btn.addEventListener('click', () => go(btn.dataset.nav));
});

// Uygulamayı Başlat
document.addEventListener('DOMContentLoaded', initApp);
