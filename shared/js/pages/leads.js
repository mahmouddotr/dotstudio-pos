/* DotStudio® POS — Giveaway leads (customer/win.html)
   Reads the same `ds_leads` bucket through shared/js/leads.js, so the landing
   page and this table can never disagree about what a lead looks like. */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon;
  var user = DS.session();
  if (!user) return;

  var page = DS.shell.mount({
    roles: ['superadmin', 'subadmin'],
    permission: user.role === 'subadmin' ? 'customers' : null,
    active: 'leads',
    title: t('leads'),
    eyebrow: t('admin'),
    icon: 'gift',
    sub: t('leadsSub'),
    actions: '<button class="btn btn-secondary" data-refresh>' + icon('refresh') + esc(t('refresh')) + '</button>' +
      '<button class="btn btn-primary" data-export>' + icon('download') + esc(t('leadsExport')) + '</button>',
    content: DS.skeleton.rows(8)
  });
  if (!page) return;

  var store = DS.leads || window.DSLeads;
  var EN = DS.lang() === 'en';
  var state = { q: '', sort: 'newest' };

  function list() {
    var rows = store.all();
    var q = state.q.trim().toLowerCase();
    if (q) {
      rows = rows.filter(function (l) {
        return (l.name + ' ' + l.phone + ' ' + l.email).toLowerCase().indexOf(q) > -1;
      });
    }
    if (state.sort === 'oldest') rows = rows.slice().reverse();
    else if (state.sort === 'name') {
      rows = rows.slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); });
    }
    return rows;
  }

  function stat(label, value, ico, tone, hint) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span>' +
      '<span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div>' +
      '<div class="stat-value" style="font-size:26px">' + esc(String(value)) + '</div>' +
      (hint ? '<div class="stat-sub" style="font-size:11px;color:var(--text-tertiary);margin-top:4px">' + esc(hint) + '</div>' : '') +
      '</div>';
  }

  function sourceLabel(source) {
    if (source === 'win-page') return EN ? 'Giveaway page' : 'صفحة السحب';
    return source || '—';
  }

  function render() {
    var rows = list();
    var s = store.stats();

    var stats = '<div class="kpi-grid">' +
      stat(t('leadsTotal'), s.total, 'users', 'lime', t('leadsLast') + ': ' + (s.last ? s.last.name : '—')) +
      stat(t('leadsToday'), s.today, 'clock', 'info', t('leadsWeek') + ': ' + s.week) +
      stat(t('leadsRepeat'), s.repeats, 'target', 'purple', EN ? 'Counted once per phone' : 'كل رقم بيتحسب مرة واحدة') +
      stat(t('leadsSource'), s.last ? sourceLabel(s.last.source) : '—', 'gift', 'green', s.last ? DS.datetime(s.last.lastAt) : '') +
      '</div>';

    var toolbar = '<div class="card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div class="search-mini" style="flex:1;min-width:220px">' + icon('search') +
      '<input data-q placeholder="' + esc(t('leadsSearch')) + '" value="' + esc(state.q) + '"></div>' +
      '<select class="select" data-sort style="width:auto;min-width:160px">' +
      [['newest', 'leadsNewest'], ['oldest', 'leadsOldest'], ['name', 'leadsByName']].map(function (o) {
        return '<option value="' + o[0] + '"' + (state.sort === o[0] ? ' selected' : '') + '>' + esc(t(o[1])) + '</option>';
      }).join('') + '</select>' +
      (rows.length ? '<button class="btn btn-secondary" data-clear style="color:var(--danger)">' + icon('trash') + esc(t('leadsClear')) + '</button>' : '') +
      '</div></div>';

    var table = '<div class="card"><div class="table-wrap flush"><table class="table"><thead><tr>' +
      '<th>' + esc(t('name')) + '</th><th>' + esc(t('phone')) + '</th><th>' + esc(t('email')) + '</th>' +
      '<th>' + esc(t('leadsAttempts')) + '</th><th>' + esc(t('date')) + '</th>' +
      '<th>' + esc(t('actions')) + '</th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (l) {
        var initial = (l.name || '?').trim().charAt(0).toUpperCase();
        return '<tr>' +
          '<td><div class="customer-cell"><span class="avatar sm" style="background:var(--surface-2);color:var(--lime-deep);font-weight:700">' + esc(initial) + '</span>' +
          '<div><div class="cell-title">' + esc(l.name || '—') + '</div><div class="cell-sub">#' + esc(l.id.slice(-4)) + ' · ' + esc(sourceLabel(l.source)) + '</div></div></div></td>' +
          '<td dir="ltr" style="white-space:nowrap"><a href="tel:' + esc(l.phone) + '" style="color:var(--text-primary);font-variant-numeric:tabular-nums">' + esc(l.phone || '—') + '</a></td>' +
          '<td dir="ltr" style="font-size:12px">' + (l.email ? '<a href="mailto:' + esc(l.email) + '" style="color:var(--text-secondary)">' + esc(l.email) + '</a>' : '<span style="color:var(--text-tertiary)">—</span>') + '</td>' +
          '<td>' + (l.attempts > 1 ? '<span class="badge warning">×' + esc(String(l.attempts)) + '</span>' : '<span style="color:var(--text-tertiary)">1</span>') + '</td>' +
          '<td style="font-size:11px;color:var(--text-tertiary);white-space:nowrap">' + esc(DS.datetime(l.date)) + '</td>' +
          '<td><div style="display:flex;gap:6px">' +
          '<button class="btn btn-icon" data-copy="' + esc(l.phone) + '" data-tip="' + esc(t('leadCopy')) + '" aria-label="' + esc(t('leadCopy')) + '">' + icon('copy') + '</button>' +
          '<a class="btn btn-icon" href="https://wa.me/2' + esc(l.phone) + '" target="_blank" rel="noopener" data-tip="' + esc(t('leadWa')) + '" aria-label="' + esc(t('leadWa')) + '">' + icon('chat') + '</a>' +
          '<button class="btn btn-icon" data-del="' + esc(l.id) + '" data-tip="' + esc(t('delete')) + '" aria-label="' + esc(t('delete')) + '" style="color:var(--danger)">' + icon('trash') + '</button>' +
          '</div></td></tr>';
      }).join('') : '<tr><td colspan="6">' + DS.empty({ icon: 'gift', title: state.q ? t('leadsNone') : t('leadsEmptyTitle'), text: state.q ? '' : t('leadsEmptyText') }) + '</td></tr>') +
      '</tbody></table></div><div class="table-foot"><span>' + esc(t('showing')) + ' ' + rows.length + ' ' + esc(t('of')) + ' ' + s.total + '</span></div></div>';

    page.setContent(stats + toolbar + table);
    bind();
  }

  function copy(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () {
        DS.toast(t('leadCopied'), 'success');
      }).catch(function () { DS.toast(t('leadCopied'), 'success'); });
    } else {
      DS.toast(t('leadCopied'), 'success');
    }
  }

  function bind() {
    var q = page.body.querySelector('[data-q]');
    if (q) {
      q.addEventListener('input', DS.debounce(function () { state.q = q.value; render(); }, 160));
    }
    var sort = page.body.querySelector('[data-sort]');
    if (sort) sort.addEventListener('change', function () { state.sort = sort.value; render(); });

    DS.$$('[data-copy]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { copy(b.getAttribute('data-copy')); });
    });

    DS.$$('[data-del]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        DS.confirm({ title: t('delete'), text: t('confirmDeleteText') }).then(function (ok) {
          if (!ok) return;
          store.remove(b.getAttribute('data-del'));
          DS.toast(t('leadsDeleted'), 'success');
          render();
        });
      });
    });

    var clear = page.body.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', function () {
      DS.confirm({ title: t('leadsClear'), text: t('leadsClearConfirm') }).then(function (ok) {
        if (!ok) return;
        var removed = store.clear();
        DS.toast(t('leadsCleared') + ' (' + removed + ')', 'success');
        render();
      });
    });
  }

  var refreshBtn = page.root.querySelector('[data-refresh]');
  if (refreshBtn) refreshBtn.addEventListener('click', function () { render(); DS.toast(t('refresh'), 'success'); });

  var exportBtn = page.root.querySelector('[data-export]');
  if (exportBtn) exportBtn.addEventListener('click', function () {
    var rows = [['Name', 'Phone', 'Email', 'Source', 'Entries', 'Registered at', 'Last entry at']].concat(store.rows());
    if (rows.length < 2) { DS.toast(t('leadsEmptyTitle'), 'warning'); return; }
    DS.download('dotstudio-giveaway-leads.csv', DS.csv(rows));
    DS.toast(t('saved'), 'success');
  });

  /* Another tab can register a lead while this table is open. */
  window.addEventListener('storage', function (e) {
    if (e.key === store.KEY) render();
  });

  setTimeout(render, 140);
})();
