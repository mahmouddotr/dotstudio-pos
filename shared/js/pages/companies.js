/* DotStudio® POS — Delivery companies */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;
  var user = DS.session();
  if (!user) return;
  var isAdmin = DS.data.isAdmin(user);
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : ['owner'],
    permission: user.role === 'subadmin' ? 'delivery-companies' : null,
    active: 'delivery-companies',
    title: t('delivery-companies'),
    eyebrow: isAdmin ? t('admin') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'truck',
    sub: DS.lang() === 'en' ? 'Partners who move your orders — performance, fees and drivers.' : 'شركاء توصيل طلباتك — الأداء والعمولات والمندوبون.',
    actions: '<button class="btn btn-primary" data-add>' + icon('plus') + esc(t('addCompany')) + '</button>',
    content: DS.skeleton.grid(3)
  });
  if (!page) return;

  function render() {
    var companies = DS.data.companies;
    var cards = companies.map(function (c) {
      var drivers = DS.data.users.filter(function (u) { return u.role === 'delivery' && u.delivery_company === c.id; });
      var orders = DS.data.orders.filter(function (o) { return o.delivery_company_id === c.id; });
      var delivered = orders.filter(function (o) { return o.status === 'delivered'; }).length;
      var revenue = DS.data.revenueOf(orders);
      return '<article class="delivery-card card">' +
        '<div style="display:flex;align-items:flex-start;gap:11px"><div class="delivery-logo">' + (c.emoji || '🛵') + '</div>' +
          '<div class="delivery-info" style="flex:1"><div class="delivery-name">' + esc(DS.lang() === 'en' ? (c.name_en || c.name) : c.name) + ' ' + DS.badge(c.status, t(c.status)) + '</div>' +
            '<div class="delivery-meta">' + esc(DS.lang() === 'en' ? (c.city_en || c.city) : c.city) + ' · ' + esc(c.phone) + '</div></div>' +
          '<button class="btn btn-icon" data-edit="' + esc(c.id) + '">' + icon('edit') + '</button></div>' +
        '<div class="delivery-stats">' +
          '<div class="delivery-stat"><b>' + c.rating + '</b><span>' + esc(t('rating')) + '</span></div>' +
          '<div class="delivery-stat"><b>' + c.completed + '</b><span>' + esc(t('completed')) + '</span></div>' +
          '<div class="delivery-stat"><b>' + c.avg_time + '</b><span>' + esc(t('avgTime')) + ' (min)</span></div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;font-size:10.5px;color:var(--text-tertiary);margin-top:10px;flex-wrap:wrap">' +
          '<span class="icon-inline">' + icon('bike') + ' ' + drivers.length + ' ' + esc(t('driver')) + '</span>' +
          '<span class="icon-inline">' + icon('orders') + ' ' + orders.length + ' ' + esc(t('orders')) + '</span>' +
          '<span class="icon-inline">' + icon('checkCircle') + ' ' + delivered + ' ' + esc(t('delivered')) + '</span>' +
          '<span style="margin-inline-start:auto;color:var(--lime);font-weight:700">' + money(revenue) + '</span>' +
        '</div>' +
        '<div class="delivery-actions" style="margin-top:12px">' +
          '<button class="btn btn-secondary btn-sm" data-drivers="' + esc(c.id) + '">' + icon('users') + esc(t('driver')) + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-toggle="' + esc(c.id) + '">' + icon(c.status === 'active' ? 'pause' : 'play') + esc(c.status === 'active' ? t('deactivate') : t('activate')) + '</button>' +
        '</div></article>';
    }).join('');

    var stats = '<div class="kpi-grid">' +
      stat(t('delivery-companies'), companies.length, 'truck', 'lime') +
      stat(t('driver'), DS.data.users.filter(function (u) { return u.role === 'delivery'; }).length, 'bike', 'info') +
      stat(t('completed'), companies.reduce(function (s, c) { return s + c.completed; }, 0), 'checkCircle', 'green') +
      stat(t('fee'), money(companies.reduce(function (s, c) { return s + c.fee; }, 0) / companies.length), 'wallet', 'purple') + '</div>';

    page.setContent(stats + '<div class="delivery-grid">' + cards + '</div>');
    bind();
  }

  function stat(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div></div>';
  }

  function bind() {
    DS.$$('[data-edit]', page.body).forEach(function (b) { b.addEventListener('click', function () { edit(b.getAttribute('data-edit')); }); });
    DS.$$('[data-toggle]', page.body).forEach(function (b) { b.addEventListener('click', function () {
      var c = DS.data.companies.filter(function (x) { return x.id === b.getAttribute('data-toggle'); })[0];
      DS.data.saveCompany({ id: c.id, status: c.status === 'active' ? 'inactive' : 'active' });
      DS.toast(t('updated'), 'success');
      render();
    }); });
    DS.$$('[data-drivers]', page.body).forEach(function (b) { b.addEventListener('click', function () {
      var c = DS.data.companies.filter(function (x) { return x.id === b.getAttribute('data-drivers'); })[0];
      var drivers = DS.data.users.filter(function (u) { return u.role === 'delivery' && u.delivery_company === c.id; });
      DS.modal({
        title: t('driver') + ' · ' + c.name,
        body: drivers.length ? drivers.map(function (d) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-soft)"><img class="avatar" src="' + esc(DS.avatarUrl(d)) + '" alt="">' +
            '<div style="flex:1"><b style="font-size:13px">' + esc(d.name) + '</b><div style="font-size:11px;color:var(--text-tertiary);direction:ltr;text-align:start">@' + esc(d.username) + '</div></div>' +
            DS.badge('active', t('active')) + '</div>';
        }).join('') : DS.empty({ icon: 'bike', title: t('noData'), text: DS.lang() === 'en' ? 'No drivers assigned yet.' : 'لا يوجد مندوبون مسجلون بعد.' }),
        actions: [{ label: t('close'), variant: 'btn-secondary' }]
      });
    }); });
  }

  function edit(id) {
    var c = id ? DS.data.companies.filter(function (x) { return x.id === id; })[0] : null;
    var isNew = !c;
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(t('name')) + ' *</label><input class="input" id="dName" value="' + esc(c ? c.name : '') + '"></div>' +
      '<div class="field"><label>Name (EN)</label><input class="input" id="dNameEn" value="' + esc(c ? (c.name_en || '') : '') + '" style="direction:ltr"></div>' +
      '<div class="field"><label>' + esc(t('phone')) + '</label><input class="input" id="dPhone" value="' + esc(c ? c.phone : '') + '" style="direction:ltr"></div>' +
      '<div class="field"><label>' + esc(t('city')) + '</label><input class="input" id="dCity" value="' + esc(c ? c.city : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('fee')) + ' (EGP)</label><input class="input" id="dFee" type="number" value="' + esc(c ? c.fee : 30) + '"></div>' +
      '<div class="field"><label>' + esc(t('avgTime')) + ' (min)</label><input class="input" id="dAvg" type="number" value="' + esc(c ? c.avg_time : 30) + '"></div>' +
      '<div class="field"><label>' + esc(t('status')) + '</label><select class="select" id="dStatus"><option value="active"' + (!c || c.status === 'active' ? ' selected' : '') + '>' + esc(t('active')) + '</option><option value="inactive"' + (c && c.status === 'inactive' ? ' selected' : '') + '>' + esc(t('inactive')) + '</option></select></div>' +
      '<div class="field"><label>Emoji</label><input class="input" id="dEmoji" value="' + esc(c ? c.emoji : '🛵') + '"></div>' +
      '</div>';
    DS.modal({
      title: isNew ? t('addCompany') : t('edit'), body: body,
      actions: [{ label: t('cancel'), variant: 'btn-secondary' }, { label: t('saveChanges'), variant: 'btn-primary', onClick: function (root) {
        var name = root.querySelector('#dName').value.trim();
        if (!name) { DS.toast(t('required'), 'error'); return false; }
        var data = {
          name: name, name_en: root.querySelector('#dNameEn').value.trim() || name,
          phone: root.querySelector('#dPhone').value.trim(), city: root.querySelector('#dCity').value.trim(),
          city_en: root.querySelector('#dCity').value.trim(), fee: Number(root.querySelector('#dFee').value) || 30,
          avg_time: Number(root.querySelector('#dAvg').value) || 30, status: root.querySelector('#dStatus').value,
          emoji: root.querySelector('#dEmoji').value || '🛵'
        };
        if (c) data.id = c.id;
        DS.data.saveCompany(data);
        DS.toast(t('companySaved'), 'success');
        render();
        return true;
      } }]
    });
  }

  var add = page.root.querySelector('[data-add]');
  if (add) add.addEventListener('click', function () { edit(null); });
  setTimeout(render, 150);
})();
