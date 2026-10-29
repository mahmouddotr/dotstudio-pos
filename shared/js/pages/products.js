/* DotStudio® POS — Products (admin + owner) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url, money = DS.money;
  var user = DS.session();
  if (!user) return;
  var isAdmin = DS.data.isAdmin(user);
  var tenantId = isAdmin ? '' : user.tenant_id;
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : ['owner'],
    permission: isAdmin && user.role === 'subadmin' ? 'products' : null,
    active: 'products',
    title: t('products'),
    eyebrow: isAdmin ? t('catalog') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'box',
    sub: DS.lang() === 'en' ? 'Manage your catalogue, pricing and stock levels.' : 'أدر كتالوج منتجاتك وأسعارها ومخزونها.',
    actions: '<button class="btn btn-primary" data-add>' + icon('plus') + esc(t('addProduct')) + '</button>',
    content: DS.skeleton.grid(8)
  });
  if (!page) return;

  var state = { q: '', cat: '', store: isAdmin ? '' : tenantId, stock: '' };

  function allProducts() {
    return DS.data.visibleProducts(user, state.store || undefined);
  }
  function categories(list) {
    var out = [];
    list.forEach(function (p) { var cat = DS.loc(p, 'category'); if (cat && out.indexOf(cat) === -1) out.push(cat); });
    return out;
  }

  function render() {
    var base = allProducts();
    var q = state.q.trim().toLowerCase();
    var list = base.filter(function (p) {
      if (q && (p.name + ' ' + (p.name_en || '') + ' ' + (p.sku || '')).toLowerCase().indexOf(q) === -1) return false;
      if (state.cat && DS.loc(p, 'category') !== state.cat) return false;
      if (state.stock === 'low' && p.stock > p.min_stock) return false;
      if (state.stock === 'out' && p.stock > 0) return false;
      return true;
    });
    var low = base.filter(function (p) { return p.stock <= p.min_stock; }).length;
    var out = base.filter(function (p) { return p.stock <= 0; }).length;
    var value = base.reduce(function (s, p) { return s + p.stock * p.price; }, 0);

    var cats = categories(base);
    var toolbar = '<div class="card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div class="search-mini" style="flex:1;min-width:200px">' + icon('search') + '<input data-search placeholder="' + esc(t('searchProduct')) + '" value="' + esc(state.q) + '"></div>' +
      (isAdmin ? '<select class="select" data-store style="width:auto;min-width:150px"><option value="">' + esc(t('allStores')) + '</option>' +
        DS.data.tenants.map(function (tn) { return '<option value="' + tn.id + '"' + (state.store === tn.id ? ' selected' : '') + '>' + esc(tn.name) + '</option>'; }).join('') + '</select>' : '') +
      '<select class="select" data-cat style="width:auto;min-width:140px"><option value="">' + esc(t('all')) + ' ' + esc(t('category')) + '</option>' +
        cats.map(function (c) { return '<option value="' + esc(c) + '"' + (state.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<div class="segmented" data-stock><button class="' + (!state.stock ? 'active' : '') + '" data-s="">' + esc(t('all')) + '</button><button class="' + (state.stock === 'low' ? 'active' : '') + '" data-s="low">' + esc(t('lowStock')) + '</button><button class="' + (state.stock === 'out' ? 'active' : '') + '" data-s="out">' + esc(t('out')) + '</button></div>' +
      '<button class="btn btn-secondary btn-sm" data-export>' + icon('download') + esc(t('exportCsv')) + '</button>' +
      '</div></div>';

    var stats = '<div class="kpi-grid">' +
      mini(t('products'), base.length, 'box', 'lime') +
      mini(t('lowStock'), low, 'alert', low ? 'orange' : 'green') +
      mini(t('outOfStock'), out, 'x', out ? 'red' : 'green') +
      mini(DS.lang() === 'en' ? 'Stock value' : 'قيمة المخزون', money(value), 'wallet', 'info') + '</div>';

    var grid = list.length ? '<div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px">' +
      list.map(function (p) {
        return DS.productCard(p, {
          actions: '<div class="product-actions">' +
            '<button class="btn btn-secondary btn-sm" data-edit="' + esc(p.id) + '">' + icon('edit') + '<span>' + esc(t('edit')) + '</span></button>' +
            '<button class="btn btn-secondary btn-sm" data-label="' + esc(p.id) + '">' + icon('printer') + '<span>' + (DS.lang() === 'en' ? 'Print Label' : 'طباعة ليبل') + '</span></button>' +
            (isAdmin ? '<a class="btn btn-icon" href="' + url('customer/storefront.html?store=' + p.tenant_id) + '" target="_blank" rel="noopener" data-tip="' + esc(t('viewStore')) + '">' + icon('external') + '</a>' : '') +
            '<button class="btn btn-icon" style="color:var(--danger)" data-del="' + esc(p.id) + '" data-tip="' + esc(t('delete')) + '">' + icon('trash') + '</button></div>'
        });
      }).join('') + '</div>'
      : DS.empty({ icon: 'box', title: t('emptyProducts'), text: t('emptyProductsText'), cta: { label: t('addFirstProduct'), icon: 'plus', onclick: 'document.querySelector("[data-add]").click()' } });

    page.setContent(stats + toolbar + grid + '<div class="text-muted" style="font-size:11px;text-align:center">' + esc(t('showing')) + ' ' + list.length + ' ' + esc(t('of')) + ' ' + base.length + ' ' + esc(t('results')) + '</div>');
    bind();
  }

  function mini(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:24px">' + value + '</div></div>';
  }

  function bind() {
    var s = page.body.querySelector('[data-search]');
    if (s) s.addEventListener('input', DS.debounce(function () { state.q = s.value; render(); }, 160));
    var cat = page.body.querySelector('[data-cat]');
    if (cat) cat.addEventListener('change', function () { state.cat = cat.value; render(); });
    var st = page.body.querySelector('[data-store]');
    if (st) st.addEventListener('change', function () { state.store = st.value; render(); });
    DS.$$('[data-s]', page.body).forEach(function (b) { b.addEventListener('click', function () { state.stock = b.getAttribute('data-s'); render(); }); });
    DS.$$('[data-edit]', page.body).forEach(function (b) { b.addEventListener('click', function () {
      var p = DS.data.products.filter(function (x) { return x.id === b.getAttribute('data-edit'); })[0];
      if (p) DS.productModal({ product: p, tenantId: p.tenant_id, onSave: render });
    }); });
    DS.$$('[data-label]', page.body).forEach(function (b) { b.addEventListener('click', function () {
      var p = DS.data.products.filter(function (x) { return x.id === b.getAttribute('data-label'); })[0];
      if (p) openLabelModal(p);
    }); });
    DS.$$('[data-del]', page.body).forEach(function (b) { b.addEventListener('click', function () {
      DS.confirm({ title: t('confirmDelete'), text: t('confirmDeleteText'), danger: true }).then(function (ok) {
        if (!ok) return;
        DS.data.deleteProduct(b.getAttribute('data-del'));
        DS.toast(t('deleted'), 'success');
        render();
      });
    }); });
    var ex = page.body.querySelector('[data-export]');
    if (ex) ex.addEventListener('click', function () {
      var rows = [['Name', 'SKU', 'Category', 'Price', 'Cost', 'Stock', 'Min stock']];
      allProducts().forEach(function (p) { rows.push([p.name, p.sku, p.category, p.price, p.cost, p.stock, p.min_stock]); });
      DS.download('dotstudio-products.csv', DS.csv(rows));
      DS.toast(t('saved'), 'success');
    });
  }

  DS.$$('[data-add]').forEach(function (b) { b.addEventListener('click', function () {
    DS.productModal({ tenantId: state.store || (isAdmin ? DS.data.tenants[0].id : user.tenant_id), onSave: render });
  }); });

  /* ──────────────────── PRODUCT LABEL MODAL (XP-235B) ──────────────────── */
  function ensurePrintStyle(mode) {
    var el = document.getElementById('dsActivePrintStyle');
    if (!el) {
      el = document.createElement('style');
      el.id = 'dsActivePrintStyle';
      document.head.appendChild(el);
    }
    if (mode === 'label') {
      el.textContent =
        '@page { size: 60mm 40mm; margin: 0; }\n' +
        '@media print { body * { visibility: hidden !important; } .label-container, .label-container * { visibility: visible !important; } .label-container { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; margin: 0 !important; } }';
    }
  }

  function drawFallbackBarcodeSvg(svg, val) {
    if (!svg) return;
    svg.setAttribute('viewBox', '0 0 180 40');
    svg.setAttribute('preserveAspectRatio', 'none');
    var bars = '';
    var hash = 0;
    for (var i = 0; i < val.length; i++) hash = ((hash << 5) - hash) + val.charCodeAt(i);
    var x = 6;
    while (x < 174) {
      var w = 1 + (Math.abs(hash = (hash * 9301 + 49297) % 233280) % 3);
      bars += '<rect x="' + x + '" y="0" width="' + w + '" height="40" fill="#000"/>';
      x += w + 1 + (Math.abs(hash = (hash * 9301 + 49297) % 233280) % 2);
    }
    svg.innerHTML = bars;
  }

  function renderBarcodeIntoSvg(val) {
    var svg = document.getElementById('modalLabelBarcodeSvg');
    if (!svg) return;
    function tryJsBarcode() {
      if (window.JsBarcode) {
        try {
          JsBarcode(svg, String(val), {
            format: 'CODE128',
            width: 1.8,
            height: 38,
            displayValue: false,
            margin: 0
          });
          return true;
        } catch (e) {
          console.warn('JsBarcode render error', e);
        }
      }
      return false;
    }
    if (!tryJsBarcode()) {
      drawFallbackBarcodeSvg(svg, val);
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';
      s.onload = function () { tryJsBarcode(); };
      document.head.appendChild(s);
    }
  }

  function openLabelModal(p) {
    ensurePrintStyle('label');
    var tenant = DS.data.tenantById(p.tenant_id) || (user.tenant_id && DS.data.tenantById(user.tenant_id)) || {};
    var storeName = DS.loc(tenant, 'name') || tenant.name || 'DotStudio Store';
    var prodName = DS.loc(p, 'name') || p.name;
    var priceText = money(p.price);
    var barcodeVal = p.barcode || ('628' + String(p.id).replace(/\D/g, '') + '00000000').slice(0, 12);

    var labelBody =
      '<div class="label-preview-wrapper" style="display:flex;justify-content:center;align-items:center;padding:18px;background:rgba(0,0,0,0.45);border-radius:14px;border:1px solid rgba(255,255,255,0.08);">' +
        '<div class="label-container" id="printableProductLabel" style="width:60mm;min-height:40mm;background:#ffffff;color:#111111;border-radius:6px;padding:3mm 4mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;align-items:center;text-align:center;box-shadow:0 12px 32px rgba(0,0,0,0.5);font-family:Inter,-apple-system,sans-serif;">' +
          '<div class="label-store" style="font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#333333;border-bottom:1px dashed #cccccc;padding-bottom:2px;width:100%;">' + esc(storeName) + '</div>' +
          '<div class="label-product" style="font-size:12.5px;font-weight:700;color:#000000;margin:3px 0 1px;line-height:1.25;max-height:30px;overflow:hidden;">' + esc(prodName) + '</div>' +
          '<div class="label-price" style="font-size:16px;font-weight:800;color:#000000;margin:1px 0;">' + esc(priceText) + '</div>' +
          '<div class="label-barcode-wrap" style="width:100%;display:flex;flex-direction:column;align-items:center;">' +
            '<svg id="modalLabelBarcodeSvg" class="label-barcode-svg" style="width:100%;max-height:38px;display:block;"></svg>' +
            '<div class="label-barcode-num" style="font-family:monospace;font-size:11px;font-weight:700;letter-spacing:0.12em;color:#000000;margin-top:2px;">' + esc(barcodeVal) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:12px;font-size:12px;color:var(--text-tertiary);">' +
        '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#82FF1F;"></span> Xprinter XP-235B · 60mm × 40mm Thermal Label</span>' +
      '</div>';

    DS.modal({
      title: DS.lang() === 'en' ? 'Print Product Label' : 'طباعة ليبل المنتج',
      sub: esc(prodName) + ' · 60×40mm',
      body: labelBody,
      actions: [
        { label: t('close'), variant: 'btn-secondary' },
        {
          label: DS.lang() === 'en' ? 'Print Label' : 'طباعة ليبل',
          variant: 'btn-primary',
          icon: icon('printer'),
          onClick: function () {
            ensurePrintStyle('label');
            window.print();
          }
        }
      ],
      onMount: function () {
        renderBarcodeIntoSvg(barcodeVal);
      }
    });
  }

  window.addEventListener('ds:data-changed', render);
  setTimeout(render, 170);
})();
