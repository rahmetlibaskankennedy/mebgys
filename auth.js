// ================= SınavRotası — Üyelik / Oturum Yönetimi =================
// Bu dosya app.js'den ÖNCE yüklenir. app.js, kullanıcı doğrulandıktan sonra
// 'sinavrotasi:authenticated' event'ini dinleyerek başlar (app.js sonunda ayarlanır).

const authPhone = document.getElementById('authPhone');
const appPhone = document.getElementById('appPhone');
const loginCard = document.getElementById('loginCard');
const signupCard = document.getElementById('signupCard');

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');
const signupInfo = document.getElementById('signupInfo');

document.getElementById('showSignup').addEventListener('click', event => {
  event.preventDefault();
  loginCard.hidden = true;
  signupCard.hidden = false;
});
document.getElementById('showLogin').addEventListener('click', event => {
  event.preventDefault();
  signupCard.hidden = true;
  loginCard.hidden = false;
});

function setFormBusy(button, busy, idleLabel) {
  button.disabled = busy;
  button.textContent = busy ? 'Bekleyin…' : idleLabel;
}

function friendlyAuthError(message = '') {
  if (/Invalid login credentials/i.test(message)) return 'E-posta veya şifre hatalı.';
  if (/User already registered/i.test(message)) return 'Bu e-posta ile zaten bir hesap var.';
  if (/Password should be at least/i.test(message)) return 'Şifre en az 6 karakter olmalı.';
  if (/Email not confirmed/i.test(message)) return 'Lütfen e-postana gelen doğrulama bağlantısına tıkla.';
  return message || 'Bir şeyler ters gitti, tekrar dene.';
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitButton = document.getElementById('loginSubmit');
  setFormBusy(submitButton, true, 'Giriş Yap');
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  setFormBusy(submitButton, false, 'Giriş Yap');
  if (error) {
    loginError.textContent = friendlyAuthError(error.message);
    return;
  }
  // onAuthStateChange bu noktadan sonra uygulamayı otomatik açacak.
});

signupForm.addEventListener('submit', async event => {
  event.preventDefault();
  signupError.textContent = '';
  signupInfo.textContent = '';
  const fullName = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const submitButton = document.getElementById('signupSubmit');
  setFormBusy(submitButton, true, 'Kayıt Ol');
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }
  });
  setFormBusy(submitButton, false, 'Kayıt Ol');
  if (error) {
    signupError.textContent = friendlyAuthError(error.message);
    return;
  }
  if (data.session) return; // e-posta doğrulama kapalıysa oturum hemen açılır.
  signupInfo.textContent = 'Hesabın oluşturuldu! Devam etmek için e-postana gelen bağlantıya tıkla, sonra giriş yap.';
  signupForm.reset();
  window.setTimeout(() => {
    signupCard.hidden = true;
    loginCard.hidden = false;
  }, 2200);
});

window.signOut = async function signOut() {
  await supabaseClient.auth.signOut();
};

function showAuthScreen() {
  authPhone.hidden = false;
  appPhone.hidden = true;
}

async function showAppScreen(session) {
  authPhone.hidden = true;
  appPhone.hidden = false;

  const user = session.user;
  const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
  const firstName = fullName.split(' ')[0];
  const firstNameEl = document.getElementById('userFirstName');
  if (firstNameEl) firstNameEl.textContent = firstName;

  window.currentUser = user;
  document.dispatchEvent(new CustomEvent('sinavrotasi:authenticated', { detail: { user } }));
}

let appStarted = false;

supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showAppScreen(session);
    appStarted = true;
  } else {
    showAuthScreen();
    appStarted = false;
  }
});

// İlk yüklemede mevcut oturumu kontrol et (sayfa yenilendiğinde tekrar giriş istemesin diye).
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    showAppScreen(data.session);
    appStarted = true;
  } else {
    showAuthScreen();
  }
});
