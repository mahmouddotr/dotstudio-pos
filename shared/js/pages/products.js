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

    var dragon = DS.dragon ? dragonStrip(base) : '';

    var grid = list.length ? '<div class="product-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px">' +
      list.map(function (p) {
        return DS.productCard(p, {
          actions: '<div class="product-actions">' +
            '<button class="btn btn-sm ' + (p.featured ? 'btn-primary' : 'btn-secondary') + '" data-feat="' + esc(p.id) + '" data-tip="' + esc(DS.lang() === 'en' ? 'Featured' : 'مميز') + '" style="padding-inline:8px">⭐</button>' +
            '<button class="btn btn-sm ' + (p.best_seller ? 'btn-primary' : 'btn-secondary') + '" data-best="' + esc(p.id) + '" data-tip="' + esc(DS.lang() === 'en' ? 'Best seller' : 'الأكثر مبيعاً') + '" style="padding-inline:8px">🔥</button>' +
            '<button class="btn btn-secondary btn-sm" data-edit="' + esc(p.id) + '">' + icon('edit') + '<span>' + esc(t('edit')) + '</span></button>' +
            '<button class="btn btn-secondary btn-sm" data-label="' + esc(p.id) + '">' + icon('printer') + '<span>' + (DS.lang() === 'en' ? 'Print Label' : 'طباعة ليبل') + '</span></button>' +
            (isAdmin ? '<a class="btn btn-icon" href="' + url('customer/storefront.html?store=' + p.tenant_id) + '" target="_blank" rel="noopener" data-tip="' + esc(t('viewStore')) + '">' + icon('external') + '</a>' : '') +
            '<button class="btn btn-icon" style="color:var(--danger)" data-del="' + esc(p.id) + '" data-tip="' + esc(t('delete')) + '">' + icon('trash') + '</button></div>'
        });
      }).join('') + '</div>'
      : DS.empty({ icon: 'box', title: t('emptyProducts'), text: t('emptyProductsText'), cta: { label: t('addFirstProduct'), icon: 'plus', onclick: 'document.querySelector("[data-add]").click()' } });

    page.setContent(stats + dragon + toolbar + grid + '<div class="text-muted" style="font-size:11px;text-align:center">' + esc(t('showing')) + ' ' + list.length + ' ' + esc(t('of')) + ' ' + base.length + ' ' + esc(t('results')) + '</div>');
    bind();
  }

  function mini(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:24px">' + value + '</div></div>';
  }

  /* ── Dragon strip: dynamic pricing · expiry · wholesale ───────── */
  function dragonStrip(base) {
    var EN = DS.lang() === 'en';
    /* 3 · dynamic pricing */
    var priced = base.map(function (p) { return { p: p, s: DS.dragon.priceSuggestion(p) }; })
      .filter(function (x) { return x.s && x.s.direction !== 'flat'; })
      .sort(function (a, b) { return Math.abs(b.s.pct) - Math.abs(a.s.pct); })
      .slice(0, 3);
    /* 9 · expiry tracking */
    var expiring = base.map(function (p) { return { p: p, s: DS.dragon.expiryStatus(p) }; })
      .filter(function (x) { return x.s && (x.s.state === 'expired' || x.s.state === 'critical' || x.s.state === 'warning'); })
      .slice(0, 3);
    /* 6 · B2B wholesale */
    var wholesale = base.filter(function (p) { return (Number(p.stock) || 0) >= 10; }).slice(0, 2);

    function head(ico, title, sub) {
      return '<div class="dr-strip-head"><span class="dr-ico">' + icon(ico) + '</span>' +
        '<div><b>' + esc(title) + '</b><span>' + esc(sub) + '</span></div></div>';
    }

    var pricingCard = '<div class="card dr-strip-card">' + head('tag', EN ? 'Dynamic pricing' : 'التسعير الديناميكي',
      EN ? 'The price your demand supports' : 'السعر الذي يدعمه الطلب') +
      (priced.length ? '<div class="dr-strip-list">' + priced.map(function (x) {
        return '<div class="dr-strip-row"><b>' + esc(DS.loc(x.p, 'name')) + '</b>' +
          '<span>' + money(x.s.current) + ' → <strong class="is-' + x.s.direction + '">' + money(x.s.suggested) + '</strong></span>' +
          '<button class="btn btn-secondary btn-sm" data-dragon-price="' + esc(x.p.id) + '">' + esc(EN ? 'Apply' : 'تطبيق') + '</button></div>';
      }).join('') + '</div>' : '<p class="dr-hint">' + esc(EN ? 'Every price is in line with demand.' : 'كل الأسعار متوافقة مع الطلب.') + '</p>') +
      '</div>';

    var expiryCard = '<div class="card dr-strip-card">' + head('clock', EN ? 'Expiry tracking' : 'تتبع الصلاحية',
      EN ? 'Sell it before it dies' : 'بِيعه قبل أن يتهيّب') +
      (expiring.length ? '<div class="dr-strip-list">' + expiring.map(function (x) {
        return '<div class="dr-strip-row"><b>' + esc(DS.loc(x.p, 'name')) + '</b>' +
          '<span class="is-' + x.s.state + '">' + esc(x.s.label) + '</span>' +
          (x.s.discount ? '<button class="btn btn-secondary btn-sm" data-dragon-mark="' + esc(x.p.id) + '">−' + x.s.discount + '%</button>' : '<span></span>') + '</div>';
      }).join('') + '</div>' : '<p class="dr-hint">' + esc(EN ? 'Nothing is close to its expiry date.' : 'لا توجد منتجات قاربت على الانتهاء.') + '</p>') +
      '</div>';

    var wholesaleCard = '<div class="card dr-strip-card">' + head('users', EN ? 'B2B wholesale' : 'الجملة B2B',
      EN ? 'Volume pricing tiers' : 'أسعار الجملة حسب الكمية') +
      (wholesale.length ? '<div class="dr-strip-list">' + wholesale.map(function (p) {
        var tiers = DS.dragon.wholesaleTiers(p).filter(function (x) { return x.available; }).slice(0, 3);
        return '<div class="dr-strip-row"><b>' + esc(DS.loc(p, 'name')) + '</b>' +
          '<span>' + tiers.map(function (x) { return x.min + '+ → ' + money(x.price); }).join(' · ') + '</span><span></span></div>';
      }).join('') + '</div>' : '<p class="dr-hint">' + esc(EN ? 'Not enough stock for wholesale yet.' : 'المخزون لا يكفي للجملة بعد.') + '</p>') +
      '</div>';

    return '<div class="dr-strip">' + pricingCard + expiryCard + wholesaleCard + '</div>';
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
    DS.$$('[data-feat]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = DS.data.products.filter(function (x) { return x.id === b.getAttribute('data-feat'); })[0];
        if (!p) return;
        DS.data.updateProduct(p.id, { featured: !p.featured });
        DS.toast(p.featured ? (DS.lang() === 'en' ? 'Removed from Top rated' : 'أُزيل من الأعلى تقييماً') : (DS.lang() === 'en' ? 'Added to Top rated' : 'أُضيف للأعلى تقييماً'), 'success');
        render();
      });
    });
    DS.$$('[data-best]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = DS.data.products.filter(function (x) { return x.id === b.getAttribute('data-best'); })[0];
        if (!p) return;
        DS.data.updateProduct(p.id, { best_seller: !p.best_seller });
        DS.toast(p.best_seller ? (DS.lang() === 'en' ? 'Removed from Best sellers' : 'أُزيل من الأكثر مبيعاً') : (DS.lang() === 'en' ? 'Added to Best sellers' : 'أُضيف للأكثر مبيعاً'), 'success');
        render();
      });
    });
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

    /* Dragon · dynamic pricing apply */
    DS.$$('[data-dragon-price]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = allProducts().filter(function (x) { return x.id === b.getAttribute('data-dragon-price'); })[0];
        if (!p) return;
        var s = DS.dragon.priceSuggestion(p);
        if (!s) return;
        DS.dragon.applySuggestedPrice(p.id, s.suggested);
        DS.toast((DS.lang() === 'en' ? 'New price: ' : 'السعر الجديد: ') + money(s.suggested), 'success');
        render();
      });
    });
    /* Dragon · expiry markdown */
    DS.$$('[data-dragon-mark]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = allProducts().filter(function (x) { return x.id === b.getAttribute('data-dragon-mark'); })[0];
        if (!p) return;
        var st = DS.dragon.expiryStatus(p);
        var cut = Math.round((Number(p.price) || 0) * (1 - (st.discount || 10) / 100));
        DS.data.updateProduct(p.id, { price: cut });
        DS.toast((DS.lang() === 'en' ? 'Marked down to ' : 'تم الخصم إلى ') + money(cut), 'success');
        render();
      });
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
        '@page { size: 50mm 30mm; margin: 0; }\n' +
        '@media print { body * { visibility: hidden !important; } .label-container, .label-container * { visibility: visible !important; } .label-container { position: absolute !important; left: 0 !important; top: 0 !important; width: 50mm !important; height: 30mm !important; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; } .barcode-img { max-width: 80%; height: auto; } }';
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
        '<div class="label-container" id="printableProductLabel" style="width:50mm;height:30mm;background:#ffffff;color:#111111;border-radius:4px;padding:2mm 3mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;box-shadow:0 12px 32px rgba(0,0,0,0.5);font-family:Inter,-apple-system,sans-serif;">' +
          '<div class="label-store" style="font-size:9px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#333333;border-bottom:1px dashed #cccccc;padding-bottom:2px;width:100%;">' + esc(storeName) + '</div>' +
          '<div class="label-product" style="font-size:11px;font-weight:700;color:#000000;margin:2px 0 1px;line-height:1.2;max-height:26px;overflow:hidden;">' + esc(prodName) + '</div>' +
          '<div class="label-price" style="font-size:12px;font-weight:800;color:#000000;margin:1px 0;">' + esc(priceText) + '</div>' +
          '<div class="label-barcode-wrap" style="width:100%;display:flex;flex-direction:column;align-items:center;">' +
            '<svg id="modalLabelBarcodeSvg" class="label-barcode-svg" style="width:80%;max-height:26px;display:block;"></svg>' +
            '<div class="label-barcode-num" style="font-family:monospace;font-size:9px;font-weight:700;letter-spacing:0.12em;color:#000000;margin-top:2px;">' + esc(barcodeVal) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:12px;font-size:12px;color:var(--text-tertiary);">' +
        '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#82FF1F;"></span> Xprinter XP-235B · 50mm × 30mm Thermal Label</span>' +
      '</div>';

    DS.modal({
      title: DS.lang() === 'en' ? 'Print Product Label' : 'طباعة ليبل المنتج',
      sub: esc(prodName) + ' · 50×30mm',
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
