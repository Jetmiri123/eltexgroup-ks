(function () {
  const form = document.getElementById('checkout-form');
  const success = document.getElementById('checkout-success');
  const checkoutWrap = document.getElementById('cart-step-checkout');
  const stepReview = document.getElementById('cart-step-review');
  const headline = document.getElementById('cart-page-headline');
  const errorEl = document.getElementById('checkout-error');
  const submitBtn = document.getElementById('checkout-submit');

  if (!form || !window.EltexCart) return;

  async function validateCartItems() {
    const result = await window.EltexCart.syncFromCatalog({ notify: false });
    if (!result.cart.length) {
      throw new Error('Shporta është bosh. Shtoni produkte nga katalogu.');
    }
    return result;
  }

  function setError(message) {
    if (!errorEl) return;
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = '';
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function buildPayload() {
    const items = window.EltexCart.read();
    if (!items.length) {
      throw new Error('Shporta është bosh.');
    }

    const fd = new FormData(form);
    return {
      customer: {
        name: String(fd.get('name') || '').trim(),
        email: String(fd.get('email') || '').trim(),
        phone: String(fd.get('phone') || '').trim(),
        company: String(fd.get('company') || '').trim(),
        notes: String(fd.get('notes') || '').trim(),
      },
      items: items.map((item) => ({
        id: item.id,
        slug: item.slug,
        qty: item.qty,
      })),
    };
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setError('');

    let payload;
    try {
      const syncResult = await validateCartItems();
      if (syncResult.removed.length) {
        document.dispatchEvent(new CustomEvent('eltex-cart-updated'));
        if (!syncResult.cart.length) {
          setError('Shporta është bosh. Shtoni produkte nga katalogu.');
          return;
        }
        setError('Disa produkte u hoqën sepse nuk gjenden më në katalog. Kontrolloni shportën dhe provoni përsëri.');
        return;
      }
      payload = buildPayload();
    } catch (err) {
      setError(err.message || 'Shporta është bosh.');
      return;
    }

    submitBtn.disabled = true;
    const defaultLabel = submitBtn.value;
    submitBtn.value = 'Duke dërguar...';

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Porosia nuk u dërgua. Provoni përsëri.');
      }

      window.EltexCart.clear();
      document.getElementById('cart-items').innerHTML = '';
      if (stepReview) stepReview.hidden = true;
      if (headline) headline.hidden = true;
      if (checkoutWrap) checkoutWrap.hidden = true;
      if (success) {
        success.hidden = false;
        const ref = document.getElementById('checkout-order-id');
        if (ref) {
          const id = data.orderRef || data.orderId || '';
          ref.textContent = id.startsWith('#') ? id : '#' + String(id).slice(-8).toUpperCase();
        }
      }
    } catch (err) {
      setError(err.message || 'Porosia nuk u dërgua.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.value = defaultLabel;
    }
  });
})();
