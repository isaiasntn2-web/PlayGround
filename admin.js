/* RUA 98 — painel administrativo */
(async () => {
  await RUA98.ready();

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const money = value => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const shortMoney = value => Number(value || 0) % 1 === 0
    ? `R$ ${Number(value).toLocaleString('pt-BR')}`
    : money(value);
  const dateBR = value => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    return `${day} ${month} ${date.getFullYear()}`;
  };
  const inputDate = value => value ? String(value).slice(0, 10) : '';
  const statusLabels = {
    pendente: 'AGUARDANDO PAGAMENTO',
    pago: 'PAGO',
    enviado: 'ENVIADO',
    entregue: 'ENTREGUE',
    cancelado: 'CANCELADO'
  };
  const orderStatuses = ['pendente', 'pago', 'enviado', 'entregue', 'cancelado'];
  const titles = {
    dashboard: 'VISÃO GERAL',
    products: 'PRODUTOS',
    drops: 'LANÇAMENTOS',
    collections: 'COLEÇÕES',
    orders: 'PEDIDOS',
    customers: 'CLIENTES',
    settings: 'CONFIGURAÇÕES'
  };
  const state = {
    panel: 'dashboard',
    productSearch: '',
    orderFilter: 'todos',
    orderSearch: '',
    customerSearch: ''
  };
  let me = null;
  let toastTimer;

  const loginScreen = $('#admin-login');
  const app = $('#admin-app');
  const content = $('#admin-content');
  const modalRoot = $('#admin-modal-root');
  const sidebar = $('#admin-sidebar');
  const sidebarScrim = $('#admin-sidebar-scrim');

  function toast(message) {
    const element = $('#admin-toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 2800);
  }

  function statusBadge(status) {
    return `<span class="badge ${esc(status)}">${statusLabels[status] || esc(String(status).toUpperCase())}</span>`;
  }

  function statusOptions(selected) {
    return orderStatuses.map(status => `<option value="${status}" ${status === selected ? 'selected' : ''}>${statusLabels[status]}</option>`).join('');
  }

  function sidebarCounts() {
    const orders = RUA98.orders();
    $('#nav-order-count').textContent = orders.filter(order => order.status === 'pendente').length;
  }

  function renderUser() {
    me = RUA98.currentUser();
    if (!me) return;
    const initials = me.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    $('#admin-user-avatar').textContent = initials || 'A';
    $('#admin-user-name').textContent = me.name;
  }

  function showLogin(reset = false) {
    me = null;
    loginScreen.hidden = false;
    app.hidden = true;
    if (reset) $('#admin-login-form').reset();
    $('#login-error').hidden = true;
    updateLoginNote();
    closeSidebar();
  }

  function updateLoginNote() {
    const note = $('#login-session-note');
    const user = RUA98.currentUser();
    if (user && user.role !== 'admin') {
      note.innerHTML = `Você está conectado como <b>${esc(user.name)}</b> (cliente). Entre com uma conta administrativa para continuar. <button type="button" id="login-session-logout">SAIR DESTA CONTA</button>`;
      note.hidden = false;
      $('#login-session-logout').addEventListener('click', () => {
        RUA98.logout();
        updateLoginNote();
        toast('SESSÃO DE CLIENTE ENCERRADA.');
      });
    } else {
      note.hidden = true;
      note.innerHTML = '';
    }
  }

  function enterApp() {
    const user = RUA98.currentUser();
    if (!user || user.role !== 'admin') {
      showLogin();
      return;
    }
    me = user;
    loginScreen.hidden = true;
    app.hidden = false;
    renderUser();
    sidebarCounts();
    render();
  }

  function openSidebar() { sidebar.classList.add('open'); sidebarScrim.classList.add('open'); }
  function closeSidebar() { sidebar.classList.remove('open'); sidebarScrim.classList.remove('open'); }

  function render() {
    if (!me) return;
    renderUser();
    sidebarCounts();
    const activePanel = state.panel;
    document.querySelectorAll('.admin-nav [data-panel]').forEach(button => {
      button.classList.toggle('active', button.dataset.panel === activePanel);
    });
    $('#admin-page-title').textContent = titles[activePanel];
    document.title = `${titles[activePanel]} — Painel RUA 98`;
    if (activePanel === 'dashboard') renderDashboard();
    if (activePanel === 'products') renderProducts();
    if (activePanel === 'drops') renderDrops();
    if (activePanel === 'collections') renderCollections();
    if (activePanel === 'orders') renderOrders();
    if (activePanel === 'customers') renderCustomers();
    if (activePanel === 'settings') renderSettings();
    closeSidebar();
  }

  /* ---------------- dashboard ---------------- */
  function renderDashboard() {
    const orders = RUA98.orders();
    const products = RUA98.products({ includeInactive: true });
    const customers = RUA98.users().filter(user => user.role === 'customer');
    const validOrders = orders.filter(order => order.status !== 'cancelado');
    const revenue = validOrders.reduce((sum, order) => sum + order.total, 0);
    const pending = orders.filter(order => order.status === 'pendente').length;
    const activeProducts = products.filter(product => product.active);
    const lowStock = activeProducts.filter(product => product.stock <= 8).sort((a, b) => a.stock - b.stock);
    const recent = orders.slice(0, 5);
    const activeDrop = RUA98.activeDrop();

    content.innerHTML = `
      <div class="admin-panel">
        <div class="panel-heading">
          <div><h2>VISÃO <span>GERAL.</span></h2><p>O PULSO DA RUA, EM TEMPO REAL.</p></div>
          <div class="panel-actions">
            <button class="admin-button" type="button" data-action="new-drop">+ LANÇAMENTO</button>
            <button class="admin-button admin-button-dark" type="button" data-action="new-product">+ NOVA PEÇA</button>
          </div>
        </div>
        <div class="admin-kpis">
          <div class="kpi dark"><span class="kpi-mark">↗</span><span class="kpi-label">RECEITA TOTAL</span><b>${shortMoney(revenue)}</b><small>${validOrders.length} PEDIDOS VÁLIDOS</small></div>
          <div class="kpi"><span class="kpi-mark">▣</span><span class="kpi-label">PEDIDOS</span><b>${String(orders.length).padStart(2, '0')}</b><small>${pending} AGUARDANDO PAGAMENTO</small></div>
          <div class="kpi"><span class="kpi-mark">♧</span><span class="kpi-label">CLIENTES</span><b>${String(customers.length).padStart(2, '0')}</b><small>CONTAS CRIADAS NA LOJA</small></div>
          <div class="kpi accent"><span class="kpi-mark">✳</span><span class="kpi-label">PEÇAS ATIVAS</span><b>${String(activeProducts.length).padStart(2, '0')}</b><small>${lowStock.length} COM ESTOQUE BAIXO</small></div>
        </div>
        <div class="dash-grid">
          <div class="dash-col">
            <div class="admin-card">
              <div class="admin-card-head"><h3>Pedidos recentes</h3><button class="admin-button small" type="button" data-action="go-orders">VER TODOS ↗</button></div>
              <div class="table-wrap" style="border:0">
                <table class="admin-table" style="min-width:560px">
                  <thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>DATA</th><th>TOTAL</th><th>STATUS</th><th></th></tr></thead>
                  <tbody>
                    ${recent.length ? recent.map(order => `
                      <tr>
                        <td><b>#${order.number}</b></td>
                        <td><div class="customer-cell"><b>${esc(order.userName)}</b><span>${esc(order.userEmail)}</span></div></td>
                        <td class="cell-muted">${dateBR(order.createdAt)}</td>
                        <td>${money(order.total)}</td>
                        <td>${statusBadge(order.status)}</td>
                        <td><div class="row-actions"><button class="icon-action" type="button" data-action="view-order" data-id="${esc(order.id)}" title="Ver pedido">→</button></div></td>
                      </tr>`).join('') : '<tr><td colspan="6" class="empty-row">NENHUM PEDIDO AINDA.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="admin-card">
              <div class="admin-card-head"><h3>Atalhos da loja</h3><span>GESTÃO RÁPIDA</span></div>
              <div class="admin-card-body">
                <div class="quick-actions">
                  <button type="button" data-action="new-product"><b>＋</b> CADASTRAR PEÇA</button>
                  <button type="button" data-action="new-drop"><b>↗</b> CRIAR LANÇAMENTO</button>
                  <button type="button" data-action="new-collection"><b>▤</b> NOVA COLEÇÃO</button>
                  <button type="button" data-action="go-customers"><b>♧</b> VER CLIENTES</button>
                </div>
              </div>
            </div>
          </div>
          <div class="dash-col">
            ${activeDrop ? `
              <div class="drop-mini">
                <span class="admin-eyebrow">LANÇAMENTO ATIVO</span>
                <h3>${esc(activeDrop.name)}</h3>
                <p>${esc(activeDrop.description || 'Sem descrição cadastrada.')}</p>
                <div class="drop-meta"><span>${esc(dateBR(activeDrop.date))}</span><b>${activeDrop.productIds.length} PEÇAS</b></div>
              </div>` : `
              <div class="admin-card">
                <div class="admin-card-body">
                  <span class="admin-eyebrow">LANÇAMENTO ATIVO</span>
                  <p class="alert-empty">Nenhum lançamento ativo. Crie um drop para destacar na loja.</p>
                  <button class="admin-button small" type="button" data-action="new-drop">CRIAR DROP ↗</button>
                </div>
              </div>`}
            <div class="admin-card">
              <div class="admin-card-head"><h3>Estoque baixo</h3><span>${lowStock.length} ALERTAS</span></div>
              <div class="admin-card-body">
                <div class="alert-list">
                  ${lowStock.length ? lowStock.slice(0, 5).map(product => `
                    <div class="alert-item">
                      <img src="${esc(product.image)}" alt="${esc(product.name)}">
                      <div><b>${esc(product.name)}</b><span>${esc(product.sizes.join(' · '))}</span></div>
                      <strong>${product.stock} UN.</strong>
                    </div>`).join('') : '<p class="alert-empty">Tudo em dia. Nenhuma peça com estoque crítico.</p>'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ---------------- produtos ---------------- */
  function productRow(product, collections) {
    const collection = collections.get(product.collectionId);
    return `
      <tr>
        <td><div class="row-product"><img src="${esc(product.image)}" alt="${esc(product.name)}"><div><b>${esc(product.name)}</b><span>${esc(product.subtitle || product.category)}</span></div></div></td>
        <td>${esc(collection ? collection.name : '—')}</td>
        <td>${money(product.price)}</td>
        <td class="${product.stock <= 8 ? 'stock-low' : 'stock-ok'}">${product.stock} un.</td>
        <td><span class="badge ${product.active ? 'active' : 'inactive'}">${product.active ? 'ATIVA' : 'INATIVA'}</span></td>
        <td><div class="row-actions">
          <button class="icon-action" type="button" data-action="edit-product" data-id="${esc(product.id)}" title="Editar peça">✎</button>
          <button class="icon-action danger" type="button" data-action="delete-product" data-id="${esc(product.id)}" title="Excluir peça">×</button>
        </div></td>
      </tr>`;
  }

  function renderProducts() {
    content.innerHTML = `
      <div class="admin-panel">
        <div class="panel-heading">
          <div><h2>PRODUTOS<span>.</span></h2><p>CADASTRE, EDITE E CONTROLE O ESTOQUE.</p></div>
          <div class="panel-actions"><button class="admin-button admin-button-dark" type="button" data-action="new-product">+ NOVA PEÇA</button></div>
        </div>
        <div class="table-wrap">
          <div class="table-toolbar">
            <div class="admin-search"><span>⌕</span><input id="product-search" type="search" placeholder="Buscar por nome, tag ou categoria..." value="${esc(state.productSearch)}"></div>
            <span class="table-count" id="product-count"></span>
          </div>
          <table class="admin-table">
            <thead><tr><th>PEÇA</th><th>COLEÇÃO</th><th>PREÇO</th><th>ESTOQUE</th><th>STATUS</th><th></th></tr></thead>
            <tbody id="product-rows"></tbody>
          </table>
        </div>
      </div>`;
    refreshProductRows();
  }

  function refreshProductRows() {
    const rows = $('#product-rows');
    if (!rows) return;
    const collections = new Map(RUA98.collections({ includeInactive: true }).map(collection => [collection.id, collection]));
    const term = state.productSearch.trim().toLowerCase();
    const products = RUA98.products({ includeInactive: true }).filter(product => {
      const haystack = [product.name, product.subtitle, product.tag, product.category, product.meta].join(' ').toLowerCase();
      return !term || haystack.includes(term);
    });
    rows.innerHTML = products.length
      ? products.map(product => productRow(product, collections)).join('')
      : '<tr><td colspan="6" class="empty-row">NENHUMA PEÇA ENCONTRADA.</td></tr>';
    $('#product-count').textContent = `${products.length} ${products.length === 1 ? 'PEÇA' : 'PEÇAS'}`;
  }

  function openProductModal(id) {
    const product = id ? RUA98.product(id) : {
      id: '', name: '', subtitle: '', category: 'oversized', collectionId: RUA98.collections()[0]?.id || '',
      price: '', compareAt: '', stock: 10, tag: '', sizes: ['P', 'M', 'G', 'GG'], meta: '100% ALGODÃO 240G',
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
      description: '', isNew: true, featured: false, active: true
    };
    if (!product) return toast('PEÇA NÃO ENCONTRADA.');
    const collections = RUA98.collections({ includeInactive: true });
    openModal(`
      <form id="product-form" data-id="${esc(product.id)}" novalidate>
        <div class="form-head">
          <div><span class="admin-eyebrow">${product.id ? 'EDITAR PEÇA' : 'NOVA PEÇA'}</span><h2>${product.id ? 'EDITAR' : 'CADASTRAR'} <span>PRODUTO.</span></h2></div>
          <button class="modal-close" type="button" data-close-modal aria-label="Fechar">×</button>
        </div>
        <div class="form-scroll">
          <div class="form-grid">
            <label class="span-2">NOME DA PEÇA<input name="name" value="${esc(product.name)}" required maxlength="70"></label>
            <label>SUBTÍTULO<input name="subtitle" value="${esc(product.subtitle)}" placeholder="HEAVYWEIGHT · PRETA" maxlength="60"></label>
            <label>CATEGORIA<select name="category">
              <option value="oversized" ${product.category === 'oversized' ? 'selected' : ''}>OVERSIZED</option>
              <option value="old-school" ${product.category === 'old-school' ? 'selected' : ''}>OLD SCHOOL</option>
            </select></label>
            <label>COLEÇÃO<select name="collectionId">
              <option value="">SEM COLEÇÃO</option>
              ${collections.map(collection => `<option value="${esc(collection.id)}" ${product.collectionId === collection.id ? 'selected' : ''}>${esc(collection.name.toUpperCase())}</option>`).join('')}
            </select></label>
            <label>PREÇO (R$)<input name="price" type="number" min="1" step="0.01" value="${esc(product.price)}" required></label>
            <label>PREÇO ANTIGO (R$)<input name="compareAt" type="number" min="0" step="0.01" value="${product.compareAt || ''}" placeholder="Opcional"></label>
            <label>ESTOQUE<input name="stock" type="number" min="0" step="1" value="${esc(product.stock)}" required></label>
            <label>TAG / SELO<input name="tag" value="${esc(product.tag)}" placeholder="NOVA PEÇA" maxlength="30"></label>
            <label>TAMANHOS<input name="sizes" value="${esc(product.sizes.join(', '))}" placeholder="P, M, G, GG" required></label>
            <label>COMPOSIÇÃO<input name="meta" value="${esc(product.meta)}" placeholder="100% ALGODÃO 240G" maxlength="50"></label>
            <label class="span-2">IMAGEM (URL)<div class="form-image-row"><input name="image" id="product-image" value="${esc(product.image)}" placeholder="https://..." required><img id="product-image-preview" src="${esc(product.image)}" alt="Prévia"></div></label>
            <label class="span-2">DESCRIÇÃO<textarea name="description" placeholder="Conte a história da peça..." maxlength="400">${esc(product.description)}</textarea></label>
            <div class="form-checks span-2">
              <label><input type="checkbox" name="isNew" ${product.isNew ? 'checked' : ''}> LANÇAMENTO</label>
              <label><input type="checkbox" name="featured" ${product.featured ? 'checked' : ''}> DESTAQUE</label>
              <label><input type="checkbox" name="active" ${product.active ? 'checked' : ''}> ATIVA NA LOJA</label>
            </div>
          </div>
          <p class="form-error" id="product-form-error" hidden></p>
        </div>
        <div class="form-actions">
          <button class="admin-button" type="button" data-close-modal>CANCELAR</button>
          <button class="admin-button admin-button-dark" type="submit">SALVAR PEÇA <span>↗</span></button>
        </div>
      </form>`);
  }

  function submitProduct(form) {
    const error = $('#product-form-error');
    error.hidden = true;
    try {
      RUA98.saveProduct({
        id: form.dataset.id || undefined,
        name: form.elements.name.value,
        subtitle: form.elements.subtitle.value,
        category: form.elements.category.value,
        collectionId: form.elements.collectionId.value,
        price: form.elements.price.value,
        compareAt: form.elements.compareAt.value,
        stock: form.elements.stock.value,
        tag: form.elements.tag.value,
        sizes: form.elements.sizes.value,
        meta: form.elements.meta.value,
        image: form.elements.image.value,
        description: form.elements.description.value,
        isNew: form.elements.isNew.checked,
        featured: form.elements.featured.checked,
        active: form.elements.active.checked
      });
      closeModal();
      render();
      toast('PEÇA SALVA COM SUCESSO ✳');
    } catch (submitError) {
      error.textContent = submitError.message.toUpperCase();
      error.hidden = false;
    }
  }

  function deleteProduct(id) {
    const product = RUA98.product(id);
    if (!product) return;
    confirmAction({
      title: 'EXCLUIR PEÇA',
      text: `A peça <b>${esc(product.name)}</b> será removida da loja, das sacolas e dos favoritos. Essa ação não pode ser desfeita.`,
      label: 'EXCLUIR PEÇA',
      onConfirm: () => {
        RUA98.deleteProduct(id);
        render();
        toast('PEÇA EXCLUÍDA.');
      }
    });
  }

  /* ---------------- lançamentos ---------------- */
  function renderDrops() {
    const drops = RUA98.drops();
    const products = RUA98.products({ includeInactive: true });
    const productMap = new Map(products.map(product => [product.id, product]));
    content.innerHTML = `
      <div class="admin-panel">
        <div class="panel-heading">
          <div><h2>LANÇAMENTOS<span>.</span></h2><p>DROPS, DATAS E PEÇAS EM DESTAQUE.</p></div>
          <div class="panel-actions"><button class="admin-button admin-button-dark" type="button" data-action="new-drop">+ NOVO LANÇAMENTO</button></div>
        </div>
        <div class="collection-grid">
          ${drops.length ? drops.map(drop => {
            const dropProducts = (drop.productIds || []).map(id => productMap.get(id)).filter(Boolean);
            return `
              <article class="collection-card drop-card">
                <div class="collection-card-top"><span class="badge ${esc(drop.status)}">${esc(drop.status.toUpperCase())}</span><span class="drop-date">${esc(drop.date ? dateBR(drop.date) : 'SEM DATA')}</span></div>
                <h3>${esc(drop.name)}</h3>
                <p>${esc(drop.description || 'Sem descrição cadastrada.')}</p>
                <div class="drop-products">
                  ${dropProducts.slice(0, 4).map(product => `<img src="${esc(product.image)}" alt="${esc(product.name)}" title="${esc(product.name)}">`).join('')}
                  <span>${dropProducts.length} ${dropProducts.length === 1 ? 'PEÇA' : 'PEÇAS'}</span>
                </div>
                <div class="collection-actions">
                  <button class="admin-button small" type="button" data-action="edit-drop" data-id="${esc(drop.id)}">EDITAR</button>
                  <button class="admin-button small admin-button-danger" type="button" data-action="delete-drop" data-id="${esc(drop.id)}">EXCLUIR</button>
                </div>
              </article>`;
          }).join('') : '<div class="account-empty" style="grid-column:1/-1"><h3>NENHUM LANÇAMENTO.</h3><p>Crie o primeiro drop e destaque na loja.</p></div>'}
        </div>
      </div>`;
  }

  function openDropModal(id) {
    const drop = id ? RUA98.drops().find(entry => entry.id === id) : {
      id: '', name: '', date: new Date().toISOString().slice(0, 10), status: 'agendado', description: '', productIds: []
    };
    if (!drop) return toast('LANÇAMENTO NÃO ENCONTRADO.');
    const products = RUA98.products({ includeInactive: true });
    openModal(`
      <form id="drop-form" data-id="${esc(drop.id)}" novalidate>
        <div class="form-head">
          <div><span class="admin-eyebrow">${drop.id ? 'EDITAR LANÇAMENTO' : 'NOVO LANÇAMENTO'}</span><h2>${drop.id ? 'EDITAR' : 'CRIAR'} <span>DROP.</span></h2></div>
          <button class="modal-close" type="button" data-close-modal aria-label="Fechar">×</button>
        </div>
        <div class="form-scroll">
          <div class="form-grid">
            <label class="span-2">NOME DO LANÇAMENTO<input name="name" value="${esc(drop.name)}" placeholder="DROP 02 — CONCRETO" required maxlength="60"></label>
            <label>DATA DE LANÇAMENTO<input name="date" type="date" value="${inputDate(drop.date)}"></label>
            <label>STATUS<select name="status">
              ${['ativo', 'agendado', 'encerrado'].map(status => `<option value="${status}" ${drop.status === status ? 'selected' : ''}>${status.toUpperCase()}</option>`).join('')}
            </select></label>
            <label class="span-2">DESCRIÇÃO<textarea name="description" placeholder="Conceito e história do drop..." maxlength="400">${esc(drop.description)}</textarea></label>
            <div class="span-2">
              <span class="admin-eyebrow" style="margin-bottom:7px;display:flex">PEÇAS DO DROP</span>
              <div class="checkbox-grid">
                ${products.length ? products.map(product => `<label><input type="checkbox" name="drop-product" value="${esc(product.id)}" ${drop.productIds.includes(product.id) ? 'checked' : ''}> ${esc(product.name)}</label>`).join('') : '<span class="alert-empty">Nenhuma peça cadastrada.</span>'}
              </div>
            </div>
          </div>
          <p class="form-error" id="drop-form-error" hidden></p>
        </div>
        <div class="form-actions">
          <button class="admin-button" type="button" data-close-modal>CANCELAR</button>
          <button class="admin-button admin-button-dark" type="submit">SALVAR LANÇAMENTO <span>↗</span></button>
        </div>
      </form>`);
  }

  function submitDrop(form) {
    const error = $('#drop-form-error');
    error.hidden = true;
    try {
      RUA98.saveDrop({
        id: form.dataset.id || undefined,
        name: form.elements.name.value,
        date: form.elements.date.value,
        status: form.elements.status.value,
        description: form.elements.description.value,
        productIds: [...form.querySelectorAll('input[name="drop-product"]:checked')].map(input => input.value)
      });
      closeModal();
      render();
      toast('LANÇAMENTO SALVO ✳');
    } catch (submitError) {
      error.textContent = submitError.message.toUpperCase();
      error.hidden = false;
    }
  }

  function deleteDrop(id) {
    const drop = RUA98.drops().find(entry => entry.id === id);
    if (!drop) return;
    confirmAction({
      title: 'EXCLUIR LANÇAMENTO',
      text: `O lançamento <b>${esc(drop.name)}</b> será removido do painel.`,
      label: 'EXCLUIR DROP',
      onConfirm: () => {
        RUA98.deleteDrop(id);
        render();
        toast('LANÇAMENTO EXCLUÍDO.');
      }
    });
  }

  /* ---------------- coleções ---------------- */
  function renderCollections() {
    const collections = RUA98.collections({ includeInactive: true });
    const products = RUA98.products({ includeInactive: true });
    content.innerHTML = `
      <div class="admin-panel">
        <div class="panel-heading">
          <div><h2>COLEÇÕES<span>.</span></h2><p>AGRUPE AS PEÇAS POR UNIVERSO.</p></div>
          <div class="panel-actions"><button class="admin-button admin-button-dark" type="button" data-action="new-collection">+ NOVA COLEÇÃO</button></div>
        </div>
        <div class="collection-grid">
          ${collections.length ? collections.map(collection => {
            const count = products.filter(product => product.collectionId === collection.id).length;
            return `
              <article class="collection-card">
                <div class="collection-card-top"><span class="badge ${collection.active ? 'active' : 'inactive'}">${collection.active ? 'ATIVA' : 'INATIVA'}</span><span class="cell-muted">${String(count).padStart(2, '0')} PEÇAS</span></div>
                <h3>${esc(collection.name)}</h3>
                <p>${esc(collection.description || 'Sem descrição cadastrada.')}</p>
                <div class="collection-actions">
                  <button class="admin-button small" type="button" data-action="edit-collection" data-id="${esc(collection.id)}">EDITAR</button>
                  <button class="admin-button small admin-button-danger" type="button" data-action="delete-collection" data-id="${esc(collection.id)}">EXCLUIR</button>
                </div>
              </article>`;
          }).join('') : '<div class="account-empty" style="grid-column:1/-1"><h3>NENHUMA COLEÇÃO.</h3><p>Crie a primeira coleção da loja.</p></div>'}
        </div>
      </div>`;
  }

  function openCollectionModal(id) {
    const collection = id ? RUA98.collection(id) : { id: '', name: '', description: '', active: true };
    if (!collection) return toast('COLEÇÃO NÃO ENCONTRADA.');
    openModal(`
      <form id="collection-form" data-id="${esc(collection.id)}" novalidate>
        <div class="form-head">
          <div><span class="admin-eyebrow">${collection.id ? 'EDITAR COLEÇÃO' : 'NOVA COLEÇÃO'}</span><h2>${collection.id ? 'EDITAR' : 'CRIAR'} <span>COLEÇÃO.</span></h2></div>
          <button class="modal-close" type="button" data-close-modal aria-label="Fechar">×</button>
        </div>
        <div class="form-scroll">
          <div class="form-grid">
            <label class="span-2">NOME<input name="name" value="${esc(collection.name)}" placeholder="Oversized" required maxlength="40"></label>
            <label class="span-2">DESCRIÇÃO<textarea name="description" placeholder="Conceito da coleção..." maxlength="240">${esc(collection.description)}</textarea></label>
            <div class="form-checks span-2"><label><input type="checkbox" name="active" ${collection.active ? 'checked' : ''}> VISÍVEL NA LOJA</label></div>
          </div>
          <p class="form-error" id="collection-form-error" hidden></p>
        </div>
        <div class="form-actions">
          <button class="admin-button" type="button" data-close-modal>CANCELAR</button>
          <button class="admin-button admin-button-dark" type="submit">SALVAR COLEÇÃO <span>↗</span></button>
        </div>
      </form>`);
  }

  function submitCollection(form) {
    const error = $('#collection-form-error');
    error.hidden = true;
    try {
      RUA98.saveCollection({
        id: form.dataset.id || undefined,
        name: form.elements.name.value,
        description: form.elements.description.value,
        active: form.elements.active.checked
      });
      closeModal();
      render();
      toast('COLEÇÃO SALVA ✳');
    } catch (submitError) {
      error.textContent = submitError.message.toUpperCase();
      error.hidden = false;
    }
  }

  function deleteCollection(id) {
    const collection = RUA98.collection(id);
    if (!collection) return;
    confirmAction({
      title: 'EXCLUIR COLEÇÃO',
      text: `A coleção <b>${esc(collection.name)}</b> será removida. As peças continuam na loja, mas ficam sem coleção.`,
      label: 'EXCLUIR COLEÇÃO',
      onConfirm: () => {
        RUA98.deleteCollection(id);
        render();
        toast('COLEÇÃO EXCLUÍDA.');
      }
    });
  }

  /* ---------------- pedidos ---------------- */
  function renderOrders() {
    content.innerHTML = `
      <div class="admin-panel">
        <div class="panel-heading">
          <div><h2>PEDIDOS<span>.</span></h2><p>ACOMPANHE E ATUALIZE CADA ENTREGA.</p></div>
          <div class="panel-actions"><button class="admin-button" type="button" data-action="export-orders">EXPORTAR CSV <span>↓</span></button><span class="table-count" id="orders-count"></span></div>
        </div>
        <div class="table-wrap">
          <div class="table-toolbar">
            <div class="admin-search"><span>⌕</span><input id="order-search" type="search" placeholder="Buscar por nº, cliente ou e-mail..." value="${esc(state.orderSearch)}"></div>
            <select class="admin-filter" id="order-filter" aria-label="Filtrar por status">
              <option value="todos">TODOS OS STATUS</option>
              ${orderStatuses.map(status => `<option value="${status}" ${state.orderFilter === status ? 'selected' : ''}>${statusLabels[status]}</option>`).join('')}
            </select>
          </div>
          <table class="admin-table">
            <thead><tr><th>PEDIDO</th><th>CLIENTE</th><th>DATA</th><th>ITENS</th><th>TOTAL</th><th>STATUS</th><th></th></tr></thead>
            <tbody id="orders-rows"></tbody>
          </table>
        </div>
      </div>`;
    refreshOrdersTable();
  }

  function refreshOrdersTable() {
    const rows = $('#orders-rows');
    if (!rows) return;
    const term = state.orderSearch.trim().toLowerCase();
    const orders = RUA98.orders().filter(order => {
      const matchesStatus = state.orderFilter === 'todos' || order.status === state.orderFilter;
      const haystack = `#${order.number} ${order.userName} ${order.userEmail}`.toLowerCase();
      return matchesStatus && (!term || haystack.includes(term));
    });
    rows.innerHTML = orders.length ? orders.map(order => {
      const items = order.items.reduce((sum, item) => sum + item.quantity, 0);
      return `
        <tr>
          <td><b>#${order.number}</b></td>
          <td><div class="customer-cell"><b>${esc(order.userName)}</b><span>${esc(order.userEmail)}</span></div></td>
          <td class="cell-muted">${dateBR(order.createdAt)}</td>
          <td>${items} ${items === 1 ? 'peça' : 'peças'}</td>
          <td>${money(order.total)}</td>
          <td>${statusBadge(order.status)}</td>
          <td><div class="row-actions"><button class="icon-action" type="button" data-action="view-order" data-id="${esc(order.id)}" title="Ver pedido">→</button></div></td>
        </tr>`;
    }).join('') : '<tr><td colspan="7" class="empty-row">NENHUM PEDIDO ENCONTRADO.</td></tr>';
    $('#orders-count').textContent = `${orders.length} ${orders.length === 1 ? 'PEDIDO' : 'PEDIDOS'}`;
  }

  function openOrderModal(id) {
    const order = RUA98.orders().find(entry => entry.id === id);
    if (!order) return toast('PEDIDO NÃO ENCONTRADO.');
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    openModal(`
      <div class="form-head">
        <div><span class="admin-eyebrow">DETALHE DO PEDIDO</span><h2>PEDIDO <span>#${order.number}</span></h2></div>
        <button class="modal-close" type="button" data-close-modal aria-label="Fechar">×</button>
      </div>
      <div class="order-detail">
        <div class="order-detail-top">
          <div><span>${dateBR(order.createdAt)} · ${esc(order.payment).toUpperCase()} · ${itemCount} ${itemCount === 1 ? 'PEÇA' : 'PEÇAS'}</span></div>
          ${statusBadge(order.status)}
        </div>
        <div class="order-info-grid">
          <div class="order-info"><b>CLIENTE</b><span>${esc(order.userName)}<br>${esc(order.userEmail)}<br>${esc(order.customer.phone || 'Telefone não informado')}</span></div>
          <div class="order-info"><b>ENTREGA</b><span>${esc(order.customer.address || 'Endereço não informado')}${order.customer.number ? `, ${esc(order.customer.number)}` : ''}<br>${esc(order.customer.city || '')}${order.customer.state ? ` · ${esc(order.customer.state)}` : ''}<br>${esc(order.customer.zip || '')}${order.trackingCode ? `<br><b class="tracking-inline">RASTREIO ${esc(order.trackingCode)}</b>` : ''}</span></div>
        </div>
        <div class="order-items">
          ${order.items.map(item => `
            <div class="order-item">
              <img src="${esc(item.image)}" alt="${esc(item.name)}">
              <div><b>${esc(item.name)}</b><span>TAM. ${esc(item.size)} · QTD. ${item.quantity}</span></div>
              <strong>${money(item.price * item.quantity)}</strong>
            </div>`).join('')}
        </div>
        <div class="order-totals">
          <div><span>SUBTOTAL</span><b>${money(order.subtotal)}</b></div>
          ${Number(order.discount) > 0 ? `<div><span>DESCONTO ${esc(order.coupon?.code || 'CUPOM')}</span><b>-${money(order.discount)}</b></div>` : ''}
          <div><span>FRETE</span><b>${order.shipping ? money(order.shipping) : 'GRÁTIS'}</b></div>
          <div class="grand"><span>TOTAL</span><b>${money(order.total)}</b></div>
        </div>
      </div>
      <div class="order-detail-actions">
        <form class="tracking-form" id="tracking-form" data-id="${esc(order.id)}">
          <label>CÓDIGO DE RASTREIO<input name="tracking" value="${esc(order.trackingCode || '')}" placeholder="BR98 0000 0000" maxlength="40" autocomplete="off"></label>
          <button class="admin-button small" type="submit">SALVAR RASTREIO</button>
        </form>
        <label>ATUALIZAR STATUS <select class="status-select order-modal-status" data-id="${esc(order.id)}">${statusOptions(order.status)}</select></label>
        <button class="admin-button" type="button" data-close-modal>FECHAR</button>
      </div>`);
  }

  function changeOrderStatus(id, status) {
    try {
      RUA98.updateOrderStatus(id, status);
      closeModal();
      render();
      toast('STATUS DO PEDIDO ATUALIZADO ✳');
    } catch (error) {
      toast(error.message.toUpperCase());
    }
  }

  /* ---------------- clientes ---------------- */
  function renderCustomers() {
    content.innerHTML = `
      <div class="admin-panel">
        <div class="panel-heading">
          <div><h2>CLIENTES<span>.</span></h2><p>QUEM VESTE A RUA 98.</p></div>
          <div class="panel-actions"><button class="admin-button" type="button" data-action="export-customers">EXPORTAR CSV <span>↓</span></button><span class="table-count" id="customers-count"></span></div>
        </div>
        <div class="table-wrap">
          <div class="table-toolbar">
            <div class="admin-search"><span>⌕</span><input id="customer-search" type="search" placeholder="Buscar por nome ou e-mail..." value="${esc(state.customerSearch)}"></div>
          </div>
          <table class="admin-table">
            <thead><tr><th>CLIENTE</th><th>PEDIDOS</th><th>TOTAL GASTO</th><th>NA RUA DESDE</th><th>TIPO</th><th>STATUS</th><th></th></tr></thead>
            <tbody id="customer-rows"></tbody>
          </table>
        </div>
      </div>`;
    refreshCustomerRows();
  }

  function refreshCustomerRows() {
    const rows = $('#customer-rows');
    if (!rows) return;
    const term = state.customerSearch.trim().toLowerCase();
    const users = RUA98.users().filter(user => {
      const haystack = `${user.name} ${user.email}`.toLowerCase();
      return !term || haystack.includes(term);
    });
    rows.innerHTML = users.length ? users.map(user => `
      <tr>
        <td><div class="customer-cell"><b>${esc(user.name)}</b><span>${esc(user.email)}</span></div></td>
        <td>${user.orders}</td>
        <td>${money(user.spent)}</td>
        <td class="cell-muted">${dateBR(user.createdAt)}</td>
        <td><span class="badge ${user.role === 'admin' ? 'admin' : ''}">${user.role === 'admin' ? 'ADMIN' : 'CLIENTE'}</span></td>
        <td><span class="badge ${user.blocked ? 'blocked' : 'active'}">${user.blocked ? 'BLOQUEADO' : 'ATIVO'}</span></td>
        <td><div class="row-actions">
          <button class="icon-action" type="button" data-action="view-customer" data-id="${esc(user.id)}" title="Ver cliente">→</button>
          ${user.role === 'admin' ? '' : `<button class="icon-action ${user.blocked ? '' : 'danger'}" type="button" data-action="toggle-block" data-id="${esc(user.id)}" title="${user.blocked ? 'Desbloquear' : 'Bloquear'} cliente">${user.blocked ? '✓' : '⊘'}</button>`}
        </div></td>
      </tr>`).join('') : '<tr><td colspan="7" class="empty-row">NENHUM CLIENTE ENCONTRADO.</td></tr>';
    $('#customers-count').textContent = `${users.length} ${users.length === 1 ? 'CONTA' : 'CONTAS'}`;
  }

  function openCustomerModal(id) {
    const user = RUA98.users().find(entry => entry.id === id);
    if (!user) return toast('CLIENTE NÃO ENCONTRADO.');
    const orders = RUA98.orders().filter(order => order.userId === id);
    openModal(`
      <div class="form-head">
        <div><span class="admin-eyebrow">PERFIL DO CLIENTE</span><h2>${esc(user.name.toUpperCase())}</h2></div>
        <button class="modal-close" type="button" data-close-modal aria-label="Fechar">×</button>
      </div>
      <div class="order-detail">
        <div class="order-info-grid">
          <div class="order-info"><b>CONTATO</b><span>${esc(user.email)}<br>${esc(user.phone || 'Telefone não informado')}<br>${esc(user.address || 'Endereço não informado')}${user.city ? `<br>${esc(user.city)}${user.state ? ` · ${esc(user.state)}` : ''}` : ''}</span></div>
          <div class="order-info"><b>RESUMO</b><span>${user.orders} ${user.orders === 1 ? 'pedido' : 'pedidos'}<br>${money(user.spent)} em compras<br>Na rua desde ${dateBR(user.createdAt)}<br>${user.role === 'admin' ? 'Administrador' : 'Cliente'}</span></div>
        </div>
        <div class="admin-card-head" style="padding:0 0 10px;border:0"><h3>Histórico de pedidos</h3><span>${orders.length} REGISTROS</span></div>
        <div class="order-items">
          ${orders.length ? orders.map(order => `
            <div class="order-item">
              <div style="width:40px;height:40px;background:var(--paper);display:grid;place-items:center;font:700 11px var(--display)">#${order.number}</div>
              <div><b>${dateBR(order.createdAt)}</b><span>${order.items.reduce((sum, item) => sum + item.quantity, 0)} peças · ${statusLabels[order.status]}</span></div>
              <strong>${money(order.total)}</strong>
            </div>`).join('') : '<div class="order-item"><span>Nenhum pedido registrado.</span></div>'}
        </div>
      </div>
      <div class="order-detail-actions">
        ${user.role === 'admin' ? '<span class="cell-muted">CONTAS ADMINISTRATIVAS NÃO PODEM SER BLOQUEADAS.</span>' : `<button class="admin-button ${user.blocked ? 'admin-button-green' : 'admin-button-danger'}" type="button" data-modal-block="${esc(user.id)}" data-blocked="${user.blocked}">${user.blocked ? 'DESBLOQUEAR CLIENTE' : 'BLOQUEAR CLIENTE'}</button>`}
        <button class="admin-button" type="button" data-close-modal>FECHAR</button>
      </div>`);
  }

  function toggleBlock(id) {
    const user = RUA98.users().find(entry => entry.id === id);
    if (!user) return;
    confirmAction({
      title: user.blocked ? 'DESBLOQUEAR CLIENTE' : 'BLOQUEAR CLIENTE',
      text: user.blocked
        ? `<b>${esc(user.name)}</b> voltará a conseguir entrar e comprar na loja.`
        : `<b>${esc(user.name)}</b> não conseguirá entrar na conta nem finalizar compras. O histórico é preservado.`,
      label: user.blocked ? 'DESBLOQUEAR' : 'BLOQUEAR',
      onConfirm: () => {
        try {
          RUA98.setUserBlocked(id, !user.blocked);
          render();
          toast(user.blocked ? 'CLIENTE DESBLOQUEADO.' : 'CLIENTE BLOQUEADO.');
        } catch (error) {
          toast(error.message.toUpperCase());
        }
      }
    });
  }

  /* ---------------- configurações ---------------- */
  function couponValue(coupon) {
    return coupon.type === 'fixed' ? money(coupon.value) : `${coupon.value}%`;
  }

  function renderCouponList() {
    const coupons = RUA98.coupons({ includeInactive: true });
    if (!coupons.length) return '<p class="security-note">NENHUM CUPOM CADASTRADO. CRIE O PRIMEIRO ACIMA.</p>';
    return `
      <div class="coupon-list">
        ${coupons.map(coupon => {
          const uses = RUA98.couponUsage(coupon.code);
          return `
            <div class="coupon-item${coupon.active ? '' : ' is-off'}">
              <div class="coupon-code"><b>${esc(coupon.code)}</b><span>${esc(coupon.label)}</span></div>
              <div class="coupon-meta">
                <strong>${esc(couponValue(coupon))}</strong>
                <span>${Number(coupon.minSubtotal) > 0 ? `MÍN. ${money(coupon.minSubtotal)}` : 'SEM MÍNIMO'}${coupon.oncePerUser ? ' · USO ÚNICO' : ''}</span>
              </div>
              <div class="coupon-uses"><b>${uses}</b><span>USO${uses === 1 ? '' : 'S'}</span></div>
              <span class="badge ${coupon.active ? 'active' : 'inactive'}">${coupon.active ? 'ATIVO' : 'PAUSADO'}</span>
              <div class="row-actions">
                <button class="icon-action" type="button" data-action="edit-coupon" data-code="${esc(coupon.code)}" title="Editar cupom">✎</button>
                <button class="icon-action" type="button" data-action="toggle-coupon" data-code="${esc(coupon.code)}" title="${coupon.active ? 'Pausar cupom' : 'Ativar cupom'}">${coupon.active ? '❚❚' : '▶'}</button>
                <button class="icon-action danger" type="button" data-action="delete-coupon" data-code="${esc(coupon.code)}" title="Excluir cupom">×</button>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  function renderSettings() {
    const settings = RUA98.settings();
    const admins = RUA98.users().filter(user => user.role === 'admin');
    const subscribers = RUA98.newsletterSubscribers();
    content.innerHTML = `
      <div class="admin-panel">
        <div class="panel-heading">
          <div><h2>CONFIGURAÇÕES<span>.</span></h2><p>AJUSTES DA LOJA, EQUIPE E DADOS.</p></div>
        </div>
        <div class="settings-grid">
          <div class="settings-col">
            <div class="settings-card">
              <div class="settings-card-head"><h3>Configurações da loja</h3><p>TEXTOS E REGRAS QUE APARECEM NA VITRINE.</p></div>
              <form class="settings-form" id="settings-form">
                <label class="span-2">ANÚNCIO PRINCIPAL<input name="announcement" value="${esc(settings.announcement)}" maxlength="80"></label>
                <label class="span-2">ANÚNCIO SECUNDÁRIO<input name="announcementTwo" value="${esc(settings.announcementTwo)}" maxlength="90"></label>
                <label>FRETE GRÁTIS A PARTIR DE (R$)<input name="freeShipping" type="number" min="0" step="0.01" value="${esc(settings.freeShipping)}"></label>
                <label>TAXA DE ENTREGA (R$)<input name="shippingFee" type="number" min="0" step="0.01" value="${esc(settings.shippingFee)}"></label>
                <label class="span-2">TEXTO DO TOPO (SEM DROP ATIVO)<input name="heroEyebrow" value="${esc(settings.heroEyebrow)}" maxlength="80"></label>
                <label>INSTAGRAM (URL)<input name="instagram" value="${esc(settings.instagram)}" placeholder="https://instagram.com/..."></label>
                <label>WHATSAPP (URL)<input name="whatsapp" value="${esc(settings.whatsapp)}" placeholder="https://wa.me/..."></label>
                <label class="span-2">AVISO DO CHECKOUT<textarea name="checkoutNote" maxlength="120">${esc(settings.checkoutNote)}</textarea></label>
              </form>
              <div class="settings-actions">
                <button class="admin-button admin-button-dark" type="submit" form="settings-form">SALVAR CONFIGURAÇÕES <span>↗</span></button>
                <span class="settings-message" id="settings-message" hidden></span>
              </div>
            </div>
            <div class="settings-card">
              <div class="settings-card-head"><h3>Cupons de desconto</h3><p>CRIE E CONTROLE OS CÓDIGOS DA LOJA.</p></div>
              <form class="settings-form coupon-form" id="coupon-form">
                <input type="hidden" name="originalCode" value="">
                <label>CÓDIGO<input name="code" placeholder="RUA10" maxlength="20" autocomplete="off" required></label>
                <label>TIPO<select name="type"><option value="percent">PERCENTUAL (%)</option><option value="fixed">VALOR FIXO (R$)</option></select></label>
                <label>VALOR<input name="value" type="number" min="0.01" step="0.01" placeholder="10" required></label>
                <label>COMPRA MÍNIMA (R$)<input name="minSubtotal" type="number" min="0" step="0.01" value="0"></label>
                <label class="span-2">DESCRIÇÃO<input name="label" placeholder="10% OFF NA PRIMEIRA COMPRA" maxlength="60"></label>
                <div class="form-checks span-2">
                  <label><input type="checkbox" name="active" checked> ATIVO</label>
                  <label><input type="checkbox" name="oncePerUser" checked> USO ÚNICO POR CONTA</label>
                </div>
                <div class="coupon-form-actions span-2">
                  <button class="admin-button admin-button-dark" type="submit">SALVAR CUPOM <span>↗</span></button>
                  <button class="admin-button" type="button" data-action="cancel-coupon" hidden>CANCELAR EDIÇÃO</button>
                  <span class="settings-message" id="coupon-message" hidden></span>
                </div>
              </form>
              ${renderCouponList()}
            </div>
            <div class="settings-card">
              <div class="settings-card-head"><h3>Adicionar administrador</h3><p>CRIE UM NOVO ACESSO AO PAINEL.</p></div>
              <form class="add-admin-form" id="add-admin-form">
                <input name="name" placeholder="Nome completo" autocomplete="name" required maxlength="60">
                <input name="email" type="email" placeholder="email@rua98.com" autocomplete="email" required>
                <input name="password" type="password" placeholder="Senha (mín. 6 caracteres)" autocomplete="new-password" minlength="6" required>
                <button class="admin-button" type="submit">CRIAR ACESSO ADMIN <span>↗</span></button>
                <span class="settings-message" id="add-admin-message" hidden></span>
              </form>
            </div>
          </div>
          <div class="settings-col">
            <div class="settings-card">
              <div class="settings-card-head"><h3>Equipe</h3><p>${admins.length} ${admins.length === 1 ? 'ADMINISTRADOR' : 'ADMINISTRADORES'}</p></div>
              <div class="team-list">
                ${admins.map(admin => {
                  const initials = admin.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
                  return `<div class="team-member"><span class="avatar">${esc(initials)}</span><div><b>${esc(admin.name)}${admin.id === me.id ? ' (VOCÊ)' : ''}</b><span>${esc(admin.email)}</span></div><span class="badge admin">ADMIN</span></div>`;
                }).join('')}
              </div>
            </div>
            <div class="settings-card">
              <div class="settings-card-head"><h3>Lista da rua</h3><p>${subscribers.length} ${subscribers.length === 1 ? 'E-MAIL CADASTRADO' : 'E-MAILS CADASTRADOS'}</p></div>
              ${subscribers.length ? `
                <div class="team-list">
                  ${subscribers.slice(0, 6).map(entry => `
                    <div class="team-member">
                      <span class="avatar">✳</span>
                      <div><b>${esc(entry.email)}</b><span>${dateBR(entry.createdAt)} · ${esc(entry.source || 'site').toUpperCase()}</span></div>
                    </div>`).join('')}
                </div>
                ${subscribers.length > 6 ? `<p class="security-note">E MAIS ${subscribers.length - 6} CONTATO(S) NA LISTA.</p>` : ''}`
                : '<p class="security-note">NENHUM E-MAIL CADASTRADO AINDA. A LISTA É ALIMENTADA PELA NEWSLETTER DA VITRINE.</p>'}
              <div class="data-actions"><button class="admin-button" type="button" data-action="export-newsletter" ${subscribers.length ? '' : 'disabled'}>EXPORTAR LISTA CSV <span>↓</span></button></div>
            </div>
            <div class="settings-card">
              <div class="settings-card-head"><h3>Dados da loja</h3><p>BACKUP E RESTAURAÇÃO</p></div>
              <div class="data-actions">
                <button class="admin-button" type="button" data-action="export-data">EXPORTAR BACKUP JSON <span>↓</span></button>
                <button class="admin-button admin-button-danger" type="button" data-action="reset-demo">RESTAURAR DADOS DEMO <span>↺</span></button>
              </div>
              <p class="security-note"><b>Ambiente demonstrativo.</b> Produtos, contas e pedidos ficam no localStorage deste navegador. Em produção, use backend, banco de dados, HTTPS e autenticação de sessão no servidor.</p>
            </div>
          </div>
        </div>
      </div>`;
  }

  function saveSettings(form) {
    try {
      RUA98.saveSettings({
        announcement: form.elements.announcement.value,
        announcementTwo: form.elements.announcementTwo.value,
        freeShipping: Number(form.elements.freeShipping.value) || 0,
        shippingFee: Number(form.elements.shippingFee.value) || 0,
        heroEyebrow: form.elements.heroEyebrow.value,
        instagram: form.elements.instagram.value,
        whatsapp: form.elements.whatsapp.value,
        checkoutNote: form.elements.checkoutNote.value
      });
      const message = $('#settings-message');
      message.textContent = 'CONFIGURAÇÕES SALVAS ✳';
      message.hidden = false;
      setTimeout(() => { message.hidden = true; }, 3000);
      toast('CONFIGURAÇÕES DA LOJA ATUALIZADAS ✳');
    } catch (error) {
      toast(error.message.toUpperCase());
    }
  }

  async function addAdmin(form) {
    const message = $('#add-admin-message');
    message.hidden = true;
    try {
      await RUA98.createAdmin({
        name: form.elements.name.value,
        email: form.elements.email.value,
        password: form.elements.password.value
      });
      form.reset();
      renderSettings();
      toast('NOVO ADMINISTRADOR CRIADO ✳');
    } catch (error) {
      message.textContent = error.message.toUpperCase();
      message.hidden = false;
    }
  }

  function fillCouponForm(code) {
    const coupon = RUA98.coupons({ includeInactive: true }).find(entry => entry.code === code);
    if (!coupon) return toast('CUPOM NÃO ENCONTRADO.');
    const form = $('#coupon-form');
    if (!form) return;
    form.elements.originalCode.value = coupon.code;
    form.elements.code.value = coupon.code;
    form.elements.type.value = coupon.type;
    form.elements.value.value = coupon.value;
    form.elements.minSubtotal.value = coupon.minSubtotal || 0;
    form.elements.label.value = coupon.label || '';
    form.elements.active.checked = Boolean(coupon.active);
    form.elements.oncePerUser.checked = Boolean(coupon.oncePerUser);
    form.querySelector('[data-action="cancel-coupon"]').hidden = false;
    form.querySelector('.admin-button-dark').innerHTML = 'ATUALIZAR CUPOM <span>↗</span>';
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    form.elements.code.focus({ preventScroll: true });
  }

  function submitCoupon(form) {
    const message = $('#coupon-message');
    if (message) message.hidden = true;
    try {
      const coupon = RUA98.saveCoupon({
        originalCode: form.elements.originalCode.value,
        code: form.elements.code.value,
        type: form.elements.type.value,
        value: form.elements.value.value,
        minSubtotal: form.elements.minSubtotal.value,
        label: form.elements.label.value,
        active: form.elements.active.checked,
        oncePerUser: form.elements.oncePerUser.checked
      });
      renderSettings();
      const fresh = $('#coupon-message');
      if (fresh) {
        fresh.textContent = `CUPOM ${coupon.code} SALVO ✳`;
        fresh.hidden = false;
        setTimeout(() => { fresh.hidden = true; }, 3200);
      }
      toast(`CUPOM ${coupon.code} SALVO ✳`);
    } catch (error) {
      if (message) {
        message.textContent = error.message.toUpperCase();
        message.hidden = false;
      }
      toast(error.message.toUpperCase());
    }
  }

  function deleteCoupon(code) {
    confirmAction({
      title: `EXCLUIR CUPOM ${esc(code)}`,
      text: 'O código deixa de funcionar imediatamente. Pedidos já feitos com ele não são alterados.',
      label: 'EXCLUIR CUPOM',
      onConfirm: () => {
        RUA98.deleteCoupon(code);
        renderSettings();
        toast(`CUPOM ${code} EXCLUÍDO.`);
      }
    });
  }

  function toggleCoupon(code) {
    try {
      const coupon = RUA98.toggleCoupon(code);
      renderSettings();
      toast(`CUPOM ${coupon.code} ${coupon.active ? 'ATIVADO' : 'PAUSADO'} ✳`);
    } catch (error) {
      toast(error.message.toUpperCase());
    }
  }

  function saveTracking(form) {
    try {
      RUA98.updateOrderTracking(form.dataset.id, form.elements.tracking.value);
      openOrderModal(form.dataset.id);
      toast('CÓDIGO DE RASTREIO SALVO ✳');
    } catch (error) {
      toast(error.message.toUpperCase());
    }
  }

  function csvCell(value) {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadCSV(filename, headers, rows) {
    const content = [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
    downloadFile(filename, `\uFEFF${content}`, 'text/csv;charset=utf-8');
  }

  function exportOrders() {
    const orders = RUA98.orders();
    downloadCSV('rua98-pedidos.csv',
      ['PEDIDO', 'CLIENTE', 'E-MAIL', 'DATA', 'STATUS', 'ITENS', 'SUBTOTAL', 'DESCONTO', 'FRETE', 'TOTAL', 'CUPOM', 'RASTREIO'],
      orders.map(order => [
        order.number,
        order.userName,
        order.userEmail,
        dateBR(order.createdAt),
        statusLabels[order.status] || order.status,
        order.items.reduce((sum, item) => sum + item.quantity, 0),
        Number(order.subtotal || 0).toFixed(2).replace('.', ','),
        Number(order.discount || 0).toFixed(2).replace('.', ','),
        Number(order.shipping || 0).toFixed(2).replace('.', ','),
        Number(order.total || 0).toFixed(2).replace('.', ','),
        order.coupon ? order.coupon.code : '',
        order.trackingCode || ''
      ]));
    toast(`${orders.length} PEDIDO(S) EXPORTADO(S) ✳`);
  }

  function exportCustomers() {
    const customers = RUA98.users().filter(user => user.role === 'customer');
    downloadCSV('rua98-clientes.csv',
      ['NOME', 'E-MAIL', 'TELEFONE', 'CIDADE', 'UF', 'PEDIDOS', 'TOTAL GASTO', 'NA RUA DESDE', 'STATUS'],
      customers.map(user => [
        user.name,
        user.email,
        user.phone || '',
        user.city || '',
        user.state || '',
        user.orders,
        Number(user.spent || 0).toFixed(2).replace('.', ','),
        dateBR(user.createdAt),
        user.blocked ? 'BLOQUEADO' : 'ATIVO'
      ]));
    toast(`${customers.length} CLIENTE(S) EXPORTADO(S) ✳`);
  }

  function exportNewsletter() {
    const subscribers = RUA98.newsletterSubscribers();
    downloadCSV('rua98-newsletter.csv',
      ['E-MAIL', 'DATA', 'ORIGEM'],
      subscribers.map(entry => [entry.email, dateBR(entry.createdAt), entry.source || 'site']));
    toast(`${subscribers.length} CONTATO(S) EXPORTADO(S) ✳`);
  }

  function exportData() {
    downloadFile('rua98-backup.json', RUA98.exportData(), 'application/json');
    toast('BACKUP EXPORTADO ✳');
  }

  function resetDemo() {
    confirmAction({
      title: 'RESTAURAR DADOS DEMO',
      text: 'Todos os produtos, pedidos, clientes e configurações criados neste navegador serão apagados e a base inicial será restaurada. Você precisará entrar novamente.',
      label: 'RESTAURAR DEMO',
      onConfirm: async () => {
        await RUA98.resetDemo();
        toast('DADOS RESTAURADOS. RECARREGANDO...');
        setTimeout(() => location.reload(), 800);
      }
    });
  }

  /* ---------------- modal ---------------- */
  function openModal(markup, options = {}) {
    modalRoot.innerHTML = `<div class="admin-modal-scrim" data-close-modal></div><div class="admin-modal${options.wide ? ' wide' : ''}" role="dialog" aria-modal="true">${markup}</div>`;
    document.body.classList.add('admin-modal-open');
    requestAnimationFrame(() => modalRoot.querySelector('input, select, textarea, button')?.focus());
  }

  function closeModal() {
    modalRoot.innerHTML = '';
    document.body.classList.remove('admin-modal-open');
  }

  function confirmAction({ title, text, label, onConfirm }) {
    openModal(`
      <div class="form-head">
        <div><span class="admin-eyebrow">CONFIRMAÇÃO</span><h2>${esc(title)}</h2></div>
        <button class="modal-close" type="button" data-close-modal aria-label="Fechar">×</button>
      </div>
      <div class="confirm-copy"><p>${text}</p></div>
      <div class="confirm-actions">
        <button class="admin-button" type="button" data-close-modal>CANCELAR</button>
        <button class="admin-button admin-button-danger" type="button" id="confirm-yes">${esc(label)}</button>
      </div>`);
    $('#confirm-yes').addEventListener('click', () => {
      closeModal();
      onConfirm();
    });
  }

  /* ---------------- eventos ---------------- */
  $('#admin-login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('.login-submit');
    const error = $('#login-error');
    error.hidden = true;
    button.disabled = true;
    button.textContent = 'VERIFICANDO...';
    try {
      const user = await RUA98.login(form.elements.email.value, form.elements.password.value);
      if (user.role !== 'admin') {
        RUA98.logout();
        throw new Error('Esta conta não tem acesso ao painel administrativo.');
      }
      me = user;
      loginScreen.hidden = true;
      app.hidden = false;
      state.panel = 'dashboard';
      renderUser();
      render();
      toast(`PAINEL LIBERADO. BEM-VINDA, ${user.name.toUpperCase()} ✳`);
    } catch (loginError) {
      error.textContent = loginError.message.toUpperCase();
      error.hidden = false;
      updateLoginNote();
    } finally {
      button.disabled = false;
      button.innerHTML = 'ACESSAR PAINEL <span>↗</span>';
    }
  });

  $('#login-demo').addEventListener('click', () => {
    const form = $('#admin-login-form');
    form.elements.email.value = 'admin@rua98.com';
    form.elements.password.value = 'rua98admin';
    form.requestSubmit();
  });

  document.querySelector('.admin-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-panel]');
    if (!button) return;
    state.panel = button.dataset.panel;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  $('#sidebar-logout').addEventListener('click', () => {
    RUA98.logout();
    showLogin(true);
    toast('SESSÃO ENCERRADA.');
  });

  $('#mobile-nav-toggle').addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeSidebar();
    else openSidebar();
  });
  sidebarScrim.addEventListener('click', closeSidebar);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
      closeSidebar();
    }
  });

  content.addEventListener('click', event => {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;
    const { action, id, code } = actionElement.dataset;
    if (action === 'new-product') openProductModal();
    if (action === 'edit-product') openProductModal(id);
    if (action === 'delete-product') deleteProduct(id);
    if (action === 'new-drop') openDropModal();
    if (action === 'edit-drop') openDropModal(id);
    if (action === 'delete-drop') deleteDrop(id);
    if (action === 'new-collection') openCollectionModal();
    if (action === 'edit-collection') openCollectionModal(id);
    if (action === 'delete-collection') deleteCollection(id);
    if (action === 'view-order') openOrderModal(id);
    if (action === 'view-customer') openCustomerModal(id);
    if (action === 'toggle-block') toggleBlock(id);
    if (action === 'go-orders') { state.panel = 'orders'; render(); window.scrollTo({ top: 0 }); }
    if (action === 'go-customers') { state.panel = 'customers'; render(); window.scrollTo({ top: 0 }); }
    if (action === 'export-data') exportData();
    if (action === 'export-orders') exportOrders();
    if (action === 'export-customers') exportCustomers();
    if (action === 'export-newsletter') exportNewsletter();
    if (action === 'edit-coupon') fillCouponForm(code);
    if (action === 'delete-coupon') deleteCoupon(code);
    if (action === 'toggle-coupon') toggleCoupon(code);
    if (action === 'cancel-coupon') renderSettings();
    if (action === 'reset-demo') resetDemo();
  });

  content.addEventListener('input', event => {
    if (event.target.id === 'product-search') {
      state.productSearch = event.target.value;
      refreshProductRows();
    }
    if (event.target.id === 'order-search') {
      state.orderSearch = event.target.value;
      refreshOrdersTable();
    }
    if (event.target.id === 'customer-search') {
      state.customerSearch = event.target.value;
      refreshCustomerRows();
    }
  });

  content.addEventListener('change', event => {
    if (event.target.id === 'order-filter') {
      state.orderFilter = event.target.value;
      refreshOrdersTable();
    }
  });

  content.addEventListener('submit', event => {
    event.preventDefault();
    if (event.target.id === 'settings-form') saveSettings(event.target);
    if (event.target.id === 'add-admin-form') addAdmin(event.target);
    if (event.target.id === 'coupon-form') submitCoupon(event.target);
  });

  modalRoot.addEventListener('click', event => {
    if (event.target.closest('[data-close-modal]')) {
      closeModal();
      return;
    }
    const blockButton = event.target.closest('[data-modal-block]');
    if (blockButton) {
      const id = blockButton.dataset.modalBlock;
      closeModal();
      toggleBlock(id);
    }
  });

  modalRoot.addEventListener('submit', event => {
    event.preventDefault();
    if (event.target.id === 'product-form') submitProduct(event.target);
    if (event.target.id === 'drop-form') submitDrop(event.target);
    if (event.target.id === 'collection-form') submitCollection(event.target);
    if (event.target.id === 'tracking-form') saveTracking(event.target);
  });

  modalRoot.addEventListener('input', event => {
    if (event.target.id === 'product-image') {
      const preview = $('#product-image-preview');
      if (preview) preview.src = event.target.value;
    }
  });

  modalRoot.addEventListener('change', event => {
    if (event.target.classList.contains('order-modal-status')) {
      changeOrderStatus(event.target.dataset.id, event.target.value);
    }
  });

  if (RUA98.currentUser()?.role === 'admin') enterApp();
  else showLogin();
})();
