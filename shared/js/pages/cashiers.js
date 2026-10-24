/* DotStudio® POS — Cashiers (admin + owner) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url, money = DS.money;
  var user = DS.session();
  if (!user) return;
  var isAdmin = DS.data.isAdmin(user);
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : ['owner'],
    permission: user.role === 'subadmin' ? 'cashiers' : null,
    active: 'cashiers',
    title: t('cashiers'),
    eyebrow: isAdmin ? t('admin') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'cashier',
    sub: DS.lang() === 'en' ? 'Cashier accounts, stores and shift activity.' : 'حسابات الكاشير والمتاجر ونشاط الورديات.',
    actions: '<button class="btn btn-primary" data-add>' + icon('plus') + esc(t('addCashier')) + '</button>',
    content: DS.skeleton.rows(5)
  });
  if (!page) return;

  var state = { store: isAdmin ? '' : user.tenant_id };

  function list() {
    return DS.data.users.filter(function (u) {
      return u.role === 'cashier' && (!state.store || u.tenant_id === state.store);
    });
  }

  function render() {
    var rows = list();
    var invoiceCount = {};
    DS.data.invoices.forEach(function (i) { invoiceCount[i.tenant_id] = (invoiceCount[i.tenant_id] || 0) + 1; });

    var stats = '<div class="kpi-grid">' +
      stat(t('cashiers'), rows.length, 'cashier', 'lime') +
      stat(t('active'), rows.filter(function (u) { return u.is_active !== false; }).length, 'checkCircle', 'green') +
      stat(t('stores'), new Set(rows.map(function (u) { return u.tenant_id; })).size, 'store', 'info') +
      stat(t('invoices'), DS.data.visibleInvoices(user).length, 'receipt', 'purple') + '</div>';

    var toolbar = isAdmin ? '<div class="card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<select class="select" data-store style="width:auto;min-width:180px"><option value="">' + esc(t('allStores')) + '</option>' +
      DS.data.tenants.map(function (tn) { return '<option value="' + tn.id + '"' + (state.store === tn.id ? ' selected' : '') + '>' + esc(tn.name) + '</option>'; }).join('') + '</select>' +
      '<span class="text-muted" style="font-size:11px">' + esc(t('showing')) + ' ' + rows.length + ' ' + esc(t('results')) + '</span></div></div>' : '';

    var table = '<div class="card"><div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('store')) + '</th><th>' + esc(t('username')) + '</th><th>' + esc(t('invoices')) + '</th><th>' + esc(t('joined')) + '</th><th>' + esc(t('status')) + '</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (u) {
        var tn = DS.data.tenantById(u.tenant_id);
        return '<tr><td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(u)) + '" alt=""><div><div class="cell-title">' + esc(DS.loc(u, 'name')) + '</div><div class="cell-sub">' + esc(t('cashier')) + '</div></div></div></td>' +
          '<td>' + (tn ? '<span class="badge neutral">' + esc(tn.name) + '</span>' : '—') + '</td>' +
          '<td style="direction:ltr;text-align:start;font-family:var(--font-mono);font-size:11px">@' + esc(u.username) + '</td>' +
          '<td>' + (invoiceCount[u.tenant_id] || 0) + '</td>' +
          '<td style="font-size:11px;color:var(--text-tertiary)">' + esc(DS.date(u.created_at)) + '</td>' +
          '<td>' + (u.is_active === false ? DS.badge('suspended', t('inactive')) : DS.badge('active', t('active'))) + '</td>' +
          '<td style="text-align:end;white-space:nowrap"><button class="btn btn-ghost btn-sm" data-edit="' + esc(u.id) + '">' + icon('edit') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-toggle="' + esc(u.id) + '">' + icon(u.is_active === false ? 'play' : 'pause') + '</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" data-del="' + esc(u.id) + '">' + icon('trash') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="7">' + DS.empty({ icon: 'cashier', title: t('noData'), text: DS.lang() === 'en' ? 'Add your first cashier to start selling.' : 'أضف أول كاشير لتبدأ البيع.', cta: { label: t('addCashier'), icon: 'plus', onclick: 'document.querySelector("[data-add]").click()' } }) + '</td></tr>') +
      '</tbody></table></div></div>';

    page.setContent(stats + toolbar + table);
    bind();
  }

  function stat(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div></div>';
  }

  function bind() {
    var s = page.body.querySelector('[data-store]');
    if (s) s.addEventListener('change', function () { state.store = s.value; render(); });
    DS.$$('[data-edit]', page.body).forEach(function (b) { b.addEventListener('click', function () { edit(DS.data.userById(b.getAttribute('data-edit'))); }); });
    DS.$$('[data-toggle]', page.body).forEach(function (b) { b.addEventListener('click', function () {
      var u = DS.data.userById(b.getAttribute('data-toggle'));
      DS.data.saveUser({ id: u.id, is_active: u.is_active === false });
      DS.toast(t('updated'), 'success');
      render();
    }); });
    DS.$$('[data-del]', page.body).forEach(function (b) { b.addEventListener('click', function () {
      DS.confirm({ title: t('confirmDelete'), text: t('confirmDeleteText'), danger: true }).then(function (ok) {
        if (!ok) return;
        DS.data.deleteUser(b.getAttribute('data-del'));
        DS.toast(t('deleted'), 'success');
        render();
      });
    }); });
  }

  function edit(u) {
    var isNew = !u;
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(t('name')) + ' *</label><input class="input" id="cName" value="' + esc(u ? u.name : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('store')) + ' *</label><select class="select" id="cStore">' + DS.data.tenants.filter(function (tn) {
        return isAdmin || tn.id === user.tenant_id;
      }).map(function (tn) { return '<option value="' + tn.id + '"' + (u && u.tenant_id === tn.id ? ' selected' : '') + '>' + esc(tn.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(t('username')) + ' *</label><input class="input" id="cUser" value="' + esc(u ? u.username : '') + '" style="direction:ltr"' + (isNew ? '' : ' readonly') + '></div>' +
      '<div class="field"><label>' + esc(t('password')) + ' *</label><input class="input" id="cPass" value="' + esc(u ? u.password || '' : '') + '" style="direction:ltr"></div>' +
      '<div class="field"><label>' + esc(t('phone')) + '</label><input class="input" id="cPhone" value="' + esc(u ? (u.phone || '') : '') + '" style="direction:ltr"></div>' +
      '<div class="field"><label>' + esc(t('status')) + '</label><select class="select" id="cActive"><option value="1"' + (!u || u.is_active !== false ? ' selected' : '') + '>' + esc(t('active')) + '</option><option value="0"' + (u && u.is_active === false ? ' selected' : '') + '>' + esc(t('inactive')) + '</option></select></div>' +
      '</div>';
    DS.modal({
      title: isNew ? t('addCashier') : t('editCashier'), body: body,
      actions: [{ label: t('cancel'), variant: 'btn-secondary' }, { label: t('saveChanges'), variant: 'btn-primary', onClick: function (root) {
        var name = root.querySelector('#cName').value.trim();
        var username = root.querySelector('#cUser').value.trim().toLowerCase();
        var pass = root.querySelector('#cPass').value;
        var tid = root.querySelector('#cStore').value;
        if (!name || !username || !pass) { DS.toast(t('required'), 'error'); return false; }
        if (isNew) {
          if (DS.data.users.filter(function (x) { return x.username === username; }).length) { DS.toast(t('invalidLogin'), 'error'); return false; }
          DS.data.addUser({ username: username, password: pass, role: 'cashier', name: name, name_en: name, tenant_id: tid, phone: root.querySelector('#cPhone').value.trim(), avatar_id: 'av6', is_active: root.querySelector('#cActive').value === '1' });
        } else {
          DS.data.saveUser({ id: u.id, name: name, password: pass, phone: root.querySelector('#cPhone').value.trim(), is_active: root.querySelector('#cActive').value === '1' });
        }
        DS.toast(t('userSaved'), 'success');
        render();
        return true;
      } }]
    });
  }

  var add = page.root.querySelector('[data-add]');
  if (add) add.addEventListener('click', function () { edit(null); });
  setTimeout(render, 160);
})();
