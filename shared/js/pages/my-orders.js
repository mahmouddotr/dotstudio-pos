/* DotStudio® POS — Customer order history */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;

  var page = DS.shell.mount({
    roles: ['customer'],
    active: 'my-orders',
    title: t('myOrders'),
    eyebrow: t('store'),
    icon: 'orders',
    sub: DS.lang() === 'en' ? 'Every order you placed, with live status and one-tap reorder.' : 'كل طلب قمت به، بحالته اللحظية وإعادة طلب بلمسة.',
    actions: '<a class="btn btn-primary" href="' + url('customer/storefront.html') + '">' + icon('store') + esc(t('browseStore')) + '</a>',
    content: DS.skeleton.rows(6)
  });
  if (!page) return;

  var state = { status: '', q: '' };

  function orders() {
    return DS.data.visibleOrders(user).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return orders().filter(function (o) {
      if (state.status === 'active' && ['pending', 'confirmed', 'preparing', 'delivering'].indexOf(o.status) === -1) return false;
      if (state.status && state.status !== 'active' && o.status !== state.status) return false;
      if (!q) return true;
      return (o.order_no + ' ' + (o.items || []).map(function (i) { return i.name; }).join(' ')).toLowerCase().indexOf(q) > -1;
    });
  }

  function stat(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div><div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }

  function orderCard(o) {
    var tn = DS.data.tenantById(o.tenant_id) || {};
    var meta = DS.statusMeta(o.status);
    var count = (o.items || []).reduce(function (s, i) { return s + i.qty; }, 0);
    var thumbs = (o.items || []).slice(0, 3).map(function (i) {
      return '<img src="' + esc(DS.data.img(i.image)) + '" alt="" style="width:38px;height:38px;border-radius:8px;object-fit:cover;border:1px solid var(--border);margin-inline-end:-10px;background:var(--surface-2)">';
    }).join('');
    return '<article class="card"><div class="card-body">' +
      '<div style="display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
        '<div style="flex:1;min-width:160px"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b style="font-family:var(--font-mono);font-size:12px;direction:ltr">' + esc(o.order_no) + '</b>' + DS.badge(o.status, meta.label) + '</div>' +
          '<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">' + esc(tn.name || '') + ' · ' + esc(DS.datetime(o.created_at)) + '</div></div>' +
        '<div style="text-align:end"><div style="font-family:var(--font-display);font-size:18px;font-weight:700">' + money(o.total) + '</div><div style="font-size:10px;color:var(--text-tertiary)">' + count + ' ' + esc(t('item')) + '</div></div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:12px;margin-top:12px;flex-wrap:wrap">' +
        '<div style="display:flex;align-items:center">' + thumbs + '<span style="margin-inline-start:14px;font-size:11px;color:var(--text-tertiary)">' + esc((o.items || [])[0] ? (DS.lang() === 'en' ? ((o.items[0].name_en || o.items[0].name)) : o.items[0].name) : '') + ((o.items || []).length > 1 ? ' +' + (o.items.length - 1) : '') + '</span></div>' +
        '<div style="flex:1"></div>' +
        '<button class="btn btn-secondary btn-sm" data-details="' + esc(o.id) + '">' + icon('eye') + esc(t('details')) + '</button>' +
        (['pending', 'confirmed', 'preparing', 'delivering'].indexOf(o.status) > -1
          ? '<a class="btn btn-primary btn-sm" href="' + url('customer/tracking.html?order=' + encodeURIComponent(o.id)) + '">' + icon('mapPin') + esc(t('trackOrder')) + '</a>'
          : '<button class="btn btn-secondary btn-sm" data-reorder="' + esc(o.id) + '">' + icon('refresh') + esc(t('reorder')) + '</button>') +
      '</div>' +
    '</div></article>';
  }

  function render() {
    var all = orders();
    var active = all.filter(function (o) { return ['pending', 'confirmed', 'preparing', 'delivering'].indexOf(o.status) > -1; });
    var delivered = all.filter(function (o) { return o.status === 'delivered'; });
    var spent = delivered.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
    var list = filtered();

    var stats = '<div class="kpi-grid">' +
      stat(t('totalOrders'), String(all.length), 'orders', 'lime', t('all')) +
      stat(t('activeOrders'), String(active.length), 'bike', 'info', t('active')) +
      stat(t('deliveredOrders'), String(delivered.length), 'checkCircle', 'green', t('completed')) +
      stat(t('totalSpent'), money(spent), 'wallet', 'purple', t('spent')) +
    '</div>';

    var toolbar = '<div class="card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div class="search-mini" style="flex:1;min-width:200px">' + icon('search') + '<input data-q placeholder="' + esc(t('search')) + ' ' + esc(t('orders')) + '" value="' + esc(state.q) + '"></div>' +
      '<select class="select" data-status style="width:auto;min-width:160px"><option value="">' + esc(t('allStatuses')) + '</option>' +
        '<option value="active"' + (state.status === 'active' ? ' selected' : '') + '>' + esc(t('activeOrders')) + '</option>' +
        DS.statusFlow.map(function (s) { return '<option value="' + s + '"' + (state.status === s ? ' selected' : '') + '>' + esc(DS.statusMeta(s).label) + '</option>'; }).join('') +
      '</select></div></div>';

    var body = list.length ? '<div style="display:flex;flex-direction:column;gap:10px">' + list.map(orderCard).join('') + '</div>' :
      DS.empty({ icon: 'orders', title: t('emptyOrders'), text: t('emptyOrdersText'), cta: { label: t('browseStore'), icon: 'store', onclick: "location.href='" + url('customer/storefront.html') + "'" } });

    page.setContent(stats + toolbar + body);
    bind(list);
  }

  function bind() {
    var q = page.body.querySelector('[data-q]');
    if (q) q.addEventListener('input', DS.debounce(function () { state.q = q.value; render(); }, 160));
    var st = page.body.querySelector('[data-status]');
    if (st) st.addEventListener('change', function () { state.status = st.value; render(); });
    DS.$$('[data-details]', page.body).forEach(function (b) { b.addEventListener('click', function () { DS.openOrder(b.getAttribute('data-details')); }); });
    DS.$$('[data-reorder]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = orders().filter(function (x) { return x.id === b.getAttribute('data-reorder'); })[0];
        if (!o) return;
        var available = DS.data.products.filter(function (p) { return p.tenant_id === o.tenant_id && p.is_active !== false; });
        var items = [];
        (o.items || []).forEach(function (it) {
          var p = available.filter(function (x) { return x.id === it.product_id; })[0];
          if (!p || p.stock <= 0) return;
          items.push({ id: p.id, name: p.name, name_en: p.name_en, price: Number(p.price), qty: Math.min(it.qty, p.stock), image: p.image, stock: p.stock, tenant_id: p.tenant_id });
        });
        if (!items.length) { DS.toast(t('outOfStock'), 'warning'); return; }
        DS.store.set('ds_cart', { tenant_id: o.tenant_id, items: items });
        DS.store.set('ds_customer_store', o.tenant_id);
        DS.toast(t('addedToCart'), 'success');
        location.href = url('customer/checkout.html');
      });
    });
  }

  render();
})();
