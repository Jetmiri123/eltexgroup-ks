(function () {
  const STORAGE_KEY = 'eltex_cart';
  const CART_VERSION_KEY = 'eltex_cart_version';
  const CART_VERSION = 2;

  function readCart() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    localStorage.setItem(CART_VERSION_KEY, String(CART_VERSION));
    updateBadge(items);
    document.dispatchEvent(new CustomEvent('eltex-cart-updated', { detail: items }));
  }

  function updateBadge(items) {
    const count = items.reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = String(count);
      el.classList.toggle('is-visible', count > 0);
      el.setAttribute('aria-hidden', count > 0 ? 'false' : 'true');
    });
  }

  function sameItem(a, b) {
    const aId = String(a.id || a.slug || '').toLowerCase();
    const bId = String(b.id || b.slug || '').toLowerCase();
    return aId && bId && aId === bId;
  }

  function sameItemId(item, productId) {
    const key = String(productId || '').toLowerCase();
    return (
      String(item.id || '').toLowerCase() === key ||
      String(item.slug || '').toLowerCase() === key
    );
  }

  function normalizeCartProduct(product) {
    return {
      id: String(product.id),
      slug: product.slug || String(product.id),
      name: product.name,
      price: Number(product.price) || 0,
      img: product.img || product.image || 'images/Placeholder.jpg',
      cat: product.cat || '',
    };
  }

  function addItem(product) {
    const entry = normalizeCartProduct(product);
    const cart = readCart();
    const existing = cart.find((item) => sameItem(item, entry));

    if (existing) {
      existing.qty += 1;
      Object.assign(existing, entry, { qty: existing.qty });
    } else {
      cart.push({ ...entry, qty: 1 });
    }

    writeCart(cart);
    showToast('Produkti u shtua në shportë');
    return cart;
  }

  function removeItem(productId) {
    const cart = readCart().filter((item) => !sameItemId(item, productId));
    writeCart(cart);
    return cart;
  }

  function findInCatalog(catalog, item) {
    const keys = [item.id, item.slug]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());

    return catalog.find((product) => {
      const productId = String(product.id || '').trim().toLowerCase();
      const productSlug = String(product.slug || '').trim().toLowerCase();
      return keys.some((key) => key === productId || key === productSlug);
    });
  }

  function syncWithCatalog(catalog) {
    const cart = readCart();
    if (!cart.length) return { removed: [], cart: [] };

    const next = [];
    const removed = [];

    cart.forEach((item) => {
      const product = findInCatalog(catalog, item);
      if (!product) {
        removed.push(item.name || item.slug || item.id);
        return;
      }

      next.push({ ...normalizeCartProduct(product), qty: Math.max(1, Number(item.qty) || 1) });
    });

    const changed =
      removed.length > 0 ||
      next.length !== cart.length ||
      next.some((item, index) => !sameItem(item, cart[index]) || item.price !== cart[index].price);

    if (changed) writeCart(next);
    return { removed, cart: next };
  }

  function clearCart() {
    writeCart([]);
    return [];
  }

  function updateQty(productId, qty) {
    const cart = readCart();
    const item = cart.find((entry) => sameItemId(entry, productId));
    if (!item) return cart;

    if (qty <= 0) {
      return removeItem(productId);
    }

    item.qty = qty;
    writeCart(cart);
    return cart;
  }

  function showToast(message) {
    let toast = document.querySelector('.cart-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'cart-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  async function loadCatalog() {
    if (window.EltexProducts) {
      return window.EltexProducts.loadProducts();
    }

    const res = await fetch('/data/live-products.json');
    if (!res.ok) throw new Error('catalog unavailable');
    const data = await res.json();
    return (data.products || []).map((raw) => ({
      id: String(raw.id || raw.slug),
      slug: raw.slug || String(raw.id),
      name: raw.name,
      price: Number(raw.price) || 0,
      img: raw.image || raw.img || 'images/Placeholder.jpg',
      cat: raw.cat || '',
    }));
  }

  async function syncFromCatalog(options) {
    const silent = !(options && options.notify);

    try {
      const products = await loadCatalog();
      const result = syncWithCatalog(products);
      if (result.removed.length && !silent) {
        showToast('Shporta u përditësua — produkte të vjetra u hoqën.');
      }
      return result;
    } catch {
      return { removed: [], cart: readCart() };
    }
  }

  window.EltexCart = {
    read: readCart,
    add: addItem,
    remove: removeItem,
    updateQty,
    clear: clearCart,
    syncWithCatalog,
    syncFromCatalog,
    count: () => readCart().reduce((sum, item) => sum + item.qty, 0),
    init: () => updateBadge(readCart()),
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateBadge(readCart());
    syncFromCatalog({ notify: false });
  });
})();
