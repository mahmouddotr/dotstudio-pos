/* DotStudio® POS — Customer live tracking */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;

  var page = DS.shell.mount({
    roles: ['customer'],
    active: 'tracking',
    title: t('trackingTitle'),
    eyebrow: t('tracking'),
    icon: 'mapPin',
    sub: DS.lang() === 'en' ? 'Follow your rider live on the map — updated every 10 seconds.' : 'تابع المندوب لحظة بلحظة على الخريطة — تحديث كل 10 ثوانٍ.',
    actions: '<button class="btn btn-secondary" data-refresh>' + icon('refresh') + esc(t('refresh')) + '</button>' +
      '<a class="btn btn-primary" href="' + url('customer/my-orders.html') + '">' + icon('orders') + esc(t('myOrders')) + '</a>',
    content: DS.skeleton.rows(5)
  });
  if (!page) return;

  var params = new URLSearchParams(location.search);
  var state = { id: params.get('order') || '', gps: null };

  function myOrders() {
    return DS.data.visibleOrders(user).filter(function (o) { return o.status !== 'cancelled'; }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function activeOrders() { return myOrders().filter(function (o) { return ['pending', 'confirmed', 'preparing', 'delivering'].indexOf(o.status) > -1; }); }
  function selected() {
    var list = activeOrders().length ? activeOrders() : myOrders();
    if (!list.length) return null;
    return list.filter(function (o) { return o.id === state.id || o.order_no === state.id; })[0] || list[0];
  }
  function orderOf(id) { return myOrders().filter(function (o) { return o.id === id; })[0]; }

  function timeline(o) {
    var flow = DS.statusFlow;
    var events = o.timeline || [];
    var idx = o.status === 'cancelled' ? -1 : flow.indexOf(o.status);
    return '<div class="timeline">' + flow.map(function (s, i) {
      var ev = events.filter(function (e) { return e.status === s; })[0];
      var done = idx > i || o.status === 'delivered' || (!!ev && idx !== -1);
      var current = idx === i && o.status !== 'delivered';
      var meta = DS.statusMeta(s);
      return '<div class="timeline-step' + (done || current ? ' done' : '') + (current ? ' current' : '') + '"><div class="timeline-dot">' + icon(meta.icon) + '</div>' +
        '<div class="timeline-info"><b>' + esc(meta.label) + '</b><span>' + (ev ? esc(DS.datetime(ev.at)) : '—') + '</span></div></div>';
    }).join('') + '</div>';
  }

  function render() {
    var o = selected();
    var actives = activeOrders();
    if (!o) {
      page.setContent(DS.empty({ icon: 'truck', title: t('noActiveOrder'), text: t('noActiveOrderText'), cta: { label: t('browseStore'), icon: 'store', onclick: "location.href='" + url('customer/storefront.html') + "'" } }));
      return;
    }
    state.id = o.id;
    var tn = DS.data.tenantById(o.tenant_id) || {};
    var meta = DS.statusMeta(o.status);
    var company = (DS.data.companies || []).filter(function (c) { return c.id === o.delivery_company_id; })[0];

    var selector = actives.length > 1 ? '<div class="card"><div class="card-body" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<span style="font-size:12px;color:var(--text-tertiary)">' + esc(t('liveOrders')) + '</span>' +
      '<select class="select" data-order style="flex:1;min-width:200px">' + actives.map(function (a) {
        return '<option value="' + esc(a.id) + '"' + (a.id === o.id ? ' selected' : '') + '>' + esc(a.order_no) + ' · ' + esc(DS.statusMeta(a.status).label) + ' · ' + esc(a.customer ? DS.loc(a.customer, 'name') : '') + '</option>';
      }).join('') + '</select></div></div>' : '';

    var left = '<div>' +
      '<div class="tracking-summary"><div class="ic">' + icon(o.status === 'delivering' ? 'bike' : meta.icon) + '</div>' +
        '<div class="t"><b>' + esc(o.status === 'delivering' ? t('driverOnWay') : o.status === 'delivered' ? t('orderDelivered') : meta.label) + '</b>' +
          '<span>' + esc(o.order_no) + ' · ' + esc(tn.name || '') + ' · ' + esc(o.driver_id && DS.data.userById(o.driver_id) ? DS.loc(DS.data.userById(o.driver_id), 'name') : (o.driver_name || t('driver'))) + '</span></div>' +
        DS.badge(o.status, meta.label) + '</div>' +
      '<div id="gpsHost"></div></div>';

    var right = '<div style="display:flex;flex-direction:column;gap:14px">' +
      '<div class="card"><div class="card-head"><div class="section-title">' + icon('receipt') + esc(t('details')) + '</div>' + DS.badge(o.status, meta.label) + '</div><div class="card-body">' +
        '<div class="order-details-grid">' +
          '<div class="order-detail-box"><div class="l">' + esc(t('orderId')) + '</div><div class="v" style="font-family:var(--font-mono);direction:ltr">' + esc(o.order_no) + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('total')) + '</div><div class="v" style="color:var(--lime)">' + money(o.total) + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('paymentMethod')) + '</div><div class="v">' + esc(t(o.payment_method || 'cash')) + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('deliveryCompany')) + '</div><div class="v">' + esc(company ? DS.loc(company, 'name') : (o.delivery_company_name || t('noCompany'))) + '</div></div>' +
        '</div>' +
        '<div style="margin-top:12px"><div class="l" style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.05em;font-weight:600">' + esc(t('address')) + '</div>' +
          '<div style="font-size:12px;color:var(--text-secondary);margin-top:3px">' + esc(o.customer ? DS.loc(o.customer, 'address') : '—') + '</div></div>' +
        '<div style="margin-top:12px">' + DS.proofThumb(o) + '</div>' +
      '</div></div>' +
      '<div class="card"><div class="card-head"><div class="section-title">' + icon('box') + esc(t('items')) + '</div><span class="badge neutral">' + (o.items || []).length + '</span></div><div class="card-body">' +
        '<div class="order-items">' + (o.items || []).map(function (it) {
          return '<div class="order-item-row"><img src="' + esc(DS.data.img(it.image)) + '" alt=""><div class="info"><div class="nm">' + esc(DS.lang() === 'en' ? (it.name_en || it.name) : it.name) + '</div><div class="qt">' + it.qty + ' × ' + money(it.price) + '</div></div><div class="pr">' + money(it.qty * it.price) + '</div></div>';
        }).join('') + '</div>' +
        '<div class="cart-summary" style="margin-top:10px"><div class="cart-row"><span>' + esc(t('subtotal')) + '</span><span>' + money(o.subtotal) + '</span></div>' +
          (o.discount ? '<div class="cart-row"><span>' + esc(t('discount')) + '</span><span style="color:var(--lime)">− ' + money(o.discount) + '</span></div>' : '') +
          '<div class="cart-row"><span>' + esc(t('delivery')) + '</span><span>' + money(o.delivery_fee) + '</span></div>' +
          '<div class="cart-row total"><span>' + esc(t('total')) + '</span><span class="num">' + money(o.total) + '</span></div></div>' +
      '</div></div>' +
      '<div class="card"><div class="card-head"><div class="section-title">' + icon('activity') + esc(t('timeline')) + '</div></div><div class="card-body">' + timeline(o) + '</div></div>' +
      '<div class="card"><div class="card-body" style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<a class="btn btn-secondary" style="flex:1" href="' + url('auth/public-chat.html') + '">' + icon('chat') + esc(t('liveSupport')) + '</a>' +
        '<button class="btn btn-secondary" style="flex:1" data-details="' + esc(o.id) + '">' + icon('eye') + esc(t('details')) + '</button></div></div>' +
    '</div>';

    page.setContent(selector + '<div class="tracking-grid">' + left + right + '</div>');
    bind(o);

    var host = page.body.querySelector('#gpsHost');
    if (host && DS.gps) {
      if (state.gps && state.gps.stop) state.gps.stop();
      state.gps = DS.gps.mount(host, {
        order: o,
        height: 380,
        baseEta: o.status === 'delivering' ? 12 : 20,
        storeLabel: tn.name || t('store'),
        customerLabel: o.customer ? DS.loc(o.customer, 'name') : t('customerLabel'),
        onDelivered: function () {
          if (o.status === 'delivering') {
            DS.data.updateOrderStatus(o.id, 'delivered', { driver_name: o.driver_name });
            DS.toast(t('orderDeliveredMsg'), 'success');
            setTimeout(render, 500);
          }
        }
      });
    }
  }

  function bind(o) {
    var sel = page.body.querySelector('[data-order]');
    if (sel) sel.addEventListener('change', function () { state.id = sel.value; render(); });
    var det = page.body.querySelector('[data-details]');
    if (det) det.addEventListener('click', function () { DS.openOrder(o.id); });
  }

  var refresh = page.root.querySelector('[data-refresh]');
  if (refresh) refresh.addEventListener('click', function () {
    var now = selected();
    if (now) { state.id = now.id; }
    render(); DS.toast(t('updated'), 'success');
  });

  window.addEventListener('ds:order-updated', function (e) {
    if (!e.detail || !e.detail.id || e.detail.id === state.id) {
      setTimeout(render, 250);
    }
  });
  window.addEventListener('ds:data-changed', function () { /* local writes already re-render */ });

  render();
})();
