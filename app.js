const products = [
  { name: 'CAMISETA RUA 98', detail: 'HEAVYWEIGHT · PRETA', price: 159, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80' },
  { name: 'CLUBE DA RUA', detail: 'ESTAMPA VINTAGE · OFF-WHITE', price: 179, image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80' },
  { name: 'SEM FREIO', detail: 'OVERSIZED · VERDE MUSGO', price: 189, image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80' },
  { name: 'SPEED CLUB', detail: 'GRÁFICO OLD SCHOOL · BRANCA', price: 169, image: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=800&q=80' }
];
const cart = [];
const drawer = document.querySelector('.cart-drawer');
const toast = document.querySelector('.toast');
let toastTimer;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}
function money(value) {
  return `R$ ${value.toLocaleString('pt-BR')}`;
}
function addToCart(productIndex, size) {
  const existing = cart.find(item => item.productIndex === productIndex && item.size === size);
  if (existing) existing.quantity += 1;
  else cart.push({ productIndex, size, quantity: 1 });
  renderCart();
  showToast(`${products[productIndex].name} · TAM. ${size} ADICIONADA À SACOLA`);
}
function renderCart() {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + products[item.productIndex].price * item.quantity, 0);
  document.querySelector('.cart-count').textContent = totalItems;
  document.querySelector('.drawer-item-count').textContent = `(${totalItems})`;
  document.querySelector('.subtotal b').textContent = money(total);
  document.querySelector('.shipping-progress span').textContent = total >= 299 ? 'VOCÊ GANHOU FRETE GRÁTIS!' : `FALTAM ${money(299 - total)} PARA O FRETE GRÁTIS`;
  document.querySelector('.progress-track i').style.width = `${Math.min(100, total / 299 * 100)}%`;
  drawer.classList.toggle('has-items', totalItems > 0);
  document.querySelector('.cart-items').innerHTML = cart.map((item, index) => {
    const product = products[item.productIndex];
    return `<article class="cart-line"><img src="${product.image}" alt="${product.name}"><div><h3>${product.name}</h3><p>${product.detail}<br>TAMANHO: ${item.size}</p><div class="cart-line-controls"><button class="qty-btn" data-action="minus" data-index="${index}" aria-label="Diminuir quantidade">−</button><span class="qty-number">${item.quantity}</span><button class="qty-btn" data-action="plus" data-index="${index}" aria-label="Aumentar quantidade">+</button><button class="remove-item" data-action="remove" data-index="${index}">REMOVER</button></div></div><span class="cart-line-price">${money(product.price * item.quantity)}</span></article>`;
  }).join('');
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

document.querySelector('.cart-toggle').addEventListener('click', openCart);
document.querySelector('.close-drawer').addEventListener('click', closeCart);
document.querySelector('.drawer-scrim').addEventListener('click', closeCart);
document.querySelector('.continue-shopping').addEventListener('click', () => {
  closeCart();
  document.querySelector('#colecao').scrollIntoView({ behavior: 'smooth' });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeCart();
    document.querySelector('.search-panel').classList.remove('open');
    document.querySelector('.main-nav').classList.remove('open');
  }
});

document.querySelectorAll('.quick-add').forEach(button => {
  button.addEventListener('click', () => {
    const card = button.closest('.product-image');
    if (card.querySelector('.size-picker')) return;
    const picker = document.createElement('div');
    picker.className = 'size-picker';
    picker.setAttribute('aria-label', 'Escolha o tamanho');
    picker.innerHTML = `<span>ESCOLHA SEU TAMANHO</span><div>${['P', 'M', 'G', 'GG'].map(size => `<button type="button" data-size="${size}">${size}</button>`).join('')}</div>`;
    card.append(picker);
    picker.querySelectorAll('button').forEach(sizeButton => sizeButton.addEventListener('click', event => {
      event.stopPropagation();
      addToCart(Number(button.dataset.product), sizeButton.dataset.size);
      picker.remove();
    }));
  });
});

document.querySelector('.cart-items').addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const index = Number(button.dataset.index);
  if (button.dataset.action === 'plus') cart[index].quantity += 1;
  if (button.dataset.action === 'minus') {
    cart[index].quantity -= 1;
    if (cart[index].quantity <= 0) cart.splice(index, 1);
  }
  if (button.dataset.action === 'remove') cart.splice(index, 1);
  renderCart();
});
document.querySelector('.checkout-btn').addEventListener('click', () => showToast('CHECKOUT SEGURO — EM BREVE NA RUA!'));

document.querySelectorAll('.favorite-btn').forEach(button => button.addEventListener('click', () => {
  const active = button.classList.toggle('active');
  button.setAttribute('aria-pressed', String(active));
  showToast(active ? 'PEÇA SALVA NOS SEUS FAVORITOS' : 'PEÇA REMOVIDA DOS FAVORITOS');
}));

const filterButtons = document.querySelectorAll('.filter-chip');
const productCards = [...document.querySelectorAll('.product-card')];
let activeFilter = 'todos';
let searchTerm = '';
function updateProducts() {
  let visible = 0;
  productCards.forEach(card => {
    const matchesFilter = activeFilter === 'todos' || card.dataset.category === activeFilter;
    const matchesSearch = card.dataset.name.includes(searchTerm.toLowerCase());
    card.hidden = !(matchesFilter && matchesSearch);
    if (!card.hidden) visible++;
  });
  document.querySelector('.results-count').textContent = `MOSTRANDO ${String(visible).padStart(2, '0')} ${visible === 1 ? 'PEÇA' : 'PEÇAS'}`;
  document.querySelector('.empty-products').hidden = visible > 0;
  document.querySelector('.product-grid').hidden = visible === 0;
}
filterButtons.forEach(button => button.addEventListener('click', () => {
  activeFilter = button.dataset.filter;
  filterButtons.forEach(item => item.classList.toggle('active', item === button));
  updateProducts();
}));
document.querySelector('.search-toggle').addEventListener('click', () => {
  const panel = document.querySelector('.search-panel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) document.querySelector('#search-input').focus();
  else {
    searchTerm = '';
    document.querySelector('#search-input').value = '';
    updateProducts();
  }
});
document.querySelector('#search-input').addEventListener('input', event => {
  searchTerm = event.target.value.trim();
  updateProducts();
  document.querySelector('#colecao').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('.search-submit').addEventListener('click', () => {
  document.querySelector('.search-panel').classList.remove('open');
  document.querySelector('#colecao').scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('.clear-search').addEventListener('click', () => {
  searchTerm = '';
  document.querySelector('#search-input').value = '';
  activeFilter = 'todos';
  filterButtons.forEach(button => button.classList.toggle('active', button.dataset.filter === 'todos'));
  updateProducts();
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
document.querySelector('.newsletter-form').addEventListener('submit', event => {
  event.preventDefault();
  const email = document.querySelector('#email');
  if (!email.checkValidity()) return email.reportValidity();
  showToast('VOCÊ TÁ NA LISTA! CONFERE SEU E-MAIL ✳');
  event.currentTarget.reset();
});
