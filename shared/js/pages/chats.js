/* DotStudio® POS — Chat centre (all roles) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon;
  var user = DS.session();
  if (!user) return;

  var isAdmin = DS.data.isAdmin(user);
  var store = user.tenant_id ? DS.data.tenantById(user.tenant_id) : null;
  var company = user.delivery_company ? (DS.data.companies || []).filter(function (c) { return c.id === user.delivery_company; })[0] : null;

  var defaultScope = isAdmin ? 'support'
    : (user.role === 'delivery' || user.role === 'driver') ? 'delivery'
      : 'stores';
  var qScope = DS.qs('scope');
  if (qScope === 'direct' || qScope === 'public') qScope = 'stores';
  var scope = (qScope && DS.chat && DS.chat.canScope(user, qScope)) ? qScope : defaultScope;

  var page = DS.shell.mount({
    roles: null,
    permission: user.role === 'subadmin' ? 'chats' : null,
    active: (user.role === 'delivery' || user.role === 'driver') ? 'messages' : 'chats',
    title: t('messages'),
    eyebrow: isAdmin ? t('admin') : (store ? store.name : (company ? company.name : t('delivery'))),
    icon: 'chat',
    sub: DS.lang() === 'en'
      ? 'Support, stores and delivery — one clean inbox.'
      : 'الدعم والمتاجر والتوصيل — صندوق واحد مرتب.',
    actions: '<span class="badge lime">' + icon('wifi') + ' ' + esc(t('live')) + '</span>',
    content: '<div class="chat-page-host"><div class="skeleton" style="height:min(72vh,720px);border-radius:24px"></div></div>'
  });
  if (!page) return;

  page.setContent('<div data-dispatch-host></div><div class="chat-page-host" data-chat-host></div>');
  var host = page.body.querySelector('[data-chat-host]');
  if (!host || !DS.chat) { page.setContent(DS.empty({ icon: 'chat', title: t('noData') })); return; }

  /* Delivery company owner: a compact dispatch inbox above the chat —
     riders on one side, live orders on the other. */
  function renderDispatch() {
    var dhost = page.body.querySelector('[data-dispatch-host]');
    if (!dhost) return;
    if (!company || !DS.data.isCompanyOwner || !DS.data.isCompanyOwner(user)) { dhost.innerHTML = ''; return; }
    var EN = DS.lang() === 'en';
    var riders = (DS.data.companyDrivers(user.delivery_company) || []).filter(function (u) { return DS.data.isRider(u); });
    var orders = DS.data.visibleOrders(user).filter(function (o) { return DS.isActiveOrderStatus(o.status); })
      .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var load = {};
    orders.forEach(function (o) { if (o.driver_id) load[o.driver_id] = (load[o.driver_id] || 0) + 1; });

    var riderRows = riders.length ? riders.map(function (d) {
      return '<button type="button" class="dispatch-person" data-team-chat="' + esc(d.id) + '">' +
        '<img class="avatar sm" src="' + esc(DS.avatarUrl(d)) + '" alt="">' +
        '<span class="dispatch-person-copy"><b>' + esc(DS.loc(d, 'name')) + '</b>' +
          '<small>' + esc(d.online === false ? t('offline') : t('online')) + ' · ' + (load[d.id] || 0) + ' ' + esc(t('orders')) + '</small></span>' +
        '<span class="dispatch-person-ico">' + icon('chat') + '</span></button>';
    }).join('') : '<div class="dispatch-empty">' + esc(t('noCompanyDrivers')) + '</div>';

    var orderRows = orders.length ? orders.map(function (o) {
      var hasDriver = !!o.driver_id;
      return '<div class="dispatch-order-row">' +
        '<div class="dispatch-order-info"><b>' + esc(o.order_no) + ' · ' + esc(o.customer ? DS.loc(o.customer, 'name') : t('customerLabel')) + '</b>' +
          '<small>' + DS.badge(o.status, DS.statusMeta(o.status).label) + ' · ' + esc(o.driver_name || t('noDriverAssigned')) + '</small></div>' +
        '<div class="dispatch-order-actions">' +
          '<button type="button" class="btn btn-secondary btn-sm" data-customer-chat="' + esc(o.id) + '">' + icon('chat') + esc(EN ? 'Customer' : 'العميل') + '</button>' +
          (hasDriver ? '<button type="button" class="btn btn-ghost btn-sm" data-monitor-chat="' + esc(o.id) + '">' + icon('eye') + esc(EN ? 'Monitor' : 'مراقبة') + '</button>' : '') +
        '</div></div>';
    }).join('') : '<div class="dispatch-empty">' + esc(t('noData')) + '</div>';

    dhost.innerHTML = '<div class="dispatch-inbox glass-card">' +
      '<div class="dispatch-col"><div class="dispatch-col-head">' + icon('users') + '<b>' + esc(t('companyDriversList')) + '</b><span class="badge lime">' + riders.length + '</span></div>' + riderRows + '</div>' +
      '<div class="dispatch-col"><div class="dispatch-col-head">' + icon('orders') + '<b>' + esc(t('activeDispatchOrders')) + '</b><span class="badge lime">' + orders.length + '</span></div>' + orderRows + '</div>' +
    '</div>';

    DS.$$('[data-team-chat]', dhost).forEach(function (b) { b.addEventListener('click', function () { if (DS.openTeamChat) DS.openTeamChat(b.getAttribute('data-team-chat')); }); });
    DS.$$('[data-customer-chat]', dhost).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = orders.filter(function (x) { return x.id === b.getAttribute('data-customer-chat'); })[0];
        if (o && DS.openCustomerChat) DS.openCustomerChat(o);
      });
    });
    DS.$$('[data-monitor-chat]', dhost).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = orders.filter(function (x) { return x.id === b.getAttribute('data-monitor-chat'); })[0];
        if (o && DS.openMonitorChat) DS.openMonitorChat(o);
      });
    });
  }
  renderDispatch();
  window.addEventListener('ds:data', function () { setTimeout(renderDispatch, 80); });
  window.addEventListener('ds:order-updated', function () { setTimeout(renderDispatch, 80); });

  var chat = DS.chat.mount(host, { mode: 'full', scope: scope });
  document.addEventListener('ds:lang', function () { if (chat) chat.refresh(); });
})();
