// ================= SınavRotası — Giriş sayfası =================

document.getElementById('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const loginError = document.getElementById('loginError');
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
  window.location.href = 'index.html';
});

document.getElementById('forgotPasswordLink')?.addEventListener('click', async () => {
  const loginError = document.getElementById('loginError');
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) {
    loginError.textContent = 'Sıfırlama bağlantısı gönderebilmemiz için önce e-postanı yaz.';
    return;
  }
  loginError.textContent = '';
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: new URL('login.html', window.location.href).href
  });
  loginError.textContent = error ? friendlyAuthError(error.message) : '';
  if (!error) alert(`${email} adresine bir şifre sıfırlama bağlantısı gönderdik.`);
});
