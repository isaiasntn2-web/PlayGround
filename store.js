/* RUA 98 — camada de dados local (demonstração)
   Em produção, autenticação e pedidos precisam de backend, HTTPS e banco de dados. */
(() => {
  const VERSION = 3;
  const DB_KEY = 'rua98_db_v3';
  const SESSION_KEY = 'rua98_session_v3';
  const GUEST_CART_KEY = 'rua98_guest_cart_v3';
  const GUEST_FAVS_KEY = 'rua98_guest_favs_v3';
  const SESSION_DAYS = 30;

  let db = null;
  let readyPromise = null;

  const copy = value => JSON.parse(JSON.stringify(value));
  const nowISO = () => new Date().toISOString();
  const uid = prefix => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  function bytesToB64(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }
  function b64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }
  function randomToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function fallbackHash(password, salt) {
    let hash = 2166136261;
    const input = `${salt}:${password}`;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash).toString(16).padStart(8, '0').repeat(8);
  }
  async function hashPassword(password, saltB64) {
    const salt = saltB64 ? b64ToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    if (!crypto.subtle) return { salt: bytesToB64(salt), hash: fallbackHash(password, bytesToB64(salt)) };
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
      key,
      256
    );
    return { salt: bytesToB64(salt), hash: bytesToB64(new Uint8Array(bits)) };
  }
  function safeEqual(left, right) {
    if (left.length !== right.length) return false;
    let result = 0;
    for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return result === 0;
  }

  function seedSettings() {
    return {
      announcement: 'FRETE GRÁTIS A PARTIR DE R$ 299',
      announcementTwo: '10% OFF NA PRIMEIRA COMPRA · USE RUA10',
      freeShipping: 299,
      shippingFee: 19.9,
      heroEyebrow: 'DROP 01 — OUTONO / INVERNO 26',
      instagram: 'https://instagram.com',
      whatsapp: '',
      checkoutNote: 'PAGAMENTO SEGURO · AMBIENTE DEMONSTRATIVO'
    };
  }

  function seedProducts() {
    const createdAt = '2026-10-01T12:00:00.000Z';
    return [
      {
        id: 'p1', name: 'CAMISETA RUA 98', subtitle: 'HEAVYWEIGHT · PRETA', category: 'oversized',
        collectionId: 'c1', price: 159, compareAt: 189,
        image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
        description: 'Algodão pesado 240g, modelagem oversized e gola reforçada. A peça que abre o uniforme.',
        meta: '100% ALGODÃO 240G', tag: 'BEST-SELLER', stock: 24, sizes: ['P', 'M', 'G', 'GG'],
        isNew: false, featured: true, active: true, createdAt
      },
      {
        id: 'p2', name: 'CLUBE DA RUA', subtitle: 'ESTAMPA VINTAGE · OFF-WHITE', category: 'old-school',
        collectionId: 'c2', price: 179, compareAt: 0,
        image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80',
        description: 'Estampa vintage aplicada com silk, algodão macio 220g e caimento reto.',
        meta: 'ALGODÃO MACIO 220G', tag: 'NOVA PEÇA', stock: 18, sizes: ['P', 'M', 'G', 'GG'],
        isNew: true, featured: true, active: true, createdAt
      },
      {
        id: 'p3', name: 'SEM FREIO', subtitle: 'OVERSIZED · VERDE MUSGO', category: 'oversized',
        collectionId: 'c1', price: 189, compareAt: 0,
        image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80',
        description: 'Verde musgo, ombro caído e acabamento premium. Edição limitada do primeiro drop.',
        meta: 'ALGODÃO PREMIUM 240G', tag: 'EDIÇÃO LIMITADA', stock: 8, sizes: ['P', 'M', 'G', 'GG'],
        isNew: false, featured: true, active: true, createdAt
      },
      {
        id: 'p4', name: 'SPEED CLUB', subtitle: 'GRÁFICO OLD SCHOOL · BRANCA', category: 'old-school',
        collectionId: 'c2', price: 169, compareAt: 0,
        image: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=800&q=80',
        description: 'Gráfico de arquivo, algodão enzimado e aquele conforto de camiseta já vivida.',
        meta: 'ALGODÃO ENZIMADO 220G', tag: 'DROP 01', stock: 31, sizes: ['P', 'M', 'G', 'GG'],
        isNew: false, featured: false, active: true, createdAt
      }
    ];
  }

  function seedOrders() {
    return [
      {
        id: 'o1042', number: 1042, userId: 'u_demo', userName: 'Cliente Demo', userEmail: 'cliente@rua98.com',
        status: 'enviado', payment: 'Pix', createdAt: '2026-11-02T14:20:00.000Z',
        items: [
          { productId: 'p1', name: 'CAMISETA RUA 98', subtitle: 'HEAVYWEIGHT · PRETA', size: 'M', quantity: 1, price: 159, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80' },
          { productId: 'p2', name: 'CLUBE DA RUA', subtitle: 'ESTAMPA VINTAGE · OFF-WHITE', size: 'G', quantity: 1, price: 179, image: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80' }
        ],
        subtotal: 338, shipping: 0, total: 338,
        customer: { name: 'Cliente Demo', phone: '(11) 99999-0000', zip: '01310-100', address: 'Av. Paulista', number: '98', city: 'São Paulo', state: 'SP' }
      },
      {
        id: 'o1041', number: 1041, userId: 'u_demo', userName: 'Cliente Demo', userEmail: 'cliente@rua98.com',
        status: 'entregue', payment: 'Cartão', createdAt: '2026-10-27T10:05:00.000Z',
        items: [
          { productId: 'p3', name: 'SEM FREIO', subtitle: 'OVERSIZED · VERDE MUSGO', size: 'G', quantity: 1, price: 189, image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80' }
        ],
        subtotal: 189, shipping: 19.9, total: 208.9,
        customer: { name: 'Cliente Demo', phone: '(11) 99999-0000', zip: '01310-100', address: 'Av. Paulista', number: '98', city: 'São Paulo', state: 'SP' }
      },
      {
        id: 'o1040', number: 1040, userId: 'u_demo', userName: 'Cliente Demo', userEmail: 'cliente@rua98.com',
        status: 'pago', payment: 'Pix', createdAt: '2026-11-09T18:40:00.000Z',
        items: [
          { productId: 'p4', name: 'SPEED CLUB', subtitle: 'GRÁFICO OLD SCHOOL · BRANCA', size: 'M', quantity: 2, price: 169, image: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=800&q=80' }
        ],
        subtotal: 338, shipping: 0, total: 338,
        customer: { name: 'Cliente Demo', phone: '(11) 99999-0000', zip: '01310-100', address: 'Av. Paulista', number: '98', city: 'São Paulo', state: 'SP' }
      },
      {
        id: 'o1039', number: 1039, userId: 'u_marina', userName: 'Marina Souza', userEmail: 'marina@email.com',
        status: 'pendente', payment: 'Boleto', createdAt: '2026-11-10T09:15:00.000Z',
        items: [
          { productId: 'p1', name: 'CAMISETA RUA 98', subtitle: 'HEAVYWEIGHT · PRETA', size: 'P', quantity: 1, price: 159, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80' }
        ],
        subtotal: 159, shipping: 19.9, total: 178.9,
        customer: { name: 'Marina Souza', phone: '(21) 98888-1111', zip: '22071-900', address: 'Rua Barata Ribeiro', number: '120', city: 'Rio de Janeiro', state: 'RJ' }
      }
    ];
  }

  async function buildSeed() {
    const usersSeed = [
      { id: 'u_admin', name: 'Ana Rua', email: 'admin@rua98.com', password: 'rua98admin', role: 'admin', phone: '', address: '', city: 'São Paulo', state: 'SP', zip: '' },
      { id: 'u_demo', name: 'Cliente Demo', email: 'cliente@rua98.com', password: 'rua123', role: 'customer', phone: '(11) 99999-0000', address: 'Av. Paulista', city: 'São Paulo', state: 'SP', zip: '01310-100' },
      { id: 'u_marina', name: 'Marina Souza', email: 'marina@email.com', password: 'rua123', role: 'customer', phone: '(21) 98888-1111', address: 'Rua Barata Ribeiro', city: 'Rio de Janeiro', state: 'RJ', zip: '22071-900' },
      { id: 'u_lucas', name: 'Lucas Ferreira', email: 'lucas@email.com', password: 'rua123', role: 'customer', phone: '', address: '', city: 'Belo Horizonte', state: 'MG', zip: '' }
    ];
    const users = [];
    for (const entry of usersSeed) {
      const hashed = await hashPassword(entry.password);
      users.push({
        id: entry.id, name: entry.name, email: entry.email, role: entry.role,
        passwordHash: hashed.hash, passwordSalt: hashed.salt,
        phone: entry.phone, address: entry.address, city: entry.city, state: entry.state, zip: entry.zip,
        cart: [], favorites: [], blocked: false, createdAt: '2026-09-12T12:00:00.000Z'
      });
    }
    return {
      version: VERSION,
      products: seedProducts(),
      collections: [
        { id: 'c1', name: 'Oversized', description: 'Caimento amplo, algodão pesado e liberdade total.', active: true, createdAt: '2026-09-01T12:00:00.000Z' },
        { id: 'c2', name: 'Old School', description: 'Gráficos de arquivo que atravessam décadas.', active: true, createdAt: '2026-09-01T12:00:00.000Z' }
      ],
      drops: [
        { id: 'd1', name: 'DROP 01 — RAÍZES', date: '2026-11-20', status: 'ativo', description: 'O primeiro drop da RUA 98: algodão pesado, gráficos de arquivo e modelagem oversized.', productIds: ['p1', 'p2', 'p3', 'p4'], createdAt: '2026-10-01T12:00:00.000Z' },
        { id: 'd2', name: 'DROP 02 — CONCRETO', date: '2026-12-15', status: 'agendado', description: 'Uma nova camada de concreto, cinza e atitude para fechar o ano.', productIds: ['p1', 'p3'], createdAt: '2026-10-20T12:00:00.000Z' }
      ],
      users,
      orders: seedOrders(),
      settings: seedSettings(),
      createdAt: '2026-09-01T12:00:00.000Z'
    };
  }

  function persist() {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    window.dispatchEvent(new CustomEvent('rua98:data'));
  }

  function readStoredDB() {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed.version === VERSION ? parsed : null;
    } catch {
      return null;
    }
  }

  function init(force = false) {
    if (readyPromise && !force) return readyPromise;
    readyPromise = (async () => {
      const stored = force ? null : readStoredDB();
      if (stored) {
        db = stored;
        return db;
      }
      db = await buildSeed();
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return db;
    })();
    return readyPromise;
  }

  function session() {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!saved || !saved.userId || !saved.expiresAt || saved.expiresAt < Date.now()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return saved;
    } catch {
      return null;
    }
  }
  function startSession(user) {
    const saved = { userId: user.id, token: randomToken(), expiresAt: Date.now() + SESSION_DAYS * 86400000 };
    localStorage.setItem(SESSION_KEY, JSON.stringify(saved));
    window.dispatchEvent(new CustomEvent('rua98:auth'));
    return saved;
  }
  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id, name: user.name, email: user.email, role: user.role,
      phone: user.phone || '', address: user.address || '', city: user.city || '', state: user.state || '', zip: user.zip || '',
      blocked: Boolean(user.blocked), createdAt: user.createdAt,
      favorites: [...(user.favorites || [])]
    };
  }
  function currentUser() {
    const saved = session();
    if (!saved || !db) return null;
    const user = db.users.find(entry => entry.id === saved.userId);
    if (!user || user.blocked) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return publicUser(user);
  }
  function findUserByEmail(email) {
    const normalized = String(email || '').trim().toLowerCase();
    return db.users.find(user => user.email.toLowerCase() === normalized);
  }

  function guestCart() {
    try { return JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]'); } catch { return []; }
  }
  function saveGuestCart(cart) {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
  }
  function activeCart() {
    const user = currentUser();
    if (!user) return guestCart();
    const record = db.users.find(entry => entry.id === user.id);
    return record ? record.cart : [];
  }
  function writeCart(cart) {
    const user = currentUser();
    if (!user) {
      saveGuestCart(cart);
      return;
    }
    const record = db.users.find(entry => entry.id === user.id);
    if (record) record.cart = cart;
    persist();
  }
  function guestFavorites() {
    try { return JSON.parse(localStorage.getItem(GUEST_FAVS_KEY) || '[]'); } catch { return []; }
  }
  function saveGuestFavorites(ids) {
    localStorage.setItem(GUEST_FAVS_KEY, JSON.stringify(ids));
  }
  function activeFavorites() {
    const user = currentUser();
    if (!user) return guestFavorites();
    const record = db.users.find(entry => entry.id === user.id);
    return record ? (record.favorites || []) : [];
  }
  function mergeGuestData(user) {
    const cart = guestCart();
    if (cart.length) {
      user.cart = user.cart || [];
      cart.forEach(item => {
        const existing = user.cart.find(line => line.productId === item.productId && line.size === item.size);
        if (existing) existing.quantity += item.quantity;
        else user.cart.push(item);
      });
      saveGuestCart([]);
    }
    const favorites = guestFavorites();
    if (favorites.length) {
      user.favorites = Array.from(new Set([...(user.favorites || []), ...favorites]));
      saveGuestFavorites([]);
    }
  }

  function cartDetailed() {
    const lines = activeCart().map(line => {
      const product = db.products.find(entry => entry.id === line.productId);
      if (!product) return null;
      return {
        productId: product.id, size: line.size, quantity: line.quantity,
        product: copy(product), total: product.price * line.quantity
      };
    }).filter(Boolean);
    const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
    const count = lines.reduce((sum, line) => sum + line.quantity, 0);
    return { lines, subtotal, count, shipping: subtotal >= db.settings.freeShipping ? 0 : db.settings.shippingFee };
  }

  function favoriteProducts() {
    const ids = new Set(activeFavorites());
    return db.products.filter(product => ids.has(product.id)).map(copy);
  }

  function orderNumber() {
    const highest = db.orders.reduce((max, order) => Math.max(max, order.number || 0), 1042);
    return highest + 1;
  }

  const api = {
    async ready() {
      await init();
      return true;
    },
    reload() {
      const stored = readStoredDB();
      if (stored) db = stored;
      return Boolean(stored);
    },
    resetDemo() {
      localStorage.removeItem(DB_KEY);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(GUEST_CART_KEY);
      localStorage.removeItem(GUEST_FAVS_KEY);
      return init(true);
    },
    db() { return copy(db); },
    settings() { return copy(db.settings); },
    saveSettings(patch) {
      db.settings = { ...db.settings, ...patch };
      persist();
      return copy(db.settings);
    },
    products(options = {}) {
      let list = [...db.products];
      if (!options.includeInactive) list = list.filter(product => product.active);
      if (options.category) list = list.filter(product => product.category === options.category);
      if (options.collectionId) list = list.filter(product => product.collectionId === options.collectionId);
      return copy(list);
    },
    product(id) {
      const product = db.products.find(entry => entry.id === id);
      return product ? copy(product) : null;
    },
    saveProduct(input) {
      const name = String(input.name || '').trim();
      const price = Number(input.price);
      if (!name) throw new Error('Informe o nome da peça.');
      if (!Number.isFinite(price) || price <= 0) throw new Error('Informe um preço válido.');
      const sizes = Array.isArray(input.sizes)
        ? input.sizes.map(size => String(size).trim().toUpperCase()).filter(Boolean)
        : String(input.sizes || '').split(',').map(size => size.trim().toUpperCase()).filter(Boolean);
      if (!sizes.length) throw new Error('Informe ao menos um tamanho.');
      const base = {
        name,
        subtitle: String(input.subtitle || '').trim().toUpperCase(),
        category: input.category === 'old-school' ? 'old-school' : 'oversized',
        collectionId: input.collectionId || '',
        price,
        compareAt: Number(input.compareAt) || 0,
        image: String(input.image || '').trim(),
        description: String(input.description || '').trim(),
        meta: String(input.meta || '').trim().toUpperCase(),
        tag: String(input.tag || '').trim().toUpperCase(),
        stock: Math.max(0, Number.parseInt(input.stock, 10) || 0),
        sizes,
        isNew: Boolean(input.isNew),
        featured: Boolean(input.featured),
        active: input.active !== false
      };
      let product;
      if (input.id) {
        product = db.products.find(entry => entry.id === input.id);
        if (!product) throw new Error('Peça não encontrada.');
        Object.assign(product, base, { updatedAt: nowISO() });
      } else {
        product = { id: uid('p'), ...base, createdAt: nowISO() };
        db.products.unshift(product);
      }
      persist();
      return copy(product);
    },
    deleteProduct(id) {
      db.products = db.products.filter(product => product.id !== id);
      db.users.forEach(user => {
        user.cart = (user.cart || []).filter(line => line.productId !== id);
        user.favorites = (user.favorites || []).filter(favorite => favorite !== id);
      });
      const guest = guestCart().filter(line => line.productId !== id);
      saveGuestCart(guest);
      saveGuestFavorites(guestFavorites().filter(favorite => favorite !== id));
      persist();
    },
    collections(options = {}) {
      let list = [...db.collections];
      if (!options.includeInactive) list = list.filter(collection => collection.active);
      return copy(list);
    },
    collection(id) {
      const collection = db.collections.find(entry => entry.id === id);
      return collection ? copy(collection) : null;
    },
    saveCollection(input) {
      const name = String(input.name || '').trim();
      if (!name) throw new Error('Informe o nome da coleção.');
      let collection;
      if (input.id) {
        collection = db.collections.find(entry => entry.id === input.id);
        if (!collection) throw new Error('Coleção não encontrada.');
        Object.assign(collection, { name, description: String(input.description || '').trim(), active: input.active !== false, updatedAt: nowISO() });
      } else {
        collection = { id: uid('c'), name, description: String(input.description || '').trim(), active: input.active !== false, createdAt: nowISO() };
        db.collections.push(collection);
      }
      persist();
      return copy(collection);
    },
    deleteCollection(id) {
      db.collections = db.collections.filter(collection => collection.id !== id);
      db.products.forEach(product => { if (product.collectionId === id) product.collectionId = ''; });
      persist();
    },
    drops() { return copy(db.drops); },
    saveDrop(input) {
      const name = String(input.name || '').trim();
      if (!name) throw new Error('Informe o nome do lançamento.');
      let drop;
      const base = {
        name,
        date: input.date || '',
        status: ['ativo', 'agendado', 'encerrado'].includes(input.status) ? input.status : 'agendado',
        description: String(input.description || '').trim(),
        productIds: Array.isArray(input.productIds) ? input.productIds : []
      };
      if (input.id) {
        drop = db.drops.find(entry => entry.id === input.id);
        if (!drop) throw new Error('Lançamento não encontrado.');
        Object.assign(drop, base, { updatedAt: nowISO() });
      } else {
        drop = { id: uid('d'), ...base, createdAt: nowISO() };
        db.drops.unshift(drop);
      }
      persist();
      return copy(drop);
    },
    deleteDrop(id) {
      db.drops = db.drops.filter(drop => drop.id !== id);
      persist();
    },
    activeDrop() {
      const active = db.drops.filter(drop => drop.status === 'ativo').sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      return active ? copy(active) : null;
    },

    async register({ name, email, password }) {
      const cleanName = String(name || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (cleanName.length < 2) throw new Error('Informe seu nome.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Informe um e-mail válido.');
      if (String(password || '').length < 6) throw new Error('A senha precisa ter ao menos 6 caracteres.');
      if (findUserByEmail(cleanEmail)) throw new Error('Já existe uma conta com este e-mail.');
      const hashed = await hashPassword(password);
      const user = {
        id: uid('u'), name: cleanName, email: cleanEmail, role: 'customer',
        passwordHash: hashed.hash, passwordSalt: hashed.salt,
        phone: '', address: '', city: '', state: '', zip: '',
        cart: [], favorites: [], blocked: false, createdAt: nowISO()
      };
      db.users.push(user);
      mergeGuestData(user);
      persist();
      startSession(user);
      return publicUser(user);
    },
    async login(email, password) {
      const user = findUserByEmail(email);
      if (!user) throw new Error('E-mail ou senha incorretos.');
      if (user.blocked) throw new Error('Esta conta está bloqueada. Fale com o atendimento.');
      const hashed = await hashPassword(password, user.passwordSalt);
      if (!safeEqual(hashed.hash, user.passwordHash)) throw new Error('E-mail ou senha incorretos.');
      mergeGuestData(user);
      persist();
      startSession(user);
      return publicUser(user);
    },
    logout() {
      localStorage.removeItem(SESSION_KEY);
      window.dispatchEvent(new CustomEvent('rua98:auth'));
    },
    currentUser,
    isAdmin() {
      const user = currentUser();
      return Boolean(user && user.role === 'admin');
    },
    async changePassword(current, next) {
      const user = currentUser();
      if (!user) throw new Error('Entre para alterar a senha.');
      if (String(next || '').length < 6) throw new Error('A nova senha precisa ter ao menos 6 caracteres.');
      const record = db.users.find(entry => entry.id === user.id);
      const hashed = await hashPassword(current, record.passwordSalt);
      if (!safeEqual(hashed.hash, record.passwordHash)) throw new Error('Senha atual incorreta.');
      const updated = await hashPassword(next);
      record.passwordHash = updated.hash;
      record.passwordSalt = updated.salt;
      persist();
    },
    updateProfile(patch) {
      const user = currentUser();
      if (!user) throw new Error('Entre para atualizar seus dados.');
      const record = db.users.find(entry => entry.id === user.id);
      const name = String(patch.name || '').trim();
      if (name.length < 2) throw new Error('Informe seu nome.');
      Object.assign(record, {
        name,
        phone: String(patch.phone || '').trim(),
        address: String(patch.address || '').trim(),
        city: String(patch.city || '').trim(),
        state: String(patch.state || '').trim().toUpperCase().slice(0, 2),
        zip: String(patch.zip || '').trim()
      });
      persist();
      return publicUser(record);
    },

    cart() { return cartDetailed(); },
    addToCart(productId, size, quantity = 1) {
      const product = db.products.find(entry => entry.id === productId);
      if (!product || !product.active) throw new Error('Esta peça não está disponível.');
      const chosenSize = product.sizes.includes(size) ? size : product.sizes[0];
      const cart = activeCart();
      const existing = cart.find(line => line.productId === productId && line.size === chosenSize);
      const nextQuantity = (existing ? existing.quantity : 0) + quantity;
      if (nextQuantity > product.stock) throw new Error(`Temos apenas ${product.stock} unidade(s) desta peça.`);
      if (existing) existing.quantity = nextQuantity;
      else cart.push({ productId, size: chosenSize, quantity });
      writeCart(cart);
      return cartDetailed();
    },
    updateCartQuantity(productId, size, delta) {
      const cart = activeCart();
      const line = cart.find(item => item.productId === productId && item.size === size);
      if (!line) return cartDetailed();
      const product = db.products.find(entry => entry.id === productId);
      line.quantity += delta;
      if (line.quantity <= 0) cart.splice(cart.indexOf(line), 1);
      else if (product) line.quantity = Math.min(line.quantity, product.stock);
      writeCart(cart);
      return cartDetailed();
    },
    removeCartItem(productId, size) {
      const cart = activeCart().filter(item => !(item.productId === productId && item.size === size));
      writeCart(cart);
      return cartDetailed();
    },
    clearCart() { writeCart([]); },

    favorites() { return [...activeFavorites()]; },
    favoriteProducts,
    isFavorite(productId) { return activeFavorites().includes(productId); },
    toggleFavorite(productId) {
      const product = db.products.find(entry => entry.id === productId);
      if (!product) throw new Error('Peça não encontrada.');
      const user = currentUser();
      if (!user) {
        const favorites = guestFavorites();
        const index = favorites.indexOf(productId);
        if (index >= 0) favorites.splice(index, 1);
        else favorites.push(productId);
        saveGuestFavorites(favorites);
        return { active: index < 0, favorites };
      }
      const record = db.users.find(entry => entry.id === user.id);
      record.favorites = record.favorites || [];
      const index = record.favorites.indexOf(productId);
      if (index >= 0) record.favorites.splice(index, 1);
      else record.favorites.push(productId);
      persist();
      return { active: index < 0, favorites: [...record.favorites] };
    },

    createOrder({ customer, payment }) {
      const user = currentUser();
      if (!user) throw new Error('Entre na sua conta para finalizar a compra.');
      const cart = cartDetailed();
      if (!cart.lines.length) throw new Error('Sua sacola está vazia.');
      for (const line of cart.lines) {
        const product = db.products.find(entry => entry.id === line.productId);
        if (!product || !product.active) throw new Error(`${line.product.name} não está mais disponível.`);
        if (line.quantity > product.stock) throw new Error(`Estoque insuficiente para ${product.name}.`);
      }
      const shipping = cart.subtotal >= db.settings.freeShipping ? 0 : db.settings.shippingFee;
      const order = {
        id: uid('o'), number: orderNumber(), userId: user.id, userName: user.name, userEmail: user.email,
        status: 'pendente', payment: String(payment || 'Pix'), createdAt: nowISO(),
        items: cart.lines.map(line => ({
          productId: line.productId, name: line.product.name, subtitle: line.product.subtitle,
          size: line.size, quantity: line.quantity, price: line.product.price, image: line.product.image
        })),
        subtotal: cart.subtotal, shipping, total: cart.subtotal + shipping,
        customer: {
          name: String(customer.name || user.name).trim(),
          phone: String(customer.phone || '').trim(),
          zip: String(customer.zip || '').trim(),
          address: String(customer.address || '').trim(),
          number: String(customer.number || '').trim(),
          city: String(customer.city || '').trim(),
          state: String(customer.state || '').trim().toUpperCase().slice(0, 2)
        }
      };
      cart.lines.forEach(line => {
        const product = db.products.find(entry => entry.id === line.productId);
        product.stock = Math.max(0, product.stock - line.quantity);
      });
      db.orders.unshift(order);
      writeCart([]);
      const record = db.users.find(entry => entry.id === user.id);
      if (record) {
        record.address = order.customer.address || record.address;
        record.city = order.customer.city || record.city;
        record.state = order.customer.state || record.state;
        record.zip = order.customer.zip || record.zip;
        record.phone = order.customer.phone || record.phone;
      }
      persist();
      return copy(order);
    },
    myOrders() {
      const user = currentUser();
      if (!user) return [];
      return copy(db.orders
        .filter(order => order.userId === user.id)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    },
    orders() { return copy([...db.orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))); },
    updateOrderStatus(id, status) {
      const order = db.orders.find(entry => entry.id === id);
      if (!order) throw new Error('Pedido não encontrado.');
      if (!['pendente', 'pago', 'enviado', 'entregue', 'cancelado'].includes(status)) throw new Error('Status inválido.');
      const previous = order.status;
      if (status === 'cancelado' && previous !== 'cancelado') {
        order.items.forEach(item => {
          const product = db.products.find(entry => entry.id === item.productId);
          if (product) product.stock += item.quantity;
        });
      }
      if (previous === 'cancelado' && status !== 'cancelado') {
        order.items.forEach(item => {
          const product = db.products.find(entry => entry.id === item.productId);
          if (product) product.stock = Math.max(0, product.stock - item.quantity);
        });
      }
      order.status = status;
      order.updatedAt = nowISO();
      persist();
      return copy(order);
    },
    users() {
      return db.users.map(user => {
        const orders = db.orders.filter(order => order.userId === user.id && order.status !== 'cancelado');
        return {
          ...publicUser(user),
          orders: orders.length,
          spent: orders.reduce((sum, order) => sum + order.total, 0),
          cartCount: (user.cart || []).reduce((sum, line) => sum + line.quantity, 0)
        };
      });
    },
    setUserBlocked(id, blocked) {
      const user = db.users.find(entry => entry.id === id);
      if (!user) throw new Error('Usuário não encontrado.');
      if (user.role === 'admin') throw new Error('Não é possível bloquear um administrador.');
      user.blocked = Boolean(blocked);
      if (blocked) {
        const active = session();
        if (active && active.userId === id) localStorage.removeItem(SESSION_KEY);
      }
      persist();
    },
    async createAdmin({ name, email, password }) {
      const cleanName = String(name || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (cleanName.length < 2) throw new Error('Informe o nome do administrador.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error('Informe um e-mail válido.');
      if (String(password || '').length < 6) throw new Error('A senha precisa ter ao menos 6 caracteres.');
      if (findUserByEmail(cleanEmail)) throw new Error('Já existe uma conta com este e-mail.');
      const hashed = await hashPassword(password);
      db.users.push({
        id: uid('u'), name: cleanName, email: cleanEmail, role: 'admin',
        passwordHash: hashed.hash, passwordSalt: hashed.salt,
        phone: '', address: '', city: '', state: '', zip: '',
        cart: [], favorites: [], blocked: false, createdAt: nowISO()
      });
      persist();
    },
    exportData() {
      return JSON.stringify(db, null, 2);
    }
  };

  window.addEventListener('storage', event => {
    if (event.key === DB_KEY && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (parsed.version === VERSION) {
          db = parsed;
          window.dispatchEvent(new CustomEvent('rua98:data'));
        }
      } catch {
        /* ignora dados inválidos de outra aba */
      }
    }
  });

  window.RUA98 = api;
})();
