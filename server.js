#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3456);
const ADMIN_PASSWORD = process.env.ELTEX_ADMIN_PASSWORD || 'Eltex2026!';

const PRODUCTS_PATH = path.join(ROOT, 'data/live-products.json');
const POSTS_PATH = path.join(ROOT, 'data/live-posts.json');
const ORDERS_PATH = path.join(ROOT, 'data/live-orders.json');
const UPLOADS_DIR = path.join(ROOT, 'images/uploads');

const ORDER_EMAIL = process.env.ELTEX_ORDER_EMAIL || process.env.ELTEX_SMTP_USER || '';
const SMTP_HOST = process.env.ELTEX_SMTP_HOST || '';
const SMTP_PORT = Number(process.env.ELTEX_SMTP_PORT || 587);
const SMTP_USER = process.env.ELTEX_SMTP_USER || '';
const SMTP_PASS = process.env.ELTEX_SMTP_PASS || '';
const SMTP_FROM = process.env.ELTEX_SMTP_FROM || SMTP_USER || 'orders@eltexgroup-rks.com';

let mailer = null;
try {
  mailer = require('nodemailer');
} catch {
  mailer = null;
}

const sessions = new Map();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function saveUploadedImage({ data, filename, contentType }) {
  if (!data || !String(contentType || '').startsWith('image/')) {
    throw new Error('Imazh i pavlefshëm');
  }
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length > 2 * 1024 * 1024) {
    throw new Error('Imazhi shumë i madh (max 2MB)');
  }
  ensureUploadsDir();
  const ext = String(filename || '')
    .split('.')
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '') || contentType.split('/')[1] || 'jpg';
  const safeExt = ext === 'jpeg' ? 'jpg' : ext;
  const name = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${safeExt}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);
  return { url: `/images/uploads/${name}` };
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

function getToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return '';
}

function isAuthed(req) {
  const token = getToken(req);
  const session = sessions.get(token);
  if (!session) return false;
  if (session.expires < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function send(res, status, body, type, extraHeaders) {
  const headers = {
    'Content-Type': type || 'text/plain; charset=utf-8',
    ...(extraHeaders || {}),
  };
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, obj, extraHeaders) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8', extraHeaders);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function routeRequest(pathname) {
  if (pathname === '/produkt' || pathname === '/produkt/') {
    return { redirect: '/produkte' };
  }
  const productMatch = pathname.match(/^\/produkt\/([^/]+)\/?$/);
  if (productMatch) {
    return { file: 'produkt.html' };
  }
  const blogMatch = pathname.match(/^\/blog\/([^/]+)\/?$/);
  if (blogMatch) {
    return { file: 'blog-post.html' };
  }
  if (pathname === '/admin' || pathname === '/admin/') {
    return { file: 'admin/index.html' };
  }
  return null;
}

function getCleanUrlRedirect(pathname) {
  if (!pathname) return null;
  if (pathname === '/produkt' || pathname === '/produkt/') return '/produkte';
  if (pathname === '/admin/') return '/admin';

  const aliases = {
    '/index.html': '/',
    '/produkt.html': '/produkte',
    '/blog-post.html': '/blogs',
    '/admin/index.html': '/admin',
  };
  if (aliases[pathname]) return aliases[pathname];

  if (pathname.endsWith('/index.html')) {
    const base = pathname.slice(0, -'/index.html'.length);
    return base || '/';
  }

  if (pathname.endsWith('.html')) {
    if (pathname.startsWith('/admin/')) return null;
    const clean = pathname.slice(0, -5);
    return clean || '/';
  }

  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return null;
}

function serveFile(res, filePath, extraHeaders) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'Not found');
      return;
    }
    send(res, 200, data, MIME[ext] || 'application/octet-stream', extraHeaders);
  });
}

const NOINDEX_HEADERS = { 'X-Robots-Tag': 'noindex, nofollow, noarchive' };

function rebuildCategories(products) {
  const counts = {};
  products.forEach((p) => {
    const cat = p.cat || (p.categories && p.categories[0]) || 'Të Tjera';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      slug: slugify(name),
      count,
    }));
}

