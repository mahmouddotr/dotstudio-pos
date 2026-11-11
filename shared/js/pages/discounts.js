/* DotStudio® POS — Discounts & promo codes (admin) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;
  var EN = DS.lang() === 'en';
  var user = DS.session();
  if (!user) return;

  var page = DS.shell.mount({
    roles: ['superadmin', 'subadmin'],
    permission: 'discounts',
    active: 'discounts',
    title: t('discounts'),
    eyebrow: t('admin'),
    icon: 'percent',
    sub: EN ? 'Create promo codes customers can redeem in the cart.' : 'أنشئ أكواد خصم يستخدمها العملاء داخل السلة.',
    actions: '<button class="btn btn-primary" data-add>' + icon('plus') + esc(EN ? 'New promo code' : 'كود خصم جديد') + '</button>',
    content: DS.skeleton.rows(5)
  });
  if (!page) return;

  function list() { return (DS.data.discounts || []).slice(); }

  function stateOf(d) {
    if (d.active === false) return { key: 'suspended', label: EN ? 'Disabled' : 'موقوف' };
    if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) return { key: 'danger', label: EN ? 'Expired' : 'منتهي' };
    if (Number(d.max_uses) > 0 && Number(d.used) >= Number(d.max_uses)) return { key: 'neutral', label: EN ? 'Fully used' : 'مستهلك' };
    return { key: 'success', label: EN ? 'Active' : 'فعّال' };
  }

  function valueLabel(d) {
    return d.type === 'fixed' ? money(d.value) : (Number(d.value) || 0) + '%';
  }

  function render() {
    var rows = list();
    var now = Date.now();
    var stats = '<div class="kpi-grid">' +
      stat(EN ? 'Promo codes' : 'أكواد الخصم', rows.length, 'percent', 'lime') +
      stat(EN ? 'Active now' : 'الأكواد الفعّالة', rows.filter(function (d) { return stateOf(d).key === 'success'; }).length, 'checkCircle', 'green') +
      stat(EN ? 'Total redemptions' : 'مرات الاستخدام', rows.reduce(function (s, d) { return s + (Number(d.used) || 0); }, 0), 'receipt', 'info') +
      stat(EN ? 'Expiring soon' : 'تنتهي قريباً', rows.filter(function (d) {
        return d.expires_at && new Date(d.expires_at).getTime() > now && new Date(d.expires_at).getTime() - now < 7 * 86400000;
      }).length, 'clock', 'orange') + '</div>';

    var hint = '<div class="notice" style="display:flex;align-items:center;gap:10px">' + icon('sparkles') +
      '<div style="flex:1;font-size:12px">' + esc(EN
        ? 'Customers enter the code in the bag or at checkout. Example: SAVE20 → 20% off the subtotal.'
        : 'العميل يدخل الكود داخل السلة أو عند إتمام الطلب. مثال: SAVE20 → خصم 20% من المجموع.') + '</div></div>';

    var sale = DS.data.storeSale ? DS.data.storeSale() : { enabled: false, percent: 10 };
    var saleCard = '<div class="card sf-admin-card"><div class="card-header"><div>' +
        '<div class="card-title">' + icon('percent') + ' ' + esc(EN ? 'Store-wide sale' : 'تخفيضات المتجر') + '</div>' +
        '<div class="card-subtitle">' + esc(EN ? 'Automatic discount on every cart — no code needed.' : 'خصم تلقائي على كل سلة — بدون كود.') + '</div></div>' +
        '<button class="btn btn-primary btn-sm" data-sale-save>' + icon('check') + esc(EN ? 'Save' : 'حفظ') + '</button></div>' +
      '<div class="card-body"><div class="field-grid">' +
        '<label class="check" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="saleEnabled"' + (sale.enabled ? ' checked' : '') + '><span>' + esc(EN ? 'Enable store-wide sale' : 'تشغيل التخفيضات') + '</span></label>' +
        '<div class="field"><label>' + esc(EN ? 'Discount %' : 'نسبة الخصم %') + '</label><input class="input" id="salePercent" type="number" min="0" max="90" step="1" dir="ltr" value="' + esc(sale.percent || 0) + '"></div>' +
        '<div class="field" style="grid-column:1/-1"><label>' + esc(EN ? 'Sale label' : 'اسم التخفيضات') + '</label><input class="input" id="saleLabel" maxlength="40" value="' + esc(EN ? (sale.label_en || sale.label) : sale.label) + '"></div>' +
      '</div></div></div>';

    var fd = DS.data.freeDelivery ? DS.data.freeDelivery() : { enabled: false };
    var companyOpts = (DS.data.companies || []).map(function (c) {
      return '<option value="' + esc(c.id) + '"' + (fd.company_id === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
    }).join('');
    var fdCard = '<div class="card sf-admin-card"><div class="card-header"><div>' +
        '<div class="card-title">' + icon('truck') + ' ' + esc(EN ? 'Free delivery' : 'توصيل مجاني') + '</div>' +
        '<div class="card-subtitle">' + esc(EN ? 'Free for a period, an order value, or a specific company.' : 'مجاناً لفترة أو عند قيمة طلب أو لشركة محددة.') + '</div></div>' +
        '<button class="btn btn-primary btn-sm" data-fd-save>' + icon('check') + esc(EN ? 'Save' : 'حفظ') + '</button></div>' +
      '<div class="card-body"><div class="field-grid">' +
        '<label class="check" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="fdEnabled"' + (fd.enabled ? ' checked' : '') + '><span>' + esc(EN ? 'Enable free delivery' : 'تشغيل التوصيل المجاني') + '</span></label>' +
        '<div class="field"><label>' + esc(EN ? 'Rule' : 'القاعدة') + '</label><select class="select" id="fdMode">' +
          '<option value="always"' + (fd.mode === 'always' ? ' selected' : '') + '>' + esc(EN ? 'Always free' : 'مجاني دائماً') + '</option>' +
          '<option value="threshold"' + (fd.mode === 'threshold' ? ' selected' : '') + '>' + esc(EN ? 'Over order value' : 'فوق قيمة طلب') + '</option>' +
          '<option value="company"' + (fd.mode === 'company' ? ' selected' : '') + '>' + esc(EN ? 'Specific company' : 'شركة محددة') + '</option>' +
        '</select></div>' +
        '<div class="field"><label>' + esc(EN ? 'Minimum order (EGP)' : 'أقل قيمة طلب (ج.م)') + '</label><input class="input" id="fdMin" type="number" min="0" step="10" dir="ltr" value="' + esc(fd.min_order || 0) + '"></div>' +
        '<div class="field"><label>' + esc(EN ? 'Company' : 'شركة التوصيل') + '</label><select class="select" id="fdCompany"><option value="">' + esc(EN ? 'All companies' : 'كل الشركات') + '</option>' + companyOpts + '</select></div>' +
        '<div class="field"><label>' + esc(EN ? 'Valid until' : 'ساري حتى') + '</label><input class="input" id="fdUntil" type="date" dir="ltr" value="' + esc(fd.until ? String(fd.until).slice(0, 10) : '') + '"></div>' +
        '<div class="field" style="grid-column:1/-1"><label>' + esc(EN ? 'Banner note' : 'ملاحظة للعميل') + '</label><input class="input" id="fdNote" maxlength="80" value="' + esc(EN ? (fd.note_en || fd.note || '') : (fd.note || '')) + '"></div>' +
      '</div></div></div>';

    var setup = '<div class="sf-admin-grid">' + saleCard + fdCard + '</div>';

    var table = '<div class="card"><div class="card-header"><div>' +
        '<div class="card-title">' + esc(EN ? 'All codes' : 'كل الأكواد') + '</div>' +
        '<div class="card-subtitle">' + rows.length + ' ' + esc(EN ? 'codes' : 'كود') + '</div></div></div>' +
      '<div class="table-wrap flush"><table class="table"><thead><tr>' +
        '<th>' + esc(EN ? 'Code' : 'الكود') + '</th>' +
        '<th>' + esc(EN ? 'Discount' : 'الخصم') + '</th>' +
        '<th>' + esc(EN ? 'Min order' : 'أقل طلب') + '</th>' +
        '<th>' + esc(EN ? 'Usage' : 'الاستخدام') + '</th>' +
        '<th>' + esc(t('expires')) + '</th>' +
        '<th>' + esc(t('status')) + '</th>' +
        '<th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (d) {
        var st = stateOf(d);
        var exp = d.expires_at ? DS.date(d.expires_at) : (EN ? 'No expiry' : 'بدون انتهاء');
        return '<tr>' +
          '<td><div style="display:flex;align-items:center;gap:8px"><b style="font-family:var(--font-mono);letter-spacing:.06em;direction:ltr">' + esc(d.code) + '</b>' +
            '<button class="btn btn-ghost btn-sm" data-copy="' + esc(d.code) + '" aria-label="copy" title="' + esc(EN ? 'Copy' : 'نسخ') + '">' + icon('copy') + '</button></div>' +
            (d.note ? '<div class="cell-sub">' + esc(EN ? (d.note_en || d.note) : d.note) + '</div>' : '') + '</td>' +
          '<td><b style="color:var(--lime)">' + esc(valueLabel(d)) + '</b><div class="cell-sub">' + esc(d.type === 'fixed' ? (EN ? 'Fixed amount' : 'مبلغ ثابت') : (EN ? 'Percentage' : 'نسبة مئوية')) + '</div></td>' +
          '<td>' + (Number(d.min_order) > 0 ? money(d.min_order) : '—') + '</td>' +
          '<td>' + (Number(d.used) || 0) + (Number(d.max_uses) > 0 ? ' / ' + Number(d.max_uses) : '') + '</td>' +
          '<td style="font-size:11px;color:var(--text-tertiary)">' + esc(exp) + '</td>' +
          '<td>' + DS.badge(st.key, st.label) + '</td>' +
          '<td style="text-align:end;white-space:nowrap">' +
            '<button class="btn btn-ghost btn-sm" data-edit="' + esc(d.id) + '" aria-label="edit">' + icon('edit') + '</button>' +
            '<button class="btn btn-ghost btn-sm" data-toggle="' + esc(d.id) + '" aria-label="toggle">' + icon(d.active === false ? 'play' : 'pause') + '</button>' +
            '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" data-del="' + esc(d.id) + '" aria-label="delete">' + icon('trash') + '</button>' +
          '</td></tr>';
      }).join('') : '<tr><td colspan="7">' + DS.empty({
        icon: 'percent',
        title: EN ? 'No promo codes yet' : 'لا توجد أكواد خصم بعد',
        text: EN ? 'Create your first code — for example SAVE20 with 20% off.' : 'أنشئ أول كود — مثلاً SAVE20 بخصم 20%.',
        cta: { label: EN ? 'New promo code' : 'كود خصم جديد', icon: 'plus', onclick: 'document.querySelector("[data-add]").click()' }
      }) + '</td></tr>') +
      '</tbody></table></div></div>';

    page.setContent(stats + hint + setup + table);
    bind();
  }

  function stat(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div>' +
      '<div class="stat-value" style="font-size:26px">' + value + '</div></div>';
  }

  function bind() {
    DS.$$('[data-add]', page.body).forEach(function (b) { b.addEventListener('click', function () { edit(null); }); });
    DS.$$('[data-edit]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        edit((DS.data.discounts || []).filter(function (d) { return d.id === b.getAttribute('data-edit'); })[0]);
      });
    });
    DS.$$('[data-toggle]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        var d = (DS.data.discounts || []).filter(function (x) { return x.id === b.getAttribute('data-toggle'); })[0];
        if (!d) return;
        DS.data.saveDiscount({ id: d.id, active: d.active === false });
        DS.toast(t('updated'), 'success');
        render();
      });
    });
    DS.$$('[data-del]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        DS.confirm({ title: t('confirmDelete'), text: EN ? 'Delete this promo code?' : 'حذف كود الخصم هذا؟', danger: true }).then(function (ok) {
          if (!ok) return;
          DS.data.deleteDiscount(b.getAttribute('data-del'));
          DS.toast(t('deleted'), 'success');
          render();
        });
      });
    });
    DS.$$('[data-copy]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { DS.copy(b.getAttribute('data-copy')); });
    });
    var saleSave = page.body.querySelector('[data-sale-save]');
    if (saleSave) saleSave.addEventListener('click', function () {
      var label = (page.body.querySelector('#saleLabel').value || '').trim();
      DS.data.saveStoreSale({
        enabled: page.body.querySelector('#saleEnabled').checked,
        percent: Number(page.body.querySelector('#salePercent').value) || 0,
        label: label || 'تخفيضات المتجر', label_en: label || 'Store sale'
      });
      DS.toast(EN ? 'Store sale saved' : 'تم حفظ التخفيضات', 'success');
      render();
    });
    var fdSave = page.body.querySelector('[data-fd-save]');
    if (fdSave) fdSave.addEventListener('click', function () {
      var until = page.body.querySelector('#fdUntil').value;
      DS.data.saveFreeDelivery({
        enabled: page.body.querySelector('#fdEnabled').checked,
        mode: page.body.querySelector('#fdMode').value,
        min_order: Number(page.body.querySelector('#fdMin').value) || 0,
        company_id: page.body.querySelector('#fdCompany').value || '',
        until: until ? new Date(until + 'T23:59:59').toISOString() : null,
        note: (page.body.querySelector('#fdNote').value || '').trim(),
        note_en: (page.body.querySelector('#fdNote').value || '').trim()
      });
      DS.toast(EN ? 'Free delivery saved' : 'تم حفظ التوصيل المجاني', 'success');
      render();
    });
  }

  function isoFromDate(v) {
    if (!v) return null;
    var d = new Date(v + 'T23:59:59');
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  function edit(d) {
    var isNew = !d;
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(EN ? 'Promo code' : 'كود الخصم') + ' *</label>' +
        '<input class="input" id="dcCode" dir="ltr" maxlength="24" placeholder="SAVE20" style="letter-spacing:.08em;text-transform:uppercase" value="' + esc(d ? d.code : '') + '"></div>' +
      '<div class="field"><label>' + esc(EN ? 'Discount type' : 'نوع الخصم') + '</label>' +
        '<select class="select" id="dcType">' +
          '<option value="percent"' + (!d || d.type !== 'fixed' ? ' selected' : '') + '>' + esc(EN ? 'Percentage %' : 'نسبة مئوية %') + '</option>' +
          '<option value="fixed"' + (d && d.type === 'fixed' ? ' selected' : '') + '>' + esc(EN ? 'Fixed amount' : 'مبلغ ثابت') + '</option>' +
        '</select></div>' +
      '<div class="field"><label>' + esc(EN ? 'Value' : 'قيمة الخصم') + ' *</label>' +
        '<input class="input" id="dcValue" type="number" min="0" step="1" dir="ltr" value="' + esc(d ? d.value : 20) + '"></div>' +
      '<div class="field"><label>' + esc(EN ? 'Minimum order' : 'أقل مبلغ للطلب') + '</label>' +
        '<input class="input" id="dcMin" type="number" min="0" step="1" dir="ltr" value="' + esc(d ? (d.min_order || 0) : 0) + '"></div>' +
      '<div class="field"><label>' + esc(EN ? 'Max uses (0 = unlimited)' : 'أقصى استخدام (0 = بلا حد)') + '</label>' +
        '<input class="input" id="dcUses" type="number" min="0" step="1" dir="ltr" value="' + esc(d ? (d.max_uses || 0) : 0) + '"></div>' +
      '<div class="field"><label>' + esc(t('expires')) + '</label>' +
        '<input class="input" id="dcExp" type="date" dir="ltr" value="' + esc(d && d.expires_at ? String(d.expires_at).slice(0, 10) : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('status')) + '</label>' +
        '<select class="select" id="dcActive">' +
          '<option value="1"' + (!d || d.active !== false ? ' selected' : '') + '>' + esc(EN ? 'Active' : 'فعّال') + '</option>' +
          '<option value="0"' + (d && d.active === false ? ' selected' : '') + '>' + esc(EN ? 'Disabled' : 'موقوف') + '</option>' +
        '</select></div>' +
      '</div>';

    DS.modal({
      title: icon('percent') + ' ' + esc(isNew ? (EN ? 'New promo code' : 'كود خصم جديد') : (EN ? 'Edit promo code' : 'تعديل كود الخصم')),
      sub: esc(EN ? 'Codes apply to the cart subtotal.' : 'يطبق الكود على مجموع السلة.'),
      size: 'md',
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('saveChanges'), variant: 'btn-primary', icon: icon('check'), onClick: function (root) {
            var code = (root.querySelector('#dcCode').value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
            var type = root.querySelector('#dcType').value === 'fixed' ? 'fixed' : 'percent';
            var value = Number(root.querySelector('#dcValue').value) || 0;
            var min = Number(root.querySelector('#dcMin').value) || 0;
            var uses = Number(root.querySelector('#dcUses').value) || 0;
            var exp = isoFromDate(root.querySelector('#dcExp').value);
            var active = root.querySelector('#dcActive').value === '1';
            if (!code) { DS.toast(EN ? 'Enter a code' : 'اكتب الكود', 'error'); return false; }
            if (value <= 0) { DS.toast(EN ? 'Value must be greater than zero' : 'القيمة يجب أن تكون أكبر من صفر', 'error'); return false; }
            if (type === 'percent' && value > 100) { DS.toast(EN ? 'Percentage cannot exceed 100' : 'النسبة لا تتجاوز 100%', 'error'); return false; }
            var dup = (DS.data.discounts || []).filter(function (x) { return x.code === code && (!d || x.id !== d.id); })[0];
            if (dup) { DS.toast(EN ? 'This code already exists' : 'هذا الكود موجود بالفعل', 'error'); return false; }

            if (isNew) {
              DS.data.addDiscount({ code: code, type: type, value: value, min_order: min, max_uses: uses, expires_at: exp, active: active });
            } else {
              DS.data.saveDiscount({ id: d.id, code: code, type: type, value: value, min_order: min, max_uses: uses, expires_at: exp, active: active });
            }
            DS.toast(EN ? 'Promo code saved' : 'تم حفظ كود الخصم', 'success');
            render();
            return true;
          } }
      ]
    });
  }

  render();
})();
