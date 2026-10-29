'use strict';
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8000';
(async () => {
  const b = await chromium.launch();
  const out = [];
  for (const w of [320, 340, 359, 360, 390, 430, 768, 1024, 1280, 1440, 1920]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|tile|unpkg|cdnjs/i.test(m.text())) errs.push(m.text()); });
    p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
    await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#loginBtn');
    await p.fill('#loginUser', 'customer'); await p.fill('#loginPass', 'customer2026');
    await Promise.all([p.waitForURL(u => !/index\.html$/.test(u.pathname)), p.click('#loginBtn')]);
    await p.goto(BASE + '/customer/storefront.html', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    const m = await p.evaluate(() => {
      const g = document.querySelector('.sf-grid');
      const t = document.querySelector('.ds-topbar');
      return {
        cols: g ? getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        topbar: t ? Math.round(t.getBoundingClientRect().height) : 0,
        float: document.querySelectorAll('.sf-float-card').length
      };
    });
    out.push({ w, ...m, errs: errs.length });
    await ctx.close();
  }
  console.table(out);
  await b.close();
})();
