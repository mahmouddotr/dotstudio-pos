/* DotStudio® POS — Orders (admin / owner / cashier) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url, money = DS.money;
  var user = DS.session();
  if (!user) return;
  var isAdmin = DS.data.isAdmin(user);
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : ['owner', 'cashier'],
    permission: user.role === 'subadmin' ? 'orders' : null,
    active: 'orders',
    title: t('orders'),
    eyebrow: isAdmin ? t('admin') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'orders',
    sub: DS.lang() === 'en' ? 'Every order with items, customer, payment, proof and timeline.' : 'كل طلب بتفاصيله الكاملة: المنتجات، العميل، الدفع، الإثبات والمراحل.',
    actions: '<button class="btn btn-secondary" data-export>' + icon('download') + esc(t('exportCsv')) + '</button>' +
      '<button class="btn btn-primary" data-refresh>' + icon('refresh') + esc(t('refresh')) + '</button>',
    content: DS.skeleton.rows(9)
  });
  if (!page) return;

  var state = { q: '', status: '', store: '', range: 'all' };

  function visible() { return DS.data.visibleOrders(user); }

  function filtered() {
    var list = visible().slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var q = state.q.trim().toLowerCase();
    return list.filter(function (o) {
      if (state.status && o.status !== state.status) return false;
      if (isAdmin && state.store && o.tenant_id !== state.store) return false;
      if (state.range !== 'all') {
        var days = Number(state.range);
        if ((Date.now() - new Date(o.created_at).getTime()) / 86400000 > days) return false;
      }
      if (q) {
        var hay = (o.order_no + ' ' + (o.customer ? o.customer.name + ' ' + o.customer.phone : '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function render() {
    var all = visible();
    var list = filtered();
    var revenue = DS.data.revenueOf(all);
    var pending = all.filter(function (o) { return o.status === 'pending'; }).length;
    var active = all.filter(function (o) { return ['confirmed', 'preparing', 'delivering'].indexOf(o.status) > -1; }).length;

    var stats = '<div class="kpi-grid">' +
      stat(t('totalOrdersLabel'), String(all.length), 'orders', 'lime', all.filter(function (o) { return o.status === 'delivered'; }).length + ' ' + t('delivered')) +
      stat(t('pendingNow'), String(pending), 'clock', pending ? 'orange' : 'green', t('pending')) +
      stat(t('activeOrders'), String(active), 'bike', 'info', t('delivering') + ': ' + all.filter(function (o) { return o.status === 'delivering'; }).length) +
      stat(t('revenue'), money(revenue), 'wallet', 'purple', t('delivered') + ' ' + t('orders')) +
    '</div>';

    var toolbar = '<div class="card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div class="search-mini" style="flex:1;min-width:220px">' + icon('search') + '<input data-q placeholder="' + esc(t('search')) + ' #ORD / ' + esc(t('customerLabel')) + '" value="' + esc(state.q) + '"></div>' +
      '<select class="select" data-status style="width:auto;min-width:150px"><option value="">' + esc(t('allStatuses')) + '</option>' +
        DS.statusFlow.concat(['cancelled']).map(function (s) { return '<option value="' + s + '"' + (state.status === s ? ' selected' : '') + '>' + esc(DS.statusMeta(s).label) + '</option>'; }).join('') + '</select>' +
      (isAdmin ? '<select class="select" data-store style="width:auto;min-width:150px"><option value="">' + esc(t('allStores')) + '</option>' +
        DS.data.tenants.map(function (tn) { return '<option value="' + tn.id + '"' + (state.store === tn.id ? ' selected' : '') + '>' + esc(tn.name) + '</option>'; }).join('') + '</select>' : '') +
      '<select class="select" data-range style="width:auto;min-width:130px"><option value="all">' + esc(t('all')) + '</option><option value="1"' + (state.range === '1' ? ' selected' : '') + '>' + esc(t('today')) + '</option><option value="7"' + (state.range === '7' ? ' selected' : '') + '>' + esc(t('last7')) + '</option><option value="30"' + (state.range === '30' ? ' selected' : '') + '>' + esc(t('last30')) + '</option></select>' +
    '</div></div>';

    var table = '<div class="card order-list-card"><div class="table-wrap flush"><table class="table"><thead><tr>' +
      '<th>' + esc(t('orderId')) + '</th><th>' + esc(t('customerLabel')) + '</th>' + (isAdmin ? '<th>' + esc(t('store')) + '</th>' : '') +
      '<th>' + esc(t('items')) + '</th><th>' + esc(t('total')) + '</th><th>' + esc(t('paymentMethod')) + '</th><th>' + esc(t('status')) + '</th><th>' + esc(t('proof')) + '</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(function (o) {
        var meta = DS.statusMeta(o.status);
        var tn = DS.data.tenantById(o.tenant_id);
        return '<tr data-order="' + esc(o.id) + '" style="cursor:pointer"><td><div class="cell-title" style="direction:ltr;text-align:start;font-family:var(--font-mono);font-size:11px">' + esc(o.order_no) + '</div><div class="cell-sub">' + esc(DS.datetime(o.created_at)) + '</div></td>' +
          '<td><div class="customer-cell"><span class="avatar sm" style="background:var(--surface-3);color:var(--lime)">' + esc(DS.initials(o.customer ? DS.loc(o.customer, 'name') : '?')) + '</span><div><div class="cell-title">' + esc(o.customer ? DS.loc(o.customer, 'name') : '—') + '</div><div class="cell-sub" style="direction:ltr;text-align:start">' + esc(o.customer ? o.customer.phone : '') + '</div></div></div></td>' +
          (isAdmin ? '<td><span class="badge neutral">' + esc(tn ? tn.name : '—') + '</span></td>' : '') +
          '<td>' + (o.items || []).reduce(function (s, i) { return s + i.qty; }, 0) + '</td>' +
          '<td><b>' + money(o.total) + '</b></td>' +
          '<td><span class="badge neutral">' + esc(t(o.payment_method || 'cash')) + '</span></td>' +
          '<td>' + DS.badge(o.status, meta.label) + '</td>' +
          '<td>' + DS.proofThumb(o) + '</td>' +
          '<td style="text-align:end"><button class="btn btn-ghost btn-sm" data-open="' + esc(o.id) + '">' + icon('eye') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="' + (isAdmin ? 9 : 8) + '">' + DS.empty({ icon: 'orders', title: t('emptyOrders'), text: t('emptyOrdersText') }) + '</td></tr>') +
      '</tbody></table></div><div class="table-foot"><span>' + esc(t('showing')) + ' ' + list.length + ' ' + esc(t('of')) + ' ' + all.length + ' ' + esc(t('results')) + '</span></div></div>';

    page.setContent(stats + toolbar + table);
    bind();
  }

  function stat(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div><div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }

  function bind() {
    var q = page.body.querySelector('[data-q]');
    if (q) q.addEventListener('input', DS.debounce(function () { state.q = q.value; render(); }, 170));
    var st = page.body.querySelector('[data-status]');
    if (st) st.addEventListener('change', function () { state.status = st.value; render(); });
    var store = page.body.querySelector('[data-store]');
    if (store) store.addEventListener('change', function () { state.store = store.value; render(); });
    var range = page.body.querySelector('[data-range]');
    if (range) range.addEventListener('change', function () { state.range = range.value; render(); });
    DS.$$('[data-order]', page.body).forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        DS.openOrder(row.getAttribute('data-order'));
      });
    });
    DS.$$('[data-open]', page.body).forEach(function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); DS.openOrder(b.getAttribute('data-open')); });
    });
    DS.$$('[data-proof]', page.body).forEach(function (img) {
      img.addEventListener('click', function (e) { e.stopPropagation(); DS.openOrder(img.getAttribute('data-proof')); });
    });
    var ex = page.body.querySelector('[data-export]') || document.querySelector('[data-export]');
    if (ex) ex.addEventListener('click', function () {
      var rows = [['Order', 'Date', 'Customer', 'Phone', 'Store', 'Items', 'Total', 'Payment', 'Status']];
      filtered().forEach(function (o) {
        rows.push([o.order_no, o.created_at, o.customer ? o.customer.name : '', o.customer ? o.customer.phone : '', o.tenant_id, o.items.length, o.total, o.payment_method, o.status]);
      });
      DS.download('dotstudio-orders.csv', DS.csv(rows));
      DS.toast(t('saved'), 'success');
    });
  }

  var refresh = page.root.querySelector('[data-refresh]');
  if (refresh) refresh.addEventListener('click', function () { render(); DS.toast(t('updated'), 'success'); });

  window.addEventListener('ds:order-updated', render);
  window.addEventListener('ds:data-changed', render);
  setTimeout(render, 170);
})();
