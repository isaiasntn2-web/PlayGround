/* RUA 98 — interface de autenticação, menu da conta e checkout */
(() => {
  const money = value => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  let pendingAction = null;
  let authMode = 'login';
  let authElements = null;
  let checkoutElements = null;
  let checkoutCoupon = '';
  let infoElements = null;
  let infoTrigger = null;

  function toast(message) {
    let element = document.querySelector('.toast');
    if (!element) {
      element = document.createElement('div');
      element.className = 'toast';
      element.setAttribute('role', 'status');
      element.setAttribute('aria-live', 'polite');
      document.body.append(element);
    }
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(element._timer);
    element._timer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  function infoContent() {
    const settings = RUA98.settings();
    const money = value => `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return {
      returns: {
        kicker: 'TROCAS & DEVOLUÇÕES',
        title: 'SEM MEDO<br>DE TROCAR.',
        body: `
          <p>Você tem <b>30 dias corridos</b> depois do recebimento para solicitar troca ou devolução. A peça precisa estar sem uso, com etiqueta e embalagem original.</p>
          <div class="info-steps">
            <div><span>01</span><b>FALE COM A GENTE</b><p>Envie o número do pedido e o motivo da troca para o atendimento.</p></div>
            <div><span>02</span><b>ENVIE A PEÇA</b><p>Enviamos as instruções e o endereço de retorno por e-mail.</p></div>
            <div><span>03</span><b>ESCOLHA O NOVO TAMANHO</b><p>Assim que a peça chegar, liberamos a troca ou o reembolso.</p></div>
          </div>
          <p class="info-note">Peça com defeito? A troca é gratuita e prioritária. Fale com a gente pelo Instagram ou pelo e-mail de atendimento.</p>`
      },
      shipping: {
        kicker: 'ENTREGA',
        title: 'CHEGA<br>NA SUA RUA.',
        body: `
          <p>Enviamos para todo o Brasil com rastreamento. O prazo começa a contar depois da confirmação do pagamento.</p>
          <div class="info-facts">
            <div><span>FRETE GRÁTIS</span><b>ACIMA DE ${money(settings.freeShipping)}</b></div>
            <div><span>FRETE PADRÃO</span><b>${money(settings.shippingFee)}</b></div>
            <div><span>PRAZO</span><b>3 A 9 DIAS ÚTEIS*</b></div>
          </div>
          <p class="info-note">*Prazo estimado para capitais. Regiões remotas podem levar mais tempo. O código de rastreio aparece em Minha Conta assim que o pedido é enviado.</p>`
      },
      privacy: {
        kicker: 'PRIVACIDADE',
        title: 'SEUS DADOS.<br>SUAS REGRAS.',
        body: `
          <p>Esta é uma loja demonstrativa. Conta, sacola, favoritos e pedidos ficam salvos <b>somente neste navegador</b>, via armazenamento local.</p>
          <div class="info-facts">
            <div><span>COLETA</span><b>NENHUM DADO ENVIADO</b></div>
            <div><span>PAGAMENTO</span><b>SIMULADO</b></div>
            <div><span>CONTROLE</span><b>VOCÊ PODE LIMPAR TUDO</b></div>
          </div>
          <p class="info-note">Para apagar os dados desta demo, limpe o armazenamento do site no navegador. Em uma loja real, política de privacidade, cookies e pagamento precisam seguir a LGPD.</p>`
      },
      sizes: {
        kicker: 'GUIA DE TAMANHOS',
        title: 'ACHA<br>SEU CAIMENTO.',
        body: `
          <p>Nossas camisetas têm modelagem <b>oversized</b>. Se você prefere um caimento mais justo, escolha um tamanho abaixo.</p>
          <div class="size-table-wrap">
            <table class="size-table">
              <thead><tr><th>TAM.</th><th>TORAX</th><th>COMPRIMENTO</th><th>MANGA</th></tr></thead>
              <tbody>
                <tr><td>P</td><td>104 CM</td><td>70 CM</td><td>22 CM</td></tr>
                <tr><td>M</td><td>110 CM</td><td>72 CM</td><td>23 CM</td></tr>
                <tr><td>G</td><td>116 CM</td><td>74 CM</td><td>24 CM</td></tr>
                <tr><td>GG</td><td>122 CM</td><td>76 CM</td><td>25 CM</td></tr>
              </tbody>
            </table>
          </div>
          <p class="info-note">Medidas aproximadas com a peça deitada. Modelo vestindo M · 1,78 m. Em dúvida, chama a gente antes de fechar o pedido.</p>`
      }
    };
  }

  function injectInfoModal() {
    if (infoElements) return;
    const scrim = document.createElement('div');
    scrim.className = 'info-scrim';
    const modal = document.createElement('section');
    modal.className = 'info-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'info-title');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <button class="info-close" type="button" aria-label="Fechar">×</button>
      <span class="eyebrow info-kicker"></span>
      <h2 class="info-title" id="info-title"></h2>
      <div class="info-body"></div>
    `;
    document.body.append(scrim, modal);
    infoElements = { scrim, modal };
    scrim.addEventListener('click', closeInfo);
    modal.querySelector('.info-close').addEventListener('click', closeInfo);
  }

  function openInfo(key = 'returns') {
    injectInfoModal();
    if (!infoElements.modal.classList.contains('open')) infoTrigger = document.activeElement;
    RUA98.ready().then(() => {
      const content = infoContent()[key] || infoContent().returns;
      infoElements.modal.querySelector('.info-kicker').textContent = content.kicker;
      infoElements.modal.querySelector('.info-title').innerHTML = content.title;
      infoElements.modal.querySelector('.info-body').innerHTML = content.body;
      infoElements.scrim.classList.add('open');
      infoElements.modal.classList.add('open');
      infoElements.modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('info-open');
      requestAnimationFrame(() => infoElements.modal.querySelector('.info-close').focus());
    });
  }

  function closeInfo() {
    if (!infoElements) return;
    infoElements.scrim.classList.remove('open');
    infoElements.modal.classList.remove('open');
    infoElements.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('info-open');
    if (infoTrigger && typeof infoTrigger.focus === 'function') {
      infoTrigger.focus({ preventScroll: true });
      infoTrigger = null;
    }
  }

  function injectAuthModal() {
    if (document.querySelector('.auth-modal')) {
      authElements = {
        scrim: document.querySelector('.auth-scrim'),
        modal: document.querySelector('.auth-modal'),
        message: document.querySelector('.auth-message'),
        tabs: document.querySelectorAll('[data-auth-tab]'),
        loginForm: document.querySelector('.login-form'),
        registerForm: document.querySelector('.register-form')
      };
      return;
    }
    const scrim = document.createElement('div');
    scrim.className = 'auth-scrim';
    const modal = document.createElement('section');
    modal.className = 'auth-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'auth-title');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <button class="auth-close" type="button" aria-label="Fechar">×</button>
      <div class="auth-brand">RUA<span>98</span><i>®</i></div>
      <span class="eyebrow auth-eyebrow"><span class="eyebrow-line"></span> SUA CONTA NA RUA</span>
      <h2 id="auth-title" class="auth-title">ENTRE NA<br><span>SUA RUA.</span></h2>
      <p class="auth-message" hidden></p>
      <div class="auth-tabs" role="tablist" aria-label="Acesso à conta">
        <button type="button" role="tab" data-auth-tab="login" class="active" aria-selected="true">ENTRAR</button>
        <button type="button" role="tab" data-auth-tab="register" aria-selected="false">CRIAR CONTA</button>
      </div>
      <form class="auth-form login-form" novalidate>
        <label>E-MAIL<input type="email" name="email" autocomplete="email" placeholder="voce@email.com" required></label>
        <label>SENHA<input type="password" name="password" autocomplete="current-password" placeholder="••••••" required></label>
        <p class="auth-error" role="alert" hidden></p>
        <button class="button button-dark auth-submit" type="submit">ENTRAR NA RUA <span>↗</span></button>
        <button class="auth-demo" type="button">TESTAR CONTA DEMO</button>
        <p class="auth-note">Demo: <b>cliente@rua98.com</b> · senha <b>rua123</b><br>Dados salvos apenas neste navegador.</p>
      </form>
      <form class="auth-form register-form" novalidate hidden>
        <label>NOME<input type="text" name="name" autocomplete="name" placeholder="Como te chamam" required maxlength="60"></label>
        <label>E-MAIL<input type="email" name="email" autocomplete="email" placeholder="voce@email.com" required></label>
        <label>SENHA<input type="password" name="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres" minlength="6" required></label>
        <p class="auth-error" role="alert" hidden></p>
        <button class="button button-dark auth-submit" type="submit">CRIAR MINHA CONTA <span>↗</span></button>
        <p class="auth-note">Sua sacola, favoritos e pedidos ficam salvos no seu perfil.<br>Autenticação de demonstração — sem servidor.</p>
      </form>
      <div class="auth-trust"><span>✳</span> SEUS DADOS FICAM NESTE NAVEGADOR <span>✳</span></div>
    `;
    document.body.append(scrim, modal);
    authElements = {
      scrim,
      modal,
      message: modal.querySelector('.auth-message'),
      tabs: modal.querySelectorAll('[data-auth-tab]'),
      loginForm: modal.querySelector('.login-form'),
      registerForm: modal.querySelector('.register-form')
    };
    scrim.addEventListener('click', closeAuth);
    modal.querySelector('.auth-close').addEventListener('click', closeAuth);
    authElements.tabs.forEach(tab => tab.addEventListener('click', () => setAuthMode(tab.dataset.authTab)));
    authElements.loginForm.addEventListener('submit', handleLogin);
    authElements.registerForm.addEventListener('submit', handleRegister);
    modal.querySelector('.auth-demo').addEventListener('click', async () => {
      const form = authElements.loginForm;
      form.elements.email.value = 'cliente@rua98.com';
      form.elements.password.value = 'rua123';
      await submitLogin('cliente@rua98.com', 'rua123');
    });
  }

  function setAuthMode(mode) {
    if (!authElements) return;
    authMode = mode === 'register' ? 'register' : 'login';
    authElements.tabs.forEach(tab => {
      const active = tab.dataset.authTab === authMode;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    authElements.loginForm.hidden = authMode !== 'login';
    authElements.registerForm.hidden = authMode !== 'register';
    const form = authMode === 'login' ? authElements.loginForm : authElements.registerForm;
    const error = form.querySelector('.auth-error');
    error.hidden = true;
    requestAnimationFrame(() => form.querySelector('input')?.focus());
  }

  function showAuthError(form, message) {
    const error = form.querySelector('.auth-error');
    error.textContent = message;
    error.hidden = false;
  }

  async function submitLogin(email, password) {
    const form = authElements.loginForm;
    const button = form.querySelector('.auth-submit');
    const error = form.querySelector('.auth-error');
    error.hidden = true;
    button.disabled = true;
    button.textContent = 'ENTRANDO...';
    try {
      const user = await RUA98.login(email, password);
      closeAuth(true);
      toast(`BEM-VINDO, ${user.name.toUpperCase()} ✳`);
      const action = pendingAction;
      pendingAction = null;
      if (action) setTimeout(action, 250);
    } catch (loginError) {
      showAuthError(form, loginError.message);
    } finally {
      button.disabled = false;
      button.innerHTML = 'ENTRAR NA RUA <span>↗</span>';
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!email || !password) return showAuthError(form, 'Preencha e-mail e senha.');
    await submitLogin(email, password);
  }

  async function handleRegister(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('.auth-submit');
    const error = form.querySelector('.auth-error');
    error.hidden = true;
    button.disabled = true;
    button.textContent = 'CRIANDO CONTA...';
    try {
      const user = await RUA98.register({
        name: form.elements.name.value,
        email: form.elements.email.value,
        password: form.elements.password.value
      });
      closeAuth(true);
      toast(`CONTA CRIADA. BEM-VINDO, ${user.name.toUpperCase()} ✳`);
      const action = pendingAction;
      pendingAction = null;
      if (action) setTimeout(action, 250);
    } catch (registerError) {
      showAuthError(form, registerError.message);
    } finally {
      button.disabled = false;
      button.innerHTML = 'CRIAR MINHA CONTA <span>↗</span>';
    }
  }

  function openAuth(mode = 'login', message = '') {
    injectAuthModal();
    if (!authElements) return;
    setAuthMode(mode);
    if (message) {
      authElements.message.textContent = message;
      authElements.message.hidden = false;
    } else {
      authElements.message.hidden = true;
    }
    authElements.scrim.classList.add('open');
    authElements.modal.classList.add('open');
    authElements.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('auth-open');
    requestAnimationFrame(() => {
      const form = authMode === 'login' ? authElements.loginForm : authElements.registerForm;
      form.querySelector('input')?.focus();
    });
  }

  function closeAuth(keepPending = false) {
    if (!authElements) return;
    if (!keepPending) pendingAction = null;
    authElements.scrim.classList.remove('open');
    authElements.modal.classList.remove('open');
    authElements.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('auth-open');
    const loginError = authElements.loginForm.querySelector('.auth-error');
    const registerError = authElements.registerForm.querySelector('.auth-error');
    loginError.hidden = true;
    registerError.hidden = true;
  }

  function injectAccountButton() {
    const actions = document.querySelector('.header-actions');
    if (!actions || actions.querySelector('.account-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'account-wrap';
    wrap.innerHTML = `
      <button class="account-btn" type="button" aria-label="Minha conta" aria-haspopup="menu" aria-expanded="false">
        <span class="account-avatar" aria-hidden="true"></span>
        <span class="account-label">ENTRAR</span>
      </button>
      <div class="account-menu" role="menu" hidden></div>
    `;
    actions.prepend(wrap);
    const button = wrap.querySelector('.account-btn');
    button.addEventListener('click', event => {
      event.stopPropagation();
      const user = RUA98.currentUser();
      if (!user) {
        pendingAction = null;
        openAuth('login', 'Entre ou crie sua conta para viver a RUA 98 do seu jeito.');
        return;
      }
      const menu = wrap.querySelector('.account-menu');
      const isOpen = !menu.hidden;
      menu.hidden = isOpen;
      button.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen) renderAccountMenu();
    });
    wrap.querySelector('.account-menu').addEventListener('click', event => {
      if (event.target.closest('.account-logout')) {
        RUA98.logout();
        toast('VOCÊ SAIU DA CONTA. ATÉ LOGO ✳');
      }
    });
    document.addEventListener('click', event => {
      if (!wrap.contains(event.target)) {
        wrap.querySelector('.account-menu').hidden = true;
        button.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        wrap.querySelector('.account-menu').hidden = true;
        button.setAttribute('aria-expanded', 'false');
      }
    });
    refreshHeader();
  }

  function renderAccountMenu() {
    const wrap = document.querySelector('.account-wrap');
    if (!wrap) return;
    const user = RUA98.currentUser();
    const menu = wrap.querySelector('.account-menu');
    if (!user) {
      menu.innerHTML = '';
      return;
    }
    const favorites = RUA98.favorites().length;
    menu.innerHTML = `
      <div class="account-hello">
        <span class="eyebrow">CONECTADO COMO</span>
        <b>${esc(user.name)}</b>
        <span class="account-email">${esc(user.email)}</span>
      </div>
      <a href="conta.html" role="menuitem">MINHA CONTA <span>↗</span></a>
      <a href="conta.html#pedidos" role="menuitem">MEUS PEDIDOS <span>${RUA98.myOrders().length}</span></a>
      <a href="conta.html#favoritos" role="menuitem">FAVORITOS <span>${favorites}</span></a>
      ${user.role === 'admin' ? '<a class="account-admin" href="admin.html" role="menuitem">PAINEL ADM <span>↗</span></a>' : ''}
      <button class="account-logout" type="button" role="menuitem">SAIR DA CONTA</button>
    `;
  }

  function refreshHeader() {
    const wrap = document.querySelector('.account-wrap');
    if (!wrap) return;
    const user = RUA98.currentUser();
    const button = wrap.querySelector('.account-btn');
    const avatar = wrap.querySelector('.account-avatar');
    const label = wrap.querySelector('.account-label');
    if (user) {
      const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
      avatar.textContent = initials || 'R';
      avatar.classList.add('filled');
      label.textContent = user.name.split(/\s+/)[0].toUpperCase();
      wrap.classList.add('logged');
      renderAccountMenu();
    } else {
      avatar.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5"/></svg>';
      avatar.classList.remove('filled');
      label.textContent = 'ENTRAR';
      wrap.classList.remove('logged');
      wrap.querySelector('.account-menu').hidden = true;
    }
  }

  function injectCheckout() {
    if (document.querySelector('.checkout-modal')) {
      checkoutElements = {
        scrim: document.querySelector('.checkout-scrim'),
        modal: document.querySelector('.checkout-modal'),
        body: document.querySelector('.checkout-body')
      };
      return;
    }
    const scrim = document.createElement('div');
    scrim.className = 'checkout-scrim';
    const modal = document.createElement('section');
    modal.className = 'checkout-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'checkout-title');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="checkout-head">
        <div><span class="eyebrow">ÚLTIMO PASSO</span><h2 id="checkout-title">FECHAR<br><span>O PEDIDO.</span></h2></div>
        <button class="checkout-close" type="button" aria-label="Fechar checkout">×</button>
      </div>
      <div class="checkout-body"></div>
    `;
    document.body.append(scrim, modal);
    checkoutElements = { scrim, modal, body: modal.querySelector('.checkout-body') };
    scrim.addEventListener('click', closeCheckout);
    modal.querySelector('.checkout-close').addEventListener('click', closeCheckout);
    checkoutElements.body.addEventListener('submit', handleCheckoutSubmit);
    checkoutElements.body.addEventListener('click', event => {
      if (event.target.closest('.checkout-success-close')) closeCheckout();
      if (event.target.closest('.coupon-apply')) applyCoupon();
      if (event.target.closest('.coupon-remove')) {
        checkoutCoupon = '';
        renderCheckoutSummary(RUA98.previewOrder(''));
        toast('CUPOM REMOVIDO.');
        checkoutElements.body.querySelector('#checkout-coupon')?.focus();
      }
    });
    checkoutElements.body.addEventListener('input', event => {
      const input = event.target.closest('#checkout-coupon');
      if (!input) return;
      input.value = input.value.toUpperCase().replace(/\s+/g, '');
      const error = checkoutElements.body.querySelector('.coupon-error');
      if (error) error.hidden = true;
    });
  }

  function checkoutSummaryHtml(totals) {
    const settings = RUA98.settings();
    return `
      <span class="eyebrow">RESUMO DA SACOLA</span>
      <div class="checkout-lines">
        ${totals.lines.map(line => `
          <div class="checkout-line">
            <img src="${esc(line.product.image)}" alt="${esc(line.product.name)}">
            <div><b>${esc(line.product.name)}</b><span>TAM. ${esc(line.size)} · QTD. ${line.quantity}</span></div>
            <strong>${money(line.total)}</strong>
          </div>`).join('')}
      </div>
      <div class="checkout-totals">
        <div><span>SUBTOTAL</span><b>${money(totals.subtotal)}</b></div>
        ${totals.discount > 0 ? `<div class="checkout-discount"><span>DESCONTO ${esc(totals.coupon.code)}</span><b>-${money(totals.discount)}</b></div>` : ''}
        <div><span>FRETE</span><b>${totals.shipping === 0 ? 'GRÁTIS' : money(totals.shipping)}</b></div>
        <div class="checkout-total"><span>TOTAL</span><b>${money(totals.total)}</b></div>
      </div>
      <div class="coupon-box">
        <span class="eyebrow">CUPOM DE DESCONTO</span>
        <div class="coupon-row">
          <input id="checkout-coupon" type="text" value="${esc(totals.coupon ? totals.coupon.code : '')}" placeholder="DIGITE SEU CUPOM" aria-label="Código do cupom" autocomplete="off" maxlength="20">
          <button class="coupon-apply" type="button">${totals.coupon ? 'TROCAR' : 'APLICAR'}</button>
        </div>
        ${totals.coupon
          ? `<p class="coupon-hint">CUPOM <b>${esc(totals.coupon.code)}</b> APLICADO · ${esc(totals.coupon.label)} <button class="coupon-remove" type="button">REMOVER</button></p>`
          : '<p class="coupon-hint">USE <b>RUA10</b> NA PRIMEIRA COMPRA.</p>'}
        <p class="coupon-error" role="alert" hidden></p>
      </div>
      <p class="checkout-secure">✳ ${esc(settings.checkoutNote)}</p>`;
  }

  function renderCheckoutSummary(totals) {
    const summary = checkoutElements?.body.querySelector('.checkout-summary');
    if (summary) summary.innerHTML = checkoutSummaryHtml(totals);
  }

  function applyCoupon() {
    const input = checkoutElements.body.querySelector('#checkout-coupon');
    const error = checkoutElements.body.querySelector('.coupon-error');
    if (!input || !error) return;
    const code = input.value.trim().toUpperCase();
    if (!code) {
      error.textContent = 'Digite um cupom para aplicar.';
      error.hidden = false;
      input.focus();
      return;
    }
    try {
      const totals = RUA98.previewOrder(code);
      checkoutCoupon = totals.coupon.code;
      renderCheckoutSummary(totals);
      toast(`CUPOM ${checkoutCoupon} APLICADO ✳`);
      checkoutElements.body.querySelector('#checkout-coupon')?.focus();
    } catch (couponError) {
      error.textContent = couponError.message.toUpperCase();
      error.hidden = false;
      input.focus();
    }
  }

  function openCheckout() {
    injectCheckout();
    const user = RUA98.currentUser();
    if (!user) {
      pendingAction = openCheckout;
      openAuth('login', 'Entre na sua conta para finalizar a compra com segurança.');
      return;
    }
    const cart = RUA98.cart();
    if (!cart.lines.length) {
      toast('SUA SACOLA ESTÁ VAZIA.');
      return;
    }
    checkoutCoupon = '';
    const totals = RUA98.previewOrder('');
    const lastOrder = RUA98.myOrders()[0];
    const profile = lastOrder ? lastOrder.customer : user;
    checkoutElements.body.innerHTML = `
      <div class="checkout-grid">
        <div class="checkout-summary">${checkoutSummaryHtml(totals)}</div>
        <form class="checkout-form" novalidate>
          <span class="eyebrow">ENTREGA</span>
          <div class="checkout-fields">
            <label class="span-2">NOME<input name="name" value="${esc(profile.name || user.name)}" autocomplete="name" required></label>
            <label>TELEFONE<input name="phone" value="${esc(profile.phone || '')}" placeholder="(11) 99999-9999" inputmode="tel" autocomplete="tel" required></label>
            <label>CEP<input name="zip" value="${esc(profile.zip || '')}" placeholder="00000-000" inputmode="numeric" autocomplete="postal-code" required></label>
            <label class="span-2">ENDEREÇO<input name="address" value="${esc(profile.address || '')}" placeholder="Rua, avenida..." autocomplete="address-line1" required></label>
            <label>NÚMERO<input name="number" value="${esc(profile.number || '')}" placeholder="98" autocomplete="address-line2"></label>
            <label>CIDADE<input name="city" value="${esc(profile.city || '')}" autocomplete="address-level2" required></label>
            <label>ESTADO<select name="state" autocomplete="address-level1" required>
              <option value="">UF</option>
              ${['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => `<option value="${uf}"${String(profile.state || '').toUpperCase() === uf ? ' selected' : ''}>${uf}</option>`).join('')}
            </select></label>
          </div>
          <span class="eyebrow checkout-payment-label">PAGAMENTO <i>DEMO</i></span>
          <div class="payment-options">
            <label><input type="radio" name="payment" value="Pix" checked><span>PIX</span></label>
            <label><input type="radio" name="payment" value="Cartão"><span>CARTÃO</span></label>
            <label><input type="radio" name="payment" value="Boleto"><span>BOLETO</span></label>
          </div>
          <p class="checkout-error" role="alert" hidden></p>
          <button class="button button-dark checkout-submit" type="submit">CONFIRMAR PEDIDO <span>↗</span></button>
          <span class="checkout-note">Pagamento simulado. Nenhuma cobrança real será feita.</span>
        </form>
      </div>
    `;
    closeCartDrawer();
    checkoutElements.scrim.classList.add('open');
    checkoutElements.modal.classList.add('open');
    checkoutElements.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('checkout-open');
    requestAnimationFrame(() => checkoutElements.body.querySelector('.checkout-form input')?.focus());
  }

  function closeCheckout() {
    if (!checkoutElements) return;
    checkoutCoupon = '';
    checkoutElements.scrim.classList.remove('open');
    checkoutElements.modal.classList.remove('open');
    checkoutElements.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('checkout-open');
  }

  function closeCartDrawer() {
    document.body.classList.remove('cart-open');
    document.querySelector('.cart-drawer')?.setAttribute('aria-hidden', 'true');
  }

  function handleCheckoutSubmit(event) {
    if (!event.target.closest('.checkout-form')) return;
    event.preventDefault();
    const form = event.target.closest('.checkout-form');
    const error = form.querySelector('.checkout-error');
    error.hidden = true;
    const values = Object.fromEntries(new FormData(form));
    if (!values.name || !values.phone || !values.zip || !values.address || !values.city || !values.state) {
      error.textContent = 'Preencha os dados de entrega para continuar.';
      error.hidden = false;
      return;
    }
    if (values.phone.replace(/\D/g, '').length < 10) {
      error.textContent = 'Informe um telefone com DDD.';
      error.hidden = false;
      form.elements.phone.focus();
      return;
    }
    if (values.zip.replace(/\D/g, '').length !== 8) {
      error.textContent = 'Informe um CEP com 8 dígitos.';
      error.hidden = false;
      form.elements.zip.focus();
      return;
    }
    try {
      const order = RUA98.createOrder({
        payment: values.payment,
        customer: values,
        couponCode: checkoutCoupon
      });
      const saving = order.discount > 0
        ? `<span class="checkout-success-saving">CUPOM ${esc(order.coupon.code)} · VOCÊ ECONOMIZOU ${money(order.discount)}</span>`
        : '';
      checkoutElements.body.innerHTML = `
        <div class="checkout-success">
          <span class="checkout-success-star">✳</span>
          <span class="eyebrow">PEDIDO CONFIRMADO</span>
          <h3>AGORA É<br><span>COM A GENTE.</span></h3>
          <p>Pedido <b>#${order.number}</b> registrado com sucesso.<br>Você acompanha tudo em Minha Conta.</p>
          ${saving}
          <p class="checkout-success-total">TOTAL DO PEDIDO <b>${money(order.total)}</b></p>
          <div class="checkout-success-actions">
            <a class="button button-dark" href="conta.html#pedidos">VER MEUS PEDIDOS <span>↗</span></a>
            <button class="button checkout-success-close" type="button">CONTINUAR COMPRANDO</button>
          </div>
        </div>
      `;
      checkoutCoupon = '';
      toast(`PEDIDO #${order.number} CONFIRMADO ✳`);
    } catch (orderError) {
      error.textContent = orderError.message;
      error.hidden = false;
    }
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-info]');
    if (!trigger) return;
    event.preventDefault();
    openInfo(trigger.dataset.info);
  });

  function trapModalFocus(container, event) {
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
      const activeModal = infoElements?.modal.classList.contains('open') ? infoElements.modal
        : checkoutElements?.modal.classList.contains('open') ? checkoutElements.modal
        : authElements?.modal.classList.contains('open') ? authElements.modal
        : null;
      if (activeModal) {
        trapModalFocus(activeModal, event);
        return;
      }
    }
    if (event.key !== 'Escape') return;
    if (infoElements?.modal.classList.contains('open')) closeInfo();
    if (checkoutElements?.modal.classList.contains('open')) closeCheckout();
    if (authElements?.modal.classList.contains('open')) closeAuth();
  });

  window.addEventListener('rua98:auth', () => {
    refreshHeader();
    renderAccountMenu();
  });
  window.addEventListener('rua98:data', () => {
    refreshHeader();
    renderAccountMenu();
  });

  const AuthUI = {
    init() {
      injectAuthModal();
      injectAccountButton();
      injectCheckout();
      injectInfoModal();
    },
    openAuth,
    closeAuth,
    openCheckout,
    closeCheckout,
    openInfo,
    closeInfo,
    refreshHeader,
    toast,
    requireLogin(message = 'Entre para continuar.') {
      if (RUA98.currentUser()) return true;
      pendingAction = null;
      openAuth('login', message);
      return false;
    }
  };

  window.AuthUI = AuthUI;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => AuthUI.init());
  else AuthUI.init();
})();
