const KEYS = {
  products: 'live-products',
  posts: 'live-posts',
  orders: 'live-orders',
};

function sessionKey(token) {
  return 'session:' + token;
}

function getKv(env) {
  return env.ELTEX_DATA || env.KV || null;
}

async function fetchAssetJson(env, request, assetPath) {
  if (!env.ASSETS || !request) return null;
  const res = await env.ASSETS.fetch(new URL(assetPath, request.url).toString());
  if (!res.ok) return null;
  return res.json();
}

export async function ensureKvSeeded(env, request) {
  const kv = getKv(env);
  if (!kv || !request) return;

  const flag = await kv.get('_kv_seeded');
  if (flag === '1') return;

  const products = await fetchAssetJson(env, request, '/data/live-products.json');
  const posts = await fetchAssetJson(env, request, '/data/live-posts.json');
  const orders = await fetchAssetJson(env, request, '/data/live-orders.json');

  if (!(await kv.get(KEYS.products)) && products) {
    await kv.put(KEYS.products, JSON.stringify(products, null, 2));
  }
  if (!(await kv.get(KEYS.posts)) && posts) {
    await kv.put(KEYS.posts, JSON.stringify(posts, null, 2));
  }
  if (!(await kv.get(KEYS.orders)) && orders) {
    await kv.put(KEYS.orders, JSON.stringify(orders, null, 2));
  }

  await kv.put('_kv_seeded', '1');
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

export async function readProducts(env, request) {
  const fromKv = await readJson(env, KEYS.products);
  if (fromKv && Array.isArray(fromKv.products) && fromKv.products.length) return fromKv;

  const fromAssets = await fetchAssetJson(env, request, '/data/live-products.json');
  return fromAssets || fromKv || { products: [], categories: [] };
}

export async function writeProducts(env, data) {
  await writeJson(env, KEYS.products, data);
}

export async function readPosts(env, request) {
  const fromKv = await readJson(env, KEYS.posts);
  if (Array.isArray(fromKv) && fromKv.length) return fromKv;

  const fromAssets = await fetchAssetJson(env, request, '/data/live-posts.json');
  return fromAssets || (Array.isArray(fromKv) ? fromKv : []);
}

export async function writePosts(env, data) {
  await writeJson(env, KEYS.posts, data);
}

export async function readOrders(env, request) {
  const fromKv = await readJson(env, KEYS.orders);
  if (Array.isArray(fromKv)) return fromKv;

  const fromAssets = await fetchAssetJson(env, request, '/data/live-orders.json');
  return fromAssets || [];
}

export async function writeOrders(env, data) {
  await writeJson(env, KEYS.orders, data);
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
