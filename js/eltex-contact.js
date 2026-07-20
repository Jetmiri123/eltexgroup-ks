(function () {
  const form = document.getElementById('wf-form-Contact-1-Form');
  if (!form) return;

  const success = form.parentElement.querySelector('.w-form-done');
  const error = form.parentElement.querySelector('.w-form-fail');
  const submitBtn = form.querySelector('[type="submit"]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (success) success.style.display = 'none';
    if (error) error.style.display = 'none';

    const fd = new FormData(form);
    const payload = {
      name: String(fd.get('Name') || '').trim(),
      email: String(fd.get('Email') || '').trim(),
      phone: String(fd.get('Phone') || '').trim(),
      message: String(fd.get('Message') || '').trim(),
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.value = submitBtn.dataset.wait || 'Duke u dërguar...';
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Mesazhi nuk u dërgua');

      form.reset();
      if (success) success.style.display = 'block';
    } catch (err) {
      if (error) {
        error.style.display = 'block';
        const text = error.querySelector('.error-text');
        if (text) text.textContent = err.message || 'Gabim gjatë dërgimit.';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.value = 'Dërgo';
      }
    }
  });
})();
