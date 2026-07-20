(function () {
  const utils = window.EltexProducts;
  const fallbackProducts = [
    { id: '6024', slug: 'izolator-cilindrik-1n-500-m10', name: 'Izolator cilindrik 1N 500 M10', cat: 'Izolator', price: 2.5, image: 'images/Placeholder-37.jpg' },
  ];

  let products = [];
  let categories = ['Të Gjitha'];
  let activeCategory = 'Të Gjitha';
  let searchQuery = '';

  const grid = document.getElementById('products-grid');
  const filterWrap = document.getElementById('products-filter');
  const searchInput = document.getElementById('product-search');
  const emptyState = document.getElementById('products-empty');

  if (!grid || !filterWrap || !utils) return;

  function buildCategories(list) {
    const counts = {};
    list.forEach((p) => {
      counts[p.cat] = (counts[p.cat] || 0) + 1;
    });
    return [
      'Të Gjitha',
      ...Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name]) => name),
    ];
  }

  function filteredProducts() {
    return products.filter((product) => {
      const matchesCategory = activeCategory === 'Të Gjitha' || product.cat === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        product.name.toLowerCase().includes(q) ||
        product.cat.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderFilters() {
    filterWrap.innerHTML = categories
      .map(
        (cat) =>
          `<button type="button" class="filter-btn${cat === activeCategory ? ' active' : ''}" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`
      )
      .join('');
  }

  function renderProducts() {
    const list = filteredProducts();

    if (emptyState) {
      emptyState.hidden = list.length > 0;
    }

    grid.innerHTML = list
      .map(
        (product) => `
      <article class="product-card" data-category="${escapeHtml(product.cat)}">
        <a href="${utils.productUrl(product)}" class="product-card-image-link">
          <img src="${product.img}" alt="${escapeHtml(product.name)}" class="product-card-image" loading="lazy">
        </a>
        <div class="product-card-body">
          <div class="product-card-category">${escapeHtml(product.cat)}</div>
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
    renderFilters();
    renderProducts();
  }

  filterWrap.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    activeCategory = button.dataset.category;
    renderFilters();
    renderProducts();
  });

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      searchQuery = event.target.value;
      renderProducts();
    });
  }

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
