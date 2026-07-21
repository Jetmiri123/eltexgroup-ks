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

  function productUrl(product) {
    const slug = product.slug || product.id;
    return '/produkt/' + encodeURIComponent(slug);
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
      sku: raw.sku || '',
      in_stock: raw.in_stock !== false,
    };
  }

  function cartPayload(product) {
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      img: product.img,
      cat: product.cat,
    };
  }

  function loadProducts() {
    return fetch('/data/live-products.json')
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
    formatPrice,
    productUrl,
    getProductParams,
    normalizeProduct,
    cartPayload,
    loadProducts,
    findProduct,
    plainTextToRichHtml,
    formatRichContent,
  };
})(window);
