/* RUA 98 — loja */
(async () => {
  await RUA98.ready();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const price = value => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const state = { category: 'todos', collection: 'todos', search: '' };
  const grid = document.querySelector('#product-grid');
  const filterList = document.querySelector('#filter-list');
  const collectionFilter = document.querySelector('#collection-filter');
  const resultsCount = document.querySelector('.results-count');
  const emptyProducts = document.querySelector('.empty-products');
  const drawer = document.querySelector('.cart-drawer');

  function applySettings() {
    const settings = RUA98.settings();
    const announcementParts = document.querySelectorAll('.announcement > span:not(.announcement-dot)');
    if (announcementParts[0]) announcementParts[0].textContent = settings.announcement;
    if (announcementParts[1]) announcementParts[1].textContent = settings.announcementTwo;
    const shippingLabel = document.querySelector('.shipping-progress > span');
    if (shippingLabel) shippingLabel.textContent = `FRETE GRÁTIS A PARTIR DE ${price(settings.freeShipping)}`;
    const heroEyebrow = document.querySelector('.hero .eyebrow');
    if (heroEyebrow) {
      const drop = RUA98.activeDrop();
      const label = drop ? drop.name : settings.heroEyebrow;
      heroEyebrow.innerHTML = '<span class="eyebrow-line"></span> ';
      heroEyebrow.append(document.createTextNode(label));
    }
    const instagram = document.querySelector('.social-links a[aria-label="Instagram"]');
    if (instagram && settings.instagram) instagram.href = settings.instagram;
    const whatsapp = document.querySelector('.social-links a[aria-label="TikTok"]');
    if (whatsapp && settings.whatsapp) whatsapp.href = settings.whatsapp;
    const checkoutNote = document.querySelector('.checkout-note');
    if (checkoutNote) checkoutNote.textContent = settings.checkoutNote;
  }

  function activeProducts() {
    return RUA98.products().filter(product => product.active);
  }

  function renderFilters() {
    const products = activeProducts();
    const count = category => category === 'todos' ? products.length : products.filter(product => product.category === category).length;
    filterList.innerHTML = [
      { id: 'todos', label: 'TUDO' },
      { id: 'oversized', label: 'OVERSIZED' },
      { id: 'old-school', label: 'OLD SCHOOL' }
    ].map(item => `
      <button class="filter-chip${state.category === item.id ? ' active' : ''}" data-filter="${item.id}">
        ${item.label} <span>${String(count(item.id)).padStart(2, '0')}</span>
      </button>`).join('');
    const collections = RUA98.collections();
    if (state.collection !== 'todos' && !collections.some(collection => collection.id === state.collection)) {
      state.collection = 'todos';
    }
    collectionFilter.innerHTML = '<option value="todos">TODAS</option>' + collections
      .map(collection => `<option value="${esc(collection.id)}">${esc(collection.name.toUpperCase())}</option>`)
      .join('');
    collectionFilter.value = state.collection;
  }

  function filteredProducts() {
    const collections = new Map(RUA98.collections({ includeInactive: true }).map(collection => [collection.id, collection.name]));
    const term = state.search.trim().toLowerCase();
    return activeProducts().filter(product => {
      const matchesCategory = state.category === 'todos' || product.category === state.category;
      const matchesCollection = state.collection === 'todos' || product.collectionId === state.collection;
      const haystack = [product.name, product.subtitle, product.tag, product.description, collections.get(product.collectionId) || '']
        .join(' ').toLowerCase();
      return matchesCategory && matchesCollection && (!term || haystack.includes(term));
    });
  }

  function productCard(product) {
    const favorite = RUA98.isFavorite(product.id);
    const collection = RUA98.collection(product.collectionId);
    const tagClass = product.isNew ? 'tag-new' : /LIMITADA|ESGOTADO/.test(product.tag) ? 'tag-limited' : '';
    const soldOut = product.stock <= 0;
    return `
      <article class="product-card" data-category="${esc(product.category)}" data-collection="${esc(product.collectionId)}" data-id="${esc(product.id)}" data-name="${esc(product.name.toLowerCase())}">
        <div class="product-image">
          <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">
          ${product.tag ? `<span class="product-tag ${tagClass}">${esc(soldOut ? 'ESGOTADO' : product.tag)}</span>` : soldOut ? '<span class="product-tag tag-limited">ESGOTADO</span>' : ''}
          <button class="favorite-btn${favorite ? ' active' : ''}" data-favorite="${esc(product.id)}" aria-label="${favorite ? 'Remover dos favoritos' : 'Favoritar'} ${esc(product.name)}" aria-pressed="${favorite}">
            <svg viewBox="0 0 24 24"><path d="M20.8 8.7c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10a4.7 4.7 0 0 1 8.8-2.2 4.7 4.7 0 0 1 8.8 2.2Z"/></svg>
          </button>
          <button class="quick-add" data-product="${esc(product.id)}" ${soldOut ? 'disabled' : ''}>
            ${soldOut ? 'ESGOTADO' : 'ADICIONAR À SACOLA'} <span>${soldOut ? '×' : '＋'}</span>
          </button>
        </div>
        <div class="product-info">
          <div><h3>${esc(product.name)}</h3><span class="product-subtitle">${esc(product.subtitle || product.meta)}</span></div>
          <span class="product-price">${price(product.price)}${product.compareAt ? `<s>${price(product.compareAt)}</s>` : ''}</span>
        </div>
        <div class="product-meta">
          <span>${esc(product.meta || '100% ALGODÃO')}</span>
          <span class="collection-name">${esc(collection ? collection.name : 'RUA 98')}</span>
        </div>
      </article>`;
  }

  function renderProducts() {
    const products = filteredProducts();
    grid.innerHTML = products.map(productCard).join('');
    resultsCount.textContent = `MOSTRANDO ${String(products.length).padStart(2, '0')} ${products.length === 1 ? 'PEÇA' : 'PEÇAS'}`;
    emptyProducts.hidden = products.length > 0;
    grid.hidden = products.length === 0;
    renderFilters();
  }

  function renderCart() {
    const cart = RUA98.cart();
    const settings = RUA98.settings();
    const total = cart.subtotal;
    document.querySelector('.cart-count').textContent = cart.count;
    document.querySelector('.drawer-item-count').textContent = `(${cart.count})`;
    document.querySelector('.subtotal b').textContent = price(total);
    const shippingLabel = document.querySelector('.shipping-progress > span');
    shippingLabel.textContent = total >= settings.freeShipping
      ? 'VOCÊ GANHOU FRETE GRÁTIS!'
      : `FALTAM ${price(settings.freeShipping - total)} PARA O FRETE GRÁTIS`;
    document.querySelector('.progress-track i').style.width = `${Math.min(100, (total / settings.freeShipping) * 100)}%`;
    drawer.classList.toggle('has-items', cart.count > 0);
    document.querySelector('.cart-items').innerHTML = cart.lines.map(line => `
      <article class="cart-line">
        <img src="${esc(line.product.image)}" alt="${esc(line.product.name)}">
        <div>
          <h3>${esc(line.product.name)}</h3>
          <p>${esc(line.product.subtitle)}<br>TAMANHO: ${esc(line.size)}</p>
          <div class="cart-line-controls">
            <button class="qty-btn" data-action="minus" data-product="${esc(line.productId)}" data-size="${esc(line.size)}" aria-label="Diminuir quantidade">−</button>
            <span class="qty-number">${line.quantity}</span>
            <button class="qty-btn" data-action="plus" data-product="${esc(line.productId)}" data-size="${esc(line.size)}" aria-label="Aumentar quantidade">+</button>
            <button class="remove-item" data-action="remove" data-product="${esc(line.productId)}" data-size="${esc(line.size)}">REMOVER</button>
          </div>
        </div>
        <span class="cart-line-price">${price(line.total)}</span>
      </article>`).join('');
    const checkoutButton = document.querySelector('.checkout-btn');
    checkoutButton.disabled = cart.count === 0;
  }

  function openCart() {
    document.body.classList.add('cart-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.querySelector('.close-drawer').focus();
  }
  function closeCart() {
    document.body.classList.remove('cart-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  function openSizePicker(button) {
    const image = button.closest('.product-image');
    const product = RUA98.product(button.dataset.product);
    if (!product) return;
    document.querySelectorAll('.size-picker').forEach(picker => picker.remove());
    if (product.stock <= 0) {
      AuthUI.toast('ESSA PEÇA ESGOTOU. VOLTA LOGO ✳');
      return;
    }
    const picker = document.createElement('div');
    picker.className = 'size-picker';
    picker.setAttribute('aria-label', 'Escolha o tamanho');
    picker.innerHTML = `<span>ESCOLHA SEU TAMANHO · ${product.stock} EM ESTOQUE</span><div>${product.sizes.map(size => `<button type="button" data-size="${esc(size)}">${esc(size)}</button>`).join('')}</div>`;
    image.append(picker);
    picker.querySelectorAll('button').forEach(sizeButton => sizeButton.addEventListener('click', event => {
      event.stopPropagation();
      try {
        RUA98.addToCart(product.id, sizeButton.dataset.size);
        picker.remove();
        renderCart();
        AuthUI.toast(`${product.name} · TAM. ${sizeButton.dataset.size} NA SACOLA ✳`);
        openCart();
      } catch (error) {
        AuthUI.toast(error.message.toUpperCase());
        picker.remove();
      }
    }));
  }

  filterList.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.category = button.dataset.filter;
    renderProducts();
  });

  collectionFilter.addEventListener('change', event => {
    state.collection = event.target.value;
    renderProducts();
  });

  grid.addEventListener('click', event => {
    const favoriteButton = event.target.closest('[data-favorite]');
    if (favoriteButton) {
      try {
        const result = RUA98.toggleFavorite(favoriteButton.dataset.favorite);
        AuthUI.toast(result.active ? 'PEÇA SALVA NOS SEUS FAVORITOS ✳' : 'PEÇA REMOVIDA DOS FAVORITOS');
        renderProducts();
        AuthUI.refreshHeader();
      } catch (error) {
        AuthUI.toast(error.message.toUpperCase());
      }
      return;
    }
    const addButton = event.target.closest('.quick-add');
    if (addButton && !addButton.disabled) openSizePicker(addButton);
  });

  document.querySelector('.cart-toggle').addEventListener('click', openCart);
  document.querySelector('.close-drawer').addEventListener('click', closeCart);
  document.querySelector('.drawer-scrim').addEventListener('click', closeCart);
  document.querySelector('.continue-shopping').addEventListener('click', () => {
    closeCart();
    document.querySelector('#colecao').scrollIntoView({ behavior: 'smooth' });
  });
  document.querySelector('.checkout-btn').addEventListener('click', () => AuthUI.openCheckout());

  document.querySelector('.cart-items').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, product, size } = button.dataset;
    if (action === 'plus') RUA98.updateCartQuantity(product, size, 1);
    if (action === 'minus') RUA98.updateCartQuantity(product, size, -1);
    if (action === 'remove') RUA98.removeCartItem(product, size);
    renderCart();
  });

  document.querySelector('.search-toggle').addEventListener('click', () => {
    const panel = document.querySelector('.search-panel');
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) document.querySelector('#search-input').focus();
  });
  document.querySelector('#search-input').addEventListener('input', event => {
    state.search = event.target.value;
    renderProducts();
  });
  document.querySelector('.search-submit').addEventListener('click', () => {
    document.querySelector('.search-panel').classList.remove('open');
    document.querySelector('#colecao').scrollIntoView({ behavior: 'smooth' });
  });
  document.querySelector('.clear-search').addEventListener('click', () => {
    state.search = '';
    state.category = 'todos';
    state.collection = 'todos';
    document.querySelector('#search-input').value = '';
    document.querySelector('#collection-filter').value = 'todos';
    renderProducts();
  });

  document.querySelector('.menu-toggle').addEventListener('click', event => {
    const nav = document.querySelector('.main-nav');
    const open = nav.classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.main-nav a').forEach(link => link.addEventListener('click', () => {
    document.querySelector('.main-nav').classList.remove('open');
    document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false');
  }));

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeCart();
      document.querySelector('.search-panel').classList.remove('open');
      document.querySelector('.main-nav').classList.remove('open');
      document.querySelectorAll('.size-picker').forEach(picker => picker.remove());
    }
  });

  document.querySelector('.newsletter-form').addEventListener('submit', event => {
    event.preventDefault();
    const email = document.querySelector('#email');
    if (!email.checkValidity()) return email.reportValidity();
    AuthUI.toast('VOCÊ TÁ NA LISTA! CONFERE SEU E-MAIL ✳');
    event.currentTarget.reset();
  });

  window.addEventListener('rua98:auth', () => {
    renderProducts();
    renderCart();
  });
  window.addEventListener('rua98:data', () => {
    renderFilters();
    renderProducts();
    renderCart();
  });

  applySettings();
  renderProducts();
  renderCart();
  AuthUI.refreshHeader();
})();