function readOrders() {
  try {
    const data = readJson(ORDERS_PATH);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeOrders(orders) {
  writeJson(ORDERS_PATH, orders);
}

function sanitizeText(value, maxLen) {
  return String(value || '')
    .trim()
    .slice(0, maxLen || 500);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

function buildOrderFromRequest(body) {
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

  const catalog = readJson(PRODUCTS_PATH).products || [];
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

  total = Math.round(total * 100) / 100;

  return {
    id: 'ord_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
    createdAt: new Date().toISOString(),
    status: 'new',
    customer: { name, email, phone, company, notes },
    items: orderItems,
    total,
    currency: 'EUR',
  };
}

function orderRef(order) {
  return String(order.id || '').slice(-8).toUpperCase();
}

function formatOrderDate(value) {
  try {
    return new Date(value).toLocaleString('sq-AL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatOrderText(order) {
  const lines = [
    'ELTEX GROUP — POROSI',
    'Referenca: #' + orderRef(order),
    'Data: ' + formatOrderDate(order.createdAt),
    '',
    'KLIENTI',
    'Emri: ' + order.customer.name,
    'Email: ' + order.customer.email,
    'Telefoni: ' + order.customer.phone,
  ];
  if (order.customer.company) lines.push('Kompania: ' + order.customer.company);
  if (order.customer.notes) lines.push('Shënime: ' + order.customer.notes);
  lines.push('', 'PRODUKTET');
  order.items.forEach((item) => {
    lines.push(
      item.qty +
        ' x ' +
        item.name +
        ' — €' +
        item.price.toFixed(2) +
        ' / copë = €' +
        item.lineTotal.toFixed(2)
    );
  });
  lines.push('', 'TOTALI: €' + order.total.toFixed(2) + ' ' + order.currency);
  return lines.join('\n');
}

function formatOrderHtml(order, options) {
  const opts = options || {};
  const rows = order.items
    .map(
      (item) =>
        '<tr><td style="padding:10px 12px;border-bottom:1px solid #eee">' +
        escapeHtml(item.qty + ' x ' + item.name) +
        '</td><td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap">€' +
        item.lineTotal.toFixed(2) +
        '</td></tr>'
    )
    .join('');

  const intro = opts.intro
    ? '<p style="margin:0 0 18px;line-height:1.6;color:#333">' + opts.intro + '</p>'
    : '';

  return (
    '<!DOCTYPE html><html lang="sq"><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#111;margin:0;padding:24px;background:#f7f7f7">' +
    '<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e8e3df;border-radius:12px;padding:24px">' +
    '<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.08em;color:#f88837">ELTEX GROUP</p>' +
    '<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">' +
    escapeHtml(opts.title || 'Porosi e Reja') +
    '</h1>' +
    intro +
    '<p style="margin:0 0 18px;line-height:1.6"><strong>Referenca:</strong> #' +
    escapeHtml(orderRef(order)) +
    '<br><strong>Data:</strong> ' +
    escapeHtml(formatOrderDate(order.createdAt)) +
    '</p>' +
    '<h2 style="margin:0 0 8px;font-size:15px">Klienti</h2>' +
    '<p style="margin:0 0 18px;line-height:1.6">' +
    '<strong>Emri:</strong> ' +
    escapeHtml(order.customer.name) +
    '<br><strong>Email:</strong> ' +
    escapeHtml(order.customer.email) +
    '<br><strong>Telefoni:</strong> ' +
    escapeHtml(order.customer.phone) +
    (order.customer.company
      ? '<br><strong>Kompania:</strong> ' + escapeHtml(order.customer.company)
      : '') +
    (order.customer.notes
      ? '<br><strong>Shënime:</strong> ' + escapeHtml(order.customer.notes)
      : '') +
    '</p>' +
    '<h2 style="margin:0 0 8px;font-size:15px">Produktet</h2>' +
    '<table style="width:100%;border-collapse:collapse;margin:0 0 18px">' +
    '<thead><tr><th style="padding:10px 12px;text-align:left;border-bottom:2px solid #111">Produkti</th>' +
    '<th style="padding:10px 12px;text-align:right;border-bottom:2px solid #111">Totali</th></tr></thead><tbody>' +
    rows +
    '</tbody></table>' +
    '<p style="margin:0;font-size:18px"><strong>Totali: €' +
    order.total.toFixed(2) +
    '</strong></p>' +
    '</div></body></html>'
  );
}

function formatCustomerOrderText(order) {
  return [
    'Përshëndetje ' + order.customer.name + ',',
    '',
    'Faleminderit për porosinë tuaj te Eltex Group.',
    'Ekipi ynë do t\'ju kontaktojë së shpejti për konfirmim dhe detajet e dorëzimit.',
    '',
    'Referenca e porosisë: #' + orderRef(order),
    'Totali: €' + order.total.toFixed(2),
    '',
    'PRODUKTET',
    ...order.items.map(
      (item) =>
        item.qty + ' x ' + item.name + ' — €' + item.lineTotal.toFixed(2)
    ),
    '',
    'Me respekt,',
    'Eltex Group',
  ].join('\n');
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendOrderEmail(order) {
  if (!mailer || !SMTP_HOST || !ORDER_EMAIL) {
    return { sent: false, reason: 'SMTP not configured' };
  }

  const transporter = mailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  const ref = orderRef(order);
  const adminSubject = 'Porosi e Reja #' + ref + ' — Eltex Group';

  await transporter.sendMail({
    from: SMTP_FROM,
    to: ORDER_EMAIL,
    replyTo: order.customer.email,
    subject: adminSubject,
    text: formatOrderText(order),
    html: formatOrderHtml(order, {
      title: 'Porosi e Reja nga Klienti',
      intro:
        'Keni marrë një porosi të re nga faqja. Detajet e klientit dhe produktet janë më poshtë.',
    }),
  });

  await transporter.sendMail({
    from: SMTP_FROM,
    to: order.customer.email,
    subject: 'Faleminderit! Porosia juaj #' + ref + ' u pranua — Eltex Group',
    text: formatCustomerOrderText(order),
    html: formatOrderHtml(order, {
      title: 'Faleminderit për porosinë tuaj',
      intro:
        'Porosia juaj u pranua me sukses. Ekipi ynë do t\'ju kontaktojë së shpejti për konfirmim dhe detajet e dorëzimit.',
    }),
  });

  return { sent: true };
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.password !== ADMIN_PASSWORD) {
      sendJson(res, 401, { error: 'Fjalëkalimi i gabuar' });
      return;
    }
    const token = crypto.randomBytes(24).toString('hex');
    sessions.set(token, { expires: Date.now() + 24 * 60 * 60 * 1000 });
    sendJson(res, 200, { token });
    return;
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const token = getToken(req);
    if (token) sessions.delete(token);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/orders' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const order = buildOrderFromRequest(body);
      const orders = readOrders();
      orders.unshift(order);
      writeOrders(orders);

      let emailResult = { sent: false };
      try {
        emailResult = await sendOrderEmail(order);
      } catch (emailErr) {
        console.error('Order email failed:', emailErr.message);
        emailResult = { sent: false, reason: emailErr.message };
      }

      sendJson(res, 201, {
        ok: true,
        orderId: order.id,
        orderRef: '#' + orderRef(order),
        emailSent: emailResult.sent,
      });
    } catch (e) {
      sendJson(res, 400, { error: e.message || 'Porosia e pavlefshme' });
    }
    return;
  }

  if (pathname === '/api/me' && req.method === 'GET') {
    sendJson(res, isAuthed(req) ? 200 : 401, { ok: isAuthed(req) });
    return;
  }

  if (!isAuthed(req)) {
    sendJson(res, 401, { error: 'Nuk jeni i kyçur' });
    return;
  }

  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);

  if (pathname === '/api/orders' && req.method === 'GET') {
    sendJson(res, 200, readOrders());
    return;
  }

  if (orderMatch && req.method === 'PATCH') {
    const body = await readBody(req);
    const orders = readOrders();
    const order = orders.find((entry) => entry.id === orderMatch[1]);
    if (!order) {
      sendJson(res, 404, { error: 'Porosia nuk u gjet' });
      return;
    }
    const allowed = ['new', 'processing', 'done', 'cancelled'];
    if (body.status && allowed.includes(body.status)) {
      order.status = body.status;
      order.updatedAt = new Date().toISOString();
    }
    writeOrders(orders);
    sendJson(res, 200, { ok: true, order });
    return;
  }

  if (pathname === '/api/products') {
    if (req.method === 'GET') {
      sendJson(res, 200, readJson(PRODUCTS_PATH));
      return;
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (!Array.isArray(body.products)) {
        sendJson(res, 400, { error: 'products array required' });
        return;
      }
      const slugs = new Set();
      for (const product of body.products) {
        if (!product.name || !String(product.name).trim()) {
          sendJson(res, 400, { error: 'Çdo produkt duhet të ketë emër' });
          return;
        }
        const slug = String(product.slug || slugify(product.name)).trim();
        if (!slug) {
          sendJson(res, 400, { error: 'Çdo produkt duhet të ketë slug' });
          return;
        }
        if (slugs.has(slug)) {
          sendJson(res, 400, { error: 'Slug i përsëritur: ' + slug });
          return;
        }
        slugs.add(slug);
        product.slug = slug;
        product.price = Number(product.price) || 0;
      }
      body.categories = rebuildCategories(body.products);
      writeJson(PRODUCTS_PATH, body);
      sendJson(res, 200, { ok: true, count: body.products.length });
      return;
    }
  }

  if (pathname === '/api/posts') {
    if (req.method === 'GET') {
      sendJson(res, 200, readJson(POSTS_PATH));
      return;
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (!Array.isArray(body)) {
        sendJson(res, 400, { error: 'posts array required' });
        return;
      }
      const slugs = new Set();
      for (const post of body) {
        if (!post.title || !String(post.title).trim()) {
          sendJson(res, 400, { error: 'Çdo artikull duhet të ketë titull' });
          return;
        }
        const slug = String(post.slug || slugify(post.title)).trim();
        if (!slug) {
          sendJson(res, 400, { error: 'Çdo artikull duhet të ketë slug' });
          return;
        }
        if (slugs.has(slug)) {
          sendJson(res, 400, { error: 'Slug i përsëritur: ' + slug });
          return;
        }
        slugs.add(slug);
        post.slug = slug;
      }
      writeJson(POSTS_PATH, body);
      sendJson(res, 200, { ok: true, count: body.length });
      return;
    }
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      sendJson(res, 200, saveUploadedImage(body));
    } catch (e) {
      sendJson(res, 400, { error: e.message || 'Ngarkimi dështoi' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  const clean = getCleanUrlRedirect(pathname);
  if (clean && clean !== pathname) {
    res.writeHead(301, { Location: clean + url.search });
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, pathname);
    } catch (e) {
      sendJson(res, 500, { error: e.message || 'Server error' });
    }
    return;
  }

  if (pathname.startsWith('/media/')) {
    const rel = pathname.replace(/^\/media\//, '');
    if (!rel || rel.includes('..')) {
      send(res, 404, 'Not found');
      return;
    }
    const filePath = path.join(UPLOADS_DIR, rel.replace(/^uploads\//, ''));
    if (!filePath.startsWith(UPLOADS_DIR)) {
      send(res, 403, 'Forbidden');
      return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        send(res, 404, 'Not found');
        return;
      }
      serveFile(res, filePath);
    });
    return;
  }

  const routed = routeRequest(pathname);
  if (routed && routed.redirect) {
    res.writeHead(302, { Location: routed.redirect });
    res.end();
    return;
  }

  let relPath = routed && routed.file ? routed.file : pathname.replace(/^\//, '');
  if (!relPath || relPath.endsWith('/')) relPath += 'index.html';
  if (!path.extname(relPath)) relPath += '.html';

  const filePath = path.join(ROOT, relPath);
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      send(res, 404, 'Not found');
      return;
    }
    const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
    serveFile(res, filePath, isAdmin ? NOINDEX_HEADERS : undefined);
  });
});

server.listen(PORT, () => {
  console.log(`Eltex site + admin → http://localhost:${PORT}`);
  console.log(`Admin portal      → http://localhost:${PORT}/admin`);
  console.log(`Default password  → ${ADMIN_PASSWORD} (set ELTEX_ADMIN_PASSWORD to change)`);
  if (!SMTP_HOST || !ORDER_EMAIL) {
    console.log('Order email       → off (set ELTEX_SMTP_HOST + ELTEX_ORDER_EMAIL to enable)');
  } else {
    console.log('Order email       → ' + ORDER_EMAIL);
  }
});
