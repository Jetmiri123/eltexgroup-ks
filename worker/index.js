import { handleApiRequest } from '../functions/lib/eltex-api.js';
import { handleDataRequest } from '../functions/lib/eltex-data.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/')) {
      const segments = path.slice(5).split('/').filter(Boolean);
      return handleApiRequest({ request, env, params: { path: segments } });
    }

    if (path.startsWith('/data/')) {
      return handleDataRequest({ request, env, filename: path.slice(6) });
    }

    if (path === '/produkt' || path === '/produkt/') {
      return Response.redirect(new URL('/produkte.html', url), 301);
    }

    const productMatch = path.match(/^\/produkt\/([^/]+)\/?$/);
    if (productMatch) {
      return env.ASSETS.fetch(new URL('/produkt.html', url));
    }

    const blogMatch = path.match(/^\/blog\/([^/]+)\/?$/);
    if (blogMatch) {
      return env.ASSETS.fetch(new URL('/blog-post.html', url));
    }

    if (path === '/admin' || path === '/admin/') {
      return env.ASSETS.fetch(new URL('/admin/index.html', url));
    }

    return env.ASSETS.fetch(request);
  },
};
