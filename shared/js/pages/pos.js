/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — premium cashier counter
   Spacious product grid · sticky order rail · live totals.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;

  var user = DS.session();
  if (!user) return;
  var EN = DS.lang() === 'en';
  function L(ar, en) { return EN ? en : ar; }

  var isSellPage = /owner\/sell\.html/.test(location.pathname);
  var tenant = DS.data.tenantById(user.tenant_id) || {};

  var page = DS.shell.mount({
    roles: ['cashier', 'owner'],
    active: isSellPage ? 'sell' : 'pos',
    title: isSellPage ? L('الكاشير', 'Cashier') : t('pos'),
    eyebrow: tenant.name || t('store'),
    icon: 'cashier',
    sub: isSellPage
      ? L('بيع سريع بنفس تجربة الكاشير — مع خصم المدير وطباعة الليبل.', 'A cashier-grade sale counter — owner discounts and label printing included.')
      : (EN ? 'Ring up a sale in seconds — products, cart, payment and receipt.' : 'أنشئ بيعة في ثوانٍ — المنتجات، السلة، الدفع والإيصال.'),
    actions: '<button type="button" class="pos-scan-btn" data-pos-scan>' + icon('camera') + '<span>' + L('مسح', 'Scan') + '</span></button>',
    content: DS.skeleton.grid(8)
  });
  if (!page) return;

  /* The counter owns the viewport; the shell keeps its sidebar and top bar. */
  document.body.classList.add('pos-immersive');

  var state = {
    q: '', cat: '', cart: [], payment: 'cash', customer: { name: '', phone: '', address: '' },
    discountType: 'percent', discountValue: 0, cashReceived: '', notes: '', busy: false, mobileOpen: false
  };
  var canDiscount = user.role === 'owner' || (DS.data.isAdmin && DS.data.isAdmin(user));

  /* ───────────────────────────── DATA ───────────────────────────── */
  function products() {
    return DS.data.visibleProducts(user).filter(function (p) { return p.is_active !== false; });
  }

  function categories() {
    var out = [];
    products().forEach(function (p) {
      var c = DS.loc(p, 'category');
      if (c && out.indexOf(c) === -1) out.push(c);
    });
    return out;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return products().filter(function (p) {
      if (state.cat && DS.loc(p, 'category') !== state.cat) return false;
      if (!q) return true;
      var name = String(DS.loc(p, 'name') || '').toLowerCase();
      var sku = String(p.sku || '').toLowerCase();
      return name.indexOf(q) > -1 ||
        sku.indexOf(q) > -1 ||
        (p.barcode && String(p.barcode).toLowerCase().indexOf(q) > -1);
    });
  }

  function cartCount() { return state.cart.reduce(function (s, l) { return s + l.qty; }, 0); }
  function subtotal() { return state.cart.reduce(function (s, l) { return s + l.price * l.qty; }, 0); }
  function deliveryFee() { return state.cart.length ? (Number(tenant.delivery_fee) || 0) : 0; }

  /* Owner/admin-only manual discount: 10–100% or 10–100 EGP.
     Cashiers never get this control — the row does not exist for them. */
  function discountAmount() {
    if (!canDiscount) return 0;
    var v = Math.max(0, Number(state.discountValue) || 0);
    var sub = subtotal();
    if (!sub || !v) return 0;
    var amount = state.discountType === 'fixed' ? v : sub * v / 100;
    return Math.max(0, Math.min(sub, Math.round(amount * 100) / 100));
  }
  function vatBase() { return Math.max(0, subtotal() - discountAmount()); }
  function vatAmount() { return DS.data.vatAmount ? DS.data.vatAmount(vatBase()) : 0; }
  function total() { return Math.max(0, subtotal() - discountAmount() + deliveryFee() + vatAmount()); }
  function lineOf(id) { return state.cart.filter(function (l) { return l.id === id; })[0]; }

  /* ── Customer lookup by phone → saved Home / Work addresses ────── */
  function knownAddresses(phone) {
    var p = String(phone || '').replace(/\s/g, '');
    if (!p) return [];
    var out = [];
    function push(label, labelEn, addr, addrEn, city, cityEn) {
      if (!addr) return;
      var dupe = out.some(function (a) { return a.address === addr; });
      if (!dupe) out.push({ label: label, label_en: labelEn, address: addr, address_en: addrEn || addr, city: city || '', city_en: cityEn || city || '' });
    }
    (DS.data.users || []).forEach(function (u) {
      if (String(u.phone || '').replace(/\s/g, '') !== p) return;
      var list = DS.data.addressesFor ? DS.data.addressesFor(u) : [];
      list.forEach(function (a, i) { push(a.label || (i ? 'Work' : 'Home'), a.label_en || (i ? 'Work' : 'Home'), a.address, a.address_en, a.city, a.city_en); });
    });
    (DS.data.visibleOrders ? DS.data.visibleOrders(user) : []).forEach(function (o) {
      if (!o.customer || String(o.customer.phone || '').replace(/\s/g, '') !== p) return;
      push('Home', 'Home', o.customer.address, o.customer.address_en, o.customer.city, o.customer.city_en);
    });
    return out.slice(0, 4);
  }

  function findCustomer(phone) {
    var p = String(phone || '').replace(/\s/g, '');
    if (!p) return null;
    var u = (DS.data.users || []).filter(function (x) { return String(x.phone || '').replace(/\s/g, '') === p; })[0];
    var orders = (DS.data.visibleOrders ? DS.data.visibleOrders(user) : []).filter(function (o) {
      return o.customer && String(o.customer.phone || '').replace(/\s/g, '') === p;
    }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    if (u) return { name: DS.loc(u, 'name'), phone: u.phone, address: DS.loc(u, 'address'), addresses: DS.data.addressesFor(u) };
    if (orders.length) return { name: DS.loc(orders[0].customer, 'name'), phone: p, address: DS.loc(orders[0].customer, 'address'), addresses: knownAddresses(p) };
    return null;
  }

  /* ───────────────────────────── CART ───────────────────────────── */
  function addToCart(id) {
    var p = products().filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var line = lineOf(id);
    var wanted = line ? line.qty + 1 : 1;
    if (wanted > Number(p.stock || 0)) {
      DS.toast(t('outOfStock') + ' · ' + DS.loc(p, 'name'), 'warning');
      return;
    }
    if (line) line.qty = wanted;
    else state.cart.push({
      id: p.id, name: p.name, name_en: p.name_en, price: Number(p.price) || 0,
      qty: 1, image: p.image, stock: Number(p.stock) || 0
    });
    renderCart();
    bumpCart();
  }

  function setQty(id, qty) {
    var line = lineOf(id);
    if (!line) return;
    if (qty <= 0) state.cart = state.cart.filter(function (l) { return l.id !== id; });
    else if (qty > Number(line.stock || 0)) { DS.toast(t('outOfStock'), 'warning'); return; }
    else line.qty = qty;
    renderCart();
  }

  function clearCart() {
    if (!state.cart.length) return;
    state.cart = [];
    state.cashReceived = '';
    state.discountValue = 0;
    state.discountType = 'percent';
    state.notes = '';
    renderCart();
    DS.toast(L('تم تفريغ السلة', 'Cart cleared'), 'info');
  }

  /* ─────────────────────────── RENDERING ────────────────────────── */
  function categoryButton(label, value) {
    return '<button type="button" role="tab" data-cat="' + esc(value) + '"' +
      ' aria-selected="' + (state.cat === value ? 'true' : 'false') + '"' +
      ' class="' + (state.cat === value ? 'active' : '') + '">' + esc(label) + '</button>';
  }

  function categoriesMarkup() {
    return categoryButton(L('الكل', 'All'), '') + categories().map(function (c) {
      return categoryButton(c, c);
    }).join('');
  }

  function productCard(p) {
    var name = DS.loc(p, 'name');
    var stock = Number(p.stock) || 0;
    var out = stock <= 0;
    var low = !out && stock <= (Number(p.min_stock) || 0);

    return '<article class="product-card' + (out ? ' is-out' : '') + '">' +
      '<div class="product-media product-image-container">' +
        '<img src="' + esc(DS.data.img(p.image)) + '" alt="' + esc(name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + esc(DS.url('assets/product-placeholder.svg')) + '\'">' +
        (out
          ? '<span class="product-badge danger">' + esc(L('نفذ', 'Sold out')) + '</span>'
          : (low ? '<span class="product-badge warning">' + esc(L('كمية محدودة', 'Low stock')) + '</span>' : '')) +
      '</div>' +
      '<h3 class="product-title">' + esc(name) + '</h3>' +
      '<div class="product-meta">' +
        '<span class="product-price">' + money(p.price) + '</span>' +
        '<span class="product-stock">' + (out ? esc(L('غير متوفر', 'Unavailable')) : esc(stock + ' ' + L('متوفر', 'in stock'))) + '</span>' +
      '</div>' +
      '<button type="button" class="add-btn" data-add="' + esc(p.id) + '"' + (out ? ' disabled' : '') + '>' +
        (out ? esc(L('نفذ', 'Sold out')) : icon('plus') + esc(L('إضافة', 'Add'))) +
      '</button>' +
    '</article>';
  }

  function renderProducts() {
    var grid = document.getElementById('productsGrid');
    if (!grid) return;
    var list = filtered();

    grid.innerHTML = list.length
      ? list.map(productCard).join('')
      : '<div style="grid-column:1/-1;padding:48px 0">' +
          DS.empty({
            icon: 'search',
            title: t('noResults') || L('لا توجد نتائج', 'No results'),
            text: L('جرّب كلمة بحث أخرى أو اختر فئة مختلفة.', 'Try another search term or pick a different category.')
          }) + '</div>';

    DS.$$('[data-add]', grid).forEach(function (b) {
      b.addEventListener('click', function () { addToCart(b.getAttribute('data-add')); });
    });
  }

  function cartMarkup() {
    if (!state.cart.length) {
      return '<div class="cart-empty">' +
        '<div class="cart-empty-icon">' + icon('bag') + '</div>' +
        '<b>' + esc(t('emptyCart')) + '</b>' +
        '<span>' + esc(L('اختر منتجاً من القائمة لبدء الطلب.', 'Pick a product from the catalogue to start an order.')) + '</span>' +
      '</div>';
    }

    return state.cart.map(function (l) {
      var name = DS.loc(l, 'name');
      return '<div class="cart-item">' +
        '<img class="ci-img" src="' + esc(DS.data.img(l.image)) + '" alt="">' +
        '<div class="ci-info">' +
          '<div class="ci-name">' + esc(name) + '</div>' +
          '<div class="ci-price">' + money(l.price) + '</div>' +
          '<div class="ci-stepper">' +
            '<button type="button" data-minus="' + esc(l.id) + '" aria-label="' + esc(L('تقليل', 'Decrease')) + '">' + icon('minus') + '</button>' +
            '<span>' + l.qty + '</span>' +
            '<button type="button" data-plus="' + esc(l.id) + '" aria-label="' + esc(L('زيادة', 'Increase')) + '">' + icon('plus') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="ci-side">' +
          '<span class="ci-line">' + money(l.price * l.qty) + '</span>' +
          '<button type="button" class="ci-remove" data-remove="' + esc(l.id) + '" aria-label="' + esc(t('remove')) + '">' + icon('trash') + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function changeLabel(cash) {
    if (!cash) return money(0);
    var diff = cash - total();
    return diff < 0 ? '− ' + money(Math.abs(diff)) : money(diff);
  }

  function summaryMarkup() {
    var hasItems = state.cart.length > 0;
    var cash = Number(state.cashReceived) || 0;
    var change = cash - total();

    return '<div class="cart-rows">' +
      '<div class="cart-row"><span>' + esc(L('المجموع', 'Subtotal')) + '</span><span>' + money(subtotal()) + '</span></div>' +
      (deliveryFee() > 0 ? '<div class="cart-row"><span>' + esc(t('delivery')) + '</span><span>' + money(deliveryFee()) + '</span></div>' : '') +
      (canDiscount && discountAmount() > 0 ? '<div class="cart-row discount"><span>' + esc(t('discount')) + '</span><span>− ' + money(discountAmount()) + '</span></div>' : '') +
      '<div class="cart-row vat"><span>' + esc(L('ضريبة القيمة المضافة', 'VAT')) + ' · ' + (DS.data.vatRate ? DS.data.vatRate() : 15) + '%</span><span>' + money(vatAmount()) + '</span></div>' +
    '</div>' +

    '<div class="cart-row total"><span>' + esc(L('الإجمالي', 'Total')) + '</span><span class="lemon-text" id="cartTotal">' + money(total()) + '</span></div>' +

    '<div class="quick-cash">' +
      [50, 100, 200, 500].map(function (amount) {
        return '<button type="button" data-cash-quick="' + amount + '">' + amount + '</button>';
      }).join('') +
    '</div>' +

    '<div class="cash-input-row">' +
      '<input class="cash-input" id="cashReceived" type="number" min="0" step="1" dir="ltr" inputmode="numeric" placeholder="' + esc(L('المبلغ المستلم', 'Cash received')) + '" value="' + esc(state.cashReceived || '') + '">' +
      '<span class="cash-change">' + esc(cash > 0 && change < 0 ? L('المتبقي', 'Due') : L('الباقي', 'Change')) +
        '<b id="cartChange" class="' + (cash > 0 && change < 0 ? 'is-short' : '') + '">' + changeLabel(cash) + '</b>' +
      '</span>' +
    '</div>' +

    '<button type="button" class="pay-btn" id="checkoutBtn"' + (hasItems ? '' : ' disabled') + '>' +
      '<span>' + esc(L('إتمام الطلب (F4)', 'Complete order (F4)')) + '</span>' +
      '<span class="pay-btn-total">' + money(total()) + '</span>' +
    '</button>' +
    '<div class="cart-hint">' + esc(L('F2 للبحث · F4 لإتمام الطلب', 'F2 to search · F4 to complete')) + '</div>';
  }

  function bindSummary() {
    DS.$$('[data-cash-quick]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { setCash(Number(b.getAttribute('data-cash-quick')) || 0); });
    });

    var cashInput = document.getElementById('cashReceived');
    if (cashInput) {
      cashInput.addEventListener('input', function () {
        state.cashReceived = cashInput.value === '' ? '' : (Number(cashInput.value) || 0);
        updateChange();
      });
    }

    var checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', openCheckout);

    updateChange();
  }

  function updateChange() {
    var input = document.getElementById('cashReceived');
    var out = document.getElementById('cartChange');
    if (!out) return;
    var cash = Number(input && input.value) || 0;
    out.textContent = changeLabel(cash);
    out.classList.toggle('is-short', cash > 0 && cash < total());
    var label = out.parentNode ? out.parentNode.firstChild : null;
    if (label && label.nodeType === 3) {
      label.nodeValue = cash > 0 && cash < total() ? L('المتبقي', 'Due') : L('الباقي', 'Change');
    }
  }

  function setCash(amount) {
    state.cashReceived = amount;
    var input = document.getElementById('cashReceived');
    if (input) input.value = amount;
    updateChange();
  }

  function renderCart() {
    var items = document.getElementById('cartItems');
    if (items) items.innerHTML = cartMarkup();

    var count = cartCount();
    var countLabel = document.getElementById('cartCountLabel');
    if (countLabel) countLabel.textContent = count;
    var mobileCount = document.querySelector('[data-mobile-count]');
    if (mobileCount) mobileCount.textContent = count;

    var host = document.getElementById('cartSummary');
    if (host) {
      host.innerHTML = summaryMarkup();
      bindSummary();
    }

    if (items) {
      DS.$$('[data-plus]', items).forEach(function (b) {
        b.onclick = function () { var l = lineOf(b.getAttribute('data-plus')); if (l) setQty(l.id, l.qty + 1); };
      });
      DS.$$('[data-minus]', items).forEach(function (b) {
        b.onclick = function () { var l = lineOf(b.getAttribute('data-minus')); if (l) setQty(l.id, l.qty - 1); };
      });
      DS.$$('[data-remove]', items).forEach(function (b) {
        b.onclick = function () { setQty(b.getAttribute('data-remove'), 0); };
      });
    }
  }

  function bumpCart() {
    var cart = document.getElementById('cartArea');
    if (!cart) return;
    cart.classList.remove('is-bumped');
    void cart.offsetWidth;
    cart.classList.add('is-bumped');
  }

  function render() {
    var html =
      '<div class="pos-layout">' +

        /* 70% — products */
        '<div class="pos-left">' +
          '<div class="pos-header">' +
            '<div class="pos-search">' +
              icon('search') +
              '<input type="text" class="search-input" id="posSearch" autocomplete="off" placeholder="' + esc(L('ابحث بالاسم أو الباركود...', 'Search by name or barcode…')) + '" value="' + esc(state.q) + '">' +
              '<button type="button" class="search-clear" data-search-clear aria-label="' + esc(L('مسح البحث', 'Clear search')) + '"' + (state.q ? '' : ' hidden') + '>' + icon('x') + '</button>' +
              (DS.dragon ? '<button type="button" class="pos-voice-btn" data-pos-voice title="' + esc(L('تحكم صوتي', 'Voice control')) + '" aria-label="' + esc(L('تحكم صوتي', 'Voice control')) + '">' + icon('mic') + '</button>' : '') +
            '</div>' +
            '<div class="categories-scroll" id="posCategories" role="tablist" aria-label="' + esc(L('الفئات', 'Categories')) + '">' +
              categoriesMarkup() +
            '</div>' +
          '</div>' +
          '<div class="products-grid" id="productsGrid" aria-label="' + esc(L('المنتجات', 'Products')) + '"></div>' +
        '</div>' +

        /* 30% — current order */
        '<div class="pos-right" id="cartArea" aria-label="' + esc(L('الطلب الحالي', 'Current order')) + '">' +
          '<div class="cart-header">' +
            '<div class="cart-header-main">' +
              '<span class="cart-header-icon">' + icon('bag') + '</span>' +
              '<h2>' + esc(L('الطلب الحالي', 'Current order')) + '</h2>' +
              '<span class="badge" id="cartCountLabel">0</span>' +
            '</div>' +
            '<div class="cart-header-actions">' +
              (isSellPage ? '<button type="button" class="cart-icon-btn" data-labels title="' + esc(L('طباعة ليبل', 'Print labels')) + '" aria-label="' + esc(L('طباعة ليبل', 'Print labels')) + '">' + icon('printer') + '</button>' : '') +
              '<button type="button" class="cart-icon-btn cart-clear" data-clear-cart aria-label="' + esc(L('تفريغ السلة', 'Clear cart')) + '" title="' + esc(L('تفريغ السلة', 'Clear cart')) + '">' + icon('trash') + '</button>' +
              '<button type="button" class="cart-icon-btn cart-close" data-cart-close aria-label="' + esc(L('إغلاق', 'Close')) + '">' + icon('x') + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-items" id="cartItems"></div>' +
          '<div class="cart-footer" id="cartSummary"></div>' +
        '</div>' +

      '</div>' +
      '<div class="pos-cart-scrim" data-cart-scrim></div>' +
      '<button type="button" class="pos-cart-fab" data-mobile-cart aria-label="' + esc(L('عرض السلة', 'View cart')) + '">' +
        icon('bag') + '<span>' + esc(L('السلة', 'Cart')) + '</span><span class="pos-fab-count" data-mobile-count>0</span>' +
      '</button>';

    page.setContent(html);

    /* Categories */
    var cats = document.getElementById('posCategories');
    if (cats) {
      cats.addEventListener('click', function (e) {
        var b = e.target.closest('[data-cat]');
        if (!b) return;
        state.cat = b.getAttribute('data-cat') || '';
        DS.$$('[data-cat]', cats).forEach(function (x) {
          var on = x === b;
          x.classList.toggle('active', on);
          x.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        renderProducts();
      });
    }

    /* Search */
    var searchInput = document.getElementById('posSearch');
    var clearSearch = page.body.querySelector('[data-search-clear]');
    if (searchInput) {
      searchInput.addEventListener('input', DS.debounce(function () {
        state.q = searchInput.value;
        if (clearSearch) clearSearch.hidden = !state.q;
        renderProducts();
      }, 120));
    }
    if (clearSearch) {
      clearSearch.addEventListener('click', function () {
        state.q = '';
        if (searchInput) { searchInput.value = ''; searchInput.focus(); }
        clearSearch.hidden = true;
        renderProducts();
      });
    }

    /* Header actions */
    var labels = page.root.querySelector('[data-labels]');
    if (labels) labels.addEventListener('click', openLabelsPicker);

    /* ── Dragon · Voice POS ──────────────────────────────────────────
       «أضف عصير مانجو» · «احذف ميلك شيك» · «كم المجموع» · «ادفع»      */
    var voiceBtn = page.body.querySelector('[data-pos-voice]');
    if (voiceBtn && DS.dragon) {
      var voice = null;
      voiceBtn.addEventListener('click', function () {
        function findProduct(q) {
          var needle = String(q || '').trim().toLowerCase();
          if (!needle) return null;
          return products().filter(function (p) {
            return (p.name + ' ' + (p.name_en || '') + ' ' + (p.category || '') + ' ' + (p.category_en || ''))
              .toLowerCase().indexOf(needle) > -1;
          })[0] || null;
        }
        if (voice && voice.state.listening) { voice.stop(); return; }
        voice = DS.dragon.voicePOS({
          onState: function (on) {
            voiceBtn.classList.toggle('is-live', on);
            voiceBtn.title = on ? L('يستمع… انقر للإيقاف', 'Listening… click to stop') : L('تحكم صوتي', 'Voice control');
          },
          onHeard: function (parsed, text) {
            DS.toast(L('سمعت: ', 'Heard: ') + text, 'info');
          },
          add: function (parsed) {
            var p = findProduct(parsed.query);
            if (!p) { DS.toast(L('لم أجد: ', 'Not found: ') + parsed.query, 'warning'); return; }
            addToCart(p.id);
            DS.toast(L('تمت إضافة ', 'Added ') + DS.loc(p, 'name'), 'success');
          },
          remove: function (parsed) {
            var p = findProduct(parsed.query);
            if (!p) { DS.toast(L('لم أجد: ', 'Not found: ') + parsed.query, 'warning'); return; }
            var line = lineOf(p.id);
            if (!line) { DS.toast(L('المنتج غير في السلة', 'Not in the cart'), 'warning'); return; }
            setQty(p.id, line.qty - 1);
            DS.toast(L('تم حذف ', 'Removed ') + DS.loc(p, 'name'), 'success');
          },
          total: function () {
            DS.toast(L('الإجمالي: ', 'Total: ') + money(total()), 'info');
          },
          pay: function () { completeSale(); },
          clear: function () { clearCart(); }
        });
        if (voice.supported) voice.start();
        else DS.toast(L('التحكم الصوتي غير مدعوم في هذا المتصفح', 'Voice control is not supported in this browser'), 'warning');
      });
    }

    var clearBtn = page.body.querySelector('[data-clear-cart]');
    if (clearBtn) clearBtn.addEventListener('click', clearCart);

    var closeBtn = page.body.querySelector('[data-cart-close]');
    if (closeBtn) closeBtn.addEventListener('click', function () { setCartOpen(false); });

    var scrim = page.body.querySelector('[data-cart-scrim]');
    if (scrim) scrim.addEventListener('click', function () { setCartOpen(false); });

    var mobileBtn = page.body.querySelector('[data-mobile-cart]');
    if (mobileBtn) mobileBtn.addEventListener('click', function () { setCartOpen(!state.mobileOpen); });

    renderProducts();
    renderCart();
    setCartOpen(false);
  }

  function setCartOpen(open) {
    state.mobileOpen = !!open;
    var cart = document.getElementById('cartArea');
    var scrim = page.body.querySelector('[data-cart-scrim]');
    if (cart) cart.classList.toggle('open', state.mobileOpen);
    if (scrim) scrim.classList.toggle('open', state.mobileOpen);
    document.body.classList.toggle('pos-cart-open', state.mobileOpen);
  }

  /* ───────────────── OWNER LABEL PRINTING ───────────────── */
  function openLabelsPicker() {
    var list = products();
    var body = '<div class="field"><label>' + esc(L('ابحث عن منتج', 'Find a product')) + '</label>' +
      '<input class="input" data-lbl-q placeholder="' + esc(t('searchProduct')) + '"></div>' +
      '<div class="pos-label-list" data-lbl-list>' + labelRows(list) + '</div>';
    var m = DS.modal({
      size: 'md',
      title: icon('printer') + ' ' + esc(L('طباعة ليبل المنتجات', 'Print product labels')),
      sub: esc(L('اختر منتجاً لطباعة ليبل 50×30مم', 'Pick a product for a 50×30mm thermal label')),
      body: body,
      actions: [{ label: t('close'), variant: 'btn-secondary' }]
    });

    function labelRows(items) {
      if (!items.length) return '<div class="text-muted" style="font-size:12px;padding:10px">' + esc(t('noProducts')) + '</div>';
      return items.map(function (p) {
        return '<button type="button" class="pos-label-row" data-print-label="' + esc(p.id) + '">' +
          '<img src="' + esc(DS.data.img(p.image)) + '" alt="">' +
          '<span><b>' + esc(DS.loc(p, 'name')) + '</b><i>' + esc(p.sku || '') + ' · ' + money(p.price) + '</i></span>' +
          icon('printer') + '</button>';
      }).join('');
    }

    function bindRows() {
      DS.$$('[data-print-label]', m.el).forEach(function (b) {
        b.addEventListener('click', function () {
          var p = products().filter(function (x) { return x.id === b.getAttribute('data-print-label'); })[0];
          if (p) printLabel(p);
        });
      });
    }

    function printLabel(p) {
      if (DS.printProductLabel) { DS.printProductLabel(p); return; }
      DS.toast(t('error'), 'error');
    }

    var q = m.el.querySelector('[data-lbl-q]');
    if (q) q.addEventListener('input', DS.debounce(function () {
      var term = q.value.trim().toLowerCase();
      var host = m.el.querySelector('[data-lbl-list]');
      var filtered = list.filter(function (p) {
        return !term || (p.name + ' ' + (p.name_en || '') + ' ' + (p.sku || '')).toLowerCase().indexOf(term) > -1;
      });
      host.innerHTML = labelRows(filtered);
      bindRows();
    }, 140));

    bindRows();
  }

  /* ─────────────────────────── CHECKOUT ─────────────────────────── */
  function openCheckout() {
    if (!state.cart.length) { DS.toast(t('emptyCartText'), 'warning'); return; }

    var customer = state.customer;
    var discountBlock = canDiscount
      ? '<div class="pos-discount-panel">' +
          '<div class="pdp-head">' + icon('percent') + '<b>' + L('خصم المدير', 'Owner discount') + '</b>' +
            '<span>' + L('10–100% أو 10–100 ج.م', '10–100% or 10–100 EGP') + '</span></div>' +
          '<div class="pdp-row">' +
            '<select class="select" id="ckDiscType">' +
              '<option value="percent"' + (state.discountType === 'percent' ? ' selected' : '') + '>' + L('نسبة %', 'Percent %') + '</option>' +
              '<option value="fixed"' + (state.discountType === 'fixed' ? ' selected' : '') + '>' + L('مبلغ ثابت', 'Fixed EGP') + '</option>' +
            '</select>' +
            '<input class="input" id="ckDiscount" type="number" min="10" max="100" step="1" value="' + esc(state.discountValue || '') + '" placeholder="10 – 100" dir="ltr">' +
            '<button type="button" class="btn btn-secondary btn-sm" data-disc-clear>' + icon('x') + '</button>' +
          '</div>' +
          '<div class="pdp-hint" data-disc-hint>' + L('لا يوجد خصم', 'No discount') + '</div>' +
        '</div>'
      : '';

    var addrPicks = knownAddresses(customer.phone);
    var body =
      '<div class="pos-checkout-stack">' +

        '<div class="pos-checkout-pay">' +
          '<div class="pos-checkout-section">' + esc(L('الدفع والملخص', 'Payment & summary')) + '</div>' +
          '<div class="field"><label>' + esc(t('paymentMethod')) + '</label><select class="select" id="ckPay">' +
              '<option value="cash"' + (state.payment === 'cash' ? ' selected' : '') + '>' + esc(t('cash')) + '</option>' +
              '<option value="card"' + (state.payment === 'card' ? ' selected' : '') + '>' + esc(t('card')) + '</option>' +
              '<option value="wallet"' + (state.payment === 'wallet' ? ' selected' : '') + '>' + esc(t('wallet')) + '</option></select></div>' +
          '<div class="pos-cash-panel" data-cash-panel' + (state.payment === 'cash' ? '' : ' hidden') + '>' +
            '<div class="field"><label>' + L('المبلغ المستلم', 'Cash received') + '</label>' +
              '<input class="input pos-cash-input" id="ckCash" type="number" min="0" step="1" dir="ltr" value="' + esc(state.cashReceived || '') + '" placeholder="0"></div>' +
            '<div class="pos-change"><span>' + L('الباقي للعميل', 'Change due') + '</span><b class="num" data-change>0</b></div>' +
            '<div class="quick-cash" style="display:flex;gap:8px;margin-top:8px;">' +
              '<button type="button" class="btn btn-secondary btn-sm" data-ck-quick="50" style="flex:1;">50</button>' +
              '<button type="button" class="btn btn-secondary btn-sm" data-ck-quick="100" style="flex:1;">100</button>' +
              '<button type="button" class="btn btn-secondary btn-sm" data-ck-quick="200" style="flex:1;">200</button>' +
            '</div>' +
          '</div>' +
          '<div class="cart-summary">' +
            '<div class="cart-row"><span>' + esc(t('subtotal')) + '</span><span>' + money(subtotal()) + '</span></div>' +
            (canDiscount ? '<div class="cart-row" data-ck-disc-row style="' + (discountAmount() ? '' : 'display:none') + ';color:var(--lime)"><span>' + esc(t('discount')) + '</span><span data-ck-discount>− ' + money(discountAmount()) + '</span></div>' : '') +
            '<div class="cart-row vat"><span>' + esc(L('ضريبة القيمة المضافة', 'VAT')) + '</span><span data-ck-vat>' + money(vatAmount()) + '</span></div>' +
            '<div class="cart-row"><span>' + esc(t('delivery')) + '</span><span>' + money(deliveryFee()) + '</span></div>' +
            '<div class="cart-row total"><span>' + esc(t('total')) + '</span><span class="num" data-ck-total>' + money(total()) + '</span></div>' +
          '</div>' +
        '</div>' +

        '<details class="pos-checkout-more">' +
          '<summary class="pos-more-toggle">' + icon('user') + '<span>' + L('خيارات إضافية · العميل، الخصم، الملاحظات', 'More options · customer, discount, notes') + '</span>' + icon('chevronDown') + '</summary>' +
          '<div class="pos-checkout-extra">' +
            '<div class="field"><label>' + esc(t('customerPhone')) + '</label>' +
              '<div class="pos-phone-lookup"><input class="input" id="ckPhone" value="' + esc(customer.phone) + '" placeholder="01xxxxxxxxx" style="direction:ltr" inputmode="tel">' +
              '<button type="button" class="btn btn-secondary btn-sm" data-phone-lookup>' + icon('search') + '</button></div>' +
              '<div class="cell-sub" data-phone-state></div></div>' +
            '<div class="field"><label>' + esc(t('customerName')) + '</label><input class="input" id="ckName" value="' + esc(customer.name) + '" placeholder="' + esc(t('walkIn')) + '"></div>' +
            '<div class="field"><label>' + L('عنوان التوصيل', 'Delivery address') + '</label>' +
              '<input class="input" id="ckAddress" value="' + esc(customer.address) + '" placeholder="' + esc(t('address')) + '">' +
              '<div class="pos-addr-picks" data-addr-picks>' + addrPicks.map(function (a, i) {
                return '<button type="button" class="pos-addr-chip" data-addr="' + esc(a.address) + '">' + icon(i === 0 ? 'home' : 'briefcase') +
                  '<span><b>' + esc(EN ? (a.label_en || a.label) : a.label) + '</b><i>' + esc(a.address) + '</i></span></button>';
              }).join('') + '</div></div>' +
            discountBlock +
            '<div class="field"><label>' + esc(t('notes')) + '</label><textarea class="textarea" id="ckNotes" rows="2" placeholder="' + esc(t('notes')) + '">' + esc(state.notes) + '</textarea></div>' +
          '</div>' +
        '</details>' +

      '</div>';

    var m = DS.modal({
      title: t('checkout'),
      sub: cartCount() + ' ' + t('items') + ' · ' + (tenant.name || ''),
      size: 'lg',
      modalClass: 'pos-checkout',
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('confirmOrder'), variant: 'btn-primary', icon: icon('check'), onClick: function (root) {
            var name = root.querySelector('#ckName').value.trim() || t('walkIn');
            var phone = root.querySelector('#ckPhone').value.trim();
            if (!name) { DS.toast(t('required'), 'error'); return false; }
            if (phone && !/^[0-9+\-\s]{7,20}$/.test(phone)) { DS.toast(t('invalidPhone'), 'error'); return false; }
            if (canDiscount) {
              var dv = Number(root.querySelector('#ckDiscount').value) || 0;
              if (dv > 0 && (dv < 10 || dv > 100)) { DS.toast(L('الخصم بين 10 و 100 فقط', 'Discount must be between 10 and 100'), 'error'); return false; }
              state.discountValue = dv > 0 ? dv : 0;
              state.discountType = root.querySelector('#ckDiscType').value === 'fixed' ? 'fixed' : 'percent';
            }
            if (state.payment === 'cash') {
              var cash = Number(root.querySelector('#ckCash').value) || 0;
              if (cash > 0 && cash < total()) { DS.toast(L('المبلغ المستلم أقل من الإجمالي', 'Cash received is less than the total'), 'error'); return false; }
              state.cashReceived = cash || '';
            }
            state.customer = { name: name, phone: phone, address: root.querySelector('#ckAddress').value.trim() };
            state.payment = root.querySelector('#ckPay').value;
            state.notes = root.querySelector('#ckNotes').value.trim();
            completeSale();
            return true;
          } }
      ],
      onMount: function (root) {
        function recalc() {
          var totalEl = root.querySelector('[data-ck-total]');
          if (totalEl) totalEl.textContent = money(total());
          var discRow = root.querySelector('[data-ck-disc-row]');
          var discEl = root.querySelector('[data-ck-discount]');
          if (discEl) discEl.textContent = '− ' + money(discountAmount());
          if (discRow) discRow.style.display = discountAmount() > 0 ? '' : 'none';
          var hint = root.querySelector('[data-disc-hint]');
          if (hint) hint.textContent = state.discountValue > 0
            ? L('خصم ' + (state.discountType === 'percent' ? state.discountValue + '%' : money(state.discountValue)), 'Discount ' + (state.discountType === 'percent' ? state.discountValue + '%' : money(state.discountValue)))
            : L('لا يوجد خصم', 'No discount');
          updateChange();
        }
        function updateChange() {
          var cashEl = root.querySelector('#ckCash');
          var out = root.querySelector('[data-change]');
          if (!out) return;
          var cash = Number(cashEl && cashEl.value) || 0;
          out.textContent = cash > 0 && cash < total() ? '− ' + money(total() - cash) : money(Math.max(0, cash - total()));
          out.classList.toggle('is-short', cash > 0 && cash < total());
        }
        var d = root.querySelector('#ckDiscount');
        if (d) d.addEventListener('input', function () {
          var v = Math.max(0, Number(d.value) || 0);
          state.discountValue = v;
          recalc();
        });
        var dt = root.querySelector('#ckDiscType');
        if (dt) dt.addEventListener('change', function () {
          state.discountType = dt.value === 'fixed' ? 'fixed' : 'percent';
          var inp = root.querySelector('#ckDiscount');
          if (inp) { inp.max = '100'; inp.min = '10'; }
          recalc();
        });
        var clr = root.querySelector('[data-disc-clear]');
        if (clr) clr.addEventListener('click', function () {
          state.discountValue = 0;
          var inp = root.querySelector('#ckDiscount');
          if (inp) inp.value = '';
          recalc();
        });
        var cashInput = root.querySelector('#ckCash');
        if (cashInput) cashInput.addEventListener('input', function () { state.cashReceived = cashInput.value; updateChange(); });
        DS.$$('[data-ck-quick]', root).forEach(function (b) {
          b.addEventListener('click', function () {
            var amt = Number(b.getAttribute('data-ck-quick')) || 0;
            state.cashReceived = amt;
            if (cashInput) cashInput.value = amt;
            state.payment = 'cash';
            var paySel = root.querySelector('#ckPay');
            if (paySel) paySel.value = 'cash';
            var panel = root.querySelector('[data-cash-panel]');
            if (panel) panel.hidden = false;
            updateChange();
          });
        });
        var pay = root.querySelector('#ckPay');
        if (pay) pay.addEventListener('change', function () {
          state.payment = pay.value;
          var panel = root.querySelector('[data-cash-panel]');
          if (panel) panel.hidden = pay.value !== 'cash';
        });

        /* Phone → customer + saved Home/Work address quick picks. */
        var phone = root.querySelector('#ckPhone');
        function lookup() {
          var c = findCustomer(phone.value);
          var stateEl = root.querySelector('[data-phone-state]');
          if (!c) {
            if (stateEl) stateEl.textContent = phone.value ? L('عميل جديد', 'New customer') : '';
            var picksEmpty = root.querySelector('[data-addr-picks]');
            if (picksEmpty) picksEmpty.innerHTML = '';
            return;
          }
          var nameEl = root.querySelector('#ckName');
          var addrEl = root.querySelector('#ckAddress');
          if (nameEl && !nameEl.value.trim()) nameEl.value = c.name || '';
          if (addrEl && !addrEl.value.trim()) addrEl.value = c.address || '';
          if (stateEl) stateEl.textContent = L('تم العثور على العميل ✓', 'Customer found ✓');
          var picks = root.querySelector('[data-addr-picks]');
          if (picks) {
            var list = c.addresses && c.addresses.length ? c.addresses : knownAddresses(phone.value);
            picks.innerHTML = list.map(function (a, i) {
              return '<button type="button" class="pos-addr-chip" data-addr="' + esc(a.address) + '">' + icon(i === 0 ? 'home' : 'briefcase') +
                '<span><b>' + esc(EN ? (a.label_en || a.label) : a.label) + '</b><i>' + esc(a.address) + '</i></span></button>';
            }).join('');
            bindAddrPicks();
          }
        }
        function bindAddrPicks() {
          DS.$$('[data-addr]', root).forEach(function (b) {
            b.onclick = function () {
              var addrEl = root.querySelector('#ckAddress');
              if (addrEl) addrEl.value = b.getAttribute('data-addr');
              DS.$$('[data-addr]', root).forEach(function (x) { x.classList.toggle('active', x === b); });
            };
          });
        }
        var lookupBtn = root.querySelector('[data-phone-lookup]');
        if (lookupBtn) lookupBtn.addEventListener('click', lookup);
        if (phone) {
          phone.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); lookup(); } });
          phone.addEventListener('change', lookup);
        }
        bindAddrPicks();
        updateChange();
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
      discount: discountAmount(),
      delivery_fee: deliveryFee(),
      total: total(),
      cash_received: state.payment === 'cash' ? (Number(state.cashReceived) || total()) : null,
      change_due: state.payment === 'cash' ? Math.max(0, (Number(state.cashReceived) || total()) - total()) : 0,
      payment_method: state.payment,
      source: 'pos',
      notes: state.notes,
      status: 'delivered',
      driver_name: user.name,
      timeline: [
        { status: 'pending', at: now, label: t('order.created') },
        { status: 'preparing', at: now, label: t('order.preparingAt') },
        { status: 'handed_to_company', at: now, label: t('handedToCompany') },
        { status: 'out_for_delivery', at: now, label: t('out_for_delivery') },
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
    state.discountValue = 0;
    state.discountType = 'percent';
    state.cashReceived = '';
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
          return '<div class="order-item-row"><img src="' + esc(DS.data.img(it.image)) + '" alt=""><div class="info"><div class="nm">' + esc(DS.loc(it, 'name')) + '</div><div class="qt">' + it.qty + ' × ' + money(it.price) + '</div></div><div class="pr">' + money(it.qty * it.price) + '</div></div>';
        }).join('') + '</div>',
      actions: [
        { label: t('newSale'), variant: 'btn-secondary' },
        (canDiscount ? { label: L('عرض الفاتورة', 'View invoice'), variant: 'btn-secondary', icon: icon('receipt'), onClick: function () { window.location.href = DS.url('cashier/invoices.html'); } } : null),
        { label: t('printReceipt'), variant: 'btn-primary', icon: icon('printer'), onClick: function () { DS.printReceipt(order); } }
      ].filter(Boolean)
    });

    window.dispatchEvent(new CustomEvent('ds:data-changed'));
  }

  window.setCash = function (amt) { setCash(amt); };

  /* ────────────────────── KEYBOARD SHORTCUTS ────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F2') {
      e.preventDefault();
      var searchInput = document.querySelector('#posSearch');
      if (searchInput) { searchInput.focus(); try { searchInput.select(); } catch (err) {} }
    } else if (e.key === 'F4') {
      e.preventDefault();
      var checkoutBtn = document.querySelector('#checkoutBtn');
      if (checkoutBtn && !checkoutBtn.disabled) checkoutBtn.click();
    } else if (e.key === 'Escape' && state.mobileOpen) {
      setCartOpen(false);
    }
  });

  /* ────────────────────── HARDWARE BARCODE SCANNER ────────────────────── */
  if (DS.mountBarcodeScanner) {
    DS.mountBarcodeScanner({
      getProducts: function () { return products(); },
      onFound: function (p) { addToCart(p.id); },
      onNotFound: function (code) {
        DS.toast(EN ? 'Product not found · ' + code : 'المنتج غير موجود · ' + code, 'error');
      }
    });
  }

  render();
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-pos-scan]') : null;
    if (!btn) return;
    if (DS.openCameraScanner) {
      DS.openCameraScanner({
        onFound: function (p) {
          if (p && p.id) {
            /* try to match by barcode/id */
            var found = (products() || []).filter(function (x) { return x.id === p.id || x.barcode === p.barcode || x.barcode === p.id; })[0];
            if (found) addToCart(found.id);
          }
        }
      });
    }
  });

})();
