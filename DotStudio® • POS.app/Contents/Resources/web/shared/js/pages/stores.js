/* DotStudio® POS — Stores (admin) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url, money = DS.money;
  var page = DS.shell.mount({
    roles: ['superadmin', 'subadmin'],
    permission: 'stores',
    active: 'stores',
    title: t('stores'),
    eyebrow: t('admin'),
    icon: 'store',
    sub: DS.lang() === 'en' ? 'Every store on the platform, its plan, team and performance.' : 'كل متجر على المنصة: باقته، فريقه، وأداؤه.',
    actions: '<button class="btn btn-primary" data-add>' + icon('plus') + esc(t('addStore')) + '</button>',
    content: DS.skeleton.grid(4)
  });
  if (!page) return;

  function render() {
    var cards = DS.data.tenants.map(function (tn) {
      var s = DS.data.statsFor(tn.id);
      var sub = DS.data.activeSubscription(tn.id);
      var owner = DS.data.users.filter(function (u) { return u.role === 'owner' && u.tenant_id === tn.id; })[0];
      var cashiers = DS.data.users.filter(function (u) { return u.role === 'cashier' && u.tenant_id === tn.id; }).length;
      return '<article class="card hoverable" style="padding:18px">' +
        '<div style="display:flex;align-items:flex-start;gap:12px">' +
          '<img src="' + esc(DS.avatarUrl(tn)) + '" alt="" style="width:52px;height:52px;border-radius:14px;object-fit:cover;border:1px solid var(--border)">' +
          '<div style="flex:1;min-width:0"><div class="section-title" style="font-size:var(--fs-lg)">' + esc(tn.name) + ' ' + DS.badge(tn.status, t(tn.status)) + '</div>' +
            '<div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">' + esc(DS.loc(tn, 'industry')) + ' · ' + esc(DS.loc(tn, 'city')) + '</div>' +
            '<div style="font-size:11px;color:var(--text-secondary);margin-top:5px">' + esc(owner ? DS.loc(owner, 'name') : '—') + ' · <span style="direction:ltr;display:inline-block">@' + esc(tn.owner_username) + '</span></div>' +
          '</div>' +
          '<button class="btn btn-icon" data-edit="' + esc(tn.id) + '">' + icon('edit') + '</button></div>' +
        '<div class="delivery-stats" style="margin-top:14px;padding-top:12px">' +
          '<div class="delivery-stat"><b>' + money(s.revenue) + '</b><span>' + esc(t('revenue')) + '</span></div>' +
          '<div class="delivery-stat"><b>' + s.orders + '</b><span>' + esc(t('orders')) + '</span></div>' +
          '<div class="delivery-stat"><b>' + s.products + '</b><span>' + esc(t('products')) + '</span></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;flex-wrap:wrap">' +
          '<span class="badge ' + (tn.plan === 'yearly' ? 'lime' : tn.plan === 'sixmonths' ? 'info' : 'neutral') + '">' + esc(t(tn.plan)) + ' · ' + money(sub ? sub.plan.price : 0) + '</span>' +
          '<span style="font-size:10px;color:' + (sub && sub.daysLeft <= 15 ? 'var(--warning)' : 'var(--text-tertiary)') + '">' + esc(t('daysRemaining')) + ': ' + Math.max(0, sub ? sub.daysLeft : 0) + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:6px;margin-top:12px">' +
          '<a class="btn btn-secondary btn-sm" style="flex:1" href="' + url('admin/products.html?store=' + tn.id) + '">' + icon('box') + esc(t('products')) + '</a>' +
          '<a class="btn btn-secondary btn-sm" style="flex:1" href="' + url('admin/orders.html?store=' + tn.id) + '">' + icon('orders') + esc(t('orders')) + '</a>' +
          '<a class="btn btn-ghost btn-sm" href="' + url('admin/subscriptions.html?store=' + tn.id) + '">' + icon('card') + '</a>' +
        '</div></article>';
    }).join('');

    var summary = '<div class="kpi-grid">' +
      stat(t('totalStores'), DS.data.tenants.length, 'store', 'lime') +
      stat(t('active'), DS.data.tenants.filter(function (x) { return x.status === 'active'; }).length, 'checkCircle', 'green') +
      stat(t('mrr'), money(DS.data.platformStats().mrr), 'card', 'info') +
      stat(t('users'), DS.data.users.length, 'users', 'purple') + '</div>';

    page.setContent(summary + '<div class="delivery-grid">' + cards + '</div>');
    DS.$$('[data-edit]', page.body).forEach(function (b) { b.addEventListener('click', function () { edit(b.getAttribute('data-edit')); }); });
  }

  function stat(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div></div>';
  }

  function edit(id) {
    var tn = id ? DS.data.tenantById(id) : null;
    var isNew = !tn;
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(t('storeName')) + ' *</label><input class="input" id="sName" value="' + esc(tn ? tn.name : '') + '"></div>' +
      '<div class="field"><label>Store name (EN)</label><input class="input" id="sNameEn" value="' + esc(tn ? (tn.name_en || '') : '') + '" style="direction:ltr"></div>' +
      '<div class="field"><label>' + esc(t('ownerLabel')) + ' *</label><input class="input" id="sOwner" value="' + esc(tn ? tn.owner : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('username')) + '</label><input class="input" id="sUser" value="' + esc(tn ? tn.owner_username : '') + '" style="direction:ltr"' + (isNew ? '' : ' readonly') + '></div>' +
      (isNew ? '<div class="field"><label>' + esc(t('password')) + '</label><input class="input" id="sPass" value="owner2026" style="direction:ltr"></div>' : '') +
      '<div class="field"><label>' + esc(t('phone')) + '</label><input class="input" id="sPhone" value="' + esc(tn ? tn.phone : '') + '" style="direction:ltr"></div>' +
      '<div class="field"><label>' + esc(t('city')) + '</label><input class="input" id="sCity" value="' + esc(tn ? tn.city : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('address')) + '</label><input class="input" id="sAddr" value="' + esc(tn ? tn.address : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('category')) + '</label><input class="input" id="sIndustry" value="' + esc(tn ? tn.industry : '') + '"></div>' +
      '<div class="field"><label>' + esc(t('plan')) + '</label><select class="select" id="sPlan">' + DS.data.PLANS.map(function (p) { return '<option value="' + p.id + '"' + (tn && tn.plan === p.id ? ' selected' : '') + '>' + esc(p.name) + ' · ' + p.price + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(t('delivery')) + ' (EGP)</label><input class="input" id="sFee" type="number" value="' + esc(tn ? tn.delivery_fee : 30) + '"></div>' +
      '<div class="field"><label>' + esc(t('status')) + '</label><select class="select" id="sStatus"><option value="active"' + (!tn || tn.status === 'active' ? ' selected' : '') + '>' + esc(t('active')) + '</option><option value="inactive"' + (tn && tn.status === 'inactive' ? ' selected' : '') + '>' + esc(t('inactive')) + '</option></select></div>' +
      '<div class="field" style="grid-column:1/-1"><label>' + esc(t('storeDesc')) + '</label><textarea class="textarea" id="sDesc" rows="2">' + esc(tn ? tn.description : '') + '</textarea></div>' +
    '</div>';

    DS.modal({
      size: 'lg', title: isNew ? t('addStore') : t('storeProfile'), body: body,
      actions: [{ label: t('cancel'), variant: 'btn-secondary' }, { label: t('saveChanges'), variant: 'btn-primary', onClick: function (root) {
        var name = root.querySelector('#sName').value.trim();
        var ownerName = root.querySelector('#sOwner').value.trim();
        var username = root.querySelector('#sUser').value.trim().toLowerCase();
        if (!name || !ownerName || !username) { DS.toast(t('required'), 'error'); return false; }
        if (isNew) {
          if (DS.data.users.filter(function (u) { return u.username === username; }).length) { DS.toast(t('invalidLogin'), 'error'); return false; }
          var tid = 't-' + username;
          var now = new Date().toISOString();
          var end = new Date(Date.now() + 30 * 86400000).toISOString();
          DS.data.db.tenants.push({
            id: tid, slug: username, name: name, name_en: root.querySelector('#sNameEn').value.trim() || name,
            owner: ownerName, owner_en: ownerName, owner_username: username,
            phone: root.querySelector('#sPhone').value.trim(), email: username + '@dotstudio.app',
            city: root.querySelector('#sCity').value.trim(), address: root.querySelector('#sAddr').value.trim(),
            industry: root.querySelector('#sIndustry').value.trim() || (DS.lang() === 'en' ? 'Retail' : 'تجارة'), industry_en: 'Retail',
            plan: root.querySelector('#sPlan').value, subscription_start: now, subscription_end: end,
            status: root.querySelector('#sStatus').value, avatar_id: 'av' + (Math.floor(Math.random() * 9) + 1),
            color: '#82FF1F', rating: 4.8, delivery_fee: Number(root.querySelector('#sFee').value) || 30,
            lat: 30.0444, lng: 31.2357, description: root.querySelector('#sDesc').value.trim(), created_at: now
          });
          DS.data.addUser({ username: username, password: root.querySelector('#sPass').value || 'owner2026', role: 'owner', name: ownerName, name_en: ownerName, tenant_id: tid, avatar_id: 'av1' });
          DS.data.addUser({ username: username.slice(0, 2) + '_cashier', password: username.slice(0, 2) + '_cashier2026', role: 'cashier', name: 'كاشير ' + name, name_en: name + ' Cashier', tenant_id: tid, avatar_id: 'av5' });
          DS.data.audit('أضاف متجر «' + name + '»', 'Added store “' + name + '”', 'store');
        } else {
          DS.data.saveTenant({
            id: tn.id, name: name, name_en: root.querySelector('#sNameEn').value.trim() || name,
            owner: ownerName, phone: root.querySelector('#sPhone').value.trim(), city: root.querySelector('#sCity').value.trim(),
            address: root.querySelector('#sAddr').value.trim(), industry: root.querySelector('#sIndustry').value.trim(),
            plan: root.querySelector('#sPlan').value, status: root.querySelector('#sStatus').value,
            delivery_fee: Number(root.querySelector('#sFee').value) || 30, description: root.querySelector('#sDesc').value.trim()
          });
        }
        DS.toast(t('storeSaved'), 'success');
        render();
        return true;
      } }]
    });
  }

  var add = page.root.querySelector('[data-add]');
  if (add) add.addEventListener('click', function () { edit(null); });
  setTimeout(render, 170);
})();
