/* DotStudio® POS — Chat centre */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon;
  var user = DS.session();
  if (!user) return;
  var isAdmin = DS.data.isAdmin(user);
  var page = DS.shell.mount({
    roles: isAdmin ? ['superadmin', 'subadmin'] : (user.role === 'delivery' ? ['delivery'] : ['owner', 'cashier']),
    permission: user.role === 'subadmin' ? 'chats' : null,
    active: 'chats',
    title: t('chats'),
    eyebrow: isAdmin ? t('admin') : (user.role === 'delivery' ? t('delivery') : (DS.data.tenantById(user.tenant_id) || {}).name),
    icon: 'chat',
    sub: DS.lang() === 'en' ? 'Support, public, stores and delivery — in one inbox.' : 'الدعم، العام، المتاجر وشركات التوصيل — في صندوق واحد.',
    actions: '<span class="badge lime">' + icon('shield') + ' ' + esc(t('live')) + '</span>',
    content: '<div class="skeleton" style="height:560px;border-radius:20px"></div>'
  });
  if (!page) return;

  setTimeout(function () {
    page.setContent('<div id="chatHost"></div>');
    var host = page.body.querySelector('#chatHost');
    DS.chat.mount(host, { mode: 'full', scope: isAdmin ? 'support' : user.role === 'delivery' ? 'delivery' : 'support' });
  }, 150);
})();
