/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — FIREBASE BRIDGE (Firebase v10 Modular SDK)
   Wraps Email/Password, Google and sign-out calls. Every failure
   falls back gracefully so the app never breaks without a network.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before firebase-bridge.js'); return; }

  var cfg = window.firebaseConfig || {
    apiKey: "AIzaSyBDaZzhcpYKG8zxvueDEoCNtX_3Iu0auq4",
    authDomain: "dotstudio-pos.firebaseapp.com",
    projectId: "dotstudio-pos",
    storageBucket: "dotstudio-pos.firebasestorage.app",
    messagingSenderId: "914496008862",
    appId: "1:914496008862:web:11466fe7fa020b519a418f",
    measurementId: "G-02MJ4LDFYP"
  };
  window.firebaseConfig = cfg;

  function looksReal(c) {
    if (!c || typeof c !== 'object') return false;
    if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(String(c.apiKey || ''))) return false;
    return !!c.projectId;
  }

  var state = { configured: looksReal(cfg), ready: false, loading: null, error: null };

  function loadModular() {
    return Promise.all([
      import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js")
    ]).then(function (mods) {
      var appMod = mods[0], authMod = mods[1];
      if (!window.firebaseApp) {
        try { window.firebaseApp = appMod.initializeApp(cfg); } catch (e) { window.firebaseApp = appMod.getApps && appMod.getApps().length ? appMod.getApps()[0] : null; }
      }
      var auth = authMod.getAuth(window.firebaseApp);
      window.firebaseAuth = window.firebaseAuth || auth;
      window.googleProvider = window.googleProvider || new authMod.GoogleAuthProvider();
      window.signInWithPopup = window.signInWithPopup || authMod.signInWithPopup;
      window.createUserWithEmailAndPassword = window.createUserWithEmailAndPassword || authMod.createUserWithEmailAndPassword;
      window.signInWithEmailAndPassword = window.signInWithEmailAndPassword || authMod.signInWithEmailAndPassword;
      window.onAuthStateChanged = window.onAuthStateChanged || authMod.onAuthStateChanged;
  window.RecaptchaVerifier = window.RecaptchaVerifier || authMod.RecaptchaVerifier;
  window.signInWithPhoneNumber = window.signInWithPhoneNumber || authMod.signInWithPhoneNumber;
      state.ready = true;
      console.log('[DS.firebase] connected ·', cfg.projectId);
      return true;
    }).catch(function (err) {
      state.error = (err && err.message) || 'firebase unavailable';
      console.warn('[DS.firebase] offline fallback ·', state.error);
      return false;
    });
  }

  function ensure() {
    if (window.firebaseAuth && window.signInWithEmailAndPassword) { state.ready = true; return Promise.resolve(true); }
    if (!state.configured) return Promise.resolve(false);
    if (state.ready) return Promise.resolve(true);
    if (state.loading) return state.loading;
    state.loading = loadModular();
    return state.loading;
  }

  function auth() { return window.firebaseAuth || null; }

  function signIn(email, password) {
    return ensure().then(function (ok) {
      if (!ok) return { ok: false, error: 'not_configured' };
      var fn = window.signInWithEmailAndPassword;
      return fn(auth(), String(email), String(password))
        .then(function (res) { return { ok: true, uid: res.user.uid, email: res.user.email }; })
        .catch(function (err) { return { ok: false, error: (err && err.code) || 'firebase' }; });
    });
  }

  function signUp(email, password, name) {
    return ensure().then(function (ok) {
      if (!ok) return { ok: false, error: 'not_configured' };
      var fn = window.createUserWithEmailAndPassword;
      return fn(auth(), String(email), String(password))
        .then(function (res) {
          if (res && res.user && name && res.user.updateProfile) {
            return res.user.updateProfile({ displayName: String(name) }).then(function () { return { ok: true, uid: res.user.uid }; });
          }
          return { ok: true, uid: res.user.uid };
        })
        .catch(function (err) { return { ok: false, error: (err && err.code) || 'firebase' }; });
    });
  }

  function google() {
    return ensure().then(function (ok) {
      if (!ok) return { ok: false, error: 'not_configured' };
      var provider = window.googleProvider || new (window.GoogleAuthProvider || Object)();
      var fn = window.signInWithPopup;
      return fn(auth(), provider)
        .then(function (res) { return { ok: true, uid: res.user.uid, email: res.user.email, name: res.user.displayName }; })
        .catch(function (err) { return { ok: false, error: (err && err.code) || 'firebase' }; });
    });
  }

  function signOut() {
    return ensure().then(function (ok) {
      if (!ok) return { ok: true, local: true };
      var a = auth();
      if (a && typeof a.signOut === 'function') return a.signOut().then(function(){return{ok:true};}).catch(function(){return{ok:false};});
      return { ok: true, local: true };
    });
  }

  function clearRemoteData() { return signOut().then(function () { return { ok: true, signedOut: true }; }); }
  function currentUser() { var a = auth(); return a ? a.currentUser : null; }

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

  if (state.configured) setTimeout(function () { ensure(); }, 400);
  console.log('%cDotStudio® · firebase bridge ' + (state.configured ? 'armed' : 'offline mode'), 'color:#82FF1F');
})();
