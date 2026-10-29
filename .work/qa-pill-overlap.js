/* Reproduce: pill toast while the shopping-bag modal is open → is the checkout button clickable? */
'use strict';
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|tile|unpkg|cdnjs/i.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));

  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#loginBtn');
  await page.fill('#loginUser', 'customer');
  await page.fill('#loginPass', 'customer2026');
  await Promise.all([page.waitForURL(u => !/index\.html$/.test(u.pathname)), page.click('#loginBtn')]);
  await page.goto(BASE + '/customer/storefront.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);

  /* two quick adds -> two pill toasts alive */
  await page.evaluate(() => { localStorage.removeItem('ds_cart'); });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const addBtns = await page.$$('[data-add-to-bag], [data-add]');
  if (addBtns[0]) await addBtns[0].click();
  await page.waitForTimeout(250);
  if (addBtns[1]) await addBtns[1].click();
  await page.waitForTimeout(350);
  const pills = await page.evaluate(() => document.querySelectorAll('.ds-pill-toast').length);

  /* open the bag modal (click the floating cart) */
  await page.click('[data-floating-cart]');
  await page.waitForTimeout(600);
  const probe = await page.evaluate(() => {
    const drawer = document.querySelector('.sf-bag, .modal');
    const btn = document.querySelector('.modal-foot .btn-primary') || document.querySelector('.modal [data-action="1"]');
    let hit = null;
    if (btn) {
      const r = btn.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      hit = el ? (el.className || el.tagName) : null;
    }
    const pill = document.querySelector('.ds-pill-toast');
    const pr = pill ? pill.getBoundingClientRect() : null;
    const br = btn ? btn.getBoundingClientRect() : null;
    return {
      modal: !!drawer,
      pills: document.querySelectorAll('.ds-pill-toast').length,
      pillZ: pill ? getComputedStyle(pill.parentElement).zIndex : null,
      overlap: !!(pr && br && pr.left < br.right && pr.right > br.left && pr.top < br.bottom && pr.bottom > br.top),
      hit: String(hit).slice(0, 60),
      btnText: btn ? btn.textContent.trim() : null
    };
  });
  console.log('pills before open:', pills);
  console.log('probe:', JSON.stringify(probe, null, 1));
  await page.screenshot({ path: '.work/qa-2-cart-drawer.png' });
  console.log('errors:', errs.length ? errs : 'none');
  await browser.close();
  process.exit(probe.overlap || /ds-pill-toast/.test(probe.hit || '') ? 1 : 0);
})();
