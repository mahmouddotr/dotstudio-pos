/* DotStudio® POS — Public careers page */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url;
  var session = DS.session();

  function pageShell(inner) {
    return '<div style="min-height:100vh;background:var(--bg)">' +
      '<header class="mkt-nav"><a href="' + url('marketing/index.html') + '" style="display:flex;align-items:center"><img src="' + url('assets/img/LOGO-WHAIT.png') + '" alt="DotStudio" style="height:40px!important;width:auto!important"></a>' +
        '<nav class="mkt-nav-links" style="display:none" id="navLinks"><a href="' + url('marketing/index.html') + '#features">' + esc(t('features')) + '</a><a href="' + url('marketing/index.html') + '#pricing">' + esc(t('pricing')) + '</a><a href="' + url('auth/public-chat.html') + '">' + esc(t('publicChat')) + '</a></nav>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<div class="ds-lang-pill" role="group" aria-label="Language">' +
            '<button type="button" class="opt' + (DS.lang() === 'ar' ? ' active' : '') + '" data-set-lang="ar">AR</button>' +
            '<span class="sep">|</span>' +
            '<button type="button" class="opt' + (DS.lang() === 'en' ? ' active' : '') + '" data-set-lang="en">EN</button></div>' +
          (session ? '<a class="btn btn-primary btn-sm" href="' + url(DS.roleHome(session)) + '">' + icon('dashboard') + esc(t('dashboard')) + '</a>'
            : '<a class="btn btn-secondary btn-sm" href="' + url('index.html') + '">' + icon('login') + esc(t('login')) + '</a>') +
        '</div></header>' +
      '<div style="max-width:900px;margin:0 auto;padding:120px 20px 70px">' + inner + '</div>' +
      '<footer class="mkt-footer" style="border-top:1px solid var(--border);max-width:900px"><span>© ' + new Date().getFullYear() + ' DotStudio®. ' + esc(t('allRights')) + '</span>' +
        '<span style="display:flex;gap:16px"><a href="' + url('marketing/index.html') + '">' + esc(t('marketing')) + '</a><a href="' + url('index.html') + '">' + esc(t('login')) + '</a><a href="' + url('auth/public-chat.html') + '">' + esc(t('publicChat')) + '</a></span></footer></div>';
  }

  function render() {
    var jobs = DS.data.jobs.filter(function (j) { return j.active !== false; });
    var inner = '<div style="text-align:center;margin-bottom:36px">' +
      '<span class="mkt-kicker">' + icon('sparkles') + ' ' + esc(t('jobsTitle')) + '</span>' +
      '<h1 style="font-size:clamp(32px,5vw,52px);font-weight:700;letter-spacing:-.04em;line-height:1.2">' + esc(t('jobsTitle')) + '</h1>' +
      '<p style="color:var(--text-secondary);font-size:16px;max-width:560px;margin:12px auto 0;line-height:1.7">' + esc(t('jobsSub')) + '</p></div>' +
      '<div class="job-list">' + (jobs.length ? jobs.map(function (j) {
        return '<div class="job-card"><div class="job-main"><div class="job-title">' + esc(DS.lang() === 'en' ? (j.title_en || j.title) : j.title) + ' <span class="badge lime">' + esc(t(j.type)) + '</span></div>' +
          '<div class="job-meta"><span>' + icon('building') + esc(DS.lang() === 'en' ? (j.department_en || j.department) : j.department) + '</span>' +
          '<span>' + icon('mapPin') + esc(DS.lang() === 'en' ? (j.location_en || j.location) : j.location) + '</span>' +
          '<span>' + icon('clock') + esc(DS.lang() === 'en' ? (j.experience_en || j.experience) : j.experience) + '</span></div>' +
          '<p style="font-size:12px;color:var(--text-tertiary);margin-top:6px;line-height:1.6">' + esc(DS.lang() === 'en' ? (j.description_en || j.description) : j.description) + '</p></div>' +
          '<div class="job-side"><span class="job-salary">' + esc(DS.lang() === 'en' ? (j.salary_en || j.salary) : j.salary) + '</span>' +
          '<button class="btn btn-primary btn-sm" data-apply="' + esc(j.id) + '">' + icon('arrowUpRight') + esc(t('applyNow')) + '</button></div></div>';
      }).join('') : DS.empty({ icon: 'jobs', title: t('noJobs'), text: t('jobsSub'), cta: { label: t('publicChat'), icon: 'chat', onclick: "location.href='" + url('auth/public-chat.html') + "'" } })) + '</div>' +
      '<div class="card" style="margin-top:28px;padding:22px;text-align:center"><div class="section-title" style="justify-content:center">' + icon('chat') + esc(DS.lang() === 'en' ? 'Questions about a role?' : 'عندك سؤال عن وظيفة؟') + '</div>' +
        '<p style="color:var(--text-secondary);font-size:13px;margin:8px 0 14px">' + esc(DS.lang() === 'en' ? 'Talk to our team in the public chat — we reply fast.' : 'كلّم فريقنا في المحادثة العامة — بنرد بسرعة.') + '</p>' +
        '<a class="btn btn-secondary" href="' + url('auth/public-chat.html') + '">' + icon('chat') + esc(t('publicChat')) + '</a></div>';

    document.body.innerHTML = pageShell(inner);
    bind();
  }

  function bind() {
    var lang = document.querySelector('[data-lang]');
    if (lang) lang.addEventListener('click', function () { DS.toggleLang(); location.reload(); });
    DS.$$('[data-apply]').forEach(function (b) {
      b.addEventListener('click', function () { apply(b.getAttribute('data-apply')); });
    });
  }

  function apply(jobId) {
    var job = DS.data.jobs.filter(function (j) { return j.id === jobId; })[0];
    if (!job) return;
    DS.modal({
      title: t('applyFor') + ' · ' + esc(DS.lang() === 'en' ? (job.title_en || job.title) : job.title),
      sub: esc(job.department) + ' · ' + esc(job.location),
      body: '<div class="field-grid">' +
        '<div class="field"><label>' + esc(t('name')) + ' *</label><input class="input" id="jName" value="' + esc(session ? session.name : '') + '"></div>' +
        '<div class="field"><label>' + esc(t('phone')) + ' *</label><input class="input" id="jPhone" value="' + esc(session && session.phone ? session.phone : '') + '" style="direction:ltr" placeholder="01xxxxxxxxx"></div>' +
        '<div class="field"><label>' + esc(t('email')) + '</label><input class="input" id="jEmail" type="email" value="' + esc(session ? (session.email || '') : '') + '" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(t('experience')) + '</label><input class="input" id="jYears" placeholder="' + esc(DS.lang() === 'en' ? 'e.g. 2 years' : 'مثال: سنتان') + '"></div>' +
        '</div><div class="field" style="margin-top:12px"><label>' + esc(t('notes')) + '</label><textarea class="textarea" id="jNote" rows="3" placeholder="' + esc(DS.lang() === 'en' ? 'Tell us why you are a great fit…' : 'قولنا ليه انت مناسب للوظيفة…') + '"></textarea></div>',
      actions: [{ label: t('cancel'), variant: 'btn-secondary' }, { label: t('applyNow'), variant: 'btn-primary', onClick: function (root) {
        var name = root.querySelector('#jName').value.trim();
        var phone = root.querySelector('#jPhone').value.trim();
        if (!name) { DS.toast(t('required'), 'error'); return false; }
        if (!/^01\d{9}$/.test(phone)) { DS.toast(t('invalidPhone'), 'error'); return false; }
        DS.data.applyJob(jobId, {
          name: name, phone: phone, email: root.querySelector('#jEmail').value.trim(),
          experience: root.querySelector('#jYears').value.trim(), note: root.querySelector('#jNote').value.trim()
        });
        DS.modal({
          title: t('applicationSent'), body: '<div style="text-align:center;padding:14px 0"><div class="empty-icon" style="margin:0 auto 12px;background:var(--success-soft);color:var(--success)">' + icon('checkCircle') + '</div><p style="color:var(--text-secondary);font-size:13px;line-height:1.7">' + esc(t('applicationSentText')) + '</p></div>',
          actions: [{ label: t('close'), variant: 'btn-primary' }]
        });
        return true;
      } }]
    });
  }

  render();
})();
