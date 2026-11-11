/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — GLOBAL AUTO-HEALING ERROR HANDLER
   Loaded on every page (before any other app script).

   • Catches window.onerror + unhandledrejection.
   • Shows a sleek, non-blocking toast: "جاري معالجة خطأ…"
   • Persists the exact error, file, line, column and stack inside
     localStorage key `ds_error_logs` (max 200 records, newest first)
     so the app can be auto-fixed later.
   • Self-contained: no CSS file, no DS dependency, never throws.

   Read the log from the console:
       DS_ERRORS.list()      → array of records
       DS_ERRORS.text()      → pretty multiline string
       DS_ERRORS.clear()     → wipe the log
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__dsErrorHandlerReady) return;
  window.__dsErrorHandlerReady = true;

  var KEY = 'ds_error_logs';
  var MAX = 200;
  var seen = {};
  var lastToastAt = 0;
  var handling = false;

  /* ───────────────────────────── storage ───────────────────────────── */
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) {}
  }
  function isAr() {
    try {
      var l = localStorage.getItem('cz_lang') || localStorage.getItem('ds_lang') || localStorage.getItem('lang');
      if (l) return l !== 'en';
      return (document.documentElement.getAttribute('lang') || 'ar').indexOf('en') !== 0;
    } catch (e) { return true; }
  }

  /* ───────────────────────────── toast ─────────────────────────────── */
  function toast(message, sub) {
    var now = Date.now();
    if (now - lastToastAt < 1400) return;   // de-dupe bursts
    lastToastAt = now;
    try {
      var host = document.getElementById('dsErrorToastHost');
      if (!host) {
        host = document.createElement('div');
        host.id = 'dsErrorToastHost';
        host.setAttribute('role', 'status');
        host.setAttribute('aria-live', 'polite');
        host.style.cssText = [
          'position:fixed', 'z-index:2147483000', 'inset-inline-end:20px', 'bottom:20px',
          'display:flex', 'flex-direction:column', 'gap:10px', 'pointer-events:none',
          'max-width:min(380px,calc(100vw - 32px))'
        ].join(';');
        (document.body || document.documentElement).appendChild(host);
      }
      var el = document.createElement('div');
      el.style.cssText = [
        'display:flex', 'align-items:center', 'gap:12px',
        'padding:14px 16px', 'border-radius:16px',
        'background:rgba(18,18,20,.92)', 'color:#fff',
        'border:1px solid rgba(255,255,255,.14)',
        'box-shadow:0 18px 50px rgba(0,0,0,.42)',
        '-webkit-backdrop-filter:blur(22px) saturate(160%)',
        'backdrop-filter:blur(22px) saturate(160%)',
        'font:500 13px/1.4 -apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",Inter,sans-serif',
        'opacity:0', 'transform:translateY(10px) scale(.98)',
        'transition:opacity .28s ease,transform .28s cubic-bezier(.2,.8,.2,1)',
        'pointer-events:auto', 'direction:' + (isAr() ? 'rtl' : 'ltr')
      ].join(';');

      var dot = document.createElement('span');
      dot.style.cssText = [
        'flex:0 0 auto', 'width:26px', 'height:26px', 'border-radius:50%',
        'display:grid', 'place-items:center', 'font-size:13px',
        'background:rgba(212,255,58,.14)', 'color:#d4ff3a'
      ].join(';');
      dot.textContent = '⟳';
      dot.style.animation = 'dsErrSpin 1.1s linear infinite';

      var body = document.createElement('div');
      body.style.cssText = 'min-width:0;flex:1 1 auto';
      var b = document.createElement('div');
      b.textContent = message || (isAr() ? 'جاري معالجة خطأ…' : 'Handling an error…');
      b.style.cssText = 'font-weight:600;letter-spacing:-.01em';
      var small = document.createElement('div');
      small.textContent = sub || (isAr() ? 'تم حفظ التفاصيل تلقائياً' : 'Details saved automatically');
      small.style.cssText = 'margin-top:2px;font-size:11.5px;color:rgba(255,255,255,.62)';
      body.appendChild(b); body.appendChild(small);

      el.appendChild(dot); el.appendChild(body);
      host.appendChild(el);
      requestAnimationFrame(function () {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0) scale(1)';
      });
      setTimeout(function () {
        el.style.opacity = '0';
        el.style.transform = 'translateY(8px) scale(.99)';
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
      }, 4200);
    } catch (e) { /* never fail inside the failure handler */ }
  }

  /* keyframes injected once (inline styles cannot declare them) */
  try {
    if (!document.getElementById('dsErrKeyframes')) {
      var st = document.createElement('style');
      st.id = 'dsErrKeyframes';
      st.textContent = '@keyframes dsErrSpin{to{transform:rotate(360deg)}}';
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (e) {}

  /* ───────────────────────────── recording ─────────────────────────── */
  function record(payload) {
    if (handling) return;
    handling = true;
    try {
      var rec = {
        id: 'err_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
        time: new Date().toISOString(),
        type: payload.type || 'error',
        message: String(payload.message || 'Unknown error').slice(0, 1200),
        file: String(payload.file || '').slice(0, 600),
        line: payload.line || 0,
        column: payload.column || 0,
        stack: String(payload.stack || '').slice(0, 4000),
        url: (function () { try { return location.href; } catch (e) { return ''; } })(),
        page: (function () { try { return location.pathname.split('/').pop() || 'index.html'; } catch (e) { return ''; } })(),
        lang: isAr() ? 'ar' : 'en',
        userAgent: (function () { try { return navigator.userAgent.slice(0, 300); } catch (e) { return ''; } })()
      };
      var fingerprint = rec.type + '|' + rec.message + '|' + rec.file + '|' + rec.line;
      var list = read();
      /* Collapse identical repeats into a counter instead of spamming storage. */
      if (seen[fingerprint]) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].fingerprint === fingerprint) {
            list[i].count = (list[i].count || 1) + 1;
            list[i].last_time = rec.time;
            break;
          }
        }
        write(list);
      } else {
        seen[fingerprint] = true;
        rec.fingerprint = fingerprint;
        rec.count = 1;
        list.unshift(rec);
        write(list);
      }
      try { console.warn('[DotStudio auto-heal]', rec.message, rec.file ? '(' + rec.file + ':' + rec.line + ')' : '', rec.stack || ''); } catch (e) {}
      toast(isAr() ? 'جاري معالجة خطأ…' : 'Handling an error…',
            isAr() ? 'حُفظت التفاصيل لإصلاحها تلقائياً' : 'Details saved for auto-repair');
    } catch (e) { /* ignore */ }
    handling = false;
  }

  /* ───────────────────────────── listeners ─────────────────────────── */
  window.addEventListener('error', function (event) {
    try {
      /* Ignore failed image/script loads — they are handled by onerror fallbacks. */
      var tgt = event.target;
      if (tgt && tgt !== window && tgt.tagName && /^(IMG|SCRIPT|LINK|VIDEO|AUDIO|SOURCE)$/.test(tgt.tagName)) return;
      var err = event.error;
      record({
        type: 'error',
        message: (event.message || (err && err.message) || 'Script error'),
        file: event.filename || (err && err.fileName) || '',
        line: event.lineno || (err && err.lineNumber) || 0,
        column: event.colno || (err && err.columnNumber) || 0,
        stack: (err && err.stack) || ''
      });
    } catch (e) {}
  }, true);

  window.onerror = function (message, source, lineno, colno, error) {
    record({
      type: 'onerror',
      message: message,
      file: source,
      line: lineno,
      column: colno,
      stack: (error && error.stack) || ''
    });
    return false; /* let the browser log it too */
  };

  window.addEventListener('unhandledrejection', function (event) {
    try {
      var reason = event.reason;
      var msg = reason && (reason.message || reason.msg) ? (reason.message || reason.msg) : String(reason);
      record({
        type: 'unhandledrejection',
        message: msg || 'Unhandled promise rejection',
        file: (reason && reason.fileName) || '',
        line: (reason && reason.lineNumber) || 0,
        column: (reason && reason.columnNumber) || 0,
        stack: (reason && reason.stack) || ''
      });
    } catch (e) {}
  });

  /* ───────────────────────────── public API ────────────────────────── */
  window.DS_ERRORS = {
    key: KEY,
    list: read,
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} seen = {}; return true; },
    text: function () {
      return read().map(function (r, i) {
        return '#' + (i + 1) + ' [' + r.time + '] ' + r.type + ' · ' + (r.count > 1 ? 'x' + r.count + ' ' : '') + r.message +
          (r.file ? '\n    at ' + r.file + ':' + r.line + ':' + r.column : '') +
          (r.stack ? '\n    ' + r.stack.split('\n').slice(0, 12).join('\n    ') : '');
      }).join('\n\n');
    },
    test: function () {
      record({ type: 'test', message: 'Manual auto-heal test', file: location.href, line: 0, column: 0, stack: '' });
      return read()[0];
    }
  };

  console.log('%cDotStudio® · auto-heal armed', 'color:#d4ff3a;font-weight:bold');
})();
