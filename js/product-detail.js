(function () {
  const {
    loadProducts,
    findProduct,
    formatPrice,
    productUrl,
    cartPayload,
    getProductParams,
    formatRichContent,
    renderCategoryBadge,
    categoryFilterUrl,
    escapeHtml,
    parseProductVariants,
    getVariantPrice,
    renderProductPrice,
    renderVariantPrice,
    canViewPrices,
  } = window.EltexProducts;

  const params = getProductParams();
  const notFound = document.getElementById('product-not-found');
  const detail = document.getElementById('product-detail');
  const relatedGrid = document.getElementById('product-related');
  const addBtn = document.getElementById('product-add-cart');
  const gallery = document.getElementById('product-gallery');
  const specsBlock = document.getElementById('product-specs');
  const specsTable = document.getElementById('product-specs-table');
  const detailsBlock = document.getElementById('product-details');
  const descriptionWrap = document.getElementById('product-description-wrap');
  const skuEl = document.getElementById('product-sku');
  const variantsEl = document.getElementById('product-variants');
  const mainImage = document.getElementById('product-image');

  let currentProduct = null;
  let variantConfig = null;
  let selectedVariant = null;

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

  function renderGallery(product) {
    const images = product.images && product.images.length ? product.images : [product.img];
    if (images.length <= 1) {
      gallery.hidden = true;
      gallery.innerHTML = '';
      return;
    }

    gallery.hidden = false;
    gallery.innerHTML = images
      .map(
        (src, i) =>
          `<button type="button" class="product-gallery-thumb${i === 0 ? ' is-active' : ''}" data-image="${escapeHtml(src)}" aria-label="Foto ${i + 1}"><img src="${escapeHtml(src)}" alt=""></button>`
      )
      .join('');

    gallery.querySelectorAll('[data-image]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mainImage.src = btn.dataset.image;
        gallery.querySelectorAll('.product-gallery-thumb').forEach((el) => el.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });
  }

  function updateAddButton() {
    if (!addBtn || !currentProduct) return;

    if (!canViewPrices()) {
      addBtn.disabled = false;
      addBtn.textContent = 'Kyçu për çmime';
      return;
    }

    if (currentProduct.in_stock === false) {
      addBtn.disabled = true;
      addBtn.textContent = 'Nuk ka stok';
      return;
    }

    if (variantConfig && !selectedVariant) {
      addBtn.disabled = true;
      addBtn.textContent = 'Zgjidhni variantin';
      return;
    }

    addBtn.disabled = false;
    addBtn.textContent = 'Shto në Shportë';
  }

  function updateSkuDisplay() {
    if (selectedVariant && selectedVariant.kod) {
      skuEl.hidden = false;
      skuEl.textContent = 'Kodi: ' + selectedVariant.kod;
      return;
    }

    if (currentProduct && currentProduct.sku) {
      skuEl.hidden = false;
      skuEl.textContent = 'SKU: ' + currentProduct.sku;
      return;
    }

    skuEl.hidden = true;
  }

  function updateVariantSpecRow() {
    const row = document.getElementById('product-variant-spec-row');
    if (!row) return;

    if (selectedVariant && variantConfig) {
      const kodHtml = selectedVariant.kod
        ? ' <span class="product-variant-kod">(' + escapeHtml(selectedVariant.kod) + ')</span>'
        : '';
      row.innerHTML =
        '<th>' +
        escapeHtml(variantConfig.attributeName) +
        '</th><td>' +
        escapeHtml(selectedVariant.label) +
        kodHtml +
        '</td>';
      row.hidden = false;
      return;
    }

    row.hidden = true;
    row.innerHTML = '';
  }

  function updatePriceDisplay() {
    const priceEl = document.getElementById('product-price');
    if (!priceEl || !currentProduct) return;

    if (!canViewPrices()) {
      priceEl.innerHTML = renderProductPrice(currentProduct);
      return;
    }

    if (selectedVariant) {
      priceEl.textContent = formatPrice(getVariantPrice(currentProduct, selectedVariant.value));
      return;
    }

    priceEl.innerHTML = renderProductPrice(currentProduct, { style: 'from' });
  }

  function onVariantSelected() {
    updateSkuDisplay();
    updateVariantSpecRow();
    updatePriceDisplay();
    updateAddButton();
  }

  function renderVariants(product) {
    variantConfig = parseProductVariants(product);
    selectedVariant = null;

    if (!variantsEl || !variantConfig || !variantConfig.variants.length) {
      if (variantsEl) {
        variantsEl.hidden = true;
        variantsEl.innerHTML = '';
      }
      updateAddButton();
      updateVariantSpecRow();
      return;
    }

    const { attributeName, variants } = variantConfig;
    const useSelect = variants.length > 8;

    variantsEl.hidden = false;

    if (useSelect) {
      variantsEl.innerHTML =
        '<label class="product-variants-label" for="product-variant-select">' +
        escapeHtml(attributeName) +
        '</label>' +
        '<select class="product-variant-select" id="product-variant-select">' +
        '<option value="">Zgjidhni një variant</option>' +
        variants
          .map((variant) => {
            const parts = [variant.label];
            if (variant.kod) parts.push('Kodi ' + variant.kod);
            if (canViewPrices()) parts.push(formatPrice(variant.price));
            return (
              '<option value="' +
              escapeHtml(variant.value) +
              '">' +
              escapeHtml(parts.join(' — ')) +
              '</option>'
            );
          })
          .join('') +
        '</select>';

      const select = document.getElementById('product-variant-select');
      select.addEventListener('change', () => {
        const match = variants.find((variant) => variant.value === select.value);
        selectedVariant = match ? { ...match, attributeName } : null;
        onVariantSelected();
      });
    } else {
      variantsEl.innerHTML =
        '<span class="product-variants-label">' +
        escapeHtml(attributeName) +
        '</span>' +
        '<div class="product-variant-options" role="listbox" aria-label="' +
        escapeHtml(attributeName) +
        '">' +
        variants
          .map(
            (variant) =>
              '<button type="button" class="product-variant-option" data-variant-value="' +
              escapeHtml(variant.value) +
              '" role="option" aria-selected="false">' +
              '<span class="variant-option-main">' +
              '<span class="variant-option-label">' +
              escapeHtml(variant.label) +
              '</span>' +
              (variant.kod
                ? '<span class="variant-option-kod">Kodi ' + escapeHtml(variant.kod) + '</span>'
                : '') +
              '</span>' +
              (canViewPrices()
                ? '<span class="variant-option-price">' + formatPrice(variant.price) + '</span>'
                : '') +
              '</button>'
          )
          .join('') +
        '</div>';

      variantsEl.querySelectorAll('.product-variant-option').forEach((btn) => {
        btn.addEventListener('click', () => {
          const match = variants.find((variant) => variant.value === btn.dataset.variantValue);
          selectedVariant = match ? { ...match, attributeName } : null;
          variantsEl.querySelectorAll('.product-variant-option').forEach((el) => {
            const isSelected = el === btn;
            el.classList.toggle('is-selected', isSelected);
            el.setAttribute('aria-selected', isSelected ? 'true' : 'false');
          });
          onVariantSelected();
        });
      });
    }

    updateAddButton();
    updateVariantSpecRow();
  }

  function renderSpecs(product) {
    const config = parseProductVariants(product);
    const variantAttrNames = config ? config.attributeNames : [];
    const rows = (product.attributes || []).filter((attr) => {
      if (!attr.name || !attr.value) return false;
      return !variantAttrNames.includes(String(attr.name).trim());
    });

    if (!product.sku && !product.cat && !rows.length && !config) {
      specsBlock.hidden = true;
      specsTable.innerHTML = '';
      return false;
    }

    specsBlock.hidden = false;
    const html = [];
    if (product.cat) {
      html.push(
        `<tr><th>Kategoria</th><td><a href="${categoryFilterUrl(product.cat)}" class="product-category-link">${escapeHtml(product.cat)}</a></td></tr>`
      );
    }
    if (product.sku) {
      html.push(`<tr><th>SKU</th><td>${escapeHtml(product.sku)}</td></tr>`);
    }
    if (config) {
      html.push('<tr id="product-variant-spec-row" hidden></tr>');
    }
    rows.forEach((row) => {
      html.push(`<tr><th>${escapeHtml(row.name)}</th><td>${escapeHtml(row.value)}</td></tr>`);
    });
    specsTable.innerHTML = html.join('');
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

  function renderRelated(all, product) {
    const related = all
      .filter((p) => p.id !== product.id && p.cat === product.cat)
      .slice(0, 3);

    if (!related.length) {
      relatedGrid.closest('.product-related').hidden = true;
      return;
    }

    relatedGrid.innerHTML = related
      .map(
        (item) => `
      <article class="product-card">
        <a href="${productUrl(item)}" class="product-card-image-link">
          <img src="${item.img}" alt="${escapeHtml(item.name)}" class="product-card-image" loading="lazy">
        </a>
        <div class="product-card-body">
          ${renderCategoryBadge(item.cat, { showLabel: false })}
          <h3 class="product-card-title">
            <a href="${productUrl(item)}">${escapeHtml(item.name)}</a>
          </h3>
          <div class="product-card-footer">
            <div class="product-card-price">${renderProductPrice(item, { style: 'from' })}</div>
            <a href="${productUrl(item)}" class="btn-add-cart product-card-view-link">Shiko detajet</a>
          </div>
        </div>
      </article>`
      )
      .join('');
  }

  function renderProduct(product, all) {
    currentProduct = product;
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
    document.getElementById('product-category').innerHTML = renderCategoryBadge(product.cat, { detail: true });
    document.getElementById('product-title').textContent = product.name;
    updatePriceDisplay();

    renderVariants(product);
    updateSkuDisplay();
    updateAddButton();

    renderGallery(product);
    renderSummary(product);
    const hasSpecs = renderSpecs(product);
    updateVariantSpecRow();
    const hasDescription = renderDescription(product);
    detailsBlock.hidden = !(hasSpecs || hasDescription);
    detailsBlock.classList.toggle('product-detail-details--single', hasSpecs !== hasDescription);

    notFound.hidden = true;
    detail.hidden = false;
    renderRelated(all, product);
  }

  function showNotFound() {
    notFound.hidden = false;
    detail.hidden = true;
    document.title = 'Produkti nuk u gjet — Eltex Group';
  }

  addBtn.addEventListener('click', () => {
    if (!currentProduct || !window.EltexCart) return;
    if (!canViewPrices()) {
      window.location.href = '/llogaria';
      return;
    }
    if (variantConfig && !selectedVariant) return;
    window.EltexCart.add(cartPayload(currentProduct, selectedVariant));
  });

  document.addEventListener('eltex-auth-ready', () => {
    if (currentProduct) {
      renderVariants(currentProduct);
      updatePriceDisplay();
      updateAddButton();
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
