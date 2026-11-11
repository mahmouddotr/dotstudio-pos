/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — LOGIN / SIGN-UP / GOOGLE
   Split Apple-style surface. Every user value is escaped before it
   reaches the DOM; passwords only ever travel into DS.auth.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  var esc = DS.esc, icon = DS.icon;

  var host = document.getElementById('authApp');
  if (!host) return;

  var state = {
    mode: 'login',
    busy: false,
    message: null
  };

  function L(ar, en) { return DS.lang() === 'en' ? en : ar; }

  /* ─────────────────────────── COPY ─────────────────────────── */
  var COPY = {
    kicker: [ 'منصة التجارة المتكاملة', 'The complete commerce platform' ],
    title: [ 'أدر متجرك<br><em>بذكاء.</em>', 'Run your store<br><em>smarter.</em>' ],
    sub: [
      'نقطة بيع، متجر إلكتروني، توصيل لحظي ومحادثات — كل ما تحتاجه في نظام واحد سريع وآمن.',
      'POS, storefront, live delivery and chats — one fast, secure system for everything you sell.'
    ],
    loginTitle: [ 'مرحباً بعودتك', 'Welcome back' ],
    loginSub: [ 'سجّل الدخول لمتابعة عملك من حيث توقفت.', 'Sign in to pick up exactly where you left off.' ],
    registerTitle: [ 'أنشئ حسابك', 'Create your account' ],
    registerSub: [ 'دقيقة واحدة وتبدأ التسوق أو إدارة متجرك.', 'One minute and you are ready to shop or sell.' ],
    tabLogin: [ 'تسجيل الدخول', 'Sign in' ],
    tabRegister: [ 'حساب جديد', 'Create account' ],
    user: [ 'البريد الإلكتروني أو اسم المستخدم', 'Email or username' ],
    userName: [ 'الاسم بالكامل', 'Full name' ],
    email: [ 'البريد الإلكتروني', 'Email address' ],
    phone: [ 'رقم الهاتف', 'Phone number' ],
    pass: [ 'كلمة المرور', 'Password' ],
    passConfirm: [ 'تأكيد كلمة المرور', 'Confirm password' ],
    remember: [ 'تذكرني', 'Remember me' ],
    forgot: [ 'نسيت كلمة المرور؟', 'Forgot password?' ],
    signIn: [ 'دخول', 'Sign in' ],
    create: [ 'إنشاء الحساب', 'Create account' ],
    or: [ 'أو', 'or' ],
    google: [ 'المتابعة باستخدام Google', 'Continue with Google' ],
    googleSignup: [ 'التسجيل باستخدام Google', 'Sign up with Google' ],
    haveAccount: [ 'لديك حساب بالفعل؟', 'Already have an account?' ],
    noAccount: [ 'ليس لديك حساب؟', 'New to DotStudio®?' ],
    demo: [ 'حسابات تجريبية', 'Demo accounts' ],
    fill: [ 'تعبئة', 'Fill' ],
    terms: [ 'أوافق على الشروط وسياسة الخصوصية', 'I agree to the terms and privacy policy' ],
    plans: [ 'الباقات والاشتراكات', 'Plans & pricing' ],
    support: [ 'الدعم الفني', 'Support' ],
    secure: [ 'اتصال آمن · بيانات محلية مشفّرة', 'Secure · encrypted local data' ],
    continueAs: [ 'متابعة باسم', 'Continue as' ],
    switch: [ 'استخدام حساب آخر', 'Use another account' ],
    loggedIn: [ 'أنت مسجّل الدخول بالفعل', 'You are already signed in' ],
    /* validation */
    vName: [ 'اكتب اسمك الكامل (حرفان على الأقل)', 'Enter your full name (2+ characters)' ],
    vEmail: [ 'بريد إلكتروني غير صالح', 'Enter a valid email address' ],
    vEmailExists: [ 'هذا البريد مسجّل بالفعل — سجّل الدخول بدلاً من ذلك', 'This email is already registered — sign in instead' ],
    vPhone: [ 'رقم هاتف غير صالح (مثال: 01012345678)', 'Enter a valid phone number (e.g. 01012345678)' ],
    vPhoneExists: [ 'رقم الهاتف مسجّل بالفعل', 'This phone number is already registered' ],
    vPass: [ 'كلمة المرور 8 أحرف على الأقل', 'Password must be at least 8 characters' ],
    vConfirm: [ 'كلمتا المرور غير متطابقتين', 'Passwords do not match' ],
    vTerms: [ 'يجب الموافقة على الشروط للمتابعة', 'Please accept the terms to continue' ],
    errInvalid: [ 'بيانات الدخول غير صحيحة', 'Incorrect email or password' ],
    errEmpty: [ 'يرجى إدخال بيانات الدخول', 'Please enter your credentials' ],
    errSuspended: [ 'هذا الحساب موقوف — راجع الإدارة', 'This account is suspended — contact support' ],
    errStoreSuspended: [ 'المتجر موقوف حالياً — راجع الإدارة', 'The store is suspended right now' ],
    errDisabled: [ 'التسجيل متوقف مؤقتاً — جرّب لاحقاً', 'Sign-ups are temporarily closed' ],
    errGeneric: [ 'حدث خطأ غير متوقع، حاول مرة أخرى', 'Something went wrong, please try again' ],
    welcome: [ 'تم إنشاء حسابك بنجاح 🎉', 'Your account is ready 🎉' ],
    signingIn: [ 'جارٍ التحقق…', 'Signing in…' ],
    newHere: [ 'جديد على DotStudio®؟', 'New to DotStudio®?' ],
    openRegister: [ 'تسجيل حساب', 'Create account' ],
    registerCta: [ 'أنشئ حسابك في دقيقة', 'Create your account in a minute' ],
    plansLink: [ 'الباقات والاشتراكات', 'Plans & pricing' ],
    forgotTitle: [ 'استعادة كلمة المرور', 'Password recovery' ],
    forgotBody: [
      'كلمة المرور مشفّرة محلياً على هذا الجهاز، ولا يمكن استرجاعها مباشرة. تواصل مع الدعم وسنساعدك في استعادة الحساب، أو استخدم حساباً تجريبياً من القائمة.',
      'Passwords are hashed locally on this device and cannot be recovered directly. Contact support and we will help you restore the account, or use one of the demo accounts below.'
    ]
  };

  function text(key) { var v = COPY[key]; return Array.isArray(v) ? L(v[0], v[1]) : v; }

  var ROLE_LABEL = {
    superadmin: [ 'مدير النظام', 'Super admin' ],
    subadmin: [ 'مشرف', 'Sub-admin' ],
    owner: [ 'صاحب متجر', 'Store owner' ],
    cashier: [ 'كاشير', 'Cashier' ],
    delivery: [ 'مندوب توصيل', 'Delivery driver' ],
    customer: [ 'عميل', 'Customer' ]
  };

  var DEMO = [
    { user: 'admin', pass: 'admin2026', role: ['مدير النظام', 'Super admin'] },
    { user: 'caznova', pass: 'caznova2026', role: ['صاحب متجر', 'Store owner'] },
    { user: 'ca_cashier', pass: 'ca_cashier2026', role: ['كاشير', 'Cashier'] },
    { user: 'talqa', pass: 'talqa2026', role: ['مندوب', 'Driver'] },
    { user: 'caznova_driver', pass: 'caznova_driver2026', role: ['مندوب كازنوفا', 'Caznova driver'] },
    { user: 'customer', pass: 'customer2026', role: ['عميل', 'Customer'] },
    { user: 'dina', pass: 'dina2026', role: ['مشرف', 'Sub-admin'] }
  ];

  /* ─────────────────────────── TEMPLATE ─────────────────────────── */
  function brandMarkup() {
    return '' +
      '<section class="auth-brand" aria-hidden="true">' +
        '<div class="auth-brand-bg"></div>' +
        '<a class="auth-logo" href="' + DS.url('index.html') + '" aria-label="DotStudio">' +
          '<img src="' + DS.url('assets/img/LOGO-WHAIT.png') + '" alt="DotStudio®">' +
          '<span><b>DotStudio®</b><small>POS · 2026</small></span>' +
        '</a>' +
        '<div class="auth-hero">' +
          '<span class="auth-kicker">' + icon('sparkles') + text('kicker') + '</span>' +
          '<h1 class="auth-title">' + text('title') + '</h1>' +
          '<p class="auth-sub">' + text('sub') + '</p>' +
          '<ul class="auth-features">' +
            '<li>' + icon('zap') + L('نقطة بيع فائقة السرعة', 'Lightning-fast POS') + '</li>' +
            '<li>' + icon('mapPin') + L('تتبع توصيل لحظي', 'Live delivery tracking') + '</li>' +
            '<li>' + icon('shield') + L('أمان وعزل بيانات', 'Secure, isolated data') + '</li>' +
          '</ul>' +
        '</div>' +
        '<div>' +
          '<div class="auth-stats">' +
            '<div class="auth-stat"><b>4</b><span>' + L('متاجر نشطة', 'Active stores') + '</span></div>' +
            '<div class="auth-stat"><b>12K+</b><span>' + L('عميل سعيد', 'Happy customers') + '</span></div>' +
            '<div class="auth-stat"><b>99.9%</b><span>' + L('وقت التشغيل', 'Uptime') + '</span></div>' +
          '</div>' +
          '<div class="auth-brand-foot"><span>© 2026 DotStudio®</span><span>' + L('صُنع في مصر', 'Made in Egypt') + '</span></div>' +
        '</div>' +
      '</section>';
  }

  function langMarkup() {
    return '<span class="auth-lang">' +
      '<button type="button" data-lang="ar" class="' + (DS.lang() === 'ar' ? 'active' : '') + '">العربية</button>' +
      '<button type="button" data-lang="en" class="' + (DS.lang() === 'en' ? 'active' : '') + '">English</button>' +
    '</span>';
  }

  function markup() {
    var user = DS.session();
    if (user) return signedInMarkup(user);

    return brandMarkup() +
      '<section class="auth-panel">' +
        '<div class="auth-card">' +
          '<div class="auth-card-head">' +
            '<h2 id="authHeading">' + text('loginTitle') + '</h2>' +
            '<p id="authSub">' + text('loginSub') + '</p>' +
          '</div>' +
          loginForm() +
          '<div class="auth-divider">' + text('or') + '</div>' +
          DS.googleButton(text('google')) +
          '<button type="button" class="auth-open-register" data-open-register>' +
            '<span class="aor-icon">' + icon('userPlus') + '</span>' +
            '<span class="aor-copy"><b>' + text('openRegister') + '</b><small>' + text('registerCta') + '</small></span>' +
            icon('arrowLeft') +
          '</button>' +
          '<div class="auth-msg' + (state.message ? ' show ' + state.message.type : '') + '" id="authMsg" role="status" aria-live="polite">' + (state.message ? esc(state.message.text) : '') + '</div>' +
          '<div class="auth-demo">' +
            '<div class="auth-demo-head"><span>' + text('demo') + '</span><span>' + esc(text('fill')) + '</span></div>' +
            '<div class="auth-demo-grid">' +
              DEMO.map(function (d, i) {
                return '<button type="button" class="auth-demo-chip" data-demo="' + i + '">' +
                  '<b>' + esc(d.user) + '</b><span>' + esc(L(d.role[0], d.role[1])) + '</span></button>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="auth-foot">' +
            '<a class="auth-plans-link" href="' + DS.url('marketing/index.html') + '#pricing">' + icon('card') + text('plansLink') + '</a>' +
            '<span class="auth-secure">' + icon('lock') + text('secure') + '</span>' +
            langMarkup() +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function signedInMarkup(user) {
    var role = ROLE_LABEL[user.role] || ROLE_LABEL.customer;
    var name = DS.loc ? DS.loc(user, 'name') : (user.name || user.username || '');
    var home = DS.roleHome ? DS.roleHome(user) : 'customer/storefront.html';
    return brandMarkup() +
      '<section class="auth-panel">' +
        '<div class="auth-card auth-card-signed">' +
          '<div class="auth-signed">' +
            '<img class="auth-signed-avatar" src="' + esc(DS.avatarUrl(user)) + '" alt="">' +
            '<span class="auth-signed-badge">' + icon('checkCircle') + text('loggedIn') + '</span>' +
            '<h2>' + esc(name) + '</h2>' +
            '<p>' + esc(L(role[0], role[1])) + (user.email ? ' · ' + esc(user.email) : '') + '</p>' +
            '<button type="button" class="auth-submit" data-signed-continue>' + icon('arrowRight') +
              '<span>' + text('continueAs') + '</span></button>' +
            '<button type="button" class="auth-link auth-signed-switch" data-signed-switch>' + icon('logout') +
              '<span>' + text('switch') + '</span></button>' +
          '</div>' +
          '<div class="auth-foot">' +
            '<a class="auth-plans-link" href="' + DS.url('marketing/index.html') + '#pricing">' + icon('card') + text('plansLink') + '</a>' +
            langMarkup() +
          '</div>' +
        '</div>' +
        '<span class="auth-signed-home" data-home="' + esc(home) + '" hidden></span>' +
      '</section>';
  }

  function field(opts) {
    return '<div class="auth-field">' +
      '<label for="' + opts.id + '">' + esc(opts.label) + '</label>' +
      '<div class="auth-input" data-wrap="' + opts.id + '">' +
        icon(opts.icon || 'user') +
        '<input id="' + opts.id + '" name="' + opts.id + '" type="' + (opts.type || 'text') + '" ' +
          'placeholder="' + esc(opts.placeholder || '') + '" ' +
          'autocomplete="' + (opts.autocomplete || 'off') + '" ' +
          (opts.dir ? 'dir="' + opts.dir + '"' : '') +
          (opts.inputmode ? 'inputmode="' + opts.inputmode + '"' : '') +
          ' maxlength="' + (opts.maxlength || 120) + '"' +
          (opts.required ? ' required' : '') + '>' +
        (opts.type === 'password'
          ? '<button type="button" class="auth-eye" data-eye="' + opts.id + '" aria-label="' + esc(L('إظهار كلمة المرور', 'Show password')) + '">' + icon('eye') + '</button>'
          : '') +
      '</div>' +
      '<div class="auth-hint" data-hint="' + opts.id + '"></div>' +
    '</div>';
  }

  function loginForm() {
    return '<form class="auth-form" id="loginForm" novalidate>' +
      field({ id: 'loginUser', label: text('user'), icon: 'mail', placeholder: 'you@dotstudio.app', autocomplete: 'username', maxlength: 120, required: true }) +
      field({ id: 'loginPass', label: text('pass'), icon: 'lock', placeholder: '••••••••', type: 'password', autocomplete: 'current-password', maxlength: 120, required: true }) +
      '<div class="auth-options">' +
        '<label class="auth-check"><input type="checkbox" id="loginRemember" checked><span>' + text('remember') + '</span></label>' +
        '<button type="button" class="auth-link" data-forgot>' + text('forgot') + '</button>' +
      '</div>' +
      '<button type="submit" class="auth-submit" id="loginSubmit">' + icon('arrowRight') + '<span>' + text('signIn') + '</span></button>' +
    '</form>';
  }

  function registerForm() {
    return '<form class="auth-form auth-register-form" id="registerForm" novalidate>' +
      '<div class="auth-row">' +
        field({ id: 'regName', label: text('userName'), icon: 'user', placeholder: L('محمود علي', 'Mahmoud Ali'), autocomplete: 'name', maxlength: 60, required: true }) +
        field({ id: 'regPhone', label: text('phone'), icon: 'phone', placeholder: '01012345678', autocomplete: 'tel', dir: 'ltr', inputmode: 'tel', maxlength: 20, required: true }) +
      '</div>' +
      field({ id: 'regEmail', label: text('email'), icon: 'mail', placeholder: 'you@example.com', type: 'email', autocomplete: 'email', dir: 'ltr', maxlength: 120, required: true }) +
      '<div class="auth-row">' +
        field({ id: 'regPass', label: text('pass'), icon: 'lock', placeholder: '••••••••', type: 'password', autocomplete: 'new-password', maxlength: 120, required: true }) +
        field({ id: 'regPass2', label: text('passConfirm'), icon: 'lock', placeholder: '••••••••', type: 'password', autocomplete: 'new-password', maxlength: 120, required: true }) +
      '</div>' +
      '<label class="auth-check"><input type="checkbox" id="regTerms"><span>' + text('terms') + '</span></label>' +
      '<div class="auth-msg" id="regMsg" role="status" aria-live="polite"></div>' +
      '<button type="submit" class="auth-submit" id="registerSubmit">' + icon('sparkles') + '<span>' + text('create') + '</span></button>' +
      '<div class="auth-divider">' + text('or') + '</div>' +
      DS.googleButton(text('googleSignup')) +
    '</form>';
  }

  /* ─────────────────────────── HELPERS ─────────────────────────── */
  function $(sel, ctx) { return (ctx || host).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || host).querySelectorAll(sel)); }

  function setMessage(type, message) {
    state.message = message ? { type: type, text: message } : null;
    var box = $('#authMsg');
    if (!box) return;
    box.className = 'auth-msg' + (message ? ' show ' + type : '');
    box.textContent = message || '';
  }

  function hintFor(id, message) {
    var hint = $('[data-hint="' + id + '"]');
    var wrap = $('[data-wrap="' + id + '"]');
    if (hint) { hint.textContent = message || ''; hint.className = 'auth-hint' + (message ? ' error' : ''); }
    if (wrap) wrap.classList.toggle('invalid', !!message);
  }

  function setBusy(btn, busy, label) {
    if (!btn) return;
    btn.disabled = !!busy;
    var span = btn.querySelector('span');
    if (!span) return;
    if (busy) {
      if (!btn.getAttribute('data-label')) btn.setAttribute('data-label', span.textContent || '');
      span.textContent = label || L('جارٍ…', 'Working…');
    } else {
      var original = btn.getAttribute('data-label');
      if (original) span.textContent = original;
    }
  }

  function messageFor(code) {
    switch (code) {
      case 'invalid': return text('errInvalid');
      case 'empty': return text('errEmpty');
      case 'suspended': return text('errSuspended');
      case 'store_suspended': return text('errStoreSuspended');
      case 'disabled': return text('errDisabled');
      default: return text('errGeneric');
    }
  }

  function redirectFor(res) {
    var target = (res && res.redirect) || (res && res.user && DS.roleHome(res.user)) || 'customer/storefront.html';
    window.location.href = DS.url(target);
  }

  /* ─────────────────────────── LOGIN ─────────────────────────── */
  function onSubmitLogin(e) {
    if (e) e.preventDefault();
    if (state.busy) return;
    var userEl = $('#loginUser'), passEl = $('#loginPass');
    var entered = (userEl && userEl.value || '').trim();
    var password = (passEl && passEl.value) || '';

    hintFor('loginUser', '');
    hintFor('loginPass', '');
    setMessage(null);

    if (!entered || !password) {
      setMessage('error', text('errEmpty'));
      if (!entered) hintFor('loginUser', text('errEmpty'));
      if (!password) hintFor('loginPass', text('errEmpty'));
      (entered ? passEl : userEl).focus();
      return;
    }

    var btn = $('#loginSubmit');
    state.busy = true;
    setBusy(btn, true, text('signingIn'));

    setTimeout(function () {
      var res;
      try { res = DS.auth.login(entered, password); }
      catch (err) { console.error(err); res = { ok: false, error: 'error' }; }

      state.busy = false;
      setBusy(btn, false);

      if (!res.ok) {
        var message = messageFor(res.error);
        setMessage('error', message);
        if (res.error === 'invalid' || res.error === 'empty') hintFor('loginPass', message);
        if (passEl && res.error === 'invalid') { passEl.value = ''; passEl.focus(); }
        return;
      }

      setMessage('success', L('مرحباً ' + (res.user.name || ''), 'Welcome ' + (res.user.name || '')));
      redirectFor(res);
    }, 90);
  }

  /* ─────────────────────── FORGOT PASSWORD ─────────────────────── */
  function openForgot() {
    DS.modal({
      title: icon('lock') + ' ' + text('forgotTitle'),
      size: 'sm',
      body: '<p style="font-size:13px;line-height:1.8;color:var(--text-secondary)">' + esc(text('forgotBody')) + '</p>',
      actions: [
        { label: DS.t('cancel'), variant: 'btn-secondary' },
        { label: text('support'), variant: 'btn-primary', icon: icon('message'), onClick: function () {
            if (DS.openSupportChat) DS.openSupportChat();
            else if (DS.chat && DS.chat.open) DS.chat.open('support');
            else DS.toast(text('support'), 'info');
          } }
      ]
    });
  }

  /* ─────────────────────── REGISTER MODAL ─────────────────────── */
  function regHint(root, id, message) {
    var hint = root.querySelector('[data-hint="' + id + '"]');
    var wrap = root.querySelector('[data-wrap="' + id + '"]');
    if (hint) { hint.textContent = message || ''; hint.className = 'auth-hint' + (message ? ' error' : ''); }
    if (wrap) wrap.classList.toggle('invalid', !!message);
  }

  function regMessage(root, type, message) {
    var box = root.querySelector('#regMsg');
    if (!box) return;
    box.className = 'auth-msg' + (message ? ' show ' + type : '');
    box.textContent = message || '';
  }

  /* Clean registration modal: Full name, phone, email, password + Google.
     Subscriptions never open from here — they live on their own link. */
  function openRegisterModal() {
    var m = DS.modal({
      title: icon('userPlus') + ' ' + text('registerTitle'),
      sub: esc(text('registerSub')),
      size: 'md',
      body: registerForm(),
      actions: [
        { label: DS.t('cancel'), variant: 'btn-secondary' },
        { label: text('create'), variant: 'btn-primary', icon: icon('sparkles'), close: false, onClick: function (root) {
            submitRegistration(root, m.close);
            return false;
          } }
      ],
      onMount: function (root) {
        var form = root.querySelector('#registerForm');
        if (form) form.addEventListener('submit', function (e) {
          e.preventDefault();
          submitRegistration(root, m.close);
        });
        root.querySelectorAll('[data-eye]').forEach(function (b) {
          b.addEventListener('click', function () {
            var input = root.querySelector('#' + b.getAttribute('data-eye'));
            if (!input) return;
            var show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            b.innerHTML = icon(show ? 'eyeOff' : 'eye');
          });
        });
        ['regName', 'regEmail', 'regPhone', 'regPass', 'regPass2'].forEach(function (id) {
          var el = root.querySelector('#' + id);
          if (el) el.addEventListener('input', function () { regHint(root, id, ''); });
        });
        var first = root.querySelector('#regName');
        if (first) setTimeout(function () { first.focus(); }, 120);
      }
    });
    return m;
  }

  function submitRegistration(root, close) {
    if (state.busy) return false;
    var payload = {
      name: (root.querySelector('#regName') && root.querySelector('#regName').value || '').trim(),
      email: (root.querySelector('#regEmail') && root.querySelector('#regEmail').value || '').trim(),
      phone: (root.querySelector('#regPhone') && root.querySelector('#regPhone').value || '').trim(),
      password: (root.querySelector('#regPass') && root.querySelector('#regPass').value || ''),
      confirm: (root.querySelector('#regPass2') && root.querySelector('#regPass2').value || '')
    };
    ['regName', 'regEmail', 'regPhone', 'regPass', 'regPass2'].forEach(function (id) { regHint(root, id, ''); });
    var pre = validateClientSide(payload);
    var bad = false;
    Object.keys(pre).forEach(function (k) { bad = true; regHint(root, k, pre[k]); });
    var terms = root.querySelector('#regTerms');
    if (terms && !terms.checked) { bad = true; }
    if (bad) {
      if (!Object.keys(pre).length) regMessage(root, 'error', text('vTerms'));
      else regMessage(root, 'error', L('راجع الحقول المظللة بالأحمر', 'Please review the highlighted fields'));
      return false;
    }

    var btn = root.querySelector('#registerSubmit');
    state.busy = true;
    setBusy(btn, true, L('جارٍ إنشاء الحساب…', 'Creating account…'));
    setTimeout(function () {
      var res;
      try { res = DS.auth.register(payload); }
      catch (err) { console.error(err); res = { ok: false, error: 'error' }; }

      state.busy = false;
      setBusy(btn, false);

      if (!res.ok) {
        if (res.error === 'validation' && res.errors) {
          var map = {
            name: ['regName', text('vName')],
            email: ['regEmail', res.errors.email === 'exists' ? text('vEmailExists') : text('vEmail')],
            phone: ['regPhone', res.errors.phone === 'exists' ? text('vPhoneExists') : text('vPhone')],
            password: ['regPass', text('vPass')],
            confirm: ['regPass2', text('vConfirm')]
          };
          Object.keys(res.errors).forEach(function (k) {
            if (map[k]) regHint(root, map[k][0], map[k][1]);
          });
          regMessage(root, 'error', L('راجع الحقول المظللة بالأحمر', 'Please review the highlighted fields'));
        } else {
          regMessage(root, 'error', messageFor(res.error));
        }
        return false;
      }
      if (DS.toast) DS.toast(L('مرحباً ' + res.user.name, 'Welcome ' + res.user.name), 'success');
      if (close) close();
      redirectFor(res);
      return true;
    }, 60);
    return false;
  }

  function validateClientSide(p) {
    var out = {};
    if (DS.sanitize(p.name, 60).length < 2) out.regName = text('vName');
    if (!DS.isEmail(p.email)) out.regEmail = text('vEmail');
    if (!DS.isPhone(p.phone)) out.regPhone = text('vPhone');
    if (String(p.password).length < 8) out.regPass = text('vPass');
    if (p.confirm !== p.password) out.regPass2 = text('vConfirm');
    return out;
  }

  /* ─────────────────────────── BIND ─────────────────────────── */
  function bind() {
    var loginEl = $('#loginForm');
    if (loginEl) loginEl.addEventListener('submit', onSubmitLogin);

    $$('[data-eye]').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = $('#' + b.getAttribute('data-eye'));
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        b.innerHTML = icon(show ? 'eyeOff' : 'eye');
      });
    });

    ['loginUser', 'loginPass'].forEach(function (id) {
      var el = $('#' + id);
      if (el) el.addEventListener('input', function () { hintFor(id, ''); if (state.message && state.message.type === 'error') setMessage(null); });
    });

    $$('[data-demo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var d = DEMO[Number(btn.getAttribute('data-demo'))];
        if (!d) return;
        var u = $('#loginUser'), p = $('#loginPass');
        if (u) u.value = d.user;
        if (p) p.value = d.pass;
        hintFor('loginUser', '');
        hintFor('loginPass', '');
        setMessage(null);
        var submit = $('#loginSubmit');
        if (submit) submit.focus();
      });
    });

    $$('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lang = btn.getAttribute('data-lang');
        if (lang && lang !== DS.lang() && DS.setLang) DS.setLang(lang);
      });
    });

    $$('[data-open-register]').forEach(function (btn) {
      btn.addEventListener('click', function () { openRegisterModal(); });
    });

    var forgot = $('[data-forgot]');
    if (forgot) forgot.addEventListener('click', openForgot);

    var cont = $('[data-signed-continue]');
    if (cont) cont.addEventListener('click', function () {
      var u = DS.session();
      if (u) window.location.href = DS.url(DS.roleHome(u));
    });

    var sw = $('[data-signed-switch]');
    if (sw) sw.addEventListener('click', function () {
      if (DS.logout) DS.logout(true);
      state.message = null;
      render();
    });
  }

  /* ─────────────────────────── RENDER ─────────────────────────── */
  function render() {
    host.innerHTML = markup();
    bind();
  }

  DS.page = { render: render };
  render();

  /* Keyboard: ⌘/Ctrl + Enter submits the login form. */
  document.addEventListener('keydown', function (e) {
    if (!(e.metaKey || e.ctrlKey) || e.key !== 'Enter') return;
    if (document.querySelector('.modal-backdrop')) return;
    var form = $('#loginForm');
    if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
  });

  document.addEventListener('ds:lang', function () { /* DS.setLang reloads the page */ });

  /* Marketing CTA → /index.html#register opens the clean sign-up modal. */
  if (location.hash === '#register' && !DS.session()) {
    setTimeout(function () { openRegisterModal(); }, 260);
  }
})();
