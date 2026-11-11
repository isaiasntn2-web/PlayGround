/* RUA 98 — área do cliente */
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
  const statusLabels = {
    pendente: 'AGUARDANDO PAGAMENTO',
    pago: 'PAGO',
    enviado: 'ENVIADO',
    entregue: 'ENTREGUE',
    cancelado: 'CANCELADO'
  };
  const state = { pane: 'overview' };

  function formatDate(date) {
    if (!date) return '—';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '—';
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = parsed.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    return `${day} ${month} ${parsed.getFullYear()}`;
  }

  function applySettings() {
    const settings = RUA98.settings();
    const announcementParts = document.querySelectorAll('.announcement > span:not(.announcement-dot)');
    if (announcementParts[0]) announcementParts[0].textContent = settings.announcement;
    if (announcementParts[1]) announcementParts[1].textContent = settings.announcementTwo;
  }

  function setPane(pane, updateHash = false) {
    const allowed = ['overview', 'orders', 'favorites', 'profile'];
    state.pane = allowed.includes(pane) ? pane : 'overview';
    document.querySelectorAll('.account-nav [data-pane]').forEach(button => {
      button.classList.toggle('active', button.dataset.pane === state.pane);
    });
    document.querySelectorAll('.account-pane').forEach(element => {
      element.hidden = element.dataset.pane !== state.pane;
    });
    if (updateHash) {
      const hashes = { overview: 'conta.html', orders: '#pedidos', favorites: '#favoritos', profile: '#dados' };
      history.replaceState(null, '', hashes[state.pane] || 'conta.html');
    }
  }

  function orderCard(order) {
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    return `
      <article class="account-order">
        <div class="account-order-head">
          <div>
            <span class="account-order-number">PEDIDO #${order.number}</span>
            <span class="account-order-date">${formatDate(order.createdAt)} · ${esc(order.payment).toUpperCase()}</span>
          </div>
          <span class="order-status ${esc(order.status)}">${statusLabels[order.status] || esc(order.status)}</span>
        </div>
        <div class="account-order-body">
          ${order.items.map(item => `
            <div class="account-order-item">
              <img src="${esc(item.image)}" alt="${esc(item.name)}">
              <div><b>${esc(item.name)}</b><span>TAM. ${esc(item.size)} · QTD. ${item.quantity}</span></div>
              <strong>${money(item.price * item.quantity)}</strong>
            </div>`).join('')}
        </div>
        <div class="account-order-foot">
          <span>${itemCount} ${itemCount === 1 ? 'PEÇA' : 'PEÇAS'} · FRETE ${order.shipping ? money(order.shipping) : 'GRÁTIS'}</span>
          <b>${money(order.total)}</b>
        </div>
      </article>`;
  }

  function renderOverview(user, orders) {
    const latest = orders[0];
    const needsProfile = !user.phone || !user.address;
    $('#pane-overview').innerHTML = `
      <div class="account-pane-title"><div><h2>VISÃO GERAL.</h2><p>O QUE É SEU, FICA AQUI.</p></div></div>
      <div class="account-welcome">
        <div>
          <h3>${latest ? 'VOCÊ JÁ FAZ PARTE DA RUA.' : 'SEU PRIMEIRO UNIFORME COMEÇA AQUI.'}</h3>
          <p>${latest
            ? `Seu pedido <b>#${latest.number}</b> está em andamento. Acompanhe o status em Meus Pedidos.`
            : 'Explore o drop atual e monte seu próximo uniforme. Suas peças favoritas ficam salvas nesta conta.'}</p>
        </div>
        <a class="button button-dark" href="${latest ? '#pedidos' : 'index.html#colecao'}" ${latest ? 'data-go="orders"' : ''}>${latest ? 'VER PEDIDOS' : 'VER AS PEÇAS'} <span>↗</span></a>
      </div>
      ${needsProfile ? `
        <div class="account-welcome" style="background:#e2e0d5">
          <div><h3>COMPLETE SEUS DADOS.</h3><p>Adicione telefone e endereço para fechar suas próximas compras em segundos.</p></div>
          <button class="button" type="button" data-go="profile">COMPLETAR <span>↗</span></button>
        </div>` : ''}
      ${latest ? `
        <div class="account-pane-title" style="margin-top:30px"><div><h2 style="font-size:22px">ÚLTIMO PEDIDO.</h2></div></div>
        ${orderCard(latest)}` : ''}
    `;
  }

  function renderOrders(orders) {
    $('#pane-orders').innerHTML = `
      <div class="account-pane-title">
        <div><h2>MEUS PEDIDOS.</h2><p>${orders.length ? `${orders.length} ${orders.length === 1 ? 'PEDIDO REGISTRADO' : 'PEDIDOS REGISTRADOS'}` : 'NADA POR AQUI AINDA'}</p></div>
        <a class="text-link" href="index.html#colecao">COMPRAR DE NOVO <span>↗</span></a>
      </div>
      ${orders.length ? orders.map(orderCard).join('') : `
        <div class="account-empty">
          <span>✳</span>
          <h3>SUA SACOLA AINDA NÃO VIROU PEDIDO.</h3>
          <p>O drop está na rua. Encontre a peça que combina com você.</p>
          <a class="button button-dark" href="index.html#colecao">VER AS PEÇAS <span>↗</span></a>
        </div>`}
    `;
  }

  function renderFavorites() {
    const products = RUA98.favoriteProducts();
    $('#pane-favorites').innerHTML = `
      <div class="account-pane-title">
        <div><h2>FAVORITOS.</h2><p>${products.length ? `${products.length} ${products.length === 1 ? 'PEÇA SALVA' : 'PEÇAS SALVAS'}` : 'SUA LISTA PESSOAL'}</p></div>
        <a class="text-link" href="index.html#colecao">CONTINUAR EXPLORANDO <span>↗</span></a>
      </div>
      ${products.length ? `
        <div class="favorite-grid">
          ${products.map(product => `
            <article class="favorite-card">
              <img src="${esc(product.image)}" alt="${esc(product.name)}">
              <div class="favorite-card-info">
                <h3>${esc(product.name)}</h3>
                <span>TAM. ${product.sizes.join(' · ')}</span>
                <div class="favorite-card-actions">
                  <a href="index.html#colecao">VER NA LOJA ↗</a>
                  <button type="button" data-remove-favorite="${esc(product.id)}">REMOVER</button>
                </div>
              </div>
            </article>`).join('')}
        </div>` : `
        <div class="account-empty">
          <span>♡</span>
          <h3>NENHUMA PEÇA SALVA.</h3>
          <p>Toque no coração dos produtos para montar sua lista pessoal.</p>
          <a class="button button-dark" href="index.html#colecao">ESCOLHER FAVORITOS <span>↗</span></a>
        </div>`}
    `;
  }

  function fillProfile(user) {
    const form = $('#profile-form');
    if (!form) return;
    form.elements.name.value = user.name || '';
    form.elements.email.value = user.email || '';
    form.elements.phone.value = user.phone || '';
    form.elements.zip.value = user.zip || '';
    form.elements.address.value = user.address || '';
    form.elements.city.value = user.city || '';
    form.elements.state.value = user.state || '';
  }

  function renderAll() {
    const user = RUA98.currentUser();
    const guest = $('#account-guest');
    const app = $('#account-app');
    if (!user) {
      guest.hidden = false;
      app.hidden = true;
      return;
    }
    guest.hidden = true;
    app.hidden = false;
    const orders = RUA98.myOrders();
    const favorites = RUA98.favorites();
    const spent = orders.filter(order => order.status !== 'cancelado').reduce((sum, order) => sum + order.total, 0);
    const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    $('#hero-avatar').textContent = initials || 'R';
    $('#hero-name').textContent = user.name;
    $('#hero-email').textContent = user.email;
    $('#hero-greeting').textContent = `E aí, ${user.name.split(/\s+/)[0]}. Tudo o que é seu, no mesmo lugar.`;
    $('#stat-orders').textContent = String(orders.length).padStart(2, '0');
    $('#stat-favorites').textContent = String(favorites.length).padStart(2, '0');
    $('#stat-spent').textContent = shortMoney(spent);
    $('#stat-since').textContent = new Date(user.createdAt || Date.now()).getFullYear();
    $('#nav-orders').textContent = orders.length;
    $('#nav-favs').textContent = favorites.length;
    const isAdmin = user.role === 'admin';
    $('#hero-admin-link').hidden = !isAdmin;
    $('#admin-nav-link').hidden = !isAdmin;
    $('#profile-form').elements.email.value = user.email;
    renderOverview(user, orders);
    renderOrders(orders);
    renderFavorites();
    if (!document.activeElement?.closest('#profile-form')) fillProfile(user);
  }

  function goPane(pane) {
    setPane(pane, true);
    if (pane === 'orders' || pane === 'favorites' || pane === 'profile') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelector('.account-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-pane]');
    if (button) goPane(button.dataset.pane);
  });

  document.addEventListener('click', event => {
    const go = event.target.closest('[data-go]');
    if (go) {
      event.preventDefault();
      goPane(go.dataset.go);
    }
  });

  document.querySelector('.account-content').addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-favorite]');
    if (!remove) return;
    try {
      RUA98.toggleFavorite(remove.dataset.removeFavorite);
      AuthUI.toast('PEÇA REMOVIDA DOS FAVORITOS.');
      renderAll();
    } catch (error) {
      AuthUI.toast(error.message.toUpperCase());
    }
  });

  $('#profile-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('#profile-message');
    message.hidden = true;
    message.classList.remove('error');
    try {
      RUA98.updateProfile({
        name: form.elements.name.value,
        phone: form.elements.phone.value,
        zip: form.elements.zip.value,
        address: form.elements.address.value,
        city: form.elements.city.value,
        state: form.elements.state.value
      });
      message.textContent = 'DADOS ATUALIZADOS ✳';
      message.hidden = false;
      AuthUI.toast('SEUS DADOS FORAM ATUALIZADOS ✳');
      renderAll();
      message.textContent = 'DADOS ATUALIZADOS ✳';
      message.hidden = false;
    } catch (error) {
      message.textContent = error.message.toUpperCase();
      message.classList.add('error');
      message.hidden = false;
    }
  });

  $('#password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = $('#password-message');
    message.hidden = true;
    message.classList.remove('error');
    if (form.elements.next.value !== form.elements.confirm.value) {
      message.textContent = 'AS SENHAS NÃO CONFEREM.';
      message.classList.add('error');
      message.hidden = false;
      return;
    }
    try {
      await RUA98.changePassword(form.elements.current.value, form.elements.next.value);
      form.reset();
      message.textContent = 'SENHA ALTERADA ✳';
      message.hidden = false;
      AuthUI.toast('SENHA ALTERADA COM SUCESSO ✳');
    } catch (error) {
      message.textContent = error.message.toUpperCase();
      message.classList.add('error');
      message.hidden = false;
    }
  });

  $('#hero-logout').addEventListener('click', () => {
    RUA98.logout();
    AuthUI.toast('VOCÊ SAIU DA CONTA. ATÉ LOGO ✳');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  $('#guest-login').addEventListener('click', () => AuthUI.openAuth('login'));
  $('#guest-register').addEventListener('click', () => AuthUI.openAuth('register'));

  const hashPane = { '#pedidos': 'orders', '#favoritos': 'favorites', '#dados': 'profile', '#overview': 'overview' }[location.hash];
  if (hashPane) state.pane = hashPane;

  window.addEventListener('rua98:auth', () => {
    renderAll();
    setPane(state.pane);
  });
  window.addEventListener('rua98:data', () => renderAll());

  applySettings();
  renderAll();
  setPane(state.pane);
  AuthUI.refreshHeader();
})();
