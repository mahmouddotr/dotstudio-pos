/* DotStudio® POS — Owner · إدارة المناديب (tenant-scoped drivers) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon;
  var user = DS.session();
  if (!user) return;
  var EN = DS.lang() === 'en';

  var page = DS.shell.mount({
    roles: ['owner'],
    active: 'drivers',
    title: t('drivers'),
    eyebrow: (DS.data.tenantById(user.tenant_id) || {}).name || t('store'),
    icon: 'bike',
    sub: EN ? 'Drivers you add here only see your store’s orders.' : 'المناديب المضافون هنا يرون طلبات متجرك فقط.',
    actions: '<button type="button" class="btn btn-primary" data-add-driver>' + icon('plus') + esc(EN ? 'Add driver' : 'إضافة مندوب') + '</button>',
    content: DS.skeleton.rows(5)
  });
  if (!page) return;

  function drivers() {
    return DS.data.users.filter(function (u) {
      return u.role === 'delivery' && u.tenant_id === user.tenant_id;
    });
  }

  function runningCounts() {
    var map = {};
    DS.data.visibleOrders(user).forEach(function (o) {
      if (o.status === 'out_for_delivery' && o.driver_id) map[o.driver_id] = (map[o.driver_id] || 0) + 1;
    });
    return map;
  }

  function render() {
    var list = drivers();
    var running = runningCounts();
    var rows = list.length ? list.map(function (d) {
      return '<tr>' +
        '<td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(d)) + '" alt="">' +
          '<div><div class="cell-title">' + esc(DS.loc(d, 'name')) + '</div>' +
          '<div class="cell-sub" style="direction:ltr;text-align:start">@' + esc(d.username) + '</div></div></div></td>' +
        '<td style="direction:ltr;text-align:start">' + esc(d.phone || '—') + '</td>' +
        '<td><span class="badge ' + (running[d.id] ? 'lime' : 'neutral') + '">' + (running[d.id] || 0) + '</span></td>' +
        '<td>' + DS.badge(d.is_active === false ? 'suspended' : 'active', d.is_active === false ? (EN ? 'Suspended' : 'موقوف') : (EN ? 'Active' : 'نشط')) + '</td>' +
        '<td style="text-align:end">' +
          '<button class="btn btn-ghost btn-sm" data-edit="' + esc(d.id) + '">' + icon('edit') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-toggle="' + esc(d.id) + '">' + icon(d.is_active === false ? 'play' : 'pause') + '</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" data-del="' + esc(d.id) + '">' + icon('trash') + '</button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="5">' + DS.empty({
      icon: 'bike',
      title: EN ? 'No drivers yet' : 'لا يوجد مناديب بعد',
      text: EN ? 'Add your first driver — he will only see your store’s orders.' : 'أضف أول مندوب — سيرى طلبات متجرك فقط.'
    }) + '</td></tr>';

    page.setContent('<div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('drivers')) +
      '</div><div class="card-subtitle">' + esc(EN ? 'Owner-managed delivery team' : 'فريق التوصيل الخاص بمتجرك') + '</div></div></div>' +
      '<div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('phone')) +
      '</th><th>' + esc(EN ? 'Active orders' : 'طلبات جارية') + '</th><th>' + esc(t('status')) + '</th><th></th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>');

    DS.$$('[data-edit]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { openDriver(DS.data.userById(b.getAttribute('data-edit'))); });
    });
    DS.$$('[data-toggle]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var d = DS.data.userById(b.getAttribute('data-toggle'));
        if (!d) return;
        DS.data.setUserActive(d.id, d.is_active === false);
        DS.toast(EN ? 'Driver updated' : 'تم تحديث حالة المندوب', 'success');
        render();
      });
    });
    DS.$$('[data-del]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var d = DS.data.userById(b.getAttribute('data-del'));
        if (!d) return;
        DS.confirm({
          title: t('deleteForever'),
          text: EN ? 'This permanently removes the driver.' : 'سيتم حذف المندوب نهائياً.',
          danger: true,
          confirmText: t('deleteForever')
        }).then(function (ok) {
          if (!ok) return;
          DS.data.deleteUser(d.id);
          DS.toast(t('userDeleted'), 'success');
          render();
        });
      });
    });
  }

  function openDriver(driver) {
    var isNew = !driver;
    var inHouseLabel = EN ? 'In-House Delivery' : 'توصيل المحل (داخلي)';
    DS.modal({
      title: icon('bike') + ' ' + esc(isNew ? (EN ? 'Add driver' : 'إضافة مندوب') : (EN ? 'Edit driver' : 'تعديل المندوب')),
      size: 'md',
      body: '<div class="field-grid">' +
        '<div class="field"><label>' + esc(EN ? 'Full name' : 'الاسم بالكامل') + ' *</label><input class="input" id="drName" maxlength="60" value="' + esc(driver ? driver.name : '') + '"></div>' +
        '<div class="field"><label>' + esc(t('phone')) + '</label><input class="input" id="drPhone" dir="ltr" maxlength="20" value="' + esc(driver ? (driver.phone || '') : '') + '"></div>' +
        '<div class="field"><label>' + esc(EN ? 'Username' : 'اسم المستخدم') + ' *</label><input class="input" id="drUser" dir="ltr" maxlength="32" value="' + esc(driver ? driver.username : '') + '"' + (isNew ? '' : ' readonly') + '></div>' +
        '<div class="field"><label>' + esc(EN ? 'Password' : 'كلمة المرور') + (isNew ? ' *' : '') + '</label><input class="input" id="drPass" dir="ltr" type="password" maxlength="64" placeholder="' + esc(isNew ? '' : (EN ? 'Leave blank to keep current' : 'اتركه فارغًا للإبقاء على الحالي')) + '"></div>' +
        '</div>' +
        '<p style="font-size:11px;color:var(--text-tertiary);margin-top:6px">' + icon('store') + ' ' +
          esc(EN ? 'In-house driver tied to your store tenant_id.' : 'مندوب داخلي مرتبط بمعرّف متجرك.') + '</p>',
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('saveChanges'), variant: 'btn-primary', close: false, onClick: function (root, close) {
            var name = (root.querySelector('#drName').value || '').trim();
            var username = (root.querySelector('#drUser').value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
            var pass = root.querySelector('#drPass').value || '';
            var phone = (root.querySelector('#drPhone').value || '').trim();
            if (!name || !username || (isNew && pass.length < 8)) {
              DS.toast(isNew ? (EN ? 'Name, username and 8+ character password are required' : 'الاسم واسم المستخدم وكلمة مرور 8 أحرف مطلوبة') : t('required'), 'error');
              return false;
            }
            if (isNew) {
              if (DS.data.users.some(function (u) { return String(u.username || '').toLowerCase() === username; })) {
                DS.toast(EN ? 'Username already used' : 'اسم المستخدم مستخدم بالفعل', 'error');
                return false;
              }
              DS.data.addUser({
                username: username, password: pass, role: 'delivery', name: name, name_en: name,
                tenant_id: user.tenant_id, phone: phone, avatar_id: 'av3', is_active: true,
                company_id: 'in_house',
                delivery_company: null,
                delivery_company_name: inHouseLabel
              });
            } else {
              DS.data.saveUser({
                id: driver.id, name: name, phone: phone,
                tenant_id: user.tenant_id,
                company_id: 'in_house',
                delivery_company: null,
                delivery_company_name: inHouseLabel,
                password: pass || undefined
              });
            }
            DS.toast(EN ? 'Driver saved' : 'تم حفظ المندوب', 'success');
            render();
            if (close) close();
            return true;
          } }
      ]
    });
  }

  var addBtn = page.actions && page.actions.querySelector('[data-add-driver]');
  if (addBtn) addBtn.addEventListener('click', function () { openDriver(null); });

  render();
})();
