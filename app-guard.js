// ================= SınavRotası — Uygulama erişim koruması =================
// index.html'de app.js'den ÖNCE yüklenir. Oturum yoksa login.html'e yönlendirir;
// oturum varsa app.js'in beklediği 'sinavrotasi:authenticated' event'ini tetikler.
// (E-posta doğrulama bağlantısındaki #access_token da burada, sayfa yüklenirken
// supabase-js tarafından otomatik okunup temizlenir.)
let appStarted = false;
function startApp(session) {
  if (appStarted) return;
  appStarted = true;
  const user = session.user;
  const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
  const firstName = fullName.split(' ')[0];
  const firstNameEl = document.getElementById('userFirstName');
  if (firstNameEl) firstNameEl.textContent = firstName;
  window.currentUser = user;
  // Sunucudaki kayıtlı kadroyu çek — tarama verisi silinse bile kaybolmasın
  supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
    .then(({ data, error }) => {
      if (error) console.error('Profil rolü okunamadı:', error);
      window.currentUserRole = data?.role || null;
      // ÖNEMLİ: window.currentUser rol sorgusundan ÖNCE senkron olarak set edildi.
      // app.js bu yüzden window.currentUser'a değil, sadece rol bilgisi de dahil
      // her şey hazır olduğunda true olan bu bayrağa bakmalı — aksi halde app.js
      // rol verisi gelmeden handleAuthenticated()'i tetikleyip kadro ekranını
      // yanlışlıkla açabilir.
      window.currentUserAuthReady = true;
      document.dispatchEvent(new CustomEvent('sinavrotasi:authenticated', { detail: { user } }));
    });
}
window.signOut = async function signOut() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
};
supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) {
    startApp(session);
  } else if (appStarted) {
    // Oturum başka bir sekmede/aygıtta kapatıldı — giriş sayfasına dön.
    window.location.href = 'login.html';
  }
});
supabaseClient.auth.getSession().then(async ({ data }) => {
  if (!data.session) {
    window.location.href = 'login.html';
    return;
  }
  // Oturum var görünüyor ama kullanıcı gerçekten Supabase'de duruyor mu, sunucudan doğrula
  const { data: userData, error } = await supabaseClient.auth.getUser();
  if (error || !userData?.user) {
    // Kullanıcı silinmiş / geçersiz — oturumu temizle, giriş sayfasına dön
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
    return;
  }
  startApp(data.session);
});

// Supabase proje ayarların — bunları Supabase Dashboard > Project Settings > API'den al.
const SUPABASE_URL = 'https://zrlsllbgqrllwgjyqbfv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_9BNNjJTjh9AfWQsxM27BiQ_1KfT0x7C';
// Not: anon key public'tir, tarayıcıda görünmesi güvenlik açığı değildir.
// Gerçek güvenlik Supabase tarafındaki Row Level Security (RLS) politikalarıyla sağlanır.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
