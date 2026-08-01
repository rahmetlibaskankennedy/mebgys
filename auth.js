// ================= SınavRotası — Üyelik / Oturum Yönetimi =================

const authContainer = document.getElementById('authContainer');
const appPhone = document.getElementById('appPhone');

const loginCard = document.getElementById('loginCard');
const signupCard = document.getElementById('signupCard');

const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const loginError = document.getElementById('loginError');
const signupError = document.getElementById('signupError');
const signupInfo = document.getElementById('signupInfo');

// --- Tab ve Ekran Yönetimi ---
function showLoginTab() {
  if (loginCard) loginCard.style.display = 'block';
  if (signupCard) signupCard.style.display = 'none';
  if (tabLogin) tabLogin.classList.add('active');
  if (tabSignup) tabSignup.classList.remove('active');
}

function showSignupTab() {
  if (loginCard) loginCard.style.display = 'none';
  if (signupCard) signupCard.style.display = 'block';
  if (tabSignup) tabSignup.classList.add('active');
  if (tabLogin) tabLogin.classList.remove('active');
}

if (tabLogin) tabLogin.addEventListener('click', showLoginTab);
if (tabSignup) tabSignup.addEventListener('click', showSignupTab);

function setFormBusy(button, busy, idleLabel) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? 'Bekleyin…' : idleLabel;
}

function friendlyAuthError(message = '') {
  if (/Invalid login credentials/i.test(message)) return 'E-posta veya şifre hatalı.';
  if (/User already registered/i.test(message)) return 'Bu e-posta ile zaten kayıtlı bir hesap var.';
  if (/Password should be at least/i.test(message)) return 'Şifre en az 6 karakter olmalı.';
  if (/Email not confirmed/i.test(message)) return 'Lütfen e-postana gelen doğrulama bağlantısına tıkla.';
  return message || 'Bir şeyler ters gitti, tekrar dene.';
}

// --- E-posta / Şifre Giriş ---
if (loginForm) {
  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (loginError) loginError.textContent = '';

    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    const submitButton = document.getElementById('loginSubmit');

    if (!email || !password) {
      if (loginError) loginError.textContent = 'Lütfen tüm alanları doldurun.';
      return;
    }

    setFormBusy(submitButton, true, 'Giriş Yap');
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    setFormBusy(submitButton, false, 'Giriş Yap');

    if (error && loginError) {
      loginError.textContent = friendlyAuthError(error.message);
    }
  });
}

// --- E-posta / Şifre Kayıt ---
if (signupForm) {
  signupForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (signupError) signupError.textContent = '';
    if (signupInfo) signupInfo.textContent = '';

    const fullName = document.getElementById('signupName')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm')?.value;
    const termsAccepted = document.getElementById('signupTerms')?.checked;

    if (!fullName || !email || !password) {
      if (signupError) signupError.textContent = 'Lütfen tüm zorunlu alanları doldurun.';
      return;
    }

    if (password !== passwordConfirm) {
      if (signupError) signupError.textContent = 'Şifreler eşleşmiyor.';
      return;
    }

    if (!termsAccepted) {
      if (signupError) signupError.textContent = 'Devam etmek için şartları kabul etmelisin.';
      return;
    }

    const submitButton = document.getElementById('signupSubmit');
    setFormBusy(submitButton, true, 'Kayıt Ol');

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin
      }
    });

    setFormBusy(submitButton, false, 'Kayıt Ol');

    if (error) {
      if (signupError) signupError.textContent = friendlyAuthError(error.message);
      return;
    }

    if (data?.session) {
      // E-posta doğrulaması kapalıysa doğrudan oturum açılır
      return;
    }

    if (signupInfo) {
      signupInfo.textContent = 'Hesabın oluşturuldu! E-postana gelen doğrulama bağlantısına tıklayarak giriş yapabilirsin.';
    }
    signupForm.reset();
    window.setTimeout(showLoginTab, 3000);
  });
}

// --- Şifre Göster / Gizle ---
document.querySelectorAll('.eye[data-toggle-for]').forEach(icon => {
  icon.addEventListener('click', () => {
    const input = document.getElementById(icon.dataset.toggleFor);
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  });
});

// --- Şifremi Unuttum ---
document.getElementById('forgotPasswordLink')?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail')?.value.trim();
  if (!email) {
    if (loginError) loginError.textContent = 'Sıfırlama bağlantısı gönderebilmemiz için önce e-postanı yaz.';
    return;
  }
  if (loginError) loginError.textContent = '';
  
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  if (error) {
    if (loginError) loginError.textContent = friendlyAuthError(error.message);
  } else {
    alert(`${email} adresine şifre sıfırlama bağlantısı gönderdik.`);
  }
});

// --- Sosyal Giriş (Google / Microsoft Azure) Entegrasyonu ---
document.querySelectorAll('.social-box[data-provider]').forEach(button => {
  button.addEventListener('click', async () => {
    const provider = button.dataset.provider; // 'google' veya 'azure'
    
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      alert(`Giriş başlatılamadı: ${error.message}`);
    }
  });
});

// --- Çıkış Yap ---
window.signOut = async function signOut() {
  await supabaseClient.auth.signOut();
};

// --- Ekran Değişim Kontrolleri ---
function showAuthScreen() {
  if (authContainer) authContainer.style.display = 'flex';
  if (appPhone) appPhone.style.display = 'none';
}

function showAppScreen(session) {
  if (authContainer) authContainer.style.display = 'none';
  if (appPhone) appPhone.style.display = 'block';

  const user = session.user;
  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Kullanıcı';
  const firstName = fullName.split(' ')[0];
  
  const firstNameEl = document.getElementById('userFirstName');
  if (firstNameEl) firstNameEl.textContent = firstName;

  window.currentUser = user;

  // E-posta doğrulama linkinden gelindiyse URL hash parametrelerini temizle (#access_token=...)
  if (window.location.hash && window.location.hash.includes('access_token')) {
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
  }

  document.dispatchEvent(new CustomEvent('sinavrotasi:authenticated', { detail: { user } }));
}

// --- Supabase Oturum Dinleyicisi ---
supabaseClient.auth.onAuthStateChange((event, session) => {
  if (session) {
    showAppScreen(session);
  } else {
    showAuthScreen();
  }
});

// --- Sayfa İlk Açılış Oturum Kontrolü ---
supabaseClient.auth.getSession().then(({ data }) => {
  if (data?.session) {
    showAppScreen(data.session);
  } else {
    showAuthScreen();
  }
}).catch(() => {
  showAuthScreen();
});
