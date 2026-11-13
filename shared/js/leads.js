/* DotStudio® POS — Giveaway leads store
   ────────────────────────────────────────────────────────────────────────────
   One source of truth for the `ds_leads` bucket written by customer/win.html.
   Zero dependencies: it is loaded by the standalone landing page (which has no
   core.js) and by the admin console (which does), so it must never assume DS
   exists. It attaches to window.DS.leads when DS is present.

   Guarantees:
   · Corrupt JSON never throws — the bad payload is parked under
     `ds_leads_corrupt_<ts>` (data is not silently destroyed) and the page
     continues with an empty list.
   · Entries are sanitized on every read (shape, field length, phone format).
   · Phones are normalised (+20 / 0020 / 10-digit forms collapse to 0XXXXXXXXXX)
     so the same human can only enter once; repeats bump `attempts` instead.
   · Writes are capped so the bucket can never bloat localStorage.
   ───────────────────────────────────────────────────────────────────────────── */
(function (global) {
  'use strict';

  var KEY = 'ds_leads';
  var CORRUPT_KEY = 'ds_leads_corrupt_';
  var SUBMITTED_KEY = 'ds_lead_me';
  var MAX = 5000;
  var PHONE_RE = /^01[0-9]{9}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ─────────────────────────── helpers ─────────────────────────── */

  function text(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 80);
  }

  function normalizePhone(value) {
    var digits = String(value == null ? '' : value).replace(/[^\d]/g, '');
    if (!digits) return '';
    /* +20 / 0020 / bare 10-digit forms all collapse to 0XXXXXXXXXX. */
    if (digits.indexOf('0020') === 0) digits = digits.slice(4);
    else if (digits.indexOf('20') === 0 && digits.length === 12) digits = digits.slice(2);
    if (digits.charAt(0) === '1' && digits.length === 10) digits = '0' + digits;
    return digits.slice(0, 11);
  }

  function normalizeEmail(value) {
    return String(value == null ? '' : value).trim().toLowerCase().slice(0, 120);
  }

  function uid() {
    return 'ld_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function storage(method, key, value) {
    try {
      if (method === 'get') return global.localStorage.getItem(key);
      if (method === 'set') { global.localStorage.setItem(key, value); return true; }
      if (method === 'remove') { global.localStorage.removeItem(key); return true; }
    } catch (e) {
      /* private mode / quota / disabled storage */
    }
    return method === 'get' ? null : false;
  }

  /* Accepts the legacy `{ name, phone, date }` shape and the richer current one. */
  function sanitize(entry) {
    if (!entry || typeof entry !== 'object') return null;
    var phone = normalizePhone(entry.phone);
    var name = text(entry.name, 80);
    var email = normalizeEmail(entry.email);
    if (email && !EMAIL_RE.test(email)) email = '';
    if (!phone && !name && !email) return null;
    var date = entry.date && !isNaN(new Date(entry.date).getTime()) ? new Date(entry.date).toISOString() : new Date().toISOString();
    var lastAt = entry.lastAt && !isNaN(new Date(entry.lastAt).getTime()) ? new Date(entry.lastAt).toISOString() : date;
    return {
      id: text(entry.id, 40) || uid(),
      name: name,
      phone: phone,
      email: email,
      source: text(entry.source, 40) || 'win-page',
      date: date,
      lastAt: lastAt,
      attempts: Math.max(1, parseInt(entry.attempts, 10) || 1)
    };
  }

  function read() {
    var raw = storage('get', KEY);
    if (!raw) return [];
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      /* Park the corrupt payload so nothing is lost, then start clean. */
      storage('set', CORRUPT_KEY + Date.now(), String(raw).slice(0, 200000));
      storage('remove', KEY);
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    var out = [];
    parsed.forEach(function (entry) {
      var clean = sanitize(entry);
      if (clean) out.push(clean);
    });
    return out;
  }

  function write(list) {
    return storage('set', KEY, JSON.stringify((list || []).slice(0, MAX)));
  }

  function indexOfPhone(list, phone) {
    if (!phone) return -1;
    for (var i = 0; i < list.length; i++) if (list[i].phone === phone) return i;
    return -1;
  }

  /* ───────────────────────────── API ───────────────────────────── */

  /* Newest first. */
  function all() {
    return read();
  }

  function count() {
    return read().length;
  }

  function find(phone) {
    var list = read();
    var i = indexOfPhone(list, normalizePhone(phone));
    return i === -1 ? null : list[i];
  }

  /* Returns one of:
     { ok:true, duplicate:false, lead } · { ok:true, duplicate:true, lead }
     { ok:false, reason:'invalid-name'|'invalid-phone'|'invalid-email' } */
  function add(input) {
    input = input || {};
    var name = text(input.name, 80);
    var phone = normalizePhone(input.phone);
    var email = normalizeEmail(input.email);

    if (name.length < 2) return { ok: false, reason: 'invalid-name' };
    if (!PHONE_RE.test(phone)) return { ok: false, reason: 'invalid-phone' };
    if (email && !EMAIL_RE.test(email)) return { ok: false, reason: 'invalid-email' };

    var list = read();
    var now = new Date().toISOString();
    var index = indexOfPhone(list, phone);

    if (index > -1) {
      var existing = list[index];
      if (name) existing.name = name;
      if (email) existing.email = email;
      existing.attempts = (existing.attempts || 1) + 1;
      existing.lastAt = now;
      list.splice(index, 1);
      list.unshift(existing);
      write(list);
      return { ok: true, duplicate: true, lead: existing };
    }

    var lead = {
      id: uid(),
      name: name,
      phone: phone,
      email: email,
      source: text(input.source, 40) || 'win-page',
      date: now,
      lastAt: now,
      attempts: 1
    };
    list.unshift(lead);
    var stored = write(list);
    return { ok: true, duplicate: false, lead: lead, saved: stored };
  }

  function remove(id) {
    var list = read();
    var next = list.filter(function (l) { return l.id !== id; });
    write(next);
    return list.length - next.length;
  }

  function clear() {
    var total = count();
    storage('remove', KEY);
    storage('remove', SUBMITTED_KEY);
    return total;
  }

  function stats() {
    var list = read();
    var today = new Date().toDateString();
    var weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    var todayCount = 0;
    var weekCount = 0;
    var repeats = 0;
    list.forEach(function (l) {
      var at = new Date(l.lastAt).getTime();
      if (new Date(l.lastAt).toDateString() === today) todayCount++;
      if (at >= weekAgo) weekCount++;
      if ((l.attempts || 1) > 1) repeats++;
    });
    return { total: list.length, today: todayCount, week: weekCount, repeats: repeats, last: list[0] || null };
  }

  /* The visitor's own entry, so the storefront banner can stay quiet after
     they have already registered (no re-prompt on every visit). */
  function markSubmitted(lead) {
    if (!lead) return false;
    return storage('set', SUBMITTED_KEY, JSON.stringify({
      name: lead.name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      date: lead.date || new Date().toISOString()
    }));
  }

  function submitted() {
    var raw = storage('get', SUBMITTED_KEY);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
      storage('remove', SUBMITTED_KEY);
      return null;
    }
  }

  function rows() {
    return read().map(function (l) {
      return [l.name, l.phone, l.email, l.source, String(l.attempts || 1), l.date, l.lastAt];
    });
  }

  var api = {
    KEY: KEY,
    MAX: MAX,
    normalizePhone: normalizePhone,
    normalizeEmail: normalizeEmail,
    validPhone: function (v) { return PHONE_RE.test(normalizePhone(v)); },
    validEmail: function (v) { return EMAIL_RE.test(normalizeEmail(v)); },
    all: all,
    count: count,
    find: find,
    add: add,
    remove: remove,
    clear: clear,
    stats: stats,
    rows: rows,
    markSubmitted: markSubmitted,
    submitted: submitted
  };

  global.DSLeads = api;
  if (global.DS) global.DS.leads = api;
})(window);
