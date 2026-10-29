/* Full-surface sweep: every page, every role, AR + EN, console errors + assets */
'use strict';
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';

const PAGES = {
  admin: ['admin/dashboard.html', 'admin/orders.html', 'admin/products.html', 'admin/stores.html', 'admin/customers.html', 'admin/users.html', 'admin/cashiers.html', 'admin/delivery-companies.html', 'admin/sub-admins.html', 'admin/reports.html', 'admin/subscriptions.html', 'admin/jobs.html', 'admin/audit-logs.html', 'admin/chats.html', 'admin/settings.html', 'admin/hardware-tools.html',
    'owner/dashboard.html', 'owner/orders.html', 'owner/products.html', 'owner/customers.html', 'owner/reports.html', 'owner/subscriptions.html', 'owner/cashiers.html', 'owner/delivery-companies.html', 'owner/messages.html', 'owner/chats.html', 'owner/settings.html',
    'cashier/pos.html', 'cashier/orders.html', 'cashier/invoices.html', 'cashier/settings.html',
    'delivery/dashboard.html', 'delivery/orders.html', 'delivery/tracking.html', 'delivery/messages.html',
    'customer/storefront.html', 'customer/checkout.html', 'customer/my-orders.html', 'customer/tracking.html',
    'auth/public-chat.html', 'auth/jobs/jobs.html', 'marketing/index.html', 'index.html'],
  customer: ['customer/storefront.html', 'customer/my-orders.html', 'customer/tracking.html', 'customer/checkout.html', 'auth/public-chat.html'],
  owner: ['owner/dashboard.html', 'owner/orders.html', 'owner/products.html', 'owner/customers.html', 'owner/reports.html', 'owner/subscriptions.html', 'owner/cashiers.html', 'owner/delivery-companies.html', 'owner/messages.html', 'owner/settings.html', 'admin/hardware-tools.html'],
  cashier: ['cashier/pos.html', 'cashier/orders.html', 'cashier/invoices.html', 'cashier/settings.html', 'admin/hardware-tools.html'],
  delivery: ['delivery/dashboard.html', 'delivery/orders.html', 'delivery/tracking.html', 'delivery/messages.html']
};
const ACCOUNTS = {
  admin: ['admin', 'admin2026'],
  customer: ['customer', 'customer2026'],
  owner: ['caznova', 'caznova2026'],
  cashier: ['ca_cashier', 'ca_cashier2026'],
  delivery: ['talqa', 'talqa2026']
};

const errors = [];
const network404 = [];

(async () => {
  const browser = await chromium.launch();
  const results = [];

  for (const role of Object.keys(PAGES)) {
    for (const lang of ['ar', 'en']) {
      const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      const page = await ctx.newPage();
      const key = role + '/' + lang;
      page.on('console', m => {
        if (m.type() !== 'error') return;
        const t = m.text();
        if (/favicon|Download the React DevTools|tile\.openstreetmap|unpkg\.com|cdnjs|net::ERR|Failed to load resource/i.test(t)) return;
        errors.push({ page: page.url(), key, text: t });
      });
      page.on('pageerror', e => errors.push({ page: page.url(), key, text: 'PAGEERROR ' + e.message }));
      page.on('response', r => {
        const u = r.url();
        if (r.status() >= 400 && u.indexOf(BASE) === 0) network404.push({ page: page.url(), status: r.status(), url: u });
      });

      await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate(l => localStorage.setItem('cz_lang', l), lang);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#loginBtn');
      await page.fill('#loginUser', ACCOUNTS[role][0]);
      await page.fill('#loginPass', ACCOUNTS[role][1]);
      await Promise.all([
        page.waitForURL(u => !/index\.html$/.test(u.pathname), { timeout: 20000 }),
        page.click('#loginBtn')
      ]);
      await page.waitForTimeout(700);

      for (const path of PAGES[role]) {
        await page.goto(BASE + '/' + path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(650);
        const info = await page.evaluate(() => ({
          app: !!document.querySelector('#app'),
          empty: ((document.querySelector('#app') || {}).innerHTML || '').trim().length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          dir: document.documentElement.dir,
          lang: document.documentElement.lang,
          title: document.title
        }));
        results.push({ key, path, ...info });
      }
      await ctx.close();
      console.log(`  · ${key} done`);
    }
  }

  await browser.close();
  const badEmpty = results.filter(r => r.empty < 120);
  const overflow = results.filter(r => r.overflow > 1);
  console.log('\nPAGES CHECKED:', results.length);
  console.log('EMPTY/BROKEN:', badEmpty.length, badEmpty.slice(0, 10));
  console.log('HORIZONTAL OVERFLOW:', overflow.length, overflow.slice(0, 10));
  console.log('CONSOLE ERRORS:', errors.length);
  errors.slice(0, 20).forEach(e => console.log('  •', e.key, e.text, '@', e.page));
  console.log('NETWORK 4xx/5xx:', network404.length);
  network404.slice(0, 20).forEach(e => console.log('  •', e.status, e.url, '@', e.page));

  require('fs').writeFileSync('.work/qa-sweep.json', JSON.stringify({ results, errors, network404 }, null, 2));
  process.exit(errors.length || badEmpty.length || network404.length || overflow.length ? 1 : 0);
})();
