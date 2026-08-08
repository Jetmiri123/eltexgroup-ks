(function (root) {
  function decodeHtml(text) {
    const el = document.createElement('textarea');
    el.innerHTML = text || '';
    return el.value;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(value) {
    return '€' + Number(value || 0).toFixed(2);
  }

  function canViewPrices() {
    const auth = root.EltexAuth;
    if (!auth || typeof auth.cachedUser !== 'function') return false;
    const user = auth.cachedUser();
    return !!(user && user.status === 'approved');
  }

  function priceGateHtml(label) {
    const text = label || 'Kyçu për të parë çmimin';
    return '<a href="/llogaria" class="price-gate-link">' + escapeHtml(text) + '</a>';
  }

  function getVariantPrice(product, variantValue) {
    const map = product.variant_prices || {};
    if (variantValue != null && Object.prototype.hasOwnProperty.call(map, variantValue)) {
      return Number(map[variantValue]) || 0;
    }
    return Number(product.price) || 0;
  }

  function getProductPriceSummary(product) {
    const config = parseProductVariants(product);
    if (!config || !config.variants.length) {
      return { type: 'single', price: Number(product.price) || 0 };
    }
    const prices = config.variants.map((variant) => getVariantPrice(product, variant.value));
    const min = Math.min.apply(null, prices);
    const max = Math.max.apply(null, prices);
    if (min === max) return { type: 'single', price: min };
    return { type: 'range', min, max };
  }

  function renderProductPrice(product, opts) {
    const options = opts || {};
    if (!canViewPrices()) {
      return priceGateHtml(options.gateLabel);
    }
    const summary = getProductPriceSummary(product);
    if (summary.type === 'range') {
      if (options.style === 'from') {
        return '<span class="price-current">nga ' + formatPrice(summary.min) + '</span>';
      }
      return (
        '<span class="price-current">' +
        formatPrice(summary.min) +
        ' – ' +
        formatPrice(summary.max) +
        '</span>'
      );
    }
    return '<span class="price-current">' + formatPrice(summary.price) + '</span>';
  }

  function renderVariantPrice(product, variantValue) {
    if (!canViewPrices()) return priceGateHtml();
    return formatPrice(getVariantPrice(product, variantValue));
  }

  function productUrl(product) {
    const slug = product.slug || product.id;
    return '/produkt/' + encodeURIComponent(slug);
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

  function categoryFilterUrl(cat) {
    const slug = slugify(cat || '');
    return slug ? '/produkte?cat=' + encodeURIComponent(slug) : '/produkte';
  }

  function renderCategoryBadge(cat, options) {
    const opts = options || {};
    const label = decodeHtml(cat || 'Të Tjera');
    if (!label) return '';

    const linked = opts.linked !== false;
    const valueHtml = linked
      ? `<a href="${categoryFilterUrl(label)}" class="product-category-value">${escapeHtml(label)}</a>`
      : `<span class="product-category-value">${escapeHtml(label)}</span>`;

    const prefix = opts.showLabel === false
      ? ''
      : '<span class="product-category-label">Kategoria</span>';

    return `<div class="product-category-badge${opts.detail ? ' product-category-badge--detail' : ''}">${prefix}${valueHtml}</div>`;
  }

  function getProductParams(location) {
    const loc = location || window.location;
    const params = new URLSearchParams(loc.search);
    if (params.get('slug') || params.get('id')) return params;

    const match = loc.pathname.match(/\/produkt(?:\.html)?\/([^/?#]+)/);
    if (match) {
      const next = new URLSearchParams();
      next.set('slug', decodeURIComponent(match[1]));
      return next;
    }
    return params;
  }

  function normalizeProduct(raw) {
    const images = raw.images && raw.images.length ? raw.images : raw.image ? [raw.image] : [];
    return {
      id: String(raw.id || raw.slug),
      slug: raw.slug || String(raw.id),
      name: decodeHtml(raw.name),
      cat: decodeHtml(raw.cat || (raw.categories && raw.categories[0]) || 'Të Tjera'),
      categories: (raw.categories || []).map(decodeHtml),
      price: Number(raw.price) || 0,
      currency: raw.currency || 'EUR',
      img: images[0] || raw.image || raw.img || 'images/Placeholder.jpg',
      images,
      permalink: raw.permalink || '',
      short_description: decodeHtml(raw.short_description || ''),
      description: decodeHtml(raw.description || raw.short_description || ''),
      short_description_html: decodeHtml(raw.short_description_html || ''),
      description_html: decodeHtml(raw.description_html || raw.short_description_html || ''),
      attributes: raw.attributes || [],
      variant_prices: raw.variant_prices && typeof raw.variant_prices === 'object' ? raw.variant_prices : {},
      sku: raw.sku || '',
      in_stock: raw.in_stock !== false,
    };
  }

  function splitAttributeValues(value) {
    return String(value || '')
      .split(/,\s*/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function parseProductVariants(product) {
    const attrs = (product.attributes || [])
      .filter((attr) => attr.name && attr.value)
      .map((attr) => ({
        name: String(attr.name).trim(),
        values: splitAttributeValues(attr.value),
      }))
      .filter((attr) => attr.values.length >= 2);

    if (!attrs.length) return null;

    const priority = [
      /seksioni|vrima|bulonit|papuç|papuqe|madh/i,
      /modeli|tipi|dimension/i,
      /diametri|diameter|montimit/i,
      /^kodi$/i,
      /kodi/i,
    ];

    let primary = attrs[0];
    priority.some((pattern) => {
      const match = attrs.find((attr) => pattern.test(attr.name));
      if (match) {
        primary = match;
        return true;
      }
      return false;
    });

    const kodAttrRaw = (product.attributes || []).find((attr) => {
      const name = String(attr && attr.name ? attr.name : '').trim();
      if (!name || name === primary.name) return false;
      return /^kodi$/i.test(name) || /kodi/i.test(name);
    });
    // Keep empty slots so codes stay aligned with variant values.
    const kodValues = kodAttrRaw
      ? String(kodAttrRaw.value || '')
          .split(',')
          .map((entry) => entry.trim())
      : [];

    const variants = primary.values.map((value, index) => ({
      value,
      label: value,
      kod: kodValues[index] || '',
      index,
      price: getVariantPrice(product, value),
    }));

    return {
      attributeName: primary.name,
      attributeNames: attrs.map((attr) => attr.name),
      variants,
    };
  }

  function cartLineKey(item) {
    const id = String(item.id || item.slug || '');
    const variant = String(item.variant || '');
    return variant ? id + '::' + variant : id;
  }

  function cartPayload(product, variantSelection) {
    const payload = {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      img: product.img,
      cat: product.cat,
    };

    if (variantSelection) {
      payload.variant = variantSelection.value;
      payload.variantLabel = variantSelection.label || variantSelection.value;
      payload.variantAttribute = variantSelection.attributeName || '';
      if (variantSelection.kod) payload.variantKod = variantSelection.kod;
      payload.price = getVariantPrice(product, variantSelection.value);
      payload.name = product.name + ' — ' + payload.variantLabel;
    }

    return payload;
  }

  function loadProducts() {
    return fetch('/data/live-products.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => (data.products || []).map(normalizeProduct));
  }

  function findProduct(products, params) {
    const slug = params.get('slug');
    const id = params.get('id');
    if (slug) {
      return products.find((p) => p.slug === slug);
    }
    if (id) {
      return products.find((p) => p.id === id || p.slug === id);
    }
    return null;
  }

  function plainTextToRichHtml(text) {
    if (!text) return '';
    if (/<[^>]+>/.test(text)) return text;

    const lines = String(text).split('\n').map((line) => line.trim());
    const parts = [];
    let index = 0;

    while (index < lines.length) {
      while (index < lines.length && !lines[index]) index += 1;
      if (index >= lines.length) break;

      if (/^[•\-–*]\s/.test(lines[index])) {
        const items = [];
        while (index < lines.length) {
          while (index < lines.length && !lines[index]) index += 1;
          if (index >= lines.length || !/^[•\-–*]\s/.test(lines[index])) break;
          items.push(lines[index].replace(/^[•\-–*]\s*/, ''));
          index += 1;
        }
        parts.push(
          '<ul>' +
            items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') +
            '</ul>'
        );
        continue;
      }

      const paragraph = [];
      while (index < lines.length && lines[index] && !/^[•\-–*]\s/.test(lines[index])) {
        paragraph.push(lines[index]);
        index += 1;
      }
      parts.push('<p>' + escapeHtml(paragraph.join(' ')) + '</p>');
    }

    return parts.join('');
  }

  function formatRichContent(html, plain) {
    if (html && /<[^>]+>/.test(html)) return html;
    if (plain && /<[^>]+>/.test(plain)) return plain;
    return plainTextToRichHtml(plain || '');
  }

  root.EltexProducts = {
    decodeHtml,
    escapeHtml,
    formatPrice,
    canViewPrices,
    priceGateHtml,
    getVariantPrice,
    getProductPriceSummary,
    renderProductPrice,
    renderVariantPrice,
    productUrl,
    slugify,
    categoryFilterUrl,
    renderCategoryBadge,
    getProductParams,
    normalizeProduct,
    splitAttributeValues,
    parseProductVariants,
    cartLineKey,
    cartPayload,
    loadProducts,
    findProduct,
    plainTextToRichHtml,
    formatRichContent,
  };
})(window);
