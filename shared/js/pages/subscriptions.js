/* DotStudio® POS — Subscriptions */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;
  var user = DS.session();
  if (!user) return;
  var isAdmin = DS.data.isAdmin(user);
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : ['owner'],
    permission: user.role === 'subadmin' ? 'subscriptions' : null,
    active: 'subscriptions',
    title: t('subscriptions'),
    eyebrow: isAdmin ? t('admin') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'card',
    sub: t('subscriptionSub'),
    content: DS.skeleton.cards(3)
  });
  if (!page) return;

  var state = { tenantId: isAdmin ? (DS.qs('store') || DS.data.tenants[0].id) : user.tenant_id };

  function render() {
    var tn = DS.data.tenantById(state.tenantId) || DS.data.tenants[0];
    var sub = DS.data.activeSubscription(tn.id);
    var payments = DS.data.payments.filter(function (p) { return p.tenant_id === tn.id; }).sort(function (a, b) { return new Date(b.at) - new Date(a.at); });

    var hero = '<div class="welcome-card"><div class="welcome-copy">' +
      '<span class="welcome-kicker">' + icon('card') + esc(t('currentPlan')) + '</span>' +
      '<div class="welcome-title">' + esc(sub ? DS.loc(sub.plan, 'name') : '—') + ' · ' + (sub && sub.daysLeft > 0 ? sub.daysLeft + ' ' + t('daysLeft') : t('expired')) + '</div>' +
      '<div class="welcome-sub">' + esc(DS.lang() === 'en' ? 'Your subscription is linked to ' + tn.name + '. Renew on WhatsApp and keep everything running.' : 'اشتراكك مرتبط بـ ' + tn.name + '. جدّد عبر واتساب وخلّي كل حاجة شغالة.') + '</div>' +
      '<div class="welcome-actions"><button class="btn btn-primary" data-renew data-plan="' + (sub ? sub.plan.id : 'monthly') + '">' + icon('whatsapp') + esc(t('renew')) + '</button>' +
      '<a class="btn btn-secondary" href="#plans">' + icon('sparkles') + esc(t('subscriptionTitle')) + '</a></div></div>' +
      '<div class="welcome-stats"><div class="welcome-stat"><div class="v">' + (sub ? sub.plan.price : 0) + ' <span style="font-size:13px">EGP</span></div><div class="l">' + esc(sub ? DS.loc(sub.plan, 'period') : '') + '</div></div>' +
      '<div class="welcome-stat"><div class="v">' + esc(DS.date(tn.subscription_end)) + '</div><div class="l">' + esc(t('expires')) + '</div></div>' +
      '<div class="welcome-stat"><div class="v">' + DS.data.statsFor(tn.id).orders + '</div><div class="l">' + esc(t('orders')) + '</div></div></div></div>';

    var storePicker = isAdmin ? '<div class="card"><div class="card-body" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:12px;color:var(--text-tertiary)">' + esc(t('selectStore')) + '</span>' +
      '<select class="select" data-store style="max-width:240px">' + DS.data.tenants.map(function (x) { return '<option value="' + x.id + '"' + (x.id === tn.id ? ' selected' : '') + '>' + esc(DS.loc(x, 'name')) + '</option>'; }).join('') + '</select>' +
      '<span class="badge ' + (sub && sub.daysLeft <= 15 ? 'warning' : 'success') + '">' + (sub && sub.daysLeft <= 15 ? t('expiringSoon') : t('active')) + '</span></div></div>' : '';

    var plans = '<div id="plans" class="plan-grid">' + DS.data.PLANS.map(function (p) {
      var current = sub && sub.plan.id === p.id;
      var features = DS.lang() === 'en' ? p.features_en : p.features;
      return '<div class="plan-card' + (p.featured ? ' featured' : '') + '">' +
        (p.featured ? '<span class="plan-badge">' + esc(t('mostPopular')) + '</span>' : p.best ? '<span class="plan-badge" style="background:var(--surface-inverse);color:var(--text-inverse)">' + esc(t('bestValue')) + '</span>' : '') +
        '<div><div class="plan-name">' + esc(DS.lang() === 'en' ? p.name_en : p.name) + '</div>' +
        '<div class="plan-price"><span class="amount">' + p.price + '</span><span class="cur">EGP</span><span class="period">' + esc(DS.lang() === 'en' ? p.period_en : p.period) + '</span></div></div>' +
        '<ul class="plan-features">' + features.map(function (f) { return '<li>' + icon('checkCircle') + '<span>' + esc(f) + '</span></li>'; }).join('') + '</ul>' +
        (current ? '<div class="plan-current">' + icon('checkCircle') + esc(t('currentPlan')) + '</div>' : '') +
        '<button class="btn ' + (p.featured ? 'btn-primary' : 'btn-secondary') + ' btn-block" data-renew data-plan="' + p.id + '">' + icon('whatsapp') + esc(current ? t('renew') : t('subscribe')) + '</button>' +
        '<div class="plan-note">' + esc(t('subscriptionContact')) + '</div></div>';
    }).join('') + '</div>';

    var paymentTable = '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('invoices')) + '</div><span class="badge lime">' + payments.length + '</span></div>' +
      '<div class="table-wrap flush"><table class="table"><thead><tr><th>ID</th><th>' + esc(t('plan')) + '</th><th>' + esc(t('total')) + '</th><th>' + esc(t('paymentMethod')) + '</th><th>' + esc(t('date')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
      (payments.length ? payments.map(function (p) {
        return '<tr><td style="font-family:var(--font-mono);font-size:11px;direction:ltr">' + esc(p.id.toUpperCase()) + '</td><td>' + esc(t(p.plan)) + '</td><td><b>' + money(p.amount) + '</b></td><td>' + esc(t(p.method === 'whatsapp' ? 'wallet' : p.method)) + '</td><td style="font-size:11px;color:var(--text-tertiary)">' + esc(DS.date(p.at)) + '</td><td>' + DS.badge(p.status, t(p.status)) + '</td></tr>';
      }).join('') : '<tr><td colspan="6">' + DS.empty({ icon: 'card', title: t('noData'), text: t('subscriptionContact') }) + '</td></tr>') +
      '</tbody></table></div></div>';

    var expiryTable = isAdmin ? '<div class="card"><div class="card-header"><div class="card-title">' + esc(DS.lang() === 'en' ? 'All subscriptions' : 'كل الاشتراكات') + '</div></div><div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(t('store')) + '</th><th>' + esc(t('plan')) + '</th><th>' + esc(t('expires')) + '</th><th>' + esc(t('daysRemaining')) + '</th><th>' + esc(t('status')) + '</th></tr></thead><tbody>' +
      DS.data.tenants.map(function (x) {
        var sx = DS.data.activeSubscription(x.id);
        return '<tr><td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(x)) + '" alt=""><b>' + esc(DS.loc(x, 'name')) + '</b></div></td>' +
          '<td>' + esc(t(x.plan)) + '</td><td>' + esc(DS.date(x.subscription_end)) + '</td>' +
          '<td><span class="badge ' + (sx.daysLeft <= 15 ? 'warning' : sx.daysLeft <= 0 ? 'danger' : 'success') + '">' + Math.max(0, sx.daysLeft) + '</span></td>' +
          '<td>' + (sx.expired ? DS.badge('expired', t('expired')) : sx.daysLeft <= 15 ? DS.badge('pending', t('expiringSoon')) : DS.badge('active', t('active'))) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' : '';

    page.setContent(hero + storePicker + plans + expiryTable + paymentTable);
    bind(tn);
  }

  function bind(tn) {
    var store = page.body.querySelector('[data-store]');
    if (store) store.addEventListener('change', function () { state.tenantId = store.value; render(); });
    DS.$$('[data-renew]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var payload = DS.data.subscriptionPayload(b.getAttribute('data-plan'), tn);
        window.open(payload.url, '_blank', 'noopener');
        DS.toast(t('subscriptionContact'), 'success');
      });
    });
  }

  setTimeout(render, 160);
})();
