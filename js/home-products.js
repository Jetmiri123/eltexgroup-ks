(function () {
  const utils = window.EltexProducts;
  if (!utils) return;

  let cachedProducts = [];

  function renderHomeProducts(products) {
    const grid = document.getElementById('home-products-grid');
    if (!grid) return;

    cachedProducts = products;

    grid.innerHTML = products
      .slice(0, 4)
      .map((product) =>
        utils.renderCatalogCard(product, {
          className: 'home-product-card',
          addAttr: 'data-home-add',
        })
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

  document.addEventListener('eltex-auth-ready', () => {
    if (cachedProducts.length) renderHomeProducts(cachedProducts);
  });
})();
