/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — CART (optimistic, deferred persistence)
   The bag repaints from memory the instant an item is added, and the
   localStorage snapshot is written a beat later (or on page hide).
   That keeps every tap at 60fps — even on a slow phone / busy tab.
   Exposes DS.cart.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before cart.js'); return; }

  var KEY = 'ds_cart';
  var FLUSH_MS = 220;
  var pending = null;
  var timer = null;

  /* Read the persisted bag (single source of truth on first paint). */
  function read() {
    var raw = DS.store.get(KEY, null);
    if (raw && Array.isArray(raw.items)) {
      return { items: raw.items.filter(function (l) { return l && l.id; }) };
    }
    return { items: [] };
  }

  function snapshot(cart) {
    var items = (cart && cart.items) || [];
    return {
      items: items.map(function (l) {
        return {
          id: l.id,
          name: l.name,
          name_en: l.name_en,
          price: Number(l.price) || 0,
          qty: Math.max(0, Number(l.qty) || 0),
          image: l.image,
          stock: l.stock,
          tenant_id: l.tenant_id
        };
      }).filter(function (l) { return l.id && l.qty > 0; })
    };
  }

  /* Write immediately (checkout, page hide, beforeunload). */
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (pending == null) return;
    try { localStorage.setItem(KEY, JSON.stringify(pending)); } catch (e) {}
    pending = null;
  }

  /* Optimistic save: memory first, storage shortly after. */
  function persist(cart, immediate) {
    if (!cart) return null;
    pending = snapshot(cart);
    if (immediate) { flush(); return pending; }
    if (timer) return pending;
    timer = setTimeout(function () { timer = null; flush(); }, FLUSH_MS);
    return pending;
  }

  function count(cart) {
    return ((cart && cart.items) || []).reduce(function (s, l) { return s + (Number(l.qty) || 0); }, 0);
  }
  function total(cart) {
    return ((cart && cart.items) || []).reduce(function (s, l) { return s + (Number(l.price) || 0) * (Number(l.qty) || 0); }, 0);
  }
  function clear() {
    pending = { items: [] };
    flush();
  }

  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });

  DS.cart = {
    KEY: KEY,
    read: read,
    persist: persist,
    flush: flush,
    clear: clear,
    count: count,
    total: total,
    snapshot: snapshot
  };
})();
