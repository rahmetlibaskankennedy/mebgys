// ================= SınavRotası — Giriş/Kayıt sayfaları ortak kodu =================
// login.html ve signup.html tarafından ortak kullanılır. app.js ile ilgisi yoktur,
// bu yüzden panel elemanları bulunamadığında (örn. bu sayfalarda olmayan id'ler) çökme olmaz.

function friendlyAuthError(message = '') {
  if (/Invalid login credentials/i.test(message)) return 'E-posta veya şifre hatalı.';
  if (/User already registered/i.test(message)) return 'Bu e-posta ile zaten bir hesap var.';
  if (/Password should be at least/i.test(message)) return 'Şifre en az 6 karakter olmalı.';
  if (/Email not confirmed/i.test(message)) return 'Lütfen e-postana gelen doğrulama bağlantısına tıkla.';
  if (/provider is not enabled/i.test(message)) return 'Bu giriş yöntemi şu anda kullanılamıyor. Lütfen e-posta ile devam et.';
  if (/redirect_to.*not allowed|requested path is invalid/i.test(message)) return 'Bu giriş yöntemi henüz yapılandırılmadı.';
  return message || 'Bir şeyler ters gitti, tekrar dene.';
}

function setFormBusy(button, busy, idleLabel) {
  if (!button) return;
  button.disabled = busy;
  button.textContent = busy ? 'Bekleyin…' : idleLabel;
}

// Şifre alanlarındaki göz ikonuna tıklayınca şifreyi göster/gizle.
document.querySelectorAll('.eye[data-toggle-for]').forEach(icon => {
  icon.addEventListener('click', () => {
    const input = document.getElementById(icon.dataset.toggleFor);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

// Google / Apple / Microsoft butonları — gerçek Supabase OAuth çağrısı.
// NOT: İlgili sağlayıcı Supabase Dashboard > Authentication > Providers altında
// açılıp kendi Client ID / Secret bilgileriyle yapılandırılmadan bu butonlar çalışmaz;
// Supabase o zaman "provider is not enabled" hatası döner (bu artık kullanıcıya
// düzgün bir mesaj olarak gösterilir, sayfa çökmez).
document.querySelectorAll('.social-box[data-provider]').forEach(button => {
  button.addEventListener('click', async () => {
    const provider = button.dataset.provider;
    button.disabled = true;
    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: { redirectTo: new URL('index.html', window.location.href).href }
      });
      if (error) {
        alert(friendlyAuthError(error.message));
        button.disabled = false;
      }
      // Hata yoksa tarayıcı sağlayıcının giriş ekranına yönlendirilir.
    } catch (err) {
      alert(friendlyAuthError(err?.message));
      button.disabled = false;
    }
  });
});

// Bu sayfaya oturumu zaten açık biri gelirse — ör. e-posta doğrulama bağlantısındaki
// #access_token ile döndüğünde ya da sekmeyi geri açtığında — doğrudan uygulamaya
// yönlendir. supabase-js, URL'deki token'ı otomatik okuyup temizler.
supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) window.location.replace('index.html');
});
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) window.location.replace('index.html');
});
