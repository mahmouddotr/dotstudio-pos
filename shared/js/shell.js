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
      { key: 'users', href: 'admin/users.html', icon: 'user' },
      { key: 'cashiers', href: 'admin/cashiers.html', icon: 'cashier' },
      { key: 'delivery-companies', href: 'admin/delivery-companies.html', icon: 'truck' },
      { key: 'sub-admins', href: 'admin/sub-admins.html', icon: 'shield' },
      { section: 'growth' },
      { key: 'reports', href: 'admin/reports.html', icon: 'chart' },
      { key: 'subscriptions', href: 'admin/subscriptions.html', icon: 'card' },
      { key: 'discounts', href: 'admin/discounts.html', icon: 'percent' },
      { key: 'reviews', href: 'admin/reviews.html', icon: 'star' },
      { key: 'jobs', href: 'admin/jobs.html', icon: 'jobs' },
      { key: 'audit', href: 'admin/audit-logs.html', icon: 'activity' },
      { section: 'communication' },
      { key: 'chats', href: 'admin/chats.html', icon: 'chat' },
      { section: 'system' },
      { key: 'systemTools', href: 'admin/hardware-tools.html', icon: 'settings' },
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
      { key: 'discounts', href: 'admin/discounts.html', icon: 'percent', perm: 'discounts' },
      { key: 'reviews', href: 'admin/reviews.html', icon: 'star', perm: 'products' },
      { key: 'jobs', href: 'admin/jobs.html', icon: 'jobs', perm: 'jobs' },
      { key: 'audit', href: 'admin/audit-logs.html', icon: 'activity', perm: 'audit' },
      { section: 'communication' },
      { key: 'chats', href: 'admin/chats.html', icon: 'chat', perm: 'chats' },
      { section: 'system' },
      { key: 'systemTools', href: 'admin/hardware-tools.html', icon: 'settings', perm: 'products' },
      { key: 'settings', href: 'admin/settings.html', icon: 'settings' }
    ],
    owner: [
      { section: 'workspace' },
      { key: 'dashboard', href: 'owner/dashboard.html', icon: 'dashboard' },
      { key: 'sell', href: 'owner/sell.html', icon: 'cashier' },
      { key: 'orders', href: 'owner/orders.html', icon: 'orders', badge: 'pending' },
      { key: 'products', href: 'owner/products.html', icon: 'box' },
      { key: 'customers', href: 'owner/customers.html', icon: 'users' },
      { section: 'growth' },
      { key: 'reports', href: 'owner/reports.html', icon: 'chart' },
      { key: 'subscriptions', href: 'owner/subscriptions.html', icon: 'card' },
      { key: 'jobs', href: 'admin/jobs.html', icon: 'jobs' },
      { section: 'team' },
      { key: 'cashiers', href: 'owner/cashiers.html', icon: 'cashier' },
      { key: 'drivers', href: 'owner/drivers.html', icon: 'bike' },
      { key: 'delivery-companies', href: 'owner/delivery-companies.html', icon: 'truck' },
      { section: 'communication' },
      { key: 'chats', href: 'owner/messages.html', icon: 'chat' },
      { section: 'system' },
      { key: 'systemTools', href: 'admin/hardware-tools.html', icon: 'settings' },
      { key: 'settings', href: 'owner/settings.html', icon: 'settings' }
    ],
    /* Cashier is a seller-only workspace: POS, order tracking and messages.
       No discounts, no products management, no drivers, no settings and no
       financial dashboards. */
    cashier: [
      { section: 'workspace' },
      { key: 'pos', href: 'cashier/pos.html', icon: 'cashier' },
      { key: 'orders', href: 'cashier/orders.html', icon: 'orders' },
      { key: 'chats', href: 'owner/messages.html', icon: 'chat' }
    ],
    delivery: [
      { section: 'workspace' },
      { key: 'dashboard', href: 'delivery/dashboard.html', icon: 'dashboard' },
      { key: 'orders', href: 'delivery/orders.html', icon: 'orders', badge: 'out_for_delivery' },
      { key: 'tracking', href: 'delivery/tracking.html', icon: 'mapPin' },
      { key: 'manage-drivers', href: 'delivery/drivers.html', icon: 'users', ownerOnly: true },
      { section: 'communication' },
      { key: 'messages', href: 'delivery/messages.html', icon: 'chat' }
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

  /* A sub-driver shares the delivery workspace and its navigation. */
  NAV.driver = NAV.delivery;

  var WORKSPACE_LABEL = { superadmin: 'platform', subadmin: 'platform', owner: 'store', cashier: 'store', delivery: 'company', driver: 'company', customer: 'store' };

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
    /* Owner-only entries (fleet management) never reach a sub-driver. */
    var owner = !!(DS.data && DS.data.isCompanyOwner && DS.data.isCompanyOwner(user));
    items = items.filter(function (n) { return !n.ownerOnly || owner; });
    if (user.role !== 'subadmin') {
      return items.filter(function (n, i, arr) {
        if (!n.section) return true;
        var next = arr[i + 1];
        return next && !next.section;
      });
    }
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
      if (key === 'orders' && !(DS.data.isDeliveryRole && DS.data.isDeliveryRole(user))) return DS.data.visibleOrders(user).filter(function (o) { return o.status === 'pending'; }).length;
      if (key === 'orders' && DS.data.isDeliveryRole && DS.data.isDeliveryRole(user)) return DS.data.visibleOrders(user).filter(function (o) { return o.status === 'out_for_delivery'; }).length;
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
    if (user.role === 'delivery' || user.role === 'driver') {
      var dc = (DS.data.companies || []).filter(function (c) { return c.id === user.delivery_company; })[0];
      return dc || user;
    }
    return null;
  }

  function roleLabelOf(user) {
    if (!user) return '';
    if (user.role === 'superadmin') return t('admin');
    if (DS.data && DS.data.isCompanyOwner && DS.data.isCompanyOwner(user)) return t('companyOwner');
    if (user.role === 'driver') return t('subDriver');
    return t(user.role);
  }

  function workspaceMarkup(user) {
    var entity = workspaceEntity(user);
    var name = displayName(user) || displayName(entity) || t('profile');
    var roleLabel = roleLabelOf(user);
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
    rows.push([t('role'), roleLabelOf(user)]);
    if (entity && entity !== user) rows.push([(user.role === 'delivery' || user.role === 'driver') ? t('deliveryCompany') : t('store'), displayName(entity)]);
    if (user.phone) rows.push([t('phone'), user.phone]);
    if (user.email) rows.push([t('email'), user.email]);
    if (user.city) rows.push([t('city'), DS.loc(user, 'city')]);

    var body = '<div class="ds-profile">' +
      '<div class="ds-profile-top">' +
        '<img class="ds-profile-avatar" src="' + esc(DS.avatarUrl(user)) + '" alt="">' +
        '<div class="ds-profile-id"><b>' + esc(displayName(user)) + '</b><span>' + esc(roleLabelOf(user)) + (entity && entity !== user ? ' · ' + esc(displayName(entity)) : '') + '</span></div>' +
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
      /* Delivery already owns the single unified «الرسائل» entry — no second chat link. */
      ((user.role === 'delivery' || user.role === 'driver') ? '' :
        '<a class="ds-sidebar-link" href="' + url('auth/public-chat.html') + '">' + icon('chat') + '<span>' + esc(t('publicChat')) + '</span></a>') +
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
          '<div class="dropdown-head">' + esc(DS.loc(user, 'name')) + ' · ' + esc(roleLabelOf(user)) + '</div>' +
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
  function impersonationMarkup(user) {
    var state = null;
    try { state = DS.impersonating ? DS.impersonating() : null; } catch (e) {}
    if (!state) return '';
    var targetName = DS.lang() === 'en' ? (user.name_en || user.name) : (user.name || user.name_en);
    return '<div class="ds-impersonation-banner" role="status">' +
      '<span class="ds-imp-icon">' + icon('shield') + '</span>' +
      '<span class="ds-imp-text">' + esc(t('impersonatingAs')) + ' <b>' + esc(targetName) + '</b></span>' +
      '<button type="button" class="ds-imp-btn" data-stop-impersonation>' + icon('logout') + esc(t('backToAdmin')) + '</button>' +
      '</div>';
  }

  /* ─────────────────────────── HELP & GUIDES ───────────────────────── */
  function guideSteps(role) {
    var en = DS.lang() === 'en';
    var S = function (icon, title_ar, title_en, text_ar, text_en) {
      return { icon: icon, title: en ? title_en : title_ar, text: en ? text_en : text_ar };
    };
    if (role === 'superadmin' || role === 'subadmin') {
      return [
        S('userPlus', 'إضافة مستخدم سريع', 'Quick add a user', 'من لوحة التحكم اضغط «إضافة سريعة»، اختر الدور (صاحب متجر / كاشير / مندوب)، وسيتم توليد tenant_id تلقائياً.', 'From the dashboard hit “Quick add user”, pick the role (owner / cashier / driver) and a tenant_id is generated automatically.'),
        S('store', 'إضافة متجر', 'Add a store', 'المتاجر ← إضافة متجر: املأ اسم المتجر وبيانات المالك والباقة، ويُنشأ حساب المالك والكاشير.', 'Stores → Add store: fill the store name, owner and plan; the owner and cashier accounts are created.'),
        S('percent', 'إنشاء كود خصم', 'Create a promo code', 'الخصومات ← كود خصم جديد. مثال: SAVE20 بنسبة 20%، ويستخدمه العميل في السلة.', 'Discounts → New promo code. Example: SAVE20 for 20% off; customers redeem it in the bag.'),
        S('orders', 'متابعة الطلبات', 'Track orders', 'الطلبات ← اضغط أي طلب لعرض التفاصيل وتغيير الحالة خطوة بخطوة دون تخطي.', 'Orders → open any order to view details and advance the status one step at a time.'),
        S('settings', 'إعادة تعيين البيانات', 'Reset demo data', 'الإعدادات ← الأمان ← إعادة تعيين البيانات لبدء تثبيت نظيف.', 'Settings → Security → Reset demo data for a clean install.')
      ];
    }
    if (role === 'owner') {
      return [
        S('plus', 'إضافة منتج', 'Add a product', 'المنتجات ← إضافة منتج: الاسم والسعر والمخزون والصورة، ثم حفظ.', 'Products → Add product: name, price, stock and image, then save.'),
        S('cashier', 'إضافة كاشير', 'Add a cashier', 'الكاشير ← إضافة كاشير، واختر المتجر واسم المستخدم وكلمة المرور.', 'Cashiers → Add cashier, choose the store plus username and password.'),
        S('truck', 'إدارة المناديب', 'Manage drivers', 'من لوحة التحكم ← إدارة المناديب ← إضافة مندوب. المندوب يرى طلبات متجرك فقط.', 'Dashboard → Manage drivers → Add driver. The driver only sees your store’s orders.'),
        S('percent', 'كود الخصم', 'Promo codes', 'اكتب الكود داخل سلة العميل أو عند إتمام الطلب ليُطبّق الخصم قبل الدفع.', 'Customers type the code in the bag or at checkout so the discount applies before payment.'),
        S('chart', 'التقارير', 'Reports', 'التقارير تعرض المبيعات والأكثر مبيعاً وأداء المتجر خلال 7 أو 30 يوماً.', 'Reports show sales, best sellers and store performance over 7 or 30 days.')
      ];
    }
    if (role === 'cashier') {
      return [
        S('cart', 'فتح نقطة البيع', 'Open the POS', 'نقطة البيع تعرض منتجات متجرك فقط — اختر المنتجات أو امسح الباركود.', 'The POS shows only your store’s products — pick items or scan a barcode.'),
        S('scan', 'مسح الباركود', 'Scan a barcode', 'امسح بالجهاز أو اكتب الباركود ثم Enter؛ يضاف المنتج للسلة فوراً.', 'Scan with the reader or type the barcode and press Enter to add the item.'),
        S('card', 'الدفع والفاتورة', 'Pay & receipt', 'اختر طريقة الدفع ثم «إتمام البيع»، واطبع الفاتورة الحرارية 80mm.', 'Choose the payment method, complete the sale and print the 80mm receipt.')
      ];
    }
    if (role === 'delivery' || role === 'driver') {
      return [
        S('check', 'قبول المهمة', 'Accept a task', 'من لوحة المندوب اضغط «قبول» لينتقل الطلب إلى قيد التحضير.', 'On the driver dashboard tap “Accept” to move the order to preparing.'),
        S('bike', 'بدء التوصيل', 'Start delivery', 'بعد تجهيز الطلب اضغط «في الطريق» — التتبع يعمل لحظياً للعميل.', 'Once ready tap “On the way” — live tracking starts for the customer.'),
        S('image', 'إثبات التسليم', 'Delivery proof', 'لا يمكن إتمام التسليم بدون رفع صورة إثبات للطرد (حتى 800KB).', 'A delivery cannot be completed without uploading a proof photo (up to 800KB).'),
        S('chat', 'محادثة العميل', 'Chat with the customer', 'افتح تفاصيل الطلب ← محادثة للتواصل مع العميل مباشرة.', 'Open the order details → chat to message the customer directly.')
      ];
    }
    return [
      S('store', 'تصفح المتاجر', 'Browse stores', 'اختر متجراً من الصفحة الرئيسية لعرض منتجاته فقط.', 'Pick a store on the home page to browse only its products.'),
      S('bag', 'السلة وكود الخصم', 'Bag & promo code', 'أضف المنتجات للسلة، واكتب كود الخصم ثم «تطبيق» ليُحسب الخصم.', 'Add items to the bag, type the promo code and tap “Apply” to see the discount.'),
      S('checkCircle', 'إتمام الطلب', 'Place the order', 'أدخل العنوان ورقم الهاتف واختر شركة التوصيل ثم أكد الطلب.', 'Enter your address and phone, choose a delivery company then confirm.'),
      S('mapPin', 'تتبع الطلب', 'Track the order', 'من «تتبع» شاهد المندوب على الخريطة وتحدث معه أو مع شركة التوصيل.', 'From Tracking watch the rider on the map and chat with him or the delivery company.')
    ];
  }

  function openHelp(user) {
    var en = DS.lang() === 'en';
    var steps = guideSteps(user && user.role);
    var roleLabel = en ? 'your workspace' : 'مساحة عملك';
    var body = '<div class="help-guide">' +
      '<div class="help-guide-head">' +
        '<span class="help-guide-ic">' + icon('sparkles') + '</span>' +
        '<div><b>' + esc(en ? 'Step-by-step guides' : 'أدلة خطوة بخطوة') + '</b>' +
          '<span>' + esc(en ? 'Everything you need for ' + roleLabel + '.' : 'كل ما تحتاجه داخل ' + roleLabel + '.') + '</span></div>' +
      '</div>' +
      '<ol class="help-steps">' + steps.map(function (s, i) {
        return '<li class="help-step">' +
          '<span class="help-step-num">' + (i + 1) + '</span>' +
          '<span class="help-step-ic">' + icon(s.icon) + '</span>' +
          '<div class="help-step-copy"><b>' + esc(s.title) + '</b><p>' + esc(s.text) + '</p></div></li>';
      }).join('') + '</ol>' +
      '<div class="help-guide-foot">' + icon('message') +
        '<span>' + esc(en ? 'Still stuck? Open Support from the chat dock.' : 'ما زلت تحتاج مساعدة؟ افتح الدعم من لوحة المحادثات.') + '</span></div></div>';

    DS.modal({
      title: '? ' + esc(en ? 'Help & guides' : 'المساعدة والأدلة'),
      sub: esc(en ? 'A quick tour of your most common tasks.' : 'جولة سريعة على أكثر المهام استخداماً.'),
      size: 'md',
      body: body,
      actions: [{ label: t('close'), variant: 'btn-primary' }]
    });
  }

  /* ─────────────────────── LIVE ORDER LISTENER ────────────────────── */
  /* Plays the notification beep whenever a new order joins the feed.
     A sub-driver also gets a toast the moment a task is assigned to him. */
  function watchOrderFeed(user) {
    if (!DS.data || !DS.data.visibleOrders || !user || user.role === 'customer') return;
    var isRider = !!(DS.data.isSubDriver && DS.data.isSubDriver(user));
    var seen = {};
    var primed = false;
    function snapshot() {
      var list;
      try { list = DS.data.visibleOrders(user) || []; } catch (e) { return; }
      var fresh = 0;
      list.forEach(function (o) { if (o && !seen[o.id]) { seen[o.id] = true; fresh++; } });
      if (primed && fresh > 0) {
        if (DS.playNotification) DS.playNotification();
        if (isRider) DS.toast(DS.lang() === 'en' ? 'You have a new delivery task' : 'لديك طلب توصيل جديد', 'success');
      }
      primed = true;
    }
    snapshot();
    window.addEventListener('ds:data', snapshot);
    window.addEventListener('ds:order-updated', snapshot);
  }

  /* ═══════════════════════════════════════════════════════════════
     CUSTOMER CHROME — one shared header · footer · bottom navigation
     Used by the storefront, order history, live tracking and checkout.
     The header keeps the old clean layout (logo · links · search · bag)
     while the customer theme layer keeps the dark/lemon surface.
     ═══════════════════════════════════════════════════════════════ */
  function customerCartCount() {
    try {
      var raw = DS.store.get('ds_cart', { items: [] });
      return ((raw && raw.items) || []).reduce(function (s, l) { return s + (Number(l.qty) || 1); }, 0);
    } catch (e) { return 0; }
  }

  function customerLinkList(EN) {
    return [
      { key: 'home', href: 'customer/storefront.html', label: EN ? 'Home' : 'الرئيسية', icon: 'home' },
      { key: 'storefront', href: 'customer/storefront.html#sfCatalog', label: EN ? 'Store' : 'المتجر', icon: 'store' },
      { key: 'my-orders', href: 'customer/my-orders.html', label: EN ? 'My orders' : 'طلباتي', icon: 'receipt' },
      { key: 'tracking', href: 'customer/tracking.html', label: EN ? 'Track order' : 'تتبع الطلب', icon: 'mapPin' }
    ];
  }

  function isStorefrontPath() {
    return /\/customer\/storefront\.html$/.test(location.pathname);
  }

  function customerHeader(active, opts) {
    opts = opts || {};
    var EN = DS.lang() === 'en';
    var count = customerCartCount();
    var onStore = isStorefrontPath();
    var cartInner = icon('bag') + '<span>' + esc(EN ? 'Bag' : 'السلة') + '</span>' +
      '<b data-cart-count>' + count + '</b>';
    var cart = onStore
      ? '<button type="button" class="sl-cart-btn" data-open-cart aria-label="' + esc(t('cart')) + '">' + cartInner + '</button>'
      : '<a class="sl-cart-btn" href="' + url('customer/storefront.html?cart=1') + '" data-cart-nav aria-label="' + esc(t('cart')) + '">' + cartInner + '</a>';
    var search = opts.search === false ? '' :
      '<label class="sl-search">' + icon('search') +
        '<input type="search" data-sl-search placeholder="' + esc(EN ? 'Search products, stores…' : 'ابحث عن منتج أو متجر…') +
        '" value="' + esc(opts.q || '') + '" aria-label="' + esc(t('search')) + '">' +
      '</label>';
    return '<header class="sl-header sf-header" data-sf-header>' +
      '<div class="sl-header-bar">' +
        '<a class="sl-logo" href="' + url('customer/storefront.html') + '" aria-label="DotStudio">' +
          '<img class="logo-on-dark" src="' + url('assets/img/LOGO-WHAIT.png') + '" alt="DotStudio">' +
          '<img class="logo-on-light" src="' + url('assets/img/LOGO-BLACK.png') + '" alt="DotStudio">' +
        '</a>' +
        '<nav class="sl-links" aria-label="' + esc(EN ? 'Customer navigation' : 'تنقل العميل') + '">' +
          customerLinkList(EN).map(function (l) {
            return '<a class="' + (l.key === active ? 'active' : '') + '" href="' + url(l.href) + '">' +
              icon(l.icon) + '<span>' + esc(l.label) + '</span></a>';
          }).join('') +
        '</nav>' +
        search +
        '<div class="sl-actions">' +
          '<button type="button" class="sl-icon-btn sl-theme-toggle" data-theme-toggle aria-label="' +
            esc(DS.customerTheme() === 'dark' ? (EN ? 'Switch to light mode' : 'التبديل للوضع الفاتح') : (EN ? 'Switch to dark mode' : 'التبديل للوضع الداكن')) +
            '" title="' + esc(EN ? 'Theme' : 'المظهر') + '">' +
            icon(DS.customerTheme() === 'dark' ? 'sun' : 'moon') +
          '</button>' +
          '<button type="button" class="sl-icon-btn sl-lang-toggle" data-customer-lang aria-label="language">' +
            esc(EN ? 'AR' : 'EN') +
          '</button>' +
          cart +
          '<button type="button" class="sl-points-badge" data-loyalty-badge aria-label="' + esc(EN ? 'My points' : 'نقاطي') + '" title="' + esc(EN ? 'My points' : 'نقاطي') + '">' +
            icon('star') + '<b data-loyalty-points>' + (DS.loyalty ? DS.loyalty.get(DS.session()) : 0) + '</b><i>' + esc(EN ? 'pts' : 'نقاطي') + '</i>' +
          '</button>' +
          '<button type="button" class="sl-icon-btn sl-logout-btn" data-customer-logout aria-label="' +
            esc(EN ? 'Sign out' : 'تسجيل الخروج') + '" title="' + esc(EN ? 'Sign out' : 'تسجيل الخروج') + '" style="background:transparent;opacity:.75">' +
            icon('logout') +
          '</button>' +
        '</div>' +
      '</div>' +
    '</header>';
  }

  function customerFooter() {
    var EN = DS.lang() === 'en';
    return '<footer class="sf-footer"><div class="sf-footer-inner">' +
      '<div class="sf-footer-brand">' +
        '<img src="' + url('assets/img/LOGO-WHAIT.png') + '" alt="DotStudio">' +
        '<span>© ' + new Date().getFullYear() + ' DotStudio® · ' + esc(EN ? 'All rights reserved.' : 'كل الحقوق محفوظة.') + '</span>' +
      '</div>' +
      '<nav class="sf-footer-links" aria-label="' + esc(EN ? 'Store links' : 'روابط المتجر') + '">' +
        '<a href="' + url('customer/storefront.html') + '">' + esc(EN ? 'Home' : 'الرئيسية') + '</a>' +
        '<a href="' + url('auth/jobs/jobs.html') + '">' + esc(EN ? 'Jobs' : 'الوظائف') + '</a>' +
        '<a href="' + url('auth/public-chat.html') + '">' + esc(EN ? 'Messages' : 'الرسائل') + '</a>' +
        '<button type="button" data-customer-logout>' + esc(EN ? 'Sign out' : 'تسجيل الخروج') + '</button>' +
      '</nav>' +
    '</div></footer>';
  }

  function customerBottomNav(active) {
    var EN = DS.lang() === 'en';
    var count = customerCartCount();
    var onStore = isStorefrontPath();
    var current = active === 'storefront' ? 'home' : active === 'tracking' ? 'my-orders' : active;
    var cartInner = icon('bag') + '<b data-cart-count>' + count + '</b><span>' + esc(EN ? 'Cart' : 'السلة') + '</span>';
    var cartItem = onStore
      ? '<button type="button" class="ds-bn-item ds-bn-cart" data-open-cart aria-label="' + esc(t('cart')) + '">' + cartInner + '</button>'
      : '<a class="ds-bn-item ds-bn-cart" href="' + url('customer/storefront.html?cart=1') + '" data-cart-nav aria-label="' + esc(t('cart')) + '">' + cartInner + '</a>';
    function item(key, href, iconName, label) {
      return '<a class="ds-bn-item' + (key === current ? ' active' : '') + '" href="' + url(href) + '">' +
        icon(iconName) + '<span>' + esc(label) + '</span></a>';
    }
    return '<nav class="ds-bottom-nav" aria-label="' + esc(EN ? 'Customer navigation' : 'تنقل العميل') + '">' +
      item('home', 'customer/storefront.html', 'home', EN ? 'Home' : 'الرئيسية') +
      item('storefront', 'customer/storefront.html#sfCatalog', 'store', EN ? 'Store' : 'المتجر') +
      cartItem +
      item('my-orders', 'customer/my-orders.html', 'receipt', EN ? 'Orders' : 'طلباتي') +
      '<button type="button" class="ds-bn-item" data-profile aria-label="' + esc(EN ? 'Profile' : 'حسابي') + '">' +
        icon('user') + '<span>' + esc(EN ? 'Profile' : 'حسابي') + '</span></button>' +
    '</nav>';
  }

  function staffBottomNav(user, active) {
    var EN = DS.lang() === 'en';
    var keysByRole = {
      superadmin: ['dashboard', 'orders', 'products', 'chats'],
      subadmin: ['dashboard', 'orders', 'products', 'chats'],
      owner: ['dashboard', 'sell', 'orders', 'products'],
      cashier: ['pos', 'orders', 'chats'],
      delivery: ['dashboard', 'orders', 'tracking', 'messages'],
      driver: ['dashboard', 'orders', 'tracking', 'messages']
    };
    var keys = (keysByRole[user.role] || ['dashboard']).slice();
    var byKey = {};
    navItemsFlat(user).forEach(function (n) { byKey[n.key] = n; });

    /* Keep the current page highlighted even when it is not one of the
       four primary tabs (reports, settings, a denied page, …). */
    var hasActive = keys.some(function (key) { return key === active && byKey[key]; });
    if (!hasActive && active && byKey[active]) {
      keys[keys.length - 1] = active;
      hasActive = true;
    }

    var html = '<nav class="ds-bottom-nav ds-bottom-nav-staff" aria-label="' +
      esc(EN ? 'Primary navigation' : 'التنقل الرئيسي') + '">';
    keys.forEach(function (key) {
      var item = byKey[key];
      if (!item) return;
      var badge = navBadgeCount(key, user);
      html += '<a class="ds-bn-item' + (key === active ? ' active' : '') + '" href="' + item.href + '"' +
        (key === active ? ' aria-current="page"' : '') + '>' +
        icon(item.icon) +
        (badge ? '<b class="ds-bn-badge">' + badge + '</b>' : '') +
        '<span>' + esc(item.label) + '</span></a>';
    });
    html += '<button type="button" class="ds-bn-item' + (hasActive ? '' : ' active') + '" data-bn-more aria-label="' +
      esc(EN ? 'More pages' : 'المزيد من الصفحات') + '"' + (hasActive ? '' : ' aria-current="page"') + '>' + icon('menu') +
      '<span>' + esc(EN ? 'More' : 'المزيد') + '</span></button>';
    return html + '</nav>';
  }

  /* One delegated listener keeps the dynamically re-rendered headers alive. */
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target || !target.closest) return;
    var themeBtn = target.closest('[data-theme-toggle]');
    if (themeBtn) {
      DS.toggleCustomerTheme();
      var dark = DS.customerTheme() === 'dark';
      var EN = DS.lang() === 'en';
      DS.$$('[data-theme-toggle]').forEach(function (b) {
        b.innerHTML = icon(dark ? 'sun' : 'moon');
        b.setAttribute('aria-label', dark
          ? (EN ? 'Switch to light mode' : 'التبديل للوضع الفاتح')
          : (EN ? 'Switch to dark mode' : 'التبديل للوضع الداكن'));
      });
      DS.toast(dark ? (EN ? 'Dark mode on' : 'تم تفعيل الوضع الداكن') : (EN ? 'Light mode on' : 'تم تفعيل الوضع الفاتح'), 'success');
      return;
    }
    if (target.closest('[data-customer-lang]')) {
      DS.setLang(DS.lang() === 'en' ? 'ar' : 'en');
      setTimeout(function () { location.reload(); }, 60);
      return;
    }
    if (target.closest('[data-customer-logout]')) {
      DS.logout();
      return;
    }
    if (target.closest('[data-loyalty-badge]')) {
      var pts = DS.loyalty ? DS.loyalty.get(DS.session()) : 0;
      DS.toast(DS.lang() === 'en'
        ? 'Your points: ' + pts + ' · 100 points = 10 EGP off'
        : 'نقاطك: ' + pts + ' نقطة · كل 100 نقطة = خصم 10 جنيه', 'info');
      return;
    }
    var cartNav = target.closest('[data-cart-nav]');
    if (cartNav) return; /* normal link navigation */
  });

  function mount(opts) {    opts = opts || {};
    var roles = opts.roles || null;
    var user = DS.requireAuth(roles);
    if (!user) return null;

    /* Folder-level guard. Shared page modules adapt their role list to the
       signed-in user, so without this an owner could open /admin/settings.html
       or a cashier could open the admin console and see their own variant of
       the page. Each role owns its folder; the cashier folder also serves
       owners (POS / sell) because owners are allowed to run the register,
       and the cashier may open the owner chat centre (messages) only. */
    var FOLDER_ROLES = {
      admin: ['superadmin', 'subadmin'],
      owner: ['owner', 'cashier'],
      cashier: ['cashier', 'owner'],
      delivery: ['delivery', 'driver'],
      customer: ['customer']
    };
    var folderMatch = String(window.location.pathname || '').match(/\/(admin|owner|cashier|delivery|customer)\//);
    var folder = folderMatch && FOLDER_ROLES[folderMatch[1]];
    if (folder && folder.indexOf(user.role) === -1) {
      window.location.replace(DS.url(DS.roleHome(user)));
      return null;
    }

    var denied = false;
    if (opts.permission && !hasPermission(user, opts.permission)) denied = true;

    var root = document.getElementById('app');
    if (!root) {
      root = document.createElement('div');
      root.id = 'app';
      document.body.appendChild(root);
    }

    var imp = impersonationMarkup(user);
    document.body.classList.toggle('ds-impersonating', !!imp);

    root.innerHTML = imp + '<div class="ds-app">' + sidebarMarkup(user, opts.active) +
      '<div class="ds-main">' + topbarMarkup(user, opts) +
      '<main class="ds-content" id="dsContent"></main></div></div>' +
      '<div class="drawer-scrim" data-scrim></div>' +
      '<button type="button" class="ds-help-fab help-btn" id="helpBtn" data-help-btn aria-label="' + esc(DS.lang() === 'en' ? 'Help & guides' : 'المساعدة والأدلة') + '" title="' + esc(DS.lang() === 'en' ? 'Help & guides' : 'المساعدة والأدلة') + '">?</button>';

    /* Customer surface: the storefront owns the viewport, so the only
       navigation on small screens is the fixed bottom bar. */
    var customerSurface = user.role === 'customer' ||
      document.body.classList.contains('saleor-store') ||
      document.body.classList.contains('saleor-checkout');
    if (customerSurface) {
      document.body.classList.add('ds-has-bottom-nav');
      root.insertAdjacentHTML('beforeend', customerBottomNav(opts.active));
    } else {
      document.body.classList.add('ds-has-bottom-nav', 'ds-has-bottom-nav-staff');
      root.insertAdjacentHTML('beforeend', staffBottomNav(user, opts.active));
    }

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
    watchOrderFeed(user);

    function bind() {
      /* help & step-by-step guides */
      DS.$$('[data-help-btn]', root).forEach(function (b) {
        b.addEventListener('click', function () { openHelp(user); });
      });
      /* impersonation exit */
      DS.$$('[data-stop-impersonation]', root).forEach(function (b) {
        b.addEventListener('click', function () { DS.stopImpersonating(); });
      });
      /* drawer */
      DS.$$('[data-menu]', root).forEach(function (b) { b.addEventListener('click', function () { sidebar.classList.add('open'); scrim.classList.add('open'); }); });
      DS.$$('[data-bn-more]', root).forEach(function (b) { b.addEventListener('click', function () { sidebar.classList.add('open'); scrim.classList.add('open'); }); });
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
    customerHeader: customerHeader,
    customerFooter: customerFooter,
    customerBottomNav: customerBottomNav,
    customerCartCount: customerCartCount,
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
