(function () {
  var PINPOINT_DOT =
    '<div class="pinpoint-dot w-embed"><svg width="30" height="30" viewBox="0 0 60 60" fill="none" aria-hidden="true"><circle cx="30" cy="30" r="30" fill="#F88837"/></svg></div>';

  function pinpoint(label, lower) {
    return (
      '<div class="point' +
      (lower ? ' lower' : '') +
      '">' +
      PINPOINT_DOT +
      '<h2 class="small-text">' +
      label +
      '</h2></div>'
    );
  }

  var PINPOINTS_HTML =
    pinpoint('Cilësi e Certifikuar', false) +
    pinpoint('Këshillim Profesional', true) +
    pinpoint('Çmime Konkurruese', false) +
    pinpoint('Dërgesa të Shpejta', true) +
    pinpoint('Partnerë Globalë', false) +
    pinpoint('Mbështetje B2B', true);

  var MOVEMENT_HTML =
    '<section class="movement_section" aria-label="Pikat tona të besimit">' +
    '<div class="pinpoints-track">' +
    '<div class="pinpoints">' +
    PINPOINTS_HTML +
    '</div></div></section>';

  function injectPinpoints() {
    if (document.querySelector('.movement_section')) return;
    if (document.querySelector('.product-detail-section')) return;
    var footerMount = document.querySelector('[data-eltex-footer]');
    if (!footerMount) return;
    footerMount.insertAdjacentHTML('beforebegin', MOVEMENT_HTML);
    initPinpointsScroll();
  }

  function initPinpointsScroll() {
    var section = document.querySelector('.movement_section');
    var track = section && section.querySelector('.pinpoints');
    if (!section || !track) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(max-width: 991px)').matches) return;

    function update() {
      var rect = section.getBoundingClientRect();
      var viewH = window.innerHeight;
      var total = section.offsetHeight + viewH;
      var progress = (viewH - rect.top) / total;
      progress = Math.max(0, Math.min(1, progress));
      var overflow = Math.max(0, track.scrollWidth - window.innerWidth + 160);
      track.style.transform = 'translate3d(' + (-progress * overflow) + 'px,0,0)';
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function setupReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var selectors = [
      '.section_headline',
      '.blog_heading',
      '.about-us',
      '.about-faq-heading',
      '.faq_holder',
      '.collection-item-2',
      '.collection-item-3',
      '.home-product-card',
      '.product-detail-grid',
      '.cart-item',
      '.partners-section',
      '.wrapper_material',
      '.hero_headline .paragraph',
      '.products-hero-section .service-materials',
    ];

    var nodes = [];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        nodes.push(el);
      });
    });

    nodes.forEach(function (el, i) {
      if (el.classList.contains('eltex-reveal')) return;
      el.classList.add('eltex-reveal');
      if (i % 4 === 1) el.classList.add('eltex-reveal-delay-1');
      if (i % 4 === 2) el.classList.add('eltex-reveal-delay-2');
      if (i % 4 === 3) el.classList.add('eltex-reveal-delay-3');
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );

    document.querySelectorAll('.eltex-reveal').forEach(function (el) {
      observer.observe(el);
    });
  }

  injectPinpoints();
  initPinpointsScroll();
  setupReveal();
  window.addEventListener('load', function () {
    initPinpointsScroll();
    setupReveal();
  });
})();
