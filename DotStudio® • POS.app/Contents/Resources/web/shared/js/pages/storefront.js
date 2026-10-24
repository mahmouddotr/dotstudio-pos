/* DotStudio® POS — Customer storefront */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  var preview = user.role !== 'customer';

  var page = DS.shell.mount({
    roles: null,
    active: 'storefront',
    title: t('storefront'),
    eyebrow: preview ? t('admin') : t('store'),
    icon: 'store',
    sub: DS.lang() === 'en' ? 'Browse the catalogue, add to cart and check out in seconds.' : 'تصفح الكتالوج، أضف للسلة وأكمل طلبك في ثوانٍ.',
    actions: '<div class="ds-lang-pill" role="group" aria-label="Language">' +
      '<button type="button" class="opt' + (DS.lang() === 'ar' ? ' active' : '') + '" data-set-lang="ar">AR</button>' +
      '<span class="sep">|</span>' +
      '<button type="button" class="opt' + (DS.lang() === 'en' ? ' active' : '') + '" data-set-lang="en">EN</button></div>' +
      '<button class="btn btn-primary" data-open-cart>' + icon('cart') + esc(t('cart')) + ' <span class="badge" data-cart-count>0</span></button>',
    content: DS.skeleton.grid(8)
  });
  if (!page) return;

  var params = new URLSearchParams(location.search);
  var state = { store: '', cat: '', q: '' };
  var cart = loadCart();

  function catalog() {
    return (DS.data.tenants || []).filter(function (tn) { return tn.status !== 'suspended'; });
  }
  function currentStore() {
    var id = state.store || params.get('store') || DS.store.get('ds_customer_store', null) || user.tenant_id || (catalog()[0] || {}).id;
    return DS.data.tenantById(id) || catalog()[0] || null;
  }
  function products(store) {
    return DS.data.products.filter(function (p) { return p.tenant_id === store.id && p.is_active !== false; });
  }
  function categories(store) {
    var out = [];
    products(store).forEach(function (p) { var c = DS.loc(p, 'category'); if (out.indexOf(c) === -1) out.push(c); });
    return out;
  }
  function pname(p) { return DS.lang() === 'en' ? (p.name_en || p.name) : p.name; }

  /* ───────────────────────────── CART ───────────────────────────── */
  function loadCart() {
    var raw = DS.store.get('ds_cart', null);
    if (raw && raw.items && Array.isArray(raw.items)) return { tenant_id: raw.tenant_id || null, items: raw.items };
    return { tenant_id: null, items: [] };
  }
  function saveCart() { DS.store.set('ds_cart', cart); }
  function cartCount() { return cart.items.reduce(function (s, l) { return s + l.qty; }, 0); }
  function cartTotal() { return cart.items.reduce(function (s, l) { return s + l.price * l.qty; }, 0); }
  function lineOf(id) { return cart.items.filter(function (l) { return l.id === id; })[0]; }

  function addToCart(id) {
    var store = currentStore();
    if (!store) return;
    var p = products(store).filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (cart.tenant_id && cart.tenant_id !== store.id && cart.items.length) {
      DS.confirm({
        title: t('cart'),
        text: DS.lang() === 'en' ? 'Your cart contains items from another store. Start a new cart for ' + store.name + '?' : 'سلتك تحتوي منتجات من متجر آخر. هل تريد بدء سلة جديدة لمتجر ' + store.name + '؟'
      }).then(function (ok) {
        if (!ok) return;
        cart = { tenant_id: store.id, items: [] };
        pushLine(p);
      });
      return;
    }
    cart.tenant_id = store.id;
    pushLine(p);
  }

  function pushLine(p) {
    var line = lineOf(p.id);
    var wanted = line ? line.qty + 1 : 1;
    if (wanted > p.stock) { DS.toast(t('outOfStock'), 'warning'); return; }
    if (line) line.qty = wanted;
    else cart.items.push({ id: p.id, name: p.name, name_en: p.name_en, price: Number(p.price) || 0, qty: 1, image: p.image, stock: p.stock, tenant_id: p.tenant_id });
    saveCart();
    DS.toast(t('addedToCart'), 'success');
    renderCart();
  }

  function setQty(id, qty) {
    var line = lineOf(id);
    if (!line) return;
    if (qty <= 0) cart.items = cart.items.filter(function (l) { return l.id !== id; });
    else if (qty > line.stock) { DS.toast(t('outOfStock'), 'warning'); return; }
    else line.qty = qty;
    if (!cart.items.length) cart.tenant_id = null;
    saveCart();
    renderCart();
  }

  function renderCart() {
    var count = cartCount();
    DS.$$('[data-cart-count]').forEach(function (el) { el.textContent = count; });
    var fc = document.querySelector('[data-floating-cart]');
    if (fc) {
      fc.style.display = count ? 'flex' : 'none';
      var c = fc.querySelector('.count');
      if (c) c.textContent = count;
      var tot = fc.querySelector('[data-fc-total]');
      if (tot) tot.textContent = money(cartTotal());
    }
    var body = document.querySelector('[data-cart-lines]');
    if (body) {
      body.innerHTML = cart.items.length ? cart.items.map(function (l) {
        return '<div class="cart-line"><img src="' + esc(DS.data.img(l.image)) + '" alt="">' +
          '<div class="cart-line-info"><div class="cart-line-name">' + esc(DS.lang() === 'en' ? (l.name_en || l.name) : l.name) + '</div>' +
            '<div class="cart-line-price">' + money(l.price) + ' × ' + l.qty + '</div></div>' +
          '<div class="qty-control"><button data-minus="' + esc(l.id) + '">' + icon('minus') + '</button><span>' + l.qty + '</span><button data-plus="' + esc(l.id) + '">' + icon('plus') + '</button></div>' +
          '<button class="btn btn-ghost btn-sm" data-remove="' + esc(l.id) + '" style="color:var(--text-tertiary)">' + icon('x') + '</button></div>';
      }).join('') : '<div class="cart-empty">' + icon('cart') + '<div>' + esc(t('emptyCart')) + '</div><div style="font-size:12px;margin-top:4px">' + esc(t('emptyCartText')) + '</div></div>';
      DS.$$('[data-plus]', body).forEach(function (b) { b.onclick = function () { var l = lineOf(b.getAttribute('data-plus')); if (l) setQty(l.id, l.qty + 1); }; });
      DS.$$('[data-minus]', body).forEach(function (b) { b.onclick = function () { var l = lineOf(b.getAttribute('data-minus')); if (l) setQty(l.id, l.qty - 1); }; });
      DS.$$('[data-remove]', body).forEach(function (b) { b.onclick = function () { setQty(b.getAttribute('data-remove'), 0); }; });
    }
    var foot = document.querySelector('[data-cart-foot]');
    if (foot) {
      foot.innerHTML = '<div class="summary-line"><span>' + esc(t('subtotal')) + '</span><span>' + money(cartTotal()) + '</span></div>' +
        '<div class="summary-line"><span>' + esc(t('delivery')) + '</span><span>' + money(cart.items.length ? deliveryFee() : 0) + '</span></div>' +
        '<div class="summary-line total"><span>' + esc(t('total')) + '</span><span class="num">' + money(cartTotal() + (cart.items.length ? deliveryFee() : 0)) + '</span></div>' +
        '<a class="btn btn-primary" href="' + url('customer/checkout.html') + '"' + (cart.items.length ? '' : ' style="pointer-events:none;opacity:.5"') + '>' + icon('arrowRight') + esc(t('checkout')) + '</a>';
    }
  }
  function deliveryFee() { var s = currentStore(); return s ? (Number(s.delivery_fee) || 0) : 0; }

  function openDrawer() {
    var d = document.querySelector('[data-cart-drawer]');
    var s = document.querySelector('[data-cart-scrim]');
    if (d) d.classList.add('open');
    if (s) s.classList.add('open');
  }

  /* Apple 2026: the floating lime cart bar opens a real modal with a
     checkout CTA (the header cart still opens the side drawer). */
  function openCartModal() {
    if (!cart.items.length) {
      DS.modal({
        size: 'sm',
        title: esc(t('cart')),
        body: '<div class="cart-empty">' + icon('cart') + '<div>' + esc(t('emptyCart')) + '</div>' +
          '<div style="font-size:12px;margin-top:4px">' + esc(t('emptyCartText')) + '</div></div>',
        actions: [{ label: t('continueShopping'), variant: 'btn-primary' }]
      });
      return;
    }
    var lines = cart.items.map(function (l) {
      return '<div class="cart-line modal-cart-line"><img src="' + esc(DS.data.img(l.image)) + '" alt="">' +
        '<div class="cart-line-info"><div class="cart-line-name">' + esc(DS.lang() === 'en' ? (l.name_en || l.name) : l.name) + '</div>' +
        '<div class="cart-line-price">' + money(l.price) + ' × ' + l.qty + '</div></div>' +
        '<div class="cart-line-total">' + money(l.price * l.qty) + '</div></div>';
    }).join('');
    var fee = deliveryFee();
    var total = cartTotal() + fee;
    var body = '<div class="cart-modal-lines">' + lines + '</div>' +
      '<div class="summary-line"><span>' + esc(t('subtotal')) + '</span><span>' + money(cartTotal()) + '</span></div>' +
      '<div class="summary-line"><span>' + esc(t('delivery')) + '</span><span>' + money(fee) + '</span></div>' +
      '<div class="summary-line total"><span>' + esc(t('total')) + '</span><span class="num">' + money(total) + '</span></div>';
    DS.modal({
      title: icon('cart') + ' ' + esc(t('cart')),
      sub: esc(cartCount() + ' ' + t('items')) + ' · ' + esc(money(total)),
      body: body,
      actions: [
        { label: t('continueShopping'), variant: 'btn-secondary' },
        { label: t('checkout'), variant: 'btn-primary', icon: icon('arrowRight'), onClick: function () {
          setTimeout(function () { location.href = url('customer/checkout.html'); }, 100);
        } }
      ]
    });
  }
  function closeDrawer() {
    var d = document.querySelector('[data-cart-drawer]');
    var s = document.querySelector('[data-cart-scrim]');
    if (d) d.classList.remove('open');
    if (s) s.classList.remove('open');
  }

  /* ───────────────────────────── RENDER ──────────────────────────── */
  function render() {
    var store = currentStore();
    if (!store) { page.setContent(DS.empty({ icon: 'store', title: t('noData') })); return; }
    state.store = store.id;

    var list = products(store);
    var q = state.q.trim().toLowerCase();
    var shown = list.filter(function (p) {
      if (state.cat && DS.loc(p, 'category') !== state.cat) return false;
      if (!q) return true;
      return (p.name + ' ' + (p.name_en || '') + ' ' + (p.category_en || p.category || '')).toLowerCase().indexOf(q) > -1;
    });

    var switcher = '<div class="store-switcher">' + catalog().map(function (tn) {
      return '<button class="store-chip' + (tn.id === store.id ? ' active' : '') + '" data-store="' + esc(tn.id) + '">' +
        '<img src="' + esc(DS.avatarUrl(tn)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(url('assets/img/LOGO-WHAIT.png')) + '\'"><div style="min-width:0"><div class="n">' + esc(tn.name) + '</div><div class="c">' + esc(DS.lang() === 'en' ? tn.industry_en : tn.industry) + '</div></div></button>';
    }).join('') + '</div>';

    var art = list.slice(0, 3).map(function (p) { return '<img src="' + esc(DS.data.img(p.image)) + '" alt="">'; }).join('');
    var hero = '<section class="store-hero">' +
      '<div class="info"><div class="welcome-kicker">' + icon('store') + esc(t('storeOpen')) + ' · ★ ' + esc(store.rating || '4.8') + '</div>' +
        '<h2>' + esc(store.name) + '</h2>' +
        '<p>' + esc(DS.lang() === 'en' ? store.description_en : store.description) + '</p>' +
        '<div class="meta"><span>' + icon('mapPin') + esc(DS.loc(store, 'address')) + '</span><span>' + icon('truck') + esc(t('delivery')) + ' ' + money(store.delivery_fee) + '</span><span>' + icon('phone') + esc(store.phone) + '</span></div></div>' +
      (art ? '<div class="store-hero-art">' + art + '</div>' : '') + '</section>';

    var previewNote = preview ? '<div class="card"><div class="card-body" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      '<span class="badge lime">' + icon('eye') + ' ' + esc(DS.lang() === 'en' ? 'Store preview' : 'معاينة المتجر') + '</span>' +
      '<span style="font-size:12px;color:var(--text-secondary);flex:1">' + esc(DS.lang() === 'en' ? 'You are previewing the live storefront as ' + store.name + '.' : 'أنت تعاين واجهة متجر ' + store.name + ' الحية.') + '</span>' +
      '<a class="btn btn-secondary btn-sm" href="' + url('admin/stores.html') + '">' + icon('arrowLeft') + esc(t('back')) + '</a></div></div>' : '';

    var rail = '<div class="storefront-bar"><div class="category-rail">' +
      '<button class="pos-cat' + (!state.cat ? ' active' : '') + '" data-cat="">' + esc(t('all')) + '</button>' +
      categories(store).map(function (c) { return '<button class="pos-cat' + (state.cat === c ? ' active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') +
      '</div><div class="search-mini" style="min-width:220px;max-width:320px;flex:1">' + icon('search') + '<input data-q placeholder="' + esc(t('searchInStore')) + '" value="' + esc(state.q) + '"></div></div>';

    var cards = shown.length ? '<div class="storefront-catalog">' + shown.map(function (p) {
      var out = p.stock <= 0;
      return '<article class="product-card"><div class="product-media"><img src="' + esc(DS.data.img(p.image)) + '" alt="' + esc(pname(p)) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'">' +
        '<div class="product-badges">' + (out ? '<span class="badge danger">' + esc(t('outOfStock')) + '</span>' : '') + '</div></div>' +
        '<div class="product-body"><div class="product-cat">' + esc(DS.lang() === 'en' ? (p.category_en || p.category) : p.category) + '</div>' +
          '<div class="product-name">' + esc(pname(p)) + '</div>' +
          '<div class="product-price"><span class="p">' + money(p.price) + '</span></div>' +
          '<div class="product-meta"><span>★ ' + (p.rating || '4.8') + '</span><span>' + (out ? esc(t('outOfStock')) : esc(t('inStock'))) + '</span></div>' +
          '<div class="product-actions"><button class="btn btn-primary btn-sm" data-add="' + esc(p.id) + '"' + (out ? ' disabled' : '') + '>' + icon('cart') + '<span>' + esc(t('addToCart')) + '</span></button>' +
          '<button class="btn btn-secondary btn-icon" data-view="' + esc(p.id) + '" aria-label="view">' + icon('eye') + '</button></div></div></article>';
    }).join('') + '</div>' : DS.empty({ icon: 'search', title: t('noResults'), text: t('emptyProductsText') });

    page.setContent(previewNote + switcher + hero + rail + cards);

    DS.$$('[data-store]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-store');
        if (id === state.store) return;
        if (cart.items.length && cart.tenant_id && cart.tenant_id !== id) {
          DS.confirm({ title: t('cart'), text: DS.lang() === 'en' ? 'Switching stores will clear your current cart. Continue?' : 'تبديل المتجر سيفرغ سلتك الحالية. هل تريد المتابعة؟' }).then(function (ok) {
            if (!ok) return;
            cart = { tenant_id: null, items: [] }; saveCart();
            state.store = id; state.cat = ''; state.q = '';
            DS.store.set('ds_customer_store', id);
            render(); renderCart();
          });
          return;
        }
        state.store = id; state.cat = ''; state.q = '';
        DS.store.set('ds_customer_store', id);
        render(); renderCart();
      });
    });
    DS.$$('[data-cat]', page.body).forEach(function (b) { b.addEventListener('click', function () { state.cat = b.getAttribute('data-cat'); render(); }); });
    var qEl = page.body.querySelector('[data-q]');
    if (qEl) qEl.addEventListener('input', DS.debounce(function () { state.q = qEl.value; render(); }, 160));
    DS.$$('[data-add]', page.body).forEach(function (b) { b.addEventListener('click', function () { addToCart(b.getAttribute('data-add')); }); });
    DS.$$('[data-view]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = list.filter(function (x) { return x.id === b.getAttribute('data-view'); })[0];
        if (!p) return;
        DS.modal({
          title: pname(p),
          sub: (DS.lang() === 'en' ? (p.category_en || p.category) : p.category) + ' · ★ ' + (p.rating || '4.8'),
          body: '<img src="' + esc(DS.data.img(p.image)) + '" alt="" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-lg);background:var(--surface-2)">' +
            '<div class="product-price" style="margin-top:12px"><span class="p">' + money(p.price) + '</span></div>' +
            '<p style="font-size:13px;color:var(--text-secondary);line-height:1.7;margin-top:8px">' + esc(DS.lang() === 'en' ? 'Fresh from ' + store.name + '. Delivered in about 30 minutes.' : 'من ' + store.name + ' مباشرة. يصلك في حوالي 30 دقيقة.') + '</p>',
          actions: [
            { label: t('close'), variant: 'btn-secondary' },
            { label: t('addToCart'), variant: 'btn-primary', icon: icon('cart'), onClick: function () { addToCart(p.id); } }
          ]
        });
      });
    });
    renderCart();
  }

  /* Drawer + floating cart injected once */
  function mountCart() {
    if (document.querySelector('[data-cart-drawer]')) return;
    var drawer = document.createElement('div');
    drawer.className = 'cart-drawer';
    drawer.setAttribute('data-cart-drawer', '');
    drawer.innerHTML = '<div class="cart-drawer-head"><div class="section-title">' + icon('cart') + esc(t('cart')) + ' <span class="badge lime" data-cart-count>0</span></div>' +
      '<button class="btn btn-ghost btn-sm" data-close-cart style="color:var(--text-tertiary)">' + icon('x') + '</button></div>' +
      '<div class="cart-drawer-body" data-cart-lines></div><div class="cart-drawer-foot" data-cart-foot></div>';
    var scrim = document.createElement('div');
    scrim.className = 'drawer-scrim';
    scrim.setAttribute('data-cart-scrim', '');
    var floating = document.createElement('button');
    floating.className = 'floating-cart';
    floating.setAttribute('data-floating-cart', '');
    floating.innerHTML = '<span style="display:flex;align-items:center;gap:8px">' + icon('cart') + '<span class="count">0</span></span><span data-fc-total>0</span>';
    document.body.appendChild(drawer);
    document.body.appendChild(scrim);
    document.body.appendChild(floating);

    drawer.querySelector('[data-close-cart]').addEventListener('click', closeDrawer);
    scrim.addEventListener('click', closeDrawer);
    floating.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openCartModal();
    });
    page.root.addEventListener('click', function (event) {
      var trigger = event.target.closest ? event.target.closest('[data-open-cart]') : null;
      if (!trigger) return;
      event.preventDefault();
      openDrawer();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeDrawer();
    });
    /* language pill uses the global delegated handler (shared/js/i18n.js) */
  }

  mountCart();
  render();
})();
