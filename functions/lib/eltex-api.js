import {
  readProducts,
  writeProducts,
  readPosts,
  writePosts,
  readOrders,
  writeOrders,
  createSession,
  isAuthed,
  deleteSession,
  getToken,
} from '../lib/eltex-store.js';

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

async function buildOrderFromRequest(env, body) {
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

  const catalog = (await readProducts(env)).products || [];
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

async function sendOrderEmail(env, order) {
  const apiKey = env.RESEND_API_KEY;
  const orderEmail = env.ELTEX_ORDER_EMAIL;
  if (!apiKey || !orderEmail) return { sent: false, reason: 'Email not configured' };

  const ref = orderRef(order);
  const from = env.ELTEX_EMAIL_FROM || 'orders@eltexgroup-ks.com';
  const lines = order.items.map((i) => `${i.qty} x ${i.name} — €${i.lineTotal.toFixed(2)}`).join('\n');

  const payload = {
    from,
    to: [orderEmail],
    reply_to: order.customer.email,
    subject: `Porosi e Reja #${ref} — Eltex Group`,
    text: `Porosi e re\n\nKlienti: ${order.customer.name}\nEmail: ${order.customer.email}\nTelefon: ${order.customer.phone}\n\n${lines}\n\nTotali: €${order.total.toFixed(2)}`,
  };

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    return { sent: false, reason: err };
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [order.customer.email],
      subject: `Faleminderit! Porosia juaj #${ref} u pranua — Eltex Group`,
      text: `Përshëndetje ${order.customer.name},\n\nFaleminderit për porosinë tuaj. Referenca: #${ref}\nTotali: €${order.total.toFixed(2)}\n\nMe respekt,\nEltex Group`,
    }),
  });

  return { sent: true };
}

export async function handleApiRequest(context) {
  const { request, env, params } = context;
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

  const adminPassword = env.ELTEX_ADMIN_PASSWORD || 'admin';

  if (pathname === '/api/login' && method === 'POST') {
    if (body.password !== adminPassword) return json({ error: 'Fjalëkalimi i gabuar' }, 401);
    const token = randomToken();
    await createSession(env, token);
    return json({ token });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    await deleteSession(env, request);
    return json({ ok: true });
  }

  if (pathname === '/api/orders' && method === 'POST') {
    try {
      const order = await buildOrderFromRequest(env, body);
      const orders = await readOrders(env);
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
    return json(await readOrders(env));
  }

  if (orderMatch && method === 'PATCH') {
    const orders = await readOrders(env);
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
    if (method === 'GET') return json(await readProducts(env));
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
    if (method === 'GET') return json(await readPosts(env));
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

  return json({ error: 'Not found' }, 404);
}
