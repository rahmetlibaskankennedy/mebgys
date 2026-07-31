const state = {
  view:'home', wrong:new Set()
};

const app = document.getElementById('app');
const scrollArea = document.getElementById('scroll-area');
const toast = document.getElementById('toast');
const navButtons=[...document.querySelectorAll('[data-nav]')];

function showToast(text){
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 2000);
}

function haptic(duration = 20) {
  if ('vibrate' in navigator) navigator.vibrate(duration);
}

function setNav(name){
  navButtons.forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
}

window.go = function(view){
  state.view = view;
  setNav(view==='quiz'||view==='result'?'bank':view);
  render();
  scrollArea.scrollTop = 0;
};

function homeView(){
 return `
 <section class="screen home-screen">
  <div class="stats">
    <div class="stat">
      <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg></div>
      <strong>12</strong><span>Konu<br>Tamamlandı</span>
    </div>
    <div class="stat">
      <div class="stat-icon accent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>
      <strong>320</strong><span>Soru<br>Çözüldü</span>
    </div>
    <div class="stat">
      <div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5aa2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg></div>
      <strong>18</strong><span>Deneme<br>Tamamlandı</span>
    </div>
    <div class="stat">
      <div class="stat-icon accent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></div>
      <strong>7</strong><span>Günlük<br>Seri</span>
    </div>
  </div>

  <div class="section-head">
    <h3>Konu Kategorileri</h3>
  </div>
  
  <section class="categories">
    <article class="category" role="button" tabindex="0" onclick="window.openTopicSheet('general-legislation')">
      <div class="cat-icon"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M6 6h12"/><path d="m6 6-4 7h8L6 6Z"/><path d="m18 6-4 7h8l-4-7Z"/><path d="M8 21h8"/></svg></div>
      <div class="cat-copy">
        <h4>Mevzuat</h4>
        <p>Kanunlar, yönetmelikler<br>ve resmi düzenlemeler</p>
        <small>120 Konu &nbsp;•&nbsp; 2400 Soru</small>
      </div>
      <div class="chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></div>
    </article>

    <article class="category" role="button" tabindex="0" onclick="window.openTopicSheet('general-culture')">
      <div class="cat-icon blue"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="4" x="3" y="16" rx="1"/><rect width="14" height="4" x="5" y="4" rx="1"/><path d="M6 8v8"/><path d="M10 8v8"/><path d="M14 8v8"/><path d="M18 8v8"/><path d="M2 20h20"/></svg></div>
      <div class="cat-copy">
        <h4>Genel Kültür</h4>
        <p>Tarih, coğrafya, vatandaşlık<br>ve güncel bilgiler</p>
        <small>95 Konu &nbsp;•&nbsp; 1900 Soru</small>
      </div>
      <div class="chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></div>
    </article>
    
    <article class="category" role="button" tabindex="0" onclick="window.openTopicSheet('meb-legislation')">
      <div class="cat-icon red"><svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>
      <div class="cat-copy">
        <h4>MEB Mevzuatı</h4>
        <p>Milli Eğitim Bakanlığı<br>mevzuat ve yönergeleri</p>
        <small>75 Konu &nbsp;•&nbsp; 1500 Soru</small>
      </div>
      <div class="chevron"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></div>
    </article>
  </section>

  <button class="cta-btn" onclick="showToast('Pratik modülü hazırlanıyor')">
    <div class="cta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></div>
    <div><strong>Pratiğe Başla</strong><span>Hemen soru çözmeye başla</span></div>
    <span class="chevron-w"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>
  </button>
 </section>`
}

function render(){
 const views = { 
   home: homeView, 
   bank: () => `<div style="text-align:center; padding:80px 20px;"><h3>Bu sayfa yer tutucudur.</h3><p style="font-size:11.5px;color:var(--muted);margin-top:10px;">Mevzuat içeriklerine doğrudan ana sayfadaki Konu Kategorilerinden (Açılır Panel) ulaşabilirsiniz.</p></div>` 
 };
 app.innerHTML = (views[state.view] || homeView)();
}

navButtons.forEach(b => b.addEventListener('click', () => window.go(b.dataset.nav)));
render();

