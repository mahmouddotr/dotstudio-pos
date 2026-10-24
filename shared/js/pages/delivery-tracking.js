/* DotStudio® POS — Delivery live route */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  var company = (DS.data.companies || []).filter(function (c) { return c.id === user.delivery_company; })[0] || {};

  var page = DS.shell.mount({
    roles: ['delivery'],
    active: 'tracking',
    title: t('mapTitle'),
    eyebrow: company.name || t('delivery'),
    icon: 'mapPin',
    sub: DS.lang() === 'en' ? '2 km route, live ETA every 10 seconds and photo proof on arrival.' : 'خط سير 2 كم، وقت وصول محدث كل 10 ثوانٍ وإثبات بالصورة عند التسليم.',
    actions: '<a class="btn btn-secondary" href="' + url('delivery/dashboard.html') + '">' + icon('dashboard') + esc(t('dashboard')) + '</a>',
    content: DS.skeleton.rows(5)
  });
  if (!page) return;

  var params = new URLSearchParams(location.search);
  var state = { id: params.get('order') || '', gps: null };

  function mine() { return DS.data.visibleOrders(user).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }); }
  function activeOrders() { return mine().filter(function (o) { return ['pending', 'confirmed', 'preparing', 'delivering'].indexOf(o.status) > -1; }); }
  function selected() {
    var list = activeOrders().length ? activeOrders() : mine();
    if (!list.length) return null;
    return list.filter(function (o) { return o.id === state.id || o.order_no === state.id; })[0] || list[0];
  }

  function nextAction(o) {
    if (o.status === 'pending' || o.status === 'confirmed') return { label: t('acceptTask'), next: 'preparing', variant: 'btn-primary', icon: 'check' };
    if (o.status === 'preparing') return { label: t('markPicked'), next: 'delivering', variant: 'btn-primary', icon: 'package' };
    if (o.status === 'delivering') return { label: t('markDelivered'), next: 'delivered', variant: 'btn-success', icon: 'checkCircle' };
    return null;
  }

  function render() {
    var o = selected();
    if (!o) {
      page.setContent(DS.empty({ icon: 'mapPin', title: t('noAssigned'), text: t('noAssignedText'), cta: { label: t('orders'), icon: 'orders', onclick: "location.href='" + url('delivery/orders.html') + "'" } }));
      return;
    }
    state.id = o.id;
    var tn = DS.data.tenantById(o.tenant_id) || {};
    var act = nextAction(o);
    var meta = DS.statusMeta(o.status);
    var list = activeOrders().length ? activeOrders() : mine();

    var selector = '<div class="card"><div class="card-body" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
      '<span style="font-size:12px;color:var(--text-tertiary)">' + esc(t('liveOrders')) + '</span>' +
      '<select class="select" data-order style="flex:1;min-width:220px">' + list.map(function (a) {
        return '<option value="' + esc(a.id) + '"' + (a.id === o.id ? ' selected' : '') + '>' + esc(a.order_no) + ' · ' + esc(a.customer ? DS.loc(a.customer, 'name') : '') + ' · ' + esc(DS.statusMeta(a.status).label) + '</option>';
      }).join('') + '</select>' + DS.badge(o.status, meta.label) + '</div></div>';

    var map = '<div class="card"><div class="card-head"><div class="section-title">' + icon('navigation') + esc(o.order_no) + '</div>' +
      '<span class="badge ' + (o.status === 'delivering' ? 'lime' : 'neutral') + '">' + icon('bike') + esc(o.status === 'delivering' ? t('live') : meta.label) + '</span></div>' +
      '<div class="card-body"><div id="gpsHost"></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
          (act ? '<button class="btn ' + act.variant + '" data-advance style="flex:1">' + icon(act.icon) + esc(act.label) + '</button>' : '') +
          '<button class="btn btn-secondary" data-details style="flex:1">' + icon('eye') + esc(t('details')) + '</button>' +
          '<a class="btn btn-secondary" href="tel:' + esc(o.customer ? o.customer.phone : '') + '" style="flex:1">' + icon('phone') + esc(t('customerLabel')) + '</a>' +
        '</div></div></div>';

    var side = '<div style="display:flex;flex-direction:column;gap:14px">' +
      '<div class="card"><div class="card-head"><div class="section-title">' + icon('store') + esc(t('customerInfo')) + '</div></div><div class="card-body">' +
        '<div class="order-detail-box" style="margin-bottom:8px"><div class="l">' + esc(t('customerName')) + '</div><div class="v">' + esc(o.customer ? DS.loc(o.customer, 'name') : '—') + '</div>' +
          '<div class="l" style="margin-top:7px">' + esc(t('phone')) + '</div><div class="v" style="direction:ltr;text-align:start">' + esc(o.customer ? o.customer.phone : '—') + '</div>' +
          '<div class="l" style="margin-top:7px">' + esc(t('address')) + '</div><div class="v" style="font-weight:500;color:var(--text-secondary)">' + esc(o.customer ? DS.loc(o.customer, 'address') : '—') + '</div></div>' +
        '<div class="order-details-grid"><div class="order-detail-box"><div class="l">' + esc(t('store')) + '</div><div class="v">' + esc(tn.name || '—') + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('total')) + '</div><div class="v" style="color:var(--lime)">' + money(o.total) + '</div></div></div>' +
        '<div style="margin-top:12px">' + (o.proof && o.proof.url
          ? '<img src="' + esc(o.proof.url) + '" alt="proof" style="width:100%;max-height:160px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--border)">'
          : '<div class="empty-proof">' + esc(t('noProof')) + '</div>') + '</div>' +
      '</div></div>' +
      '<div class="card"><div class="card-head"><div class="section-title">' + icon('box') + esc(t('items')) + '</div><span class="badge neutral">' + (o.items || []).length + '</span></div><div class="card-body">' +
        '<div class="order-items">' + (o.items || []).map(function (it) {
          return '<div class="order-item-row"><img src="' + esc(DS.data.img(it.image)) + '" alt=""><div class="info"><div class="nm">' + esc(DS.lang() === 'en' ? (it.name_en || it.name) : it.name) + '</div><div class="qt">' + it.qty + ' × ' + money(it.price) + '</div></div><div class="pr">' + money(it.qty * it.price) + '</div></div>';
        }).join('') + '</div></div></div>' +
    '</div>';

    page.setContent(selector + '<div class="tracking-grid">' + map + side + '</div>');
    bind(o);

    var host = page.body.querySelector('#gpsHost');
    if (host && DS.gps) {
      if (state.gps && state.gps.stop) state.gps.stop();
      state.gps = DS.gps.mount(host, {
        order: o,
        height: 360,
        baseEta: 12,
        storeLabel: tn.name || t('store'),
        customerLabel: o.customer ? DS.loc(o.customer, 'name') : t('customerLabel'),
        onDelivered: function () {
          DS.toast(t('orderDeliveredMsg'), 'success');
          setTimeout(render, 400);
        }
      });
    }
  }

  function bind(o) {
    var sel = page.body.querySelector('[data-order]');
    if (sel) sel.addEventListener('change', function () { state.id = sel.value; render(); });
    var det = page.body.querySelector('[data-details]');
    if (det) det.addEventListener('click', function () { DS.openOrder(o.id); });
    var adv = page.body.querySelector('[data-advance]');
    if (adv) adv.addEventListener('click', function () {
      var act = nextAction(o);
      if (!act) return;
      if (act.next === 'delivered') { openProof(o); return; }
      DS.data.updateOrderStatus(o.id, act.next, { driver_name: DS.loc(user, 'name'), company_id: company.id, company_name: company.name });
      DS.toast(t('statusUpdated'), act.next === 'delivering' ? 'success' : 'info');
      window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: o.id } }));
      render();
    });
  }

  function openProof(o) {
    DS.modal({
      title: t('proofUpload'),
      sub: o.order_no + ' · ' + (o.customer ? o.customer.name : ''),
      body: '<div class="field"><label>' + esc(t('proof')) + ' *</label>' +
          '<label style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px dashed var(--border-strong);border-radius:var(--radius-lg);padding:28px;background:var(--surface-2);cursor:pointer;text-align:center">' +
            '<span style="width:52px;height:52px;border-radius:14px;background:var(--lime-soft);color:var(--lime);display:grid;place-items:center">' + icon('image') + '</span>' +
            '<b style="font-size:13px">' + esc(t('uploadImage')) + '</b><span style="font-size:11px;color:var(--text-tertiary)">PNG / JPG · ≤ 800KB</span>' +
            '<input type="file" id="proofFile" accept="image/*" hidden></label>' +
          '<div data-proof-preview style="margin-top:10px;display:none"><img alt="proof" style="width:100%;max-height:220px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--border)"></div>' +
          '<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px">' + esc(t('proofRequired')) + '</p></div>',
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('markDelivered'), variant: 'btn-success', icon: icon('checkCircle'), onClick: function (root) {
            var img = root.querySelector('[data-proof-preview] img');
            var src = img ? img.getAttribute('src') : '';
            if (!src) { DS.toast(t('proofRequired'), 'error'); return false; }
            DS.data.updateOrderStatus(o.id, 'delivered', { proof: src, driver_name: DS.loc(user, 'name'), company_id: company.id, company_name: company.name });
            DS.toast(t('orderDeliveredMsg'), 'success');
            window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: o.id } }));
            setTimeout(render, 200);
            return true;
          } }
      ],
      onMount: function (root) {
        var input = root.querySelector('#proofFile');
        input.addEventListener('change', function () {
          var f = input.files && input.files[0];
          if (!f) return;
          if (f.size > 800 * 1024) { DS.toast('≤ 800KB', 'error'); input.value = ''; return; }
          var r = new FileReader();
          r.onload = function (ev) {
            var box = root.querySelector('[data-proof-preview]');
            box.style.display = '';
            box.querySelector('img').src = ev.target.result;
          };
          r.readAsDataURL(f);
        });
      }
    });
  }

  render();
})();
