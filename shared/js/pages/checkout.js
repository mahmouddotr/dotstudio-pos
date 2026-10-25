/* DotStudio® POS — Storefront checkout */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  var preview = user.role !== 'customer';

  var page = DS.shell.mount({
    roles: null,
    active: 'checkout',
    title: t('checkout'),
    eyebrow: t('storefront'),
    icon: 'cart',
    sub: DS.lang() === 'en' ? 'Confirm your details and place the order.' : 'أكد بياناتك وأكمل طلبك.',
    actions: '<a class="btn btn-secondary" href="' + url('customer/storefront.html') + '">' + icon('arrowLeft') + esc(t('continueShopping')) + '</a>',
    content: DS.skeleton.rows(4)
  });
  if (!page) return;

  var cart = DS.store.get('ds_cart', { tenant_id: null, items: [] });
  if (!cart || !Array.isArray(cart.items)) cart = { tenant_id: null, items: [] };
  var store = DS.data.tenantById(cart.tenant_id) || DS.data.tenantById(DS.store.get('ds_customer_store', null)) || DS.data.tenants[0];
  var companies = (DS.data.companies || []).filter(function (c) { return c.status !== 'suspended'; });
  var state = { payment: 'cash', company: companies[0] ? companies[0].id : '' };

  function validItems() {
    var out = [];
    cart.items.forEach(function (l) {
      var p = DS.data.products.filter(function (x) { return x.id === l.id && x.tenant_id === store.id; })[0];
      if (!p || p.is_active === false) return;
      var qty = Math.min(Math.max(1, Number(l.qty) || 1), Math.max(0, p.stock));
      if (qty <= 0) return;
      out.push({ product_id: p.id, name: p.name, name_en: p.name_en, price: Number(p.price), qty: qty, image: p.image });
    });
    return out;
  }

  function subtotal(items) { return items.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }
  function selectedCompany() { return companies.filter(function (c) { return c.id === state.company; })[0] || null; }
  function fee() {
    var c = selectedCompany();
    if (c) return Number(c.fee) || 0;
    return Number(store.delivery_fee) || 0;
  }

  function orderItems() {
    return '<div class="order-items">' + cart.items.map(function (l) {
      return '<div class="order-item-row"><img src="' + esc(DS.data.img(l.image)) + '" alt=""><div class="info"><div class="nm">' + esc(DS.lang() === 'en' ? (l.name_en || l.name) : l.name) + '</div><div class="qt">' + esc(t('quantity')) + ': ' + l.qty + '</div></div><div class="pr">' + money(l.price * l.qty) + '</div></div>';
    }).join('') + '</div>';
  }

  function render() {
    if (!cart.items.length) {
      page.setContent(DS.empty({ icon: 'cart', title: t('emptyCart'), text: t('emptyCartText'), cta: { label: t('browseStore'), icon: 'store', onclick: "location.href='" + url('customer/storefront.html') + "'" } }));
      return;
    }
    var items = validItems();
    var sub = subtotal(items);
    var total = sub + fee();

    var form = '<div class="checkout-grid">' +
      '<div class="checkout-section">' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('user') + esc(t('customerInfo')) + '</div>' + (preview ? '<span class="badge purple">' + esc(DS.lang() === 'en' ? 'Preview' : 'معاينة') + '</span>' : '') + '</div>' +
          '<div class="card-body"><div class="field-grid">' +
            '<div class="field"><label>' + esc(t('customerName')) + ' *</label><input class="input" id="coName" value="' + esc(user.name || '') + '"></div>' +
            '<div class="field"><label>' + esc(t('phone')) + ' *</label><input class="input" id="coPhone" value="' + esc(user.phone || '') + '" style="direction:ltr" inputmode="tel"></div>' +
            '<div class="field" style="grid-column:1/-1"><label>' + esc(t('deliveryTo')) + ' *</label><input class="input" id="coAddress" value="' + esc(DS.loc(user, 'address') || '') + '"></div>' +
            '<div class="field"><label>' + esc(t('city')) + '</label><input class="input" id="coCity" value="' + esc(DS.loc(user, 'city') || DS.loc(store, 'city') || '') + '"></div>' +
            '<div class="field"><label>' + esc(t('deliveryCompany')) + '</label><select class="select" id="coCompany">' +
              '<option value="">' + esc(t('noCompany')) + '</option>' +
              companies.map(function (c) { return '<option value="' + esc(c.id) + '"' + (state.company === c.id ? ' selected' : '') + '>' + esc(c.name) + ' · ' + money(c.fee) + '</option>'; }).join('') +
            '</select></div>' +
            '<div class="field" style="grid-column:1/-1"><label>' + esc(t('notes')) + '</label><textarea class="textarea" id="coNotes" rows="2" placeholder="' + esc(t('notes')) + '"></textarea></div>' +
          '</div></div></div>' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('wallet') + esc(t('choosePayment')) + '</div></div>' +
          '<div class="card-body"><div class="payment-options">' +
            '<button class="payment-option' + (state.payment === 'cash' ? ' active' : '') + '" data-pay="cash">' + icon('wallet') + esc(t('cash')) + '</button>' +
            '<button class="payment-option' + (state.payment === 'card' ? ' active' : '') + '" data-pay="card">' + icon('card') + esc(t('card')) + '</button>' +
            '<button class="payment-option' + (state.payment === 'wallet' ? ' active' : '') + '" data-pay="wallet">' + icon('phone') + esc(t('vodafone')) + '</button>' +
          '</div></div></div>' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('box') + esc(t('items')) + '</div><span class="badge neutral">' + cart.items.length + ' ' + esc(t('item')) + '</span></div>' +
          '<div class="card-body">' + orderItems() + '</div></div>' +
      '</div>' +
      '<aside class="checkout-sticky">' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('receipt') + esc(t('orderSummary')) + '</div></div><div class="card-body">' +
          '<div class="summary-line"><span>' + esc(t('subtotal')) + '</span><span>' + money(sub) + '</span></div>' +
          '<div class="summary-line"><span>' + esc(t('delivery')) + '</span><span data-sum-fee>' + money(fee()) + '</span></div>' +
          '<div class="summary-line total"><span>' + esc(t('total')) + '</span><span class="num" data-sum-total>' + money(total) + '</span></div>' +
          '<div class="checkout-hint">' + icon('shield') + esc(t('orderSummaryHint')) + '</div>' +
          '<button type="button" class="btn btn-primary" data-place style="width:100%;margin-top:10px;min-height:46px">' + icon('check') + esc(t('confirmOrder')) + '</button>' +
          '<div class="login-trust"><span>' + icon('shield') + esc(t('secure')) + '</span><span>' + icon('truck') + esc(t('delivered')) + '</span></div>' +
        '</div></div>' +
        '<div class="card"><div class="card-body" style="display:flex;gap:10px;align-items:center">' +
          '<img src="' + esc(DS.avatarUrl(store)) + '" alt="" style="width:44px;height:44px;border-radius:12px;object-fit:cover">' +
          '<div style="min-width:0"><div style="font-weight:700;font-size:13px">' + esc(store.name) + '</div><div style="font-size:11px;color:var(--text-tertiary)">' + esc(DS.loc(store, 'address')) + '</div></div></div></div>' +
      '</aside></div>';

    page.setContent(form);

    DS.$$('[data-pay]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { state.payment = b.getAttribute('data-pay'); render(); });
    });
    var co = page.body.querySelector('#coCompany');
    if (co) co.addEventListener('change', function () {
      state.company = co.value;
      /* Live summary refresh — the delivery fee follows the chosen company. */
      var items2 = validItems();
      var sub2 = subtotal(items2);
      var feeEl = page.body.querySelector('[data-sum-fee]');
      var totalEl = page.body.querySelector('[data-sum-total]');
      if (feeEl) feeEl.textContent = money(fee());
      if (totalEl) totalEl.textContent = money(sub2 + fee());
    });
    var place = page.body.querySelector('[data-place]');
    if (place) place.addEventListener('click', placeOrder);
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
    var company = companies.filter(function (c) { return c.id === state.company; })[0] || null;
    var sub = subtotal(items);
    var total = sub + fee();
    var now = new Date().toISOString();
    var timeline = [
      { status: 'pending', at: now, label: DS.data.statusLabel('pending') }
    ];
    busy = true;
    var order = DS.data.createOrder({
      tenant_id: store.id,
      customer_id: user.id,
      customer: { name: name, name_en: name, phone: phone, address: address, city: city, lat: store.lat + 0.01, lng: store.lng + 0.01 },
      items: items,
      subtotal: sub,
      discount: 0,
      delivery_fee: fee(),
      total: total,
      payment_method: state.payment,
      source: 'store',
      notes: notes,
      status: 'pending',
      delivery_company_id: company ? company.id : null,
      delivery_company_name: company ? company.name : null,
      driver_name: company ? (DS.lang() === 'en' ? company.name_en || company.name : company.name) + ' · ' + (DS.lang() === 'en' ? 'Courier' : 'مندوب') : null,
      timeline: timeline,
      updated_at: now
    });
    DS.store.set('ds_cart', { tenant_id: null, items: [] });
    DS.store.set('ds_customer_store', store.id);
    busy = false;

    DS.modal({
      title: t('orderPlaced'),
      sub: order.order_no + ' · ' + money(order.total),
      body: '<div style="text-align:center;padding:10px 4px 4px">' +
          '<div class="empty-icon" style="margin:0 auto 12px;background:var(--lime-soft);color:var(--lime)">' + icon('checkCircle') + '</div>' +
          '<div style="font-size:var(--fs-lg);font-weight:700">' + esc(t('orderPlaced')) + '</div>' +
          '<p style="color:var(--text-tertiary);font-size:var(--fs-md);line-height:1.7;margin-top:6px">' + esc(t('orderPlacedText')) + '</p>' +
          '<div class="order-details-grid" style="margin-top:14px;text-align:start">' +
            '<div class="order-detail-box"><div class="l">' + esc(t('orderId')) + '</div><div class="v" style="font-family:var(--font-mono);direction:ltr">' + esc(order.order_no) + '</div></div>' +
            '<div class="order-detail-box"><div class="l">' + esc(t('total')) + '</div><div class="v" style="color:var(--lime)">' + money(order.total) + '</div></div>' +
          '</div></div>',
      actions: [
        { label: t('continueShopping'), variant: 'btn-secondary', onClick: function () { location.href = url('customer/storefront.html'); } },
        { label: t('trackOrder'), variant: 'btn-primary', icon: icon('mapPin'), onClick: function () { location.href = url('customer/tracking.html?order=' + encodeURIComponent(order.id)); } }
      ],
      dismissible: false
    });
    DS.toast(t('orderCreated'), 'success');
    window.dispatchEvent(new CustomEvent('ds:data-changed'));
  }

  render();
})();
