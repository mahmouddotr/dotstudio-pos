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

  /* ── Premium hero slider ──────────────────────────────────────────
     Five curated editorial frames (Tech · Home · Beauty · Fashion ·
     Bestsellers). Every frame owns its own caption on the left 38% of
     the canvas; the whole frame cross-fades every 5 seconds.
     ───────────────────────────────────────────────────────────────── */
  var HERO_SLIDES = [
    {
      src: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=1920&auto=format&fit=crop',
      label: 'التقنية', labelEn: 'Tech',
      title: 'أحدث التقنية', titleEn: 'Next-gen tech',
      sub: 'أجهزة وإلكترونيات مختارة بعناية — بأفضل الأسعار وتوصيل سريع لباب البيت.',
      subEn: 'Hand-picked devices and electronics — best prices, delivered to your door.'
    },
    {
      src: 'https://images.unsplash.com/photo-1558002038-1055907df827?q=80&w=1920&auto=format&fit=crop',
      label: 'المنزل الذكي', labelEn: 'Smart home',
      title: 'بيت أذكى', titleEn: 'A smarter home',
      sub: 'كل ما يجعل منزلك أسهل وأجمل — من الإضاءة الذكية إلى أدوات المطبخ.',
      subEn: 'Everything that makes home easier and nicer — smart lighting to kitchen gear.'
    },
    {
      src: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=1920&auto=format&fit=crop',
      label: 'الجمال', labelEn: 'Beauty',
      title: 'جمالك أولاً', titleEn: 'Beauty, first',
      sub: 'روتين عناية وعطور أصلية من أفضل الماركات — لأنك تستحقين الأفضل.',
      subEn: 'Authentic skincare and fragrance from top brands — because you deserve it.'
    },
    {
      src: 'https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=1920&auto=format&fit=crop',
      label: 'الموضة', labelEn: 'Fashion',
      title: 'الموضة الجديدة', titleEn: 'New-season fashion',
      sub: 'إطلالات هذا الموسم بقطع محدودة — اختَر ستايلك قبل أن ينفد.',
      subEn: 'This season’s looks in limited pieces — pick your style before it sells out.'
    },
    {
      src: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1920&auto=format&fit=crop',
      label: 'الأكثر مبيعاً', labelEn: 'Bestsellers',
      title: 'الأكثر مبيعاً', titleEn: 'Bestsellers',
      sub: 'المنتجات التي اخترتموها أكثر من غيرها — جاهزة للشحن الآن.',
      subEn: 'The products everyone keeps coming back for — ready to ship right now.'
    }
  ];
  var HERO_SLIDE_MS = 5000;
  var heroTimer = null;

  /* ── A/B hero experiment ─────────────────────────────────────────
     First-time visitors are bucketed once (50/50) into variant A or B
     and the choice is remembered on the device, so the storefront can
     measure which editorial frame set converts better. Variant B uses
     a different order and a couple of alternate frames.            */
  var HERO_SLIDES_B = [
    HERO_SLIDES[4],
    HERO_SLIDES[2],
    {
      src: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1920&auto=format&fit=crop',
      label: 'تسوّق اليوم', labelEn: 'Shop today',
      title: 'كل ما تحبينه', titleEn: 'Everything you love',
      sub: 'مختارات جديدة كل يوم من متاجرك المفضلة — بضغطة واحدة.',
      subEn: 'Fresh picks every day from your favourite stores — one tap away.'
    },
    HERO_SLIDES[0],
    HERO_SLIDES[3]
  ];
  var heroVariant = (function () {
    var v = null;
    try { v = localStorage.getItem('ds_ab_hero'); } catch (e) {}
    if (v !== 'a' && v !== 'b') {
      v = Math.random() < 0.5 ? 'a' : 'b';
      try { localStorage.setItem('ds_ab_hero', v); } catch (e) {}
    }
    return v;
  })();
  var HERO_SLIDES_ACTIVE = heroVariant === 'b' ? HERO_SLIDES_B : HERO_SLIDES;

  document.body.classList.add('saleor-store');

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
  var state = { store: params.get('store') || '', cat: '', q: '', page: 1 };
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
    var st = DS.data.storeStatus ? DS.data.storeStatus(tn) : null;
    if (st && st.hoursLabel) return st.hoursLabel;
    var h = DS.data.storeHours ? DS.data.storeHours(tn) : { open: '10:00', close: '22:00' };
    return h.open + ' – ' + h.close;
  }

  /* ── Closed-store notice (opening hours) ─────────────────────────── */
  function closedStores() {
    return catalog().filter(function (tn) { return !storeOpen(tn); });
  }
  function closedBannerMarkup() {
    var list = closedStores();
    if (!list.length) return '';
    var names = list.map(function (tn) { return tname(tn); }).join('، ');
    var first = list[0];
    var st = DS.data.storeStatus ? DS.data.storeStatus(first) : null;
    var opensAt = st ? st.openLabel : (DS.data.nextOpenLabel ? DS.data.nextOpenLabel(first) : '10:00');
    var text = EN
      ? 'The store is closed right now. We open at ' + opensAt + '.'
      : 'المتجر مغلق حالياً. نفتح الساعة ' + opensAt + '.';
    if (list.length > 1) {
      text += EN
        ? ' Closed stores: ' + names + '.'
        : ' المتاجر المغلقة: ' + names + '.';
    }
    return '<div class="sf-closed-banner" role="status">' + icon('clock') +
      '<div><b>' + esc(EN ? 'Store closed' : 'المتجر مغلق') + '</b><span>' + esc(text) + '</span></div>' +
      '</div>';
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
  /* Live rating = seeded product score + every customer review. */
  function ratingInfo(p) {
    if (DS.data.ratingFor) {
      var r = DS.data.ratingFor(p.id);
      return { value: r.rating, count: r.count };
    }
    return { value: Number(p.rating) || 4.8, count: Number(p.review_count) || 0 };
  }
  function ratingOf(p) { return ratingMarkup(ratingInfo(p).value, ratingInfo(p).count || null); }
  function stockBadge(p) {
    var out = (Number(p.stock) || 0) <= 0;
    var low = !out && (Number(p.stock) || 0) <= (Number(p.min_stock) || 0);
    if (out) return '<span class="sf-badge danger">' + esc(t('outOfStock')) + '</span>';
    if (low) return '<span class="sf-badge warning">' + esc(EN ? 'Low stock · ' + p.stock : 'كمية محدودة · ' + p.stock) + '</span>';
    return '';
  }

  /* ───────────────────────────── CART ───────────────────────────── */
  function loadCart() {
    if (DS.cart) return DS.cart.read();
    var raw = DS.store.get('ds_cart', null);
    if (raw && Array.isArray(raw.items)) {
      /* Migrate the old single-store shape: lines already carry tenant_id. */
      return { items: raw.items.filter(function (l) { return l && l.id; }) };
    }
    return { items: [] };
  }
  /* Optimistic: the UI repaints first, storage catches up a beat later. */
  function saveCart() {
    if (DS.cart) { DS.cart.persist(cart); return; }
    DS.store.set('ds_cart', cart);
  }

  /* ── Promo code (applied in the bag, honoured at checkout) ─────── */
  function promoCode() {
    var raw = DS.store.get('ds_promo', '');
    return typeof raw === 'string' ? raw : '';
  }
  function promoState() {
    var code = promoCode();
    if (!code) return null;
    var check = DS.data.validateDiscount(code, cartTotal());
    return { code: code, check: check };
  }
  function promoAmount() {
    var p = promoState();
    return p && p.check && p.check.ok ? Number(p.check.amount) || 0 : 0;
  }
  /* Store-wide sale set by the admin — automatic, no code required. */
  function saleAmount() {
    return DS.data.storeSaleAmount ? DS.data.storeSaleAmount(cartTotal()) : 0;
  }
  function totalDiscount() { return Math.min(cartTotal(), promoAmount() + saleAmount()); }
  function promoMarkup() {
    var p = promoState();
    var applied = p && p.check && p.check.ok;
    var err = p && p.check && !p.check.ok
      ? (p.check.error === 'expired' ? (EN ? 'Code expired' : 'الكود منتهي')
        : p.check.error === 'used' ? (EN ? 'Code fully used' : 'تم استهلاك الكود')
        : p.check.error === 'min' ? (EN ? 'Minimum order not reached' : 'الحد الأدنى للطلب غير مكتمل')
        : (EN ? 'Invalid code' : 'كود غير صالح'))
      : '';
    return '<div class="sf-promo">' +
      '<div class="sf-promo-row">' +
        '<span class="sf-promo-ic">' + icon('card') + '</span>' +
        '<input class="sf-promo-input" data-promo-input maxlength="24" dir="ltr" placeholder="' + esc(EN ? 'Promo code' : 'كود الخصم') + '" value="' + esc(applied ? p.code : (p ? p.code : '')) + '">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-promo-apply>' + esc(applied ? (EN ? 'Update' : 'تحديث') : (EN ? 'Apply' : 'تطبيق')) + '</button>' +
        (applied ? '<button type="button" class="btn btn-ghost btn-sm" data-promo-remove aria-label="remove">' + icon('x') + '</button>' : '') +
      '</div>' +
      (applied
        ? '<div class="sf-promo-ok">' + icon('checkCircle') + esc(EN ? 'Code applied · −' + money(promoAmount()) : 'تم تطبيق الكود · خصم ' + money(promoAmount())) + '</div>'
        : (err ? '<div class="sf-promo-err">' + icon('alert') + esc(err) + '</div>' : '')) +
    '</div>';
  }
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
  /* Closed stores + the time they open again (for the checkout notice). */
  function closedVendorDetail() {
    var out = [];
    groups().forEach(function (g) {
      if (storeOpen(g.tenant)) return;
      var st = DS.data.storeStatus ? DS.data.storeStatus(g.tenant) : null;
      out.push({ name: tname(g.tenant), opensAt: st ? st.openLabel : '10:00' });
    });
    return out;
  }

  function addToCart(id) {
    var p = allProducts().filter(function (x) { return x.id === id; })[0];
    if (!p) return false;
    var tn = storeOf(p);
    if (!tn) return false;
    if (!storeOpen(tn)) {
      var st = DS.data.storeStatus ? DS.data.storeStatus(tn) : null;
      var opensAt = st ? st.openLabel : (DS.data.nextOpenLabel ? DS.data.nextOpenLabel(tn) : '10:00');
      DS.toast(EN
        ? tname(tn) + ' is closed right now — we open at ' + opensAt + '.'
        : 'متجر ' + tname(tn) + ' مغلق حالياً — نفتح الساعة ' + opensAt + '.', 'error');
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
          '<img src="' + esc(DS.avatarUrl(g.tenant)) + '" alt="" loading="lazy" decoding="async">' +
          '<b>' + esc(tname(g.tenant)) + '</b>' +
          (open
            ? '<span class="sf-bag-hours">' + icon('clock') + esc(storeHoursLabel(g.tenant)) + '</span>'
            : '<span class="sf-bag-offline">' + esc(EN ? 'Offline' : 'أوفلاين') + '</span>') +
          '<span class="sf-bag-fee">' + esc(t('delivery')) + ' ' + money(vendorFee(g.tenant.id)) + '</span>' +
        '</div>' +
        g.items.map(function (l) {
          return '<div class="sf-bag-line">' +
            '<span class="sf-bl-media"><img src="' + esc(DS.data.img(l.image)) + '" alt="" loading="lazy" decoding="async"></span>' +
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
    var closedDetail = closedVendorDetail();
    var vatBase = Math.max(0, cartTotal() - totalDiscount());
    var vat = DS.data.vatAmount ? DS.data.vatAmount(vatBase) : 0;
    var total = Math.max(0, cartTotal() + fee - totalDiscount() + vat);
    var closedText = closedDetail.map(function (c) {
      return EN ? (c.name + ' (opens at ' + c.opensAt + ')') : (c.name + ' (نفتح الساعة ' + c.opensAt + ')');
    }).join('، ');
    return '<div class="sf-bag-lines">' + bagLinesMarkup() + '</div>' +
      (closed.length ? '<div class="sf-bag-warning">' + icon('alert') +
        '<span>' + esc(EN
          ? 'The store is closed right now: ' + closedText + '. Remove its items to check out.'
          : 'المتجر مغلق حالياً: ' + closedText + '. احذف منتجاته لإتمام الطلب.') + '</span></div>' : '') +
      promoMarkup() +
      '<div class="sf-bag-sum">' +
        '<div class="sf-sum-row"><span>' + esc(t('subtotal')) + '</span><span>' + money(cartTotal()) + '</span></div>' +
        (saleAmount() ? '<div class="sf-sum-row" style="color:var(--success)"><span>⚡ ' + esc(EN ? 'Store sale' : (DS.data.storeSale().label || 'تخفيضات المتجر')) + '</span><span>− ' + money(saleAmount()) + '</span></div>' : '') +
        (promoAmount() ? '<div class="sf-sum-row" style="color:var(--success)"><span>' + esc(EN ? 'Discount' : 'الخصم') + ' · ' + esc(promoCode()) + '</span><span>− ' + money(promoAmount()) + '</span></div>' : '') +
        '<div class="sf-sum-row"><span>' + esc(t('delivery')) + (groups().length > 1 ? ' (' + groups().length + ')' : '') + '</span><span>' + money(fee) + '</span></div>' +
        '<div class="sf-sum-row vat"><span>' + esc(EN ? 'VAT' : 'ضريبة القيمة المضافة') + ' · ' + (DS.data.vatRate ? DS.data.vatRate() : 15) + '%</span><span>' + money(vat) + '</span></div>' +
        '<div class="sf-sum-row total"><span>' + esc(t('total')) + '</span><b>' + money(total) + '</b></div>' +
      '</div>';
  }

  function bindBag(m) {
    var body = m.el.querySelector('.modal-body');
    if (!body) return;
    var applyBtn = body.querySelector('[data-promo-apply]');
    if (applyBtn) applyBtn.addEventListener('click', function () {
      var input = body.querySelector('[data-promo-input]');
      var code = input ? input.value.trim().toUpperCase() : '';
      if (!code) { DS.store.set('ds_promo', ''); refreshBag(m); return; }
      var check = DS.data.validateDiscount(code, cartTotal());
      if (!check.ok) {
        DS.store.set('ds_promo', code);
        DS.toast(check.error === 'min'
          ? (EN ? 'Minimum order for this code is ' + money(check.min_order) : 'الحد الأدنى لهذا الكود ' + money(check.min_order))
          : (EN ? 'Invalid promo code' : 'كود الخصم غير صالح'), 'error');
      } else {
        DS.store.set('ds_promo', code);
        DS.toast(EN ? 'Promo applied · −' + money(check.amount) : 'تم تطبيق الخصم · −' + money(check.amount), 'success');
      }
      refreshBag(m);
    });
    var input = body.querySelector('[data-promo-input]');
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (applyBtn) applyBtn.click(); }
    });
    var removeBtn = body.querySelector('[data-promo-remove]');
    if (removeBtn) removeBtn.addEventListener('click', function () {
      DS.store.set('ds_promo', '');
      DS.toast(EN ? 'Promo removed' : 'تم إزالة الكود', 'info');
      refreshBag(m);
    });
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
    return esc(head) + ' · ' + esc(money(Math.max(0, cartTotal() + deliveryFee() - totalDiscount())));
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
            var closed = closedVendorDetail();
            if (closed.length) {
              DS.toast(EN
                ? 'The store is closed right now — we open at ' + closed[0].opensAt + '.'
                : 'المتجر مغلق حالياً — نفتح الساعة ' + closed[0].opensAt + '.', 'error');
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

  /* ── Saleor-style compare-at price ─────────────────────────────── */
  function comparePrice(p) {
    var price = Number(p.price) || 0;
    var cp = Number(p.compare_price || p.old_price || p.comparePrice || 0);
    if (cp > price) return cp;
    /* Demo merchandising: best sellers show a realistic "was" price. */
    if (p.best_seller) return Math.round(price * 1.18);
    return 0;
  }
  function priceMarkup(p) {
    var cp = comparePrice(p);
    if (!cp) return '<span class="sf-price">' + money(p.price) + '</span>';
    var pct = Math.max(1, Math.round((1 - (Number(p.price) || 0) / cp) * 100));
    return '<span class="sf-price-wrap">' +
      '<span class="sf-price">' + money(p.price) + '</span>' +
      '<s class="sf-price-old">' + money(cp) + '</s>' +
      '<span class="sf-off">−' + pct + '%</span>' +
    '</span>';
  }

  /* ─────────────── UNIFIED CUSTOMER HEADER ──────────────────────── */
  function headerMarkup() {
    return DS.shell.customerHeader('home', { search: true, q: state.q });
  }

  /* ─────────────────────────── PRODUCT CARD ─────────────────────── */
  function cardMarkup(p) {
    var tn = storeOf(p);
    var offline = tn ? !storeOpen(tn) : true;
    var out = (Number(p.stock) || 0) <= 0;
    var offBadge = offline ? '<span class="sf-badge danger">' + esc(EN ? 'Offline' : 'أوفلاين') + '</span>' : '';
    var badges = offBadge + stockBadge(p);
    if (!offline && !out) {
      if (p.best_seller) badges += '<span class="sf-badge lime">🔥 ' + esc(t('bestSeller')) + '</span>';
      else if (p.featured) badges += '<span class="sf-badge gold">⭐ ' + esc(EN ? 'Top rated' : 'الأعلى تقييماً') + '</span>';
    }
    var inBag = lineOf(p.id);
    var disabled = offline || out;
    var info = ratingInfo(p);
    return '<article class="sf-card' + (disabled ? ' is-out' : '') + (offline ? ' is-offline' : '') + '">' +
      '<button type="button" class="sf-card-media product-image-container" data-view="' + esc(p.id) + '" aria-label="' + esc(t('quickView')) + '">' +
        '<img src="' + esc(imgOf(p)) + '" alt="' + esc(pname(p)) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'">' +
        '<span class="sf-badge-stack">' + badges + '</span>' +
        '<span class="sf-quick">' + icon('eye') + '<i>' + esc(t('quickView')) + '</i></span>' +
      '</button>' +
      '<div class="sf-card-body">' +
        '<div class="sf-card-cat">' + esc(pcat(p)) + '</div>' +
        '<h3 class="sf-card-name">' + esc(pname(p)) + '</h3>' +
        '<a class="sf-card-store" href="#" data-store="' + esc(p.tenant_id) + '">' + icon('store') +
          '<span>' + esc(EN ? 'From ' : 'من متجر ') + '<b>' + esc(tname(tn)) + '</b></span></a>' +
        '<div class="sf-card-meta">' + ratingMarkup(info.value, info.count || null) +
          '<span class="sf-dot"></span><span>' + esc(offline ? (EN ? 'Offline' : 'أوفلاين') : out ? t('outOfStock') : t('inStock')) + '</span></div>' +
        '<div class="sf-card-foot">' +
          priceMarkup(p) +
          '<span class="sf-card-actions">' +
            '<button type="button" class="sf-share" data-share="' + esc(p.id) + '" aria-label="' + esc(EN ? 'Share on WhatsApp' : 'مشاركة على واتساب') + '" title="' + esc(EN ? 'Share on WhatsApp' : 'مشاركة على واتساب') + '">' + icon('whatsapp') + '</button>' +
            '<button type="button" class="sf-add' + (inBag ? ' in-bag' : '') + '" data-add="' + esc(p.id) + '"' + (disabled ? ' disabled' : '') +
              ' aria-label="' + esc(t('addToBag')) + '" title="' + esc(offline ? (EN ? 'Store is offline' : 'المتجر أوفلاين الآن') : t('addToBag')) + '">' +
              (inBag ? '<b>' + inBag.qty + '</b>' : icon('plus')) +
            '</button>' +
          '</span>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  /* Share a single product to WhatsApp (works on desktop + mobile). */
  function shareProduct(id) {
    var p = allProducts().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var tn = storeOf(p);
    var link = 'customer/storefront.html?store=' + encodeURIComponent(p.tenant_id || '');
    try {
      if (location.origin && location.origin !== 'null') {
        link = location.origin + location.pathname + '?store=' + encodeURIComponent(p.tenant_id || '');
      }
    } catch (e) {}
    var text = pname(p) + ' · ' + money(p.price) + ' — ' + tname(tn) + '\n' + link;
    var wa = 'https://wa.me/?text=' + encodeURIComponent(text);
    try { window.open(wa, '_blank', 'noopener'); }
    catch (e) { location.href = wa; }
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
  /* ─────────────────────────── HERO SLIDER ─────────────────────────── */
  function heroSliderMarkup(slides, fallback) {
    return '<div class="sf-hero-bg sf-hero-slider" data-hero-slider>' +
      slides.map(function (s, i) {
        return '<img class="sf-hero-slide' + (i === 0 ? ' is-active' : '') + '" src="' + esc(s.src) + '" alt="" ' +
          (i === 0 ? '' : 'loading="lazy" ') + 'decoding="async" ' +
          'onerror="this.onerror=null;this.src=\'' + esc(fallback) + '\'">';
      }).join('') +
    '</div>';
  }
  function heroDotsMarkup(slides) {
    return '<div class="sf-hero-dots" role="tablist" aria-label="' + esc(EN ? 'Hero slides' : 'شرائح الواجهة') + '">' +
      slides.map(function (s, i) {
        return '<button type="button" class="sf-hero-dot' + (i === 0 ? ' is-active' : '') + '" data-hero-dot="' + i + '" ' +
          'role="tab" aria-selected="' + (i === 0 ? 'true' : 'false') + '" aria-label="' + esc(EN ? s.labelEn : s.label) + '"></button>';
      }).join('') +
    '</div>';
  }
  /* Per-frame caption — always anchored to the left 38% of the hero. */
  function heroPanelsMarkup(slides, offline, offlineText) {
    return '<div class="sf-hero-panels" data-hero-panels>' +
      slides.map(function (s, i) {
        return '<div class="sf-hero-panel' + (i === 0 ? ' is-active' : '') + '" data-hero-panel="' + i + '"' +
            (i === 0 ? '' : ' aria-hidden="true"') + '>' +
          '<span class="sf-hero-panel-kicker">' + icon('sparkles') + esc(EN ? s.labelEn : s.label) + '</span>' +
          '<h2 class="sf-hero-panel-title">' + esc(EN ? s.titleEn : s.title) + '</h2>' +
          '<p class="sf-hero-panel-sub">' + esc(EN ? s.subEn : s.sub) + '</p>' +
          (offline ? '<div class="sf-offline-note">' + icon('alert') + '<span>' + esc(offlineText) + '</span></div>' : '') +
          '<button type="button" class="sf-hero-shop" data-scroll-products' + (offline ? ' aria-disabled="true"' : '') + '>' +
            icon('bag') + '<span>' + esc(t('shopNow')) + '</span>' + icon(EN ? 'arrowRight' : 'arrowLeft') +
          '</button>' +
        '</div>';
      }).join('') +
    '</div>';
  }
  /* Warm the cache so every cross-fade is instant. */
  function preloadHeroSlides() {
    HERO_SLIDES_ACTIVE.forEach(function (s) { var im = new Image(); im.src = s.src; });
  }
  function initHeroSlider() {
    if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
    var root = document.querySelector('[data-hero-slider]');
    if (!root) return;
    var slides = DS.$$('.sf-hero-slide', root);
    if (slides.length < 2) return;
    var dots = DS.$$('[data-hero-dot]');
    var panels = DS.$$('[data-hero-panel]');
    var idx = 0;
    function go(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-active', k === idx); });
      panels.forEach(function (p, k) {
        p.classList.toggle('is-active', k === idx);
        if (k === idx) p.removeAttribute('aria-hidden');
        else p.setAttribute('aria-hidden', 'true');
      });
      dots.forEach(function (d, k) {
        d.classList.toggle('is-active', k === idx);
        d.setAttribute('aria-selected', k === idx ? 'true' : 'false');
      });
    }
    function restart() {
      if (heroTimer) clearInterval(heroTimer);
      heroTimer = setInterval(function () {
        if (document.hidden) return;
        go(idx + 1);
      }, HERO_SLIDE_MS);
    }
    dots.forEach(function (d) {
      d.addEventListener('click', function () {
        go(parseInt(d.getAttribute('data-hero-dot'), 10) || 0);
        restart();
      });
    });
    var hero = root.closest ? root.closest('.sf-hero') : null;
    if (hero) {
      hero.addEventListener('mouseenter', function () {
        if (heroTimer) { clearInterval(heroTimer); heroTimer = null; }
      });
      hero.addEventListener('mouseleave', restart);
    }
    restart();
  }

  function heroMarkup() {
    var tn = state.store ? DS.data.tenantById(state.store) : null;
    var catMode = !!state.cat;
    var list = catalogProducts();
    if (catMode) list = list.filter(function (p) { return DS.loc(p, 'category') === state.cat; });
    var featured = list.slice().sort(function (a, b) { return (b.sold || 0) - (a.sold || 0); }).slice(0, 3);
    var art, fallback, title, sub, kicker, meta, light;
    if (catMode) {
      light = true;
      art = (list[0] && imgOf(list[0])) || MARKET_HERO;
      fallback = url('assets/img/LOGO-WHAIT.png');
      title = state.cat;
      sub = EN ? (list.length + ' products in this category — hand-picked for you.') : (list.length + ' منتج في هذا القسم — مختار بعناية.');
      kicker = EN ? 'Category' : 'قسم';
      meta = '<span class="sf-meta-pill" style="background:rgba(0,0,0,0.06);border-color:rgba(0,0,0,0.12);color:#1d1d1f">' + icon('box') + list.length + ' ' + esc(EN ? 'products' : 'منتج') + '</span>' +
             '<span class="sf-meta-pill" style="background:rgba(0,0,0,0.06);border-color:rgba(0,0,0,0.12);color:#1d1d1f">' + icon('store') + (state.store ? esc(tname(tn)) : catalog().length + ' ' + esc(EN ? 'stores' : 'متاجر')) + '</span>';
    } else {
      light = false;
      art = tn ? heroArt(tn) : MARKET_HERO;
      fallback = tn ? fallbackArt(tn) : url('assets/img/LOGO-WHAIT.png');
      title = tn ? tname(tn) : (EN ? 'All your stores' : 'كل متاجرك');
      sub = tn ? DS.loc(tn, 'description') : (EN ? 'Browse every product from every store in one place — one bag, one checkout, live tracking.' : 'تصفح كل منتجات كل المتاجر في مكان واحد — سلة واحدة، دفع واحد، وتتبع لحظي.');
      kicker = tn ? t('storeHeroKicker') : (EN ? 'One marketplace · every store' : 'سوق واحد · كل المتاجر');
      meta = tn
        ? '<span class="sf-meta-pill">' + icon('star') + (tn.rating || '4.8') + ' · ' + esc(t('storeRating')) + '</span>' +
          '<span class="sf-meta-pill">' + icon('clock') + esc(storeHoursLabel(tn)) + '</span>' +
          '<span class="sf-meta-pill">' + icon('truck') + esc(t('delivery')) + ' ' + money(tn.delivery_fee) + '</span>' +
          '<span class="sf-meta-pill">' + icon('mapPin') + esc(DS.loc(tn, 'address')) + '</span>'
        : '<span class="sf-meta-pill">' + icon('store') + catalog().length + ' ' + esc(EN ? 'stores' : 'متاجر') + '</span>' +
          '<span class="sf-meta-pill">' + icon('box') + allProducts().length + ' ' + esc(EN ? 'products' : 'منتج') + '</span>' +
          '<span class="sf-meta-pill">' + icon('clock') + esc(EN ? 'Delivered in 30–45 min' : 'التوصيل في 30–45 دقيقة') + '</span>' +
          '<span class="sf-meta-pill">' + icon('shield') + esc(t('securePayment')) + '</span>';
    }
    var offline = tn ? !storeOpen(tn) : false;
    var heroStatus = tn && DS.data.storeStatus ? DS.data.storeStatus(tn) : null;
    var offlineText = EN
      ? (heroStatus && heroStatus.offline
        ? 'This store is offline now. Ordering is disabled until it reopens.'
        : 'The store is closed right now — we open at ' + (heroStatus ? heroStatus.openLabel : '10:00') + '.')
      : (heroStatus && heroStatus.offline
        ? 'هذا المتجر أوفلاين الآن. الطلب متوقف حتى إعادة الفتح.'
        : 'المتجر مغلق حالياً. نفتح الساعة ' + (heroStatus ? heroStatus.openLabel : '10:00') + '.');
    var cards = featured.map(function (p) {
      return '<button type="button" class="sf-float-card" data-view="' + esc(p.id) + '">' +
        '<img src="' + esc(imgOf(p)) + '" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'">' +
        '<span><b>' + esc(pname(p)) + '</b><i>' + money(p.price) + '</i></span></button>';
    }).join('');
    var sectionStyle = light ? ' style="background:#f5f5f7"' : '';
    var titleStyle = light ? ' style="color:#1d1d1f"' : '';
    var subStyle = light ? ' style="color:#515154"' : '';
    var kickerStyle = light ? ' style="background:rgba(0,0,0,0.06);border-color:rgba(0,0,0,0.12);color:#1d1d1f"' : '';

    /* ── Premium marketplace hero: five editorial frames, each with its
       own caption on the left 38% of the canvas. ─────────────────── */
    if (!light) {
      return '<section class="sf-hero sf-hero-mega sf-hero-premium' + (offline ? ' is-offline' : '') + '">' +
        heroSliderMarkup(HERO_SLIDES_ACTIVE, fallback) +
        heroPanelsMarkup(HERO_SLIDES_ACTIVE, offline, offlineText) +
        heroDotsMarkup(HERO_SLIDES_ACTIVE) +
      '</section>';
    }

    /* Category heroes keep the single light frame + static copy. */
    var bg = '<div class="sf-hero-bg">' +
          '<img src="' + esc(art) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(fallback) + '\'">' +
        '</div>';
    return '<section class="sf-hero sf-hero-mega' + (offline ? ' is-offline' : '') + '"' + sectionStyle + '>' +
      bg +
      '<div class="sf-hero-inner">' +
        '<div class="sf-hero-copy">' +
          '<span class="sf-kicker"' + kickerStyle + '>' + icon('spark') +
            esc(kicker) + '</span>' +
          '<h1 class="sf-title"' + titleStyle + '>' + esc(title) + '<span>.</span></h1>' +
          '<p class="sf-sub"' + subStyle + '>' + esc(sub) + '</p>' +
          (offline ? '<div class="sf-offline-note">' + icon('alert') +
            '<span>' + esc(offlineText) + '</span></div>' : '') +
          '<div class="sf-hero-cta">' +
            '<button type="button" class="btn btn-primary sf-cta" data-scroll-products>' + icon('bag') + esc(t('shopNow')) + '</button>' +
            '<a class="btn btn-secondary sf-cta' + (tn && offline ? ' is-off' : '') + '" href="' + url('auth/public-chat.html?scope=stores') + '"' + (tn && offline ? ' aria-disabled="true" data-chat-closed="1"' : '') + '>' + icon('chat') + esc(t('chatDirectTitle')) + '</a>' +
          '</div>' +
          '<div class="sf-hero-meta">' + meta + '</div>' +
        '</div>' +
        (cards ? '<div class="sf-hero-cards">' + cards + '</div>' : '') +
      '</div>' +
    '</section>';
  }

  /* ── Best Sellers + Top Rated rails ─────────────────────────────── */
  function railCard(p) {
    var info = ratingInfo(p);
    var out = (Number(p.stock) || 0) <= 0;
    return '<button type="button" class="sf-rail-card' + (out ? ' is-out' : '') + '" data-rail-view="' + esc(p.id) + '">' +
      '<span class="sf-rail-media"><img src="' + esc(imgOf(p)) + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'">' +
        (out ? '<span class="sf-badge danger">' + esc(t('outOfStock')) + '</span>' : '') + '</span>' +
      '<span class="sf-rail-name">' + esc(pname(p)) + '</span>' +
      '<span class="sf-rail-foot">' + ratingMarkup(info.value, info.count || null) + '<b>' + money(p.price) + '</b></span>' +
    '</button>';
  }
  function railsMarkup() {
    var list = catalogProducts();
    var best = list.filter(function (p) { return p.best_seller; });
    if (!best.length) best = list.slice().sort(function (a, b) { return (b.sold || 0) - (a.sold || 0); }).slice(0, 8);
    best = best.slice().sort(function (a, b) { return (b.sold || 0) - (a.sold || 0); }).slice(0, 8);
    var top = list.filter(function (p) { return p.featured; });
    if (!top.length) top = list.slice();
    top = top.slice().sort(function (a, b) { return ratingInfo(b).value - ratingInfo(a).value; }).slice(0, 8);
    if (!best.length && !top.length) return '';
    function rail(title, sub, iconName, items, cls) {
      if (!items.length) return '';
      return '<section class="sf-rail-section ' + cls + '">' +
        '<div class="sf-rail-head"><div><span class="sf-rail-kicker">' + icon(iconName) + '</span>' +
          '<h2>' + esc(title) + '</h2><p>' + esc(sub) + '</p></div>' +
          (state.store ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-rail-all="' + (cls === 'is-best' ? 'best' : 'top') + '">' + esc(EN ? 'View all' : 'عرض الكل') + icon('arrowLeft') + '</button>') +
        '</div>' +
        '<div class="sf-rail-scroll">' + items.map(railCard).join('') + '</div>' +
      '</section>';
    }
    return '<div class="sf-rails">' +
      rail(EN ? 'Best sellers' : 'الأكثر مبيعاً', EN ? '🔥 What everyone is ordering right now' : '🔥 الأكثر طلباً هذا الأسبوع', 'flame', best, 'is-best') +
      rail(EN ? 'Top rated' : 'الأعلى تقييماً', EN ? '⭐ Loved by verified customers' : '⭐ اختيار العملاء وتقييماتهم', 'star', top, 'is-top') +
    '</div>';
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
        '<img class="sf-store-logo" src="' + esc(DS.avatarUrl(tn)) + '" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' + esc(url('assets/img/LOGO-WHAIT.png')) + '\'">' +
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
          '<button type="button" class="sf-voice" data-q-voice aria-label="' + esc(EN ? 'Voice search' : 'بحث صوتي') + '" title="' + esc(EN ? 'Voice search' : 'بحث صوتي') + '">' + icon('mic') + '</button>' +
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

  function footerMarkup() {
    return DS.shell.customerFooter();
  }

  /* ── Customer support: store owner · rider · platform team ─────── */
  function activeOrderForChat() {
    var list = DS.data.visibleOrders(user).filter(function (o) {
      return DS.isActiveOrderStatus(o.status) || DS.isHoldOrderStatus(o.status);
    });
    return list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); })[0] || null;
  }
  function supportTenantId() {
    if (state.store) return state.store;
    var vendors = vendorIds();
    if (vendors.length) return vendors[0];
    var active = activeOrderForChat();
    return active ? active.tenant_id : '';
  }
  function openSupport() {
    var active = activeOrderForChat();
    if (DS.openSupportHub) {
      DS.openSupportHub({ tenantId: supportTenantId(), order: active });
    } else {
      location.href = url('auth/public-chat.html');
    }
  }
  function mountSupportFab() {
    if (document.querySelector('[data-support-fab]')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sf-support-fab';
    b.setAttribute('data-support-fab', '');
    b.setAttribute('aria-label', EN ? 'Support' : 'الدعم');
    b.innerHTML = (DS.icons && DS.icons.lifebuoy ? icon('lifebuoy') : icon('chat')) +
      '<span>' + esc(EN ? 'Support' : 'الدعم') + '</span>';
    b.addEventListener('click', openSupport);
    document.body.appendChild(b);
  }
  function mountWaFab() {
    if (document.querySelector('[data-wa-fab]')) return;
    var wa = (DS.data.settings && DS.data.settings.whatsapp) || DS.data.WHATSAPP || '201226770582';
    var msg = EN ? 'Hello, I would like to place an order.' : 'مرحباً، أريد تقديم طلب.';
    var a = document.createElement('a');
    a.className = 'sf-wa-fab';
    a.setAttribute('data-wa-fab', '');
    a.href = 'https://wa.me/' + String(wa).replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', EN ? 'Order on WhatsApp' : 'طلب عبر واتساب');
    a.innerHTML = icon('whatsapp') + '<span>' + esc(EN ? 'WhatsApp' : 'واتساب') + '</span>';
    document.body.appendChild(a);
  }

  /* ── Dragon: spin-to-win + WhatsApp storefront ───────────────── */
  function mountDragonFabs() {
    if (!DS.dragon || document.querySelector('[data-dragon-fab]')) return;
    var wrap = document.createElement('div');
    wrap.className = 'sf-dragon-fabs';
    wrap.setAttribute('data-dragon-fab', '');

    var spin = document.createElement('button');
    spin.type = 'button';
    spin.className = 'sf-dragon-fab is-spin';
    spin.title = EN ? 'Spin to win' : 'عجلة الحظ';
    spin.setAttribute('aria-label', spin.title);
    spin.innerHTML = icon('sparkles') + '<span>' + esc(EN ? 'Spin' : 'الحظ') + '</span>';
    spin.addEventListener('click', function () { DS.dragon.spinWheel(); });

    var wa = document.createElement('a');
    wa.className = 'sf-dragon-fab is-wa';
    wa.href = DS.dragon.whatsappCatalogLink(state.store ? DS.data.tenantById(state.store) : null);
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.title = EN ? 'Share the storefront on WhatsApp' : 'شارك المتجر على واتساب';
    wa.setAttribute('aria-label', wa.title);
    wa.innerHTML = icon('whatsapp') + '<span>' + esc(EN ? 'Share' : 'مشاركة') + '</span>';

    wrap.appendChild(spin);
    wrap.appendChild(wa);
    document.body.appendChild(wrap);
  }

  function render() {
    if (state.store && !DS.data.tenantById(state.store)) state.store = '';
    var note = preview ? '<div class="sf-preview-note">' +
      '<span class="badge lime">' + icon('eye') + ' ' + esc(EN ? 'Store preview' : 'معاينة المتجر') + '</span>' +
      '<span>' + esc(EN ? 'You are previewing the live storefront as ' + (state.store ? tname(DS.data.tenantById(state.store)) : 'customer') + '.'
        : 'أنت تعاين واجهة المتجر الحية باسم ' + (state.store ? tname(DS.data.tenantById(state.store)) : 'العميل') + '.') + '</span>' +
      '<a class="btn btn-secondary btn-sm" href="' + url('admin/stores.html') + '">' + icon('arrowLeft') + esc(t('back')) + '</a>' +
    '</div>' : '';

    page.setContent(headerMarkup() + '<div class="sf-page">' + note + closedBannerMarkup() + heroMarkup() + railsMarkup() + storeDirectoryMarkup() +
      trustMarkup() + toolbarMarkup() + footerMarkup() + '</div>');

    /* Live SEO — the title + meta description follow the active store/category. */
    if (DS.seo) {
      var seoTenant = state.store ? DS.data.tenantById(state.store) : null;
      DS.seo({
        title: state.cat || (seoTenant ? tname(seoTenant) : (EN ? 'Shop every store' : 'كل المتاجر')),
        description: state.cat
          ? (EN ? 'Shop ' + state.cat + ' from every store on DotStudio — one bag, one checkout, live tracking.'
            : 'تسوق ' + state.cat + ' من كل متاجر DotStudio — سلة واحدة، دفع واحد، وتتبع لحظي.')
          : (seoTenant ? (DS.loc(seoTenant, 'description') || tname(seoTenant))
            : (EN ? 'Every store in one bag — shop, track and get it delivered in minutes.'
              : 'كل متاجرك في سلة واحدة — تسوّق، تتبّع، واستلم في دقائق.')),
        image: seoTenant ? heroArt(seoTenant) : MARKET_HERO,
        url: location.href
      });
    }

    bindStatic();
    initHeroSlider();
    preloadHeroSlides();
    renderGrid();
    renderCart();
  }

  function bindStatic() {
    var body = page.body;
    /* Hero floating product cards open the same quick view as the grid. */
    DS.$$('.sf-float-card[data-view]', body).forEach(function (b) {
      b.addEventListener('click', function () { quickView(b.getAttribute('data-view')); });
    });
    DS.$$('[data-rail-view]', body).forEach(function (b) {
      b.addEventListener('click', function () { quickView(b.getAttribute('data-rail-view')); });
    });
    DS.$$('[data-rail-all]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        var target = body.querySelector('#sfCatalog');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    DS.$$('[data-store]', body).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        var id = b.getAttribute('data-store');
        if (id === state.store) return;
        /* Multi-vendor bag: switching stores never clears the cart. */
        state.store = id;
        state.cat = '';
        state.page = 1;
        if (id) DS.store.set('ds_customer_store', id);
        render();
      });
    });

    /* A closed store cannot receive chat messages either. */
    DS.$$('[data-chat-closed]', body).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        DS.toast(EN
          ? 'The store is closed right now — you can\'t send messages.'
          : 'المتجر مغلق، لا يمكنك إرسال رسائل الآن.', 'warning');
      });
    });

    DS.$$('[data-cat]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        state.cat = b.getAttribute('data-cat');
        state.page = 1;
        render();
      });
    });

    /* Standalone header search mirrors the catalog search. */
    var slSearch = body.querySelector('[data-sl-search]');
    if (slSearch) {
      var applySearch = DS.debounce(function () {
        state.q = slSearch.value;
        state.page = 1;
        var q2 = body.querySelector('[data-q]');
        if (q2 && q2.value !== state.q) q2.value = state.q;
        renderGrid();
      }, 150);
      slSearch.addEventListener('input', applySearch);
      slSearch.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var target = body.querySelector('#sfCatalog');
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    var qEl = body.querySelector('[data-q]');
    if (qEl) qEl.addEventListener('input', DS.debounce(function () {
      state.q = qEl.value;
      state.page = 1;
      if (slSearch && slSearch.value !== state.q) slSearch.value = state.q;
      renderGrid();
    }, 150));

    /* Voice search — Web Speech API, Arabic by default. */
    var voiceBtn = body.querySelector('[data-q-voice]');
    if (voiceBtn) voiceBtn.addEventListener('click', function () {
      if (!DS.voiceSearch) return;
      DS.voiceSearch(function (text) {
        var phrase = String(text || '').trim();
        if (!phrase) return;
        state.q = phrase;
        state.page = 1;
        if (qEl) qEl.value = phrase;
        if (slSearch) slSearch.value = phrase;
        renderGrid();
        var target = body.querySelector('#sfCatalog');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, {
        onStart: function () { voiceBtn.classList.add('is-listening'); },
        onEnd: function () { voiceBtn.classList.remove('is-listening'); }
      });
    });

    DS.$$('[data-scroll-products]', body).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = body.querySelector('#sfCatalog');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    DS.$$('[data-open-cart]').forEach(function (b) {
      if (b.getAttribute('data-bag-bound')) return;
      b.setAttribute('data-bag-bound', '1');
      b.addEventListener('click', openBagModal);
    });

    /* Footer "Support" opens the same support hub as the floating button. */
    DS.$$('[data-footer-support]', body).forEach(function (b) {
      b.addEventListener('click', openSupport);
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

    var perPage = 30;
    var totalPages = Math.max(1, Math.ceil(shown.length / perPage));
    if (state.page > totalPages) state.page = totalPages;
    if (state.page < 1) state.page = 1;
    var start = (state.page - 1) * perPage;
    var pageItems = shown.slice(start, start + perPage);

    /* ONE flat grid — every card lives in the same container so the layout is a
       real multi-column grid. Grouping by category previously produced one
       single-card grid per category, which read as a vertical stack. */
    var pagHtml = '';
    if (totalPages > 1) {
      var nums = '';
      for (var i = 1; i <= totalPages; i++) {
        nums += '<button type="button" class="sf-page-btn' + (i === state.page ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
      }
      pagHtml = '<nav class="sf-pagination" aria-label="pagination">' +
        '<button type="button" class="sf-page-btn sf-page-prev" data-page="prev"' + (state.page <= 1 ? ' disabled' : '') + '>‹</button>' +
        nums +
        '<button type="button" class="sf-page-btn sf-page-next" data-page="next"' + (state.page >= totalPages ? ' disabled' : '') + '>›</button>' +
      '</nav>';
    }
    host.innerHTML = '<div class="sf-grid" id="products-grid" data-products-grid>' +
      pageItems.map(cardMarkup).join('') +
    '</div>' + pagHtml;

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
    DS.$$('[data-share]', host).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        shareProduct(b.getAttribute('data-share'));
      });
    });
    DS.$$('.sf-card-store', host).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        state.store = b.getAttribute('data-store');
        state.cat = '';
        state.page = 1;
        render();
      });
    });
    DS.$$('[data-page]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        var val = b.getAttribute('data-page');
        if (val === 'prev') state.page = Math.max(1, state.page - 1);
        else if (val === 'next') state.page = Math.min(totalPages, state.page + 1);
        else state.page = Number(val) || 1;
        renderGrid();
        var grid = page.body.querySelector('#sfCatalog');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ─────────────────────────── REVIEWS ─────────────────────────── */
  function reviewStarsPicker(value) {
    var out = '';
    for (var i = 1; i <= 5; i++) {
      out += '<button type="button" class="sf-rstar' + (i <= value ? ' on' : '') + '" data-rstar="' + i + '" aria-label="' + i + '">' + starSvg(true) + '</button>';
    }
    return '<div class="sf-rstar-row" data-rstar-row>' + out + '</div>';
  }

  function reviewListMarkup(p) {
    var list = DS.data.reviewsFor ? DS.data.reviewsFor(p.id) : [];
    if (!list.length) {
      return '<div class="sf-rev-empty">' + icon('star') + '<b>' + esc(EN ? 'No reviews yet' : 'لا توجد تقييمات بعد') + '</b><span>' + esc(EN ? 'Be the first to review this product.' : 'كن أول من يقيّم هذا المنتج.') + '</span></div>';
    }
    var user = DS.session() || {};
    var canModerate = DS.data.isAdmin && DS.data.isAdmin(user);
    return '<div class="sf-rev-list">' + list.map(function (r, i) {
      var name = EN ? (r.name_en || r.name) : (r.name || r.name_en);
      var text = EN ? (r.text_en || r.text) : (r.text || r.text_en);
      return '<article class="sf-rev">' +
        '<div class="sf-rev-top"><span class="avatar sm" style="background:var(--surface-3);color:var(--text-primary)">' + esc(DS.initials(name || '?')) + '</span>' +
          '<span class="sf-rev-id"><b>' + esc(name || '—') + '</b>' +
            '<span>' + starsMarkup(r.rating) + (r.verified ? '<em class="sf-rev-verified">' + icon('checkCircle') + esc(EN ? 'Verified' : 'موثّق') + '</em>' : '') + '</span>' +
          '</span>' +
          '<span class="sf-rev-date">' + esc(DS.date(r.created_at)) + '</span>' +
          (canModerate ? '<span class="sf-rev-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" data-rev-edit="' + esc(r.id) + '" aria-label="edit">' + icon('edit') + '</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger)" data-rev-del="' + esc(r.id) + '" aria-label="delete">' + icon('trash') + '</button>' +
          '</span>' : '') +
        '</div>' +
        (text ? '<p class="sf-rev-text">' + esc(text) + '</p>' : '') +
        (r.image ? '<button type="button" class="sf-rev-photo" data-rev-photo="' + i + '"><img src="' + esc(r.image) + '" alt=""></button>' : '') +
      '</article>';
    }).join('') + '</div>';
  }

  function reviewComposerMarkup(p) {
    var user = DS.session() || {};
    return '<div class="sf-rev-compose" data-rev-compose>' +
      '<div class="sf-rev-compose-head"><b>' + esc(EN ? 'Write a review' : 'اكتب تقييمك') + '</b>' +
        '<span>' + esc(EN ? 'Your feedback helps other shoppers.' : 'رأيك يساعد بقية العملاء.') + '</span></div>' +
      reviewStarsPicker(5) +
      '<div class="field-grid" style="margin-top:10px">' +
        '<div class="field"><label>' + esc(EN ? 'Your name' : 'اسمك') + '</label>' +
          '<input class="input" data-rev-name maxlength="60" value="' + esc(EN ? (user.name_en || user.name || '') : (user.name || '')) + '"></div>' +
        '<div class="field"><label>' + esc(EN ? 'Photo (optional)' : 'صورة (اختياري)') + '</label>' +
          '<label class="btn btn-secondary btn-sm" style="width:100%;justify-content:center">' + icon('upload') + esc(EN ? 'Upload' : 'رفع صورة') +
            '<input type="file" accept="image/*" data-rev-file hidden></label></div>' +
      '</div>' +
      '<div class="field" style="margin-top:8px"><label>' + esc(EN ? 'Comment' : 'التعليق') + '</label>' +
        '<textarea class="textarea" rows="3" data-rev-text maxlength="700" placeholder="' + esc(EN ? 'What did you like about it?' : 'ما الذي أعجبك في المنتج؟') + '"></textarea></div>' +
      '<div class="sf-rev-file-preview" data-rev-preview hidden></div>' +
      '<button type="button" class="btn btn-primary sf-rev-submit" data-rev-submit>' + icon('send') + esc(EN ? 'Publish review' : 'نشر التقييم') + '</button>' +
    '</div>';
  }

  function openReviewEditor(r, p, refresh) {
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(EN ? 'Rating' : 'التقييم') + '</label>' +
        '<select class="select" id="rveRating">' + [5, 4, 3, 2, 1].map(function (n) {
          return '<option value="' + n + '"' + (Number(r.rating) === n ? ' selected' : '') + '>' + n + ' ★</option>';
        }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(EN ? 'Name' : 'الاسم') + '</label><input class="input" id="rveName" value="' + esc(EN ? (r.name_en || r.name) : r.name) + '"></div>' +
      '<div class="field" style="grid-column:1/-1"><label>' + esc(EN ? 'Comment' : 'التعليق') + '</label>' +
        '<textarea class="textarea" id="rveText" rows="3">' + esc(EN ? (r.text_en || r.text) : r.text) + '</textarea></div>' +
    '</div>';
    DS.modal({
      size: 'sm',
      title: icon('edit') + ' ' + esc(EN ? 'Edit review' : 'تعديل التقييم'),
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('save'), variant: 'btn-primary', icon: icon('check'), onClick: function (root) {
          var rating = Number(root.querySelector('#rveRating').value) || 5;
          var name = root.querySelector('#rveName').value.trim();
          var text = root.querySelector('#rveText').value.trim();
          DS.data.updateReview(r.id, { rating: rating, name: name, name_en: name, text: text, text_en: text });
          DS.toast(EN ? 'Review updated' : 'تم تحديث التقييم', 'success');
          refresh();
          return true;
        } }
      ]
    });
  }

  function openReviews(p) {
    var current = { rating: 5, image: null };
    var m = DS.modal({
      size: 'lg',
      title: icon('star') + ' ' + esc(EN ? 'Reviews' : 'التقييمات'),
      sub: esc(pname(p)),
      body: '<div class="sf-rev-body" data-rev-body>' +
        '<div class="sf-rev-summary">' +
          '<div class="sf-rev-score"><b>' + ratingInfo(p).value.toFixed(1) + '</b>' + starsMarkup(ratingInfo(p).value) +
            '<span>' + (ratingInfo(p).count || 0) + ' ' + esc(EN ? 'reviews' : 'تقييم') + '</span></div>' +
        '</div>' +
        reviewListMarkup(p) + reviewComposerMarkup(p) +
      '</div>',
      actions: [{ label: t('close'), variant: 'btn-secondary' }]
    });
    m.el.classList.add('sf-modal-backdrop');
    var box = m.el.querySelector('.modal');
    if (box) box.classList.add('sf-modal');

    function refresh() {
      var body = m.el.querySelector('[data-rev-body]');
      if (!body) return;
      body.innerHTML = '<div class="sf-rev-summary"><div class="sf-rev-score"><b>' + ratingInfo(p).value.toFixed(1) + '</b>' +
        starsMarkup(ratingInfo(p).value) + '<span>' + (ratingInfo(p).count || 0) + ' ' + esc(EN ? 'reviews' : 'تقييم') + '</span></div></div>' +
        reviewListMarkup(p) + reviewComposerMarkup(p);
      current = { rating: 5, image: null };
      bind();
    }

    function bind() {
      var root = m.el;
      DS.$$('[data-rstar]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          current.rating = Number(b.getAttribute('data-rstar')) || 5;
          DS.$$('[data-rstar]', root).forEach(function (x) {
            x.classList.toggle('on', Number(x.getAttribute('data-rstar')) <= current.rating);
          });
        });
      });
      var file = root.querySelector('[data-rev-file]');
      if (file) file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        if (f.size > 1.5 * 1024 * 1024) { DS.toast(EN ? 'Image must be under 1.5MB' : 'الصورة يجب أن تكون أقل من 1.5 ميجا', 'error'); return; }
        var rd = new FileReader();
        rd.onload = function (ev) {
          current.image = ev.target.result;
          var prev = root.querySelector('[data-rev-preview]');
          if (prev) { prev.hidden = false; prev.innerHTML = '<img src="' + ev.target.result + '" alt=""><button type="button" data-rev-clear>' + icon('x') + '</button>'; }
          var clr = root.querySelector('[data-rev-clear]');
          if (clr) clr.addEventListener('click', function () { current.image = null; prev.hidden = true; prev.innerHTML = ''; });
        };
        rd.readAsDataURL(f);
      });
      var submit = root.querySelector('[data-rev-submit]');
      if (submit) submit.addEventListener('click', function () {
        var user = DS.session() || {};
        var name = (root.querySelector('[data-rev-name]') || {}).value || user.name || 'Customer';
        var text = (root.querySelector('[data-rev-text]') || {}).value || '';
        if (!String(text).trim()) { DS.toast(EN ? 'Write a short comment first' : 'اكتب تعليقاً قصيراً أولاً', 'error'); return; }
        DS.data.addReview({
          product_id: p.id, name: name, name_en: name,
          text: text, text_en: text,
          rating: current.rating, image: current.image
        });
        DS.toast(EN ? 'Thanks! Your review is live.' : 'شكراً! تم نشر تقييمك.', 'success');
        refresh();
        renderGrid();
      });
      DS.$$('[data-rev-del]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          DS.confirm({ title: t('confirmDelete'), text: EN ? 'Delete this review?' : 'حذف هذا التقييم؟', danger: true }).then(function (ok) {
            if (!ok) return;
            DS.data.deleteReview(b.getAttribute('data-rev-del'));
            DS.toast(t('deleted'), 'success');
            refresh();
            renderGrid();
          });
        });
      });
      DS.$$('[data-rev-edit]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          var r = (DS.data.reviewsFor(p.id) || []).filter(function (x) { return x.id === b.getAttribute('data-rev-edit'); })[0];
          if (r) openReviewEditor(r, p, refresh);
        });
      });
      DS.$$('[data-rev-photo]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          var img = b.querySelector('img');
          if (!img) return;
          DS.modal({ size: 'lg', title: EN ? 'Customer photo' : 'صورة العميل', body: '<img src="' + img.src + '" alt="" style="width:100%;border-radius:12px">', actions: [{ label: t('close'), variant: 'btn-secondary' }] });
        });
      });
    }
    bind();
    return m;
  }

  function quickView(id) {
    var p = allProducts().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var tn = storeOf(p);
    var offline = tn ? !storeOpen(tn) : true;
    var out = (Number(p.stock) || 0) <= 0;
    var descAr = 'من متجر ' + tname(tn) + ' مباشرة. يصلك في حوالي 30 دقيقة مع تتبع مباشر.';
    var descEn = 'Hand-picked by ' + tname(tn) + '. Delivered in about 30 minutes with live tracking.';
    var m = DS.modal({
      title: esc(pname(p)),
      sub: esc(pcat(p)),
      body: '<div class="sf-qv">' +
        '<div class="sf-qv-media"><img src="' + esc(imgOf(p)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'"></div>' +
        '<div class="sf-qv-info">' +
          '<div class="sf-qv-rating-line">' + ratingOf(p) +
            '<span class="sf-qv-sep">·</span>' +
            '<span class="sf-qv-stock' + (offline || out ? ' is-off' : '') + '">' +
              esc(offline ? (EN ? 'Store offline' : 'المتجر أوفلاين') : out ? t('outOfStock') : t('inStock')) +
            '</span>' +
          '</div>' +
          '<a class="sf-qv-store" href="#" data-qv-store="' + esc(p.tenant_id) + '">' + icon('store') +
            '<span>' + esc(EN ? 'From ' : 'من متجر ') + '<b>' + esc(tname(tn)) + '</b></span></a>' +
          '<div class="sf-qv-price">' + money(p.price) + '</div>' +
          '<div class="sf-qv-desc">' +
            '<button type="button" class="sf-translate-btn" data-qv-translate data-lang="' + (EN ? 'en' : 'ar') + '" data-ar="' + esc(descAr) + '" data-en="' + esc(descEn) + '">' +
              icon('globe') + '<span>' + esc(EN ? 'العربية' : 'English') + '</span></button>' +
            '<p data-qv-desc>' + esc(EN ? descEn : descAr) + '</p>' +
          '</div>' +
          '<div class="sf-qv-facts">' +
            '<span>' + icon('truck') + esc(t('delivery')) + ' ' + money(tn ? tn.delivery_fee : 0) + '</span>' +
            '<span>' + icon('clock') + esc(tn ? storeHoursLabel(tn) : '') + '</span>' +
            '<span>' + icon('shield') + esc(t('qualityGuarantee')) + '</span>' +
            '<span>' + icon('box') + esc(out ? t('outOfStock') : p.stock + ' ' + t('units')) + '</span>' +
          '</div>' +
          '<button type="button" class="sf-qv-reviews" data-open-reviews>' + icon('star') +
            '<span>' + esc(EN ? 'Reviews' : 'التقييمات') + '</span><b>' + (ratingInfo(p).count || 0) + '</b>' + icon('chevronRight') + '</button>' +
          (DS.dragon ? '<button type="button" class="sf-qv-ar" data-open-ar>' + icon('sparkles') +
            '<span>' + esc(EN ? 'Try it in AR' : 'جرّبه بالواقع المعزز') + '</span></button>' : '') +
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
    var arBtn = m.el.querySelector('[data-open-ar]');
    if (arBtn) arBtn.addEventListener('click', function () {
      m.close();
      setTimeout(function () { if (DS.dragon) DS.dragon.openAR(p); }, 140);
    });

    /* Instant AR ⇄ EN description toggle — no reload, no re-render. */
    var trBtn = m.el.querySelector('[data-qv-translate]');
    if (trBtn) trBtn.addEventListener('click', function () {
      var showEn = trBtn.getAttribute('data-lang') !== 'en';
      trBtn.setAttribute('data-lang', showEn ? 'en' : 'ar');
      var pEl = m.el.querySelector('[data-qv-desc]');
      if (pEl) {
        pEl.textContent = trBtn.getAttribute(showEn ? 'data-en' : 'data-ar') || '';
        pEl.setAttribute('dir', showEn ? 'ltr' : 'rtl');
      }
      var label = trBtn.querySelector('span');
      if (label) label.textContent = showEn ? 'العربية' : 'English';
      trBtn.classList.toggle('is-en', showEn);
    });
    var reviewBtn = m.el.querySelector('[data-open-reviews]');
    if (reviewBtn) reviewBtn.addEventListener('click', function () {
      m.close();
      setTimeout(function () { openReviews(p); }, 140);
    });
    var storeLink = m.el.querySelector('[data-qv-store]');
    if (storeLink) storeLink.addEventListener('click', function (e) {
      e.preventDefault();
      m.close();
      state.store = p.tenant_id;
      state.cat = '';
      state.page = 1;
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
  mountSupportFab();
  mountWaFab();
  mountDragonFabs();
  render();

  /* Bottom-nav / header bag links land here with ?cart=1. */
  if (params.get('cart') === '1') setTimeout(openBagModal, 220);

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
        DS.toast(EN ? 'Barcode not found' : 'الباركود غير موجود', 'error');
      }
    });
  }
})();
