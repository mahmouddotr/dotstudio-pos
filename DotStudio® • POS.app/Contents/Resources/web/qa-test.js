/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — APPLE 2026 QA
   Playwright end-to-end: login, all roles, all sidebar pages,
   i18n integrity, tenant isolation, cart modal, checkout & delivery.
   Run: node qa-test.js
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const SHOTS = path.join(__dirname, 'QA-SCREENSHOTS');
const AR = /[\u0600-\u06FF]/;

const results = [];
const failures = [];
let pageErrors = [];

function record(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail || '' });
  if (pass) console.log('  ✓ ' + name + (detail ? ' — ' + detail : ''));
  else { console.log('  ✗ ' + name + (detail ? ' — ' + detail : '')); failures.push(name + (detail ? ' — ' + detail : '')); }
}

async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: false });
}

async function newContext(browser, lang) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  if (lang) {
    await ctx.addInitScript(function (l) {
      try { localStorage.setItem('lang', l); localStorage.setItem('ds_lang', l); } catch (e) {}
    }, lang);
  }
  return ctx;
}

async function login(page, username, password) {
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#loginForm');
  await page.fill('#loginUser', username);
  await page.fill('#loginPass', password);
  await page.click('#loginBtn');
  await page.waitForURL(function (url) { return !/index\.html$/.test(url.pathname); }, { timeout: 20000 });
  await page.waitForTimeout(1100);
}

/* Visible Arabic detector — returns de-duplicated snippets. */
async function arabicLeaks(page) {
  return page.evaluate(function () {
    var out = [];
    var seen = {};
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var n;
    while ((n = walker.nextNode())) {
      var text = (n.textContent || '').trim();
      if (!text || !/[\u0600-\u06FF]/.test(text)) continue;
      var el = n.parentElement;
      if (!el || el.closest('script,style,template,noscript')) continue;
      var st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) continue;
      var key = text.slice(0, 90);
      if (seen[key]) continue;
      seen[key] = 1;
      out.push(text.slice(0, 90) + '  [' + (el.className || el.tagName) + ']');
      if (out.length >= 40) break;
    }
    return out;
  });
}

async function checkPage(page, name, opts) {
  opts = opts || {};
  await page.waitForTimeout(opts.wait || 900);
  const health = await page.evaluate(function () {
    return {
      topbar: !!document.querySelector('.ds-topbar'),
      sidebar: !!document.querySelector('.ds-sidebar'),
      bodyLength: (document.body.innerText || '').length,
      dir: document.documentElement.getAttribute('dir'),
      lang: document.documentElement.getAttribute('lang'),
      unstyled: document.styleSheets.length === 0,
      text: (document.body.innerText || '').slice(0, 240)
    };
  });
  const errs = pageErrors.splice(0);
  record(name + ' · shell rendered', health.topbar && health.sidebar, 'topbar=' + health.topbar + ' sidebar=' + health.sidebar);
  record(name + ' · content rendered', health.bodyLength > 180, 'chars=' + health.bodyLength);
  record(name + ' · no JS errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  if (opts.lang === 'en') {
    const leaks = await arabicLeaks(page);
    record(name + ' · EN has no Arabic', leaks.length === 0, leaks.slice(0, 4).join(' ‖ '));
  }
  return health;
}

