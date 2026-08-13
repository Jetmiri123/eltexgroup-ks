import {
  ensureKvSeeded,
  readProducts,
  writeProducts,
  readPosts,
  writePosts,
  readOrders,
  writeOrders,
  readSubmissions,
  writeSubmissions,
  readRequests,
  writeRequests,
  createSession,
  isAuthed,
  deleteSession,
  getKv,
} from '../lib/eltex-store.js';
import { sendOrderEmail, sendContactEmail } from '../lib/eltex-email.js';
import { storeUploadedImage } from '../lib/eltex-media.js';
import {
  signupUser,
  loginUser,
  getUserFromRequest,
  deleteUserSession,
  readUsers,
  updateUserStatus,
  deleteUser,
  updateUserProfile,
  publicUser,
} from '../lib/eltex-users.js';

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
  // Password lives only in the Cloudflare secret; no fallback so a missing
  // secret can never silently re-enable a known default password.
  return String(env.ELTEX_ADMIN_PASSWORD || '').trim();
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

function assignProductSlugs(products) {
  const slugs = new Set();
  for (const product of products) {
    if (!product.name || !String(product.name).trim()) {
      throw new Error('Çdo produkt duhet të ketë emër');
    }
    const preferred = String(product.slug || slugify(product.name)).trim();
    if (!preferred) throw new Error('Çdo produkt duhet të ketë slug');

    let slug = preferred;
    let suffix = 2;
    while (slugs.has(slug)) {
      slug = `${preferred}-${suffix}`;
      suffix += 1;
    }
    slugs.add(slug);
    product.slug = slug;
    product.price = Number(product.price) || 0;
  }
}

