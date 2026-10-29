/* Visual capture: storefront grid (AR/EN, desktop/mobile) + quick view stars */
'use strict';
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';

async function login(browser, lang, viewport, user, pass) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(l => { localStorage.setItem('ds_lang', l); localStorage.removeItem('ds_cart'); }, lang);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#loginBtn');
  await page.fill('#loginUser', user);
  await page.fill('#loginPass', pass);
  await Promise.all([page.waitForURL(u => !/index\.html$/.test(u.pathname)), page.click('#loginBtn')]);
  await page.goto(BASE + '/customer/storefront.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();
  const report = {};

  /* AR desktop — grid section */
  {
    const { ctx, page } = await login(browser, 'ar', { width: 1440, height: 900 }, 'customer', 'customer2026');
    const info = await page.evaluate(() => {
      const g = document.querySelector('.sf-grid');
      const cs = g ? getComputedStyle(g) : null;
      g.scrollIntoView({ block: 'start' });
      return {
        cols: cs ? cs.gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        cards: document.querySelectorAll('.sf-card').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    await page.waitForTimeout(700);
    await page.screenshot({ path: '.work/qa-grid-ar-desktop.png' });
    report.arDesktop = info;

    /* quick view modal: count stars + their size */
    await page.evaluate(() => window.scrollTo(0, 260));
    await page.waitForTimeout(400);
    const first = await page.$('.sf-card [data-quick], .sf-card [data-view], .sf-card button');
    if (first) { await first.click(); await page.waitForTimeout(700); }
    const stars = await page.evaluate(() => {
      const modal = document.querySelector('.modal, .sf-qv');
      if (!modal) return { modal: false };
      const s = Array.from(modal.querySelectorAll('.star, .sf-qv-star, [data-star], svg'));
      const big = Array.from(modal.querySelectorAll('*')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 60 && r.height > 60 && /★|☆/.test(el.textContent || '') && el.children.length === 0;
      }).length;
      return {
        modal: true, glyphs: (modal.textContent.match(/[★☆]/g) || []).length,
        starEls: s.length, bigGlyph: big,
        title: (modal.querySelector('.sf-qv-title, .modal-title, h3') || {}).textContent
      };
    });
    report.quickView = stars;
    await page.screenshot({ path: '.work/qa-6-quickview.png' });
    await ctx.close();
  }

  /* EN desktop — grid section */
  {
    const { ctx, page } = await login(browser, 'en', { width: 1440, height: 900 }, 'customer', 'customer2026');
    const info = await page.evaluate(() => {
      const g = document.querySelector('.sf-grid');
      g.scrollIntoView({ block: 'start' });
      return {
        dir: document.documentElement.dir,
        cols: getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length,
        cards: document.querySelectorAll('.sf-card').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    await page.waitForTimeout(700);
    await page.screenshot({ path: '.work/qa-grid-en-desktop.png' });
    report.enDesktop = info;
    await ctx.close();
  }

  /* AR mobile — hero + grid */
  for (const vp of [{ width: 390, height: 844, tag: '390' }, { width: 768, height: 1024, tag: '768' }]) {
    const { ctx, page } = await login(browser, 'ar', { width: vp.width, height: vp.height }, 'customer', 'customer2026');
    const info = await page.evaluate(() => {
      const g = document.querySelector('.sf-grid');
      const cards = Array.from(document.querySelectorAll('.sf-float-card')).map(c => {
        const r = c.getBoundingClientRect();
        const h = c.closest('.sf-hero');
        const hr = h ? h.getBoundingClientRect() : null;
        return { w: Math.round(r.width), clipped: hr ? (r.bottom > hr.bottom + 1) : false };
      });
      return {
        cols: g ? getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        floatCards: cards,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    await page.screenshot({ path: '.work/qa-mobile-' + vp.tag + '.png' });
    await page.evaluate(() => document.querySelector('.sf-grid').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(600);
    await page.screenshot({ path: '.work/qa-mobile-grid-' + vp.tag + '.png' });
    report['mobile' + vp.tag] = info;
    await ctx.close();
  }

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
})();
