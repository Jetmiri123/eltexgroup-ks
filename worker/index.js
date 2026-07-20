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

    return env.ASSETS.fetch(request);
  },
};
