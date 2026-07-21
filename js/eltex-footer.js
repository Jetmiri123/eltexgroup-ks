(function () {
  const footerHtml = `
<footer class="eltex-footer">
  <div class="eltex-footer-inner">
    <div class="eltex-footer-grid">
      <div class="eltex-footer-brand">
        <a href="/"><img src="images/brand/eltex-logo-white.png" alt="Eltex Group" class="eltex-footer-logo"></a>
        <h4>Kompania Jonë</h4>
        <p>Eltex Group ofron furnizime elektrike me cilësi të lartë për instalime profesionale dhe shtëpiake. Fokusohemi në cilësi, besueshmëri dhe çmime konkurruese.</p>
      </div>
      <div>
        <h4>Kujdesi ndaj Klientit</h4>
        <ul class="eltex-footer-links">
          <li><a href="/produkte">Produktet</a></li>
          <li><a href="/about-us">Rreth nesh</a></li>
          <li><a href="/contact-us">Kontakti</a></li>
          <li><a href="/cart">Shporta</a></li>
        </ul>
      </div>
      <div>
        <h4>Lidhje të Dobishme</h4>
        <ul class="eltex-footer-links">
          <li><a href="/blogs">Blog</a></li>
          <li><a href="/dergesa-kthime">Dërgesa dhe Kthime</a></li>
          <li><a href="/kushtet-e-perdorimit">Kushtet e Përdorimit</a></li>
          <li><a href="/politika-e-privatesise">Politika e Privatësisë</a></li>
        </ul>
      </div>
      <div>
        <h4>Abonohu</h4>
        <p class="eltex-footer-note">Do të përdoret në përputhje me Politikën tonë të Privatësisë.</p>
        <form class="newsletter-form" onsubmit="return false;">
          <input type="email" placeholder="Email" aria-label="Email">
          <button type="submit">Regjistrohu</button>
        </form>
      </div>
    </div>
    <div class="eltex-footer-bottom">
      <div>
        <h4>Adresa</h4>
        <div class="footer-map">
          <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d2940.836079185536!2d21.12612299678955!3d42.597492200000005!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x13549d45765bdb8f%3A0x3d923c0f7e18d9b!2sEltex%20group%20shpk!5e1!3m2!1ssq!2sus!4v1784539975878!5m2!1ssq!2sus" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" title="Eltex Group shpk"></iframe>
        </div>
        <p class="eltex-footer-address">Eltex group shpk, Llapnasellë, Qagllavic 10000</p>
      </div>
      <div>
        <h4>Kontakt</h4>
        <div class="footer-contact-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <a href="tel:+38344722311">+383 44 722 311</a>
        </div>
        <div class="footer-contact-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <a href="tel:+38349404696">+383 49 404 696</a>
        </div>
        <div class="footer-contact-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          <a href="mailto:info@eltexgroup-ks.com">info@eltexgroup-ks.com</a>
        </div>
      </div>
      <div>
        <h4>Rrjetet Tona Sociale</h4>
        <div class="social-links">
          <a href="#" class="social-link" aria-label="Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          </a>
          <a href="#" class="social-link" aria-label="Instagram">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </a>
          <a href="#" class="social-link" aria-label="LinkedIn">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
          </a>
        </div>
      </div>
    </div>
    <div class="eltex-copyright">
      © 2026 ELTEXGROUP. Të gjitha të drejtat e rezervuara.
    </div>
  </div>
</footer>`;

  document.querySelectorAll('[data-eltex-footer]').forEach((mount) => {
    mount.outerHTML = footerHtml;
  });
})();
