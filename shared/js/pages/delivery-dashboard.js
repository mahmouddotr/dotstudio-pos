/* DotStudio® POS — Delivery dashboard
   Two clean modes on the same route:
   · Company owner  → fleet overview, live queue and route map.
   · Sub-driver     → Apple-style glass console with only his assigned tasks.
   Chat lives in the single «الرسائل» sidebar entry — never duplicated here. */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;

  var company = (DS.data.companies || []).filter(function (c) { return c.id === user.delivery_company; })[0] || {};
  var isOwner = DS.data.isCompanyOwner ? DS.data.isCompanyOwner(user) : true;
  /* Store-managed (in-house) riders are not B2B sub-drivers, but they still
     use the rider console — any non-company-owner delivery account is a rider. */
  var isDriver = !isOwner;

  var page = DS.shell.mount({
    roles: ['delivery', 'driver'],
    active: 'dashboard',
    title: isDriver
      ? (DS.lang() === 'en' ? 'My deliveries' : 'توصيلاتي')
      : (DS.lang() === 'en' ? 'Delivery company' : 'شركة التوصيل'),
    eyebrow: DS.loc(company, 'name') || t('delivery'),
    icon: isDriver ? 'bike' : 'truck',
    sub: isDriver
      ? (DS.lang() === 'en' ? 'Your assigned tasks, earnings and proof of delivery — all in one clean console.' : 'مهامك المُسندة، أرباحك وإثبات التسليم — في لوحة واحدة مرتبة.')
      : (DS.lang() === 'en' ? 'Your live fleet, routes and dispatch — all in one console.' : 'أسطولك المباشر، خطوط السير والتوزيع — في لوحة واحدة.'),
    actions: (isOwner
      ? '<a class="btn btn-secondary" href="' + url('delivery/drivers.html') + '">' + icon('users') + esc(t('manage-drivers')) + '</a>'
      : '') +
      '<a class="btn btn-secondary" href="' + url('delivery/orders.html') + '">' + icon('orders') + esc(t('orders')) + '</a>' +
      '<a class="btn btn-primary" href="' + url('delivery/tracking.html') + '">' + icon('mapPin') + esc(t('mapTitle')) + '</a>',
    content: DS.skeleton.rows(6)
  });
  if (!page) return;

  var state = { gps: null };

  function myOrders() {
    return DS.data.visibleOrders(user).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function activeOrders() {
    return myOrders().filter(function (o) { return DS.isActiveOrderStatus(o.status); });
  }
  function currentTask() {
    var list = activeOrders();
    return list.filter(function (o) { return o.status === 'out_for_delivery'; })[0]
      || list.filter(function (o) { return o.status === 'handed_to_company'; })[0]
      || list[0] || null;
  }
  function completedToday() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return myOrders().filter(function (o) { return o.status === 'delivered' && new Date(o.updated_at || o.created_at) >= today; });
  }
  function earningsOf(list) {
    return list.reduce(function (s, o) { return s + (Number(company.fee) || 30); }, 0);
  }

  function stat(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div><div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }

  function nextAction(o) {
    if (isOwner) {
      if (o.status === 'handed_to_company' && o.driver_id) return { label: t('startDelivery'), next: 'out_for_delivery', variant: 'btn-primary', icon: 'bike' };
      return null;
    }
    if (o.status === 'handed_to_company' && o.driver_id === user.id) return { label: t('startDelivery'), next: 'out_for_delivery', variant: 'btn-primary', icon: 'bike' };
    if (o.status === 'out_for_delivery' && o.driver_id === user.id) return { label: t('markDelivered'), next: 'delivered', variant: 'btn-success', icon: 'checkCircle' };
    return null;
  }

  function companyRiders() {
    var list = DS.data.companyDrivers ? DS.data.companyDrivers(user.delivery_company) : [];
    return list.filter(function (u) { return DS.data.isRider(u) && u.is_active !== false; });
  }

  function assignMarkup(o) {
    if (!isOwner || o.status !== 'handed_to_company') return '';
    var riders = companyRiders();
    if (!riders.length) return '<span class="assign-empty">' + esc(t('noCompanyDrivers')) + '</span>';
    return '<div class="driver-assign-slot">' +
      '<select class="select assign-driver-select" data-assign-select="' + esc(o.id) + '">' +
        '<option value="">' + esc(t('assignDriver')) + '</option>' +
        riders.map(function (d) {
          return '<option value="' + esc(d.id + '') + '"' + (o.driver_id === d.id ? ' selected' : '') + '>' +
            esc(DS.loc(d, 'name')) + (d.online === false ? ' · ' + esc(t('offline')) : '') + '</option>';
        }).join('') +
      '</select>' +
      '<button class="btn btn-primary btn-sm" data-assign="' + esc(o.id) + '">' + icon('userPlus') + esc(t('assignDriver')) + '</button>' +
    '</div>';
  }

  function driverName(o) {
    if (o.driver_id && DS.data.userById) {
      var d = DS.data.userById(o.driver_id);
      if (d) return DS.loc(d, 'name');
    }
    return o.driver_name || t('noDriverAssigned');
  }

  function taskCard(o, driverMode) {
    var tn = DS.data.tenantById(o.tenant_id) || {};
    var act = nextAction(o);
    var meta = DS.statusMeta(o.status);
    var canReject = driverMode && o.status === 'handed_to_company' && o.driver_id === user.id;
    var rider = o.driver_id && DS.data.userById ? DS.data.userById(o.driver_id) : null;
    return '<div class="delivery-task' + (driverMode ? ' driver-task' : '') + '"><div class="num-badge">' + esc(String(o.order_no).replace('ORD-', '')) + '</div>' +
      '<div class="info"><b>' + esc(o.customer ? DS.loc(o.customer, 'name') : t('customerLabel')) + ' · ' + money(o.total) + '</b>' +
        '<span>' + esc(tn.name || '') + ' · ' + esc(o.customer ? DS.loc(o.customer, 'address') : '') + '</span>' +
        '<span style="margin-top:3px">' + esc(DS.timeAgo(o.updated_at || o.created_at)) + ' · ' + esc(o.order_no) +
          (driverMode ? '' : ' · ' + esc(driverName(o)) + (rider && rider.phone ? ' · ' + esc(rider.phone) : '')) + '</span></div>' +
      '<div class="right">' + DS.badge(o.status, meta.label) +
        assignMarkup(o) +
        (act ? '<button class="btn ' + act.variant + ' btn-sm" data-advance="' + esc(o.id) + '">' + icon(act.icon) + esc(act.label) + '</button>' : '') +
        (canReject ? '<button class="btn btn-secondary btn-sm" data-reject="' + esc(o.id) + '">' + icon('x') + esc(DS.lang() === 'en' ? 'Reject' : 'رفض') + '</button>' : '') +
        (driverMode && o.status === 'out_for_delivery' ? '<button class="btn btn-ghost btn-sm" data-transfer="' + esc(o.id) + '">' + icon('users') + esc(DS.lang() === 'en' ? 'Transfer' : 'تحويل') + '</button>' : '') +
        '<button class="btn btn-secondary btn-sm" data-details="' + esc(o.id) + '">' + icon('eye') + '</button></div></div>';
  }

  /* ───────────────────────── SUB-DRIVER VIEW ───────────────────────── */
  function renderDriver() {
    var all = myOrders();
    var active = activeOrders();
    var done = completedToday();
    var earnings = earningsOf(done);
    var task = currentTask();

    var stats = '<div class="driver-kpi-grid">' +
      '<div class="driver-kpi"><span class="dk-ic lime">' + icon('wallet') + '</span><span class="dk-label">' + esc(t('earnings')) + '</span><b class="dk-value">' + money(earnings) + '</b><span class="dk-foot">' + esc(t('today')) + '</span></div>' +
      '<div class="driver-kpi"><span class="dk-ic green">' + icon('checkCircle') + '</span><span class="dk-label">' + esc(t('completedToday')) + '</span><b class="dk-value">' + done.length + '</b><span class="dk-foot">' + esc(t('delivered')) + '</span></div>' +
      '<div class="driver-kpi"><span class="dk-ic info">' + icon('orders') + '</span><span class="dk-label">' + esc(t('pending')) + '</span><b class="dk-value">' + active.length + '</b><span class="dk-foot">' + esc(t('assignedOrders')) + '</span></div>' +
    '</div>';

    var hero = '<section class="driver-hero">' +
      '<div class="driver-hero-glow"></div>' +
      '<div class="driver-hero-copy">' +
        '<span class="driver-hero-kicker">' + icon('bike') + esc(DS.loc(company, 'name') || t('delivery')) + ' · ' + esc(t('live')) + '</span>' +
        '<h2>' + esc(t('welcome')) + (DS.lang() === 'en' ? ', ' : '، ') + esc(DS.loc(user, 'name')) + ' 👋</h2>' +
        '<p>' + esc(DS.lang() === 'en' ? 'Accept a task, follow the route and confirm delivery with a photo proof.' : 'اقبل المهمة، اتبع خط السير وأكد التسليم بصورة إثبات.') + '</p>' +
        (task
          ? '<div class="driver-hero-task"><span class="dh-num">' + esc(task.order_no) + '</span>' +
              '<span>' + esc(task.customer ? DS.loc(task.customer, 'name') : t('customerLabel')) + ' · ' + esc(task.customer ? DS.loc(task.customer, 'address') : '') + '</span>' +
              DS.badge(task.status, DS.statusMeta(task.status).label) + '</div>'
          : '<div class="driver-hero-task"><span>' + esc(t('noAssigned')) + ' — ' + esc(t('noAssignedText')) + '</span></div>') +
      '</div>' +
      '<div class="driver-hero-actions">' +
        '<a class="btn btn-secondary" href="' + url('delivery/orders.html') + '">' + icon('orders') + esc(t('orders')) + '</a>' +
        '<a class="btn btn-primary" href="' + url('delivery/tracking.html') + '">' + icon('mapPin') + esc(t('mapTitle')) + '</a>' +
      '</div></section>';

    var mapBlock = '<div class="card driver-glass"><div class="card-head"><div class="section-title">' + icon('mapPin') + esc(t('mapTitle')) + '</div>' +
      (task ? '<span class="badge lime">' + icon('bike') + ' ' + esc(task.order_no) + '</span>' : '') + '</div><div class="card-body">' +
      (task ? '<div id="gpsHost"></div>' : DS.empty({ icon: 'mapPin', title: t('noAssigned'), text: t('noAssignedText') })) + '</div></div>';

    var tasks = '<div class="card driver-glass"><div class="card-head"><div class="section-title">' + icon('orders') + esc(t('liveOrders')) + ' <span class="badge lime">' + active.length + '</span></div>' +
      '<a class="btn btn-ghost btn-sm" href="' + url('delivery/orders.html') + '">' + esc(t('viewAll')) + ' ' + icon('arrowRight') + '</a></div><div class="card-body">' +
      (active.length ? active.slice(0, 6).map(function (o) { return taskCard(o, true); }).join('') : DS.empty({ icon: 'orders', title: t('noAssigned'), text: t('noAssignedText') })) + '</div></div>';

    var history = all.filter(function (o) { return o.status === 'delivered'; }).slice(0, 4);
    var historyBlock = history.length
      ? '<div class="card driver-glass"><div class="card-head"><div class="section-title">' + icon('checkCircle') + esc(t('deliveredOrders')) + '</div></div><div class="card-body">' +
          history.map(function (o) { return taskCard(o, true); }).join('') + '</div></div>'
      : '';

    page.setContent('<div class="driver-console">' + hero + stats + '<div class="driver-columns">' +
      '<div class="driver-col">' + mapBlock + tasks + '</div>' +
      '<div class="driver-col">' + historyBlock +
        '<div class="card driver-glass driver-tips"><div class="card-body">' +
          '<div class="section-title">' + icon('sparkles') + esc(DS.lang() === 'en' ? 'Rider checklist' : 'قائمة المندوب') + '</div>' +
          '<ul class="driver-checklist">' +
            '<li>' + icon('check') + esc(DS.lang() === 'en' ? 'Accept the task to start preparing it.' : 'اقبل المهمة لبدء تجهيزها.') + '</li>' +
            '<li>' + icon('package') + esc(DS.lang() === 'en' ? 'Mark “Picked up” once the parcel is with you.' : 'اضغط «تم الاستلام» عند استلام الطرد.') + '</li>' +
            '<li>' + icon('image') + esc(DS.lang() === 'en' ? 'Delivered always needs a proof photo.' : 'التسليم يتطلب صورة إثبات دائماً.') + '</li>' +
            '<li>' + icon('chat') + esc(DS.lang() === 'en' ? 'Use Messages to talk to the customer.' : 'استخدم «الرسائل» للتواصل مع العميل.') + '</li>' +
          '</ul></div></div>' +
      '</div></div></div>');

    bind(true);
    mountGps(task);
  }

  /* ────────────────────────── OWNER VIEW ─────────────────────────── */
  function renderOwner() {
    var all = myOrders();
    var active = activeOrders();
    var done = completedToday();
    var delivering = all.filter(function (o) { return o.status === 'out_for_delivery'; });
    var task = currentTask();
    var riders = DS.data.companyDrivers ? DS.data.companyDrivers(user.delivery_company) : [];
    var subDrivers = riders.filter(function (u) { return DS.data.isSubDriver(u); });

    var stats = '<div class="kpi-grid">' +
      stat(t('liveOrders'), String(active.length), 'orders', 'lime', DS.loc(company, 'name') || '') +
      stat(t('onTheWay'), String(delivering.length), 'bike', 'info', t('delivering')) +
      stat(t('completedToday'), String(done.length), 'checkCircle', 'green', t('today')) +
      stat(t('earnings'), money(earningsOf(done)), 'wallet', 'purple', t('today')) +
    '</div>';

    var welcome = '<section class="welcome-card"><div class="welcome-copy"><div class="welcome-kicker">' + icon('truck') + esc(DS.loc(company, 'name') || t('delivery')) + ' · ' + esc(t('live')) + '</div>' +
      '<div class="welcome-title">' + esc(t('welcome')) + (DS.lang() === 'en' ? ', ' : '، ') + esc(DS.loc(user, 'name')) + ' 👋</div>' +
      '<div class="welcome-sub">' + esc(DS.lang() === 'en' ? 'Dispatch tasks to your riders and follow every route in real time.' : 'وزّع المهام على مناديبك وتابع كل خط سير لحظة بلحظة.') + '</div>' +
      '<div class="welcome-actions"><a class="btn btn-primary" href="' + url('delivery/drivers.html') + '">' + icon('users') + esc(t('manage-drivers')) + '</a>' +
        '<a class="btn btn-secondary" href="' + url('delivery/tracking.html') + '">' + icon('mapPin') + esc(t('mapTitle')) + '</a></div></div>' +
      '<div class="welcome-stats"><div class="welcome-stat"><div class="v">' + (company.rating || '4.8') + '</div><div class="l">' + esc(t('rating')) + '</div></div>' +
        '<div class="welcome-stat"><div class="v">' + (company.avg_time || 30) + '</div><div class="l">' + esc(t('avgTime')) + ' (' + esc(DS.lang() === 'en' ? 'min' : 'د') + ')</div></div>' +
        '<div class="welcome-stat"><div class="v">' + subDrivers.length + '</div><div class="l">' + esc(t('drivers')) + '</div></div></div></section>';

    var mapBlock = '<div class="card"><div class="card-head"><div class="section-title">' + icon('mapPin') + esc(t('mapTitle')) + '</div>' +
      (task ? '<span class="badge lime">' + icon('bike') + ' ' + esc(task.order_no) + '</span>' : '') + '</div><div class="card-body">' +
      (task ? '<div id="gpsHost"></div>' : DS.empty({ icon: 'mapPin', title: t('noAssigned'), text: t('noAssignedText') })) + '</div></div>';

    var tasks = '<div class="card"><div class="card-head"><div class="section-title">' + icon('orders') + esc(t('liveOrders')) + ' <span class="badge lime">' + active.length + '</span></div>' +
      '<a class="btn btn-ghost btn-sm" href="' + url('delivery/orders.html') + '">' + esc(t('viewAll')) + ' ' + icon('arrowRight') + '</a></div><div class="card-body">' +
      (active.length ? active.slice(0, 5).map(function (o) { return taskCard(o, false); }).join('') : DS.empty({ icon: 'orders', title: t('noAssigned'), text: t('noAssignedText') })) + '</div></div>';

    page.setContent('<div class="owner-shell"><div style="display:flex;flex-direction:column;gap:14px">' + welcome + stats + mapBlock + tasks + '</div></div>');
    bind(false);
    mountGps(task);
  }

  function mountGps(task) {
    var host = page.body.querySelector('#gpsHost');
    if (!host || !task || !DS.gps) return;
    if (state.gps && state.gps.stop) state.gps.stop();
    state.gps = DS.gps.mount(host, {
      order: task,
      height: 300,
      baseEta: 12,
      storeLabel: (DS.data.tenantById(task.tenant_id) || {}).name || t('store'),
      customerLabel: task.customer ? DS.loc(task.customer, 'name') : t('customerLabel')
    });
  }

  function render() { if (isDriver) renderDriver(); else renderOwner(); }

  /* ─────────────────────────── ACTIONS ───────────────────────────── */
  function bind(driverMode) {
    DS.$$('[data-details]', page.body).forEach(function (b) { b.addEventListener('click', function () { DS.openOrder(b.getAttribute('data-details')); }); });

    DS.$$('[data-assign]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-assign');
        var sel = page.body.querySelector('[data-assign-select="' + id + '"]');
        if (!sel || !sel.value) { DS.toast(t('noDriverAssigned'), 'warning'); return; }
        var res = DS.data.assignOrder(id, sel.value);
        if (!res) { DS.toast(t('noPermission'), 'error'); return; }
        DS.toast(t('driverAssigned'), 'success');
        window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: id } }));
        render();
      });
    });

    DS.$$('[data-advance]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = myOrders().filter(function (x) { return x.id === b.getAttribute('data-advance'); })[0];
        if (!o) return;
        var act = nextAction(o);
        if (!act) return;
        if (act.next === 'delivered') { openProof(o); return; }
        var res = DS.data.updateOrderStatus(o.id, act.next, { driver_id: o.driver_id || user.id, driver_name: driverName(o), company_id: company.id, company_name: company.name });
        if (!res) { DS.toast(t('noPermission'), 'error'); return; }
        DS.toast(t('statusUpdated'), 'success');
        window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: o.id } }));
        render();
      });
    });

    DS.$$('[data-reject]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-reject');
        DS.confirm({
          title: DS.lang() === 'en' ? 'Reject this task?' : 'رفض هذه المهمة؟',
          text: DS.lang() === 'en' ? 'The task returns to the company queue for another rider.' : 'ستعود المهمة إلى قائمة الشركة لمندوب آخر.',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          DS.data.unassignOrder(id);
          DS.toast(DS.lang() === 'en' ? 'Task returned to the company' : 'تم إرجاع المهمة إلى الشركة', 'success');
          window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: id } }));
          render();
        });
      });
    });

    DS.$$('[data-transfer]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { openTransfer(b.getAttribute('data-transfer')); });
    });
  }

  function openTransfer(orderId) {
    var o = myOrders().filter(function (x) { return x.id === orderId; })[0];
    if (!o) return;
    var mates = (DS.data.companyDrivers ? DS.data.companyDrivers(user.delivery_company) : []).filter(function (u) {
      return u.id !== user.id && u.id !== o.driver_id && DS.data.isSubDriver(u);
    });
    if (!mates.length) {
      DS.toast(DS.lang() === 'en' ? 'No other riders available right now.' : 'لا يوجد مندوب آخر متاح حالياً.', 'warning');
      return;
    }
    var body = '<div class="field"><label>' + esc(DS.lang() === 'en' ? 'Transfer to' : 'تحويل إلى') + '</label>' +
      '<select class="select" data-transfer-target>' + mates.map(function (u) {
        return '<option value="' + esc(u.id) + '">' + esc(DS.loc(u, 'name')) + (u.online === false ? ' · ' + esc(t('offline')) : '') + '</option>';
      }).join('') + '</select></div>' +
      '<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px">' + esc(o.order_no) + ' · ' + esc(o.customer ? DS.loc(o.customer, 'name') : '') + '</p>';
    DS.modal({
      title: DS.lang() === 'en' ? 'Transfer task' : 'تحويل المهمة',
      sub: esc(o.order_no),
      size: 'sm',
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: DS.lang() === 'en' ? 'Transfer' : 'تحويل', variant: 'btn-primary', icon: icon('users'), onClick: function (root) {
            var sel = root.querySelector('[data-transfer-target]');
            if (!sel) return false;
            DS.data.assignOrder(o.id, sel.value);
            DS.toast(DS.lang() === 'en' ? 'Task transferred' : 'تم تحويل المهمة', 'success');
            window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: o.id } }));
            setTimeout(render, 150);
            return true;
          } }
      ]
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
            '<input type="file" id="proofPhoto" accept="image/*" capture="environment" hidden></label>' +
          '<div data-proof-preview style="margin-top:10px;display:none"><img alt="proof" style="width:100%;max-height:220px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--border)"></div>' +
          '<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px">' + esc(t('proofRequired')) + '</p></div>',
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('markDelivered'), variant: 'btn-success', icon: icon('checkCircle'), onClick: function (root) {
            var img = root.querySelector('[data-proof-preview] img');
            var src = img ? img.getAttribute('src') : '';
            if (!src) { DS.toast(t('proofRequired'), 'error'); return false; }
            DS.data.updateOrderStatus(o.id, 'delivered', { proof: src, driver_id: o.driver_id || user.id, driver_name: driverName(o), company_id: company.id, company_name: company.name });
            DS.toast(t('orderDeliveredMsg'), 'success');
            window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: o.id } }));
            setTimeout(render, 200);
            return true;
          } }
      ],
      onMount: function (root) {
        var input = root.querySelector('#proofPhoto');
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

  window.addEventListener('ds:order-updated', function () { setTimeout(render, 120); });
  window.addEventListener('ds:data', function () { setTimeout(render, 120); });

  render();
})();
