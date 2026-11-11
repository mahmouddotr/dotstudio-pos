/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — FIREBASE BRIDGE (optional)
   The demo runs fully offline. If `shared/js/firebase-config.js`
   contains a real project (apiKey starts with AIza…) this bridge
   lazy-loads the Firebase compat SDK and mirrors Email/Password,
   Google and sign-out calls. Every failure falls back to local
   auth silently, so the app never breaks without a network.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before firebase-bridge.js'); return; }

  var SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
  var cfg = window.firebaseConfig || null;

  function looksReal(c) {
    if (!c || typeof c !== 'object') return false;
    if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(String(c.apiKey || ''))) return false;
    var junk = String(c.appId || '') + String(c.messagingSenderId || '') + String(c.projectId || '');
    if (/placeholder|replace_with|1234567890|abcdef/i.test(junk)) return false;
    return !!c.projectId;
  }

  var state = {
    configured: looksReal(cfg),
    ready: false,
    loading: null,
    error: null
  };

  function load(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function ensure() {
    if (!state.configured) return Promise.resolve(false);
    if (state.ready) return Promise.resolve(true);
    if (state.loading) return state.loading;
    state.loading = load(SDK + 'firebase-app-compat.js')
      .then(function () { return load(SDK + 'firebase-auth-compat.js'); })
      .then(function () {
        if (typeof window.firebase === 'undefined' || !window.firebase.initializeApp) throw new Error('Firebase SDK missing');
        if (!window.firebase.apps || !window.firebase.apps.length) window.firebase.initializeApp(cfg);
        state.ready = true;
        console.log('[DS.firebase] connected ·', cfg.projectId);
        return true;
      })
      .catch(function (err) {
        state.error = (err && err.message) || 'firebase unavailable';
        console.warn('[DS.firebase] offline fallback ·', state.error);
        return false;
      });
    return state.loading;
  }

  /* Every remote call is best-effort: local auth is the source of truth. */
  function safe(promise, label) {
    return promise.catch(function (err) {
      var code = (err && err.code) || '';
      console.warn('[DS.firebase] ' + label + ' skipped ·', code || (err && err.message));
      return { ok: false, error: code || 'firebase' };
    });
  }

  function auth() {
    return window.firebase && window.firebase.auth ? window.firebase.auth() : null;
  }

  function signIn(email, password) {
    return ensure().then(function (ok) {
      if (!ok) return { ok: false, error: 'not_configured' };
      return safe(auth().signInWithEmailAndPassword(String(email), String(password)), 'signIn')
        .then(function (res) { return res && res.user ? { ok: true, uid: res.user.uid } : res; });
    });
  }

  function signUp(email, password, name) {
    return ensure().then(function (ok) {
      if (!ok) return { ok: false, error: 'not_configured' };
      return safe(auth().createUserWithEmailAndPassword(String(email), String(password)), 'signUp')
        .then(function (res) {
          if (res && res.user && name && res.user.updateProfile) {
            return res.user.updateProfile({ displayName: String(name) }).then(function () { return { ok: true, uid: res.user.uid }; });
          }
          return res && res.user ? { ok: true, uid: res.user.uid } : res;
        });
    });
  }

  function google() {
    return ensure().then(function (ok) {
      if (!ok) return { ok: false, error: 'not_configured' };
      var provider = new window.firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return safe(auth().signInWithPopup(provider), 'google')
        .then(function (res) { return res && res.user ? { ok: true, uid: res.user.uid, email: res.user.email } : res; });
    });
  }

  function signOut() {
    return ensure().then(function (ok) {
      if (!ok) return { ok: true, local: true };
      return safe(auth().signOut(), 'signOut');
    });
  }

  /* Used by Settings → Reset demo database. Remote documents are only
     touched when a real project is configured. */
  function clearRemoteData() {
    return ensure().then(function (ok) {
      if (!ok) return { ok: true, local: true };
      return signOut().then(function () { return { ok: true, signedOut: true }; });
    });
  }

  function currentUser() {
    if (!state.ready) return null;
    var a = auth();
    return a ? a.currentUser : null;
  }

  DS.firebase = {
    get configured() { return state.configured; },
    get ready() { return state.ready; },
    get error() { return state.error; },
    config: cfg,
    ensure: ensure,
    signIn: signIn,
    signUp: signUp,
    google: google,
    signOut: signOut,
    currentUser: currentUser,
    clearRemoteData: clearRemoteData
  };

  /* Kick off the connection in the background — never blocks the UI. */
  if (state.configured) setTimeout(function () { ensure(); }, 400);
  console.log('%cDotStudio® · firebase bridge ' + (state.configured ? 'armed' : 'offline mode'), 'color:#82FF1F');
})();
