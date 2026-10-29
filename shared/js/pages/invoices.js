/* DotStudio® POS — Invoices (cashier / owner) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;
  var user = DS.session();
  if (!user) return;
  var tenant = DS.data.tenantById(user.tenant_id) || {};
  var page = DS.shell.mount({
    roles: ['cashier', 'owner'],
    active: 'invoices',
    title: t('invoices'),
    eyebrow: tenant.name || t('store'),
    icon: 'receipt',
    sub: DS.lang() === 'en' ? 'Every sale, receipt and payment method in one ledger.' : 'كل بيعة وإيصال وطريقة دفع في سجل واحد.',
    actions: '<button class="btn btn-secondary" data-export>' + icon('download') + esc(t('exportCsv')) + '</button>' +
      '<button class="btn btn-primary" data-refresh>' + icon('refresh') + esc(t('refresh')) + '</button>',
    content: DS.skeleton.rows(8)
  });
  if (!page) return;

  var state = { q: '', range: 'all', method: '' };

  function invoices() {
    return DS.data.visibleInvoices(user).slice().sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }
  function methodOf(i) { return i.payment_method || i.method || 'cash'; }
  function totalOf(i) { return Number(i.total) || 0; }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return invoices().filter(function (i) {
      if (state.method && methodOf(i) !== state.method) return false;
      if (state.range !== 'all' && (Date.now() - new Date(i.created_at).getTime()) / 86400000 > Number(state.range)) return false;
      if (!q) return true;
      var hay = (i.invoice_no + ' ' + (i.cashier_name || '') + ' ' + (i.order_no || '') + ' ' + (i.customer ? i.customer.name + ' ' + i.customer.phone : '')).toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }

  function stat(label, value, ico, tone, foot) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div><div class="stat-foot">' + esc(foot || '') + '</div></div>';
  }

  function render() {
    var all = invoices();
    var list = filtered();
    var total = all.reduce(function (s, i) { return s + totalOf(i); }, 0);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var todayTotal = all.filter(function (i) { return new Date(i.created_at) >= today; }).reduce(function (s, i) { return s + totalOf(i); }, 0);
    var cash = all.filter(function (i) { return methodOf(i) === 'cash'; }).reduce(function (s, i) { return s + totalOf(i); }, 0);

    var stats = '<div class="kpi-grid">' +
      stat(t('invoices'), String(all.length), 'receipt', 'lime', tenant.name || '') +
      stat(t('total'), money(total), 'wallet', 'green', t('all')) +
      stat(t('today'), money(todayTotal), 'trendingUp', 'info', t('today')) +
      stat(t('cash'), money(cash), 'wallet', 'purple', t('paymentMethod')) +
    '</div>';

    var toolbar = '<div class="card"><div class="card-body" style="padding:12px 14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div class="search-mini" style="flex:1;min-width:200px">' + icon('search') + '<input data-q placeholder="' + esc(t('search')) + ' INV / ' + esc(t('customerLabel')) + '" value="' + esc(state.q) + '"></div>' +
      '<select class="select" data-method style="width:auto;min-width:150px"><option value="">' + esc(t('paymentMethod')) + '</option>' +
        '<option value="cash"' + (state.method === 'cash' ? ' selected' : '') + '>' + esc(t('cash')) + '</option>' +
        '<option value="card"' + (state.method === 'card' ? ' selected' : '') + '>' + esc(t('card')) + '</option>' +
        '<option value="vodafone"' + (state.method === 'vodafone' ? ' selected' : '') + '>' + esc(t('vodafone')) + '</option></select>' +
      '<select class="select" data-range style="width:auto;min-width:130px"><option value="all">' + esc(t('all')) + '</option>' +
        '<option value="1"' + (state.range === '1' ? ' selected' : '') + '>' + esc(t('today')) + '</option>' +
        '<option value="7"' + (state.range === '7' ? ' selected' : '') + '>' + esc(t('last7')) + '</option>' +
        '<option value="30"' + (state.range === '30' ? ' selected' : '') + '>' + esc(t('last30')) + '</option></select>' +
    '</div></div>';

    var table = '<div class="card"><div class="table-wrap flush"><table class="table"><thead><tr>' +
      '<th>' + esc(t('invoice')) + '</th><th>' + esc(t('date')) + '</th><th>' + esc(t('customerLabel')) + '</th>' +
      '<th>' + esc(t('items')) + '</th><th>' + esc(t('paymentMethod')) + '</th><th>' + esc(t('total')) + '</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(function (i) {
        var name = i.customer && i.customer.name ? DS.loc(i.customer, 'name') : (i.cashier_name || t('walkIn'));
        return '<tr data-inv="' + esc(i.id) + '" style="cursor:pointer">' +
          '<td><div class="cell-title" style="font-family:var(--font-mono);direction:ltr;text-align:start;font-size:11px">' + esc(i.invoice_no) + '</div>' +
            (i.order_no ? '<div class="cell-sub" style="direction:ltr;text-align:start">' + esc(i.order_no) + '</div>' : '') + '</td>' +
          '<td>' + esc(DS.datetime(i.created_at)) + '</td>' +
          '<td><div class="cell-title">' + esc(name) + '</div><div class="cell-sub">' + esc(i.cashier_name || '') + '</div></td>' +
          '<td>' + (i.items || []).reduce(function (s, it) { return s + it.qty; }, 0) + '</td>' +
          '<td><span class="badge neutral">' + esc(t(methodOf(i))) + '</span></td>' +
          '<td><b>' + money(totalOf(i)) + '</b></td>' +
          '<td style="text-align:end;white-space:nowrap"><button class="btn btn-ghost btn-sm" data-print="' + esc(i.id) + '">' + icon('printer') + '</button>' +
            '<button class="btn btn-ghost btn-sm" data-view="' + esc(i.id) + '">' + icon('eye') + '</button></td></tr>';
      }).join('') : '<tr><td colspan="7">' + DS.empty({ icon: 'receipt', title: t('noData'), text: t('emptyOrdersText') }) + '</td></tr>') +
      '</tbody></table></div><div class="table-foot"><span>' + esc(t('showing')) + ' ' + list.length + ' ' + esc(t('of')) + ' ' + all.length + ' ' + esc(t('results')) + '</span>' +
      '<b>' + money(list.reduce(function (s, i) { return s + totalOf(i); }, 0)) + '</b></div></div>';

    page.setContent(stats + toolbar + table);
    bind(list);
  }

  /* Print CSS comes from the shared thermal receipt module (ui.js) so the
     invoices page, POS and the print window always match. */
  function ensurePrintStyle() {
    var el = document.getElementById('dsActivePrintStyle');
    if (!el) {
      el = document.createElement('style');
      el.id = 'dsActivePrintStyle';
      document.head.appendChild(el);
    }
    el.textContent = DS.thermalCss + '\n' +
      '@media print {\n' +
      '  .modal-backdrop, .modal, .modal-card, .modal-body, .modal-dialog { position: static !important; transform: none !important; overflow: visible !important; max-height: none !important; background: #ffffff !important; box-shadow: none !important; }\n' +
      '  .invoice-modal-wrapper { display: block !important; padding: 0 !important; background: #ffffff !important; }\n' +
      '}';
  }

  function drawFallbackQr(box, url) {
    if (!box) return;
    box.innerHTML = '<svg viewBox="0 0 80 80" width="80" height="80" style="display:block;">' +
      '<rect width="80" height="80" fill="#fff"/>' +
      '<rect x="6" y="6" width="22" height="22" fill="#000"/><rect x="9" y="9" width="16" height="16" fill="#fff"/><rect x="12" y="12" width="10" height="10" fill="#000"/>' +
      '<rect x="52" y="6" width="22" height="22" fill="#000"/><rect x="55" y="9" width="16" height="16" fill="#fff"/><rect x="58" y="12" width="10" height="10" fill="#000"/>' +
      '<rect x="6" y="52" width="22" height="22" fill="#000"/><rect x="9" y="55" width="16" height="16" fill="#fff"/><rect x="12" y="58" width="10" height="10" fill="#000"/>' +
      '<rect x="34" y="8" width="4" height="4" fill="#000"/><rect x="42" y="8" width="4" height="4" fill="#000"/>' +
      '<rect x="8" y="34" width="4" height="4" fill="#000"/><rect x="8" y="42" width="4" height="4" fill="#000"/>' +
      '<rect x="34" y="34" width="12" height="12" fill="#000"/><rect x="38" y="38" width="4" height="4" fill="#fff"/>' +
      '<rect x="52" y="34" width="4" height="4" fill="#000"/><rect x="60" y="34" width="8" height="4" fill="#000"/>' +
      '<rect x="34" y="52" width="4" height="8" fill="#000"/><rect x="42" y="60" width="8" height="4" fill="#000"/>' +
      '<rect x="56" y="56" width="8" height="8" fill="#000"/><rect x="68" y="52" width="4" height="12" fill="#000"/>' +
      '</svg>';
  }

  function renderQrCodeInto(box, url) {
    if (!box) return;
    box.innerHTML = '';
    function tryQr() {
      if (window.QRCode) {
        try {
          new QRCode(box, {
            text: url,
            width: 88,
            height: 88,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
          return true;
        } catch (e) {
          console.warn('QRCode render error', e);
        }
      }
      return false;
    }
    if (!tryQr()) {
      drawFallbackQr(box, url);
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      s.onload = function () {
        box.innerHTML = '';
        tryQr();
      };
      document.head.appendChild(s);
    }
  }

  function openInvoice(id) {
    var inv = invoices().filter(function (i) { return i.id === id; })[0];
    if (!inv) return;

    var invTenant = DS.data.tenantById(inv.tenant_id) || tenant || {};
    var settings = DS.receiptSettings();
    var storeName = settings.name || DS.loc(invTenant, 'name') || invTenant.name || 'DotStudio POS';
    var orderNo = inv.order_no || inv.invoice_no || '—';
    var trackingUrl = new URL(DS.url('customer/tracking.html?order=' + encodeURIComponent(orderNo)), window.location.href).href;

    ensurePrintStyle();
    var receiptHtml = '<div class="invoice-modal-wrapper">' + DS.thermalInvoice(inv) + '</div>';

    DS.modal({
      title: t('invoice') + ' ' + (inv.invoice_no || ''),
      sub: esc(orderNo) + ' · ' + esc(storeName),
      body: receiptHtml,
      actions: [
        { label: t('close'), variant: 'btn-secondary' },
        {
          label: t('printReceipt'),
          variant: 'btn-primary',
          icon: icon('printer'),
          onClick: function () {
            ensurePrintStyle();
            setTimeout(function () { window.print(); }, 80);
          }
        }
      ],
      onMount: function () {
        renderQrCodeInto(document.getElementById('invoiceQrBox'), trackingUrl);
      }
    });
  }

  function bind(list) {
    var q = page.body.querySelector('[data-q]');
    if (q) q.addEventListener('input', DS.debounce(function () { state.q = q.value; render(); }, 160));
    var method = page.body.querySelector('[data-method]');
    if (method) method.addEventListener('change', function () { state.method = method.value; render(); });
    var range = page.body.querySelector('[data-range]');
    if (range) range.addEventListener('change', function () { state.range = range.value; render(); });
    DS.$$('[data-inv]', page.body).forEach(function (row) {
      row.addEventListener('click', function (e) { if (e.target.closest('button')) return; openInvoice(row.getAttribute('data-inv')); });
    });
    DS.$$('[data-view]', page.body).forEach(function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); openInvoice(b.getAttribute('data-view')); }); });
    DS.$$('[data-print]', page.body).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var inv = list.filter(function (i) { return i.id === b.getAttribute('data-print'); })[0];
        if (inv) DS.printReceipt(inv, 'invoice');
      });
    });
  }

  var refresh = page.root.querySelector('[data-refresh]');
  if (refresh) refresh.addEventListener('click', function () { render(); DS.toast(t('updated'), 'success'); });
  var exportBtn = page.root.querySelector('[data-export]');
  if (exportBtn) exportBtn.addEventListener('click', function () {
    var rows = [['Invoice', 'Order', 'Date', 'Customer', 'Cashier', 'Items', 'Method', 'Subtotal', 'Discount', 'Total']];
    filtered().forEach(function (i) {
      rows.push([i.invoice_no, i.order_no || '', i.created_at, i.customer ? DS.loc(i.customer, 'name') : (i.cashier_name || ''), i.cashier_name || '', (i.items || []).length, methodOf(i), i.subtotal, i.discount || 0, totalOf(i)]);
    });
    DS.download('dotstudio-invoices.csv', DS.csv(rows));
    DS.toast(t('saved'), 'success');
  });

  render();
})();
