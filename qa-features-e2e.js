/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — FINAL FEATURES E2E
   Accounts · routing · 1-on-1 chat · God Mode · CRUD ·
   subscriptions · storefront → cart → checkout → stock.
   Run: node qa-features-e2e.js
   ═══════════════════════════════════════════════════════════════ */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const results = [];
let consoleErrors = [];

function ok(name, pass, detail) {
  results.push({ name, pass: !!pass, detail: detail || '' });
  console.log((pass ? '  ✓ ' : '  ✗ ') + name + (detail ? ' — ' + detail : ''));
}

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/favicon|Download the React DevTools/i.test(text)) return;
    consoleErrors.push({ url: page.url(), text });
  });
  page.on('pageerror', e => consoleErrors.push({ url: page.url(), text: 'PAGEERROR ' + e.message }));
  return { ctx, page };
}

async function login(page, username, password) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#loginBtn');
      await page.fill('#loginUser', username);
      await page.fill('#loginPass', password);
      await page.click('#loginBtn');
      await page.waitForURL(u => !/index\.html$/.test(u.pathname), { timeout: 20000 });
      await page.waitForTimeout(850);
      return;
    } catch (e) {
      if (attempt === 1) throw e;
      await page.waitForTimeout(500);
    }
  }
}

const ACCOUNTS = [
  ['admin', 'admin2026', '/admin/dashboard.html'],
  ['dina', 'dina2026', '/admin/dashboard.html'],
  ['amal', 'amal2026', '/admin/dashboard.html'],
  ['fatma', 'fatma2026', '/admin/dashboard.html'],
  ['nada', 'nada2026', '/admin/dashboard.html'],
  ['basmala', 'basmala2026', '/admin/dashboard.html'],
  ['caznova', 'caznova2026', '/owner/dashboard.html'],
  ['smozy', 'smozy2026', '/owner/dashboard.html'],
  ['bnsheikh', 'bnsheikh2026', '/owner/dashboard.html'],
  ['mastore', 'mastore2026', '/owner/dashboard.html'],
  ['ca_cashier', 'ca_cashier2026', '/cashier/pos.html'],
  ['sm_cashier', 'sm_cashier2026', '/cashier/pos.html'],
  ['bn_cashier', 'bn_cashier2026', '/cashier/pos.html'],
  ['ma_cashier', 'ma_cashier2026', '/cashier/pos.html'],
  ['talqa', 'talqa2026', '/delivery/dashboard.html'],
  ['hala', 'hala2026', '/delivery/dashboard.html'],
  ['ahla', 'ahla2026', '/delivery/dashboard.html'],
  ['customer', 'customer2026', '/customer/storefront.html']
];

