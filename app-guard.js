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
  document.dispatchEvent(new CustomEvent('sinavrotasi:authenticated', { detail: { user } }));
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
