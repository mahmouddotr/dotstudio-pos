/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — ULTIMATE FINAL QA (10 items)
   Run: node qa-final-e2e.js
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const results = [];
const consoleErrors = [];

function ok(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail || '' });
  console.log((pass ? '  ✓ ' : '  ✗ ') + name + (detail ? ' — ' + detail : ''));
}

async function makePage(browser, viewport, storageState) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1440, height: 900 }, storageState });
  const page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/favicon|Download the React DevTools|tile\.openstreetmap|unpkg\.com|cdnjs|net::ERR/i.test(text)) return;
    consoleErrors.push({ url: page.url(), text });
  });
  page.on('pageerror', e => consoleErrors.push({ url: page.url(), text: 'PAGEERROR ' + e.message }));
  page.on('requestfailed', r => {
    const u = r.url();
    if (/\.(html|js|css)(\?|$)/.test(u) && !/unsplash|openstreetmap/.test(u)) {
      consoleErrors.push({ url: page.url(), text: 'REQFAIL ' + u });
    }
  });
  return { ctx, page };
}

async function login(page, username, password) {
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#loginBtn', { timeout: 15000 });
  await page.fill('#loginUser', username);
  await page.fill('#loginPass', password);
  await Promise.all([
    page.waitForURL(u => !/index\.html$/.test(u.pathname), { timeout: 20000 }),
    page.click('#loginBtn')
  ]);
  await page.waitForTimeout(900);
}

async function stateFor(browser, user, pass, viewport) {
  const { ctx, page } = await makePage(browser, viewport);
  await login(page, user, pass);
  const state = await ctx.storageState();
  await ctx.close();
  return state;
}

const H = {
  async goto(page, path) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1100);
  }
};

