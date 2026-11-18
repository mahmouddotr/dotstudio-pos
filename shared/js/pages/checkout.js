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
    actions: '<button type="button" class="btn btn-secondary" data-theme-toggle aria-label="' + esc(EN ? 'Toggle theme' : 'تبديل المظهر') + '" title="' + esc(EN ? 'Theme' : 'المظهر') + '">' + icon((DS.customerTheme && DS.customerTheme() === 'dark') ? 'sun' : 'moon') + '</button>' +
      '<a class="btn btn-secondary" href="' + url('customer/storefront.html') + '">' + icon('arrowLeft') + esc(t('continueShopping')) + '</a>',
    content: DS.skeleton.rows(4)
  });
  if (!page) return;
  document.body.classList.add('saleor', 'saleor-store', 'saleor-checkout');
  var cart = DS.store.get('ds_cart', { items: [] });
  if (!cart || !Array.isArray(cart.items)) cart = { items: [] };
  var companies = (DS.data.companies || []).filter(function (c) { return c.status !== 'suspended'; });
  var state = {
    payment: 'cash', company: companies[0] ? companies[0].id : '', lat: null, lng: null,
    redeem: false, fawryRef: '', receiptData: '', receiptName: '', transactionId: '', step: 1,
    deliveryMode: 'inhouse', speed: 'standard',
    form: { name: '', phone: '', address: '', city: '', notes: '' }
  };

  /* Delivery pricing rules (TASK 3):
     · In-house  → one dynamic store fee, never a service fee.
     · External  → the courier tariff + a flat 5 EGP service fee.
     · Express   → a small speed surcharge on the chosen channel.
     VAT is intentionally absent: the storefront no longer adds 15%. */
  var SERVICE_FEE = 5;
  var EXPRESS_INHOUSE = 15;
  var EXPRESS_EXTERNAL = 10;

  /* Manual wallet payments need a human check before the order is prepared. */
  function isManualPayment(method) { return method === 'vodafone' || method === 'instapay'; }

  function payLabel(method) {
    if (method === 'cash') return EN ? 'Cash on delivery' : 'كاش عند الاستلام';
    if (method === 'vodafone') return EN ? 'Vodafone Cash' : 'فودافون كاش';
    if (method === 'instapay') return EN ? 'InstaPay' : 'إنستاباي';
    if (method === 'online') return EN ? 'Pay online' : 'الدفع الإلكتروني';
    return EN ? 'Fawry' : 'فوري';
  }

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
      var st = DS.data.storeStatus ? DS.data.storeStatus(tn) : null;
      return {
        tn: tn,
        id: id,
        name: DS.loc(tn, 'name'),
        items: vItems,
        subtotal: vItems.reduce(function (s, it) { return s + it.price * it.qty; }, 0),
        fee: Number(tn.delivery_fee) || 0,
        open: DS.data.isStoreOpen ? DS.data.isStoreOpen(tn) : true,
        opensAt: st ? st.openLabel : '10:00'
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

  /* Single delivery fee for ONE chosen channel (TASK 3). */
  function isExternal() { return state.deliveryMode === 'external'; }
  function serviceFee() { return isExternal() ? SERVICE_FEE : 0; }

  function channelBase(vlist, mode, speed) {
    mode = mode || state.deliveryMode;
    speed = speed || state.speed;
    var distance = distanceFor(vlist);
    if (mode === 'external') {
      var company = selectedCompany();
      var tariff = company ? Number(company.fee) : 0;
      return Math.max(1, Math.round(tariff || 25)) + (speed === 'express' ? EXPRESS_EXTERNAL : 0);
    }
    var storeBase = Math.min(Math.round(10 + distance * 5), 100);
    return Math.max(1, storeBase + (speed === 'express' ? EXPRESS_INHOUSE : 0));
  }

  function deliveryQuote(vlist, sub, mode, speed) {
    mode = mode || state.deliveryMode;
    speed = speed || state.speed;
    var distance = distanceFor(vlist);
    var base = channelBase(vlist, mode, speed);
    var company = mode === 'external' ? selectedCompany() : null;

    var fd = DS.data.freeDelivery ? DS.data.freeDelivery() : { enabled: false };
    var free = false;
    if (fd && fd.enabled) {
      if (fd.until && new Date(fd.until).getTime() < Date.now()) free = false;
      else if (fd.mode === 'always') free = true;
      else if (fd.mode === 'threshold' && (Number(sub) || 0) >= (Number(fd.min_order) || 0)) free = true;
      else if (fd.mode === 'company' && mode === 'external' && (!fd.company_id || (company && company.id === fd.company_id))) free = true;
    }
    return {
      distance: Math.round(distance * 10) / 10,
      fee: free ? 0 : base,
      service: mode === 'external' ? SERVICE_FEE : 0,
      free: free,
      base: base,
      mode: mode,
      speed: speed
    };
  }

  function fee(vlist, sub) {
    return deliveryQuote(vlist, sub).fee;
  }
  function closedVendors(vlist) { return (vlist || []).filter(function (v) { return !v.open; }); }

  /* ── Egyptian phone helpers (TASK 6B.1) ───────────────────────────
     Local 01xxxxxxxxx and +201xxxxxxxxx are both normalised to the
     same 10 digits, then rendered as "+20 10 1234 5678". */
  function phoneDigits(v) {
    var d = String(v || '').replace(/[^\d]/g, '');
    if (d.indexOf('0020') === 0) d = d.slice(4);
    else if (d.indexOf('20') === 0 && d.length > 10) d = d.slice(2);
    if (d.charAt(0) === '0') d = d.slice(1);
    return d.slice(0, 10);
  }
  function phoneDisplay(v) {
    var d = phoneDigits(v);
    if (!d) return '';
    var out = '+20 ' + d.slice(0, 2);
    if (d.length > 2) out += ' ' + d.slice(2, 6);
    if (d.length > 6) out += ' ' + d.slice(6, 10);
    return out;
  }
  function phoneValid(v) {
    var d = phoneDigits(v);
    if (d.length === 10) return true;
    return /^\+?[0-9]{7,15}$/.test(String(v || '').replace(/[\s\-()]/g, ''));
  }

  /* ── Form state survives re-renders (payment / delivery switches) ── */
  function seedForm() {
    var q = DS.store.get('ds_quick_customer', null) || {};
    if (!state.form.name) state.form.name = q.name || user.name || '';
    if (!state.form.phone) state.form.phone = q.phone || user.phone || '';
    if (!state.form.address) state.form.address = q.address || DS.loc(user, 'address') || '';
    if (!state.form.city) state.form.city = q.city || DS.loc(user, 'city') || '';
    if (state.form.phone) state.form.phone = phoneDisplay(state.form.phone);
    if (!state.lat && q.lat) { state.lat = Number(q.lat) || null; state.lng = Number(q.lng) || null; }
  }
  function captureForm() {
    if (!page.body) return;
    var map = { name: '#coName', phone: '#coPhone', address: '#coAddress', city: '#coCity', notes: '#coNotes' };
    Object.keys(map).forEach(function (k) {
      var el = page.body.querySelector(map[k]);
      if (el) state.form[k] = el.value;
    });
  }

  /* Street / city autocomplete suggestions, built from real data. */
  function suggestions() {
    var saved = DS.data.addressesFor ? DS.data.addressesFor(user) : [];
    var streets = [], cities = [];
    saved.forEach(function (a) {
      var s = DS.loc(a, 'address');
      if (s && streets.indexOf(s) === -1) streets.push(s);
      var c = DS.loc(a, 'city');
      if (c && cities.indexOf(c) === -1) cities.push(c);
    });
    (DS.data.tenants || []).forEach(function (tn) {
      var c = DS.loc(tn, 'city');
      if (c && cities.indexOf(c) === -1) cities.push(c);
    });
    (EN ? ['Cairo', 'Giza', 'Alexandria', 'Mansoura'] : ['القاهرة', 'الجيزة', 'الإسكندرية', 'المنصورة'])
      .forEach(function (c) { if (cities.indexOf(c) === -1) cities.push(c); });
    return { streets: streets, cities: cities };
  }

  function datalist(id, values) {
    if (!values || !values.length) return '';
    return '<datalist id="' + id + '">' + values.map(function (v) {
      return '<option value="' + esc(v) + '"></option>';
    }).join('') + '</datalist>';
  }

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

  /* ── MANUAL WALLET PAYMENT · PAYMENT INSTRUCTIONS ────────────────
     Vodafone Cash / InstaPay: the customer transfers the exact amount,
     uploads the receipt image and types the transaction id. The order
     stays on hold until an admin verified the receipt on the desk. */
  function paymentInstructions(total, tenant) {
    if (!isManualPayment(state.payment)) return '';
    var accounts = DS.data.paymentAccounts ? DS.data.paymentAccounts(tenant ? tenant.id : '') : { vodafone: '', instapay: '' };
    var wallet = state.payment === 'instapay' ? accounts.instapay : accounts.vodafone;
    var methodLabel = state.payment === 'instapay' ? t('paymentMethodInstapay') : t('paymentMethodVodafone');
    return '<div class="pay-instructions" data-pay-instructions>' +
      '<div class="pay-instructions-head">' +
        '<span class="pay-instructions-ic">' + icon('shield') + '</span>' +
        '<div class="pay-instructions-titles"><b>' + esc(t('payInstructionsTitle')) + '</b>' +
          '<span>' + esc(methodLabel) + (tenant && tenant.name ? ' · ' + esc(tenant.name) : '') + '</span></div>' +
        '<span class="pay-secure-badge">🛡️ ' + esc(t('paySecureBadge')) + '</span>' +
      '</div>' +
      '<ol class="pay-steps">' +
        '<li><span class="pay-step-num">1</span><div class="pay-step-body">' +
          '<b>' + esc(t('payTransferAmount', { amount: money(total) })) + '</b>' +
          '<div class="pay-wallet">' +
            '<span class="pay-wallet-label">' + esc(t('payWalletNumber')) + '</span>' +
            '<span class="pay-wallet-number" id="walletNumber" dir="ltr">' + esc(wallet) + '</span>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-copy-wallet>' + icon('copy') + esc(t('payCopy')) + '</button>' +
          '</div>' +
        '</div></li>' +
        '<li><span class="pay-step-num">2</span><div class="pay-step-body"><b>' + esc(t('payUploadStep')) + '</b></div></li>' +
      '</ol>' +
      '<div class="pay-form">' +
        '<div class="pay-field">' +
          '<label for="receiptImage">' + esc(t('payReceiptLabel')) + ' *</label>' +
          '<label class="pay-receipt-drop" for="receiptImage" data-receipt-drop>' +
            icon('paperclip') +
            '<span data-receipt-drop-label>' + esc(state.receiptName || (EN ? 'Upload the transfer receipt' : 'أرفق صورة الإيصال')) + '</span>' +
          '</label>' +
          '<input type="file" accept="image/*" id="receiptImage" required class="pay-receipt-input">' +
          '<div class="pay-receipt-preview" data-receipt-preview' + (state.receiptData ? '' : ' hidden') + '>' +
            '<img src="' + esc(state.receiptData) + '" alt="' + esc(t('payReceiptLabel')) + '">' +
            '<span data-receipt-name>' + esc(state.receiptName || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="pay-field">' +
          '<label for="transactionId">' + esc(t('payTransactionLabel')) + ' *</label>' +
          '<input type="text" id="transactionId" placeholder="رقم العملية (Transaction ID)" required value="' + esc(state.transactionId) + '">' +
        '</div>' +
      '</div>' +
    '</div>';
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
    /* No VAT on the storefront: subtotal + one delivery fee (+ 5 EGP
       service fee only for an external courier) − discounts. */
    var shipFee = quote.fee;
    var service = quote.service;
    var total = Math.max(0, sub + shipFee + service - discount);
    var inBase = deliveryQuote(vlist, sub, 'inhouse', 'standard').fee;
    var inEx = deliveryQuote(vlist, sub, 'inhouse', 'express').fee;
    var extBase = deliveryQuote(vlist, sub, 'external', 'standard').fee;
    var extEx = deliveryQuote(vlist, sub, 'external', 'express').fee;
    var inFree = inBase === 0;
    var extFree = extBase === 0;
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
          '<div style="flex:1"><b>' + esc(EN ? 'The store is closed right now' : 'المتجر مغلق حالياً') + '</b>' +
          '<div style="font-size:12px;opacity:.85;margin-top:2px">' + esc(closed.map(function (v) {
            return v.name + ' — ' + (EN ? 'opens at ' : 'نفتح الساعة ') + (v.opensAt || '10:00');
          }).join('، ')) + '</div></div>' +
          '<a class="btn btn-secondary btn-sm" href="' + url('customer/storefront.html') + '">' + esc(t('cart')) + '</a></div>'
      : '';

    /* One-click checkout: details saved from the previous order. */
    var quick = DS.store.get('ds_quick_customer', null);
    var quickBtn = quick && (quick.name || quick.phone || quick.address)
      ? '<button type="button" class="co-quickpay" data-quick-pay>' +
          '<span class="co-quickpay-ic">' + icon('zap') + '</span>' +
          '<span class="co-quickpay-copy"><b>' + esc(EN ? 'Express payment' : 'الدفع السريع') + '</b>' +
            '<i>' + esc([quick.name, quick.address].filter(Boolean).join(' · ')) + '</i></span>' +
          icon('arrowLeft') +
        '</button>'
      : '';

    seedForm();
    var nameVal = state.form.name;
    var phoneVal = state.form.phone;
    var addressVal = state.form.address;
    var cityVal = state.form.city || DS.loc(primary, 'city') || '';
    var sugg = suggestions();
    var companyName = (companies.filter(function (c) { return c.id === state.company; })[0] || companies[0] || {}).name || (EN ? 'Courier partner' : 'شركة توصيل');

    function stepInd(n, label) {
      var done = state.step > n;
      return '<button type="button" class="co-step' + (state.step === n ? ' is-active' : '') + (done ? ' is-done' : '') +
        '" data-step-ind="' + n + '" data-step-goto="' + n + '">' +
        '<span class="co-step-num">' + (done ? '✓' : n) + '</span>' + esc(label) + '</button>';
    }
    var stepper = '<div class="co-stepper">' +
      stepInd(1, EN ? 'Shipping' : 'الشحن') +
      stepInd(2, EN ? 'Payment' : 'الدفع') +
      stepInd(3, EN ? 'Review' : 'المراجعة') +
    '</div>';
    var form = warning + '<div class="checkout-grid">' +
      '<div class="checkout-section">' + stepper +
        '<div class="step-pane' + (state.step===1?' is-active':'') + '" data-step-pane="1">' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('user') + esc(t('customerInfo')) + '</div>' + (preview ? '<span class="badge purple">' + esc(EN ? 'Preview' : 'معاينة') + '</span>' : '') + '</div>' +
          '<div class="card-body">' + quickBtn +
            (addressCards ? '<div class="field" style="margin-bottom:14px"><label>' + esc(EN ? 'Saved addresses' : 'العناوين المحفوظة') + '</label>' +
              '<div class="co-address-cards">' + addressCards + '</div></div>' : '') +
            '<div class="co-fields">' +
              '<div class="co-field"><input class="co-input" id="coName" placeholder=" " autocomplete="name" value="' + esc(nameVal) + '"><label for="coName">' + esc(t('customerName')) + ' *</label></div>' +
              '<div class="co-field"><input class="co-input" id="coPhone" placeholder=" " autocomplete="tel" dir="ltr" inputmode="tel" value="' + esc(phoneVal) + '"><label for="coPhone">' + esc(EN ? 'Phone (+20)' : 'الهاتف (+20)') + ' *</label></div>' +
              '<div class="co-field co-field-full"><input class="co-input" id="coAddress" placeholder=" " autocomplete="street-address" list="coStreetList" value="' + esc(addressVal) + '"><label for="coAddress">' + esc(t('deliveryTo')) + ' *</label></div>' +
              '<div class="co-field"><input class="co-input" id="coCity" placeholder=" " autocomplete="address-level2" list="coCityList" value="' + esc(cityVal) + '"><label for="coCity">' + esc(t('city')) + '</label></div>' +
              '<div class="co-field co-field-full"><textarea class="co-input" id="coNotes" rows="2" placeholder=" ">' + esc(state.form.notes || '') + '</textarea><label for="coNotes">' + esc(t('notes')) + '</label></div>' +
            '</div>' +
            datalist('coStreetList', sugg.streets) + datalist('coCityList', sugg.cities) +
            '<div class="co-delivery-block">' +
              '<div class="co-delivery-title">' + esc(EN ? 'Delivery method' : 'طريقة التوصيل') + '</div>' +
              '<div class="co-mode-grid">' +
                '<button type="button" class="co-mode' + (!isExternal() ? ' is-active' : '') + '" data-delivery-mode="inhouse">' +
                  icon('store') +
                  '<b>' + esc(EN ? 'In-house delivery' : 'توصيل المتجر') + '</b>' +
                  '<i>' + esc(EN ? 'Store driver' : 'مندوب المتجر') + ' · ' + (inFree ? esc(EN ? 'FREE' : 'مجاني') : money(inBase)) + '</i>' +
                '</button>' +
                (companies.length ? '<button type="button" class="co-mode' + (isExternal() ? ' is-active' : '') + '" data-delivery-mode="external">' +
                  icon('truck') +
                  '<b>' + esc(EN ? 'Delivery company' : 'شركة توصيل') + '</b>' +
                  '<i>' + esc(companyName) + ' · ' + (extFree ? esc(EN ? 'FREE' : 'مجاني') : money(extBase)) + '</i>' +
                '</button>' : '') +
              '</div>' +
              '<div class="co-speed-grid">' +
                '<button type="button" class="co-speed' + (state.speed !== 'express' ? ' is-active' : '') + '" data-speed="standard">' +
                  '<span>' + esc(EN ? 'Standard · 45–60 min' : 'عادي · 45–60 دقيقة') + '</span>' +
                  '<b>' + money(isExternal() ? extBase : inBase) + '</b>' +
                '</button>' +
                '<button type="button" class="co-speed' + (state.speed === 'express' ? ' is-active' : '') + '" data-speed="express">' +
                  '<span>' + esc(EN ? 'Express · 20–30 min' : 'سريع · 20–30 دقيقة') + '</span>' +
                  '<b>' + money(isExternal() ? extEx : inEx) + '</b>' +
                '</button>' +
              '</div>' +
              (isExternal() && companies.length ? '<div class="co-field is-select"><select class="co-input" id="coCompany">' +
                companies.map(function (c) { return '<option value="' + esc(c.id) + '"' + (state.company === c.id ? ' selected' : '') + '>' + esc(c.name) + ' · ' + money(c.fee) + '</option>'; }).join('') +
              '</select><label for="coCompany">' + esc(t('deliveryCompany')) + '</label></div>' : '') +
              '<div class="co-delivery-title">' + esc(EN ? 'No VAT · service fee only for a courier company' : 'بدون ضريبة · رسوم خدمة 5 ج فقط لشركة التوصيل') + '</div>' +
            '</div>' +
          '</div></div>' +
          '<div class="step-nav" style="display:flex;gap:8px;margin:12px 0">' +
            '<button type="button" class="btn btn-primary" data-step-next="2" style="flex:1">' + esc(EN?'Next':'التالي') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="step-pane' + (state.step===2?' is-active':'') + '" data-step-pane="2">' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('wallet') + esc(t('choosePayment')) + '</div></div>' +
          '<div class="card-body"><div class="payment-options payment-options-4" role="radiogroup" aria-label="' + esc(t('choosePayment')) + '">' +
            '<button type="button" class="payment-option' + (state.payment === 'cash' ? ' active' : '') + '" data-pay="cash" role="radio" aria-checked="' + (state.payment === 'cash' ? 'true' : 'false') + '">' + icon('wallet') + '<span>' + esc(EN ? 'Cash on delivery' : 'كاش عند الاستلام') + '</span></button>' +
            '<button type="button" class="payment-option' + (state.payment === 'vodafone' ? ' active' : '') + '" data-pay="vodafone" role="radio" aria-checked="' + (state.payment === 'vodafone' ? 'true' : 'false') + '">' + icon('phone') + '<span>' + esc(EN ? 'Vodafone Cash' : 'فودافون كاش') + '</span></button>' +
            '<button type="button" class="payment-option' + (state.payment === 'instapay' ? ' active' : '') + '" data-pay="instapay" role="radio" aria-checked="' + (state.payment === 'instapay' ? 'true' : 'false') + '">' + icon('card') + '<span>' + esc(EN ? 'InstaPay' : 'إنستاباي') + '</span></button>' +
            '<button type="button" class="payment-option' + (state.payment === 'online' ? ' active' : '') + '" data-pay="online" role="radio" aria-checked="' + (state.payment === 'online' ? 'true' : 'false') + '">' + icon('card') + '<span>' + esc(EN ? 'Pay online' : 'الدفع الإلكتروني') + '</span></button>' +
          '</div>' +
          (!isManualPayment(state.payment) ? '<div class="co-pay-hint">' + icon('shield') + '<span>' +
            esc(state.payment === 'cash'
              ? (EN ? 'Pay the driver in cash when your order arrives.' : 'ادفع للمندوب نقداً عند وصول الطلب.')
              : (EN ? 'You will be redirected to the secure payment gateway.' : 'سيتم تحويلك إلى بوابة الدفع الآمنة.')) +
            '</span></div>' : '') +
          paymentInstructions(total, primary) + '</div></div>' +
        '<div class="step-nav" style="display:flex;gap:8px;margin:12px 0">' +
          '<button type="button" class="btn btn-secondary" data-step-prev="1">' + esc(EN?'Back':'رجوع') + '</button>' +
          '<button type="button" class="btn btn-primary" data-step-next="3" style="flex:1">' + esc(EN?'Next':'التالي') + '</button>' +
        '</div>' +
        '</div>' +
        '<div class="step-pane' + (state.step===3?' is-active':'') + '" data-step-pane="3">' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('checkCircle') + esc(EN ? 'Review your order' : 'مراجعة الطلب') + '</div></div>' +
          '<div class="card-body" style="padding-top:2px;padding-bottom:2px">' +
            '<div class="co-review-block">' +
              '<div class="co-review-copy"><span>' + esc(EN ? 'Contact' : 'بيانات التواصل') + '</span>' +
                '<b>' + esc(nameVal || '—') + '</b><b dir="ltr" style="font-weight:500;color:var(--text-secondary)">' + esc(phoneVal || '—') + '</b></div>' +
              '<button type="button" class="co-review-edit" data-step-goto="1">' + icon('edit') + esc(EN ? 'Edit' : 'تعديل') + '</button>' +
            '</div>' +
            '<div class="co-review-block">' +
              '<div class="co-review-copy"><span>' + esc(EN ? 'Delivery address' : 'عنوان التوصيل') + '</span>' +
                '<b>' + esc([addressVal, cityVal].filter(Boolean).join('، ') || '—') + '</b></div>' +
              '<button type="button" class="co-review-edit" data-step-goto="1">' + icon('edit') + esc(EN ? 'Edit' : 'تعديل') + '</button>' +
            '</div>' +
            '<div class="co-review-block">' +
              '<div class="co-review-copy"><span>' + esc(EN ? 'Delivery' : 'التوصيل') + '</span>' +
                '<b>' + esc((isExternal() ? (EN ? 'Courier company · ' : 'شركة توصيل · ') + companyName : (EN ? 'In-house delivery' : 'توصيل المتجر')) +
                  ' · ' + (state.speed === 'express' ? (EN ? 'Express 20–30 min' : 'سريع 20–30 دقيقة') : (EN ? 'Standard 45–60 min' : 'عادي 45–60 دقيقة'))) + '</b>' +
                '<b style="font-weight:500;color:var(--text-secondary)">' +
                  (quote.free ? esc(EN ? 'Free delivery' : 'توصيل مجاني') : esc((EN ? 'Delivery fee ' : 'رسوم التوصيل ') + money(shipFee))) +
                  (service ? ' + ' + esc((EN ? 'service fee ' : 'رسوم خدمة ') + money(service)) : '') + '</b></div>' +
              '<button type="button" class="co-review-edit" data-step-goto="1">' + icon('edit') + esc(EN ? 'Edit' : 'تعديل') + '</button>' +
            '</div>' +
            '<div class="co-review-block">' +
              '<div class="co-review-copy"><span>' + esc(EN ? 'Payment method' : 'طريقة الدفع') + '</span>' +
                '<b>' + esc(payLabel(state.payment)) + '</b>' +
                (isManualPayment(state.payment) && state.transactionId
                  ? '<b dir="ltr" style="font-weight:500;color:var(--text-secondary)">' + esc(state.transactionId) + '</b>' : '') +
                (isManualPayment(state.payment) && !state.receiptData
                  ? '<b style="font-weight:600;color:var(--danger)">' + esc(EN ? 'Receipt image required' : 'مطلوب صورة الإيصال') + '</b>' : '') + '</div>' +
              '<button type="button" class="co-review-edit" data-step-goto="2">' + icon('edit') + esc(EN ? 'Edit' : 'تعديل') + '</button>' +
            '</div>' +
          '</div></div>' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('box') + esc(t('items')) + '</div>' +
          '<span class="badge neutral">' + cart.items.length + ' ' + esc(t('item')) + ' · ' + vlist.length + ' ' + esc(EN ? 'stores' : 'متاجر') + '</span></div>' +
          '<div class="card-body" style="padding-top:8px">' + orderItems(vlist) + '</div></div>' +
        '<div class="step-nav" style="display:flex;gap:8px;margin:12px 0">' +
          '<button type="button" class="btn btn-secondary" data-step-prev="2">' + esc(EN?'Back':'رجوع') + '</button>' +
          '<button type="button" class="btn btn-primary" data-place-top style="flex:1">' + esc(EN ? 'Place order' : 'تأكيد الطلب') + '</button>' +
        '</div>' +
      '</div>' +
      '</div>' +
      '<aside class="checkout-sticky">' +
        '<button type="button" class="co-summary-toggle" data-co-summary-toggle aria-expanded="false">' +
          '<b>' + esc(t('orderSummary')) + '</b>' +
          '<span style="display:inline-flex;align-items:center;gap:10px"><span class="co-summary-total" data-co-summary-total>' + money(total) + '</span>' +
          '<span class="co-summary-chev">' + icon('chevronDown') + '</span></span>' +
        '</button>' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('receipt') + esc(t('orderSummary')) + '</div></div><div class="card-body">' +
          '<div class="summary-line"><span>' + esc(t('subtotal')) + '</span><span>' + money(sub) + '</span></div>' +
          (saleAmount ? '<div class="summary-line" style="color:var(--success)"><span>⚡ ' + esc(EN ? 'Store sale' : (DS.data.storeSale().label || 'تخفيضات المتجر')) + '</span><span>− ' + money(saleAmount) + '</span></div>' : '') +
          (promo && promo.amount ? '<div class="summary-line" style="color:var(--success)"><span>' + esc(EN ? 'Promo' : 'كود الخصم') + ' · ' + esc(promo.code) + '</span><span data-sum-discount>− ' + money(promo.amount) + '</span></div>' : '') +
          '<div class="summary-line co-loyalty-line" data-loyalty-line style="color:var(--success);' + (loyalty ? '' : 'display:none') + '"><span>' + icon('star') + esc(EN ? 'Loyalty · 100 pts' : 'نقاط الولاء · 100 نقطة') + '</span><span data-sum-loyalty>− ' + money(loyalty || (DS.loyalty ? DS.loyalty.REDEEM_VALUE : 10)) + '</span></div>' +
          '<div class="summary-line"><span>' + icon('truck') + ' ' + esc(t('delivery')) + ' · ' + esc(EN ? quote.distance + ' km' : quote.distance + ' كم') +
            (quote.free ? ' · ' + esc(EN ? 'FREE' : 'مجاني') : '') + '</span><span data-sum-fee>' + money(shipFee) + '</span></div>' +
          (service ? '<div class="summary-line" data-sum-service><span>' + esc(EN ? 'Service fee' : 'رسوم الخدمة') + '</span><span>' + money(service) + '</span></div>' : '') +
          promoMarkup(sub) +
          '<label class="co-loyalty-toggle' + (loyaltyPoints() >= (DS.loyalty ? DS.loyalty.POINTS_PER_REDEEM : 100) ? '' : ' is-disabled') + '">' +
            '<input type="checkbox" data-loyalty-redeem' + (state.redeem ? ' checked' : '') + (loyaltyPoints() >= (DS.loyalty ? DS.loyalty.POINTS_PER_REDEEM : 100) ? '' : ' disabled') + '>' +
            '<span class="co-loyalty-box">' + icon('star') + '</span>' +
            '<span class="co-loyalty-copy"><b>' + esc(EN ? 'Use 100 points for 10 EGP off' : 'استخدام 100 نقطة للحصول على خصم 10 جنيه') + '</b>' +
              '<i>' + esc(EN ? 'Balance: ' : 'رصيدك: ') + '<b data-loyalty-balance>' + loyaltyPoints() + '</b> ' + esc(EN ? 'points' : 'نقطة') + '</i></span>' +
          '</label>' +
          '<div class="summary-line total"><span>' + esc(t('total')) + '</span><span class="num" data-sum-total>' + money(total) + '</span></div>' +
          '<div class="checkout-hint">' + icon('shield') + esc(t('orderSummaryHint')) + '</div>' +
          '<button type="button" class="co-place-btn" data-place' + (closed.length ? ' disabled' : '') + '>' +
            '<span class="co-spinner" data-co-spinner hidden></span>' +
            '<span data-place-label>' + esc(closed.length
              ? (EN ? 'Store closed — opens at ' + (closed[0].opensAt || '10:00') : 'المتجر مغلق — نفتح الساعة ' + (closed[0].opensAt || '10:00'))
              : t('confirmOrder')) + '</span>' +
            '<b>' + money(total) + '</b></button>' +
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

    /* ── Form bindings (kept in state so a re-render never loses typing) ── */
    [['#coName', 'name'], ['#coAddress', 'address'], ['#coCity', 'city'], ['#coNotes', 'notes']].forEach(function (pair) {
      var el = page.body.querySelector(pair[0]);
      if (el) el.addEventListener('input', function () { state.form[pair[1]] = el.value; });
    });
    var phoneEl = page.body.querySelector('#coPhone');
    if (phoneEl) {
      phoneEl.addEventListener('input', function () {
        phoneEl.value = phoneEl.value.replace(/[^\d+\s]/g, '');
        state.form.phone = phoneEl.value;
      });
      phoneEl.addEventListener('blur', function () {
        if (phoneDigits(phoneEl.value)) phoneEl.value = phoneDisplay(phoneEl.value);
        state.form.phone = phoneEl.value;
      });
    }

    function validateStep1(silent) {
      captureForm();
      if (!String(state.form.name || '').trim() || !String(state.form.phone || '').trim() || !String(state.form.address || '').trim()) {
        if (!silent) DS.toast(EN ? 'Please fill in your name, phone and address.' : 'يرجى إكمال الاسم والهاتف والعنوان.', 'error');
        return false;
      }
      if (!phoneValid(state.form.phone)) {
        if (!silent) DS.toast(EN ? 'Enter a valid Egyptian phone number (+20).' : 'أدخل رقم هاتف مصري صحيح (+20).', 'error');
        return false;
      }
      return true;
    }

    /* ── 3-step navigation (client-side, preserves typed input) ── */
    function goToStep(n) {
      if (n > 1 && state.step === 1 && !validateStep1()) return;
      captureForm();
      state.step = n;
      DS.$$('[data-step-pane]', page.body).forEach(function (p) {
        p.classList.toggle('is-active', Number(p.getAttribute('data-step-pane')) === n);
      });
      DS.$$('[data-step-ind]', page.body).forEach(function (p) {
        var i = Number(p.getAttribute('data-step-ind'));
        p.classList.toggle('is-active', i === n);
        p.classList.toggle('is-done', i < n);
        var num = p.querySelector('.co-step-num');
        if (num) num.textContent = i < n ? '✓' : String(i);
      });
      var drawer = page.body.querySelector('.checkout-sticky');
      if (drawer) drawer.classList.remove('is-open');
    }
    DS.$$('[data-step-next]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { goToStep(Number(b.getAttribute('data-step-next'))); });
    });
    DS.$$('[data-step-prev]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { goToStep(Number(b.getAttribute('data-step-prev'))); });
    });
    DS.$$('[data-step-goto]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { goToStep(Number(b.getAttribute('data-step-goto'))); });
    });
    DS.$$('[data-step-ind]', page.body).forEach(function (b) {
      if (!b.hasAttribute('data-step-goto')) b.addEventListener('click', function () { goToStep(Number(b.getAttribute('data-step-ind'))); });
    });

    /* TASK 4 — a manual transfer cannot be confirmed before the proof. */
    function manualGate() {
      var blocked = !closed.length && isManualPayment(state.payment) &&
        (!state.receiptData || !String(state.transactionId || '').trim());
      var btn = page.body.querySelector('[data-place]');
      var top = page.body.querySelector('[data-place-top]');
      if (btn) {
        btn.classList.toggle('is-off', blocked);
        btn.disabled = blocked || !!closed.length;
        var label = btn.querySelector('[data-place-label]');
        if (label) {
          label.textContent = closed.length
            ? (EN ? 'Store closed' : 'المتجر مغلق')
            : (blocked ? (EN ? 'Upload receipt & transaction ID' : 'أرفق الإيصال ورقم العملية') : t('confirmOrder'));
        }
      }
      if (top) {
        top.disabled = blocked || !!closed.length;
        top.classList.toggle('is-off', blocked);
      }
    }

    DS.$$('[data-pay]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var next = b.getAttribute('data-pay');
        captureForm();
        /* Switching the method clears the receipt + reference: a receipt
           never follows the customer to another payment channel. */
        if (next !== state.payment) { state.receiptData = ''; state.receiptName = ''; state.transactionId = ''; }
        state.payment = next; state.fawryRef = '';
        render();
      });
    });

    /* ── Delivery channel + speed (one fee only, TASK 3) ── */
    DS.$$('[data-delivery-mode]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-delivery-mode');
        if (mode === 'external' && !companies.length) return;
        captureForm();
        state.deliveryMode = mode === 'external' ? 'external' : 'inhouse';
        if (!state.company && companies[0]) state.company = companies[0].id;
        render();
      });
    });
    DS.$$('[data-speed]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        captureForm();
        state.speed = b.getAttribute('data-speed') === 'express' ? 'express' : 'standard';
        render();
      });
    });

    /* Copy the wallet number to the clipboard. */
    var copyBtn = page.body.querySelector('[data-copy-wallet]');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var num = page.body.querySelector('#walletNumber');
      if (num) DS.copy(num.textContent.trim());
    });

    /* Receipt image → shrunk data URL kept in state. */
    var receiptInput = page.body.querySelector('#receiptImage');
    if (receiptInput) {
      receiptInput.addEventListener('change', function () {
        var f = receiptInput.files && receiptInput.files[0];
        if (!f) return;
        if (!/^image\//.test(f.type)) { DS.toast(EN ? 'Please upload an image' : 'يرجى رفع صورة', 'error'); receiptInput.value = ''; return; }
        if (f.size > 8 * 1024 * 1024) { DS.toast(EN ? 'Image is too large' : 'حجم الصورة كبير جداً', 'error'); receiptInput.value = ''; return; }
        DS.readImage(f, function (data) {
          state.receiptData = data;
          state.receiptName = f.name || '';
          var preview = page.body.querySelector('[data-receipt-preview]');
          if (preview) {
            preview.hidden = false;
            var img = preview.querySelector('img');
            if (img) img.src = data;
            var name = preview.querySelector('[data-receipt-name]');
            if (name) name.textContent = f.name || '';
          }
          var dropLabel = page.body.querySelector('[data-receipt-drop-label]');
          if (dropLabel) dropLabel.textContent = f.name || (EN ? 'Receipt attached' : 'تم إرفاق الإيصال');
          DS.toast(EN ? 'Receipt attached' : 'تم إرفاق صورة الإيصال', 'success');
          manualGate();
        });
      });
    }

    /* Transaction id — normalised (no spaces / dashes) before it is stored. */
    var txInput = page.body.querySelector('#transactionId');
    if (txInput) txInput.addEventListener('input', function () {
      state.transactionId = txInput.value;
      manualGate();
    });
    var co = page.body.querySelector('#coCompany');
    if (co) co.addEventListener('change', function () {
      captureForm();
      state.company = co.value;
      render();
    });

    /* Saved address cards → fill the address field + remember coordinates so
       the delivery quote reflects the real distance. */
    DS.$$('[data-co-addr]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var idx = Number(b.getAttribute('data-co-addr')) || 0;
        var a = saved[idx];
        if (!a) return;
        captureForm();
        state.form.address = EN ? (a.address_en || a.address) : a.address;
        if (a.city || a.city_en) state.form.city = EN ? (a.city_en || a.city) : a.city;
        state.addrIdx = idx;
        state.lat = Number(a.lat) || null;
        state.lng = Number(a.lng) || null;
        DS.$$('[data-co-addr]', page.body).forEach(function (x) { x.classList.toggle('is-active', x === b); });
        render();
      });
    });
    if (typeof state.addrIdx === 'number') {
      DS.$$('[data-co-addr]', page.body).forEach(function (x) {
        x.classList.toggle('is-active', Number(x.getAttribute('data-co-addr')) === state.addrIdx);
      });
    }
    var quickBtnEl = page.body.querySelector('[data-quick-pay]');
    if (quickBtnEl && quick) quickBtnEl.addEventListener('click', function () {
      captureForm();
      state.form.name = quick.name || state.form.name;
      state.form.phone = phoneDisplay(quick.phone || state.form.phone);
      state.form.address = quick.address || state.form.address;
      state.form.city = quick.city || state.form.city;
      state.lat = Number(quick.lat) || null;
      state.lng = Number(quick.lng) || null;
      DS.toast(EN ? 'Details filled — place your order in one tap.' : 'تم تعبئة بياناتك — أكّد الطلب بضغطة واحدة.', 'success');
      render();
    });

    /* Mobile summary drawer (sticky bar at the bottom). */
    var sumToggle = page.body.querySelector('[data-co-summary-toggle]');
    if (sumToggle) sumToggle.addEventListener('click', function () {
      var drawer = page.body.querySelector('.checkout-sticky');
      if (!drawer) return;
      var open = drawer.classList.toggle('is-open');
      sumToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    var promoApply = page.body.querySelector('[data-co-promo-apply]');
    if (promoApply) promoApply.addEventListener('click', function () {
      var input = page.body.querySelector('[data-co-promo]');
      var code = input ? input.value.trim().toUpperCase() : '';
      captureForm();
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
      captureForm();
      render();
      DS.toast(state.redeem
        ? (EN ? '100 points applied · 10 EGP off' : 'تم استخدام 100 نقطة · خصم 10 جنيه')
        : (EN ? 'Loyalty discount removed' : 'تم إلغاء خصم النقاط'), state.redeem ? 'success' : 'info');
    });

    var place = page.body.querySelector('[data-place]');
    if (place && closed.length) {
      place.addEventListener('click', function (e) {
        e.preventDefault();
        DS.toast(EN
          ? 'The store is closed right now — we open at ' + (closed[0].opensAt || '10:00') + '.'
          : 'المتجر مغلق حالياً. نفتح الساعة ' + (closed[0].opensAt || '10:00') + '.', 'error');
      });
    } else if (place) {
      place.addEventListener('click', placeOrder);
    }
    var placeTop = page.body.querySelector('[data-place-top]');
    if (placeTop) placeTop.addEventListener('click', function () {
      if (closed.length) {
        DS.toast(EN
          ? 'The store is closed right now — we open at ' + (closed[0].opensAt || '10:00') + '.'
          : 'المتجر مغلق حالياً. نفتح الساعة ' + (closed[0].opensAt || '10:00') + '.', 'error');
        return;
      }
      placeOrder();
    });

    manualGate();
  }

  var busy = false;
  /* 3-second lock — a double tap or a slow network can never create two
     identical orders. The button also shows a live countdown. */
  var LOCK_MS = 3000;
  var lastPlaceAt = 0;
  var lockTimer = null;

  function lockButton(ms) {
    var btn = page.body.querySelector('[data-place]');
    if (!btn) return;
    var left = Math.ceil(ms / 1000);
    btn.disabled = true;
    btn.classList.add('is-locked', 'is-loading');
    var original = btn.innerHTML;
    function tick() {
      if (left <= 0) {
        btn.disabled = false;
        btn.classList.remove('is-locked', 'is-loading');
        btn.innerHTML = original;
        if (lockTimer) { clearInterval(lockTimer); lockTimer = null; }
        return;
      }
      btn.innerHTML = '<span class="co-spinner"></span><span>' +
        (DS.lang() === 'en' ? 'Placing your order ' : 'جارٍ تأكيد الطلب ') + left + 's</span>';
      left--;
    }
    tick();
    if (lockTimer) clearInterval(lockTimer);
    lockTimer = setInterval(tick, 1000);
  }

  /* ── ANTI-FRAUD GATE ──────────────────────────────────────────────
     A manual wallet transfer is only accepted when the customer proves
     it: a receipt image + a transaction id that was never used before. */
  function guardManualPayment() {
    if (!isManualPayment(state.payment)) return true;
    var txRaw = String(state.transactionId || '').trim();
    if (!state.receiptData) { DS.toast(t('payReceiptRequired'), 'error'); return false; }
    if (!txRaw) { DS.toast(t('payTransactionRequired'), 'error'); return false; }
    if (!DS.data.validTransactionId(txRaw)) { DS.toast(t('payTransactionInvalid'), 'error'); return false; }
    /* The reference may never be replayed — a fake receipt always reuses
       the same transaction id. */
    if (DS.data.transactionIdUsed(txRaw)) { DS.toast(t('payDuplicateTransaction'), 'error'); return false; }
    /* One customer cannot flood the verification desk with fake receipts. */
    var mine = DS.data.pendingVerificationCount(user.id || (user.phone || ''));
    if (mine >= DS.data.MAX_PENDING_VERIFICATIONS) { DS.toast(t('payTooManyPending'), 'warning'); return false; }
    return true;
  }

  function placeOrder() {
    if (busy) return;
    var nowMs = Date.now();
    if (nowMs - lastPlaceAt < LOCK_MS) {
      DS.toast(EN ? 'Please wait a moment before placing another order.' : 'انتظر لحظة قبل إرسال طلب آخر.', 'warning');
      return;
    }
    captureForm();
    var name = String(state.form.name || '').trim();
    var phone = String(state.form.phone || '').trim();
    var address = String(state.form.address || '').trim();
    var city = String(state.form.city || '').trim();
    var notes = String(state.form.notes || '').trim();
    if (!name || !phone || !address) { DS.toast(t('required'), 'error'); return; }
    if (!phoneValid(phone)) { DS.toast(t('invalidPhone'), 'error'); return; }
    var items = validItems();
    if (!items.length) { DS.toast(t('outOfStock'), 'error'); return; }
    var vlist = vendors(items);
    var closed = closedVendors(vlist);
    if (closed.length) {
      DS.toast(EN
        ? 'The store is closed right now — we open at ' + (closed[0].opensAt || '10:00') + '.'
        : 'المتجر مغلق حالياً. نفتح الساعة ' + (closed[0].opensAt || '10:00') + '.', 'error');
      render();
      return;
    }
    var company = selectedCompany();
    var sub = subtotal(items);
    var promo = promoCheck(sub);
    var saleAmount = DS.data.storeSaleAmount ? DS.data.storeSaleAmount(sub) : 0;
    var loyalty = loyaltyDiscount();
    var discount = Math.min(sub, (promo ? promo.amount : 0) + saleAmount + loyalty);
    var finalQuote = deliveryQuote(vlist, sub);
    var finalFee = finalQuote.fee;
    var serviceFeeAmt = finalQuote.service;
    var total = Math.max(0, sub + finalFee + serviceFeeAmt - discount);
    var now = new Date().toISOString();
    var primary = vlist[0].tn;
    var manual = isManualPayment(state.payment);
    /* Pay Online (Paymob): redirect to the gateway instead of creating a local order. */
    if (state.payment === 'online') {
      busy = true; lastPlaceAt = Date.now(); lockButton(LOCK_MS);
      if (DS.api && typeof DS.api.checkoutPaymob === 'function') {
        DS.api.checkoutPaymob(total, 'EGP', { name: name, phone: phone, address: address }).then(function (data) {
          var redirectUrl = data && (data.iframe_url || data.payment_url || data.url);
          if (redirectUrl) { window.location.href = redirectUrl; }
          else { busy = false; DS.toast(EN ? 'Payment gateway unavailable' : 'بوابة الدفع غير متاحة', 'error'); }
        }).catch(function () { busy = false; DS.toast(EN ? 'Payment gateway unavailable' : 'بوابة الدفع غير متاحة', 'error'); });
      } else {
        busy = false; DS.toast(EN ? 'Payment gateway unavailable' : 'بوابة الدفع غير متاحة', 'error');
      }
      return;
    }
    /* Anti-fraud gate — nothing is created when the receipt or the
       transaction reference is missing, forged or already used. */
    if (!guardManualPayment()) return;
    var txId = manual ? DS.data.normalizeTransactionId(state.transactionId) : null;
    /* Loyalty points earned with this order (credited once the payment
       of a manual transfer is approved). */
    var earned = DS.loyalty ? DS.loyalty.earnedFor(total) : 0;
    /* One-click checkout: remember the delivery identity for next time. */
    DS.store.set('ds_quick_customer', {
      name: name, phone: phone, address: address, city: city,
      lat: Number(state.lat) || null, lng: Number(state.lng) || null, saved_at: now
    });
    /* Phase 2: persist the order to the real backend (Cloudflare Worker). */
    try {
      if (DS.api && typeof DS.api.createOrder === 'function') {
        DS.api.createOrder({
          customer_name: name,
          tenant_id: primary.id,
          items: items.map(function (it) { return { product_id: it.product_id, quantity: it.qty }; }),
          total: total,
          status: manual ? 'pending_verification' : 'pending'
        }).catch(function () {});
      } else if (typeof fetch === 'function') {
        fetch('http://localhost:8787/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': String(primary.id || '') },
          body: JSON.stringify({
            customer_name: name,
            tenant_id: primary.id,
            items: items.map(function (it) { return { product_id: it.product_id, quantity: it.qty }; }),
            total: total
          })
        }).catch(function () {});
      }
    } catch (e) {}
    busy = true;
    lastPlaceAt = Date.now();
    lockButton(LOCK_MS);
    var order = DS.data.createOrder({
      tenant_id: primary.id,
      vendor_ids: vlist.map(function (v) { return v.id; }),
      vendors: vlist.map(function (v) {
        return {
          id: v.id, name: v.tn.name, name_en: v.tn.name_en || v.tn.name,
          subtotal: v.subtotal, delivery_fee: v.id === primary.id ? finalFee : 0, items: v.items.length
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
      service_fee: serviceFeeAmt,
      delivery_mode: state.deliveryMode,
      delivery_speed: state.speed,
      vat: 0,
      total: total,
      payment_method: state.payment,
      /* A manual transfer is NOT paid yet — it waits on the verification
         desk, so the money is only booked when an admin approves it. */
      payment_status: manual ? 'pending_verification' : 'pending',
      payment_transaction_id: manual ? txId : null,
      used_transaction_ids: manual ? [txId] : [],
      payment_receipt: manual ? state.receiptData : null,
      payment_receipt_at: manual ? now : null,
      loyalty_points_earned: manual ? earned : 0,
      fawry_ref: state.payment === 'fawry' ? (state.fawryRef || (state.fawryRef = String(Math.floor(10000000 + Math.random() * 90000000)))) : null,
      source: 'store',
      notes: notes,
      /* The order is created ON HOLD — it stays invisible to the cashier
         and the kitchen until the receipt is verified. */
      status: manual ? 'pending_verification' : 'pending',
      delivery_company_id: company ? company.id : null,
      delivery_company_name: company ? company.name : null,
      driver_name: company ? (EN ? company.name_en || company.name : company.name) + ' · ' + (EN ? 'Courier' : 'مندوب') : null,
      timeline: manual
        ? [{ status: 'pending_verification', at: now, label: 'قيد مراجعة الدفع' }]
        : [{ status: 'pending', at: now, label: DS.data.statusLabel('pending') }],
      history: manual
        ? [{
            action: 'receipt_submitted', at: now, by: user.name || 'Customer',
            by_role: user.role || 'customer', transaction_id: txId, method: state.payment
          }]
        : [],
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
      service_fee: serviceFeeAmt,
      delivery_mode: state.deliveryMode,
      delivery_speed: state.speed,
      total: total,
      payment_method: state.payment,
      payment_status: order.payment_status || 'pending',
      status: manual ? 'unpaid' : 'unpaid',
      created_at: now
    });

    if (promo && promo.amount && promo.code) DS.data.consumeDiscount(promo.code);

    /* Loyalty: spend the redeemed 100 points, then credit the new balance.
       For a manual transfer the points are only credited once the admin
       approved the payment (see DS.data.verifyPayment). */
    if (loyalty && DS.loyalty) DS.loyalty.spend(user, DS.loyalty.POINTS_PER_REDEEM);
    if (!manual && DS.loyalty) DS.loyalty.add(user, earned);
    state.redeem = false;

    DS.store.set('ds_cart', { items: [] });
    DS.store.set('ds_promo', '');
    DS.store.set('ds_customer_store', primary.id);
    busy = false;

    var storeList = vlist.map(function (v) { return esc(v.name); }).join(' · ');
    var fawryNote = state.payment === 'fawry'
      ? '<div style="margin:12px 0;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)">' +
          '<div style="font-size:12px;color:var(--text-tertiary)">' + esc(EN ? 'Fawry reference number' : 'رقم مرجع فوري') + '</div>' +
          '<div style="font-size:22px;font-weight:800;letter-spacing:2px;margin:4px 0">' + esc(state.fawryRef) + '</div>' +
          '<div style="font-size:12px;color:var(--text-secondary)">' + esc(EN ? 'Go pay at any Fawry outlet. Order is Pending until payment is confirmed.' : 'ادفع في أي فرع فوري. الطلب قيد الانتظار حتى تأكيد الدفع.') + '</div>' +
        '</div>'
      : '';
    var paidNote = manual
      ? '<div class="pay-modal-note">' + icon('shield') +
          '<div><b>' + esc(t('payReceiptReceived')) + '</b>' +
          '<span>' + esc(EN ? 'Transaction ID: ' : 'رقم العملية: ') + esc(txId) + '</span></div>' +
        '</div>'
      : '';
    DS.modal({
      title: manual ? (EN ? 'Receipt received' : 'تم استلام الإيصال') : (state.payment === 'fawry' ? (EN ? 'Order placed — pay at Fawry' : 'تم إنشاء الطلب — ادفع في فوري') : t('orderPlaced')),
      sub: order.order_no + ' · ' + money(order.total),
      body: '<div style="text-align:center;padding:10px 4px 4px">' +
          '<div class="empty-icon" style="margin:0 auto 12px;background:var(--lime-soft);color:var(--success)">' + icon('checkCircle') + '</div>' +
          '<div style="font-size:var(--fs-lg);font-weight:700">' + esc(manual ? t('payReceiptReceived') : t('orderPlaced')) + '</div>' +
          '<p style="color:var(--text-tertiary);font-size:var(--fs-md);line-height:1.7;margin-top:6px">' + esc(manual ? t('payReviewing') : t('orderPlacedText')) + '</p>' +
          paidNote + fawryNote + '<div class="order-details-grid" style="margin-top:14px;text-align:start">' +
            '<div class="order-detail-box"><div class="l">' + esc(t('orderId')) + '</div><div class="v" style="font-family:var(--font-mono);direction:ltr">' + esc(order.order_no) + '</div></div>' +
            '<div class="order-detail-box"><div class="l">' + esc(t('total')) + '</div><div class="v" style="color:var(--text-primary)">' + money(order.total) + '</div></div>' +
            (manual ? '<div class="order-detail-box"><div class="l">' + esc(t('transactionId')) + '</div><div class="v" style="font-family:var(--font-mono);direction:ltr">' + esc(txId) + '</div></div>' : '') +
            (manual ? '' : '<div class="order-detail-box"><div class="l">' + esc(EN ? 'Points earned' : 'نقاط مكتسبة') + '</div><div class="v" style="color:var(--accent)">+' + earned + ' ⭐</div></div>') +
            (vlist.length > 1 ? '<div class="order-detail-box" style="grid-column:1/-1"><div class="l">' + esc(EN ? 'Stores' : 'المتاجر') + '</div><div class="v">' + storeList + '</div></div>' : '') +
          '</div></div>',
      actions: [
        { label: t('printReceipt'), variant: 'btn-secondary', icon: icon('printer'), onClick: function () { DS.printReceipt(invoice); } },
        { label: t('trackOrder'), variant: 'btn-primary', icon: icon('mapPin'), onClick: function () { location.href = url('customer/tracking.html?order=' + encodeURIComponent(order.id)); } },
        { label: t('continueShopping'), variant: 'btn-ghost', onClick: function () { location.href = url('customer/storefront.html'); } }
      ],
      dismissible: false
    });
    DS.toast(manual ? t('payReceiptReceived') : t('orderCreated'), 'success');
    window.dispatchEvent(new CustomEvent('ds:data-changed'));
  }

  render();
})();
