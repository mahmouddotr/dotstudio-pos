/* Deep flows: POS sale, checkout → order, print receipt screenshot, EN storefront */
'use strict';
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const out = [];
const errs = [];
function ok(n, p, d) { out.push({ n, p: !!p, d: d || '' }); console.log((p ? '  ✓ ' : '  ✗ ') + n + (d ? ' — ' + d : '')); }

async function pageFor(browser, user, pass, lang, viewport) {
  const ctx = await browser.newContext({ viewport: viewport || { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/favicon|net::ERR|Tile|tile\.openstreetmap|unpkg|cdnjs/i.test(t)) return;
    errs.push({ url: page.url(), text: t });
  });
  page.on('pageerror', e => errs.push({ url: page.url(), text: 'PAGEERROR ' + e.message }));
  await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(l => localStorage.setItem('ds_lang', l), lang || 'ar');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#loginBtn');
  await page.fill('#loginUser', user);
  await page.fill('#loginPass', pass);
  await Promise.all([page.waitForURL(u => !/index\.html$/.test(u.pathname), { timeout: 20000 }), page.click('#loginBtn')]);
  await page.waitForTimeout(800);
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch();

  /* ── POS sale ── */
  console.log('\n▶ POS sale');
  {
    const { ctx, page } = await pageFor(browser, 'ca_cashier', 'ca_cashier2026', 'ar');
    await page.goto(BASE + '/cashier/pos.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const pos = await page.evaluate(() => ({
      products: document.querySelectorAll('.pos-card, [data-add]').length,
      grid: !!document.querySelector('.pos-grid, .pos-products'),
      cart: !!document.querySelector('.pos-cart'),
      hiddenScanner: !!document.getElementById('barcodeScannerInput')
    }));
    ok('POS renders catalogue + cart', pos.products > 3 && pos.cart && pos.hiddenScanner, JSON.stringify(pos));

    /* add the first product to the cart */
    const pre = await page.evaluate(() => {
      const orders = DS.data.visibleOrders(DS.session()).length;
      return { orders };
    });
    const pid = await page.evaluate(() => {
      const b = document.querySelector('.pos-card[data-add]');
      return b ? b.getAttribute('data-add') : null;
    });
    const stockBefore = await page.evaluate(id => {
      const p = DS.data.products.find(x => x.id === id);
      return p ? p.stock : -1;
    }, pid);
    await page.click('.pos-card[data-add]');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const c = document.querySelector('[data-count]');
      const body = document.querySelector('[data-cart-body]');
      return {
        count: c ? c.textContent.trim() : '',
        rows: body ? body.querySelectorAll('.pos-cart-row, [data-line], .cart-line').length : -1,
        text: body ? body.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
      };
    });
    ok('POS add-to-cart updates the cart', after.count === '1' && after.text.length > 0, JSON.stringify(after));

    /* complete the sale through the checkout modal */
    await page.click('[data-checkout]');
    await page.waitForTimeout(700);
    const modalOpen = await page.evaluate(() => !!document.querySelector('#ckName'));
    await page.fill('#ckName', 'QA Walk-in');
    await page.fill('#ckPhone', '01098765432');
    await page.click('.modal [data-action="1"]');
    await page.waitForTimeout(1400);
    const sale = await page.evaluate(id => {
      const orders = DS.data.visibleOrders(DS.session());
      const latest = orders.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      const prod = DS.data.products.find(x => x.id === id);
      const invoice = DS.data.invoices ? DS.data.invoices.filter(i => i.order_id === (latest && latest.id))[0] : null;
      return {
        orders: orders.length,
        latest: latest ? { no: latest.order_no, total: latest.total, source: latest.source, status: latest.status } : null,
        stock: prod ? prod.stock : -1,
        invoice: invoice ? { no: invoice.invoice_no, total: invoice.total, status: invoice.status } : null,
        cartCount: (document.querySelector('[data-count]') || {}).textContent,
        receiptModal: document.body.textContent.indexOf('QA Walk-in') >= 0
      };
    }, pid);
    ok('POS checkout modal opens', modalOpen, '');
    ok('POS sale creates order + invoice', sale.orders === pre.orders + 1 && sale.latest && sale.latest.source === 'pos' && !!sale.invoice, JSON.stringify({ order: sale.latest, invoice: sale.invoice, receipt: sale.receiptModal }));
    ok('POS sale decrements stock + clears cart', sale.stock === stockBefore - 1 && sale.cartCount.trim() === '0', JSON.stringify({ stockBefore, stockAfter: sale.stock, cart: sale.cartCount }));
    await page.screenshot({ path: '.work/qa-pos.png' });
    await ctx.close();
  }

  /* ── Storefront → checkout → order ── */
  console.log('\n▶ Storefront → checkout → order');
  {
    const { ctx, page } = await pageFor(browser, 'customer', 'customer2026', 'ar');
    await page.goto(BASE + '/customer/storefront.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const ids = await page.evaluate(() => {
      const ps = (DS.data.products || []).filter(p => p.is_active !== false && p.stock > 0);
      const a = ps.filter(p => p.tenant_id === 't-caznova')[0];
      const b = ps.filter(p => p.tenant_id === 't-smozy')[0];
      localStorage.setItem('ds_cart', JSON.stringify({ items: [
        { id: a.id, name: a.name, name_en: a.name_en, price: a.price, qty: 2, image: a.image, stock: a.stock, tenant_id: a.tenant_id },
        { id: b.id, name: b.name, name_en: b.name_en, price: b.price, qty: 1, image: b.image, stock: b.stock, tenant_id: b.tenant_id }
      ] }));
      const orders = DS.data.visibleOrders(DS.session()).length;
      return { a: a.id, b: b.id, stockA: a.stock, stockB: b.stock, orders };
    });
    await page.goto(BASE + '/customer/checkout.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const co = await page.evaluate(() => ({
      vendors: document.querySelectorAll('.co-sum-fee').length,
      total: (document.querySelector('[data-sum-total]') || {}).textContent,
      fields: ['#coName', '#coPhone', '#coAddress'].every(s => !!document.querySelector(s)),
      place: !!document.querySelector('[data-place]') && !document.querySelector('[data-place]').disabled
    }));
    ok('checkout shows both vendors + summary', co.vendors === 2 && co.fields && co.place, JSON.stringify(co));
    await page.fill('#coName', 'QA Customer');
    await page.fill('#coPhone', '01012345678');
    await page.fill('#coAddress', '12 QA Street');
    await page.fill('#coCity', 'Cairo');
    await page.click('[data-place]');
    await page.waitForTimeout(2200);
    const placed = await page.evaluate(() => {
      const orders = DS.data.visibleOrders(DS.session());
      const latest = orders.sort((x, y) => new Date(y.created_at) - new Date(x.created_at))[0];
      return {
        url: location.pathname,
        orders: orders.length,
        latest: latest ? { no: latest.order_no, total: latest.total, status: latest.status, vendors: latest.vendor_ids || [latest.tenant_id] } : null,
        cart: JSON.parse(localStorage.getItem('ds_cart') || '{"items":[]}').items.length,
        toast: !!document.querySelector('.toast')
      };
    });
    ok('order placed from multi-vendor cart', placed.orders > ids.orders && placed.latest && placed.latest.vendors.length === 2, JSON.stringify(placed.latest));
    ok('cart cleared after order', placed.cart === 0, `${placed.cart} items left`);
    await page.screenshot({ path: '.work/qa-checkout-done.png' });
    await ctx.close();
  }

  /* ── 80mm print preview screenshot ── */
  console.log('\n▶ Print layout screenshot');
  {
    const { ctx, page } = await pageFor(browser, 'ca_cashier', 'ca_cashier2026', 'ar');
    await page.goto(BASE + '/cashier/invoices.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await page.click('[data-view]');
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      /* isolate the receipt for an honest 80mm screenshot */
      document.body.innerHTML = '<div style="background:#fff;padding:20px;display:flex;justify-content:center">' + document.querySelector('.invoice-print-area').outerHTML + '</div>';
      const s = document.createElement('style');
      s.textContent = document.getElementById('dsActivePrintStyle').textContent;
      document.head.appendChild(s);
      const qr = document.getElementById('invoiceQrBox');
      if (qr && !qr.firstChild) qr.innerHTML = '<svg viewBox="0 0 10 10" width="80" height="80"><rect width="10" height="10" fill="#fff"/><rect x="1" y="1" width="3" height="3" fill="#000"/><rect x="6" y="1" width="3" height="3" fill="#000"/><rect x="1" y="6" width="3" height="3" fill="#000"/><rect x="5" y="5" width="4" height="4" fill="#000"/></svg>';
    });
    await page.setViewportSize({ width: 360, height: 900 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: '.work/qa-5-invoice-80mm.png', fullPage: true });
    const box = await page.evaluate(() => {
      const a = document.querySelector('.invoice-print-area');
      const r = a.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), qr: !!document.querySelector('.ipa-qr'), logo: !!document.querySelector('.ipa-logo') };
    });
    ok('80mm receipt screenshot captured', box.w > 250 && box.w < 320 && box.qr && !box.logo, JSON.stringify(box));
    await ctx.close();
  }

  /* ── EN storefront (LTR) ── */
  console.log('\n▶ English / LTR storefront');
  {
    const { ctx, page } = await pageFor(browser, 'customer', 'customer2026', 'en');
    await page.goto(BASE + '/customer/storefront.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const en = await page.evaluate(() => {
      const grid = document.querySelector('.sf-grid');
      return {
        dir: document.documentElement.dir,
        lang: document.documentElement.lang,
        hero: (document.querySelector('.sf-title') || {}).textContent,
        cols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length : 0,
        cards: document.querySelectorAll('.sf-float-card').length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        title: document.querySelector('.sf-card-name').textContent.trim(),
        price: document.querySelector('.sf-price').textContent.trim()
      };
    });
    ok('EN storefront is LTR with 4 columns + cards', en.dir === 'ltr' && en.cols === 4 && en.cards === 3 && en.overflow <= 1, JSON.stringify(en));
    await page.screenshot({ path: '.work/qa-1-storefront-en.png' });
    await ctx.close();
  }

  /* ── public pages ── */
  console.log('\n▶ Public pages');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push({ url: page.url(), text: 'PAGEERROR ' + e.message }));
    for (const p of ['marketing/index.html', 'auth/jobs/jobs.html', 'index.html']) {
      await page.goto(BASE + '/' + p, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const info = await page.evaluate(() => ({
        text: (document.body.innerText || '').trim().length,
        imgs: Array.from(document.images).filter(i => !i.complete || i.naturalWidth === 0).length,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      ok('public page renders: ' + p, info.text > 100 && info.imgs === 0 && info.overflow <= 1, JSON.stringify(info));
      await page.screenshot({ path: '.work/qa-public-' + p.replace(/\W+/g, '-') + '.png' });
    }
    await ctx.close();
  }

  await browser.close();
  const failed = out.filter(r => !r.p);
  console.log('\nTOTAL', out.length, 'PASS', out.length - failed.length, 'FAIL', failed.length);
  console.log('CONSOLE ERRORS:', errs.length ? JSON.stringify(errs, null, 1) : 'none');
  require('fs').writeFileSync('.work/qa-deep.json', JSON.stringify({ out, errs }, null, 2));
  process.exit(failed.length || errs.length ? 1 : 0);
})();
