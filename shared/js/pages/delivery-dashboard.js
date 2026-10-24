/* DotStudio® POS — Delivery company dashboard */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  var company = (DS.data.companies || []).filter(function (c) { return c.id === user.delivery_company; })[0] || {};

  var page = DS.shell.mount({
    roles: ['delivery'],
    active: 'dashboard',
    title: t('deliveryDashboard'),
    eyebrow: DS.loc(company, 'name') || t('delivery'),
    icon: 'truck',
    sub: DS.lang() === 'en' ? 'Your live tasks, route and delivery chat — all in one console.' : 'مهامك الحية، خط السير ومحادثة التوصيل — في لوحة واحدة.',
    actions: '<a class="btn btn-secondary" href="' + url('delivery/orders.html') + '">' + icon('orders') + esc(t('orders')) + '</a>' +
      '<a class="btn btn-primary" href="' + url('delivery/tracking.html') + '">' + icon('mapPin') + esc(t('mapTitle')) + '</a>',
    content: DS.skeleton.rows(6)
  });
  if (!page) return;

  var state = { gps: null };

  function myOrders() {
    return DS.data.visibleOrders(user).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function activeOrders() {
    return myOrders().filter(function (o) { return ['pending', 'confirmed', 'preparing', 'delivering'].indexOf(o.status) > -1; });
  }
  function currentTask() {
    var list = activeOrders();
    return list.filter(function (o) { return o.status === 'delivering'; })[0] || list[0] || null;
  }

  function stat(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div><div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }

  function nextAction(o) {
    if (o.status === 'pending' || o.status === 'confirmed') return { label: t('acceptTask'), next: 'preparing', variant: 'btn-primary', icon: 'check' };
    if (o.status === 'preparing') return { label: t('markPicked'), next: 'delivering', variant: 'btn-primary', icon: 'package' };
    if (o.status === 'delivering') return { label: t('markDelivered'), next: 'delivered', variant: 'btn-success', icon: 'checkCircle' };
    return null;
  }

  function taskCard(o) {
    var tn = DS.data.tenantById(o.tenant_id) || {};
    var act = nextAction(o);
    var meta = DS.statusMeta(o.status);
    return '<div class="delivery-task"><div class="num-badge">' + esc(String(o.order_no).replace('ORD-', '')) + '</div>' +
      '<div class="info"><b>' + esc(o.customer ? DS.loc(o.customer, 'name') : t('customerLabel')) + ' · ' + money(o.total) + '</b>' +
        '<span>' + esc(tn.name || '') + ' · ' + esc(o.customer ? DS.loc(o.customer, 'address') : '') + '</span>' +
        '<span style="margin-top:3px">' + esc(DS.timeAgo(o.updated_at || o.created_at)) + ' · ' + esc(o.order_no) + '</span></div>' +
      '<div class="right">' + DS.badge(o.status, meta.label) +
        (act ? '<button class="btn ' + act.variant + ' btn-sm" data-advance="' + esc(o.id) + '">' + icon(act.icon) + esc(act.label) + '</button>' : '') +
        '<button class="btn btn-secondary btn-sm" data-details="' + esc(o.id) + '">' + icon('eye') + '</button></div></div>';
  }

  function render() {
    var all = myOrders();
    var active = activeOrders();
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var completedToday = all.filter(function (o) { return o.status === 'delivered' && new Date(o.updated_at || o.created_at) >= today; });
    var delivering = all.filter(function (o) { return o.status === 'delivering'; });
    var earnings = completedToday.reduce(function (s, o) { return s + (Number(company.fee) || 30); }, 0);
    var task = currentTask();

    var stats = '<div class="kpi-grid">' +
      stat(t('assignedOrders'), String(active.length), 'orders', 'lime', DS.loc(company, 'name') || '') +
      stat(t('onTheWay'), String(delivering.length), 'bike', 'info', t('delivering')) +
      stat(t('completedToday'), String(completedToday.length), 'checkCircle', 'green', t('today')) +
      stat(t('earnings'), money(earnings), 'wallet', 'purple', t('today')) +
    '</div>';

    var welcome = '<section class="welcome-card"><div class="welcome-copy"><div class="welcome-kicker">' + icon('truck') + esc(DS.loc(company, 'name') || t('delivery')) + ' · ' + esc(t('live')) + '</div>' +
      '<div class="welcome-title">' + esc(t('welcome')) + (DS.lang() === 'en' ? ', ' : '، ') + esc(DS.loc(user, 'name')) + ' 👋</div>' +
      '<div class="welcome-sub">' + esc(DS.lang() === 'en' ? 'Accept a task, follow the route and confirm delivery with a photo proof.' : 'اقبل المهمة، اتبع خط السير وأكد التسليم بصورة إثبات.') + '</div>' +
      '<div class="welcome-actions"><a class="btn btn-primary" href="' + url('delivery/orders.html') + '">' + icon('orders') + esc(t('orders')) + '</a>' +
        '<a class="btn btn-secondary" href="' + url('delivery/tracking.html') + '">' + icon('mapPin') + esc(t('mapTitle')) + '</a></div></div>' +
      '<div class="welcome-stats"><div class="welcome-stat"><div class="v">' + (company.rating || '4.8') + '</div><div class="l">' + esc(t('rating')) + '</div></div>' +
        '<div class="welcome-stat"><div class="v">' + (company.avg_time || 30) + '</div><div class="l">' + esc(t('avgTime')) + ' (' + esc(DS.lang() === 'en' ? 'min' : 'د') + ')</div></div>' +
        '<div class="welcome-stat"><div class="v">' + (company.completed || 0) + '</div><div class="l">' + esc(t('completed')) + '</div></div></div></section>';

    var mapBlock = '<div class="card"><div class="card-head"><div class="section-title">' + icon('mapPin') + esc(t('mapTitle')) + '</div>' +
      (task ? '<span class="badge lime">' + icon('bike') + ' ' + esc(task.order_no) + '</span>' : '') + '</div><div class="card-body">' +
      (task ? '<div id="gpsHost"></div>' : DS.empty({ icon: 'mapPin', title: t('noAssigned'), text: t('noAssignedText') })) + '</div></div>';

    var tasks = '<div class="card"><div class="card-head"><div class="section-title">' + icon('orders') + esc(t('liveOrders')) + ' <span class="badge lime">' + active.length + '</span></div>' +
      '<a class="btn btn-ghost btn-sm" href="' + url('delivery/orders.html') + '">' + esc(t('viewAll')) + ' ' + icon('arrowRight') + '</a></div><div class="card-body">' +
      (active.length ? active.slice(0, 4).map(taskCard).join('') : DS.empty({ icon: 'orders', title: t('noAssigned'), text: t('noAssignedText') })) + '</div></div>';

    var left = '<div style="display:flex;flex-direction:column;gap:14px">' + welcome + stats + mapBlock + tasks + '</div>';
    var chat = '<div class="chat-host" data-chat-host></div>';

    page.setContent('<div class="delivery-shell">' + left + chat + '</div>');
    bind();

    var host = page.body.querySelector('#gpsHost');
    if (host && task && DS.gps) {
      if (state.gps && state.gps.stop) state.gps.stop();
      state.gps = DS.gps.mount(host, {
        order: task,
        height: 300,
        baseEta: 12,
        storeLabel: (DS.data.tenantById(task.tenant_id) || {}).name || t('store'),
        customerLabel: task.customer ? DS.loc(task.customer, 'name') : t('customerLabel')
      });
    }
    var chatHost = page.body.querySelector('[data-chat-host]');
    if (chatHost && DS.chat) {
      DS.chat.mount(chatHost, { mode: 'dock', allTabs: true, scope: 'delivery' });
    }
  }

  function bind() {
    DS.$$('[data-details]', page.body).forEach(function (b) { b.addEventListener('click', function () { DS.openOrder(b.getAttribute('data-details')); }); });
    DS.$$('[data-advance]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = myOrders().filter(function (x) { return x.id === b.getAttribute('data-advance'); })[0];
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
          '<label class="proof-drop" data-proof-drop style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px dashed var(--border-strong);border-radius:var(--radius-lg);padding:28px;background:var(--surface-2);cursor:pointer;text-align:center">' +
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
