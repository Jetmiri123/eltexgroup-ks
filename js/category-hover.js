(function () {
  var section = document.querySelector('.product-categories');
  if (!section) return;

  var linkSelectors = [
    '.service_link',
    '.service_link-1',
    '.service_link-2',
    '.service_link_3',
    '.service_link-4',
    '.service_link_5',
  ];

  var imageClasses = [
    'gelander-image',
    'anbaubalkone-image',
    'berdachungen-image',
    'carports-image',
    'zaunanlagen-image',
    'treppenbau-image',
  ];

  var links = linkSelectors.map(function (selector) {
    return section.querySelector(selector);
  });

  var images = imageClasses.map(function (className) {
    return section.querySelector('.' + className);
  });

  var mobileBound = false;

  function isDesktop() {
    return window.matchMedia('(min-width: 992px)').matches;
  }

  function clearInlineOverrides() {
    images.forEach(function (img) {
      if (!img) return;
      img.style.removeProperty('display');
      img.style.removeProperty('opacity');
      img.style.removeProperty('transition');
    });
    links.forEach(function (link) {
      if (link) link.classList.remove('is-category-active');
    });
  }

  function activate(index) {
    images.forEach(function (img, i) {
      if (!img) return;
      var active = i === index;
      img.style.transition = 'opacity 0.3s ease';
      img.style.opacity = active ? '1' : '0';
      if (active) {
        img.style.display = 'block';
      } else {
        window.setTimeout(function () {
          if (img.style.opacity === '0') img.style.display = 'none';
        }, 300);
      }
    });

    links.forEach(function (link, i) {
      if (link) link.classList.toggle('is-category-active', i === index);
    });
  }

  function bindMobileFallback() {
    if (mobileBound) return;
    mobileBound = true;

    links.forEach(function (link, index) {
      if (!link) return;
      link.addEventListener('mouseenter', function () {
        if (isDesktop()) return;
        activate(index);
      });
      link.addEventListener('focus', function () {
        if (isDesktop()) return;
        activate(index);
      });
    });

    section.addEventListener('mouseleave', function () {
      if (isDesktop()) return;
      activate(0);
    });

    activate(0);
  }

  function init() {
    if (isDesktop()) {
      clearInlineOverrides();
      return;
    }
    bindMobileFallback();
  }

  init();
  window.addEventListener('load', init);
  window.addEventListener('resize', init);
})();
