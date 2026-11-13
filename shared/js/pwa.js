/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — PWA BOOTSTRAP
   • Registers the service worker from any folder depth
   • Injects the web-app manifest when the page has none
   • Shows a dismissible «تثبيت التطبيق» banner when installable
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS = window.DS || {};

  /* Resolve the app root from this script's own URL. */
  function detectRoot() {
    try {
      var sc = document.currentScript;
      if (!sc || !sc.src) {
        var all = document.getElementsByTagName('script');
        for (var i = all.length - 1; i >= 0; i--) {
          if (all[i].src && /shared\/js\/pwa\.js/.test(all[i].src)) { sc = all[i]; break; }
        }
      }
      if (sc && sc.src) return sc.src.replace(/shared\/js\/pwa\.js.*$/, '');
    } catch (e) {}
    return '';
  }
  var ROOT = detectRoot();

  function absolute(path) {
    try { return new URL(ROOT + String(path).replace(/^\.?\//, ''), location.href).href; }
    catch (e) { return ROOT + path; }
  }

  /* ── Manifest ─────────────────────────────────────────────────── */
  var hasManifest = !!document.querySelector('link[rel="manifest"]');
  if (!hasManifest) {
    var link = document.createElement('link');
    link.rel = 'manifest';
    link.href = absolute('manifest.json');
    document.head.appendChild(link);
  }

  /* ── Service worker (caches CSS/JS/fonts/images) ──────────────── */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    try {
      navigator.serviceWorker.register(absolute('sw.js')).catch(function () {});
    } catch (e) {}
  }

  /* ── Install banner ───────────────────────────────────────────── */
  var DISMISS_KEY = 'ds_pwa_dismissed';
  var deferred = null;
  var shown = false;

  function isStandalone() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
    } catch (e) { return false; }
  }
  function dismissed() { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch (e) { return false; } }
  function dismiss() { try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {} }

  function banner(text, cta, onInstall) {
    if (shown || dismissed() || isStandalone()) return;
    if (!document.body) return;
    shown = true;
    var el = document.createElement('div');
    el.className = 'pwa-install-banner';
    el.setAttribute('role', 'region');
    el.setAttribute('data-pwa-banner', '');
    el.innerHTML =
      '<span class="pwa-banner-ico" aria-hidden="true">' +
        '<img src="' + absolute('assets/img/logo-192.png') + '" alt="">' +
      '</span>' +
      '<span class="pwa-banner-copy"><b>' + (text || 'تثبيت التطبيق') + '</b>' +
        '<i>' + (document.documentElement.lang === 'en'
          ? 'Faster, offline-ready, right on your home screen.'
          : 'أسرع ويعمل بدون إنترنت — على شاشتك الرئيسية.') + '</i></span>' +
      '<button type="button" class="btn btn-primary btn-sm pwa-banner-install">' + (cta || 'تثبيت التطبيق') + '</button>' +
      '<button type="button" class="pwa-banner-x" aria-label="close">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>';

    el.querySelector('.pwa-banner-x').addEventListener('click', function () {
      dismiss();
      el.classList.remove('in');
      setTimeout(function () { el.remove(); }, 220);
    });
    el.querySelector('.pwa-banner-install').addEventListener('click', function () {
      if (onInstall) onInstall();
      el.classList.remove('in');
      setTimeout(function () { el.remove(); }, 220);
    });

    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('in'); });
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    banner('تثبيت التطبيق', 'تثبيت التطبيق', function () {
      if (!deferred) return;
      deferred.prompt();
      var p = deferred.userChoice;
      deferred = null;
      if (p && p.then) p.catch(function () {});
      dismiss();
    });
  });

  window.addEventListener('appinstalled', function () {
    dismiss();
    deferred = null;
    var el = document.querySelector('[data-pwa-banner]');
    if (el) el.remove();
  });

  /* iOS Safari has no install prompt — explain the share-sheet route. */
  document.addEventListener('DOMContentLoaded', function () {
    var iOS = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    var safari = /safari/i.test(navigator.userAgent || '') && !/chrome|crios|fxios/i.test(navigator.userAgent || '');
    if (iOS && safari && !isStandalone()) {
      setTimeout(function () {
        banner('تثبيت التطبيق', 'تثبيت التطبيق', function () {
          try {
            alert(document.documentElement.lang === 'en'
              ? 'Tap Share, then “Add to Home Screen”.'
              : 'اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».');
          } catch (e) {}
        });
      }, 3200);
    }
  });

  DS.pwa = {
    root: ROOT,
    installable: function () { return !!deferred; },
    push: function (payload) {
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'DS_PUSH', notification: payload || {} });
        }
      } catch (e) {}
    }
  };
})();
