/* DotStudio® POS — Public community chat */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, url = DS.url;
  var user = DS.session();
  if (!user) { location.replace(url('index.html')); return; }

  var page = DS.shell.mount({
    roles: null,
    active: 'public-chat',
    title: t('publicChat'),
    eyebrow: DS.lang() === 'en' ? 'Community' : 'المجتمع',
    icon: 'globe',
    sub: DS.lang() === 'en' ? 'Talk to stores, drivers and the DotStudio team in real time.' : 'تحدث مع المتاجر والمندوبين وفريق DotStudio في الوقت الحقيقي.',
    actions: '<span class="badge lime">' + icon('wifi') + ' ' + esc(t('live')) + '</span>' +
      '<a class="btn btn-secondary" href="' + url(DS.roleHome(user)) + '">' + icon('dashboard') + esc(t('back')) + '</a>',
    content: '<div class="chat-host" data-chat-host>' + DS.skeleton.rows(5) + '</div>'
  });
  if (!page) return;

  var host = page.body.querySelector('[data-chat-host]');
  if (!host || !DS.chat) { page.setContent(DS.empty({ icon: 'chat', title: t('noData') })); return; }
  DS.chat.mount(host, { mode: 'full', scope: 'public', allTabs: true });
})();
