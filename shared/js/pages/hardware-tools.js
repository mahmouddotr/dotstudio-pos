/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — System Tools
   One place for the physical shop hardware:
   barcode scanner · 60×40mm label designer · thermal invoice settings.
   Shared by admin, owner and cashier.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;
  var user = DS.session();
  if (!user) return;
  var EN = DS.lang() === 'en';

  var page = DS.shell.mount({
    roles: ['superadmin', 'subadmin', 'owner', 'cashier'],
    active: 'systemTools',
    title: t('systemTools'),
    eyebrow: EN ? 'Hardware' : 'الهاردوير',
    icon: 'settings',
    sub: t('systemToolsHint'),
    content: DS.skeleton.rows(6)
  });
  if (!page) return;

  var state = { tab: 'scanner', scans: [] };

  function products() {
    var list = DS.data.visibleProducts(user) || [];
    return list.filter(function (p) { return p.is_active !== false; });
  }
  function tenantName() {
    var tn = DS.data.tenantById(user.tenant_id);
    return tn ? DS.loc(tn, 'name') : (DS.data.tenants[0] ? DS.data.tenants[0].name : 'DotStudio');
  }
  function pname(p) { return EN ? (p.name_en || p.name) : p.name; }

  /* ─────────────────────────── TABS ─────────────────────────── */
  var TABS = [
    { key: 'scanner', label: t('scanBarcode'), icon: 'search' },
    { key: 'label', label: t('labelDesigner'), icon: 'tag' },
    { key: 'settings', label: t('invoiceSettings'), icon: 'receipt' }
  ];

  function tabsMarkup() {
    return '<div class="ht-tabs" role="tablist">' + TABS.map(function (tab) {
      return '<button type="button" class="ht-tab' + (state.tab === tab.key ? ' active' : '') + '" role="tab" data-tab="' + tab.key + '"' +
        ' aria-selected="' + (state.tab === tab.key) + '">' + icon(tab.icon) + '<span>' + esc(tab.label) + '</span></button>';
    }).join('') + '</div>';
  }

  /* ─────────────────────── 1 · SCANNER ─────────────────────── */
  function scannerMarkup() {
    var list = products();
    return '<section class="ht-panel" data-panel="scanner">' +
      '<div class="ht-scan">' +
        '<div class="ht-scan-copy">' +
          '<div class="ht-eyebrow">' + icon('search') + esc(EN ? 'Keyboard-wedge scanner' : 'ماسح ضوئي USB') + '</div>' +
          '<h2>' + esc(EN ? 'Scan a product barcode' : 'امسح باركود أي منتج') + '</h2>' +
          '<p>' + esc(EN
            ? 'Point the scanner at the barcode or type it below and press Enter. The catalogue has ' + list.length + ' products.'
            : 'وجّه الماسح نحو الباركود أو اكتبه بالأسفل واضغط Enter. الكتالوج به ' + list.length + ' منتج.') + '</p>' +
        '</div>' +
        '<div class="ht-scan-box">' +
          '<input class="input ht-scan-input" id="htScanInput" data-scan-input autofocus autocomplete="off" spellcheck="false" inputmode="numeric" placeholder="' + esc(EN ? 'Listening for a scan…' : 'جارٍ الاستماع للماسح…') + '">' +
          '<button type="button" class="btn btn-primary ht-scan-btn" data-scan-simulate>' + icon('sparkles') + esc(EN ? 'Simulate scan' : 'محاكاة مسح') + '</button>' +
        '</div>' +
        '<div class="ht-scan-hint">' + icon('shield') + esc(EN ? 'Press Enter after the code — no mouse needed.' : 'اضغط Enter بعد الكود — بدون استخدام الماوس.') + '</div>' +
      '</div>' +
      '<div class="ht-log-head"><div class="section-title">' + icon('activity') + esc(EN ? 'Scan log' : 'سجل المسح') + '</div>' +
        '<span class="badge neutral" data-scan-count>0</span></div>' +
      '<div class="ht-log" data-scan-log>' + scanLogMarkup() + '</div>' +
    '</section>';
  }

  function scanLogMarkup() {
    if (!state.scans.length) {
      return '<div class="ht-log-empty">' + icon('search') +
        '<b>' + esc(EN ? 'No scans yet' : 'لا يوجد مسح بعد') + '</b>' +
        '<span>' + esc(EN ? 'Every scan will appear here with product details.' : 'كل عملية مسح ستظهر هنا مع تفاصيل المنتج.') + '</span></div>';
    }
    return state.scans.map(function (s) {
      return '<div class="ht-log-row' + (s.ok ? '' : ' is-error') + '">' +
        '<span class="ht-log-ico">' + icon(s.ok ? 'checkCircle' : 'alert') + '</span>' +
        '<span class="ht-log-main"><b>' + esc(s.name) + '</b><span>' + esc(s.code) + '</span></span>' +
        '<span class="ht-log-price">' + (s.ok ? money(s.price) : '—') + '</span>' +
        '<span class="ht-log-time">' + esc(s.time) + '</span>' +
      '</div>';
    }).join('');
  }

  function timeNow() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ':' + ('0' + d.getSeconds()).slice(-2);
  }

  function findByCode(code) {
    var c = String(code || '').trim().toLowerCase();
    if (!c) return null;
    var list = products();
    return list.filter(function (p) {
      return (p.barcode && String(p.barcode).toLowerCase() === c) ||
        String(p.id).toLowerCase() === c ||
        (p.sku && String(p.sku).toLowerCase() === c);
    })[0] || null;
  }

  function scan(code) {
    code = String(code || '').trim();
    if (!code) return;
    var p = findByCode(code);
    state.scans.unshift(p
      ? { ok: true, name: pname(p), code: p.barcode || p.id, price: Number(p.price) || 0, time: timeNow() }
      : { ok: false, name: EN ? 'Unknown barcode' : 'باركود غير معروف', code: code, price: 0, time: timeNow() });
    if (state.scans.length > 40) state.scans.length = 40;
    if (p) DS.toast((EN ? 'Scanned: ' : 'تم مسح: ') + pname(p) + ' · ' + money(p.price), 'success');
    else DS.toast((EN ? 'Barcode not found: ' : 'الباركود غير موجود: ') + code, 'danger');
    refreshLog();
    var input = page.body.querySelector('[data-scan-input]');
    if (input) { input.value = ''; input.focus(); }
  }

  function refreshLog() {
    var host = page.body.querySelector('[data-scan-log]');
    if (host) host.innerHTML = scanLogMarkup();
    var count = page.body.querySelector('[data-scan-count]');
    if (count) count.textContent = state.scans.length;
  }

  /* ──────────────────── 2 · LABEL DESIGNER ──────────────────── */
  var label = { name: '', price: '', barcode: '' };
  function seedLabel() {
    var first = products()[0];
    label.name = first ? first.name : (EN ? 'Product name' : 'اسم المنتج');
    label.price = first ? first.price : 100;
    label.barcode = first ? (first.barcode || first.id) : '6281000000001';
  }

  function labelMarkup() {
    return '<section class="ht-panel" data-panel="label">' +
      '<div class="ht-label-grid">' +
        '<div class="ht-label-form">' +
          '<div class="ht-eyebrow">' + icon('tag') + esc(EN ? '60 × 40 mm sticker' : 'استيكر 60 × 40 مم') + '</div>' +
          '<h2>' + esc(t('labelDesigner')) + '</h2>' +
          '<p class="ht-muted">' + esc(EN ? 'Type the details and print directly to a label printer.' : 'اكتب البيانات واطبعها مباشرة على طابعة الاستيكرات.') + '</p>' +
          '<div class="field"><label>' + esc(t('labelName')) + '</label>' +
            '<input class="input" data-label="name" maxlength="40" value="' + esc(label.name) + '"></div>' +
          '<div class="field"><label>' + esc(t('labelPrice')) + '</label>' +
            '<input class="input" data-label="price" type="number" min="0" step="0.5" value="' + esc(label.price) + '"></div>' +
          '<div class="field"><label>' + esc(t('labelBarcode')) + '</label>' +
            '<input class="input" data-label="barcode" dir="ltr" value="' + esc(label.barcode) + '"></div>' +
          '<button type="button" class="btn btn-primary" data-print-label style="width:100%;min-height:46px">' + icon('printer') + esc(t('printLabel')) + '</button>' +
        '</div>' +
        '<div class="ht-label-stage">' +
          '<div class="ht-label-caption">' + esc(EN ? 'Live preview' : 'معاينة مباشرة') + ' · 60 × 40 mm</div>' +
          '<div class="label-preview" id="htLabelPreview">' +
            '<div class="lp-name" data-lp="name">' + esc(label.name) + '</div>' +
            '<div class="lp-price" data-lp="price">' + esc(money(label.price)) + '</div>' +
            '<div class="lp-barcode" data-lp="barcode"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function drawBarcode() {
    var host = page.body.querySelector('[data-lp="barcode"]');
    if (!host) return;
    var code = String(label.barcode || '').trim() || '0000000000';
    host.innerHTML = '';
    if (window.JsBarcode) {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      host.appendChild(svg);
      try {
        window.JsBarcode(svg, code, {
          format: 'CODE128', width: 1.7, height: 46, displayValue: true,
          fontSize: 11, margin: 0, lineColor: '#000000', background: '#FFFFFF'
        });
        return;
      } catch (e) {
        host.innerHTML = '';
      }
    }
    /* Offline fallback: deterministic CODE128-looking bars. */
    var bars = '';
    var seed = 0;
    for (var i = 0; i < code.length; i++) seed = (seed * 31 + code.charCodeAt(i)) % 9973;
    for (var b = 0; b < 58; b++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      var w = (seed % 3) + 1;
      if ((seed >> 3) % 2 === 0) bars += '<i style="width:' + w + 'px"></i>';
      else bars += '<span style="width:' + w + 'px"></span>';
    }
    host.innerHTML = '<div class="lp-bars">' + bars + '</div><div class="lp-code">' + esc(code) + '</div>';
  }

  function syncLabel() {
    var n = page.body.querySelector('[data-lp="name"]');
    var p = page.body.querySelector('[data-lp="price"]');
    if (n) n.textContent = label.name || (EN ? 'Product name' : 'اسم المنتج');
    if (p) p.textContent = money(label.price || 0);
    drawBarcode();
  }

  /* ──────────────── 3 · INVOICE SETTINGS ──────────────── */
  function stored(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }

  function settingsMarkup() {
    var name = stored('store_name', tenantName());
    var footer = stored('footer_text', EN ? 'Thank you for shopping with us' : 'شكراً لتعاملكم معنا');
    var logo = stored('store_logo', '');
    return '<section class="ht-panel" data-panel="settings">' +
      '<div class="ht-label-grid">' +
        '<div class="ht-label-form">' +
          '<div class="ht-eyebrow">' + icon('receipt') + esc(EN ? 'Thermal 80mm invoice' : 'فاتورة حرارية 80 مم') + '</div>' +
          '<h2>' + esc(t('invoiceSettings')) + '</h2>' +
          '<p class="ht-muted">' + esc(EN ? 'These values are printed on every receipt.' : 'هذه البيانات تُطبع على كل فاتورة.') + '</p>' +
          '<div class="field"><label>' + esc(t('storeName')) + '</label>' +
            '<input class="input" data-set="store_name" value="' + esc(name) + '"></div>' +
          '<div class="field"><label>' + esc(t('footerText')) + '</label>' +
            '<input class="input" data-set="footer_text" value="' + esc(footer) + '"></div>' +
          '<div class="field"><label>' + esc(t('storeLogo')) + '</label>' +
            '<div class="ht-logo-row">' +
              '<span class="ht-logo-preview" data-logo-preview>' + (logo ? '<img src="' + esc(logo) + '" alt="">' : icon('image')) + '</span>' +
              '<label class="btn btn-secondary btn-sm ht-logo-btn">' + icon('download') + esc(t('uploadLogo')) +
                '<input type="file" accept="image/*" data-logo-input hidden></label>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-logo-clear>' + icon('trash') + esc(t('delete')) + '</button>' +
            '</div></div>' +
          '<button type="button" class="btn btn-primary" data-save-settings style="width:100%;min-height:46px">' + icon('check') + esc(t('save')) + '</button>' +
        '</div>' +
        '<div class="ht-label-stage">' +
          '<div class="ht-label-caption">' + esc(t('invoicePreview')) + ' · 80 mm</div>' +
          '<div class="ht-invoice-preview">' +
            '<div class="hip-logo" data-hip-logo>' + (logo ? '<img src="' + esc(logo) + '" alt="">' : '') + '</div>' +
            '<div class="hip-name" data-hip-name>' + esc(name) + '</div>' +
            '<div class="hip-meta">' + esc(EN ? 'TAX RECEIPT · 80mm' : 'فاتورة ضريبية · 80 مم') + '</div>' +
            '<div class="hip-rule"></div>' +
            '<div class="hip-row"><span>' + esc(EN ? 'Order' : 'الطلب') + '</span><span>ORD-1042</span></div>' +
            '<div class="hip-row"><span>' + esc(EN ? 'Item' : 'منتج') + '</span><span>' + esc(EN ? 'Sample item' : 'منتج تجريبي') + '</span></div>' +
            '<div class="hip-rule dashed"></div>' +
            '<div class="hip-row total"><span>' + esc(t('total')) + '</span><span>' + money(125) + '</span></div>' +
            '<div class="hip-footer" data-hip-footer>' + esc(footer) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* ─────────────────────────── RENDER ─────────────────────────── */
  function contentMarkup() {
    if (state.tab === 'label') return labelMarkup();
    if (state.tab === 'settings') return settingsMarkup();
    return scannerMarkup();
  }

  function render() {
    page.setContent('<div class="ht-page">' + tabsMarkup() + contentMarkup() + '</div>');
    bind();
    if (state.tab === 'label') { syncLabel(); }
    if (state.tab === 'scanner') {
      var input = page.body.querySelector('[data-scan-input]');
      if (input) setTimeout(function () { try { input.focus(); } catch (e) {} }, 60);
    }
  }

  function bind() {
    var body = page.body;
    DS.$$('[data-tab]', body).forEach(function (b) {
      b.addEventListener('click', function () {
        state.tab = b.getAttribute('data-tab');
        render();
      });
    });

    /* Scanner */
    var input = body.querySelector('[data-scan-input]');
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); scan(input.value); }
    });
    var sim = body.querySelector('[data-scan-simulate]');
    if (sim) sim.addEventListener('click', function () {
      var list = products();
      if (!list.length) { DS.toast(t('noData'), 'warning'); return; }
      var p = list[Math.floor(Math.random() * list.length)];
      var code = p.barcode || p.id;
      if (input) input.value = code;
      scan(code);
    });

    /* Label designer */
    DS.$$('[data-label]', body).forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.getAttribute('data-label');
        label[key] = el.value;
        syncLabel();
      });
    });
    var printBtn = body.querySelector('[data-print-label]');
    if (printBtn) printBtn.addEventListener('click', function () {
      DS.toast(EN ? 'Sending label to printer…' : 'جارٍ إرسال الاستيكر للطابعة…', 'success');
      setTimeout(function () { window.print(); }, 220);
    });

    /* Invoice settings */
    DS.$$('[data-set]', body).forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.getAttribute('data-set');
        if (key === 'store_name') {
          var n = body.querySelector('[data-hip-name]'); if (n) n.textContent = el.value;
        }
        if (key === 'footer_text') {
          var f = body.querySelector('[data-hip-footer]'); if (f) f.textContent = el.value;
        }
      });
    });
    var logoInput = body.querySelector('[data-logo-input]');
    if (logoInput) logoInput.addEventListener('change', function () {
      var file = logoInput.files && logoInput.files[0];
      if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) { DS.toast(EN ? 'Logo must be under 1.5 MB' : 'حجم الشعار يجب أن يكون أقل من 1.5 ميجا', 'error'); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        var data = e.target.result;
        try { localStorage.setItem('store_logo', data); } catch (err) { DS.toast(EN ? 'Storage is full' : 'مساحة التخزين ممتلئة', 'error'); return; }
        var prev = body.querySelector('[data-logo-preview]');
        if (prev) prev.innerHTML = '<img src="' + esc(data) + '" alt="">';
        var hip = body.querySelector('[data-hip-logo]');
        if (hip) hip.innerHTML = '<img src="' + esc(data) + '" alt="">';
        DS.toast(EN ? 'Logo uploaded' : 'تم رفع الشعار', 'success');
      };
      reader.readAsDataURL(file);
    });
    var logoClear = body.querySelector('[data-logo-clear]');
    if (logoClear) logoClear.addEventListener('click', function () {
      try { localStorage.removeItem('store_logo'); } catch (e) {}
      var prev = body.querySelector('[data-logo-preview]'); if (prev) prev.innerHTML = icon('image');
      var hip = body.querySelector('[data-hip-logo]'); if (hip) hip.innerHTML = '';
      DS.toast(EN ? 'Logo removed' : 'تم حذف الشعار', 'success');
    });
    var save = body.querySelector('[data-save-settings]');
    if (save) save.addEventListener('click', function () {
      try {
        localStorage.setItem('store_name', (body.querySelector('[data-set="store_name"]').value || '').trim());
        localStorage.setItem('footer_text', (body.querySelector('[data-set="footer_text"]').value || '').trim());
      } catch (e) {}
      DS.toast(t('savedSettings'), 'success');
    });
  }

  seedLabel();
  render();
})();
