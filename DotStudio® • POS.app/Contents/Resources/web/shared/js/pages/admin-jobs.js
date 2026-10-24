/* DotStudio® POS — Jobs management (admin) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url;
  var page = DS.shell.mount({
    roles: ['superadmin', 'subadmin', 'owner'],
    permission: 'jobs',
    active: 'jobs',
    title: t('jobs'),
    eyebrow: DS.session() && DS.session().role === 'owner' ? (DS.data.tenantById(DS.session().tenant_id) || {}).name : t('admin'),
    icon: 'jobs',
    sub: DS.lang() === 'en' ? 'Open roles, applications and hiring pipeline.' : 'الوظائف المتاحة وطلبات التوظيف ومسار الاختيار.',
    actions: '<a class="btn btn-secondary" href="' + url('auth/jobs/jobs.html') + '" target="_blank" rel="noopener">' + icon('external') + esc(t('view')) + '</a>' +
      '<button class="btn btn-primary" data-add>' + icon('plus') + esc(t('addJob')) + '</button>',
    content: DS.skeleton.rows(5)
  });
  if (!page) return;

  var tab = 'jobs';
  var user = page.user;

  function render() {
    var jobs = DS.data.jobs.filter(function (j) { return user.role !== 'owner' || j.tenant_id === user.tenant_id; });
    var apps = DS.data.applications;
    var stats = '<div class="kpi-grid">' +
      stat(t('jobs'), jobs.filter(function (j) { return j.active !== false; }).length, 'jobs', 'lime') +
      stat(t('myApplications'), apps.length, 'file', 'info') +
      stat(t('newCustomers'), apps.filter(function (a) { return a.status === 'new'; }).length, 'sparkles', 'orange') +
      stat(t('department'), new Set(jobs.map(function (j) { return j.department; })).size, 'layers', 'purple') + '</div>';

    var tabs = '<div class="tabs"><button class="tab' + (tab === 'jobs' ? ' active' : '') + '" data-tab="jobs">' + esc(t('jobs')) + ' <span class="badge neutral">' + jobs.length + '</span></button>' +
      '<button class="tab' + (tab === 'apps' ? ' active' : '') + '" data-tab="apps">' + esc(t('myApplications')) + ' <span class="badge neutral">' + apps.length + '</span></button></div>';

    var content;
    if (tab === 'jobs') {
      content = '<div class="job-list">' + (jobs.length ? jobs.map(function (j) {
        var count = apps.filter(function (a) { return a.job_id === j.id; }).length;
        return '<div class="job-card"><div class="job-main"><div class="job-title">' + esc(DS.loc(j, 'title')) + ' ' + (j.active === false ? DS.badge('suspended', t('inactive')) : DS.badge('active', t('active'))) + '</div>' +
          '<div class="job-meta"><span>' + icon('building') + esc(DS.loc(j, 'department')) + '</span><span>' + icon('mapPin') + esc(DS.loc(j, 'location')) + '</span><span>' + icon('clock') + esc(t(j.type)) + '</span><span>' + icon('file') + count + ' ' + esc(t('myApplications')) + '</span></div></div>' +
          '<div class="job-side"><span class="job-salary">' + esc(DS.loc(j, 'salary')) + '</span>' +
          '<button class="btn btn-secondary btn-sm" data-edit="' + esc(j.id) + '">' + icon('edit') + esc(t('edit')) + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-toggle="' + esc(j.id) + '">' + icon(j.active === false ? 'play' : 'pause') + '</button></div></div>';
      }).join('') : DS.empty({ icon: 'jobs', title: t('noJobs'), text: t('jobsSub'), cta: { label: t('addJob'), icon: 'plus', onclick: 'document.querySelector("[data-add]").click()' } })) + '</div>';
    } else {
      content = '<div class="card"><div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(t('name')) + '</th><th>' + esc(t('phone')) + '</th><th>' + esc(t('jobs')) + '</th><th>' + esc(t('date')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        (apps.length ? apps.map(function (a) {
          var job = jobs.filter(function (j) { return j.id === a.job_id; })[0];
          return '<tr><td><div class="cell-title">' + esc(a.name) + '</div><div class="cell-sub" style="direction:ltr;text-align:start">' + esc(a.email || '') + '</div></td>' +
            '<td style="direction:ltr;text-align:start">' + esc(a.phone) + '</td><td>' + esc(job ? DS.loc(job, 'title') : '—') + '</td>' +
            '<td style="font-size:11px;color:var(--text-tertiary)">' + esc(DS.datetime(a.at)) + '</td><td>' + DS.badge('pending', t('pending')) + '</td></tr>';
        }).join('') : '<tr><td colspan="5">' + DS.empty({ icon: 'file', title: t('noData'), text: DS.lang() === 'en' ? 'Applications will appear here.' : 'ستظهر طلبات التوظيف هنا.' }) + '</td></tr>') +
        '</tbody></table></div></div>';
    }

    page.setContent(stats + tabs + content);
    bind();
  }

  function stat(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div></div>';
  }

  function bind() {
    DS.$$('[data-tab]', page.body).forEach(function (b) { b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); render(); }); });
    DS.$$('[data-edit]', page.body).forEach(function (b) { b.addEventListener('click', function () { edit(DS.data.jobs.filter(function (j) { return j.id === b.getAttribute('data-edit'); })[0]); }); });
    DS.$$('[data-toggle]', page.body).forEach(function (b) { b.addEventListener('click', function () {
      var j = DS.data.jobs.filter(function (x) { return x.id === b.getAttribute('data-toggle'); })[0];
      DS.data.saveJob({ id: j.id, active: j.active === false });
      DS.toast(t('updated'), 'success');
      render();
    }); });
  }

  function edit(j) {
    var isNew = !j;
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(t('jobDesc')) + ' *</label><input class="input" id="jTitle" value="' + esc(j ? j.title : '') + '"></div>' +
      '<div class="field"><label>Title (EN)</label><input class="input" id="jTitleEn" value="' + esc(j ? (j.title_en || '') : '') + '" style="direction:ltr"></div>' +
      '<div class="field"><label>' + esc(t('department')) + '</label><input class="input" id="jDept" value="' + esc(j ? j.department : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('location')) + '</label><input class="input" id="jLoc" value="' + esc(j ? j.location : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('salary')) + '</label><input class="input" id="jSalary" value="' + esc(j ? j.salary : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('experience')) + '</label><input class="input" id="jExp" value="' + esc(j ? j.experience : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('date')) + '</label><select class="select" id="jType">' + ['fullTime', 'partTime', 'remote'].map(function (k) { return '<option value="' + k + '"' + (j && j.type === k ? ' selected' : '') + '>' + esc(t(k)) + '</option>'; }).join('') + '</select></div>' +
      '</div><div class="field" style="margin-top:12px"><label>' + esc(t('jobDesc')) + '</label><textarea class="textarea" id="jDesc" rows="3">' + esc(j ? j.description : '') + '</textarea></div>' +
      '<div class="field" style="margin-top:12px"><label>' + (DS.lang() === 'en' ? 'Store details' : 'بيانات المتجر') + '</label><input class="input" id="jStore" value="' + esc(j ? (j.store_details || '') : (user.role === 'owner' && DS.data.tenantById(user.tenant_id) ? DS.data.tenantById(user.tenant_id).name : '')) + '"></div>' +
      '<div class="field" style="margin-top:12px"><label>' + (DS.lang() === 'en' ? 'Contact info' : 'بيانات التواصل') + '</label><input class="input" id="jContact" value="' + esc(j ? (j.contact_info || '') : '') + '" placeholder="WhatsApp / phone / email"></div>' +
      '<div class="field" style="margin-top:12px"><label>' + esc(t('requirements')) + ' (' + (DS.lang() === 'en' ? 'one per line' : 'كل متطلب في سطر') + ')</label><textarea class="textarea" id="jReq" rows="3">' + esc(j ? (j.requirements || []).join('\n') : '') + '</textarea></div>';
    DS.modal({
      size: 'lg', title: isNew ? t('addJob') : t('edit'), body: body,
      actions: [{ label: t('cancel'), variant: 'btn-secondary' }, { label: t('saveChanges'), variant: 'btn-primary', onClick: function (root) {
        var title = root.querySelector('#jTitle').value.trim();
        if (!title) { DS.toast(t('required'), 'error'); return false; }
        var data = {
          title: title, title_en: root.querySelector('#jTitleEn').value.trim() || title,
          department: root.querySelector('#jDept').value.trim() || (DS.lang() === 'en' ? 'General' : 'عام'),
          location: root.querySelector('#jLoc').value.trim() || (DS.lang() === 'en' ? 'Cairo' : 'القاهرة'),
          salary: root.querySelector('#jSalary').value.trim() || '—',
          experience: root.querySelector('#jExp').value.trim() || '—',
          type: root.querySelector('#jType').value,
          description: root.querySelector('#jDesc').value.trim(),
          store_details: root.querySelector('#jStore').value.trim(),
          contact_info: root.querySelector('#jContact').value.trim(),
          tenant_id: user.role === 'owner' ? user.tenant_id : (j && j.tenant_id) || null,
          requirements: root.querySelector('#jReq').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean)
        };
        if (j) data.id = j.id;
        DS.data.saveJob(data);
        DS.toast(t('saved'), 'success');
        render();
        return true;
      } }]
    });
  }

  var add = page.root.querySelector('[data-add]');
  if (add) add.addEventListener('click', function () { edit(null); });
  setTimeout(render, 160);
})();
