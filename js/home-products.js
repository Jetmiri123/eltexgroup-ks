(function () {
  const utils = window.EltexProducts;
  if (!utils) return;

  function renderHomeProducts(products) {
    const grid = document.getElementById('home-products-grid');
    if (!grid) return;

    grid.innerHTML = products
      .slice(0, 4)
      .map(
        (product) => `
      <article class="home-product-card">
        <a href="${utils.productUrl(product)}" class="home-product-image-link">
          <img src="${utils.escapeHtml(product.img)}" alt="${utils.escapeHtml(product.name)}" class="home-product-image" loading="lazy">
        </a>
        <div class="home-product-body">
          ${utils.renderCategoryBadge(product.cat)}
          <h3 class="small-text home-product-title">
            <a href="${utils.productUrl(product)}">${utils.escapeHtml(product.name)}</a>
          </h3>
          <div class="home-product-price">${utils.formatPrice(product.price)}</div>
          <button type="button" class="btn-add-cart" data-home-add="${utils.escapeHtml(product.id)}">Shto në Shportë</button>
        </div>
      </article>`
      )
      .join('');

    grid.querySelectorAll('[data-home-add]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const id = String(button.dataset.homeAdd || '');
        const product = products.find((item) => String(item.id) === id);
        if (product && window.EltexCart) {
          window.EltexCart.add(utils.cartPayload(product));
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    utils
      .loadProducts()
      .then((products) => {
        window.EltexHomeProducts = products;
        renderHomeProducts(products);
      })
      .catch(() => {
        window.EltexHomeProducts = [];
      });
  });
})();
