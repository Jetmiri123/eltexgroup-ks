(function () {
  const STORAGE_KEY = 'eltex_cart';
  const CART_VERSION_KEY = 'eltex_cart_version';
  const CART_VERSION = 3;

  function cartLineKey(item) {
    if (window.EltexProducts && window.EltexProducts.cartLineKey) {
      return window.EltexProducts.cartLineKey(item);
    }
    const id = String(item.id || item.slug || '');
    const variant = String(item.variant || '');
    return variant ? id + '::' + variant : id;
  }

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
    const aVariant = String(a.variant || '');
    const bVariant = String(b.variant || '');
    return aId && bId && aId === bId && aVariant === bVariant;
  }

  function findCartItem(cart, key) {
    return cart.find((item) => cartLineKey(item) === key);
  }

  function normalizeCartProduct(product) {
    const entry = {
      id: String(product.id),
      slug: product.slug || String(product.id),
      name: product.name,
      price: Number(product.price) || 0,
      img: product.img || product.image || 'images/Placeholder.jpg',
      cat: product.cat || '',
    };

    if (product.variant) {
      entry.variant = product.variant;
      entry.variantLabel = product.variantLabel || product.variant;
      entry.variantAttribute = product.variantAttribute || '';
      if (product.variantKod) entry.variantKod = product.variantKod;
    }

    return entry;
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

  function removeItem(cartKey) {
    const cart = readCart().filter((item) => cartLineKey(item) !== cartKey);
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

      const synced = {
        ...normalizeCartProduct(product),
        qty: Math.max(1, Number(item.qty) || 1),
      };

      if (item.variant) {
        synced.variant = item.variant;
        synced.variantLabel = item.variantLabel || item.variant;
        synced.variantAttribute = item.variantAttribute || '';
        if (item.variantKod) synced.variantKod = item.variantKod;
        synced.name = product.name + ' — ' + synced.variantLabel;
      }

      next.push(synced);
    });

    const changed =
      removed.length > 0 ||
      next.length !== cart.length ||
      next.some(
        (item, index) =>
          cartLineKey(item) !== cartLineKey(cart[index]) ||
          item.price !== cart[index].price ||
          item.name !== cart[index].name
      );

    if (changed) writeCart(next);
    return { removed, cart: next };
  }

  function clearCart() {
    writeCart([]);
    return [];
  }

  function updateQty(cartKey, qty) {
    const cart = readCart();
    const item = findCartItem(cart, cartKey);
    if (!item) return cart;

    if (qty <= 0) {
      return removeItem(cartKey);
    }

    item.qty = Math.max(1, Math.min(999, qty));
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
    cartLineKey,
    count: () => readCart().reduce((sum, item) => sum + item.qty, 0),
    init: () => updateBadge(readCart()),
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateBadge(readCart());
    syncFromCatalog({ notify: false });
  });
})();
