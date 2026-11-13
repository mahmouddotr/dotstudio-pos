/* DotStudio® POS — PAYMENT VERIFICATION DESK (Admin / Owner)
   Reviews the receipts of the manual wallet transfers (Vodafone Cash /
   InstaPay). A held order stays invisible for the cashier and the kitchen
   until an admin approves it here. */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money, url = DS.url;
  var user = DS.session();
  if (!user) return;
  var isAdminUser = DS.data.isAdmin(user);

  var page = DS.shell.mount({
    roles: isAdminUser ? ['superadmin', 'subadmin'] : ['owner'],
    permission: user.role === 'subadmin' ? 'orders' : null,
    active: 'paymentVerification',
    title: t('paymentVerification'),
    eyebrow: isAdminUser ? t('admin') : (DS.data.tenantById(user.tenant_id) || {}).name,
    icon: 'shield',
    sub: t('verificationDeskSub'),
    actions: '<button class="btn btn-secondary" data-refresh>' + icon('refresh') + esc(t('refresh')) + '</button>',
    content: DS.skeleton.rows(6)
  });
  if (!page) return;

  var state = { tab: 'pending', q: '' };

  /* ── Data ─────────────────────────────────────────────────────── */
  function pending() {
    return DS.data.pendingVerifications(user).slice().sort(function (a, b) {
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }
  function rejected() {
    return DS.data.rejectedVerifications(user).slice().sort(function (a, b) {
      return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
    });
  }
  function list() { return state.tab === 'rejected' ? rejected() : pending(); }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    if (!q) return list();
    return list().filter(function (o) {
      var hay = [o.order_no, o.customer ? o.customer.name : '', o.customer ? o.customer.phone : '', o.payment_transaction_id].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  /* ── Markup ───────────────────────────────────────────────────── */
  function stat(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span>' +
      '<span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div>' +
      '<div class="stat-value" style="font-size:26px">' + value + '</div>' +
      '<div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }

  function historyList(o) {
    var rows = o.history || [];
    if (!rows.length) return '';
    var EN = DS.lang() === 'en';
    var map = {
      receipt_submitted: EN ? 'Receipt submitted' : 'تم إرسال الإيصال',
      receipt_resubmitted: EN ? 'New receipt submitted' : 'تم إرسال إيصال جديد',
      payment_approved: EN ? 'Payment approved' : 'تم تأكيد الدفع',
      payment_rejected: EN ? 'Receipt rejected' : 'تم رفض الإيصال'
    };
    return '<ul class="verify-history">' + rows.map(function (h) {
      var tone = h.action === 'payment_approved' ? 'var(--success)'
        : (h.action === 'payment_rejected' ? 'var(--danger)' : 'var(--text-tertiary)');
      return '<li>' +
        '<span style="color:' + tone + '">' + icon(h.action === 'payment_approved' ? 'checkCircle' : (h.action === 'payment_rejected' ? 'alert' : 'upload')) + '</span>' +
        '<span><span class="who">' + esc(map[h.action] || h.action) + '</span> — ' +
          esc(h.by || 'System') + ' · ' + esc(DS.datetime(h.at)) +
          (h.reason ? '<br><span class="reason">' + esc(h.reason) + '</span>' : '') +
        '</span></li>';
    }).join('') + '</ul>';
  }

  function verifyCard(o) {
    var EN = DS.lang() === 'en';
    var tn = DS.data.tenantById(o.tenant_id) || {};
    var customerName = o.customer ? DS.loc(o.customer, 'name') : '—';
    var methodLabel = o.payment_method === 'instapay' ? t('paymentMethodInstapay') : t('paymentMethodVodafone');
    var isRejected = o.status === 'payment_rejected';

    /* LEFT — the order facts the reviewer checks against the receipt. */
    var left = '<div class="verify-left">' +
      '<div class="verify-rows">' +
        '<div class="verify-row"><span class="verify-label">' + esc(t('orderId')) + '</span>' +
          '<span class="v mono">' + esc(o.order_no) + '</span></div>' +
        '<div class="verify-row"><span class="verify-label">' + esc(t('customerLabel')) + '</span>' +
          '<span class="v">' + esc(customerName) + '</span>' +
          (o.customer && o.customer.phone ? '<span class="v mono" style="font-size:var(--fs-xs);color:var(--text-tertiary)">' + esc(o.customer.phone) + '</span>' : '') +
        '</div>' +
        '<div class="verify-row"><span class="verify-label">' + esc(t('total')) + '</span>' +
          '<span class="verify-amount">' + money(o.total) + '</span>' +
          '<span class="v" style="font-size:var(--fs-xs);color:var(--text-tertiary)">' +
            esc(EN ? 'Items' : 'المنتجات') + ': ' + (o.items || []).reduce(function (s, i) { return s + i.qty; }, 0) +
            ' · ' + esc(EN ? 'Delivery' : 'التوصيل') + ': ' + money(o.delivery_fee) +
            (o.discount ? ' · ' + esc(EN ? 'Discount' : 'الخصم') + ': −' + money(o.discount) : '') +
          '</span></div>' +
        '<div class="verify-row"><span class="verify-label">' + esc(EN ? 'Date' : 'التاريخ') + '</span>' +
          '<span class="v">' + esc(DS.datetime(o.created_at)) + '</span></div>' +
        '<div class="verify-row"><span class="verify-label">' + esc(EN ? 'Store' : 'المتجر') + '</span>' +
          '<span class="v">' + esc(tn.name || '—') + '</span></div>' +
        '<div class="verify-row"><span class="verify-label">' + esc(t('paymentMethod')) + '</span>' +
          '<span class="v">' + esc(methodLabel) + '</span></div>' +
      '</div>' +
      (isRejected && o.rejection_reason
        ? '<div class="verify-reason">' + icon('alert') + ' ' + esc(o.rejection_reason) + '</div>'
        : '') +
      historyList(o) +
    '</div>';

    /* RIGHT — the evidence: the receipt image + the transaction reference. */
    var right = '<div class="verify-right">' +
      '<div class="verify-label">' + esc(t('receiptImage')) + '</div>' +
      (o.payment_receipt
        ? '<img class="verify-receipt" src="' + esc(o.payment_receipt) + '" alt="' + esc(t('receiptImage')) + '" data-zoom="' + esc(o.id) + '">'
        : '<div class="verify-receipt-empty">' + icon('image') + '<span>' + esc(EN ? 'No receipt attached' : 'لا يوجد إيصال مرفق') + '</span></div>') +
      '<div style="margin-top:14px">' +
        '<div class="verify-label">' + esc(t('transactionId')) + '</div>' +
        '<span class="verify-tx">' + icon('shield') + esc(o.payment_transaction_id || '—') + '</span>' +
      '</div>' +
      (isRejected ? '' :
        '<div class="verify-actions">' +
          '<button class="btn btn-primary" data-approve="' + esc(o.id) + '">' + icon('checkCircle') + esc(t('approvePayment')) + '</button>' +
          '<button class="btn btn-secondary" data-reject="' + esc(o.id) + '">' + icon('x') + esc(t('rejectReceipt')) + '</button>' +
        '</div>') +
    '</div>';

    return '<article class="verify-card" data-order="' + esc(o.id) + '">' +
      '<div class="verify-head">' +
        '<span class="order-no">' + esc(o.order_no) + '</span>' +
        DS.badge(o.status, DS.statusMeta(o.status).label) +
        '<span class="badge neutral">' + esc(methodLabel) + '</span>' +
        '<span style="margin-inline-start:auto;font-size:var(--fs-xs);color:var(--text-tertiary)">' + esc(DS.timeAgo(o.created_at)) + '</span>' +
      '</div>' +
      '<div class="verify-split">' + left + right + '</div>' +
    '</article>';
  }

  function render() {
    var p = pending(), r = rejected();
    var heldAmount = p.reduce(function (s, o) { return s + (Number(o.total) || 0); }, 0);
    var rows = filtered();

    var stats = '<div class="kpi-grid">' +
      stat(t('awaitingReviewCount'), String(p.length), 'shield', p.length ? 'orange' : 'green', t('manualPayment')) +
      stat(t('rejectedCount'), String(r.length), 'alert', r.length ? 'danger' : 'green', t('paymentRejected')) +
      stat(t('total'), money(heldAmount), 'wallet', 'lime', t('awaitingReviewCount')) +
      stat(t('orders'), String(p.length + r.length), 'orders', 'info', t('paymentVerification')) +
    '</div>';

    var toolbar = '<div class="card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div class="search-mini" style="flex:1;min-width:220px">' + icon('search') +
        '<input data-q placeholder="' + esc(DS.lang() === 'en' ? 'Search order / customer / transaction' : 'ابحث برقم الطلب أو العميل أو العملية') + '" value="' + esc(state.q) + '"></div>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="btn btn-sm ' + (state.tab === 'pending' ? 'btn-primary' : 'btn-secondary') + '" data-tab="pending">' + esc(t('awaitingReviewCount')) + ' · ' + p.length + '</button>' +
        '<button class="btn btn-sm ' + (state.tab === 'rejected' ? 'btn-primary' : 'btn-secondary') + '" data-tab="rejected">' + esc(t('rejectedCount')) + ' · ' + r.length + '</button>' +
      '</div>' +
    '</div></div>';

    var body = rows.length
      ? rows.map(verifyCard).join('')
      : '<div class="card"><div class="card-body">' + DS.empty({
          icon: 'shield',
          title: t('noPendingVerifications'),
          text: t('noPendingVerificationsText')
        }) + '</div></div>';

    page.setContent(stats + toolbar + body);
    bind();
  }

  /* ── Actions ──────────────────────────────────────────────────── */
  function approve(id) {
    var o = DS.data.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    var res = DS.data.verifyPayment(id, true, '');
    if (!res || !res.ok) { DS.toast(t('error'), 'error'); return; }
    DS.toast((DS.lang() === 'en' ? 'Payment approved — ' : 'تم تأكيد الدفع — ') + o.order_no, 'success');
    render();
  }

  var REASONS = [
    { ar: 'المبلغ غير مطابق', en: 'Amount does not match' },
    { ar: 'رقم العملية خطأ', en: 'Wrong transaction ID' },
    { ar: 'الإيصال غير واضح', en: 'Receipt is not readable' },
    { ar: 'لا يوجد تحويل فعلي', en: 'No real transfer found' }
  ];

  function reject(id) {
    var o = DS.data.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    var EN = DS.lang() === 'en';
    var quick = REASONS.map(function (r, i) {
      return '<button type="button" class="btn btn-secondary btn-sm" data-reason="' + esc(EN ? r.en : r.ar) + '">' + esc(EN ? r.en : r.ar) + '</button>';
    }).join('');
    DS.modal({
      size: 'sm',
      title: esc(t('rejectReceipt')),
      sub: o.order_no + ' · ' + money(o.total),
      body: '<div class="field"><label>' + esc(t('rejectionReasonLabel')) + '</label>' +
        '<input class="input" id="rejectReason" placeholder="' + esc(t('rejectionReasonPlaceholder')) + '">' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' + quick + '</div>' +
        '<p style="font-size:11px;color:var(--text-tertiary);margin-top:10px">' +
          esc(EN ? 'The reason is shown to the customer and stored in the audit trail.' : 'سيظهر السبب للعميل وسيُسجَّل في سجل النشاط.') + '</p>' +
        '</div>',
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('rejectReceipt'), variant: 'btn-danger', icon: icon('x'), onClick: function (root) {
            var input = root.querySelector('#rejectReason');
            var reason = (input && input.value || '').trim();
            if (!reason) { DS.toast(t('rejectionReasonLabel'), 'error'); return false; }
            var res = DS.data.verifyPayment(id, false, reason);
            if (!res || !res.ok) { DS.toast(t('error'), 'error'); return false; }
            DS.toast((EN ? 'Receipt rejected — ' : 'تم رفض الإيصال — ') + o.order_no, 'success');
            render();
            return true;
          } }
      ],
      onMount: function (root) {
        DS.$$('[data-reason]', root).forEach(function (b) {
          b.addEventListener('click', function () {
            var input = root.querySelector('#rejectReason');
            if (input) input.value = b.getAttribute('data-reason');
          });
        });
      }
    });
  }

  function bind() {
    var q = page.body.querySelector('[data-q]');
    if (q) q.addEventListener('input', DS.debounce(function () { state.q = q.value; render(); }, 170));
    DS.$$('[data-tab]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); render(); });
    });
    DS.$$('[data-approve]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { approve(b.getAttribute('data-approve')); });
    });
    DS.$$('[data-reject]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { reject(b.getAttribute('data-reject')); });
    });
    /* Click the receipt to enlarge it. */
    DS.$$('[data-zoom]', page.body).forEach(function (img) {
      img.addEventListener('click', function () {
        var box = document.createElement('div');
        box.className = 'verify-lightbox';
        box.innerHTML = '<img src="' + esc(img.getAttribute('src')) + '" alt="">';
        box.addEventListener('click', function () { box.remove(); });
        document.body.appendChild(box);
      });
    });
  }

  var refresh = page.root.querySelector('[data-refresh]');
  if (refresh) refresh.addEventListener('click', function () { render(); DS.toast(t('updated'), 'success'); });

  window.addEventListener('ds:order-updated', render);
  window.addEventListener('ds:data-changed', render);
  setTimeout(render, 160);
})();
