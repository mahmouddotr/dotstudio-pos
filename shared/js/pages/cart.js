(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var EN = DS.lang() === 'en';
  var user = DS.session();
  if (!user) return;

  var page = DS.shell.mount({
    roles: null,
    active: 'storefront',
    title: EN ? 'Cart' : 'السلة',
    eyebrow: EN ? 'Store' : 'المتجر',
    icon: 'bag',
    sub: EN ? 'Review your items before checkout.' : 'راجع منتجاتك قبل إتمام الطلب.',
    actions: '<button type="button" class="btn btn-secondary" data-theme-toggle aria-label="' + esc(EN ? 'Toggle theme' : 'تبديل المظهر') + '" title="' + esc(EN ? 'Theme' : 'المظهر') + '">' + icon((DS.customerTheme && DS.customerTheme() === 'dark') ? 'sun' : 'moon') + '</button>' +
      '<a class="btn btn-secondary" href="' + url('customer/storefront.html') + '">' + icon('arrowLeft') + esc(EN ? 'Continue shopping' : 'متابعة التسوق') + '</a>',
    content: DS.skeleton.rows(4)
  });
  if (!page) return;
  document.body.classList.add('saleor', 'saleor-store');

  /* Hydrate a stored line from the live catalog: an older bag may hold only
     {id, qty}, and a product may change its price/name after it was added. */
  function hydrate(l) {
    if (!l) return l;
    var p = (DS.data.products || []).filter(function (x) { return x.id === l.id; })[0];
    if (!p) return l;
    return {
      id: l.id,
      name: p.name,
      name_en: p.name_en,
      price: Number(p.price) || 0,
      qty: Math.max(0, Number(l.qty) || 0),
      image: p.image,
      stock: p.stock,
      tenant_id: p.tenant_id,
      variant: l.variant || ''
    };
  }
  function cart() {
    var c = DS.cart.read();
    return { items: (c.items || []).map(hydrate) };
  }
  function productName(l) { return EN ? (l.name_en || l.name) : l.name; }
  function imgSrc(l) { return DS.data.img ? DS.data.img(l.image) : (l.image || ''); }
  function tenantName(id) {
    var tn = DS.data.tenantById ? DS.data.tenantById(id) : null;
    return tn ? (EN ? (tn.name_en || tn.name) : tn.name) : '';
  }
  function tenantOf(id) { return DS.data.tenantById ? DS.data.tenantById(id) : null; }

  function promo() {
    var code = String(DS.store.get('ds_promo', '') || '').trim().toUpperCase();
    if (!code || !DS.data.validateDiscount) return null;
    var sub = (cart().items || []).reduce(function (s, l) { return s + (Number(l.price) || 0) * (Number(l.qty) || 0); }, 0);
    var check = DS.data.validateDiscount(code, sub);
    return { code: code, amount: check && check.ok ? Number(check.amount) || 0 : 0 };
  }

  /* ONE delivery fee only: the cart shows the estimate of the store that will
     hand the bag over; checkout then applies the exact single fee for the
     chosen channel (in-house or courier). */
  function deliveryEstimate(items) {
    var first = (items || [])[0];
    var tn = first ? tenantOf(first.tenant_id) : null;
    return tn ? (Number(tn.delivery_fee) || 0) : 0;
  }

  function render() {
    var c = cart();
    var items = c.items || [];
    if (!items.length) {
      page.setContent('<div class="ct-cart-page"><div class="ct-empty-wrap">' +
        DS.empty({ icon: 'bag', title: t('emptyCart'), text: t('emptyCartText'),
          cta: { label: t('browseStore'), icon: 'store', onclick: "location.href='" + url('customer/storefront.html') + "'" } }) +
        '</div></div>');
      return;
    }

    var subtotal = items.reduce(function (s, l) { return s + (Number(l.price) || 0) * (Number(l.qty) || 0); }, 0);
    var shipping = deliveryEstimate(items);
    var discount = promo();
    var discountAmount = Math.min(subtotal, discount ? discount.amount : 0);
    var total = Math.max(0, subtotal + shipping - discountAmount);
    var count = items.reduce(function (s, l) { return s + (Number(l.qty) || 0); }, 0);
    var stores = Object.keys(items.reduce(function (acc, l) { acc[l.tenant_id] = 1; return acc; }, {})).length;

    var itemsHtml = items.map(function (l) {
      var variant = l.variant ? String(l.variant) : tenantName(l.tenant_id);
      return '<div class="ct-line" data-id="' + esc(l.id) + '">' +
        '<div class="ct-line-media"><img src="' + esc(imgSrc(l)) + '" alt="' + esc(productName(l)) + '" loading="lazy"></div>' +
        '<div class="ct-line-info">' +
          '<b>' + esc(productName(l)) + '</b>' +
          (variant ? '<span class="ct-line-variant">' + esc(variant) + '</span>' : '') +
          '<span class="ct-line-unit">' + money(l.price) + ' × ' + (Number(l.qty) || 0) + '</span>' +
        '</div>' +
        '<div class="ct-line-side">' +
          '<div class="ct-qty">' +
            '<button type="button" data-dec="' + esc(l.id) + '" aria-label="' + esc(EN ? 'Decrease' : 'تقليل') + '">' + icon('minus') + '</button>' +
            '<i>' + (Number(l.qty) || 0) + '</i>' +
            '<button type="button" data-inc="' + esc(l.id) + '" aria-label="' + esc(EN ? 'Increase' : 'زيادة') + '">' + icon('plus') + '</button>' +
          '</div>' +
          '<span class="ct-line-total">' + money((Number(l.price) || 0) * (Number(l.qty) || 0)) + '</span>' +
        '</div>' +
        '<button type="button" class="ct-trash" data-remove="' + esc(l.id) + '" aria-label="' + esc(EN ? 'Remove item' : 'حذف المنتج') + '" title="' + esc(EN ? 'Remove' : 'حذف') + '">' + icon('trash') + '</button>' +
      '</div>';
    }).join('');

    var summary = '<aside class="ct-summary">' +
      '<h2>' + esc(EN ? 'Order summary' : 'ملخص الطلب') + '</h2>' +
      '<div class="ct-sum-row"><span>' + esc(t('subtotal')) + ' · ' + count + ' ' + esc(t('item')) + '</span><span>' + money(subtotal) + '</span></div>' +
      '<div class="ct-sum-row"><span>' + esc(t('delivery')) + (stores > 1 ? ' · ' + esc(EN ? 'estimate' : 'تقديري') : '') + '</span><span>' + (shipping ? money(shipping) : esc(EN ? 'Free' : 'مجاني')) + '</span></div>' +
      (discountAmount ? '<div class="ct-sum-row is-discount"><span>' + esc(EN ? 'Promo' : 'خصم') + ' · ' + esc(discount.code) + '</span><span>− ' + money(discountAmount) + '</span></div>' : '') +
      '<div class="ct-sum-rule"></div>' +
      '<div class="ct-sum-total"><span>' + esc(t('total')) + '</span><b>' + money(total) + '</b></div>' +
      '<a class="ct-checkout-btn" href="' + url('customer/checkout.html') + '">' + icon('lock') + esc(EN ? 'Checkout' : 'إتمام الطلب') + '</a>' +
      '<div class="ct-trust">' +
        '<span>' + icon('shield') + (EN ? 'Secure Payment 100%' : 'دفع آمن 100%') + '</span>' +
        '<span>' + icon('refresh') + (EN ? 'Easy Returns' : 'إرجاع سهل') + '</span>' +
        '<span>' + icon('truck') + (EN ? 'Free Shipping' : 'شحن مجاني') + '</span>' +
      '</div>' +
      '<div class="ct-sum-note">' + icon('checkCircle') + esc(EN ? 'Taxes included. No hidden fees.' : 'الأسعار شاملة. بدون رسوم خفية.') + '</div>' +
    '</aside>';

    page.setContent('<div class="ct-cart-page">' +
      '<div class="ct-cart-head"><div>' +
        '<h1>' + esc(EN ? 'Your bag' : 'سلة مشترياتك') + '</h1>' +
        '<p>' + count + ' ' + esc(t('item')) + ' · ' + stores + ' ' + esc(EN ? 'stores' : 'متاجر') + '</p>' +
      '</div>' +
      '<a class="btn btn-secondary" href="' + url('customer/storefront.html') + '">' + icon('arrowLeft') + esc(EN ? 'Keep shopping' : 'متابعة التسوق') + '</a>' +
      '</div>' +
      '<div class="ct-cart-layout"><div class="ct-cart-list">' + itemsHtml + '</div>' + summary + '</div>' +
    '</div>');

    page.body.querySelectorAll('[data-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-remove');
        var c = cart();
        c.items = c.items.filter(function (l) { return l.id !== id; });
        DS.cart.persist(c, true);
        render();
      });
    });
    page.body.querySelectorAll('[data-inc]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-inc');
        var c = cart();
        var l = c.items.filter(function (x) { return x.id === id; })[0];
        if (l) { l.qty = (Number(l.qty) || 0) + 1; DS.cart.persist(c, true); render(); }
      });
    });
    page.body.querySelectorAll('[data-dec]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-dec');
        var c = cart();
        var l = c.items.filter(function (x) { return x.id === id; })[0];
        if (l) {
          l.qty = (Number(l.qty) || 0) - 1;
          if (l.qty <= 0) c.items = c.items.filter(function (x) { return x.id !== id; });
          DS.cart.persist(c, true);
          render();
        }
      });
    });
  }

  render();
})();
