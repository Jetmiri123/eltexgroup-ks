const KEYS = {
  products: 'live-products',
  posts: 'live-posts',
  orders: 'live-orders',
};

function sessionKey(token) {
  return 'session:' + token;
}

export async function readProducts(env) {
  return (await readJson(env, KEYS.products)) || { products: [], categories: [] };
}

export async function writeProducts(env, data) {
  await writeJson(env, KEYS.products, data);
}

export async function readPosts(env) {
  const data = await readJson(env, KEYS.posts);
  return Array.isArray(data) ? data : [];
}

export async function writePosts(env, data) {
  await writeJson(env, KEYS.posts, data);
}

export async function readOrders(env) {
  const data = await readJson(env, KEYS.orders);
  return Array.isArray(data) ? data : [];
}

export async function writeOrders(env, data) {
  await writeJson(env, KEYS.orders, data);
}

export async function readJson(env, key) {
  if (!env.ELTEX_DATA) return null;
  return env.ELTEX_DATA.get(key, 'json');
}

export async function writeJson(env, key, data) {
  if (!env.ELTEX_DATA) throw new Error('Storage not configured');
  await env.ELTEX_DATA.put(key, JSON.stringify(data, null, 2));
}

export async function createSession(env, token) {
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  await env.ELTEX_DATA.put(sessionKey(token), String(expires), {
    expirationTtl: 86400,
  });
}

export async function isAuthed(env, req) {
  const token = getToken(req);
  if (!token || !env.ELTEX_DATA) return false;
  const expires = Number(await env.ELTEX_DATA.get(sessionKey(token)));
  if (!expires || expires < Date.now()) {
    if (expires) await env.ELTEX_DATA.delete(sessionKey(token));
    return false;
  }
  return true;
}

export async function deleteSession(env, req) {
  const token = getToken(req);
  if (token && env.ELTEX_DATA) await env.ELTEX_DATA.delete(sessionKey(token));
}

function getToken(req) {
  const auth = req.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

export async function loadDataWithFallback(env, assetPath, key, request) {
  const kv = await readJson(env, key);
  if (kv) return kv;

  if (env.ASSETS) {
    const assetUrl = new URL(assetPath, request.url);
    const res = await env.ASSETS.fetch(assetUrl.toString());
    if (res.ok) return res.json();
  }

  return null;
}

export { KEYS, getToken };
