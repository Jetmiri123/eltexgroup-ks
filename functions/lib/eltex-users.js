import { getKv, getToken, writeJson } from './eltex-store.js';

export const USERS_KEY = 'live-users';

const USER_SESSION_PREFIX = 'user-session:';
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

function randomId(prefix) {
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  return prefix + Date.now().toString(36) + hex;
}

function randomToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt() {
  return randomToken(16);
}

async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    company: user.company || '',
    phone: user.phone || '',
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt || user.createdAt,
  };
}

export async function readUsers(env, request) {
  const kv = getKv(env);
  if (kv) {
    const raw = await kv.get(USERS_KEY);
    if (raw !== null) {
      try {
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    }
  }

  if (env.ASSETS && request) {
    const res = await env.ASSETS.fetch(new URL('/data/live-users.json', request.url).toString());
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  }

  return [];
}

export async function writeUsers(env, users) {
  await writeJson(env, USERS_KEY, users);
}

function userSessionKey(token) {
  return USER_SESSION_PREFIX + token;
}

export async function createUserSession(env, userId) {
  const kv = getKv(env);
  if (!kv) throw new Error('Storage nuk është i disponueshëm');
  const token = randomToken();
  const expires = Date.now() + SESSION_TTL_SEC * 1000;
  await kv.put(userSessionKey(token), JSON.stringify({ userId, expires }), {
    expirationTtl: SESSION_TTL_SEC,
  });
  return token;
}

export async function deleteUserSession(env, request) {
  const kv = getKv(env);
  const token = getToken(request);
  if (token && kv) await kv.delete(userSessionKey(token));
}

export async function getUserFromRequest(env, request) {
  const kv = getKv(env);
  const token = getToken(request);
  if (!token || !kv) return null;

  const raw = await kv.get(userSessionKey(token));
  if (!raw) return null;

  let session;
  try {
    session = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!session?.userId || !session.expires || session.expires < Date.now()) {
    if (session?.userId) await kv.delete(userSessionKey(token));
    return null;
  }

  const users = await readUsers(env, request);
  const user = users.find((entry) => entry.id === session.userId);
  return user || null;
}

export async function signupUser(env, request, body) {
  if (!getKv(env)) throw new Error('Storage nuk është i disponueshëm');

  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 160);
  const password = String(body.password || '');
  const company = String(body.company || '').trim().slice(0, 120);
  const phone = String(body.phone || '').trim().slice(0, 40);

  if (!name) throw new Error('Emri është i detyrueshëm');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email i pavlefshëm');
  if (password.length < 8) throw new Error('Fjalëkalimi duhet të ketë të paktën 8 karaktere');

  const users = await readUsers(env, request);
  if (users.some((entry) => entry.email === email)) {
    throw new Error('Ky email është i regjistruar tashmë');
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const now = new Date().toISOString();
  const user = {
    id: randomId('usr_'),
    email,
    name,
    company,
    phone,
    passwordHash,
    passwordSalt: salt,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  users.unshift(user);
  await writeUsers(env, users);
  return publicUser(user);
}

export async function loginUser(env, request, body) {
  if (!getKv(env)) throw new Error('Storage nuk është i disponueshëm');

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email || !password) throw new Error('Email dhe fjalëkalimi janë të detyrueshëm');

  const users = await readUsers(env, request);
  const user = users.find((entry) => entry.email === email);
  if (!user) throw new Error('Email ose fjalëkalimi i gabuar');

  const valid = (await hashPassword(password, user.passwordSalt)) === user.passwordHash;
  if (!valid) throw new Error('Email ose fjalëkalimi i gabuar');

  if (user.status === 'pending') {
    const err = new Error('Llogaria juaj është në pritje të aprovimit nga administratori.');
    err.code = 'pending';
    throw err;
  }

  if (user.status === 'rejected') {
    const err = new Error('Kërkesa juaj për llogari u refuzua. Kontaktoni Eltex Group për më shumë.');
    err.code = 'rejected';
    throw err;
  }

  const token = await createUserSession(env, user.id);
  return { token, user: publicUser(user) };
}

export async function updateUserStatus(env, request, userId, status) {
  const allowed = ['pending', 'approved', 'rejected'];
  if (!allowed.includes(status)) throw new Error('Status i pavlefshëm');

  const users = await readUsers(env, request);
  const user = users.find((entry) => entry.id === userId);
  if (!user) throw new Error('Përdoruesi nuk u gjet');

  user.status = status;
  user.updatedAt = new Date().toISOString();
  if (status === 'approved') user.approvedAt = user.updatedAt;

  await writeUsers(env, users);
  return publicUser(user);
}

export async function deleteUser(env, request, userId) {
  const users = await readUsers(env, request);
  const index = users.findIndex((entry) => entry.id === userId);
  if (index === -1) throw new Error('Përdoruesi nuk u gjet');
  users.splice(index, 1);
  await writeUsers(env, users);
  return { ok: true };
}
