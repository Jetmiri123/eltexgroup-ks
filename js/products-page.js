(function () {
  const utils = window.EltexProducts;
  const fallbackProducts = [
    { id: '6024', slug: 'izolator-cilindrik-1n-500-m10', name: 'Izolator cilindrik 1N 500 M10', cat: 'Izolator', price: 2.5, image: 'images/Placeholder-37.jpg' },
  ];

  let products = [];
  let categories = ['Të Gjitha'];
  let activeCategory = 'Të Gjitha';
  let searchQuery = '';
  let categorySearchQuery = '';
  let filterModalOpen = false;
  let lastFocus = null;

  const grid = document.getElementById('products-grid');
  const filterOpenBtn = document.getElementById('products-filter-open');
  const filterLabel = document.getElementById('products-filter-label');
  const filterModal = document.getElementById('products-filter-modal');
  const filterPanel = document.getElementById('products-filter-panel');
  const filterList = document.getElementById('products-filter-list');
  const categorySearchInput = document.getElementById('products-category-search');
  const activeFilters = document.getElementById('products-active-filters');
  const resultsMeta = document.getElementById('products-results-meta');
  const searchInput = document.getElementById('product-search');
  const emptyState = document.getElementById('products-empty');

  if (!grid || !filterOpenBtn || !filterModal || !filterList || !utils) return;

  function buildCategories(list) {
    const counts = {};
    list.forEach((product) => {
      counts[product.cat] = (counts[product.cat] || 0) + 1;
    });
    return [
      'Të Gjitha',
      ...Object.entries(counts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sq'))
        .map(([name]) => name),
    ];
  }

  function categoryCount(cat) {
    if (cat === 'Të Gjitha') return products.length;
    return products.filter((product) => product.cat === cat).length;
  }

  function filteredProducts() {
    return products.filter((product) => {
      const matchesCategory = activeCategory === 'Të Gjitha' || product.cat === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.cat.toLowerCase().includes(q) ||
        (product.sku || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }

  function escapeHtml(text) {
    return utils.escapeHtml(text);
  }

  function truncateLabel(text, max) {
    const value = String(text || '');
    if (value.length <= max) return value;
    return value.slice(0, max - 1) + '…';
  }

  function syncCategoryUrl() {
    const url = new URL(window.location.href);
    if (activeCategory === 'Të Gjitha') {
      url.searchParams.delete('cat');
    } else {
      url.searchParams.set('cat', utils.slugify(activeCategory));
    }
    history.replaceState({}, '', url.pathname + url.search);
  }

  function applyCategoryFromUrl() {
    const param = new URLSearchParams(window.location.search).get('cat');
    if (!param) return;

    const match = products.find((product) => utils.slugify(product.cat) === param);
    if (match) {
      activeCategory = match.cat;
    }
  }

  function setCategory(cat) {
    activeCategory = cat || 'Të Gjitha';
    syncCategoryUrl();
    updateFilterUi();
    renderProducts();
  }

  function updateFilterTrigger() {
    const isFiltered = activeCategory !== 'Të Gjitha';
    filterOpenBtn.classList.toggle('is-active', isFiltered);
    filterOpenBtn.setAttribute('aria-expanded', filterModalOpen ? 'true' : 'false');

    if (isFiltered) {
      filterLabel.textContent = truncateLabel(activeCategory, 28);
      filterLabel.title = activeCategory;
    } else {
      filterLabel.textContent = 'Të gjitha';
      filterLabel.removeAttribute('title');
    }
  }

  function renderActiveFilters() {
    const chips = [];
    const q = searchQuery.trim();

    if (activeCategory !== 'Të Gjitha') {
      chips.push(
        '<button type="button" class="products-filter-chip" data-clear-category aria-label="Hiq filtrin e kategorisë">' +
          '<span>' +
          escapeHtml(truncateLabel(activeCategory, 36)) +
          '</span>' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
          '</button>'
      );
    }

    if (q) {
      chips.push(
        '<button type="button" class="products-filter-chip" data-clear-search aria-label="Pastro kërkimin">' +
          '<span>Kërkim: “' +
          escapeHtml(truncateLabel(q, 24)) +
          '”</span>' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
          '</button>'
      );
    }

    if (!chips.length) {
      activeFilters.hidden = true;
      activeFilters.innerHTML = '';
      return;
    }

    activeFilters.hidden = false;
    activeFilters.innerHTML = chips.join('');
  }

  function updateResultsMeta(count) {
    if (!resultsMeta) return;
    resultsMeta.textContent = count + ' produkt' + (count === 1 ? '' : 'e');
  }

  function visibleCategories() {
    const q = categorySearchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((cat) => cat.toLowerCase().includes(q));
  }

  function renderFilterList() {
    const list = visibleCategories();

    if (!list.length) {
      filterList.innerHTML =
        '<p class="products-filter-empty">Nuk u gjet asnjë kategori.</p>';
      return;
    }

    filterList.innerHTML = list
      .map((cat) => {
        const count = categoryCount(cat);
        const selected = cat === activeCategory;
        const label = cat === 'Të Gjitha' ? 'Të gjitha kategoritë' : cat;
        return (
          '<button type="button" class="products-filter-option' +
          (selected ? ' is-selected' : '') +
          '" data-category="' +
          escapeHtml(cat) +
          '" role="option" aria-selected="' +
          (selected ? 'true' : 'false') +
          '">' +
          '<span class="products-filter-option-name">' +
          escapeHtml(label) +
          '</span>' +
          '<span class="products-filter-option-count">' +
          count +
          '</span>' +
          '</button>'
        );
      })
      .join('');
  }

  function updateFilterUi() {
    updateFilterTrigger();
    renderFilterList();
    renderActiveFilters();
  }

  function openFilterModal() {
    if (filterModalOpen) return;
    filterModalOpen = true;
    lastFocus = document.activeElement;
    categorySearchQuery = '';
    if (categorySearchInput) categorySearchInput.value = '';
    filterModal.hidden = false;
    document.body.classList.add('products-filter-open');
    updateFilterTrigger();
    renderFilterList();
    window.requestAnimationFrame(() => {
      filterModal.classList.add('is-visible');
      (categorySearchInput || filterPanel).focus();
    });
  }

  function closeFilterModal() {
    if (!filterModalOpen) return;
    filterModalOpen = false;
    filterModal.classList.remove('is-visible');
    document.body.classList.remove('products-filter-open');
    updateFilterTrigger();

    window.setTimeout(() => {
      if (!filterModalOpen) filterModal.hidden = true;
    }, 220);

    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  }

  function renderProducts() {
    const list = filteredProducts();

    if (emptyState) {
      emptyState.hidden = list.length > 0;
    }

    updateResultsMeta(list.length);
    updateFilterUi();

    grid.innerHTML = list
      .map(
        (product) => `
      <article class="product-card" data-category="${escapeHtml(product.cat)}">
        <a href="${utils.productUrl(product)}" class="product-card-image-link">
          <img src="${product.img}" alt="${escapeHtml(product.name)}" class="product-card-image" loading="lazy">
        </a>
        <div class="product-card-body">
          ${utils.renderCategoryBadge(product.cat)}
          <h3 class="product-card-title">
            <a href="${utils.productUrl(product)}">${escapeHtml(product.name)}</a>
          </h3>
          <div class="product-card-footer">
            <div class="product-card-price">
              <span class="price-current">${utils.formatPrice(product.price)}</span>
            </div>
            <button type="button" class="btn-add-cart" data-add-cart="${escapeHtml(product.id)}">Shto në Shportë</button>
          </div>
        </div>
      </article>`
      )
      .join('');
  }

  function init(list) {
    products = list.map(utils.normalizeProduct);
    categories = buildCategories(products);
    applyCategoryFromUrl();
    updateFilterUi();
    renderProducts();
  }

  filterOpenBtn.addEventListener('click', openFilterModal);

  filterModal.addEventListener('click', (event) => {
    if (event.target.closest('[data-filter-close]')) {
      closeFilterModal();
    }
  });

  filterList.addEventListener('click', (event) => {
    const option = event.target.closest('[data-category]');
    if (!option) return;
    setCategory(option.dataset.category);
    closeFilterModal();
  });

  if (categorySearchInput) {
    categorySearchInput.addEventListener('input', (event) => {
      categorySearchQuery = event.target.value;
      renderFilterList();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filterModalOpen) {
      event.preventDefault();
      closeFilterModal();
    }
  });

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      searchQuery = event.target.value;
      renderProducts();
    });
  }

  activeFilters.addEventListener('click', (event) => {
    if (event.target.closest('[data-clear-category]')) {
      setCategory('Të Gjitha');
      return;
    }
    if (event.target.closest('[data-clear-search]')) {
      searchQuery = '';
      if (searchInput) searchInput.value = '';
      renderProducts();
    }
  });

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-add-cart]');
    if (!button || !window.EltexCart) return;
    event.preventDefault();
    const product = products.find((item) => item.id === button.dataset.addCart);
    if (product) {
      window.EltexCart.add(utils.cartPayload(product));
    }
  });

  utils
    .loadProducts()
    .then(init)
    .catch(() => init(fallbackProducts.map(utils.normalizeProduct)));
})();
