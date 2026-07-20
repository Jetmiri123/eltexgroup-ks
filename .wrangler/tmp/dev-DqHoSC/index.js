var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-x7kNkZ/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// functions/lib/eltex-store.js
var KEYS = {
  products: "live-products",
  posts: "live-posts",
  orders: "live-orders"
};
function sessionKey(token) {
  return "session:" + token;
}
__name(sessionKey, "sessionKey");
async function readProducts(env) {
  return await readJson(env, KEYS.products) || { products: [], categories: [] };
}
__name(readProducts, "readProducts");
async function writeProducts(env, data) {
  await writeJson(env, KEYS.products, data);
}
__name(writeProducts, "writeProducts");
async function readPosts(env) {
  const data = await readJson(env, KEYS.posts);
  return Array.isArray(data) ? data : [];
}
__name(readPosts, "readPosts");
async function writePosts(env, data) {
  await writeJson(env, KEYS.posts, data);
}
__name(writePosts, "writePosts");
async function readOrders(env) {
  const data = await readJson(env, KEYS.orders);
  return Array.isArray(data) ? data : [];
}
__name(readOrders, "readOrders");
async function writeOrders(env, data) {
  await writeJson(env, KEYS.orders, data);
}
__name(writeOrders, "writeOrders");
function getKv(env) {
  return env.ELTEX_DATA || env.KV || null;
}
__name(getKv, "getKv");
async function readJson(env, key) {
  const kv = getKv(env);
  if (!kv) return null;
  return kv.get(key, "json");
}
__name(readJson, "readJson");
async function writeJson(env, key, data) {
  const kv = getKv(env);
  if (!kv) throw new Error("Storage not configured");
  await kv.put(key, JSON.stringify(data, null, 2));
}
__name(writeJson, "writeJson");
async function createSession(env, token) {
  const kv = getKv(env);
  if (!kv) return;
  const expires = Date.now() + 24 * 60 * 60 * 1e3;
  await kv.put(sessionKey(token), String(expires), {
    expirationTtl: 86400
  });
}
__name(createSession, "createSession");
async function isAuthed(env, req) {
  const kv = getKv(env);
  const token = getToken(req);
  if (!token || !kv) return false;
  const expires = Number(await kv.get(sessionKey(token)));
  if (!expires || expires < Date.now()) {
    if (expires) await kv.delete(sessionKey(token));
    return false;
  }
  return true;
}
__name(isAuthed, "isAuthed");
async function deleteSession(env, req) {
  const kv = getKv(env);
  const token = getToken(req);
  if (token && kv) await kv.delete(sessionKey(token));
}
__name(deleteSession, "deleteSession");
function getToken(req) {
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7) : "";
}
__name(getToken, "getToken");
async function loadDataWithFallback(env, assetPath, key, request) {
  const kv = await readJson(env, key);
  if (kv) return kv;
  if (env.ASSETS) {
    const assetUrl = new URL(assetPath, request.url);
    const res = await env.ASSETS.fetch(assetUrl.toString());
    if (res.ok) return res.json();
  }
  return null;
}
__name(loadDataWithFallback, "loadDataWithFallback");

