import { getKv } from './eltex-store.js';

const MEDIA_PREFIX = 'media:';
const MAX_BYTES = 2 * 1024 * 1024;

function mediaKey(path) {
  return MEDIA_PREFIX + path;
}

function randomSuffix() {
  const arr = new Uint8Array(3);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeExt(filename, contentType) {
  const fromName = String(filename || '')
    .split('.')
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (fromName && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  const fromType = String(contentType || '').split('/')[1]?.replace(/[^a-z0-9]/g, '');
  return fromType || 'jpg';
}

function decodeBase64(data) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function storeUploadedImage(env, { data, filename, contentType }) {
  if (!data || !String(contentType || '').startsWith('image/')) {
    throw new Error('Imazh i pavlefshëm');
  }

  const bytes = decodeBase64(data);
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error('Imazhi shumë i madh (max 2MB)');
  }

  const key = `uploads/${Date.now()}-${randomSuffix()}.${safeExt(filename, contentType)}`;

  if (env.UPLOADS) {
    await env.UPLOADS.put(key, bytes, {
      httpMetadata: { contentType },
    });
    return { url: `/media/${key}` };
  }

  const kv = getKv(env);
  if (!kv) throw new Error('Storage nuk është i disponueshëm');

  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  await kv.put(
    mediaKey(key),
    JSON.stringify({
      contentType,
      data: btoa(binary),
    })
  );

  return { url: `/media/${key}` };
}

export async function serveMedia(env, path) {
  const key = path.replace(/^\/+/, '');
  if (!key || key.includes('..')) {
    return new Response('Not found', { status: 404 });
  }

  if (env.UPLOADS) {
    const obj = await env.UPLOADS.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    const headers = {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    };
    return new Response(obj.body, { headers });
  }

  const kv = getKv(env);
  if (!kv) return new Response('Not found', { status: 404 });

  const stored = await kv.get(mediaKey(key), 'json');
  if (!stored?.data) return new Response('Not found', { status: 404 });

  const bytes = decodeBase64(stored.data);
  return new Response(bytes, {
    headers: {
      'Content-Type': stored.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
