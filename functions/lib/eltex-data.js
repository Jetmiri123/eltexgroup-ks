import { loadDataWithFallback, KEYS } from './eltex-store.js';

const FILE_MAP = {
  'live-products.json': KEYS.products,
  'live-posts.json': KEYS.posts,
  'live-orders.json': KEYS.orders,
  'live-site-manifest.json': 'live-site-manifest',
};

export async function handleDataRequest({ request, env, filename }) {
  if (!FILE_MAP[filename]) {
    return env.ASSETS.fetch(request);
  }

  const data = await loadDataWithFallback(
    env,
    '/data/' + filename,
    FILE_MAP[filename],
    request
  );

  if (data === null) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(JSON.stringify(data, null, 2) + '\n', {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': filename.includes('orders') ? 'no-store' : 'public, max-age=60',
    },
  });
}