(async function run() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let exitCode = 0;

  try {
    /* ───────────── 1 · LOGIN SCREEN (AR + EN) ───────────── */
    console.log('\n▶ 1. Apple 2026 login');
    for (const lang of ['ar', 'en']) {
      const ctx = await newContext(browser, lang);
      const page = await ctx.newPage();
      page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
      await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
      const data = await page.evaluate(function () {
        var card = document.querySelector('.login-card');
        var mesh = document.querySelector('.mesh');
        return {
          dir: document.documentElement.getAttribute('dir'),
          lang: document.documentElement.getAttribute('lang'),
          title: document.querySelector('#loginTitle').textContent.trim(),
          cardWidth: card ? Math.round(card.getBoundingClientRect().width) : 0,
          logo: document.querySelector('.brand img') ? Math.round(document.querySelector('.brand img').getBoundingClientRect().height) : 0,
          mesh: !!mesh,
          meshAnim: mesh ? getComputedStyle(mesh).animationDuration : '',
          demos: document.querySelectorAll('.demo-chip').length,
          inputs: document.querySelectorAll('.apple-input').length,
          lime: !!document.querySelector('.apple-btn-lime'),
          pills: document.querySelectorAll('.ds-lang-pill .opt').length,
          font: getComputedStyle(document.querySelector('#loginTitle')).fontFamily
        };
      });
      record('login · ' + lang + ' direction', data.dir === (lang === 'ar' ? 'rtl' : 'ltr'), data.dir + '/' + data.lang);
      record('login · title localized', lang === 'ar' ? AR.test(data.title) : /welcome/i.test(data.title), data.title);
      record('login · glass card 480px', data.cardWidth > 400 && data.cardWidth <= 500, data.cardWidth + 'px');
      record('login · logo 60px', data.logo >= 50 && data.logo <= 70, data.logo + 'px');
      record('login · mesh gradient animated 20s', data.mesh && data.meshAnim.indexOf('20s') === 0, data.meshAnim);
      record('login · 8 demo accounts', data.demos === 8, String(data.demos));
      record('login · 2 apple inputs', data.inputs === 2, String(data.inputs));
      record('login · lime CTA', data.lime, '');
      record('login · AR|EN pill', data.pills === 2, String(data.pills));
      record('login · SF Pro typography', /SF Pro/.test(data.font), data.font);
      if (lang === 'en') {
        const leaks = await arabicLeaks(page);
        record('login · EN has no Arabic', leaks.length === 0, leaks.slice(0, 3).join(' ‖ '));
      }
      await shot(page, '01-login-' + lang + '.png');
      await ctx.close();
    }

    /* ───────────── 2 · EIGHT DEMO ACCOUNTS ───────────── */
    console.log('\n▶ 2. Eight demo accounts route correctly');
    const accounts = [
      ['admin', 'admin2026', '/admin/dashboard.html'],
      ['owner', 'owner2026', '/owner/dashboard.html'],
      ['caznova', 'caznova2026', '/owner/dashboard.html'],
      ['smozy', 'smozy2026', '/owner/dashboard.html'],
      ['cashier', 'cashier2026', '/cashier/pos.html'],
      ['delivery', 'delivery2026', '/delivery/dashboard.html'],
      ['customer', 'customer2026', '/customer/storefront.html'],
      ['dina', 'dina2026', '/admin/dashboard.html']
    ];
    for (const [u, p, home] of accounts) {
      const ctx = await newContext(browser, 'en');
      const page = await ctx.newPage();
      page.on('pageerror', e => pageErrors.push(u + ' pageerror: ' + e.message));
      await login(page, u, p);
      const url = new URL(page.url()).pathname;
      record('account ' + u + ' → ' + home, url === home, url);
      record('account ' + u + ' · not redirected to login', !/index\.html/.test(url), url);
      const role = await page.evaluate(() => (window.DS && DS.session() ? DS.session().role : ''));
      record('account ' + u + ' · session role', !!role, role);
      await shot(page, '02-account-' + u + '.png');
      await ctx.close();
    }

    /* ───────────── 3 · ADMIN SIDEBAR + EVERY PAGE ───────────── */
    console.log('\n▶ 3. Admin sidebar — every page (EN)');
    const adminCtx = await newContext(browser, 'en');
    const admin = await adminCtx.newPage();
    admin.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));
    admin.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
    await login(admin, 'admin', 'admin2026');

    const nav = await admin.$$eval('.ds-sidebar a[data-nav]', els => els.map(e => ({ key: e.getAttribute('data-nav'), href: e.href })));
    record('admin · sidebar has all sections', nav.length >= 13, nav.length + ' links');

    let idx = 0;
    for (const item of nav) {
      idx++;
      pageErrors = [];
      await admin.goto(item.href, { waitUntil: 'domcontentloaded' });
      const h = await checkPage(admin, 'admin/' + item.key, { lang: 'en', wait: 1000 });
      record('admin/' + item.key + ' · active nav', await admin.locator('.ds-nav-item.active').count() === 1, '');
      await shot(admin, '03-admin-' + String(idx).padStart(2, '0') + '-' + item.key + '-en.png');
      record('admin/' + item.key + ' · EN dir', h.dir === 'ltr', h.dir);
    }

    /* Arabic dashboard screenshot + live toggle (fresh context: no forced lang) */
    await adminCtx.close();
    const toggleCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const admin2 = await toggleCtx.newPage();
    admin2.on('pageerror', e => pageErrors.push('toggle pageerror: ' + e.message));
    pageErrors = [];
    await admin2.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await admin2.evaluate(() => { localStorage.setItem('lang', 'en'); localStorage.setItem('ds_lang', 'en'); });
    await admin2.reload({ waitUntil: 'domcontentloaded' });
    await login(admin2, 'admin', 'admin2026');
    await admin2.click('.ds-topbar [data-set-lang="ar"]');
    await admin2.waitForTimeout(1600);
    let state = await admin2.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, stored: localStorage.getItem('lang'), nav: (document.querySelector('.ds-nav-item .label') || {}).textContent }));
    record('toggle EN→AR · rtl', state.dir === 'rtl' && state.lang === 'ar' && state.stored === 'ar', JSON.stringify(state));
    await shot(admin2, '04-admin-dashboard-ar.png');
    await admin2.click('.ds-topbar [data-set-lang="en"]');
    await admin2.waitForTimeout(1600);
    state = await admin2.evaluate(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, stored: localStorage.getItem('lang') }));
    record('toggle AR→EN · ltr', state.dir === 'ltr' && state.lang === 'en' && state.stored === 'en', JSON.stringify(state));
    record('toggle · no page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
    await toggleCtx.close();

    /* ───────────── 4 · FIVE SUB-ADMINS ───────────── */
    console.log('\n▶ 4. Five sub-admins');
    const subs = [['dina', 'dina2026', 'chats'], ['amal', 'amal2026', 'reports'], ['fatma', 'fatma2026', 'orders'], ['nada', 'nada2026', 'customers'], ['basmala', 'basmala2026', 'cashiers']];
    for (const [u, p, perm] of subs) {
      const ctx = await newContext(browser, 'en');
      const page = await ctx.newPage();
      page.on('pageerror', e => pageErrors.push(u + ' pageerror: ' + e.message));
      pageErrors = [];
      await login(page, u, p);
      const info = await page.evaluate(function () {
        var s = DS.session();
        return { role: s && s.role, perms: (DS.store.get('ds_permissions', []) || []), nav: document.querySelectorAll('.ds-nav-item').length, url: location.pathname };
      });
      record('subadmin ' + u + ' · role', info.role === 'subadmin', info.role);
      record('subadmin ' + u + ' · permission ' + perm, info.perms.indexOf(perm) > -1, info.perms.join(','));
      record('subadmin ' + u + ' · restricted sidebar', info.nav > 0 && info.nav < 14, info.nav + ' links');
      record('subadmin ' + u + ' · no JS errors', pageErrors.length === 0, pageErrors.slice(0, 1).join(''));
      await shot(page, '05-subadmin-' + u + '.png');
      await ctx.close();
    }

    /* ───────────── 5 · TENANT ISOLATION ───────────── */
    console.log('\n▶ 5. Tenant isolation (caznova / smozy)');
    for (const tenant of ['caznova', 'smozy']) {
      const ctx = await newContext(browser, 'en');
      const page = await ctx.newPage();
      page.on('pageerror', e => pageErrors.push(tenant + ' pageerror: ' + e.message));
      await login(page, tenant, tenant + '2026');
      const iso = await page.evaluate(function () {
        var u = DS.session();
        var products = DS.data.visibleProducts(u);
        var orders = DS.data.visibleOrders(u);
        var customers = DS.data.visibleOrders(u).map(function (o) { return o.customer && o.customer.phone; });
        return {
          tenant: u.tenant_id,
          productTenants: Array.from(new Set(products.map(function (p) { return p.tenant_id; }))),
          orderTenants: Array.from(new Set(orders.map(function (o) { return o.tenant_id; }))),
          products: products.length,
          orders: orders.length
        };
      });
      record('isolation ' + tenant + ' · products only own tenant', iso.productTenants.length === 1 && iso.productTenants[0] === 't-' + tenant, JSON.stringify(iso.productTenants));
      record('isolation ' + tenant + ' · orders only own tenant', iso.orderTenants.length === 1 && iso.orderTenants[0] === 't-' + tenant, JSON.stringify(iso.orderTenants));
      record('isolation ' + tenant + ' · has data', iso.products > 0 && iso.orders > 0, iso.products + ' products / ' + iso.orders + ' orders');

      for (const pageName of ['products', 'orders', 'customers']) {
        await page.goto(BASE + '/owner/' + pageName + '.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        const leaks = await arabicLeaks(page);
        record('isolation ' + tenant + '/' + pageName + ' · EN clean', leaks.length === 0, leaks.slice(0, 3).join(' ‖ '));
      }
      await shot(page, '06-isolation-' + tenant + '.png');
      await ctx.close();
    }

    /* ───────────── 6 · CUSTOMER CART → MODAL → CHECKOUT → TALQA ───────────── */
    console.log('\n▶ 6. Customer cart, modal, checkout, Talqa delivery');
    const custCtx = await newContext(browser, 'en');
    const cust = await custCtx.newPage();
    cust.on('pageerror', e => pageErrors.push('customer pageerror: ' + e.message));
    pageErrors = [];
    await login(cust, 'customer', 'customer2026');
    await cust.waitForSelector('[data-add]');
    await cust.click('[data-add]');
    await cust.waitForTimeout(500);
    const cartState = await cust.evaluate(() => ({
      floatingVisible: (function () { var f = document.querySelector('[data-floating-cart]'); return !!f && getComputedStyle(f).display !== 'none'; })(),
      count: document.querySelector('[data-floating-cart] .count') ? document.querySelector('[data-floating-cart] .count').textContent : '',
      stored: JSON.parse(localStorage.getItem('ds_cart') || '{}')
    }));
    record('customer · add to cart', cartState.stored.items && cartState.stored.items.length > 0, (cartState.stored.items || []).length + ' lines');
    record('customer · green cart bar visible', cartState.floatingVisible && Number(cartState.count) > 0, 'count=' + cartState.count);
    await shot(cust, '07-customer-cart-bar.png');

    await cust.click('[data-floating-cart]');
    await cust.waitForSelector('.modal-backdrop', { timeout: 5000 });
    await cust.waitForTimeout(350);
    const modal = await cust.evaluate(() => ({
      visible: !!document.querySelector('.modal-backdrop .modal'),
      title: (document.querySelector('.modal-backdrop .modal-title') || {}).textContent || '',
      body: (document.querySelector('.modal-backdrop .modal-body') || {}).innerText || ''
    }));
    record('customer · cart bar opens modal', modal.visible, modal.title.trim());
    record('customer · modal shows cart + total', modal.body.length > 20 && /total|checkout|subtotal/i.test(modal.body), modal.body.slice(0, 60).replace(/\n/g, ' '));
    await shot(cust, '08-cart-modal.png');

    await cust.click('.modal-backdrop .modal-foot .btn-primary');
    await cust.waitForURL('**/customer/checkout.html', { timeout: 8000 });
    await cust.waitForTimeout(1000);
    record('customer · checkout page opens', /checkout\.html$/.test(new URL(cust.url()).pathname), cust.url());
    await shot(cust, '09-checkout.png');
    await cust.click('[data-place]');
    await cust.waitForSelector('.modal-backdrop .modal-title', { timeout: 8000 });
    await cust.waitForTimeout(500);
    const placed = await cust.evaluate(() => ({
      text: (document.querySelector('.modal-backdrop') || {}).innerText || '',
      last: (function () {
        var orders = DS.data.orders.slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
        var o = orders[0];
        return { id: o.id, no: o.order_no, company: o.delivery_company_id, status: o.status, total: o.total, tenant: o.tenant_id, timeline: o.timeline.map(function (x) { return x.label; }) };
      })()
    }));
    record('customer · order confirmation modal', /order/i.test(placed.text), placed.last.no + ' · ' + placed.last.status);
    record('customer · order routed to Talqa', placed.last.company === 'dc-talqa', String(placed.last.company));
    record('customer · order timeline localized', placed.last.timeline.every(l => !AR.test(l)), placed.last.timeline.join(' → '));
    await shot(cust, '10-order-confirmed.png');
    await custCtx.close();

    /* ───────────── 7 · DELIVERY — TALQA ONLY ───────────── */
    console.log('\n▶ 7. Delivery sees Talqa orders only');
    const delCtx = await newContext(browser, 'en');
    const del = await delCtx.newPage();
    del.on('pageerror', e => pageErrors.push('delivery pageerror: ' + e.message));
    pageErrors = [];
    await login(del, 'talqa', 'talqa2026');
    await del.goto(BASE + '/delivery/orders.html', { waitUntil: 'domcontentloaded' });
    await del.waitForTimeout(1000);
    const delInfo = await del.evaluate(function () {
      var u = DS.session();
      var orders = DS.data.visibleOrders(u);
      return {
        company: u.delivery_company,
        ids: Array.from(new Set(orders.map(function (o) { return o.delivery_company_id; }))),
        count: orders.length,
        hasNew: orders.some(function (o) { return o.customer && o.customer.phone === '01123456789' && o.status === 'delivering'; })
      };
    });
    record('delivery · company is Talqa', delInfo.company === 'dc-talqa', delInfo.company);
    record('delivery · only Talqa orders', delInfo.ids.length === 1 && delInfo.ids[0] === 'dc-talqa', JSON.stringify(delInfo.ids) + ' · ' + delInfo.count + ' orders');
    record('delivery · new customer order visible', delInfo.hasNew, '');
    const delLeaks = await arabicLeaks(del);
    record('delivery · EN has no Arabic', delLeaks.length === 0, delLeaks.slice(0, 3).join(' ‖ '));
    await shot(del, '11-delivery-orders.png');
    await del.goto(BASE + '/delivery/dashboard.html', { waitUntil: 'domcontentloaded' });
    await checkPage(del, 'delivery/dashboard', { lang: 'en', wait: 900 });
    await shot(del, '12-delivery-dashboard.png');
    await delCtx.close();

    /* ───────────── 8 · MOBILE LOGIN ───────────── */
    console.log('\n▶ 8. Mobile');
    const mobCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const mob = await mobCtx.newPage();
    await mob.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    const mobCard = await mob.evaluate(() => {
      var c = document.querySelector('.login-card');
      return { w: Math.round(c.getBoundingClientRect().width), overflow: document.documentElement.scrollWidth <= window.innerWidth + 1 };
    });
    record('mobile · card fits viewport', mobCard.w <= 370 && mobCard.overflow, mobCard.w + 'px · no overflow=' + mobCard.overflow);
    await shot(mob, '13-login-mobile.png');
    await mobCtx.close();

  } catch (e) {
    console.error('\nFATAL', e);
    failures.push('FATAL: ' + e.message);
  } finally {
    await browser.close();
  }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  const summary = {
    at: new Date().toISOString(),
    base: BASE,
    passed,
    failed: total - passed,
    total,
    failures,
    results
  };
  fs.writeFileSync(path.join(__dirname, 'qa-results.json'), JSON.stringify(summary, null, 2));

  console.log('\n══════════════════════════════════════════════');
  console.log(' QA RESULT: ' + passed + '/' + total + ' passed · ' + (total - passed) + ' failed');
  if (failures.length) {
    console.log(' FAILURES:');
    failures.slice(0, 40).forEach(f => console.log('  - ' + f));
    exitCode = 1;
  }
  console.log(' Screenshots: ' + SHOTS);
  console.log('══════════════════════════════════════════════');
  process.exit(exitCode);
})();
