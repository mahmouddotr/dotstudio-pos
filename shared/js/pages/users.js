/* DotStudio® POS — Users directory · God Mode · advanced CRUD */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon;
  var page = DS.shell.mount({
    roles: ['superadmin'],
    active: 'users',
    title: t('users'),
    eyebrow: t('admin'),
    icon: 'users',
    sub: DS.lang() === 'en'
      ? 'Every account in one place — log in as any user, duplicate, suspend or delete.'
      : 'كل الحسابات في مكان واحد — ادخل كأي مستخدم، انسخ، أوقف أو احذف.',
    actions: '<button type="button" class="btn btn-primary" data-quick-add>' + icon('userPlus') + ' ' + esc(DS.lang() === 'en' ? 'Quick add' : 'إضافة سريعة') + '</button>' +
      '<span class="badge lime">' + icon('shield') + ' ' + esc(DS.lang() === 'en' ? 'God mode' : 'وضع الإدارة') + '</span>',
    content: DS.skeleton.rows(6)
  });
  if (!page) return;

  var ROLES = ['superadmin', 'subadmin', 'owner', 'cashier', 'delivery', 'customer'];
  var state = { q: '', role: 'all' };
  var menuEl = null;

  function closeMenu() {
    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
    menuEl = null;
  }
  document.addEventListener('click', function (e) {
    if (menuEl && !menuEl.contains(e.target)) closeMenu();
  });
  window.addEventListener('resize', closeMenu);

  function storeOf(u) {
    if (u.role === 'delivery' && u.delivery_company) {
      var co = (DS.data.companies || []).filter(function (c) { return c.id === u.delivery_company; })[0];
      return co ? DS.loc(co, 'name') : (u.delivery_company_name || '—');
    }
    if (u.tenant_id) {
      var tn = DS.data.tenantById(u.tenant_id);
      return tn ? DS.loc(tn, 'name') : '—';
    }
    return '—';
  }

  function roleLabel(u) {
    return t(u.role === 'superadmin' ? 'admin' : u.role);
  }

  function list() {
    var q = state.q.trim().toLowerCase();
    return DS.data.users.filter(function (u) {
      if (state.role !== 'all' && u.role !== state.role) return false;
      if (!q) return true;
      return String(u.name || '').toLowerCase().indexOf(q) > -1 ||
        String(u.name_en || '').toLowerCase().indexOf(q) > -1 ||
        String(u.username || '').toLowerCase().indexOf(q) > -1 ||
        String(u.email || '').toLowerCase().indexOf(q) > -1 ||
        String(storeOf(u)).toLowerCase().indexOf(q) > -1;
    });
  }

  function stat(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span><span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div><div class="stat-value" style="font-size:26px">' + value + '</div></div>';
  }

  function render() {
    var all = DS.data.users;
    var users = list();
    var me = DS.session() || {};
    var active = all.filter(function (u) { return u.is_active !== false; }).length;
    var suspended = all.length - active;

    var stats = '<div class="kpi-grid">' +
      stat(t('users'), all.length, 'users', 'lime') +
      stat(t('active'), active, 'checkCircle', 'green') +
      stat(t('inactive'), suspended, 'pause', 'warning') +
      stat(t('sub-admins'), all.filter(function (u) { return u.role === 'subadmin'; }).length, 'shield', 'purple') +
      '</div>';

    var filters = '<div class="card"><div class="card-body user-filters">' +
      '<div class="user-search">' + icon('search') +
        '<input class="input" data-user-q value="' + esc(state.q) + '" placeholder="' + esc(t('search')) + '…" aria-label="' + esc(t('search')) + '">' +
      '</div>' +
      '<select class="select" data-user-role aria-label="' + esc(t('role')) + '">' +
        '<option value="all"' + (state.role === 'all' ? ' selected' : '') + '>' + esc(t('allRoles')) + '</option>' +
        ROLES.map(function (r) {
          return '<option value="' + r + '"' + (state.role === r ? ' selected' : '') + '>' + esc(t(r === 'superadmin' ? 'admin' : r)) + '</option>';
        }).join('') + '</select>' +
      '<span class="badge neutral">' + users.length + '</span>' +
      '</div></div>';

    var table = '<div class="card"><div class="card-header"><div><div class="card-title">' + esc(t('users')) + '</div>' +
      '<div class="card-subtitle">' + esc(DS.lang() === 'en' ? 'Login as any account, or manage it from the ⋮ menu.' : 'ادخل كأي حساب، أو أدره من قائمة ⋮.') + '</div></div></div>' +
      '<div class="table-wrap flush"><table class="table"><thead><tr>' +
        '<th>' + esc(t('name')) + '</th><th>' + esc(t('role')) + '</th><th>' + esc(t('store')) + '</th>' +
        '<th>' + esc(t('status')) + '</th><th>' + esc(t('actions')) + '</th>' +
      '</tr></thead><tbody>' +
      (users.length ? users.map(function (u) {
        var isMe = u.id === me.id;
        return '<tr>' +
          '<td><div class="customer-cell"><img class="avatar sm" src="' + esc(DS.avatarUrl(u)) + '" alt="">' +
            '<div><div class="cell-title">' + esc(DS.loc(u, 'name')) + (isMe ? ' <span class="badge lime">' + esc(DS.lang() === 'en' ? 'You' : 'أنت') + '</span>' : '') + '</div>' +
            '<div class="cell-sub" style="direction:ltr;text-align:start">@' + esc(u.username) + '</div></div></div></td>' +
          '<td><span class="badge neutral">' + esc(roleLabel(u)) + '</span></td>' +
          '<td style="font-size:12px;color:var(--text-secondary)">' + esc(storeOf(u)) + '</td>' +
          '<td>' + (u.is_active === false ? DS.badge('suspended', t('inactive')) : DS.badge('active', t('active'))) + '</td>' +
          '<td><div class="user-row-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" data-login-as="' + esc(u.id) + '"' + (isMe || u.is_active === false ? ' disabled' : '') + '>' + icon('logout') + esc(t('loginAs')) + '</button>' +
            '<button type="button" class="btn btn-ghost btn-sm user-menu-btn" data-menu="' + esc(u.id) + '" aria-label="menu">' + icon('more') + '</button>' +
          '</div></td></tr>';
      }).join('') : '<tr><td colspan="5">' + DS.empty({ icon: 'users', title: t('noData'), text: t('searchPlaceholder') }) + '</td></tr>') +
      '</tbody></table></div></div>';

    var hint = '<div class="card"><div class="card-body" style="display:flex;gap:10px;align-items:flex-start;font-size:12px;color:var(--text-tertiary);line-height:1.7">' +
      '<span class="stat-icon purple" style="flex-shrink:0">' + icon('shield') + '</span>' +
      '<div><b style="color:var(--text-secondary);display:block;margin-bottom:2px">' + esc(t('loginAs')) + '</b>' + esc(t('loginAsText')) + '</div></div></div>';

    page.setContent(stats + filters + table + hint);
    bind();
  }

  function menuFor(u) {
    var isMe = (DS.session() || {}).id === u.id;
    var items = '';
    if (!isMe) {
      items += '<button type="button" class="dropdown-item' + (u.is_active === false ? '' : ' warn') + '" data-act="toggle">' +
        icon(u.is_active === false ? 'play' : 'pause') +
        esc(u.is_active === false ? t('activateUser') : t('suspendUser')) + '</button>';
    }
    items += '<button type="button" class="dropdown-item" data-act="duplicate">' + icon('copy') + esc(t('duplicate')) + '</button>';
    if (!isMe) {
      items += '<div class="dropdown-sep"></div>' +
        '<button type="button" class="dropdown-item danger" data-act="delete">' + icon('trash') + esc(t('deleteForever')) + '</button>';
    }
    return items;
  }

  function openMenu(btn, u) {
    closeMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'ds-row-menu dropdown-menu';
    menuEl.innerHTML = '<div class="dropdown-head">' + esc(DS.loc(u, 'name')) + ' · @' + esc(u.username) + '</div>' + menuFor(u);
    document.body.appendChild(menuEl);
    var r = btn.getBoundingClientRect();
    var w = 226;
    var left = Math.min(window.innerWidth - w - 10, Math.max(10, r.right - w));
    menuEl.style.position = 'fixed';
    menuEl.style.width = w + 'px';
    menuEl.style.left = left + 'px';
    menuEl.style.top = Math.round(r.bottom + 6) + 'px';
    menuEl.style.zIndex = '5000';
    menuEl.style.display = 'block';

    DS.$$('[data-act]', menuEl).forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var act = b.getAttribute('data-act');
        closeMenu();
        if (act === 'toggle') toggleUser(u);
        else if (act === 'duplicate') duplicateUser(u);
        else if (act === 'delete') deleteUser(u);
      });
    });
    return menuEl;
  }

  /* ───────────────────── QUICK ADD (admin) ───────────────────── */
  /* Name · Username · Password · Role → users array with tenant_id. */
  function openQuickAdd() {
    var en = DS.lang() === 'en';
    var tenants = DS.data.tenants || [];
    var storeOpts = tenants.map(function (tn) {
      return '<option value="' + esc(tn.id) + '">' + esc(DS.loc(tn, 'name')) + '</option>';
    }).join('');
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(en ? 'Full name' : 'الاسم بالكامل') + ' *</label>' +
        '<input class="input" id="qaName" maxlength="60" placeholder="' + esc(en ? 'Mahmoud Ali' : 'محمود علي') + '"></div>' +
      '<div class="field"><label>' + esc(en ? 'Username' : 'اسم المستخدم') + ' *</label>' +
        '<input class="input" id="qaUser" dir="ltr" maxlength="32" placeholder="owner2026"></div>' +
      '<div class="field"><label>' + esc(en ? 'Password' : 'كلمة المرور') + ' *</label>' +
        '<input class="input" id="qaPass" dir="ltr" type="password" maxlength="64" autocomplete="new-password" placeholder="••••••••"></div>' +
      '<div class="field"><label>' + esc(en ? 'Role' : 'الدور') + '</label>' +
        '<select class="select" id="qaRole">' +
          '<option value="owner">' + esc(en ? 'Owner' : 'صاحب متجر') + '</option>' +
          '<option value="cashier">' + esc(en ? 'Cashier' : 'كاشير') + '</option>' +
          '<option value="delivery">' + esc(en ? 'Driver' : 'مندوب') + '</option>' +
        '</select></div>' +
      '<div class="field" id="qaStoreField" style="display:none"><label>' + esc(en ? 'Store' : 'المتجر') + ' *</label>' +
        '<select class="select" id="qaStore">' + storeOpts + '</select></div>' +
      '</div>' +
      '<p style="font-size:11px;color:var(--text-tertiary);margin-top:6px">' + icon('shield') + ' ' +
        esc(en ? 'A tenant_id is generated automatically for every new owner.' : 'يتم توليد tenant_id تلقائياً لكل صاحب متجر جديد.') + '</p>';

    DS.modal({
      title: icon('userPlus') + ' ' + esc(en ? 'Quick add' : 'إضافة سريعة'),
      sub: esc(en ? 'Name, username, password and role — ready in seconds.' : 'الاسم، اسم المستخدم، كلمة المرور والدور — في ثوانٍ.'),
      size: 'md',
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('save'), variant: 'btn-primary', icon: icon('check'), close: false, onClick: function (root, close) {
            var name = (root.querySelector('#qaName').value || '').trim();
            var username = (root.querySelector('#qaUser').value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
            var pass = root.querySelector('#qaPass').value || '';
            var role = root.querySelector('#qaRole').value;
            var storeEl = root.querySelector('#qaStore');
            var tenantId = role === 'owner' ? ('tenant_' + Date.now()) : (storeEl ? storeEl.value : '');
            if (!name || !username || pass.length < 6) {
              DS.toast(en ? 'Name, username and a 6+ character password are required' : 'الاسم واسم المستخدم وكلمة مرور 6 أحرف مطلوبة', 'error');
              return false;
            }
            if (DS.data.users.some(function (u) { return String(u.username || '').toLowerCase() === username; })) {
              DS.toast(en ? 'Username already used' : 'اسم المستخدم مستخدم بالفعل', 'error');
              return false;
            }
            DS.data.addUser({
              username: username,
              password: pass,
              role: role,
              name: name,
              name_en: name,
              tenant_id: tenantId,
              avatar_id: role === 'delivery' ? 'av3' : (role === 'owner' ? 'av1' : 'av6'),
              is_active: true
            });
            DS.toast(en ? 'Account created' : 'تم إنشاء الحساب', 'success');
            window.dispatchEvent(new CustomEvent('ds:data-changed'));
            render();
            if (close) close();
            return true;
          } }
      ],
      onMount: function (root) {
        var roleSel = root.querySelector('#qaRole');
        var field = root.querySelector('#qaStoreField');
        function sync() { if (field) field.style.display = roleSel && roleSel.value === 'owner' ? 'none' : ''; }
        if (roleSel) roleSel.addEventListener('change', sync);
        sync();
      }
    });
  }

  function bind() {
    var q = page.body.querySelector('[data-user-q]');
    if (q) {
      q.addEventListener('input', DS.debounce(function () {
        state.q = q.value;
        var pos = q.selectionStart;
        render();
        var next = page.body.querySelector('[data-user-q]');
        if (next) { next.focus(); try { next.setSelectionRange(pos, pos); } catch (e) {} }
      }, 220));
    }
    var role = page.body.querySelector('[data-user-role]');
    if (role) role.addEventListener('change', function () { state.role = role.value; render(); });

    DS.$$('[data-login-as]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { loginAs(b.getAttribute('data-login-as')); });
    });
    DS.$$('[data-menu]', page.body).forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var u = DS.data.userById(b.getAttribute('data-menu'));
        if (!u) return;
        if (menuEl && menuEl.getAttribute('data-for') === u.id) { closeMenu(); return; }
        openMenu(b, u);
        menuEl.setAttribute('data-for', u.id);
      });
    });
  }

  function loginAs(id) {
    var res = DS.impersonate(id);
    if (!res || !res.ok) {
      var msg = res && res.error === 'store_suspended' ? t('storeSuspended')
        : res && res.error === 'suspended' ? t('inactive') : t('noPermission');
      DS.toast(msg, 'error');
      return;
    }
    DS.toast(t('loginAs') + ' · ' + DS.loc(res.user, 'name'), 'success');
    setTimeout(function () { window.location.href = DS.url(res.redirect); }, 260);
  }

  function toggleUser(u) {
    var next = u.is_active === false;
    DS.data.setUserActive(u.id, next);
    DS.toast(next ? t('userActivated') : t('userSuspended'), 'success');
    render();
  }

  function duplicateUser(u) {
    var copy = DS.data.duplicateUser(u.id);
    if (!copy) { DS.toast(t('noPermission'), 'error'); return; }
    DS.toast(t('userDuplicated') + ' · @' + copy.username, 'success');
    render();
  }

  function deleteUser(u) {
    DS.confirm({
      title: t('deleteForever'),
      text: (DS.lang() === 'en' ? 'This permanently removes ' : 'سيتم حذف ') + DS.loc(u, 'name') + (DS.lang() === 'en' ? ' and cannot be undone.' : ' نهائياً ولا يمكن الرجوع.'),
      danger: true,
      confirmText: t('deleteForever')
    }).then(function (ok) {
      if (!ok) return;
      var done = DS.data.deleteUser(u.id);
      if (!done) { DS.toast(t('noPermission'), 'error'); return; }
      DS.toast(t('userDeleted'), 'success');
      render();
    });
  }

  var quickBtn = page.actions && page.actions.querySelector('[data-quick-add]');
  if (quickBtn) quickBtn.addEventListener('click', openQuickAdd);

  render();
})();
