/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — APPLICATION SHELL
   Role-aware sidebar, topbar, notifications, user menu, guards.
   Every page calls DS.shell.mount({ ... }).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before shell.js'); return; }

  var t = DS.t, icon = DS.icon, esc = DS.esc, url = DS.url;

  /* ─────────────────────────── NAVIGATION ─────────────────────────── */
  var NAV = {
    superadmin: [
      { section: 'workspace' },
      { key: 'dashboard', href: 'admin/dashboard.html', icon: 'dashboard' },
      { section: 'operations' },
      { key: 'orders', href: 'admin/orders.html', icon: 'orders', badge: 'pending' },
      { key: 'products', href: 'admin/products.html', icon: 'box' },
      { key: 'stores', href: 'admin/stores.html', icon: 'store' },
      { key: 'customers', href: 'admin/customers.html', icon: 'users' },
      { key: 'cashiers', href: 'admin/cashiers.html', icon: 'cashier' },
      { key: 'delivery-companies', href: 'admin/delivery-companies.html', icon: 'truck' },
      { key: 'sub-admins', href: 'admin/sub-admins.html', icon: 'shield' },
      { section: 'growth' },
      { key: 'reports', href: 'admin/reports.html', icon: 'chart' },
      { key: 'subscriptions', href: 'admin/subscriptions.html', icon: 'card' },
      { key: 'jobs', href: 'admin/jobs.html', icon: 'jobs' },
      { key: 'audit', href: 'admin/audit-logs.html', icon: 'activity' },
      { section: 'communication' },
      { key: 'chats', href: 'admin/chats.html', icon: 'chat' },
      { section: 'system' },
      { key: 'settings', href: 'admin/settings.html', icon: 'settings' }
    ],
    subadmin: [
      { section: 'workspace' },
      { key: 'dashboard', href: 'admin/dashboard.html', icon: 'dashboard' },
      { section: 'operations' },
      { key: 'orders', href: 'admin/orders.html', icon: 'orders', perm: 'orders' },
      { key: 'products', href: 'admin/products.html', icon: 'box', perm: 'products' },
      { key: 'stores', href: 'admin/stores.html', icon: 'store', perm: 'stores' },
      { key: 'customers', href: 'admin/customers.html', icon: 'users', perm: 'customers' },
      { key: 'cashiers', href: 'admin/cashiers.html', icon: 'cashier', perm: 'cashiers' },
      { key: 'delivery-companies', href: 'admin/delivery-companies.html', icon: 'truck', perm: 'delivery-companies' },
      { section: 'growth' },
      { key: 'reports', href: 'admin/reports.html', icon: 'chart', perm: 'reports' },
      { key: 'subscriptions', href: 'admin/subscriptions.html', icon: 'card', perm: 'subscriptions' },
      { key: 'jobs', href: 'admin/jobs.html', icon: 'jobs', perm: 'jobs' },
      { key: 'audit', href: 'admin/audit-logs.html', icon: 'activity', perm: 'audit' },
      { section: 'communication' },
      { key: 'chats', href: 'admin/chats.html', icon: 'chat', perm: 'chats' },
      { section: 'system' },
      { key: 'settings', href: 'admin/settings.html', icon: 'settings' }
    ],
    owner: [
      { section: 'workspace' },
      { key: 'dashboard', href: 'owner/dashboard.html', icon: 'dashboard' },
      { key: 'orders', href: 'owner/orders.html', icon: 'orders', badge: 'pending' },
      { key: 'products', href: 'owner/products.html', icon: 'box' },
      { key: 'customers', href: 'owner/customers.html', icon: 'users' },
      { section: 'growth' },
      { key: 'reports', href: 'owner/reports.html', icon: 'chart' },
      { key: 'subscriptions', href: 'owner/subscriptions.html', icon: 'card' },
      { key: 'jobs', href: 'admin/jobs.html', icon: 'jobs' },
      { section: 'team' },
      { key: 'cashiers', href: 'owner/cashiers.html', icon: 'cashier' },
      { key: 'delivery-companies', href: 'owner/delivery-companies.html', icon: 'truck' },
      { section: 'communication' },
      { key: 'chats', href: 'owner/messages.html', icon: 'chat' },
      { section: 'system' },
      { key: 'settings', href: 'owner/settings.html', icon: 'settings' }
    ],
    cashier: [
      { section: 'workspace' },
      { key: 'pos', href: 'cashier/pos.html', icon: 'cashier' },
      { key: 'orders', href: 'cashier/orders.html', icon: 'orders' },
      { key: 'invoices', href: 'cashier/invoices.html', icon: 'receipt' },
      { key: 'chats', href: 'owner/messages.html', icon: 'chat' },
      { section: 'system' },
      { key: 'settings', href: 'cashier/settings.html', icon: 'settings' }
    ],
    delivery: [
      { section: 'workspace' },
      { key: 'dashboard', href: 'delivery/dashboard.html', icon: 'dashboard' },
      { key: 'orders', href: 'delivery/orders.html', icon: 'orders', badge: 'delivering' },
      { key: 'tracking', href: 'delivery/tracking.html', icon: 'mapPin' },
      { key: 'chats', href: 'delivery/messages.html', icon: 'chat' }
    ],
    customer: [
      { section: 'workspace' },
      { key: 'storefront', href: 'customer/storefront.html', icon: 'store' },
      { key: 'my-orders', href: 'customer/my-orders.html', icon: 'orders' },
      { key: 'tracking', href: 'customer/tracking.html', icon: 'truck' },
      { section: 'community' },
      { key: 'chats', href: 'auth/public-chat.html', icon: 'chat' }
    ]
  };

  var WORKSPACE_LABEL = { superadmin: 'platform', subadmin: 'platform', owner: 'store', cashier: 'store', delivery: 'company', customer: 'store' };

  function permissionsOf(user) {
    if (!user) return [];
    if (user.role === 'superadmin') return DS.data ? DS.data.PERMISSIONS_ALL : [];
    if (user.role === 'subadmin') {
      var stored = DS.store.get('ds_permissions', null);
      return (user.permissions || stored || []);
    }
    return [];
  }

  function hasPermission(user, perm) {
    if (!user) return false;
    if (user.role === 'superadmin' || user.role === 'owner' || user.role === 'cashier') return true;
    if (user.role === 'subadmin') return permissionsOf(user).indexOf(perm) > -1;
    return false;
  }

  function navFor(user) {
    if (!user) return [];
    var items = NAV[user.role === 'subadmin' ? 'subadmin' : user.role] || [];
    if (user.role !== 'subadmin') return items;
    return items.filter(function (n) {
      if (n.section) return true;
      return !n.perm || hasPermission(user, n.perm);
    }).filter(function (n, i, arr) {
      if (!n.section) return true;
      var next = arr[i + 1];
      return next && !next.section;
    });
  }

  function navItemsFlat(user) {
    user = user || DS.session();
    return navFor(user).filter(function (n) { return n.key; }).map(function (n) {
      return {
        key: n.key,
        label: t(n.key),
        href: url(n.href),
        icon: n.icon,
        sub: t(WORKSPACE_LABEL[user.role] || 'workspace')
      };
    });
  }

  function hrefFor(key) {
    var user = DS.session();
    var all = NAV[user && user.role === 'subadmin' ? 'subadmin' : (user && user.role) || 'superadmin'] || [];
    var found = all.filter(function (n) { return n.key === key; })[0];
    return found ? url(found.href) : url(DS.roleHome(user));
  }

  /* ───────────────────────────── BADGES ───────────────────────────── */
  function navBadgeCount(key, user) {
    if (!DS.data || !user) return 0;
    try {
      if (key === 'orders' && user.role !== 'delivery') return DS.data.visibleOrders(user).filter(function (o) { return o.status === 'pending'; }).length;
      if (key === 'orders' && user.role === 'delivery') return DS.data.visibleOrders(user).filter(function (o) { return o.status === 'delivering'; }).length;
    } catch (e) {}
    return 0;
  }

  /* ───────────────────────────── HELPERS ──────────────────────────── */
  function displayName(entity) {
    if (!entity) return '';
    return DS.lang() === 'en' ? (entity.name_en || entity.name || '') : (entity.name || entity.name_en || '');
  }

  function workspaceEntity(user) {
    if (!DS.data) return user;
    if (user.role === 'owner' || user.role === 'cashier' || user.role === 'customer') {
      var tn = DS.data.tenantById(user.tenant_id || DS.data.currentStoreId(user));
      return tn || user;
    }
    if (user.role === 'delivery') {
      var dc = (DS.data.companies || []).filter(function (c) { return c.id === user.delivery_company; })[0];
      return dc || user;
    }
    return null;
  }

  function workspaceMarkup(user) {
    var entity = workspaceEntity(user);
    var name = displayName(user) || displayName(entity) || t('profile');
    var roleLabel = t(user.role === 'superadmin' ? 'admin' : user.role);
    var sub = roleLabel;
    if (entity && entity !== user) {
      var storeName = displayName(entity);
      if (storeName && storeName !== name) sub = roleLabel + ' · ' + storeName;
    }
    var avatar = '<img class="avatar" src="' + esc(DS.avatarUrl(user)) + '" alt="">';
    return '<button class="ds-workspace" data-workspace type="button" aria-label="' + esc(t('profileTitle')) + '">' + avatar +
      '<div class="ds-workspace-info"><div class="ds-workspace-name">' + esc(name) + '</div><div class="ds-workspace-role">' + esc(sub) + '</div></div>' +
      icon('chevronDown') + '</button>';
  }

  /* Profile sheet — never logs the user out, never navigates away. */
  function openProfile() {
    var user = DS.session();
    if (!user) return;
    var entity = workspaceEntity(user);
    var rows = [];
    rows.push([t('username'), user.username || '—']);
    rows.push([t('role'), t(user.role === 'superadmin' ? 'admin' : user.role)]);
    if (entity && entity !== user) rows.push([user.role === 'delivery' ? t('deliveryCompany') : t('store'), displayName(entity)]);
    if (user.phone) rows.push([t('phone'), user.phone]);
    if (user.email) rows.push([t('email'), user.email]);
    if (user.city) rows.push([t('city'), DS.loc(user, 'city')]);

    var body = '<div class="ds-profile">' +
      '<div class="ds-profile-top">' +
        '<img class="ds-profile-avatar" src="' + esc(DS.avatarUrl(user)) + '" alt="">' +
        '<div class="ds-profile-id"><b>' + esc(displayName(user)) + '</b><span>' + esc(t(user.role === 'superadmin' ? 'admin' : user.role)) + (entity && entity !== user ? ' · ' + esc(displayName(entity)) : '') + '</span></div>' +
        '<span class="ds-profile-live"><i></i>' + esc(t('online')) + '</span>' +
      '</div>' +
      '<div class="ds-profile-rows">' + rows.map(function (r) {
        return '<div class="ds-profile-row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
      }).join('') + '</div>' +
      '<div class="ds-profile-actions">' +
        '<button type="button" class="btn btn-secondary" data-profile-avatar>' + icon('image') + esc(t('changeAvatar')) + '</button>' +
        '<button type="button" class="btn btn-danger" data-profile-logout>' + icon('logout') + esc(t('logout')) + '</button>' +
      '</div></div>';

    var m = DS.modal({
      size: 'sm',
      title: esc(t('profileTitle')),
      sub: esc(t('profileSettings')),
      body: body,
      actions: [{ label: t('close'), variant: 'btn-secondary' }],
      onMount: function (root) {
        var av = root.querySelector('[data-profile-avatar]');
        if (av) av.addEventListener('click', function () { m.close(); setTimeout(function () { DS.avatarPicker(); }, 160); });
        var out = root.querySelector('[data-profile-logout]');
        if (out) out.addEventListener('click', function () {
          DS.confirm({ title: t('logout'), text: t('confirmDeleteText'), danger: true }).then(function (ok) {
            if (ok) DS.logout();
          });
        });
      }
    });
    return m;
  }
  DS.openProfile = openProfile;

  function brandMarkup() {
    return '<a class="ds-brand" href="' + url(DS.roleHome()) + '">' +
      '<img src="' + url('assets/img/LOGO-WHAIT.png') + '" alt="DotStudio" style="height:40px!important;width:auto!important;max-width:150px;object-fit:contain">' +
      '</a>';
  }

  function sidebarMarkup(user, active) {
    var items = navFor(user);
    var html = '<aside class="ds-sidebar" id="dsSidebar"><div class="ds-sidebar-head">' + brandMarkup() +
      '<button class="ds-sidebar-close" data-sidebar-close aria-label="close">' + icon('x') + '</button></div>' +
      workspaceMarkup(user) + '<nav class="ds-nav">';
    var index = 0;
    items.forEach(function (n) {
      if (n.section) { html += '<div class="ds-nav-section">' + esc(sectionLabel(n.section)) + '</div>'; return; }
      index++;
      var badge = navBadgeCount(n.key, user);
      html += '<a class="ds-nav-item' + (n.key === active ? ' active' : '') + '" href="' + url(n.href) + '" data-nav="' + n.key + '">' +
        icon(n.icon) + '<span class="label">' + esc(t(n.key)) + '</span>' +
        (badge ? '<span class="ds-nav-badge">' + badge + '</span>' : '') +
        '</a>';
    });
    html += '</nav><div class="ds-sidebar-foot">' +
      '<a class="ds-sidebar-link" href="' + url('marketing/index.html') + '">' + icon('globe') + '<span>' + esc(t('marketing')) + '</span></a>' +
      '<a class="ds-sidebar-link" href="' + url('auth/jobs/jobs.html') + '">' + icon('jobs') + '<span>' + esc(t('jobsTitle')) + '</span></a>' +
      '<a class="ds-sidebar-link" href="' + url('auth/public-chat.html') + '">' + icon('chat') + '<span>' + esc(t('publicChat')) + '</span></a>' +
      '<button class="ds-sidebar-link danger" data-logout>' + icon('logout') + '<span>' + esc(t('logout')) + '</span></button>' +
      '<div class="ds-sidebar-version"><span>v2.0.0</span><span class="live"><i></i>PRO</span></div>' +
      '</div></aside>';
    return html;
  }

  function sectionLabel(key) {
    var map = {
      workspace: t('workspace'), operations: DS.lang() === 'en' ? 'Operations' : 'العمليات',
      growth: DS.lang() === 'en' ? 'Growth' : 'النمو', communication: DS.lang() === 'en' ? 'Communication' : 'التواصل',
      team: DS.lang() === 'en' ? 'Team' : 'الفريق', system: DS.lang() === 'en' ? 'System' : 'النظام', community: DS.lang() === 'en' ? 'Community' : 'المجتمع'
    };
    return map[key] || key;
  }

  function topbarMarkup(user, opts) {
    var title = opts.title || t(opts.active || 'dashboard');
    var sub = opts.eyebrow || (workspaceEntity(user) ? displayName(workspaceEntity(user)) : t('platform'));
    var unread = 0;
    try { unread = DS.data ? DS.data.notifications(user).length : 0; } catch (e) {}
    return '<header class="ds-topbar">' +
      '<button class="ds-menu-btn" data-menu aria-label="menu">' + icon('menu') + '</button>' +
      '<div class="ds-topbar-context"><span class="ds-topbar-title">' + esc(title) + '</span><span class="ds-topbar-sep"></span><span class="ds-topbar-sub">' + esc(sub) + '</span></div>' +
      '<div class="ds-topbar-actions">' +
        '<button class="ds-search-btn" data-cmd>' + icon('search') + '<span>' + esc(t('search')) + '</span><span class="kbd">⌘K</span></button>' +
        '<div class="ds-lang-pill" role="group" aria-label="' + esc(t('language')) + '">' +
          '<button type="button" class="opt' + (DS.lang() === 'ar' ? ' active' : '') + '" data-set-lang="ar" aria-pressed="' + (DS.lang() === 'ar') + '">AR</button>' +
          '<span class="sep">|</span>' +
          '<button type="button" class="opt' + (DS.lang() === 'en' ? ' active' : '') + '" data-set-lang="en" aria-pressed="' + (DS.lang() === 'en') + '">EN</button>' +
        '</div>' +
        '<button class="ds-top-btn" data-theme title="' + esc(t('theme')) + '">' + icon(DS.theme() === 'dark' ? 'sun' : 'moon') + '</button>' +
        '<div class="dropdown"><button class="ds-top-btn" data-notif title="' + esc(t('notifications')) + '">' + icon('bell') + (unread ? '<span class="dot"></span>' : '') + '</button>' +
          '<div class="dropdown-menu" data-notif-menu hidden style="min-width:300px;max-width:340px"><div class="dropdown-head">' + esc(t('notifications')) + '</div><div data-notif-body></div></div></div>' +
        '<div class="dropdown"><button class="ds-user-btn" data-user>' +
          '<img class="avatar" src="' + esc(DS.avatarUrl(user)) + '" alt=""><span class="u-name">' + esc(DS.lang() === 'en' ? (user.name_en || user.name) : user.name) + '</span>' + icon('chevronDown') +
        '</button><div class="dropdown-menu" data-user-menu hidden>' +
          '<div class="dropdown-head">' + esc(DS.loc(user, 'name')) + ' · ' + esc(t(user.role === 'superadmin' ? 'admin' : user.role)) + '</div>' +
          '<button class="dropdown-item" data-profile>' + icon('user') + esc(t('profileSettings')) + '</button>' +
          '<button class="dropdown-item" data-avatar>' + icon('image') + esc(t('changeAvatar')) + '</button>' +
          '<div class="dropdown-sep"></div>' +
          '<a class="dropdown-item" href="' + url('marketing/index.html') + '">' + icon('globe') + esc(t('marketing')) + '</a>' +
          '<a class="dropdown-item" href="' + url('auth/jobs/jobs.html') + '">' + icon('jobs') + esc(t('jobs')) + '</a>' +
          '<div class="dropdown-sep"></div>' +
          '<button class="dropdown-item danger" data-logout>' + icon('logout') + esc(t('logout')) + '</button>' +
        '</div></div>' +
      '</div></header>';
  }

  function notificationsMarkup(user) {
    var list = [];
    try { list = DS.data.notifications(user); } catch (e) {}
    if (!list.length) return '<div class="dropdown-item" style="color:var(--text-tertiary);pointer-events:none">' + esc(t('noNotifications')) + '</div>';
    return list.map(function (n) {
      return '<a class="dropdown-item" href="' + url(n.href || '') + '" style="align-items:flex-start">' +
        '<span style="width:28px;height:28px;border-radius:8px;background:var(--surface-2);display:grid;place-items:center;flex-shrink:0;color:var(--lime)">' + icon(n.icon || 'bell') + '</span>' +
        '<span style="min-width:0"><span style="display:block;font-size:12px;font-weight:600;color:var(--text-primary)">' + esc(n.title) + '</span>' +
        '<span style="display:block;font-size:11px;color:var(--text-tertiary);margin-top:1px">' + esc(n.text) + '</span>' +
        '<span style="display:block;font-size:10px;color:var(--text-disabled);margin-top:2px">' + esc(DS.timeAgo(n.at)) + '</span></span></a>';
    }).join('');
  }

  /* ───────────────────────────── ACCESS ───────────────────────────── */
  function deniedMarkup(user) {
    return '<div class="empty-state" style="min-height:56vh">' +
      '<div class="empty-icon">' + icon('lock') + '</div>' +
      '<div class="empty-title">' + esc(t('accessDenied')) + '</div>' +
      '<div class="empty-text">' + esc(t('accessDeniedText')) + '</div>' +
      '<div class="empty-actions"><a class="btn btn-primary" href="' + url(DS.roleHome(user)) + '">' + icon('arrowRight') + esc(t('back')) + '</a></div></div>';
  }

  /* ───────────────────────────── MOUNT ────────────────────────────── */
  function mount(opts) {
    opts = opts || {};
    var roles = opts.roles || null;
    var user = DS.requireAuth(roles);
    if (!user) return null;

    var denied = false;
    if (opts.permission && !hasPermission(user, opts.permission)) denied = true;

    var root = document.getElementById('app');
    if (!root) {
      root = document.createElement('div');
      root.id = 'app';
      document.body.appendChild(root);
    }

    root.innerHTML = '<div class="ds-app">' + sidebarMarkup(user, opts.active) +
      '<div class="ds-main">' + topbarMarkup(user, opts) +
      '<main class="ds-content" id="dsContent"></main></div></div>' +
      '<div class="drawer-scrim" data-scrim></div>';

    var content = root.querySelector('#dsContent');
    var sidebar = root.querySelector('#dsSidebar');
    var scrim = root.querySelector('[data-scrim]');
    var mounted = { root: root, user: user, content: content, shell: root.querySelector('.ds-app') };

    function closeMenus() {
      DS.$$('[data-user-menu],[data-notif-menu]', root).forEach(function (m) { m.hidden = true; });
    }
    function closeDrawer() { sidebar.classList.remove('open'); scrim.classList.remove('open'); }

    if (denied) {
      content.innerHTML = '<div class="page-head"><div class="page-head-main"><div class="page-title">' + esc(t('accessDenied')) + '</div></div></div>' + deniedMarkup(user);
      /* Safe stubs: page modules may still call these after a permission denial.
         Rendering must never replace the access-denied state or throw. */
      mounted.denied = true;
      mounted.body = content;
      mounted.actions = content;
      mounted.setContent = function () {};
      mounted.setActions = function () {};
      mounted.setTitle = function () {};
      bind();
      return mounted;
    }

    content.innerHTML =
      '<div class="page-head"><div class="page-head-main">' +
        (opts.eyebrow ? '<div class="page-eyebrow">' + icon(opts.icon || 'dashboard') + esc(opts.eyebrow) + '</div>' : '') +
        '<h1 class="page-title">' + esc(opts.title || t(opts.active || 'dashboard')) + '</h1>' +
        (opts.sub ? '<p class="page-sub">' + esc(opts.sub) + '</p>' : '') +
      '</div><div class="page-actions" data-page-actions>' + (opts.actions || '') + '</div></div>' +
      '<div class="page-body" data-page-body>' + (opts.content || '') + '</div>';

    mounted.body = content.querySelector('[data-page-body]');
    mounted.actions = content.querySelector('[data-page-actions]');
    mounted.setContent = function (html) { mounted.body.innerHTML = html; };
    mounted.setActions = function (html) { mounted.actions.innerHTML = html; };
    mounted.setTitle = function (title, sub) {
      var h = content.querySelector('.page-title');
      if (h) h.textContent = title;
      if (sub != null) {
        var p = content.querySelector('.page-sub');
        if (p) p.textContent = sub;
      }
    };

    bind();

    function bind() {
      /* drawer */
      DS.$$('[data-menu]', root).forEach(function (b) { b.addEventListener('click', function () { sidebar.classList.add('open'); scrim.classList.add('open'); }); });
      DS.$$('[data-sidebar-close]', root).forEach(function (b) { b.addEventListener('click', closeDrawer); });
      scrim.addEventListener('click', closeDrawer);

      /* language pill */
      DS.$$('.ds-topbar [data-set-lang]', root).forEach(function (b) {
        b.addEventListener('click', function () {
          var next = b.getAttribute('data-set-lang');
          if (next === DS.lang()) return;
          DS.setLang(next);
          setTimeout(function () { location.reload(); }, 60);
        });
      });
      var themeBtn = root.querySelector('[data-theme]');
      if (themeBtn) themeBtn.addEventListener('click', function () { DS.toggleTheme(); themeBtn.innerHTML = icon(DS.theme() === 'dark' ? 'sun' : 'moon'); });

      /* command palette */
      DS.$$('[data-cmd]', root).forEach(function (b) { b.addEventListener('click', DS.commandPalette); });

      /* notifications */
      var notifBtn = root.querySelector('[data-notif]');
      var notifMenu = root.querySelector('[data-notif-menu]');
      if (notifBtn) notifBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = notifMenu.hidden;
        closeMenus();
        notifMenu.hidden = !willOpen;
        if (willOpen) root.querySelector('[data-notif-body]').innerHTML = notificationsMarkup(user);
      });
      if (notifMenu) notifMenu.addEventListener('click', function (e) { e.stopPropagation(); });

      /* user menu */
      var userBtn = root.querySelector('[data-user]');
      var userMenu = root.querySelector('[data-user-menu]');
      if (userBtn) userBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = userMenu.hidden;
        closeMenus();
        userMenu.hidden = !willOpen;
      });
      if (userMenu) userMenu.addEventListener('click', function (e) { e.stopPropagation(); });

      /* workspace / profile */
      var ws = root.querySelector('[data-workspace]');
      if (ws) ws.addEventListener('click', function () { closeMenus(); openProfile(); });

      DS.$$('[data-avatar]', root).forEach(function (b) { b.addEventListener('click', function () { closeMenus(); DS.avatarPicker(); }); });
      DS.$$('[data-profile]', root).forEach(function (b) { b.addEventListener('click', function () { closeMenus(); openProfile(); }); });
      DS.$$('[data-logout]', root).forEach(function (b) { b.addEventListener('click', function () { DS.logout(); }); });

      document.addEventListener('click', closeMenus);
      window.addEventListener('resize', DS.debounce(function () { if (window.innerWidth > 960) closeDrawer(); }, 150));
      window.addEventListener('ds:lang', function () { location.reload(); });
    }

    mounted.refresh = function () {
      var u = DS.session() || user;
      var wsHost = root.querySelector('[data-workspace]');
      if (wsHost) wsHost.outerHTML = workspaceMarkup(u);
      var av = root.querySelector('[data-user] .avatar');
      if (av) av.src = DS.avatarUrl(u);
    };

    if (typeof opts.onReady === 'function') {
      try { opts.onReady(mounted); } catch (e) { console.error('[DS] onReady failed', e); }
    }
    return mounted;
  }

  /* ─────────────────────────── PAGE HELPERS ───────────────────────── */
  function stat(opts) {
    opts = opts || {};
    return '<div class="stat">' +
      '<div class="stat-top"><span class="stat-label">' + esc(opts.label || '') + '</span>' +
      '<span class="stat-icon ' + (opts.tone || '') + '">' + icon(opts.icon || 'activity') + '</span></div>' +
      '<div class="stat-value">' + (opts.value || '0') + '</div>' +
      '<div class="stat-foot">' + (opts.foot || '') + '</div></div>';
  }

  function refreshContent(html) {
    var body = document.querySelector('[data-page-body]');
    if (body) body.innerHTML = html;
  }

  /* Expose */
  DS.shell = {
    mount: mount,
    NAV: NAV,
    navFor: navFor,
    getNavItems: navItemsFlat,
    hrefFor: hrefFor,
    hasPermission: hasPermission,
    permissionsOf: permissionsOf,
    workspaceEntity: workspaceEntity,
    displayName: displayName,
    stat: stat,
    refreshUser: function () {
      var u = DS.session();
      if (!u) return;
      var ws = document.querySelector('[data-workspace]');
      if (ws) ws.outerHTML = workspaceMarkup(u);
      var av = document.querySelector('[data-user] .avatar');
      if (av) av.src = DS.avatarUrl(u);
    },
    refresh: refreshContent
  };

  console.log('%cDotStudio® POS · shell ready', 'color:#82FF1F;font-weight:bold');
})();
