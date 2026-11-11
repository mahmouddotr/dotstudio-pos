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
