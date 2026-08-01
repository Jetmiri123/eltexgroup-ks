(function () {
  const auth = window.EltexAuth;
  if (!auth) return;

  const guestWrap = document.getElementById('account-guest');
  const userWrap = document.getElementById('account-user');
  const messageEl = document.getElementById('account-message');
  const settingsMessageEl = document.getElementById('settings-message');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const settingsForm = document.getElementById('settings-form');
  const logoutBtn = document.getElementById('account-logout');
  const loginEmailInput = document.getElementById('login-email');

  function showMessage(text, type, target) {
    const el = target || messageEl;
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'account-message';
      return;
    }
    el.hidden = false;
    el.textContent = text;
    el.className = 'account-message ' + (type || 'info');
  }

  function setGuestTab(name) {
    document.querySelectorAll('[data-account-tab]').forEach((tab) => {
      const active = tab.dataset.accountTab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.getElementById('account-panel-login').hidden = name !== 'login';
    document.getElementById('account-panel-signup').hidden = name !== 'signup';
    showMessage('');
  }

  function setUserTab(name) {
    document.querySelectorAll('[data-user-tab]').forEach((tab) => {
      const active = tab.dataset.userTab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.getElementById('account-panel-profile').hidden = name !== 'profile';
    document.getElementById('account-panel-settings').hidden = name !== 'settings';
    showMessage('', '', settingsMessageEl);
  }

  function statusLabel(status) {
    const map = {
      approved: 'Aprovuar',
      pending: 'Në pritje',
      rejected: 'Refuzuar',
    };
    return map[status] || status;
  }

  function fillSettings(user) {
    document.getElementById('settings-name').value = user.name || '';
    document.getElementById('settings-email').value = user.email || '';
    document.getElementById('settings-phone').value = user.phone || '';
    document.getElementById('settings-company').value = user.company || '';
    settingsForm.querySelector('[name="currentPassword"]').value = '';
    settingsForm.querySelector('[name="newPassword"]').value = '';
  }

  function renderUser(user) {
    guestWrap.hidden = true;
    userWrap.hidden = false;
    setUserTab('profile');

    const badge = document.getElementById('account-status-badge');
    badge.textContent = statusLabel(user.status);
    badge.className = 'account-status-badge ' + user.status;

    document.getElementById('account-user-name').textContent = user.name;
    document.getElementById('account-user-email').innerHTML = 'Email: <strong>' + user.email + '</strong>';
    document.getElementById('account-user-phone').innerHTML = user.phone
      ? 'Telefoni: <strong>' + user.phone + '</strong>'
      : '';
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

    fillSettings(user);
    auth.refreshNav(user);

    const settingsTab = document.querySelector('[data-user-tab="settings"]');
    const canEdit = user.status === 'approved';
    if (settingsTab) settingsTab.hidden = !canEdit;
    if (!canEdit) setUserTab('profile');
  }

  function renderGuest() {
    guestWrap.hidden = false;
    userWrap.hidden = true;
    setGuestTab('login');
    auth.refreshNav(null);
  }

  async function boot() {
    if (loginEmailInput && auth.rememberedEmail()) {
      loginEmailInput.value = auth.rememberedEmail();
    }

    const cached = auth.cachedUser();
    if (cached && auth.token()) {
      renderUser(cached);
    }

    const user = await auth.me();
    if (user) renderUser(user);
    else renderGuest();
  }

  document.querySelectorAll('[data-account-tab]').forEach((tab) => {
    tab.addEventListener('click', () => setGuestTab(tab.dataset.accountTab));
  });

  document.querySelectorAll('[data-user-tab]').forEach((tab) => {
    tab.addEventListener('click', () => setUserTab(tab.dataset.userTab));
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
        remember: form.get('remember') === 'on',
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
    const email = String(form.get('email') || '').trim();
    try {
      const data = await auth.signup({
        name: String(form.get('name') || '').trim(),
        email,
        phone: String(form.get('phone') || '').trim(),
        company: String(form.get('company') || '').trim(),
        password: String(form.get('password') || ''),
      });
      signupForm.reset();
      setGuestTab('login');
      if (loginEmailInput) loginEmailInput.value = email;
      showMessage(data.message || 'Kërkesa u dërgua. Do të njoftoheni pas aprovimit.', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = settingsForm.querySelector('[type="submit"]');
    submit.disabled = true;
    showMessage('', '', settingsMessageEl);

    const form = new FormData(settingsForm);
    try {
      const data = await auth.updateProfile({
        name: String(form.get('name') || '').trim(),
        phone: String(form.get('phone') || '').trim(),
        company: String(form.get('company') || '').trim(),
        currentPassword: String(form.get('currentPassword') || ''),
        newPassword: String(form.get('newPassword') || ''),
      });
      renderUser(data.user);
      showMessage('Ndryshimet u ruajtën.', 'success', settingsMessageEl);
    } catch (err) {
      showMessage(err.message, 'error', settingsMessageEl);
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
