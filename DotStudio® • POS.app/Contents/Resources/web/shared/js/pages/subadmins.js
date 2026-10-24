/* DotStudio® POS — Sub-admins (superadmin) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;
  var page = DS.shell.mount({
    roles: ['superadmin'],
    active: 'sub-admins',
    title: t('sub-admins'),
    eyebrow: t('admin'),
    icon: 'shield',
    sub: DS.lang() === 'en' ? 'Give your team exactly the access they need — nothing more.' : 'امنح فريقك الصلاحيات التي يحتاجها فقط — لا أكثر.',
    actions: '<button class="btn btn-primary" data-add>' + icon('plus') + esc(t('addAdmin')) + '</button>',
    content: DS.skeleton.rows(5)
  });
  if (!page) return;

  function list() { return DS.data.users.filter(function (u) { return u.role === 'subadmin'; }); }

  function render() {
    var subs = list();
    var stats = '<div class="kpi-grid">' +
      stat(t('sub-admins'), subs.length, 'shield', 'lime') +
      stat(t('active'), subs.filter(function (u) { return u.is_active !== false; }).length, 'checkCircle', 'green') +
      stat(t('permissions'), DS.data.PERMISSIONS_ALL.length, 'key', 'info') +
      stat(t('audit'), DS.data.auditLogs.length, 'activity', 'purple') + '</div>';

    var table = '<div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('users')) + '</div><div class="card-subtitle">' + esc(t('permissionsHint')) + '</div></div></div>' +
      '<div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('permissions')) + '</th><th>' + esc(t('joined')) + '</th><th>' + esc(t('status')) + '</th><th></th></tr></thead><tbody>' +
      (subs.length ? subs.map(function (u) {
        var perms = u.permissions || [];
        return '<tr><td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(u)) + '" alt=""><div><div class="cell-title">' + esc(DS.loc(u, 'name')) + '</div><div class="cell-sub" style="direction:ltr;text-align:start">@' + esc(u.username) + '</div></div></div></td>' +
          '<td style="max-width:340px"><div style="display:flex;gap:4px;flex-wrap:wrap">' + (perms.length ? perms.map(function (p) { return '<span class="badge neutral">' + esc(t(p)) + '</span>'; }).join('') : '<span class="text-muted" style="font-size:11px">' + esc(t('noPermission')) + '</span>') + '</div></td>' +
          '<td style="font-size:11px;color:var(--text-tertiary)">' + esc(DS.date(u.created_at)) + '</td>' +
          '<td>' + (u.is_active === false ? DS.badge('suspended', t('inactive')) : DS.badge('active', t('active'))) + '</td>' +
          '<td style="text-align:end;white-space:nowrap"><button class="btn btn-ghost btn-sm" data-edit="' + esc(u.id) + '">' + icon('edit') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-toggle="' + esc(u.id) + '">' + icon(u.is_active === false ? 'play' : 'pause') + '</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" data-del="' + esc(u.id) + '">' + icon('trash') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="5">' + DS.empty({ icon: 'shield', title: t('noData'), text: t('permissionsHint') }) + '</td></tr>') +
      '</tbody></table></div></div>';

    page.setContent(stats + table);
    bind();
  }

  function stat(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div></div>';
  }

  function bind() {
    DS.$$('[data-edit]', page.body).forEach(function (b) { b.addEventListener('click', function () { edit(DS.data.userById(b.getAttribute('data-edit'))); }); });
    DS.$$('[data-toggle]', page.body).forEach(function (b) { b.addEventListener('click', function () {
      var u = DS.data.userById(b.getAttribute('data-toggle'));
      DS.data.saveUser({ id: u.id, is_active: u.is_active === false });
      DS.toast(u.is_active === false ? t('updated') : t('updated'), 'success');
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
    var perms = u ? (u.permissions || []) : [];
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(t('name')) + ' *</label><input class="input" id="aName" value="' + esc(u ? u.name : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('username')) + ' *</label><input class="input" id="aUser" value="' + esc(u ? u.username : '') + '" style="direction:ltr"' + (isNew ? '' : ' readonly') + '></div>' +
      '<div class="field"><label>' + esc(t('password')) + ' *</label><input class="input" id="aPass" value="' + esc(u ? u.password || '' : '') + '" style="direction:ltr" placeholder="••••••••"></div>' +
      '<div class="field"><label>Email</label><input class="input" id="aEmail" value="' + esc(u ? (u.email || '') : '') + '" style="direction:ltr"></div>' +
      '</div><div class="field" style="margin-top:14px"><label>' + esc(t('permissions')) + '</label><p class="hint" style="margin-bottom:8px">' + esc(t('permissionsHint')) + '</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">' + DS.data.PERMISSIONS_ALL.map(function (p) {
        return '<label class="check" style="padding:8px 10px;border:1px solid var(--border);border-radius:8px"><input type="checkbox" value="' + p + '"' + (perms.indexOf(p) > -1 ? ' checked' : '') + '><span>' + esc(t(p)) + '</span></label>';
      }).join('') + '</div></div>';
    DS.modal({
      size: 'lg', title: isNew ? t('addAdmin') : t('edit') + ' · ' + esc(DS.loc(u, 'name')), body: body,
      actions: [{ label: t('cancel'), variant: 'btn-secondary' }, { label: t('saveChanges'), variant: 'btn-primary', onClick: function (root) {
        var name = root.querySelector('#aName').value.trim();
        var username = root.querySelector('#aUser').value.trim().toLowerCase();
        var pass = root.querySelector('#aPass').value;
        if (!name || !username || !pass) { DS.toast(t('required'), 'error'); return false; }
        var selected = DS.$$('input[type=checkbox]:checked', root).map(function (c) { return c.value; });
        var email = root.querySelector('#aEmail').value.trim();
        if (isNew) {
          if (DS.data.users.filter(function (x) { return x.username === username; }).length) { DS.toast(t('invalidLogin'), 'error'); return false; }
          DS.data.addUser({ username: username, password: pass, role: 'subadmin', name: name, name_en: name, email: email, permissions: selected, avatar_id: 'av5' });
        } else {
          DS.data.saveUser({ id: u.id, name: name, email: email, password: pass, permissions: selected });
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
