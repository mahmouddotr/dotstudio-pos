/* DotStudio® POS — Reports */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;
  var user = DS.session();
  if (!user) return;
  var isAdmin = DS.data.isAdmin(user);
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : ['owner'],
    permission: user.role === 'subadmin' ? 'reports' : null,
    active: 'reports',
    title: t('reports'),
    eyebrow: isAdmin ? t('admin') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'chart',
    sub: DS.lang() === 'en' ? 'Revenue, categories and product performance — export ready.' : 'الإيرادات والفئات وأداء المنتجات — جاهزة للتصدير.',
    actions: '<button class="btn btn-secondary" data-export>' + icon('download') + esc(t('exportCsv')) + '</button>',
    content: DS.skeleton.cards(4)
  });
  if (!page) return;

  var range = 7;
  function scoped(tenantId) { return tenantId ? DS.data.ordersByTenant(tenantId) : DS.data.orders.slice(); }

  function render() {
    var tid = isAdmin ? null : user.tenant_id;
    var orders = scoped(tid);
    var series = DS.data.series(range, tid);
    var sk = DS.data.statsFor(tid);
    var cats = DS.data.categoryBreakdown(tid).slice(0, 6).map(function (c) { return { label: DS.lang() === 'en' ? (c.name_en || c.name) : c.name, value: c.value }; });
    var tops = DS.data.topProducts(tid, 6);
    var tenants = DS.data.tenants.map(function (tn) {
      var s = DS.data.statsFor(tn.id);
      return { tn: tn, s: s };
    }).sort(function (a, b) { return b.s.revenue - a.s.revenue; });
    var seriesTotal = series.reduce(function (a, x) { return a + x.value; }, 0);

    var stats = '<div class="kpi-grid">' +
      stat(t('totalRevenue'), money(sk.revenue), 'trendingUp', 'lime', t('delivered') + ': ' + sk.delivered) +
      stat(t('profit'), money(sk.profit), 'wallet', 'green', Math.round(sk.revenue ? (sk.profit / sk.revenue) * 100 : 0) + '% ' + (DS.lang() === 'en' ? 'margin' : 'هامش')) +
      stat(t('avgOrder'), money(sk.avgOrder), 'receipt', 'info', t('orders') + ': ' + sk.orders) +
      stat(t('cancelled'), String(sk.cancelled), 'x', sk.cancelled ? 'red' : 'green', Math.round(sk.orders ? (sk.cancelled / sk.orders) * 100 : 0) + '%') + '</div>';

    var chart = '<div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('salesOverview')) + '</div><div class="card-subtitle">' + range + ' ' + esc(DS.lang() === 'en' ? 'days' : 'يوم') + ' · ' + money(seriesTotal) + '</div></div>' +
      '<div class="segmented" data-range><button class="' + (range === 7 ? 'active' : '') + '" data-days="7">7</button><button class="' + (range === 30 ? 'active' : '') + '" data-days="30">30</button></div></div>' +
      '<div class="card-body">' + DS.chart.area(series) + '</div></div>';

    var breakdown = '<div class="two-col"><div class="card"><div class="card-header"><div class="card-title">' + esc(t('revenueSplit')) + '</div></div><div class="card-body">' + DS.chart.donut(cats, { label: t('category'), center: cats.length }) + '</div></div>' +
      '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('topProducts')) + '</div></div><div class="card-body">' +
      DS.chart.bars(tops.map(function (p) { return { label: DS.lang() === 'en' ? (p.name_en || p.name) : p.name, value: p.revenue, display: money(p.revenue) + ' · ' + p.qty + ' ' + t('units') }; })) + '</div></div></div>';

    var table = isAdmin
      ? '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('topStores')) + '</div></div><div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(t('store')) + '</th><th>' + esc(t('orders')) + '</th><th>' + esc(t('revenue')) + '</th><th>' + esc(t('avgOrder')) + '</th><th>' + esc(t('growth')) + '</th></tr></thead><tbody>' +
        tenants.map(function (x) {
          return '<tr><td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(x.tn)) + '" alt=""><div><div class="cell-title">' + esc(x.tn.name) + '</div><div class="cell-sub">' + esc(DS.loc(x.tn, 'industry')) + '</div></div></div></td>' +
            '<td>' + x.s.orders + '</td><td><b>' + money(x.s.revenue) + '</b></td><td>' + money(x.s.avgOrder) + '</td>' +
            '<td><span class="badge ' + (x.s.monthRevenue > 0 ? 'success' : 'neutral') + '">' + (x.s.monthRevenue > 0 ? '+' : '') + Math.round(x.s.monthRevenue / (x.s.revenue || 1) * 100) + '%</span></td></tr>';
        }).join('') + '</tbody></table></div></div>'
      : '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('topProducts')) + '</div></div><div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(t('products')) + '</th><th>' + esc(t('quantity')) + '</th><th>' + esc(t('revenue')) + '</th><th>' + esc(t('stock')) + '</th></tr></thead><tbody>' +
        tops.map(function (p) {
          var full = DS.data.products.filter(function (x) { return x.id === p.id; })[0] || {};
          return '<tr><td><div class="customer-cell"><img class="avatar sm" style="border-radius:7px" src="' + esc(DS.data.img(p.image)) + '" alt=""><div><div class="cell-title">' + esc(DS.lang() === 'en' ? (p.name_en || p.name) : p.name) + '</div></div></div></td>' +
            '<td>' + p.qty + '</td><td><b>' + money(p.revenue) + '</b></td><td><span class="badge ' + (full.stock <= (full.min_stock || 0) ? 'warning' : 'success') + '">' + (full.stock || 0) + '</span></td></tr>';
        }).join('') + '</tbody></table></div></div>';

    page.setContent(stats + chart + breakdown + table);
    bind();
  }

  function stat(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:24px">' + value + '</div><div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }

  function bind() {
    DS.$$('[data-days]', page.body).forEach(function (b) { b.addEventListener('click', function () { range = Number(b.getAttribute('data-days')); render(); }); });
  }

  var ex = page.root.querySelector('[data-export]');
  if (ex) ex.addEventListener('click', function () {
    var tid = isAdmin ? null : user.tenant_id;
    var rows = [['Order', 'Date', 'Store', 'Customer', 'Items', 'Subtotal', 'Discount', 'Delivery', 'Total', 'Status']];
    scoped(tid).forEach(function (o) {
      rows.push([o.order_no, o.created_at, o.tenant_id, o.customer ? o.customer.name : '', o.items.length, o.subtotal, o.discount, o.delivery_fee, o.total, o.status]);
    });
    DS.download('dotstudio-report.csv', DS.csv(rows));
    DS.toast(t('saved'), 'success');
  });

  setTimeout(render, 160);
})();
