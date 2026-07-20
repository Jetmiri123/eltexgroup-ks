(function () {
  const { loadProducts, findProduct, formatPrice, productUrl, cartPayload, getProductParams } =
    window.EltexProducts;

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
  const mainImage = document.getElementById('product-image');

  let currentProduct = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stripHtml(html) {
    return String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function textToParagraphs(text) {
    return escapeHtml(text)
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function renderDescriptionHtml(product) {
    const html = product.description_html || product.short_description_html;
    if (html && /<[^>]+>/.test(html)) {
      return html;
    }
    return textToParagraphs(product.description || product.short_description || '');
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

  function renderSpecs(product) {
    const rows = (product.attributes || []).filter((a) => a.name && a.value);
    if (!product.sku && !rows.length) {
      specsBlock.hidden = true;
      specsTable.innerHTML = '';
      return false;
    }

    specsBlock.hidden = false;
    const html = [];
    if (product.sku) {
      html.push(`<tr><th>SKU</th><td>${escapeHtml(product.sku)}</td></tr>`);
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
    const plainShort = stripHtml(
      product.short_description_html || product.short_description || product.description || ''
    );

    if (!plainDescription || (plainShort && plainDescription === plainShort)) {
      descriptionWrap.hidden = true;
      document.getElementById('product-description').innerHTML = '';
      return false;
    }

    descriptionWrap.hidden = false;
    document.getElementById('product-description').innerHTML = descriptionHtml;
    return true;
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
          <div class="product-card-category">${escapeHtml(item.cat)}</div>
          <h3 class="product-card-title">
            <a href="${productUrl(item)}">${escapeHtml(item.name)}</a>
          </h3>
          <div class="product-card-footer">
            <div class="product-card-price">
              <span class="price-current">${formatPrice(item.price)}</span>
            </div>
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
    mainImage.src = product.img;
    mainImage.alt = product.name;
    document.getElementById('product-category').textContent = product.cat;
    document.getElementById('product-title').textContent = product.name;
    document.getElementById('product-price').textContent = formatPrice(product.price);

    if (product.sku) {
      skuEl.hidden = false;
      skuEl.textContent = 'SKU: ' + product.sku;
    } else {
      skuEl.hidden = true;
    }

    addBtn.disabled = product.in_stock === false;
    addBtn.textContent = product.in_stock === false ? 'Nuk ka stok' : 'Shto në Shportë';

    renderGallery(product);
    const hasSpecs = renderSpecs(product);
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
    if (currentProduct && window.EltexCart) {
      window.EltexCart.add(cartPayload(currentProduct));
    }
  });

  loadProducts()
    .then((products) => {
      if (!params.get('slug') && !params.get('id')) {
        window.location.replace('/produkte.html');
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
