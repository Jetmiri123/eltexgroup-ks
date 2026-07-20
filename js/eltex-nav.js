(function () {
  var mount = document.querySelector('[data-eltex-nav]');
  if (!mount) return;

  var page = mount.getAttribute('data-page') || '';
  var links = [
    { id: 'index', href: '/', label: 'Home' },
    { id: 'produkte', href: '/produkte', label: 'Produkte' },
    { id: 'about-us', href: '/about-us', label: 'Për Ne' },
    { id: 'blogs', href: '/blogs', label: 'Blog' },
    { id: 'contact-us', href: '/contact-us', label: 'Kontakt' },
    { id: 'cart', href: '/cart', label: 'Shporta', cart: true },
  ];

  function linkHtml(link) {
    var current = link.id === page;
    var cls = 'navbar_link w-nav-link' + (current ? ' w--current' : '') + (link.cart ? ' navbar_cart-link' : '');
    var aria = current ? ' aria-current="page"' : '';
    var label = link.label;
    if (link.cart) {
      label = 'Shporta<span class="cart-count" data-cart-count aria-hidden="true">0</span>';
    }
    return '<a href="' + link.href + '"' + aria + ' class="' + cls + '">' + label + '</a>';
  }

  var navParts = links
    .map(function (link, i) {
      var sep = i > 0 ? '<div class="nav_line">/</div>' : '';
      return sep + linkHtml(link);
    })
    .join('');

  var brandCurrent = page === 'index' ? ' w--current' : '';
  var brandAria = page === 'index' ? ' aria-current="page"' : '';

  var html =
    '<div data-collapse="medium" data-animation="default" data-duration="400" fs-scrolldisable-element="smart-nav" data-easing="ease" data-easing2="ease" role="banner" class="navbar_component w-nav">' +
    '<div class="navbar_container">' +
    '<a href="/"' +
    brandAria +
    ' class="navbar_logo-link w-nav-brand' +
    brandCurrent +
    '">' +
    '<img src="images/brand/eltex-logo.png" loading="eager" alt="Eltex Group" class="navbar_logo">' +
    '</a>' +
    '<nav role="navigation" class="navbar_menu is-page-height-tablet w-nav-menu">' +
    navParts +
    '</nav>' +
    '<div data-w-id="70e4924a-7764-1076-0797-649b20cd147e" class="navbar_menu-button w-nav-button">' +
    '<div class="menu-icon">' +
    '<div data-is-ix2-target="1" class="lottie-animation" data-w-id="70e4924a-7764-1076-0797-649b20cd1480" data-animation-type="lottie" data-src="documents/burger-menu.json" data-loop="0" data-direction="1" data-autoplay="0" data-renderer="svg" data-duration="0" data-loading="eager" data-ix2-initial-state="9"></div>' +
    '</div></div></div></div>';

  mount.outerHTML = html;
})();
