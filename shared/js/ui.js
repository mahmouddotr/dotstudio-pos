/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — UI KIT
   Order details modal, product editor, charts, tracking map,
   receipt printing and shared card helpers.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before ui.js'); return; }

  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url, money = DS.money;

  function orderById(id) {
    if (!DS.data) return null;
    var user = DS.session();
    var list = DS.data.visibleOrders(user);
    return list.filter(function (o) { return o.id === id || o.order_no === id; })[0] || null;
  }

  /* ────────────────────────── ORDER DETAILS ──────────────────────── */
  var STATUS_ACTIONS = {
    pending: { next: 'preparing', labelKey: 'startPreparing', variant: 'btn-primary', icon: 'check' },
    confirmed: { next: 'preparing', labelKey: 'startPreparing', variant: 'btn-primary', icon: 'check' },
    preparing: { next: 'handed_to_company', labelKey: 'handToCompany', variant: 'btn-primary', icon: 'truck' },
    /* Store work ends here. Only the delivery company can move on. */
    handed_to_company: null,
    out_for_delivery: { next: 'delivered', labelKey: 'markDelivered', variant: 'btn-success', icon: 'checkCircle', proof: true }
  };

  /* Who may advance an order at each step. */
  function canAdvanceOrder(user, order) {
    if (!user || !order) return false;
    if (user.role === 'superadmin' || user.role === 'subadmin') return true;
    var store = (user.role === 'owner' || user.role === 'cashier') && user.tenant_id && DS.data.orderHasTenant(order, user.tenant_id);
    if (order.status === 'out_for_delivery') return user.role === 'delivery' || user.role === 'driver';
    return store;
  }

  /* Delivery cannot be completed without a proof photo (driver requirement). */
  function openProofUpload(order, after) {
    DS.modal({
      title: t('proofUpload'),
      sub: order.order_no + ' · ' + (order.customer ? DS.loc(order.customer, 'name') : ''),
      body: '<div class="field"><label>' + esc(t('proof')) + ' *</label>' +
          '<label style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px dashed var(--border-strong);border-radius:var(--radius-lg);padding:26px;background:var(--surface-2);cursor:pointer;text-align:center">' +
            '<span style="width:48px;height:48px;border-radius:13px;background:var(--lime-soft);color:var(--success);display:grid;place-items:center">' + icon('image') + '</span>' +
            '<b style="font-size:13px">' + esc(t('uploadImage')) + '</b><span style="font-size:11px;color:var(--text-tertiary)">PNG / JPG · ≤ 800KB</span>' +
            '<input type="file" id="proofPhoto" accept="image/*" capture="environment" hidden></label>' +
          '<div data-proof-preview style="margin-top:10px;display:none"><img alt="proof" style="width:100%;max-height:220px;object-fit:cover;border-radius:var(--radius-md);border:1px solid var(--border)"></div>' +
          '<p style="font-size:11px;color:var(--text-tertiary);margin-top:8px">' + esc(t('proofRequired')) + '</p></div>',
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('markDelivered'), variant: 'btn-success', icon: icon('checkCircle'), onClick: function (root) {
            var img = root.querySelector('[data-proof-preview] img');
            var src = img ? img.getAttribute('src') : '';
            if (!src) { DS.toast(t('proofRequired'), 'error'); return false; }
            var res = DS.data.updateOrderStatus(order.id, 'delivered', { proof: src, driver_name: order.driver_name });
            if (!res) { DS.toast(t('error'), 'error'); return false; }
            DS.toast(t('orderDeliveredMsg'), 'success');
            window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: order.id } }));
            if (after) setTimeout(after, 160);
            return true;
          } }
      ],
      onMount: function (root) {
        var input = root.querySelector('#proofPhoto');
        if (!input) return;
        input.addEventListener('change', function () {
          var f = input.files && input.files[0];
          if (!f) return;
          if (f.size > 800 * 1024) { DS.toast('≤ 800KB', 'error'); input.value = ''; return; }
          var r = new FileReader();
          r.onload = function (ev) {
            var box = root.querySelector('[data-proof-preview]');
            box.style.display = '';
            box.querySelector('img').src = ev.target.result;
          };
          r.readAsDataURL(f);
        });
      }
    });
  }

  function timelineMarkup(order) {
    var flow = DS.statusFlow;
    var events = order.timeline || [];
    var currentIdx = order.status === 'cancelled' ? -1 : flow.indexOf(order.status);
    return '<div class="timeline">' + flow.map(function (s, i) {
      var ev = events.filter(function (e) { return e.status === s; })[0];
      var done = currentIdx > i || order.status === 'delivered' || (!!ev && currentIdx !== -1);
      var current = currentIdx === i && order.status !== 'delivered';
      var meta = DS.statusMeta(s);
      return '<div class="timeline-step' + (done || current ? ' done' : '') + (current ? ' current' : '') + '">' +
        '<div class="timeline-dot">' + icon(meta.icon) + '</div>' +
        '<div class="timeline-info"><b>' + esc(meta.label) + '</b><span>' + (ev ? esc(DS.datetime(ev.at)) : '—') + '</span></div></div>';
    }).join('') +
    (order.status === 'cancelled' ? '<div class="timeline-step current"><div class="timeline-dot" style="background:var(--danger);border-color:var(--danger);color:#fff">' + icon('x') + '</div><div class="timeline-info"><b>' + esc(t('cancelled')) + '</b><span>' + esc(DS.datetime(order.updated_at)) + '</span></div></div>' : '') +
    '</div>';
  }

  function orderBody(order) {
    var user = DS.session() || {};
    var meta = DS.statusMeta(order.status);
    var tenant = DS.data.tenantById(order.tenant_id);
    var itemsHtml = (order.items || []).map(function (it) {
      return '<div class="order-item-row"><img src="' + esc(DS.data.img(it.image)) + '" alt="" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'">' +
        '<div class="info"><div class="nm">' + esc(DS.lang() === 'en' ? (it.name_en || it.name) : it.name) + '</div>' +
        '<div class="qt">' + esc(t('quantity')) + ': ' + it.qty + ' × ' + money(it.price) + '</div></div>' +
        '<div class="pr">' + money(it.price * it.qty) + '</div></div>';
    }).join('');

    var proof = order.proof && order.proof.url
      ? '<div class="proof-box"><img src="' + esc(order.proof.url) + '" alt="proof" data-proof-img><div class="info"><b>' + esc(t('proof')) + '</b><span>' + esc(DS.datetime(order.proof.at)) + ' · ' + esc(order.proof.by || '') + '</span></div>' +
        '<a class="btn btn-secondary btn-sm" href="' + esc(order.proof.url) + '" target="_blank" rel="noopener">' + icon('eye') + '</a></div>'
      : '<div class="proof-box" style="border-style:dashed"><div class="empty-icon" style="width:40px;height:40px;border-radius:10px;margin:0">' + icon('image') + '</div><div class="info"><b>' + esc(t('noProof')) + '</b><span>' + esc(t('proof')) + '</span></div></div>';

    return '<div class="order-details-grid" style="margin-bottom:14px">' +
        '<div class="order-detail-box"><div class="l">' + esc(t('orderId')) + '</div><div class="v" style="font-family:var(--font-mono);direction:ltr">' + esc(order.order_no) + '</div></div>' +
        '<div class="order-detail-box"><div class="l">' + esc(t('status')) + '</div><div class="v">' + DS.badge(order.status, meta.label) + '</div></div>' +
        '<div class="order-detail-box"><div class="l">' + esc(t('store')) + '</div><div class="v">' + esc(tenant ? tenant.name : '—') + '</div></div>' +
        '<div class="order-detail-box"><div class="l">' + esc(t('date')) + '</div><div class="v">' + esc(DS.datetime(order.created_at)) + '</div></div>' +
      '</div>' +
      '<div class="two-col even" style="gap:14px"><div>' +
        '<div class="section-title" style="font-size:var(--fs-md);margin-bottom:4px">' + icon('box') + esc(t('items')) + '</div>' +
        '<div class="order-items">' + itemsHtml + '</div>' +
        '<div class="cart-summary" style="margin-top:12px">' +
          '<div class="cart-row"><span>' + esc(t('subtotal')) + '</span><span>' + money(order.subtotal) + '</span></div>' +
          (order.discount ? '<div class="cart-row"><span>' + esc(t('discount')) + '</span><span style="color:var(--success)">− ' + money(order.discount) + '</span></div>' : '') +
          '<div class="cart-row"><span>' + esc(t('delivery')) + '</span><span>' + money(order.delivery_fee) + '</span></div>' +
          '<div class="cart-row total"><span>' + esc(t('total')) + '</span><span class="num">' + money(order.total) + '</span></div>' +
        '</div>' +
      '</div><div>' +
        '<div class="section-title" style="font-size:var(--fs-md);margin-bottom:8px">' + icon('user') + esc(t('customerInfo')) + '</div>' +
        '<div class="order-detail-box" style="margin-bottom:10px"><div class="l">' + esc(t('customerName')) + '</div><div class="v">' + esc(order.customer ? (DS.lang() === 'en' ? (order.customer.name_en || order.customer.name) : order.customer.name) : '—') + '</div>' +
          '<div class="l" style="margin-top:8px">' + esc(t('phone')) + '</div><div class="v" style="direction:ltr;text-align:start">' + esc(order.customer ? order.customer.phone : '—') + '</div>' +
          '<div class="l" style="margin-top:8px">' + esc(t('address')) + '</div><div class="v" style="font-weight:500;color:var(--text-secondary)">' + esc(order.customer ? order.customer.address : '—') + '</div></div>' +
        '<div class="order-details-grid">' +
          '<div class="order-detail-box"><div class="l">' + esc(t('paymentMethod')) + '</div><div class="v">' + esc(t(order.payment_method || 'cash')) + '</div></div>' +
          '<div class="order-detail-box"><div class="l">' + esc(t('deliveryCompany')) + '</div><div class="v">' + esc(order.delivery_company_name || t('noCompany')) + '</div></div>' +
        '</div>' +
        '<div class="order-detail-box" style="margin-top:10px"><div class="l">' + esc(t('driver')) + '</div><div class="v">' +
          esc(order.driver_name || t('noDriverAssigned')) +
          (order.driver_id && DS.data.userById ? (function () {
            var dv = DS.data.userById(order.driver_id);
            return dv && dv.phone ? '<span style="display:block;direction:ltr;text-align:start;font-size:11px;color:var(--text-tertiary);font-weight:500">' + esc(dv.phone) + '</span>' : '';
          })() : '') +
        '</div></div>' +
        '<div style="margin-top:12px">' + proof + '</div>' +
        '<div class="section-title" style="font-size:var(--fs-md);margin:14px 0 8px">' + icon('activity') + esc(t('timeline')) + '</div>' +
        timelineMarkup(order) +
      '</div></div>';
  }

  function openOrderEditor(order) {
    var EN = DS.lang() === 'en';
    var statuses = ['pending', 'preparing', 'handed_to_company', 'out_for_delivery', 'delivered', 'cancelled'].filter(function (s) {
      if (s === order.status) return true;
      if (!DS.data.canTransition(order.status, s)) return false;
      return !DS.data.canTransitionForUser || DS.data.canTransitionForUser(DS.session(), order, s);
    });
    var sub = Number(order.subtotal) || 0;
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(t('status')) + '</label><select class="select" id="oeStatus">' +
        statuses.map(function (s) { return '<option value="' + s + '"' + (s === order.status ? ' selected' : '') + '>' + esc(DS.statusMeta(s).label) + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="field"><label>' + esc(t('discount')) + ' (EGP)</label><input class="input" id="oeDiscount" type="number" min="0" step="1" dir="ltr" value="' + esc(Number(order.discount) || 0) + '"></div>' +
      '<div class="field"><label>' + esc(t('delivery')) + ' (EGP)</label><input class="input" id="oeFee" type="number" min="0" step="1" dir="ltr" value="' + esc(Number(order.delivery_fee) || 0) + '"></div>' +
      '<div class="field"><label>' + esc(t('subtotal')) + '</label><input class="input" value="' + esc(money(sub)) + '" disabled></div>' +
      '<div class="field" style="grid-column:1/-1"><label>' + esc(t('notes')) + '</label><textarea class="textarea" id="oeNotes" rows="2">' + esc(order.notes || '') + '</textarea></div>' +
    '</div>' +
    '<div class="cart-summary" style="margin-top:12px"><div class="cart-row total"><span>' + esc(t('total')) + '</span><b class="num" data-oe-total>' + money(order.total) + '</b></div></div>';
    DS.modal({
      size: 'md',
      title: icon('edit') + ' ' + esc(EN ? 'Edit order' : 'تعديل الطلب'),
      sub: esc(order.order_no),
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('saveChanges'), variant: 'btn-primary', icon: icon('check'), onClick: function (root) {
          var disc = Math.max(0, Number(root.querySelector('#oeDiscount').value) || 0);
          var fee = Math.max(0, Number(root.querySelector('#oeFee').value) || 0);
          if (disc > sub) { DS.toast(EN ? 'Discount cannot exceed the subtotal' : 'الخصم أكبر من المجموع', 'error'); return false; }
          var status = root.querySelector('#oeStatus').value;
          var res = DS.data.updateOrder(order.id, {
            status: status, discount: disc, delivery_fee: fee,
            notes: root.querySelector('#oeNotes').value.trim()
          });
          if (!res) { DS.toast(EN ? 'This status transition is not allowed' : 'هذا الانتقال في الحالة غير مسموح', 'error'); return false; }
          DS.toast(t('updated'), 'success');
          window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: order.id } }));
          return true;
        } }
      ],
      onMount: function (root) {
        function recalc() {
          var disc = Math.max(0, Number(root.querySelector('#oeDiscount').value) || 0);
          var fee = Math.max(0, Number(root.querySelector('#oeFee').value) || 0);
          var el = root.querySelector('[data-oe-total]');
          if (el) el.textContent = money(Math.max(0, sub - disc + fee));
        }
        root.querySelector('#oeDiscount').addEventListener('input', recalc);
        root.querySelector('#oeFee').addEventListener('input', recalc);
      }
    });
  }

  function openAssignDriver(order) {
    var user = DS.session() || {};
    var EN = DS.lang() === 'en';
    var riders = (DS.data.companyDrivers ? DS.data.companyDrivers(user.delivery_company) : []).filter(function (u) {
      return DS.data.isRider(u) && u.is_active !== false;
    });
    if (!riders.length) {
      DS.toast(EN ? 'Add a rider first.' : 'أضف مندوباً أولاً.', 'warning');
      return;
    }
    var body = '<div class="assign-driver-glass">' +
      '<div class="assign-driver-head"><span class="assign-driver-ico">' + icon('bike') + '</span>' +
        '<div><b>' + esc(order.order_no) + '</b><span>' + esc(order.customer ? DS.loc(order.customer, 'name') : '') + '</span></div>' +
        DS.badge(order.status, DS.statusMeta(order.status).label) + '</div>' +
      '<div class="field" style="margin-top:14px"><label>' + esc(t('assignDriver')) + '</label>' +
        '<select class="select assign-driver-select" data-assign-driver>' +
          '<option value="">' + esc(t('noDriverAssigned')) + '</option>' +
          riders.map(function (d) {
            return '<option value="' + esc(d.id) + '"' + (order.driver_id === d.id ? ' selected' : '') + '>' +
              esc(DS.loc(d, 'name')) + (d.phone ? ' · ' + esc(d.phone) : '') + (d.online === false ? ' · ' + esc(t('offline')) : '') + '</option>';
          }).join('') +
        '</select></div>' +
      '<p class="assign-driver-hint">' + esc(t('assignDriverHint')) + '</p></div>';
    DS.modal({
      size: 'sm',
      title: icon('userPlus') + ' ' + esc(t('assignDriver')),
      sub: esc(order.order_no),
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('save'), variant: 'btn-primary', icon: icon('check'), onClick: function (root) {
            var sel = root.querySelector('[data-assign-driver]');
            var driverId = sel ? sel.value : '';
            if (!driverId) { DS.toast(t('noDriverAssigned'), 'error'); return false; }
            var res = DS.data.assignOrder(order.id, driverId);
            if (!res) { DS.toast(t('noPermission'), 'error'); return false; }
            DS.toast(t('driverAssigned'), 'success');
            window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: order.id } }));
            setTimeout(function () { openOrder(order.id); }, 180);
            return true;
          } }
      ]
    });
  }

  function openOrder(id) {
    var order = orderById(id);
    if (!order) { DS.toast(t('noData'), 'error'); return; }
    var user = DS.session() || {};
    var actions = [];
    var isRider = DS.data.isRider ? DS.data.isRider(user) : (user.role === 'delivery' || user.role === 'driver');
    var isCompanyOwner = DS.data.isCompanyOwner ? DS.data.isCompanyOwner(user) : false;
    var canAdvance = canAdvanceOrder(user, order);
    var flow = STATUS_ACTIONS[order.status];
    /* Delivered belongs exclusively to the rider assigned to this order. */
    if (flow && flow.proof && (!isRider || order.driver_id !== user.id)) flow = null;
    if (!canAdvance) flow = null;
    if (flow) {
      actions.push({
        label: t(flow.labelKey), variant: flow.variant, icon: icon(flow.icon),
        onClick: function () {
          if (flow.proof) {
            openProofUpload(order, function () { openOrder(order.id); });
            return;
          }
          var res = DS.data.updateOrderStatus(order.id, flow.next, { driver_name: order.driver_name || user.name });
          if (!res) { DS.toast(t('noPermission'), 'error'); return; }
          DS.toast(t('statusUpdated'), 'success');
          window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: order.id } }));
          setTimeout(function () { openOrder(order.id); }, 120);
        }
      });
    }
    /* Delivery company owner: assign a rider once the store handed the order. */
    if (isCompanyOwner && order.status === 'handed_to_company' && order.delivery_company_id === user.delivery_company) {
      actions.push({
        label: t('assignDriver'), variant: 'btn-primary', icon: icon('userPlus'),
        onClick: function (root, close) {
          close();
          setTimeout(function () { openAssignDriver(order); }, 140);
          return false;
        }
      });
    }
    /* Assigned rider (or the company dispatching) starts the live route. */
    if (order.status === 'handed_to_company' && order.driver_id && (isCompanyOwner || order.driver_id === user.id)) {
      actions.push({
        label: t('startDelivery'), variant: 'btn-primary', icon: icon('bike'),
        onClick: function () {
          var res = DS.data.updateOrderStatus(order.id, 'out_for_delivery', { driver_id: order.driver_id, driver_name: order.driver_name });
          if (!res) { DS.toast(t('noPermission'), 'error'); return; }
          DS.toast(t('statusUpdated'), 'success');
          window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: order.id } }));
          setTimeout(function () { openOrder(order.id); }, 120);
        }
      });
    }
    if (canAdvance && ['pending', 'preparing', 'handed_to_company'].indexOf(order.status) > -1 && !isRider) {
      actions.push({
        label: t('cancelled'), variant: 'btn-danger', icon: icon('x'),
        onClick: function () {
          DS.confirm({ title: t('confirm'), text: t('confirmDeleteText'), danger: true }).then(function (ok) {
            if (!ok) return;
            var res = DS.data.updateOrderStatus(order.id, 'cancelled');
            if (!res) { DS.toast(t('noPermission'), 'error'); return; }
            DS.toast(t('orderCancelled'), 'warning');
            window.dispatchEvent(new CustomEvent('ds:order-updated', { detail: { id: order.id } }));
          });
        }
      });
    }
    /* Admin / owner can edit the discount, delivery fee, notes and status. */
    if ((user.role === 'superadmin' || user.role === 'subadmin' || user.role === 'owner') && DS.data.updateOrder) {
      actions.push({
        label: DS.lang() === 'en' ? 'Edit order' : 'تعديل الطلب', variant: 'btn-secondary', icon: icon('edit'),
        onClick: function (root, close) {
          close();
          setTimeout(function () { openOrderEditor(order); }, 140);
          return false;
        }
      });
    }
    actions.push({ label: t('close'), variant: 'btn-secondary' });

    DS.modal({
      size: 'lg',
      title: esc(order.order_no) + ' ' + DS.badge(order.status),
      sub: (order.customer ? order.customer.name : '') + ' · ' + DS.datetime(order.created_at),
      body: orderBody(order),
      actions: actions,
      onMount: function (root) {
        var img = root.querySelector('[data-proof-img]');
        if (img) img.addEventListener('click', function () {
          DS.modal({ size: 'lg', title: t('proof'), body: '<img src="' + esc(order.proof.url) + '" alt="proof" style="width:100%;border-radius:var(--radius-md)">', actions: [{ label: t('close'), variant: 'btn-secondary' }] });
        });
      }
    });
  }
  DS.openOrder = openOrder;

  /* ────────────────────────── PRODUCT EDITOR ─────────────────────── */
  function productModal(opts) {
    opts = opts || {};
    var user = DS.session() || {};
    var tenantId = opts.tenantId || user.tenant_id || DS.data.currentStoreId(user);
    var product = opts.product || null;
    var tenantProducts = DS.data.products.filter(function (p) { return p.tenant_id === tenantId; });
    var images = [];
    tenantProducts.forEach(function (p) { if (p.image && images.indexOf(p.image) === -1) images.push(p.image); });
    var selectedImage = product ? product.image : (images[0] || '');
    var categories = [];
    tenantProducts.forEach(function (p) { if (p.category && categories.indexOf(p.category) === -1) categories.push(p.category); });

    var body =
      '<div class="field-grid">' +
        '<div class="field"><label>' + esc(t('name')) + ' *</label><input class="input" id="pName" value="' + esc(product ? product.name : '') + '" placeholder="' + esc(t('name')) + '"></div>' +
        '<div class="field"><label>Name (EN)</label><input class="input" id="pNameEn" value="' + esc(product ? (product.name_en || '') : '') + '" placeholder="English name"></div>' +
        '<div class="field"><label>' + esc(t('category')) + '</label><input class="input" id="pCat" list="pCats" value="' + esc(product ? product.category : '') + '"><datalist id="pCats">' + categories.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>' +
        '<div class="field"><label>SKU</label><input class="input" id="pSku" value="' + esc(product ? (product.sku || '') : ('SKU-' + Date.now().toString(36).toUpperCase())) + '" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(t('price')) + ' *</label><input class="input" id="pPrice" type="number" min="0" step="1" value="' + esc(product ? product.price : '') + '"></div>' +
        '<div class="field"><label>Cost</label><input class="input" id="pCost" type="number" min="0" step="1" value="' + esc(product ? (product.cost || 0) : '') + '"></div>' +
        '<div class="field"><label>' + esc(t('stock')) + '</label><input class="input" id="pStock" type="number" min="0" step="1" value="' + esc(product ? product.stock : 10) + '"></div>' +
        '<div class="field"><label>' + esc(t('lowStock')) + '</label><input class="input" id="pMin" type="number" min="0" step="1" value="' + esc(product ? (product.min_stock || 5) : 5) + '"></div>' +
      '</div>' +
      '<div class="field" style="margin-top:12px"><label>' + esc(t('image')) + '</label>' +
        '<div class="image-picker" id="pImages">' + images.map(function (src) {
          return '<button type="button" class="image-pick' + (src === selectedImage ? ' selected' : '') + '" data-img="' + esc(src) + '"><img src="' + esc(DS.data.img(src)) + '" alt=""></button>';
        }).join('') + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:8px;align-items:center"><input class="input" id="pImage" value="' + esc(selectedImage) + '" placeholder="products/... or https://" style="direction:ltr">' +
        '<label class="btn btn-secondary btn-sm" style="flex-shrink:0">' + icon('upload') + esc(t('uploadImage')) + '<input type="file" id="pUpload" accept="image/*" hidden></label></div>' +
      '</div>' +
      '<label class="check" style="margin-top:12px;display:flex"><input type="checkbox" id="pActive" ' + (!product || product.is_active !== false ? 'checked' : '') + '><span>' + esc(t('active')) + '</span></label>' +
      '<div class="field-grid" style="margin-top:8px">' +
        '<label class="check" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:12px"><input type="checkbox" id="pFeatured" ' + (product && product.featured ? 'checked' : '') + '><span>' + esc(DS.lang() === 'en' ? '⭐ Featured (Top Rated)' : '⭐ مميز (الأعلى تقييماً)') + '</span></label>' +
        '<label class="check" style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid var(--border);border-radius:12px"><input type="checkbox" id="pBest" ' + (product && product.best_seller ? 'checked' : '') + '><span>' + esc(DS.lang() === 'en' ? '🔥 Best seller' : '🔥 الأكثر مبيعاً') + '</span></label>' +
      '</div>';

    var m = DS.modal({
      size: 'lg',
      title: product ? t('editProduct') : t('addProduct'),
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('save'), variant: 'btn-primary', icon: icon('check'), onClick: function (root) {
            var name = root.querySelector('#pName').value.trim();
            var price = Number(root.querySelector('#pPrice').value);
            if (!name) { DS.toast(t('required'), 'error'); return false; }
            if (!price || price < 0) { DS.toast(t('required'), 'error'); return false; }
            var data = {
              name: name,
              name_en: root.querySelector('#pNameEn').value.trim() || name,
              category: root.querySelector('#pCat').value.trim() || (DS.lang() === 'en' ? 'General' : 'عام'),
              sku: root.querySelector('#pSku').value.trim(),
              price: price,
              cost: Number(root.querySelector('#pCost').value) || 0,
              stock: Number(root.querySelector('#pStock').value) || 0,
              min_stock: Number(root.querySelector('#pMin').value) || 0,
              image: root.querySelector('#pImage').value.trim() || selectedImage,
              tenant_id: tenantId,
              is_active: root.querySelector('#pActive').checked,
              featured: root.querySelector('#pFeatured').checked,
              best_seller: root.querySelector('#pBest').checked
            };
            if (product) DS.data.updateProduct(product.id, data);
            else DS.data.addProduct(data);
            DS.toast(t('productSaved'), 'success');
            window.dispatchEvent(new CustomEvent('ds:data-changed'));
            if (opts.onSave) opts.onSave();
            return true;
          } }
      ],
      onMount: function (root) {
        root.querySelectorAll('[data-img]').forEach(function (b) {
          b.addEventListener('click', function () {
            root.querySelectorAll('[data-img]').forEach(function (x) { x.classList.remove('selected'); });
            b.classList.add('selected');
            selectedImage = b.getAttribute('data-img');
            root.querySelector('#pImage').value = selectedImage;
          });
        });
        var up = root.querySelector('#pUpload');
        up.addEventListener('change', function () {
          var f = up.files && up.files[0];
          if (!f) return;
          if (f.size > 500 * 1024) { DS.toast('≤ 500KB', 'error'); return; }
          var r = new FileReader();
          r.onload = function (ev) {
            selectedImage = ev.target.result;
            root.querySelector('#pImage').value = selectedImage;
            root.querySelectorAll('[data-img]').forEach(function (x) { x.classList.remove('selected'); });
          };
          r.readAsDataURL(f);
        });
      }
    });
    return m;
  }
  DS.productModal = productModal;

  /* ───────────────────────────── CHARTS ──────────────────────────── */
  function areaChart(series, opts) {
    opts = opts || {};
    var w = 620, h = 200, padX = 8, padTop = 14, padBottom = 26;
    var values = series.map(function (s) { return Number(s.value) || 0; });
    var max = Math.max.apply(null, values.concat([1]));
    var min = 0;
    var innerW = w - padX * 2;
    var innerH = h - padTop - padBottom;
    var step = series.length > 1 ? innerW / (series.length - 1) : innerW;
    function pt(i, v) {
      return [padX + i * step, padTop + innerH - ((v - min) / (max - min || 1)) * innerH];
    }
    var pts = values.map(function (v, i) { return pt(i, v); });
    var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    var area = line + ' L' + (padX + innerW) + ' ' + (h - padBottom) + ' L' + padX + ' ' + (h - padBottom) + ' Z';
    var grid = '';
    for (var g = 0; g <= 3; g++) {
      var y = padTop + (innerH / 3) * g;
      grid += '<line x1="' + padX + '" y1="' + y + '" x2="' + (w - padX) + '" y2="' + y + '" stroke="var(--border-soft)" stroke-width="1" stroke-dasharray="3 3"/>';
    }
    var dots = pts.map(function (p, i) {
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="var(--lime)" stroke="var(--bg)" stroke-width="2"><title>' + esc(series[i].label + ' · ' + money(series[i].value)) + '</title></circle>';
    }).join('');
    var labels = series.map(function (s, i) {
      return '<span style="position:absolute;left:' + ((i + 0.5) / series.length * 100) + '%;transform:translateX(-50%);bottom:0;font-size:9px;color:var(--text-tertiary);white-space:nowrap">' + esc(s.label) + '</span>';
    }).join('');
    return '<div class="chart-box"><svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img">' +
      '<defs><linearGradient id="dsArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#82FF1F" stop-opacity=".30"/><stop offset="1" stop-color="#82FF1F" stop-opacity="0"/></linearGradient></defs>' +
      grid + '<path d="' + area + '" fill="url(#dsArea)"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--lime)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      dots + '</svg><div style="position:absolute;inset:0;pointer-events:none">' + labels + '</div></div>';
  }

  function barChart(items, opts) {
    opts = opts || {};
    if (!items || !items.length) return '<div class="text-muted" style="font-size:12px">' + esc(t('noData')) + '</div>';
    var max = Math.max.apply(null, items.map(function (x) { return x.value || 0; }).concat([1]));
    return '<div style="display:flex;flex-direction:column;gap:13px">' + items.map(function (it, i) {
      return '<div><div style="display:flex;justify-content:space-between;gap:10px;font-size:12px;margin-bottom:5px"><span style="font-weight:600">' + esc(it.label) + '</span><span style="color:var(--text-tertiary)">' + esc(it.display || money(it.value)) + '</span></div>' +
        '<div class="progress' + (i === 0 ? ' green' : '') + '"><div class="progress-bar" style="width:' + Math.max(4, (it.value / max) * 100) + '%"></div></div></div>';
    }).join('') + '</div>';
  }

  function donut(items, opts) {
    opts = opts || {};
    var colors = ['#82FF1F', '#64D2FF', '#BF5AF2', '#FF9F0A', '#30D158', '#FF453A'];
    var total = items.reduce(function (s, x) { return s + (Number(x.value) || 0); }, 0) || 1;
    var r = 54, c = 2 * Math.PI * r, offset = 0;
    var arcs = items.map(function (it, i) {
      var frac = (Number(it.value) || 0) / total;
      var seg = '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + colors[i % colors.length] + '" stroke-width="18" stroke-dasharray="' + (frac * c) + ' ' + (c - frac * c) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 70 70)" stroke-linecap="butt"/>';
      offset += frac * c;
      return seg;
    }).join('');
    var legend = items.map(function (it, i) {
      return '<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--text-secondary);margin-bottom:7px"><i style="width:8px;height:8px;border-radius:2px;background:' + colors[i % colors.length] + ';display:inline-block"></i><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(it.label) + '</span><b style="color:var(--text-primary)">' + Math.round((it.value / total) * 100) + '%</b></div>';
    }).join('');
    return '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap"><div style="position:relative;width:140px;height:140px;flex-shrink:0"><svg viewBox="0 0 140 140" width="140" height="140">' +
      '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="var(--surface-3)" stroke-width="18"/>' + arcs +
      '<text x="70" y="66" text-anchor="middle" font-size="18" font-weight="700" fill="var(--text-primary)" font-family="Inter,sans-serif">' + (opts.center || items.length) + '</text>' +
      '<text x="70" y="84" text-anchor="middle" font-size="9" fill="var(--text-tertiary)">' + esc(opts.label || '') + '</text></svg></div>' +
      '<div style="flex:1;min-width:140px">' + legend + '</div></div>';
  }

  DS.chart = { area: areaChart, bars: barChart, donut: donut };

  /* ──────────────────────────── TRACKING MAP ─────────────────────── */
  function mapMarkup(opts) {
    opts = opts || {};
    var progress = opts.progress == null ? 55 : opts.progress;
    var svg =
      '<svg class="map-svg" viewBox="0 0 800 480" preserveAspectRatio="xMidYMid slice">' +
        '<rect width="800" height="480" fill="#0D1117"/>' +
        '<g stroke="#1C2530" stroke-width="1">' +
          '<path d="M0 60h800M0 140h800M0 220h800M0 300h800M0 380h800M80 0v480M200 0v480M320 0v480M440 0v480M560 0v480M680 0v480"/>' +
        '</g>' +
        '<g fill="#121A22">' +
          '<rect x="20" y="20" width="120" height="70" rx="4"/><rect x="220" y="30" width="150" height="90" rx="4"/>' +
          '<rect x="500" y="20" width="100" height="100" rx="4"/><rect x="650" y="70" width="120" height="50" rx="4"/>' +
          '<rect x="30" y="180" width="90" height="100" rx="4"/><rect x="240" y="170" width="100" height="70" rx="4"/>' +
          '<rect x="470" y="170" width="110" height="90" rx="4"/><rect x="660" y="190" width="110" height="60" rx="4"/>' +
          '<rect x="20" y="330" width="140" height="100" rx="4"/><rect x="230" y="330" width="120" height="90" rx="4"/>' +
          '<rect x="500" y="330" width="140" height="100" rx="4"/><rect x="690" y="340" width="90" height="80" rx="4"/>' +
        '</g>' +
        '<g fill="#16212B" opacity=".7"><circle cx="360" cy="90" r="26"/><circle cx="610" cy="280" r="34"/><circle cx="150" cy="260" r="20"/></g>' +
        '<path id="dsRoute" d="M140 380 C 250 360, 300 300, 400 280 S 560 220, 660 130" fill="none" stroke="#82FF1F" stroke-opacity=".35" stroke-width="7" stroke-linecap="round"/>' +
        '<path d="M140 380 C 250 360, 300 300, 400 280 S 560 220, 660 130" fill="none" stroke="#82FF1F" stroke-width="2.4" stroke-dasharray="7 7" stroke-linecap="round"/>' +
      '</svg>';
    var pctX = 17 + (progress / 100) * 52;
    var pctY = 79 - (progress / 100) * 50;
    return '<div class="map-card" style="height:' + (opts.height || 340) + 'px" data-map>' + svg +
      '<div class="map-pin store" style="left:17.5%;top:79%"><div class="pin">' + icon('store') + '</div><div class="lbl">' + esc(opts.storeLabel || t('store')) + '</div></div>' +
      '<div class="map-pin customer" style="left:82.5%;top:27%"><div class="pin">' + icon('home') + '</div><div class="lbl">' + esc(opts.customerLabel || t('customerLabel')) + '</div></div>' +
      '<div class="moto-marker' + (opts.animate ? '' : ' static') + '" data-moto style="left:' + pctX + '%;top:' + pctY + '%">' + icon('bike') + '</div>' +
      '<div class="map-badge"><span class="dot"></span>' + esc(opts.badge || t('live')) + '</div>' +
      '<div class="map-eta"><div class="lbl">' + esc(t('eta')) + '</div><div class="val" data-eta>' + esc(opts.etaText || ((opts.eta || 12) + ' ' + (DS.lang() === 'ar' ? 'دقيقة' : 'min'))) + '</div><div class="sub" data-distance>' + esc(opts.distanceText || ((opts.distance || '2.0') + ' ' + (DS.lang() === 'ar' ? 'كم' : 'km'))) + '</div></div>' +
      (opts.legend === false ? '' : '<div class="map-legend"><span><i style="background:#82FF1F"></i>' + esc(t('store')) + '</span><span><i style="background:#fff"></i>' + esc(t('customerLabel')) + '</span><span><i style="background:#64D2FF"></i>' + esc(t('driver')) + '</span></div>') +
      '</div>';
  }
  function mapMount(el, opts) {
    if (!el) return null;
    el.innerHTML = mapMarkup(opts);
    var moto = el.querySelector('[data-moto]');
    var eta = el.querySelector('[data-eta]');
    var dist = el.querySelector('[data-distance]');
    var progress = opts && opts.progress != null ? opts.progress : 55;
    return {
      update: function (p, extra) {
        progress = Math.max(0, Math.min(100, p));
        var x = 17 + (progress / 100) * 52;
        var y = 79 - (progress / 100) * 50;
        if (moto) { moto.style.left = x + '%'; moto.style.top = y + '%'; }
        if (eta && extra && extra.eta != null) eta.textContent = extra.eta + ' ' + (DS.lang() === 'ar' ? 'دقيقة' : 'min');
        if (dist && extra && extra.distance != null) dist.textContent = extra.distance + ' ' + (DS.lang() === 'ar' ? 'كم' : 'km');
      }
    };
  }
  DS.map = { markup: mapMarkup, mount: mapMount };

  /* ──────────────────────────── RECEIPT ──────────────────────────── */
  /* Shared 80 mm thermal receipt. Both the on-screen paper (invoices
     page / POS) and the standalone print window render the exact same
     `.invoice-print-area` markup, so what you see is what prints. */
  function receiptSettings() {
    function read(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
    return { name: read('store_name', ''), footer: read('footer_text', ''), logo: read('store_logo', '') };
  }
  DS.receiptSettings = receiptSettings;

  function receiptTrackingUrl(no) {
    try {
      return new URL(DS.url('customer/tracking.html?order=' + encodeURIComponent(no)), window.location.href).href;
    } catch (e) {
      return DS.url('customer/tracking.html?order=' + encodeURIComponent(no));
    }
  }

  function absoluteUrl(path) {
    try { return new URL(DS.url(path), window.location.href).href; }
    catch (e) { return DS.url(path); }
  }

  function tenantOf(id) {
    return (DS.data && DS.data.tenantById) ? (DS.data.tenantById(id) || null) : null;
  }

  /* One authoritative receipt model.
     invoice → linked order → customer user → live catalogue.
     This is what guarantees the printed paper shows the real order,
     store and customer instead of half-empty snapshots.              */
  function resolveReceipt(input) {
    var data = Object.assign({}, input || {});
    var orders = (DS.data && DS.data.orders) || [];
    var order = null;

    if (data.order_id) order = orders.filter(function (o) { return o.id === data.order_id; })[0] || null;
    if (!order && data.order_no) order = orders.filter(function (o) { return o.order_no === data.order_no; })[0] || null;

    if (order) {
      if (!data.order_id) data.order_id = order.id;
      if (!data.order_no) data.order_no = order.order_no;
      if (!data.items || !data.items.length) data.items = order.items;
      if (!data.tenant_id) data.tenant_id = order.tenant_id;
      if (data.subtotal == null) data.subtotal = order.subtotal;
      if (data.discount == null) data.discount = order.discount || 0;
      if (data.delivery_fee == null) data.delivery_fee = order.delivery_fee || 0;
      if (data.total == null) data.total = order.total;
      if (!data.payment_method) data.payment_method = order.payment_method;
      if (!data.created_at) data.created_at = order.created_at;
      if (!data.cashier_name) data.cashier_name = order.cashier_name || (order.source === 'pos' ? order.driver_name : '') || '';
    }

    if (!data.customer || !data.customer.name) {
      var customer = (data.customer && data.customer.name) ? data.customer : (order && order.customer) || null;
      if (!customer && order && order.customer_id && DS.data && DS.data.userById) {
        var byId = DS.data.userById(order.customer_id);
        if (byId) customer = { name: byId.name, name_en: byId.name_en, phone: byId.phone, address: byId.address, city: byId.city };
      }
      if (!customer && data.customer_id && DS.data && DS.data.users) {
        var u = DS.data.users.filter(function (x) { return x.id === data.customer_id; })[0];
        if (u) customer = { name: u.name, name_en: u.name_en, phone: u.phone, address: u.address, city: u.city };
      }
      data.customer = customer ? Object.assign({}, customer) : null;
    }

    /* Fill missing product names / images from the live catalogue. */
    data.items = (data.items || []).map(function (it) {
      it = Object.assign({}, it);
      if (it.product_id && DS.data && DS.data.products) {
        var p = DS.data.products.filter(function (x) { return x.id === it.product_id; })[0];
        if (p) {
          if (!it.name) it.name = p.name;
          if (!it.name_en) it.name_en = p.name_en;
          if (!it.image) it.image = p.image;
        }
      }
      return it;
    });

    data.tenant = tenantOf(data.tenant_id) || {};
    return data;
  }
  DS.resolveReceipt = resolveReceipt;

  function thermalInvoice(raw) {
    var data = resolveReceipt(raw);
    var EN = DS.lang() === 'en';
    var settings = receiptSettings();
    var tenant = data.tenant || {};
    var storeName = settings.name || DS.loc(tenant, 'name') || tenant.name || 'DotStudio POS';
    var footer = settings.footer || (EN ? 'Thank you for shopping with us' : 'شكراً لتعاملكم معنا');
    var no = data.order_no || data.invoice_no || '—';
    var trackingUrl = receiptTrackingUrl(no);
    var items = data.items || [];

    var storeLine = [];
    if (tenant.phone) storeLine.push(tenant.phone);
    if (DS.loc(tenant, 'address')) storeLine.push(DS.loc(tenant, 'address'));
    if (DS.loc(tenant, 'city')) storeLine.push(DS.loc(tenant, 'city'));

    var meta = function (label, value, cls) {
      if (value == null || value === '') return '';
      return '<div class="ipa-meta-row' + (cls ? ' ' + cls : '') + '"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>';
    };

    var rows = items.map(function (it) {
      var name = EN ? (it.name_en || it.name) : it.name;
      if (EN && !it.name_en && it.product_id && DS.data && DS.data.products) {
        var prod = DS.data.products.filter(function (p) { return p.id === it.product_id; })[0];
        if (prod && prod.name_en) name = prod.name_en;
      }
      var vendor = it.tenant_id && it.tenant_id !== data.tenant_id && DS.data.tenantById ? DS.data.tenantById(it.tenant_id) : null;
      var vendorName = vendor ? DS.loc(vendor, 'name') : '';
      return '<tr>' +
        '<td class="ipa-item-name">' + esc(name || '—') + (vendorName ? '<small>' + esc(EN ? 'from ' + vendorName : 'من متجر ' + vendorName) + '</small>' : '') + '</td>' +
        '<td class="ipa-num">' + (Number(it.qty) || 0) + '</td>' +
        '<td class="ipa-num">' + money(it.price) + '</td>' +
        '<td class="ipa-num ipa-line-total">' + money((Number(it.qty) || 0) * (Number(it.price) || 0)) + '</td>' +
      '</tr>';
    }).join('');

    var subtotal = data.subtotal != null ? Number(data.subtotal) : items.reduce(function (s, it) { return s + (Number(it.qty) || 0) * (Number(it.price) || 0); }, 0);
    var delivery = Number(data.delivery_fee) || 0;
    var discount = Number(data.discount) || 0;
    var grand = data.total != null ? Number(data.total) : subtotal + delivery - discount;
    var customer = data.customer || null;

    return '<div class="invoice-print-area" id="print-invoice-area" dir="' + (EN ? 'ltr' : 'rtl') + '">' +
      (settings.logo ? '<div class="ipa-logo"><img src="' + esc(settings.logo) + '" alt=""></div>' : '') +
      '<div class="ipa-store">' + esc(storeName) + '</div>' +
      (storeLine.length ? '<div class="ipa-store-sub">' + esc(storeLine.join(' · ')) + '</div>' : '') +
      '<div class="ipa-tax">' + esc(EN ? 'TAX INVOICE' : 'فاتورة ضريبية') + '</div>' +
      '<div class="ipa-sep"></div>' +
      '<div class="ipa-meta">' +
        meta(EN ? 'Order' : 'رقم الطلب', no) +
        (data.invoice_no && data.invoice_no !== no ? meta(EN ? 'Invoice' : 'الفاتورة', data.invoice_no) : '') +
        meta(t('date'), DS.datetime(data.created_at || Date.now())) +
        (data.cashier_name ? meta(t('cashier'), data.cashier_name) : '') +
        (customer && customer.name ? meta(t('customerLabel'), DS.loc(customer, 'name')) : '') +
        (customer && customer.phone && customer.phone !== '—' ? meta(t('phone'), customer.phone) : '') +
        meta(t('paymentMethod'), t(data.payment_method || data.method || 'cash')) +
      '</div>' +
      '<div class="ipa-sep dashed"></div>' +
      '<table class="ipa-items"><thead><tr>' +
        '<th class="ipa-th-name">' + esc(t('item')) + '</th>' +
        '<th class="ipa-num">' + esc(t('quantity')) + '</th>' +
        '<th class="ipa-num">' + esc(t('price')) + '</th>' +
        '<th class="ipa-num">' + esc(t('total')) + '</th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="4" class="ipa-num">—</td></tr>') + '</tbody></table>' +
      '<div class="ipa-sep dashed"></div>' +
      '<div class="ipa-totals">' +
        '<div class="ipa-sum"><span>' + esc(t('subtotal')) + '</span><b>' + money(subtotal) + '</b></div>' +
        (discount ? '<div class="ipa-sum"><span>' + esc(t('discount')) + '</span><b>− ' + money(discount) + '</b></div>' : '') +
        (delivery ? '<div class="ipa-sum"><span>' + esc(t('delivery')) + '</span><b>' + money(delivery) + '</b></div>' : '') +
        '<div class="ipa-sum ipa-grand"><span>' + esc(t('total')) + '</span><b>' + money(grand) + '</b></div>' +
      '</div>' +
      '<div class="ipa-sep dashed"></div>' +
      '<div class="ipa-qr">' +
        '<div class="ipa-qr-box" id="invoiceQrBox"></div>' +
        '<div class="ipa-qr-title">' + esc(EN ? 'Scan to track your order' : 'امسح لمتابعة طلبك') + '</div>' +
        '<div class="ipa-qr-url">' + esc(trackingUrl) + '</div>' +
      '</div>' +
      '<div class="ipa-sep"></div>' +
      '<div class="ipa-footer">' + esc(footer) + '</div>' +
    '</div>';
  }
  DS.thermalInvoice = thermalInvoice;

  var THERMAL_CSS = [
    '.invoice-print-area { width: 80mm; box-sizing: border-box; margin: 0 auto; padding: 5mm; background: #ffffff; color: #000000; font-family: "Courier New", Courier, monospace; font-size: 11px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    '.invoice-print-area .ipa-logo { text-align: center; margin-bottom: 2mm; }',
    '.invoice-print-area .ipa-logo img { max-height: 12mm; max-width: 46mm; object-fit: contain; }',
    '.invoice-print-area .ipa-store { text-align: center; font-size: 17px; font-weight: 700; letter-spacing: .04em; line-height: 1.2; word-break: break-word; }',
    '.invoice-print-area .ipa-store-sub { text-align: center; font-size: 8.5px; color: #333; margin-top: 1mm; line-height: 1.45; word-break: break-word; }',
    '.invoice-print-area .ipa-tax { text-align: center; font-size: 9px; letter-spacing: .18em; text-transform: uppercase; margin-top: 1mm; }',
    '.invoice-print-area .ipa-sep { border-top: 1px dashed #000; margin: 2.5mm 0; }',
    '.invoice-print-area .ipa-sep.dashed { border-top: 1px dashed #000; }',
    '.invoice-print-area .ipa-meta { display: flex; flex-direction: column; gap: .8mm; font-size: 10px; }',
    '.invoice-print-area .ipa-meta-row { display: flex; justify-content: space-between; gap: 4mm; }',
    '.invoice-print-area .ipa-meta-row span { color: #333; }',
    '.invoice-print-area .ipa-meta-row b { font-weight: 700; text-align: end; word-break: break-word; }',
    '.invoice-print-area .ipa-items { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }',
    '.invoice-print-area .ipa-items th { font-size: 8.5px; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px dashed #000; padding: 0 0 1.2mm; text-align: start; font-weight: 700; }',
    '.invoice-print-area .ipa-items td { padding: 1.4mm 0; vertical-align: top; text-align: start; border-bottom: 1px dotted #999; }',
    '.invoice-print-area .ipa-items tr:last-child td { border-bottom: none; }',
    '.invoice-print-area .ipa-th-name { width: 46%; }',
    '.invoice-print-area .ipa-num { text-align: end !important; white-space: nowrap; }',
    '.invoice-print-area .ipa-item-name { word-break: break-word; }',
    '.invoice-print-area .ipa-item-name small { display: block; font-size: 8px; color: #444; }',
    '.invoice-print-area .ipa-line-total { font-weight: 700; }',
    '.invoice-print-area .ipa-totals { display: flex; flex-direction: column; gap: 1mm; font-size: 10.5px; }',
    '.invoice-print-area .ipa-sum { display: flex; justify-content: space-between; gap: 4mm; }',
    '.invoice-print-area .ipa-sum b { font-weight: 700; }',
    '.invoice-print-area .ipa-grand { font-size: 14px; font-weight: 700; border-top: 1px dashed #000; padding-top: 1.6mm; margin-top: .6mm; }',
    '.invoice-print-area .ipa-qr { display: flex; flex-direction: column; align-items: center; gap: 1mm; text-align: center; }',
    '.invoice-print-area .ipa-qr-box { width: 22mm; height: 22mm; display: grid; place-items: center; overflow: hidden; }',
    '.invoice-print-area .ipa-qr-box img, .invoice-print-area .ipa-qr-box canvas { width: 22mm !important; height: 22mm !important; display: block; }',
    '.invoice-print-area .ipa-qr-title { font-size: 9px; font-weight: 700; }',
    '.invoice-print-area .ipa-qr-url { font-size: 7px; color: #333; word-break: break-all; direction: ltr; max-width: 100%; }',
    '.invoice-print-area .ipa-footer { text-align: center; font-size: 9px; line-height: 1.5; }',
    '@media print {',
    '  @page { size: 80mm auto; margin: 0 !important; }',
    '  html, body { margin: 0 !important; padding: 0 !important; background: #ffffff !important; }',
    '  body { font-family: "Cairo", "Inter", sans-serif !important; }',
    '  body * { visibility: hidden !important; }',
    '  .invoice-print-area, .invoice-print-area *, .invoice-container, .invoice-container * { visibility: visible !important; }',
    '  .invoice-container { width: 80mm !important; max-width: 80mm !important; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #ffffff !important; color: #000000 !important; }',
    '  .invoice-modal-wrapper { display: block !important; margin: 0 !important; padding: 0 !important; }',
    '  .invoice-print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 80mm !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; background: #ffffff !important; color: #000000 !important; font-family: "Cairo", "Inter", sans-serif !important; }',
    '}'
  ].join('\n');
  DS.thermalCss = THERMAL_CSS;

  function printReceipt(raw, kind) {
    var data = resolveReceipt(raw);
    var no = data.order_no || data.invoice_no || '—';
    var trackingUrl = receiptTrackingUrl(no);
    var qrLib = absoluteUrl('shared/vendor/qrcode.min.js');
    var html = '<!DOCTYPE html><html lang="' + DS.lang() + '" dir="' + (DS.lang() === 'ar' ? 'rtl' : 'ltr') + '">' +
      '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(no) + '</title>' +
      '<style>body{margin:0;padding:0;background:#fff;display:flex;justify-content:center}' + THERMAL_CSS + '</style>' +
      '<script src="' + esc(qrLib) + '"><\/script>' +
      '</head><body>' + thermalInvoice(data) +
      '<script>' +
      'function dsThermalPrint(){' +
      '  var box=document.getElementById("invoiceQrBox");' +
      '  if(window.QRCode&&box&&!box.firstChild){try{new QRCode(box,{text:' + JSON.stringify(trackingUrl) + ',width:88,height:88,colorDark:"#000000",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});}catch(e){}}' +
      '  setTimeout(function(){try{window.focus();window.print();}catch(e){}},420);' +
      '}' +
      'window.onload=dsThermalPrint;' +
      '<\/script></body></html>';
    var w = window.open('', '_blank', 'width=460,height=760');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    else DS.toast(t('error'), 'error');
  }
  DS.printReceipt = printReceipt;

  /* ───────────────────── 60×40mm PRODUCT LABEL ───────────────────── */
  function printProductLabel(p) {
    if (!p) return;
    var tn = DS.data.tenantById(p.tenant_id) || (DS.session() && DS.data.tenantById((DS.session() || {}).tenant_id)) || {};
    var store = DS.loc(tn, 'name') || tn.name || 'DotStudio®';
    var name = DS.loc(p, 'name') || p.name || '';
    var barcode = p.barcode || p.sku || '';
    var bars = '';
    var hash = 0;
    String(barcode).split('').forEach(function (ch) { hash = ((hash << 5) - hash) + ch.charCodeAt(0); });
    for (var x = 4; x < 176;) {
      var w = 1 + (Math.abs(hash = (hash * 9301 + 49297) % 233280) % 3);
      bars += '<rect x="' + x + '" y="0" width="' + w + '" height="34" fill="#000"/>';
      x += w + 1 + (Math.abs(hash = (hash * 9301 + 49297) % 233280) % 2);
    }
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(name) + '</title>' +
      '<style>@page{size:50mm 30mm;margin:0}html,body{margin:0;padding:0;background:#fff}' +
      '.lb{width:50mm;height:30mm;box-sizing:border-box;padding:2mm 3mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;font-family:Arial,sans-serif;color:#000}' +
      '.st{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-bottom:1px dashed #bbb;width:100%;padding-bottom:2px}' +
      '.nm{font-size:11px;font-weight:700;line-height:1.2;max-height:26px;overflow:hidden;margin:2px 0}' +
      '.pr{font-size:12px;font-weight:800;margin:1px 0}' +
      '.bc{width:80%}.bc svg{width:100%;height:26px;display:block}.cd{font-family:monospace;font-size:9px;letter-spacing:.12em;font-weight:700}' +
      '</style></head><body><div class="lb"><div class="st">' + esc(store) + '</div>' +
      '<div class="nm">' + esc(name) + '</div><div class="pr">' + esc(money(p.price)) + '</div>' +
      '<div class="bc"><svg viewBox="0 0 180 34" preserveAspectRatio="none">' + bars + '</svg>' +
      '<div class="cd">' + esc(barcode) + '</div></div></div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},260);};<\/script></body></html>';
    var w = window.open('', '_blank', 'width=420,height=360');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
    else DS.toast(t('error'), 'error');
  }
  DS.printProductLabel = printProductLabel;

  /* ─────────────────────────── SMALL PARTS ───────────────────────── */
  DS.productCard = function (p, opts) {
    opts = opts || {};
    var lang = DS.lang();
    var name = lang === 'en' ? (p.name_en || p.name) : p.name;
    var cat = lang === 'en' ? (p.category_en || p.category) : p.category;
    var stockCls = p.stock <= 0 ? 'stock-out' : p.stock <= (p.min_stock || 0) ? 'stock-low' : 'stock-ok';
    var stockTxt = p.stock <= 0 ? t('outOfStock') : p.stock + ' ' + t('units');
    return '<article class="product-card" data-product="' + esc(p.id) + '">' +
      '<div class="product-media product-image-container"><img src="' + esc(DS.data.img(p.image)) + '" alt="' + esc(name) + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + esc(url('assets/product-placeholder.svg')) + '\'">' +
        '<div class="product-badges">' + (p.stock <= 0 ? '<span class="badge danger">' + esc(t('out')) + '</span>' : p.stock <= (p.min_stock || 0) ? '<span class="badge warning">' + esc(t('lowStockShort')) + '</span>' : '') + '</div></div>' +
      '<div class="product-body"><div class="product-cat">' + esc(cat || '') + '</div>' +
        '<div class="product-name">' + esc(name) + '</div>' +
        '<div class="product-price"><span class="p">' + money(p.price) + '</span></div>' +
        '<div class="product-meta"><span class="stock-pill ' + stockCls + '">' + esc(stockTxt) + '</span><span>★ ' + (p.rating || '4.8') + '</span></div>' +
        (opts.actions != null ? opts.actions : '') + '</div></article>';
  };

  DS.statusLine = function (status) {
    var meta = DS.statusMeta(status);
    return '<span class="status-line"><i class="status-dot ' + status + '"></i>' + esc(meta.label) + '</span>';
  };

  DS.proofThumb = function (order) {
    if (!order.proof || !order.proof.url) return '<span class="text-muted" style="font-size:11px">—</span>';
    return '<img src="' + esc(order.proof.url) + '" alt="proof" style="width:34px;height:26px;object-fit:cover;border-radius:5px;border:1px solid var(--border);cursor:pointer" data-proof="' + esc(order.id) + '">';
  };

  console.log('%cDotStudio® POS · ui ready', 'color:#82FF1F;font-weight:bold');
})();
