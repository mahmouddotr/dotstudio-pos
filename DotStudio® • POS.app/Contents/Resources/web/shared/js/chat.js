/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — CHAT
   One chat engine for Support / Public / Stores / Delivery.
   Support is visible to admins and the store owner only.
   Stores is owners + admins. Delivery is drivers + admins.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before chat.js'); return; }

  var t = DS.t, esc = DS.esc, icon = DS.icon;

  var SCOPES = [
    { key: 'support', labelKey: 'chatSupport', icon: 'lifebuoy' },
    { key: 'public', labelKey: 'chatPublic', icon: 'globe' },
    { key: 'stores', labelKey: 'chatStores', icon: 'store' },
    { key: 'delivery', labelKey: 'chatDelivery', icon: 'truck' }
  ];
  /* lifebuoy icon fallback */
  DS.icons.lifebuoy = '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/>';

  function canScope(user, scope) {
    if (!user) return false;
    var admin = user.role === 'superadmin' || user.role === 'subadmin';
    if (scope === 'support') return admin || user.role === 'owner' || user.role === 'cashier';
    if (scope === 'public') return true;
    if (scope === 'stores') return admin || user.role === 'owner';
    if (scope === 'delivery') return admin || user.role === 'delivery' || user.role === 'owner' || user.role === 'cashier';
    return false;
  }

  function roomsOf(user, scope) {
    if (!canScope(user, scope)) return [];
    return (DS.data.roomsFor(user) || []).filter(function (r) { return r.scope === scope; });
  }

  function roomTitle(room) {
    return DS.lang() === 'en' ? (room.title_en || room.title) : room.title;
  }

  function roomAvatar(room) {
    if (room.scope === 'support') {
      var tn = DS.data.tenantById(room.tenant_id);
      return tn ? DS.avatarUrl(tn) : DS.url('assets/img/LOGO-WHAIT.png');
    }
    if (room.scope === 'delivery') return '';
    return '';
  }

  function messagesMarkup(room, user) {
    if (!room) return '';
    var lastDay = '';
    var html = '';
    var allMessages = Array.isArray(room.messages) ? room.messages : [];
    var messages = allMessages.slice(Math.max(0, allMessages.length - 20));
    if (allMessages.length > messages.length) {
      html += '<div class="chat-day">' + esc(DS.lang() === 'en' ? 'Showing the latest 20 messages' : 'يتم عرض آخر 20 رسالة') + '</div>';
    }
    messages.forEach(function (m) {
      var day = DS.date(m.at);
      if (day !== lastDay) { html += '<div class="chat-day">' + esc(day) + '</div>'; lastDay = day; }
      var mine = m.user_id === user.id;
      var av = '';
      if (room.scope === 'support' && m.role === 'superadmin') {
        av = '<span class="avatar sm" style="background:var(--lime);color:var(--on-lime);font-weight:800">D</span>';
      } else {
        var u = DS.data.userById(m.user_id);
        av = '<img class="avatar sm" src="' + esc(DS.avatarUrl(u || { name: m.name })) + '" alt="">';
      }
      html += '<div class="chat-msg' + (mine ? ' mine' : '') + '">' + av +
        '<div><div class="chat-name">' + esc(mine ? t('you') : (function () { var usr = m.user_id && DS.data ? DS.data.userById(m.user_id) : null; return usr ? DS.loc(usr, 'name') : (DS.lang() === 'en' ? (m.name_en || m.name) : m.name); })()) + (room.scope !== 'support' && !mine ? ' · ' + esc(t(m.role === 'superadmin' ? 'admin' : m.role)) : '') + '</div>' +
        '<div class="chat-bubble">' + esc(DS.lang() === 'en' ? (m.text_en || m.text) : m.text) + '</div>' +
        '<div class="chat-meta">' + esc(DS.timeShort(m.at)) + '</div></div></div>';
    });
    return html;
  }

  function lockMarkup(scope) {
    return '<div class="chat-locked"><div class="empty-icon">' + icon('lock') + '</div>' +
      '<b>' + esc(t('chatLocked')) + '</b><p>' + esc(t('chatLockedText')) + '</p>' +
      '<span class="badge neutral">' + esc(t(scope === 'stores' ? 'chatOwnersOnly' : scope === 'support' ? 'chatSupport' : 'chatAdminOnly')) + '</span></div>';
  }

  /* ───────────────────────────── MOUNT ───────────────────────────── */
  function mount(el, opts) {
    if (!el) return null;
    opts = opts || {};
    var user = DS.session();
    if (!user) return null;
    var mode = opts.mode || 'full';
    var state = {
      scope: opts.scope || (mode === 'dock' ? 'public' : 'support'),
      roomId: opts.roomId || null
    };

    function allowedScopes() {
      return SCOPES.filter(function (s) { return canScope(user, s.key); });
    }
    function visibleScopes() {
      return opts.allTabs ? SCOPES : allowedScopes();
    }
    function currentRooms() { return roomsOf(user, state.scope); }
    function currentRoom() {
      var rooms = currentRooms();
      if (!rooms.length) return null;
      return rooms.filter(function (r) { return r.id === state.roomId; })[0] || rooms[0];
    }

    function render() {
      var tabHtml = visibleScopes().map(function (s) {
        var allowed = canScope(user, s.key);
        return '<button class="' + (mode === 'dock' ? 'dock-tab' : 'chat-rail-item') + (state.scope === s.key ? ' active' : '') + '" data-scope="' + s.key + '"' + (allowed ? '' : ' data-locked="1"') + '>' +
          icon(s.icon) + '<span>' + esc(t(s.labelKey)) + '</span>' + (!allowed ? icon('lock', 'lock') : '') + '</button>';
      }).join('');

      if (mode === 'dock') {
        var room = currentRoom();
        var allowed = canScope(user, state.scope);
        el.innerHTML = '<div class="chat-dock">' +
          '<div class="chat-dock-head"><div class="chat-head-info">' + icon('chat') + '<div><div class="chat-head-name">' + esc(t('deliveryChat')) + '</div><div class="chat-head-sub">' + esc(t('chatPublic') === 'العام' ? 'قنوات التواصل' : 'Communication channels') + '</div></div></div>' +
            '<span class="badge lime">' + icon('shield') + 'PRO</span></div>' +
          '<div class="dock-tabs">' + tabHtml + '</div>' +
          (allowed
            ? (room
              ? '<div class="chat-head" style="padding:9px 14px"><div class="chat-head-info"><span class="avatar sm" style="background:var(--surface-3)">' + icon('users') + '</span><div><div class="chat-head-name" style="font-size:12px">' + esc(roomTitle(room)) + '</div><div class="chat-head-sub">' + (room.messages || []).length + ' ' + esc(DS.lang() === 'en' ? 'messages' : 'رسالة') + '</div></div></div></div>' +
                '<div class="chat-dock-body" data-chat-body>' + messagesMarkup(room, user) + '</div>' +
                '<div class="chat-composer"><textarea rows="1" data-chat-input placeholder="' + esc(t('sendMessage')) + '"></textarea>' +
                '<button class="chat-send" data-chat-send aria-label="send">' + icon('send') + '</button></div>'
              : '<div class="chat-empty">' + esc(t('emptyChats')) + '</div>')
            : lockMarkup(state.scope)) +
          '</div>';
      } else {
        var rooms = currentRooms();
        var active = currentRoom();
        var allowedScope = canScope(user, state.scope);
        var roomsHtml = rooms.map(function (r) {
          var last = (r.messages || [])[r.messages.length - 1];
          return '<button class="chat-room' + (active && active.id === r.id ? ' active' : '') + '" data-room="' + esc(r.id) + '">' +
            (roomAvatar(r) ? '<img class="avatar sm" src="' + esc(roomAvatar(r)) + '" alt="">' : '<span class="avatar sm" style="background:var(--surface-3);color:var(--lime)">' + icon(r.scope === 'delivery' ? 'truck' : r.scope === 'stores' ? 'store' : 'globe') + '</span>') +
            '<div class="chat-room-info"><div class="chat-room-name">' + esc(roomTitle(r)) + '<span class="chat-room-time">' + (last ? esc(DS.timeShort(last.at)) : '') + '</span></div>' +
            '<div class="chat-room-preview">' + esc(last ? (DS.lang() === 'en' ? (last.text_en || last.text) : last.text) : t('emptyChats')) + '</div></div></button>';
        }).join('');

        el.innerHTML = '<div class="chat-shell">' +
          '<aside class="chat-side"><div class="chat-side-head"><div class="section-title" style="font-size:var(--fs-md)">' + esc(t('messages')) + ' <span class="badge lime">PRO</span></div>' +
            '<div class="page-sub" style="margin-top:4px;font-size:11px">' + esc(DS.lang() === 'en' ? 'Support, community and operations' : 'الدعم والمجتمع والعمليات') + '</div></div>' +
            '<div class="chat-tab-rail">' + tabHtml + '</div>' +
            '<div class="chat-rooms">' + (allowedScope ? (roomsHtml || '<div class="chat-empty" style="min-height:100px">' + esc(t('emptyChats')) + '</div>') : lockMarkup(state.scope)) + '</div></aside>' +
          '<section class="chat-main">' +
            (allowedScope && active
              ? '<div class="chat-head"><div class="chat-head-info">' + (roomAvatar(active) ? '<img class="avatar" src="' + esc(roomAvatar(active)) + '" alt="">' : '<span class="avatar" style="background:var(--surface-3);color:var(--lime)">' + icon('users') + '</span>') +
                  '<div><div class="chat-head-name">' + esc(roomTitle(active)) + '</div><div class="chat-head-sub">' + esc(actionHint(active, user)) + '</div></div></div>' +
                  '<span class="badge ' + (active.scope === 'support' ? 'lime' : active.scope === 'public' ? 'info' : active.scope === 'stores' ? 'orange' : 'purple') + '">' + esc(t('chat' + active.scope.charAt(0).toUpperCase() + active.scope.slice(1)) || active.scope) + '</span></div>' +
                '<div class="chat-body" data-chat-body>' + messagesMarkup(active, user) + '</div>' +
                '<div class="chat-composer"><textarea rows="1" data-chat-input placeholder="' + esc(t('sendMessage')) + '"></textarea>' +
                '<button class="chat-send" data-chat-send aria-label="send">' + icon('send') + '</button></div>'
              : '<div class="chat-empty">' + (allowedScope ? t('emptyChats') : t('chatLocked')) + '</div>') +
          '</section></div>';
      }
      bind();
    }

    function actionHint(room, user) {
      if (room.scope === 'support') return t('support');
      if (room.scope === 'public') return (room.messages || []).length + ' ' + (DS.lang() === 'en' ? 'messages · everyone' : 'رسالة · الجميع');
      if (room.scope === 'stores') return t('chatOwnersOnly');
      return t('chatDelivery');
    }

    function bind() {
      DS.$$('[data-scope]', el).forEach(function (b) {
        b.addEventListener('click', function () {
          var scope = b.getAttribute('data-scope');
          if (!canScope(user, scope)) { DS.toast(t('chatLockedText'), 'warning'); return; }
          state.scope = scope;
          state.roomId = null;
          render();
        });
      });
      DS.$$('[data-room]', el).forEach(function (b) {
        b.addEventListener('click', function () {
          state.roomId = b.getAttribute('data-room');
          render();
        });
      });
      var input = el.querySelector('[data-chat-input]');
      var sendBtn = el.querySelector('[data-chat-send]');
      var body = el.querySelector('[data-chat-body]');
      if (body) body.scrollTop = body.scrollHeight;
      if (input) {
        input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });
      }
      if (sendBtn) sendBtn.addEventListener('click', send);

      function send() {
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        var room = currentRoom();
        if (!room) { DS.toast(t('emptyChats'), 'error'); return; }
        DS.data.sendMessage(room.id, text);
        input.value = '';
        input.style.height = 'auto';
        var newBody = el.querySelector('[data-chat-body]');
        newBody.innerHTML = messagesMarkup(room, user);
        newBody.scrollTop = newBody.scrollHeight;
        if (mode === 'dock') {
          /* refresh scope counter in head */
        }
      }
    }

    render();

    return {
      element: el,
      refresh: render,
      scope: function (s) { state.scope = s; state.roomId = null; render(); },
      destroy: function () { el.innerHTML = ''; }
    };
  }

  DS.chat = {
    mount: mount,
    scopes: SCOPES,
    canScope: canScope,
    roomsOf: roomsOf
  };

  console.log('%cDotStudio® POS · chat ready', 'color:#82FF1F;font-weight:bold');
})();
