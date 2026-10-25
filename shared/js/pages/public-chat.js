/* DotStudio® POS — Community chat (public entry point for every role) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url;
  var user = DS.session();
  if (!user) { location.replace(url('index.html')); return; }

  var qScope = DS.qs('scope');
  var scope = (qScope && DS.chat && DS.chat.canScope(user, qScope)) ? qScope : 'public';

  var page = DS.shell.mount({
    roles: null,
    active: 'chats',
    title: t('messages'),
    eyebrow: DS.lang() === 'en' ? 'Community' : 'المجتمع',
    icon: 'chat',
    sub: DS.lang() === 'en'
      ? 'Talk to stores, drivers and the DotStudio team in real time.'
      : 'تحدث مع المتاجر والمندوبين وفريق DotStudio في الوقت الحقيقي.',
    actions: '<span class="badge lime">' + icon('wifi') + ' ' + esc(t('live')) + '</span>' +
      '<a class="btn btn-secondary" href="' + url(DS.roleHome(user)) + '">' + icon('dashboard') + esc(t('back')) + '</a>',
    content: '<div class="chat-page-host"><div class="skeleton" style="height:min(72vh,720px);border-radius:24px"></div></div>'
  });
  if (!page) return;

  var host = page.body.querySelector('.chat-page-host');
  if (!host || !DS.chat) { page.setContent(DS.empty({ icon: 'chat', title: t('noData') })); return; }

  var chat = DS.chat.mount(host, { mode: 'full', scope: scope });
  document.addEventListener('ds:lang', function () { if (chat) chat.refresh(); });
})();
