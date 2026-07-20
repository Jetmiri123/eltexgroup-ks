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

function getKv(env) {
  return env.ELTEX_DATA || env.KV || null;
}

export async function readJson(env, key) {
  const kv = getKv(env);
  if (!kv) return null;
  return kv.get(key, 'json');
}

export async function writeJson(env, key, data) {
  const kv = getKv(env);
  if (!kv) throw new Error('Storage not configured');
  await kv.put(key, JSON.stringify(data, null, 2));
}

export async function createSession(env, token) {
  const kv = getKv(env);
  if (!kv) return;
  const expires = Date.now() + 24 * 60 * 60 * 1000;
  await kv.put(sessionKey(token), String(expires), {
    expirationTtl: 86400,
  });
}

export async function isAuthed(env, req) {
  const kv = getKv(env);
  const token = getToken(req);
  if (!token || !kv) return false;
  const expires = Number(await kv.get(sessionKey(token)));
  if (!expires || expires < Date.now()) {
    if (expires) await kv.delete(sessionKey(token));
    return false;
  }
  return true;
}

export async function deleteSession(env, req) {
  const kv = getKv(env);
  const token = getToken(req);
  if (token && kv) await kv.delete(sessionKey(token));
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
