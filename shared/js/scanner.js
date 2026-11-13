/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — BARCODE SCANNER (Keyboard Wedge / HID)
   ─────────────────────────────────────────────────────────────
   Works with any USB/Bluetooth scanner that behaves like a keyboard:
   it types the barcode very fast and ends with Enter (or Tab).

   • Global listener: no need to click a field first.
   • Never steals keystrokes from real inputs (search, checkout…).
   • Also supports a dedicated manual field via [data-scan-input].
   • Exposes DS.mountBarcodeScanner() and DS.scanner.processCode().
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS = window.DS || {};

  var FAST_MS = 55;        /* max gap between scanner keystrokes  */
  var SILENCE_MS = 140;    /* auto-flush when no Enter is sent   */
  var DUPLICATE_MS = 350;  /* ignore the same code fired twice   */

  function L(ar, en) { return (DS.lang && DS.lang() === 'en') ? en : ar; }

  function isEditable(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return el.isContentEditable === true;
  }

  function isDedicated(el) {
    if (!el) return false;
    if (el.id === 'barcodeScannerInput') return true;
    return !!(el.getAttribute && el.getAttribute('data-scan-input') !== null);
  }

  function matchProduct(products, code) {
    var raw = String(code || '').trim();
    var lower = raw.toLowerCase();
    var list = Array.isArray(products) ? products : [];
    var found = list.filter(function (p) { return p && p.barcode && String(p.barcode).trim() === raw; })[0];
    if (!found) found = list.filter(function (p) { return p && p.id && String(p.id).trim().toLowerCase() === lower; })[0];
    if (!found) found = list.filter(function (p) { return p && p.sku && String(p.sku).trim().toLowerCase() === lower; })[0];
    return found || null;
  }

  function ensureHiddenInput() {
    var input = document.getElementById('barcodeScannerInput');
    if (input) return input;
    input = document.createElement('input');
    input.type = 'text';
    input.id = 'barcodeScannerInput';
    input.className = 'barcode-scanner-input';
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('aria-hidden', 'true');
    input.setAttribute('tabindex', '-1');
    input.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(input);
    return input;
  }

  function mountBarcodeScanner(opts) {
    opts = opts || {};
    if (DS.__scannerInstance) return DS.__scannerInstance;

    var hiddenInput = ensureHiddenInput();
    var minLength = Number(opts.minLength) || 3;
    var buffer = '';
    var lastAt = 0;
    var timer = null;
    var lastCode = '';
    var lastCodeAt = 0;

    function productsList() {
      if (typeof opts.getProducts === 'function') return opts.getProducts() || [];
      return (DS.data && DS.data.products) || [];
    }

    function feedback(ok, text, code) {
      if (typeof opts.onFeedback === 'function') {
        try { opts.onFeedback(ok, text, code); } catch (e) {}
      }
    }

    function processCode(raw) {
      var code = String(raw == null ? '' : raw).trim();
      if (!code || code.length < minLength) return { ok: false, reason: 'short' };

      var now = Date.now();
      if (code === lastCode && now - lastCodeAt < DUPLICATE_MS) return { ok: false, reason: 'duplicate' };
      lastCode = code;
      lastCodeAt = now;

      var found = matchProduct(productsList(), code);
      if (found) {
        var name = DS.loc ? DS.loc(found, 'name') : (found.name_en || found.name || code);
        feedback(true, name, code);
        if (typeof opts.onFound === 'function') opts.onFound(found, code);
        else if (typeof opts.addToCart === 'function') opts.addToCart(found.id, found);
        return { ok: true, product: found, code: code };
      }

      feedback(false, code, code);
      if (typeof opts.onNotFound === 'function') opts.onNotFound(code);
      else if (DS.toast) DS.toast(L('المنتج غير موجود · ', 'Product not found · ') + code, 'error');
      return { ok: false, reason: 'not_found', code: code };
    }

    function flush(source) {
      clearTimeout(timer);
      timer = null;
      var code = (buffer || '').trim();
      buffer = '';
      lastAt = 0;
      if (hiddenInput) hiddenInput.value = '';
      if (!code) return { ok: false, reason: 'empty' };
      return processCode(code);
    }

    function reset() { buffer = ''; lastAt = 0; clearTimeout(timer); timer = null; }

    function onKeyDown(e) {
      if (e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      var target = e.target;
      var dedicated = isDedicated(target);

      /* Real form fields keep their normal behaviour. */
      if (!dedicated && isEditable(target)) { reset(); return; }

      if (e.key === 'Enter' || e.key === 'Tab') {
        var Code = (buffer || (dedicated && target && target.value) || '').trim();
        if (Code && Code.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          if (dedicated && target) target.value = '';
          buffer = Code;
          flush('enter');
        } else if (dedicated) {
          e.preventDefault();
          if (target) target.value = '';
          reset();
        } else {
          reset();
        }
        return;
      }

      if (e.key && e.key.length === 1) {
        var now = Date.now();
        /* Non-dedicated input: a slow typist is not a scanner, so reset. */
        if (!dedicated && lastAt && now - lastAt > FAST_MS) buffer = '';
        lastAt = now;
        buffer += e.key;

        clearTimeout(timer);
        timer = setTimeout(function () {
          /* Scanners without a suffix: flush only if it clearly looks like a code. */
          if (buffer.length >= Math.max(6, minLength)) flush('silence');
          else reset();
        }, SILENCE_MS + 120);
      }
    }

    window.addEventListener('keydown', onKeyDown, true);

    hiddenInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var value = hiddenInput.value || buffer;
        hiddenInput.value = '';
        buffer = value;
        flush('hidden');
      }
    });

    hiddenInput.addEventListener('change', function () {
      if (hiddenInput.value) {
        var value = hiddenInput.value;
        hiddenInput.value = '';
        processCode(value);
      }
    });

    var api = {
      input: hiddenInput,
      processCode: processCode,
      reset: reset,
      destroy: function () {
        window.removeEventListener('keydown', onKeyDown, true);
        reset();
        DS.__scannerInstance = null;
      }
    };

    DS.__scannerInstance = api;
    DS.scanner = api;
    return api;
  }

  DS.mountBarcodeScanner = mountBarcodeScanner;
  DS.initScanner = mountBarcodeScanner;
})();

