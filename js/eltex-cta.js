(function () {
  if (document.querySelector('.cta-div')) return;

  var html =
    '<div class="cta-div">' +
    '<a data-w-id="d1b3ffe6-c96f-942b-3497-978d54150d3c" href="tel:+38344722311" class="cta-circle w-inline-block">' +
    '<div class="cta-icon w-embed"><svg width="45" height="45" viewBox="0 0 45 45" fill="none"><path d="M16.8108 4.86359C16.119 3.13408 14.4439 2 12.5812 2H6.31568C3.93219 2 2 3.93173 2 6.31521C2 26.5748 18.4241 42.9989 38.6837 42.9989C41.0672 42.9989 42.9989 41.0666 42.9989 38.6831L43 32.4166C43 30.5538 41.8662 28.879 40.1367 28.1872L34.1316 25.7861C32.5781 25.1647 30.8092 25.4443 29.5238 26.5155L27.974 27.8081C26.164 29.3164 23.5008 29.1965 21.8348 27.5305L17.4708 23.1624C15.8048 21.4964 15.6817 18.8354 17.19 17.0254L18.4823 15.4757C19.5535 14.1902 19.8357 12.4209 19.2142 10.8674L16.8108 4.86359Z" stroke="white" stroke-width="3.41658" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
    '</a>' +
    '<div class="text-hidden"><div class="cta-text">Telefono Tani!</div></div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', html);
})();
