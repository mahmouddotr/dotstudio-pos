/* DotStudio® POS — Dashboard (admin + owner) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url, money = DS.money;

  var user = DS.session();
  if (!user) return;
  var isAdmin = user.role === 'superadmin' || user.role === 'subadmin';
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : ['owner'],
    active: 'dashboard',
    title: isAdmin ? t('platformOverview') : t('dashboard'),
    eyebrow: isAdmin ? t('admin') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'dashboard',
    sub: isAdmin ? (DS.lang() === 'en' ? 'A live pulse of every store, order and delivery on the platform.' : 'نبض لحظي لكل متجر وطلب وتوصيل على المنصة.')
      : (DS.lang() === 'en' ? 'Your store performance, orders and stock at a glance.' : 'أداء متجرك وطلباتك ومخزونك في شاشة واحدة.'),
    content: '<div class="kpi-grid">' + DS.skeleton.cards(4) + '</div><div class="two-col">' + DS.skeleton.rows(5) + DS.skeleton.rows(4) + '</div>'
  });
  if (!page) return;

  var range = 7;

  function greeting() {
    var h = new Date().getHours();
    if (DS.lang() === 'en') return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return h < 12 ? 'صباح الخير' : h < 18 ? 'مساء الخير' : 'مساء النور';
  }

  function tenantStats(tn) {
    var s = DS.data.statsFor(tn.id);
    return s;
  }

  function revenueSplit() {
    var rows = DS.data.tenants.map(function (tn) {
      var orders = DS.data.ordersByTenant(tn.id);
      return { name: tn.name, value: DS.data.revenueOf(orders) };
    }).filter(function (r) { return r.value > 0; });
    return rows.length ? rows : [{ name: t('noData'), value: 1 }];
  }

  function ownerRender() {
    var tn = DS.data.tenantById(user.tenant_id);
    var s = DS.data.statsFor(user.tenant_id);
    var series = DS.data.series(range, user.tenant_id);
    var tops = DS.data.topProducts(user.tenant_id, 5);
    var orders = DS.data.visibleOrders(user).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var low = DS.data.visibleProducts(user).filter(function (p) { return p.stock <= p.min_stock; }).slice(0, 5);
    var sub = DS.data.activeSubscription(user.tenant_id);
    var active = orders.filter(function (o) { return o.status === 'delivering'; })[0];
    var seriesTotal = series.reduce(function (a, x) { return a + x.value; }, 0);

    return '<div class="welcome-card"><div class="welcome-copy">' +
      '<span class="welcome-kicker">' + icon('sparkles') + esc(greeting()) + ' · ' + esc(user.name) + '</span>' +
      '<div class="welcome-title">' + esc(DS.lang() === 'en' ? 'Your store is running smoothly.' : 'متجرك شغّال بكفاءة.') + '</div>' +
      '<div class="welcome-sub">' + esc(DS.lang() === 'en'
        ? 'You have ' + s.active + ' active orders and ' + s.todayOrders + ' orders today. Keep the momentum going.'
        : 'لديك ' + s.active + ' طلبات جارية و' + s.todayOrders + ' طلبات اليوم. كمّل بنفس القوة.') + '</div>' +
      '<div class="welcome-actions">' +
        '<button class="btn btn-primary" data-add-product>' + icon('plus') + esc(t('addProduct')) + '</button>' +
        '<a class="btn btn-secondary" href="' + url('owner/orders.html') + '">' + icon('orders') + esc(t('orders')) + '</a>' +
        '<a class="btn btn-ghost" href="' + url('customer/storefront.html') + '" target="_blank" rel="noopener">' + icon('store') + esc(t('viewStore')) + '</a>' +
      '</div></div><div class="welcome-stats">' +
        '<div class="welcome-stat"><div class="v">' + money(s.monthRevenue) + '</div><div class="l">' + esc(t('thisMonthRevenue')) + '</div></div>' +
        '<div class="welcome-stat"><div class="v">' + s.active + '</div><div class="l">' + esc(t('activeOrders')) + '</div></div>' +
        '<div class="welcome-stat"><div class="v">' + (tn ? tn.rating : '4.8') + '</div><div class="l">' + esc(t('rating')) + '</div></div>' +
      '</div></div>' +

      (sub && sub.daysLeft <= 15 ? '<div class="notice warning" style="display:flex;align-items:center;gap:10px">' + icon('alert') +
        '<div style="flex:1"><b>' + esc(t('expiringSoon')) + '</b> · ' + esc(t('daysRemaining')) + ': ' + Math.max(0, sub.daysLeft) + '</div>' +
        '<a class="btn btn-primary btn-sm" href="' + url('owner/subscriptions.html') + '">' + icon('whatsapp') + esc(t('renew')) + '</a></div>' : '') +

      '<div class="kpi-grid">' +
        statCard(t('monthRevenue'), money(s.monthRevenue), 'chart', 'lime', '+' + s.monthOrders + ' ' + t('orders')) +
        statCard(t('ordersToday'), String(s.todayOrders), 'orders', 'info', t('activeOrders') + ': ' + s.active) +
        statCard(t('avgOrder'), money(s.avgOrder), 'receipt', 'purple', t('delivered') + ': ' + s.delivered) +
        statCard(t('lowStock'), String(s.lowStock), 'box', s.lowStock ? 'orange' : 'green', t('products') + ': ' + s.products) +
      '</div>' +

      '<div class="two-col"><div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('salesOverview')) + '</div><div class="card-subtitle">' + esc(t('last7')) + ' · ' + money(seriesTotal) + '</div></div>' +
        '<div class="segmented" data-range><button class="' + (range === 7 ? 'active' : '') + '" data-days="7">7</button><button class="' + (range === 30 ? 'active' : '') + '" data-days="30">30</button></div></div>' +
        '<div class="card-body">' + DS.chart.area(series) + '</div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('revenueSplit')) + '</div></div><div class="card-body">' +
          DS.chart.donut(DS.data.categoryBreakdown(user.tenant_id).slice(0, 5).map(function (c) { return { label: c.name, value: c.value }; }), { label: t('category'), center: DS.data.categoryBreakdown(user.tenant_id).length }) +
        '</div></div></div>' +

      '<div class="two-col"><div class="card order-list-card"><div class="card-header"><div class="card-title">' + esc(t('recentOrders')) + '</div>' +
        '<a class="btn btn-ghost btn-sm" href="' + url('owner/orders.html') + '">' + esc(t('viewAll')) + icon('arrowRight') + '</a></div>' +
        '<div class="table-wrap flush"><table class="table table-compact"><thead><tr><th>' + esc(t('orderId')) + '</th><th>' + esc(t('customerLabel')) + '</th><th>' + esc(t('total')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        (orders.length ? orders.slice(0, 6).map(orderRow).join('') : '<tr><td colspan="4">' + DS.empty({ icon: 'orders', title: t('emptyOrders'), text: t('emptyOrdersText') }) + '</td></tr>') +
        '</tbody></table></div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('topProducts')) + '</div></div><div class="card-body">' +
          (tops.length ? tops.map(function (p, i) {
            return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border-soft)">' +
              '<span style="font-family:var(--font-display);font-weight:700;color:var(--text-tertiary);width:16px">' + (i + 1) + '</span>' +
              '<img src="' + esc(DS.data.img(p.image)) + '" alt="" style="width:34px;height:34px;border-radius:8px;object-fit:cover">' +
              '<div style="flex:1;min-width:0"><div class="truncate" style="font-size:12px;font-weight:600">' + esc(DS.lang() === 'en' ? (p.name_en || p.name) : p.name) + '</div>' +
              '<div style="font-size:10px;color:var(--text-tertiary)">' + p.qty + ' ' + esc(t('units')) + '</div></div>' +
              '<b style="font-size:12px">' + money(p.revenue) + '</b></div>';
          }).join('') : DS.empty({ icon: 'box', title: t('emptyProducts'), text: t('emptyProductsText') })) +
        '</div></div></div>' +

      '<div class="two-col">' +
        (active ? '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('liveOrders')) + '</div><a class="btn btn-ghost btn-sm" href="' + url('customer/tracking.html?order=' + active.id) + '">' + esc(t('tracking')) + '</a></div><div class="card-body" data-owner-map></div></div>'
          : '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('lowStock')) + '</div></div><div class="card-body">' +
            (low.length ? low.map(function (p) {
              return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-soft)"><img src="' + esc(DS.data.img(p.image)) + '" style="width:32px;height:32px;border-radius:7px;object-fit:cover" alt="">' +
                '<div style="flex:1;min-width:0"><div class="truncate" style="font-size:12px;font-weight:600">' + esc(p.name) + '</div><div style="font-size:10px;color:var(--text-tertiary)">' + p.stock + ' / ' + p.min_stock + '</div></div>' +
                '<a class="btn btn-ghost btn-sm" href="' + url('owner/products.html') + '">' + esc(t('manage')) + '</a></div>';
            }).join('') : DS.empty({ icon: 'checkCircle', title: t('inStock'), text: DS.lang() === 'en' ? 'All products are above their minimum stock level.' : 'كل المنتجات أعلى من حد المخزون الأدنى.' })) +
            '</div></div>') +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('quickActions')) + '</div></div><div class="card-body"><div class="quick-grid">' +
          quick('plus', t('addProduct'), 'owner/products.html', 'data-add-product') +
          quick('receipt', t('orders'), 'owner/orders.html') +
          quick('chart', t('reports'), 'owner/reports.html') +
          quick('card', t('subscriptions'), 'owner/subscriptions.html') +
          quick('cashier', t('cashiers'), 'owner/cashiers.html') +
          quick('truck', t('delivery-companies'), 'owner/delivery-companies.html') +
        '</div></div></div></div>';
  }

  function adminRender() {
    var s = DS.data.platformStats();
    var series = DS.data.series(range);
    var split = revenueSplit();
    var orders = DS.data.orders.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var tops = DS.data.topProducts(null, 5);
    var logs = DS.data.auditLogs.slice(0, 6);
    var tenants = DS.data.tenants.map(function (tn) {
      var ts = tenantStats(tn);
      return { tn: tn, s: ts };
    }).sort(function (a, b) { return b.s.revenue - a.s.revenue; });

    return '<div class="welcome-card"><div class="welcome-copy">' +
      '<span class="welcome-kicker">' + icon('sparkles') + esc(greeting()) + ' · ' + esc(user.name) + '</span>' +
      '<div class="welcome-title">' + esc(DS.lang() === 'en' ? 'The whole platform, in one place.' : 'المنصة كاملة، في مكان واحد.') + '</div>' +
      '<div class="welcome-sub">' + esc(DS.lang() === 'en'
        ? tenants.length + ' stores, ' + s.active + ' live orders and ' + money(s.monthRevenue) + ' revenue this month.'
        : tenants.length + ' متاجر، ' + s.active + ' طلب جاري، و' + money(s.monthRevenue) + ' إيرادات هذا الشهر.') + '</div>' +
      '<div class="welcome-actions">' +
        '<a class="btn btn-primary" href="' + url('admin/stores.html') + '">' + icon('store') + esc(t('stores')) + '</a>' +
        '<a class="btn btn-secondary" href="' + url('admin/orders.html') + '">' + icon('orders') + esc(t('orders')) + '</a>' +
        '<a class="btn btn-ghost" href="' + url('admin/reports.html') + '">' + icon('chart') + esc(t('reports')) + '</a>' +
      '</div></div><div class="welcome-stats">' +
        '<div class="welcome-stat"><div class="v">' + money(s.mrr) + '</div><div class="l">' + esc(t('mrr')) + '</div></div>' +
        '<div class="welcome-stat"><div class="v">' + s.tenants + '</div><div class="l">' + esc(t('totalStores')) + '</div></div>' +
        '<div class="welcome-stat"><div class="v">' + s.users + '</div><div class="l">' + esc(t('users')) + '</div></div>' +
      '</div></div>' +

      '<div class="kpi-grid">' +
        statCard(t('totalRevenue'), money(s.revenue), 'trendingUp', 'lime', t('delivered') + ': ' + s.delivered) +
        statCard(t('totalOrdersLabel'), String(s.orders), 'orders', 'info', t('activeOrders') + ': ' + s.active) +
        statCard(t('totalCustomers'), String(DS.data.customers().length), 'users', 'purple', t('newCustomers') + ': ' + s.todayOrders) +
        statCard(t('mrr'), money(s.mrr), 'card', 'orange', t('arr') + ': ' + money(s.arr)) +
      '</div>' +

      '<div class="two-col"><div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('salesOverview')) + '</div><div class="card-subtitle">' + esc(t('last7')) + '</div></div>' +
        '<div class="segmented" data-range><button class="' + (range === 7 ? 'active' : '') + '" data-days="7">7</button><button class="' + (range === 30 ? 'active' : '') + '" data-days="30">30</button></div></div>' +
        '<div class="card-body">' + DS.chart.area(series) + '</div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('revenueSplit')) + '</div><span class="badge lime">' + esc(t('live')) + '</span></div><div class="card-body">' +
          DS.chart.donut(split, { label: t('stores'), center: split.length }) + '</div></div></div>' +

      '<div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('topStores')) + '</div><div class="card-subtitle">' + esc(t('revenue')) + ' · ' + esc(t('orders')) + ' · ' + esc(t('status')) + '</div></div>' +
        '<a class="btn btn-ghost btn-sm" href="' + url('admin/stores.html') + '">' + esc(t('manage')) + icon('arrowRight') + '</a></div>' +
        '<div class="table-wrap flush"><table class="table table-compact"><thead><tr><th>' + esc(t('store')) + '</th><th>' + esc(t('plan')) + '</th><th>' + esc(t('orders')) + '</th><th>' + esc(t('revenue')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        tenants.map(function (x) {
          return '<tr><td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(x.tn)) + '" alt=""><div><div class="cell-title">' + esc(x.tn.name) + '</div><div class="cell-sub">' + esc(DS.loc(x.tn, 'industry')) + '</div></div></div></td>' +
            '<td><span class="badge ' + (x.tn.plan === 'yearly' ? 'lime' : x.tn.plan === 'sixmonths' ? 'info' : 'neutral') + '">' + esc(t(x.tn.plan)) + '</span></td>' +
            '<td>' + x.s.orders + '</td><td><b>' + money(x.s.revenue) + '</b></td>' +
            '<td>' + DS.badge(x.tn.status, t(x.tn.status)) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +

      '<div class="two-col"><div class="card order-list-card"><div class="card-header"><div class="card-title">' + esc(t('recentOrders')) + '</div>' +
        '<a class="btn btn-ghost btn-sm" href="' + url('admin/orders.html') + '">' + esc(t('viewAll')) + icon('arrowRight') + '</a></div>' +
        '<div class="table-wrap flush"><table class="table table-compact"><thead><tr><th>' + esc(t('orderId')) + '</th><th>' + esc(t('customerLabel')) + '</th><th>' + esc(t('total')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        orders.slice(0, 6).map(orderRow).join('') + '</tbody></table></div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('liveActivity')) + '</div><a class="btn btn-ghost btn-sm" href="' + url('admin/audit-logs.html') + '">' + esc(t('viewAll')) + '</a></div>' +
        '<div class="card-body" style="display:flex;flex-direction:column;gap:0">' +
        logs.map(function (l) {
          return '<div style="display:flex;gap:9px;padding:8px 0;border-bottom:1px solid var(--border-soft)">' +
            '<span style="width:28px;height:28px;border-radius:8px;background:var(--surface-2);color:var(--lime);display:grid;place-items:center;flex-shrink:0">' + icon(l.icon) + '</span>' +
            '<div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:500">' + esc(DS.lang() === 'en' ? l.action_en : l.action) + '</div>' +
            '<div style="font-size:10px;color:var(--text-tertiary);margin-top:1px">' + esc(DS.lang() === 'en' ? (l.actor_en || l.actor) : l.actor) + ' · ' + esc(DS.timeAgo(l.at)) + '</div></div></div>';
        }).join('') + '</div></div></div>' +

      '<div class="kpi-grid cols-2"><div class="card"><div class="card-header"><div class="card-title">' + esc(t('topProducts')) + '</div></div><div class="card-body">' +
        DS.chart.bars(tops.map(function (p) { return { label: DS.lang() === 'en' ? (p.name_en || p.name) : p.name, value: p.revenue }; })) + '</div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('quickActions')) + '</div></div><div class="card-body"><div class="quick-grid">' +
          quick('store', t('addStore'), 'admin/stores.html') +
          quick('shield', t('addAdmin'), 'admin/sub-admins.html') +
          quick('cashier', t('cashiers'), 'admin/cashiers.html') +
          quick('jobs', t('jobs'), 'admin/jobs.html') +
          quick('chat', t('chats'), 'admin/chats.html') +
          quick('settings', t('settings'), 'admin/settings.html') +
        '</div></div></div></div>';
  }

  function statCard(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div>' +
      '<div class="stat-value">' + value + '</div><div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }
  function quick(ico, label, href, attr) {
    return '<a class="quick-btn" href="' + url(href) + '" ' + (attr || '') + '><span class="qi">' + icon(ico) + '</span><span>' + esc(label) + '</span></a>';
  }
  function orderRow(o) {
    var meta = DS.statusMeta(o.status);
    return '<tr data-order="' + esc(o.id) + '" style="cursor:pointer"><td><div class="cell-title" style="direction:ltr;text-align:start;font-family:var(--font-mono);font-size:11px">' + esc(o.order_no) + '</div><div class="cell-sub">' + esc(DS.timeAgo(o.created_at)) + '</div></td>' +
      '<td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(DS.data.userByUsername((o.customer && o.customer.phone) === '01123456789' ? 'customer' : 'customer'))) + '" alt=""><div><div class="cell-title">' + esc(DS.loc(o.customer, 'name')) + '</div><div class="cell-sub">' + esc(DS.data.tenantById(o.tenant_id).name) + '</div></div></div></td>' +
      '<td><b>' + money(o.total) + '</b></td><td>' + DS.badge(o.status, meta.label) + '</td></tr>';
  }

  function render() {
    page.setContent(isAdmin ? adminRender() : ownerRender());
    bind();
    if (!isAdmin) {
      var host = page.body.querySelector('[data-owner-map]');
      var active = DS.data.visibleOrders(user).filter(function (o) { return o.status === 'delivering'; })[0];
      if (host && active) DS.gps.mount(host, { order: active, height: 260, showStrip: false });
    }
  }

  function bind() {
    DS.$$('[data-order]', page.body).forEach(function (row) {
      row.addEventListener('click', function () { DS.openOrder(row.getAttribute('data-order')); });
    });
    DS.$$('[data-days]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { range = Number(b.getAttribute('data-days')); render(); });
    });
    DS.$$('[data-add-product]', page.body).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        DS.productModal({ tenantId: isAdmin ? DS.data.tenants[0].id : user.tenant_id, onSave: render });
      });
    });
  }

  window.addEventListener('ds:order-updated', function () { render(); });
  window.addEventListener('ds:data-changed', function () { render(); });
  setTimeout(render, 180);
})();
