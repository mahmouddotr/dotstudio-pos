/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — SECURITY LAYER
   • Synchronous SHA-256 (no network, works offline / file://)
   • Salted, iterated password hashing (PBKDF2-style key stretching)
   • Input sanitising + validation helpers
   • Safe DOM text helpers (never innerHTML with raw user input)
   Exposes window.DS.security / shortcuts on window.DS.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS = window.DS || {};

  /* ───────────────────────── SHA-256 (sync) ───────────────────────── */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8(str) {
    str = String(str == null ? '' : str);
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(++i);
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
    return out;
  }

  function hex32(n) { return ('00000000' + (n >>> 0).toString(16)).slice(-8); }

  function sha256(message) {
    var bytes = utf8(message);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var len = bytes.length;
    var total = (((len + 8) >> 6) + 1) << 6;
    var m = new Array(total);
    for (var q = 0; q < total; q++) m[q] = q < len ? bytes[q] : 0;
    m[len] = 0x80;
    var bits = len * 8;
    var hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
    m[total - 8] = (hi >>> 24) & 0xff; m[total - 7] = (hi >>> 16) & 0xff; m[total - 6] = (hi >>> 8) & 0xff; m[total - 5] = hi & 0xff;
    m[total - 4] = (lo >>> 24) & 0xff; m[total - 3] = (lo >>> 16) & 0xff; m[total - 2] = (lo >>> 8) & 0xff; m[total - 1] = lo & 0xff;

    var w = new Array(64);
    for (var off = 0; off < total; off += 64) {
      for (var i = 0; i < 16; i++) {
        w[i] = ((m[off + i * 4] << 24) | (m[off + i * 4 + 1] << 16) | (m[off + i * 4 + 2] << 8) | m[off + i * 4 + 3]) | 0;
      }
      for (i = 16; i < 64; i++) {
        var s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3);
        var s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(hex32).join('');
  }
  DS.sha256 = sha256;

  /* ───────────────────────── PASSWORD HASHING ───────────────────────── */
  var ROUNDS = 512;

  function randomHex(len) {
    var out = '';
    try {
      var buf = new Uint8Array(Math.ceil(len / 2));
      crypto.getRandomValues(buf);
      for (var i = 0; i < buf.length; i++) out += ('0' + buf[i].toString(16)).slice(-2);
    } catch (e) {
      for (var j = 0; j < len; j++) out += '0123456789abcdef'[Math.floor(Math.random() * 16)];
    }
    return out.slice(0, len);
  }

  function strengthen(password, salt, rounds) {
    var pw = String(password == null ? '' : password);
    var hash = sha256(salt + '\u0000' + pw);
    for (var i = 0; i < rounds; i++) hash = sha256(hash + '\u0000' + salt + '\u0000' + pw);
    return hash;
  }

  /* Format: v1$<rounds>$<salt>$<hash> — never the plaintext. */
  function hashPassword(password, salt) {
    salt = salt || randomHex(24);
    return 'v1$' + ROUNDS + '$' + salt + '$' + strengthen(password, salt, ROUNDS);
  }

  function isHashed(value) { return /^v1\$\d+\$[0-9a-f]+\$[0-9a-f]{64}$/.test(String(value || '')); }

  /* Accepts hashed values and (for backwards compatibility only) legacy
     plaintext demo passwords, so existing local databases keep working. */
  function verifyPassword(password, stored) {
    if (stored == null) return false;
    if (!isHashed(stored)) return String(password) === String(stored);
    var parts = String(stored).split('$');
    var rounds = Number(parts[1]) || ROUNDS;
    var salt = parts[2], expected = parts[3];
    var actual = strengthen(password, salt, rounds);
    if (actual.length !== expected.length) return false;
    var diff = 0;
    for (var i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    return diff === 0;
  }

  /* Returns the fields to persist: always a hash, never a plain password. */
  function passwordPatch(password) {
    if (password == null || password === '') return {};
    return { password_hash: hashPassword(password), password: null };
  }

  var security = {
    sha256: sha256,
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    isHashed: isHashed,
    passwordPatch: passwordPatch,
    strength: function (pw) {
      pw = String(pw || '');
      var score = 0;
      if (pw.length >= 8) score++;
      if (pw.length >= 12) score++;
      if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
      if (/[0-9]/.test(pw)) score++;
      if (/[^A-Za-z0-9]/.test(pw)) score++;
      return Math.min(4, score);
    }
  };
  DS.security = security;

  /* ───────────────────────── SANITISING ───────────────────────── */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  /* Plain-text sanitiser for names, addresses, notes and search boxes.
     Removes control chars, markup delimiters and collapses whitespace. */
  function sanitize(value, maxLen) {
    var s = String(value == null ? '' : value);
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    s = s.replace(/[<>]/g, '');
    s = s.replace(/javascript:/gi, '');
    s = s.replace(/\s+/g, ' ').trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  /* Like sanitize() but keeps line breaks (chat messages, order notes). */
  function sanitizeMultiline(value, maxLen) {
    var s = String(value == null ? '' : value);
    s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    s = s.replace(/[<>]/g, '');
    s = s.replace(/javascript:/gi, '');
    s = s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  function isEmail(value) {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(String(value || '').trim());
  }

  /* Egyptian mobile (010/011/012/015 + 8 digits) or international +CC. */
  function isPhone(value) {
    var v = String(value || '').replace(/[\s-]/g, '');
    return /^(\+?\d{8,15})$/.test(v) || /^01[0125]\d{8}$/.test(v);
  }

  function normalizePhone(value) {
    var v = String(value || '').replace(/[\s-()]/g, '').trim();
    if (/^01[0125]\d{8}$/.test(v)) return v;
    if (/^\+/.test(v)) return v;
    if (/^\d{8,15}$/.test(v)) return '+' + v;
    return v;
  }

  /* Safe DOM write: textContent only, never raw HTML. */
  function setText(el, value) { if (el) el.textContent = String(value == null ? '' : value); }

  /* Build an element tree from a static template string. The template is
     authored by us (never by the user); interpolations must go through
     esc()/text nodes. Kept tiny on purpose. */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'text') node.textContent = String(attrs[k]);
      else if (k === 'class') node.className = attrs[k];
      else if (k === 'dataset') Object.keys(attrs[k]).forEach(function (d) { node.dataset[d] = attrs[k][d]; });
      else if (/^on/.test(k) && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  Object.assign(security, {
    escapeHtml: escapeHtml,
    sanitize: sanitize,
    sanitizeMultiline: sanitizeMultiline,
    isEmail: isEmail,
    isPhone: isPhone,
    normalizePhone: normalizePhone,
    setText: setText,
    el: el
  });

  /* Convenience aliases used across the app. */
  DS.esc = DS.esc || escapeHtml;
  DS.sanitize = sanitize;
  DS.sanitizeMultiline = sanitizeMultiline;
  DS.isEmail = isEmail;
  DS.isPhone = isPhone;
  DS.normalizePhone = normalizePhone;
  DS.setText = setText;
})();
