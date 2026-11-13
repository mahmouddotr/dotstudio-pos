/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — AI AGENCY (System Health Monitor)
   «الرقيب الآلي» — futuristic command centre that patrols the demo
   platform: hero imagery, the 18 default accounts and the critical
   commerce buttons. Everything runs locally, read-only.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url;
  var user = DS.session();
  if (!user) return;
  var EN = DS.lang() === 'en';
  function L(ar, en) { return EN ? en : ar; }

  /* ── The five premium hero frames (must match storefront.js) ──── */
  var HERO_IMAGES = [
    { src: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=1920&auto=format&fit=crop', label: 'Tech', labelAr: 'التقنية' },
    { src: 'https://images.unsplash.com/photo-1558002038-1055907df827?q=80&w=1920&auto=format&fit=crop', label: 'Smart home', labelAr: 'المنزل الذكي' },
    { src: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=1920&auto=format&fit=crop', label: 'Beauty', labelAr: 'الجمال' },
    { src: 'https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=1920&auto=format&fit=crop', label: 'Fashion', labelAr: 'الموضة' },
    { src: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1920&auto=format&fit=crop', label: 'Bestsellers', labelAr: 'الأكثر مبيعاً' }
  ];

  /* ── The 18 default demo accounts ─────────────────────────────── */
  var ACCOUNTS = [
    { username: 'admin', role: 'superadmin' },
    { username: 'dina', role: 'subadmin' },
    { username: 'amal', role: 'subadmin' },
    { username: 'fatma', role: 'subadmin' },
    { username: 'nada', role: 'subadmin' },
    { username: 'basmala', role: 'subadmin' },
    { username: 'caznova', role: 'owner' },
    { username: 'smozy', role: 'owner' },
    { username: 'bnsheikh', role: 'owner' },
    { username: 'mastore', role: 'owner' },
    { username: 'ca_cashier', role: 'cashier' },
    { username: 'sm_cashier', role: 'cashier' },
    { username: 'bn_cashier', role: 'cashier' },
    { username: 'ma_cashier', role: 'cashier' },
    { username: 'talqa', role: 'delivery' },
    { username: 'hala', role: 'delivery' },
    { username: 'ahla', role: 'delivery' },
    { username: 'customer', role: 'customer' }
  ];

  var page = DS.shell.mount({
    roles: ['superadmin', 'subadmin'],
    permission: 'settings',
    active: 'aiAgency',
    title: L('الوكالة الذكية', 'AI Agency'),
    eyebrow: L('الرقيب الآلي', 'Patrol officer'),
    icon: 'target',
    sub: L('مركز قيادة صحة النظام — فحص الصور، الحسابات والأزرار الحرجة في ثوانٍ.',
      'System-health command centre — images, accounts and critical buttons in seconds.'),
    content: DS.skeleton.cards(3)
  });
  if (!page) return;

  var state = {
    running: false,
    done: false,
    pass: 0,
    fail: 0,
    warn: 0,
    heroProbe: null,
    clock: null
  };

  /* ─────────────────────────── HELPERS ─────────────────────────── */
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(date) {
    var d = date || new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function dbInfo() {
    var db = null;
    try { db = JSON.parse(localStorage.getItem('ds_db_v1') || 'null'); } catch (e) {}
    if (!db && DS.data) {
      db = { users: DS.data.users || [], tenants: DS.data.tenants || [], products: DS.data.products || [] };
    }
    return db || { users: [], tenants: [], products: [] };
  }

  /* Probe the five hero frames once (cached across runs). */
  function probeHeroImages() {
    if (state.heroProbe) return state.heroProbe;
    state.heroProbe = Promise.all(HERO_IMAGES.map(function (item, i) {
      return new Promise(function (resolve) {
        var settled = false;
        var img = new Image();
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          resolve({ index: i, ok: false, width: 0 });
        }, 10000);
        img.onload = function () {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ index: i, ok: img.naturalWidth > 0, width: img.naturalWidth });
        };
        img.onerror = function () {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve({ index: i, ok: false, width: 0 });
        };
        img.src = item.src;
      });
    }));
    return state.heroProbe;
  }

  /* Live DOM probe of the storefront through a hidden iframe.
     Falls back to a source-level wiring check when the customer
     folder is not reachable from this session (role guard). */
  function probeStorefrontButtons() {
    return new Promise(function (resolve) {
      var frame = document.createElement('iframe');
      frame.className = 'aia-probe-frame';
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      var settled = false;
      var timer = null;
      function finish(res) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        try { frame.remove(); } catch (e) {}
        resolve(res);
      }
      timer = setTimeout(function () { finish({ mode: 'timeout' }); }, 12000);
      frame.onload = function () {
        var win = frame.contentWindow;
        var path = '';
        try { path = String(win.location.pathname || ''); } catch (e) { path = ''; }
        if (path && path.indexOf('storefront') === -1) { finish({ mode: 'guarded' }); return; }
        setTimeout(function () {
          try {
            var doc = frame.contentDocument;
            if (!doc) { finish({ mode: 'error' }); return; }
            var slides = doc.querySelectorAll('.sf-hero-slide, .sf-hero-bg img');
            var heroLoaded = 0;
            Array.prototype.forEach.call(slides, function (im) {
              if (im && im.complete && im.naturalWidth > 0) heroLoaded++;
            });
            var adds = doc.querySelectorAll('[data-add]');
            var clickable = 0;
            Array.prototype.forEach.call(adds, function (b) {
              if (b && !b.disabled && b.getAttribute('aria-disabled') !== 'true') clickable++;
            });
            var openCart = doc.querySelector('[data-open-cart]');
            if (openCart) { try { openCart.click(); } catch (e) {} }
            setTimeout(function () {
              var bagGo = doc.querySelector('[data-bag-go]');
              var shop = doc.querySelector('[data-scroll-products]');
              finish({
                mode: 'live',
                heroSlides: slides.length,
                heroLoaded: heroLoaded,
                addButtons: adds.length,
                addClickable: clickable,
                checkout: !!bagGo,
                checkoutBlocked: !!(bagGo && bagGo.getAttribute('aria-disabled') === 'true'),
                shop: !!shop
              });
            }, 550);
          } catch (e) { finish({ mode: 'error' }); }
        }, 900);
      };
      frame.src = url('customer/storefront.html');
      document.body.appendChild(frame);
    });
  }

  /* Source-level fallback: the wiring that powers the two buttons. */
  function probeStorefrontSource() {
    return fetch(url('shared/js/pages/storefront.js'), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (src) {
        if (!src) return { mode: 'error' };
        return {
          mode: 'source',
          addWired: src.indexOf('data-add="') > -1,
          checkoutWired: src.indexOf('[data-bag-go]') > -1 || src.indexOf('data-bag-go') > -1,
          shopWired: src.indexOf('data-scroll-products') > -1
        };
      })
      .catch(function () { return { mode: 'error' }; });
  }

  /* ─────────────────────────── MARKUP ──────────────────────────── */
  function statusTile(key, iconName, title, sub) {
    return '<div class="aia-tile" data-tile="' + key + '">' +
      '<span class="aia-tile-ic">' + icon(iconName) + '</span>' +
      '<div class="aia-tile-copy"><b>' + esc(title) + '</b><span data-tile-state>' + esc(sub) + '</span></div>' +
      '<i class="aia-dot" data-tile-dot></i>' +
    '</div>';
  }

  function markup() {
    return '<div class="aia">' +
      '<section class="aia-hero">' +
        '<div class="aia-glow" aria-hidden="true"></div>' +
        '<div class="aia-hero-top">' +
          '<span class="aia-badge"><i class="aia-live"></i>' + esc(L('الوكالة الذكية · الرقيب الآلي', 'AI Agency · Patrol officer')) + '</span>' +
          '<span class="aia-clock">' + icon('clock') + '<b data-clock>' + stamp() + '</b></span>' +
        '</div>' +
        '<h2 class="aia-title">' + esc(L('مركز قيادة صحة النظام', 'System health command centre')) + '</h2>' +
        '<p class="aia-sub">' + esc(L(
          'يفحص الرقيب الآلي كل شيء محلياً: صور الواجهة الخمس، الحسابات الافتراضية الثمانية عشر، وأزرار الشراء والدفع — ثم يسجّل كل نتيجة أمامك.',
          'The patrol officer checks everything locally: the five hero frames, the eighteen default accounts and the buy/checkout buttons — logging every result live.')) + '</p>' +
        '<div class="aia-status-grid">' +
          statusTile('db', 'database', L('قاعدة البيانات (LocalStorage)', 'Database (LocalStorage)'), L('جارٍ الفحص…', 'Checking…')) +
          statusTile('images', 'image', L('الصور', 'Images'), L('جارٍ الفحص…', 'Checking…')) +
          statusTile('auth', 'shield', L('المصادقة', 'Auth'), L('جارٍ الفحص…', 'Checking…')) +
        '</div>' +
        '<div class="aia-actions">' +
          '<button type="button" class="aia-run" data-run>' + icon('zap') +
            '<span data-run-label>' + esc(L('بدء الفحص الشامل', 'Start full diagnostic')) + '</span>' + icon('arrowLeft') +
          '</button>' +
          '<button type="button" class="aia-ghost" data-clear>' + icon('refresh') + esc(L('مسح السجل', 'Clear log')) + '</button>' +
          '<a class="aia-ghost" href="' + url('customer/storefront.html') + '" target="_blank" rel="noopener">' + icon('store') + esc(L('فتح المتجر', 'Open storefront')) + '</a>' +
        '</div>' +
      '</section>' +

      '<section class="aia-console">' +
        '<header class="aia-console-head">' +
          '<div class="aia-console-title">' + icon('activity') + '<b>' + esc(L('سجل الفحص المباشر', 'Live diagnostic log')) + '</b>' +
            '<span class="aia-console-id">PATROL-01</span></div>' +
          '<div class="aia-counters">' +
            '<span class="aia-count pass" data-count-pass>0</span>' +
            '<span class="aia-count fail" data-count-fail>0</span>' +
            '<span class="aia-count warn" data-count-warn>0</span>' +
          '</div>' +
        '</header>' +
        '<div class="aia-progress"><i data-progress></i></div>' +
        '<div class="aia-log" data-log role="log" aria-live="polite">' +
          '<div class="aia-line info"><span class="aia-time">' + stamp() + '</span><span class="aia-text">' +
            esc(L('الرقيب الآلي جاهز — اضغط «بدء الفحص الشامل».', 'Patrol officer standing by — press “Start full diagnostic”.')) +
          '</span></div>' +
        '</div>' +
        '<footer class="aia-console-foot">' + icon('lock') +
          '<span>' + esc(L('قراءة فقط · لا يتم تعديل أي بيانات أثناء الفحص', 'Read-only · no data is modified during a scan')) + '</span>' +
        '</footer>' +
      '</section>' +
    '</div>';
  }

  /* ─────────────────────────── RENDER ──────────────────────────── */
  var root = null;
  page.setContent(markup());
  root = page.body;
  var logEl = root.querySelector('[data-log]');
  var runBtn = root.querySelector('[data-run]');
  var runLabel = root.querySelector('[data-run-label]');
  var progressEl = root.querySelector('[data-progress]');

  function addLine(kind, text) {
    var line = document.createElement('div');
    line.className = 'aia-line ' + kind;
    line.innerHTML = '<span class="aia-time">' + stamp() + '</span>' +
      '<span class="aia-mark">' + (kind === 'pass' ? '✅' : kind === 'fail' ? '❌' : kind === 'warn' ? '⚠️' : '›') + '</span>' +
      '<span class="aia-text">' + esc(text) + '</span>';
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function sectionLine(text) {
    var line = document.createElement('div');
    line.className = 'aia-section';
    line.innerHTML = '<span>' + esc(text) + '</span>';
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }
  function bump(kind) {
    if (kind === 'pass') state.pass++;
    if (kind === 'fail') state.fail++;
    if (kind === 'warn') state.warn++;
    root.querySelector('[data-count-pass]').textContent = state.pass;
    root.querySelector('[data-count-fail]').textContent = state.fail;
    root.querySelector('[data-count-warn]').textContent = state.warn;
  }
  function report(kind, text) {
    bump(kind);
    addLine(kind, text);
  }
  function setProgress(pct) {
    progressEl.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }
  function tile(key, status, text) {
    var box = root.querySelector('[data-tile="' + key + '"]');
    if (!box) return;
    box.setAttribute('data-status', status);
    var s = box.querySelector('[data-tile-state]');
    if (s) s.textContent = text;
  }

  /* ── Live tiles (always on) ───────────────────────────────────── */
  function refreshTiles() {
    var db = dbInfo();
    var dbOk = Array.isArray(db.users) && db.users.length > 0;
    tile('db', dbOk ? 'ok' : 'error', dbOk
      ? L('متصلة · ' + db.users.length + ' حساب · ' + (db.products || []).length + ' منتج', 'Online · ' + db.users.length + ' accounts · ' + (db.products || []).length + ' products')
      : L('غير متاحة', 'Unavailable'));

    probeHeroImages().then(function (rows) {
      var ok = rows.filter(function (r) { return r.ok; }).length;
      tile('images', ok === rows.length ? 'ok' : ok ? 'warn' : 'error',
        L(ok + ' / ' + rows.length + ' صورة محمّلة', ok + ' / ' + rows.length + ' images loaded'));
    });

    var authOk = !!(user && user.id && user.role) && typeof DS.requireAuth === 'function';
    tile('auth', authOk ? 'ok' : 'error', authOk
      ? L('جاهزة · ' + user.role, 'Ready · ' + user.role)
      : L('غير جاهزة', 'Not ready'));
  }

  /* ── Full diagnostic ──────────────────────────────────────────── */
  async function runDiagnostic() {
    if (state.running) return;
    state.running = true;
    state.done = false;
    state.pass = state.fail = state.warn = 0;
    root.querySelector('[data-count-pass]').textContent = '0';
    root.querySelector('[data-count-fail]').textContent = '0';
    root.querySelector('[data-count-warn]').textContent = '0';
    runBtn.disabled = true;
    runBtn.classList.add('is-running');
    runLabel.textContent = L('جارٍ الفحص…', 'Scanning…');
    setProgress(4);
    logEl.innerHTML = '';
    addLine('info', L('بدء الفحص الشامل — ' + stamp(), 'Full diagnostic started — ' + stamp()));
    refreshTiles();

    /* 1 · Hero images */
    sectionLine(L('1) صور الواجهة الخمس (img.complete)', '1) The five hero frames (img.complete)'));
    var images = await probeHeroImages();
    setProgress(28);
    for (var i = 0; i < images.length; i++) {
      var row = images[i];
      var name = L(HERO_IMAGES[row.index].labelAr, HERO_IMAGES[row.index].label);
      await sleep(110);
      if (row.ok) report('pass', L('Image Hero ' + (row.index + 1) + ': ' + name + ' — محمّلة (' + row.width + 'px)', 'Image Hero ' + (row.index + 1) + ': ' + name + ' — loaded (' + row.width + 'px)'));
      else report('fail', L('Image Hero ' + (row.index + 1) + ': ' + name + ' — مفقودة', 'Image Hero ' + (row.index + 1) + ': ' + name + ' — missing'));
    }

    /* 2 · Default accounts */
    sectionLine(L('2) الحسابات الافتراضية (' + ACCOUNTS.length + ')', '2) Default accounts (' + ACCOUNTS.length + ')'));
    var db = dbInfo();
    var users = db.users || [];
    setProgress(52);
    for (var a = 0; a < ACCOUNTS.length; a++) {
      var acc = ACCOUNTS[a];
      var found = users.filter(function (u) {
        return String(u.username || '').toLowerCase() === acc.username;
      })[0];
      await sleep(70);
      if (found && found.is_active !== false) {
        report('pass', L('Account ' + acc.username + ': OK (' + acc.role + ')', 'Account ' + acc.username + ': OK (' + acc.role + ')'));
      } else if (found) {
        report('warn', L('Account ' + acc.username + ': معطّل', 'Account ' + acc.username + ': suspended'));
      } else {
        report('fail', L('Account ' + acc.username + ': مفقود', 'Account ' + acc.username + ': missing'));
      }
    }

    /* 3 · Critical buttons */
    sectionLine(L('3) الأزرار الحرجة (Add to Cart · Checkout)', '3) Critical buttons (Add to Cart · Checkout)'));
    setProgress(72);
    var probe = await probeStorefrontButtons();
    if (probe.mode !== 'live') probe = await probeStorefrontSource();
    await sleep(160);

    if (probe.mode === 'live') {
      var heroOk = probe.heroSlides >= 5 && probe.heroLoaded >= 5;
      heroOk
        ? report('pass', L('شرائح الواجهة: ' + probe.heroLoaded + '/' + probe.heroSlides + ' محمّلة داخل الصفحة', 'Hero slides: ' + probe.heroLoaded + '/' + probe.heroSlides + ' loaded in-page'))
        : report('warn', L('شرائح الواجهة: ' + probe.heroLoaded + '/' + probe.heroSlides + ' محمّلة', 'Hero slides: ' + probe.heroLoaded + '/' + probe.heroSlides + ' loaded'));
      if (probe.addClickable > 0) {
        report('pass', L('زر أضف للسلة: ' + probe.addClickable + ' زر قابل للضغط', 'Add to Cart: ' + probe.addClickable + ' clickable button(s)'));
      } else {
        report('fail', L('زر أضف للسلة: غير قابل للضغط', 'Add to Cart: not clickable'));
      }
      if (probe.checkout) {
        report('pass', L('زر إتمام الطلب: متاح' + (probe.checkoutBlocked ? ' (السلة فارغة)' : ''), 'Checkout: available' + (probe.checkoutBlocked ? ' (bag empty)' : '')));
      } else {
        report('warn', L('زر إتمام الطلب: لم يظهر في السلة', 'Checkout: did not appear in the bag'));
      }
      if (probe.shop) report('pass', L('زر تسوق الآن: يعمل', 'Shop Now CTA: wired'));
      else report('warn', L('زر تسوق الآن: غير موجود', 'Shop Now CTA: missing'));
    } else if (probe.mode === 'source') {
      probe.addWired
        ? report('pass', L('زر أضف للسلة: مربوط بصفحة المتجر', 'Add to Cart: wired to the storefront'))
        : report('fail', L('زر أضف للسلة: غير مربوط', 'Add to Cart: not wired'));
      probe.checkoutWired
        ? report('pass', L('زر إتمام الطلب: مربوط بنافذة السلة', 'Checkout: wired to the bag modal'))
        : report('fail', L('زر إتمام الطلب: غير مربوط', 'Checkout: not wired'));
      probe.shopWired
        ? report('pass', L('زر تسوق الآن: مربوط', 'Shop Now CTA: wired'))
        : report('warn', L('زر تسوق الآن: غير موجود', 'Shop Now CTA: missing'));
      addLine('info', L('تم التحقق من ربط الأزرار عبر مصدر صفحة المتجر (حماية الأدوار تمنع المعاينة المباشرة).',
        'Button wiring verified from the storefront source (role guard blocks a live preview).'));
    } else {
      report('warn', L('تعذّر فحص الأزرار: ' + probe.mode, 'Button probe failed: ' + probe.mode));
    }

    /* Summary */
    setProgress(100);
    state.running = false;
    state.done = true;
    runBtn.disabled = false;
    runBtn.classList.remove('is-running');
    runLabel.textContent = L('بدء الفحص الشامل', 'Start full diagnostic');
    sectionLine(L('النتيجة النهائية', 'Final result'));
    if (state.fail === 0) {
      addLine('pass', L('كل الأنظمة تعمل بشكل سليم — ' + state.pass + ' فحص ناجح، ' + state.warn + ' تنبيه، 0 أخطاء.',
        'All systems healthy — ' + state.pass + ' passed, ' + state.warn + ' warning(s), 0 errors.'));
      if (DS.toast) DS.toast(L('اكتمل الفحص بنجاح', 'Diagnostic complete'), 'success');
    } else {
      addLine('fail', L('الفحص انتهى بـ ' + state.fail + ' خطأ — راجع السجل أعلاه.',
        'Diagnostic finished with ' + state.fail + ' error(s) — review the log above.'));
      if (DS.toast) DS.toast(L('الفحص وجد أخطاء', 'Diagnostic found issues'), 'error');
    }
    setTimeout(function () { setProgress(0); }, 1200);
  }

  /* ── Wiring ───────────────────────────────────────────────────── */
  runBtn.addEventListener('click', runDiagnostic);
  root.querySelector('[data-clear]').addEventListener('click', function () {
    if (state.running) return;
    logEl.innerHTML = '';
    state.pass = state.fail = state.warn = 0;
    root.querySelector('[data-count-pass]').textContent = '0';
    root.querySelector('[data-count-fail]').textContent = '0';
    root.querySelector('[data-count-warn]').textContent = '0';
    addLine('info', L('تم مسح السجل — الرقيب الآلي جاهز.', 'Log cleared — patrol officer standing by.'));
  });

  if (state.clock) clearInterval(state.clock);
  state.clock = setInterval(function () {
    var el = root.querySelector('[data-clock]');
    if (!el || !document.body.contains(el)) { clearInterval(state.clock); state.clock = null; return; }
    el.textContent = stamp();
  }, 1000);

  refreshTiles();
  setTimeout(refreshTiles, 2500);

  /* Expose for console/debugging (read-only). */
  DS.aiAgency = { run: runDiagnostic, images: HERO_IMAGES, accounts: ACCOUNTS };
})();
