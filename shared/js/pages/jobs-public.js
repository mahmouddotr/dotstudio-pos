/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — PUBLIC CAREERS
   Apple / Noon inspired: one big statement, quiet type, small icons,
   department filters and a single focused apply flow.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url;
  var session = DS.session();

  var state = { dept: 'all', q: '' };

  function L(ar, en) { return DS.lang() === 'en' ? en : ar; }
  function jobTitle(j) { return DS.lang() === 'en' ? (j.title_en || j.title) : j.title; }
  function jobDept(j) { return DS.lang() === 'en' ? (j.department_en || j.department || '') : (j.department || j.department_en || ''); }
  function jobLoc(j) { return DS.lang() === 'en' ? (j.location_en || j.location || '') : (j.location || j.location_en || ''); }
  function jobExp(j) { return DS.lang() === 'en' ? (j.experience_en || j.experience || '') : (j.experience || j.experience_en || ''); }
  function jobSalary(j) { return DS.lang() === 'en' ? (j.salary_en || j.salary || '') : (j.salary || j.salary_en || ''); }
  function jobDesc(j) { return DS.lang() === 'en' ? (j.description_en || j.description || '') : (j.description || j.description_en || ''); }

  function activeJobs() { return DS.data.jobs.filter(function (j) { return j.active !== false; }); }

  function departments() {
    var out = [];
    activeJobs().forEach(function (j) {
      var d = jobDept(j);
      if (d && out.indexOf(d) === -1) out.push(d);
    });
    return out;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return activeJobs().filter(function (j) {
      if (state.dept !== 'all' && jobDept(j) !== state.dept) return false;
      if (!q) return true;
      return (jobTitle(j) + ' ' + jobDept(j) + ' ' + jobLoc(j) + ' ' + jobDesc(j)).toLowerCase().indexOf(q) > -1;
    });
  }

  /* ─────────────────────────── SHELL ─────────────────────────── */
  function nav() {
    return '<header class="car-nav">' +
      '<a class="car-nav-logo" href="' + url('marketing/index.html') + '">' +
        '<img src="' + url('assets/img/LOGO-WHAIT.png') + '" alt="DotStudio®">' +
        '<b>DotStudio®</b></a>' +
      '<nav class="car-nav-links">' +
        '<a href="' + url('marketing/index.html') + '#features">' + esc(t('features')) + '</a>' +
        '<a href="' + url('marketing/index.html') + '#pricing">' + esc(t('pricing')) + '</a>' +
        '<a href="' + url('auth/public-chat.html') + '">' + esc(t('publicChat')) + '</a>' +
        '<a href="#roles">' + esc(L('الوظائف', 'Careers')) + '</a>' +
      '</nav>' +
      '<div class="car-nav-actions">' +
        '<div class="ds-lang-pill" role="group" aria-label="Language">' +
          '<button type="button" class="opt' + (DS.lang() === 'ar' ? ' active' : '') + '" data-set-lang="ar">AR</button>' +
          '<span class="sep">|</span>' +
          '<button type="button" class="opt' + (DS.lang() === 'en' ? ' active' : '') + '" data-set-lang="en">EN</button>' +
        '</div>' +
        (session
          ? '<a class="btn btn-primary btn-sm" href="' + url(DS.roleHome(session)) + '">' + icon('dashboard') + esc(t('dashboard')) + '</a>'
          : '<a class="btn btn-secondary btn-sm" href="' + url('index.html') + '">' + icon('login') + esc(t('login')) + '</a>') +
      '</div></header>';
  }

  function hero() {
    var count = activeJobs().length;
    return '<section class="car-hero">' +
      '<span class="car-eyebrow">' + icon('sparkles') + esc(L('نوظّف الآن · ' + count + ' وظيفة متاحة', 'We are hiring · ' + count + ' open roles')) + '</span>' +
      '<h1>' + esc(L('اصنع مستقبل', 'Build the future of')) + '<br><em>' + esc(L('التجارة الرقمية.', 'retail, with us.')) + '</em></h1>' +
      '<p>' + esc(L(
        'في DotStudio نبني أدوات يستخدمها آلاف المتاجر كل يوم — نقطة بيع، متجر إلكتروني، توصيل لحظي ومحادثات في نظام واحد. انضم لفريق صغير بيشتغل بسرعة وبيحب التفاصيل.',
        'At DotStudio we build tools thousands of stores rely on every day — POS, storefront, live delivery and chat in one system. Join a small team that moves fast and cares about craft.'
      )) + '</p>' +
      '<div class="car-hero-actions">' +
        '<a class="btn btn-primary" href="#roles">' + icon('arrowDown') + esc(L('استعرض الوظائف', 'Browse open roles')) + '</a>' +
        '<a class="btn btn-secondary" href="' + url('auth/public-chat.html') + '">' + icon('chat') + esc(L('كلّم فريقنا', 'Talk to the team')) + '</a>' +
      '</div>' +
      '<div class="car-stats">' +
        '<div class="car-stat"><b>' + count + '</b><span>' + esc(L('وظيفة متاحة', 'Open roles')) + '</span></div>' +
        '<div class="car-stat"><b>4</b><span>' + esc(L('متاجر على المنصة', 'Stores on platform')) + '</span></div>' +
        '<div class="car-stat"><b>2</b><span>' + esc(L('مدن', 'Cities')) + '</span></div>' +
        '<div class="car-stat"><b>100%</b><span>' + esc(L('عمل عن بُعد جزئياً', 'Hybrid friendly')) + '</span></div>' +
      '</div></section>';
  }

  function values() {
    /* Three clean Apple-style cards · minimal text. */
    var items = [
      { icon: 'zap', ar: 'أثر حقيقي', en: 'Real impact', tar: 'شغل يوصل لمتاجر حقيقية كل يوم.', ten: 'Work that reaches real stores every day.' },
      { icon: 'users', ar: 'فريق صغير', en: 'Small team', tar: 'ملكية كاملة وقرارات أسرع.', ten: 'Full ownership, faster decisions.' },
      { icon: 'trendingUp', ar: 'نمو مستمر', en: 'Keep growing', tar: 'تعلّم ومسار وظيفي واضح.', ten: 'Learning and a clear career path.' }
    ];
    var cardCss = 'background:var(--surface);border:1px solid var(--border);border-radius:24px;padding:28px 22px;' +
      'text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.18);transition:transform .25s ease,border-color .25s ease';
    return '<section class="car-section" style="padding-top:4px">' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px">' +
      items.map(function (v) {
        return '<article class="car-card-clean" style="' + cardCss + '">' +
          '<span style="width:52px;height:52px;border-radius:16px;display:grid;place-items:center;margin:0 auto 14px;' +
            'background:var(--lime-soft);color:var(--lime)">' + icon(v.icon) + '</span>' +
          '<b style="display:block;font-size:16px;letter-spacing:-.01em;color:var(--text-primary)">' + esc(L(v.ar, v.en)) + '</b>' +
          '<p style="margin:8px 0 0;font-size:12.5px;line-height:1.6;color:var(--text-tertiary)">' + esc(L(v.tar, v.ten)) + '</p>' +
        '</article>';
      }).join('') + '</div></section>';
  }

  function roles() {
    var depts = departments();
    var list = filtered();
    var chips = '<button class="car-filter' + (state.dept === 'all' ? ' is-active' : '') + '" data-dept="all">' +
        esc(L('الكل', 'All')) + ' · ' + activeJobs().length + '</button>' +
      depts.map(function (d) {
        var n = activeJobs().filter(function (j) { return jobDept(j) === d; }).length;
        return '<button class="car-filter' + (state.dept === d ? ' is-active' : '') + '" data-dept="' + esc(d) + '">' + esc(d) + ' · ' + n + '</button>';
      }).join('');

    var rows = list.map(function (j) {
      return '<button type="button" class="car-job" data-apply="' + esc(j.id) + '">' +
        '<span class="car-job-ic">' + icon('jobs') + '</span>' +
        '<span class="car-job-main">' +
          '<span class="car-job-title">' + esc(jobTitle(j)) +
            '<span class="badge lime">' + esc(t(j.type)) + '</span></span>' +
          '<span class="car-job-meta">' +
            '<span>' + icon('building') + esc(jobDept(j)) + '</span>' +
            '<span>' + icon('mapPin') + esc(jobLoc(j)) + '</span>' +
            (jobExp(j) ? '<span>' + icon('clock') + esc(jobExp(j)) + '</span>' : '') +
          '</span>' +
          (jobDesc(j) ? '<span class="car-job-desc" style="display:block;margin-top:6px;font-size:11.5px;line-height:1.6;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">' + esc(jobDesc(j)) + '</span>' : '') +
        '</span>' +
        '<span class="car-job-side">' +
          (jobSalary(j) ? '<span class="car-job-salary">' + esc(jobSalary(j)) + '</span>' : '') +
          '<span class="car-job-arrow">' + icon('arrowLeft') + '</span>' +
        '</span></button>';
    }).join('');

    return '<section class="car-section car-roles" id="roles">' +
      '<div class="car-section-head"><div><h2>' + esc(L('الوظائف المتاحة', 'Open roles')) + '</h2>' +
        '<p>' + esc(L('اختر القسم أو ابحث بالاسم — التقديم دقيقة واحدة.', 'Filter by team or search by name — applying takes a minute.')) + '</p></div></div>' +
      '<div class="car-filters">' + chips +
        '<label class="car-search">' + icon('search') +
          '<input type="search" data-job-search value="' + esc(state.q) + '" placeholder="' + esc(L('ابحث عن وظيفة…', 'Search roles…')) + '" aria-label="' + esc(L('بحث', 'Search')) + '"></label>' +
      '</div>' +
      (rows ? '<div class="car-list">' + rows + '</div>'
        : '<div class="car-empty">' + icon('search') + '<div><b>' + esc(L('مفيش وظائف مطابقة', 'No matching roles')) + '</b><div style="margin-top:4px">' + esc(L('جرّب كلمة تانية أو اختار «الكل».', 'Try another keyword or pick “All”.')) + '</div></div></div>') +
    '</section>';
  }

  function closing() {
    return '<section class="car-cta"><div class="car-cta-inner">' +
      '<span class="car-value-ic" style="margin:0;flex-shrink:0">' + icon('message') + '</span>' +
      '<div><b>' + esc(L('عندك سؤال قبل التقديم؟', 'Questions before you apply?')) + '</b>' +
        '<p>' + esc(L('كلّم فريقنا في المحادثة العامة — بنرد بسرعة وبنشرح كل تفصيلة.', 'Talk to our team in the public chat — we reply fast and explain every detail.')) + '</p></div>' +
      '<a class="btn btn-primary" href="' + url('auth/public-chat.html') + '">' + icon('chat') + esc(t('publicChat')) + '</a>' +
    '</div></section>';
  }

  function foot() {
    return '<footer class="car-foot">' +
      '<span>© ' + new Date().getFullYear() + ' DotStudio®. ' + esc(t('allRights')) + '</span>' +
      '<span style="display:flex;gap:16px"><a href="' + url('marketing/index.html') + '">' + esc(t('marketing')) + '</a>' +
      '<a href="' + url('index.html') + '">' + esc(t('login')) + '</a>' +
      '<a href="' + url('auth/public-chat.html') + '">' + esc(t('publicChat')) + '</a></span></footer>';
  }

  function render() {
    document.body.innerHTML = '<div class="car-page">' + nav() + hero() + values() + roles() + closing() + foot() + '</div>';
    bind();
  }

  function bind() {
    DS.$$('[data-dept]').forEach(function (b) {
      b.addEventListener('click', function () { state.dept = b.getAttribute('data-dept'); render(); });
    });
    var search = document.querySelector('[data-job-search]');
    if (search) {
      var timer = null;
      search.addEventListener('input', function () {
        state.q = search.value;
        clearTimeout(timer);
        timer = setTimeout(function () {
          var pos = search.selectionStart;
          render();
          var again = document.querySelector('[data-job-search]');
          if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) {} }
        }, 180);
      });
    }
    DS.$$('[data-apply]').forEach(function (b) {
      b.addEventListener('click', function (event) {
        /* Applying must never touch the page language or navigate away. */
        event.preventDefault();
        event.stopPropagation();
        apply(b.getAttribute('data-apply'));
      });
    });
  }

  function apply(jobId) {
    var job = DS.data.jobs.filter(function (j) { return j.id === jobId; })[0];
    if (!job) return;
    var wa = 'https://wa.me/' + (DS.data.WHATSAPP || '201226770582') + '?text=' +
      encodeURIComponent(L('مرحباً، أرغب في التقديم على وظيفة ', 'Hello, I would like to apply for ') + jobTitle(job));

    DS.modal({
      title: t('applyFor') + ' · ' + esc(jobTitle(job)),
      sub: esc(jobDept(job)) + ' · ' + esc(jobLoc(job)),
      body: '<div class="field-grid">' +
        '<div class="field"><label>' + esc(t('name')) + ' *</label><input class="input" id="jName" value="' + esc(session ? session.name : '') + '"></div>' +
        '<div class="field"><label>' + esc(t('phone')) + ' *</label><input class="input" id="jPhone" value="' + esc(session && session.phone ? session.phone : '') + '" style="direction:ltr" placeholder="01xxxxxxxxx"></div>' +
        '<div class="field"><label>' + esc(t('email')) + '</label><input class="input" id="jEmail" type="email" value="' + esc(session ? (session.email || '') : '') + '" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(t('experience')) + '</label><input class="input" id="jYears" placeholder="' + esc(L('مثال: سنتان', 'e.g. 2 years')) + '"></div>' +
        '</div><div class="field" style="margin-top:12px"><label>' + esc(t('notes')) + '</label><textarea class="textarea" id="jNote" rows="3" placeholder="' + esc(L('قولنا ليه انت مناسب للوظيفة…', 'Tell us why you are a great fit…')) + '"></textarea></div>',
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('sendWhatsapp'), variant: 'btn-secondary', icon: icon('whatsapp'), onClick: function () { window.open(wa, '_blank', 'noopener'); } },
        { label: t('applyNow'), variant: 'btn-primary', onClick: function (root) {
          var name = root.querySelector('#jName').value.trim();
          var phone = root.querySelector('#jPhone').value.trim();
          if (!name) { DS.toast(t('required'), 'error'); return false; }
          if (!/^01\d{9}$/.test(phone)) { DS.toast(t('invalidPhone'), 'error'); return false; }
          DS.data.applyJob(jobId, {
            job_id: jobId,
            job_title: job.title,
            name: name, phone: phone, email: root.querySelector('#jEmail').value.trim(),
            experience: root.querySelector('#jYears').value.trim(), note: root.querySelector('#jNote').value.trim()
          });
          DS.modal({
            title: t('applicationSent'),
            body: '<div style="text-align:center;padding:14px 0"><div class="empty-icon" style="margin:0 auto 12px;background:var(--success-soft);color:var(--success)">' + icon('checkCircle') + '</div>' +
              '<p style="color:var(--text-secondary);font-size:13px;line-height:1.7">' + esc(t('applicationSentText')) + '</p></div>',
            actions: [
              { label: t('close'), variant: 'btn-secondary' },
              { label: t('sendWhatsapp'), variant: 'btn-primary', icon: icon('whatsapp'), onClick: function () { window.open(wa, '_blank', 'noopener'); } }
            ]
          });
          return true;
        } }
      ]
    });
  }

  render();
  document.addEventListener('ds:lang', render);
})();
