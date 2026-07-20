import {
  ensureKvSeeded,
  readProducts,
  writeProducts,
  readPosts,
  writePosts,
  readOrders,
  writeOrders,
  createSession,
  isAuthed,
  deleteSession,
  getKv,
} from '../lib/eltex-store.js';
import { sendOrderEmail, sendContactEmail } from '../lib/eltex-email.js';
import { storeUploadedImage } from '../lib/eltex-media.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function sanitizeText(value, maxLen) {
  return String(value || '')
    .trim()
    .slice(0, maxLen || 500);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAdminPassword(env) {
  const value = String(env.ELTEX_ADMIN_PASSWORD || 'Eltex2026!').trim();
  return value;
}

function rebuildCategories(products) {
  const counts = {};
  products.forEach((p) => {
    const cat = p.cat || (p.categories && p.categories[0]) || 'Të Tjera';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, slug: slugify(name), count }));
}

function findCatalogProduct(catalog, line) {
  const keys = [line.id, line.slug]
    .filter(Boolean)
    .map((value) => String(value).trim());

  for (const key of keys) {
    const lower = key.toLowerCase();
    const product = catalog.find(
      (p) => String(p.id) === key || p.slug === key || String(p.slug || '').toLowerCase() === lower
    );
    if (product) return product;
  }
  return null;
}

function orderRef(order) {
  return String(order.id || '').slice(-8).toUpperCase();
}

function randomToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomOrderId() {
  const arr = new Uint8Array(3);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  return 'ord_' + Date.now().toString(36) + hex;
}

async function buildOrderFromRequest(env, request, body) {
  const customer = body.customer || {};
  const name = sanitizeText(customer.name, 120);
  const email = sanitizeText(customer.email, 160).toLowerCase();
  const phone = sanitizeText(customer.phone, 40);
  const company = sanitizeText(customer.company, 120);
  const notes = sanitizeText(customer.notes, 2000);

  if (!name) throw new Error('Emri është i detyrueshëm');
  if (!isValidEmail(email)) throw new Error('Email i pavlefshëm');
  if (!phone) throw new Error('Telefoni është i detyrueshëm');

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) throw new Error('Shporta është bosh');

  const catalog = (await readProducts(env, request)).products || [];
  const orderItems = [];
  let total = 0;

  rawItems.forEach((line) => {
    const product = findCatalogProduct(catalog, line);
    const ref = String(line.slug || line.id || '').trim();
    if (!product) throw new Error('Një produkt në shportë nuk u gjet: ' + ref);

    const qty = Math.max(1, Math.min(999, Number(line.qty) || 1));
    const price = Number(product.price) || 0;
    const lineTotal = Math.round(price * qty * 100) / 100;

    orderItems.push({
      id: String(product.id),
      slug: product.slug || '',
      name: product.name || '',
      cat: product.cat || (product.categories && product.categories[0]) || '',
      price,
      qty,
      lineTotal,
    });
    total += lineTotal;
  });

  return {
    id: randomOrderId(),
    createdAt: new Date().toISOString(),
    status: 'new',
    customer: { name, email, phone, company, notes },
    items: orderItems,
    total: Math.round(total * 100) / 100,
    currency: 'EUR',
  };
}