// functions/lib/eltex-api.js
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
__name(json, "json");
function slugify(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
__name(slugify, "slugify");
function sanitizeText(value, maxLen) {
  return String(value || "").trim().slice(0, maxLen || 500);
}
__name(sanitizeText, "sanitizeText");
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
__name(isValidEmail, "isValidEmail");
function rebuildCategories(products) {
  const counts = {};
  products.forEach((p) => {
    const cat = p.cat || p.categories && p.categories[0] || "T\xEB Tjera";
    counts[cat] = (counts[cat] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, slug: slugify(name), count }));
}
__name(rebuildCategories, "rebuildCategories");
function findCatalogProduct(catalog, line) {
  const keys = [line.id, line.slug].filter(Boolean).map((value) => String(value).trim());
  for (const key of keys) {
    const lower = key.toLowerCase();
    const product = catalog.find(
      (p) => String(p.id) === key || p.slug === key || String(p.slug || "").toLowerCase() === lower
    );
    if (product) return product;
  }
  return null;
}
__name(findCatalogProduct, "findCatalogProduct");
function orderRef(order) {
  return String(order.id || "").slice(-8).toUpperCase();
}
__name(orderRef, "orderRef");
function randomToken(bytes = 24) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
__name(randomToken, "randomToken");
function randomOrderId() {
  const arr = new Uint8Array(3);
  crypto.getRandomValues(arr);
  const hex = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
  return "ord_" + Date.now().toString(36) + hex;
}
__name(randomOrderId, "randomOrderId");
async function buildOrderFromRequest(env, body) {
  const customer = body.customer || {};
  const name = sanitizeText(customer.name, 120);
  const email = sanitizeText(customer.email, 160).toLowerCase();
  const phone = sanitizeText(customer.phone, 40);
  const company = sanitizeText(customer.company, 120);
  const notes = sanitizeText(customer.notes, 2e3);
  if (!name) throw new Error("Emri \xEBsht\xEB i detyruesh\xEBm");
  if (!isValidEmail(email)) throw new Error("Email i pavlefsh\xEBm");
  if (!phone) throw new Error("Telefoni \xEBsht\xEB i detyruesh\xEBm");
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) throw new Error("Shporta \xEBsht\xEB bosh");
  const catalog = (await readProducts(env)).products || [];
  const orderItems = [];
  let total = 0;
  rawItems.forEach((line) => {
    const product = findCatalogProduct(catalog, line);
    const ref = String(line.slug || line.id || "").trim();
    if (!product) throw new Error("Nj\xEB produkt n\xEB shport\xEB nuk u gjet: " + ref);
    const qty = Math.max(1, Math.min(999, Number(line.qty) || 1));
    const price = Number(product.price) || 0;
    const lineTotal = Math.round(price * qty * 100) / 100;
    orderItems.push({
      id: String(product.id),
      slug: product.slug || "",
      name: product.name || "",
      cat: product.cat || product.categories && product.categories[0] || "",
      price,
      qty,
      lineTotal
    });
    total += lineTotal;
  });
  return {
    id: randomOrderId(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    status: "new",
    customer: { name, email, phone, company, notes },
    items: orderItems,
    total: Math.round(total * 100) / 100,
    currency: "EUR"
  };
}
__name(buildOrderFromRequest, "buildOrderFromRequest");
async function sendOrderEmail(env, order) {
  const apiKey = env.RESEND_API_KEY;
  const orderEmail = env.ELTEX_ORDER_EMAIL;
  if (!apiKey || !orderEmail) return { sent: false, reason: "Email not configured" };
  const ref = orderRef(order);
  const from = env.ELTEX_EMAIL_FROM || "orders@eltexgroup-ks.com";
  const lines = order.items.map((i) => `${i.qty} x ${i.name} \u2014 \u20AC${i.lineTotal.toFixed(2)}`).join("\n");
  const payload = {
    from,
    to: [orderEmail],
    reply_to: order.customer.email,
    subject: `Porosi e Reja #${ref} \u2014 Eltex Group`,
    text: `Porosi e re

Klienti: ${order.customer.name}
Email: ${order.customer.email}
Telefon: ${order.customer.phone}

${lines}

Totali: \u20AC${order.total.toFixed(2)}`
  };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.text();
    return { sent: false, reason: err };
  }
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [order.customer.email],
      subject: `Faleminderit! Porosia juaj #${ref} u pranua \u2014 Eltex Group`,
      text: `P\xEBrsh\xEBndetje ${order.customer.name},

Faleminderit p\xEBr porosin\xEB tuaj. Referenca: #${ref}
Totali: \u20AC${order.total.toFixed(2)}

Me respekt,
Eltex Group`
    })
  });
  return { sent: true };
}
__name(sendOrderEmail, "sendOrderEmail");
async function handleApiRequest(context) {
  const { request, env, params } = context;
  const segments = (params.path || []).filter(Boolean);
  const pathname = "/api/" + segments.join("/");
  const method = request.method;
  let body = {};
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }
  const adminPassword = env.ELTEX_ADMIN_PASSWORD || "admin";
  if (pathname === "/api/login" && method === "POST") {
    if (body.password !== adminPassword) return json({ error: "Fjal\xEBkalimi i gabuar" }, 401);
    const token = randomToken();
    await createSession(env, token);
    return json({ token });
  }
  if (pathname === "/api/logout" && method === "POST") {
    await deleteSession(env, request);
    return json({ ok: true });
  }
  if (pathname === "/api/orders" && method === "POST") {
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
          orderRef: "#" + orderRef(order),
          emailSent: emailResult.sent
        },
        201
      );
    } catch (e) {
      return json({ error: e.message || "Porosia e pavlefshme" }, 400);
    }
  }
  if (pathname === "/api/me" && method === "GET") {
    const ok = await isAuthed(env, request);
    return json({ ok }, ok ? 200 : 401);
  }
  if (!await isAuthed(env, request)) {
    return json({ error: "Nuk jeni i ky\xE7ur" }, 401);
  }
  const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
  if (pathname === "/api/orders" && method === "GET") {
    return json(await readOrders(env));
  }
  if (orderMatch && method === "PATCH") {
    const orders = await readOrders(env);
    const order = orders.find((entry) => entry.id === orderMatch[1]);
    if (!order) return json({ error: "Porosia nuk u gjet" }, 404);
    const allowed = ["new", "processing", "done", "cancelled"];
    if (body.status && allowed.includes(body.status)) {
      order.status = body.status;
      order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    await writeOrders(env, orders);
    return json({ ok: true, order });
  }
  if (pathname === "/api/products") {
    if (method === "GET") return json(await readProducts(env));
    if (method === "PUT") {
      if (!Array.isArray(body.products)) return json({ error: "products array required" }, 400);
      const slugs = /* @__PURE__ */ new Set();
      for (const product of body.products) {
        if (!product.name || !String(product.name).trim()) {
          return json({ error: "\xC7do produkt duhet t\xEB ket\xEB em\xEBr" }, 400);
        }
        const slug = String(product.slug || slugify(product.name)).trim();
        if (!slug) return json({ error: "\xC7do produkt duhet t\xEB ket\xEB slug" }, 400);
        if (slugs.has(slug)) return json({ error: "Slug i p\xEBrs\xEBritur: " + slug }, 400);
        slugs.add(slug);
        product.slug = slug;
        product.price = Number(product.price) || 0;
      }
      body.categories = rebuildCategories(body.products);
      await writeProducts(env, body);
      return json({ ok: true, count: body.products.length });
    }
  }
  if (pathname === "/api/posts") {
    if (method === "GET") return json(await readPosts(env));
    if (method === "PUT") {
      if (!Array.isArray(body)) return json({ error: "posts array required" }, 400);
      const slugs = /* @__PURE__ */ new Set();
      for (const post of body) {
        if (!post.title || !String(post.title).trim()) {
          return json({ error: "\xC7do artikull duhet t\xEB ket\xEB titull" }, 400);
        }
        const slug = String(post.slug || slugify(post.title)).trim();
        if (!slug) return json({ error: "\xC7do artikull duhet t\xEB ket\xEB slug" }, 400);
        if (slugs.has(slug)) return json({ error: "Slug i p\xEBrs\xEBritur: " + slug }, 400);
        slugs.add(slug);
        post.slug = slug;
      }
      await writePosts(env, body);
      return json({ ok: true, count: body.length });
    }
  }
  return json({ error: "Not found" }, 404);
}
__name(handleApiRequest, "handleApiRequest");

