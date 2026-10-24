/* DotStudio® POS — Cashier point of sale */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;

  var user = DS.session();
  if (!user) return;
  var tenant = DS.data.tenantById(user.tenant_id) || {};
  var page = DS.shell.mount({
    roles: ['cashier', 'owner'],
    active: 'pos',
    title: t('pos'),
    eyebrow: tenant.name || t('store'),
    icon: 'cashier',
    sub: DS.lang() === 'en' ? 'Ring up a sale in seconds — products, cart, payment and receipt.' : 'أنشئ بيعة في ثوانٍ — المنتجات، السلة، الدفع والإيصال.',
    actions: '<a class="btn btn-secondary" href="' + DS.url('cashier/invoices.html') + '">' + icon('receipt') + esc(t('invoices')) + '</a>' +
      '<button class="btn btn-primary" data-mobile-cart>' + icon('cart') + esc(t('cart')) + ' <span class="badge" data-mobile-count>0</span></button>',
    content: DS.skeleton.grid(8)
  });
  if (!page) return;

  var state = {
    q: '', cat: '', cart: [], payment: 'cash', customer: { name: '', phone: '', address: '' },
    discount: 0, notes: '', busy: false, mobileOpen: false
  };

  function products() {
    return DS.data.visibleProducts(user).filter(function (p) { return p.is_active !== false; });
  }

  function categories() {
    var out = [];
    products().forEach(function (p) { var c = DS.loc(p, 'category'); if (out.indexOf(c) === -1) out.push(c); });
    return out;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return products().filter(function (p) {
      if (state.cat && DS.loc(p, 'category') !== state.cat) return false;
      if (!q) return true;
      return (p.name + ' ' + (p.name_en || '') + ' ' + (p.sku || '')).toLowerCase().indexOf(q) > -1;
    });
  }

  function cartCount() { return state.cart.reduce(function (s, l) { return s + l.qty; }, 0); }
  function subtotal() { return state.cart.reduce(function (s, l) { return s + l.price * l.qty; }, 0); }
  function deliveryFee() { return state.cart.length ? (Number(tenant.delivery_fee) || 0) : 0; }
  function total() { return Math.max(0, subtotal() - state.discount + deliveryFee()); }
  function lineOf(id) { return state.cart.filter(function (l) { return l.id === id; })[0]; }

  function addToCart(id) {
    var p = products().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var line = lineOf(id);
    var wanted = line ? line.qty + 1 : 1;
    if (wanted > p.stock) { DS.toast(t('outOfStock') + ' · ' + (DS.lang() === 'en' ? p.name_en || p.name : p.name), 'warning'); return; }
    if (line) line.qty = wanted;
    else state.cart.push({ id: p.id, name: p.name, name_en: p.name_en, price: Number(p.price) || 0, qty: 1, image: p.image, stock: p.stock });
    DS.toast(t('addedToCart'), 'success');
    renderCart();
  }

  function setQty(id, qty) {
    var line = lineOf(id);
    if (!line) return;
    if (qty <= 0) state.cart = state.cart.filter(function (l) { return l.id !== id; });
    else if (qty > line.stock) { DS.toast(t('outOfStock'), 'warning'); return; }
    else line.qty = qty;
    renderCart();
  }

  function productCard(p) {
    var name = DS.lang() === 'en' ? (p.name_en || p.name) : p.name;
    var out = p.stock <= 0;
    return '<button class="pos-card' + (out ? ' out' : '') + '" data-add="' + esc(p.id) + '"' + (out ? ' disabled' : '') + '>' +
      '<div class="img"><img src="' + esc(DS.data.img(p.image)) + '" alt="' + esc(name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + esc(DS.url('assets/product-placeholder.svg')) + '\'">' +
        (out ? '' : '<span class="add">' + icon('plus') + '</span>') +
        (out ? '<span class="badge danger" style="position:absolute;top:6px;inset-inline-start:6px">' + esc(t('out')) + '</span>' : (p.stock <= (p.min_stock || 0) ? '<span class="badge warning" style="position:absolute;top:6px;inset-inline-start:6px">' + esc(t('lowStockShort')) + '</span>' : '')) +
      '</div>' +
      '<div class="info"><div class="nm">' + esc(name) + '</div>' +
        '<div class="pr"><span>' + money(p.price) + '</span><span class="st">' + p.stock + '</span></div></div></button>';
  }

  function cartMarkup() {
    if (!state.cart.length) {
      return '<div class="cart-empty">' + icon('cart') + '<div>' + esc(t('emptyCart')) + '</div></div>';
    }
    return state.cart.map(function (l) {
      var name = DS.lang() === 'en' ? (l.name_en || l.name) : l.name;
      return '<div class="cart-line"><img src="' + esc(DS.data.img(l.image)) + '" alt="">' +
        '<div class="cart-line-info"><div class="cart-line-name">' + esc(name) + '</div>' +
          '<div class="cart-line-price">' + money(l.price) + ' × ' + l.qty + '</div></div>' +
        '<div class="qty-control"><button data-minus="' + esc(l.id) + '" aria-label="minus">' + icon('minus') + '</button>' +
          '<span>' + l.qty + '</span><button data-plus="' + esc(l.id) + '" aria-label="plus">' + icon('plus') + '</button></div>' +
        '<button class="btn btn-ghost btn-sm" data-remove="' + esc(l.id) + '" aria-label="remove" style="color:var(--text-tertiary)">' + icon('x') + '</button></div>';
    }).join('');
  }

  function renderProducts() {
    var grid = page.body.querySelector('[data-grid]');
    if (!grid) return;
    var list = filtered();
    grid.innerHTML = list.length ? list.map(productCard).join('') :
      '<div style="grid-column:1/-1">' + DS.empty({ icon: 'box', title: t('noProducts'), text: t('emptyProductsText') }) + '</div>';
    DS.$$('[data-add]', grid).forEach(function (b) {
      b.addEventListener('click', function () { addToCart(b.getAttribute('data-add')); });
    });
  }

  function renderCart() {
    var body = page.body.querySelector('[data-cart-body]');
    if (body) body.innerHTML = cartMarkup();
    var countEls = DS.$$('[data-count]');
    countEls.forEach(function (el) { el.textContent = cartCount(); });
    var mc = page.root.querySelector('[data-mobile-count]');
    if (mc) mc.textContent = cartCount();
    var sub = page.body.querySelector('[data-sub]');
    if (sub) sub.textContent = money(subtotal());
    var del = page.body.querySelector('[data-del]');
    if (del) del.textContent = money(deliveryFee());
    var disc = page.body.querySelector('[data-disc]');
    if (disc) disc.textContent = '− ' + money(state.discount);
    var discRow = page.body.querySelector('[data-disc-row]');
    if (discRow) discRow.style.display = state.discount > 0 ? '' : 'none';
    var tot = page.body.querySelector('[data-total]');
    if (tot) tot.textContent = money(total());
    var itemsTotal = page.body.querySelector('[data-lines]');
    if (itemsTotal) itemsTotal.textContent = cartCount();

    DS.$$('[data-plus]', page.body).forEach(function (b) { b.onclick = function () { var l = lineOf(b.getAttribute('data-plus')); if (l) setQty(l.id, l.qty + 1); }; });
    DS.$$('[data-minus]', page.body).forEach(function (b) { b.onclick = function () { var l = lineOf(b.getAttribute('data-minus')); if (l) setQty(l.id, l.qty - 1); }; });
    DS.$$('[data-remove]', page.body).forEach(function (b) { b.onclick = function () { setQty(b.getAttribute('data-remove'), 0); }; });
    DS.$$('[data-pay]', page.body).forEach(function (b) {
      b.onclick = function () { state.payment = b.getAttribute('data-pay'); renderCart(); };
    });
  }

  function todayStats() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var mine = DS.data.visibleOrders(user).filter(function (o) { return o.source === 'pos' && new Date(o.created_at) >= today; });
    return {
      sales: mine.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0),
      count: mine.length,
      avg: mine.length ? mine.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0) / mine.length : 0
    };
  }

  function render() {
    var stats = todayStats();
    var html =
      '<div class="kpi-grid cols-3">' +
        '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(t('todaySales')) + '</span><span class="stat-icon lime">' + icon('wallet') + '</span></div><div class="stat-value" style="font-size:26px">' + money(stats.sales) + '</div><div class="stat-foot">' + esc(t('today')) + '</div></div>' +
        '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(t('transactions')) + '</span><span class="stat-icon info">' + icon('receipt') + '</span></div><div class="stat-value" style="font-size:26px">' + stats.count + '</div><div class="stat-foot">' + esc(t('shift')) + '</div></div>' +
        '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(t('avgTicket')) + '</span><span class="stat-icon purple">' + icon('chart') + '</span></div><div class="stat-value" style="font-size:26px">' + money(stats.avg) + '</div><div class="stat-foot">' + esc(t('today')) + '</div></div>' +
      '</div>' +
      '<div class="pos-shell"><div class="pos-products">' +
        '<div class="pos-search-row"><div class="search-mini pos-search">' + icon('search') + '<input data-q placeholder="' + esc(t('searchProduct')) + '" value="' + esc(state.q) + '"></div>' +
          '<span class="badge neutral">' + products().length + ' ' + esc(t('products')) + '</span></div>' +
        '<div class="pos-cats"><button class="pos-cat' + (!state.cat ? ' active' : '') + '" data-cat="">' + esc(t('all')) + '</button>' +
          categories().map(function (c) { return '<button class="pos-cat' + (state.cat === c ? ' active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
        '<div class="pos-grid" data-grid></div>' +
      '</div>' +
      '<aside class="pos-cart' + (state.mobileOpen ? ' open' : '') + '" data-cart>' +
        '<div class="pos-cart-head"><div class="pos-cart-title">' + icon('cart') + esc(t('cart')) + ' <span class="count" data-count>0</span></div>' +
          '<button class="btn btn-ghost btn-sm" data-close-cart style="color:var(--text-tertiary)">' + icon('x') + '</button></div>' +
        '<div class="pos-cart-body" data-cart-body></div>' +
        '<div class="pos-cart-foot">' +
          '<div class="cart-row"><span>' + esc(t('subtotal')) + '</span><span data-sub>0</span></div>' +
          '<div class="cart-row" data-disc-row style="display:none;color:var(--lime)"><span>' + esc(t('discount')) + '</span><span data-disc>—</span></div>' +
          '<div class="cart-row"><span>' + esc(t('delivery')) + '</span><span data-del>0</span></div>' +
          '<div class="cart-row total"><span>' + esc(t('total')) + '</span><span class="num" data-total>0</span></div>' +
          '<div class="pay-methods">' +
            '<button class="pay-method active" data-pay="cash">' + icon('wallet') + esc(t('cash')) + '</button>' +
            '<button class="pay-method" data-pay="card">' + icon('card') + esc(t('card')) + '</button>' +
            '<button class="pay-method" data-pay="wallet">' + icon('phone') + esc(t('wallet')) + '</button>' +
          '</div>' +
          '<div style="display:flex;gap:6px">' +
            '<button class="btn btn-secondary" data-clear style="flex:1">' + icon('trash') + esc(t('clearCart')) + '</button>' +
            '<button class="btn btn-primary" data-checkout style="flex:1.6">' + icon('check') + esc(t('checkout')) + '</button>' +
          '</div>' +
        '</div>' +
      '</aside></div>';

    page.setContent(html);
    renderProducts();
    renderCart();

    var q = page.body.querySelector('[data-q]');
    q.addEventListener('input', DS.debounce(function () { state.q = q.value; renderProducts(); }, 140));
    DS.$$('[data-cat]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { state.cat = b.getAttribute('data-cat'); render(); });
    });
    var clear = page.body.querySelector('[data-clear]');
    if (clear) clear.addEventListener('click', function () {
      if (!state.cart.length) return;
      state.cart = []; state.discount = 0; renderCart();
      DS.toast(t('removedFromCart'), 'info');
    });
    var checkout = page.body.querySelector('[data-checkout]');
    if (checkout) checkout.addEventListener('click', openCheckout);
    var close = page.body.querySelector('[data-close-cart]');
    if (close) close.addEventListener('click', function () { state.mobileOpen = false; var c = page.body.querySelector('[data-cart]'); if (c) c.classList.remove('open'); });
    var mobile = page.root.querySelector('[data-mobile-cart]');
    if (mobile) mobile.addEventListener('click', function () { state.mobileOpen = true; var c = page.body.querySelector('[data-cart]'); if (c) c.classList.add('open'); });
  }

  /* ─────────────────────────── CHECKOUT ─────────────────────────── */
  function openCheckout() {
    if (!state.cart.length) { DS.toast(t('emptyCartText'), 'warning'); return; }
    var customer = state.customer;
    var body =
      '<div class="field-grid">' +
        '<div class="field"><label>' + esc(t('customerName')) + '</label><input class="input" id="ckName" value="' + esc(customer.name) + '" placeholder="' + esc(t('walkIn')) + '"></div>' +
        '<div class="field"><label>' + esc(t('customerPhone')) + '</label><input class="input" id="ckPhone" value="' + esc(customer.phone) + '" placeholder="01xxxxxxxxx" style="direction:ltr" inputmode="tel"></div>' +
        '<div class="field" style="grid-column:1/-1"><label>' + esc(t('address')) + '</label><input class="input" id="ckAddress" value="' + esc(customer.address) + '" placeholder="' + esc(t('address')) + '"></div>' +
        '<div class="field"><label>' + esc(t('discount')) + ' (EGP)</label><input class="input" id="ckDiscount" type="number" min="0" step="1" value="' + esc(state.discount) + '"></div>' +
        '<div class="field"><label>' + esc(t('paymentMethod')) + '</label><select class="select" id="ckPay">' +
          '<option value="cash"' + (state.payment === 'cash' ? ' selected' : '') + '>' + esc(t('cash')) + '</option>' +
          '<option value="card"' + (state.payment === 'card' ? ' selected' : '') + '>' + esc(t('card')) + '</option>' +
          '<option value="wallet"' + (state.payment === 'wallet' ? ' selected' : '') + '>' + esc(t('wallet')) + '</option></select></div>' +
        '<div class="field" style="grid-column:1/-1"><label>' + esc(t('notes')) + '</label><textarea class="textarea" id="ckNotes" rows="2" placeholder="' + esc(t('notes')) + '">' + esc(state.notes) + '</textarea></div>' +
      '</div>' +
      '<div class="cart-summary" style="margin-top:12px"><div class="cart-row"><span>' + esc(t('subtotal')) + '</span><span>' + money(subtotal()) + '</span></div>' +
        '<div class="cart-row"><span>' + esc(t('delivery')) + '</span><span>' + money(deliveryFee()) + '</span></div>' +
        '<div class="cart-row total"><span>' + esc(t('total')) + '</span><span class="num" data-ck-total>' + money(total()) + '</span></div></div>';

    var m = DS.modal({
      title: t('checkout'),
      sub: cartCount() + ' ' + t('items') + ' · ' + (tenant.name || ''),
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('confirmOrder'), variant: 'btn-primary', icon: icon('check'), onClick: function (root) {
            var name = root.querySelector('#ckName').value.trim();
            var phone = root.querySelector('#ckPhone').value.trim();
            if (!name) { DS.toast(t('required'), 'error'); return false; }
            if (phone && !/^[0-9+\-\s]{7,20}$/.test(phone)) { DS.toast(t('invalidPhone'), 'error'); return false; }
            var disc = Math.max(0, Number(root.querySelector('#ckDiscount').value) || 0);
            if (disc > subtotal()) { DS.toast(t('discount') + ' > ' + t('subtotal'), 'error'); return false; }
            state.discount = disc;
            state.customer = { name: name, phone: phone, address: root.querySelector('#ckAddress').value.trim() };
            state.payment = root.querySelector('#ckPay').value;
            state.notes = root.querySelector('#ckNotes').value.trim();
            completeSale();
            return true;
          } }
      ],
      onMount: function (root) {
        var d = root.querySelector('#ckDiscount');
        d.addEventListener('input', function () {
          var v = Math.max(0, Number(d.value) || 0);
          var el = root.querySelector('[data-ck-total]');
          if (el) el.textContent = money(Math.max(0, subtotal() - v + deliveryFee()));
        });
      }
    });
    return m;
  }

  function completeSale() {
    if (state.busy) return;
    state.busy = true;
    var now = new Date().toISOString();
    var items = state.cart.map(function (l) {
      return { product_id: l.id, name: l.name, name_en: l.name_en, price: l.price, qty: l.qty, image: l.image };
    });
    var payload = {
      tenant_id: user.tenant_id,
      customer_id: 'walkin-' + (state.customer.phone || 'guest'),
      customer: {
        name: state.customer.name || t('walkIn'),
        name_en: state.customer.name || t('walkIn'),
        phone: state.customer.phone || '—',
        address: state.customer.address || DS.loc(tenant, 'address') || '',
        city: tenant.city || ''
      },
      items: items,
      subtotal: subtotal(),
      discount: state.discount,
      delivery_fee: deliveryFee(),
      total: total(),
      payment_method: state.payment,
      source: 'pos',
      notes: state.notes,
      status: 'delivered',
      driver_name: user.name,
      timeline: [
        { status: 'pending', at: now, label: t('order.created') },
        { status: 'confirmed', at: now, label: t('order.confirmedAt') },
        { status: 'delivered', at: now, label: t('order.deliveredAt') }
      ]
    };
    var order = DS.data.createOrder(payload);
    var invoice = DS.data.addInvoice({
      tenant_id: user.tenant_id,
      order_id: order.id,
      order_no: order.order_no,
      customer: payload.customer,
      items: items.map(function (it) { return Object.assign({}, it); }),
      subtotal: payload.subtotal,
      discount: payload.discount,
      delivery_fee: payload.delivery_fee,
      total: payload.total,
      payment_method: payload.payment_method,
      status: 'paid',
      created_at: now
    });

    state.cart = [];
    state.discount = 0;
    state.notes = '';
    state.customer = { name: '', phone: '', address: '' };
    state.payment = 'cash';
    state.busy = false;
    state.mobileOpen = false;
    render();
    DS.toast(t('orderCreated') + ' · ' + order.order_no, 'success');

    DS.modal({
      title: t('receipt'),
      sub: invoice.invoice_no + ' · ' + order.order_no,
      body: '<div class="order-details-grid" style="margin-bottom:12px">' +
          '<div class="order-detail-box"><div class="l">' + esc(t('orderId')) + '</div><div class="v" style="font-family:var(--font-mono);direction:ltr">' + esc(order.order_no) + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('total')) + '</div><div class="v" style="color:var(--lime)">' + money(order.total) + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('paymentMethod')) + '</div><div class="v">' + esc(t(order.payment_method)) + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('customerLabel')) + '</div><div class="v">' + esc(order.customer.name) + '</div></div>' +
        '</div>' +
        '<div class="order-items">' + order.items.map(function (it) {
          return '<div class="order-item-row"><img src="' + esc(DS.data.img(it.image)) + '" alt=""><div class="info"><div class="nm">' + esc(DS.lang() === 'en' ? (it.name_en || it.name) : it.name) + '</div><div class="qt">' + it.qty + ' × ' + money(it.price) + '</div></div><div class="pr">' + money(it.qty * it.price) + '</div></div>';
        }).join('') + '</div>',
      actions: [
        { label: t('newSale'), variant: 'btn-secondary' },
        { label: t('printReceipt'), variant: 'btn-primary', icon: icon('printer'), onClick: function () { DS.printReceipt(order); } }
      ]
    });

    window.dispatchEvent(new CustomEvent('ds:data-changed'));
  }

  render();
})();
