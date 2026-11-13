/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — DRAGON SUITE
   Ten offline-first engines that turn the plain POS into a growth
   machine. Every engine is deterministic (no network, no API keys)
   and strictly tenant-scoped.

   1 · AR Shopping          → DS.dragon.openAR(product)
   2 · Voice POS            → DS.dragon.voicePOS(handlers)
   3 · Dynamic Pricing      → DS.dragon.priceSuggestion(product)
   4 · Spin-to-Win          → DS.dragon.spinWheel()
   5 · Automated POs        → DS.dragon.purchaseOrders()
   6 · B2B Wholesale        → DS.dragon.wholesaleTiers(product)
   7 · Heatmaps             → DS.dragon.salesHeatmap()
   8 · WhatsApp Storefront  → DS.dragon.whatsappLink(text)
   9 · Expiry Tracking      → DS.dragon.expiryStatus(product)
  10 · Churn Prediction     → DS.dragon.churnScore(customer)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before dragon.js'); return; }

  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var EN = DS.lang() === 'en';

  /* ─────────────────────────── helpers ─────────────────────────── */
  function user() { return DS.session(); }
  function isAdmin(u) { return !!(u && (u.role === 'superadmin' || u.role === 'subadmin')); }
  function tenantScope(u) {
    u = u || user();
    if (!u) return null;
    if (isAdmin(u)) return null;                    /* every tenant */
    if (u.role === 'owner' || u.role === 'cashier') return u.tenant_id || null;
    return null;
  }
  function scopeProducts(u) {
    u = u || user();
    if (!u) return [];
    var tid = tenantScope(u);
    return DS.data.visibleProducts(u, tid).filter(function (p) { return p.is_active !== false; });
  }
  function scopeOrders(u) {
    u = u || user();
    if (!u) return [];
    return DS.data.visibleOrders(u);
  }
  function daysBetween(a, b) { return Math.abs((new Date(b) - new Date(a)) / 86400000); }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  /* Stable pseudo-random from a string — same input, same result. */
  function hash(str) {
    var h = 2166136261;
    str = String(str || '');
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }
  function pickFrom(arr, seed) {
    if (!arr.length) return null;
    return arr[hash(seed) % arr.length];
  }

  /* ═══════════════════════════════════════════════════════════════
     1 · AR SHOPPING — try a product in your own space
     ═══════════════════════════════════════════════════════════════ */
  function openAR(product) {
    if (!product) return null;
    var img = DS.data.img(product.image);
    var name = DS.lang() === 'en' ? (product.name_en || product.name) : product.name;
    var price = money(product.price);
    var stream = null;
    var video = null;

    var body =
      '<div class="dr-ar" data-ar-stage>' +
        '<video class="dr-ar-video" data-ar-video playsinline muted autoplay></video>' +
        '<div class="dr-ar-fallback" data-ar-fallback>' +
          '<img src="' + esc(img) + '" alt="">' +
          '<div class="dr-ar-grid"></div>' +
          '<span class="dr-ar-hint">' + icon('camera') + esc(EN ? 'Point your camera at the product' : 'وجّه الكاميرا نحو المنتج') + '</span>' +
        '</div>' +
        '<div class="dr-ar-product" data-ar-product>' +
          '<img src="' + esc(img) + '" alt="' + esc(name) + '">' +
        '</div>' +
      '</div>' +
      '<div class="dr-ar-meta">' +
        '<div><b>' + esc(name) + '</b><span>' + esc(DS.loc(product, 'category')) + ' · ' + price + '</span></div>' +
        '<div class="dr-ar-controls">' +
          '<button type="button" class="btn btn-secondary btn-sm" data-ar-toggle>' + icon('camera') + esc(EN ? 'Camera' : 'الكاميرا') + '</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-ar-rotate>' + icon('refresh') + esc(EN ? 'Rotate' : 'تدوير') + '</button>' +
        '</div>' +
      '</div>';

    var m = DS.modal({
      size: 'md',
      title: icon('sparkles') + ' ' + esc(EN ? 'AR shopping' : 'التسوق بالواقع المعزز'),
      sub: name,
      body: body,
      className: 'dr-ar-backdrop',
      actions: [
        { label: EN ? 'Add to bag' : 'أضف للسلة', variant: 'btn-primary', onClick: function () {
            if (typeof DS.dragonAddToBag === 'function') DS.dragonAddToBag(product);
            else DS.toast(EN ? 'Added to bag' : 'أُضيف إلى سلتك', 'success');
            return true;
          } },
        { label: t('close'), variant: 'btn-secondary' }
      ],
      onMount: function (root) {
        var stage = root.querySelector('[data-ar-stage]');
        var vid = root.querySelector('[data-ar-video]');
        var fallback = root.querySelector('[data-ar-fallback]');
        var item = root.querySelector('[data-ar-product]');
        var rotate = 0;

        function stopCamera() {
          if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} stream = null; }
          if (video) { try { video.srcObject = null; } catch (e) {} }
          if (vid) vid.style.display = 'none';
          if (fallback) fallback.style.display = '';
        }
        function startCamera() {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            DS.toast(EN ? 'Camera not available — showing the studio view' : 'الكاميرا غير متاحة — عرض الاستوديو', 'info');
            return;
          }
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (s) {
            stream = s;
            if (!vid) return;
            vid.srcObject = s;
            vid.style.display = 'block';
            if (fallback) fallback.style.display = 'none';
            try { vid.play(); } catch (e) {}
          }).catch(function () {
            DS.toast(EN ? 'Camera permission denied — showing the studio view' : 'تم رفض إذن الكاميرا — عرض الاستوديو', 'info');
          });
        }
        var toggle = root.querySelector('[data-ar-toggle]');
        if (toggle) toggle.addEventListener('click', function () {
          if (stream) stopCamera(); else startCamera();
        });
        var rot = root.querySelector('[data-ar-rotate]');
        if (rot) rot.addEventListener('click', function () {
          rotate = (rotate + 45) % 360;
          if (item) item.style.transform = 'translate(-50%, -50%) rotate(' + rotate + 'deg)';
        });
        /* Gentle float so the product reads as "in the room". */
        if (item) {
          item.style.animation = 'drFloat 5s ease-in-out infinite';
          if (stage) stage.setAttribute('data-ar-live', '1');
        }
      },
      onClose: function () {
        if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
      }
    });
    return m;
  }

  /* ═══════════════════════════════════════════════════════════════
     2 · VOICE POS — run the till with your voice
     ═══════════════════════════════════════════════════════════════ */
  var VOICE_AR = {
    add: ['أضف', 'ضيف', 'ابغى', 'أبغى', 'add'],
    remove: ['احذف', 'شيل', 'remove', 'delete'],
    clear: ['امسح', 'فرّغ', 'clear', 'empty'],
    pay: ['ادفع', 'فاتورة', 'ختم', 'pay', 'checkout'],
    total: ['كم المجموع', 'الإجمالي', 'total'],
    cancel: ['إلغاء', 'cancel', 'stop']
  };

  function voicePOS(handlers) {
    handlers = handlers || {};
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var state = { listening: false, rec: null, last: '' };
    if (!SR) {
      DS.toast(EN ? 'Voice control is not supported in this browser' : 'التحكم الصوتي غير مدعوم في هذا المتصفح', 'warning');
      return { supported: false, start: function () {}, stop: function () {} };
    }
    function parse(text) {
      var t2 = String(text || '').toLowerCase();
      if (VOICE_AR.clear.some(function (k) { return t2.indexOf(k) > -1; })) return { cmd: 'clear', raw: text };
      if (VOICE_AR.pay.some(function (k) { return t2.indexOf(k) > -1; })) return { cmd: 'pay', raw: text };
      if (VOICE_AR.total.some(function (k) { return t2.indexOf(k) > -1; })) return { cmd: 'total', raw: text };
      if (VOICE_AR.cancel.some(function (k) { return t2 === k || t2.indexOf(k + ' ') === 0; })) return { cmd: 'cancel', raw: text };
      if (VOICE_AR.add.some(function (k) { return t2.indexOf(k) > -1; })) {
        var m = /(?:أضف|ضيف|ابغى|أبغى|add)\s+(.+)/.exec(t2);
        return { cmd: 'add', query: m ? m[1].trim() : '', raw: text };
      }
      if (VOICE_AR.remove.some(function (k) { return t2.indexOf(k) > -1; })) {
        var m2 = /(?:احذف|شيل|remove|delete)\s+(.+)/.exec(t2);
        return { cmd: 'remove', query: m2 ? m2[1].trim() : '', raw: text };
      }
      return { cmd: 'unknown', raw: text };
    }
    function start() {
      if (state.listening) return;
      try {
        var rec = new SR();
        rec.lang = EN ? 'en-US' : 'ar-EG';
        rec.interimResults = false;
        rec.continuous = false;
        rec.onresult = function (ev) {
          var last = ev.results[ev.results.length - 1];
          var text = last && last[0] ? last[0].transcript : '';
          state.last = text;
          var parsed = parse(text);
          if (parsed.cmd !== 'unknown' && handlers[parsed.cmd]) handlers[parsed.cmd](parsed);
          else if (handlers.onHeard) handlers.onHeard(parsed, text);
        };
        rec.onerror = function (e) { if (handlers.onError) handlers.onError(e); };
        rec.onend = function () {
          state.listening = false;
          if (handlers.onState) handlers.onState(false);
        };
        rec.start();
        state.rec = rec;
        state.listening = true;
        if (handlers.onState) handlers.onState(true);
      } catch (e) {
        if (handlers.onError) handlers.onError(e);
      }
    }
    function stop() {
      if (state.rec) { try { state.rec.stop(); } catch (e) {} }
      state.listening = false;
      if (handlers.onState) handlers.onState(false);
    }
    return { supported: true, start: start, stop: stop, parse: parse, state: state };
  }

  /* ═══════════════════════════════════════════════════════════════
     3 · DYNAMIC PRICING — the price the demand supports
     ═══════════════════════════════════════════════════════════════ */
  function priceSuggestion(product) {
    if (!product) return null;
    var price = Number(product.price) || 0;
    var cost = Number(product.cost) || 0;
    var stock = Number(product.stock) || 0;
    var minStock = Number(product.min_stock) || 0;
    var sold = Number(product.sold) || 0;
    var ratio = sold / Math.max(1, sold + stock);           /* demand share */
    var margin = price > 0 ? (price - cost) / price : 0;
    var reasons = [];
    var factor = 1;

    if (sold >= 60 && ratio > 0.55) { factor *= 1.08; reasons.push(EN ? 'Strong demand' : 'طلب مرتفع'); }
    else if (sold < 10 && stock > 20) { factor *= 0.94; reasons.push(EN ? 'Slow mover' : 'حركة بطيئة'); }

    if (minStock && stock <= minStock) { factor *= 1.05; reasons.push(EN ? 'Below min. stock' : 'أقل من الحد الأدنى'); }
    if (margin > 0.55) { factor *= 0.96; reasons.push(EN ? 'Very high margin' : 'هامش ربح مرتفع جداً'); }
    if (margin < 0.15 && margin >= 0) { factor *= 1.03; reasons.push(EN ? 'Thin margin' : 'هامش ربح منخفض'); }

    var suggested = Math.max(1, Math.round(price * factor));
    var delta = suggested - price;
    return {
      current: price,
      suggested: suggested,
      delta: delta,
      pct: price ? Math.round((delta / price) * 100) : 0,
      direction: delta > 0 ? 'up' : (delta < 0 ? 'down' : 'flat'),
      reasons: reasons.length ? reasons : [EN ? 'Price is in line with demand' : 'السعر متوافق مع الطلب'],
      confidence: clamp(60 + Math.round(ratio * 40), 40, 96)
    };
  }
  function applySuggestedPrice(productId, price) {
    var p = scopeProducts().filter(function (x) { return x.id === productId; })[0];
    if (!p) return null;
    DS.data.updateProduct({ id: p.id, price: Math.max(1, Math.round(Number(price) || p.price)) });
    return p;
  }

  /* ═══════════════════════════════════════════════════════════════
     4 · SPIN-TO-WIN — the lucky wheel
     ═══════════════════════════════════════════════════════════════ */
  var WHEEL_PRIZES = [
    { id: 'p5', type: 'percent', value: 5, ar: 'خصم 5%', en: '5% off' },
    { id: 'p10', type: 'percent', value: 10, ar: 'خصم 10%', en: '10% off' },
    { id: 'p15', type: 'percent', value: 15, ar: 'خصم 15%', en: '15% off' },
    { id: 'free', type: 'shipping', value: 0, ar: 'توصيل مجاني', en: 'Free delivery' },
    { id: 'p25', type: 'percent', value: 25, ar: 'خصم 25%', en: '25% off' },
    { id: 'try', type: 'none', value: 0, ar: 'حظ أوفر', en: 'Try again' }
  ];
  function wheelState() {
    var saved = DS.data.getExtra('wheel', null);
    return saved || { spins: 0, last: null, coupons: [] };
  }
  function spinWheel() {
    var st = wheelState();
    var u = user();
    if (!u) return null;
    /* One spin per customer per day. */
    var today = new Date().toDateString();
    if (st.last && st.last.day === today) return { already: true, prize: st.last.prize };
    var seed = (u.id || '') + '|' + today + '|' + st.spins;
    var prize = pickFrom(WHEEL_PRIZES, seed);
    st.spins++;
    st.last = { day: today, prize: prize };
    if (prize.type !== 'none') {
      st.coupons = st.coupons || [];
      st.coupons.push({ code: 'SPIN' + (st.spins) + (prize.value || ''), prize: prize, at: new Date().toISOString() });
    }
    DS.data.setExtra('wheel', st);
    return { already: false, prize: prize, coupons: st.coupons };
  }
  function openSpinWheel() {
    var result = spinWheel();
    var prize = result && result.prize;
    var segs = WHEEL_PRIZES.map(function (p) {
      return '<li class="dr-wheel-seg" style="--seg:' + esc((EN ? p.en : p.ar)) + '"><b>' + esc(EN ? p.en : p.ar) + '</b></li>';
    }).join('');
    DS.modal({
      size: 'sm',
      title: icon('sparkles') + ' ' + esc(EN ? 'Spin to win' : 'عجلة الحظ'),
      sub: EN ? 'A little surprise for your next order' : 'مفاجأة صغيرة لطلبك القادم',
      body: '<div class="dr-wheel"><ul class="dr-wheel-segs">' + segs + '</ul>' +
        '<div class="dr-wheel-hub">' + icon('gift') + '</div></div>' +
        '<p class="dr-wheel-result">' + esc(result && result.already
          ? (EN ? 'You already spun today — come back tomorrow!' : 'لقد لعبت اليوم — عد غداً!')
          : (prize ? (EN ? 'You won: ' + prize.en : 'ربحت: ' + prize.ar) : (EN ? 'Try again' : 'حظ أوفر'))) + '</p>' +
        (prize && prize.type === 'percent' ? '<p class="hint">' + esc(EN ? 'Code ' : 'الكود ') + '<b>' + esc((result.coupons || [])[result.coupons.length - 1].code) + '</b></p>' : ''),
      actions: [{ label: t('close'), variant: 'btn-primary' }]
    });
    return result;
  }

  /* ═══════════════════════════════════════════════════════════════
     5 · AUTOMATED PURCHASE ORDERS — never run out again
     ═══════════════════════════════════════════════════════════════ */
  function purchaseOrders() {
    var saved = DS.data.getExtra('purchase_orders', null);
    if (saved && saved.length) return saved;
    var list = scopeProducts().map(function (p) {
      var minStock = Number(p.min_stock) || 0;
      var stock = Number(p.stock) || 0;
      if (!minStock || stock > minStock) return null;
      var target = Math.max(minStock * 3, 10);
      var qty = Math.max(1, target - stock);
      return {
        id: 'po-' + p.id,
        product_id: p.id,
        product_name: DS.loc(p, 'name'),
        sku: p.sku || '',
        tenant_id: p.tenant_id,
        qty: qty,
        cost: Number(p.cost) || 0,
        total: round2(qty * (Number(p.cost) || 0)),
        stock: stock,
        min_stock: minStock,
        status: 'draft',
        at: new Date().toISOString()
      };
    }).filter(Boolean);
    DS.data.setExtra('purchase_orders', list);
    return list;
  }
  function approvePurchaseOrder(id) {
    var list = purchaseOrders();
    var po = list.filter(function (x) { return x.id === id; })[0];
    if (!po) return null;
    po.status = 'approved';
    po.approved_at = new Date().toISOString();
    /* Stock is topped up so the suggestion is really applied. */
    var p = scopeProducts().filter(function (x) { return x.id === po.product_id; })[0];
    if (p) DS.data.updateProduct({ id: p.id, stock: (Number(p.stock) || 0) + po.qty });
    DS.data.setExtra('purchase_orders', list);
    DS.data.audit('أمر شراء آلي: ' + po.product_name, 'Automated purchase order: ' + po.product_name, 'box');
    return po;
  }
  function refreshPurchaseOrders() {
    var list = purchaseOrders().filter(function (x) { return x.status === 'draft'; });
    var fresh = list.map(function (po) {
      var p = scopeProducts().filter(function (x) { return x.id === po.product_id; })[0];
      if (!p) return null;
      var minStock = Number(p.min_stock) || 0;
      var stock = Number(p.stock) || 0;
      if (!minStock || stock > minStock) return null;
      var target = Math.max(minStock * 3, 10);
      var qty = Math.max(1, target - stock);
      return Object.assign({}, po, {
        qty: qty, stock: stock, cost: Number(p.cost) || 0, total: round2(qty * (Number(p.cost) || 0))
      });
    }).filter(Boolean);
    var approved = purchaseOrders().filter(function (x) { return x.status !== 'draft'; });
    DS.data.setExtra('purchase_orders', fresh.concat(approved));
    return fresh;
  }

  /* ═══════════════════════════════════════════════════════════════
     6 · B2B WHOLESALE — volume tiers for resellers
     ═══════════════════════════════════════════════════════════════ */
  var WHOLESALE_TIERS = [
    { min: 10, off: 15 },
    { min: 25, off: 22 },
    { min: 50, off: 30 },
    { min: 100, off: 38 }
  ];
  function wholesaleTiers(product) {
    var price = Number(product && product.price) || 0;
    var stock = Number(product && product.stock) || 0;
    return WHOLESALE_TIERS.map(function (tier) {
      return {
        min: tier.min,
        off: tier.off,
        price: Math.round(price * (1 - tier.off / 100)),
        available: stock >= tier.min
      };
    });
  }
  function wholesalePrice(product, qty) {
    var price = Number(product && product.price) || 0;
    qty = Number(qty) || 1;
    var off = 0;
    WHOLESALE_TIERS.forEach(function (tier) { if (qty >= tier.min) off = Math.max(off, tier.off); });
    return { unit: Math.round(price * (1 - off / 100)), off: off, total: Math.round(price * (1 - off / 100)) * qty };
  }
  function isWholesaleAccount(u) {
    u = u || user();
    if (!u) return false;
    if (u.wholesale === true) return true;
    return u.role === 'customer' && u.wholesale_account === true;
  }

  /* ═══════════════════════════════════════════════════════════════
     7 · HEATMAPS — when your store actually sells
     ═══════════════════════════════════════════════════════════════ */
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  function salesHeatmap(orders) {
    orders = orders || scopeOrders();
    var grid = [];
    for (var d = 0; d < 7; d++) grid.push(new Array(24).fill(0));
    var counts = new Array(24).fill(0);
    (orders || []).forEach(function (o) {
      var dt = new Date(o.created_at || o.updated_at || Date.now());
      if (isNaN(dt.getTime())) return;
      var row = grid[dt.getDay()];
      var hour = dt.getHours();
      row[hour] += Number(o.total) || 0;
      counts[hour] += 1;
    });
    var max = 0;
    grid.forEach(function (row) { row.forEach(function (v) { if (v > max) max = v; }); });
    var best = { day: 0, hour: 0, value: 0 };
    grid.forEach(function (row, d) {
      row.forEach(function (v, h) { if (v > best.value) best = { day: d, hour: h, value: v }; });
    });
    var peakHour = counts.indexOf(Math.max.apply(null, counts));
    return {
      grid: grid,
      max: max,
      best: best,
      peakHour: peakHour,
      days: EN ? DAYS : DAYS_AR,
      hours: Array.from({ length: 24 }, function (_, i) { return i; }),
      total: round2((orders || []).reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0))
    };
  }
  function heatmapCellStyle(value, max) {
    if (!max || !value) return 'opacity:.06';
    var ratio = value / max;
    return 'opacity:' + (0.18 + ratio * 0.82).toFixed(2);
  }

  /* ═══════════════════════════════════════════════════════════════
     8 · WHATSAPP STOREFRONT — sell inside WhatsApp
     ═══════════════════════════════════════════════════════════════ */
  function whatsappNumber() {
    var s = DS.data.settings || {};
    return String(s.whatsapp || DS.data.WHATSAPP || '201226770582').replace(/[^0-9]/g, '');
  }
  function whatsappLink(text) {
    var msg = String(text || (EN ? 'Hello, I would like to place an order.' : 'مرحباً، أريد تقديم طلب.')).trim();
    return 'https://wa.me/' + whatsappNumber() + '?text=' + encodeURIComponent(msg);
  }
  function whatsappCatalogLink(tn) {
    var base = location.origin + (DS.url ? DS.url('customer/storefront.html') : '/customer/storefront.html');
    if (tn && tn.id) base += '?store=' + encodeURIComponent(tn.id);
    var msg = EN
      ? 'Hi! Here is the DotStudio® storefront: ' + base
      : 'مرحباً! هذا رابط المتجر على DotStudio®: ' + base;
    return whatsappLink(msg);
  }
  function whatsappCartLink(items) {
    var lines = (items || []).map(function (l) {
      return '• ' + (EN ? (l.name_en || l.name) : l.name) + ' × ' + l.qty + ' — ' + money(l.price * l.qty);
    });
    var msg = (EN ? 'Hi! I would like to order:' : 'مرحباً! أريد طلب:') + '\n' + lines.join('\n');
    return whatsappLink(msg);
  }

  /* ═══════════════════════════════════════════════════════════════
     9 · EXPIRY TRACKING — sell it before it dies
     ═══════════════════════════════════════════════════════════════ */
  function expiryStatus(product) {
    if (!product) return null;
    var raw = product.expiry_date || product.expiry || null;
    if (!raw) return { state: 'none', days: null, date: null, label: EN ? 'No expiry date' : 'لا يوجد تاريخ صلاحية', action: null };
    var dt = new Date(raw);
    if (isNaN(dt.getTime())) return { state: 'none', days: null, date: null, label: EN ? 'No expiry date' : 'لا يوجد تاريخ صلاحية', action: null };
    var days = Math.ceil((dt.getTime() - Date.now()) / 86400000);
    var res;
    if (days < 0) {
      res = { state: 'expired', days: days, date: raw, label: EN ? ('Expired ' + Math.abs(days) + 'd ago') : ('منتهي منذ ' + Math.abs(days) + ' يوم'), action: EN ? 'Remove from the shelf' : 'إزالة من الرف', discount: 50 };
    } else if (days <= 7) {
      res = { state: 'critical', days: days, date: raw, label: EN ? ('Expires in ' + days + 'd') : ('ينتهي خلال ' + days + ' يوم'), action: EN ? 'Flash sale now' : 'عرض تنفيذي الآن', discount: 30 };
    } else if (days <= 30) {
      res = { state: 'warning', days: days, date: raw, label: EN ? ('Expires in ' + days + 'd') : ('ينتهي خلال ' + days + ' يوم'), action: EN ? 'Plan a promotion' : 'خطط لعرض ترويجي', discount: 15 };
    } else {
      res = { state: 'ok', days: days, date: raw, label: EN ? ('Expires in ' + days + 'd') : ('ينتهي خلال ' + days + ' يوم'), action: null, discount: 0 };
    }
    return res;
  }
  function expiryAlerts() {
    return scopeProducts().map(function (p) {
      var s = expiryStatus(p);
      return { product: p, status: s };
    }).filter(function (x) { return x.status && (x.status.state === 'expired' || x.status.state === 'critical' || x.status.state === 'warning'); });
  }

  /* ═══════════════════════════════════════════════════════════════
     10 · CHURN PREDICTION — who is about to leave
     ═══════════════════════════════════════════════════════════════ */
  function churnScore(customer) {
    if (!customer) return null;
    var orders = Number(customer.orders) || 0;
    var spent = Number(customer.spent) || 0;
    var last = customer.last_order ? new Date(customer.last_order) : null;
    var days = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : 999;
    var avg = orders ? spent / orders : 0;

    var score = 0;
    var reasons = [];
    if (days > 60) { score += 40; reasons.push(EN ? ('No order for ' + days + ' days') : ('لا يوجد طلب منذ ' + days + ' يوم')); }
    else if (days > 30) { score += 28; reasons.push(EN ? 'Inactive for over a month' : 'غير نشط منذ أكثر من شهر'); }
    else if (days > 14) { score += 16; reasons.push(EN ? 'Inactive for two weeks' : 'غير نشط منذ أسبوعين'); }
    else if (days <= 7) { score -= 10; reasons.push(EN ? 'Very recent order' : 'طلب حديث جداً'); }

    if (orders <= 1) { score += 25; reasons.push(EN ? 'Only one order so far' : 'طلب واحد فقط حتى الآن'); }
    if (orders >= 5 && avg >= 300) { score -= 15; reasons.push(EN ? 'Loyal high-value customer' : 'عميل وفيّ عالي القيمة'); }

    var live = (DS.data.customersFor ? DS.data.customersFor(user()) : []).filter(function (c) {
      return c.phone === customer.phone;
    })[0];
    if (live && live.orders > orders) {
      score -= 10;
      reasons.unshift(EN ? 'Ordered again recently' : 'طلب مرة أخرى مؤخراً');
    }

    score = clamp(Math.round(score), 0, 100);
    var level = score >= 60 ? 'high' : (score >= 30 ? 'medium' : 'low');
    var action = level === 'high'
      ? (EN ? 'Call now + 20% comeback coupon' : 'اتصل الآن + كوبون عودة 20%')
      : (level === 'medium'
        ? (EN ? 'Send a WhatsApp nudge' : 'أرسل رسالة واتساب تذكيرية')
        : (EN ? 'Keep the usual flow' : 'استمر بالتعامل المعتاد'));
    return {
      score: score,
      level: level,
      reasons: reasons,
      action: action,
      daysSince: days,
      orders: orders,
      spent: spent
    };
  }
  function churnRanking() {
    var list = DS.data.customersFor ? DS.data.customersFor(user()) : [];
    return list.map(function (c) {
      return { customer: c, churn: churnScore(c) };
    }).filter(function (x) { return x.churn; })
      .sort(function (a, b) { return b.churn.score - a.churn.score; });
  }

  /* ─────────────────────── demo data helper ──────────────────────
     The clean demo database ships without orders, so the heatmap, the
     churn model and the purchase-order planner have nothing to chew
     on. This creates a deterministic week of trade for the tenant. */
  var DEMO_CUSTOMERS = [
    ['ياسمين محمد', 'Yasmin Mohamed', '01011110001'],
    ['محمد علي', 'Mohamed Ali', '01011110002'],
    ['سارة حسن', 'Sara Hassan', '01011110003'],
    ['أحمد كمال', 'Ahmed Kamal', '01011110004'],
    ['منى سعيد', 'Mona Said', '01011110005'],
    ['كريم عادل', 'Karim Adel', '01011110006'],
    ['نهى رجب', 'Noha Ragab', '01011110007'],
    ['عمر شريف', 'Omar Sherif', '01011110008']
  ];
  function seedDemoOrders(count) {
    var u = user();
    if (!u) return 0;
    var scope = tenantScope(u);
    var tids = scope ? [scope] : DS.data.tenants.map(function (t) { return t.id; });
    var made = 0;
    var n = Number(count) || 26;
    for (var i = 0; i < n; i++) {
      var tid = tids[hash('tenant' + i) % tids.length];
      var list = scopeProducts(u).filter(function (p) {
        return p.tenant_id === tid && (Number(p.stock) || 0) > 3;
      });
      if (!list.length) continue;
      var p = list[hash('prod' + i) % list.length];
      var qty = 1 + (hash('qty' + i) % 3);
      var when = new Date(Date.now() - (hash('day' + i) % 30) * 86400000 - (hash('hour' + i) % 13) * 3600000);
      var who = DEMO_CUSTOMERS[hash('cust' + i) % DEMO_CUSTOMERS.length];
      var price = Number(p.price) || 0;
      var total = price * qty;
      DS.data.createOrder({
        tenant_id: tid,
        status: 'delivered',
        source: i % 3 === 0 ? 'pos' : 'store',
        customer: {
          name: who[0], name_en: who[1], phone: who[2],
          address: 'القاهرة · مدينة نصر', address_en: 'Cairo · Nasr City',
          city: 'القاهرة', city_en: 'Cairo', lat: 30.0601, lng: 31.3488
        },
        items: [{ product_id: p.id, name: p.name, name_en: p.name_en, qty: qty, price: price, image: p.image }],
        subtotal: total, discount: 0, delivery_fee: 0, total: total,
        created_at: when.toISOString(), updated_at: when.toISOString(),
        timeline: [{ status: 'delivered', at: when.toISOString(), label: 'تم التسليم' }]
      });
      made++;
    }
    return made;
  }

  /* ═══════════════════════════════════════════════════════════════ */
  DS.dragon = {
    /* 1 */ openAR: openAR,
    /* 2 */ voicePOS: voicePOS, VOICE_COMMANDS: VOICE_AR,
    /* 3 */ priceSuggestion: priceSuggestion, applySuggestedPrice: applySuggestedPrice,
    /* 4 */ spinWheel: openSpinWheel, spin: spinWheel, WHEEL_PRIZES: WHEEL_PRIZES,
    /* 5 */ purchaseOrders: purchaseOrders, approvePurchaseOrder: approvePurchaseOrder, refreshPurchaseOrders: refreshPurchaseOrders,
    /* 6 */ wholesaleTiers: wholesaleTiers, wholesalePrice: wholesalePrice, WHOLESALE_TIERS: WHOLESALE_TIERS,
    /* 7 */ salesHeatmap: salesHeatmap, heatmapCellStyle: heatmapCellStyle,
    /* 8 */ whatsappLink: whatsappLink, whatsappCatalogLink: whatsappCatalogLink, whatsappCartLink: whatsappCartLink,
    /* 9 */ expiryStatus: expiryStatus, expiryAlerts: expiryAlerts,
    /* 10 */ churnScore: churnScore, churnRanking: churnRanking,
    /* helpers */
    scopeProducts: scopeProducts, scopeOrders: scopeOrders, hash: hash,
    seedDemoOrders: seedDemoOrders
  };
  console.log('%cDotStudio® · dragon suite ready', 'color:#82FF1F');
})();
