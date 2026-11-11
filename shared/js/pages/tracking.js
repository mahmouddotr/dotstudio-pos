/* DotStudio® POS — Customer live tracking */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  document.body.classList.add('saleor-store');

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
  var state = { id: params.get('order') || '', gps: null, geoAsked: false };

  /* ── Unified customer header (same chrome as the storefront) ───── */
  function headerMarkup(active) {
    return DS.shell.customerHeader(active === 'tracking' ? 'tracking' : active || 'tracking', { search: false });
  }

  function myOrders() {
    return DS.data.visibleOrders(user).filter(function (o) { return o.status !== 'cancelled'; }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function activeOrders() { return myOrders().filter(function (o) { return DS.isActiveOrderStatus(o.status); }); }
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

  /* ── TASK 5 · LIVE ORDER TIMELINE ─────────────────────────────
     Four customer-facing phases with a lemon glow on the active one:
     Preparing → Picked Up → On the Way → Delivered. */
  function statusStepper(o) {
    var EN = DS.lang() === 'en';
    var phases = [
      { key: 'preparing', statuses: ['pending', 'confirmed', 'preparing'], icon: 'package', ar: 'قيد التحضير', en: 'Preparing' },
      { key: 'picked_up', statuses: ['handed_to_company'], icon: 'box', ar: 'تم الاستلام', en: 'Picked Up' },
      { key: 'on_the_way', statuses: ['out_for_delivery', 'delivering'], icon: 'bike', ar: 'في الطريق', en: 'On the Way' },
      { key: 'delivered', statuses: ['delivered'], icon: 'home', ar: 'تم التسليم', en: 'Delivered' }
    ];
    var idx = 0;
    if (o.status === 'cancelled') idx = -1;
    else if (o.status === 'delivered') idx = 3;
    else if (o.status === 'out_for_delivery' || o.status === 'delivering') idx = 2;
    else if (o.status === 'handed_to_company') idx = 1;
    else idx = 0;

    var events = o.timeline || [];
    var progress = idx <= 0 ? 0 : (idx / 3) * 100;

    return '<div class="ord-timeline' + (o.status === 'cancelled' ? ' is-cancelled' : '') + '" style="--tl-progress:' + progress + '%" aria-label="' + esc(t('timeline')) + '">' +
      '<span class="ord-timeline-rail" aria-hidden="true"><span class="ord-timeline-fill"></span></span>' +
      phases.map(function (p, i) {
        var ev = events.filter(function (e) { return p.statuses.indexOf(e.status) > -1; })[0];
        var done = idx > i;
        var current = idx === i;
        var complete = o.status === 'delivered' && i === 3;
        var cls = 'ord-phase' + (done ? ' is-done' : '') + (current ? ' is-current' : '') + (complete ? ' is-complete' : '');
        return '<div class="' + cls + '">' +
          '<span class="ord-phase-dot">' + icon(done || complete ? 'check' : p.icon) + '</span>' +
          '<b class="ord-phase-label">' + esc(EN ? p.en : p.ar) + '</b>' +
          '<small class="ord-phase-time">' + (ev ? esc(DS.datetime(ev.at)) : (current ? esc(EN ? 'Now' : 'الآن') : '—')) + '</small>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function render() {
    var o = selected();
    var actives = activeOrders();
    if (!o) {
      page.setContent(headerMarkup('tracking') + '<div class="ct-page">' +
        DS.empty({ icon: 'truck', title: t('noActiveOrder'), text: t('noActiveOrderText'), cta: { label: t('browseStore'), icon: 'store', onclick: "location.href='" + url('customer/storefront.html') + "'" } }) +
        '</div>');
      return;
    }
    state.id = o.id;
    var tn = DS.data.tenantById(o.tenant_id) || {};
    var meta = DS.statusMeta(o.status);
    var company = (DS.data.companies || []).filter(function (c) { return c.id === o.delivery_company_id; })[0];
    var rider = DS.data.driverForOrder ? DS.data.driverForOrder(o) : null;
    var riderName = rider ? DS.loc(rider, 'name') : (o.driver_name || '');
    var companyName = company ? DS.loc(company, 'name') : (o.delivery_company_name || '');

    var selector = actives.length > 1 ? '<div class="card"><div class="card-body" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<span style="font-size:12px;color:var(--text-tertiary)">' + esc(t('liveOrders')) + '</span>' +
      '<select class="select" data-order style="flex:1;min-width:200px">' + actives.map(function (a) {
        return '<option value="' + esc(a.id) + '"' + (a.id === o.id ? ' selected' : '') + '>' + esc(a.order_no) + ' · ' + esc(DS.statusMeta(a.status).label) + ' · ' + esc(a.customer ? DS.loc(a.customer, 'name') : '') + '</option>';
      }).join('') + '</select></div></div>' : '';

    var EN = DS.lang() === 'en';
    var driverCard = (riderName || companyName)
      ? '<div class="card trk-driver-card"><div class="card-body trk-driver">' +
          '<span class="trk-driver-avatar">' +
            (rider && DS.avatarUrl ? '<img src="' + esc(DS.avatarUrl(rider)) + '" alt="">' : icon('bike')) +
          '</span>' +
          '<span class="trk-driver-copy">' +
            '<i>' + esc(EN ? 'Delivery rider' : 'المندوب') + '</i>' +
            '<b>' + esc(riderName || companyName) + '</b>' +
            (rider && rider.phone ? '<small dir="ltr" style="text-align:start">' + esc(rider.phone) + '</small>' : '') +
            (companyName ? '<small>' + esc(companyName) + '</small>' : '') +
          '</span>' +
          '<span class="trk-driver-live"><i></i>' + esc(EN ? 'Live' : 'لحظي') + '</span>' +
        '</div>' +
        (rider && rider.phone ? '<div class="card-body" style="padding-top:0"><a class="btn btn-primary" style="width:100%" href="tel:' + esc(rider.phone) + '">' + icon('phone') + esc(t('callDriver')) + '</a></div>' : '') +
        '</div>'
      : '';

    var left = '<div>' +
      '<div class="tracking-summary"><div class="ic">' + icon(o.status === 'out_for_delivery' ? 'bike' : meta.icon) + '</div>' +
        '<div class="t"><b>' + esc(o.status === 'out_for_delivery' ? t('driverOnWay') : o.status === 'delivered' ? t('orderDelivered') : meta.label) + '</b>' +
          '<span>' + esc(o.order_no) + ' · ' + esc(tn.name || '') + ' · ' + esc(companyName) + (riderName ? ' · ' + esc(riderName) : '') + '</span></div>' +
        DS.badge(o.status, meta.label) + '</div>' +
      '<div id="gpsHost"></div>' +
      '<div class="trk-actions">' +
        (rider && ['delivered', 'cancelled'].indexOf(o.status) === -1 ? '<button type="button" class="btn btn-primary" data-driver-chat>' + icon('chat') + esc(t('chatWithDriver')) + '</button>' : '') +
        (rider && rider.phone ? '<a class="btn btn-secondary" href="tel:' + esc(rider.phone) + '">' + icon('phone') + esc(t('callDriver')) + '</a>' : '') +
        '<button type="button" class="btn btn-secondary" data-company-chat>' + icon('truck') + esc(DS.lang() === 'en' ? 'Delivery company' : 'شركة التوصيل') + '</button>' +
      '</div></div>';

    var right = '<div class="trk-aside">' +
      driverCard +
      '<div class="card"><div class="card-head"><div class="section-title">' + icon('receipt') + esc(t('details')) + '</div>' + DS.badge(o.status, meta.label) + '</div><div class="card-body">' +
        '<div class="order-details-grid">' +
          '<div class="order-detail-box"><div class="l">' + esc(t('orderId')) + '</div><div class="v" style="font-family:var(--font-mono);direction:ltr">' + esc(o.order_no) + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('total')) + '</div><div class="v" style="color:var(--text)">' + money(o.total) + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('paymentMethod')) + '</div><div class="v">' + esc(t(o.payment_method || 'cash')) + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('deliveryCompany')) + '</div><div class="v">' + esc(companyName || t('noCompany')) +
            (riderName ? '<span class="order-detail-rider">' + icon('bike') + ' ' + esc(riderName) + '</span>' : '') + '</div></div>' +
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
          (o.discount ? '<div class="cart-row"><span>' + esc(t('discount')) + '</span><span style="color:var(--success)">− ' + money(o.discount) + '</span></div>' : '') +
          '<div class="cart-row"><span>' + esc(t('delivery')) + '</span><span>' + money(o.delivery_fee) + '</span></div>' +
          '<div class="cart-row total"><span>' + esc(t('total')) + '</span><span class="num">' + money(o.total) + '</span></div></div>' +
      '</div></div>' +
      '<div class="card"><div class="card-head"><div class="section-title">' + icon('activity') + esc(t('timeline')) + '</div></div><div class="card-body">' + timeline(o) + '</div></div>' +
      '<div class="card"><div class="card-body" style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<a class="btn btn-secondary" style="flex:1" href="' + url('auth/public-chat.html') + '">' + icon('chat') + esc(t('liveSupport')) + '</a>' +
        '<button class="btn btn-secondary" style="flex:1" data-details="' + esc(o.id) + '">' + icon('eye') + esc(t('details')) + '</button></div></div>' +
    '</div>';

    var head = '<div class="ct-page-head"><div>' +
      '<div class="ct-eyebrow">' + icon('mapPin') + esc(t('tracking')) + '</div>' +
      '<h1 class="ct-title">' + esc(t('trackingTitle')) + '</h1>' +
      '<p class="ct-sub">' + esc(DS.lang() === 'en'
        ? 'Follow your rider live on the map — updated every 10 seconds.'
        : 'تابع المندوب لحظة بلحظة على الخريطة — تحديث كل 10 ثوانٍ.') + '</p>' +
      '</div><div class="ct-page-actions">' +
        '<button type="button" class="btn btn-secondary" data-refresh>' + icon('refresh') + esc(t('refresh')) + '</button>' +
        '<a class="btn btn-primary" href="' + url('customer/my-orders.html') + '">' + icon('orders') + esc(t('myOrders')) + '</a>' +
      '</div></div>';

    page.setContent(headerMarkup('tracking') + '<div class="ct-page">' + head +
      statusStepper(o) +
      (selector ? '<div style="margin:14px 0">' + selector + '</div>' : '') +
      '<div class="tracking-grid">' + left + right + '</div></div>');
    bind(o);

    var host = page.body.querySelector('#gpsHost');
    if (host && DS.gps) {
      if (state.gps && state.gps.stop) state.gps.stop();
      state.gps = DS.gps.mount(host, {
        order: o,
        delivering: o.status === 'out_for_delivery',
        height: 380,
        baseEta: o.status === 'out_for_delivery' ? 12 : 20,
        storeLabel: tn.name || t('store'),
        customerLabel: o.customer ? DS.loc(o.customer, 'name') : t('customerLabel'),
        onDelivered: function () {
          /* The rider confirms delivery with a proof photo — the customer view
             only celebrates that the rider has arrived. */
          if (o.status === 'out_for_delivery') {
            DS.toast(t('orderDeliveredMsg'), 'success');
            setTimeout(render, 500);
          }
        }
      });
    }

    /* Auto-request the browser's location permission once per visit. */
    if (!state.geoAsked && DS.gps && (DS.gps.askLocation || DS.gps.requestLocation)) {
      state.geoAsked = true;
      var ask = DS.gps.askLocation || DS.gps.requestLocation;
      try {
        ask('customer', function (res) {
          if (res && res.ok && state.gps && state.gps.refresh) state.gps.refresh();
        });
      } catch (e) {}
    }
  }

  function bind(o) {
    var sel = page.body.querySelector('[data-order]');
    if (sel) sel.addEventListener('change', function () { state.id = sel.value; render(); });
    var det = page.body.querySelector('[data-details]');
    if (det) det.addEventListener('click', function () { DS.openOrder(o.id); });

    var chatBtn = page.body.querySelector('[data-driver-chat]');
    if (chatBtn) chatBtn.addEventListener('click', function () {
      if (DS.openDriverChat) DS.openDriverChat(o);
      else DS.toast(t('chatDriverNoOrder'), 'warning');
    });

    var companyBtn = page.body.querySelector('[data-company-chat]');
    if (companyBtn) companyBtn.addEventListener('click', function () {
      if (DS.openCompanyChat) DS.openCompanyChat(o);
      else DS.toast(t('noCompany'), 'warning');
    });

    var refreshBtn = page.body.querySelector('[data-refresh]');
    if (refreshBtn) refreshBtn.addEventListener('click', function () {
      var now = selected();
      if (now) { state.id = now.id; }
      render(); DS.toast(t('updated'), 'success');
    });
  }

  /* Floating support sheet: store owner · rider · platform team. */
  function mountSupportFab() {
    if (document.querySelector('[data-support-fab]')) return;
    var EN = DS.lang() === 'en';
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sf-support-fab';
    b.setAttribute('data-support-fab', '');
    b.setAttribute('aria-label', EN ? 'Support' : 'الدعم');
    b.innerHTML = (DS.icons && DS.icons.lifebuoy ? icon('lifebuoy') : icon('chat')) +
      '<span>' + esc(EN ? 'Support' : 'الدعم') + '</span>';
    b.addEventListener('click', function () {
      var o = selected();
      if (DS.openSupportHub) DS.openSupportHub({ tenantId: o ? o.tenant_id : '', order: o });
      else location.href = url('auth/public-chat.html');
    });
    document.body.appendChild(b);
  }

  window.addEventListener('ds:order-updated', function (e) {
    if (!e.detail || !e.detail.id || e.detail.id === state.id) {
      setTimeout(render, 250);
    }
  });
  window.addEventListener('ds:data-changed', function () { /* local writes already re-render */ });

  mountSupportFab();
  render();
})();
