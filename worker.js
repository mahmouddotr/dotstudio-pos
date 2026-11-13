/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — background worker
   Runs the heavy merchandising maths off the main thread:
   • market-basket  → what customers buy together (association rules)
   • forecast       → 7-day demand + days of cover per product
   Protocol: { id, type, orders|products }  →  { id, result } | { id, error }
   ═══════════════════════════════════════════════════════════════ */
'use strict';

function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

/* Apriori-lite: one pass over every basket, counting item pairs. */
function marketBasket(orders, limit) {
  limit = limit || 8;
  var singles = {};
  var pairs = {};
  var baskets = 0;

  (orders || []).forEach(function (o) {
    if (!o) return;
    var ids = [];
    (o.items || []).forEach(function (it) {
      var id = it && (it.product_id || it.id);
      if (id && ids.indexOf(id) === -1) ids.push(id);
    });
    if (ids.length < 2) { ids.forEach(function (id) { singles[id] = (singles[id] || 0) + 1; }); return; }
    baskets++;
    ids.forEach(function (id) {
      singles[id] = (singles[id] || 0) + 1;
      ids.forEach(function (other) {
        if (other === id) return;
        var k = pairKey(id, other);
        pairs[k] = (pairs[k] || 0) + 1;
      });
    });
  });

  var rows = Object.keys(pairs).map(function (k) {
    var parts = k.split('|');
    var together = pairs[k] / 2;
    var a = singles[parts[0]] || 1;
    var b = singles[parts[1]] || 1;
    return {
      a: parts[0], b: parts[1], together: together,
      support: baskets ? together / baskets : 0,
      confidence: together / a,
      lift: baskets ? (together * baskets) / (a * b) : 0
    };
  }).sort(function (x, y) { return y.together - x.together || y.lift - x.lift; }).slice(0, limit);

  return { baskets: baskets, pairs: rows };
}

/* Simple moving average + linear trend over the last N days. */
function forecast(products, orders, horizon) {
  horizon = horizon || 7;
  var DAY = 86400000;
  var now = Date.now();
  var WINDOW = 30;
  var sold = {};

  (orders || []).forEach(function (o) {
    if (!o || !o.created_at) return;
    var at = new Date(o.created_at).getTime();
    if (!isFinite(at) || now - at > WINDOW * DAY) return;
    (o.items || []).forEach(function (it) {
      var id = it && (it.product_id || it.id);
      if (!id) return;
      sold[id] = sold[id] || { qty: 0, recent: 0, older: 0 };
      var qty = Number(it.qty) || 0;
      sold[id].qty += qty;
      if (now - at <= 7 * DAY) sold[id].recent += qty;
      else sold[id].older += qty;
    });
  });

  var rows = (products || []).map(function (p) {
    if (!p || !p.id) return null;
    var s = sold[p.id] || { qty: 0, recent: 0, older: 0 };
    var daily = s.qty / WINDOW;
    /* Momentum: last 7 days vs the 23 before it. */
    var momentum = s.older ? (s.recent / 7) / (s.older / 23) : (s.recent ? 1.35 : 1);
    momentum = Math.max(0.6, Math.min(1.8, momentum || 1));
    var forecastDaily = daily * momentum;
    var next7 = Math.max(0, Math.round(forecastDaily * horizon));
    var stock = Math.max(0, Number(p.stock) || 0);
    var cover = forecastDaily > 0 ? stock / forecastDaily : null;
    return {
      id: p.id,
      name: p.name,
      name_en: p.name_en || p.name,
      sold_30d: s.qty,
      next_7d: next7,
      days_cover: cover == null ? null : Math.round(cover * 10) / 10,
      reorder: cover != null && cover <= horizon,
      suggested_qty: Math.max(0, next7 - stock)
    };
  }).filter(Boolean);

  rows.sort(function (a, b) { return b.next_7d - a.next_7d; });
  return { days: WINDOW, horizon: horizon, rows: rows.slice(0, 12), all: rows };
}

self.addEventListener('message', function (event) {
  var msg = event.data || {};
  if (!msg.type) return;
  try {
    if (msg.type === 'market-basket') {
      self.postMessage({ id: msg.id, result: marketBasket(msg.orders || msg.payload && msg.payload.orders, msg.limit) });
    } else if (msg.type === 'forecast') {
      var p = msg.products || (msg.payload && msg.payload.products) || [];
      var o = msg.orders || (msg.payload && msg.payload.orders) || [];
      self.postMessage({ id: msg.id, result: forecast(p, o, msg.horizon) });
    }
  } catch (err) {
    self.postMessage({ id: msg.id, error: String(err && err.message || err) });
  }
});
