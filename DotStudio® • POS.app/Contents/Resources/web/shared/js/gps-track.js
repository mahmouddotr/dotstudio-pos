/* ═══════════════════════════════════════════════════════════════
   DotStudio® — GPS & Order Tracking
   - Beautiful location-permission modal (customer / driver)
   - Live geolocation capture -> localStorage (ds_geo)
   - Shared order-status pipeline (preparing -> on_way -> delivered)
   - Leaflet map helper (CDN) with canvas mock fallback
   API: window.DSTrack.{askPermission, getLocation, watch, statusOf,
        setStatus, openTrackingModal, mountMap, stages}
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LS_GEO = 'ds_geo';
  var LS_ORDERS = 'ds_order_status';
  var STAGES = [
    { k: 'preparing', ar: 'قيد التحضير', en: 'Preparing', ic: '👨‍🍳', pct: 15 },
    { k: 'ready', ar: 'جاهز للتوصيل', en: 'Ready', ic: '📦', pct: 35 },
    { k: 'on_way', ar: 'في الطريق إليك', en: 'On the way', ic: '🚚', pct: 70 },
    { k: 'delivered', ar: 'تم التسليم', en: 'Delivered', ic: '✅', pct: 100 }
  ];
  var ORDER = STAGES.map(function (s) { return s.k; });

  function ls(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function ss(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function user() { return ls('cz_user', null) || {}; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ─── styles (injected once) ─── */
  function injectCSS() {
    if (document.getElementById('ds-gps-css')) return;
    var st = document.createElement('style'); st.id = 'ds-gps-css';
    st.textContent = '\
.dsg-bg{position:fixed;inset:0;background:rgba(7,7,9,.78);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:.28s}\
.dsg-bg.open{opacity:1}\
.dsg-card{width:100%;max-width:420px;background:linear-gradient(180deg,#17171A,#111113);border:1px solid rgba(255,255,255,.09);border-radius:24px;padding:30px 26px;text-align:center;transform:translateY(18px) scale(.97);transition:.32s cubic-bezier(.2,.9,.3,1.2);box-shadow:0 40px 90px -30px rgba(0,0,0,.9)}\
.dsg-bg.open .dsg-card{transform:translateY(0) scale(1)}\
.dsg-ic{width:82px;height:82px;margin:0 auto 18px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(130,255,31,.3),rgba(130,255,31,.06));display:grid;place-items:center;font-size:38px;position:relative}\
.dsg-ic::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid rgba(130,255,31,.45);animation:dsgPulse 2s infinite}\
@keyframes dsgPulse{0%{transform:scale(.9);opacity:.9}70%{transform:scale(1.25);opacity:0}100%{opacity:0}}\
.dsg-card h3{font-size:20px;font-weight:900;color:#F5F5F7;margin-bottom:9px}\
.dsg-card p{font-size:13.5px;color:#98989F;line-height:1.7;margin-bottom:22px}\
.dsg-benefits{display:flex;flex-direction:column;gap:10px;text-align:start;margin-bottom:22px}\
.dsg-benefit{display:flex;align-items:center;gap:11px;font-size:13px;color:#C9C9CF;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:11px 13px}\
.dsg-benefit b{color:#82FF1F}\
.dsg-actions{display:flex;gap:10px}\
.dsg-btn{flex:1;border:none;border-radius:13px;padding:14px;font-size:14px;font-weight:900;font-family:inherit;cursor:pointer;transition:.18s}\
.dsg-btn.allow{background:#82FF1F;color:#0A0A0B}\
.dsg-btn.allow:hover{background:#6FE60A;transform:translateY(-1px)}\
.dsg-btn.deny{background:rgba(255,255,255,.06);color:#98989F;border:1px solid rgba(255,255,255,.09)}\
.dsg-btn.deny:hover{color:#F5F5F7}\
.dsg-status{font-size:12px;color:#82FF1F;margin-top:14px;min-height:16px;font-weight:700}\
.dsg-map{width:100%;height:260px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#101012;position:relative}\
.dsg-map .leaflet-tile{mix-blend-mode:normal !important}\
.dsg-map canvas{display:block;width:100%;height:100%}\
.dsg-map-badge{position:absolute;top:12px;inset-inline-start:12px;background:rgba(10,10,11,.85);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:7px 12px;font-size:11.5px;font-weight:800;color:#82FF1F;z-index:500}\
.dsg-eta{margin-top:8px;text-align:end;color:#82FF1F;font-size:12px;font-weight:800}\
.dst-live-eta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;padding:10px 12px;background:#101214;border:1px solid rgba(130,255,31,.16);border-radius:12px;color:#C9C9D1;font-size:12px;line-height:1.4}\
.dst-live-eta-main{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}\
.dst-live-eta-main b{color:#82FF1F;font-size:13px;white-space:nowrap}\
.dst-live-dist{color:#8A8A92;font-size:11px;direction:ltr;margin-inline-start:4px}\
.dst-msg-btn{border:1px solid rgba(130,255,31,.35);background:rgba(130,255,31,.1);color:#B9FF8A;border-radius:9px;padding:7px 10px;font:800 11.5px "Figtree",system-ui,sans-serif;cursor:pointer;white-space:nowrap;transition:.18s}\
.dst-msg-btn:hover{background:#82FF1F;color:#0A0A0B}\
.dst-moto-bubble{width:38px;height:38px;border-radius:50%;background:#82FF1F;border:3px solid #0A0A0B;display:grid;place-items:center;box-shadow:0 0 0 6px rgba(130,255,31,.16),0 8px 20px rgba(0,0,0,.55);overflow:hidden}\
.dst-moto-bubble img{width:27px;height:27px;object-fit:contain;display:block}\
.dst-moto-bubble.fallback{font-size:20px;color:#0A0A0B}\
.dst-house-pin{width:38px;height:38px;border-radius:50%;background:#fff;border:3px solid #60A5FA;display:grid;place-items:center;font-size:19px;box-shadow:0 0 0 6px rgba(96,165,250,.15),0 8px 20px rgba(0,0,0,.55)}\
.dst-track{display:flex;flex-direction:column;gap:0}\
.dst-step{display:flex;gap:14px;position:relative;padding-bottom:20px}\
.dst-step:last-child{padding-bottom:0}\
.dst-step::before{content:"";position:absolute;inset-inline-start:17px;top:38px;bottom:0;width:2px;background:rgba(255,255,255,.09)}\
.dst-step:last-child::before{display:none}\
.dst-step.done::before{background:#82FF1F}\
.dst-dot{width:36px;height:36px;border-radius:50%;flex-shrink:0;display:grid;place-items:center;font-size:16px;background:rgba(255,255,255,.06);color:#6E6E73;border:2px solid rgba(255,255,255,.08);z-index:1}\
.dst-step.done .dst-dot{background:#82FF1F;color:#0A0A0B;border-color:#82FF1F}\
.dst-step.active .dst-dot{animation:dsgPulse 1.8s infinite}\
.dst-info b{display:block;font-size:14px;color:#F5F5F7;font-weight:800}\
.dst-step:not(.done) .dst-info b{color:#6E6E73}\
.dst-info span{font-size:11.5px;color:#6E6E73}\
';
    document.head.appendChild(st);
  }

  /* ─── permission modal ─── */
  function askPermission(role, force) {
    role = role || (user().role || 'customer');
    /* Once permission was granted we normally skip the prompt. Placing a new
       order calls this with force=true so the GPS modal always appears. */
    if (!force && ls(LS_GEO, null) && ls(LS_GEO, {}).granted) { startWatch(); return; }
    injectCSS();
    var existing = document.getElementById('dsgBg');
    if (existing) { existing.classList.add('open'); return; }
    var isDriver = role === 'delivery';
    var benefits = isDriver
      ? [['📍', 'تحديث موقعك <b>لحظياً</b> لشركة التوصيل'], ['🗺️', 'عرض <b>مسار الطلب</b> على الخريطة'], ['🔔', 'إشعار العميل عند <b>الاقتراب</b>']]
      : [['📦', 'تتبّع طلبك <b>خطوة بخطوة</b>'], ['🚚', 'شوف المندوب على <b>الخريطة</b>'], ['⏱️', 'وقت وصول <b>دقيق</b> ومحدّث']];
    var bg = document.createElement('div'); bg.className = 'dsg-bg'; bg.id = 'dsgBg';
    bg.innerHTML = '<div class="dsg-card">' +
      '<div class="dsg-ic">📍</div>' +
      '<h3>' + (isDriver ? 'تفعيل تتبّع الموقع' : 'فعّل تتبّع طلبك') + '</h3>' +
      '<p>نحتاج صلاحية الوصول لموقعك عشان ' + (isDriver ? 'نوصل الطلبات بدقة' : 'نتابع طلبك لحظة بلحظة') + '. موقعك محمي ومش بنشاركه مع حد.</p>' +
      '<div class="dsg-benefits">' + benefits.map(function (b) { return '<div class="dsg-benefit"><span>' + b[0] + '</span><span>' + b[1] + '</span></div>'; }).join('') + '</div>' +
      '<div class="dsg-actions"><button class="dsg-btn deny" id="dsgDeny">لاحقاً</button><button class="dsg-btn allow" id="dsgAllow">السماح بالموقع</button></div>' +
      '<div class="dsg-status" id="dsgStatus"></div>' +
      '</div>';
    document.body.appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('open'); });

    function close() { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 300); }
    document.getElementById('dsgDeny').onclick = function () {
      ss(LS_GEO, { granted: false, denied: true, role: role, ts: Date.now() }); close();
    };
    document.getElementById('dsgAllow').onclick = function () {
      var status = document.getElementById('dsgStatus');
      status.textContent = '⏳ جارٍ تحديد موقعك...';
      if (!navigator.geolocation) { status.textContent = '⚠️ المتصفح لا يدعم الموقع'; return; }
      navigator.geolocation.getCurrentPosition(function (p) {
        ss(LS_GEO, { granted: true, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, role: role, ts: Date.now() });
        try { window.dispatchEvent(new CustomEvent('ds:location-update')); } catch (e) {}
        status.textContent = '✅ تم تحديد موقعك بنجاح';
        startWatch();
        setTimeout(close, 700);
      }, function () {
        ss(LS_GEO, { granted: false, mock: true, role: role, ts: Date.now() });
        status.textContent = 'تم استخدام موقع تقديري';
        setTimeout(close, 700);
      }, { enableHighAccuracy: true, timeout: 8000 });
    };
  }

  var watchId = null;
  function startWatch() {
    if (watchId != null || !navigator.geolocation) return;
    try {
      watchId = navigator.geolocation.watchPosition(function (p) {
        var g = ls(LS_GEO, {}) || {}; g.granted = true; g.lat = p.coords.latitude; g.lng = p.coords.longitude; g.acc = p.coords.accuracy; g.ts = Date.now();
        ss(LS_GEO, g);
        try { window.dispatchEvent(new CustomEvent('ds:location-update')); } catch (e) {}
      }, function () {}, { enableHighAccuracy: true, maximumAge: 5000 });
    } catch (e) {}
  }

  function getLocation() { return ls(LS_GEO, null); }

  /* ─── order status pipeline ─── */
  function statusOf(orderId) {
    var all = ls(LS_ORDERS, {});
    if (!all[orderId]) all[orderId] = { stage: 'preparing', ts: Date.now() };
    return all[orderId];
  }
  function setStatus(orderId, stage) {
    var all = ls(LS_ORDERS, {});
    all[orderId] = { stage: stage, ts: Date.now() };
    ss(LS_ORDERS, all);
    try { window.dispatchEvent(new CustomEvent('ds:order-status', { detail: { orderId: orderId, stage: stage } })); } catch (e) {}
    return all[orderId];
  }
  function nextStage(stage) {
    var i = ORDER.indexOf(stage);
    return i < 0 ? 'preparing' : ORDER[Math.min(i + 1, ORDER.length - 1)];
  }
  function stageMeta(k) { return STAGES.filter(function (s) { return s.k === k; })[0] || STAGES[0]; }

  /* ─── tracking modal ─── */
  function openTrackingModal(orderId, role) {
    injectCSS();
    if (document.getElementById('dstBg')) return;
    orderId = orderId || 'current';
    role = role || (user().role || 'customer');
    var st = statusOf(orderId);
    var meta = stageMeta(st.stage);
    var bg = document.createElement('div'); bg.className = 'dsg-bg'; bg.id = 'dstBg';
    bg.innerHTML = '<div class="dsg-card" style="max-width:440px;text-align:start">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><h3 style="margin:0">تتبّع الطلب</h3><button id="dstClose" style="background:none;border:none;color:#98989F;font-size:22px;cursor:pointer">×</button></div>' +
      '<p style="text-align:start;margin-bottom:16px">رقم الطلب: <b style="color:#82FF1F">#' + esc(String(orderId).slice(-6)) + '</b> · <span id="dstStage" style="color:#82FF1F;font-weight:800">' + meta.ic + ' ' + meta.ar + '</span></p>' +
      '<div id="dstBar" style="height:7px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden;margin-bottom:20px"><div style="height:100%;width:' + meta.pct + '%;background:linear-gradient(90deg,#82FF1F,#46C400);border-radius:4px;transition:width .6s"></div></div>' +
      '<div class="dst-track" id="dstTrack">' + STAGES.map(function (s) {
        var idx = ORDER.indexOf(s.k), cur = ORDER.indexOf(st.stage);
        var cls = cur >= idx ? 'done' : '';
        if (s.k === st.stage) cls += ' active';
        return '<div class="dst-step ' + cls + '"><div class="dst-dot">' + s.ic + '</div><div class="dst-info"><b>' + s.ar + '</b></div></div>';
      }).join('') + '</div>' +
      '<div style="margin-top:20px"><div class="dsg-map" id="dstMap" style="height:220px"><div class="dsg-map-badge">📍 موقع المندوب مباشر</div></div><div id="dstEta" class="dsg-eta" role="status" aria-live="polite">ETA: —</div></div>' +
      (role === 'delivery'
        ? '<div class="dsg-actions" style="margin-top:16px"><button class="dsg-btn deny" id="dstPrev">↩ السابق</button><button class="dsg-btn allow" id="dstNext">الخطوة التالية ←</button></div>'
        : '') +
      '</div>';
    document.body.appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('open'); });
    document.getElementById('dstClose').onclick = function () { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 300); };
    bg.addEventListener('click', function (e) { if (e.target === bg) { bg.classList.remove('open'); setTimeout(function () { bg.remove(); }, 300); } });
    if (role === 'delivery') {
      document.getElementById('dstNext').onclick = function () { setStatus(orderId, nextStage(statusOf(orderId).stage)); refresh(); };
      document.getElementById('dstPrev').onclick = function () {
        var i = ORDER.indexOf(statusOf(orderId).stage); setStatus(orderId, ORDER[Math.max(i - 1, 0)]); refresh();
      };
    }
    renderMap(document.getElementById('dstMap'), role);
    function refresh() {
      var s = statusOf(orderId), m = stageMeta(s.stage);
      document.getElementById('dstStage').textContent = m.ic + ' ' + m.ar;
      document.getElementById('dstBar').firstChild.style.width = m.pct + '%';
      document.querySelectorAll('#dstTrack .dst-step').forEach(function (el, i) {
        el.className = 'dst-step' + (ORDER.indexOf(s.stage) >= i ? ' done' : '') + (ORDER[i] === s.stage ? ' active' : '');
      });
    }
  }

  /* ─── Leaflet / mock map ─── */
  var leafletCallbacks = [];
  var leafletLoading = false;
  var maps = typeof WeakMap === 'function' ? new WeakMap() : null;
  /* Kafr El-Sheikh city centre — the fixed Noon-style tracking viewport. */
  var DST_CENTER = [31.1107, 30.9398];
  var DST_ZOOM = 14;
  /* Standard keyless OpenStreetMap tiles (no CartoDB/ArcGIS API keys). */
  var DST_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  function loadLeaflet(cb) {
    if (window.L) { cb(true); return; }
    leafletCallbacks.push(cb);
    if (leafletLoading) return;
    leafletLoading = true;
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
    var js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    function finish(ok) { leafletLoading = false; leafletCallbacks.splice(0).forEach(function (fn) { try { fn(ok); } catch (e) {} }); }
    js.onload = function () { finish(true); }; js.onerror = function () { finish(false); };
    document.head.appendChild(js);
  }
  function distanceKm(a, b) {
    var rad = Math.PI / 180, dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    var x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function setEta(el, minutes, km) {
    var targetId = el.id === 'trkMap' ? 'trkEta' : el.id === 'dlvMap' ? 'dlvEta' : el.id === 'dstMap' ? 'dstEta' : '';
    var target = targetId && document.getElementById(targetId);
    var value = Math.max(1, Math.round(minutes));
    if (target) {
      target.textContent = el.id === 'trkMap'
        ? '~' + value + ' دقيقة'
        : (document.documentElement.lang === 'ar'
          ? 'الوقت المتوقع للوصول: ' + value + ' دقيقة'
          : 'ETA: ' + value + ' min');
    }
    var box = el.parentNode && el.parentNode.querySelector('.dst-live-eta[data-for="' + el.id + '"]');
    if (box) {
      var v = box.querySelector('.dst-live-eta-val');
      var d = box.querySelector('.dst-live-dist');
      if (v) v.textContent = value + ' دقيقة';
      if (d) d.textContent = (typeof km === 'number') ? (km < 1 ? Math.round(km * 1000) + ' م' : km.toFixed(1) + ' كم') : '';
    }
    try {
      window.dispatchEvent(new CustomEvent('ds:eta', {
        detail: { id: el.id, minutes: value, km: typeof km === 'number' ? km : null }
      }));
    } catch (e) {}
  }

  /* Live distance/ETA snapshot for the customer tracking UI (read every 10s). */
  function getEta(elOrId) {
    var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el || !el._dstState) return null;
    var st = el._dstState;
    if (!st.driver || !st.customer) return null;
    var km = distanceKm(st.driver, st.customer);
    return {
      km: km,
      minutes: Math.max(1, Math.ceil(km)),
      driver: st.driver.slice(),
      customer: st.customer.slice(),
      active: deliveryActive()
    };
  }

  function openDriverChat() {
    try {
      if (window.DSChatFull && window.DSChatFull.open) return window.DSChatFull.open('delivery', 'talqa');
      if (window.openChatWith) return window.openChatWith('talqa', 'delivery');
      if (window.DSChat && window.DSChat.openSupport) return window.DSChat.openSupport();
    } catch (e) {}
  }
  /* Delivery staff must reach the Store Owner — never the platform Admin. */
  function openStoreOwnerChat() {
    var u = user();
    var ownerKey = u.tenant_id || u.shop_id || window.DS_TENANT || 'caznova';
    try {
      if (window.DSChatFull && window.DSChatFull.open) return window.DSChatFull.open('stores', ownerKey);
      if (window.openChatWith) return window.openChatWith(ownerKey, 'stores');
      if (window.DSChat && window.DSChat.openSupport) return window.DSChat.openSupport();
    } catch (e) {}
  }
  function openCustomerChat() {
    try {
      if (window.DSChatFull && window.DSChatFull.open) return window.DSChatFull.open('support');
      if (window.DSChat && window.DSChat.openSupport) return window.DSChat.openSupport();
    } catch (e) {}
  }

  /* The motorcycle only moves while the order is actually being delivered. */
  function deliveryActive() {
    try {
      if (window.DSOrders && typeof window.DSOrders.all === 'function') {
        var all = window.DSOrders.all() || [];
        if (all.length) {
          return all.some(function (o) { return o.status === 'delivering'; });
        }
      }
    } catch (e) {}
    try {
      var orders = ls(LS_ORDERS, {}) || {};
      return Object.keys(orders).some(function (id) {
        var stage = orders[id] && orders[id].stage;
        return stage === 'delivering';
      });
    } catch (e) { return false; }
  }
  function setMapState(el) {
    var badge = el && el.parentNode && el.parentNode.querySelector('.dsg-map-badge');
    if (!badge) return;
    if (deliveryActive()) {
      badge.textContent = '📍 موقع المندوب مباشر';
      badge.style.color = '#82FF1F';
    } else {
      badge.textContent = '⏸ بانتظار بدء التوصيل';
      badge.style.color = '#FBBF24';
    }
  }

  function ensureLiveUi(el, role) {
    if (!el || !el.parentNode) return;
    if (!el.id) el.id = 'dstMap_' + Math.random().toString(36).slice(2, 7);
    var box = el.parentNode.querySelector('.dst-live-eta[data-for="' + el.id + '"]');
    if (box) return;
    box = document.createElement('div');
    box.className = 'dst-live-eta';
    box.setAttribute('data-for', el.id);
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    box.innerHTML =
      '<div class="dst-live-eta-main">' +
        '<span>⏱ الوقت المتوقع للوصول:</span>' +
        '<b class="dst-live-eta-val">— دقيقة</b>' +
        '<span class="dst-live-dist"></span>' +
      '</div>' +
      '<button type="button" class="dst-msg-btn">💬 ' + (role === 'delivery' ? 'مراسلة المالك' : 'مراسلة المندوب') + '</button>';
    el.parentNode.insertBefore(box, el);
    var btn = box.querySelector('.dst-msg-btn');
    if (btn) btn.addEventListener('click', function () { if (role === 'delivery') openStoreOwnerChat(); else openDriverChat(); });
  }

  function whenVisible(el, cb) {
    if (el.clientWidth > 0 && el.clientHeight > 0) { cb(); return; }
    if (el._dsVisibleObserver) return;
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        if (el.clientWidth > 0 && el.clientHeight > 0) {
          ro.disconnect();
          el._dsVisibleObserver = null;
          if (el.isConnected) cb();
        }
      });
      el._dsVisibleObserver = ro;
      ro.observe(el);
      return;
    }
    setTimeout(function retry() {
      if (el.clientWidth > 0 && el.clientHeight > 0) cb();
      else if (el.isConnected) setTimeout(retry, 350);
    }, 350);
  }

  function startSim(el, st) {
    if (st.timer) return;
    if (!deliveryActive()) { setMapState(el); return; }
    setMapState(el);
    st.timer = setInterval(function () {
      if (!el.isConnected) { clearInterval(st.timer); st.timer = null; return; }
      if (!deliveryActive()) {
        clearInterval(st.timer); st.timer = null;
        setMapState(el);
        return;
      }
      if (!st.driverMarker || !st.line) return;
      var from = st.driver, to = st.customer;
      var remain = distanceKm(from, to);
      if (remain <= 0.03) {
        st.driver = to.slice();
        st.driverMarker.setLatLng(st.driver);
        st.line.setLatLngs([st.driver, to]);
        setEta(el, 1, 0);
        clearInterval(st.timer); st.timer = null;
        return;
      }
      /* Simulated live tracking — move ~7% closer every 2 seconds. */
      var ratio = 0.07;
      st.driver = [from[0] + (to[0] - from[0]) * ratio, from[1] + (to[1] - from[1]) * ratio];
      st.driverMarker.setLatLng(st.driver);
      st.line.setLatLngs([st.driver, to]);
      var left = distanceKm(st.driver, to);
      setEta(el, Math.max(1, Math.ceil(left * 1)), left);
    }, 2000);
  }

  function renderMap(el, forcedRole) {
    if (!el) return;
    injectCSS();
    if (!el.id) el.id = 'dstMap_' + Math.random().toString(36).slice(2, 7);
    if (!el._dsLocationListener) {
      el._dsLocationListener = function () { if (el.isConnected) renderMap(el); };
      window.addEventListener('ds:location-update', el._dsLocationListener);
      el._dsStatusListener = function () { if (el.isConnected) renderMap(el); };
      window.addEventListener('ds:order-status', el._dsStatusListener);
      el._dsStorageListener = function (e) {
        if (!e || e.key === LS_ORDERS || e.key === 'ds_orders' || e.key === 'ds_orders_v2') {
          if (el.isConnected) renderMap(el);
        }
      };
      window.addEventListener('storage', el._dsStorageListener);
    }
    /* Noon-style viewport: always centred on Kafr El-Sheikh (31.1107, 30.9398), zoom 14. */
    var g = getLocation() || {};
    var role = forcedRole || (el.id === 'dlvMap' ? 'delivery' : 'customer');
    var lat = DST_CENTER[0], lng = DST_CENTER[1];
    /* A demo customer/driver pair inside the city so the route is always visible.
       ~5.3 km apart → a realistic 6-minute delivery window that counts down. */
    var customer = role === 'delivery' ? [31.1049, 30.9476] : [31.1107, 30.9398];
    var driver = role === 'delivery' ? [31.1489, 30.9731] : [31.1489, 30.9731];
    var initialKm = distanceKm(driver, customer);
    ensureLiveUi(el, role);
    setMapState(el);
    setEta(el, Math.max(1, Math.ceil(initialKm * 1)), initialKm);
    loadLeaflet(function (ok) {
      if (ok && window.L) {
        if (!el.clientWidth || !el.clientHeight) {
          whenVisible(el, function () { if (el.isConnected) renderMap(el, forcedRole); });
          return;
        }
        try {
          el.querySelectorAll('canvas').forEach(function (canvas) { canvas.remove(); });
          var map = maps && maps.get(el);
          var st = el._dstState;
          if (!map) {
            map = L.map(el, { zoomControl: true, attributionControl: true });
            /* Standard OpenStreetMap raster tiles — no API key required. */
            L.tileLayer(DST_TILE_URL, {
              maxZoom: 19,
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
            }).addTo(map);
            map._dsTrackingLayers = L.layerGroup().addTo(map);
            if (maps) maps.set(el, map);
            st = el._dstState = { driver: driver.slice(), customer: customer.slice(), gps: [lat, lng], timer: null };
            map.setView(DST_CENTER, DST_ZOOM);
          } else {
            if (!st) st = el._dstState = { driver: driver.slice(), customer: customer.slice(), gps: [lat, lng], timer: null };
            st.customer = customer.slice();
            /* Only reset the simulated driver when the real GPS position actually changes. */
            if (role === 'delivery') {
              if (!st.gps) st.gps = [lat, lng];
              else if (distanceKm(st.gps, [lat, lng]) > 0.05) {
                st.driver = driver.slice();
                st.gps = [lat, lng];
              }
            }
          }
          map._dsTrackingLayers.clearLayers();
          var driverIcon = L.divIcon({
            className: 'dst-driver-marker',
            html: '<div class="dst-moto-bubble" style="font-size:20px;line-height:1">🛵</div>',
            iconSize: [40, 40], iconAnchor: [20, 20]
          });
          var customerIcon = L.divIcon({
            className: 'dst-customer-marker',
            html: '<div class="dst-house-pin">🏠</div>',
            iconSize: [40, 40], iconAnchor: [20, 20]
          });
          var driverLabel = document.documentElement.lang === 'ar' ? 'المندوب' : 'Driver';
          var customerLabel = document.documentElement.lang === 'ar' ? 'موقعك' : 'You';
          st.driverMarker = L.marker(st.driver, { icon: driverIcon, zIndexOffset: 500 }).bindTooltip(driverLabel, { direction: 'top', offset: [0, -22] }).addTo(map._dsTrackingLayers);
          st.customerMarker = L.marker(st.customer, { icon: customerIcon, zIndexOffset: 400 }).bindTooltip(customerLabel, { direction: 'top', offset: [0, -22] }).addTo(map._dsTrackingLayers);
          st.line = L.polyline([st.driver, st.customer], { color: '#82FF1F', weight: 4, opacity: .9, dashArray: '9 8', lineCap: 'round' }).addTo(map._dsTrackingLayers);
          var km = distanceKm(st.driver, st.customer);
          /* Product rule: 1 km ≈ 1 minute. */
          setEta(el, Math.max(1, Math.ceil(km)), km);
          startSim(el, st);
          setTimeout(function () { map.invalidateSize(); }, 100);
          return;
        } catch (e) { console.warn('[DSTrack] map error', e); }
      }
      drawMockMap(el, driver, customer, lat, lng);
    });
  }
  function drawMockMap(el, driver, customer, lat, lng) {
    el.querySelectorAll('canvas').forEach(function (c) { c.remove(); });
    var c = document.createElement('canvas');
    var r = el.getBoundingClientRect();
    c.width = r.width || 400; c.height = r.height || 220;
    el.appendChild(c);
    var x = c.getContext('2d'), W = c.width, H = c.height;
    x.fillStyle = '#0E0E11'; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.05)'; x.lineWidth = 1;
    for (var i = 0; i < W; i += 40) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
    for (var j = 0; j < H; j += 40) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
    var a = { x: W * 0.2, y: H * 0.75 }, b = { x: W * 0.8, y: H * 0.3 };
    x.strokeStyle = '#82FF1F'; x.lineWidth = 3; x.setLineDash([9, 7]);
    x.beginPath(); x.moveTo(a.x, a.y); x.quadraticCurveTo(W * 0.5, H * 0.2, b.x, b.y); x.stroke(); x.setLineDash([]);
    function dot(p, col, lbl) {
      x.fillStyle = col; x.beginPath(); x.arc(p.x, p.y, 9, 0, 7); x.fill();
      x.fillStyle = '#0A0A0B'; x.font = 'bold 10px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(lbl, p.x, p.y);
    }
    dot(a, '#82FF1F', '🛵'); dot(b, '#60A5FA', '🏠');
    x.fillStyle = 'rgba(255,255,255,.82)'; x.font = 'bold 11px sans-serif'; x.textAlign = 'start';
    x.fillText('Driver / المندوب', a.x + 14, a.y); x.fillText('Customer / العميل', b.x + 14, b.y);
    x.fillStyle = 'rgba(255,255,255,.5)'; x.font = '11px sans-serif'; x.textAlign = 'start';
    x.fillText(lat.toFixed(4) + ', ' + lng.toFixed(4), 12, H - 12);
  }

  window.DSTrack = {
    askPermission: askPermission, getLocation: getLocation, watch: startWatch,
    statusOf: statusOf, setStatus: setStatus, nextStage: nextStage, stageMeta: stageMeta,
    openTrackingModal: openTrackingModal, renderMap: renderMap, stages: STAGES, order: ORDER,
    getEta: getEta, messageDriver: openDriverChat, messageCustomer: openCustomerChat,
    messageStore: openStoreOwnerChat, deliveryActive: deliveryActive
  };
})();
