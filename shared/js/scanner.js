/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — HARDWARE BARCODE SCANNER (Keyboard Wedge)
   Listens for high-speed USB scanner keystrokes on cashier POS
   and customer storefront. Auto-detects products by barcode / id.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS = window.DS || {};

  function mountBarcodeScanner(opts) {
    opts = opts || {};

    /* 1. Ensure Hidden Input Exists */
    var hiddenInput = document.getElementById('barcodeScannerInput');
    if (!hiddenInput) {
      hiddenInput = document.createElement('input');
      hiddenInput.type = 'text';
      hiddenInput.id = 'barcodeScannerInput';
      hiddenInput.className = 'barcode-scanner-input';
      hiddenInput.setAttribute('autocomplete', 'off');
      hiddenInput.setAttribute('aria-hidden', 'true');
      hiddenInput.setAttribute('tabindex', '-1');
      hiddenInput.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:-9999px;top:-9999px;z-index:-1;width:1px;height:1px;';
      document.body.appendChild(hiddenInput);
    }

    /* 2. Remove any floating badge */
    var oldBadge = document.getElementById('scanner-badge') || document.getElementById('dsScannerBadge');
    if (oldBadge && oldBadge.parentNode) {
      oldBadge.parentNode.removeChild(oldBadge);
    }
    var badge = null;

    function flashBadge(success, text) {
      if (typeof opts.onFeedback === 'function') {
        opts.onFeedback(success, text);
      }
    }

    /* 3. Product Lookup & Processing */
    function processCode(raw) {
      var code = String(raw || '').trim();
      if (!code || code.length < 2) return;

      var prods = typeof opts.getProducts === 'function' ? opts.getProducts() : (DS.data ? DS.data.products : []);
      var found = null;

      // 1. Exact barcode match
      found = prods.filter(function (p) {
        return p && p.barcode && String(p.barcode).trim() === code;
      })[0];

      // 2. Exact product id match
      if (!found) {
        found = prods.filter(function (p) {
          return p && p.id && String(p.id).trim().toLowerCase() === code.toLowerCase();
        })[0];
      }

      // 3. Fallback SKU match
      if (!found) {
        found = prods.filter(function (p) {
          return p && p.sku && String(p.sku).trim().toLowerCase() === code.toLowerCase();
        })[0];
      }

      if (found) {
        flashBadge(true, DS.loc ? DS.loc(found, 'name') : (found.name_en || found.name));
        if (typeof opts.onFound === 'function') {
          opts.onFound(found);
        } else if (typeof opts.addToCart === 'function') {
          opts.addToCart(found.id);
        }
      } else {
        flashBadge(false);
        if (typeof opts.onNotFound === 'function') {
          opts.onNotFound(code);
        } else {
          DS.toast('Product Not Found', 'danger');
        }
      }
    }

    /* 4. Keystroke & Input Buffer Listeners */
    var buffer = '';
    var lastKeyTime = 0;
    var scanInProgress = false;

    // Direct listener on hidden input
    hiddenInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var val = hiddenInput.value || buffer;
        hiddenInput.value = '';
        buffer = '';
        processCode(val);
      }
    });

    hiddenInput.addEventListener('change', function () {
      if (hiddenInput.value) {
        var val = hiddenInput.value;
        hiddenInput.value = '';
        processCode(val);
      }
    });

    // Global listener on window
    window.addEventListener('keydown', function (e) {
      var target = e.target;
      var isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      var isOurHidden = target && target.id === 'barcodeScannerInput';

      var now = Date.now();
      var diff = now - lastKeyTime;
      lastKeyTime = now;

      // Enter key fires: check if we have a scanned code
      if (e.key === 'Enter') {
        var candidate = (hiddenInput && hiddenInput.value) || buffer;
        if (candidate && candidate.trim().length >= 2) {
          if (!isInput || isOurHidden || scanInProgress || diff < 55) {
            e.preventDefault();
            e.stopPropagation();
            processCode(candidate);
            buffer = '';
            scanInProgress = false;
            if (hiddenInput) hiddenInput.value = '';
            return;
          }
        }
        buffer = '';
        scanInProgress = false;
        return;
      }

      // Record character if printable
      if (e.key && e.key.length === 1) {
        if (diff < 50) {
          // Rapid typing: scanner detected!
          scanInProgress = true;
          buffer += e.key;
        } else {
          // Slow typing: reset buffer
          scanInProgress = false;
          buffer = e.key;
        }
      }
    }, true);

    // Keep hidden input focused when clicking neutral page areas
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      var isInteractive = t.closest('input, textarea, select, button, a, [contenteditable="true"]');
      if (!isInteractive && hiddenInput) {
        hiddenInput.focus();
      }
    });

    // Initial focus
    setTimeout(function () {
      if (hiddenInput && !document.activeElement) {
        hiddenInput.focus();
      }
    }, 200);

    return {
      hiddenInput: hiddenInput,
      badge: badge,
      processCode: processCode,
      flashBadge: flashBadge
    };
  }

  DS.mountBarcodeScanner = mountBarcodeScanner;
  DS.initScanner = mountBarcodeScanner;
})();
