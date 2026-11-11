/* DotStudio® POS — Delivery company owner · إدارة المناديب
   The owner adds riders (role: 'driver'), sees their live load and earnings,
   and re-dispatches any pending task from one rider to another. */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  var EN = DS.lang() === 'en';

  var isOwner = DS.data.isCompanyOwner ? DS.data.isCompanyOwner(user) : true;
  if (!isOwner) {
    window.location.replace(url('delivery/dashboard.html'));
    return;
  }

  var company = (DS.data.companies || []).filter(function (c) { return c.id === user.delivery_company; })[0] || {};

  var page = DS.shell.mount({
    roles: ['delivery', 'driver'],
    active: 'manage-drivers',
    title: t('manage-drivers'),
    eyebrow: DS.loc(company, 'name') || t('delivery'),
    icon: 'users',
    sub: EN ? 'Add riders, follow their load and re-dispatch tasks in one tap.' : 'أضف المناديب، تابع أحمالهم وأعد توزيع المهام بضغطة واحدة.',
    actions: '<button type="button" class="btn btn-primary" data-add-driver>' + icon('userPlus') + esc(EN ? 'Add driver' : 'إضافة مندوب') + '</button>',
    content: DS.skeleton.rows(5)
  });
  if (!page) return;

  function drivers() {
    var list = DS.data.companyDrivers ? DS.data.companyDrivers(user.delivery_company) : [];
    return list.filter(function (u) { return DS.data.isSubDriver(u); });
  }

  function activeCounts() {
    var map = {};
    DS.data.visibleOrders(user).forEach(function (o) {
      if (!o.driver_id) return;
      if (DS.isActiveOrderStatus(o.status) === false) return;
      map[o.driver_id] = (map[o.driver_id] || 0) + 1;
    });
    return map;
  }

  function earningsToday() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var fee = Number(company.fee) || 30;
    var map = {};
    DS.data.visibleOrders(user).forEach(function (o) {
      if (o.status !== 'delivered' || !o.driver_id) return;
      if (new Date(o.updated_at || o.created_at) < today) return;
      map[o.driver_id] = (map[o.driver_id] || 0) + fee;
    });
    return map;
  }

  function pendingOrders() {
    return DS.data.visibleOrders(user)
      .filter(function (o) { return o.status === 'handed_to_company'; })
      .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }

  function currentDriverName(o) {
    if (o.driver_id && DS.data.userById) {
      var d = DS.data.userById(o.driver_id);
      if (d) return DS.loc(d, 'name');
    }
    return o.driver_name || (EN ? 'Unassigned' : 'غير مُسند');
  }

  function render() {
    var list = drivers();
    var running = activeCounts();
    var earned = earningsToday();

    var rows = list.length ? list.map(function (d) {
      var online = d.online !== false && d.is_active !== false;
      return '<tr>' +
        '<td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(d)) + '" alt="">' +
          '<div><div class="cell-title">' + esc(DS.loc(d, 'name')) + '</div>' +
          '<div class="cell-sub" style="direction:ltr;text-align:start">@' + esc(d.username) + (d.phone ? ' · ' + esc(d.phone) : '') + '</div></div></div></td>' +
        '<td><span class="badge ' + (running[d.id] ? 'lime' : 'neutral') + '">' + (running[d.id] || 0) + '</span></td>' +
        '<td style="font-weight:600;color:var(--lime)">' + money(earned[d.id] || 0) + '</td>' +
        '<td><span class="badge ' + (online ? 'success' : 'neutral') + '"><i class="driver-dot' + (online ? ' on' : '') + '"></i>' + esc(online ? t('online') : t('offline')) + '</span></td>' +
        '<td style="text-align:end">' +
          '<button class="btn btn-ghost btn-sm" data-toggle="' + esc(d.id) + '" title="' + esc(online ? t('offline') : t('online')) + '">' + icon(online ? 'pause' : 'play') + '</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" data-del="' + esc(d.id) + '">' + icon('trash') + '</button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="5">' + DS.empty({
      icon: 'users',
      title: EN ? 'No riders yet' : 'لا يوجد مناديب بعد',
      text: EN ? 'Add your first rider — he will see only the tasks assigned to him.' : 'أضف أول مندوب — سيرى فقط المهام المُسندة إليه.'
    }) + '</td></tr>';

    var team = '<div class="card"><div class="card-head"><div class="section-title">' + icon('users') + esc(t('manage-drivers')) +
      ' <span class="badge lime">' + list.length + '</span></div>' +
      '<span class="badge neutral">' + esc(DS.loc(company, 'name') || t('delivery')) + '</span></div>' +
      '<div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(EN ? 'Driver name' : 'اسم المندوب') +
      '</th><th>' + esc(EN ? 'Active orders' : 'طلبات جارية') + '</th><th>' + esc(EN ? 'Total earnings today' : 'أرباح اليوم') +
      '</th><th>' + esc(t('status')) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';

    var pending = pendingOrders();
    var assignRows = pending.length ? pending.map(function (o) {
      return '<div class="dispatch-row" data-order-row="' + esc(o.id) + '">' +
        '<div class="dispatch-info"><b>' + esc(o.order_no) + ' · ' + esc(o.customer ? DS.loc(o.customer, 'name') : t('customerLabel')) + '</b>' +
          '<span>' + esc(DS.statusMeta(o.status).label) + ' · ' + esc(currentDriverName(o)) + '</span></div>' +
        '<div class="dispatch-controls"><select class="select" data-assign-target="' + esc(o.id) + '">' +
          list.map(function (d) {
            return '<option value="' + esc(d.id) + '"' + (o.driver_id === d.id ? ' selected' : '') + '>' + esc(DS.loc(d, 'name')) + (d.online === false ? ' · ' + esc(t('offline')) : '') + '</option>';
          }).join('') +
        '</select>' +
        '<button type="button" class="btn btn-primary btn-sm" data-assign="' + esc(o.id) + '">' + icon('bike') + esc(EN ? 'Assign' : 'إسناد') + '</button></div></div>';
    }).join('') : DS.empty({ icon: 'orders', title: t('noAssigned'), text: t('noAssignedText') });

    var dispatch = '<div class="card"><div class="card-head"><div class="section-title">' + icon('truck') + esc(EN ? 'Re-dispatch pending tasks' : 'إعادة توزيع المهام المعلّقة') +
      ' <span class="badge lime">' + pending.length + '</span></div></div><div class="card-body">' + assignRows + '</div></div>';

    page.setContent('<div class="dispatch-layout">' + team + dispatch + '</div>');
    bind();
  }

  function bind() {
    DS.$$('[data-toggle]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var d = DS.data.userById(b.getAttribute('data-toggle'));
        if (!d) return;
        var next = !(d.online !== false && d.is_active !== false);
        DS.data.saveUser({ id: d.id, online: next, is_active: true });
        DS.toast(EN ? 'Rider status updated' : 'تم تحديث حالة المندوب', 'success');
        render();
      });
    });

    DS.$$('[data-del]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var d = DS.data.userById(b.getAttribute('data-del'));
        if (!d) return;
        DS.confirm({
          title: t('deleteForever'),
          text: EN ? 'This permanently removes the rider.' : 'سيتم حذف المندوب نهائياً.',
          danger: true,
          confirmText: t('deleteForever')
        }).then(function (ok) {
          if (!ok) return;
          /* Never leave live tasks pointing at a deleted rider. */
          DS.data.visibleOrders(user).filter(function (o) {
            return o.driver_id === d.id && DS.isActiveOrderStatus(o.status);
          }).forEach(function (o) { DS.data.unassignOrder(o.id); });
          DS.data.deleteUser(d.id);
          DS.toast(t('userDeleted'), 'success');
          render();
        });
      });
    });

    DS.$$('[data-assign]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-assign');
        var sel = page.body.querySelector('[data-assign-target="' + id + '"]');
        if (!sel || !sel.value) { DS.toast(EN ? 'Add a rider first' : 'أضف مندوباً أولاً', 'warning'); return; }
        DS.data.assignOrder(id, sel.value);
        DS.toast(EN ? 'Task assigned' : 'تم إسناد المهمة', 'success');
        window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: id } }));
        render();
      });
    });
  }

  function openAdd() {
    DS.modal({
      title: icon('userPlus') + ' ' + esc(EN ? 'Add driver' : 'إضافة مندوب'),
      sub: esc(DS.loc(company, 'name') || t('delivery')),
      size: 'md',
      body: '<div class="field-grid">' +
        '<div class="field"><label>' + esc(EN ? 'Full name' : 'الاسم بالكامل') + ' *</label><input class="input" id="dvName" maxlength="60" placeholder="' + esc(EN ? 'e.g. Ahmed' : 'مثال: أحمد') + '"></div>' +
        '<div class="field"><label>' + esc(t('phone')) + '</label><input class="input" id="dvPhone" dir="ltr" maxlength="20" placeholder="01000000000"></div>' +
        '<div class="field"><label>' + esc(EN ? 'Username' : 'اسم المستخدم') + ' *</label><input class="input" id="dvUser" dir="ltr" maxlength="32" placeholder="ahmed"></div>' +
        '<div class="field"><label>' + esc(EN ? 'Password' : 'كلمة المرور') + ' *</label><input class="input" id="dvPass" dir="ltr" type="password" maxlength="64" placeholder="••••••••"></div>' +
        '</div>' +
        '<p style="font-size:11px;color:var(--text-tertiary);margin-top:6px">' + icon('bike') + ' ' +
          esc(EN ? 'The rider signs in with this username and only sees tasks assigned to him.' : 'يسجّل المندوب بهذا الاسم ويرى فقط المهام المُسندة إليه.') + '</p>',
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('saveChanges'), variant: 'btn-primary', close: false, onClick: function (root, close) {
            var name = (root.querySelector('#dvName').value || '').trim();
            var phone = (root.querySelector('#dvPhone').value || '').trim();
            var username = (root.querySelector('#dvUser').value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
            var pass = root.querySelector('#dvPass').value || '';
            if (!name || !username || pass.length < 8) {
              DS.toast(EN ? 'Name, username and an 8+ character password are required' : 'الاسم واسم المستخدم وكلمة مرور من 8 أحرف مطلوبة', 'error');
              return false;
            }
            if (DS.data.users.some(function (u) { return String(u.username || '').toLowerCase() === username; })) {
              DS.toast(EN ? 'Username already used' : 'اسم المستخدم مستخدم بالفعل', 'error');
              return false;
            }
            DS.data.addUser({
              username: username, password: pass, role: 'driver',
              name: name, name_en: name, phone: phone,
              delivery_company: user.delivery_company,
              company_id: user.delivery_company,
              delivery_company_name: company.name || null,
              parent_id: user.id,
              company_owner: false,
              avatar_id: 'av1', is_active: true, online: true
            });
            DS.toast(EN ? 'Driver added' : 'تم إضافة المندوب', 'success');
            render();
            if (close) close();
            return true;
          } }
      ]
    });
  }

  var addBtn = page.actions && page.actions.querySelector('[data-add-driver]');
  if (addBtn) addBtn.addEventListener('click', openAdd);

  window.addEventListener('ds:order-updated', function () { setTimeout(render, 120); });
  window.addEventListener('ds:data', function () { setTimeout(render, 120); });

  render();
})();
