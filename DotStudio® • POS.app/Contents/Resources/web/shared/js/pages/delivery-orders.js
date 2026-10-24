/* DotStudio® POS — Delivery tasks */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  var company = (DS.data.companies || []).filter(function (c) { return c.id === user.delivery_company; })[0] || {};

  var page = DS.shell.mount({
    roles: ['delivery'],
    active: 'orders',
    title: t('orders'),
    eyebrow: DS.loc(company, 'name') || t('delivery'),
    icon: 'orders',
    sub: DS.lang() === 'en' ? 'Every task assigned to your company, with one-tap status updates.' : 'كل مهمة مُسندة لشركتك مع تحديث الحالة بلمسة واحدة.',
    actions: '<a class="btn btn-secondary" href="' + url('delivery/dashboard.html') + '">' + icon('dashboard') + esc(t('dashboard')) + '</a>' +
      '<button class="btn btn-primary" data-refresh>' + icon('refresh') + esc(t('refresh')) + '</button>',
    content: DS.skeleton.rows(9)
  });
  if (!page) return;

  var state = { status: '', q: '' };

  function mine() { return DS.data.visibleOrders(user).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); }); }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return mine().filter(function (o) {
      if (state.status === 'active' && ['pending', 'confirmed', 'preparing', 'delivering'].indexOf(o.status) === -1) return false;
      if (state.status && state.status !== 'active' && o.status !== state.status) return false;
      if (!q) return true;
      return (o.order_no + ' ' + (o.customer ? o.customer.name + ' ' + o.customer.phone : '')).toLowerCase().indexOf(q) > -1;
    });
  }
  function nextAction(o) {
    if (o.status === 'pending' || o.status === 'confirmed') return { label: t('acceptTask'), next: 'preparing', variant: 'btn-primary', icon: 'check' };
    if (o.status === 'preparing') return { label: t('markPicked'), next: 'delivering', variant: 'btn-primary', icon: 'package' };
    if (o.status === 'delivering') return { label: t('markDelivered'), next: 'delivered', variant: 'btn-success', icon: 'checkCircle' };
    return null;
  }

  function stat(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div><div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }

  function render() {
    var all = mine();
    var active = all.filter(function (o) { return ['pending', 'confirmed', 'preparing', 'delivering'].indexOf(o.status) > -1; });
    var done = all.filter(function (o) { return o.status === 'delivered'; });
    var list = filtered();

    var stats = '<div class="kpi-grid">' +
      stat(t('assignedOrders'), String(all.length), 'orders', 'lime', DS.loc(company, 'name') || '') +
      stat(t('activeOrders'), String(active.length), 'bike', 'info', t('active')) +
      stat(t('deliveredOrders'), String(done.length), 'checkCircle', 'green', t('completed')) +
      stat(t('earnings'), money(done.length * (Number(company.fee) || 30)), 'wallet', 'purple', t('all')) +
    '</div>';

    var toolbar = '<div class="card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div class="search-mini" style="flex:1;min-width:200px">' + icon('search') + '<input data-q placeholder="' + esc(t('search')) + ' #ORD / ' + esc(t('customerLabel')) + '" value="' + esc(state.q) + '"></div>' +
      '<select class="select" data-status style="width:auto;min-width:160px"><option value="">' + esc(t('allStatuses')) + '</option>' +
        '<option value="active"' + (state.status === 'active' ? ' selected' : '') + '>' + esc(t('activeOrders')) + '</option>' +
        DS.statusFlow.map(function (s) { return '<option value="' + s + '"' + (state.status === s ? ' selected' : '') + '>' + esc(DS.statusMeta(s).label) + '</option>'; }).join('') +
      '</select></div></div>';

    var cards = list.length ? '<div class="delivery-grid">' + list.map(function (o) {
      var tn = DS.data.tenantById(o.tenant_id) || {};
      var act = nextAction(o);
      var count = (o.items || []).reduce(function (s, i) { return s + i.qty; }, 0);
      return '<article class="card"><div class="card-body">' +
        '<div style="display:flex;align-items:flex-start;gap:10px">' +
          '<div class="delivery-logo">' + icon('truck') + '</div>' +
          '<div class="delivery-info" style="flex:1"><div class="delivery-name">' + esc(o.order_no) + ' ' + DS.badge(o.status, DS.statusMeta(o.status).label) + '</div>' +
            '<div class="delivery-meta">' + esc(tn.name || '') + ' · ' + esc(DS.datetime(o.created_at)) + '</div></div>' +
          '<b style="color:var(--lime)">' + money(o.total) + '</b></div>' +
        '<div style="margin-top:10px;display:flex;flex-direction:column;gap:3px">' +
          '<div style="font-size:12px;font-weight:600">' + esc(o.customer ? DS.loc(o.customer, 'name') : t('customerLabel')) + '</div>' +
          '<div class="icon-inline" style="font-size:11px;color:var(--text-tertiary)">' + icon('mapPin') + esc(o.customer ? DS.loc(o.customer, 'address') : '') + '</div>' +
          '<div class="icon-inline" style="font-size:11px;color:var(--text-tertiary)">' + icon('phone') + esc(o.customer ? o.customer.phone : '') + ' · ' + count + ' ' + esc(t('item')) + '</div></div>' +
        '<div class="delivery-actions" style="margin-top:12px;display:flex;gap:6px">' +
          '<button class="btn btn-secondary btn-sm" data-details="' + esc(o.id) + '">' + icon('eye') + esc(t('details')) + '</button>' +
          (act ? '<button class="btn ' + act.variant + ' btn-sm" data-advance="' + esc(o.id) + '">' + icon(act.icon) + esc(act.label) + '</button>' : '') +
        '</div></div></article>';
    }).join('') + '</div>' : DS.empty({ icon: 'orders', title: t('noAssigned'), text: t('noAssignedText') });

    page.setContent(stats + toolbar + cards);
    bind();
  }

  function bind() {
    var q = page.body.querySelector('[data-q]');
    if (q) q.addEventListener('input', DS.debounce(function () { state.q = q.value; render(); }, 160));
    var st = page.body.querySelector('[data-status]');
    if (st) st.addEventListener('change', function () { state.status = st.value; render(); });
    DS.$$('[data-details]', page.body).forEach(function (b) { b.addEventListener('click', function () { DS.openOrder(b.getAttribute('data-details')); }); });
    DS.$$('[data-advance]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = mine().filter(function (x) { return x.id === b.getAttribute('data-advance'); })[0];
        if (!o) return;
        var act = nextAction(o);
        if (!act) return;
        if (act.next === 'delivered') { openProof(o); return; }
        DS.data.updateOrderStatus(o.id, act.next, { driver_name: DS.loc(user, 'name'), company_id: company.id, company_name: company.name });
        DS.toast(t('statusUpdated'), act.next === 'delivering' ? 'success' : 'info');
        window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: o.id } }));
        render();
      });
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

  var refresh = page.root.querySelector('[data-refresh]');
  if (refresh) refresh.addEventListener('click', function () { render(); DS.toast(t('updated'), 'success'); });

  render();
})();
