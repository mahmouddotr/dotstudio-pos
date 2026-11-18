import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const root = '/Users/dot/Desktop/BRTFOLIO/DotStudio® - POS-OLD/DotStudio_APPLE_FINAL';
const pageUrl = 'file://' + root + '/shared/js/core.js'; // placeholder
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script src="file://${root}/shared/js/core.js"></script>
<script src="file://${root}/shared/js/data.js"></script>
<script>
window.__ready = false;
setTimeout(function(){ window.__ready = true; }, 200);
</script>
</body></html>`;
const tmp = '/tmp/dump-products.html';
fs.writeFileSync(tmp, html);

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto('file://' + tmp);
await page.waitForFunction(() => window.__ready === true);
const products = await page.evaluate(() => window.DS.data.products);
const tenants = await page.evaluate(() => window.DS.data.tenants);
fs.mkdirSync(path.join(root, 'backend/data'), { recursive: true });
fs.writeFileSync(path.join(root, 'backend/data/products.json'), JSON.stringify(products, null, 2));
fs.writeFileSync(path.join(root, 'backend/data/tenants.json'), JSON.stringify(tenants, null, 2));
console.log('products', products.length, 'tenants', tenants.length);
await browser.close();
