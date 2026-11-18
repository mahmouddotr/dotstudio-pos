(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url;
  var EN = DS.lang() === 'en';
  var user = DS.session();
  if (!user) return;

  var params = new URLSearchParams(location.search);
  var orderId = params.get('order') || params.get('id') || '';

  var page = DS.shell.mount({
    roles: null,
    active: 'storefront',
    title: EN ? 'Order placed' : 'تم الطلب',
    eyebrow: EN ? 'Store' : 'المتجر',
    icon: 'checkCircle',
    content: ''
  });
  if (!page) return;
  document.body.classList.add('saleor', 'saleor-store');

  var html = '<div class="co-page"><div class="success-page">' +
    '<div class="success-check">' + icon('check') + '</div>' +
    '<div class="success-title">' + esc(EN ? 'Payment Successful!' : 'تم الدفع بنجاح!') + '</div>' +
    '<div class="success-sub">' + esc(EN ? 'Your order has been placed successfully.' : 'تم إنشاء طلبك بنجاح.') + '</div>' +
    (orderId ? '<div class="success-order">#' + esc(orderId) + '</div>' : '') +
    '<div class="success-actions">' +
      '<a class="btn btn-primary" style="background:#111111;color:#FFFFFF;border-color:#111111" href="' + url('customer/tracking.html' + (orderId ? '?order=' + encodeURIComponent(orderId) : '')) + '">' + esc(EN ? 'Track Your Order' : 'تتبع طلبك') + '</a>' +
      '<a class="btn btn-outline" href="' + url('customer/storefront.html') + '">' + esc(EN ? 'Continue Shopping' : 'متابعة التسوق') + '</a>' +
    '</div>' +
  '</div></div>';
  page.setContent(html);
})();
