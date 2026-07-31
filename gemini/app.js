const STORAGE_KEY = 'sinavrotasi-study-progress-v3';
const CATALOGUE_URL = 'categoryTopics.json';
const DAILY_GOAL = 20;

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

// DOM Elemanları
const app = document.getElementById('app');
const scrollArea = document.getElementById('scroll-area');
const toast = document.getElementById('toast');
const navButtons = [...document.querySelectorAll('[data-nav]')];

const routeSheet = document.getElementById('routeSheet');
const topicSheet = document.getElementById('topicSheet');
const topicBackdrop = document.getElementById('topicBackdrop');

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
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function defaultProgress() {
  return { answers: 0, correctAnswers: 0, wrongAnswers: 0, dailyAnswers: {}, completedSections: {}, completedTests: [], wrongQuestionIds: [] };
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return defaultProgress();
    return { ...defaultProgress(), ...saved };
  } catch (e) {
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

function updateHeader() {
  const today = dateKey();
  const solved = progress.dailyAnswers[today] || 0;
  const pct = Math.min(100, Math.round((solved / DAILY_GOAL) * 100));

  const percentEl = document.getElementById('dailyGoalPercent');
  const solvedCountEl = document.getElementById('dailySolvedCount');
  const progressFill = document.getElementById('dailyProgressFill');
  const goalCircle = document.getElementById('dailyGoalCircle');
  const msgEl = document.getElementById('dailyGoalMessage');

  if (percentEl) percentEl.textContent = `%${pct}`;
  if (solvedCountEl) solvedCountEl.textContent = solved;
  if (progressFill) progressFill.style.width = `${pct}%`;
  if (goalCircle) goalCircle.setAttribute('stroke-dasharray', `${pct}, 100`);

  if (msgEl) {
    if (pct === 0) msgEl.textContent = 'İlk soruyla günlük hedefini başlat.';
    else if (pct < 100) msgEl.textContent = `Harika gidiyorsun! Hedefe ${DAILY_GOAL - solved} soru kaldı.`;
    else msgEl.textContent = 'Tebrikler! Bugünkü soru hedefini tamamladın.';
  }
}

async function initCatalogue() {
  try {
    const res = await fetch(CATALOGUE_URL);
    if (!res.ok) throw new Error('Katalog dosyası okunamadı.');
    state.catalogue = await res.json();
    await preloadQuestionBanks();
    render();
  } catch (err) {
    state.catalogueError = err.message;
    render();
  }
}

async function preloadQuestionBanks() {
  if (!state.catalogue) return;
  const fetchPromises = [];

  Object.values(state.catalogue).forEach(cat => {
    (cat.topics || []).forEach(item => {
      if (item.questionFile) {
        fetchPromises.push(
          fetch(item.questionFile)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
              if (data && data.questions) {
                state.questionBanks.set(item.id, data.questions);
              }
            }).catch(() => {})
        );
      }
    });
  });

  await Promise.all(fetchPromises);
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

function homeView() {
  if (!state.catalogue) return `<div class="empty-state">İçerik yükleniyor...</div>`;

  const stats = {
    completedSections: Object.keys(progress.completedSections).length,
    solvedQuestions: progress.answers || 0,
    completedMocks: progress.completedTests.filter(t => t.kind === 'mock').length,
    streak: getStreak()
  };

  const categories = Object.entries(state.catalogue).map(([key, cat]) => {
    const topics = cat.topics || [];
    return `<article class="category" role="button" tabindex="0" data-open-category="${key}">
      <div class="cat-icon ${cat.iconClass || ''}">${svg(cat.icon || 'book')}</div>
      <div class="cat-copy">
        <h4>${escapeHtml(cat.title)}</h4>
        <p>${escapeHtml(cat.subtitle)}</p>
        <small>${topics.length} Konu / Başlık</small>
      </div>
      <div class="chevron">${svg('arrow')}</div>
    </article>`;
  }).join('');

  return `<section class="screen home-screen">
    <div class="stats">
      <button class="stat stat-button" onclick="go('wrong')"><span class="stat-icon">${svg('book')}</span><strong>${stats.completedSections}</strong><span>Konu<br>Tamamlandı</span></button>
      <button class="stat stat-button" onclick="go('wrong')"><span class="stat-icon accent">${svg('target')}</span><strong>${stats.solvedQuestions}</strong><span>Soru<br>Çözüldü</span></button>
      <button class="stat stat-button" onclick="go('bank')"><span class="stat-icon amber">${svg('trophy')}</span><strong>${stats.completedMocks}</strong><span>Deneme<br>Tamamlandı</span></button>
      <button class="stat stat-button" onclick="go('wrong')"><span class="stat-icon accent">${svg('flame')}</span><strong>${stats.streak}</strong><span>Günlük<br>Seri</span></button>
    </div>
    <div class="section-head"><h3>Test Kategorileri</h3></div>
    <section class="categories">${categories}</section>
    <button class="cta-btn" id="openRouteSheetButton" type="button">
      <div class="cta-icon">${svg('target')}</div>
      <div><strong>Bugünkü Rota</strong><span>Önerilen planı gör veya özelleştir</span></div>
      <span class="chevron-w">${svg('arrow')}</span>
    </button>
  </section>`;
}

