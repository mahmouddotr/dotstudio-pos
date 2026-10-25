/* DotStudio® POS — Chat centre (all roles) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon;
  var user = DS.session();
  if (!user) return;

  var isAdmin = DS.data.isAdmin(user);
  var store = user.tenant_id ? DS.data.tenantById(user.tenant_id) : null;
  var company = user.delivery_company ? (DS.data.companies || []).filter(function (c) { return c.id === user.delivery_company; })[0] : null;

  var defaultScope = isAdmin ? 'support'
    : user.role === 'delivery' ? 'delivery'
      : 'stores';
  var qScope = DS.qs('scope');
  if (qScope === 'direct' || qScope === 'public') qScope = 'stores';
  var scope = (qScope && DS.chat && DS.chat.canScope(user, qScope)) ? qScope : defaultScope;

  var page = DS.shell.mount({
    roles: null,
    permission: user.role === 'subadmin' ? 'chats' : null,
    active: 'chats',
    title: t('messages'),
    eyebrow: isAdmin ? t('admin') : (store ? store.name : (company ? company.name : t('delivery'))),
    icon: 'chat',
    sub: DS.lang() === 'en'
      ? 'Support, stores and delivery — one clean inbox.'
      : 'الدعم والمتاجر والتوصيل — صندوق واحد مرتب.',
    actions: '<span class="badge lime">' + icon('wifi') + ' ' + esc(t('live')) + '</span>',
    content: '<div class="chat-page-host"><div class="skeleton" style="height:min(72vh,720px);border-radius:24px"></div></div>'
  });
  if (!page) return;

  page.setContent('<div class="chat-page-host" data-chat-host></div>');
  var host = page.body.querySelector('[data-chat-host]');
  if (!host || !DS.chat) { page.setContent(DS.empty({ icon: 'chat', title: t('noData') })); return; }

  var chat = DS.chat.mount(host, { mode: 'full', scope: scope });
  document.addEventListener('ds:lang', function () { if (chat) chat.refresh(); });
})();