function prepareProductCatalog(body) {
  if (!Array.isArray(body.products)) {
    throw new Error('products array required');
  }
  assignProductSlugs(body.products);
  const derived = rebuildCategories(body.products);
  const seen = new Set(derived.map((c) => c.slug));
  // Keep manually added categories that have no products yet (count 0),
  // otherwise they would be wiped on every save.
  const custom = (Array.isArray(body.categories) ? body.categories : []).filter((cat) => {
    if (!cat || !cat.name) return false;
    const slug = cat.slug || slugify(cat.name);
    if (seen.has(slug)) return false;
    seen.add(slug);
    cat.slug = slug;
    cat.count = 0;
    return true;
  });
  body.categories = [...derived, ...custom];
  body.updatedAt = new Date().toISOString();
  return body;
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

function randomSubmissionId() {
  const arr = new Uint8Array(3);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  return 'sub_' + Date.now().toString(36) + hex;
}

async function storeSubmission(env, request, submission) {
  if (!getKv(env)) {
    throw new Error('Storage nuk është i disponueshëm');
  }
  const submissions = await readSubmissions(env, request);
  submissions.unshift(submission);
  await writeSubmissions(env, submissions);
  return submission;
}

function getCatalogVariantPrice(product, variantValue) {
  const map = product.variant_prices || {};
  if (variantValue != null && Object.prototype.hasOwnProperty.call(map, variantValue)) {
    return Number(map[variantValue]) || 0;
  }
  return Number(product.price) || 0;
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
    const variantKey = sanitizeText(line.variant || line.variantLabel, 80);
    const price = variantKey
      ? getCatalogVariantPrice(product, variantKey)
      : Number(product.price) || 0;
    const lineTotal = Math.round(price * qty * 100) / 100;
    const variantLabel = sanitizeText(line.variantLabel || line.variant, 80);
    const displayName = variantLabel
      ? (product.name || '') + ' — ' + variantLabel
      : product.name || '';

    orderItems.push({
      id: String(product.id),
      slug: product.slug || '',
      name: displayName,
      cat: product.cat || (product.categories && product.categories[0]) || '',
      price,
      qty,
      lineTotal,
      variant: variantLabel,
      variantKod: sanitizeText(line.variantKod, 40),
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
    const adminPassword = getAdminPassword(env);
    if (!adminPassword || body.password !== adminPassword) {
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

    let submission = null;
    try {
      submission = await storeSubmission(env, request, {
        id: randomSubmissionId(),
        type: 'contact',
        createdAt: new Date().toISOString(),
        status: 'new',
        name,
        email,
        phone,
        message,
      });
    } catch (e) {
      return json({ error: e.message || 'Mesazhi nuk u ruajt' }, 503);
    }

    let emailResult = { sent: false };
    try {
      emailResult = await sendContactEmail(env, { name, email, phone, message });
    } catch (e) {
      emailResult = { sent: false, reason: e.message };
    }

    return json({ ok: true, emailSent: emailResult.sent, submissionId: submission.id });
  }

  if (pathname === '/api/newsletter' && method === 'POST') {
    const email = sanitizeText(body.email, 160).toLowerCase();

    if (!isValidEmail(email)) return json({ error: 'Email i pavlefshëm' }, 400);

    try {
      const submission = await storeSubmission(env, request, {
        id: randomSubmissionId(),
        type: 'newsletter',
        createdAt: new Date().toISOString(),
        status: 'new',
        name: '',
        email,
        phone: '',
        message: '',
      });
      return json({ ok: true, submissionId: submission.id }, 201);
    } catch (e) {
      return json({ error: e.message || 'Regjistrimi nuk u ruajt' }, 503);
    }
  }

  if (pathname === '/api/orders' && method === 'POST') {
    try {
      const user = await getUserFromRequest(env, request);
      if (!user || user.status !== 'approved') {
        return json(
          { error: 'Duhet të jeni i kyçur me llogari të aprovuar për të dërguar porosi.' },
          403
        );
      }

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

  if (pathname === '/api/auth/signup' && method === 'POST') {
    try {
      const user = await signupUser(env, request, body);
      return json({ ok: true, user, message: 'Kërkesa u dërgua. Do të njoftoheni pas aprovimit nga administratori.' }, 201);
    } catch (e) {
      const status = e.message.includes('Storage') ? 503 : 400;
      return json({ error: e.message || 'Regjistrimi dështoi' }, status);
    }
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const result = await loginUser(env, request, body);
      return json({ ok: true, ...result });
    } catch (e) {
      if (e.code === 'pending' || e.code === 'rejected') {
        return json({ error: e.message, code: e.code }, 403);
      }
      return json({ error: e.message || 'Kyçja dështoi' }, 401);
    }
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    await deleteUserSession(env, request);
    return json({ ok: true });
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = await getUserFromRequest(env, request);
    if (!user) return json({ ok: false }, 401);
    return json({ ok: true, user: publicUser(user) });
  }

  if (pathname === '/api/auth/profile' && method === 'PATCH') {
    const current = await getUserFromRequest(env, request);
    if (!current) return json({ error: 'Nuk jeni i kyçur' }, 401);
    try {
      const user = await updateUserProfile(env, request, current.id, body);
      return json({ ok: true, user });
    } catch (e) {
      return json({ error: e.message || 'Ndryshimi dështoi' }, 400);
    }
  }

  if (!(await isAuthed(env, request))) {
    return json({ error: 'Nuk jeni i kyçur' }, 401);
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  const submissionMatch = pathname.match(/^\/api\/submissions\/([^/]+)$/);
  const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);

  if (pathname === '/api/users' && method === 'GET') {
    const users = await readUsers(env, request);
    return json(users.map(publicUser));
  }

  if (userMatch && method === 'PATCH') {
    try {
      const user = await updateUserStatus(env, request, userMatch[1], body.status);
      return json({ ok: true, user });
    } catch (e) {
      return json({ error: e.message || 'Ndryshimi dështoi' }, 400);
    }
  }

  if (userMatch && method === 'DELETE') {
    try {
      await deleteUser(env, request, userMatch[1]);
      return json({ ok: true });
    } catch (e) {
      return json({ error: e.message || 'Fshirja dështoi' }, 404);
    }
  }

  if (pathname === '/api/orders' && method === 'GET') {
    return json(await readOrders(env, request));
  }

  if (pathname === '/api/submissions' && method === 'GET') {
    return json(await readSubmissions(env, request));
  }

  if (submissionMatch && method === 'PATCH') {
    const submissions = await readSubmissions(env, request);
    const submission = submissions.find((entry) => entry.id === submissionMatch[1]);
    if (!submission) return json({ error: 'Mesazhi nuk u gjet' }, 404);
    const allowed = ['new', 'read', 'archived'];
    if (body.status && allowed.includes(body.status)) {
      submission.status = body.status;
      submission.updatedAt = new Date().toISOString();
    }
    await writeSubmissions(env, submissions);
    return json({ ok: true, submission });
  }

  if (submissionMatch && method === 'DELETE') {
    const submissions = await readSubmissions(env, request);
    const index = submissions.findIndex((entry) => entry.id === submissionMatch[1]);
    if (index === -1) return json({ error: 'Mesazhi nuk u gjet' }, 404);
    submissions.splice(index, 1);
    await writeSubmissions(env, submissions);
    return json({ ok: true });
  }

  if (orderMatch && method === 'PATCH') {
    const orders = await readOrders(env, request);
    const order = orders.find((entry) => entry.id === orderMatch[1]);
    if (!order) return json({ error: 'Porosia nuk u gjet' }, 404);
    const allowed = ['new', 'processing', 'done', 'cancelled', 'paid', 'unpaid_balance'];
    let changed = false;
    if (body.status && allowed.includes(body.status)) {
      order.status = body.status;
      changed = true;
    }
    if (body.customer && typeof body.customer === 'object') {
      const current = order.customer || {};
      order.customer = {
        name: sanitizeText(body.customer.name, 120) || current.name || '',
        email: sanitizeText(body.customer.email, 160) || current.email || '',
        phone: sanitizeText(body.customer.phone, 40) || current.phone || '',
        company: sanitizeText(body.customer.company, 120),
        notes: sanitizeText(body.customer.notes, 500),
      };
      changed = true;
    }
    if (Array.isArray(body.items)) {
      let total = 0;
      const previous = Array.isArray(order.items) ? order.items : [];
      order.items = body.items
        .map((patch, index) => {
          if (!patch || patch.remove) return null;
          const base = previous[index] || previous.find((item) => String(item.id) === String(patch.id)) || {};
          const qty = Math.max(1, Math.min(999, Number(patch.qty != null ? patch.qty : base.qty) || 1));
          const price = Math.max(0, Number(patch.price != null ? patch.price : base.price) || 0);
          const lineTotal = Math.round(price * qty * 100) / 100;
          total += lineTotal;
          return {
            ...base,
            ...patch,
            id: String(patch.id || base.id || ''),
            slug: sanitizeText(patch.slug || base.slug, 120),
            name: sanitizeText(patch.name || base.name, 200) || base.name || '',
            cat: sanitizeText(patch.cat || base.cat, 120),
            variant: sanitizeText(patch.variant || base.variant, 80),
            variantKod: sanitizeText(patch.variantKod || base.variantKod, 40),
            qty,
            price,
            lineTotal,
            remove: undefined,
          };
        })
        .filter(Boolean);
      order.total = Math.round(total * 100) / 100;
      changed = true;
    }
    if (changed) order.updatedAt = new Date().toISOString();
    await writeOrders(env, orders);
    return json({ ok: true, order });
  }

  if (orderMatch && method === 'DELETE') {
    const orders = await readOrders(env, request);
    const index = orders.findIndex((entry) => entry.id === orderMatch[1]);
    if (index === -1) return json({ error: 'Porosia nuk u gjet' }, 404);
    orders.splice(index, 1);
    await writeOrders(env, orders);
    return json({ ok: true });
  }

  if (pathname === '/api/products') {
    if (method === 'GET') return json(await readProducts(env, request));
    if (method === 'PUT') {
      if (!getKv(env)) {
        return json({ error: 'Magazina e të dhënave nuk është e disponueshme. Ndryshimet nuk mund të ruhen.' }, 503);
      }
      try {
        const catalog = prepareProductCatalog(body);
        await writeProducts(env, catalog);
        return json({ ok: true, count: catalog.products.length, updatedAt: catalog.updatedAt });
      } catch (e) {
        return json({ error: e.message || 'Ruajtja e produkteve dështoi' }, 400);
      }
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

  if (pathname === '/api/requests') {
    if (method === 'GET') return json(await readRequests(env, request));
    if (method === 'PUT') {
      if (!getKv(env)) {
        return json({ error: 'Magazina e të dhënave nuk është e disponueshme.' }, 503);
      }
      if (!Array.isArray(body)) return json({ error: 'requests array required' }, 400);
      for (const item of body) {
        if (!item.body || !String(item.body).trim()) {
          return json({ error: 'Çdo kërkesë duhet të ketë përshkrim' }, 400);
        }
        item.body = String(item.body).trim();
        item.title = String(item.title || '').trim();
        item.status = item.status === 'done' ? 'done' : 'pending';
      }
      await writeRequests(env, body);
      return json({ ok: true, count: body.length });
    }
  }

  return json({ error: 'Not found' }, 404);
}
