// Quick visual pass: login (AR/EN) + admin dashboard (AR/EN)
const { chromium } = require('playwright');
const BASE = 'http://127.0.0.1:8000';
const OUT = 'QA-SCREENSHOTS';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  for (const lang of ['ar', 'en']) {
    await ctx.clearCookies();
    await page.goto(BASE + '/index.html');
    await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('lang', l); }, lang);
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const box = await page.locator('.login-card').boundingBox();
    const doc = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight }));
    console.log(lang, 'card', JSON.stringify(box), 'scroll', doc.sh, 'viewport', doc.ch);
    await page.screenshot({ path: `${OUT}/14-login-${lang}-fit.png`, fullPage: true });
  }

  // admin dashboard
  await page.goto(BASE + '/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE + '/index.html');
  await page.fill('#loginUser', 'admin');
  await page.fill('#loginPass', 'admin2026');
  await page.click('#loginBtn');
  await page.waitForURL('**/admin/dashboard.html');
  await page.waitForTimeout(700);
  const brand = await page.locator('.ds-brand img').boundingBox();
  console.log('sidebar brand', JSON.stringify(brand));
  await page.screenshot({ path: `${OUT}/14-admin-brand-en.png` });
  await page.click('[data-set-lang="ar"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/14-admin-brand-ar.png` });

  await browser.close();
})();
