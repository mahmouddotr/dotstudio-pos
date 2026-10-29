/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — Customer storefront
   Unified mega catalog across every store on the platform:
   large glass hero · store directory · category groups · multi-vendor bag.
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
  var MARKET_HERO = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=80';

  var page = DS.shell.mount({
    roles: null,
    active: 'storefront',
    title: t('storefront'),
    eyebrow: preview ? t('admin') : t('store'),
    icon: 'store',
    sub: EN ? 'Every store, one bag, delivered in minutes.' : 'كل المتاجر في سلة واحدة، تصلك في دقائق.',
    actions: '<button type="button" class="btn btn-secondary sf-topbag" data-open-cart>' +
      icon('bag') + '<span>' + esc(t('cart')) + '</span><span class="badge lime" data-cart-count>0</span></button>',
    content: DS.skeleton.grid(8)
  });
  if (!page) return;

  var params = new URLSearchParams(location.search);
  var state = { store: params.get('store') || '', cat: '', q: '' };
  var cart = loadCart();

  /* ───────────────────────────── DATA ───────────────────────────── */
  function catalog() {
    return (DS.data.tenants || []).filter(function (tn) { return tn.status !== 'suspended'; });
  }
  function allProducts() {
    return (DS.data.products || []).filter(function (p) { return p.is_active !== false; });
  }
  function storeOf(p) { return DS.data.tenantById(p && p.tenant_id); }
  function storeOpen(tn) { return DS.data.isStoreOpen ? DS.data.isStoreOpen(tn) : true; }
  function storeHoursLabel(tn) {
    var h = DS.data.storeHours ? DS.data.storeHours(tn) : { open: '10:00', close: '22:00' };
    return h.open + ' – ' + h.close;
  }
  function productsOf(tnId) {
    return allProducts().filter(function (p) { return p.tenant_id === tnId; });
  }
  function pname(p) { return EN ? (p.name_en || p.name) : p.name; }
  function pcat(p) { return EN ? (p.category_en || p.category) : p.category; }
  function tname(tn) { return tn ? DS.loc(tn, 'name') : ''; }
  function heroArt(tn) { return HERO[tn.slug] || HERO[tn.id.replace('t-', '')] || MARKET_HERO; }
  function fallbackArt(tn) {
    var first = productsOf(tn.id)[0];
    return first ? DS.data.img(first.image) : url('assets/img/LOGO-WHAIT.png');
  }
  function imgOf(p) { return DS.data.img(p.image); }

  /* Small, standard 5-star SVG row — never a giant emoji star. */
  function starSvg(filled) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" class="sf-star-svg' + (filled ? ' is-on' : '') + '">' +
      '<path d="M12 2.6l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.68 6.1 20.77l1.13-6.57L2.45 9.54l6.6-.96L12 2.6z"/></svg>';
  }
  function starsMarkup(rating) {
    var r = Math.max(0, Math.min(5, Number(rating) || 0));
    var out = '';
    for (var i = 1; i <= 5; i++) out += starSvg(r >= i - 0.25);
    return '<span class="sf-stars-svg" aria-hidden="true">' + out + '</span>';
  }
  function ratingMarkup(rating, reviews) {
    var value = Number(rating) || 4.8;
    return '<span class="sf-rating">' + starsMarkup(value) + '<b>' + value.toFixed(1) + '</b>' +
      (reviews ? '<span class="sf-rating-count">(' + reviews + ')</span>' : '') + '</span>';
  }

  /* ───────────────────────────── CART ───────────────────────────── */
  function loadCart() {
    var raw = DS.store.get('ds_cart', null);
    if (raw && Array.isArray(raw.items)) {
      /* Migrate the old single-store shape: lines already carry tenant_id. */
      return { items: raw.items.filter(function (l) { return l && l.id; }) };
    }
    return { items: [] };
  }
  function saveCart() { DS.store.set('ds_cart', cart); }
  function cartCount() { return cart.items.reduce(function (s, l) { return s + l.qty; }, 0); }
  function cartTotal() { return cart.items.reduce(function (s, l) { return s + l.price * l.qty; }, 0); }
  function lineOf(id) { return cart.items.filter(function (l) { return l.id === id; })[0]; }

  function vendorIds() {
    var out = [];
    cart.items.forEach(function (l) { if (l.tenant_id && out.indexOf(l.tenant_id) === -1) out.push(l.tenant_id); });
    return out;
  }
  function vendorFee(tnId) {
    var tn = DS.data.tenantById(tnId);
    return tn ? (Number(tn.delivery_fee) || 0) : 0;
  }
  /* One delivery per vendor → the bag shows the sum of their fees. */
  function deliveryFee() {
    return vendorIds().reduce(function (s, id) { return s + vendorFee(id); }, 0);
  }
  function groups() {
    return vendorIds().map(function (id) {
      return {
        tenant: DS.data.tenantById(id),
        items: cart.items.filter(function (l) { return l.tenant_id === id; })
      };
    }).filter(function (g) { return g.tenant && g.items.length; });
  }
  function closedVendors() {
    return groups().filter(function (g) { return !storeOpen(g.tenant); }).map(function (g) { return tname(g.tenant); });
  }

  function addToCart(id) {
    var p = allProducts().filter(function (x) { return x.id === id; })[0];
    if (!p) return false;
    var tn = storeOf(p);
    if (!tn) return false;
    if (!storeOpen(tn)) {
      DS.toast(EN ? tname(tn) + ' is offline right now.' : 'متجر ' + tname(tn) + ' أوفلاين حالياً.', 'error');
      return false;
    }
    if ((Number(p.stock) || 0) <= 0) { DS.toast(t('outOfStock'), 'warning'); return false; }
    var line = lineOf(p.id);
    var wanted = line ? line.qty + 1 : 1;
    if (wanted > p.stock) { DS.toast(t('outOfStock'), 'warning'); return false; }
    if (line) line.qty = wanted;
    else cart.items.push({
      id: p.id, name: p.name, name_en: p.name_en, price: Number(p.price) || 0,
      qty: 1, image: p.image, stock: p.stock, tenant_id: p.tenant_id
    });
    saveCart();
    renderCart();
    DS.pillToast(pname(p), {
      image: imgOf(p),
      sub: money(p.price) + ' · ' + tname(tn) + ' · ' + t('addedToBag'),
      action: t('viewBag'),
      onAction: openBagModal
    });
    return true;
  }

  function setQty(id, qty) {
    var line = lineOf(id);
    if (!line) return;
    if (qty <= 0) cart.items = cart.items.filter(function (l) { return l.id !== id; });
    else if (qty > line.stock) { DS.toast(t('outOfStock'), 'warning'); return; }
    else line.qty = qty;
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
      if (tot) tot.textContent = money(cartTotal() + deliveryFee());
      var sub = pill.querySelector('[data-fc-sub]');
      if (sub) {
        var vendors = groups().length;
        sub.textContent = vendors > 1
          ? (EN ? count + ' items · ' + vendors + ' stores' : count + ' منتجات · ' + vendors + ' متاجر')
          : count + ' ' + t('itemsInBag');
      }
    }
    /* Refresh the add buttons so their "in bag" counters stay truthful. */
    DS.$$('[data-add]').forEach(function (b) {
      var line = lineOf(b.getAttribute('data-add'));
      b.classList.toggle('in-bag', !!line);
      if (!b.disabled) b.innerHTML = line ? '<b>' + line.qty + '</b>' : icon('plus');
    });
  }

  function bagLinesMarkup() {
    if (!cart.items.length) {
      return '<div class="sf-bag-empty">' + icon('bag') +
        '<b>' + esc(t('emptyCart')) + '</b><span>' + esc(t('emptyCartText')) + '</span></div>';
    }
    return groups().map(function (g) {
      var open = storeOpen(g.tenant);
      return '<div class="sf-bag-group">' +
        '<div class="sf-bag-store">' +
          '<img src="' + esc(DS.avatarUrl(g.tenant)) + '" alt="">' +
          '<b>' + esc(tname(g.tenant)) + '</b>' +
          (open
            ? '<span class="sf-bag-hours">' + icon('clock') + esc(storeHoursLabel(g.tenant)) + '</span>'
            : '<span class="sf-bag-offline">' + esc(EN ? 'Offline' : 'أوفلاين') + '</span>') +
          '<span class="sf-bag-fee">' + esc(t('delivery')) + ' ' + money(vendorFee(g.tenant.id)) + '</span>' +
        '</div>' +
        g.items.map(function (l) {
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
        }).join('') +
      '</div>';
    }).join('');
  }

  function bagBodyMarkup() {
    if (!cart.items.length) return bagLinesMarkup();
    var fee = deliveryFee();
    var closed = closedVendors();
    return '<div class="sf-bag-lines">' + bagLinesMarkup() + '</div>' +
      (closed.length ? '<div class="sf-bag-warning">' + icon('alert') +
        '<span>' + esc(EN
          ? 'Offline store: ' + closed.join(', ') + '. Remove its items to check out.'
          : 'متجر أوفلاين: ' + closed.join('، ') + '. احذف منتجاته لإتمام الطلب.') + '</span></div>' : '') +
      '<div class="sf-bag-sum">' +
        '<div class="sf-sum-row"><span>' + esc(t('subtotal')) + '</span><span>' + money(cartTotal()) + '</span></div>' +
        '<div class="sf-sum-row"><span>' + esc(t('delivery')) + (groups().length > 1 ? ' (' + groups().length + ')' : '') + '</span><span>' + money(fee) + '</span></div>' +
        '<div class="sf-sum-row total"><span>' + esc(t('total')) + '</span><b>' + money(cartTotal() + fee) + '</b></div>' +
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

  function bagSubtitle() {
    var count = cartCount();
    var vendors = groups().length;
    var head = vendors > 1
      ? (EN ? count + ' items from ' + vendors + ' stores' : count + ' منتجات من ' + vendors + ' متاجر')
      : count + ' ' + t('itemsInBag');
    return esc(head) + ' · ' + esc(money(cartTotal() + deliveryFee()));
  }

  function refreshBag(m) {
    var body = m.el.querySelector('.modal-body');
    if (!body) return;
    body.innerHTML = bagBodyMarkup();
    bindBag(m);
    var sub = m.el.querySelector('.modal-sub');
    if (sub) sub.innerHTML = bagSubtitle();
    var go = m.el.querySelector('[data-bag-go]');
    if (go) {
      var blocked = !cart.items.length || closedVendors().length > 0;
      go.classList.toggle('is-off', blocked);
      go.setAttribute('aria-disabled', blocked ? 'true' : 'false');
    }
  }

  function openBagModal() {
    var m = DS.modal({
      title: icon('bag') + ' ' + esc(t('yourBag')),
      sub: bagSubtitle(),
      body: bagBodyMarkup(),
      actions: [
        { label: t('keepShopping'), variant: 'btn-secondary' },
        {
          label: t('checkoutNow'), variant: 'btn-primary', icon: icon('arrowRight'),
          onClick: function () {
            if (!cart.items.length) return false;
            var closed = closedVendors();
            if (closed.length) {
              DS.toast(EN ? closed.join(', ') + ' is offline — cannot check out.' : closed.join('، ') + ' أوفلاين — لا يمكن إتمام الطلب.', 'error');
              return false;
            }
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
      var blocked = !cart.items.length || closedVendors().length > 0;
      if (blocked) {
        go.classList.add('is-off');
        go.setAttribute('aria-disabled', 'true');
      }
    }
    bindBag(m);
  }

  /* ─────────────────────────── PRODUCT CARD ─────────────────────── */
  function cardMarkup(p) {
    var tn = storeOf(p);
    var offline = tn ? !storeOpen(tn) : true;
    var out = (Number(p.stock) || 0) <= 0;
    var badge = '';
    if (offline) badge = '<span class="sf-badge danger">' + esc(EN ? 'Offline' : 'أوفلاين') + '</span>';
    else if (out) badge = '<span class="sf-badge danger">' + esc(t('outOfStock')) + '</span>';
    else if ((p.sold || 0) >= 300) badge = '<span class="sf-badge lime">' + esc(t('bestSeller')) + '</span>';
    else if ((p.rating || 0) >= 4.9) badge = '<span class="sf-badge">' + esc(t('newArrival')) + '</span>';
    var inBag = lineOf(p.id);
    var disabled = offline || out;
    return '<article class="sf-card' + (disabled ? ' is-out' : '') + (offline ? ' is-offline' : '') + '">' +
      '<button type="button" class="sf-card-media" data-view="' + esc(p.id) + '" aria-label="' + esc(t('quickView')) + '">' +
        '<img src="' + esc(imgOf(p)) + '" alt="' + esc(pname(p)) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'">' +
        badge +
        '<span class="sf-quick">' + icon('eye') + '<i>' + esc(t('quickView')) + '</i></span>' +
      '</button>' +
      '<div class="sf-card-body">' +
        '<div class="sf-card-cat">' + esc(pcat(p)) + '</div>' +
        '<h3 class="sf-card-name">' + esc(pname(p)) + '</h3>' +
        '<a class="sf-card-store" href="#" data-store="' + esc(p.tenant_id) + '">' + icon('store') +
          '<span>' + esc(EN ? 'From ' : 'من متجر ') + '<b>' + esc(tname(tn)) + '</b></span></a>' +
        '<div class="sf-card-meta">' + ratingMarkup(p.rating || 4.8, p.reviews) +
          '<span class="sf-dot"></span><span>' + esc(offline ? (EN ? 'Offline' : 'أوفلاين') : out ? t('outOfStock') : t('inStock')) + '</span></div>' +
        '<div class="sf-card-foot">' +
          '<span class="sf-price">' + money(p.price) + '</span>' +
          '<button type="button" class="sf-add' + (inBag ? ' in-bag' : '') + '" data-add="' + esc(p.id) + '"' + (disabled ? ' disabled' : '') +
            ' aria-label="' + esc(t('addToBag')) + '" title="' + esc(offline ? (EN ? 'Store is offline' : 'المتجر أوفلاين الآن') : t('addToBag')) + '">' +
            (inBag ? '<b>' + inBag.qty + '</b>' : icon('plus')) +
          '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  /* ───────────────────────────── RENDER ─────────────────────────── */
  function catalogProducts() {
    var list = allProducts();
    if (state.store) list = list.filter(function (p) { return p.tenant_id === state.store; });
    return list;
  }
  function filterProducts() {
    var q = state.q.trim().toLowerCase();
    return catalogProducts().filter(function (p) {
      if (state.cat && DS.loc(p, 'category') !== state.cat) return false;
      if (!q) return true;
      var tn = storeOf(p);
      var hay = p.name + ' ' + (p.name_en || '') + ' ' + (p.category_en || p.category || '') + ' ' + (tn ? (tn.name + ' ' + (tn.name_en || '')) : '');
      return hay.toLowerCase().indexOf(q) > -1;
    });
  }
  function categories() {
    var out = [];
    catalogProducts().forEach(function (p) {
      var c = DS.loc(p, 'category');
      if (out.indexOf(c) === -1) out.push(c);
    });
    return out;
  }
  function heroMarkup() {
    var tn = state.store ? DS.data.tenantById(state.store) : null;
    var list = catalogProducts();
    var featured = list.slice().sort(function (a, b) { return (b.sold || 0) - (a.sold || 0); }).slice(0, 3);
    var art = tn ? heroArt(tn) : MARKET_HERO;
    var fallback = tn ? fallbackArt(tn) : url('assets/img/LOGO-WHAIT.png');
    var offline = tn ? !storeOpen(tn) : false;
    var cards = featured.map(function (p) {
      return '<button type="button" class="sf-float-card" data-view="' + esc(p.id) + '">' +
        '<img src="' + esc(imgOf(p)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'">' +
        '<span><b>' + esc(pname(p)) + '</b><i>' + money(p.price) + '</i></span></button>';
    }).join('');
    var meta = tn
      ? '<span class="sf-meta-pill">' + icon('star') + (tn.rating || '4.8') + ' · ' + esc(t('storeRating')) + '</span>' +
        '<span class="sf-meta-pill">' + icon('clock') + esc(storeHoursLabel(tn)) + '</span>' +
        '<span class="sf-meta-pill">' + icon('truck') + esc(t('delivery')) + ' ' + money(tn.delivery_fee) + '</span>' +
        '<span class="sf-meta-pill">' + icon('mapPin') + esc(DS.loc(tn, 'address')) + '</span>'
      : '<span class="sf-meta-pill">' + icon('store') + catalog().length + ' ' + esc(EN ? 'stores' : 'متاجر') + '</span>' +
        '<span class="sf-meta-pill">' + icon('box') + allProducts().length + ' ' + esc(EN ? 'products' : 'منتج') + '</span>' +
        '<span class="sf-meta-pill">' + icon('clock') + esc(EN ? 'Delivered in 30–45 min' : 'التوصيل في 30–45 دقيقة') + '</span>' +
        '<span class="sf-meta-pill">' + icon('shield') + esc(t('securePayment')) + '</span>';
    return '<section class="sf-hero sf-hero-mega' + (offline ? ' is-offline' : '') + '">' +
      '<div class="sf-hero-bg">' +
        '<img src="' + esc(art) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(fallback) + '\'">' +
      '</div>' +
      '<div class="sf-hero-inner">' +
        '<div class="sf-hero-copy">' +
          '<span class="sf-kicker">' + icon('spark') +
            esc(tn ? t('storeHeroKicker') : (EN ? 'One marketplace · every store' : 'سوق واحد · كل المتاجر')) + '</span>' +
          '<h1 class="sf-title">' + esc(tn ? tname(tn) : (EN ? 'All your stores' : 'كل متاجرك')) + '<span>.</span></h1>' +
          '<p class="sf-sub">' + esc(tn ? DS.loc(tn, 'description')
            : (EN ? 'Browse every product from every store in one place — one bag, one checkout, live tracking.'
              : 'تصفح كل منتجات كل المتاجر في مكان واحد — سلة واحدة، دفع واحد، وتتبع لحظي.')) + '</p>' +
          (offline ? '<div class="sf-offline-note">' + icon('alert') +
            '<span>' + esc(EN ? 'This store is offline now. Ordering is disabled until it reopens.' : 'هذا المتجر أوفلاين الآن. الطلب متوقف حتى إعادة الفتح.') + '</span></div>' : '') +
          '<div class="sf-hero-cta">' +
            '<button type="button" class="btn btn-primary sf-cta" data-scroll-products>' + icon('bag') + esc(t('shopNow')) + '</button>' +
            '<a class="btn btn-secondary sf-cta" href="' + url('auth/public-chat.html?scope=stores') + '">' + icon('chat') + esc(t('chatDirectTitle')) + '</a>' +
          '</div>' +
          '<div class="sf-hero-meta">' + meta + '</div>' +
        '</div>' +
        (cards ? '<div class="sf-hero-cards">' + cards + '</div>' : '') +
      '</div>' +
    '</section>';
  }

  function storeDirectoryMarkup() {
    var tenants = catalog();
    var allActive = !state.store;
    var allCard = '<button type="button" class="sf-store-card sf-store-all' + (allActive ? ' active' : '') + '" data-store="">' +
      '<span class="sf-store-logo sf-store-logo-all">' + icon('grid') + '</span>' +
      '<span class="sf-store-copy"><b>' + esc(EN ? 'All stores' : 'كل المتاجر') + '</b>' +
        '<i>' + allProducts().length + ' ' + esc(EN ? 'products' : 'منتج') + ' · ' + tenants.length + ' ' + esc(EN ? 'stores' : 'متاجر') + '</i>' +
        '<span class="sf-store-hours">' + icon('clock') + esc(EN ? 'Unified catalog' : 'كتالوج موحّد') + '</span></span>' +
      (allActive ? '<em>' + icon('check') + '</em>' : '') + '</button>';
    return '<div class="sf-store-directory">' + allCard + tenants.map(function (tn) {
      var open = storeOpen(tn);
      var count = productsOf(tn.id).length;
      return '<button type="button" class="sf-store-card' + (tn.id === state.store ? ' active' : '') + (open ? '' : ' is-offline') + '" data-store="' + esc(tn.id) + '">' +
        '<img class="sf-store-logo" src="' + esc(DS.avatarUrl(tn)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(url('assets/img/LOGO-WHAIT.png')) + '\'">' +
        '<span class="sf-store-copy"><b>' + esc(tname(tn)) + '</b>' +
          '<i>' + esc(DS.loc(tn, 'industry')) + ' · ' + count + ' ' + esc(EN ? 'products' : 'منتج') + '</i>' +
          '<span class="sf-store-hours">' + icon('clock') + esc(storeHoursLabel(tn)) + '</span></span>' +
        (open
          ? '<span class="sf-store-open">' + esc(EN ? 'Open' : 'متاح') + '</span>'
          : '<span class="sf-store-offline">' + esc(EN ? 'Offline' : 'أوفلاين') + '</span>') +
        (tn.id === state.store ? '<em>' + icon('check') + '</em>' : '') +
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

  function toolbarMarkup() {
    var cats = categories();
    return '<section class="sf-toolbar" id="sfCatalog">' +
      '<div class="sf-toolbar-head">' +
        '<div><div class="sf-eyebrow">' + icon('grid') + esc(t('shopByCategory')) + '</div>' +
          '<h2 class="sf-section-title">' + esc(state.store ? (EN ? 'Store catalog' : 'كتالوج المتجر') : (EN ? 'The full catalog' : 'الكتالوج الكامل')) + '</h2></div>' +
        '<div class="sf-search">' + icon('search') +
          '<input type="search" data-q placeholder="' + esc(EN ? 'Search every store…' : 'ابحث في كل المتاجر…') + '" value="' + esc(state.q) + '" aria-label="' + esc(t('search')) + '">' +
        '</div>' +
      '</div>' +
      '<div class="sf-rail">' +
        '<button type="button" class="sf-cat' + (!state.cat ? ' active' : '') + '" data-cat="">' + esc(t('allProducts')) + '</button>' +
        cats.map(function (c) {
          return '<button type="button" class="sf-cat' + (state.cat === c ? ' active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="sf-result-line"><span data-result-count></span></div>' +
      '<div class="sf-groups" data-grid></div>' +
    '</section>';
  }

  function render() {
    if (state.store && !DS.data.tenantById(state.store)) state.store = '';
    var note = preview ? '<div class="sf-preview-note">' +
      '<span class="badge lime">' + icon('eye') + ' ' + esc(EN ? 'Store preview' : 'معاينة المتجر') + '</span>' +
      '<span>' + esc(EN ? 'You are previewing the live storefront as ' + (state.store ? tname(DS.data.tenantById(state.store)) : 'customer') + '.'
        : 'أنت تعاين واجهة المتجر الحية باسم ' + (state.store ? tname(DS.data.tenantById(state.store)) : 'العميل') + '.') + '</span>' +
      '<a class="btn btn-secondary btn-sm" href="' + url('admin/stores.html') + '">' + icon('arrowLeft') + esc(t('back')) + '</a>' +
    '</div>' : '';

    page.setContent('<div class="sf-page">' + note + heroMarkup() + storeDirectoryMarkup() +
      trustMarkup() + toolbarMarkup() + '</div>');

    bindStatic();
    renderGrid();
    renderCart();
  }

  function bindStatic() {
    var body = page.body;
    /* Hero floating product cards open the same quick view as the grid. */
    DS.$$('.sf-float-card[data-view]', body).forEach(function (b) {
      b.addEventListener('click', function () { quickView(b.getAttribute('data-view')); });
    });
    DS.$$('[data-store]', body).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var id = b.getAttribute('data-store');
        if (id === state.store) return;
        /* Multi-vendor bag: switching stores never clears the cart. */
        state.store = id;
        state.cat = '';
        if (id) DS.store.set('ds_customer_store', id);
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
    var host = page.body.querySelector('[data-grid]');
    if (!host) return;
    var shown = filterProducts();
    var vendors = [];
    shown.forEach(function (p) { if (vendors.indexOf(p.tenant_id) === -1) vendors.push(p.tenant_id); });

    var countEl = page.body.querySelector('[data-result-count]');
    if (countEl) {
      countEl.innerHTML = state.q.trim()
        ? esc(t('resultsFor')) + ' <b>“' + esc(state.q.trim()) + '”</b> · ' + shown.length + ' ' + esc(t('item'))
        : '<b>' + shown.length + '</b> ' + esc(t('item')) + ' · <b>' + vendors.length + '</b> ' +
          esc(EN ? 'stores' : 'متاجر') + ' · ' + esc(EN ? 'delivered in 30–45 min' : 'توصيل في 30–45 دقيقة');
    }
    if (!shown.length) {
      host.innerHTML = DS.empty({ icon: 'search', title: t('noItems'), text: t('emptyProductsText') });
      return;
    }

    /* ONE flat grid — every card lives in the same container so the layout is a
       real multi-column grid. Grouping by category previously produced one
       single-card grid per category, which read as a vertical stack. */
    host.innerHTML = '<div class="sf-grid" id="products-grid" data-products-grid>' +
      shown.map(cardMarkup).join('') +
    '</div>';

    DS.$$('[data-add]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        var ok = addToCart(b.getAttribute('data-add'));
        if (!ok) return;
        var card = b.closest('.sf-card');
        if (card) {
          card.classList.add('just-added');
          setTimeout(function () { card.classList.remove('just-added'); }, 520);
        }
      });
    });
    DS.$$('[data-view]', host).forEach(function (b) {
      b.addEventListener('click', function () { quickView(b.getAttribute('data-view')); });
    });
    DS.$$('.sf-card-store', host).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        state.store = b.getAttribute('data-store');
        state.cat = '';
        render();
      });
    });
  }

  function quickView(id) {
    var p = allProducts().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var tn = storeOf(p);
    var offline = tn ? !storeOpen(tn) : true;
    var out = (Number(p.stock) || 0) <= 0;
    var m = DS.modal({
      title: esc(pname(p)),
      sub: esc(pcat(p)),
      body: '<div class="sf-qv">' +
        '<div class="sf-qv-media"><img src="' + esc(imgOf(p)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'"></div>' +
        '<div class="sf-qv-info">' +
          '<div class="sf-qv-rating-line">' + ratingMarkup(p.rating || 4.8, p.reviews) +
            '<span class="sf-qv-sep">·</span>' +
            '<span class="sf-qv-stock' + (offline || out ? ' is-off' : '') + '">' +
              esc(offline ? (EN ? 'Store offline' : 'المتجر أوفلاين') : out ? t('outOfStock') : t('inStock')) +
            '</span>' +
          '</div>' +
          '<a class="sf-qv-store" href="#" data-qv-store="' + esc(p.tenant_id) + '">' + icon('store') +
            '<span>' + esc(EN ? 'From ' : 'من متجر ') + '<b>' + esc(tname(tn)) + '</b></span></a>' +
          '<div class="sf-qv-price">' + money(p.price) + '</div>' +
          '<p>' + esc(EN
            ? 'Hand-picked by ' + tname(tn) + '. Delivered in about 30 minutes with live tracking.'
            : 'من متجر ' + tname(tn) + ' مباشرة. يصلك في حوالي 30 دقيقة مع تتبع مباشر.') + '</p>' +
          '<div class="sf-qv-facts">' +
            '<span>' + icon('truck') + esc(t('delivery')) + ' ' + money(tn ? tn.delivery_fee : 0) + '</span>' +
            '<span>' + icon('clock') + esc(tn ? storeHoursLabel(tn) : '') + '</span>' +
            '<span>' + icon('shield') + esc(t('qualityGuarantee')) + '</span>' +
            '<span>' + icon('box') + esc(out ? t('outOfStock') : p.stock + ' ' + t('units')) + '</span>' +
          '</div>' +
        '</div></div>',
      actions: [
        { label: t('close'), variant: 'btn-secondary' },
        {
          label: t('addToBag'), variant: 'btn-primary', icon: icon('bag'), disabled: out || offline,
          onClick: function () { addToCart(p.id); }
        }
      ]
    });
    m.el.classList.add('sf-modal-backdrop');
    var box = m.el.querySelector('.modal');
    if (box) box.classList.add('sf-modal');
    var storeLink = m.el.querySelector('[data-qv-store]');
    if (storeLink) storeLink.addEventListener('click', function (e) {
      e.preventDefault();
      m.close();
      state.store = p.tenant_id;
      state.cat = '';
      render();
    });
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

  /* ────────────────────── HARDWARE BARCODE SCANNER ────────────────────── */
  if (DS.mountBarcodeScanner) {
    DS.mountBarcodeScanner({
      getProducts: function () { return allProducts(); },
      onFound: function (p) {
        var tn = storeOf(p);
        if (tn && !storeOpen(tn)) {
          DS.toast(EN ? tname(tn) + ' is offline right now.' : 'متجر ' + tname(tn) + ' أوفلاين حالياً.', 'error');
          return;
        }
        addToCart(p.id);
        DS.toast(pname(p) + ' · ' + (EN ? 'scanned' : 'تم المسح'), 'success');
      },
      onNotFound: function () {
        DS.toast(EN ? 'Barcode not found' : 'الباركود غير موجود', 'danger');
      }
    });
  }
})();