export async function handleApiRequest(context) {
  const { request, env, params } = context;
  await ensureKvSeeded(env, request);

  const segments = (params.path || []).filter(Boolean);
  const pathname = '/api/' + segments.join('/');
  const method = request.method;

  let body = {};
  if (method !== 'GET' && method !== 'HEAD') {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  if (pathname === '/api/login' && method === 'POST') {
    if (body.password !== getAdminPassword(env)) {
      return json({ error: 'Fjalëkalimi i gabuar' }, 401);
    }
    const token = randomToken();
    await createSession(env, token);
    return json({ token });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    await deleteSession(env, request);
    return json({ ok: true });
  }

  if (pathname === '/api/contact' && method === 'POST') {
    const name = sanitizeText(body.name, 120);
    const email = sanitizeText(body.email, 160).toLowerCase();
    const phone = sanitizeText(body.phone, 40);
    const message = sanitizeText(body.message, 2000);

    if (!name) return json({ error: 'Emri është i detyrueshëm' }, 400);
    if (!isValidEmail(email)) return json({ error: 'Email i pavlefshëm' }, 400);

    let emailResult = { sent: false };
    try {
      emailResult = await sendContactEmail(env, { name, email, phone, message });
    } catch (e) {
      emailResult = { sent: false, reason: e.message };
    }

    return json({ ok: true, emailSent: emailResult.sent });
  }

  if (pathname === '/api/orders' && method === 'POST') {
    try {
      if (!getKv(env)) {
        return json({ error: 'Storage nuk është i disponueshëm. Porosia nuk u ruajt.' }, 503);
      }
      const order = await buildOrderFromRequest(env, request, body);
      const orders = await readOrders(env, request);
      orders.unshift(order);
      await writeOrders(env, orders);

      let emailResult = { sent: false };
      try {
        emailResult = await sendOrderEmail(env, order);
      } catch (e) {
        emailResult = { sent: false, reason: e.message };
      }

      return json(
        {
          ok: true,
          orderId: order.id,
          orderRef: '#' + orderRef(order),
          emailSent: emailResult.sent,
        },
        201
      );
    } catch (e) {
      return json({ error: e.message || 'Porosia e pavlefshme' }, 400);
    }
  }

  if (pathname === '/api/me' && method === 'GET') {
    const ok = await isAuthed(env, request);
    return json({ ok }, ok ? 200 : 401);
  }

  if (!(await isAuthed(env, request))) {
    return json({ error: 'Nuk jeni i kyçur' }, 401);
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);

  if (pathname === '/api/orders' && method === 'GET') {
    return json(await readOrders(env, request));
  }

  if (orderMatch && method === 'PATCH') {
    const orders = await readOrders(env, request);
    const order = orders.find((entry) => entry.id === orderMatch[1]);
    if (!order) return json({ error: 'Porosia nuk u gjet' }, 404);
    const allowed = ['new', 'processing', 'done', 'cancelled'];
    if (body.status && allowed.includes(body.status)) {
      order.status = body.status;
      order.updatedAt = new Date().toISOString();
    }
    await writeOrders(env, orders);
    return json({ ok: true, order });
  }

  if (pathname === '/api/products') {
    if (method === 'GET') return json(await readProducts(env, request));
    if (method === 'PUT') {
      if (!Array.isArray(body.products)) return json({ error: 'products array required' }, 400);
      const slugs = new Set();
      for (const product of body.products) {
        if (!product.name || !String(product.name).trim()) {
          return json({ error: 'Çdo produkt duhet të ketë emër' }, 400);
        }
        const slug = String(product.slug || slugify(product.name)).trim();
        if (!slug) return json({ error: 'Çdo produkt duhet të ketë slug' }, 400);
        if (slugs.has(slug)) return json({ error: 'Slug i përsëritur: ' + slug }, 400);
        slugs.add(slug);
        product.slug = slug;
        product.price = Number(product.price) || 0;
      }
      body.categories = rebuildCategories(body.products);
      await writeProducts(env, body);
      return json({ ok: true, count: body.products.length });
    }
  }

  if (pathname === '/api/posts') {
    if (method === 'GET') return json(await readPosts(env, request));
    if (method === 'PUT') {
      if (!Array.isArray(body)) return json({ error: 'posts array required' }, 400);
      const slugs = new Set();
      for (const post of body) {
        if (!post.title || !String(post.title).trim()) {
          return json({ error: 'Çdo artikull duhet të ketë titull' }, 400);
        }
        const slug = String(post.slug || slugify(post.title)).trim();
        if (!slug) return json({ error: 'Çdo artikull duhet të ketë slug' }, 400);
        if (slugs.has(slug)) return json({ error: 'Slug i përsëritur: ' + slug }, 400);
        slugs.add(slug);
        post.slug = slug;
      }
      await writePosts(env, body);
      return json({ ok: true, count: body.length });
    }
  }

  if (pathname === '/api/upload' && method === 'POST') {
    try {
      const result = await storeUploadedImage(env, body);
      return json(result);
    } catch (e) {
      return json({ error: e.message || 'Ngarkimi dështoi' }, 400);
    }
  }

  return json({ error: 'Not found' }, 404);
}
