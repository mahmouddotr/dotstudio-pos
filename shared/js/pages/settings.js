/* DotStudio® POS — Settings */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url, money = DS.money;
  var user = DS.session();
  if (!user) return;
  var isAdmin = DS.data.isAdmin(user);
  var isSuper = user.role === 'superadmin';
  var isOwner = user.role === 'owner';
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : (user.role === 'delivery' ? ['delivery'] : [user.role]),
    active: 'settings',
    title: t('settings'),
    eyebrow: isAdmin ? t('admin') : (user.role === 'delivery' ? t('delivery') : (DS.data.tenantById(user.tenant_id) || {}).name),
    icon: 'settings',
    sub: t('settingsSub'),
    content: '<div class="skeleton" style="height:500px;border-radius:20px"></div>'
  });
  if (!page) return;

  var state = { tab: 'profile' };

  var TABS = [{ key: 'profile', label: t('profile'), icon: 'user' }];
  if (isSuper || isOwner) TABS.push({ key: 'store', label: isOwner ? t('storeProfile') : (DS.lang() === 'en' ? 'Platform' : 'المنصة'), icon: 'store' });
  TABS.push({ key: 'preferences', label: t('preferences'), icon: 'palette' });
  TABS.push({ key: 'security', label: t('security'), icon: 'shield' });

  function render() {
    var nav = '<div class="settings-nav">' + TABS.map(function (x) {
      return '<button class="' + (state.tab === x.key ? 'active' : '') + '" data-tab="' + x.key + '">' + icon(x.icon) + esc(x.label) + '</button>';
    }).join('') + '</div>';

    var body = '';
    if (state.tab === 'profile') body = profileSection();
    else if (state.tab === 'store') body = isSuper ? platformSection() : storeSection();
    else if (state.tab === 'preferences') body = prefsSection();
    else body = securitySection();

    page.setContent('<div class="settings-grid">' + nav + '<div style="display:flex;flex-direction:column;gap:16px">' + body + '</div></div>');
    bind();
  }

  function profileSection() {
    var av = DS.avatarUrl(isOwner ? (DS.data.tenantById(user.tenant_id) || user) : user);
    return '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('profile')) + '</div></div><div class="card-body">' +
      '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px"><img src="' + esc(av) + '" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--border)">' +
      '<div><div style="font-weight:600">' + esc(user.name) + '</div><div style="font-size:11px;color:var(--text-tertiary);direction:ltr;text-align:start">@' + esc(user.username) + ' · ' + esc(t(user.role)) + '</div>' +
      '<button class="btn btn-secondary btn-sm" style="margin-top:7px" data-avatar>' + icon('image') + esc(t('changeAvatar')) + '</button></div></div>' +
      '<div class="field-grid">' +
        '<div class="field"><label>' + esc(t('name')) + '</label><input class="input" id="setName" value="' + esc(user.name) + '"></div>' +
        '<div class="field"><label>Name (EN)</label><input class="input" id="setNameEn" value="' + esc(user.name_en || '') + '" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(t('email')) + '</label><input class="input" id="setEmail" type="email" value="' + esc(user.email || '') + '" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(t('phone')) + '</label><input class="input" id="setPhone" value="' + esc(user.phone || '') + '" style="direction:ltr"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" data-save-profile>' + icon('check') + esc(t('saveChanges')) + '</button></div>' +
      '</div></div>';
  }

  function platformSection() {
    var s = DS.data.settings;
    return '<div class="card"><div class="card-header"><div class="card-title">' + esc(DS.lang() === 'en' ? 'Platform settings' : 'إعدادات المنصة') + '</div><span class="badge lime">' + esc(t('admin')) + '</span></div><div class="card-body">' +
      '<div class="field-grid">' +
        '<div class="field"><label>' + esc(t('platformOverview')) + '</label><input class="input" id="plName" value="' + esc(s.platform_name) + '"></div>' +
        '<div class="field"><label>WhatsApp</label><input class="input" id="plWa" value="' + esc(s.whatsapp) + '" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(t('email')) + '</label><input class="input" id="plEmail" value="' + esc(s.support_email) + '" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(t('delivery')) + ' (EGP)</label><input class="input" id="plFee" type="number" value="' + esc(s.default_delivery_fee) + '"></div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">' +
        toggle('plMaint', DS.lang() === 'en' ? 'Maintenance mode' : 'وضع الصيانة', DS.lang() === 'en' ? 'Hide the storefront while you deploy updates.' : 'إخفاء المتجر أثناء تحديثات النظام.', s.maintenance) +
        toggle('plSignup', DS.lang() === 'en' ? 'Allow new stores' : 'السماح بمتاجر جديدة', DS.lang() === 'en' ? 'New store registration is open.' : 'تسجيل المتاجر الجديدة متاح.', s.allow_signups) +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" data-save-platform>' + icon('check') + esc(t('saveSettings')) + '</button></div>' +
      '</div></div>';
  }

  function storeSection() {
    var tn = DS.data.tenantById(user.tenant_id);
    if (!tn) return DS.empty({ icon: 'store', title: t('noData'), text: '' });
    var sub = DS.data.activeSubscription(tn.id);
    return '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('storeProfile')) + '</div><span class="badge ' + (sub && sub.daysLeft <= 15 ? 'warning' : 'success') + '">' + esc(t(tn.plan)) + ' · ' + Math.max(0, sub ? sub.daysLeft : 0) + ' ' + esc(t('daysLeft')) + '</span></div><div class="card-body">' +
      '<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px"><img src="' + esc(DS.avatarUrl(tn)) + '" alt="" style="width:64px;height:64px;border-radius:16px;object-fit:cover;border:2px solid var(--border)">' +
      '<div><div style="font-weight:600">' + esc(tn.name) + '</div><div style="font-size:11px;color:var(--text-tertiary)">' + esc(DS.loc(tn, 'industry')) + ' · ' + esc(DS.loc(tn, 'city')) + '</div>' +
      '<button class="btn btn-secondary btn-sm" style="margin-top:7px" data-avatar>' + icon('image') + esc(t('logoAvatar')) + '</button></div></div>' +
      '<div class="field-grid">' +
        '<div class="field"><label>' + esc(t('storeName')) + '</label><input class="input" id="stName" value="' + esc(tn.name) + '"></div>' +
        '<div class="field"><label>Name (EN)</label><input class="input" id="stNameEn" value="' + esc(tn.name_en || '') + '" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(t('storePhone')) + '</label><input class="input" id="stPhone" value="' + esc(tn.phone) + '" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(t('city')) + '</label><input class="input" id="stCity" value="' + esc(tn.city) + '"></div>' +
        '<div class="field"><label>' + esc(t('storeAddress')) + '</label><input class="input" id="stAddr" value="' + esc(tn.address) + '"></div>' +
        '<div class="field"><label>' + esc(t('delivery')) + ' (EGP)</label><input class="input" id="stFee" type="number" value="' + esc(tn.delivery_fee) + '"></div>' +
        '<div class="field" style="grid-column:1/-1"><label>' + esc(t('storeDesc')) + '</label><textarea class="textarea" id="stDesc" rows="2">' + esc(tn.description || '') + '</textarea></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:10px;flex-wrap:wrap">' +
        '<a class="btn btn-ghost btn-sm" href="' + url('owner/subscriptions.html') + '">' + icon('card') + esc(t('subscriptions')) + '</a>' +
        '<button class="btn btn-primary" data-save-store>' + icon('check') + esc(t('saveChanges')) + '</button></div>' +
      '</div></div>';
  }

  function prefsSection() {
    var langNow = DS.lang(), themeNow = DS.theme();
    return '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('preferences')) + '</div></div><div class="card-body">' +
      '<div class="field-grid">' +
        '<div class="field"><label>' + esc(t('language')) + '</label><select class="select" id="prefLang"><option value="ar"' + (langNow === 'ar' ? ' selected' : '') + '>العربية</option><option value="en"' + (langNow === 'en' ? ' selected' : '') + '>English</option></select></div>' +
        '<div class="field"><label>' + esc(t('theme')) + '</label><select class="select" id="prefTheme"><option value="dark"' + (themeNow === 'dark' ? ' selected' : '') + '>' + esc(DS.lang() === 'en' ? 'Dark' : 'داكن') + '</option><option value="light"' + (themeNow === 'light' ? ' selected' : '') + '>' + esc(DS.lang() === 'en' ? 'Light' : 'فاتح') + '</option></select></div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">' +
        toggle('prefNotif', DS.lang() === 'en' ? 'Order notifications' : 'إشعارات الطلبات', DS.lang() === 'en' ? 'Show a badge for new orders.' : 'إظهار شارة للطلبات الجديدة.', DS.store.get('ds_pref_notif', true)) +
        toggle('prefSound', DS.lang() === 'en' ? 'Sound alerts' : 'تنبيهات صوتية', DS.lang() === 'en' ? 'Play a soft sound for new activity.' : 'تشغيل صوت خفيف عند وجود نشاط جديد.', DS.store.get('ds_pref_sound', false)) +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" data-save-prefs>' + icon('check') + esc(t('saveSettings')) + '</button></div>' +
      '</div></div>';
  }

  function securitySection() {
    return '<div class="card"><div class="card-header"><div class="card-title">' + esc(t('security')) + '</div></div><div class="card-body">' +
      '<div class="field-grid">' +
        '<div class="field"><label>' + esc(DS.lang() === 'en' ? 'Current password' : 'كلمة المرور الحالية') + '</label><input class="input" id="secOld" type="password" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(DS.lang() === 'en' ? 'New password' : 'كلمة المرور الجديدة') + '</label><input class="input" id="secNew" type="password" style="direction:ltr"></div>' +
        '<div class="field"><label>' + esc(DS.lang() === 'en' ? 'Confirm new password' : 'تأكيد كلمة المرور') + '</label><input class="input" id="secNew2" type="password" style="direction:ltr"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btn-primary" data-save-pass>' + icon('key') + esc(t('saveChanges')) + '</button></div>' +
      '</div></div>' +
      '<div class="card" style="border-color:rgba(255,69,58,.35)"><div class="card-header"><div class="card-title" style="color:var(--danger)">' + esc(DS.lang() === 'en' ? 'Danger zone' : 'منطقة الخطر') + '</div></div><div class="card-body">' +
      '<p style="font-size:12px;color:var(--text-secondary);line-height:1.7;margin-bottom:12px">' + esc(DS.lang() === 'en' ? 'Reset the demo database back to its original seed. All local changes will be lost.' : 'إعادة قاعدة البيانات التجريبية لحالتها الأصلية. كل التغييرات المحلية ستُفقد.') + '</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-danger" data-reset>' + icon('refresh') + esc(DS.lang() === 'en' ? 'Reset demo data' : 'إعادة تعيين البيانات') + '</button>' +
      '<button class="btn btn-secondary" data-logout>' + icon('logout') + esc(t('logout')) + '</button></div></div></div>';
  }

  function toggle(id, title, desc, checked) {
    return '<label class="check" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border:1px solid var(--border);border-radius:var(--radius-md)">' +
      '<span><b style="display:block;font-size:12px;color:var(--text-primary)">' + esc(title) + '</b><span style="font-size:11px;color:var(--text-tertiary)">' + esc(desc) + '</span></span>' +
      '<input type="checkbox" id="' + id + '" ' + (checked ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--lime)"></label>';
  }

  function bind() {
    DS.$$('[data-tab]', page.body).forEach(function (b) { b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); render(); }); });
    DS.$$('[data-avatar]', page.body).forEach(function (b) { b.addEventListener('click', function () { DS.avatarPicker(); }); });
    var saveProfile = page.body.querySelector('[data-save-profile]');
    if (saveProfile) saveProfile.addEventListener('click', function () {
      var name = page.body.querySelector('#setName').value.trim();
      if (!name) { DS.toast(t('required'), 'error'); return; }
      var patch = { id: user.id, name: name, name_en: page.body.querySelector('#setNameEn').value.trim() || name, email: page.body.querySelector('#setEmail').value.trim(), phone: page.body.querySelector('#setPhone').value.trim() };
      DS.data.saveUser(patch);
      var fresh = DS.data.userById(user.id);
      delete fresh.password;
      localStorage.setItem('cz_user', JSON.stringify(fresh));
      DS.toast(t('settingsSaved'), 'success');
      DS.shell.refreshUser();
      render();
    });
    var saveStore = page.body.querySelector('[data-save-store]');
    if (saveStore) saveStore.addEventListener('click', function () {
      var tn = DS.data.tenantById(user.tenant_id);
      DS.data.saveTenant({
        id: tn.id, name: page.body.querySelector('#stName').value.trim() || tn.name,
        name_en: page.body.querySelector('#stNameEn').value.trim() || tn.name,
        phone: page.body.querySelector('#stPhone').value.trim(), city: page.body.querySelector('#stCity').value.trim(),
        address: page.body.querySelector('#stAddr').value.trim(), delivery_fee: Number(page.body.querySelector('#stFee').value) || 30,
        description: page.body.querySelector('#stDesc').value.trim()
      });
      DS.toast(t('settingsSaved'), 'success');
      render();
    });
    var savePlatform = page.body.querySelector('[data-save-platform]');
    if (savePlatform) savePlatform.addEventListener('click', function () {
      DS.data.saveSettings({
        platform_name: page.body.querySelector('#plName').value.trim() || 'DotStudio® POS',
        whatsapp: page.body.querySelector('#plWa').value.trim(),
        support_email: page.body.querySelector('#plEmail').value.trim(),
        default_delivery_fee: Number(page.body.querySelector('#plFee').value) || 30,
        maintenance: page.body.querySelector('#plMaint').checked,
        allow_signups: page.body.querySelector('#plSignup').checked
      });
      DS.toast(t('settingsSaved'), 'success');
      render();
    });
    var savePrefs = page.body.querySelector('[data-save-prefs]');
    if (savePrefs) savePrefs.addEventListener('click', function () {
      var nextLang = page.body.querySelector('#prefLang').value;
      var nextTheme = page.body.querySelector('#prefTheme').value;
      DS.store.set('ds_pref_notif', page.body.querySelector('#prefNotif').checked);
      DS.store.set('ds_pref_sound', page.body.querySelector('#prefSound').checked);
      try { localStorage.setItem('ds_theme', nextTheme); } catch (e) {}
      DS.applyTheme();
      if (nextLang !== DS.lang()) { DS.setLang(nextLang); setTimeout(function () { location.reload(); }, 60); return; }
      DS.toast(t('settingsSaved'), 'success');
      render();
    });
    var savePass = page.body.querySelector('[data-save-pass]');
    if (savePass) savePass.addEventListener('click', function () {
      var oldP = page.body.querySelector('#secOld').value;
      var np = page.body.querySelector('#secNew').value;
      var np2 = page.body.querySelector('#secNew2').value;
      var dbUser = DS.data.users.filter(function (u) { return u.id === user.id; })[0];
      if (!dbUser || dbUser.password !== oldP) { DS.toast(t('invalidLogin'), 'error'); return; }
      if (np.length < 6) { DS.toast(t('required'), 'error'); return; }
      if (np !== np2) { DS.toast(t('required'), 'error'); return; }
      DS.data.saveUser({ id: user.id, password: np });
      DS.toast(t('settingsSaved'), 'success');
      render();
    });
    var reset = page.body.querySelector('[data-reset]');
    if (reset) reset.addEventListener('click', function () {
      DS.confirm({ title: t('confirmDelete'), text: t('confirmDeleteText'), danger: true }).then(function (ok) {
        if (ok) DS.data.reset();
      });
    });
    DS.$$('[data-logout]', page.body).forEach(function (b) { b.addEventListener('click', function () { DS.logout(); }); });
  }

  setTimeout(render, 150);
})();
