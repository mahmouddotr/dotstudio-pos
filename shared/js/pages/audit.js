/* DotStudio® POS — Audit log */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon;
  var page = DS.shell.mount({
    roles: ['superadmin', 'subadmin'],
    permission: 'audit',
    active: 'audit',
    title: t('auditLog'),
    eyebrow: t('admin'),
    icon: 'activity',
    sub: t('auditSub'),
    actions: '<button class="btn btn-secondary" data-export>' + icon('download') + esc(t('exportCsv')) + '</button>',
    content: DS.skeleton.rows(10)
  });
  if (!page) return;

  var state = { q: '', role: '' };

  function list() {
    return DS.data.auditLogs.filter(function (l) {
      if (state.role && l.role !== state.role) return false;
      if (state.q) {
        var hay = (l.action + ' ' + (l.action_en || '') + ' ' + l.actor).toLowerCase();
        if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  function render() {
    var rows = list();
    var stats = '<div class="kpi-grid">' +
      stat(t('audit'), DS.data.auditLogs.length, 'activity', 'lime') +
      stat(t('today'), DS.data.auditLogs.filter(function (l) { return new Date(l.at).toDateString() === new Date().toDateString(); }).length, 'clock', 'info') +
      stat(t('users'), new Set(DS.data.auditLogs.map(function (l) { return l.actor; })).size, 'users', 'purple') +
      stat(t('admin'), DS.data.auditLogs.filter(function (l) { return l.role === 'superadmin'; }).length, 'shield', 'green') + '</div>';

    var toolbar = '<div class="card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div class="search-mini" style="flex:1;min-width:220px">' + icon('search') + '<input data-q placeholder="' + esc(t('search')) + '…" value="' + esc(state.q) + '"></div>' +
      '<select class="select" data-role style="width:auto;min-width:150px"><option value="">' + esc(t('all')) + '</option>' +
      ['superadmin', 'subadmin', 'owner', 'cashier', 'delivery'].map(function (r) { return '<option value="' + r + '"' + (state.role === r ? ' selected' : '') + '>' + esc(t(r)) + '</option>'; }).join('') + '</select></div></div>';

    var table = '<div class="card"><div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(t('users')) + '</th><th>' + esc(t('role')) + '</th><th>' + esc(t('details')) + '</th><th>' + esc(t('date')) + '</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (l) {
        return '<tr><td><div class="customer-cell"><span class="avatar sm" style="background:var(--surface-2);color:var(--lime)">' + icon(l.icon || 'activity') + '</span><div><div class="cell-title">' + esc(DS.lang() === 'en' ? (l.actor_en || l.actor) : l.actor) + '</div><div class="cell-sub">' + esc(t(l.role)) + '</div></div></div></td>' +
          '<td>' + DS.badge(l.role, t(l.role)) + '</td>' +
          '<td style="max-width:480px"><div style="font-size:12px">' + esc(DS.lang() === 'en' ? (l.action_en || l.action) : l.action) + '</div></td>' +
          '<td style="font-size:11px;color:var(--text-tertiary);white-space:nowrap">' + esc(DS.datetime(l.at)) + '</td></tr>';
      }).join('') : '<tr><td colspan="4">' + DS.empty({ icon: 'activity', title: t('noData'), text: t('auditSub') }) + '</td></tr>') +
      '</tbody></table></div><div class="table-foot"><span>' + esc(t('showing')) + ' ' + rows.length + ' ' + esc(t('of')) + ' ' + DS.data.auditLogs.length + '</span></div></div>';

    page.setContent(stats + toolbar + table);
    bind();
  }

  function stat(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div></div>';
  }

  function bind() {
    var q = page.body.querySelector('[data-q]');
    if (q) q.addEventListener('input', DS.debounce(function () { state.q = q.value; render(); }, 160));
    var role = page.body.querySelector('[data-role]');
    if (role) role.addEventListener('change', function () { state.role = role.value; render(); });
  }

  var ex = page.root.querySelector('[data-export]');
  if (ex) ex.addEventListener('click', function () {
    var rows = [['Actor', 'Role', 'Action', 'Action EN', 'At']];
    list().forEach(function (l) { rows.push([DS.lang() === 'en' ? (l.actor_en || l.actor) : l.actor, l.role, l.action, l.action_en, l.at]); });
    DS.download('dotstudio-audit.csv', DS.csv(rows));
    DS.toast(t('saved'), 'success');
  });

  setTimeout(render, 160);
})();
