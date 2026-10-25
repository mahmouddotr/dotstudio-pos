/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — CHAT (Apple Messages / WhatsApp layout)
   Three panes: channels · conversations · thread.
   Channels are only rendered when the signed-in role can use them,
   so there are no "locked" screens anywhere.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before chat.js'); return; }

  var t = DS.t, esc = DS.esc, icon = DS.icon;

  DS.icons.lifebuoy = '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/>';

  var SCOPES = [
    { key: 'support', labelKey: 'chatSupport', hintKey: 'chatSupportHint', icon: 'lifebuoy', tone: 'lime' },
    { key: 'direct', labelKey: 'chatDirect', hintKey: 'chatDirectHint', icon: 'store', tone: 'blue' },
    { key: 'public', labelKey: 'chatPublic', hintKey: 'chatPublicHint', icon: 'globe', tone: 'purple' },
    { key: 'stores', labelKey: 'chatStores', hintKey: 'chatStoresHint', icon: 'building', tone: 'orange' },
    { key: 'delivery', labelKey: 'chatDelivery', hintKey: 'chatDeliveryHint', icon: 'truck', tone: 'teal' }
  ];

  function isAdmin(user) { return !!user && (user.role === 'superadmin' || user.role === 'subadmin'); }

  function canScope(user, scope) {
    if (!user) return false;
    var admin = isAdmin(user);
    if (scope === 'support') return true;
    if (scope === 'public') return true;
    if (scope === 'direct') return user.role === 'customer' || user.role === 'owner' || user.role === 'cashier';
    if (scope === 'stores') return admin || user.role === 'owner';
    if (scope === 'delivery') return admin || user.role === 'delivery' || user.role === 'owner' || user.role === 'cashier';
    return false;
  }

  function meta(scope) {
    return SCOPES.filter(function (s) { return s.key === scope; })[0] || SCOPES[0];
  }

  function roomsOf(user, scope) {
    if (!canScope(user, scope)) return [];
    var rooms = (DS.data.roomsFor(user) || []).filter(function (r) { return r.scope === scope; });
    /* Support: for customers/drivers hide the other tenants' rooms. */
    if (scope === 'support' && !isAdmin(user)) {
      rooms = rooms.filter(function (r) { return r.tenant_id == null || r.tenant_id === (user.tenant_id || DS.data.currentStoreId(user)); });
    }
    return rooms;
  }

  function langText(obj, base) {
    if (!obj) return '';
    return DS.lang() === 'en' ? (obj[base + '_en'] || obj[base] || '') : (obj[base] || obj[base + '_en'] || '');
  }

  function roomTitle(room) { return langText(room, 'title'); }

  function roomHint(room, user) {
    var m = meta(room.scope);
    if (room.scope === 'direct') {
      var tn = DS.data.tenantById(room.tenant_id);
      if (user.role === 'customer') return tn ? langText(tn, 'industry') : t('chatDirectHint');
      return t('chatDirectHint');
    }
    if (room.scope === 'support') return t('chatSupportHint');
    return t(m.hintKey);
  }

  function avatarFor(room, user) {
    if (room.scope === 'support' || room.scope === 'direct') {
      var tn = DS.data.tenantById(room.tenant_id);
      if (tn) return '<img class="avatar sm" src="' + esc(DS.avatarUrl(tn)) + '" alt="">';
      return '<span class="avatar sm chat-avatar-brand">D</span>';
    }
    var m = meta(room.scope);
    return '<span class="avatar sm chat-avatar-tone ' + m.tone + '">' + icon(m.icon) + '</span>';
  }

  function lastMessage(room) {
    var msgs = room.messages || [];
    return msgs.length ? msgs[msgs.length - 1] : null;
  }

  function otherParty(room, user) {
    if (room.scope === 'public') return t('chatPublicHint');
    if (room.scope === 'stores') return t('chatStoresHint');
    if (room.scope === 'delivery') return t('chatDeliveryHint');
    if (room.scope === 'support') return t('chatSupportHint');
    var tn = DS.data.tenantById(room.tenant_id);
    return tn ? langText(tn, 'name') : t('chatDirectHint');
  }

  function dayLabel(iso) {
    var d = new Date(iso);
    var today = new Date();
    var same = d.toDateString() === today.toDateString();
    if (same) return DS.lang() === 'en' ? 'Today' : 'اليوم';
    var y = new Date(Date.now() - 86400000);
    if (d.toDateString() === y.toDateString()) return DS.lang() === 'en' ? 'Yesterday' : 'أمس';
    return DS.date(iso);
  }

  function messagesMarkup(room, user) {
    var msgs = (room.messages || []).slice(-80);
    if (!msgs.length) {
      return '<div class="chat-thread-empty"><div class="cte-icon">' + icon('chat') + '</div>' +
        '<b>' + esc(t('chatStartConversation')) + '</b><p>' + esc(t('chatEmptyHint')) + '</p></div>';
    }
    var html = '', lastDay = '';
    msgs.forEach(function (m, i) {
      var day = dayLabel(m.at);
      if (day !== lastDay) {
        html += '<div class="chat-day"><span>' + esc(day) + '</span></div>';
        lastDay = day;
      }
      var mine = m.user_id === user.id;
      var prev = msgs[i - 1];
      var grouped = prev && prev.user_id === m.user_id && (new Date(m.at) - new Date(prev.at)) < 5 * 60000;
      var name = DS.lang() === 'en' ? (m.name_en || m.name) : (m.name || m.name_en);
      var u = DS.data.userById(m.user_id);
      if (u) name = langText(u, 'name');
      var av = '';
      if (!mine) {
        av = grouped ? '<span class="chat-msg-av"></span>' : '<img class="chat-msg-av" src="' + esc(DS.avatarUrl(u || { name: name })) + '" alt="">';
      }
      html += '<div class="chat-msg' + (mine ? ' mine' : '') + (grouped ? ' grouped' : '') + '">' + av +
        '<div class="chat-msg-body">' +
          (!mine && !grouped ? '<div class="chat-name">' + esc(name) + '</div>' : '') +
          '<div class="chat-bubble">' + esc(DS.lang() === 'en' ? (m.text_en || m.text) : m.text) + '</div>' +
          '<div class="chat-meta">' + esc(DS.timeShort(m.at)) + (mine ? '<span class="ticks">' + icon('check') + '</span>' : '') + '</div>' +
        '</div></div>';
    });
    return html;
  }

  function roomListMarkup(rooms, activeId, user) {
    if (!rooms.length) {
      return '<div class="chat-list-empty"><div class="cte-icon">' + icon('chat') + '</div><b>' + esc(t('chatNoRooms')) + '</b></div>';
    }
    return rooms.map(function (r) {
      var last = lastMessage(r);
      var preview = last ? (DS.lang() === 'en' ? (last.text_en || last.text) : last.text) : t('chatEmptyHint');
      var mineLast = last && last.user_id === user.id;
      return '<button type="button" class="chat-room' + (r.id === activeId ? ' active' : '') + '" data-room="' + esc(r.id) + '">' +
        avatarFor(r, user) +
        '<span class="chat-room-info"><span class="chat-room-name">' + esc(roomTitle(r)) + '</span>' +
        '<span class="chat-room-preview">' + (mineLast ? '<i>' + esc(t('you')) + ':</i> ' : '') + esc(preview) + '</span></span>' +
        '<span class="chat-room-side"><span class="chat-room-time">' + (last ? esc(DS.timeShort(last.at)) : '') + '</span>' +
        '<span class="chat-room-count">' + (r.messages || []).length + '</span></span></button>';
    }).join('');
  }

  function channelListMarkup(scopes, state, user) {
    return scopes.map(function (s) {
      var count = roomsOf(user, s.key).reduce(function (n, r) { return n + (r.messages || []).length; }, 0);
      return '<button type="button" class="chat-channel' + (state.scope === s.key ? ' active' : '') + '" data-scope="' + s.key + '" title="' + esc(t(s.labelKey)) + '">' +
        '<span class="cc-ico ' + s.tone + '">' + icon(s.icon) + '</span>' +
        '<span class="cc-label">' + esc(t(s.labelKey)) + '</span>' +
        (count ? '<span class="cc-count">' + count + '</span>' : '') +
        '</button>';
    }).join('');
  }

  function meMarkup(user) {
    return '<div class="chat-me">' +
      '<img class="avatar" src="' + esc(DS.avatarUrl(user)) + '" alt="">' +
      '<div class="chat-me-info"><b>' + esc(langText(user, 'name')) + '</b><span>' + esc(t(user.role === 'superadmin' ? 'admin' : user.role)) + '</span></div>' +
      '<span class="chat-online" title="' + esc(t('chatOnline')) + '"></span></div>';
  }

  /* ───────────────────────────── MOUNT ───────────────────────────── */
  function mount(el, opts) {
    if (!el) return null;
    opts = opts || {};
    var user = DS.session();
    if (!user) return null;

    var mode = opts.mode || 'full';
    var scopes = SCOPES.filter(function (s) { return canScope(user, s.key); });
    if (!scopes.length) scopes = [SCOPES[0]];

    var state = {
      scope: opts.scope && canScope(user, opts.scope) ? opts.scope : scopes[0].key,
      roomId: opts.roomId || null,
      mobileConv: false
    };

    function currentRooms() { return roomsOf(user, state.scope); }
    function currentRoom() {
      var rooms = currentRooms();
      if (!rooms.length) return null;
      var found = rooms.filter(function (r) { return r.id === state.roomId; })[0];
      if (found) return found;
      state.roomId = rooms[0].id;
      return rooms[0];
    }

    function headerMarkup(room) {
      if (!room) return '';
      return '<div class="chat-conv-head">' +
        '<button type="button" class="chat-back" data-chat-back aria-label="back">' + icon('chevronRight') + '</button>' +
        avatarFor(room, user) +
        '<div class="chat-conv-id"><b>' + esc(roomTitle(room)) + '</b>' +
          '<span><i class="chat-live-dot"></i>' + esc(otherParty(room, user)) + '</span></div>' +
        '<span class="chat-conv-tag">' + icon(meta(room.scope).icon) + esc(t(meta(room.scope).labelKey)) + '</span>' +
      '</div>';
    }

    function threadMarkup(room) {
      return '<div class="chat-thread" data-chat-thread>' + messagesMarkup(room, user) + '</div>' +
        '<div class="chat-compose">' +
          '<div class="chat-compose-box"><textarea rows="1" data-chat-input placeholder="' + esc(t('sendMessage')) + '" aria-label="' + esc(t('sendMessage')) + '"></textarea></div>' +
          '<button type="button" class="chat-send" data-chat-send aria-label="' + esc(t('send')) + '">' + icon('send') + '</button>' +
        '</div>';
    }

    function render() {
      var room = currentRoom();
      var list = currentRooms();

      if (mode === 'dock') {
        el.innerHTML = '<div class="chat-dock">' +
          '<div class="chat-dock-head">' +
            '<div class="chat-dock-title">' + icon('chat') + '<div><b>' + esc(t('messages')) + '</b><span>' + esc(t('chatChannels')) + '</span></div></div>' +
            '<span class="chat-live-pill"><i></i>' + esc(t('live')) + '</span>' +
          '</div>' +
          '<div class="dock-tabs">' + channelListMarkup(scopes, state, user) + '</div>' +
          (room
            ? '<div class="chat-dock-room">' + avatarFor(room, user) + '<div><b>' + esc(roomTitle(room)) + '</b><span>' + esc(otherParty(room, user)) + '</span></div></div>' +
              threadMarkup(room)
            : '<div class="chat-thread-empty"><div class="cte-icon">' + icon('chat') + '</div><b>' + esc(t('chatNoRooms')) + '</b></div>') +
          '</div>';
        bind();
        return;
      }

      el.innerHTML = '<div class="chat-app" data-view="' + (state.mobileConv ? 'conversation' : 'list') + '">' +
        '<aside class="chat-channels">' +
          '<div class="chat-channels-head"><b>' + esc(t('messages')) + '</b><span>' + esc(t('chatChannels')) + '</span></div>' +
          '<div class="chat-channel-list">' + channelListMarkup(scopes, state, user) + '</div>' +
          meMarkup(user) +
        '</aside>' +
        '<section class="chat-rooms-pane">' +
          '<div class="chat-pane-head"><div><b>' + esc(t(meta(state.scope).labelKey)) + '</b><span>' + esc(t(meta(state.scope).hintKey)) + '</span></div>' +
            '<span class="chat-pane-count">' + list.length + '</span></div>' +
          '<div class="chat-room-list">' + roomListMarkup(list, room && room.id, user) + '</div>' +
        '</section>' +
        '<section class="chat-conv">' +
          (room ? headerMarkup(room) + threadMarkup(room)
            : '<div class="chat-thread-empty"><div class="cte-icon">' + icon('chat') + '</div><b>' + esc(t('chatPick')) + '</b><p>' + esc(t('chatPickText')) + '</p></div>') +
        '</section>' +
        '</div>';
      bind();
    }

    function scrollThread() {
      var th = el.querySelector('[data-chat-thread]');
      if (th) th.scrollTop = th.scrollHeight;
    }

    function bind() {
      DS.$$('[data-scope]', el).forEach(function (b) {
        b.addEventListener('click', function () {
          state.scope = b.getAttribute('data-scope');
          state.roomId = null;
          state.mobileConv = false;
          render();
        });
      });
      DS.$$('[data-room]', el).forEach(function (b) {
        b.addEventListener('click', function () {
          state.roomId = b.getAttribute('data-room');
          state.mobileConv = true;
          render();
        });
      });
      var back = el.querySelector('[data-chat-back]');
      if (back) back.addEventListener('click', function () { state.mobileConv = false; render(); });

      var input = el.querySelector('[data-chat-input]');
      var sendBtn = el.querySelector('[data-chat-send]');
      if (input) {
        input.addEventListener('input', function () {
          input.style.height = 'auto';
          input.style.height = Math.min(120, input.scrollHeight) + 'px';
          if (sendBtn) sendBtn.classList.toggle('ready', !!input.value.trim());
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });
      }
      if (sendBtn) sendBtn.addEventListener('click', send);
      scrollThread();

      function send() {
        if (!input) return;
        var text = input.value.trim();
        if (!text) return;
        var room = currentRoom();
        if (!room) return;
        var msg = DS.data.sendMessage(room.id, text);
        if (!msg) { DS.toast(t('noPermission'), 'error'); return; }
        input.value = '';
        input.style.height = 'auto';
        if (sendBtn) sendBtn.classList.remove('ready');
        var th = el.querySelector('[data-chat-thread]');
        if (th) {
          th.innerHTML = messagesMarkup(room, user);
          th.scrollTop = th.scrollHeight;
        } else {
          render();
        }
        /* refresh list previews without losing focus */
        var listHost = el.querySelector('.chat-room-list');
        if (listHost) {
          listHost.innerHTML = roomListMarkup(currentRooms(), room.id, user);
          DS.$$('[data-room]', listHost).forEach(function (b) {
            b.addEventListener('click', function () {
              state.roomId = b.getAttribute('data-room');
              state.mobileConv = true;
              render();
            });
          });
        }
      }
    }

    render();

    return {
      element: el,
      refresh: render,
      scope: function (s) { if (canScope(user, s)) { state.scope = s; state.roomId = null; state.mobileConv = false; render(); } },
      room: function (id) { state.roomId = id; state.mobileConv = true; render(); },
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
