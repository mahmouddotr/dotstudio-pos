/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — LANDING AUTH BRIDGE
   Connects the restored Apple-style intro/login page to the real
   auth stack (DS.auth) WITHOUT changing the intro design:

   • doLogin() → DS.auth.login() (hashed passwords, suspensions,
     tenant suspension, session shape, role routing, audit log).
   • openSignup() → modal using the page's own .signup-* styles,
     validated by DS.auth.register() (salted SHA-256 hashing).
   • Google button → DS.auth.googleSignIn() (offline demo flow).
   • Keeps cz_lang (landing) and ds_lang / lang (app) in sync.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS || !DS.auth) { console.warn('[landing] auth stack unavailable'); return; }

  var LS_LANDING = 'cz_lang';
  var LS_APP = 'ds_lang';
  var LS_ALT = 'lang';

  /* ─────────────────────── language synchronisation ─────────────────────── */
  function isEn() {
    try {
      var v = localStorage.getItem(LS_LANDING);
      if (v === 'en') return true;
      if (v === 'ar') return false;
      v = localStorage.getItem(LS_APP) || localStorage.getItem(LS_ALT);
      return v === 'en';
    } catch (e) { return false; }
  }
  function L(ar, en) { return isEn() ? en : ar; }

  /* ─────────────────────── "remember me" ─────────────────────── */
  function rememberChoice() {
    var el = document.getElementById('rememberMe');
    return el ? !!el.checked : true;
  }
  function syncRememberUI() {
    var el = document.getElementById('rememberMe');
    if (!el) return;
    try {
      var v = localStorage.getItem('cz_remember');
      if (v === '1') el.checked = true;
      else if (v === '0') el.checked = false;
    } catch (e) {}
  }

  function syncLangKeys() {
    var lang;
    try {
      lang = localStorage.getItem(LS_LANDING);
      if (lang !== 'ar' && lang !== 'en') {
        lang = localStorage.getItem(LS_APP) || localStorage.getItem(LS_ALT) || 'ar';
        lang = lang === 'en' ? 'en' : 'ar';
      }
      localStorage.setItem(LS_LANDING, lang);
      localStorage.setItem(LS_APP, lang);
      localStorage.setItem(LS_ALT, lang);
    } catch (e) { lang = 'ar'; }
    if (document.documentElement) {
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    }
  }

  /* Wrap the page's own setLang so both storage keys always agree. */
  function wrapSetLang() {
    var original = window.setLang;
    if (typeof original !== 'function' || original.__dsBridgeWrapped) return;
    var wrapped = function (lang) {
      lang = lang === 'en' ? 'en' : 'ar';
      try {
        localStorage.setItem(LS_LANDING, lang);
        localStorage.setItem(LS_APP, lang);
        localStorage.setItem(LS_ALT, lang);
      } catch (e) {}
      try { original(lang); } catch (e) {}
      refreshBridgeCopy();
    };
    wrapped.__dsBridgeWrapped = true;
    window.setLang = wrapped;
    /* Keep the app's own helper aligned as well. */
    if (DS.setLang) DS.setLang(langNow());
  }
  function langNow() {
    try { return localStorage.getItem(LS_LANDING) === 'en' ? 'en' : 'ar'; } catch (e) { return 'ar'; }
  }

  /* ───────────────────────────── login ─────────────────────────────────── */
  var LOGIN_ERRORS = {
    empty:            { ar: 'أدخل اسم المستخدم وكلمة السر', en: 'Enter your username and password' },
    invalid:          { ar: 'بيانات الدخول غير صحيحة', en: 'Invalid credentials' },
    suspended:        { ar: 'الحساب موقوف — راجع الإدارة', en: 'Account suspended — contact admin' },
    store_suspended:  { ar: 'المتجر موقوف — راجع الإدارة', en: 'Store suspended — contact admin' }
  };

  function errText(code) {
    var m = LOGIN_ERRORS[code] || LOGIN_ERRORS.invalid;
    return L(m.ar, m.en);
  }

  function setError(msg, tone) {
    var el = document.getElementById('loginErr');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = tone === 'ok' ? '#d4ff3a' : '#ff453a';
  }

  function installLogin() {
    window.doLogin = function doLogin() {
      var uEl = document.getElementById('loginUser');
      var pEl = document.getElementById('loginPass');
      var btn = document.getElementById('loginBtn');
      if (!uEl || !pEl) return;

      var username = String(uEl.value || '').trim();
      var password = String(pEl.value || '');
      setError('');

      if (!username || !password) { setError(errText('empty')); if (!username) uEl.focus(); else pEl.focus(); return; }

      if (btn) btn.disabled = true;
      setError(L('⏳ جاري التحقق…', '⏳ Authenticating…'), 'ok');

      /* Async frame so the button state paints; auth itself is synchronous. */
      setTimeout(function () {
        var res;
        try { res = DS.auth.login(username, password, { remember: rememberChoice() }); }
        catch (e) { console.error('[landing] login crashed', e); res = { ok: false, error: 'invalid' }; }

        if (res && res.ok) {
          setError(L('✓ تم الدخول بنجاح', '✓ Signed in successfully'), 'ok');
          var target = res.redirect || (DS.roleHome ? DS.roleHome(res.user) : 'customer/storefront.html');
          setTimeout(function () { window.location.href = target; }, 220);
          return;
        }
        if (btn) btn.disabled = false;
        if (pEl) { pEl.value = ''; pEl.focus(); }
        setError(errText(res && res.error));
      }, 120);
    };
  }

  /* ─────────────────────────── google button ──────────────────────────── */
  function googleSvg() {
    return '<svg viewBox="0 0 48 48" width="19" height="19" aria-hidden="true">' +
      '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
      '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
      '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
      '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
      '</svg>';
  }

  function installGoogleButton() {
    if (document.getElementById('dsLandingAuthAlt')) return;
    var btn = document.getElementById('loginBtn');
    if (!btn || !btn.parentNode) return;
    var wrap = document.createElement('div');
    wrap.id = 'dsLandingAuthAlt';
    wrap.className = 'landing-auth-alt';
    wrap.innerHTML =
      '<div class="landing-auth-divider"><span id="dsLandingOr"></span></div>' +
      '<button type="button" class="landing-google-btn" id="dsLandingGoogle">' + googleSvg() +
        '<span id="dsLandingGoogleLabel"></span></button>';
    btn.parentNode.insertBefore(wrap, btn.nextSibling);
    wrap.querySelector('#dsLandingGoogle').addEventListener('click', function () {
      try { DS.auth.googleSignIn({ remember: rememberChoice() }); }
      catch (e) { DS.toast && DS.toast(L('تعذّر بدء الدخول عبر Google', 'Could not start Google sign-in'), 'error'); }
    });
  }

  /* ──────────────────────────── signup modal ───────────────────────────── */
  function signupMarkup() {
    return '' +
      '<div class="signup-overlay" id="dsSignupOverlay" aria-hidden="true">' +
        '<div class="signup-modal" role="dialog" aria-modal="true" aria-labelledby="dsSignupTitle">' +
          '<button type="button" class="signup-close" data-su-close aria-label="close">✕</button>' +
          '<div class="signup-title" id="dsSignupTitle"></div>' +
          '<div class="signup-sub" id="dsSignupSub"></div>' +
          '<form id="dsSignupForm" autocomplete="off" novalidate>' +
            '<div class="su-field">' +
              '<label class="su-label" for="dsSuName" id="dsSuNameLabel"></label>' +
              '<input class="su-input" id="dsSuName" name="name" maxlength="60" autocomplete="name">' +
            '</div>' +
            '<div class="su-row">' +
              '<div class="su-field">' +
                '<label class="su-label" for="dsSuEmail" id="dsSuEmailLabel"></label>' +
                '<input class="su-input" id="dsSuEmail" name="email" type="email" dir="ltr" maxlength="120" autocomplete="email">' +
              '</div>' +
              '<div class="su-field">' +
                '<label class="su-label" for="dsSuPhone" id="dsSuPhoneLabel"></label>' +
                '<input class="su-input" id="dsSuPhone" name="phone" type="tel" dir="ltr" maxlength="20" autocomplete="tel">' +
              '</div>' +
            '</div>' +
            '<div class="su-row">' +
              '<div class="su-field">' +
                '<label class="su-label" for="dsSuPass" id="dsSuPassLabel"></label>' +
                '<input class="su-input" id="dsSuPass" name="password" type="password" maxlength="72" autocomplete="new-password">' +
              '</div>' +
              '<div class="su-field">' +
                '<label class="su-label" for="dsSuConfirm" id="dsSuConfirmLabel"></label>' +
                '<input class="su-input" id="dsSuConfirm" name="confirm" type="password" maxlength="72" autocomplete="new-password">' +
              '</div>' +
            '</div>' +
            '<label class="check-wrap" style="display:flex;align-items:center;gap:8px;margin:4px 0 6px;font-size:12.5px;color:#a0a0a0">' +
              '<input type="checkbox" id="dsSuTerms" style="accent-color:#d4ff3a">' +
              '<span id="dsSuTermsLabel"></span>' +
            '</label>' +
            '<button type="submit" class="su-btn" id="dsSuSubmit"></button>' +
            '<div class="su-err" id="dsSuErr" role="alert"></div>' +
          '</form>' +
          '<div class="su-divider"><span id="dsSuOr"></span></div>' +
          '<button type="button" class="su-alt-btn google" id="dsSuGoogle">' + googleSvg() + '<span id="dsSuGoogleLabel"></span></button>' +
          '<div class="su-footer"><span id="dsSuHave"></span> <a id="dsSuLogin"></a></div>' +
        '</div>' +
      '</div>';
  }

  function ensureSignup() {
    var overlay = document.getElementById('dsSignupOverlay');
    if (overlay) return overlay;
    var host = document.createElement('div');
    host.innerHTML = signupMarkup();
    overlay = host.firstChild;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeSignup();
    });
    overlay.querySelector('[data-su-close]').addEventListener('click', closeSignup);
    overlay.querySelector('#dsSuLogin').addEventListener('click', function (e) {
      e.preventDefault(); closeSignup();
      var u = document.getElementById('loginUser'); if (u) u.focus();
    });
    overlay.querySelector('#dsSuGoogle').addEventListener('click', function () {
      closeSignup();
      setTimeout(function () { try { DS.auth.googleSignIn({ remember: rememberChoice() }); } catch (e) {} }, 180);
    });

    var form = overlay.querySelector('#dsSignupForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitSignup(overlay);
    });

    /* Clear the error as soon as the user edits anything. */
    form.addEventListener('input', function () {
      var err = document.getElementById('dsSuErr');
      if (err) err.textContent = '';
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('show')) closeSignup();
    });
    return overlay;
  }

  function signupErrText(errors) {
    if (!errors) return L('تعذّر إنشاء الحساب', 'Could not create the account');
    var map = {
      name:     { ar: 'الاسم قصير جداً (حرفان على الأقل)', en: 'Name is too short (2+ characters)' },
      email:    { ar: 'بريد إلكتروني غير صالح', en: 'Invalid email address' },
      phone:    { ar: 'رقم هاتف غير صالح', en: 'Invalid phone number' },
      password: { ar: 'كلمة السر 8 أحرف على الأقل', en: 'Password must be at least 8 characters' },
      confirm:  { ar: 'كلمتا السر غير متطابقتين', en: 'Passwords do not match' }
    };
    var order = ['name', 'email', 'phone', 'password', 'confirm'];
    for (var i = 0; i < order.length; i++) {
      var k = order[i];
      if (!errors[k]) continue;
      if (k === 'email' && errors.email === 'exists') return L('هذا البريد مسجّل بالفعل — سجّل الدخول', 'This email is already registered — sign in');
      if (k === 'phone' && errors.phone === 'exists') return L('رقم الهاتف مسجّل بالفعل', 'This phone number is already registered');
      return L(map[k].ar, map[k].en);
    }
    return L('تحقّق من البيانات المدخلة', 'Please check your details');
  }

  function submitSignup(overlay) {
    var btn = overlay.querySelector('#dsSuSubmit');
    var errEl = overlay.querySelector('#dsSuErr');
    var name = overlay.querySelector('#dsSuName').value;
    var email = overlay.querySelector('#dsSuEmail').value;
    var phone = overlay.querySelector('#dsSuPhone').value;
    var pass = overlay.querySelector('#dsSuPass').value;
    var confirm = overlay.querySelector('#dsSuConfirm').value;
    var terms = overlay.querySelector('#dsSuTerms');

    errEl.textContent = '';
    if (terms && !terms.checked) {
      errEl.textContent = L('يجب الموافقة على الشروط للمتابعة', 'You must accept the terms to continue');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = L('⏳ جاري الإنشاء…', '⏳ Creating…'); }

    setTimeout(function () {
      var res;
      try { res = DS.auth.register({ name: name, email: email, phone: phone, password: pass, confirm: confirm }, { remember: rememberChoice() }); }
      catch (e) { console.error('[landing] register crashed', e); res = { ok: false, error: 'validation', errors: {} }; }

      if (res && res.ok) {
        if (btn) btn.textContent = L('✓ تم إنشاء الحساب', '✓ Account created');
        if (errEl) { errEl.style.color = '#d4ff3a'; errEl.textContent = L('مرحباً بك! جاري تحويلك…', 'Welcome! Redirecting…'); }
        var target = res.redirect || 'customer/storefront.html';
        setTimeout(function () { window.location.href = target; }, 600);
        return;
      }

      if (btn) { btn.disabled = false; btn.textContent = L('إنشاء الحساب', 'Create account'); }
      if (res && res.error === 'disabled') {
        errEl.textContent = L('التسجيل متوقف حالياً — تواصل مع الإدارة', 'Sign-ups are currently disabled — contact support');
      } else {
        errEl.textContent = signupErrText(res && res.errors);
      }
    }, 100);
  }

  function openSignup() {
    ensureSignup();
    var overlay = document.getElementById('dsSignupOverlay');
    refreshBridgeCopy();
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('signup-open');
    setTimeout(function () { var f = document.getElementById('dsSuName'); if (f) f.focus(); }, 120);
    return false;
  }
  function closeSignup() {
    var overlay = document.getElementById('dsSignupOverlay');
    if (!overlay) return;
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('signup-open');
  }

  /* ──────────────────────────── bilingual copy ─────────────────────────── */
  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  function refreshBridgeCopy() {
    var ar = !isEn();
    setText('dsLandingOr', ar ? 'أو' : 'or');
    setText('dsLandingGoogleLabel', ar ? 'المتابعة باستخدام Google' : 'Continue with Google');

    setText('dsSignupTitle', ar ? 'إنشاء حساب جديد' : 'Create your account');
    setText('dsSignupSub', ar ? 'دقائق وتكون جاهزاً للشراء من كل المتاجر.' : 'A minute and you can shop every store.');
    setText('dsSuNameLabel', ar ? 'الاسم الكامل' : 'Full name');
    setText('dsSuEmailLabel', ar ? 'البريد الإلكتروني' : 'Email');
    setText('dsSuPhoneLabel', ar ? 'رقم الهاتف' : 'Phone number');
    setText('dsSuPassLabel', ar ? 'كلمة السر' : 'Password');
    setText('dsSuConfirmLabel', ar ? 'تأكيد كلمة السر' : 'Confirm password');
    setText('dsSuTermsLabel', ar ? 'أوافق على الشروط وسياسة الخصوصية' : 'I agree to the terms & privacy policy');
    setText('dsSuSubmit', ar ? 'إنشاء الحساب' : 'Create account');
    setText('dsSuOr', ar ? 'أو' : 'or');
    setText('dsSuGoogleLabel', ar ? 'التسجيل باستخدام Google' : 'Sign up with Google');
    setText('dsSuHave', ar ? 'لديك حساب بالفعل؟' : 'Already have an account?');
    setText('dsSuLogin', ar ? 'سجّل الدخول' : 'Sign in');

    var ph = [
      ['dsSuName', ar ? 'محمد أحمد' : 'Mohamed Ahmed'],
      ['dsSuEmail', 'name@example.com'],
      ['dsSuPhone', ar ? '01xxxxxxxxx' : '01xxxxxxxxx'],
      ['dsSuPass', ar ? '8 أحرف على الأقل' : 'At least 8 characters'],
      ['dsSuConfirm', ar ? 'أعد كتابة كلمة السر' : 'Repeat password']
    ];
    ph.forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el) el.setAttribute('placeholder', pair[1]);
    });

    var link = document.getElementById('labelSignup');
    if (link) link.textContent = ar ? 'سجّل الآن' : 'Sign up';
  }

  /* ─────────────────────────────── boot ────────────────────────────────── */
  function boot() {
    document.body.classList.add('ds-landing');
    syncLangKeys();
    wrapSetLang();
    installLogin();
    installGoogleButton();
    syncRememberUI();
    refreshBridgeCopy();

    /* The page's DOMContentLoaded handler calls setLang(state.lang) after us,
       so re-run copy sync once the intro has finished booting. */
    window.addEventListener('load', function () {
      syncLangKeys();
      refreshBridgeCopy();
      installGoogleButton();
      syncRememberUI();
    });

    /* Keep every open tab / page in sync. */
    window.addEventListener('storage', function (e) {
      if (e.key === LS_LANDING || e.key === LS_APP || e.key === LS_ALT) refreshBridgeCopy();
    });
  }

  window.openSignup = openSignup;
  window.closeSignup = closeSignup;
  window.dsOpenGoogle = function () { try { DS.auth.googleSignIn(); } catch (e) {} };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
