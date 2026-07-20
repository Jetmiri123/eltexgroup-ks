(function () {
  function setItemOpen(item, open) {
    item.classList.toggle('is-open', open);
    var trigger = item.querySelector('[role="button"]') || item.querySelector('.question_div') || item.querySelector('.about_heading');
    if (trigger) {
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
  }

  function setupExclusiveAccordion(items, getTrigger, defaultOpenIndex) {
    items.forEach(function (item, index) {
      var trigger = getTrigger(item);
      if (!trigger) return;

      var open = index === defaultOpenIndex;
      setItemOpen(item, open);

      function toggleItem() {
        var isOpen = item.classList.contains('is-open');
        items.forEach(function (other) {
          setItemOpen(other, other === item ? !isOpen : false);
        });
      }

      trigger.addEventListener('click', toggleItem);
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleItem();
        }
      });
    });
  }

  /* About-us FAQ accordion */
  document.querySelectorAll('.about-faq-drop-down').forEach(function (wrap) {
    var items = wrap.querySelectorAll('.faqs_materials');
    if (!items.length) return;

    setupExclusiveAccordion(
      items,
      function (item) {
        return item.querySelector('.about_heading');
      },
      0
    );
  });

  /* Homepage FAQ accordion */
  document.querySelectorAll('._2-col-grid-right.faq').forEach(function (wrap) {
    var items = wrap.querySelectorAll('.faq_holder');
    if (!items.length) return;

    setupExclusiveAccordion(
      items,
      function (item) {
        return item.querySelector('.question_div');
      },
      -1
    );
  });

  /* Wire index nav cart badge */
  document.querySelectorAll('.nav_badge[data-cart-count]').forEach(function (badge) {
    if (!window.EltexCart) return;
    var update = function () {
      var count = window.EltexCart.count();
      badge.textContent = String(count);
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    };
    update();
    document.addEventListener('eltex-cart-updated', update);
  });
})();