function bankView() {
  const allQuestions = Array.from(state.questionBanks.values()).flat();

  return `<section class="screen content-screen">
    <div class="page-heading"><span>DENEMELER</span><h2>Hızlı Denemeler</h2><p>Aktif soru bankalarından oluşturulan denemelerle kendini test et.</p></div>
    <article class="practice-card">
      <div class="practice-card-icon">${svg('trophy')}</div>
      <div>
        <span>KARMA MEVZUAT VE GENEL KÜLTÜR</span>
        <h3>20 Soruluk MEB GYS Denemesi</h3>
        <p>${allQuestions.length} soru içerisinden rastgele seçilir.</p>
      </div>
      <button class="reader-primary" id="startMockButton" type="button" ${allQuestions.length ? '' : 'disabled'}>Başlat</button>
    </article>
  </section>`;
}

function studiesView() {
  const accuracy = progress.answers ? Math.round((progress.correctAnswers / progress.answers) * 100) : 0;
  const recent = progress.completedTests.slice(-5).reverse();

  return `<section class="screen content-screen">
    <div class="page-heading"><span>ÇALIŞMALARIM</span><h2>İlerleme ve Performans</h2></div>
    <div class="study-grid">
      <article><span>Çözülen Soru</span><strong>${progress.answers}</strong></article>
      <article><span>Doğruluk Oranı</span><strong>%${accuracy}</strong></article>
      <article><span>Yanlış Havuzu</span><strong>${progress.wrongQuestionIds.length} Soru</strong></article>
      <article><span>Günlük Seri</span><strong>${getStreak()} Gün</strong></article>
    </div>
    <section class="recent-tests">
      <h3>Son Tamamlanan Testler</h3>
      ${recent.length ? recent.map(t => `<article><div><strong>${escapeHtml(t.title)}</strong><span>${t.score}/${t.total} Doğru</span></div><small>${t.kind === 'mock' ? 'Deneme' : 'Konu Testi'}</small></article>`).join('') : '<div class="empty-inline">Henüz tamamlanmış test yok.</div>'}
    </section>
  </section>`;
}

function libraryView() {
  if (!state.catalogue) return '';

  const list = Object.entries(state.catalogue).map(([catKey, cat]) => {
    return `<section class="library-group">
      <div class="library-group-head"><span>${escapeHtml(cat.title)}</span></div>
      ${(cat.topics || []).map(topic => `
        <button class="library-item" data-open-topic="${topic.id}" data-cat="${catKey}" type="button">
          <span class="library-item-icon">${svg('gavel')}</span>
          <span><strong>${escapeHtml(topic.title)}</strong><small>${topic.questionCount || 20} Soru</small></span>
          ${svg('arrow')}
        </button>
      `).join('')}
    </section>`;
  }).join('');

  return `<section class="screen content-screen">
    <div class="page-heading"><span>KİTAPLIK</span><h2>Mevzuat ve Konu Kaynakları</h2></div>
    ${list}
  </section>`;
}

function profileView() {
  return `<section class="screen content-screen">
    <div class="page-heading"><span>PROFİL</span><h2>Kullanıcı Profili</h2></div>
    <article class="practice-card">
      <div>
        <h3>MEB GYS Hazırlık Modülü</h3>
        <p>Sistem hedeflerinize ve soru çözüm istatistiklerinize göre otomatik adapte olur.</p>
      </div>
    </article>
  </section>`;
}

function render() {
  updateHeader();
  if (state.view === 'home') app.innerHTML = homeView();
  else if (state.view === 'bank') app.innerHTML = bankView();
  else if (state.view === 'wrong') app.innerHTML = studiesView();
  else if (state.view === 'laws') app.innerHTML = libraryView();
  else if (state.view === 'profile') app.innerHTML = profileView();
}