(async () => {
  const browser = await chromium.launch();

  /* ───────────── 1 · all 18 accounts + routing + shell ───────────── */
  console.log('\n▶ Accounts & routing');
  for (const [user, pass, route] of ACCOUNTS) {
    const { ctx, page } = await newPage(browser);
    try {
      await login(page, user, pass);
      const pathname = new URL(page.url()).pathname;
      const shell = await page.locator('.ds-sidebar').count();
      const nav = await page.locator('.ds-nav-item').count();
      ok(user + ' → ' + route, pathname === route && shell === 1 && nav > 0, pathname + ' · nav ' + nav);
    } catch (e) {
      ok(user + ' login', false, e.message.split('\n')[0]);
    }
    await ctx.close();
  }

  /* ───────────── 2 · login subscription modal alignment ───────────── */
  console.log('\n▶ Login subscription modal');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    await page.click('#dspIndexSubsBtn');
    await page.waitForTimeout(500);
    const text = await page.locator('[data-dsp-subs-backdrop] .dsp-subs-grid').innerText();
    ok('three aligned plans', /299/.test(text) && /1499/.test(text) && /2499/.test(text), text.replace(/\s+/g, ' ').slice(0, 120));
    ok('lifetime price removed', !/5999/.test(text));
    const cards = await page.locator('[data-dsp-subs-backdrop] .dsp-subs-grid > div').count();
    ok('three plan cards', cards === 3, String(cards));
    await ctx.close();
  }

  /* ───────────── 3 · admin 1-on-1 chat + block + report ───────────── */
  console.log('\n▶ Chat (admin)');
  {
    const { ctx, page } = await newPage(browser);
    await login(page, 'admin', 'admin2026');
    await page.goto(BASE + '/admin/chats.html');
    await page.waitForTimeout(1000);

    const scopes = await page.locator('[data-scope]').evaluateAll(els => els.map(e => e.getAttribute('data-scope')));
    ok('three hierarchical channels', scopes.join(',') === 'support,stores,delivery', scopes.join(','));
    ok('no General channel', !scopes.includes('public'));

    const contacts = await page.locator('[data-contact]').count();
    ok('support lists people', contacts > 10, String(contacts));
    const firstRoom = await page.locator('.chat-room.active .chat-room-name').innerText();
    await page.locator('[data-contact]').first().click();
    await page.waitForTimeout(300);
    const bubblesBefore = await page.locator('.chat-bubble').count();
    await page.fill('[data-chat-input]', 'رسالة E2E من الأدمن');
    await page.click('[data-chat-send]');
    await page.waitForTimeout(450);
    const bubblesAfter = await page.locator('.chat-bubble').count();
    const lastText = await page.locator('.chat-bubble').last().innerText();
    ok('1-on-1 send message', bubblesAfter === bubblesBefore + 1 && lastText.includes('E2E'), firstRoom + ' · ' + bubblesBefore + '→' + bubblesAfter);

    await page.click('[data-chat-settings]');
    await page.waitForTimeout(350);
    ok('settings menu opens', (await page.locator('.chat-settings').count()) === 1);
    await page.click('[data-settings-block]');
    await page.waitForTimeout(450);
    const blockedBlocks = await page.evaluate(() => DS.data.chatBlocks.length);
    ok('block user', (await page.locator('.chat-blocked-bar').count()) === 1 && blockedBlocks >= 1, 'blocks ' + blockedBlocks);
    await page.click('[data-chat-unblock]');
    await page.waitForTimeout(400);
    const unblockedBlocks = await page.evaluate(() => DS.data.chatBlocks.length);
    ok('unblock user', (await page.locator('.chat-blocked-bar').count()) === 0 && unblockedBlocks === 0);

    await page.click('[data-chat-settings]');
    await page.waitForTimeout(300);
    await page.click('[data-settings-report]');
    await page.waitForTimeout(450);
    ok('report form opens', (await page.locator('.chat-report').count()) === 1);
    await page.click('.modal-foot [data-action="1"]');
    await page.waitForTimeout(500);
    const reports = await page.evaluate(() => DS.data.chatReports.length);
    ok('report submitted', reports >= 1, 'reports ' + reports);

    await page.click('[data-scope="stores"]');
    await page.waitForTimeout(450);
    ok('stores channel lists stores', (await page.locator('[data-contact]').count()) === 4);
    await page.click('[data-scope="delivery"]');
    await page.waitForTimeout(450);
    ok('delivery channel lists companies', (await page.locator('[data-contact]').count()) === 3);
    await ctx.close();
  }

  /* ───────────── 4 · customer chat side ───────────── */
  console.log('\n▶ Chat (customer)');
  {
    const { ctx, page } = await newPage(browser);
    await login(page, 'customer', 'customer2026');
    await page.goto(BASE + '/auth/public-chat.html');
    await page.waitForTimeout(1000);
    const names = await page.locator('.chat-room-name').allTextContents();
    ok('support shows agents', names.length >= 6 && names.join(' ').includes('System Admin'), names.join(' | '));
    const bubbles = await page.locator('.chat-bubble').count();
    ok('seeded 1-on-1 thread', bubbles === 3, 'bubbles ' + bubbles);
    await page.fill('[data-chat-input]', 'شكراً يا فريق DotStudio');
    await page.click('[data-chat-send]');
    await page.waitForTimeout(400);
    ok('customer can reply', (await page.locator('.chat-bubble').count()) === bubbles + 1);
    await page.goto(BASE + '/auth/public-chat.html?scope=stores');
    await page.waitForTimeout(800);
    ok('customer sees stores list', (await page.locator('[data-contact]').count()) === 4);
    await ctx.close();
  }

  /* ───────────── 4b · store threads stay private (1-on-1) ───────────── */
  console.log('\n▶ Store thread privacy');
  {
    const { ctx, page } = await newPage(browser);
    await login(page, 'caznova', 'caznova2026');
    await page.goto(BASE + '/owner/chats.html');
    await page.waitForTimeout(1000);
    await page.click('[data-scope="stores"]');
    await page.waitForTimeout(500);
    const ownerContacts = await page.locator('[data-contact] .chat-room-name').allTextContents();
    ok('store team sees customer threads', ownerContacts.length > 0 && ownerContacts.join(' ').includes('ياسمين'), ownerContacts.join(' | '));
    const ownerBubbles = await page.locator('.chat-bubble').count();
    await page.fill('[data-chat-input]', 'رد المتجر E2E');
    await page.click('[data-chat-send]');
    await page.waitForTimeout(450);
    ok('store team can reply', (await page.locator('.chat-bubble').count()) === ownerBubbles + 1);

    const priv = await page.evaluate(() => {
      const byName = n => DS.data.users.filter(u => u.username === n)[0];
      const customer = byName('customer');
      const otherStore = byName('mastore');
      const otherPerson = byName('dina');
      const roomA = DS.data.chatRoomIdFor('stores', 't-caznova', customer);
      const roomB = DS.data.chatRoomIdFor('stores', 't-caznova', otherPerson);
      const leaked = DS.data.roomsFor(otherStore).filter(r => r.peer_id === 't-caznova' && r.person_id !== otherStore.id).length;
      const shared = DS.data.chatRoom(customer, 'stores', 't-caznova', false);
      const ownerMsg = shared && shared.messages.some(m => m.text === 'رد المتجر E2E');
      return { roomA, roomB, leaked, ownerMsg };
    });
    ok('every person gets a private store room', !!priv.roomA && !!priv.roomB && priv.roomA !== priv.roomB);
    ok('other stores cannot read the thread', priv.leaked === 0, 'leaked=' + priv.leaked);
    ok('owner reply lands in the customer thread', priv.ownerMsg === true);

    const dpriv = await page.evaluate(() => {
      const byName = n => DS.data.users.filter(u => u.username === n)[0];
      const cz = byName('caznova'), ma = byName('mastore');
      const a = DS.data.chatRoomIdFor('delivery', 'dc-hala', cz);
      const b = DS.data.chatRoomIdFor('delivery', 'dc-hala', ma);
      const leaked = DS.data.roomsFor(ma).filter(r => r.scope === 'delivery' && r.peer_id === 'dc-hala').length;
      const rider = byName('hala');
      const riderSees = DS.data.chatContacts(rider, 'delivery').map(c => c.name);
      return { a, b, leaked, riderSees };
    });
    ok('every person gets a private delivery room', !!dpriv.a && !!dpriv.b && dpriv.a !== dpriv.b);
    ok('other stores cannot read the company thread', dpriv.leaked === 0, 'leaked=' + dpriv.leaked);
    ok('rider sees the company inbox threads', dpriv.riderSees.length >= 1, dpriv.riderSees.join(' | '));
    await ctx.close();
  }

  /* ───────────── 5 · God Mode ───────────── */
  console.log('\n▶ God Mode');
  {
    const { ctx, page } = await newPage(browser);
    await login(page, 'admin', 'admin2026');
    await page.goto(BASE + '/admin/users.html');
    await page.waitForTimeout(950);
    const rows = await page.locator('tbody tr').count();
    ok('users directory lists all accounts', rows === 18, String(rows));
    ok('login-as available per user', (await page.locator('[data-login-as]').count()) === 18);

    await page.locator('tbody tr', { hasText: 'ca_cashier' }).locator('[data-login-as]').click();
    await page.waitForURL(/cashier\/pos\.html/, { timeout: 15000 });
    await page.waitForTimeout(850);
    const banner = await page.locator('.ds-impersonation-banner').innerText();
    ok('impersonation lands on target dashboard', /cashier\/pos\.html/.test(page.url()));
    ok('fixed banner names the user', banner.includes('أنت الآن تتصفح كـ') && banner.includes('كاشير Caznova'), banner.replace(/\s+/g, ' '));
    ok('fixed banner offers return', banner.includes('العودة للأدمن'));
    await page.click('[data-stop-impersonation]');
    await page.waitForURL(/admin\/dashboard\.html/, { timeout: 15000 });
    await page.waitForTimeout(700);
    ok('return restores admin session', /admin\/dashboard\.html/.test(page.url()) && (await page.locator('.ds-impersonation-banner').count()) === 0);
    await ctx.close();
  }

  /* ───────────── 6 · Advanced user CRUD ───────────── */
  console.log('\n▶ Advanced CRUD');
  {
    const { ctx, page } = await newPage(browser);
    await login(page, 'admin', 'admin2026');
    await page.goto(BASE + '/admin/users.html');
    await page.waitForTimeout(950);
    const before = await page.locator('tbody tr').count();

    await page.locator('tbody tr', { hasText: 'dina' }).first().locator('[data-menu]').click();
    await page.waitForTimeout(250);
    await page.click('.ds-row-menu [data-act="duplicate"]');
    await page.waitForTimeout(650);
    const copyRow = page.locator('tbody tr', { hasText: 'dina_copy' });
    ok('duplicate user', (await page.locator('tbody tr').count()) === before + 1 && (await copyRow.count()) === 1);

    await copyRow.locator('[data-menu]').click();
    await page.waitForTimeout(250);
    await page.click('.ds-row-menu [data-act="toggle"]');
    await page.waitForTimeout(550);
    const copyInactive = await copyRow.locator('.badge').filter({ hasText: 'موقوف' }).count();
    const dbInactive = await page.evaluate(() => (DS.data.users.filter(u => u.username === 'dina_copy')[0] || {}).is_active);
    ok('suspend user', copyInactive === 1 && dbInactive === false, 'is_active=' + dbInactive);

    await copyRow.locator('[data-menu]').click();
    await page.waitForTimeout(250);
    await page.click('.ds-row-menu [data-act="delete"]');
    await page.waitForTimeout(400);
    await page.click('.modal-foot [data-action="1"]');
    await page.waitForTimeout(650);
    ok('delete permanently', (await page.locator('tbody tr', { hasText: 'dina_copy' }).count()) === 0 && (await page.locator('tbody tr').count()) === before);
    await ctx.close();
  }

  /* ───────────── 7 · Subscription manage + instant suspend ───────────── */
  console.log('\n▶ Subscriptions');
  {
    const { ctx, page } = await newPage(browser);
    await login(page, 'admin', 'admin2026');
    await page.goto(BASE + '/admin/subscriptions.html');
    await page.waitForTimeout(1000);

    const beforeDays = await page.evaluate(() => DS.data.activeSubscription('t-smozy').daysLeft);
    await page.locator('tbody tr', { hasText: 'Smozy' }).locator('[data-manage]').click();
    await page.waitForTimeout(400);
    await page.click('[data-sub-plus]');
    await page.click('.modal-foot [data-action="1"]');
    await page.waitForTimeout(750);
    const afterDays = await page.evaluate(() => DS.data.activeSubscription('t-smozy').daysLeft);
    ok('+7 days extends subscription', afterDays === beforeDays + 7, beforeDays + ' → ' + afterDays);

    await page.locator('tbody tr', { hasText: 'Smozy' }).locator('[data-manage]').click();
    await page.waitForTimeout(350);
    await page.click('[data-sub-toggle]');
    await page.waitForTimeout(650);
    const status = await page.evaluate(() => DS.data.tenantById('t-smozy').status);
    ok('suspend store immediately', status === 'suspended', status);

    await page.evaluate(() => { ['cz_user', 'cz_session', 'cz_role', 'cz_mock', 'ds_permissions'].forEach(k => localStorage.removeItem(k)); });
    await page.goto(BASE + '/index.html');
    await page.fill('#loginUser', 'smozy');
    await page.fill('#loginPass', 'smozy2026');
    await page.click('#loginBtn');
    await page.waitForTimeout(800);
    const err = await page.locator('#loginErr').innerText();
    ok('suspended store blocks owner login', /موقوف/.test(err) && /index\.html/.test(page.url()), err);

    await login(page, 'admin', 'admin2026');
    await page.goto(BASE + '/admin/subscriptions.html');
    await page.waitForTimeout(900);
    await page.locator('tbody tr', { hasText: 'Smozy' }).locator('[data-manage]').click();
    await page.waitForTimeout(350);
    await page.click('[data-sub-toggle]');
    await page.waitForTimeout(650);
    ok('activate store restores access', (await page.evaluate(() => DS.data.tenantById('t-smozy').status)) === 'active');
    await ctx.close();
  }

  /* ───────────── 8 · Storefront → cart → checkout → stock ───────────── */
  console.log('\n▶ Storefront → checkout → stock');
  {
    const { ctx, page } = await newPage(browser);
    await login(page, 'customer', 'customer2026');
    await page.goto(BASE + '/customer/storefront.html');
    await page.waitForTimeout(1100);
    await page.waitForSelector('[data-add]');

    const product = await page.evaluate(() => {
      const btn = document.querySelector('[data-add]');
      const id = btn.getAttribute('data-add');
      const p = DS.data.db.products.filter(x => x.id === id)[0];
      return { id, stock: p.stock, name: p.name_en || p.name, price: p.price, tenant: p.tenant_id };
    });
    await page.click('[data-add="' + product.id + '"]');
    await page.waitForTimeout(450);
    const cartCount = await page.locator('[data-cart-count]').first().innerText();
    ok('add to cart', cartCount === '1', 'count=' + cartCount + ' · ' + product.name);

    await page.click('[data-open-cart]');
    await page.waitForTimeout(450);
    ok('cart modal opens', (await page.locator('.sf-bag-line').count()) === 1);
    await page.click('.modal-foot [data-action="1"]');
    await page.waitForURL(/customer\/checkout\.html/, { timeout: 15000 });
    await page.waitForTimeout(900);

    const fill = async (sel, val) => {
      const el = page.locator(sel);
      if (el && (await el.count())) {
        const cur = await el.inputValue().catch(() => '');
        if (!cur) await el.fill(val);
      }
    };
    await fill('#coName', 'Yasmin E2E');
    await fill('#coPhone', '01123456789');
    await fill('#coAddress', 'Nasr City · E2E street 12');
    await fill('#coCity', 'Cairo');

    await page.click('[data-place]');
    await page.waitForTimeout(1200);
    const modal = page.locator('.modal-backdrop').last();
    const modalText = await modal.innerText();
    const orderNo = (modalText.match(/ORD-\d+/) || [])[0];
    ok('place order', !!orderNo, orderNo || modalText.slice(0, 80));

    const stockAfter = await page.evaluate(({ pid, no }) => {
      const p = DS.data.db.products.filter(x => x.id === pid)[0];
      const o = DS.data.db.orders.filter(x => x.order_no === no)[0];
      return { stock: p.stock, order: !!o, total: o && o.total, items: o && o.items.length };
    }, { pid: product.id, no: orderNo });
    ok('order saved to database', stockAfter.order && stockAfter.items === 1, 'items=' + stockAfter.items);
    ok('stock decreased by 1', stockAfter.stock === product.stock - 1, product.stock + ' → ' + stockAfter.stock);

    await page.goto(BASE + '/customer/my-orders.html');
    await page.waitForTimeout(900);
    const found = await page.locator('body').innerText();
    ok('order visible in My Orders', orderNo ? found.includes(orderNo) : false, orderNo);
    await ctx.close();
  }

  /* ───────────── 9 · Marketing + Jobs untouched ───────────── */
  console.log('\n▶ Marketing & Jobs');
  {
    const { ctx, page } = await newPage(browser);
    const m = await page.goto(BASE + '/marketing/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    ok('marketing page loads', m.status() === 200 && (await page.locator('body').innerText()).length > 200);
    const j = await page.goto(BASE + '/auth/jobs/jobs.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    ok('jobs page loads', j.status() === 200 && (await page.locator('body').innerText()).length > 100);
    await ctx.close();
  }

  /* ───────────── Console health ───────────── */
  console.log('\n▶ Console health');
  ok('zero console errors', consoleErrors.length === 0, consoleErrors.length ? JSON.stringify(consoleErrors.slice(0, 6)) : 'clean');

  await browser.close();

  const failed = results.filter(r => !r.pass);
  fs.writeFileSync(path.join(__dirname, 'qa-features-results.json'), JSON.stringify({ at: new Date().toISOString(), total: results.length, failed: failed.length, results, consoleErrors }, null, 2));
  console.log('\n────────────────────────────────────────');
  console.log('TOTAL ' + results.length + ' · PASSED ' + (results.length - failed.length) + ' · FAILED ' + failed.length);
  if (failed.length) { failed.forEach(f => console.log(' ✗ ' + f.name + ' — ' + f.detail)); process.exit(1); }
  console.log('ALL FEATURES E2E PASSED');
})().catch(e => { console.error(e); process.exit(1); });
