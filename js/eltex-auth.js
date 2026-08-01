(function (root) {
  const TOKEN_KEY = 'eltex_user_token';
  const PROFILE_KEY = 'eltex_user_profile';
  const EMAIL_KEY = 'eltex_remember_email';

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(value) {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }

  function cachedUser() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setCachedUser(user) {
    if (user) localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
    else localStorage.removeItem(PROFILE_KEY);
  }

  function rememberedEmail() {
    return localStorage.getItem(EMAIL_KEY) || '';
  }

  function setRememberedEmail(email) {
    if (email) localStorage.setItem(EMAIL_KEY, email);
    else localStorage.removeItem(EMAIL_KEY);
  }

  function userInitial(user) {
    const source = (user && (user.name || user.email)) || '';
    return String(source).trim().charAt(0).toUpperCase() || '';
  }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token()) headers.Authorization = 'Bearer ' + token();
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || 'Gabim serveri');
      err.code = data.code;
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function refreshNav(user) {
    const link = document.querySelector('[data-profile-link]');
    if (!link) return;

    const initialEl = link.querySelector('[data-profile-initial]');
    const activeUser = user === undefined ? cachedUser() : user;

    link.classList.toggle('is-signed-in', !!(activeUser && activeUser.status === 'approved'));
    link.setAttribute('aria-label', activeUser ? 'Llogaria: ' + activeUser.name : 'Llogaria');

    if (initialEl) {
      const initial = userInitial(activeUser);
      if (initial && activeUser && activeUser.status === 'approved') {
        initialEl.textContent = initial;
        initialEl.hidden = false;
      } else {
        initialEl.textContent = '';
        initialEl.hidden = true;
      }
    }
  }

  async function signup(payload) {
    return api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async function login(payload) {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.token) setToken(data.token);
    if (data.user) setCachedUser(data.user);
    if (payload.remember !== false && payload.email) {
      setRememberedEmail(String(payload.email).trim().toLowerCase());
    }
    refreshNav(data.user || null);
    return data;
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setToken('');
    setCachedUser(null);
    refreshNav(null);
  }

  async function me() {
    if (!token()) {
      setCachedUser(null);
      refreshNav(null);
      return null;
    }
    try {
      const data = await api('/api/auth/me');
      if (data.user) {
        setCachedUser(data.user);
        refreshNav(data.user);
        return data.user;
      }
    } catch {
      setToken('');
      setCachedUser(null);
      refreshNav(null);
    }
    return null;
  }

  async function updateProfile(payload) {
    const data = await api('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (data.user) {
      setCachedUser(data.user);
      refreshNav(data.user);
    }
    return data;
  }

  function init() {
    refreshNav(cachedUser());
    if (token()) {
      me().catch(function () {
        /* handled in me() */
      });
    }
  }

  root.EltexAuth = {
    token,
    setToken,
    cachedUser,
    setCachedUser,
    rememberedEmail,
    setRememberedEmail,
    userInitial,
    refreshNav,
    signup,
    login,
    logout,
    me,
    updateProfile,
    init,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
