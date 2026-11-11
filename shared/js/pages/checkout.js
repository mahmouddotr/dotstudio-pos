/* DotStudio® POS — Storefront checkout (multi-vendor, single order) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var EN = DS.lang() === 'en';
  var user = DS.session();
  if (!user) return;
  var preview = user.role !== 'customer';

  var page = DS.shell.mount({
    roles: null,
    active: 'checkout',
    title: t('checkout'),
    eyebrow: t('storefront'),
    icon: 'cart',
    sub: EN ? 'Confirm your details and place the order.' : 'أكد بياناتك وأكمل طلبك.',
    actions: '<a class="btn btn-secondary" href="' + url('customer/storefront.html') + '">' + icon('arrowLeft') + esc(t('continueShopping')) + '</a>',
    content: DS.skeleton.rows(4)
  });
  if (!page) return;
  document.body.classList.add('saleor', 'saleor-store', 'saleor-checkout');
  var cart = DS.store.get('ds_cart', { items: [] });
  if (!cart || !Array.isArray(cart.items)) cart = { items: [] };
  var companies = (DS.data.companies || []).filter(function (c) { return c.status !== 'suspended'; });
  var state = { payment: 'cash', company: companies[0] ? companies[0].id : '', lat: null, lng: null, redeem: false };

  /* ── Cart → validated lines, keeping each item's vendor ─────────── */
  function validItems() {
    var out = [];
    cart.items.forEach(function (l) {
      var p = DS.data.products.filter(function (x) { return x.id === l.id; })[0];
      if (!p || p.is_active === false) return;
      var tn = DS.data.tenantById(p.tenant_id);
      if (!tn || tn.status === 'suspended') return;
      var qty = Math.min(Math.max(1, Number(l.qty) || 1), Math.max(0, Number(p.stock) || 0));
      if (qty <= 0) return;
      out.push({
        product_id: p.id, name: p.name, name_en: p.name_en, price: Number(p.price), qty: qty,
        image: p.image, tenant_id: p.tenant_id, tenant_name: tn.name, tenant_name_en: tn.name_en || tn.name
      });
    });
    return out;
  }

  function vendors(items) {
    var ids = [];
    items.forEach(function (it) { if (ids.indexOf(it.tenant_id) === -1) ids.push(it.tenant_id); });
    return ids.map(function (id) {
      var tn = DS.data.tenantById(id);
      var vItems = items.filter(function (it) { return it.tenant_id === id; });
      return {
        tn: tn,
        id: id,
        name: DS.loc(tn, 'name'),
        items: vItems,
        subtotal: vItems.reduce(function (s, it) { return s + it.price * it.qty; }, 0),
        fee: Number(tn.delivery_fee) || 0,
        open: DS.data.isStoreOpen ? DS.data.isStoreOpen(tn) : true
      };
    }).filter(function (v) { return v.tn; });
  }

  function subtotal(items) { return items.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }
  function selectedCompany() { return companies.filter(function (c) { return c.id === state.company; })[0] || null; }

  /* ── Haversine distance → dynamic delivery pricing ─────────────── */
  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  }

  function distanceFor(vlist) {
    var tn = (vlist && vlist[0] && vlist[0].tn) || DS.data.tenants[0] || {};
    var lat1 = Number(tn.lat) || 30.0444;
    var lon1 = Number(tn.lng) || 31.2357;
    /* Customer coordinates: chosen saved address, saved profile, or a demo offset. */
    var lat2 = Number(state.lat) || Number(user.lat || user.latitude) || (lat1 + 0.018);
    var lon2 = Number(state.lng) || Number(user.lng || user.longitude) || (lon1 + 0.012);
    return haversineKm(lat1, lon1, lat2, lon2);
  }

  /* Dynamic fee = store distance base, or the chosen company's own tariff,
     then the admin free-delivery rule can zero it out. */
  function deliveryQuote(vlist, sub) {
    var distance = distanceFor(vlist);
    var storeBase = 10 + (distance * 5);            // 10 EGP base + 5 EGP/km
    storeBase = Math.min(Math.round(storeBase), 100);
    var company = selectedCompany();
    var amount = company
      ? Math.max(0, Math.round((Number(company.fee) || 0) + distance * 2))
      : Math.max(1, storeBase);

    var fd = DS.data.freeDelivery ? DS.data.freeDelivery() : { enabled: false };
    var free = false;
    if (fd && fd.enabled) {
      if (fd.until && new Date(fd.until).getTime() < Date.now()) free = false;
      else if (fd.mode === 'always') free = true;
      else if (fd.mode === 'threshold' && (Number(sub) || 0) >= (Number(fd.min_order) || 0)) free = true;
      else if (fd.mode === 'company' && (!fd.company_id || (company && company.id === fd.company_id))) free = true;
    }
    return {
      distance: Math.round(distance * 10) / 10,
      fee: free ? 0 : amount,
      free: free,
      base: amount
    };
  }

  function fee(vlist, sub) {
    return deliveryQuote(vlist, sub).fee;
  }
  function closedVendors(vlist) { return (vlist || []).filter(function (v) { return !v.open; }); }

  function orderItems(vlist) {
    return vlist.map(function (v) {
      return '<div class="co-vendor">' +
        '<div class="co-vendor-head">' + icon('store') + '<b>' + esc(v.name) + '</b>' +
          '<span>' + v.items.length + ' ' + esc(t('item')) + '</span>' +
          (v.open ? '' : '<span class="co-vendor-off">' + esc(EN ? 'Offline' : 'أوفلاين') + '</span>') +
        '</div>' +
        v.items.map(function (l) {
          return '<div class="order-item-row"><img src="' + esc(DS.data.img(l.image)) + '" alt=""><div class="info"><div class="nm">' +
            esc(EN ? (l.name_en || l.name) : l.name) + '</div><div class="qt">' + esc(t('quantity')) + ': ' + l.qty + '</div></div><div class="pr">' + money(l.price * l.qty) + '</div></div>';
        }).join('') +
      '</div>';
    }).join('');
  }

  /* ── Promo code carried over from the storefront bag ───────────── */
  function promoCode() { return String(DS.store.get('ds_promo', '') || '').trim().toUpperCase(); }

  /* ── Loyalty & rewards (Task 3) ───────────────────────────────
     100 points = 10 EGP off. Points are earned on the final paid total
     at 1 point per 10 EGP and stored per customer profile. */
  function loyaltyPoints() { return DS.loyalty ? DS.loyalty.get(user) : 0; }
  function loyaltyDiscount() {
    var cost = DS.loyalty ? DS.loyalty.POINTS_PER_REDEEM : 100;
    return state.redeem && loyaltyPoints() >= cost ? (DS.loyalty ? DS.loyalty.REDEEM_VALUE : 10) : 0;
  }

  function promoCheck(sub) {
    var code = promoCode();
    if (!code) return null;
    var check = DS.data.validateDiscount(code, sub);
    return { code: code, check: check, amount: check.ok ? Number(check.amount) || 0 : 0 };
  }

  function promoMarkup(sub) {
    var p = promoCheck(sub);
    var ok = p && p.check.ok;
    var err = p && !p.check.ok
      ? (p.check.error === 'expired' ? (EN ? 'Code expired' : 'الكود منتهي')
        : p.check.error === 'used' ? (EN ? 'Code fully used' : 'تم استهلاك الكود')
        : p.check.error === 'min' ? (EN ? 'Minimum order ' + money(p.check.min_order) : 'الحد الأدنى للطلب ' + money(p.check.min_order))
        : (EN ? 'Invalid code' : 'كود غير صالح'))
      : '';
    return '<div class="co-promo">' +
      '<div class="co-promo-row">' +
        icon('card') +
        '<input class="input" data-co-promo maxlength="24" dir="ltr" placeholder="' + esc(EN ? 'Promo code' : 'كود الخصم') + '" value="' + esc(p ? p.code : '') + '">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-co-promo-apply>' + esc(ok ? (EN ? 'Update' : 'تحديث') : (EN ? 'Apply' : 'تطبيق')) + '</button>' +
        (ok ? '<button type="button" class="btn btn-ghost btn-sm" data-co-promo-remove aria-label="remove">' + icon('x') + '</button>' : '') +
      '</div>' +
      (ok ? '<div class="co-promo-ok">' + icon('checkCircle') + esc((EN ? 'Code ' + p.code + ' applied' : 'تم تطبيق الكود ' + p.code)) + '</div>'
          : (err ? '<div class="co-promo-err">' + icon('alert') + esc(err) + '</div>' : '')) +
    '</div>';
  }

  /* Minimal sticky header for the standalone (saleor-style) checkout. */
  function coHeader() {
    return '<header class="co-header">' +
      '<a class="co-brand" href="' + url('customer/storefront.html') + '" aria-label="DotStudio">' +
        '<img src="' + url('assets/img/LOGO-ICON-DONE.png') + '" alt="DotStudio">' +
        '<span>DotStudio<sup>®</sup></span>' +
      '</a>' +
      '<a class="btn btn-ghost btn-sm" href="' + url('customer/storefront.html') + '" style="display:inline-flex;align-items:center;gap:6px">' +
        icon('arrowLeft') + esc(EN ? 'Back to store' : 'العودة للمتجر') +
      '</a>' +
      '<span class="co-secure">' + icon('shield') + esc(EN ? 'Secure checkout' : 'دفع آمن 100%') + '</span>' +
    '</header>';
  }

  function render() {
    if (!cart.items.length) {
      page.setContent(coHeader() + '<div class="co-page">' + DS.empty({ icon: 'cart', title: t('emptyCart'), text: t('emptyCartText'), cta: { label: t('browseStore'), icon: 'store', onclick: "location.href='" + url('customer/storefront.html') + "'" } }) + '</div>');
      return;
    }
    var items = validItems();
    var vlist = vendors(items);
    var sub = subtotal(items);
    var closed = closedVendors(vlist);
    var promo = promoCheck(sub);
    var saleAmount = DS.data.storeSaleAmount ? DS.data.storeSaleAmount(sub) : 0;
    var loyalty = loyaltyDiscount();
    var discount = Math.min(sub, (promo ? promo.amount : 0) + saleAmount + loyalty);
    var quote = deliveryQuote(vlist, sub);
    var total = Math.max(0, sub + fee(vlist, sub) - discount);
    var primary = vlist[0] ? vlist[0].tn : (DS.data.tenants[0] || {});
    var saved = DS.data.addressesFor ? DS.data.addressesFor(user) : [];
    var addressCards = saved.map(function (a, i) {
      var label = EN ? (a.label_en || a.label) : a.label;
      return '<button type="button" class="co-addr-card" data-co-addr="' + i + '">' +
        '<span class="co-addr-ic">' + icon(i === 0 ? 'home' : 'briefcase') + '</span>' +
        '<span class="co-addr-copy"><b>' + esc(label) + '</b><i>' + esc(EN ? (a.address_en || a.address) : a.address) + '</i></span>' +
        '<span class="co-addr-check">' + icon('check') + '</span></button>';
    }).join('');

    var warning = closed.length
      ? '<div class="notice warning" style="display:flex;align-items:center;gap:10px">' + icon('alert') +
          '<div style="flex:1"><b>' + esc(EN ? 'A store in your bag is offline' : 'يوجد متجر أوفلاين في سلتك') + '</b>' +
          '<div style="font-size:12px;opacity:.85;margin-top:2px">' + esc(closed.map(function (v) { return v.name; }).join('، ') + ' — ' +
            (EN ? 'remove its items or come back during opening hours.' : 'احذف منتجاته أو عد خلال ساعات العمل.')) + '</div></div>' +
          '<a class="btn btn-secondary btn-sm" href="' + url('customer/storefront.html') + '">' + esc(t('cart')) + '</a></div>'
      : '';

    var form = warning + '<div class="checkout-grid">' +
      '<div class="checkout-section">' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('user') + esc(t('customerInfo')) + '</div>' + (preview ? '<span class="badge purple">' + esc(EN ? 'Preview' : 'معاينة') + '</span>' : '') + '</div>' +
          '<div class="card-body"><div class="field-grid">' +
            '<div class="field"><label>' + esc(t('customerName')) + ' *</label><input class="input" id="coName" value="' + esc(user.name || '') + '"></div>' +
            '<div class="field"><label>' + esc(t('phone')) + ' *</label><input class="input" id="coPhone" value="' + esc(user.phone || '') + '" style="direction:ltr" inputmode="tel"></div>' +
            (addressCards ? '<div class="field" style="grid-column:1/-1"><label>' + esc(EN ? 'Saved addresses' : 'العناوين المحفوظة') + '</label>' +
              '<div class="co-address-cards">' + addressCards + '</div></div>' : '') +
            '<div class="field" style="grid-column:1/-1"><label>' + esc(t('deliveryTo')) + ' *</label><input class="input" id="coAddress" value="' + esc(DS.loc(user, 'address') || '') + '"></div>' +
            '<div class="field"><label>' + esc(t('city')) + '</label><input class="input" id="coCity" value="' + esc(DS.loc(user, 'city') || DS.loc(primary, 'city') || '') + '"></div>' +
            '<div class="field"><label>' + esc(t('deliveryCompany')) + '</label><select class="select" id="coCompany">' +
              '<option value="">' + esc(EN ? 'Store delivery' : 'توصيل المتجر') + ' (' + money(fee(vlist, sub)) + ')</option>' +
              companies.map(function (c) { return '<option value="' + esc(c.id) + '"' + (state.company === c.id ? ' selected' : '') + '>' + esc(c.name) + ' · ' + money(c.fee) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field" style="grid-column:1/-1"><label>' + esc(t('notes')) + '</label><textarea class="textarea" id="coNotes" rows="2" placeholder="' + esc(t('notes')) + '"></textarea></div>' +
          '</div></div></div>' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('wallet') + esc(t('choosePayment')) + '</div></div>' +
          '<div class="card-body"><div class="payment-options" role="radiogroup" aria-label="' + esc(t('choosePayment')) + '">' +
            '<button type="button" class="payment-option' + (state.payment === 'cash' ? ' active' : '') + '" data-pay="cash" role="radio" aria-checked="' + (state.payment === 'cash' ? 'true' : 'false') + '">' + icon('wallet') + esc(EN ? 'Cash on delivery' : 'الدفع عند الاستلام') + '</button>' +
            '<button type="button" class="payment-option' + (state.payment === 'card' ? ' active' : '') + '" data-pay="card" role="radio" aria-checked="' + (state.payment === 'card' ? 'true' : 'false') + '">' + icon('card') + esc(EN ? 'Card' : 'بطاقة') + '</button>' +
            '<button type="button" class="payment-option' + (state.payment === 'wallet' ? ' active' : '') + '" data-pay="wallet" role="radio" aria-checked="' + (state.payment === 'wallet' ? 'true' : 'false') + '">' + icon('phone') + esc(EN ? 'Vodafone Cash' : 'فودافون كاش') + '</button>' +
          '</div></div></div>' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('box') + esc(t('items')) + '</div>' +
          '<span class="badge neutral">' + cart.items.length + ' ' + esc(t('item')) + ' · ' + vlist.length + ' ' + esc(EN ? 'stores' : 'متاجر') + '</span></div>' +
          '<div class="card-body">' + orderItems(vlist) + '</div></div>' +
      '</div>' +
      '<aside class="checkout-sticky">' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('receipt') + esc(t('orderSummary')) + '</div></div><div class="card-body">' +
          '<div class="summary-line"><span>' + esc(t('subtotal')) + '</span><span>' + money(sub) + '</span></div>' +
          (saleAmount ? '<div class="summary-line" style="color:var(--success)"><span>⚡ ' + esc(EN ? 'Store sale' : (DS.data.storeSale().label || 'تخفيضات المتجر')) + '</span><span>− ' + money(saleAmount) + '</span></div>' : '') +
          (promo && promo.amount ? '<div class="summary-line" style="color:var(--success)"><span>' + esc(EN ? 'Promo' : 'كود الخصم') + ' · ' + esc(promo.code) + '</span><span data-sum-discount>− ' + money(promo.amount) + '</span></div>' : '') +
          '<div class="summary-line co-loyalty-line" data-loyalty-line style="color:var(--success);' + (loyalty ? '' : 'display:none') + '"><span>' + icon('star') + esc(EN ? 'Loyalty · 100 pts' : 'نقاط الولاء · 100 نقطة') + '</span><span data-sum-loyalty>− ' + money(loyalty || (DS.loyalty ? DS.loyalty.REDEEM_VALUE : 10)) + '</span></div>' +
          vlist.map(function (v) {
            return '<div class="summary-line co-sum-fee"><span>' + icon('truck') + ' ' + esc(v.name) + '</span><span>' + money(v.fee) + '</span></div>';
          }).join('') +
          '<div class="summary-line"><span>' + esc(t('delivery')) + ' · ' + esc(EN ? quote.distance + ' km' : quote.distance + ' كم') +
            (quote.free ? ' · ' + esc(EN ? 'FREE' : 'مجاني') : '') + '</span><span data-sum-fee>' + money(fee(vlist, sub)) + '</span></div>' +
          promoMarkup(sub) +
          '<label class="co-loyalty-toggle' + (loyaltyPoints() >= (DS.loyalty ? DS.loyalty.POINTS_PER_REDEEM : 100) ? '' : ' is-disabled') + '">' +
            '<input type="checkbox" data-loyalty-redeem' + (state.redeem ? ' checked' : '') + (loyaltyPoints() >= (DS.loyalty ? DS.loyalty.POINTS_PER_REDEEM : 100) ? '' : ' disabled') + '>' +
            '<span class="co-loyalty-box">' + icon('star') + '</span>' +
            '<span class="co-loyalty-copy"><b>' + esc(EN ? 'Use 100 points for 10 EGP off' : 'استخدام 100 نقطة للحصول على خصم 10 جنيه') + '</b>' +
              '<i>' + esc(EN ? 'Balance: ' : 'رصيدك: ') + '<b data-loyalty-balance>' + loyaltyPoints() + '</b> ' + esc(EN ? 'points' : 'نقطة') + '</i></span>' +
          '</label>' +
          '<div class="summary-line total"><span>' + esc(t('total')) + '</span><span class="num" data-sum-total>' + money(total) + '</span></div>' +
          '<div class="checkout-hint">' + icon('shield') + esc(t('orderSummaryHint')) + '</div>' +
          '<button type="button" class="btn btn-primary" data-place style="width:100%;margin-top:10px;min-height:46px"' + (closed.length ? ' disabled' : '') + '>' +
            icon(closed.length ? 'alert' : 'check') + esc(closed.length ? (EN ? 'Store offline' : 'المتجر أوفلاين') : t('confirmOrder')) + '</button>' +
          '<div class="login-trust"><span>' + icon('shield') + esc(t('secure')) + '</span><span>' + icon('truck') + esc(t('delivered')) + '</span></div>' +
        '</div></div>' +
        '<div class="card"><div class="card-body" style="display:flex;flex-direction:column;gap:10px">' +
          vlist.map(function (v) {
            return '<div style="display:flex;gap:10px;align-items:center">' +
              '<img src="' + esc(DS.avatarUrl(v.tn)) + '" alt="" style="width:42px;height:42px;border-radius:12px;object-fit:cover">' +
              '<div style="min-width:0;flex:1"><div style="font-weight:700;font-size:13px">' + esc(v.name) + '</div>' +
                '<div style="font-size:11px;color:var(--text-tertiary)">' + esc(DS.loc(v.tn, 'address')) + '</div></div>' +
              (v.open ? '<span class="badge lime">' + esc(EN ? 'Open' : 'متاح') + '</span>' : '<span class="badge danger">' + esc(EN ? 'Offline' : 'أوفلاين') + '</span>') +
            '</div>';
          }).join('') +
        '</div></div>' +
      '</aside></div>';

    page.setContent(coHeader() + '<div class="co-page">' + form + '</div>');

    DS.$$('[data-pay]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { state.payment = b.getAttribute('data-pay'); render(); });
    });
    var co = page.body.querySelector('#coCompany');
    if (co) co.addEventListener('change', function () {
      state.company = co.value;
      /* Live summary refresh — the delivery fee follows the chosen company. */
      var feeEl = page.body.querySelector('[data-sum-fee]');
      var totalEl = page.body.querySelector('[data-sum-total]');
      var newFee = fee(vlist, sub);
      var newDisc = Math.min(sub, (promo ? promo.amount : 0) + saleAmount + loyaltyDiscount());
      if (feeEl) feeEl.textContent = money(newFee);
      if (totalEl) totalEl.textContent = money(Math.max(0, sub + newFee - newDisc));
    });

    /* Saved address cards → fill the address field + remember coordinates so
       the delivery quote reflects the real distance. */
    DS.$$('[data-co-addr]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = Number(b.getAttribute('data-co-addr')) || 0;
        var a = saved[idx];
        if (!a) return;
        var addrEl = page.body.querySelector('#coAddress');
        if (addrEl) addrEl.value = EN ? (a.address_en || a.address) : a.address;
        var cityEl = page.body.querySelector('#coCity');
        if (cityEl && (a.city || a.city_en)) cityEl.value = EN ? (a.city_en || a.city) : a.city;
        state.lat = Number(a.lat) || null;
        state.lng = Number(a.lng) || null;
        DS.$$('[data-co-addr]', page.body).forEach(function (x) { x.classList.toggle('is-active', x === b); });
        /* Re-render the summary fee with the new distance. */
        var q = deliveryQuote(vlist, sub);
        var feeEl = page.body.querySelector('[data-sum-fee]');
        var totalEl = page.body.querySelector('[data-sum-total]');
        var newDisc = Math.min(sub, (promo ? promo.amount : 0) + saleAmount + loyaltyDiscount());
        if (feeEl) feeEl.textContent = money(q.fee);
        if (totalEl) totalEl.textContent = money(Math.max(0, sub + q.fee - newDisc));
      });
    });
    var promoApply = page.body.querySelector('[data-co-promo-apply]');
    if (promoApply) promoApply.addEventListener('click', function () {
      var input = page.body.querySelector('[data-co-promo]');
      var code = input ? input.value.trim().toUpperCase() : '';
      if (!code) { DS.store.set('ds_promo', ''); render(); return; }
      var check = DS.data.validateDiscount(code, sub);
      if (!check.ok) {
        DS.store.set('ds_promo', code);
        DS.toast(check.error === 'min'
          ? (EN ? 'Minimum order for this code is ' + money(check.min_order) : 'الحد الأدنى لهذا الكود ' + money(check.min_order))
          : (EN ? 'Invalid promo code' : 'كود الخصم غير صالح'), 'error');
      } else {
        DS.store.set('ds_promo', code);
        DS.toast(EN ? 'Promo applied · −' + money(check.amount) : 'تم تطبيق الخصم · −' + money(check.amount), 'success');
      }
      render();
    });
    var promoInput = page.body.querySelector('[data-co-promo]');
    if (promoInput) promoInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (promoApply) promoApply.click(); }
    });
    var promoRemove = page.body.querySelector('[data-co-promo-remove]');
    if (promoRemove) promoRemove.addEventListener('click', function () {
      DS.store.set('ds_promo', '');
      DS.toast(EN ? 'Promo removed' : 'تم إزالة الكود', 'info');
      render();
    });

    var loyaltyToggle = page.body.querySelector('[data-loyalty-redeem]');
    if (loyaltyToggle) loyaltyToggle.addEventListener('change', function () {
      state.redeem = !!loyaltyToggle.checked;
      var line = page.body.querySelector('[data-loyalty-line]');
      var totalEl = page.body.querySelector('[data-sum-total]');
      var activeFee = fee(vlist, sub);
      var activeDisc = Math.min(sub, (promo ? promo.amount : 0) + saleAmount + loyaltyDiscount());
      if (line) line.style.display = loyaltyDiscount() ? '' : 'none';
      if (totalEl) totalEl.textContent = money(Math.max(0, sub + activeFee - activeDisc));
      DS.toast(state.redeem
        ? (EN ? '100 points applied · 10 EGP off' : 'تم استخدام 100 نقطة · خصم 10 جنيه')
        : (EN ? 'Loyalty discount removed' : 'تم إلغاء خصم النقاط'), state.redeem ? 'success' : 'info');
    });

    var place = page.body.querySelector('[data-place]');
    if (place && closed.length) {
      place.addEventListener('click', function (e) { e.preventDefault(); DS.toast(EN ? 'This store is offline right now.' : 'المتجر أوفلاين حالياً.', 'error'); });
    } else if (place) {
      place.addEventListener('click', placeOrder);
    }
  }

  var busy = false;
  function placeOrder() {
    if (busy) return;
    var name = (page.body.querySelector('#coName').value || '').trim();
    var phone = (page.body.querySelector('#coPhone').value || '').trim();
    var address = (page.body.querySelector('#coAddress').value || '').trim();
    var city = (page.body.querySelector('#coCity').value || '').trim();
    var notes = (page.body.querySelector('#coNotes').value || '').trim();
    if (!name || !phone || !address) { DS.toast(t('required'), 'error'); return; }
    if (!/^[0-9+\-\s]{7,20}$/.test(phone)) { DS.toast(t('invalidPhone'), 'error'); return; }
    var items = validItems();
    if (!items.length) { DS.toast(t('outOfStock'), 'error'); return; }
    var vlist = vendors(items);
    var closed = closedVendors(vlist);
    if (closed.length) {
      DS.toast(EN ? 'Offline store: ' + closed.map(function (v) { return v.name; }).join(', ') : 'متجر أوفلاين: ' + closed.map(function (v) { return v.name; }).join('، '), 'error');
      render();
      return;
    }
    var company = selectedCompany();
    var sub = subtotal(items);
    var promo = promoCheck(sub);
    var saleAmount = DS.data.storeSaleAmount ? DS.data.storeSaleAmount(sub) : 0;
    var loyalty = loyaltyDiscount();
    var discount = Math.min(sub, (promo ? promo.amount : 0) + saleAmount + loyalty);
    var finalFee = fee(vlist, sub);
    var total = Math.max(0, sub + finalFee - discount);
    var now = new Date().toISOString();
    var primary = vlist[0].tn;
    busy = true;
    var order = DS.data.createOrder({
      tenant_id: primary.id,
      vendor_ids: vlist.map(function (v) { return v.id; }),
      vendors: vlist.map(function (v) {
        return {
          id: v.id, name: v.tn.name, name_en: v.tn.name_en || v.tn.name,
          subtotal: v.subtotal, delivery_fee: v.fee, items: v.items.length
        };
      }),
      multi_vendor: vlist.length > 1,
      customer_id: user.id,
      customer: {
        name: name, name_en: name, phone: phone, address: address, city: city,
        lat: Number(state.lat) || ((primary.lat || 30.05) + 0.01),
        lng: Number(state.lng) || ((primary.lng || 31.36) + 0.01)
      },
      items: items,
      subtotal: sub,
      discount: discount,
      sale_discount: saleAmount,
      loyalty_discount: loyalty,
      loyalty_points_used: loyalty ? (DS.loyalty ? DS.loyalty.POINTS_PER_REDEEM : 100) : 0,
      promo_code: promo && promo.amount ? promo.code : null,
      delivery_fee: finalFee,
      total: total,
      payment_method: state.payment,
      source: 'store',
      notes: notes,
      status: 'pending',
      delivery_company_id: company ? company.id : null,
      delivery_company_name: company ? company.name : null,
      driver_name: company ? (EN ? company.name_en || company.name : company.name) + ' · ' + (EN ? 'Courier' : 'مندوب') : null,
      timeline: [{ status: 'pending', at: now, label: DS.data.statusLabel('pending') }],
      updated_at: now
    });
    /* Every storefront order gets a real invoice, linked to the order so the
       80 mm thermal receipt and the cashier invoice ledger stay in sync. */
    var invoice = DS.data.addInvoice({
      tenant_id: primary.id,
      order_id: order.id,
      order_no: order.order_no,
      customer: order.customer,
      items: items.map(function (it) { return Object.assign({}, it); }),
      subtotal: sub,
      discount: discount,
      sale_discount: saleAmount,
      loyalty_discount: loyalty,
      loyalty_points_used: loyalty ? (DS.loyalty ? DS.loyalty.POINTS_PER_REDEEM : 100) : 0,
      promo_code: promo && promo.amount ? promo.code : null,
      delivery_fee: finalFee,
      total: total,
      payment_method: state.payment,
      status: order.status === 'delivered' ? 'paid' : 'unpaid',
      created_at: now
    });

    if (promo && promo.amount && promo.code) DS.data.consumeDiscount(promo.code);

    /* Loyalty: spend the redeemed 100 points, then credit the new balance. */
    var earned = DS.loyalty ? DS.loyalty.earnedFor(total) : 0;
    if (loyalty && DS.loyalty) DS.loyalty.spend(user, DS.loyalty.POINTS_PER_REDEEM);
    if (DS.loyalty) DS.loyalty.add(user, earned);
    state.redeem = false;

    DS.store.set('ds_cart', { items: [] });
    DS.store.set('ds_promo', '');
    DS.store.set('ds_customer_store', primary.id);
    busy = false;

    var storeList = vlist.map(function (v) { return esc(v.name); }).join(' · ');
    DS.modal({
      title: t('orderPlaced'),
      sub: order.order_no + ' · ' + money(order.total),
      body: '<div style="text-align:center;padding:10px 4px 4px">' +
          '<div class="empty-icon" style="margin:0 auto 12px;background:var(--lime-soft);color:var(--success)">' + icon('checkCircle') + '</div>' +
          '<div style="font-size:var(--fs-lg);font-weight:700">' + esc(t('orderPlaced')) + '</div>' +
          '<p style="color:var(--text-tertiary);font-size:var(--fs-md);line-height:1.7;margin-top:6px">' + esc(t('orderPlacedText')) + '</p>' +
          '<div class="order-details-grid" style="margin-top:14px;text-align:start">' +
            '<div class="order-detail-box"><div class="l">' + esc(t('orderId')) + '</div><div class="v" style="font-family:var(--font-mono);direction:ltr">' + esc(order.order_no) + '</div></div>' +
            '<div class="order-detail-box"><div class="l">' + esc(t('total')) + '</div><div class="v" style="color:var(--text-primary)">' + money(order.total) + '</div></div>' +
            '<div class="order-detail-box"><div class="l">' + esc(EN ? 'Points earned' : 'نقاط مكتسبة') + '</div><div class="v" style="color:var(--accent)">+' + earned + ' ⭐</div></div>' +
            (vlist.length > 1 ? '<div class="order-detail-box" style="grid-column:1/-1"><div class="l">' + esc(EN ? 'Stores' : 'المتاجر') + '</div><div class="v">' + storeList + '</div></div>' : '') +
          '</div></div>',
      actions: [
        { label: t('printReceipt'), variant: 'btn-secondary', icon: icon('printer'), onClick: function () { DS.printReceipt(invoice); } },
        { label: t('trackOrder'), variant: 'btn-primary', icon: icon('mapPin'), onClick: function () { location.href = url('customer/tracking.html?order=' + encodeURIComponent(order.id)); } },
        { label: t('continueShopping'), variant: 'btn-ghost', onClick: function () { location.href = url('customer/storefront.html'); } }
      ],
      dismissible: false
    });
    DS.toast(t('orderCreated'), 'success');
    window.dispatchEvent(new CustomEvent('ds:data-changed'));
  }

  render();
})();
