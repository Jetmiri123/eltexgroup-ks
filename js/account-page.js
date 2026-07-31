(function () {
  const auth = window.EltexAuth;
  if (!auth) return;

  const guestWrap = document.getElementById('account-guest');
  const userWrap = document.getElementById('account-user');
  const messageEl = document.getElementById('account-message');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const logoutBtn = document.getElementById('account-logout');

  function showMessage(text, type) {
    if (!messageEl) return;
    if (!text) {
      messageEl.hidden = true;
      messageEl.textContent = '';
      messageEl.className = 'account-message';
      return;
    }
    messageEl.hidden = false;
    messageEl.textContent = text;
    messageEl.className = 'account-message ' + (type || 'info');
  }

  function setTab(name) {
    document.querySelectorAll('[data-account-tab]').forEach((tab) => {
      const active = tab.dataset.accountTab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.getElementById('account-panel-login').hidden = name !== 'login';
    document.getElementById('account-panel-signup').hidden = name !== 'signup';
    showMessage('');
  }

  function statusLabel(status) {
    const map = {
      approved: 'Aprovuar',
      pending: 'Në pritje',
      rejected: 'Refuzuar',
    };
    return map[status] || status;
  }

  function renderUser(user) {
    guestWrap.hidden = true;
    userWrap.hidden = false;

    const badge = document.getElementById('account-status-badge');
    badge.textContent = statusLabel(user.status);
    badge.className = 'account-status-badge ' + user.status;

    document.getElementById('account-user-name').textContent = user.name;
    document.getElementById('account-user-email').innerHTML = 'Email: <strong>' + user.email + '</strong>';
    document.getElementById('account-user-company').innerHTML = user.company
      ? 'Kompania: <strong>' + user.company + '</strong>'
      : '';

    const note = document.getElementById('account-user-note');
    if (user.status === 'approved') {
      note.textContent = 'Llogaria juaj është aktive. Mund të vazhdoni me blerjet dhe porositë.';
    } else if (user.status === 'pending') {
      note.textContent = 'Kërkesa juaj është dërguar. Do të njoftoheni pas aprovimit nga administratori.';
    } else {
      note.textContent = 'Kërkesa juaj u refuzua. Kontaktoni Eltex Group për më shumë informacion.';
    }
  }

  function renderGuest() {
    guestWrap.hidden = false;
    userWrap.hidden = true;
  }

  async function boot() {
    const user = await auth.me();
    if (user) renderUser(user);
    else renderGuest();
  }

  document.querySelectorAll('[data-account-tab]').forEach((tab) => {
    tab.addEventListener('click', () => setTab(tab.dataset.accountTab));
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = loginForm.querySelector('[type="submit"]');
    submit.disabled = true;
    showMessage('');

    const form = new FormData(loginForm);
    try {
      const data = await auth.login({
        email: String(form.get('email') || '').trim(),
        password: String(form.get('password') || ''),
      });
      renderUser(data.user);
      showMessage('Mirë se vini, ' + data.user.name + '!', 'success');
    } catch (err) {
      showMessage(err.message, err.code === 'pending' || err.code === 'rejected' ? 'info' : 'error');
    } finally {
      submit.disabled = false;
    }
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = signupForm.querySelector('[type="submit"]');
    submit.disabled = true;
    showMessage('');

    const form = new FormData(signupForm);
    try {
      const data = await auth.signup({
        name: String(form.get('name') || '').trim(),
        email: String(form.get('email') || '').trim(),
        phone: String(form.get('phone') || '').trim(),
        company: String(form.get('company') || '').trim(),
        password: String(form.get('password') || ''),
      });
      signupForm.reset();
      setTab('login');
      showMessage(data.message || 'Kërkesa u dërgua. Do të njoftoheni pas aprovimit.', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await auth.logout();
    renderGuest();
    showMessage('U çkyçët me sukses.', 'info');
  });

  boot();
})();
