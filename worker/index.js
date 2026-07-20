import { handleApiRequest } from '../functions/lib/eltex-api.js';
import { handleDataRequest } from '../functions/lib/eltex-data.js';
import { serveMedia } from '../functions/lib/eltex-media.js';
import { getCleanUrlRedirect, redirectResponse } from '../functions/lib/eltex-urls.js';

const NOINDEX = 'noindex, nofollow, noarchive';

function withNoIndex(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', NOINDEX);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isPrivatePath(path) {
  return path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/');
}

async function serveStatic(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  let response = await env.ASSETS.fetch(request);
  if (response.status !== 404) return response;

  if (path === '/' || path === '') {
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  }

  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) {
    response = await env.ASSETS.fetch(new Request(new URL(path + '.html', url), request));
    if (response.status !== 404) return response;
  }

  if (path.endsWith('/')) {
    response = await env.ASSETS.fetch(new Request(new URL(path + 'index.html', url), request));
    if (response.status !== 404) return response;
  }

  return response;
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (path.startsWith('/api/')) {
      const segments = path.slice(5).split('/').filter(Boolean);
      return withNoIndex(await handleApiRequest({ request, env, params: { path: segments } }));
    }

    if (path.startsWith('/data/')) {
      return handleDataRequest({ request, env, filename: path.slice(6) });
    }

    if (path.startsWith('/media/')) {
      return serveMedia(env, path.slice(7));
    }

    const clean = getCleanUrlRedirect(path);
    if (clean && clean !== path) {
      return redirectResponse(request, clean);
    }

    const response = await serveStatic(request, env);
    if (isPrivatePath(path)) {
      return withNoIndex(response);
    }
    return response;
  },
};
