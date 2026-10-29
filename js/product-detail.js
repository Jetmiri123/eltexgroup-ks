(function () {
  const {
    loadProducts,
    findProduct,
    formatPrice,
    productUrl,
    cartPayload,
    getProductParams,
    formatRichContent,
    categoryFilterUrl,
    escapeHtml,
    parseProductVariants,
    getProductKod,
    sortCatalogProducts,
    getVariantPrice,
    renderProductPrice,
    canViewPrices,
    isNewProduct,
    renderCatalogCard,
  } = window.EltexProducts;

  const params = getProductParams();
  const notFound = document.getElementById('product-not-found');
  const detail = document.getElementById('product-detail');
  const relatedGrid = document.getElementById('product-related');
  const addBtn = document.getElementById('product-add-cart');
  const addLabel = document.getElementById('product-add-cart-label');
  const gallery = document.getElementById('product-gallery');
  const specsBlock = document.getElementById('product-specs');
  const specsTable = document.getElementById('product-specs-table');
  const specsTableFull = document.getElementById('product-specs-table-full');
  const specsEmpty = document.getElementById('product-specs-empty');
  const descriptionWrap = document.getElementById('product-description-wrap');
  const variantsEl = document.getElementById('product-variants');
  const mainImage = document.getElementById('product-image');
  const qtyInput = document.getElementById('product-qty-input');
  const qtyMinus = document.getElementById('product-qty-minus');
  const qtyPlus = document.getElementById('product-qty-plus');
  const galleryPrev = document.getElementById('product-gallery-prev');
  const galleryNext = document.getElementById('product-gallery-next');
  const quoteLink = document.getElementById('product-quote');

  let currentProduct = null;
  let variantConfig = null;
  let selectedVariant = null;
  let galleryImages = [];
  let galleryIndex = 0;
  let allProducts = [];

  const COLOR_MAP = [
    { re: /kuq|red/i, color: '#e53935' },
    { re: /verdh|yellow|gold/i, color: '#f5b400' },
    { re: /gjelb|green/i, color: '#2e7d32' },
    { re: /kalt|blue/i, color: '#1e88e5' },
    { re: /zez|black/i, color: '#222222' },
    { re: /bardh|white/i, color: '#f4f4f4' },
    { re: /portokall|orange/i, color: '#f88837' },
    { re: /gri|gray|grey/i, color: '#9e9e9e' },
    { re: /kafe|brown/i, color: '#6d4c41' },
    { re: /vjollc|purple|violet/i, color: '#8e24aa' },
  ];

  function normalizeQty(value) {
    const qty = parseInt(String(value == null ? 1 : value).trim(), 10);
    if (!Number.isFinite(qty) || qty < 1) return 1;
    return Math.min(999, qty);
  }

  function getSelectedQty() {
    return normalizeQty(qtyInput ? qtyInput.value : 1);
  }

  function setSelectedQty(value) {
    if (!qtyInput) return;
    qtyInput.value = String(normalizeQty(value));
  }

  function stripHtml(html) {
    return String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function renderDescriptionHtml(product) {
    const fullHtml = formatRichContent(product.description_html, product.description);
    const shortHtml = formatRichContent(product.short_description_html, product.short_description);
    if (fullHtml && stripHtml(fullHtml) !== stripHtml(shortHtml)) {
      return fullHtml;
    }
    return shortHtml || fullHtml;
  }

  function renderSummaryHtml(product) {
    return formatRichContent(product.short_description_html, product.short_description);
  }

  function variantColor(label) {
    const hit = COLOR_MAP.find((entry) => entry.re.test(String(label || '')));
    return hit ? hit.color : '';
  }

  function isColorAttribute(name, variants) {
    if (/ngjyr|color/i.test(String(name || ''))) return true;
    const colored = variants.filter((variant) => variantColor(variant.label || variant.value)).length;
    return colored >= 2 && colored / variants.length >= 0.5;
  }

  function setGalleryIndex(index) {
    if (!galleryImages.length) return;
    galleryIndex = (index + galleryImages.length) % galleryImages.length;
    mainImage.src = galleryImages[galleryIndex];
    gallery.querySelectorAll('.product-gallery-thumb').forEach((el, i) => {
      el.classList.toggle('is-active', i === galleryIndex);
    });
  }

  function renderGallery(product) {
    galleryImages = (product.images && product.images.length ? product.images : [product.img]).filter(Boolean);
    galleryIndex = 0;
    const hasMany = galleryImages.length > 1;

    if (galleryPrev) galleryPrev.hidden = !hasMany;
    if (galleryNext) galleryNext.hidden = !hasMany;

    if (!hasMany) {
      gallery.hidden = true;
      gallery.innerHTML = '';
      return;
    }

    gallery.hidden = false;
    gallery.innerHTML = galleryImages
      .map(
        (src, i) =>
          '<button type="button" class="product-gallery-thumb' +
          (i === 0 ? ' is-active' : '') +
          '" data-index="' +
          i +
          '" aria-label="Foto ' +
          (i + 1) +
          '"><img src="' +
          escapeHtml(src) +
          '" alt=""></button>'
      )
      .join('');

    gallery.querySelectorAll('[data-index]').forEach((btn) => {
      btn.addEventListener('click', () => setGalleryIndex(Number(btn.dataset.index)));
    });
  }

  function setAddLabel(text) {
    if (addLabel) addLabel.textContent = text;
    else if (addBtn) addBtn.textContent = text;
  }

  function updateAddButton() {
    if (!addBtn || !currentProduct) return;

    if (!canViewPrices()) {
      addBtn.disabled = false;
      setAddLabel('Kyçu për çmime');
      return;
    }

    if (currentProduct.in_stock === false) {
      addBtn.disabled = true;
      setAddLabel('Nuk ka stok');
      return;
    }

    if (variantConfig && !selectedVariant) {
      addBtn.disabled = true;
      setAddLabel('Zgjidhni variantin');
      return;
    }

    addBtn.disabled = false;
    setAddLabel('Shto në shportë');
  }

  function updateVariantSpecRow() {
    const row = document.getElementById('product-variant-spec-row');
    const rowFull = document.getElementById('product-variant-spec-row-full');
    [row, rowFull].forEach((el) => {
      if (!el) return;
      if (selectedVariant && variantConfig) {
        const kodHtml = selectedVariant.kod
          ? ' <span class="product-variant-kod">(' + escapeHtml(selectedVariant.kod) + ')</span>'
          : '';
        el.innerHTML =
          '<th>' +
          escapeHtml(variantConfig.attributeName) +
          '</th><td>' +
          escapeHtml(selectedVariant.label) +
          kodHtml +
          '</td>';
        el.hidden = false;
        return;
      }
      el.hidden = true;
      el.innerHTML = '';
    });
  }

  function updatePriceDisplay() {
    const priceEl = document.getElementById('product-price');
    if (!priceEl || !currentProduct) return;

    if (!canViewPrices()) {
      priceEl.innerHTML = renderProductPrice(currentProduct);
      return;
    }

    const amount = selectedVariant
      ? formatPrice(getVariantPrice(currentProduct, selectedVariant.value))
      : renderProductPrice(currentProduct, { style: 'from' });

    priceEl.innerHTML = amount + '<span class="price-unit"> / copë</span>';
  }

  function onVariantSelected() {
    updateVariantSpecRow();
    updatePriceDisplay();
    updateAddButton();
  }

  function selectVariant(variant, attributeName) {
    selectedVariant = variant ? { ...variant, attributeName } : null;
    if (!variantsEl) return;
    variantsEl.querySelectorAll('.product-variant-option').forEach((el) => {
      const isSelected = selectedVariant && el.dataset.variantValue === selectedVariant.value;
      el.classList.toggle('is-selected', isSelected);
      el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
    onVariantSelected();
  }

  function renderVariants(product) {
    variantConfig = parseProductVariants(product);
    selectedVariant = null;

    if (!variantsEl) return;

    const kod = getProductKod(product);
    if (!variantConfig || !variantConfig.variants.length) {
      if (kod) {
        variantsEl.hidden = false;
        variantsEl.innerHTML =
          '<span class="product-variants-label">Kodi i produktit:</span>' +
          '<div class="product-sku-value">' +
          escapeHtml(kod) +
          '</div>';
      } else {
        variantsEl.hidden = true;
        variantsEl.innerHTML = '';
      }
      updateAddButton();
      updateVariantSpecRow();
      return;
    }

    const { attributeName, variants } = variantConfig;
    const asColors = isColorAttribute(attributeName, variants);

    variantsEl.hidden = false;
    variantsEl.innerHTML =
      '<span class="product-variants-label">Kodi i produktit:</span>' +
      '<div class="product-variant-options' +
      (asColors ? ' product-variant-options--swatches' : '') +
      '" role="listbox" aria-label="' +
      escapeHtml(attributeName) +
      '">' +
      variants
        .map((variant) => {
          const color = asColors ? variantColor(variant.label) : '';
          const kodText = variant.kod || variant.label;
          const nameText = variant.kod ? variant.label : '';
          return (
            '<button type="button" class="product-variant-option' +
            (asColors ? ' product-variant-option--swatch' : '') +
            '" data-variant-value="' +
            escapeHtml(variant.value) +
            '" role="option" aria-selected="false">' +
            (color
              ? '<span class="product-swatch-dot" style="background:' +
                color +
                '"></span>'
              : '') +
            '<span class="product-swatch-text">' +
            '<span class="variant-option-kod">' +
            escapeHtml(kodText) +
            '</span>' +
            (nameText
              ? '<span class="variant-option-label">(' + escapeHtml(nameText) + ')</span>'
              : '') +
            '</span></button>'
          );
        })
        .join('') +
      '</div>';

    variantsEl.querySelectorAll('.product-variant-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const match = variants.find((variant) => variant.value === btn.dataset.variantValue);
        selectVariant(match, attributeName);
      });
    });

    selectVariant(variants[0], attributeName);
  }

  function specRowsHtml(product) {
    const config = parseProductVariants(product);
    const variantAttrNames = config ? config.attributeNames : [];
    const rows = (product.attributes || []).filter((attr) => {
      if (!attr.name || !attr.value) return false;
      return !variantAttrNames.includes(String(attr.name).trim());
    });
    const productKod = getProductKod(product);
    const specRows = rows.filter((row) => !/^kodi$/i.test(String(row.name || '').trim()));
    const html = [];

    if (product.cat) {
      html.push(
        '<tr><th>Kategoria</th><td><a href="' +
          categoryFilterUrl(product.cat) +
          '" class="product-category-link">' +
          escapeHtml(product.cat) +
          '</a></td></tr>'
      );
    }
    if (productKod && !config) {
      html.push('<tr><th>Kodi</th><td>' + escapeHtml(productKod) + '</td></tr>');
    }
    if (config) {
      html.push('<tr id="product-variant-spec-row" hidden></tr>');
    }
    specRows.forEach((row) => {
      html.push('<tr><th>' + escapeHtml(row.name) + '</th><td>' + escapeHtml(row.value) + '</td></tr>');
    });

    return { html: html.join(''), hasContent: !!(product.cat || productKod || specRows.length || config) };
  }

  function renderSpecs(product) {
    const result = specRowsHtml(product);
    if (!result.hasContent) {
      specsBlock.hidden = true;
      specsTable.innerHTML = '';
      if (specsTableFull) specsTableFull.innerHTML = '';
      if (specsEmpty) specsEmpty.hidden = false;
      return false;
    }

    specsBlock.hidden = false;
    specsTable.innerHTML = result.html;
    if (specsTableFull) {
      specsTableFull.innerHTML = result.html.replace(
        'id="product-variant-spec-row"',
        'id="product-variant-spec-row-full"'
      );
    }
    if (specsEmpty) specsEmpty.hidden = true;
    return true;
  }

  function renderDescription(product) {
    const descriptionHtml = renderDescriptionHtml(product);
    const plainDescription = stripHtml(descriptionHtml);

    if (!plainDescription) {
      descriptionWrap.hidden = true;
      document.getElementById('product-description').innerHTML = '';
      return false;
    }

    descriptionWrap.hidden = false;
    document.getElementById('product-description').innerHTML = descriptionHtml;
    return true;
  }

  function renderSummary(product) {
    const summaryEl = document.getElementById('product-summary');
    if (!summaryEl) return;

    const summaryHtml = renderSummaryHtml(product);
    const plainSummary = stripHtml(summaryHtml);
    const plainDescription = stripHtml(renderDescriptionHtml(product));

    if (!plainSummary || plainSummary === plainDescription) {
      summaryEl.hidden = true;
      summaryEl.innerHTML = '';
      return;
    }

    summaryEl.hidden = false;
    summaryEl.innerHTML = summaryHtml;
  }

  function renderDetailsTab(product) {
    const table = document.getElementById('product-details-table');
    if (!table) return;
    const rows = [];
    if (product.cat) {
      rows.push('<tr><th>Kategoria</th><td>' + escapeHtml(product.cat) + '</td></tr>');
    }
    const kod = getProductKod(product, selectedVariant);
    if (kod) rows.push('<tr><th>Kodi</th><td>' + escapeHtml(kod) + '</td></tr>');
    rows.push(
      '<tr><th>Stoku</th><td>' +
        (product.in_stock === false ? 'Nuk ka stok' : 'Në stok') +
        '</td></tr>'
    );
    rows.push('<tr><th>Sasia në paketim</th><td>1 copë</td></tr>');
    (product.attributes || []).forEach((attr) => {
      if (!attr.name || !attr.value) return;
      rows.push('<tr><th>' + escapeHtml(attr.name) + '</th><td>' + escapeHtml(attr.value) + '</td></tr>');
    });
    table.innerHTML = rows.join('');
  }

  function extractDocuments(product) {
    const html = String(product.description_html || product.short_description_html || '');
    const docs = [];
    const re = /<a[^>]+href=["']([^"']+\.(?:pdf|docx?|xlsx?|zip))["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = re.exec(html))) {
      docs.push({
        href: match[1],
        label: stripHtml(match[2]) || match[1].split('/').pop(),
      });
    }
    return docs;
  }

  function renderDocuments(product) {
    const list = document.getElementById('product-docs');
    const empty = document.getElementById('product-docs-empty');
    if (!list) return;
    const docs = extractDocuments(product);
    if (!docs.length) {
      list.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;
    list.innerHTML = docs
      .map(
        (doc) =>
          '<li><a href="' +
          escapeHtml(doc.href) +
          '" target="_blank" rel="noopener">' +
          escapeHtml(doc.label) +
          '</a></li>'
      )
      .join('');
  }

  function renderRelated(all, product) {
    const same = sortCatalogProducts(all.filter((item) => item.id !== product.id && item.cat === product.cat));
    const others = sortCatalogProducts(all.filter((item) => item.id !== product.id && item.cat !== product.cat));
    const related = same.concat(others).slice(0, 4);

    if (!related.length) {
      relatedGrid.closest('.product-related').hidden = true;
      return;
    }

    relatedGrid.closest('.product-related').hidden = false;
    relatedGrid.innerHTML = related
      .map((item) => renderCatalogCard(item, { badge: 'recommended' }))
      .join('');
  }

  function bindTabs() {
    const tabs = document.querySelectorAll('.product-tab');
    const panels = document.querySelectorAll('.product-tabs-panel');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const id = tab.dataset.tab;
        tabs.forEach((el) => {
          const active = el === tab;
          el.classList.toggle('is-active', active);
          el.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.panel !== id;
        });
      });
    });
  }

  function renderProduct(product, all) {
    currentProduct = product;
    allProducts = all;
    setSelectedQty(1);
    document.title = product.name + ' — Eltex Group';

    const meta = document.querySelector('meta[name="description"]');
    const summaryText = product.short_description || product.description || '';
    if (meta && summaryText) {
      meta.setAttribute('content', summaryText.replace(/<[^>]+>/g, '').slice(0, 160));
    }

    document.getElementById('breadcrumb-current').textContent = product.name;

    const breadcrumbCategory = document.getElementById('breadcrumb-category');
    const breadcrumbCategorySep = document.getElementById('breadcrumb-category-sep');
    if (product.cat && breadcrumbCategory) {
      breadcrumbCategory.textContent = product.cat;
      breadcrumbCategory.href = categoryFilterUrl(product.cat);
      breadcrumbCategory.hidden = false;
      if (breadcrumbCategorySep) breadcrumbCategorySep.hidden = false;
    } else if (breadcrumbCategory) {
      breadcrumbCategory.hidden = true;
      if (breadcrumbCategorySep) breadcrumbCategorySep.hidden = true;
    }

    mainImage.src = product.img;
    mainImage.alt = product.name;

    const newBadge = document.getElementById('product-new-badge');
    if (newBadge) newBadge.hidden = !isNewProduct(product);

    document.getElementById('product-category').innerHTML = product.cat
      ? '<a class="product-detail-kicker" href="' +
        categoryFilterUrl(product.cat) +
        '">' +
        escapeHtml(product.cat) +
        '</a>'
      : '';
    document.getElementById('product-title').textContent = product.name;

    if (quoteLink) {
      quoteLink.href =
        '/contact-us?produkt=' + encodeURIComponent(product.name);
    }

    renderVariants(product);
    updatePriceDisplay();
    updateAddButton();
    renderGallery(product);
    renderSummary(product);
    renderSpecs(product);
    updateVariantSpecRow();
    renderDescription(product);
    renderDetailsTab(product);
    renderDocuments(product);

    notFound.hidden = true;
    detail.hidden = false;
    renderRelated(all, product);
  }

  function showNotFound() {
    notFound.hidden = false;
    detail.hidden = true;
    document.title = 'Produkti nuk u gjet — Eltex Group';
  }

  if (qtyMinus) {
    qtyMinus.addEventListener('click', () => setSelectedQty(getSelectedQty() - 1));
  }
  if (qtyPlus) {
    qtyPlus.addEventListener('click', () => setSelectedQty(getSelectedQty() + 1));
  }
  if (qtyInput) {
    qtyInput.addEventListener('change', () => setSelectedQty(qtyInput.value));
    qtyInput.addEventListener('blur', () => setSelectedQty(qtyInput.value));
  }
  if (galleryPrev) {
    galleryPrev.addEventListener('click', () => setGalleryIndex(galleryIndex - 1));
  }
  if (galleryNext) {
    galleryNext.addEventListener('click', () => setGalleryIndex(galleryIndex + 1));
  }

  bindTabs();

  addBtn.addEventListener('click', () => {
    if (!currentProduct || !window.EltexCart) return;
    if (!canViewPrices()) {
      window.location.href = '/llogaria';
      return;
    }
    if (variantConfig && !selectedVariant) return;
    window.EltexCart.add(cartPayload(currentProduct, selectedVariant), getSelectedQty());
  });

  if (relatedGrid) {
    relatedGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-cart]');
      if (!button || !window.EltexCart) return;
      event.preventDefault();
      const product = allProducts.find((item) => item.id === button.dataset.addCart);
      if (product) window.EltexCart.add(cartPayload(product));
    });
  }

  document.addEventListener('eltex-auth-ready', () => {
    if (currentProduct) {
      renderVariants(currentProduct);
      updatePriceDisplay();
      updateAddButton();
      renderRelated(allProducts, currentProduct);
    }
  });

  loadProducts()
    .then((products) => {
      if (!params.get('slug') && !params.get('id')) {
        window.location.replace('/produkte');
        return;
      }
      const product = findProduct(products, params);
      if (product) {
        renderProduct(product, products);
      } else {
        showNotFound();
      }
    })
    .catch(showNotFound);
})();
