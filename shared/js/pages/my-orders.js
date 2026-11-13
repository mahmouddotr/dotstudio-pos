/* DotStudio® POS — Customer order history */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  document.body.classList.add('saleor-store');

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

  /* ── Unified customer header (same chrome as the storefront) ───── */
  function headerMarkup(active) {
    return DS.shell.customerHeader(active || 'my-orders', { search: false });
  }
  function bindChrome() {
    /* Theme, language and logout are handled by the shared shell chrome. */
  }

  function orders() {
    return DS.data.visibleOrders(user).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return orders().filter(function (o) {
      if (state.status === 'active' && !DS.isActiveOrderStatus(o.status) && !DS.isHoldOrderStatus(o.status)) return false;
      if (state.status && state.status !== 'active' && o.status !== state.status) return false;
      if (!q) return true;
      return (o.order_no + ' ' + (o.items || []).map(function (i) { return i.name; }).join(' ')).toLowerCase().indexOf(q) > -1;
    });
  }

  function stat(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div><div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }

  function orderCard(o) {
    var EN = DS.lang() === 'en';
    var tn = DS.data.tenantById(o.tenant_id) || {};
    var meta = DS.statusMeta(o.status);
    var lines = o.items || [];
    var count = lines.reduce(function (s, i) { return s + i.qty; }, 0);
    var thumbs = lines.slice(0, 3).map(function (i) {
      return '<img src="' + esc(DS.data.img(i.image)) + '" alt="">';
    }).join('');
    var firstName = lines[0] ? (EN ? (lines[0].name_en || lines[0].name) : lines[0].name) : '';
    var extra = lines.length > 1 ? ' +' + (lines.length - 1) : '';
    var live = DS.isActiveOrderStatus(o.status) || DS.isHoldOrderStatus(o.status);
    return '<article class="ct-order">' +
      '<div class="ct-order-top">' +
        '<div class="ct-order-idwrap">' +
          '<div class="ct-order-idrow"><span class="ct-order-no">' + esc(o.order_no) + '</span>' + DS.badge(o.status, meta.label) + '</div>' +
          '<div class="ct-order-date">' + icon('clock') +
            '<span>' + esc(DS.datetime(o.created_at)) + '</span>' +
            '<span class="sep">·</span>' +
            '<i>' + esc(tn.name || '') + '</i>' +
          '</div>' +
        '</div>' +
        '<div class="ct-order-total">' +
          '<span>' + esc(EN ? 'Total' : 'الإجمالي') + '</span>' +
          '<b>' + money(o.total) + '</b>' +
          '<i>' + count + ' ' + esc(t('item')) + '</i>' +
        '</div>' +
      '</div>' +
      '<div class="ct-order-mid">' +
        '<div class="ct-order-items">' +
          '<div class="ct-order-thumbs">' + thumbs + '</div>' +
          '<div class="ct-order-itemtext"><b>' + esc(firstName) + extra + '</b>' +
            esc(EN ? 'Order details and invoice' : 'تفاصيل الطلب والفاتورة') + '</div>' +
        '</div>' +
        '<div class="ct-order-actions">' +
          '<button class="btn btn-secondary btn-sm" data-details="' + esc(o.id) + '">' + icon('eye') + esc(t('details')) + '</button>' +
          (live
            ? '<a class="btn btn-primary btn-sm" href="' + url('customer/tracking.html?order=' + encodeURIComponent(o.id)) + '">' + icon('mapPin') + esc(t('trackOrder')) + '</a>'
            : '<button class="btn btn-primary btn-sm" data-reorder="' + esc(o.id) + '">' + icon('refresh') + esc(t('reorder')) + '</button>') +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function render() {
    var all = orders();
    var active = all.filter(function (o) { return DS.isActiveOrderStatus(o.status) || DS.isHoldOrderStatus(o.status); });
    var delivered = all.filter(function (o) { return o.status === 'delivered'; });
    var spent = delivered.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
    var list = filtered();

    var head = '<div class="ct-page-head"><div>' +
      '<div class="ct-eyebrow">' + icon('orders') + esc(t('store')) + '</div>' +
      '<h1 class="ct-title">' + esc(t('myOrders')) + '</h1>' +
      '<p class="ct-sub">' + esc(DS.lang() === 'en'
        ? 'Every order you placed, with live status and one-tap reorder.'
        : 'كل طلب قمت به، بحالته اللحظية وإعادة طلب بلمسة.') + '</p>' +
      '</div><div class="ct-page-actions">' +
        '<a class="btn btn-primary" href="' + url('customer/storefront.html') + '">' + icon('store') + esc(t('browseStore')) + '</a>' +
      '</div></div>';

    var stats = '<div class="kpi-grid ct-stats">' +
      stat(t('totalOrders'), String(all.length), 'orders', 'lime', t('all')) +
      stat(t('activeOrders'), String(active.length), 'bike', 'info', t('active')) +
      stat(t('deliveredOrders'), String(delivered.length), 'checkCircle', 'green', t('completed')) +
      stat(t('totalSpent'), money(spent), 'wallet', 'purple', t('spent')) +
    '</div>';

    var toolbar = '<div class="ct-toolbar">' +
      '<div class="search-mini" style="flex:1;min-width:200px">' + icon('search') + '<input data-q placeholder="' + esc(t('search')) + ' ' + esc(t('orders')) + '" value="' + esc(state.q) + '"></div>' +
      '<select class="select" data-status style="width:auto;min-width:160px"><option value="">' + esc(t('allStatuses')) + '</option>' +
        '<option value="active"' + (state.status === 'active' ? ' selected' : '') + '>' + esc(t('activeOrders')) + '</option>' +
        (DS.allOrderStatuses || DS.statusFlow).map(function (s) { return '<option value="' + s + '"' + (state.status === s ? ' selected' : '') + '>' + esc(DS.statusMeta(s).label) + '</option>'; }).join('') +
      '</select></div>';

    var body = list.length ? '<div class="ct-orders">' + list.map(orderCard).join('') + '</div>' :
      DS.empty({ icon: 'orders', title: t('emptyOrders'), text: t('emptyOrdersText'), cta: { label: t('browseStore'), icon: 'store', onclick: "location.href='" + url('customer/storefront.html') + "'" } });

    page.setContent(headerMarkup('orders') + '<div class="ct-page">' + head +
      '<div style="display:flex;flex-direction:column;gap:18px">' + stats + toolbar + body + '</div></div>');
    bind(list);
    bindChrome();
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