function startQuiz(title, questions, kind = 'practice') {
  if (!questions || !questions.length) {
    showToast('Bu konu için soru bankası yüklenemedi.');
    return;
  }

  state.quiz = {
    title,
    questions,
    currentIndex: 0,
    score: 0,
    answers: [],
    kind
  };

  renderQuizScreen();
}

function renderQuizScreen() {
  const quiz = state.quiz;
  const q = quiz.questions[quiz.currentIndex];

  app.innerHTML = `<section class="screen quiz-screen">
    <div class="quiz-header">
      <button class="round-btn" onclick="go('home')">${svg('back')}</button>
      <div><h3>${escapeHtml(quiz.title)}</h3><small>Soru ${quiz.currentIndex + 1} / ${quiz.questions.length}</small></div>
    </div>
    <div class="quiz-card">
      <p class="quiz-prompt">${escapeHtml(q.prompt)}</p>
      <div class="quiz-options">
        ${q.options.map((opt, idx) => `<button class="option-btn" data-option="${idx}">${escapeHtml(opt)}</button>`).join('')}
      </div>
    </div>
  </section>`;
}

function handleOptionSelect(optionIdx) {
  const quiz = state.quiz;
  const q = quiz.questions[quiz.currentIndex];
  const isCorrect = optionIdx === q.answerIndex;

  const today = dateKey();
  progress.answers += 1;
  progress.dailyAnswers[today] = (progress.dailyAnswers[today] || 0) + 1;

  if (isCorrect) {
    progress.correctAnswers += 1;
    quiz.score += 1;
  } else {
    progress.wrongAnswers += 1;
    if (!progress.wrongQuestionIds.includes(q.id)) {
      progress.wrongQuestionIds.push(q.id);
    }
  }

  saveProgress();

  if (quiz.currentIndex + 1 < quiz.questions.length) {
    quiz.currentIndex += 1;
    renderQuizScreen();
  } else {
    progress.completedTests.push({
      title: quiz.title,
      score: quiz.score,
      total: quiz.questions.length,
      kind: quiz.kind,
      date: new Date().toISOString()
    });
    saveProgress();
    showToast(`Test bitti! Sonuç: ${quiz.score}/${quiz.questions.length}`);
    go('wrong');
  }
}

// Event Delegation
document.addEventListener('click', (e) => {
  const catCard = e.target.closest('[data-open-category]');
  if (catCard) {
    const catKey = catCard.dataset.openCategory;
    const cat = state.catalogue[catKey];
    if (cat && cat.topics && cat.topics.length) {
      const questions = [];
      cat.topics.forEach(t => {
        const qList = state.questionBanks.get(t.id) || [];
        questions.push(...qList);
      });
      startQuiz(cat.title, questions.slice(0, 20), 'category');
    }
    return;
  }

  const topicBtn = e.target.closest('[data-open-topic]');
  if (topicBtn) {
    const topicId = topicBtn.dataset.openTopic;
    const questions = state.questionBanks.get(topicId) || [];
    startQuiz('Konu Testi', questions.slice(0, 20), 'topic');
    return;
  }

  const optionBtn = e.target.closest('[data-option]');
  if (optionBtn && state.quiz) {
    handleOptionSelect(Number(optionBtn.dataset.option));
    return;
  }

  if (e.target.closest('#openRouteSheetButton')) {
    routeSheet.setAttribute('aria-hidden', 'false');
    routeSheet.classList.add('open');
    return;
  }

  if (e.target.closest('#closeRouteSheet')) {
    routeSheet.setAttribute('aria-hidden', 'true');
    routeSheet.classList.remove('open');
    return;
  }

  if (e.target.closest('#startRouteButton')) {
    routeSheet.setAttribute('aria-hidden', 'true');
    routeSheet.classList.remove('open');
    const allQuestions = Array.from(state.questionBanks.values()).flat();
    startQuiz('Bugünkü Rota', allQuestions.sort(() => 0.5 - Math.random()).slice(0, routeSettings.questions), 'route');
    return;
  }

  if (e.target.closest('#startMockButton')) {
    const allQuestions = Array.from(state.questionBanks.values()).flat();
    startQuiz('MEB GYS Hızlı Deneme', allQuestions.sort(() => 0.5 - Math.random()).slice(0, 20), 'mock');
    return;
  }
});

// Uygulama Başlatma
initCatalogue();
