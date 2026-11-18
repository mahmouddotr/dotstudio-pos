/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — API SERVICE (backend-ready abstraction)
   Every data access goes through this thin async layer. Today it reads
   from the offline localStorage demo DB; tomorrow each function swaps
   its body for a `fetch('https://api.dotstudio.com/...')` call without
   touching the pages that consume it.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.warn('[DS] core.js must load before api-service.js'); return; }

  var BASE = (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1'))
    ? 'http://localhost:8787'
    : 'https://api.dotstudio.com';

  function db() { return (DS.data && DS.data.db) ? DS.data.db : null; }

  function normalizeProduct(p) {
    if (!p) return p;
    var out = Object.assign({}, p);
    if (!out.image && out.image_url) out.image = out.image_url;
    if (!out.image_url && out.image) out.image_url = out.image;
    return out;
  }

  async function request(path, opts) {
    opts = opts || {};
    try {
      var res = await fetch(BASE + path, opts);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }

  var api = {
    baseUrl: BASE,

    /* ── Products ── */
    async getProducts() {
      try {
        var data = await request('/api/products');
        if (data && Array.isArray(data.products)) {
          return data.products.map(normalizeProduct);
        }
      } catch (e) {}
      try {
        if (DS.data && Array.isArray(DS.data.products)) return DS.data.products;
        var d = db();
        return (d && Array.isArray(d.products)) ? d.products : [];
      } catch (e) { return []; }
    },
    async getVisibleProducts(user) {
      try {
        var list = await this.getProducts();
        if (list && list.length) return list;
      } catch (e) {}
      try {
        if (DS.data && typeof DS.data.visibleProducts === 'function') return DS.data.visibleProducts(user);
        return await this.getProducts();
      } catch (e) { return []; }
    },
    async getProduct(id) {
      var list = await this.getProducts();
      return list.filter(function (p) { return p && p.id === id; })[0] || null;
    },

    /* ── Tenants / stores ── */
    async getTenants() {
      try {
        var data = await request('/api/tenants');
        if (data && Array.isArray(data.tenants)) return data.tenants;
      } catch (e) {}
      try {
        if (DS.data && Array.isArray(DS.data.tenants)) return DS.data.tenants;
        var d = db();
        return (d && Array.isArray(d.tenants)) ? d.tenants : [];
      } catch (e) { return []; }
    },
    async getTenant(id) {
      try {
        if (DS.data && typeof DS.data.tenantById === 'function') return DS.data.tenantById(id);
        var list = await this.getTenants();
        return list.filter(function (t) { return t && t.id === id; })[0] || null;
      } catch (e) { return null; }
    },

    /* ── Orders ── */
    async getOrders() {
      try {
        if (DS.data && Array.isArray(DS.data.orders)) return DS.data.orders;
        var d = db();
        return (d && Array.isArray(d.orders)) ? d.orders : [];
      } catch (e) { return []; }
    },
    async getVisibleOrders(user) {
      try {
        if (DS.data && typeof DS.data.visibleOrders === 'function') return DS.data.visibleOrders(user);
        return await this.getOrders();
      } catch (e) { return []; }
    },
    /* ── Orders (write) ── */
    async createOrder(order) {
      try {
        var res = await fetch(BASE + '/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': (order && order.tenant_id) ? String(order.tenant_id) : '',
            'Authorization': 'Bearer dummy-token'
          },
          body: JSON.stringify(order || {})
        });
        if (res.ok) {
          var data = await res.json();
          return (data && data.order) ? data.order : data;
        }
      } catch (e) {}
      return null;
    },
    /* ── Paymob checkout ── */
    async checkoutPaymob(amount, currency, customerInfo) {
      try {
        var res = await fetch(BASE + '/api/checkout/paymob', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dummy-token' },
          body: JSON.stringify({ amount: amount, currency: currency || 'EGP', customerInfo: customerInfo || {} })
        });
        if (res.ok) return await res.json();
      } catch (e) {}
      return null;
    },
    async createPaymentIntent(amount, currency, customerInfo) {
      return this.checkoutPaymob(amount, currency, customerInfo);
    },

    /* ── Users ── */
    async getUsers() {
      try {
        if (DS.data && Array.isArray(DS.data.users)) return DS.data.users;
        var d = db();
        return (d && Array.isArray(d.users)) ? d.users : [];
      } catch (e) { return []; }
    },

    /* ── Cart (localStorage today) ── */
    async getCart() {
      try {
        if (DS.store && typeof DS.store.get === 'function') return DS.store.get('ds_cart', { items: [] });
        var raw = localStorage.getItem('ds_cart');
        return raw ? JSON.parse(raw) : { items: [] };
      } catch (e) { return { items: [] }; }
    },
    async setCart(cart) {
      try {
        if (DS.store && typeof DS.store.set === 'function') DS.store.set('ds_cart', cart);
        else localStorage.setItem('ds_cart', JSON.stringify(cart));
      } catch (e) {}
      return cart;
    },
    async clearCart() {
      try {
        if (DS.store && typeof DS.store.remove === 'function') DS.store.remove('ds_cart');
        else localStorage.removeItem('ds_cart');
      } catch (e) {}
      return { items: [] };
    },

    /* ── Viewed products (recommendations) ── */
    async getViewedProducts() {
      try {
        if (DS.store && typeof DS.store.get === 'function') return DS.store.get('ds_viewed_products', []);
        var raw = localStorage.getItem('ds_viewed_products');
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    },
    async setViewedProducts(arr) {
      try {
        if (DS.store && typeof DS.store.set === 'function') DS.store.set('ds_viewed_products', arr);
        else localStorage.setItem('ds_viewed_products', JSON.stringify(arr));
      } catch (e) {}
      return arr;
    },

    /* ── Generic key/value (future: fetch) ── */
    async get(key, fallback) {
      try {
        if (DS.store && typeof DS.store.get === 'function') return DS.store.get(key, fallback);
        var raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    async set(key, value) {
      try {
        if (DS.store && typeof DS.store.set === 'function') DS.store.set(key, value);
        else localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
      return value;
    },
    async remove(key) {
      try {
        if (DS.store && typeof DS.store.remove === 'function') DS.store.remove(key);
        else localStorage.removeItem(key);
      } catch (e) {}
    }
  };

  DS.api = api;
  /* Convenience alias some pages expect. */
  DS.apiService = api;
})();