/* ─────────────────────────── CAMERA SCANNER ───────────────────────────
   HTML5 getUserMedia + (when available) BarcodeDetector. Falls back to a
   manual text field when the API or camera is unavailable. */
(function () {
  var DS = window.DS;
  if (!DS) return;

  function L(ar, en) { return (DS.lang && DS.lang() === 'en') ? en : ar; }

  function openCameraScanner(opts) {
    opts = opts || {};
    var old = document.querySelector('.ds-scan-backdrop');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var backdrop = document.createElement('div');
    backdrop.className = 'ds-scan-backdrop';
    backdrop.innerHTML =
      '<div class="ds-scan" role="dialog" aria-modal="true">' +
        '<div class="ds-scan-head"><b>' + esc(L('مسح الباركود', 'Scan barcode')) + '</b>' +
          '<button type="button" data-scan-close aria-label="Close">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button></div>' +
        '<div class="ds-scan-stage">' +
          '<video data-scan-video autoplay playsinline muted></video>' +
          '<canvas data-scan-canvas hidden></canvas>' +
          '<div class="ds-scan-frame"></div>' +
        '</div>' +
        '<div class="ds-scan-note">' + esc(L('وجّه الكاميرا نحو الباركود. أو اكتب الرمز يدوياً.', 'Point the camera at the barcode. Or type the code manually.')) + '</div>' +
        '<div class="ds-scan-manual">' +
          '<input data-scan-manual type="text" inputmode="numeric" placeholder="' + esc(L('أدخل الباركود', 'Enter barcode')) + '" dir="ltr">' +
          '<button type="button" data-scan-submit>' + esc(L('بحث', 'Search')) + '</button>' +
        '</div>' +
        '<div class="ds-scan-err" data-scan-err></div>' +
      '</div>';

    document.body.appendChild(backdrop);
    document.body.classList.add('ds-gsi-open');

    var video = backdrop.querySelector('[data-scan-video]');
    var manual = backdrop.querySelector('[data-scan-manual]');
    var errEl = backdrop.querySelector('[data-scan-err]');
    var stream = null;
    var raf = null;
    var detector = null;
    var closed = false;

    function close() {
      if (closed) return;
      closed = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) {} });
      document.body.classList.remove('ds-gsi-open');
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    }

    function setError(msg) { if (errEl) errEl.textContent = msg || ''; }

    function handleCode(code) {
      code = String(code || '').trim();
      if (!code) return;
      if (typeof opts.onFound === 'function') {
        /* Let caller decide; close on success. */
      }
      if (typeof DS.scanner !== 'undefined' && DS.scanner && typeof DS.scanner.processCode === 'function') {
        var res = DS.scanner.processCode(code);
        if (res && res.ok) { close(); return; }
      }
      if (typeof opts.onFound === 'function') {
        try { opts.onFound({ id: code, barcode: code, name: code }); } catch (e) {}
      }
      close();
    }

    backdrop.querySelector('[data-scan-close]').addEventListener('click', close);
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });

    backdrop.querySelector('[data-scan-submit]').addEventListener('click', function () {
      handleCode(manual.value);
      manual.value = '';
    });
    manual.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); handleCode(manual.value); manual.value = ''; }
    });

    if ('BarcodeDetector' in window) {
      try { detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'] }); } catch (e) { detector = null; }
    }

    function detectLoop() {
      if (closed) return;
      if (detector && video && video.readyState >= 2) {
        detector.detect(video).then(function (codes) {
          if (closed) return;
          if (codes && codes.length) {
            var val = codes[0].rawValue;
            if (val) { setError(''); handleCode(val); return; }
          }
          raf = requestAnimationFrame(detectLoop);
        }).catch(function () { raf = requestAnimationFrame(detectLoop); });
      } else {
        raf = requestAnimationFrame(detectLoop);
      }
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
        stream = s;
        video.srcObject = s;
        video.play().catch(function () {});
        backdrop.classList.add('is-open');
        raf = requestAnimationFrame(detectLoop);
      }).catch(function (err) {
        setError(L('تعذّر الوصول إلى الكاميرا. أدخل الرمز يدوياً.', 'Camera unavailable. Enter the code manually.'));
        backdrop.classList.add('is-open');
      });
    } else {
      setError(L('المتصفح لا يدعم الكاميرا. أدخل الرمز يدوياً.', 'Camera not supported. Enter the code manually.'));
      backdrop.classList.add('is-open');
    }

    requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
  }

  function esc(v) { var DS = window.DS; return DS.esc ? DS.esc(v) : String(v == null ? '' : v); }

  DS.openCameraScanner = openCameraScanner;
  DS.openBarcodeScanner = openCameraScanner;
})();