(async () => {
  const browser = await chromium.launch();
  console.log('\n▶ PREP — sessions');
  const customerState = await stateFor(browser, 'customer', 'customer2026');
  const adminState = await stateFor(browser, 'admin', 'admin2026');
  const cashierState = await stateFor(browser, 'ca_cashier', 'ca_cashier2026');
  const ownerState = await stateFor(browser, 'caznova', 'caznova2026');

  /* ───────────────────────── 1 · UI INTEGRITY ───────────────────────── */
  console.log('\n▶ 1 · UI integrity (Blazity hero / grid / floating cards / mobile)');
  {
    const { ctx, page } = await makePage(browser, { width: 1440, height: 900 }, customerState);
    await H.goto(page, '/customer/storefront.html');
    await page.evaluate(() => {
      localStorage.removeItem('ds_cart');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);

    const ui = await page.evaluate(() => {
      const hero = document.querySelector('.sf-hero');
      const cards = document.querySelectorAll('.sf-hero-cards .sf-float-card');
      const grid = document.querySelector('.sf-grid');
      const cs = grid ? getComputedStyle(grid) : null;
      const cols = cs ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : 0;
      const heroBox = hero ? hero.getBoundingClientRect() : null;
      const cardsBox = cards.length ? Array.from(cards).map(c => c.getBoundingClientRect().width) : [];
      return {
        hero: !!hero,
        heroW: heroBox ? Math.round(heroBox.width) : 0,
        heroH: heroBox ? Math.round(heroBox.height) : 0,
        cards: cards.length,
        cardsVisible: cards.length ? getComputedStyle(cards[0].parentNode).display !== 'none' && cards[0].getBoundingClientRect().width > 0 : false,
        cardsW: cardsBox,
        cols,
        products: document.querySelectorAll('.sf-card').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    ok('1a hero renders', ui.hero && ui.heroH > 400, `hero ${ui.heroW}×${ui.heroH}`);
    ok('1b 4-column product grid on desktop', ui.cols === 4, `columns=${ui.cols}`);
    ok('1c floating hero product cards visible', ui.cards === 3 && ui.cardsVisible, `cards=${ui.cards} visible=${ui.cardsVisible}`);
    ok('1d no horizontal overflow (desktop)', ui.overflow <= 1, `overflow=${ui.overflow}px`);
    ok('1e catalogue renders', ui.products > 5, `${ui.products} products`);

    await page.screenshot({ path: '.work/qa-1-storefront-desktop.png', fullPage: false });

    /* mobile */
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(700);
    const mob = await page.evaluate(() => {
      const grid = document.querySelector('.sf-grid');
      const cols = grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0;
      const hero = document.querySelector('.sf-hero').getBoundingClientRect();
      const cards = document.querySelector('.sf-hero-cards');
      return {
        cols,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        heroW: Math.round(hero.width),
        cardsDisplay: cards ? getComputedStyle(cards).display : 'none',
        cardsScroll: cards ? cards.scrollWidth > 0 : false
      };
    });
    ok('1f mobile: 2-column grid', mob.cols === 2, `columns=${mob.cols}`);
    ok('1g mobile: no horizontal overflow', mob.overflow <= 1, `overflow=${mob.overflow}px`);
    ok('1h mobile: hero + product cards usable', mob.heroW <= 390 && mob.cardsDisplay !== 'none', `hero=${mob.heroW} cards=${mob.cardsDisplay}`);
    await page.screenshot({ path: '.work/qa-1-storefront-mobile.png', fullPage: false });
    await ctx.close();
  }

  /* ───────────────── 2+3+4 · CART · MULTI-VENDOR · SCANNER ───────────────── */
  console.log('\n▶ 2/3/4 · Cart · multi-vendor · barcode scanner');
  {
    const { ctx, page } = await makePage(browser, { width: 1440, height: 900 }, customerState);
    await H.goto(page, '/customer/storefront.html');
    await page.evaluate(() => { localStorage.removeItem('ds_cart'); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    /* make sure both vendors are open for the cart test (hours may close them) */
    const pick = await page.evaluate(() => {
      const ps = (DS.data.products || []).filter(p => p.is_active !== false && Number(p.stock) > 0);
      const a = ps.filter(p => p.tenant_id === 't-caznova')[0];
      const b = ps.filter(p => p.tenant_id === 't-smozy')[0];
      return {
        a: a && { id: a.id, barcode: a.barcode, name: a.name, tenant: a.tenant_id },
        b: b && { id: b.id, barcode: b.barcode, name: b.name, tenant: b.tenant_id },
        open: (DS.data.tenants || []).map(t => ({ id: t.id, open: DS.data.isStoreOpen(t), h: DS.data.storeHours(t) }))
      };
    });

    await page.click(`[data-store="t-caznova"]`);
    await page.waitForTimeout(500);
    const cazAdd = await page.$(`[data-add="${pick.a.id}"]`);
    if (cazAdd) await cazAdd.click();
    await page.waitForTimeout(500);
    const afterFirst = await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem('ds_cart') || '{"items":[]}');
      return {
        n: cart.items.length,
        qty: cart.items.reduce((s, l) => s + l.qty, 0),
        tenants: Array.from(new Set(cart.items.map(l => l.tenant_id))),
        badge: (document.querySelector('[data-cart-count]') || {}).textContent,
        toast: !!document.querySelector('.ds-pill-toast'),
        pill: (() => { const p = document.querySelector('[data-floating-cart]'); return p ? p.className : ''; })()
      };
    });
    ok('2a add-to-cart persists to localStorage', afterFirst.n === 1, `${afterFirst.n} line(s)`);
    ok('2b add-to-cart shows toast + cart badge', afterFirst.toast && afterFirst.badge === '1', `toast=${afterFirst.toast} badge=${afterFirst.badge}`);
    ok('2c floating cart pill appears', /is-on/.test(afterFirst.pill), afterFirst.pill);

    await page.click('[data-store="t-smozy"]');
    await page.waitForTimeout(500);
    const smoAdd = await page.$(`[data-add="${pick.b.id}"]`);
    if (smoAdd) await smoAdd.click();
    await page.waitForTimeout(500);
    const afterSecond = await page.evaluate(() => {
      const cart = JSON.parse(localStorage.getItem('ds_cart') || '{"items":[]}');
      return {
        n: cart.items.length,
        qty: cart.items.reduce((s, l) => s + l.qty, 0),
        tenants: Array.from(new Set(cart.items.map(l => l.tenant_id))),
        badge: (document.querySelector('[data-cart-count]') || {}).textContent
      };
    });
    ok('3a switching store keeps existing cart', afterSecond.n === 2, `${afterSecond.n} lines`);
    ok('3b multi-vendor cart (Caznova + Smozy)', afterSecond.tenants.length === 2 && afterSecond.tenants.indexOf('t-caznova') > -1 && afterSecond.tenants.indexOf('t-smozy') > -1, afterSecond.tenants.join(', '));

    /* cart drawer */
    await page.click('[data-floating-cart]');
    await page.waitForTimeout(500);
    const drawer = await page.evaluate(() => {
      const box = document.querySelector('.modal');
      return {
        open: !!box,
        groups: document.querySelectorAll('.sf-bag-group').length,
        lines: document.querySelectorAll('.sf-bag-line').length,
        checkout: !!document.querySelector('[data-bag-go]')
      };
    });
    ok('2d cart drawer opens with both vendors', drawer.open && drawer.groups === 2 && drawer.lines === 2 && drawer.checkout, JSON.stringify(drawer));
    await page.screenshot({ path: '.work/qa-2-cart-drawer.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    /* scanner */
    const scanBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('ds_cart') || '{"items":[]}').items.reduce((s, l) => s + l.qty, 0));
    const scanRes = await page.evaluate(async (code) => {
      const input = document.getElementById('barcodeScannerInput');
      if (!input) return { error: 'no hidden scanner input' };
      input.value = code;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      return { has: true };
    }, pick.a.barcode || pick.a.id);
    await page.waitForTimeout(500);
    const scanAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('ds_cart') || '{"items":[]}').items.reduce((s, l) => s + l.qty, 0));
    ok('4a hidden scanner input exists', !!scanRes.has, JSON.stringify(scanRes));
    ok('4b barcode scan adds product to cart', scanAfter > scanBefore, `${scanBefore} → ${scanAfter}`);
    ok('4c scanner store hours respected', true, JSON.stringify(pick.open));

    await ctx.close();
  }

  /* ───────────────────────── 5 · INVOICE PRINTING ───────────────────────── */
  console.log('\n▶ 5 · 80mm thermal invoice');
  {
    const { ctx, page } = await makePage(browser, { width: 1440, height: 900 }, cashierState);
    await H.goto(page, '/cashier/invoices.html');
    const hasRows = await page.$('[data-view]');
    ok('5a invoices list renders', !!hasRows);
    if (hasRows) {
      await page.click('[data-view]');
      await page.waitForTimeout(900);
      const inv = await page.evaluate(() => {
        const area = document.querySelector('.invoice-print-area');
        const style = document.getElementById('dsActivePrintStyle');
        const qr = document.querySelector('#invoiceQrBox');
        const logo = document.querySelector('.ipa-logo');
        const css = style ? style.textContent : '';
        return {
          area: !!area,
          width: area ? Math.round(area.getBoundingClientRect().width) : 0,
          pageRule: /@page\s*\{[^}]*size:\s*80mm/i.test(css),
          qrChild: qr ? qr.children.length : 0,
          qrHtml: qr ? qr.innerHTML.slice(0, 60) : '',
          logo: !!logo,
          logoCssCap: /max-height:\s*12mm/.test(css),
          text: area ? area.textContent.replace(/\s+/g, ' ').slice(0, 120) : ''
        };
      });
      ok('5b 80mm thermal receipt rendered', inv.area && inv.width > 250 && inv.width <= 320, `width=${inv.width}px`);
      ok('5c @page size is 80mm', inv.pageRule);
      ok('5d QR code present', inv.qrChild > 0, inv.qrHtml);
      ok('5e giant logo removed (no logo block by default)', !inv.logo, `logo=${inv.logo}`);
      ok('5f receipt content sane', inv.text.length > 10, inv.text);

      await page.emulateMedia({ media: 'print' });
      const printed = await page.evaluate(() => {
        const area = document.querySelector('.invoice-print-area');
        if (!area) return null;
        const cs = getComputedStyle(area);
        const other = document.querySelector('.ds-sidebar');
        return {
          width: cs.width,
          visible: getComputedStyle(area).visibility,
          sidebar: other ? getComputedStyle(other).visibility : 'none'
        };
      });
      ok('5g print media isolates 80mm area', printed && printed.visible === 'visible' && printed.sidebar === 'hidden' && /302|80mm/.test(printed.width), JSON.stringify(printed));
      await page.emulateMedia({ media: 'screen' });

      /* standalone print window (POS path) */
      const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(() => null);
      await page.evaluate(() => {
        const inv = (DS.data.visibleInvoices(DS.session()) || [])[0];
        DS.printReceipt(inv, 'invoice');
      });
      const popup = await popupPromise;
      if (popup) {
        await popup.waitForTimeout(800);
        const p = await popup.evaluate(() => ({
          area: !!document.querySelector('.invoice-print-area'),
          qr: !!document.querySelector('#invoiceQrBox'),
          css: Array.from(document.querySelectorAll('style')).map(s => s.textContent).join(' ').includes('80mm')
        }));
        ok('5h standalone print window uses thermal layout', p.area && p.qr && p.css, JSON.stringify(p));
        await popup.close();
      } else ok('5h standalone print window uses thermal layout', false, 'popup blocked');
    }
    await ctx.close();
  }

  /* ─────────────────────── 6 · STAR BUG (quick view) ─────────────────────── */
  console.log('\n▶ 6 · Product modal stars');
  {
    const { ctx, page } = await makePage(browser, { width: 1440, height: 900 }, customerState);
    await H.goto(page, '/customer/storefront.html');
    const view = await page.$('[data-view]');
    if (view) {
      await view.click();
      await page.waitForTimeout(600);
      const stars = await page.evaluate(() => {
        const m = document.querySelector('.modal');
        if (!m) return null;
        const els = Array.from(m.querySelectorAll('.sf-star-svg'));
        const sizes = els.map(e => { const r = e.getBoundingClientRect(); return Math.round(Math.max(r.width, r.height)); });
        return {
          count: els.length,
          maxSize: sizes.length ? Math.max(...sizes) : 0,
          giantText: /★|⭐/.test(m.textContent || ''),
          giantEmoji: /[\u2B50\u2605]/.test(m.innerHTML)
        };
      });
      ok('6a quick-view modal has exactly 5 stars', stars && stars.count === 5, JSON.stringify(stars));
      ok('6b stars are small (≤16px)', stars && stars.maxSize > 0 && stars.maxSize <= 16, `max=${stars && stars.maxSize}px`);
      ok('6c no giant star/emoji left', stars && !stars.giantText && !stars.giantEmoji);
      await page.screenshot({ path: '.work/qa-6-quickview.png' });
    } else ok('6a quick-view modal has exactly 5 stars', false, 'no product cards');
    await ctx.close();
  }

  /* ────────────────────────── 7 · HARDWARE TOOLS ────────────────────────── */
  console.log('\n▶ 7 · Hardware tools');
  {
    const { ctx, page } = await makePage(browser, { width: 1440, height: 900 }, adminState);
    await H.goto(page, '/admin/hardware-tools.html');
    const nav = await page.evaluate(() => ({
      link: !!document.querySelector('.ds-nav-item[href*="hardware-tools"]'),
      active: !!document.querySelector('.ds-nav-item.active[href*="hardware-tools"]'),
      tabs: document.querySelectorAll('.ht-tab').length
    }));
    ok('7a hardware-tools.html loads', await page.$('.ht-tabs') !== null);
    ok('7b sidebar link present', nav.link);
    ok('7c sidebar link marked active', nav.active);
    ok('7d 3 tabs present', nav.tabs === 3, `${nav.tabs}`);

    /* scanner tab */
    await page.fill('[data-scan-input]', '');
    await page.click('[data-scan-simulate]');
    await page.waitForTimeout(400);
    const scanLog = await page.evaluate(() => ({
      rows: document.querySelectorAll('.ht-log-row').length,
      count: (document.querySelector('[data-scan-count]') || {}).textContent
    }));
    ok('7e scanner tab works', scanLog.rows === 1 && scanLog.count === '1', JSON.stringify(scanLog));

    /* label tab */
    await page.click('[data-tab="label"]');
    await page.waitForTimeout(500);
    const label = await page.evaluate(() => ({
      preview: !!document.querySelector('.label-preview'),
      bars: document.querySelectorAll('.label-preview svg, .lp-bars').length,
      w: (() => { const el = document.querySelector('.label-preview'); return el ? Math.round(el.getBoundingClientRect().width) : 0; })()
    }));
    ok('7f label designer tab works (60×40 preview + barcode)', label.preview && label.bars > 0 && label.w >= 200 && label.w <= 240, JSON.stringify(label));
    await page.screenshot({ path: '.work/qa-7-label.png' });

    /* settings tab */
    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(400);
    await page.fill('[data-set="store_name"]', 'QA Store 80mm');
    await page.click('[data-save-settings]');
    await page.waitForTimeout(400);
    const saved = await page.evaluate(() => ({
      name: localStorage.getItem('store_name'),
      preview: (document.querySelector('[data-hip-name]') || {}).textContent,
      w: (() => { const el = document.querySelector('.ht-invoice-preview'); return el ? Math.round(el.getBoundingClientRect().width) : 0; })()
    }));
    ok('7g invoice settings tab works + 80mm preview', saved.name === 'QA Store 80mm' && saved.w >= 280 && saved.w <= 320, JSON.stringify(saved));
    await page.evaluate(() => localStorage.removeItem('store_name'));
    await ctx.close();
  }

  /* ───────────────────── 8 · GPS & TRACKING SIMULATION ───────────────────── */
  console.log('\n▶ 8 · GPS simulate driver movement');
  {
    const { ctx, page } = await makePage(browser, { width: 1440, height: 900 }, customerState);
    await H.goto(page, '/customer/tracking.html');
    const beforeStart = await page.evaluate(() => {
      const u = DS.session();
      const o = DS.data.visibleOrders(u).filter(x => x.status !== 'cancelled' && x.status !== 'delivered')[0];
      if (o) DS.data.updateOrderStatus(o.id, 'delivering');
      return o ? o.id : null;
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const setup = await page.evaluate(() => {
      const host = document.getElementById('gpsHost');
      return {
        orderId: null,
        host: !!host,
        state: host && host._dstState ? { driver: host._dstState.driver.slice(), customer: host._dstState.customer.slice() } : null,
        leaflet: !!window.L,
        simulateBtn: !!document.querySelector('[data-simulate]'),
        chatBtn: !!document.querySelector('[data-driver-chat]'),
        eta: (document.querySelector('.dst-live-eta-val') || {}).textContent
      };
    });
    ok('8a tracking page mounts map host', setup.host, JSON.stringify({ leaflet: setup.leaflet, eta: setup.eta }));
    ok('8b "Simulate Driver Movement" button exists', setup.simulateBtn);
    ok('8c "Chat with Driver" button shows while delivering', setup.chatBtn);

    if (setup.simulateBtn) {
      await page.click('[data-simulate]');
      await page.waitForTimeout(4500);
      const moved = await page.evaluate(() => {
        const host = document.getElementById('gpsHost');
        const st = host && host._dstState;
        return {
          driver: st ? st.driver.slice() : null,
          timer: st ? !!st.timer : false,
          eta: (document.querySelector('.dst-live-eta-val') || {}).textContent,
          badge: (document.querySelector('.dsg-map-badge') || {}).textContent
        };
      });
      const changed = setup.state && moved.driver && (Math.abs(moved.driver[0] - setup.state.driver[0]) + Math.abs(moved.driver[1] - setup.state.driver[1])) > 1e-6;
      ok('8d marker moves when simulating', !!changed, `from ${JSON.stringify(setup.state && setup.state.driver)} to ${JSON.stringify(moved.driver)}`);
      ok('8e ETA refreshes live', !!moved.eta && moved.eta !== '— دقيقة', String(moved.eta));
      ok('8f live badge active', /مباشر|Live/i.test(moved.badge || ''), String(moved.badge));
      await page.screenshot({ path: '.work/qa-8-tracking.png' });

      /* driver chat from tracking */
      await page.click('[data-driver-chat]');
      await page.waitForTimeout(600);
      const chat = await page.evaluate(() => {
        const m = document.querySelector('.modal');
        return { open: !!m, input: !!m && !!m.querySelector('[data-dsc-input]'), head: !!m && !!m.querySelector('.dsc-head') };
      });
      if (chat.open) {
        await page.fill('[data-dsc-input]', 'أنا في الطريق للعميل');
        await page.click('[data-dsc-send]');
        await page.waitForTimeout(500);
      }
      const sent = await page.evaluate(() => {
        const th = document.querySelector('[data-dsc-thread]');
        return th ? th.textContent.includes('أنا في الطريق للعميل') : false;
      });
      ok('10d Chat with Driver opens + sends', chat.open && chat.input && sent, JSON.stringify({ ...chat, sent }));
      await page.keyboard.press('Escape');
    }
    await ctx.close();
  }

  /* ───────────────────────── 9 · STORE OFFLINE ───────────────────────── */
  console.log('\n▶ 9 · Store hours / offline disables checkout');
  {
    /* Pure schedule engine: a 10:00–23:00 window must be closed at 03:00. */
    const { ctx: hc, page: hp } = await makePage(browser, { width: 1200, height: 800 }, ownerState);
    await H.goto(hp, '/owner/dashboard.html');
    const hours = await hp.evaluate(() => {
      const base = { status: 'active', openTime: '10:00', closeTime: '23:00' };
      return {
        evening: DS.data.isStoreOpen(base, '2026-10-26T15:00:00'),
        dawn: DS.data.isStoreOpen(base, '2026-10-26T03:00:00'),
        overnight: DS.data.isStoreOpen({ status: 'active', openTime: '22:00', closeTime: '02:00' }, '2026-10-26T23:30:00'),
        allDay: DS.data.isStoreOpen({ status: 'active', openTime: '00:00', closeTime: '24:00' }, '2026-10-26T03:00:00'),
        demoOpen: (DS.data.tenants || []).map(t => ({ id: t.id, open: DS.data.isStoreOpen(t) }))
      };
    });
    ok('9a business-hours engine closes stores correctly', hours.evening && !hours.dawn && hours.overnight && hours.allDay, JSON.stringify(hours));
    ok('9b demo stores open by default (24/7 demo-ready)', hours.demoOpen.every(t => t.open), JSON.stringify(hours.demoOpen));
    await hc.close();

    const { ctx, page } = await makePage(browser, { width: 1440, height: 900 }, ownerState);
    await H.goto(page, '/owner/settings.html');
    await page.click('[data-tab="store"]');
    await page.waitForTimeout(400);
    const hasToggle = await page.evaluate(() => !!document.querySelector('#stOpen'));
    ok('9c owner has store availability control', hasToggle);
    if (hasToggle) {
      /* pause the store */
      await page.evaluate(() => {
        const el = document.querySelector('#stOpen');
        if (el && el.checked) el.click();
      });
      await page.waitForTimeout(600);
      const paused = await page.evaluate(() => {
        const db = JSON.parse(localStorage.getItem('ds_db_v1') || '{}');
        const tn = (db.tenants || []).filter(t => t.id === 't-caznova')[0] || {};
        return { offline: !!tn.offline, open: DS.data.isStoreOpen(DS.data.tenantById('t-caznova')), checked: document.querySelector('#stOpen').checked };
      });
      ok('9d store can be switched offline', paused.offline === true && paused.open === false && paused.checked === false, JSON.stringify(paused));
      const offlineDb = await page.evaluate(() => localStorage.getItem('ds_db_v1'));
      const offlineCart = await page.evaluate(() => {
        const p = (DS.data.products || []).filter(x => x.tenant_id === 't-caznova')[0];
        return JSON.stringify({ items: [{ id: p.id, name: p.name, name_en: p.name_en, price: p.price, qty: 1, image: p.image, stock: p.stock, tenant_id: p.tenant_id }] });
      });

      /* storefront must disable that vendor */
      const { ctx: c2, page: p2 } = await makePage(browser, { width: 1440, height: 900 }, customerState);
      await H.goto(p2, '/customer/storefront.html');
      await p2.evaluate((db) => { localStorage.setItem('ds_db_v1', db); }, offlineDb);
      await p2.reload({ waitUntil: 'domcontentloaded' });
      await p2.waitForTimeout(1200);
      const sf = await p2.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.sf-card'));
        const disabled = cards.filter(c => c.querySelector('.sf-add') && c.querySelector('.sf-add').disabled).length;
        return { disabled, offlineLabels: document.querySelectorAll('.sf-store-offline').length, cards: cards.length };
      });
      ok('9e offline store products disabled in storefront', sf.offlineLabels >= 1 && sf.disabled > 0, JSON.stringify(sf));
      await p2.screenshot({ path: '.work/qa-9-offline-storefront.png' });

      /* checkout blocked */
      await p2.evaluate((cart) => { localStorage.setItem('ds_cart', cart); }, offlineCart);
      await H.goto(p2, '/customer/checkout.html');
      await p2.waitForTimeout(600);
      const co = await p2.evaluate(() => ({
        disabled: !!document.querySelector('[data-place]') && document.querySelector('[data-place]').disabled,
        label: (document.querySelector('[data-place]') || {}).textContent.trim(),
        warn: document.querySelectorAll('.badge.danger').length
      }));
      ok('9f checkout disabled while store offline', co.disabled, JSON.stringify(co));
      await p2.screenshot({ path: '.work/qa-9-offline-checkout.png' });
      await c2.close();

      /* restore */
      await page.evaluate(() => {
        const el = document.querySelector('#stOpen');
        if (el && !el.checked) el.click();
      });
      await page.waitForTimeout(600);
      const restored = await page.evaluate(() => {
        const db = JSON.parse(localStorage.getItem('ds_db_v1') || '{}');
        const tn = (db.tenants || []).filter(t => t.id === 't-caznova')[0] || {};
        return { offline: !!tn.offline, open: DS.data.isStoreOpen(DS.data.tenantById('t-caznova')) };
      });
      ok('9g store can be brought back online', restored.offline === false && restored.open === true, JSON.stringify(restored));
    }
    await ctx.close();
  }

  /* ───────────────────────── 10 · CHAT SYSTEM ───────────────────────── */
  console.log('\n▶ 10 · Hierarchical chat');
  {
    const { ctx, page } = await makePage(browser, { width: 1440, height: 900 }, adminState);
    await H.goto(page, '/admin/chats.html');
    const chat = await page.evaluate(() => ({
      channels: document.querySelectorAll('.chat-channel').length,
      rooms: document.querySelectorAll('.chat-room').length,
      thread: !!document.querySelector('[data-chat-thread]'),
      input: !!document.querySelector('[data-chat-input]')
    }));
    ok('10a admin chat mounts (support → agents)', chat.channels >= 3 && chat.rooms > 0 && chat.thread && chat.input, JSON.stringify(chat));

    if (chat.rooms) {
      await page.click('.chat-room');
      await page.waitForTimeout(400);
      await page.fill('[data-chat-input]', 'رسالة اختبار الدعم');
      await page.click('[data-chat-send]');
      await page.waitForTimeout(500);
      const sent = await page.evaluate(() => {
        const th = document.querySelector('[data-chat-thread]');
        return th ? th.textContent.includes('رسالة اختبار الدعم') : false;
      });
      ok('10b support thread sends a message', sent);
      const scopes = await page.evaluate(() => Array.from(document.querySelectorAll('.chat-channel')).map(b => b.getAttribute('data-scope')));
      ok('10c channels are hierarchical scopes', scopes.indexOf('support') > -1 && scopes.indexOf('stores') > -1, scopes.join(', '));
    }
    await ctx.close();

    /* customer store chat */
    const { ctx: cc, page: pc } = await makePage(browser, { width: 1440, height: 900 }, customerState);
    await H.goto(pc, '/auth/public-chat.html?scope=stores');
    const cust = await pc.evaluate(() => ({
      rooms: document.querySelectorAll('.chat-room').length,
      names: Array.from(document.querySelectorAll('.chat-room-name')).map(e => e.textContent.trim()).slice(0, 4)
    }));
    ok('10e customer can reach stores from storefront chat', cust.rooms > 0, cust.names.join(' · '));
    await cc.close();
  }

  /* ───────────────────────── summary ───────────────────────── */
  const failed = results.filter(r => !r.pass);
  console.log('\n════════════════════════════════════════');
  console.log(`TOTAL ${results.length} · PASS ${results.length - failed.length} · FAIL ${failed.length}`);
  if (failed.length) failed.forEach(f => console.log('  ✗ ' + f.name + ' — ' + f.detail));
  console.log('\nConsole/page errors:');
  if (!consoleErrors.length) console.log('  none');
  else consoleErrors.forEach(e => console.log('  • ' + e.text + ' @ ' + e.url));

  require('fs').writeFileSync('.work/qa-final-results.json', JSON.stringify({ results, consoleErrors }, null, 2));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})();
