/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — Customer storefront
   Premium Apple/Noon-style shopping experience:
   glass hero · store switcher · category rail · product grid
   compact floating bag pill · glass bag modal · pill toasts.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  var preview = user.role !== 'customer';
  var EN = DS.lang() === 'en';

  /* Curated free stock imagery (Unsplash direct CDN). Local art is used as
     an instant fallback so the hero never shows an empty frame. */
  var HERO = {
    caznova: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1800&q=80',
    smozy: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=1800&q=80',
    bnsheikh: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1800&q=80',
    mastore: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=1800&q=80'
  };

  var page = DS.shell.mount({
    roles: null,
    active: 'storefront',
    title: t('storefront'),
    eyebrow: preview ? t('admin') : t('store'),
    icon: 'store',
    sub: EN ? 'Curated stores, delivered in minutes.' : 'متاجر مختارة بعناية، تصلك في دقائق.',
    actions: '<button type="button" class="btn btn-secondary sf-topbag" data-open-cart>' +
      icon('bag') + '<span>' + esc(t('cart')) + '</span><span class="badge lime" data-cart-count>0</span></button>',
    content: DS.skeleton.grid(8)
  });
  if (!page) return;

  var params = new URLSearchParams(location.search);
  var state = { store: '', cat: '', q: '' };
  var cart = loadCart();

  /* ───────────────────────────── DATA ───────────────────────────── */
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
  function pname(p) { return EN ? (p.name_en || p.name) : p.name; }
  function pcat(p) { return EN ? (p.category_en || p.category) : p.category; }
  function heroArt(store) { return HERO[store.slug] || HERO[store.id.replace('t-', '')] || ''; }
  function fallbackArt(store) {
    var first = products(store)[0];
    return first ? DS.data.img(first.image) : url('assets/img/LOGO-WHAIT.png');
  }

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
  function deliveryFee() { var s = currentStore(); return s ? (Number(s.delivery_fee) || 0) : 0; }

  function addToCart(id) {
    var store = currentStore();
    if (!store) return;
    var p = products(store).filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (cart.tenant_id && cart.tenant_id !== store.id && cart.items.length) {
      DS.confirm({
        title: t('cart'),
        text: EN ? 'Your bag contains items from another store. Start a new bag for ' + store.name + '?'
          : 'سلتك تحتوي منتجات من متجر آخر. هل تريد بدء سلة جديدة لمتجر ' + store.name + '؟'
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
    else cart.items.push({
      id: p.id, name: p.name, name_en: p.name_en, price: Number(p.price) || 0,
      qty: 1, image: p.image, stock: p.stock, tenant_id: p.tenant_id
    });
    saveCart();
    renderCart();
    DS.pillToast(pname(p), {
      image: DS.data.img(p.image),
      sub: money(p.price) + ' · ' + t('addedToBag'),
      action: t('viewBag'),
      onAction: openBagModal
    });
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
    document.body.classList.toggle('sf-cart-on', count > 0);
    var pill = document.querySelector('[data-floating-cart]');
    if (pill) {
      pill.classList.toggle('is-on', count > 0);
      var c = pill.querySelector('[data-fc-count]');
      if (c) c.textContent = count;
      var tot = pill.querySelector('[data-fc-total]');
      if (tot) tot.textContent = money(cartTotal());
      var sub = pill.querySelector('[data-fc-sub]');
      if (sub) sub.textContent = count + ' ' + t('itemsInBag');
    }
  }

  function bagLinesMarkup() {
    if (!cart.items.length) {
      return '<div class="sf-bag-empty">' + icon('bag') +
        '<b>' + esc(t('emptyCart')) + '</b><span>' + esc(t('emptyCartText')) + '</span></div>';
    }
    return cart.items.map(function (l) {
      return '<div class="sf-bag-line">' +
        '<span class="sf-bl-media"><img src="' + esc(DS.data.img(l.image)) + '" alt=""></span>' +
        '<span class="sf-bl-info"><b>' + esc(EN ? (l.name_en || l.name) : l.name) + '</b>' +
          '<span>' + money(l.price) + '</span></span>' +
        '<span class="sf-qty">' +
          '<button type="button" data-mq-minus="' + esc(l.id) + '" aria-label="minus">' + icon('minus') + '</button>' +
          '<i>' + l.qty + '</i>' +
          '<button type="button" data-mq-plus="' + esc(l.id) + '" aria-label="plus">' + icon('plus') + '</button>' +
        '</span>' +
        '<span class="sf-bl-total">' + money(l.price * l.qty) + '</span>' +
        '<button type="button" class="sf-bl-remove" data-mq-remove="' + esc(l.id) + '" aria-label="remove">' + icon('x') + '</button>' +
      '</div>';
    }).join('');
  }

  function bagBodyMarkup() {
    var fee = deliveryFee();
    var total = cartTotal() + (cart.items.length ? fee : 0);
    if (!cart.items.length) return bagLinesMarkup();
    return '<div class="sf-bag-lines">' + bagLinesMarkup() + '</div>' +
      '<div class="sf-bag-sum">' +
        '<div class="sf-sum-row"><span>' + esc(t('subtotal')) + '</span><span>' + money(cartTotal()) + '</span></div>' +
        '<div class="sf-sum-row"><span>' + esc(t('delivery')) + '</span><span>' + money(fee) + '</span></div>' +
        '<div class="sf-sum-row total"><span>' + esc(t('total')) + '</span><b>' + money(total) + '</b></div>' +
      '</div>';
  }

  function bindBag(m) {
    var body = m.el.querySelector('.modal-body');
    if (!body) return;
    DS.$$('[data-mq-plus]', body).forEach(function (b) {
      b.addEventListener('click', function () { var l = lineOf(b.getAttribute('data-mq-plus')); if (l) { setQty(l.id, l.qty + 1); refreshBag(m); } });
    });
    DS.$$('[data-mq-minus]', body).forEach(function (b) {
      b.addEventListener('click', function () { var l = lineOf(b.getAttribute('data-mq-minus')); if (l) { setQty(l.id, l.qty - 1); refreshBag(m); } });
    });
    DS.$$('[data-mq-remove]', body).forEach(function (b) {
      b.addEventListener('click', function () { setQty(b.getAttribute('data-mq-remove'), 0); refreshBag(m); });
    });
  }

  function refreshBag(m) {
    var body = m.el.querySelector('.modal-body');
    if (!body) return;
    body.innerHTML = bagBodyMarkup();
    bindBag(m);
    var sub = m.el.querySelector('.modal-sub');
    if (sub) sub.innerHTML = esc(cartCount() + ' ' + t('itemsInBag')) + ' · ' + esc(money(cartTotal() + (cart.items.length ? deliveryFee() : 0)));
    var go = m.el.querySelector('[data-bag-go]');
    if (go) go.classList.toggle('is-off', !cart.items.length);
  }

  function openBagModal() {
    var m = DS.modal({
      title: icon('bag') + ' ' + esc(t('yourBag')),
      sub: esc(cartCount() + ' ' + t('itemsInBag')) + ' · ' + esc(money(cartTotal() + (cart.items.length ? deliveryFee() : 0))),
      body: bagBodyMarkup(),
      actions: [
        { label: t('keepShopping'), variant: 'btn-secondary' },
        {
          label: t('checkoutNow'), variant: 'btn-primary', icon: icon('arrowRight'),
          onClick: function () {
            if (!cart.items.length) return false;
            setTimeout(function () { location.href = url('customer/checkout.html'); }, 80);
          }
        }
      ]
    });
    m.el.classList.add('sf-modal-backdrop');
    var box = m.el.querySelector('.modal');
    if (box) box.classList.add('sf-modal');
    var go = m.el.querySelector('[data-action="1"]');
    if (go) {
      go.setAttribute('data-bag-go', '');
      if (!cart.items.length) go.classList.add('is-off');
    }
    bindBag(m);
  }

  /* ─────────────────────────── PRODUCT CARD ─────────────────────── */
  function cardMarkup(p) {
    var out = p.stock <= 0;
    var badge = '';
    if (out) badge = '<span class="sf-badge danger">' + esc(t('outOfStock')) + '</span>';
    else if ((p.sold || 0) >= 300) badge = '<span class="sf-badge lime">' + esc(t('bestSeller')) + '</span>';
    else if ((p.rating || 0) >= 4.9) badge = '<span class="sf-badge">' + esc(t('newArrival')) + '</span>';
    var inBag = lineOf(p.id);
    return '<article class="sf-card' + (out ? ' is-out' : '') + '">' +
      '<button type="button" class="sf-card-media" data-view="' + esc(p.id) + '" aria-label="' + esc(t('quickView')) + '">' +
        '<img src="' + esc(DS.data.img(p.image)) + '" alt="' + esc(pname(p)) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'">' +
        badge +
        '<span class="sf-quick">' + icon('eye') + '<i>' + esc(t('quickView')) + '</i></span>' +
      '</button>' +
      '<div class="sf-card-body">' +
        '<div class="sf-card-cat">' + esc(pcat(p)) + '</div>' +
        '<h3 class="sf-card-name">' + esc(pname(p)) + '</h3>' +
        '<div class="sf-card-meta"><span class="sf-star">' + icon('star') + (p.rating || '4.8') + '</span>' +
          '<span class="sf-dot"></span><span>' + esc(out ? t('outOfStock') : t('inStock')) + '</span></div>' +
        '<div class="sf-card-foot">' +
          '<span class="sf-price">' + money(p.price) + '</span>' +
          '<button type="button" class="sf-add' + (inBag ? ' in-bag' : '') + '" data-add="' + esc(p.id) + '"' + (out ? ' disabled' : '') +
            ' aria-label="' + esc(t('addToBag')) + '">' +
            (inBag ? '<b>' + inBag.qty + '</b>' : icon('plus')) +
          '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  /* ───────────────────────────── RENDER ─────────────────────────── */
  function filterProducts(store) {
    var q = state.q.trim().toLowerCase();
    return products(store).filter(function (p) {
      if (state.cat && DS.loc(p, 'category') !== state.cat) return false;
      if (!q) return true;
      return (p.name + ' ' + (p.name_en || '') + ' ' + (p.category_en || p.category || '')).toLowerCase().indexOf(q) > -1;
    });
  }

  function heroMarkup(store) {
    var list = products(store);
    var featured = list.slice().sort(function (a, b) { return (b.sold || 0) - (a.sold || 0); }).slice(0, 3);
    var art = heroArt(store);
    var cards = featured.map(function (p) {
      return '<button type="button" class="sf-float-card" data-view="' + esc(p.id) + '">' +
        '<img src="' + esc(DS.data.img(p.image)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'">' +
        '<span><b>' + esc(pname(p)) + '</b><i>' + money(p.price) + '</i></span></button>';
    }).join('');
    return '<section class="sf-hero">' +
      '<div class="sf-hero-bg">' +
        '<img src="' + esc(art) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(fallbackArt(store)) + '\'">' +
      '</div>' +
      '<div class="sf-hero-inner">' +
        '<div class="sf-hero-copy">' +
          '<span class="sf-kicker">' + icon('spark') + esc(t('storeHeroKicker')) + '</span>' +
          '<h1 class="sf-title">' + esc(DS.loc(store, 'name')) + '<span>.</span></h1>' +
          '<p class="sf-sub">' + esc(DS.loc(store, 'description')) + '</p>' +
          '<div class="sf-hero-cta">' +
            '<button type="button" class="btn btn-primary sf-cta" data-scroll-products>' + icon('bag') + esc(t('shopNow')) + '</button>' +
            '<a class="btn btn-secondary sf-cta" href="' + url('auth/public-chat.html?scope=stores') + '">' + icon('chat') + esc(t('chatDirectTitle')) + '</a>' +
          '</div>' +
          '<div class="sf-hero-meta">' +
            '<span class="sf-meta-pill">' + icon('star') + (store.rating || '4.8') + ' · ' + esc(t('storeRating')) + '</span>' +
            '<span class="sf-meta-pill">' + icon('clock') + esc(t('deliveryIn')) + ' 30–45 ' + esc(t('minutes')) + '</span>' +
            '<span class="sf-meta-pill">' + icon('truck') + esc(t('delivery')) + ' ' + money(store.delivery_fee) + '</span>' +
            '<span class="sf-meta-pill">' + icon('mapPin') + esc(DS.loc(store, 'address')) + '</span>' +
          '</div>' +
        '</div>' +
        (cards ? '<div class="sf-hero-cards">' + cards + '</div>' : '') +
      '</div>' +
    '</section>';
  }

  function storebarMarkup(store) {
    return '<div class="sf-storebar">' + catalog().map(function (tn) {
      return '<button type="button" class="sf-store-chip' + (tn.id === store.id ? ' active' : '') + '" data-store="' + esc(tn.id) + '">' +
        '<img src="' + esc(DS.avatarUrl(tn)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(url('assets/img/LOGO-WHAIT.png')) + '\'">' +
        '<span><b>' + esc(DS.loc(tn, 'name')) + '</b><i>' + esc(DS.loc(tn, 'industry')) + '</i></span>' +
        (tn.id === store.id ? '<em>' + icon('check') + '</em>' : '') +
      '</button>';
    }).join('') + '</div>';
  }

  function trustMarkup() {
    var items = [
      { icon: 'truck', title: t('freeDelivery'), text: t('freeDeliveryText') },
      { icon: 'shield', title: t('securePayment'), text: t('securePaymentText') },
      { icon: 'sparkles', title: t('qualityGuarantee'), text: t('qualityGuaranteeText') }
    ];
    return '<div class="sf-trust">' + items.map(function (it) {
      return '<div class="sf-trust-item"><span class="sf-trust-ico">' + icon(it.icon) + '</span>' +
        '<span><b>' + esc(it.title) + '</b><i>' + esc(it.text) + '</i></span></div>';
    }).join('') + '</div>';
  }

  function toolbarMarkup(store) {
    var cats = categories(store);
    return '<section class="sf-toolbar" id="sfCatalog">' +
      '<div class="sf-toolbar-head">' +
        '<div><div class="sf-eyebrow">' + icon('grid') + esc(t('shopByCategory')) + '</div>' +
          '<h2 class="sf-section-title">' + esc(t('featuredPicks')) + '</h2></div>' +
        '<div class="sf-search">' + icon('search') +
          '<input type="search" data-q placeholder="' + esc(t('searchInStore')) + '" value="' + esc(state.q) + '" aria-label="' + esc(t('search')) + '">' +
        '</div>' +
      '</div>' +
      '<div class="sf-rail">' +
        '<button type="button" class="sf-cat' + (!state.cat ? ' active' : '') + '" data-cat="">' + esc(t('allProducts')) + '</button>' +
        cats.map(function (c) {
          return '<button type="button" class="sf-cat' + (state.cat === c ? ' active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="sf-result-line"><span data-result-count></span></div>' +
      '<div class="sf-grid" data-grid></div>' +
    '</section>';
  }

  function render() {
    var store = currentStore();
    if (!store) { page.setContent(DS.empty({ icon: 'store', title: t('noData') })); return; }
    state.store = store.id;

    var note = preview ? '<div class="sf-preview-note">' +
      '<span class="badge lime">' + icon('eye') + ' ' + esc(EN ? 'Store preview' : 'معاينة المتجر') + '</span>' +
      '<span>' + esc(EN ? 'You are previewing the live storefront as ' + DS.loc(store, 'name') + '.' : 'أنت تعاين واجهة متجر ' + DS.loc(store, 'name') + ' الحية.') + '</span>' +
      '<a class="btn btn-secondary btn-sm" href="' + url('admin/stores.html') + '">' + icon('arrowLeft') + esc(t('back')) + '</a>' +
    '</div>' : '';

    page.setContent('<div class="sf-page">' + note + heroMarkup(store) + storebarMarkup(store) +
      trustMarkup() + toolbarMarkup(store) + '</div>');

    bindStatic();
    renderGrid();
    renderCart();
  }

  function bindStatic() {
    var body = page.body;
    DS.$$('[data-store]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-store');
        if (id === state.store) return;
        if (cart.items.length && cart.tenant_id && cart.tenant_id !== id) {
          DS.confirm({
            title: t('cart'),
            text: EN ? 'Switching stores will clear your current bag. Continue?' : 'تبديل المتجر سيفرغ سلتك الحالية. هل تريد المتابعة؟'
          }).then(function (ok) {
            if (!ok) return;
            cart = { tenant_id: null, items: [] }; saveCart();
            state.store = id; state.cat = ''; state.q = '';
            DS.store.set('ds_customer_store', id);
            render();
          });
          return;
        }
        state.store = id; state.cat = ''; state.q = '';
        DS.store.set('ds_customer_store', id);
        render();
      });
    });

    DS.$$('[data-cat]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        state.cat = b.getAttribute('data-cat');
        DS.$$('[data-cat]', body).forEach(function (x) { x.classList.toggle('active', x === b); });
        renderGrid();
      });
    });

    var qEl = body.querySelector('[data-q]');
    if (qEl) qEl.addEventListener('input', DS.debounce(function () {
      state.q = qEl.value;
      renderGrid();
    }, 150));

    var scrollBtn = body.querySelector('[data-scroll-products]');
    if (scrollBtn) scrollBtn.addEventListener('click', function () {
      var target = body.querySelector('#sfCatalog');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    DS.$$('[data-open-cart]').forEach(function (b) {
      if (b.getAttribute('data-bag-bound')) return;
      b.setAttribute('data-bag-bound', '1');
      b.addEventListener('click', openBagModal);
    });
  }

  function renderGrid() {
    var store = currentStore();
    if (!store) return;
    var host = page.body.querySelector('[data-grid]');
    if (!host) return;
    var shown = filterProducts(store);
    var countEl = page.body.querySelector('[data-result-count]');
    if (countEl) {
      countEl.innerHTML = state.q.trim()
        ? esc(t('resultsFor')) + ' <b>“' + esc(state.q.trim()) + '”</b> · ' + shown.length + ' ' + esc(t('item'))
        : '<b>' + shown.length + '</b> ' + esc(t('item')) + ' · ' + esc(t('delivered')) + ' 30–45 ' + esc(t('minutes'));
    }
    if (!shown.length) {
      host.innerHTML = DS.empty({ icon: 'search', title: t('noItems'), text: t('emptyProductsText') });
      return;
    }
    host.innerHTML = shown.map(cardMarkup).join('');
    DS.$$('[data-add]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        addToCart(b.getAttribute('data-add'));
        var card = b.closest('.sf-card');
        if (card) {
          card.classList.add('just-added');
          setTimeout(function () { card.classList.remove('just-added'); }, 520);
        }
        var line = lineOf(b.getAttribute('data-add'));
        if (line) {
          b.classList.add('in-bag');
          b.innerHTML = '<b>' + line.qty + '</b>';
        }
      });
    });
    DS.$$('[data-view]', host).forEach(function (b) {
      b.addEventListener('click', function () { quickView(store, b.getAttribute('data-view')); });
    });
  }

  function quickView(store, id) {
    var p = products(store).filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var out = p.stock <= 0;
    var m = DS.modal({
      title: esc(pname(p)),
      sub: esc(pcat(p)) + ' · ' + icon('star') + ' ' + (p.rating || '4.8'),
      body: '<div class="sf-qv">' +
        '<div class="sf-qv-media"><img src="' + esc(DS.data.img(p.image)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'"></div>' +
        '<div class="sf-qv-info">' +
          '<div class="sf-qv-price">' + money(p.price) + '</div>' +
          '<p>' + esc(EN
            ? 'Hand-picked by ' + DS.loc(store, 'name') + '. Delivered in about 30 minutes with live tracking.'
            : 'من ' + DS.loc(store, 'name') + ' مباشرة. يصلك في حوالي 30 دقيقة مع تتبع مباشر.') + '</p>' +
          '<div class="sf-qv-facts">' +
            '<span>' + icon('truck') + esc(t('delivery')) + ' ' + money(store.delivery_fee) + '</span>' +
            '<span>' + icon('shield') + esc(t('qualityGuarantee')) + '</span>' +
            '<span>' + icon('box') + esc(out ? t('outOfStock') : p.stock + ' ' + t('units')) + '</span>' +
          '</div>' +
        '</div></div>',
      actions: [
        { label: t('close'), variant: 'btn-secondary' },
        {
          label: t('addToBag'), variant: 'btn-primary', icon: icon('bag'), disabled: out,
          onClick: function () { addToCart(p.id); }
        }
      ]
    });
    m.el.classList.add('sf-modal-backdrop');
    var box = m.el.querySelector('.modal');
    if (box) box.classList.add('sf-modal');
  }

  /* ─────────────────────── FLOATING BAG PILL ─────────────────────── */
  function mountFloatingCart() {
    if (document.querySelector('[data-floating-cart]')) return;
    var pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'sf-float-cart';
    pill.setAttribute('data-floating-cart', '');
    pill.setAttribute('aria-label', t('viewBag'));
    pill.innerHTML = '<span class="sfc-ico">' + icon('bag') + '<i data-fc-count>0</i></span>' +
      '<span class="sfc-text"><b data-fc-total>0</b><small data-fc-sub></small></span>' +
      '<span class="sfc-go">' + esc(t('viewBag')) + icon('arrowRight') + '</span>';
    pill.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openBagModal();
    });
    document.body.appendChild(pill);
  }

  mountFloatingCart();
  render();
})();
