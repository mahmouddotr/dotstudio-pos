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

  /* Local calendar date (YYYY-MM-DD) — toISOString() would shift by timezone. */
  function localDate(d) {
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }

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

    var expiryTable = isAdmin ? '<div class="card"><div class="card-header"><div class="card-title">' + esc(DS.lang() === 'en' ? 'All subscriptions' : 'كل الاشتراكات') + '</div><span class="badge lime">' + DS.data.tenants.length + '</span></div><div class="table-wrap flush"><table class="table"><thead><tr><th>' + esc(t('store')) + '</th><th>' + esc(t('plan')) + '</th><th>' + esc(t('expires')) + '</th><th>' + esc(t('daysRemaining')) + '</th><th>' + esc(t('status')) + '</th><th></th></tr></thead><tbody>' +
      DS.data.tenants.map(function (x) {
        var sx = DS.data.activeSubscription(x.id);
        return '<tr><td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(x)) + '" alt=""><div><div class="cell-title">' + esc(DS.loc(x, 'name')) + '</div><div class="cell-sub">' + (x.status === 'suspended' ? esc(t('inactive')) : esc(t('active'))) + '</div></div></div></td>' +
          '<td>' + esc(t(x.plan)) + '</td><td>' + esc(DS.date(x.subscription_end)) + '</td>' +
          '<td><span class="badge ' + (sx.daysLeft <= 15 ? 'warning' : 'success') + '">' + Math.max(0, sx.daysLeft) + '</span></td>' +
          '<td>' + (x.status === 'suspended' ? DS.badge('suspended', t('inactive')) : sx.expired ? DS.badge('expired', t('expired')) : sx.daysLeft <= 15 ? DS.badge('pending', t('expiringSoon')) : DS.badge('active', t('active'))) + '</td>' +
          '<td style="text-align:end;white-space:nowrap"><button class="btn btn-secondary btn-sm" data-manage="' + esc(x.id) + '">' + icon('settings') + esc(t('manage')) + '</button></td></tr>';
      }).join('') + '</tbody></table></div></div>' : '';

    page.setContent(hero + storePicker + plans + expiryTable + paymentTable);
    bind(tn);
  }

  function bind(tn) {
    var store = page.body.querySelector('[data-store]');
    if (store) store.addEventListener('change', function () { state.tenantId = store.value; render(); });
    DS.$$('[data-manage]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { manage(b.getAttribute('data-manage')); });
    });
    DS.$$('[data-renew]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var payload = DS.data.subscriptionPayload(b.getAttribute('data-plan'), tn);
        window.open(payload.url, '_blank', 'noopener');
        DS.toast(t('subscriptionContact'), 'success');
      });
    });
  }

  /* ─────────────── Manage one subscription (admin only) ─────────────── */
  function manage(tenantId) {
    var tn = DS.data.tenantById(tenantId);
    if (!tn) return;
    var end = new Date(tn.subscription_end);
    if (isNaN(end.getTime())) end = new Date();
    var dateValue = localDate(end);
    var suspended = tn.status === 'suspended';

    var body = '<div class="manage-sub">' +
      '<div class="manage-sub-head">' +
        '<img class="avatar" src="' + esc(DS.avatarUrl(tn)) + '" alt="">' +
        '<div><b>' + esc(DS.loc(tn, 'name')) + '</b><span>' + esc(t('manageSubscription')) + '</span></div>' +
        (suspended ? DS.badge('suspended', t('inactive')) : DS.badge('active', t('active'))) +
      '</div>' +
      '<p class="hint" style="margin:2px 0 12px">' + esc(t('subscriptionManageHint')) + '</p>' +
      '<div class="field"><label>' + esc(t('plan')) + '</label><select class="select" data-sub-plan>' +
        DS.data.PLANS.map(function (p) {
          return '<option value="' + p.id + '"' + (p.id === tn.plan ? ' selected' : '') + '>' + esc(DS.loc(p, 'name')) + ' · ' + p.price + ' EGP</option>';
        }).join('') + '</select></div>' +
      '<div class="field" style="margin-top:12px"><label>' + esc(t('setExpiry')) + '</label>' +
        '<div class="manage-sub-quick"><input class="input" type="date" data-sub-date value="' + esc(dateValue) + '">' +
          '<button type="button" class="btn btn-secondary btn-sm" data-sub-plus dir="ltr">+7</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-sub-minus dir="ltr">−7</button>' +
        '</div></div>' +
      '<label class="check" style="margin-top:12px;padding:9px 11px;border:1px solid var(--border);border-radius:10px"><input type="checkbox" data-sub-payment><span>' + esc(t('recordPayment')) + '</span></label>' +
      '<div class="manage-sub-status">' +
        '<button type="button" class="btn ' + (suspended ? 'btn-primary' : 'btn-danger') + ' btn-block" data-sub-toggle>' +
          icon(suspended ? 'play' : 'pause') + esc(suspended ? t('activateStore') : t('suspendStore')) +
        '</button>' +
      '</div></div>';

    var m = DS.modal({
      size: 'sm',
      title: t('manageSubscription'),
      sub: DS.loc(tn, 'name'),
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('saveChanges'), variant: 'btn-primary', onClick: function (root) {
          var nextPlan = root.querySelector('[data-sub-plan]').value;
          var nextDate = root.querySelector('[data-sub-date]').value;
          var pay = root.querySelector('[data-sub-payment]').checked;
          if (!nextDate) { DS.toast(t('required'), 'error'); return false; }
          /* Keep the original time-of-day so +7/−7 always move exactly 7 days. */
          var until = new Date(nextDate + 'T00:00:00');
          if (isNaN(until.getTime())) { DS.toast(t('required'), 'error'); return false; }
          until.setHours(end.getHours(), end.getMinutes(), end.getSeconds(), end.getMilliseconds());
          DS.data.manageSubscription(tn.id, {
            plan: nextPlan,
            end: until.toISOString(),
            recordPayment: pay && nextPlan !== tn.plan
          });
          DS.toast(t('subscriptionUpdated'), 'success');
          state.tenantId = tn.id;
          render();
          return true;
        } }
      ],
      onMount: function (root) {
        var dateInput = root.querySelector('[data-sub-date]');
        var cursor = new Date(end.getTime());
        var plus = root.querySelector('[data-sub-plus]');
        var minus = root.querySelector('[data-sub-minus]');
        if (plus) plus.addEventListener('click', function () {
          cursor.setDate(cursor.getDate() + 7);
          dateInput.value = localDate(cursor);
        });
        if (minus) minus.addEventListener('click', function () {
          cursor.setDate(cursor.getDate() - 7);
          dateInput.value = localDate(cursor);
        });
        if (dateInput) dateInput.addEventListener('change', function () {
          var picked = new Date(dateInput.value + 'T00:00:00');
          if (!isNaN(picked.getTime())) {
            cursor.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
            dateInput.value = localDate(cursor);
          }
        });
        var toggle = root.querySelector('[data-sub-toggle]');
        if (toggle) toggle.addEventListener('click', function () {
          DS.data.setTenantStatus(tn.id, suspended ? 'active' : 'suspended');
          DS.toast(suspended ? t('storeActivated') : t('storeSuspended'), 'success');
          m.close();
          state.tenantId = tn.id;
          render();
        });
      }
    });
  }

  setTimeout(render, 160);
})();