(() => {
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

  // Temizlenmiş ve maddelerden arındırılmış JSON yapısı
  const categoryTopics = {
    "general-culture": {
      "title": "Türkçe ve Genel Kültür",
      "subtitle": "Dil, tarih, coğrafya ve vatandaşlık konularını çalış.",
      "icon": "landmark",
      "iconClass": "blue",
      "progress": 40,
      "topics": [
        "Türkçe dilbilgisi",
        "Atatürk İlkeleri ve İnkılap Tarihi",
        "Türkiye Coğrafyası",
        "Yurttaşlık Bilgisi",
        "Güncel Bilgiler"
      ]
    },
    "general-legislation": {
      "title": "Genel Mevzuat",
      "subtitle": "Temel kamu mevzuatına sıralı şekilde çalış.",
      "icon": "scale",
      "iconClass": "",
      "progress": 20,
      "topics": [
        "T.C. Anayasası",
        "657 sayılı Devlet Memurları Kanunu",
        "4483 sayılı Memurlar ve Diğer Kamu Görevlilerinin Yargılanması",
        "5442 sayılı İl İdaresi Kanunu",
        "4982 sayılı Bilgi Edinme Hakkı Kanunu",
        "3071 sayılı Dilekçe Hakkının Kullanılmasına Dair Kanun"
      ]
    },
    "meb-legislation": {
      "title": "MEB Mevzuatı",
      "subtitle": "Milli Eğitim Bakanlığı mevzuatını ve bağlı düzenlemeleri çalış.",
      "icon": "schoolbook",
      "iconClass": "red",
      "progress": 13,
      "topics": [
        "1739 sayılı Milli Eğitim Temel Kanunu",
        {
          "id": "law-222",
          "type": "document",
          "documentType": "law",
          "documentNumber": "222",
          "title": "222 sayılı İlköğretim ve Eğitim Kanunu",
          "questionCount": 42,
          "articleCount": 84,
          "progress": 0,
          "meta": {
            "accepted": "5 Ocak 1961",
            "officialGazette": "12 Ocak 1961 • 10705"
          },
          "children": [
            {
              "id": "law-222-section-genel-esaslar",
              "type": "section",
              "title": "Genel Esaslar",
              "articleRange": "Madde 1 – Madde 5"
            },
            {
              "id": "law-222-section-te-kilat",
              "type": "section",
              "title": "Teşkilat",
              "articleRange": "Madde 6 – Madde 13"
            },
            {
              "id": "law-222-section-i-lde-i-lk-retim-g-revlileri",
              "type": "section",
              "title": "İlde İlköğretim Görevlileri",
              "articleRange": "Madde 14 – Madde 24"
            },
            {
              "id": "law-222-section-i-lk-retim-kurullar",
              "type": "section",
              "title": "İlköğretim Kurulları",
              "articleRange": "Madde 26"
            },
            {
              "id": "law-222-section-a-lma-kapanma-ve-tatiller",
              "type": "section",
              "title": "Açılma, Kapanma ve Tatiller",
              "articleRange": "Madde 40 – Madde 45"
            },
            {
              "id": "law-222-section-kay-t-ve-kabul",
              "type": "section",
              "title": "Kayıt ve Kabul",
              "articleRange": "Madde 46 – Madde 51"
            },
            {
              "id": "law-222-section-okula-devam",
              "type": "section",
              "title": "Okula Devam",
              "articleRange": "Madde 52 – Madde 59"
            },
            {
              "id": "law-222-section-okullar-n-arsa-ve-arazi-i-leri",
              "type": "section",
              "title": "Okulların Arsa ve Arazi İşleri",
              "articleRange": "Madde 60 – Madde 68"
            },
            {
              "id": "law-222-section-okul-yap-m-ve-donat-m",
              "type": "section",
              "title": "Okul Yapımı ve Donatımı",
              "articleRange": "Madde 69 – Madde 75"
            },
            {
              "id": "law-222-section-gelir-gider-ve-planlama",
              "type": "section",
              "title": "Gelir, Gider ve Planlama",
              "articleRange": "Madde 76 – Madde 84"
            },
            {
              "id": "law-222-section-t-rl-h-k-mler",
              "type": "section",
              "title": "Türlü Hükümler",
              "articleRange": "Madde 85 – Madde 89"
            },
            {
              "id": "law-222-section-ek-ge-ici-ve-son-h-k-mler",
              "type": "section",
              "title": "Ek, Geçici ve Son Hükümler",
              "articleRange": "Ek Madde 1 – Madde 91"
            }
          ]
        },
        "652 sayılı KHK (MEB Teşkilat)",
        "1 Sayılı Cumhurbaşkanlığı Kararnamesi MEB Teşkilatı",
        "5580 sayılı Özel Öğretim Kurumları Kanunu",
        "MEB Personelin Görevde Yükselme Yönetmeliği"
      ]
    }
  };

  const topicIconPaths = {
    scale: '<path d="M12 3v18"/><path d="M6 6h12"/><path d="m6 6-4 7h8L6 6Z"/><path d="m18 6-4 7h8l-4-7Z"/><path d="M8 21h8"/>',
    landmark: '<path d="m3 10 9-6 9 6"/><path d="M5 10h14"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/><path d="M4 18h16M3 22h18"/>',
    schoolbook: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M8 4v16"/><path d="M12 8h4M12 12h4"/><path d="m14 15 .7 1.4 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2L14 15Z"/>',
    gavel: '<path d="m14 13-7.5 7.5a1 1 0 0 1-3-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6 4 4-6 6-4-4Z"/>',
    arrow: '<path d="m9 18 6-6-6-6"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>'
  };

  function topicSvg(name, className = 'ui-icon') {
    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${topicIconPaths[name]}</svg>`;
  }

  function normalizeTopic(topic) { return typeof topic === 'string' ? { title: topic } : topic; }

  let navStack = [];

  function renderDocumentHub(documentItem, parentLevel) {
    if (documentItem.id === 'law-222') {
      renderLaw222DocumentHub(documentItem, parentLevel);
      return;
    }
    // Varsayılan diğer dokümanlar için
    topicSheet.classList.remove('law222-flow');
    topicSheetTitle.textContent = documentItem.title;
    topicSheetSubtitle.textContent = 'Mevzuat Hub';
    topicList.innerHTML = `<p style="padding:20px;text-align:center;color:var(--muted)">Diğer mevzuatlar yakında eklenecek.</p>`;
  }

  function renderLevel(level) {
    topicSheet.classList.remove('law222-flow');
    topicSheet.classList.remove('quiz-active');
    topicSheetTitle.textContent = level.title;
    topicSheetSubtitle.textContent = level.subtitle;
    topicEyebrow.textContent = level.eyebrow || 'KONU KATEGORİSİ';
    topicHeadingIcon.className = `topic-heading-icon ${level.iconClass || ''}`.trim();
    topicHeadingIcon.innerHTML = topicSvg(level.icon);

    if (navStack.length > 1) {
      const parentLevel = navStack[navStack.length - 2];
      topicBreadcrumbWrap.innerHTML = `
        <div class="topic-breadcrumb" id="topicBackBtn">
          ${topicSvg('back')}
          <span>${parentLevel.title}</span>
        </div>
      `;
      document.getElementById('topicBackBtn').addEventListener('click', () => {
        navStack.pop();
        renderLevel(navStack[navStack.length - 1]);
      });
    } else {
      topicBreadcrumbWrap.innerHTML = '';
    }

    const items = level.topics.map(normalizeTopic);
    const progress = level.progress || 0;
    topicProgressText.textContent = progress ? `%${progress} tamamlandı` : 'Henüz çalışılmadı';
    topicProgressBar.style.width = `${progress}%`;

    topicList.innerHTML = items.map((item, index) => {
      return `
        <article class="topic-item" data-index="${index}">
          <div class="topic-number">${String(index + 1).padStart(2, '0')}</div>
          <div class="topic-copy">
            <h4>${item.title}</h4>
            <p>Konu anlatımı ve soru bankası</p>
          </div>
          <div class="topic-arrow">${topicSvg('arrow')}</div>
        </article>
      `;
    }).join('');

    topicSheet.scrollTop = 0;

    topicList.querySelectorAll('.topic-item').forEach(el => {
      const item = items[Number(el.dataset.index)];
      el.addEventListener('click', () => {
        if (item.type === 'document') {
          renderDocumentHub(item, navStack[navStack.length - 1]);
        } else {
          showToast(`${item.title} detayları açılıyor…`);
        }
      });
    });
  }

  // ----------------------------------------------------
  // 222 SAYILI KANUN ÖZEL AKIŞI
  // ----------------------------------------------------

  function renderLaw222DocumentHub(documentItem, parentLevel) {
    topicSheet.classList.add('law222-flow');
    topicSheet.classList.remove('quiz-active');
    
    topicSheetTitle.textContent = documentItem.title;
    topicSheetSubtitle.textContent = `${documentItem.articleCount || 0} madde • ${documentItem.questionCount || 0} soru`;
    topicEyebrow.textContent = 'MEVZUAT ÇALIŞMA MERKEZİ';
    topicHeadingIcon.className = `topic-heading-icon ${parentLevel.iconClass || ''}`.trim();
    topicHeadingIcon.innerHTML = topicSvg('gavel');

    topicBreadcrumbWrap.innerHTML = `
      <div class="topic-breadcrumb" id="documentBackBtn" role="button" tabindex="0">
        ${topicSvg('back')}
        <span>${parentLevel.title}</span>
      </div>
    `;

    const progress = documentItem.progress || 0;
    topicProgressText.textContent = `%${progress} tamamlandı`;
    topicProgressBar.style.width = `${progress}%`;

    // Alt bölümleri değil, sadece 4'lü kart ızgarasını render ediyoruz
    topicList.innerHTML = `
      <section class="document-overview-card">
        <div class="document-overview-top">
          <span class="document-number">${documentItem.documentNumber || 'MEVZUAT'}</span>
          <span class="document-status">ÇALIŞMA PLANI HAZIR</span>
        </div>
        <h4>${documentItem.title}</h4>
        <p>Aşağıdaki çalışma yöntemlerinden birini seçerek ilerleyebilirsin.</p>
        <div class="document-stats">
          <span><strong>${documentItem.articleCount || 0}</strong> madde</span>
          <span><strong>${documentItem.questionCount || 0}</strong> soru</span>
          <span><strong>%${progress}</strong> ilerleme</span>
        </div>
      </section>

      <div class="document-mode-grid">
        <button class="document-mode-card" data-document-mode="sections" type="button">
          <span class="document-mode-icon" style="background:#edf3fb; color:var(--blue);">
            <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </span>
          <strong>Madde Madde Çalış</strong>
          <small>Bölüm ve madde listesinden istediğin yere git.</small>
        </button>
        <button class="document-mode-card" data-document-mode="random" type="button">
          <span class="document-mode-icon" style="background:#f4eff6; color:#85679e;">
            <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8" cy="8" r="1.5"/><circle cx="16" cy="16" r="1.5"/><circle cx="8" cy="16" r="1.5"/><circle cx="16" cy="8" r="1.5"/><circle cx="12" cy="12" r="1.5"/></svg>
          </span>
          <strong>Rastgele 20 Soru</strong>
          <small>Kanunun tamamından rastgele 20 soruyla kendini test et.</small>
        </button>
        <button class="document-mode-card" data-document-mode="truefalse" type="button">
          <span class="document-mode-icon" style="background:#fff0f1; color:var(--red);">
            <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <strong>Doğru / Yanlış</strong>
          <small>Kanun maddelerini doğru/yanlış formatında test et.</small>
        </button>
        <button class="document-mode-card" data-document-mode="summary" type="button">
          <span class="document-mode-icon" style="background:#fff0f1; color:var(--red);">
            <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </span>
          <strong>Özet ve Kritik Noktalar</strong>
          <small>Sınavda öne çıkan maddeleri hızlı tekrar et.</small>
        </button>
      </div>
    `;

    topicSheet.scrollTop = 0;

    document.getElementById('documentBackBtn').addEventListener('click', () => {
      haptic(14);
      renderLevel(parentLevel);
    });

    topicList.querySelector('[data-document-mode="sections"]').addEventListener('click', () => {
      haptic(20);
      renderLaw222Sections(documentItem, parentLevel);
    });

    topicList.querySelector('[data-document-mode="random"]').addEventListener('click', () => {
      openLaw222RandomQuiz(documentItem, parentLevel);
    });

    topicList.querySelector('[data-document-mode="truefalse"]').addEventListener('click', () => {
      haptic(20);
      toast.textContent = 'Doğru / Yanlış test modülü hazırlanıyor…';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    });

    topicList.querySelector('[data-document-mode="summary"]').addEventListener('click', () => {
      haptic(20);
      toast.textContent = 'Özet ve kritik noktalar ekranı hazırlanıyor…';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    });
  }

  // Madde Madde Çalış (Bölüm Listesi Ekranı)
  function renderLaw222Sections(documentItem, parentLevel) {
    topicSheet.classList.add('law222-flow');
    topicSheet.classList.remove('quiz-active');
    
    topicSheetTitle.textContent = "Bölüm Seçimi";
    topicSheetSubtitle.textContent = "Hangi bölümden test çözmek istiyorsun?";
    topicEyebrow.textContent = 'MADDE MADDE ÇALIŞ';
    
    topicBreadcrumbWrap.innerHTML = `
      <div class="topic-breadcrumb" id="sectionsBackBtn" role="button" tabindex="0">
        ${topicSvg('back')}
        <span>${documentItem.title}</span>
      </div>
    `;

    topicList.innerHTML = `
      <div class="document-section-head" style="margin-top:0;">
        <span>BÖLÜM TESTLERİ</span>
        <strong>Bölüme tıkla, test başlasın</strong>
      </div>
      <div class="document-section-list">
        ${documentItem.children.map((section, index) => `
          <article class="document-section-item" data-section-index="${index}">
            <span class="document-section-number">${String(index + 1).padStart(2, '0')}</span>
            <div>
              <h4>${section.title}</h4>
              <p>${section.articleRange || ''}</p>
            </div>
            <span class="document-section-arrow">›</span>
          </article>
        `).join('')}
      </div>
    `;

    topicSheet.scrollTop = 0;

    document.getElementById('sectionsBackBtn').addEventListener('click', () => {
      haptic(14);
      renderLaw222DocumentHub(documentItem, parentLevel);
    });

    topicList.querySelectorAll('.document-section-item').forEach(element => {
      element.addEventListener('click', () => {
        const section = documentItem.children[Number(element.dataset.sectionIndex)];
        // Geri dönülecek fonksiyonu ekleyelim (Section listesine geri dönebilmesi için)
        openLaw222SectionQuiz(section, parentLevel, documentItem, () => renderLaw222Sections(documentItem, parentLevel));
      });
    });
  }

  // ----------------------------------------------------
  // TEST MODÜLÜ (MODERN ARAYÜZ)
  // ----------------------------------------------------

  const LAW_222_QUESTIONS_URL = 'questions-222.json';
  let law222QuestionBank = [];
  let law222QuestionsLoading = null;
  let law222QuizState = null;
  let timerInterval = null;

  function loadLaw222Questions() {
    if (law222QuestionBank.length) return Promise.resolve(law222QuestionBank);
    if (law222QuestionsLoading) return law222QuestionsLoading;
    law222QuestionsLoading = fetch(LAW_222_QUESTIONS_URL, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        law222QuestionBank = data.questions || [];
        return law222QuestionBank;
      })
      .catch(error => {
        law222QuestionsLoading = null;
        throw error;
      });
    return law222QuestionsLoading;
  }

  function shuffleArray(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function law222QuizLoadError() {
    toast.textContent = 'Sorular yüklenemedi. Lütfen tekrar dene.';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function startLaw222Quiz(questions, meta) {
    if (!questions.length) {
      toast.textContent = 'Bu bölüm için soru bulunamadı.';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
      return;
    }
    
    clearInterval(timerInterval);
    
    law222QuizState = {
      questions: shuffleArray(questions).map(q => ({...q, userSelected: undefined})),
      index: 0,
      score: 0,
      wrong: [],
      title: meta.title,
      subtitle: meta.subtitle,
      renderParent: meta.renderParent,
      retryFn: meta.retryFn,
      timeLeft: 45 // Örnek olarak görseldeki gibi her soruya 45 sn atandı
    };
    renderLaw222Quiz();
  }

  function openLaw222SectionQuiz(section, parentLevel, documentItem, returnFn) {
    haptic(20);
    loadLaw222Questions().then(bank => {
      const pool = bank.filter(q => q.sectionId === section.id);
      startLaw222Quiz(pool, {
        title: section.title,
        subtitle: `${section.articleRange || ''} • Karma Sorular`.trim(),
        renderParent: returnFn, // Quizden çıkınca section listesine döner
        retryFn: () => openLaw222SectionQuiz(section, parentLevel, documentItem, returnFn)
      });
    }).catch(law222QuizLoadError);
  }

  function openLaw222RandomQuiz(documentItem, parentLevel) {
    haptic(20);
    loadLaw222Questions().then(bank => {
      // Rastgele 20 soru seçimi
      const pool = shuffleArray(bank).slice(0, 20);
      startLaw222Quiz(pool, {
        title: documentItem.title,
        subtitle: 'Rastgele 20 Soru',
        renderParent: () => renderLaw222DocumentHub(documentItem, parentLevel), // Quizden çıkınca ana Huba döner
        retryFn: () => openLaw222RandomQuiz(documentItem, parentLevel)
      });
    }).catch(law222QuizLoadError);
  }

  function renderLaw222Quiz() {
    topicSheet.classList.add('quiz-active');
    const state = law222QuizState;
    const total = state.questions.length;
    const current = state.questions[state.index];

    const letters = ['A', 'B', 'C', 'D', 'E'];
    
    topicList.innerHTML = `
      <div class="quiz-modern-container">
        <div class="quiz-modern-topbar">
          <button id="quizModernBackBtn" aria-label="Geri">${topicSvg('back')}</button>
          <h2>Mevzuat</h2>
          <button aria-label="Yer İşareti">${topicSvg('bookmark')}</button>
        </div>
        
        <div class="quiz-modern-progress-area">
          <div class="quiz-modern-progress-info">
            Soru ${state.index + 1} / ${total}
            <div class="quiz-modern-progress-bar">
              <div class="quiz-modern-progress-fill" style="width: ${((state.index + 1) / total) * 100}%"></div>
            </div>
          </div>
          <div class="quiz-modern-timer" id="quizTimer">
            ${topicSvg('clock')} 00:${state.timeLeft < 10 ? '0'+state.timeLeft : state.timeLeft}
          </div>
        </div>

        <div class="quiz-modern-card">
          <span class="quiz-modern-badge">Soru</span>
          <h3 class="quiz-modern-question">${current.prompt}</h3>
          
          <div class="quiz-modern-options">
            ${current.options.map((opt, i) => {
               let className = 'quiz-modern-option';
               if (current.userSelected !== undefined) {
                 if (i === current.answerIndex) className += ' correct';
                 else if (i === current.userSelected) className += ' wrong';
               }
               return `
               <button class="${className}" data-index="${i}" type="button">
                 <span class="quiz-modern-option-letter">${letters[i]}</span>
                 <span class="quiz-modern-option-text">${opt}</span>
               </button>
               `;
            }).join('')}
          </div>
        </div>

        <div class="quiz-modern-footer">
          <button class="quiz-modern-btn quiz-modern-btn-prev" id="quizPrevBtn" ${state.index === 0 ? 'disabled' : ''}>
            ${topicSvg('arrowLeft')} Önceki Soru
          </button>
          <button class="quiz-modern-btn quiz-modern-btn-next" id="quizNextBtn">
            Sonraki Soru ${topicSvg('arrowRight')}
          </button>
        </div>
      </div>
    `;

    topicSheet.scrollTop = 0;

    // Geri Sayım Sayacı İşlemi
    clearInterval(timerInterval);
    const timerDisplay = document.getElementById('quizTimer');
    if(current.userSelected === undefined) {
       timerInterval = setInterval(() => {
         if(state.timeLeft > 0) {
           state.timeLeft--;
           timerDisplay.innerHTML = `${topicSvg('clock')} 00:${state.timeLeft < 10 ? '0'+state.timeLeft : state.timeLeft}`;
         } else {
           clearInterval(timerInterval);
         }
       }, 1000);
    }

    // Geri Butonu
    document.getElementById('quizModernBackBtn').addEventListener('click', () => {
      haptic(14);
      clearInterval(timerInterval);
      topicSheet.classList.remove('quiz-active');
      law222QuizState = null;
      state.renderParent();
    });

    // Seçeneklere Tıklama
    const optionButtons = [...topicList.querySelectorAll('.quiz-modern-option')];
    optionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        if (current.userSelected !== undefined) return;
        
        clearInterval(timerInterval); 
        
        const selected = Number(btn.dataset.index);
        current.userSelected = selected;
        
        if (selected === current.answerIndex) { 
            state.score++; 
            haptic(20); 
        } else { 
            state.wrong.push({ ...current, selected }); 
            haptic(30); 
        }
        renderLaw222Quiz(); 
      });
    });

    // İleri / Geri Yönlendirme
    document.getElementById('quizPrevBtn').addEventListener('click', () => {
        if (state.index > 0) { 
            haptic(10);
            state.index--; 
            state.timeLeft = 45; // Süreyi her soruda sıfırlıyoruz
            renderLaw222Quiz(); 
        }
    });

    document.getElementById('quizNextBtn').addEventListener('click', () => {
        haptic(10);
        if (state.index < total - 1) {
            state.index++;
            state.timeLeft = 45; 
            renderLaw222Quiz();
        } else {
            clearInterval(timerInterval);
            renderLaw222QuizResult();
        }
    });
  }

  function renderLaw222QuizResult() {
    topicSheet.classList.remove('quiz-active');
    topicSheet.classList.add('law222-flow');
    const state = law222QuizState;
    const total = state.questions.length;
    const pct = total ? Math.round((state.score / total) * 100) : 0;

    topicEyebrow.textContent = 'SONUÇ';
    topicHeadingIcon.className = 'topic-heading-icon red';
    topicHeadingIcon.innerHTML = topicSvg('gavel');
    topicSheetTitle.textContent = state.title;
    topicSheetSubtitle.textContent = 'Test tamamlandı';
    topicBreadcrumbWrap.innerHTML = '';

    topicProgressText.textContent = `%${pct} başarı`;
    topicProgressBar.style.width = `${pct}%`;

    topicList.innerHTML = `
      <section class="quiz-result-card">
        <strong>${state.score} / ${total}</strong>
        <span>Doğru cevap</span>
      </section>
      ${state.wrong.length ? `
        <div class="quiz-result-list">
          <span class="quiz-result-list-title">YANLIŞ YAPILAN SORULAR</span>
          ${state.wrong.map(w => `
            <article class="quiz-result-item">
              <p>${w.prompt}</p>
              <small>Doğru cevap: ${w.options[w.answerIndex]}</small>
            </article>
          `).join('')}
        </div>
      ` : `<p class="quiz-result-perfect">Tebrikler, tüm soruları doğru yanıtladın!</p>`}
      <div class="quiz-result-actions">
        <button class="reader-secondary" id="quizRetryBtn" type="button">Tekrar Dene</button>
        <button class="reader-primary" id="quizBackBtn2" type="button">Listeye Dön</button>
      </div>
    `;

    topicSheet.scrollTop = 0;

    document.getElementById('quizRetryBtn').addEventListener('click', () => {
      haptic(18);
      const retryFn = state.retryFn;
      law222QuizState = null;
      retryFn();
    });
    
    document.getElementById('quizBackBtn2').addEventListener('click', () => {
      haptic(14);
      const renderParent = state.renderParent;
      law222QuizState = null;
      renderParent();
    });
  }

  window.openTopicSheet = function(categoryKey) {
    const category = categoryTopics[categoryKey];
    if (!category) {
      showToast('Kategori bulunamadı.');
      return;
    }
    navStack = [{
      title: category.title,
      subtitle: category.subtitle,
      icon: category.icon,
      iconClass: category.iconClass,
      eyebrow: 'KONU KATEGORİSİ',
      topics: category.topics,
      progress: category.progress
    }];
    renderLevel(navStack[0]);
    topicSheet.classList.add('open');
    topicBackdrop.classList.add('open');
  };

  function closeTopicSheet() {
    topicSheet.classList.remove('open');
    topicBackdrop.classList.remove('open');
    clearInterval(timerInterval);
  }

  closeTopicSheetButton.addEventListener('click', closeTopicSheet);
  topicBackdrop.addEventListener('click', closeTopicSheet);

})();