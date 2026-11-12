/* RUA 98 — loja */
(async () => {
  await RUA98.ready();

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const price = value => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const state = { category: 'todos', collection: 'todos', search: '', sort: 'featured', favoritesOnly: false };
  const RECENT_KEY = 'rua98_recent_v1';
  const grid = document.querySelector('#product-grid');
  const filterList = document.querySelector('#filter-list');
  const collectionFilter = document.querySelector('#collection-filter');
  const sortFilter = document.querySelector('#sort-filter');
  const favoritesToggle = document.querySelector('.favorites-toggle');
  const resultsCount = document.querySelector('.results-count');
  const emptyProducts = document.querySelector('.empty-products');
  const drawer = document.querySelector('.cart-drawer');
  const searchPanel = document.querySelector('.search-panel');
  const searchInput = document.querySelector('#search-input');
  const searchHint = document.querySelector('#search-hint');
  const searchToggle = document.querySelector('.search-toggle');
  const recentSection = document.querySelector('.recently-viewed');
  const recentGrid = document.querySelector('#recent-grid');
  let productElements = null;
  let modalProductId = null;
  let modalSize = '';
  let modalTrigger = null;
  let cartTrigger = null;

  function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(field);
    field.select();
    document.execCommand('copy');
    field.remove();
    return Promise.resolve();
  }

  function recentIds() {
    try {
      const saved = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter(id => RUA98.product(id)) : [];
    } catch {
      return [];
    }
  }

  function rememberRecent(id) {
    const list = recentIds().filter(entry => entry !== id);
    list.unshift(id);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 4))); } catch { /* modo privado */ }
    renderRecent();
  }

  function renderRecent() {
    if (!recentSection || !recentGrid) return;
    const products = recentIds().map(id => RUA98.product(id)).filter(product => product && product.active);
    recentSection.hidden = products.length === 0;
    recentGrid.innerHTML = products.map(product => `
      <article class="recent-card">
        <button class="recent-media" type="button" data-details="${esc(product.id)}" aria-label="Ver ${esc(product.name)}">
          <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">
        </button>
        <div class="recent-info">
          <div><b>${esc(product.name)}</b><span>${esc(product.subtitle || product.meta)}</span></div>
          <strong>${price(product.price)}</strong>
        </div>
      </article>`).join('');
  }

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
    if (sortFilter) sortFilter.value = state.sort;
  }

  function filteredProducts() {
    const collections = new Map(RUA98.collections({ includeInactive: true }).map(collection => [collection.id, collection.name]));
    const term = state.search.trim().toLowerCase();
    const results = activeProducts().filter(product => {
      const matchesCategory = state.category === 'todos' || product.category === state.category;
      const matchesCollection = state.collection === 'todos' || product.collectionId === state.collection;
      const matchesFavorite = !state.favoritesOnly || RUA98.isFavorite(product.id);
      const haystack = [product.name, product.subtitle, product.tag, product.description, collections.get(product.collectionId) || '']
        .join(' ').toLowerCase();
      return matchesCategory && matchesCollection && matchesFavorite && (!term || haystack.includes(term));
    });
    if (state.sort === 'price-asc') results.sort((a, b) => a.price - b.price);
    else if (state.sort === 'price-desc') results.sort((a, b) => b.price - a.price);
    else if (state.sort === 'name') results.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    else if (state.sort === 'new') results.sort((a, b) => Number(b.isNew) - Number(a.isNew) || String(b.createdAt).localeCompare(String(a.createdAt)));
    else results.sort((a, b) => Number(b.featured) - Number(a.featured) || Number(b.isNew) - Number(a.isNew));
    return results;
  }

  function productCard(product) {
    const favorite = RUA98.isFavorite(product.id);
    const collection = RUA98.collection(product.collectionId);
    const tagClass = product.isNew ? 'tag-new' : /LIMITADA|ESGOTADO/.test(product.tag) ? 'tag-limited' : '';
    const soldOut = product.stock <= 0;
    const lowStock = !soldOut && product.stock <= 8;
    return `
      <article class="product-card" data-category="${esc(product.category)}" data-collection="${esc(product.collectionId)}" data-id="${esc(product.id)}" data-name="${esc(product.name.toLowerCase())}">
        <div class="product-image">
          <img src="${esc(product.image)}" alt="${esc(product.name)}" loading="lazy">
          ${product.tag ? `<span class="product-tag ${tagClass}">${esc(soldOut ? 'ESGOTADO' : product.tag)}</span>` : soldOut ? '<span class="product-tag tag-limited">ESGOTADO</span>' : ''}
          <button class="favorite-btn${favorite ? ' active' : ''}" data-favorite="${esc(product.id)}" aria-label="${favorite ? 'Remover dos favoritos' : 'Favoritar'} ${esc(product.name)}" aria-pressed="${favorite}">
            <svg viewBox="0 0 24 24"><path d="M20.8 8.7c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10a4.7 4.7 0 0 1 8.8-2.2 4.7 4.7 0 0 1 8.8 2.2Z"/></svg>
          </button>
          ${lowStock ? `<span class="stock-flag">ÚLTIMAS ${product.stock}</span>` : ''}
          <button class="quick-add" data-product="${esc(product.id)}" ${soldOut ? 'disabled' : ''}>
            ${soldOut ? 'ESGOTADO' : 'ADICIONAR À SACOLA'} <span>${soldOut ? '×' : '＋'}</span>
          </button>
        </div>
        <div class="product-info">
          <div><h3>${esc(product.name)}</h3><span class="product-subtitle">${esc(product.subtitle || product.meta)}</span><button class="product-details" type="button" data-details="${esc(product.id)}" aria-label="Ver detalhes de ${esc(product.name)}">VER DETALHES <span>↗</span></button></div>
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
    const emptyText = emptyProducts.querySelector('.empty-text');
    if (emptyText) emptyText.textContent = state.favoritesOnly ? 'VOCÊ AINDA NÃO SALVOU NENHUMA PEÇA.' : 'NENHUMA PEÇA ENCONTRADA.';
    if (searchHint) {
      searchHint.textContent = state.search.trim()
        ? `${products.length} ${products.length === 1 ? 'PEÇA ENCONTRADA' : 'PEÇAS ENCONTRADAS'}`
        : '';
    }
    if (favoritesToggle) {
      const favorites = activeProducts().filter(product => RUA98.isFavorite(product.id)).length;
      favoritesToggle.querySelector('.favorites-count').textContent = favorites;
      favoritesToggle.classList.toggle('active', state.favoritesOnly);
      favoritesToggle.setAttribute('aria-pressed', String(state.favoritesOnly));
      favoritesToggle.setAttribute('aria-label', state.favoritesOnly ? 'Mostrar todas as peças' : 'Mostrar peças favoritas');
      favoritesToggle.title = `${favorites} ${favorites === 1 ? 'peça salva' : 'peças salvas'}`;
    }
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
    if (!document.body.classList.contains('cart-open')) cartTrigger = document.activeElement;
    document.body.classList.add('cart-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.querySelector('.cart-toggle').setAttribute('aria-expanded', 'true');
    document.querySelector('.close-drawer').focus();
  }
  function closeCart() {
    document.body.classList.remove('cart-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.querySelector('.cart-toggle').setAttribute('aria-expanded', 'false');
    if (cartTrigger && cartTrigger.isConnected && typeof cartTrigger.focus === 'function') {
      cartTrigger.focus({ preventScroll: true });
    }
    cartTrigger = null;
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

  function ensureProductModal() {
    if (productElements) return productElements;
    if (document.querySelector('.product-modal')) {
      productElements = {
        scrim: document.querySelector('.product-scrim'),
        modal: document.querySelector('.product-modal'),
        body: document.querySelector('.product-modal-body')
      };
      return productElements;
    }
    const scrim = document.createElement('div');
    scrim.className = 'product-scrim';
    const modal = document.createElement('section');
    modal.className = 'product-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'product-detail-title');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <button class="product-close" type="button" aria-label="Fechar detalhes">×</button>
      <div class="product-modal-body"></div>
    `;
    document.body.append(scrim, modal);
    productElements = { scrim, modal, body: modal.querySelector('.product-modal-body') };
    scrim.addEventListener('click', closeProductModal);
    modal.querySelector('.product-close').addEventListener('click', closeProductModal);
    productElements.body.addEventListener('click', event => {
      const sizeButton = event.target.closest('[data-detail-size]');
      if (sizeButton) {
        modalSize = sizeButton.dataset.detailSize;
        productElements.body.querySelectorAll('[data-detail-size]').forEach(button => {
          const active = button.dataset.detailSize === modalSize;
          button.classList.toggle('selected', active);
          button.setAttribute('aria-pressed', String(active));
        });
        const error = productElements.body.querySelector('.product-detail-error');
        if (error) error.hidden = true;
        return;
      }
      if (event.target.closest('[data-detail-add]')) {
        const product = RUA98.product(modalProductId);
        if (!product) return;
        if (!modalSize) {
          const error = productElements.body.querySelector('.product-detail-error');
          error.textContent = 'ESCOLHA UM TAMANHO PARA CONTINUAR.';
          error.hidden = false;
          return;
        }
        try {
          RUA98.addToCart(product.id, modalSize);
          closeProductModal();
          renderCart();
          AuthUI.toast(`${product.name} · TAM. ${modalSize} NA SACOLA ✳`);
          openCart();
        } catch (error) {
          const message = productElements.body.querySelector('.product-detail-error');
          message.textContent = error.message.toUpperCase();
          message.hidden = false;
        }
        return;
      }
      if (event.target.closest('[data-detail-favorite]')) {
        try {
          const result = RUA98.toggleFavorite(modalProductId);
          AuthUI.toast(result.active ? 'PEÇA SALVA NOS SEUS FAVORITOS ✳' : 'PEÇA REMOVIDA DOS FAVORITOS');
          renderProducts();
          AuthUI.refreshHeader();
          const button = productElements.body.querySelector('[data-detail-favorite]');
          if (button) {
            button.classList.toggle('active', result.active);
            button.innerHTML = result.active ? '♥ FAVORITADO' : '♡ FAVORITAR';
            button.setAttribute('aria-pressed', String(result.active));
          }
        } catch (error) {
          AuthUI.toast(error.message.toUpperCase());
        }
        return;
      }
      if (event.target.closest('[data-detail-share]')) {
        const product = RUA98.product(modalProductId);
        if (!product) return;
        const url = `${location.origin}${location.pathname}#produto=${encodeURIComponent(product.id)}`;
        if (navigator.share) {
          navigator.share({ title: `${product.name} — RUA 98`, text: product.subtitle || '', url }).catch(() => {});
          return;
        }
        copyText(url)
          .then(() => AuthUI.toast('LINK DA PEÇA COPIADO ✳'))
          .catch(() => AuthUI.toast(`COPIE: ${url}`));
        return;
      }
      const related = event.target.closest('[data-related]');
      if (related) openProductModal(related.dataset.related);
    });
    return productElements;
  }

  function productModalHtml(product) {
    const collection = RUA98.collection(product.collectionId);
    const settings = RUA98.settings();
    const favorite = RUA98.isFavorite(product.id);
    const soldOut = product.stock <= 0;
    const lowStock = !soldOut && product.stock <= 5;
    const tagClass = soldOut ? 'tag-limited' : product.isNew ? 'tag-new' : /LIMITADA/.test(product.tag || '') ? 'tag-limited' : '';
    const relatedCandidates = activeProducts().filter(item => item.id !== product.id);
    const related = relatedCandidates
      .filter(item => item.collectionId === product.collectionId || item.category === product.category)
      .concat(relatedCandidates.filter(item => item.collectionId !== product.collectionId && item.category !== product.category))
      .slice(0, 2);
    const sizes = product.sizes.map(size => `
      <button type="button" data-detail-size="${esc(size)}" class="${size === modalSize ? 'selected' : ''}" aria-pressed="${size === modalSize}" ${soldOut ? 'disabled' : ''}>${esc(size)}</button>`).join('');
    return `
      <div class="product-detail-grid">
        <div class="product-detail-media">
          <img src="${esc(product.image)}" alt="${esc(product.name)}">
          ${product.tag ? `<span class="product-tag ${tagClass}">${esc(soldOut ? 'ESGOTADO' : product.tag)}</span>` : soldOut ? '<span class="product-tag tag-limited">ESGOTADO</span>' : ''}
          <span class="product-detail-media-label">RUA 98 · ${esc(collection ? collection.name.toUpperCase() : 'DROP 01')}</span>
        </div>
        <div class="product-detail-copy">
          <span class="eyebrow"><span class="eyebrow-line"></span> ${esc(collection ? collection.name.toUpperCase() : 'RUA 98')} · DROP 01</span>
          <h2 id="product-detail-title">${esc(product.name)}</h2>
          <p class="product-detail-subtitle">${esc(product.subtitle || product.meta)}</p>
          <div class="product-detail-price">${price(product.price)}${product.compareAt ? `<s>${price(product.compareAt)}</s>` : ''}</div>
          <p class="product-detail-description">${esc(product.description || 'Algodão de verdade, modelagem ampla e acabamento pensado pra durar.')}</p>
          <div class="product-detail-meta">
            <span>${esc(product.meta || '100% ALGODÃO')}</span>
            <span>${esc(collection ? collection.name : 'RUA 98')}</span>
          </div>
          <div class="product-detail-stock${lowStock ? ' is-low' : ''}${soldOut ? ' is-out' : ''}">
            ${soldOut ? 'ESGOTADO · VOLTA EM BREVE' : lowStock ? `ÚLTIMAS ${product.stock} UNIDADES` : `${product.stock} UNIDADES EM ESTOQUE`}
          </div>
          <span class="product-detail-label">ESCOLHA SEU TAMANHO</span>
          <div class="product-size-grid">${sizes}</div>
          <p class="product-detail-error" role="alert" hidden></p>
          <div class="product-detail-actions">
            <button class="button button-dark product-detail-add" type="button" data-detail-add ${soldOut ? 'disabled' : ''}>${soldOut ? 'ESGOTADO' : 'ADICIONAR À SACOLA'} <span>${soldOut ? '×' : '↗'}</span></button>
            <button class="product-detail-favorite${favorite ? ' active' : ''}" type="button" data-detail-favorite aria-pressed="${favorite}">${favorite ? '♥ FAVORITADO' : '♡ FAVORITAR'}</button>
          </div>
          <div class="product-detail-links">
            <button class="size-guide-link" type="button" data-info="sizes">GUIA DE TAMANHOS <span>↗</span></button>
            <button class="size-guide-link" type="button" data-detail-share>COMPARTILHAR <span>↗</span></button>
          </div>
          <div class="product-detail-trust">
            <span>✳ FRETE GRÁTIS ACIMA DE ${price(settings.freeShipping)}</span>
            <span>✳ TROCA EM ATÉ 30 DIAS</span>
          </div>
        </div>
      </div>
      ${related.length ? `
        <div class="product-related">
          <div class="product-related-head"><span class="eyebrow">COMBINA COM</span><span>MAIS DA RUA ↗</span></div>
          <div class="product-related-grid">
            ${related.map(item => `
              <button class="related-card" type="button" data-related="${esc(item.id)}" aria-label="Ver ${esc(item.name)}">
                <img src="${esc(item.image)}" alt="${esc(item.name)}" loading="lazy">
                <span>${esc(item.name)}</span>
                <b>${price(item.price)}</b>
              </button>`).join('')}
          </div>
        </div>` : ''}
    `;
  }

  function openProductModal(id, options = {}) {
    const product = RUA98.product(id);
    if (!product) return;
    document.querySelectorAll('.size-picker').forEach(picker => picker.remove());
    ensureProductModal();
    if (!productElements.modal.classList.contains('open')) modalTrigger = document.activeElement;
    modalProductId = product.id;
    modalSize = product.sizes.includes('M') ? 'M' : product.sizes[0] || '';
    if (product.stock <= 0) modalSize = '';
    productElements.body.innerHTML = productModalHtml(product);
    productElements.scrim.classList.add('open');
    productElements.modal.classList.add('open');
    productElements.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('product-open');
    rememberRecent(product.id);
    if (options.updateHash !== false) {
      try { history.replaceState(null, '', `#produto=${encodeURIComponent(product.id)}`); } catch { /* ignora */ }
    }
    requestAnimationFrame(() => productElements.modal.querySelector('.product-close')?.focus());
  }

  function closeProductModal() {
    if (!productElements) return;
    const wasOpen = productElements.modal.classList.contains('open');
    productElements.scrim.classList.remove('open');
    productElements.modal.classList.remove('open');
    productElements.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('product-open');
    modalProductId = null;
    modalSize = '';
    if (wasOpen && location.hash.startsWith('#produto=')) {
      try { history.replaceState(null, '', `${location.pathname}${location.search}#colecao`); } catch { /* ignora */ }
    }
    if (modalTrigger && modalTrigger.isConnected && typeof modalTrigger.focus === 'function') {
      modalTrigger.focus({ preventScroll: true });
    }
    modalTrigger = null;
  }

  function openProductFromHash() {
    const match = location.hash.match(/^#produto=(.+)$/);
    if (!match) return;
    const id = decodeURIComponent(match[1]);
    if (RUA98.product(id)) openProductModal(id, { updateHash: false });
  }


  filterList.addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    state.category = button.dataset.filter;
    renderProducts();
  });

  if (sortFilter) {
    sortFilter.addEventListener('change', event => {
      state.sort = event.target.value;
      renderProducts();
    });
  }

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
    const card = event.target.closest('.product-card');
    const detailsButton = event.target.closest('[data-details]');
    const image = event.target.closest('.product-image');
    if (card && (detailsButton || (image && !event.target.closest('button')))) {
      openProductModal(card.dataset.id);
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

  searchToggle.addEventListener('click', () => {
    const open = searchPanel.classList.toggle('open');
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) searchInput.focus();
  });
  if (searchInput) {
    searchInput.setAttribute('aria-controls', 'product-grid');
    searchInput.setAttribute('aria-describedby', 'search-hint');
  }
  document.querySelectorAll('[data-search-term]').forEach(button => {
    button.addEventListener('click', () => {
      state.search = button.dataset.searchTerm;
      state.category = 'todos';
      state.collection = 'todos';
      state.favoritesOnly = false;
      searchInput.value = state.search;
      collectionFilter.value = 'todos';
      searchPanel.classList.remove('open');
      searchToggle.setAttribute('aria-expanded', 'false');
      renderProducts();
      document.querySelector('#colecao').scrollIntoView({ behavior: 'smooth' });
    });
  });
  if (recentGrid) {
    recentGrid.addEventListener('click', event => {
      const trigger = event.target.closest('[data-details]');
      if (trigger) openProductModal(trigger.dataset.details);
    });
    document.querySelector('.recently-clear')?.addEventListener('click', () => {
      localStorage.removeItem(RECENT_KEY);
      renderRecent();
      AuthUI.toast('HISTÓRICO LIMPO.');
    });
  }
  if (favoritesToggle) {
    favoritesToggle.addEventListener('click', () => {
      state.favoritesOnly = !state.favoritesOnly;
      renderProducts();
      document.querySelector('#colecao').scrollIntoView({ behavior: 'smooth' });
      AuthUI.toast(state.favoritesOnly ? 'MOSTRANDO SÓ AS PEÇAS QUE VOCÊ SALVOU ♥' : 'MOSTRANDO TODAS AS PEÇAS.');
    });
  }
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
    state.favoritesOnly = false;
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

  function trapFocus(container, event) {
    const focusables = [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(element => element.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      if (document.querySelector('.info-modal.open, .checkout-modal.open, .auth-modal.open')) return;
      if (productElements?.modal.classList.contains('open')) return trapFocus(productElements.modal, event);
      if (document.body.classList.contains('cart-open')) return trapFocus(drawer, event);
    }
    if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const tag = document.activeElement?.tagName || '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || document.activeElement?.isContentEditable) return;
      if (document.querySelector('.info-modal.open, .checkout-modal.open, .auth-modal.open')) return;
      event.preventDefault();
      searchPanel.classList.add('open');
      searchToggle.setAttribute('aria-expanded', 'true');
      searchInput.focus();
      return;
    }
    if (event.key === 'Escape') {
      if (document.querySelector('.info-modal.open, .checkout-modal.open, .auth-modal.open')) return;
      closeCart();
      closeProductModal();
      searchPanel.classList.remove('open');
      searchToggle.setAttribute('aria-expanded', 'false');
      document.querySelector('.main-nav').classList.remove('open');
      document.querySelector('.menu-toggle').setAttribute('aria-expanded', 'false');
      document.querySelectorAll('.size-picker').forEach(picker => picker.remove());
    }
  });

  document.querySelector('.newsletter-form').addEventListener('submit', event => {
    event.preventDefault();
    const email = document.querySelector('#email');
    if (!email.checkValidity()) return email.reportValidity();
    try {
      const result = RUA98.subscribeNewsletter(email.value);
      AuthUI.toast(result.already ? 'VOCÊ JÁ ESTÁ NA LISTA. CUPOM RUA10 LIBERADO ✳' : 'BEM-VINDO À LISTA! USE O CUPOM RUA10 ✳');
      event.currentTarget.reset();
    } catch (error) {
      AuthUI.toast(error.message.toUpperCase());
    }
  });

  window.addEventListener('rua98:auth', () => {
    renderProducts();
    renderCart();
    renderRecent();
  });
  window.addEventListener('rua98:data', () => {
    renderFilters();
    renderProducts();
    renderCart();
    renderRecent();
  });

  applySettings();
  renderProducts();
  renderCart();
  renderRecent();
  AuthUI.refreshHeader();
  openProductFromHash();
  window.addEventListener('hashchange', openProductFromHash);

  const params = new URLSearchParams(location.search);
  if (params.get('cart') === '1') {
    const cart = RUA98.cart();
    const clean = new URL(location.href);
    clean.searchParams.delete('cart');
    try { history.replaceState(null, '', `${clean.pathname}${clean.search}${clean.hash}`); } catch { /* ignora */ }
    if (cart.count > 0) {
      openCart();
      AuthUI.toast('SACOLA ATUALIZADA ✳');
    }
  }
})();
