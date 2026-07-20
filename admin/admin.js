(function () {
  const TOKEN_KEY = 'eltex_admin_token';

  const loginScreen = document.getElementById('login-screen');
  const app = document.getElementById('app');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const logoutBtn = document.getElementById('logout-btn');
  const productsTable = document.getElementById('products-table');
  const postsTable = document.getElementById('posts-table');
  const productSearch = document.getElementById('product-search');
  const postSearch = document.getElementById('post-search');
  const orderSearch = document.getElementById('order-search');
  const orderStatusFilter = document.getElementById('order-status-filter');
  const ordersTable = document.getElementById('orders-table');
  const editorDialog = document.getElementById('editor-dialog');
  const editorForm = document.getElementById('editor-form');
  const editorTitle = document.getElementById('editor-title');
  const editorFields = document.getElementById('editor-fields');
  const deleteItemBtn = document.getElementById('delete-item-btn');
  const toast = document.getElementById('toast');
  const loginSubmitBtn = loginForm.querySelector('button[type="submit"]');
  const editorSubmitBtn = editorForm.querySelector('button[type="submit"]');

  let productsData = { products: [], categories: [] };
  let postsData = [];
  let ordersData = [];
  let editorMode = null;
  let editorIndex = -1;

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setToken(value) {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token()) headers.Authorization = 'Bearer ' + token();
    const res = await fetch(path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      const isLogin = path === '/api/login';
      if (!isLogin && token()) {
        setToken('');
        app.hidden = true;
        loginScreen.hidden = false;
        throw new Error('Sesioni skadoi. Kyçuni përsëri.');
      }
      throw new Error(data.error || 'Gabim serveri');
    }
    if (!res.ok) throw new Error(data.error || 'Gabim serveri');
    return data;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toast.hidden = true;
    }, 2800);
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function emptyRow(colspan, message) {
    return `<tr><td colspan="${colspan}" class="table-empty">${escapeHtml(message)}</td></tr>`;
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
    button.disabled = busy;
    if (button.tagName === 'INPUT') {
      button.value = busy ? busyLabel : button.dataset.defaultLabel;
    } else {
      button.textContent = busy ? busyLabel : button.dataset.defaultLabel;
    }
  }

  function slugify(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  const pageTitle = document.getElementById('page-title');

  const TAB_LABELS = {
    products: 'Produktet',
    posts: 'Blog B2B',
    orders: 'Porositë',
  };

  function setBadge(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value > 0 ? String(value) : '';
  }

  function switchTab(name) {
    document.querySelectorAll('.sidebar-link').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.tab === name);
    });
    document.getElementById('panel-products').hidden = name !== 'products';
    document.getElementById('panel-posts').hidden = name !== 'posts';
    document.getElementById('panel-orders').hidden = name !== 'orders';
    if (pageTitle) pageTitle.textContent = TAB_LABELS[name] || 'Admin';
  }

  function formatOrderDate(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('sq-AL');
    } catch {
      return value;
    }
  }

  function orderStatusLabel(status) {
    const map = {
      new: 'E re',
      processing: 'Në përpunim',
      done: 'Përfunduar',
      cancelled: 'Anuluar',
    };
    return map[status] || status;
  }

  function renderOrders() {
    const q = orderSearch.value.trim().toLowerCase();
    const status = orderStatusFilter.value;
    const rows = ordersData.filter((order) => {
      if (status && order.status !== status) return false;
      if (!q) return true;
      const hay = [
        order.id,
        order.customer && order.customer.name,
        order.customer && order.customer.email,
        order.customer && order.customer.phone,
        order.customer && order.customer.company,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });

    const newCount = ordersData.filter((o) => o.status === 'new').length;
    setBadge('orders-count', newCount || ordersData.length);

    ordersTable.innerHTML = rows.length
      ? rows
          .map((order) => {
            const itemCount = (order.items || []).reduce((sum, item) => sum + item.qty, 0);
            const customer = order.customer || {};
            return `
        <tr>
          <td>${escapeHtml(formatOrderDate(order.createdAt))}</td>
          <td>
            <strong>${escapeHtml(customer.name)}</strong><br>
            <span class="muted-inline">${escapeHtml(customer.email)}</span>
          </td>
          <td>${itemCount} copë</td>
          <td>€${Number(order.total || 0).toFixed(2)}</td>
          <td><span class="status-badge status-${escapeHtml(order.status || 'new')}">${escapeHtml(orderStatusLabel(order.status))}</span></td>
          <td><button type="button" class="btn ghost small" data-view-order="${escapeHtml(order.id)}">Shiko</button></td>
        </tr>`;
          })
          .join('')
      : emptyRow(6, ordersData.length ? 'Asnjë porosi nuk përputhet me kërkimin.' : 'Ende nuk ka porosi.');
  }

  function openOrderViewer(orderId) {
    const order = ordersData.find((entry) => entry.id === orderId);
    if (!order) return;

    editorMode = 'order';
    editorIndex = ordersData.indexOf(order);
    editorTitle.textContent = 'Porosia ' + order.id.slice(-8).toUpperCase();
    deleteItemBtn.hidden = true;

    const itemsHtml = (order.items || [])
      .map(
        (item) =>
          '<tr><td>' +
          escapeHtml(item.name) +
          '</td><td>' +
          item.qty +
          '</td><td>€' +
          Number(item.price).toFixed(2) +
          '</td><td>€' +
          Number(item.lineTotal).toFixed(2) +
          '</td></tr>'
      )
      .join('');

    const customer = order.customer || {};

    editorFields.innerHTML = `
      <div class="order-detail">
        <p><strong>Klienti:</strong> ${escapeHtml(customer.name)}<br>
        <strong>Email:</strong> ${escapeHtml(customer.email)}<br>
        <strong>Telefoni:</strong> ${escapeHtml(customer.phone)}${
          customer.company
            ? '<br><strong>Kompania:</strong> ' + escapeHtml(customer.company)
            : ''
        }${
          customer.notes
            ? '<br><strong>Shënime:</strong> ' + escapeHtml(customer.notes)
            : ''
        }</p>
        <table class="data-table compact">
          <thead><tr><th>Produkti</th><th>Sasia</th><th>Çmimi</th><th>Totali</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p><strong>Totali: €${Number(order.total || 0).toFixed(2)}</strong></p>
        <div class="field-grid">
          <div>
            <label for="order-status">Statusi</label>
            <select name="status" id="order-status">
              <option value="new"${order.status === 'new' ? ' selected' : ''}>E re</option>
              <option value="processing"${order.status === 'processing' ? ' selected' : ''}>Në përpunim</option>
              <option value="done"${order.status === 'done' ? ' selected' : ''}>Përfunduar</option>
              <option value="cancelled"${order.status === 'cancelled' ? ' selected' : ''}>Anuluar</option>
            </select>
          </div>
        </div>
      </div>`;
    editorDialog.showModal();
  }

  async function saveOrderStatus(orderId, status) {
    await api('/api/orders/' + encodeURIComponent(orderId), {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    showToast('Statusi u përditësua');
    ordersData = await api('/api/orders');
    renderOrders();
  }

  function renderProducts() {
    const q = productSearch.value.trim().toLowerCase();
    const rows = productsData.products.filter((p) => {
      if (!q) return true;
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.cat || '').toLowerCase().includes(q) ||
        (p.slug || '').toLowerCase().includes(q)
      );
    });

    setBadge('products-count', productsData.products.length);
    productsTable.innerHTML = rows.length
      ? rows
          .map((p) => {
            const idx = productsData.products.indexOf(p);
            return `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(p.cat || '')}</td>
          <td>€${Number(p.price || 0).toFixed(2)}</td>
          <td class="slug-cell">${escapeHtml(p.slug)}</td>
          <td><button type="button" class="btn ghost small" data-edit-product="${idx}">Ndrysho</button></td>
        </tr>`;
          })
          .join('')
      : emptyRow(5, productsData.products.length ? 'Asnjë produkt nuk përputhet me kërkimin.' : 'Nuk ka produkte.');
  }

  function renderPosts() {
    const q = postSearch.value.trim().toLowerCase();
    const rows = postsData.filter((p) => {
      if (!q) return true;
      return (
        (p.title || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.slug || '').toLowerCase().includes(q)
      );
    });

    setBadge('posts-count', postsData.length);
    postsTable.innerHTML = rows.length
      ? rows
          .map((p) => {
            const idx = postsData.indexOf(p);
            return `
        <tr>
          <td>${escapeHtml(p.title)}</td>
          <td>${escapeHtml(p.category || '')}</td>
          <td>${escapeHtml(p.date || '')}</td>
          <td class="slug-cell">${escapeHtml(p.slug)}</td>
          <td><button type="button" class="btn ghost small" data-edit-post="${idx}">Ndrysho</button></td>
        </tr>`;
          })
          .join('')
      : emptyRow(5, postsData.length ? 'Asnjë artikull nuk përputhet me kërkimin.' : 'Nuk ka artikuj.');
  }

  async function loadAll() {
    const [products, posts, orders] = await Promise.all([
      api('/api/products'),
      api('/api/posts'),
      api('/api/orders'),
    ]);
    productsData = products;
    postsData = posts;
    ordersData = orders;
    renderProducts();
    renderPosts();
    renderOrders();
  }

  async function saveProducts() {
    await api('/api/products', {
      method: 'PUT',
      body: JSON.stringify(productsData),
    });
    productsData = await api('/api/products');
    showToast('Produktet u ruajtën');
    renderProducts();
  }

  async function savePosts() {
    await api('/api/posts', {
      method: 'PUT',
      body: JSON.stringify(postsData),
    });
    postsData = await api('/api/posts');
    showToast('Artikujt u ruajtën');
    renderPosts();
  }

  function field(name, label, opts = {}) {
    const type = opts.type || 'text';
    const cls = opts.full ? 'full' : '';
    if (type === 'textarea') {
      return `<div class="${cls}"><label>${escapeHtml(label)}</label><textarea name="${name}" rows="${opts.rows || 5}"></textarea></div>`;
    }
    return `<div class="${cls}"><label>${escapeHtml(label)}</label><input type="${type}" name="${name}" ${opts.step ? `step="${opts.step}"` : ''}></div>`;
  }

  function fillEditorFields(values) {
    editorFields.querySelectorAll('[name]').forEach((el) => {
      if (Object.prototype.hasOwnProperty.call(values, el.name)) {
        el.value = values[el.name] == null ? '' : String(values[el.name]);
      }
    });
  }

  function openProductEditor(index) {
    editorMode = 'product';
    editorIndex = index;
    const isNew = index < 0;
    const p = isNew
      ? { id: String(Date.now()), slug: '', name: '', cat: '', price: 0, image: '', short_description: '', description: '', categories: [] }
      : { ...productsData.products[index] };

    editorTitle.textContent = isNew ? 'Produkt i Ri' : 'Ndrysho Produktin';
    deleteItemBtn.hidden = isNew;
    editorFields.innerHTML = `
      <div class="field-grid">
        ${field('name', 'Emri i produktit *', { full: true })}
        ${field('slug', 'Slug (URL)')}
        ${field('price', 'Çmimi (EUR)', { type: 'number', step: '0.01' })}
        ${field('cat', 'Kategoria *')}
        ${field('image', 'URL e imazhit', { full: true })}
        ${field('short_description', 'Përshkrim i shkurtër', { type: 'textarea', full: true, rows: 4 })}
        ${field('description', 'Përshkrim i plotë', { type: 'textarea', full: true, rows: 8 })}
      </div>`;
    fillEditorFields({
      name: p.name || '',
      slug: p.slug || '',
      price: p.price ?? 0,
      cat: p.cat || '',
      image: p.image || '',
      short_description: p.short_description || '',
      description: p.description || '',
    });
    editorDialog.showModal();
  }

  function openPostEditor(index) {
    editorMode = 'post';
    editorIndex = index;
    const isNew = index < 0;
    const p = isNew
      ? { id: Date.now(), slug: '', title: '', category: 'B2B Artikuj', date: new Date().toISOString().slice(0, 10), image: '', excerpt: '', content: '' }
      : { ...postsData[index] };

    editorTitle.textContent = isNew ? 'Artikull i Ri' : 'Ndrysho Artikullin';
    deleteItemBtn.hidden = isNew;
    editorFields.innerHTML = `
      <div class="field-grid">
        ${field('title', 'Titulli *', { full: true })}
        ${field('slug', 'Slug (URL)')}
        ${field('category', 'Kategoria')}
        ${field('date', 'Data', { type: 'date' })}
        ${field('image', 'URL e imazhit', { full: true })}
        ${field('excerpt', 'Përmbledhje', { type: 'textarea', full: true, rows: 3 })}
        ${field('content', 'Përmbajtja (HTML)', { type: 'textarea', full: true, rows: 12 })}
      </div>`;
    fillEditorFields({
      title: p.title || '',
      slug: p.slug || '',
      category: p.category || '',
      date: p.date || '',
      image: p.image || '',
      excerpt: p.excerpt || '',
      content: p.content || '',
    });
    editorDialog.showModal();
  }

  function readForm() {
    const data = {};
    editorFields.querySelectorAll('[name]').forEach((el) => {
      data[el.name] = el.type === 'number' ? Number(el.value) : el.value.trim();
    });
    return data;
  }

  editorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readForm();

    try {
      setBusy(editorSubmitBtn, true, 'Duke ruajtur...');

      if (editorMode === 'order') {
        const order = ordersData[editorIndex];
        const status = editorFields.querySelector('[name="status"]').value;
        await saveOrderStatus(order.id, status);
        editorDialog.close();
        return;
      }

      if (editorMode === 'product') {
        if (!data.name) throw new Error('Emri i produktit është i detyrueshëm');
        if (!data.cat) throw new Error('Kategoria është e detyrueshme');
        if (!data.slug) data.slug = slugify(data.name);
        data.id = editorIndex < 0 ? String(Date.now()) : productsData.products[editorIndex].id;
        data.currency = 'EUR';
        data.price = Number(data.price) || 0;
        data.categories = data.cat ? [data.cat] : [];
        data.permalink = '/produkt/' + data.slug;

        if (editorIndex < 0) productsData.products.unshift(data);
        else productsData.products[editorIndex] = { ...productsData.products[editorIndex], ...data };

        await saveProducts();
      } else if (editorMode === 'post') {
        if (!data.title) throw new Error('Titulli është i detyrueshëm');
        if (!data.slug) data.slug = slugify(data.title);
        data.id = editorIndex < 0 ? Date.now() : postsData[editorIndex].id;

        if (editorIndex < 0) postsData.unshift(data);
        else postsData[editorIndex] = { ...postsData[editorIndex], ...data };

        await savePosts();
      }

      editorDialog.close();
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusy(editorSubmitBtn, false, 'Ruaj');
    }
  });

  deleteItemBtn.addEventListener('click', async () => {
    if (!confirm('Je i sigurt që do ta fshish?')) return;
    try {
      if (editorMode === 'product' && editorIndex >= 0) {
        productsData.products.splice(editorIndex, 1);
        await saveProducts();
      } else if (editorMode === 'post' && editorIndex >= 0) {
        postsData.splice(editorIndex, 1);
        await savePosts();
      }
      editorDialog.close();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('close-dialog').addEventListener('click', () => editorDialog.close());
  document.getElementById('cancel-dialog').addEventListener('click', () => editorDialog.close());

  ordersTable.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view-order]');
    if (btn) openOrderViewer(btn.dataset.viewOrder);
  });

  orderSearch.addEventListener('input', renderOrders);
  orderStatusFilter.addEventListener('change', renderOrders);

  productsTable.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit-product]');
    if (btn) openProductEditor(Number(btn.dataset.editProduct));
  });

  postsTable.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit-post]');
    if (btn) openPostEditor(Number(btn.dataset.editPost));
  });

  document.getElementById('add-product-btn').addEventListener('click', () => openProductEditor(-1));
  document.getElementById('add-post-btn').addEventListener('click', () => openPostEditor(-1));
  productSearch.addEventListener('input', renderProducts);
  postSearch.addEventListener('input', renderPosts);

  document.querySelectorAll('.sidebar-link').forEach((tab) => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true;
    try {
      setBusy(loginSubmitBtn, true, 'Duke u kyçur...');
      const res = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ password: document.getElementById('password').value }),
      });
      setToken(res.token);
      loginScreen.hidden = true;
      app.hidden = false;
      await loadAll();
    } catch (err) {
      loginError.textContent = err.message;
      loginError.hidden = false;
    } finally {
      setBusy(loginSubmitBtn, false, 'Hyr në panel');
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await api('/api/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    setToken('');
    app.hidden = true;
    loginScreen.hidden = false;
    document.getElementById('password').value = '';
  });

  async function boot() {
    if (!token()) return;
    try {
      await api('/api/me');
      loginScreen.hidden = true;
      app.hidden = false;
      await loadAll();
    } catch (err) {
      setToken('');
      if (err.message && !err.message.includes('Sesioni skadoi')) {
        loginError.textContent = err.message;
        loginError.hidden = false;
      }
    }
  }

  boot();
})();
