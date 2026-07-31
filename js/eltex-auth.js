(function (root) {
  const TOKEN_KEY = 'eltex_user_token';

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(value) {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
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
    return data;
  }

  async function logout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setToken('');
  }

  async function me() {
    if (!token()) return null;
    try {
      const data = await api('/api/auth/me');
      return data.user || null;
    } catch {
      setToken('');
      return null;
    }
  }

  root.EltexAuth = {
    token,
    setToken,
    signup,
    login,
    logout,
    me,
  };
})(window);
