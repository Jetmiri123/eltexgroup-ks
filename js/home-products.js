(function () {
  const utils = window.EltexProducts;
  if (!utils) return;

  document.addEventListener('DOMContentLoaded', () => {
    utils
      .loadProducts()
      .then((products) => {
        window.EltexHomeProducts = products;
        document.querySelectorAll('[data-home-add]').forEach((button) => {
          button.addEventListener('click', (event) => {
            event.preventDefault();
            const id = String(button.dataset.homeAdd || '');
            const product = products.find((item) => String(item.id) === id);
            if (product && window.EltexCart) {
              window.EltexCart.add(utils.cartPayload(product));
            }
          });
        });
      })
      .catch(() => {
        window.EltexHomeProducts = [];
      });
  });
})();
