import { handleApiRequest } from '../lib/eltex-api.js';

export async function onRequest(context) {
  return handleApiRequest(context);
}
