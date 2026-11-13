/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — DRAGON SUITE PAGE
   One screen that hosts the ten Dragon engines. Every card is live:
   it reads the demo database, reacts to clicks and writes back.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  if (!DS.dragon) { console.warn('[dragon] engine missing'); return; }

  var isAdmin = DS.data.isAdmin(user);
  var isOwner = user.role === 'owner';
  if (!isAdmin && !isOwner) { location.replace(url(DS.roleHome(user))); return; }

  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : ['owner'],
    active: 'dragon',
    title: DS.lang() === 'en' ? 'Dragon suite' : 'حزمة التنين',
    eyebrow: isAdmin ? t('admin') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'sparkles',
    sub: DS.lang() === 'en'
      ? 'Twelve growth engines — AR, voice, pricing, loyalty, wholesale, heatmaps and more.'
      : 'اثنا عشر محرك نمو — الواقع المعزز، الصوت، التسعير، الولاء، الجملة، الخرائط الحرارية والمزيد.',
    content: DS.skeleton.cards(6)
  });
  if (!page) return;

  var EN = DS.lang() === 'en';
  var state = { tab: 'all' };

  /* ─────────────────────────── helpers ─────────────────────────── */
  function L(ar, en) { return EN ? en : ar; }
  function products() { return DS.dragon.scopeProducts(); }
  function orders() { return DS.dragon.scopeOrders(); }

  function card(opts) {
    return '<section class="card dr-card" id="dr-' + esc(opts.id) + '">' +
      '<div class="card-header dr-card-head">' +
        '<div><div class="card-title"><span class="dr-ico">' + icon(opts.icon) + '</span>' + esc(opts.title) + '</div>' +
        '<div class="card-subtitle">' + esc(opts.sub) + '</div></div>' +
        '<span class="badge lime">#' + esc(opts.n) + '</span>' +
      '</div>' +
      '<div class="card-body dr-card-body">' + opts.body + '</div>' +
      '</section>';
  }

  /* ── 1 · AR Shopping ─────────────────────────────────────────── */
  function arBody() {
    var list = products().slice(0, 6);
    if (!list.length) return DS.empty({ icon: 'box', title: t('noData'), text: '' });
    return '<p class="dr-hint">' + esc(L(
      'افتح الكاميرا وجرّب المنتج في مكانك قبل الشراء.',
      'Open the camera and try the product in your space before you buy.')) + '</p>' +
      '<div class="dr-ar-picks">' + list.map(function (p) {
        return '<button type="button" class="dr-ar-item" data-ar="' + esc(p.id) + '">' +
          '<img src="' + esc(DS.data.img(p.image)) + '" alt="">' +
          '<span><b>' + esc(DS.loc(p, 'name')) + '</b><i>' + money(p.price) + '</i></span></button>';
      }).join('') + '</div>';
  }

  /* ── 2 · Voice POS ───────────────────────────────────────────── */
  function voiceBody() {
    var commands = [
      { cmd: 'add', ar: '«أضف عصير مانجو»', en: '“add mango juice”' },
      { cmd: 'remove', ar: '«احذف ميلك شيك»', en: '“remove milkshake”' },
      { cmd: 'total', ar: '«كم المجموع»', en: '“what is the total”' },
      { cmd: 'pay', ar: '«ادفع»', en: '“pay”' },
      { cmd: 'clear', ar: '«امسح السلة»', en: '“clear the cart”' }
    ];
    return '<p class="dr-hint">' + esc(L(
      'اضغط الميكروفون وتكلم — نقطة البيع ينفّذ الأمر فوراً.',
      'Hit the microphone and speak — the till executes the command instantly.')) + '</p>' +
      '<div class="dr-voice-bar">' +
        '<button type="button" class="btn btn-primary" data-voice>' + icon('mic') + '<span>' + esc(L('ابدأ الاستماع', 'Start listening')) + '</span></button>' +
        '<span class="dr-voice-status" data-voice-status>' + esc(L('جاهز', 'Ready')) + '</span>' +
      '</div>' +
      '<div class="dr-voice-log" data-voice-log>' + esc(L('الأوامر المسموعة تظهر هنا.', 'Heard commands appear here.')) + '</div>' +
      '<ul class="dr-cmd-list">' + commands.map(function (c) {
        return '<li><code>' + esc(EN ? c.en : c.ar) + '</code></li>';
      }).join('') + '</ul>';
  }

  /* ── 3 · Dynamic pricing ─────────────────────────────────────── */
  function pricingBody() {
    var list = products().map(function (p) {
      var s = DS.dragon.priceSuggestion(p);
      return { p: p, s: s };
    }).filter(function (x) { return x.s && x.s.direction !== 'flat'; })
      .sort(function (a, b) { return Math.abs(b.s.pct) - Math.abs(a.s.pct); })
      .slice(0, 5);
    if (!list.length) return DS.empty({ icon: 'tag', title: t('noData'), text: '' });
    return '<p class="dr-hint">' + esc(L(
      'السعر المقترح مبني على الطلب، هامش الربح والمخزون.',
      'The suggested price follows demand, margin and stock cover.')) + '</p>' +
      '<div class="dr-price-list">' + list.map(function (x) {
        return '<div class="dr-price-row">' +
          '<div><b>' + esc(DS.loc(x.p, 'name')) + '</b><span>' + esc(x.s.reasons.join(' · ')) + '</span></div>' +
          '<div class="dr-price-nums"><s>' + money(x.s.current) + '</s><strong class="is-' + x.s.direction + '">' + money(x.s.suggested) + '</strong>' +
          '<span class="badge ' + (x.s.direction === 'up' ? 'success' : 'warning') + '">' + (x.s.delta > 0 ? '+' : '') + x.s.pct + '%</span></div>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-price-apply="' + esc(x.p.id) + '">' + esc(L('تطبيق', 'Apply')) + '</button>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* ── 4 · Spin-to-Win ─────────────────────────────────────────── */
  function wheelBody() {
    var st = DS.data.getExtra('wheel', null);
    var spins = st && st.spins ? st.spins : 0;
    var coupons = (st && st.coupons) || [];
    return '<p class="dr-hint">' + esc(L(
      'عجلة الحظ تمنح العميل خصماً حقيقياً يُطبّق على الطلب.',
      'The lucky wheel hands the customer a real discount applied to the order.')) + '</p>' +
      '<div class="dr-wheel-preview">' + DS.dragon.WHEEL_PRIZES.map(function (p) {
        return '<span class="dr-wheel-chip">' + esc(EN ? p.en : p.ar) + '</span>';
      }).join('') + '</div>' +
      '<div class="dr-row-actions">' +
        '<button type="button" class="btn btn-primary" data-spin>' + icon('sparkles') + esc(L('دور العجلة', 'Spin the wheel')) + '</button>' +
        '<span class="dr-muted">' + esc(L('عدد الأدوار', 'Spins')) + ': <b>' + spins + '</b> · ' + esc(L('كوبونات', 'Coupons')) + ': <b>' + coupons.length + '</b></span>' +
      '</div>';
  }

  /* ── 5 · Automated purchase orders ────────────────────────────── */
  function poBody() {
    var list = DS.dragon.purchaseOrders();
    var drafts = list.filter(function (x) { return x.status === 'draft'; });
    if (!drafts.length) return '<p class="dr-hint">' + esc(L(
      'كل المنتجات فوق حد المخزون — لا توجد أوامر شراء الآن.',
      'Every product is above its minimum stock — no purchase orders right now.')) + '</p>';
    return '<p class="dr-hint">' + esc(L(
      'أمر شراء آلي لكل منتج تحت الحد الأدنى — اعتمده بضغطة.',
      'An automatic purchase order for every product under its minimum — approve in one click.')) + '</p>' +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>' + esc(t('products')) + '</th><th>' + esc(t('stock')) + '</th><th>' + esc(L('الكمية المطلوبة', 'Suggested qty')) + '</th><th>' + esc(t('total')) + '</th><th></th></tr></thead><tbody>' +
      drafts.map(function (po) {
        return '<tr><td><b>' + esc(po.product_name) + '</b><div class="cell-sub">' + esc(po.sku) + '</div></td>' +
          '<td><span class="badge warning">' + po.stock + ' / ' + po.min_stock + '</span></td>' +
          '<td>' + po.qty + '</td><td><b>' + money(po.total) + '</b></td>' +
          '<td><button type="button" class="btn btn-primary btn-sm" data-po-approve="' + esc(po.id) + '">' + icon('check') + esc(L('اعتماد', 'Approve')) + '</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ── 6 · B2B wholesale ───────────────────────────────────────── */
  function wholesaleBody() {
    var list = products().slice(0, 4);
    if (!list.length) return DS.empty({ icon: 'box', title: t('noData'), text: '' });
    return '<p class="dr-hint">' + esc(L(
      'أسعار الجملة تلقائياً حسب الكمية — جاهزة لعروض B2B.',
      'Automatic volume pricing — ready for your B2B resellers.')) + '</p>' +
      '<div class="dr-tier-list">' + list.map(function (p) {
        var tiers = DS.dragon.wholesaleTiers(p);
        return '<div class="dr-tier-row">' +
          '<div class="dr-tier-name"><img src="' + esc(DS.data.img(p.image)) + '" alt=""><b>' + esc(DS.loc(p, 'name')) + '</b><span>' + esc(L('سعر الوحدة', 'Unit price')) + ': ' + money(p.price) + '</span></div>' +
          '<div class="dr-tier-cells">' + tiers.map(function (t) {
            return '<span class="dr-tier' + (t.available ? '' : ' is-off') + '"><b>' + t.min + '+</b>' + money(t.price) + '<i>−' + t.off + '%</i></span>';
          }).join('') + '</div>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* ── 7 · Heatmaps ────────────────────────────────────────────── */
  function heatmapBody() {
    var hm = DS.dragon.salesHeatmap(orders());
    if (!hm.max) {
      return '<p class="dr-hint">' + esc(L(
        'لا توجد طلبات كافية بعد لرسم الخريطة الحرارية.',
        'Not enough orders yet to draw the heatmap.')) + '</p>';
    }
    var head = '<div class="dr-heat-hours">' + hm.hours.map(function (h) {
      return '<span>' + (h % 3 === 0 ? h : '') + '</span>';
    }).join('') + '</div>';
    var rows = hm.grid.map(function (row, d) {
      return '<div class="dr-heat-row"><span class="dr-heat-day">' + esc(hm.days[d]) + '</span>' +
        row.map(function (v) {
          return '<i style="' + DS.dragon.heatmapCellStyle(v, hm.max) + '" title="' + esc(hm.days[d] + ' · ' + money(v)) + '"></i>';
        }).join('') + '</div>';
    }).join('');
    return '<p class="dr-hint">' + esc(L(
      'أكثر يوم مبيعاً: ' + hm.days[hm.best.day] + ' — أعلى ساعة: ' + hm.best.hour + ':00.',
      'Busiest day: ' + hm.days[hm.best.day] + ' — peak hour: ' + hm.best.hour + ':00.')) + '</p>' +
      '<div class="dr-heatmap">' + head + rows + '</div>';
  }

  /* ── 8 · WhatsApp storefront ─────────────────────────────────── */
  function waBody() {
    var tenants = isAdmin ? DS.data.tenants : DS.data.tenants.filter(function (tn) { return tn.id === user.tenant_id; });
    var links = tenants.map(function (tn) {
      return '<div class="dr-wa-row">' +
        '<img src="' + esc(DS.avatarUrl(tn)) + '" alt=""><div><b>' + esc(DS.loc(tn, 'name')) + '</b><span>' + esc(L('رابط متجر واتساب جاهز للمشاركة', 'A ready-to-share WhatsApp storefront link')) + '</span></div>' +
        '<a class="btn btn-secondary btn-sm" href="' + esc(DS.dragon.whatsappCatalogLink(tn)) + '" target="_blank" rel="noopener">' + icon('whatsapp') + esc(L('مشاركة', 'Share')) + '</a>' +
        '</div>';
    }).join('');
    var copy = '<div class="dr-wa-copy"><code>' + esc(DS.dragon.whatsappCatalogLink(tenants[0] || {})) + '</code>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-wa-copy>' + icon('copy') + esc(L('نسخ', 'Copy')) + '</button></div>';
    return '<p class="dr-hint">' + esc(L(
      'شارك المتجر على واتساب — الطلب يصلك في المحادثة نفسها.',
      'Share the storefront on WhatsApp — orders land straight in the chat.')) + '</p>' +
      links + copy;
  }

  /* ── 9 · Expiry tracking ─────────────────────────────────────── */
  function expiryBody() {
    var alerts = DS.dragon.expiryAlerts();
    if (!alerts.length) return '<p class="dr-hint">' + esc(L(
      'لا توجد منتجات قاربت على انتهاء الصلاحية.',
      'No product is close to its expiry date.')) + '</p>';
    return '<p class="dr-hint">' + esc(L(
      'تتبّع الصلاحية يمنع الت sell-outke لا — ينبّهك قبل انتهاء المنتج.',
      'Expiry tracking warns you before a product dies on the shelf.')) + '</p>' +
      '<div class="dr-expiry-list">' + alerts.map(function (x) {
        return '<div class="dr-expiry-row is-' + x.status.state + '">' +
          '<img src="' + esc(DS.data.img(x.product.image)) + '" alt="">' +
          '<div><b>' + esc(DS.loc(x.product, 'name')) + '</b><span>' + esc(x.status.label) + '</span></div>' +
          '<span class="badge ' + (x.status.state === 'expired' ? 'danger' : (x.status.state === 'critical' ? 'warning' : 'neutral')) + '">' + esc(x.status.state) + '</span>' +
          (x.status.discount ? '<button type="button" class="btn btn-secondary btn-sm" data-expiry-mark="' + esc(x.product.id) + '">' + esc(L('خصم', 'Discount') + ' ' + x.status.discount + '%') + '</button>' : '') +
        '</div>';
      }).join('') + '</div>';
  }

  /* ── 10 · Churn prediction ───────────────────────────────────── */
  function churnBody() {
    var rank = DS.dragon.churnRanking();
    if (!rank.length) return '<p class="dr-hint">' + esc(L(
      'لا يوجد عملاء بعد لقياس احتمال المغادرة.',
      'No customers yet to measure churn against.')) + '</p>';
    var top = rank.slice(0, 6);
    return '<p class="dr-hint">' + esc(L(
      'درجة المغادرة = طول الفترة بلا طلب + عدد الطلبات + قيمة العميل.',
      'Churn score = time since last order + order count + customer value.')) + '</p>' +
      '<div class="dr-churn-list">' + top.map(function (x) {
        return '<div class="dr-churn-row">' +
          '<div class="dr-churn-name"><b>' + esc(EN ? (x.customer.name_en || x.customer.name) : x.customer.name) + '</b>' +
          '<span>' + esc(x.customer.orders + ' ' + L('طلب', 'orders') + ' · ' + money(x.customer.spent)) + '</span></div>' +
          '<div class="dr-churn-meter"><i style="width:' + x.churn.score + '%" class="is-' + x.churn.level + '"></i></div>' +
          '<span class="badge ' + (x.churn.level === 'high' ? 'danger' : (x.churn.level === 'medium' ? 'warning' : 'success')) + '">' + x.churn.score + '%</span>' +
          '<span class="dr-churn-action">' + esc(x.churn.action) + '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  /* ── 11 · Market basket (bought together) ────────────────────── */
  function productName(id) {
    var p = (DS.data.products || []).filter(function (x) { return x.id === id; })[0];
    return p ? DS.loc(p, 'name') : id;
  }
  function basketMarkup(res) {
    var list = (res && res.pairs) || [];
    if (!list.length) return '<p class="dr-hint">' + esc(L(
      'لا توجد سلات كافية بعد — أنشئ طلبات متعددة المنتجات.',
      'Not enough multi-item baskets yet — create a few orders.')) + '</p>';
    return '<p class="dr-hint">' + esc(L(
      'المنتجات التي تُشترى معاً — فرص بيع إضافي مبنية على ' + (res.baskets || 0) + ' سلة.',
      'Products bought together — cross-sell ideas from ' + (res.baskets || 0) + ' baskets.')) + '</p>' +
      '<div class="dr-basket-list">' + list.map(function (x) {
        var pct = Math.min(100, Math.round((x.support || 0) * 100));
        var lift = Math.round((x.lift || 0) * 10) / 10;
        return '<div class="dr-basket-row">' +
          '<div class="dr-basket-pair"><b>' + esc(productName(x.a)) + '</b><i>+</i><b>' + esc(productName(x.b)) + '</b></div>' +
          '<div class="dr-basket-meta"><span class="badge lime">' + pct + '%</span><span class="dr-muted">lift ' + lift + '×</span></div>' +
          '<i class="dr-basket-bar"><b style="width:' + Math.min(100, Math.round(lift * 22)) + '%"></b></i>' +
        '</div>';
      }).join('') + '</div>';
  }
  function basketBody() { return '<div data-basket-body>' + basketMarkup(DS.marketBasket(orders())) + '</div>'; }

  /* ── 12 · AI demand forecasting ──────────────────────────────── */
  function forecastMarkup(res) {
    var rows = ((res && res.rows) || []).slice(0, 8);
    if (!rows.length) return '<p class="dr-hint">' + esc(L(
      'لا توجد بيانات كافية للتنبؤ بالطلب بعد.',
      'Not enough trade yet to forecast demand.')) + '</p>';
    return '<p class="dr-hint">' + esc(L(
      'توقّع الطلب لـ 7 أيام القادمة من مبيعات آخر 30 يوماً — مع كمية إعادة الطلب.',
      'A 7-day demand forecast from the last 30 days — with the reorder quantity.')) + '</p>' +
      '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>' + esc(t('products')) + '</th><th>' + esc(L('7 أيام', '7 days')) + '</th><th>' + esc(L('تغطية', 'Cover')) + '</th><th>' + esc(L('الحالة', 'Status')) + '</th>' +
      '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><td><b>' + esc(EN ? (r.name_en || r.name) : r.name) + '</b>' +
          '<div class="cell-sub">' + r.sold_30d + ' ' + esc(L('مبيعات / 30 يوم', 'sold / 30d')) + '</div></td>' +
          '<td><b>' + r.next_7d + '</b></td>' +
          '<td>' + (r.days_cover == null ? '—' : r.days_cover + ' ' + esc(L('يوم', 'd'))) + '</td>' +
          '<td>' + (r.reorder
            ? '<span class="badge danger">' + esc(L('اطلب', 'Reorder')) + ' · ' + r.suggested_qty + '</span>'
            : '<span class="badge success">' + esc(L('متوفر', 'Covered')) + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function forecastBody() { return '<div data-forecast-body>' + forecastMarkup(DS.demandForecast(products(), orders())) + '</div>'; }

  /* Recompute both heavy engines off the main thread after paint. */
  function runInsights() {
    if (!DS.workerRun || !page.body) return;
    DS.workerRun('market-basket', { orders: orders() }, function (res) {
      var host = page.body.querySelector('[data-basket-body]');
      if (host && res) host.innerHTML = basketMarkup(res);
    });
    DS.workerRun('forecast', { products: products(), orders: orders() }, function (res) {
      var host = page.body.querySelector('[data-forecast-body]');
      if (host && res) host.innerHTML = forecastMarkup(res);
    });
  }

  /* ─────────────────────────── render ─────────────────────────── */
  function render() {
    var orderCount = orders().length;
    var cards = [
      { id: 'ar', icon: 'sparkles', title: L('التسوق بالواقع المعزز', 'AR shopping'), sub: L('جرّب المنتج بالكاميرا', 'Try the product with your camera'), body: arBody() },
      { id: 'voice', icon: 'mic', title: L('نقطة البيع الصوتية', 'Voice POS'), sub: L('أوامر صوتية لنقطة البيع', 'Voice commands for the till'), body: voiceBody() },
      { id: 'pricing', icon: 'tag', title: L('التسعير الديناميكي', 'Dynamic pricing'), sub: L('سعر يتبع الطلب والمخزون', 'A price that follows demand'), body: pricingBody() },
      { id: 'wheel', icon: 'gift', title: L('عجلة الحظ', 'Spin to win'), sub: L('خصومات حقيقية للعملاء', 'Real discounts for customers'), body: wheelBody() },
      { id: 'po', icon: 'box', title: L('أوامر الشراء الآلية', 'Automated purchase orders'), sub: L('لا تنفد مخزونك أبداً', 'Never run out of stock'), body: poBody() },
      { id: 'b2b', icon: 'users', title: L('الجملة B2B', 'B2B wholesale'), sub: L('أسعار حسب الكمية', 'Volume pricing tiers'), body: wholesaleBody() },
      { id: 'heat', icon: 'chart', title: L('الخرائط الحرارية', 'Heatmaps'), sub: L('متى يبيع متجرك فعلاً', 'When your store really sells'), body: heatmapBody() },
      { id: 'wa', icon: 'whatsapp', title: L('متجر واتساب', 'WhatsApp storefront'), sub: L('بيع داخل المحادثة', 'Sell inside the chat'), body: waBody() },
      { id: 'expiry', icon: 'clock', title: L('تتبع الصلاحية', 'Expiry tracking'), sub: L('تنبيه قبل انتهاء المنتج', 'Warn before a product expires'), body: expiryBody() },
      { id: 'churn', icon: 'trendingUp', title: L('توقع المغادرة', 'Churn prediction'), sub: L('من على وشك الرحيل', 'Who is about to leave'), body: churnBody() },
      { id: 'basket', icon: 'bag', title: L('تحليل سلة السوق', 'Market basket'), sub: L('المنتجات التي تُشترى معاً', 'What gets bought together'), body: basketBody() },
      { id: 'forecast', icon: 'zap', title: L('التنبؤ بالطلب AI', 'AI demand forecasting'), sub: L('توقّع مبيعات 7 أيام قادمة', '7-day demand forecast'), body: forecastBody() }
    ];
    var banner = orderCount ? '' :
      '<div class="dr-empty-banner">' + icon('sparkles') +
      '<div><b>' + esc(L('قاعدة البيانات نظيفة — لا توجد طلبات بعد', 'Clean database — no orders yet')) + '</b>' +
      '<span>' + esc(L('أنشئ بيانات تجريبية لتفعيل الخريطة الحرارية وتوقع المغادرة وأوامر الشراء.',
        'Generate demo trade to activate the heatmap, churn model and purchase orders.')) + '</span></div>' +
      '<button type="button" class="btn btn-primary btn-sm" data-seed>' + icon('zap') + esc(L('توليد بيانات تجريبية', 'Generate demo data')) + '</button></div>';
    page.setContent(banner + '<div class="dr-grid">' + cards.map(function (c, i) {
      return card({ id: c.id, icon: c.icon, title: c.title, sub: c.sub, body: c.body, n: i + 1 });
    }).join('') + '</div>');
    bind();
  }

  /* ─────────────────────────── events ─────────────────────────── */
  function bind() {
    var seed = page.body.querySelector('[data-seed]');
    if (seed) seed.addEventListener('click', function () {
      var made = DS.dragon.seedDemoOrders(26);
      DS.toast(L('تم إنشاء ', 'Created ') + made + L(' طلب تجريبي', ' demo orders'), 'success');
      render();
    });

    DS.$$('[data-ar]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = products().filter(function (x) { return x.id === b.getAttribute('data-ar'); })[0];
        if (p) DS.dragon.openAR(p);
      });
    });

    var voiceBtn = page.body.querySelector('[data-voice]');
    var voiceStatus = page.body.querySelector('[data-voice-status]');
    var voiceLog = page.body.querySelector('[data-voice-log]');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', function () {
        var log = function (msg) { if (voiceLog) voiceLog.innerHTML = esc(msg); };
        var voice = DS.dragon.voicePOS({
          onState: function (on) {
            if (voiceStatus) voiceStatus.textContent = on ? L('يستمع…', 'Listening…') : L('جاهز', 'Ready');
            voiceBtn.classList.toggle('is-live', on);
          },
          onHeard: function (parsed, text) { log(text); },
          onError: function () { log(L('تعذّر الاستماع — جرّب مرة أخرى.', 'Could not listen — try again.')); },
          add: function (parsed) {
            var list = products();
            var q = (parsed.query || '').trim();
            var hit = list.filter(function (p) {
              return (p.name + ' ' + (p.name_en || '') + ' ' + (p.category || '')).toLowerCase().indexOf(q) > -1;
            })[0];
            log(hit ? (L('أضفنا: ', 'Added: ') + DS.loc(hit, 'name')) : (L('لم أجد: ', 'Not found: ') + q));
            if (hit) DS.toast(L('تمت إضافة ', 'Added ') + DS.loc(hit, 'name'), 'success');
          },
          remove: function (parsed) { log(L('تم حذف: ', 'Removed: ') + (parsed.query || '')); },
          total: function () {
            var sum = DS.data.orders.slice(-1)[0];
            log(L('إجمالي آخر طلب: ', 'Last order total: ') + money(sum ? sum.total : 0));
          },
          pay: function () { log(L('تم تجهيز الدفع.', 'Payment is ready.')); DS.toast(L('جاهز للدفع', 'Ready to pay'), 'success'); },
          clear: function () { log(L('تم مسح السلة.', 'The cart is empty now.')); }
        });
        if (voice.supported) voice.start();
      });
    }

    DS.$$('[data-price-apply]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = products().filter(function (x) { return x.id === b.getAttribute('data-price-apply'); })[0];
        if (!p) return;
        var s = DS.dragon.priceSuggestion(p);
        if (!s) return;
        DS.dragon.applySuggestedPrice(p.id, s.suggested);
        DS.toast(L('السعر الجديد: ', 'New price: ') + money(s.suggested), 'success');
        render();
      });
    });

    var spin = page.body.querySelector('[data-spin]');
    if (spin) spin.addEventListener('click', function () { DS.dragon.spinWheel(); render(); });

    DS.$$('[data-po-approve]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var po = DS.dragon.approvePurchaseOrder(b.getAttribute('data-po-approve'));
        if (po) DS.toast(L('تم اعتماد أمر الشراء: ', 'Purchase order approved: ') + po.product_name, 'success');
        render();
      });
    });

    DS.$$('[data-expiry-mark]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var p = products().filter(function (x) { return x.id === b.getAttribute('data-expiry-mark'); })[0];
        if (!p) return;
        var st = DS.dragon.expiryStatus(p);
        var cut = Math.round((Number(p.price) || 0) * (1 - (st.discount || 10) / 100));
        DS.data.updateProduct({ id: p.id, price: cut });
        DS.toast(L('تم خصم ', 'Marked down to ') + money(cut), 'success');
        render();
      });
    });

    var copy = page.body.querySelector('[data-wa-copy]');
    if (copy) copy.addEventListener('click', function () {
      var code = page.body.querySelector('.dr-wa-copy code');
      if (!code) return;
      if (DS.copy) DS.copy(code.textContent);
      DS.toast(t('copied'), 'success');
    });

    /* Cards 11 + 12 refresh asynchronously from worker.js. */
    setTimeout(runInsights, 60);
  }

  setTimeout(render, 150);
})();
