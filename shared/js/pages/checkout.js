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

  var cart = DS.store.get('ds_cart', { items: [] });
  if (!cart || !Array.isArray(cart.items)) cart = { items: [] };
  var companies = (DS.data.companies || []).filter(function (c) { return c.status !== 'suspended'; });
  var state = { payment: 'cash', company: companies[0] ? companies[0].id : '' };

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
  function fee(vlist) {
    var c = selectedCompany();
    if (c) return Number(c.fee) || 0;
    return (vlist || []).reduce(function (s, v) { return s + v.fee; }, 0);
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

  function render() {
    if (!cart.items.length) {
      page.setContent(DS.empty({ icon: 'cart', title: t('emptyCart'), text: t('emptyCartText'), cta: { label: t('browseStore'), icon: 'store', onclick: "location.href='" + url('customer/storefront.html') + "'" } }));
      return;
    }
    var items = validItems();
    var vlist = vendors(items);
    var sub = subtotal(items);
    var closed = closedVendors(vlist);
    var total = sub + fee(vlist);
    var primary = vlist[0] ? vlist[0].tn : (DS.data.tenants[0] || {});

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
            '<div class="field" style="grid-column:1/-1"><label>' + esc(t('deliveryTo')) + ' *</label><input class="input" id="coAddress" value="' + esc(DS.loc(user, 'address') || '') + '"></div>' +
            '<div class="field"><label>' + esc(t('city')) + '</label><input class="input" id="coCity" value="' + esc(DS.loc(user, 'city') || DS.loc(primary, 'city') || '') + '"></div>' +
            '<div class="field"><label>' + esc(t('deliveryCompany')) + '</label><select class="select" id="coCompany">' +
              '<option value="">' + esc(EN ? 'Store delivery' : 'توصيل المتجر') + ' (' + money(vlist.reduce(function (s, v) { return s + v.fee; }, 0)) + ')</option>' +
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
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('box') + esc(t('items')) + '</div>' +
          '<span class="badge neutral">' + cart.items.length + ' ' + esc(t('item')) + ' · ' + vlist.length + ' ' + esc(EN ? 'stores' : 'متاجر') + '</span></div>' +
          '<div class="card-body">' + orderItems(vlist) + '</div></div>' +
      '</div>' +
      '<aside class="checkout-sticky">' +
        '<div class="card"><div class="card-head"><div class="section-title">' + icon('receipt') + esc(t('orderSummary')) + '</div></div><div class="card-body">' +
          '<div class="summary-line"><span>' + esc(t('subtotal')) + '</span><span>' + money(sub) + '</span></div>' +
          vlist.map(function (v) {
            return '<div class="summary-line co-sum-fee"><span>' + icon('truck') + ' ' + esc(v.name) + '</span><span>' + money(v.fee) + '</span></div>';
          }).join('') +
          '<div class="summary-line"><span>' + esc(t('delivery')) + '</span><span data-sum-fee>' + money(fee(vlist)) + '</span></div>' +
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

    page.setContent(form);

    DS.$$('[data-pay]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { state.payment = b.getAttribute('data-pay'); render(); });
    });
    var co = page.body.querySelector('#coCompany');
    if (co) co.addEventListener('change', function () {
      state.company = co.value;
      /* Live summary refresh — the delivery fee follows the chosen company. */
      var feeEl = page.body.querySelector('[data-sum-fee]');
      var totalEl = page.body.querySelector('[data-sum-total]');
      if (feeEl) feeEl.textContent = money(fee(vlist));
      if (totalEl) totalEl.textContent = money(sub + fee(vlist));
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
    var total = sub + fee(vlist);
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
      customer: { name: name, name_en: name, phone: phone, address: address, city: city, lat: (primary.lat || 30.05) + 0.01, lng: (primary.lng || 31.36) + 0.01 },
      items: items,
      subtotal: sub,
      discount: 0,
      delivery_fee: fee(vlist),
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
    DS.store.set('ds_cart', { items: [] });
    DS.store.set('ds_customer_store', primary.id);
    busy = false;

    var storeList = vlist.map(function (v) { return esc(v.name); }).join(' · ');
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
            (vlist.length > 1 ? '<div class="order-detail-box" style="grid-column:1/-1"><div class="l">' + esc(EN ? 'Stores' : 'المتاجر') + '</div><div class="v">' + storeList + '</div></div>' : '') +
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