// functions/lib/eltex-data.js
var FILE_MAP = {
  "live-products.json": KEYS.products,
  "live-posts.json": KEYS.posts,
  "live-orders.json": KEYS.orders,
  "live-site-manifest.json": "live-site-manifest"
};
async function handleDataRequest({ request, env, filename }) {
  if (!FILE_MAP[filename]) {
    return env.ASSETS.fetch(request);
  }
  const data = await loadDataWithFallback(
    env,
    "/data/" + filename,
    FILE_MAP[filename],
    request
  );
  if (data === null) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(JSON.stringify(data, null, 2) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": filename.includes("orders") ? "no-store" : "public, max-age=60"
    }
  });
}
__name(handleDataRequest, "handleDataRequest");

// worker/index.js
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith("/api/")) {
      const segments = path.slice(5).split("/").filter(Boolean);
      return handleApiRequest({ request, env, params: { path: segments } });
    }
    if (path.startsWith("/data/")) {
      return handleDataRequest({ request, env, filename: path.slice(6) });
    }
    if (path === "/produkt" || path === "/produkt/") {
      return Response.redirect(new URL("/produkte.html", url), 301);
    }
    const productMatch = path.match(/^\/produkt\/([^/]+)\/?$/);
    if (productMatch) {
      return env.ASSETS.fetch(new URL("/produkt.html", url));
    }
    const blogMatch = path.match(/^\/blog\/([^/]+)\/?$/);
    if (blogMatch) {
      return env.ASSETS.fetch(new URL("/blog-post.html", url));
    }
    if (path === "/admin" || path === "/admin/") {
      return env.ASSETS.fetch(new URL("/admin/index.html", url));
    }
    return env.ASSETS.fetch(request);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-x7kNkZ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-x7kNkZ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
