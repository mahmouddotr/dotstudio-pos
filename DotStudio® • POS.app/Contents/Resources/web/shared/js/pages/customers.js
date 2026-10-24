/* DotStudio® POS — Customers */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;
  var user = DS.session();
  if (!user) return;
  var isAdmin = DS.data.isAdmin(user);
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : ['owner', 'cashier'],
    permission: user.role === 'subadmin' ? 'customers' : null,
    active: 'customers',
    title: t('customers'),
    eyebrow: isAdmin ? t('admin') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'users',
    sub: DS.lang() === 'en' ? 'Everyone who ordered, their history and lifetime value.' : 'كل من طلب من متجرك، سجله وقيمته الإجمالية.',
    content: DS.skeleton.rows(8)
  });
  if (!page) return;

  var state = { q: '', sort: 'spent' };

  function list() {
    var rows = DS.data.customersFor(user);
    var q = state.q.trim().toLowerCase();
    rows = rows.filter(function (c) { return !q || (c.name + ' ' + c.phone + ' ' + c.city).toLowerCase().indexOf(q) > -1; });
    rows.sort(function (a, b) { return state.sort === 'orders' ? b.orders - a.orders : state.sort === 'recent' ? new Date(b.last_order) - new Date(a.last_order) : b.spent - a.spent; });
    return rows;
  }

  function render() {
    var all = DS.data.customersFor(user);
    var rows = list();
    var totalSpent = all.reduce(function (s, c) { return s + c.spent; }, 0);
    var avg = all.length ? totalSpent / all.length : 0;

    var stats = '<div class="kpi-grid">' +
      stat(t('totalCustomers'), all.length, 'users', 'lime') +
      stat(t('totalSpent'), money(totalSpent), 'wallet', 'green') +
      stat(t('avgBasket'), money(avg), 'receipt', 'info') +
      stat(t('returning'), all.filter(function (c) { return c.orders > 1; }).length, 'refresh', 'purple') + '</div>';

    var toolbar = '<div class="card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div class="search-mini" style="flex:1;min-width:220px">' + icon('search') + '<input data-q placeholder="' + esc(t('search')) + ' ' + esc(t('name')) + ' / ' + esc(t('phone')) + '" value="' + esc(state.q) + '"></div>' +
      '<select class="select" data-sort style="width:auto"><option value="spent"' + (state.sort === 'spent' ? ' selected' : '') + '>' + esc(t('spent')) + '</option><option value="orders"' + (state.sort === 'orders' ? ' selected' : '') + '>' + esc(t('ordersCount')) + '</option><option value="recent"' + (state.sort === 'recent' ? ' selected' : '') + '>' + esc(t('lastOrder')) + '</option></select></div></div>';

    var table = '<div class="card"><div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(t('customerLabel')) + '</th><th>' + esc(t('city')) + '</th><th>' + esc(t('ordersCount')) + '</th><th>' + esc(t('spent')) + '</th><th>' + esc(t('lastOrder')) + '</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (c) {
        return '<tr data-customer="' + esc(c.id) + '" style="cursor:pointer"><td><div class="customer-cell"><span class="avatar sm" style="background:var(--surface-3);color:var(--lime)">' + esc(DS.initials(DS.loc(c, 'name'))) + '</span>' +
          '<div><div class="cell-title">' + esc(DS.loc(c, 'name')) + '</div><div class="cell-sub" style="direction:ltr;text-align:start">' + esc(c.phone) + '</div></div></div></td>' +
          '<td><span class="badge neutral">' + esc(DS.loc(c, 'city') || '—') + '</span></td>' +
          '<td>' + c.orders + '</td><td><b>' + money(c.spent) + '</b></td>' +
          '<td style="font-size:11px;color:var(--text-tertiary)">' + esc(DS.timeAgo(c.last_order)) + '</td>' +
          '<td style="text-align:end"><button class="btn btn-ghost btn-sm" data-open="' + esc(c.id) + '">' + icon('eye') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="6">' + DS.empty({ icon: 'users', title: t('emptyCustomers'), text: t('emptyCustomersText') }) + '</td></tr>') +
      '</tbody></table></div><div class="table-foot"><span>' + esc(t('showing')) + ' ' + rows.length + ' ' + esc(t('of')) + ' ' + all.length + '</span></div></div>';

    page.setContent(stats + toolbar + table);
    bind();
  }

  function stat(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div></div>';
  }

  function bind() {
    var q = page.body.querySelector('[data-q]');
    if (q) q.addEventListener('input', DS.debounce(function () { state.q = q.value; render(); }, 160));
    var sort = page.body.querySelector('[data-sort]');
    if (sort) sort.addEventListener('change', function () { state.sort = sort.value; render(); });
    DS.$$('[data-customer]', page.body).forEach(function (row) { row.addEventListener('click', function () { detail(row.getAttribute('data-customer')); }); });
    DS.$$('[data-open]', page.body).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); detail(b.getAttribute('data-open')); }); });
  }

  function detail(id) {
    var c = list().filter(function (x) { return x.id === id; })[0] || DS.data.customersFor(user).filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var orders = DS.data.visibleOrders(user).filter(function (o) { return o.customer && o.customer.phone === c.phone; }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var body = '<div class="order-details-grid" style="margin-bottom:14px">' +
      '<div class="order-detail-box"><div class="l">' + esc(t('phone')) + '</div><div class="v" style="direction:ltr;text-align:start">' + esc(c.phone) + '</div></div>' +
      '<div class="order-detail-box"><div class="l">' + esc(t('city')) + '</div><div class="v">' + esc(DS.loc(c, 'city') || '—') + '</div></div>' +
      '<div class="order-detail-box"><div class="l">' + esc(t('ordersCount')) + '</div><div class="v">' + c.orders + '</div></div>' +
      '<div class="order-detail-box"><div class="l">' + esc(t('totalSpent')) + '</div><div class="v" style="color:var(--lime)">' + money(c.spent) + '</div></div>' +
      '</div>' +
      '<div class="order-detail-box" style="margin-bottom:14px"><div class="l">' + esc(t('address')) + '</div><div class="v" style="font-weight:500;color:var(--text-secondary)">' + esc(DS.loc(c, 'address') || '—') + '</div></div>' +
      '<div class="section-title" style="font-size:var(--fs-md);margin-bottom:8px">' + icon('orders') + esc(t('orders')) + '</div>' +
      '<div class="table-wrap"><table class="table table-compact"><thead><tr><th>' + esc(t('orderId')) + '</th><th>' + esc(t('total')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('date')) + '</th></tr></thead><tbody>' +
      (orders.length ? orders.map(function (o) {
        return '<tr data-open-order="' + esc(o.id) + '" style="cursor:pointer"><td style="direction:ltr;font-family:var(--font-mono);font-size:11px">' + esc(o.order_no) + '</td><td><b>' + money(o.total) + '</b></td><td>' + DS.badge(o.status, DS.statusMeta(o.status).label) + '</td><td style="font-size:11px;color:var(--text-tertiary)">' + esc(DS.date(o.created_at)) + '</td></tr>';
      }).join('') : '<tr><td colspan="4">' + DS.empty({ icon: 'orders', title: t('emptyOrders'), text: t('emptyOrdersText') }) + '</td></tr>') +
      '</tbody></table></div>';
    DS.modal({
      title: esc(c.name), sub: esc(c.phone) + ' · ' + esc(t('customerLabel')),
      size: 'lg', body: body,
      actions: [
        { label: t('contactWhatsapp'), variant: 'btn-success', icon: icon('whatsapp'), close: true, onClick: function () { window.open('https://wa.me/2' + String(c.phone).replace(/^0/, '') + '?text=' + encodeURIComponent(DS.lang() === 'en' ? 'Hello ' + c.name + ' 👋 How can we help?' : 'مرحباً ' + c.name + ' 👋 كيف نقدر نساعدك؟'), '_blank', 'noopener'); } },
        { label: t('close'), variant: 'btn-secondary' }
      ],
      onMount: function (root) {
        root.querySelectorAll('[data-open-order]').forEach(function (tr) {
          tr.addEventListener('click', function () { DS.openOrder(tr.getAttribute('data-open-order')); });
        });
      }
    });
  }

  setTimeout(render, 170);
})();
