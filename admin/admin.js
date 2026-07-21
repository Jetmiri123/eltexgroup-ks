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
  const productCategoryFilter = document.getElementById('product-category-filter');
  const productCategoryTags = document.getElementById('product-category-tags');
  const productFilterMeta = document.getElementById('product-filter-meta');
  const postSearch = document.getElementById('post-search');
  const orderSearch = document.getElementById('order-search');
  const orderStatusFilter = document.getElementById('order-status-filter');
  const ordersTable = document.getElementById('orders-table');
  const submissionSearch = document.getElementById('submission-search');
  const submissionTypeFilter = document.getElementById('submission-type-filter');
  const submissionStatusFilter = document.getElementById('submission-status-filter');
  const submissionsTable = document.getElementById('submissions-table');
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
  let submissionsData = [];
  let editorMode = null;
  let editorIndex = -1;
  let richEditors = {};
  let selectedProductCategorySlug = '';

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

  function decodeHtml(text) {
    const el = document.createElement('textarea');
    el.innerHTML = text || '';
    return el.value;
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function htmlToPlainText(html) {
    const div = document.createElement('div');
    div.innerHTML = html || '';
    return div.textContent.replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').trim();
  }

  function plainTextToRichHtml(text) {
    if (!text) return '';
    if (/<[^>]+>/.test(text)) return text;

    const lines = String(text).split('\n').map((line) => line.trim());
    const parts = [];
    let index = 0;

    while (index < lines.length) {
      while (index < lines.length && !lines[index]) index += 1;
      if (index >= lines.length) break;

      if (/^[•\-–*]\s/.test(lines[index])) {
        const items = [];
        while (index < lines.length) {
          while (index < lines.length && !lines[index]) index += 1;
          if (index >= lines.length || !/^[•\-–*]\s/.test(lines[index])) break;
          items.push(lines[index].replace(/^[•\-–*]\s*/, ''));
          index += 1;
        }
        parts.push(
          '<ul>' +
            items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') +
            '</ul>'
        );
        continue;
      }

      const paragraph = [];
      while (index < lines.length && lines[index] && !/^[•\-–*]\s/.test(lines[index])) {
        paragraph.push(lines[index]);
        index += 1;
      }
      parts.push('<p>' + escapeHtml(paragraph.join(' ')) + '</p>');
    }

    return parts.join('');
  }

  function richContentForEditor(item, field) {
    const htmlValue = item[field + '_html'] || '';
    if (htmlValue && /<[^>]+>/.test(htmlValue)) return htmlValue;
    return plainTextToRichHtml(item[field] || '');
  }

  function emptyRow(colspan, message) {
    return `<tr><td colspan="${colspan}" class="table-empty">${escapeHtml(message)}</td></tr>`;
  }

  function productThumb(image, alt) {
    if (image) {
      return `<img src="${escapeHtml(image)}" alt="${escapeHtml(alt)}" class="table-thumb" loading="lazy">`;
    }
    return '<div class="table-thumb placeholder">—</div>';
  }

  function categoryOptions() {
    const cats = (productsData.categories || []).map((c) => c.name).filter(Boolean);
    const fromProducts = productsData.products.map((p) => p.cat).filter(Boolean);
    const unique = [...new Set([...cats, ...fromProducts])].sort((a, b) => a.localeCompare(b, 'sq'));
    return unique.map((name) => `<option value="${escapeHtml(name)}"></option>`).join('');
  }

  function categoryField(name, label) {
    return `<div class="full">
      <label for="${name}">${escapeHtml(label)}</label>
      <input type="text" name="${name}" id="${name}" list="${name}-list" autocomplete="off" placeholder="Zgjidhni ose shkruani kategori">
      <datalist id="${name}-list">${categoryOptions()}</datalist>
    </div>`;
  }

  function imageUploadField(currentUrl, label) {
    const fieldLabel = label || 'Imazhi';
    const safeUrl = escapeHtml(currentUrl || '');
    return `<div class="full image-upload" data-image-upload>
      <label>${escapeHtml(fieldLabel)}</label>
      <div class="image-dropzone${currentUrl ? ' has-image' : ''}" data-dropzone>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-file-input>
        <div class="image-dropzone-content" data-dropzone-empty${currentUrl ? ' hidden' : ''}>
          <div class="image-dropzone-icon">📷</div>
          <p class="image-dropzone-title">Tërhiqni imazhin këtu</p>
          <p class="image-dropzone-sub">ose klikoni për të ngarkuar · PNG, JPG, WEBP · max 2MB</p>
        </div>
        <div class="image-preview-wrap"${currentUrl ? '' : ' hidden'} data-preview-wrap>
          <img src="${safeUrl}" alt="" class="image-preview" data-preview>
          <div class="image-preview-actions">
            <button type="button" class="btn ghost small" data-change-image>Ndrysho</button>
            <button type="button" class="btn ghost small" data-remove-image>Hiq</button>
          </div>
        </div>
        <p class="upload-progress" hidden data-upload-status></p>
      </div>
      <div class="image-url-row">
        <input type="url" name="image" value="${safeUrl}" placeholder="https://..." data-image-url>
        <button type="button" class="btn ghost small image-url-toggle" data-toggle-url>URL</button>
      </div>
      <p class="field-hint">Ngarkoni një foto ose vendosni linkun e imazhit.</p>
    </div>`;
  }

  function bindImageUpload(container) {
    const root = container.querySelector('[data-image-upload]');
    if (!root) return;

    const dropzone = root.querySelector('[data-dropzone]');
    const fileInput = root.querySelector('[data-file-input]');
    const urlInput = root.querySelector('[data-image-url]');
    const preview = root.querySelector('[data-preview]');
    const previewWrap = root.querySelector('[data-preview-wrap]');
    const emptyState = root.querySelector('[data-dropzone-empty]');
    const statusEl = root.querySelector('[data-upload-status]');
    const changeBtn = root.querySelector('[data-change-image]');
    const removeBtn = root.querySelector('[data-remove-image]');
    const toggleUrlBtn = root.querySelector('[data-toggle-url]');

    let urlRowVisible = Boolean(urlInput.value.trim());

    function setPreview(url) {
      urlInput.value = url || '';
      if (url) {
        preview.src = url;
        previewWrap.hidden = false;
        emptyState.hidden = true;
        dropzone.classList.add('has-image');
      } else {
        preview.removeAttribute('src');
        previewWrap.hidden = true;
        emptyState.hidden = false;
        dropzone.classList.remove('has-image');
      }
    }

    function syncUrlRow() {
      urlInput.parentElement.hidden = !urlRowVisible;
      toggleUrlBtn.textContent = urlRowVisible ? 'Fshih URL' : 'URL';
    }

    syncUrlRow();

    toggleUrlBtn.addEventListener('click', () => {
      urlRowVisible = !urlRowVisible;
      syncUrlRow();
    });

    changeBtn.addEventListener('click', () => fileInput.click());

    removeBtn.addEventListener('click', () => {
      fileInput.value = '';
      setPreview('');
    });

    urlInput.addEventListener('input', () => {
      const url = urlInput.value.trim();
      if (url) setPreview(url);
    });

    async function handleFile(file) {
      statusEl.hidden = false;
      statusEl.textContent = 'Duke ngarkuar...';
      try {
        const url = await uploadImageFile(file);
        setPreview(url);
        showToast('Imazhi u ngarkua');
      } catch (err) {
        showToast(err.message || 'Ngarkimi dështoi');
      } finally {
        statusEl.hidden = true;
        statusEl.textContent = '';
        fileInput.value = '';
      }
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (file) handleFile(file);
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }

  async function uploadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      throw new Error('Zgjidhni një imazh të vlefshëm (PNG, JPG, WEBP)');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Imazhi duhet të jetë nën 2MB');
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);

    const result = await api('/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        data: btoa(binary),
        filename: file.name,
        contentType: file.type,
      }),
    });

    return result.url;
  }

  function isEmptyRichHtml(html) {
    const text = String(html || '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    return !text;
  }

  function richField(name, label, opts = {}) {
    const tallClass = opts.tall ? ' rich-tall' : '';
    const hint = opts.hint
      ? `<p class="field-hint">${escapeHtml(opts.hint)}</p>`
      : '<p class="field-hint">Përdorni Enter për rreshta të rinj dhe butonin e listës për pikat (•).</p>';
    return `<div class="full rich-field${tallClass}">
      <label>${escapeHtml(label)}</label>
      <div data-rich-editor="${escapeHtml(name)}"></div>
      ${hint}
    </div>`;
  }

  function resetRichEditors() {
    richEditors = {};
  }

  function initRichEditors(container, values) {
    resetRichEditors();
    if (typeof Quill === 'undefined') return;

    container.querySelectorAll('[data-rich-editor]').forEach((el) => {
      const name = el.dataset.richEditor;

      const quill = new Quill(el, {
        theme: 'snow',
        placeholder: 'Shkruani këtu...',
        modules: {
          toolbar: {
            container: [
              [{ header: [2, 3, false] }],
              ['bold', 'italic', 'underline'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['link', 'image'],
              ['clean'],
            ],
            handlers: {
              image: function handleEditorImage() {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/jpeg,image/png,image/webp,image/gif';
                input.onchange = async () => {
                  const file = input.files && input.files[0];
                  if (!file) return;
                  try {
                    const url = await uploadImageFile(file);
                    const range = quill.getSelection(true);
                    quill.insertEmbed(range.index, 'image', url);
                    quill.setSelection(range.index + 1);
                    showToast('Imazhi u shtua');
                  } catch (err) {
                    showToast(err.message || 'Ngarkimi dështoi');
                  }
                };
                input.click();
              },
            },
          },
        },
      });

      const html = values[name] || '';
      if (html) {
        quill.clipboard.dangerouslyPasteHTML(html);
      }

      richEditors[name] = quill;
    });
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
    submissions: 'Mesazhet',
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
    document.getElementById('panel-submissions').hidden = name !== 'submissions';
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
          <td class="table-actions">
            <button type="button" class="btn ghost small" data-view-order="${escapeHtml(order.id)}">Shiko</button>
            <button type="button" class="btn danger small" data-delete-order="${escapeHtml(order.id)}">Fshi</button>
          </td>
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
    deleteItemBtn.hidden = false;

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

  async function deleteOrder(orderId) {
    await api('/api/orders/' + encodeURIComponent(orderId), { method: 'DELETE' });
    showToast('Porosia u fshi');
    ordersData = await api('/api/orders');
    renderOrders();
  }

  function submissionTypeLabel(type) {
    const map = {
      contact: 'Kontakt',
      newsletter: 'Newsletter',
    };
    return map[type] || type;
  }

  function submissionStatusLabel(status) {
    const map = {
      new: 'E re',
      read: 'E lexuar',
      archived: 'Arkivuar',
    };
    return map[status] || status;
  }

  function renderSubmissions() {
    const q = submissionSearch.value.trim().toLowerCase();
    const type = submissionTypeFilter.value;
    const status = submissionStatusFilter.value;
    const rows = submissionsData.filter((entry) => {
      if (type && entry.type !== type) return false;
      if (status && entry.status !== status) return false;
      if (!q) return true;
      const hay = [entry.id, entry.name, entry.email, entry.phone, entry.message, entry.type]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });

    const newCount = submissionsData.filter((entry) => entry.status === 'new').length;
    setBadge('submissions-count', newCount || submissionsData.length);

    submissionsTable.innerHTML = rows.length
      ? rows
          .map((entry) => {
            return `
        <tr>
          <td>${escapeHtml(formatOrderDate(entry.createdAt))}</td>
          <td>${escapeHtml(submissionTypeLabel(entry.type))}</td>
          <td><strong>${escapeHtml(entry.name || '—')}</strong></td>
          <td><span class="muted-inline">${escapeHtml(entry.email)}</span></td>
          <td><span class="status-badge status-${escapeHtml(entry.status || 'new')}">${escapeHtml(submissionStatusLabel(entry.status))}</span></td>
          <td class="table-actions">
            <button type="button" class="btn ghost small" data-view-submission="${escapeHtml(entry.id)}">Shiko</button>
            <button type="button" class="btn danger small" data-delete-submission="${escapeHtml(entry.id)}">Fshi</button>
          </td>
        </tr>`;
          })
          .join('')
      : emptyRow(
          6,
          submissionsData.length ? 'Asnjë mesazh nuk përputhet me kërkimin.' : 'Ende nuk ka mesazhe.'
        );
  }

  function openSubmissionViewer(submissionId) {
    const entry = submissionsData.find((item) => item.id === submissionId);
    if (!entry) return;

    editorMode = 'submission';
    editorIndex = submissionsData.indexOf(entry);
    editorTitle.textContent = submissionTypeLabel(entry.type) + ' — ' + entry.id.slice(-8).toUpperCase();
    deleteItemBtn.hidden = false;

    editorFields.innerHTML = `
      <div class="order-detail">
        <p><strong>Lloji:</strong> ${escapeHtml(submissionTypeLabel(entry.type))}<br>
        <strong>Data:</strong> ${escapeHtml(formatOrderDate(entry.createdAt))}<br>
        <strong>Emri:</strong> ${escapeHtml(entry.name || '—')}<br>
        <strong>Email:</strong> ${escapeHtml(entry.email)}${
          entry.phone ? '<br><strong>Telefoni:</strong> ' + escapeHtml(entry.phone) : ''
        }</p>
        ${
          entry.message
            ? '<p><strong>Mesazhi:</strong><br>' + escapeHtml(entry.message).replace(/\n/g, '<br>') + '</p>'
            : ''
        }
        <div class="field-grid">
          <div>
            <label for="submission-status">Statusi</label>
            <select name="status" id="submission-status">
              <option value="new"${entry.status === 'new' ? ' selected' : ''}>E re</option>
              <option value="read"${entry.status === 'read' ? ' selected' : ''}>E lexuar</option>
              <option value="archived"${entry.status === 'archived' ? ' selected' : ''}>Arkivuar</option>
            </select>
          </div>
        </div>
      </div>`;
    editorDialog.showModal();
  }

  async function saveSubmissionStatus(submissionId, status) {
    await api('/api/submissions/' + encodeURIComponent(submissionId), {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    showToast('Statusi u përditësua');
    submissionsData = await api('/api/submissions');
    renderSubmissions();
  }

  async function deleteSubmission(submissionId) {
    await api('/api/submissions/' + encodeURIComponent(submissionId), { method: 'DELETE' });
    showToast('Mesazhi u fshi');
    submissionsData = await api('/api/submissions');
    renderSubmissions();
  }

  function truncateTagLabel(text, maxLen) {
    const label = decodeHtml(text || '');
    if (label.length <= maxLen) return label;
    return label.slice(0, maxLen - 1).trim() + '…';
  }

  function productCategorySlug(product) {
    return slugify(product.cat || 'Të Tjera');
  }

  function productMatchesSearch(product, query) {
    if (!query) return true;
    const hay = [
      product.name,
      product.cat,
      product.slug,
      product.sku,
      product.id,
      ...(product.categories || []),
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(query);
  }

  function getProductCategoryOptions() {
    const map = new Map();

    productsData.products.forEach((product) => {
      const name = product.cat || 'Të Tjera';
      const slug = slugify(name);
      const entry = map.get(slug);
      if (entry) {
        entry.count += 1;
        return;
      }
      map.set(slug, { name, slug, count: 1 });
    });

    (productsData.categories || []).forEach((cat) => {
      if (!cat || !cat.name) return;
      const slug = cat.slug || slugify(cat.name);
      if (!map.has(slug)) {
        map.set(slug, { name: cat.name, slug, count: cat.count || 0 });
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || decodeHtml(a.name).localeCompare(decodeHtml(b.name), 'sq')
    );
  }

  function syncProductCategoryFilter() {
    if (!productCategoryFilter) return;

    const current = selectedProductCategorySlug;
    const options = getProductCategoryOptions();
    productCategoryFilter.innerHTML =
      '<option value="">Të gjitha kategoritë</option>' +
      options
        .map(
          (cat) =>
            `<option value="${escapeHtml(cat.slug)}"${cat.slug === current ? ' selected' : ''}>${escapeHtml(decodeHtml(cat.name))} (${cat.count})</option>`
        )
        .join('');
  }

  function renderProductCategoryTags(searchMatcher) {
    if (!productCategoryTags) return;

    const matchFn = searchMatcher || (() => true);
    const counts = new Map();

    productsData.products.forEach((product) => {
      if (!matchFn(product)) return;
      const slug = productCategorySlug(product);
      counts.set(slug, (counts.get(slug) || 0) + 1);
    });

    const options = getProductCategoryOptions().filter((cat) => counts.has(cat.slug));
    const visibleTotal = productsData.products.filter(matchFn).length;
    const activeSlug = selectedProductCategorySlug;

    let html =
      `<button type="button" class="filter-tag${!activeSlug ? ' is-active' : ''}" data-cat="" title="Të gjitha produktet">` +
      `Të gjitha <span class="filter-tag-count">${visibleTotal}</span></button>`;

    options.forEach((cat) => {
      const count = counts.get(cat.slug) || 0;
      if (!count) return;
      const label = decodeHtml(cat.name);
      html +=
        `<button type="button" class="filter-tag${activeSlug === cat.slug ? ' is-active' : ''}" data-cat="${escapeHtml(cat.slug)}" title="${escapeHtml(label)}">` +
        `${escapeHtml(truncateTagLabel(label, 34))} <span class="filter-tag-count">${count}</span></button>`;
    });

    productCategoryTags.innerHTML = html;
  }

  function updateProductFilterMeta(visibleCount) {
    if (!productFilterMeta) return;

    const q = productSearch.value.trim();
    const category = getProductCategoryOptions().find((cat) => cat.slug === selectedProductCategorySlug);
    const parts = [`${visibleCount} produkt${visibleCount === 1 ? '' : 'e'}`];

    if (category) parts.push(decodeHtml(category.name));
    if (q) parts.push(`kërkim: “${q}”`);

    if (!selectedProductCategorySlug && !q) {
      productFilterMeta.hidden = true;
      productFilterMeta.textContent = '';
      return;
    }

    productFilterMeta.hidden = false;
    productFilterMeta.textContent = 'Duke shfaqur ' + parts.join(' · ');
  }

  function renderProducts() {
    const q = productSearch.value.trim().toLowerCase();
    const searchMatcher = (product) => productMatchesSearch(product, q);

    renderProductCategoryTags(searchMatcher);
    syncProductCategoryFilter();

    const rows = productsData.products.filter((product) => {
      if (selectedProductCategorySlug && productCategorySlug(product) !== selectedProductCategorySlug) {
        return false;
      }
      return searchMatcher(product);
    });

    updateProductFilterMeta(rows.length);
    setBadge('products-count', productsData.products.length);
    productsTable.innerHTML = rows.length
      ? rows
          .map((p) => {
            const idx = productsData.products.indexOf(p);
            return `
        <tr>
          <td class="thumb-cell">${productThumb(p.image, p.name)}</td>
          <td><strong>${escapeHtml(p.name)}</strong></td>
          <td><span class="table-tag" title="${escapeHtml(decodeHtml(p.cat || ''))}">${escapeHtml(truncateTagLabel(p.cat || '', 42))}</span></td>
          <td>€${Number(p.price || 0).toFixed(2)}</td>
          <td><button type="button" class="btn ghost small" data-edit-product="${idx}">Ndrysho</button></td>
        </tr>`;
          })
          .join('')
      : emptyRow(5, productsData.products.length ? 'Asnjë produkt nuk përputhet me filtrat.' : 'Nuk ka produkte.');
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
          <td class="thumb-cell">${productThumb(p.image, p.title)}</td>
          <td><strong>${escapeHtml(p.title)}</strong></td>
          <td>${escapeHtml(p.category || '')}</td>
          <td>${escapeHtml(p.date || '')}</td>
          <td><button type="button" class="btn ghost small" data-edit-post="${idx}">Ndrysho</button></td>
        </tr>`;
          })
          .join('')
      : emptyRow(5, postsData.length ? 'Asnjë artikull nuk përputhet me kërkimin.' : 'Nuk ka artikuj.');
  }

  async function loadAll() {
    const [products, posts, orders, submissions] = await Promise.all([
      api('/api/products'),
      api('/api/posts'),
      api('/api/orders'),
      api('/api/submissions'),
    ]);
    productsData = products;
    postsData = posts;
    ordersData = orders;
    submissionsData = submissions;
    renderProducts();
    renderPosts();
    renderOrders();
    renderSubmissions();
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
        ${field('price', 'Çmimi (EUR)', { type: 'number', step: '0.01' })}
        ${categoryField('cat', 'Kategoria *')}
        ${imageUploadField(p.image || '')}
        ${richField('short_description', 'Përshkrim i shkurtër')}
        ${richField('description', 'Përshkrim i plotë', { tall: true })}
      </div>`;
    fillEditorFields({
      name: p.name || '',
      price: p.price ?? 0,
      cat: p.cat || '',
    });
    initRichEditors(editorFields, {
      short_description: richContentForEditor(p, 'short_description'),
      description: richContentForEditor(p, 'description'),
    });
    bindImageUpload(editorFields);
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
        ${field('category', 'Kategoria')}
        ${field('date', 'Data', { type: 'date' })}
        ${imageUploadField(p.image || '', 'Imazhi i artikullit')}
        ${richField('excerpt', 'Përmbledhje')}
        ${richField('content', 'Përmbajtja', { tall: true })}
      </div>`;
    fillEditorFields({
      title: p.title || '',
      category: p.category || '',
      date: p.date || '',
    });
    initRichEditors(editorFields, {
      excerpt: p.excerpt || '',
      content: p.content || '',
    });
    bindImageUpload(editorFields);
    editorDialog.showModal();
  }

  function readForm() {
    const data = {};
    editorFields.querySelectorAll('[name]').forEach((el) => {
      if (richEditors[el.name]) return;
      data[el.name] = el.type === 'number' ? Number(el.value) : el.value.trim();
    });
    Object.keys(richEditors).forEach((name) => {
      const html = richEditors[name].root.innerHTML;
      data[name] = isEmptyRichHtml(html) ? '' : html.trim();
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

      if (editorMode === 'submission') {
        const submission = submissionsData[editorIndex];
        const status = editorFields.querySelector('[name="status"]').value;
        await saveSubmissionStatus(submission.id, status);
        editorDialog.close();
        return;
      }

      if (editorMode === 'product') {
        if (!data.name) throw new Error('Emri i produktit është i detyrueshëm');
        if (!data.cat) throw new Error('Kategoria është e detyrueshme');
        if (editorIndex < 0) {
          data.slug = slugify(data.name);
          data.id = String(Date.now());
        } else {
          const existing = productsData.products[editorIndex];
          data.slug = existing.slug || slugify(data.name);
          data.id = existing.id;
        }
        data.currency = 'EUR';
        data.price = Number(data.price) || 0;
        data.categories = data.cat ? [data.cat] : [];
        data.permalink = '/produkt/' + data.slug;
        data.image = editorFields.querySelector('[name="image"]')?.value.trim() || '';

        ['short_description', 'description'].forEach((field) => {
          const html = data[field] || '';
          if (html) {
            data[field + '_html'] = html;
            data[field] = htmlToPlainText(html);
          } else {
            data[field + '_html'] = '';
            data[field] = '';
          }
        });

        if (editorIndex < 0) productsData.products.unshift(data);
        else productsData.products[editorIndex] = { ...productsData.products[editorIndex], ...data };

        await saveProducts();
      } else if (editorMode === 'post') {
        if (!data.title) throw new Error('Titulli është i detyrueshëm');
        if (editorIndex < 0) {
          data.slug = slugify(data.title);
          data.id = Date.now();
        } else {
          const existing = postsData[editorIndex];
          data.slug = existing.slug || slugify(data.title);
          data.id = existing.id;
        }
        data.image = editorFields.querySelector('[name="image"]')?.value.trim() || '';

        if (editorIndex < 0) postsData.unshift(data);
        else postsData[editorIndex] = { ...postsData[editorIndex], ...data };

        await savePosts();
      }

      editorDialog.close();
      resetRichEditors();
    } catch (err) {
      showToast(err.message);
    } finally {
      setBusy(editorSubmitBtn, false, 'Ruaj');
    }
  });

  deleteItemBtn.addEventListener('click', async () => {
    const confirmMessage =
      editorMode === 'order'
        ? 'Je i sigurt që do ta fshish këtë porosi?'
        : editorMode === 'submission'
          ? 'Je i sigurt që do ta fshish këtë mesazh?'
          : 'Je i sigurt që do ta fshish?';
    if (!confirm(confirmMessage)) return;
    try {
      if (editorMode === 'order' && editorIndex >= 0) {
        await deleteOrder(ordersData[editorIndex].id);
      } else if (editorMode === 'submission' && editorIndex >= 0) {
        await deleteSubmission(submissionsData[editorIndex].id);
      } else if (editorMode === 'product' && editorIndex >= 0) {
        productsData.products.splice(editorIndex, 1);
        await saveProducts();
      } else if (editorMode === 'post' && editorIndex >= 0) {
        postsData.splice(editorIndex, 1);
        await savePosts();
      }
      editorDialog.close();
      resetRichEditors();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('close-dialog').addEventListener('click', () => {
    resetRichEditors();
    editorDialog.close();
  });
  document.getElementById('cancel-dialog').addEventListener('click', () => {
    resetRichEditors();
    editorDialog.close();
  });

  ordersTable.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view-order]');
    if (viewBtn) {
      openOrderViewer(viewBtn.dataset.viewOrder);
      return;
    }

    const deleteBtn = e.target.closest('[data-delete-order]');
    if (deleteBtn) {
      if (!confirm('Je i sigurt që do ta fshish këtë porosi?')) return;
      deleteOrder(deleteBtn.dataset.deleteOrder).catch((err) => showToast(err.message));
    }
  });

  orderSearch.addEventListener('input', renderOrders);
  orderStatusFilter.addEventListener('change', renderOrders);

  submissionsTable.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view-submission]');
    if (viewBtn) {
      openSubmissionViewer(viewBtn.dataset.viewSubmission);
      return;
    }

    const deleteBtn = e.target.closest('[data-delete-submission]');
    if (deleteBtn) {
      if (!confirm('Je i sigurt që do ta fshish këtë mesazh?')) return;
      deleteSubmission(deleteBtn.dataset.deleteSubmission).catch((err) => showToast(err.message));
    }
  });

  submissionSearch.addEventListener('input', renderSubmissions);
  submissionTypeFilter.addEventListener('change', renderSubmissions);
  submissionStatusFilter.addEventListener('change', renderSubmissions);

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
  productCategoryFilter.addEventListener('change', () => {
    selectedProductCategorySlug = productCategoryFilter.value || '';
    renderProducts();
  });
  productCategoryTags.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    selectedProductCategorySlug = btn.dataset.cat || '';
    renderProducts();
  });
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
