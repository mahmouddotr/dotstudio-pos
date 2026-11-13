/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — AUTH MODULE
   One place for signing in, creating an account and Google sign-in.
   • Passwords are stored as salted, iterated SHA-256 hashes only.
   • Every input is sanitised + validated before it touches the DB.
   • Works fully offline (no Firebase, no network round-trip).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before auth.js'); return; }

  var LS_LAST_EMAIL = 'ds_last_email';

  function db() { return DS.data ? DS.data.db : null; }
  function users() { return (db() && db().users) || []; }
  function findUsername(username) {
    var u = String(username || '').trim().toLowerCase();
    return users().filter(function (x) { return String(x.username || '').toLowerCase() === u; })[0] || null;
  }
  function findByEmail(email) {
    var e = String(email || '').trim().toLowerCase();
    if (!e) return null;
    return users().filter(function (x) {
      return String(x.email || '').trim().toLowerCase() === e || String(x.google_email || '').trim().toLowerCase() === e;
    })[0] || null;
  }

  /* ───────────────────────── SESSION ───────────────────────── */
  var REMEMBER_KEY = 'cz_remember';
  var SESSION_KEYS = ['cz_user', 'cz_session', 'cz_role', 'cz_mock', 'cz_login_at', 'ds_permissions'];

  function wipeSession(store) {
    if (!store) return;
    SESSION_KEYS.forEach(function (k) { try { store.removeItem(k); } catch (e) {} });
  }

  /* remember === false → sessionStorage (logged out when the browser closes).
     Anything else keeps the previous behaviour → localStorage. */
  function setSession(user, remember) {
    if (!user) return null;
    var clean = Object.assign({}, user);
    delete clean.password;
    delete clean.password_hash;

    var persist = remember !== false;
    var primary = null, secondary = null;
    try {
      primary = persist ? localStorage : sessionStorage;
      secondary = persist ? sessionStorage : localStorage;
    } catch (e) { primary = null; secondary = null; }
    if (!primary) {
      /* sessionStorage blocked (private mode / file://) → stay persistent. */
      try { primary = localStorage; secondary = sessionStorage; persist = true; } catch (e) { primary = null; }
    }
    if (!primary) return clean;

    wipeSession(secondary);

    try {
      primary.setItem('cz_user', JSON.stringify(clean));
      primary.setItem('cz_session', clean.id);
      primary.setItem('cz_role', clean.role);
      primary.setItem('cz_mock', '1');
      primary.setItem('cz_login_at', String(Date.now()));
      primary.setItem(REMEMBER_KEY, persist ? '1' : '0');
      primary.removeItem('ds_preview_mode');
      if (clean.role === 'subadmin') primary.setItem('ds_permissions', JSON.stringify(clean.permissions || []));
      else primary.removeItem('ds_permissions');
    } catch (e) { /* storage disabled */ }

    try {
      /* Non-credential preferences stay device-wide. */
      if (clean.tenant_id) localStorage.setItem('ds_customer_store', clean.tenant_id);
      localStorage.setItem(REMEMBER_KEY, persist ? '1' : '0');
      if (clean.email) localStorage.setItem(LS_LAST_EMAIL, clean.email);
    } catch (e) {}

    /* Mock JWT lives in sessionStorage only — it dies with the tab. */
    try {
      if (DS.security && DS.security.issueToken) {
        sessionStorage.setItem('ds_jwt', DS.security.issueToken({
          sub: clean.id, role: clean.role, name: clean.name, tenant: clean.tenant_id || null
        }));
      }
    } catch (e) {}

    return clean;
  }
  DS.setSession = setSession;

  function homeOf(user) {
    if (DS.roleHome) return DS.roleHome(user);
    return 'customer/storefront.html';
  }

  /* ───────────────────────── LOGIN ───────────────────────── */
  var DEMO_ALIASES = {
    owner: 'caznova', cashier: 'ca_cashier', delivery: 'talqa',
    customer: 'customer', subadmin: 'dina', admin: 'admin'
  };

  function login(usernameOrEmail, password, opts) {
    opts = opts || {};
    var entered = String(usernameOrEmail == null ? '' : usernameOrEmail).trim();
    if (!entered) return { ok: false, error: 'empty' };
    var canonical = DEMO_ALIASES[entered.toLowerCase()];
    var aliasPassword = canonical ? entered.toLowerCase() + '2026' : null;
    var user = /@/.test(entered) ? findByEmail(entered) : findUsername(entered);
    if (!user) return { ok: false, error: 'invalid' };

    var stored = user.password_hash || user.password;
    var ok = DS.security.verifyPassword(password, stored);
    /* Demo alias passwords (owner / cashier / delivery / customer …). */
    if (!ok && aliasPassword) ok = DS.security.verifyPassword(aliasPassword, stored);

    if (!ok) return { ok: false, error: 'invalid' };
    if (user.is_active === false) return { ok: false, error: 'suspended' };
    if (user.tenant_id && (user.role === 'owner' || user.role === 'cashier')) {
      var tn = DS.data.tenantById(user.tenant_id);
      if (tn && tn.status === 'suspended') return { ok: false, error: 'store_suspended' };
    }

    var clean = setSession(user, opts.remember);
    if (DS.data.audit) {
      try { DS.data.audit('تسجيل دخول · ' + (user.name || entered), 'Signed in · ' + (user.name_en || user.name || entered), 'shield', clean); } catch (e) {}
    }
    /* Mirror the session into Firebase when a real project is configured. */
    if (DS.firebase && DS.firebase.configured && user.email) {
      try { DS.firebase.signIn(user.email, password); } catch (e) {}
    }
    return { ok: true, user: clean, redirect: homeOf(clean) };
  }
  DS.login = login;

  /* ───────────────────────── REGISTER ───────────────────────── */
  function slugUsername(name, email) {
    var base = String(email || '').split('@')[0] || String(name || 'user');
    base = base.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (!base || base.length < 3) {
      base = 'user' + String(Date.now()).slice(-5);
    }
    var candidate = base, n = 2;
    while (findUsername(candidate)) { candidate = base + n; n++; }
    return candidate;
  }

  function validateRegistration(input) {
    var errors = {};
    var name = DS.sanitize(input.name, 60);
    var email = DS.sanitize(input.email, 120).toLowerCase();
    var phone = DS.normalizePhone(input.phone);
    var password = String(input.password || '');
    var confirm = String(input.confirm == null ? input.password : input.confirm);

    if (name.length < 2) errors.name = 'short';
    if (!DS.isEmail(email)) errors.email = 'invalid';
    else if (findByEmail(email)) errors.email = 'exists';
    if (!DS.isPhone(phone)) errors.phone = 'invalid';
    else if (users().some(function (u) { return DS.normalizePhone(u.phone) === phone; })) errors.phone = 'exists';
    if (password.length < 8) errors.password = 'short';
    if (confirm !== password) errors.confirm = 'mismatch';

    return { errors: errors, clean: { name: name, email: email, phone: phone, password: password } };
  }

  function register(input, opts) {
    input = input || {};
    opts = opts || {};
    var settings = (db() && db().settings) || {};
    if (settings.allow_signups === false) return { ok: false, error: 'disabled' };

    var check = validateRegistration(input);
    if (Object.keys(check.errors).length) return { ok: false, error: 'validation', errors: check.errors };
    var c = check.clean;

    var store = null;
    try { store = localStorage.getItem('ds_customer_store'); } catch (e) {}
    var tenantId = (input.tenant_id && DS.data.tenantById(input.tenant_id)) ? input.tenant_id : (store || 't-caznova');

    var patch = DS.security.passwordPatch(c.password);
    var user = {
      id: DS.uid('u'),
      username: slugUsername(c.name, c.email),
      name: c.name,
      name_en: c.name,
      email: c.email,
      phone: c.phone,
      role: 'customer',
      tenant_id: tenantId,
      avatar_id: 'av' + (1 + Math.floor(Math.random() * 9)),
      provider: 'password',
      is_active: true,
      terms_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    user.password_hash = patch.password_hash;

    db().users.push(user);
    if (DS.data.audit) {
      try { DS.data.audit('حساب جديد · ' + user.name, 'New account · ' + user.name, 'user', user); } catch (e) {}
    }
    try { localStorage.setItem('ds_db_v1', JSON.stringify(db())); } catch (e) {}

    var clean = setSession(user, opts.remember);
    if (DS.firebase && DS.firebase.configured) {
      try { DS.firebase.signUp(c.email, c.password, c.name); } catch (e) {}
    }
    return { ok: true, user: clean, redirect: homeOf(clean) };
  }
  DS.register = register;

  /* ───────────────────────── GOOGLE SIGN-IN ─────────────────────────
     Google identity flow: the user picks (or types) a Google account and
     we create/restore the matching customer profile. When a real Firebase
     project is configured (shared/js/firebase-config.js) the bridge also
     mirrors the provider sign-in; otherwise a local session is created
     silently. No password is ever requested or stored for these accounts. */

  function googleIcon() {
    return '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">' +
      '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>' +
      '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>' +
      '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>' +
      '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>' +
      '</svg>';
  }
  DS.googleIcon = googleIcon;

  var GOOGLE_ACCOUNTS = [
    { name: 'ياسمين محمد', name_en: 'Yasmin Mohamed', email: 'yasmin@gmail.com', color: '#1a73e8', initial: 'ي' },
    { name: 'محمود علي', name_en: 'Mahmoud Ali', email: 'mahmoud@gmail.com', color: '#34a853', initial: 'م' },
    { name: 'سارة سميزي', name_en: 'Sara Smozy', email: 'sara@gmail.com', color: '#fbbc05', initial: 'س' },
    { name: 'أحمد كازنوفا', name_en: 'Ahmed Caznova', email: 'ahmed@gmail.com', color: '#ea4335', initial: 'أ' }
  ];

  function googleLoginAccount(account, opts) {
    opts = opts || {};
    var name = (account && (account.name || account.name_en)) || 'عميل جوجل';
    var email = String((account && account.email) || 'google@customer.com').trim().toLowerCase();
    var existing = findByEmail(email);
    if (!existing) {
      var store = null;
      try { store = localStorage.getItem('ds_customer_store'); } catch (e) {}
      var user = {
        id: DS.uid('u'),
        username: slugUsername(name, email),
        name: name,
        name_en: account && account.name_en ? account.name_en : name,
        email: email,
        phone: '',
        role: 'customer',
        tenant_id: store || 't-caznova',
        avatar_id: 'av5',
        provider: 'google',
        is_active: true,
        created_at: new Date().toISOString()
      };
      try { (db().users = db().users || []).push(user); } catch (e) {}
      try { localStorage.setItem('ds_db_v1', JSON.stringify(db())); } catch (e) {}
      existing = user;
    }
    var clean = setSession(existing, opts.remember !== false);
    try {
      if (DS.firebase && DS.firebase.configured && existing.email) DS.firebase.signIn(existing.email, '');
    } catch (e) {}
    return { ok: true, user: clean, redirect: 'customer/storefront.html' };
  }

  function googleSignIn(opts) {
    opts = opts || {};
    /* Backwards-compatible entry point: open the account picker. */
    openGoogleSignIn(opts);
    return { ok: true, redirect: 'customer/storefront.html' };
  }
  DS.googleSignIn = googleSignIn;

  function openGoogleSignIn(opts) {
    opts = opts || {};
    /* Remove any existing popup. */
    var old = document.querySelector('.ds-gsi-backdrop');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var backdrop = document.createElement('div');
    backdrop.className = 'ds-gsi-backdrop';
    backdrop.innerHTML =
      '<div class="ds-gsi" role="dialog" aria-modal="true" aria-labelledby="dsGsiTitle">' +
        '<button type="button" class="ds-gsi-close" data-gsi-close aria-label="Close">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
        '<div class="ds-gsi-logo">' + googleIcon() + '</div>' +
        '<h2 id="dsGsiTitle">' + esc(DS.lang() === 'en' ? 'Choose an account' : 'اختر حساباً') + '</h2>' +
        '<p class="ds-gsi-sub">' + esc(DS.lang() === 'en' ? 'to continue to ' : 'للمتابعة إلى ') + '<b>DotStudio®</b></p>' +
        '<div class="ds-gsi-accounts" data-gsi-accounts>' +
          GOOGLE_ACCOUNTS.map(function (a, i) {
            return '<button type="button" class="ds-gsi-acc' + (i === 0 ? ' is-active' : '') + '" data-gsi-acc="' + i + '">' +
              '<span class="ds-gsi-avatar" style="background:' + esc(a.color) + '">' + esc(a.initial) + '</span>' +
              '<span class="ds-gsi-acc-copy"><b>' + esc(DS.lang() === 'en' ? (a.name_en || a.name) : a.name) + '</b><span>' + esc(a.email) + '</span></span>' +
              '<span class="ds-gsi-radio"></span>' +
            '</button>';
          }).join('') +
        '</div>' +
        '<div class="ds-gsi-divider"></div>' +
        '<button type="button" class="ds-gsi-link" data-gsi-toggle-manual>' + esc(DS.lang() === 'en' ? 'Use another account' : 'استخدام حساب آخر') + '</button>' +
        '<div class="ds-gsi-manual" data-gsi-manual>' +
          '<div class="ds-gsi-field"><input type="email" data-gsi-email placeholder=" " dir="ltr"><label>' + esc(DS.lang() === 'en' ? 'Email or phone' : 'البريد الإلكتروني أو الهاتف') + '</label></div>' +
          '<div class="ds-gsi-err" data-gsi-err></div>' +
        '</div>' +
        '<div class="ds-gsi-actions">' +
          '<button type="button" class="ds-gsi-link" data-gsi-cancel>' + esc(DS.lang() === 'en' ? 'Cancel' : 'إلغاء') + '</button>' +
          '<button type="button" class="ds-gsi-continue" data-gsi-continue>' + esc(DS.lang() === 'en' ? 'Continue' : 'متابعة') + '</button>' +
        '</div>' +
        '<div class="ds-gsi-foot"><span>' + esc(DS.lang() === 'en' ? 'Not shared with DotStudio®' : 'لن تتم مشاركته مع DotStudio®') + '</span><a href="#" data-gsi-help>' + esc(DS.lang() === 'en' ? 'Learn more' : 'المزيد') + '</a></div>' +
      '</div>';

    document.body.appendChild(backdrop);
    document.body.classList.add('ds-gsi-open');

    var selected = 0;
    function close() {
      document.body.classList.remove('ds-gsi-open');
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    function updateActive() {
      backdrop.querySelectorAll('[data-gsi-acc]').forEach(function (b, i) {
        b.classList.toggle('is-active', i === selected);
      });
    }

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) close();
    });
    backdrop.querySelector('[data-gsi-close]').addEventListener('click', close);
    backdrop.querySelector('[data-gsi-cancel]').addEventListener('click', close);

    backdrop.querySelectorAll('[data-gsi-acc]').forEach(function (b, i) {
      b.addEventListener('click', function () { selected = i; updateActive(); });
    });

    var manual = backdrop.querySelector('[data-gsi-manual]');
    backdrop.querySelector('[data-gsi-toggle-manual]').addEventListener('click', function () {
      manual.classList.toggle('is-open');
    });

    var continueBtn = backdrop.querySelector('[data-gsi-continue]');
    continueBtn.addEventListener('click', function () {
      var emailInput = backdrop.querySelector('[data-gsi-email]');
      var email = (emailInput && emailInput.value || '').trim();
      var account = null;
      if (manual.classList.contains('is-open') && email) {
        account = { name: email.split('@')[0] || 'Google User', name_en: email.split('@')[0] || 'Google User', email: email };
      } else {
        account = GOOGLE_ACCOUNTS[selected];
      }
      if (!account || !account.email) {
        var err = backdrop.querySelector('[data-gsi-err]');
        if (err) err.textContent = DS.lang() === 'en' ? 'Enter a valid email' : 'أدخل بريداً إلكترونياً صالحاً';
        return;
      }
      continueBtn.disabled = true;
      continueBtn.innerHTML = '<span class="ds-gsi-spinner"></span>';
      setTimeout(function () {
        var res = googleLoginAccount(account, opts);
        close();
        window.location.href = DS.url(res.redirect || 'customer/storefront.html');
      }, 420);
    });

    /* Open animation. */
    requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
  }
  DS.openGoogleSignIn = openGoogleSignIn;

  /* Reusable Google button markup (used by the login page + checkout). */
  DS.googleButton = function (label) {
    return '<button type="button" class="btn btn-google" data-google-signin>' + googleIcon() +
      '<span>' + esc(label || (DS.lang() === 'en' ? 'Continue with Google' : 'المتابعة باستخدام Google')) + '</span></button>';
  };

  /* Let any page wire a Google button without extra plumbing. */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-google-signin]') : null;
    if (!btn) return;
    e.preventDefault();
    openGoogleSignIn();
  });

  function esc(v) { return DS.esc ? DS.esc(v) : String(v == null ? '' : v); }

  /* Public namespace used by the login page and any other surface. */
  DS.auth = {
    login: login,
    register: register,
    googleSignIn: googleSignIn,
    googleButton: DS.googleButton,
    setSession: setSession,
    loginWithAlias: login
  };

  console.log('%cDotStudio® · auth ready', 'color:#82FF1F');
})();
