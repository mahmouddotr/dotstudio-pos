/* DotStudio® POS — Dashboard (admin + owner) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url, money = DS.money;

  var user = DS.session();
  if (!user) return;
  var isAdmin = user.role === 'superadmin' || user.role === 'subadmin';
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : ['owner'],
    active: 'dashboard',
    title: isAdmin ? t('platformOverview') : t('dashboard'),
    eyebrow: isAdmin ? t('admin') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'dashboard',
    sub: isAdmin ? (DS.lang() === 'en' ? 'A live pulse of every store, order and delivery on the platform.' : 'نبض لحظي لكل متجر وطلب وتوصيل على المنصة.')
      : (DS.lang() === 'en' ? 'Your store performance, orders and stock at a glance.' : 'أداء متجرك وطلباتك ومخزونك في شاشة واحدة.'),
    content: '<div class="kpi-grid">' + DS.skeleton.cards(4) + '</div><div class="two-col">' + DS.skeleton.rows(5) + DS.skeleton.rows(4) + '</div>'
  });
  if (!page) return;
  document.body.classList.add('saleor', isAdmin ? 'saleor-admin' : 'saleor-owner');
  var range = 7;
  var fleet = null;
  var view = { tab: 'overview', branch: 'main' };

  /* ───────────────────────── TASK 4 · BRANCHES ─────────────────────────
     Visual multi-branch management: branches are stored per tenant in
     localStorage and orders are deterministically assigned to one of them
     so every branch shows a different, stable slice of the stats. */
  var BRANCH_KEY = 'ds_branches_' + (user.tenant_id || 'store');
  function defaultBranches() {
    var tn = DS.data.tenantById(user.tenant_id) || {};
    return [
      { id: 'main', name: DS.lang() === 'en' ? 'Main branch' : 'الفرع الرئيسي', name_en: 'Main branch', address: tn.address || (DS.lang() === 'en' ? 'Head office' : 'المقر الرئيسي'), created_at: new Date().toISOString() },
      { id: 'smouha', name: 'فرع سموحة', name_en: 'Smouha branch', address: DS.lang() === 'en' ? 'Smouha, Alexandria' : 'سموحة، الإسكندرية', created_at: new Date().toISOString() }
    ];
  }
  function branches() {
    var list = DS.store.get(BRANCH_KEY, null);
    if (!Array.isArray(list) || !list.length) {
      list = defaultBranches();
      DS.store.set(BRANCH_KEY, list);
    }
    if (!list.some(function (b) { return b.id === view.branch; })) view.branch = list[0].id;
    return list;
  }
  function branchName(b) { return DS.lang() === 'en' ? (b.name_en || b.name) : (b.name || b.name_en); }
  function hashId(id) {
    var s = String(id || ''), h = 0;
    for (var i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function ordersForBranch(branchId) {
    var list = branches();
    var all = DS.data.ordersByTenant ? DS.data.ordersByTenant(user.tenant_id) : DS.data.visibleOrders(user);
    var idx = Math.max(0, list.map(function (b) { return b.id; }).indexOf(branchId));
    return all.filter(function (o) { return hashId(o.id) % list.length === idx; });
  }
  function branchStats(list) {
    var revenue = DS.data.revenueOf ? DS.data.revenueOf(list) : list.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
    return {
      orders: list.length,
      revenue: revenue,
      active: list.filter(function (o) { return DS.isActiveOrderStatus(o.status); }).length,
      delivered: list.filter(function (o) { return o.status === 'delivered'; }).length,
      avg: list.length ? revenue / list.length : 0
    };
  }

  /* ─────────── PRO MAX · MULTI-BRANCH STOCK SYNC ───────────
     A visual per-branch stock ledger in localStorage. Transfers move
     units between branches (10 by default) without touching the global
     product stock — a safe, instant simulation of a real sync engine. */
  var BRANCH_STOCK_KEY = 'ds_branch_stock_' + (user.tenant_id || 'store');
  var TRANSFER_KEY = 'ds_branch_transfers_' + (user.tenant_id || 'store');

  function branchStockMap() {
    var list = branches();
    var products = DS.data.visibleProducts(user);
    var raw = DS.store.get(BRANCH_STOCK_KEY, null);
    if (!raw || typeof raw !== 'object') raw = {};
    var changed = false;
    list.forEach(function (b, bi) {
      if (!raw[b.id] || typeof raw[b.id] !== 'object') { raw[b.id] = {}; changed = true; }
      products.forEach(function (p) {
        if (raw[b.id][p.id] == null) {
          var total = Number(p.stock) || 0;
          var base = Math.floor(total / list.length);
          var extra = bi === 0 ? total - base * list.length : 0;
          raw[b.id][p.id] = base + extra;
          changed = true;
        }
      });
    });
    if (changed) DS.store.set(BRANCH_STOCK_KEY, raw);
    return raw;
  }
  function branchStockIn(branchId, productId) {
    var map = branchStockMap();
    return Number((map[branchId] || {})[productId]) || 0;
  }
  function distributionMarkup(productId) {
    var map = branchStockMap();
    return branches().map(function (b) {
      return '<span class="pm-dist-chip"><b>' + esc(branchName(b)) + '</b><i>' + (Number((map[b.id] || {})[productId]) || 0) + '</i></span>';
    }).join('');
  }
  function transferStock(productId, fromId, toId, qty) {
    if (!productId || fromId === toId || !(qty > 0)) return false;
    var map = branchStockMap();
    var available = Number((map[fromId] || {})[productId]) || 0;
    if (qty > available) return false;
    map[fromId][productId] = available - qty;
    map[toId][productId] = (Number((map[toId] || {})[productId]) || 0) + qty;
    DS.store.set(BRANCH_STOCK_KEY, map);
    var log = DS.store.get(TRANSFER_KEY, []);
    if (!Array.isArray(log)) log = [];
    log.unshift({ product_id: productId, from: fromId, to: toId, qty: qty, at: new Date().toISOString() });
    DS.store.set(TRANSFER_KEY, log.slice(0, 12));
    return true;
  }

  function branchTransferMarkup() {
    var EN = DS.lang() === 'en';
    var list = branches();
    var products = DS.data.visibleProducts(user);
    if (list.length < 2 || !products.length) {
      return '<section class="pm-card pm-transfer"><header class="pm-card-head">' +
        '<span class="pm-card-ico">' + icon('truck') + '</span>' +
        '<div><div class="pm-kicker">' + esc(EN ? 'Multi-branch sync' : 'مزامنة الفروع') + '</div>' +
          '<h2>' + esc(EN ? 'Transfer stock' : 'نقل المخزون') + '</h2></div></header>' +
        '<div class="pm-empty">' + icon('store') +
          '<b>' + esc(EN ? 'Add a second branch first' : 'أضف فرعاً ثانياً أولاً') + '</b>' +
          '<span>' + esc(EN ? 'Stock transfers need at least two branches.' : 'نقل المخزون يحتاج فرعين على الأقل.') + '</span></div></section>';
    }
    var selectedId = products[0].id;
    var productOpts = products.slice(0, 80).map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(EN ? (p.name_en || p.name) : p.name) + ' · ' + esc(p.sku || '') + '</option>';
    }).join('');
    var branchOpts = list.map(function (b) {
      return '<option value="' + esc(b.id) + '">' + esc(branchName(b)) + '</option>';
    }).join('');
    var fromOpts = list.map(function (b, i) {
      return '<option value="' + esc(b.id) + '"' + (i === 0 ? ' selected' : '') + '>' + esc(branchName(b)) + '</option>';
    }).join('');
    var toOpts = list.map(function (b, i) {
      return '<option value="' + esc(b.id) + '"' + (i === 1 ? ' selected' : '') + '>' + esc(branchName(b)) + '</option>';
    }).join('');
    var log = DS.store.get(TRANSFER_KEY, []);
    if (!Array.isArray(log)) log = [];
    var logRows = log.slice(0, 4).map(function (t) {
      var p = products.filter(function (x) { return x.id === t.product_id; })[0] || {};
      var fromB = list.filter(function (b) { return b.id === t.from; })[0];
      var toB = list.filter(function (b) { return b.id === t.to; })[0];
      return '<div class="pm-transfer-log-row">' + icon('truck') +
        '<span>' + esc(EN
          ? 'Moved ' + t.qty + ' × ' + (p.name_en || p.name || '') + ' · ' + (fromB ? branchName(fromB) : t.from) + ' → ' + (toB ? branchName(toB) : t.to)
          : 'نقل ' + t.qty + ' × ' + (p.name || '') + ' · ' + (fromB ? branchName(fromB) : t.from) + ' ← ' + (toB ? branchName(toB) : t.to)) +
        '</span><i>' + esc(DS.timeAgo(t.at)) + '</i></div>';
    }).join('');
    return '<section class="pm-card pm-transfer">' +
      '<header class="pm-card-head">' +
        '<span class="pm-card-ico">' + icon('truck') + '</span>' +
        '<div><div class="pm-kicker">' + esc(EN ? 'Multi-branch sync' : 'مزامنة الفروع') + '</div>' +
          '<h2>' + esc(EN ? 'Transfer stock between branches' : 'نقل المخزون بين الفروع') + '</h2></div>' +
        '<span class="pm-pill lime">' + icon('refresh') + esc(EN ? 'Live' : 'لحظي') + '</span>' +
      '</header>' +
      '<div class="pm-transfer-grid">' +
        '<div class="field"><label>' + esc(EN ? 'Product' : 'المنتج') + '</label><select class="select" data-tr-product>' + productOpts + '</select></div>' +
        '<div class="field"><label>' + esc(EN ? 'From branch' : 'من فرع') + '</label><select class="select" data-tr-from>' + fromOpts + '</select></div>' +
        '<div class="field"><label>' + esc(EN ? 'To branch' : 'إلى فرع') + '</label><select class="select" data-tr-to>' + toOpts + '</select></div>' +
        '<div class="field"><label>' + esc(EN ? 'Quantity' : 'الكمية') + '</label><input class="input" type="number" min="1" step="1" value="10" data-tr-qty dir="ltr"></div>' +
        '<button type="button" class="btn btn-primary pm-transfer-btn" data-branch-transfer>' + icon('truck') + esc(EN ? 'Transfer' : 'نقل الآن') + '</button>' +
      '</div>' +
      '<div class="pm-transfer-dist" data-tr-dist>' + distributionMarkup(selectedId) + '</div>' +
      (logRows ? '<div class="pm-transfer-log">' + logRows + '</div>' : '') +
    '</section>';
  }

  /* ────────────────────── TASK 2 · AI SALES FORECAST ───────────────────
     Reads the real order history for the tenant, ranks items by units
     sold and forecasts stock pressure. No backend, no external calls. */
  function aiForecast() {
    var orders = DS.data.ordersByTenant ? DS.data.ordersByTenant(user.tenant_id) : DS.data.visibleOrders(user);
    var map = {};
    orders.forEach(function (o) {
      (o.items || []).forEach(function (it) {
        var key = it.product_id || it.name;
        if (!key) return;
        if (!map[key]) map[key] = { id: it.product_id, name: it.name, name_en: it.name_en || it.name, qty: 0 };
        map[key].qty += Number(it.qty) || 0;
      });
    });
    var list = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.qty - a.qty; });
    var products = DS.data.visibleProducts(user);
    var fallback = false;
    if (!list.length) {
      /* Fresh demo database: no orders yet. Fall back to the seeded sales
         counters so the forecast still has a meaningful signal. */
      fallback = true;
      list = products.map(function (p) {
        return { id: p.id, name: p.name, name_en: p.name_en || p.name, qty: Number(p.sold) || 0 };
      }).filter(function (p) { return p.qty > 0; }).sort(function (a, b) { return b.qty - a.qty; });
    }
    var top = list.slice(0, 3);
    var totalUnits = list.reduce(function (s, x) { return s + x.qty; }, 0);
    return {
      totalUnits: totalUnits,
      products: list.length,
      orders: orders.length,
      fallback: fallback,
      top: top.map(function (p) {
        var prod = products.filter(function (x) { return x.id === p.id; })[0] || {};
        var stock = Number(prod.stock) || 0;
        var demand = totalUnits ? Math.round(p.qty / totalUnits * 100) : 0;
        return {
          name: DS.lang() === 'en' ? (p.name_en || p.name) : (p.name || p.name_en),
          qty: p.qty,
          share: demand,
          stock: stock,
          low: stock <= (Number(prod.min_stock) || 0),
          confidence: Math.max(62, Math.min(97, Math.round((p.qty / Math.max(1, top[0] ? top[0].qty : p.qty)) * 82 + 15)))
        };
      })
    };
  }

  function aiInsightsMarkup() {
    var EN = DS.lang() === 'en';
    var f = aiForecast();
    var body;
    if (!f.top.length) {
      body = '<div class="ai-empty">' + icon('sparkles') +
        '<p>' + esc(EN ? 'No sales history yet. Complete a few orders and the forecast will start learning.' : 'لا يوجد سجل مبيعات بعد. أنشئ بضع طلبات وسيبدأ التنبؤ في التعلم.') + '</p></div>';
    } else {
      body = '<div class="ai-forecast-list">' + f.top.map(function (p, i) {
        return '<div class="ai-forecast-item">' +
          '<span class="ai-rank">' + (i + 1) + '</span>' +
          '<div class="ai-forecast-copy">' +
            '<div class="ai-forecast-title">' +
              (EN ? 'Forecast: ' : 'تنبؤ: ') + (EN ? 'product ' : 'منتج ') + '<b>' + esc(p.name) + '</b> ' +
              (EN ? 'is in high demand — we recommend increasing stock by 20%.' : 'مطلوب بكثرة، ننصح بزيادة المخزون بنسبة 20%.') +
            '</div>' +
            '<div class="ai-forecast-meta">' +
              '<span>' + icon('trendingUp') + p.qty + ' ' + esc(t('units')) + '</span>' +
              '<span>' + icon('chart') + p.share + '% ' + esc(EN ? 'of demand' : 'من الطلب') + '</span>' +
              '<span class="' + (p.low ? 'is-low' : '') + '">' + icon('box') + (EN ? 'Stock ' : 'المخزون ') + p.stock + '</span>' +
              '<span class="ai-conf">' + icon('sparkles') + (EN ? 'Confidence ' : 'ثقة ') + p.confidence + '%</span>' +
            '</div>' +
            '<div class="ai-bar"><span style="width:' + p.confidence + '%"></span></div>' +
          '</div>' +
        '</div>';
      }).join('') + '</div>';
    }
    return '<section class="ai-insights-card">' +
      '<div class="ai-glow" aria-hidden="true"></div>' +
      '<header class="ai-insights-head">' +
        '<span class="ai-orb">' + icon('sparkles') + '</span>' +
        '<div><div class="ai-kicker">' + esc(EN ? 'AI Insights' : 'تحليلات الذكاء الاصطناعي') + '</div>' +
          '<h2>' + esc(EN ? 'Sales forecasting' : 'تنبؤات المبيعات') + '</h2>' +
          '<p>' + esc(EN ? 'Learns from your orders and flags the products about to run out.' : 'يتعلم من طلباتك ويحدد المنتجات المعرضة للنفاد قبل حدوثه.') + '</p></div>' +
        '<span class="ai-live"><i></i>' + esc(EN ? 'Live model' : 'نموذج لحظي') + '</span>' +
      '</header>' +
      body +
      '<footer class="ai-insights-foot">' +
        '<span>' + icon(f.fallback ? 'chart' : 'orders') + (f.fallback
          ? esc(EN ? 'Based on historical sales' : 'مبني على المبيعات التاريخية')
          : f.orders + ' ' + esc(EN ? 'orders analysed' : 'طلب تم تحليله')) + '</span>' +
        '<span>' + icon('box') + f.products + ' ' + esc(EN ? 'products tracked' : 'منتج متتبع') + '</span>' +
      '</footer>' +
    '</section>';
  }

  /* ───────── PRO MAX · SMART INVENTORY FORECASTING CARD ─────────
     Reads DS.data.inventoryForecast() (14-day sales velocity) and renders
     the exact restock warning the owner needs to act on today. */
  function inventoryAlertMarkup() {
    var EN = DS.lang() === 'en';
    var alerts = DS.data.inventoryForecast ? DS.data.inventoryForecast(user.tenant_id) : [];
    var body;
    if (alerts.length) {
      body = '<div class="pm-alert-list">' + alerts.slice(0, 5).map(function (a) {
        var name = EN ? (a.name_en || a.name) : a.name;
        return '<div class="pm-alert-item">' +
          '<span class="pm-alert-ico">' + icon('alert') + '</span>' +
          '<div class="pm-alert-copy">' +
            '<div class="pm-alert-title">' + esc(EN
              ? 'Warning: ' + name + ' will run out in ' + a.days_left + ' days. Order ' + a.suggested + ' units.'
              : 'تحذير: منتج ' + name + ' سينفد خلال ' + a.days_left + ' أيام. اطلب ' + a.suggested + ' قطعة') + '</div>' +
            '<div class="pm-alert-meta">' +
              '<span>' + icon('box') + (EN ? 'Stock ' : 'المخزون ') + a.stock + '</span>' +
              '<span>' + icon('trendingUp') + a.velocity + (EN ? '/day' : '/يوم') + '</span>' +
              '<span>' + icon('orders') + a.units + (EN ? ' sold' : ' مبيع') + '</span>' +
            '</div>' +
          '</div>' +
          '<a class="btn btn-secondary btn-sm" href="' + url('owner/products.html') + '">' + icon('plus') + esc(EN ? 'Restock' : 'تعبئة') + '</a>' +
        '</div>';
      }).join('') + '</div>';
    } else {
      body = '<div class="pm-empty">' + icon('checkCircle') +
        '<b>' + esc(EN ? 'No product is running out in the next 3 days.' : 'لا يوجد منتج سينفد خلال 3 أيام.') + '</b>' +
        '<span>' + esc(EN ? 'Alerts appear automatically as orders come in.' : 'ستظهر التحذيرات تلقائياً مع كل طلب جديد.') + '</span></div>';
    }
    return '<section class="pm-card pm-forecast">' +
      '<header class="pm-card-head">' +
        '<span class="pm-card-ico">' + icon('box') + '</span>' +
        '<div><div class="pm-kicker">' + esc(EN ? 'Smart inventory' : 'المخزون الذكي') + '</div>' +
          '<h2>' + esc(EN ? 'Forecasting' : 'التنبؤ بالمخزون') + '</h2></div>' +
        (alerts.length ? '<span class="pm-pill danger">' + alerts.length + ' ' + esc(EN ? 'alerts' : 'تحذير') + '</span>' : '') +
      '</header>' + body +
      '<footer class="pm-card-foot">' + icon('sparkles') +
        esc(EN ? 'Based on the last 14 days of sales · restock target = 21 days.' : 'محسوب من مبيعات آخر 14 يوم · هدف التعبئة = 21 يوم.') +
      '</footer>' +
    '</section>';
  }

  /* ───────── PRO MAX · CUSTOMER LIFETIME VALUE (VIP) ───────── */
  function ltvMarkup() {
    var EN = DS.lang() === 'en';
    var d = DS.data.customerLifetime ? DS.data.customerLifetime(user.tenant_id) : { customers: [], vipCount: 0, avg: 0, total: 0, count: 0 };
    var top = d.customers.slice(0, 5);
    var body = top.length ? '<div class="pm-vip-list">' + top.map(function (c) {
      var name = EN ? (c.name_en || c.name) : (c.name || c.name_en);
      return '<div class="pm-vip-row">' +
        '<span class="avatar sm" style="background:var(--surface-3);color:var(--text-primary)">' + esc(DS.initials(name || '?')) + '</span>' +
        '<div class="pm-vip-copy"><b>' + esc(name || '—') + '</b>' +
          '<span>' + esc(c.orders) + ' ' + esc(EN ? 'orders' : 'طلب') + ' · ' + money(c.avg) + ' ' + esc(EN ? 'avg' : 'متوسط') + '</span></div>' +
        (c.vip ? '<span class="pm-vip-badge">◆ ' + esc(EN ? 'Diamond' : 'عميل ماسي') + '</span>' : '') +
        '<b class="pm-vip-value">' + money(c.ltv) + '</b>' +
      '</div>';
    }).join('') + '</div>' : '<div class="pm-empty">' + icon('users') +
      '<b>' + esc(EN ? 'No customers yet' : 'لا يوجد عملاء بعد') + '</b>' +
      '<span>' + esc(EN ? 'Lifetime value appears after the first order.' : 'ستظهر القيمة الإجمالية بعد أول طلب.') + '</span></div>';
    return '<section class="pm-card pm-ltv">' +
      '<header class="pm-card-head">' +
        '<span class="pm-card-ico">' + icon('users') + '</span>' +
        '<div><div class="pm-kicker">' + esc(EN ? 'Customer lifetime value' : 'قيمة العميل مدى الحياة') + '</div>' +
          '<h2>' + esc(EN ? 'Top customers' : 'أفضل العملاء') + '</h2></div>' +
        '<span class="pm-pill lime">' + (d.vipCount || 0) + ' VIP</span>' +
      '</header>' + body +
      '<footer class="pm-card-foot">' + icon('wallet') +
        esc(EN ? 'Total lifetime value ' : 'إجمالي القيمة ') + money(d.total) + ' · ' +
        esc(EN ? 'average ' : 'متوسط ') + money(d.avg) +
      '</footer>' +
    '</section>';
  }

  function ownerTabsMarkup() {
    var EN = DS.lang() === 'en';
    return '<div class="owner-tabs" role="tablist">' +
      '<button type="button" class="owner-tab' + (view.tab === 'overview' ? ' active' : '') + '" data-owner-tab="overview" role="tab" aria-selected="' + (view.tab === 'overview') + '">' +
        icon('dashboard') + esc(EN ? 'Overview' : 'نظرة عامة') + '</button>' +
      '<button type="button" class="owner-tab' + (view.tab === 'branches' ? ' active' : '') + '" data-owner-tab="branches" role="tab" aria-selected="' + (view.tab === 'branches') + '">' +
        icon('store') + esc(EN ? 'Branches' : 'الفروع') + '<span class="owner-tab-count">' + branches().length + '</span></button>' +
    '</div>';
  }

  function greeting() {
    var h = new Date().getHours();
    if (DS.lang() === 'en') return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    return h < 12 ? 'صباح الخير' : h < 18 ? 'مساء الخير' : 'مساء النور';
  }

  function tenantStats(tn) {
    var s = DS.data.statsFor(tn.id);
    return s;
  }

  function revenueSplit() {
    var rows = DS.data.tenants.map(function (tn) {
      var orders = DS.data.ordersByTenant(tn.id);
      return { name: tn.name, value: DS.data.revenueOf(orders) };
    }).filter(function (r) { return r.value > 0; });
    return rows.length ? rows : [{ name: t('noData'), value: 1 }];
  }

  function ownerRender() {
    var tn = DS.data.tenantById(user.tenant_id);
    var s = DS.data.statsFor(user.tenant_id);
    var series = DS.data.series(range, user.tenant_id);
    var tops = DS.data.topProducts(user.tenant_id, 5);
    var orders = DS.data.visibleOrders(user).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var low = DS.data.visibleProducts(user).filter(function (p) { return p.stock <= p.min_stock; }).slice(0, 5);
    var sub = DS.data.activeSubscription(user.tenant_id);
    var active = orders.filter(function (o) { return o.status === 'out_for_delivery'; })[0];
    var seriesTotal = series.reduce(function (a, x) { return a + x.value; }, 0);
    var tabs = ownerTabsMarkup();
    if (view.tab === 'branches') return tabs + branchesRender();

    return tabs + '<div class="welcome-card"><div class="welcome-copy">' +
      '<span class="welcome-kicker">' + icon('sparkles') + esc(greeting()) + ' · ' + esc(user.name) + '</span>' +
      '<div class="welcome-title">' + esc(DS.lang() === 'en' ? 'Your store is running smoothly.' : 'متجرك شغّال بكفاءة.') + '</div>' +
      '<div class="welcome-sub">' + esc(DS.lang() === 'en'
        ? 'You have ' + s.active + ' active orders and ' + s.todayOrders + ' orders today. Keep the momentum going.'
        : 'لديك ' + s.active + ' طلبات جارية و' + s.todayOrders + ' طلبات اليوم. كمّل بنفس القوة.') + '</div>' +
      '<div class="welcome-actions">' +
        '<button class="btn btn-primary" data-add-product>' + icon('plus') + esc(t('addProduct')) + '</button>' +
        '<a class="btn btn-secondary" href="' + url('owner/orders.html') + '">' + icon('orders') + esc(t('orders')) + '</a>' +
        '<a class="btn btn-ghost" href="' + url('customer/storefront.html') + '" target="_blank" rel="noopener">' + icon('store') + esc(t('viewStore')) + '</a>' +
      '</div></div><div class="welcome-stats">' +
        '<div class="welcome-stat"><div class="v">' + money(s.monthRevenue) + '</div><div class="l">' + esc(t('thisMonthRevenue')) + '</div></div>' +
        '<div class="welcome-stat"><div class="v">' + s.active + '</div><div class="l">' + esc(t('activeOrders')) + '</div></div>' +
        '<div class="welcome-stat"><div class="v">' + (tn ? tn.rating : '4.8') + '</div><div class="l">' + esc(t('rating')) + '</div></div>' +
      '</div></div>' +

      (sub && sub.daysLeft <= 15 ? '<div class="notice warning" style="display:flex;align-items:center;gap:10px">' + icon('alert') +
        '<div style="flex:1"><b>' + esc(t('expiringSoon')) + '</b> · ' + esc(t('daysRemaining')) + ': ' + Math.max(0, sub.daysLeft) + '</div>' +
        '<a class="btn btn-primary btn-sm" href="' + url('owner/subscriptions.html') + '">' + icon('whatsapp') + esc(t('renew')) + '</a></div>' : '') +

      aiInsightsMarkup() +

      inventoryAlertMarkup() +

      '<div class="kpi-grid">' +
        statCard(t('monthRevenue'), money(s.monthRevenue), 'chart', 'lime', '+' + s.monthOrders + ' ' + t('orders')) +
        statCard(t('ordersToday'), String(s.todayOrders), 'orders', 'info', t('activeOrders') + ': ' + s.active) +
        statCard(t('avgOrder'), money(s.avgOrder), 'receipt', 'purple', t('delivered') + ': ' + s.delivered) +
        statCard(t('lowStock'), String(s.lowStock), 'box', s.lowStock ? 'orange' : 'green', t('products') + ': ' + s.products) +
      '</div>' +

      '<div class="two-col"><div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('salesOverview')) + '</div><div class="card-subtitle">' + esc(t('last7')) + ' · ' + money(seriesTotal) + '</div></div>' +
        '<div class="segmented" data-range><button class="' + (range === 7 ? 'active' : '') + '" data-days="7">7</button><button class="' + (range === 30 ? 'active' : '') + '" data-days="30">30</button></div></div>' +
        '<div class="card-body">' + DS.chart.area(series) + '</div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('revenueSplit')) + '</div></div><div class="card-body">' +
          DS.chart.donut(DS.data.categoryBreakdown(user.tenant_id).slice(0, 5).map(function (c) { return { label: c.name, value: c.value }; }), { label: t('category'), center: DS.data.categoryBreakdown(user.tenant_id).length }) +
        '</div></div></div>' +

      '<div class="two-col"><div class="card order-list-card"><div class="card-header"><div class="card-title">' + esc(t('recentOrders')) + '</div>' +
        '<a class="btn btn-ghost btn-sm" href="' + url('owner/orders.html') + '">' + esc(t('viewAll')) + icon('arrowRight') + '</a></div>' +
        '<div class="table-wrap flush"><table class="table table-compact"><thead><tr><th>' + esc(t('orderId')) + '</th><th>' + esc(t('customerLabel')) + '</th><th>' + esc(t('total')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        (orders.length ? orders.slice(0, 6).map(orderRow).join('') : '<tr><td colspan="4">' + DS.empty({ icon: 'orders', title: t('emptyOrders'), text: t('emptyOrdersText') }) + '</td></tr>') +
        '</tbody></table></div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('topProducts')) + '</div></div><div class="card-body">' +
          (tops.length ? tops.map(function (p, i) {
            return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border-soft)">' +
              '<span style="font-family:var(--font-display);font-weight:700;color:var(--text-tertiary);width:16px">' + (i + 1) + '</span>' +
              '<img src="' + esc(DS.data.img(p.image)) + '" alt="" style="width:34px;height:34px;border-radius:8px;object-fit:cover">' +
              '<div style="flex:1;min-width:0"><div class="truncate" style="font-size:12px;font-weight:600">' + esc(DS.lang() === 'en' ? (p.name_en || p.name) : p.name) + '</div>' +
              '<div style="font-size:10px;color:var(--text-tertiary)">' + p.qty + ' ' + esc(t('units')) + '</div></div>' +
              '<b style="font-size:12px">' + money(p.revenue) + '</b></div>';
          }).join('') : DS.empty({ icon: 'box', title: t('emptyProducts'), text: t('emptyProductsText') })) +
        '</div></div></div>' +

      driversCard() +

      ltvMarkup() +

      '<div class="two-col">' +
        (active ? '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('liveOrders')) + '</div><a class="btn btn-ghost btn-sm" href="' + url('customer/tracking.html?order=' + active.id) + '">' + esc(t('tracking')) + '</a></div><div class="card-body" data-owner-map></div></div>'
          : '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('lowStock')) + '</div></div><div class="card-body">' +
            (low.length ? low.map(function (p) {
              return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-soft)"><img src="' + esc(DS.data.img(p.image)) + '" style="width:32px;height:32px;border-radius:7px;object-fit:cover" alt="">' +
                '<div style="flex:1;min-width:0"><div class="truncate" style="font-size:12px;font-weight:600">' + esc(p.name) + '</div><div style="font-size:10px;color:var(--text-tertiary)">' + p.stock + ' / ' + p.min_stock + '</div></div>' +
                '<a class="btn btn-ghost btn-sm" href="' + url('owner/products.html') + '">' + esc(t('manage')) + '</a></div>';
            }).join('') : DS.empty({ icon: 'checkCircle', title: t('inStock'), text: DS.lang() === 'en' ? 'All products are above their minimum stock level.' : 'كل المنتجات أعلى من حد المخزون الأدنى.' })) +
            '</div></div>') +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('quickActions')) + '</div></div><div class="card-body"><div class="quick-grid">' +
          quick('plus', t('addProduct'), 'owner/products.html', 'data-add-product') +
          quick('receipt', t('orders'), 'owner/orders.html') +
          quick('chart', t('reports'), 'owner/reports.html') +
          quick('card', t('subscriptions'), 'owner/subscriptions.html') +
          quick('cashier', t('cashiers'), 'owner/cashiers.html') +
          quick('truck', t('delivery-companies'), 'owner/delivery-companies.html') +
        '</div></div></div></div>';
  }

  function adminRender() {
    var s = DS.data.platformStats();
    var series = DS.data.series(range);
    var split = revenueSplit();
    var orders = DS.data.orders.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var tops = DS.data.topProducts(null, 5);
    var logs = DS.data.auditLogs.slice(0, 6);
    var tenants = DS.data.tenants.map(function (tn) {
      var ts = tenantStats(tn);
      return { tn: tn, s: ts };
    }).sort(function (a, b) { return b.s.revenue - a.s.revenue; });

    return '<div class="welcome-card"><div class="welcome-copy">' +
      '<span class="welcome-kicker">' + icon('sparkles') + esc(greeting()) + ' · ' + esc(user.name) + '</span>' +
      '<div class="welcome-title">' + esc(DS.lang() === 'en' ? 'The whole platform, in one place.' : 'المنصة كاملة، في مكان واحد.') + '</div>' +
      '<div class="welcome-sub">' + esc(DS.lang() === 'en'
        ? tenants.length + ' stores, ' + s.active + ' live orders and ' + money(s.monthRevenue) + ' revenue this month.'
        : tenants.length + ' متاجر، ' + s.active + ' طلب جاري، و' + money(s.monthRevenue) + ' إيرادات هذا الشهر.') + '</div>' +
      '<div class="welcome-actions">' +
        '<a class="btn btn-primary" href="' + url('admin/stores.html') + '">' + icon('store') + esc(t('stores')) + '</a>' +
        '<a class="btn btn-secondary" href="' + url('admin/orders.html') + '">' + icon('orders') + esc(t('orders')) + '</a>' +
        '<a class="btn btn-ghost" href="' + url('admin/reports.html') + '">' + icon('chart') + esc(t('reports')) + '</a>' +
        '<button class="btn btn-secondary" data-quick-add-user>' + icon('userPlus') + esc(DS.lang() === 'en' ? 'Quick add user' : 'إضافة سريعة') + '</button>' +
      '</div></div><div class="welcome-stats">' +
        '<div class="welcome-stat"><div class="v">' + money(s.mrr) + '</div><div class="l">' + esc(t('mrr')) + '</div></div>' +
        '<div class="welcome-stat"><div class="v">' + s.tenants + '</div><div class="l">' + esc(t('totalStores')) + '</div></div>' +
        '<div class="welcome-stat"><div class="v">' + s.users + '</div><div class="l">' + esc(t('users')) + '</div></div>' +
      '</div></div>' +

      '<div class="kpi-grid">' +
        statCard(t('totalRevenue'), money(s.revenue), 'trendingUp', 'lime', t('delivered') + ': ' + s.delivered) +
        statCard(t('totalOrdersLabel'), String(s.orders), 'orders', 'info', t('activeOrders') + ': ' + s.active) +
        statCard(t('totalCustomers'), String(DS.data.customers().length), 'users', 'purple', t('newCustomers') + ': ' + s.todayOrders) +
        statCard(t('mrr'), money(s.mrr), 'card', 'orange', t('arr') + ': ' + money(s.arr)) +
      '</div>' +

      '<div class="two-col"><div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('salesOverview')) + '</div><div class="card-subtitle">' + esc(t('last7')) + '</div></div>' +
        '<div class="segmented" data-range><button class="' + (range === 7 ? 'active' : '') + '" data-days="7">7</button><button class="' + (range === 30 ? 'active' : '') + '" data-days="30">30</button></div></div>' +
        '<div class="card-body">' + DS.chart.area(series) + '</div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('revenueSplit')) + '</div><span class="badge lime">' + esc(t('live')) + '</span></div><div class="card-body">' +
          DS.chart.donut(split, { label: t('stores'), center: split.length }) + '</div></div></div>' +

      '<div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('topStores')) + '</div><div class="card-subtitle">' + esc(t('revenue')) + ' · ' + esc(t('orders')) + ' · ' + esc(t('status')) + '</div></div>' +
        '<a class="btn btn-ghost btn-sm" href="' + url('admin/stores.html') + '">' + esc(t('manage')) + icon('arrowRight') + '</a></div>' +
        '<div class="table-wrap flush"><table class="table table-compact"><thead><tr><th>' + esc(t('store')) + '</th><th>' + esc(t('plan')) + '</th><th>' + esc(t('orders')) + '</th><th>' + esc(t('revenue')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        tenants.map(function (x) {
          return '<tr><td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(x.tn)) + '" alt=""><div><div class="cell-title">' + esc(x.tn.name) + '</div><div class="cell-sub">' + esc(DS.loc(x.tn, 'industry')) + '</div></div></div></td>' +
            '<td><span class="badge ' + (x.tn.plan === 'yearly' ? 'lime' : x.tn.plan === 'sixmonths' ? 'info' : 'neutral') + '">' + esc(t(x.tn.plan)) + '</span></td>' +
            '<td>' + x.s.orders + '</td><td><b>' + money(x.s.revenue) + '</b></td>' +
            '<td>' + DS.badge(x.tn.status, t(x.tn.status)) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +

      '<div class="two-col"><div class="card order-list-card"><div class="card-header"><div class="card-title">' + esc(t('recentOrders')) + '</div>' +
        '<a class="btn btn-ghost btn-sm" href="' + url('admin/orders.html') + '">' + esc(t('viewAll')) + icon('arrowRight') + '</a></div>' +
        '<div class="table-wrap flush"><table class="table table-compact"><thead><tr><th>' + esc(t('orderId')) + '</th><th>' + esc(t('customerLabel')) + '</th><th>' + esc(t('total')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
        orders.slice(0, 6).map(orderRow).join('') + '</tbody></table></div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('liveActivity')) + '</div><a class="btn btn-ghost btn-sm" href="' + url('admin/audit-logs.html') + '">' + esc(t('viewAll')) + '</a></div>' +
        '<div class="card-body" style="display:flex;flex-direction:column;gap:0">' +
        logs.map(function (l) {
          return '<div style="display:flex;gap:9px;padding:8px 0;border-bottom:1px solid var(--border-soft)">' +
            '<span style="width:28px;height:28px;border-radius:8px;background:var(--surface-2);color:var(--lime);display:grid;place-items:center;flex-shrink:0">' + icon(l.icon) + '</span>' +
            '<div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:500">' + esc(DS.lang() === 'en' ? l.action_en : l.action) + '</div>' +
            '<div style="font-size:10px;color:var(--text-tertiary);margin-top:1px">' + esc(DS.lang() === 'en' ? (l.actor_en || l.actor) : l.actor) + ' · ' + esc(DS.timeAgo(l.at)) + '</div></div></div>';
        }).join('') + '</div></div></div>' +

      '<div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('liveTracking')) + '</div>' +
        '<div class="card-subtitle">' + esc(t('liveTrackingHint')) + '</div></div><span class="badge lime">' + esc(t('live')) + '</span></div>' +
        '<div class="card-body"><div data-fleet-map style="height:340px;border-radius:16px;overflow:hidden"></div></div></div>' +

      '<div class="kpi-grid cols-2"><div class="card"><div class="card-header"><div class="card-title">' + esc(t('topProducts')) + '</div></div><div class="card-body">' +
        DS.chart.bars(tops.map(function (p) { return { label: DS.lang() === 'en' ? (p.name_en || p.name) : p.name, value: p.revenue }; })) + '</div></div>' +
        '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('quickActions')) + '</div></div><div class="card-body"><div class="quick-grid">' +
          quickAdd('userPlus', DS.lang() === 'en' ? 'Quick add user' : 'إضافة سريعة') +
          quick('store', t('addStore'), 'admin/stores.html') +
          quick('shield', t('addAdmin'), 'admin/sub-admins.html') +
          quick('cashier', t('cashiers'), 'admin/cashiers.html') +
          quick('jobs', t('jobs'), 'admin/jobs.html') +
          quick('chat', t('chats'), 'admin/chats.html') +
          quick('settings', t('settings'), 'admin/settings.html') +
        '</div></div></div></div>';
  }

  function branchTopProducts(list, limit) {
    var map = {};
    list.forEach(function (o) {
      (o.items || []).forEach(function (it) {
        var key = it.product_id || it.name;
        if (!map[key]) map[key] = { name: it.name, name_en: it.name_en || it.name, qty: 0, revenue: 0, image: it.image };
        map[key].qty += Number(it.qty) || 0;
        map[key].revenue += (Number(it.qty) || 0) * (Number(it.price) || 0);
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, limit || 5);
  }

  function branchesRender() {
    var EN = DS.lang() === 'en';
    var list = branches();
    var current = list.filter(function (b) { return b.id === view.branch; })[0] || list[0];
    var orders = ordersForBranch(current.id).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var s = branchStats(orders);
    var tops = branchTopProducts(orders, 5);

    var pills = '<div class="branch-pills" role="tablist">' + list.map(function (b) {
      return '<button type="button" class="branch-pill' + (b.id === current.id ? ' active' : '') + '" data-branch-select="' + esc(b.id) + '">' +
        icon('store') + '<span>' + esc(branchName(b)) + '</span>' +
        '<b>' + branchStats(ordersForBranch(b.id)).orders + '</b></button>';
    }).join('') +
      '<button type="button" class="branch-pill branch-pill-add" data-add-branch>' + icon('plus') + '<span>' + esc(EN ? 'New branch' : 'فرع جديد') + '</span></button>' +
    '</div>';

    var head = '<div class="branch-head">' +
      '<div class="branch-head-copy"><div class="branch-eyebrow">' + icon('store') + esc(EN ? 'Multi-branch management' : 'إدارة الفروع') + '</div>' +
        '<h2>' + esc(branchName(current)) + '</h2>' +
        '<p>' + icon('mapPin') + esc(current.address || (EN ? 'No address saved' : 'لا يوجد عنوان محفوظ')) + '</p></div>' +
      '<button type="button" class="btn btn-primary" data-add-branch>' + icon('plus') + esc(EN ? 'Add branch' : 'إضافة فرع') + '</button>' +
    '</div>';

    var kpis = '<div class="kpi-grid branch-kpis">' +
      statCard(EN ? 'Branch revenue' : 'إيرادات الفرع', money(s.revenue), 'chart', 'lime', s.orders + ' ' + t('orders')) +
      statCard(EN ? 'Orders' : 'الطلبات', String(s.orders), 'orders', 'info', (EN ? 'Active: ' : 'الجارية: ') + s.active) +
      statCard(EN ? 'Average order' : 'متوسط الطلب', money(s.avg), 'receipt', 'purple', (EN ? 'Delivered: ' : 'تم التسليم: ') + s.delivered) +
      statCard(EN ? 'Branches' : 'الفروع', String(list.length), 'store', 'orange', (EN ? 'All locations' : 'كل المواقع')) +
    '</div>';

    var branchCards = '<div class="branch-list">' + list.map(function (b) {
      var bs = branchStats(ordersForBranch(b.id));
      return '<button type="button" class="branch-card' + (b.id === current.id ? ' active' : '') + '" data-branch-select="' + esc(b.id) + '">' +
        '<span class="branch-card-ic">' + icon('store') + '</span>' +
        '<span class="branch-card-copy"><b>' + esc(branchName(b)) + '</b><i>' + esc(b.address || '—') + '</i>' +
          '<small>' + bs.orders + ' ' + esc(t('orders')) + ' · ' + money(bs.revenue) + '</small></span>' +
        (b.id === current.id ? '<span class="branch-card-live">' + icon('check') + '</span>' : icon('arrowRight')) +
      '</button>';
    }).join('') + '</div>';

    var topsMarkup = tops.length ? tops.map(function (p, i) {
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-soft)">' +
        '<span style="font-family:var(--font-display);font-weight:700;color:var(--text-tertiary);width:16px">' + (i + 1) + '</span>' +
        '<img src="' + esc(DS.data.img(p.image)) + '" alt="" style="width:34px;height:34px;border-radius:8px;object-fit:cover">' +
        '<div style="flex:1;min-width:0"><div class="truncate" style="font-size:12px;font-weight:600">' + esc(EN ? (p.name_en || p.name) : p.name) + '</div>' +
        '<div style="font-size:10px;color:var(--text-tertiary)">' + p.qty + ' ' + esc(t('units')) + '</div></div>' +
        '<b style="font-size:12px">' + money(p.revenue) + '</b></div>';
    }).join('') : DS.empty({ icon: 'box', title: t('emptyProducts'), text: t('emptyProductsText') });

    var recent = '<div class="table-wrap flush"><table class="table table-compact"><thead><tr><th>' + esc(t('orderId')) + '</th><th>' + esc(t('customerLabel')) + '</th><th>' + esc(t('total')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
      (orders.length ? orders.slice(0, 6).map(orderRow).join('') : '<tr><td colspan="4">' + DS.empty({ icon: 'orders', title: t('emptyOrders'), text: t('emptyOrdersText') }) + '</td></tr>') +
      '</tbody></table></div>';

    return head + pills + kpis +
      '<div class="two-col"><div class="card"><div class="card-header"><div class="card-title">' + esc(t('topProducts')) + ' · ' + esc(branchName(current)) + '</div></div><div class="card-body">' + topsMarkup + '</div></div>' +
      '<div class="card"><div class="card-header"><div class="card-title">' + esc(EN ? 'All branches' : 'كل الفروع') + '</div></div><div class="card-body">' + branchCards + '</div></div></div>' +
      branchTransferMarkup() +
      '<div class="card order-list-card"><div class="card-header"><div class="card-title">' + esc(t('recentOrders')) + ' · ' + esc(branchName(current)) + '</div>' +
        '<a class="btn btn-ghost btn-sm" href="' + url('owner/orders.html') + '">' + esc(t('viewAll')) + icon('arrowRight') + '</a></div>' + recent + '</div>';
  }

  function openAddBranch() {
    var EN = DS.lang() === 'en';
    DS.modal({
      title: icon('store') + ' ' + esc(EN ? 'Add a branch' : 'إضافة فرع'),
      sub: esc(EN ? 'Create a new location and switch between its stats.' : 'أنشئ موقعاً جديداً وبدّل بين إحصائياته.'),
      size: 'sm',
      body: '<div class="field"><label>' + esc(EN ? 'Branch name' : 'اسم الفرع') + ' *</label>' +
          '<input class="input" id="brName" maxlength="60" placeholder="' + esc(EN ? 'Smouha branch' : 'فرع سموحة') + '"></div>' +
        '<div class="field" style="margin-top:10px"><label>' + esc(EN ? 'Address' : 'العنوان') + '</label>' +
          '<input class="input" id="brAddress" maxlength="120" placeholder="' + esc(EN ? 'Street, city' : 'الشارع، المدينة') + '"></div>',
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: EN ? 'Create branch' : 'إنشاء الفرع', variant: 'btn-primary', icon: icon('check'), onClick: function (root) {
            var name = (root.querySelector('#brName').value || '').trim();
            var address = (root.querySelector('#brAddress').value || '').trim();
            if (!name) { DS.toast(t('required'), 'error'); return false; }
            var list = branches();
            var id = 'br-' + Date.now().toString(36);
            list.push({ id: id, name: name, name_en: name, address: address || (EN ? 'No address' : 'بدون عنوان'), created_at: new Date().toISOString() });
            DS.store.set(BRANCH_KEY, list);
            view.tab = 'branches';
            view.branch = id;
            DS.toast(EN ? 'Branch created' : 'تم إنشاء الفرع', 'success');
            render();
            return true;
          } }
      ]
    });
  }

  function statCard(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div>' +
      '<div class="stat-value">' + value + '</div><div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }
  function quick(ico, label, href, attr) {
    return '<a class="quick-btn" href="' + url(href) + '" ' + (attr || '') + '><span class="qi">' + icon(ico) + '</span><span>' + esc(label) + '</span></a>';
  }
  function quickAdd(ico, label) {
    return '<button type="button" class="quick-btn" data-quick-add-user><span class="qi">' + icon(ico) + '</span><span>' + esc(label) + '</span></button>';
  }

  /* ───────────────── ADMIN · QUICK ADD USER ───────────────── */
  function openQuickAddUser() {
    var en = DS.lang() === 'en';
    var isOwner = user.role === 'owner';
    var scopedTenants = isOwner ? DS.data.tenants.filter(function (tn) { return tn.id === user.tenant_id; }) : DS.data.tenants;
    var storeOpts = scopedTenants.map(function (tn) {
      return '<option value="' + esc(tn.id) + '"' + (isOwner && tn.id === user.tenant_id ? ' selected' : '') + '>' + esc(tn.name) + ' · ' + esc(tn.id) + '</option>';
    }).join('');
    var companyOpts = (DS.data.companies || []).map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
    }).join('');
    var body =
      '<div class="field-grid">' +
        '<div class="field"><label>' + esc(en ? 'Full name' : 'الاسم بالكامل') + ' *</label><input class="input" id="qaName" maxlength="60" placeholder="' + esc(en ? 'Mahmoud Ali' : 'محمود علي') + '"></div>' +
        '<div class="field"><label>' + esc(en ? 'Username' : 'اسم المستخدم') + ' *</label><input class="input" id="qaUser" dir="ltr" maxlength="32" placeholder="ma_store"></div>' +
        '<div class="field"><label>' + esc(en ? 'Password' : 'كلمة المرور') + ' *</label><input class="input" id="qaPass" dir="ltr" maxlength="64" placeholder="••••••••"></div>' +
        '<div class="field"><label>' + esc(en ? 'Role' : 'الدور') + ' *</label><select class="select" id="qaRole">' +
          (isOwner ? '' : '<option value="owner">' + esc(en ? 'Store owner' : 'صاحب متجر') + '</option>') +
          '<option value="cashier"' + (isOwner ? ' selected' : '') + '>' + esc(en ? 'Cashier' : 'كاشير') + '</option>' +
          '<option value="delivery">' + esc(en ? 'Driver' : 'مندوب') + '</option>' +
        '</select></div>' +
        '<div class="field" data-qa-store hidden><label>' + esc(en ? 'Store (tenant_id)' : 'المتجر (tenant_id)') + ' *</label><select class="select" id="qaTenant">' + storeOpts + '</select></div>' +
        '<div class="field" data-qa-store-name><label>' + esc(en ? 'Store name' : 'اسم المتجر') + ' *</label><input class="input" id="qaStore" maxlength="60"></div>' +
        '<div class="field" data-qa-company hidden><label>' + esc(en ? 'Delivery company' : 'شركة التوصيل') + '</label><select class="select" id="qaCompany">' + companyOpts + '</select></div>' +
        '<div class="field"><label>' + esc(en ? 'Phone' : 'رقم الهاتف') + '</label><input class="input" id="qaPhone" dir="ltr" maxlength="20" placeholder="01012345678"></div>' +
      '</div>' +
      '<p style="font-size:11px;color:var(--text-tertiary);margin-top:4px">' + icon('shield') + ' ' +
        esc(en ? 'A tenant_id is generated automatically for every new owner.' : 'يتم توليد tenant_id تلقائياً لكل صاحب متجر جديد.') + '</p>';

    DS.modal({
      title: icon('userPlus') + ' ' + esc(en ? 'Quick add user' : 'إضافة مستخدم سريعة'),
      sub: esc(en ? 'Create an owner, cashier or driver in seconds.' : 'أنشئ صاحب متجر أو كاشير أو مندوباً في ثوانٍ.'),
      size: 'md',
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: en ? 'Create account' : 'إنشاء الحساب', variant: 'btn-primary', icon: icon('check'), onClick: function (root) {
            var name = (root.querySelector('#qaName').value || '').trim();
            var username = (root.querySelector('#qaUser').value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
            var pass = root.querySelector('#qaPass').value || '';
            var role = root.querySelector('#qaRole').value;
            var phone = (root.querySelector('#qaPhone').value || '').trim();
            if (!name || !username || !pass) { DS.toast(t('required'), 'error'); return false; }
            if (pass.length < 8) { DS.toast(en ? 'Password must be at least 8 characters' : 'كلمة المرور 8 أحرف على الأقل', 'error'); return false; }
            if (DS.data.users.some(function (u) { return String(u.username || '').toLowerCase() === username; })) {
              DS.toast(en ? 'Username already used' : 'اسم المستخدم مستخدم بالفعل', 'error'); return false;
            }

            if (role === 'owner') {
              var storeName = (root.querySelector('#qaStore').value || '').trim();
              if (!storeName) { DS.toast(t('required'), 'error'); return false; }
              var slug = username.replace(/[^a-z0-9]/g, '') || String(Date.now()).slice(-6);
              var tid = 't-' + slug, n = 2;
              while (DS.data.tenantById(tid)) { tid = 't-' + slug + n; n++; }
              var now = new Date().toISOString();
              var end = new Date(Date.now() + 30 * 86400000).toISOString();
              DS.data.db.tenants.push({
                id: tid, slug: slug, name: storeName, name_en: storeName,
                owner: name, owner_en: name, owner_username: username,
                phone: phone, email: username + '@dotstudio.app',
                city: '', city_en: '', address: '', address_en: '',
                industry: en ? 'Retail' : 'تجارة', industry_en: 'Retail',
                plan: 'monthly', subscription_start: now, subscription_end: end,
                status: 'active', avatar_id: 'av' + (1 + Math.floor(Math.random() * 9)),
                color: '#82FF1F', rating: 4.8, delivery_fee: 30,
                lat: 30.0444, lng: 31.2357,
                description: '', description_en: '', created_at: now
              });
              DS.data.addUser({
                username: username, password: pass, role: 'owner', name: name, name_en: name,
                tenant_id: tid, phone: phone, avatar_id: 'av1', is_active: true
              });
              DS.data.audit('إضافة سريعة · متجر «' + storeName + '»', 'Quick add · store “' + storeName + '”', 'store');
              DS.toast(en ? 'Store + owner created' : 'تم إنشاء المتجر والحساب', 'success');
            } else {
              var tenantId = root.querySelector('#qaTenant').value;
              if (isOwner) tenantId = user.tenant_id;
              var payload = {
                username: username, password: pass, role: role, name: name, name_en: name,
                tenant_id: tenantId, phone: phone, avatar_id: role === 'delivery' ? 'av3' : 'av6', is_active: true
              };
              if (role === 'delivery') {
                var comp = (DS.data.companies || []).filter(function (c) { return c.id === root.querySelector('#qaCompany').value; })[0];
                if (comp) { payload.delivery_company = comp.id; payload.delivery_company_name = comp.name; }
              }
              DS.data.addUser(payload);
              DS.toast(en ? 'User created' : 'تم إنشاء الحساب', 'success');
            }
            render();
            return true;
          } }
      ],
      onMount: function (root) {
        var roleSel = root.querySelector('#qaRole');
        function sync() {
          var role = roleSel.value;
          root.querySelector('[data-qa-store]').hidden = role === 'owner';
          root.querySelector('[data-qa-company]').hidden = role !== 'delivery';
          root.querySelector('[data-qa-store-name]').hidden = role !== 'owner';
        }
        roleSel.addEventListener('change', sync);
        sync();
      }
    });
  }

  /* ───────────────── OWNER · MANAGE DRIVERS ───────────────── */
  function tenantDrivers() {
    return DS.data.users.filter(function (u) {
      return u.role === 'delivery' && u.tenant_id === user.tenant_id;
    });
  }

  function driversCard() {
    var en = DS.lang() === 'en';
    var list = tenantDrivers();
    var running = {};
    DS.data.visibleOrders(user).forEach(function (o) {
      if (o.status === 'out_for_delivery' && o.driver_id) running[o.driver_id] = (running[o.driver_id] || 0) + 1;
    });
    return '<div class="card" data-drivers-card><div class="card-header"><div>' +
        '<div class="card-title">' + icon('truck') + ' ' + esc(en ? 'Manage drivers' : 'إدارة المناديب') + '</div>' +
        '<div class="card-subtitle">' + esc(en ? 'Drivers created here can only see your store’s orders.' : 'المناديب المضافون هنا يرون طلبات متجرك فقط.') + '</div></div>' +
        '<button class="btn btn-primary btn-sm" data-add-driver>' + icon('plus') + esc(en ? 'Add driver' : 'إضافة مندوب') + '</button></div>' +
      '<div class="card-body">' +
      (list.length ? list.map(function (d) {
        var tn = DS.data.tenantById(d.tenant_id);
        return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border-soft)">' +
          '<img class="avatar sm" src="' + esc(DS.avatarUrl(d)) + '" alt="">' +
          '<div style="flex:1;min-width:0"><div class="truncate" style="font-size:12.5px;font-weight:600">' + esc(DS.loc(d, 'name')) + '</div>' +
            '<div style="font-size:10.5px;color:var(--text-tertiary)">@' + esc(d.username) + ' · ' + esc(tn ? tn.name : '') + (d.phone ? ' · ' + esc(d.phone) : '') + '</div></div>' +
          '<span class="badge ' + (running[d.id] ? 'lime' : 'neutral') + '">' + (running[d.id] || 0) + ' ' + esc(en ? 'on the way' : 'جاري') + '</span>' +
          '<span class="badge ' + (d.is_active === false ? 'danger' : 'success') + '">' + esc(d.is_active === false ? (en ? 'Off' : 'موقوف') : (en ? 'Active' : 'نشط')) + '</span>' +
          '<button class="btn btn-ghost btn-sm" data-edit-driver="' + esc(d.id) + '" aria-label="edit">' + icon('edit') + '</button>' +
          '<button class="btn btn-ghost btn-sm" data-toggle-driver="' + esc(d.id) + '" aria-label="toggle">' + icon(d.is_active === false ? 'play' : 'pause') + '</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" data-del-driver="' + esc(d.id) + '" aria-label="delete">' + icon('trash') + '</button></div>';
      }).join('') : DS.empty({ icon: 'truck', title: en ? 'No drivers yet' : 'لا يوجد مناديب بعد', text: en ? 'Add your first driver — he will only see your store’s orders.' : 'أضف أول مندوب — سيرى طلبات متجرك فقط.' })) +
      '</div></div>';
  }

  function openDriverModal(driver) {
    var en = DS.lang() === 'en';
    var isNew = !driver;
    var inHouseLabel = en ? 'In-House Delivery' : 'توصيل المحل (داخلي)';
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(en ? 'Full name' : 'الاسم بالكامل') + ' *</label><input class="input" id="drName" maxlength="60" value="' + esc(driver ? driver.name : '') + '"></div>' +
      '<div class="field"><label>' + esc(en ? 'Phone' : 'رقم الهاتف') + '</label><input class="input" id="drPhone" dir="ltr" maxlength="20" value="' + esc(driver ? (driver.phone || '') : '') + '" placeholder="01012345678"></div>' +
      '<div class="field"><label>' + esc(en ? 'Username' : 'اسم المستخدم') + ' *</label><input class="input" id="drUser" dir="ltr" maxlength="32" value="' + esc(driver ? driver.username : '') + '"' + (isNew ? '' : ' readonly') + '></div>' +
      '<div class="field"><label>' + esc(en ? 'Password' : 'كلمة المرور') + (isNew ? ' *' : '') + '</label><input class="input" id="drPass" dir="ltr" maxlength="64" autocomplete="new-password" placeholder="' + esc(isNew ? '' : (en ? 'Leave blank to keep current' : 'اتركه فارغًا للإبقاء على الحالي')) + '"></div>' +
      '<div class="field"><label>' + esc(en ? 'Status' : 'الحالة') + '</label><select class="select" id="drActive">' +
        '<option value="1"' + (!driver || driver.is_active !== false ? ' selected' : '') + '>' + esc(en ? 'Active' : 'نشط') + '</option>' +
        '<option value="0"' + (driver && driver.is_active === false ? ' selected' : '') + '>' + esc(en ? 'Suspended' : 'موقوف') + '</option></select></div>' +
      '</div>' +
      '<p style="font-size:11px;color:var(--text-tertiary);margin-top:4px">' + icon('store') + ' ' +
        esc(en ? 'The driver is tied to ' + (DS.data.tenantById(user.tenant_id) || {}).name + ' and sees its orders only.' : 'المندوب مرتبط بمتجر ' + (DS.data.tenantById(user.tenant_id) || {}).name + ' ويرى طلباته فقط.') + '</p>';

    DS.modal({
      title: icon('truck') + ' ' + esc(isNew ? (en ? 'Add driver' : 'إضافة مندوب') : (en ? 'Edit driver' : 'تعديل المندوب')),
      size: 'md',
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('saveChanges'), variant: 'btn-primary', onClick: function (root) {
            var name = (root.querySelector('#drName').value || '').trim();
            var username = (root.querySelector('#drUser').value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
            var pass = root.querySelector('#drPass').value || '';
            var phone = (root.querySelector('#drPhone').value || '').trim();
            var active = root.querySelector('#drActive').value === '1';
            if (!name || !username || (isNew && pass.length < 8)) {
              DS.toast(isNew ? (en ? 'Name, username and 8+ character password are required' : 'الاسم واسم المستخدم وكلمة مرور 8 أحرف مطلوبة') : t('required'), 'error');
              return false;
            }
            if (isNew) {
              if (DS.data.users.some(function (u) { return String(u.username || '').toLowerCase() === username; })) {
                DS.toast(en ? 'Username already used' : 'اسم المستخدم مستخدم بالفعل', 'error'); return false;
              }
              DS.data.addUser({
                username: username, password: pass, role: 'delivery', name: name, name_en: name,
                tenant_id: user.tenant_id, phone: phone, avatar_id: 'av3', is_active: active,
                company_id: 'in_house',
                delivery_company: null,
                delivery_company_name: inHouseLabel
              });
            } else {
              DS.data.saveUser({
                id: driver.id, name: name, phone: phone, is_active: active,
                tenant_id: user.tenant_id,
                company_id: 'in_house',
                delivery_company: null,
                delivery_company_name: inHouseLabel,
                password: pass || undefined
              });
            }
            DS.toast(en ? 'Driver saved' : 'تم حفظ المندوب', 'success');
            render();
            return true;
          } }
      ]
    });
  }

  function orderRow(o) {
    var meta = DS.statusMeta(o.status);
    return '<tr data-order="' + esc(o.id) + '" style="cursor:pointer"><td><div class="cell-title" style="direction:ltr;text-align:start;font-family:var(--font-mono);font-size:11px">' + esc(o.order_no) + '</div><div class="cell-sub">' + esc(DS.timeAgo(o.created_at)) + '</div></td>' +
      '<td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(DS.data.userByUsername((o.customer && o.customer.phone) === '01123456789' ? 'customer' : 'customer'))) + '" alt=""><div><div class="cell-title">' + esc(DS.loc(o.customer, 'name')) + '</div><div class="cell-sub">' + esc(DS.data.tenantById(o.tenant_id).name) + '</div></div></div></td>' +
      '<td><b>' + money(o.total) + '</b></td><td>' + DS.badge(o.status, meta.label) + '</td></tr>';
  }

  function render() {
    if (fleet && fleet.stop) { try { fleet.stop(); } catch (e) {} fleet = null; }
    page.setContent(isAdmin ? adminRender() : ownerRender());
    bind();
    if (!isAdmin) {
      var host = page.body.querySelector('[data-owner-map]');
      var active = DS.data.visibleOrders(user).filter(function (o) { return o.status === 'out_for_delivery'; })[0];
      if (host && active) DS.gps.mount(host, { order: active, height: 260, showStrip: false });
    } else {
      var fleetHost = page.body.querySelector('[data-fleet-map]');
      if (fleetHost && DS.gps && DS.gps.fleet) fleet = DS.gps.fleet(fleetHost, { height: 340 });
    }
  }

  function bind() {
    DS.$$('[data-order]', page.body).forEach(function (row) {
      row.addEventListener('click', function () { DS.openOrder(row.getAttribute('data-order')); });
    });
    DS.$$('[data-days]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { range = Number(b.getAttribute('data-days')); render(); });
    });
    DS.$$('[data-add-product]', page.body).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        DS.productModal({ tenantId: isAdmin ? DS.data.tenants[0].id : user.tenant_id, onSave: render });
      });
    });
    DS.$$('[data-quick-add-user]', page.body).forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); openQuickAddUser(); });
    });
    DS.$$('[data-add-driver]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { openDriverModal(null); });
    });
    DS.$$('[data-edit-driver]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { openDriverModal(DS.data.userById(b.getAttribute('data-edit-driver'))); });
    });
    DS.$$('[data-toggle-driver]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var d = DS.data.userById(b.getAttribute('data-toggle-driver'));
        if (!d) return;
        DS.data.saveUser({ id: d.id, is_active: d.is_active === false });
        DS.toast(t('updated'), 'success');
        render();
      });
    });
    DS.$$('[data-del-driver]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        DS.confirm({ title: t('confirmDelete'), text: t('confirmDeleteText'), danger: true }).then(function (ok) {
          if (!ok) return;
          DS.data.deleteUser(b.getAttribute('data-del-driver'));
          DS.toast(t('deleted'), 'success');
          render();
        });
      });
    });
    DS.$$('[data-owner-tab]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        view.tab = b.getAttribute('data-owner-tab') === 'branches' ? 'branches' : 'overview';
        render();
      });
    });
    DS.$$('[data-add-branch]', page.body).forEach(function (b) {
      b.addEventListener('click', openAddBranch);
    });
    DS.$$('[data-branch-select]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        view.tab = 'branches';
        view.branch = b.getAttribute('data-branch-select');
        render();
      });
    });
    bindBranchTransfer();
  }

  function bindBranchTransfer() {
    var btn = page.body.querySelector('[data-branch-transfer]');
    if (!btn) return;
    var prod = page.body.querySelector('[data-tr-product]');
    var dist = page.body.querySelector('[data-tr-dist]');
    if (prod && dist) {
      prod.addEventListener('change', function () { dist.innerHTML = distributionMarkup(prod.value); });
    }
    btn.addEventListener('click', function () {
      var EN = DS.lang() === 'en';
      var from = page.body.querySelector('[data-tr-from]');
      var to = page.body.querySelector('[data-tr-to]');
      var qtyEl = page.body.querySelector('[data-tr-qty]');
      var qty = Math.max(1, Number(qtyEl && qtyEl.value) || 0);
      var productId = prod && prod.value;
      if (!productId || !from || !to) return;
      if (from.value === to.value) { DS.toast(EN ? 'Pick two different branches' : 'اختر فرعين مختلفين', 'error'); return; }
      var list = branches();
      var fromB = list.filter(function (b) { return b.id === from.value; })[0];
      var toB = list.filter(function (b) { return b.id === to.value; })[0];
      var product = DS.data.visibleProducts(user).filter(function (p) { return p.id === productId; })[0];
      if (!transferStock(productId, from.value, to.value, qty)) {
        DS.toast(EN ? 'Not enough stock in the source branch' : 'الكمية غير متاحة في الفرع المصدر', 'error');
        return;
      }
      DS.toast(EN
        ? 'Moved ' + qty + ' × ' + (product ? (product.name_en || product.name) : '') + ' from ' + branchName(fromB) + ' to ' + branchName(toB)
        : 'تم نقل ' + qty + ' قطعة من ' + branchName(fromB) + ' إلى ' + branchName(toB), 'success');
      render();
    });
  }

  window.addEventListener('ds:order-updated', function () { render(); });
  window.addEventListener('ds:data-changed', function () { render(); });
  setTimeout(render, 180);
})();
