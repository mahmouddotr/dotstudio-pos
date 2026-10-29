'use strict';
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8000';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#loginBtn');
  await p.fill('#loginUser', 'customer'); await p.fill('#loginPass', 'customer2026');
  await Promise.all([p.waitForURL(u => !/index\.html$/.test(u.pathname)), p.click('#loginBtn')]);
  await p.goto(BASE + '/customer/storefront.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  /* take store offline + seed cart, then open checkout */
  await p.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('ds_db_v1'));
    db.tenants.find(s => s.id === 't-caznova').offline = true;
    localStorage.setItem('ds_db_v1', JSON.stringify(db));
    const prod = db.products.find(x => x.tenant_id === 't-caznova');
    localStorage.setItem('ds_cart', JSON.stringify({ items: [{ id: prod.id, name: prod.name, name_en: prod.name_en, price: prod.price, qty: 1, image: prod.image, stock: prod.stock, tenant_id: prod.tenant_id }] }));
  });
  await p.goto(BASE + '/customer/checkout.html', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1200);
  const st = await p.evaluate(() => {
    const btn = document.querySelector('[data-place]');
    const cs = getComputedStyle(btn);
    return { disabled: btn.disabled, opacity: cs.opacity, bg: cs.backgroundColor, color: cs.color, filter: cs.filter, shadow: cs.boxShadow.slice(0, 80), cursor: cs.cursor };
  });
  console.log(JSON.stringify(st, null, 1));
  await p.screenshot({ path: '.work/qa-9-offline-checkout.png' });
  await b.close();
})();
