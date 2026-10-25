/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — CHAT (1-on-1, hierarchical)
   Three panes: channels · contacts · direct thread.
   Support → people · Stores → storefronts · Delivery → companies.
   Every selection opens a focused one-to-one conversation, with a
   settings menu to block or report the other party.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before chat.js'); return; }

  var t = DS.t, esc = DS.esc, icon = DS.icon;

  DS.icons.lifebuoy = '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24M14.83 9.17l4.24-4.24M14.83 14.83l4.24 4.24M9.17 14.83l-4.24 4.24"/>';

  var SCOPES = [
    { key: 'support', labelKey: 'chatSupport', hintKey: 'chatSupportHint', icon: 'lifebuoy', tone: 'lime' },
    { key: 'stores', labelKey: 'chatStores', hintKey: 'chatStoresHint', icon: 'store', tone: 'blue' },
    { key: 'delivery', labelKey: 'chatDelivery', hintKey: 'chatDeliveryHint', icon: 'truck', tone: 'teal' }
  ];

  function isAdmin(user) { return !!user && (user.role === 'superadmin' || user.role === 'subadmin'); }

  function canScope(user, scope) {
    if (DS.data && DS.data.chatCanScope) return DS.data.chatCanScope(user, scope);
    return false;
  }

  function meta(scope) {
    return SCOPES.filter(function (s) { return s.key === scope; })[0] || SCOPES[0];
  }

  function langText(obj, base) {
    if (!obj) return '';
    return DS.lang() === 'en' ? (obj[base + '_en'] || obj[base] || '') : (obj[base] || obj[base + '_en'] || '');
  }

  function contactsOf(user, scope) {
    if (!canScope(user, scope)) return [];
    return DS.data.chatContacts(user, scope) || [];
  }

  function contactName(contact) {
    return DS.lang() === 'en' ? (contact.name_en || contact.name) : (contact.name || contact.name_en);
  }

  function contactSub(contact) {
    return DS.lang() === 'en' ? (contact.subtitle_en || contact.subtitle) : (contact.subtitle || contact.subtitle_en);
  }

  function avatarFor(contact, cls) {
    cls = cls || 'avatar sm';
    if (contact.type === 'user') {
      var u = DS.data.userById(contact.id);
      if (u) return '<img class="' + cls + '" src="' + esc(DS.avatarUrl(u)) + '" alt="">';
      return '<span class="' + cls + ' chat-avatar-tone lime">' + esc(DS.initials(contactName(contact))) + '</span>';
    }
    if (contact.type === 'tenant') {
      var tn = DS.data.tenantById(contact.id);
      if (tn) return '<img class="' + cls + '" src="' + esc(DS.avatarUrl(tn)) + '" alt="">';
      return '<span class="' + cls + ' chat-avatar-tone blue">' + icon('store') + '</span>';
    }
    var co = (DS.data.companies || []).filter(function (c) { return c.id === contact.id; })[0];
    return '<span class="' + cls + ' chat-avatar-tone teal">' + esc((co && co.emoji) || '🛵') + '</span>';
  }

  function roomOf(user, scope, contact) {
    if (!contact) return null;
    return DS.data.chatThread(user, scope, contact.id);
  }

  function lastMessage(room) {
    var msgs = (room && room.messages) || [];
    return msgs.length ? msgs[msgs.length - 1] : null;
  }

  function dayLabel(iso) {
    var d = new Date(iso);
    var today = new Date();
    if (d.toDateString() === today.toDateString()) return DS.lang() === 'en' ? 'Today' : 'اليوم';
    var y = new Date(Date.now() - 86400000);
    if (d.toDateString() === y.toDateString()) return DS.lang() === 'en' ? 'Yesterday' : 'أمس';
    return DS.date(iso);
  }

  function messagesMarkup(room, user) {
    var msgs = ((room && room.messages) || []).slice(-120);
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
        av = grouped
          ? '<span class="chat-msg-av"></span>'
          : '<img class="chat-msg-av" src="' + esc(DS.avatarUrl(u || { name: name })) + '" alt="">';
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

  function contactListMarkup(contacts, activeKey, user, scope) {
    if (!contacts.length) {
      return '<div class="chat-list-empty"><div class="cte-icon">' + icon('chat') + '</div><b>' + esc(t('chatNoRooms')) + '</b></div>';
    }
    return contacts.map(function (c) {
      var room = roomOf(user, scope, c);
      var last = lastMessage(room);
      var preview = last
        ? (DS.lang() === 'en' ? (last.text_en || last.text) : last.text)
        : (contactSub(c) || t('chatEmptyHint'));
      var mineLast = last && last.user_id === user.id;
      var blocked = DS.data.isPeerBlocked(scope, c.id, user);
      var count = room ? (room.messages || []).length : 0;
      return '<button type="button" class="chat-room' + (c.key === activeKey ? ' active' : '') + (blocked ? ' is-blocked' : '') + '" data-contact="' + esc(c.key) + '">' +
        avatarFor(c) +
        '<span class="chat-room-info"><span class="chat-room-name">' + esc(contactName(c)) +
          (blocked ? ' <span class="chat-blocked-chip">' + icon('lock') + '</span>' : '') + '</span>' +
        '<span class="chat-room-preview">' + (mineLast ? '<i>' + esc(t('you')) + ':</i> ' : '') + esc(String(preview).slice(0, 80)) + '</span></span>' +
        '<span class="chat-room-side"><span class="chat-room-time">' + (last ? esc(DS.timeShort(last.at)) : '') + '</span>' +
        (count ? '<span class="chat-room-count">' + count + '</span>' : '') + '</span></button>';
    }).join('');
  }

  function channelListMarkup(scopes, state, user) {
    return scopes.map(function (s) {
      var contacts = contactsOf(user, s.key);
      var msgs = contacts.reduce(function (n, c) {
        var room = roomOf(user, s.key, c);
        return n + ((room && room.messages) || []).length;
      }, 0);
      return '<button type="button" class="chat-channel' + (state.scope === s.key ? ' active' : '') + '" data-scope="' + s.key + '" title="' + esc(t(s.labelKey)) + '">' +
        '<span class="cc-ico ' + s.tone + '">' + icon(s.icon) + '</span>' +
        '<span class="cc-label">' + esc(t(s.labelKey)) + '</span>' +
        (msgs ? '<span class="cc-count">' + msgs + '</span>' : '') +
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
      contactKey: null,
      mobileConv: false
    };

    function currentContacts() { return contactsOf(user, state.scope); }

    function currentContact() {
      var list = currentContacts();
      if (!list.length) return null;
      var found = list.filter(function (c) { return c.key === state.contactKey; })[0];
      if (found) return found;
      /* keep a previous selection only if it exists in this scope */
      if (state.contactKey) {
        state.contactKey = null;
      }
      return list[0];
    }

    function selectDefault() {
      var c = currentContact();
      state.contactKey = c ? c.key : null;
      return c;
    }

    function headerMarkup(contact, room, blocked) {
      if (!contact) return '';
      return '<div class="chat-conv-head">' +
        '<button type="button" class="chat-back" data-chat-back aria-label="back">' + icon('chevronRight') + '</button>' +
        avatarFor(contact, 'avatar') +
        '<div class="chat-conv-id"><b>' + esc(contactName(contact)) + '</b>' +
          '<span><i class="chat-live-dot"></i>' + esc(contactSub(contact) || t(meta(state.scope).hintKey)) + '</span></div>' +
        '<span class="chat-conv-tag">' + icon(meta(state.scope).icon) + esc(t(meta(state.scope).labelKey)) + '</span>' +
        '<button type="button" class="chat-settings-btn' + (blocked ? ' is-blocked' : '') + '" data-chat-settings aria-label="' + esc(t('chatSettings')) + '" title="' + esc(t('chatSettings')) + '">' + icon('settings') + '</button>' +
      '</div>';
    }

    function threadMarkup(contact, room, blocked) {
      if (blocked) {
        return '<div class="chat-thread" data-chat-thread>' + messagesMarkup(room, user) + '</div>' +
          '<div class="chat-blocked-bar">' + icon('lock') +
            '<span>' + esc(t('chatBlockedNotice')) + '</span>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-chat-unblock>' + esc(t('chatUnblock')) + '</button>' +
          '</div>';
      }
      return '<div class="chat-thread" data-chat-thread>' + messagesMarkup(room, user) + '</div>' +
        '<div class="chat-compose">' +
          '<div class="chat-compose-box"><textarea rows="1" data-chat-input placeholder="' + esc(t('sendMessage')) + '" aria-label="' + esc(t('sendMessage')) + '"></textarea></div>' +
          '<button type="button" class="chat-send" data-chat-send aria-label="' + esc(t('send')) + '">' + icon('send') + '</button>' +
        '</div>';
    }

    function render() {
      var contact = selectDefault();
      var room = roomOf(user, state.scope, contact);
      var blocked = contact ? DS.data.isPeerBlocked(state.scope, contact.id, user) : false;
      var list = currentContacts();

      if (mode === 'dock') {
        el.innerHTML = '<div class="chat-dock">' +
          '<div class="chat-dock-head">' +
            '<div class="chat-dock-title">' + icon('chat') + '<div><b>' + esc(t('messages')) + '</b><span>' + esc(t('chatChannels')) + '</span></div></div>' +
            '<span class="chat-live-pill"><i></i>' + esc(t('live')) + '</span>' +
          '</div>' +
          '<div class="dock-tabs">' + channelListMarkup(scopes, state, user) + '</div>' +
          (contact
            ? '<div class="chat-dock-room">' + avatarFor(contact) + '<div><b>' + esc(contactName(contact)) + '</b><span>' + esc(contactSub(contact)) + '</span></div></div>' +
              threadMarkup(contact, room, blocked)
            : '<div class="chat-thread-empty"><div class="cte-icon">' + icon('chat') + '</div><b>' + esc(t('chatNoRooms')) + '</b></div>') +
          '</div>';
        bind(contact);
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
          '<div class="chat-room-list">' + contactListMarkup(list, contact && contact.key, user, state.scope) + '</div>' +
        '</section>' +
        '<section class="chat-conv">' +
          (contact
            ? headerMarkup(contact, room, blocked) + threadMarkup(contact, room, blocked)
            : '<div class="chat-thread-empty"><div class="cte-icon">' + icon('chat') + '</div><b>' + esc(t('chatPick')) + '</b><p>' + esc(t('chatPickText')) + '</p></div>') +
        '</section>' +
        '</div>';
      bind(contact);
    }

    function scrollThread() {
      var th = el.querySelector('[data-chat-thread]');
      if (th) th.scrollTop = th.scrollHeight;
    }

    function bind(contact) {
      DS.$$('[data-scope]', el).forEach(function (b) {
        b.addEventListener('click', function () {
          state.scope = b.getAttribute('data-scope');
          state.contactKey = null;
          state.mobileConv = false;
          render();
        });
      });
      DS.$$('[data-contact]', el).forEach(function (b) {
        b.addEventListener('click', function () {
          state.contactKey = b.getAttribute('data-contact');
          state.mobileConv = true;
          render();
        });
      });
      var back = el.querySelector('[data-chat-back]');
      if (back) back.addEventListener('click', function () { state.mobileConv = false; render(); });

      var gear = el.querySelector('[data-chat-settings]');
      if (gear && contact) gear.addEventListener('click', function () { openSettings(contact); });

      var unblock = el.querySelector('[data-chat-unblock]');
      if (unblock && contact) unblock.addEventListener('click', function () {
        DS.data.togglePeerBlock(state.scope, contact.id, user);
        DS.toast(t('chatUnblocked'), 'success');
        render();
      });

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
        if (!input || !contact) return;
        var text = input.value.trim();
        if (!text) return;
        if (DS.data.isPeerBlocked(state.scope, contact.id, user)) {
          DS.toast(t('chatBlockedNotice'), 'error');
          return;
        }
        var msg = DS.data.sendMessageTo(state.scope, contact.id, text);
        if (!msg) { DS.toast(t('noPermission'), 'error'); return; }
        input.value = '';
        input.style.height = 'auto';
        if (sendBtn) sendBtn.classList.remove('ready');
        var room = roomOf(user, state.scope, contact);
        var th = el.querySelector('[data-chat-thread]');
        if (th) {
          th.innerHTML = messagesMarkup(room, user);
          th.scrollTop = th.scrollHeight;
        } else {
          render();
        }
        /* refresh contact previews without losing focus */
        var listHost = el.querySelector('.chat-room-list');
        if (listHost) {
          listHost.innerHTML = contactListMarkup(currentContacts(), contact.key, user, state.scope);
          DS.$$('[data-contact]', listHost).forEach(function (b) {
            b.addEventListener('click', function () {
              state.contactKey = b.getAttribute('data-contact');
              state.mobileConv = true;
              render();
            });
          });
        }
      }
    }

    function openSettings(contact) {
      var blocked = DS.data.isPeerBlocked(state.scope, contact.id, user);
      var body = '<div class="chat-settings">' +
        '<div class="chat-settings-peer">' + avatarFor(contact, 'avatar') +
          '<div><b>' + esc(contactName(contact)) + '</b><span>' + esc(contactSub(contact)) + '</span></div>' +
        '</div>' +
        '<button type="button" class="chat-settings-row" data-settings-block>' +
          '<span class="cs-ico">' + icon(blocked ? 'checkCircle' : 'lock') + '</span>' +
          '<span class="cs-copy"><b>' + esc(blocked ? t('chatUnblock') : t('chatBlock')) + '</b><small>' + esc(t('chatBlockHint')) + '</small></span>' +
        '</button>' +
        '<button type="button" class="chat-settings-row danger" data-settings-report>' +
          '<span class="cs-ico">' + icon('alert') + '</span>' +
          '<span class="cs-copy"><b>' + esc(t('chatReport')) + '</b><small>' + esc(t('chatReportHint')) + '</small></span>' +
        '</button>' +
      '</div>';

      var m = DS.modal({
        size: 'sm',
        title: t('chatSettings'),
        sub: contactName(contact),
        body: body,
        actions: [{ label: t('close'), variant: 'btn-secondary' }],
        onMount: function (root) {
          var blockBtn = root.querySelector('[data-settings-block]');
          if (blockBtn) blockBtn.addEventListener('click', function () {
            var nowBlocked = DS.data.togglePeerBlock(state.scope, contact.id, user);
            DS.toast(nowBlocked ? t('chatBlockedToast') : t('chatUnblocked'), 'success');
            m.close();
            render();
          });
          var reportBtn = root.querySelector('[data-settings-report]');
          if (reportBtn) reportBtn.addEventListener('click', function () {
            m.close();
            setTimeout(function () { openReport(contact); }, 140);
          });
        }
      });
    }

    function openReport(contact) {
      var reasons = DS.lang() === 'en'
        ? ['Spam or advertising', 'Harassment or abuse', 'Impersonation', 'Inappropriate content', 'Other']
        : ['رسائل مزعجة أو إعلانات', 'إساءة أو تحرش', 'انتحال شخصية', 'محتوى غير لائق', 'أخرى'];
      var body = '<div class="chat-report">' +
        '<p class="hint">' + esc(t('chatReportText')) + '</p>' +
        '<div class="chat-report-reasons">' + reasons.map(function (r, i) {
          return '<label class="check chat-report-reason"><input type="radio" name="chatReason" value="' + esc(r) + '"' + (i === 0 ? ' checked' : '') + '><span>' + esc(r) + '</span></label>';
        }).join('') + '</div>' +
        '<div class="field" style="margin-top:12px"><label>' + esc(t('chatReportDetails')) + '</label>' +
        '<textarea class="input" rows="3" data-report-details placeholder="' + esc(t('chatReportPlaceholder')) + '"></textarea></div>' +
      '</div>';
      DS.modal({
        size: 'sm',
        title: t('chatReport'),
        sub: contactName(contact),
        body: body,
        actions: [
          { label: t('cancel'), variant: 'btn-secondary' },
          { label: t('chatSendReport'), variant: 'btn-primary', onClick: function (root) {
            var picked = root.querySelector('input[name="chatReason"]:checked');
            var detail = (root.querySelector('[data-report-details]').value || '').trim();
            var reason = (picked ? picked.value : '') + (detail ? ' — ' + detail : '');
            DS.data.reportPeer(state.scope, contact.id, reason, user);
            DS.toast(t('chatReportSent'), 'success');
            return true;
          } }
        ]
      });
    }

    render();

    return {
      element: el,
      refresh: render,
      scope: function (s) { if (canScope(user, s)) { state.scope = s; state.contactKey = null; state.mobileConv = false; render(); } },
      room: function (id) {
        /* Accept a room id for backwards compatibility. */
        var list = currentContacts();
        var match = list.filter(function (c) { return c.roomId === id; })[0];
        if (match) { state.contactKey = match.key; state.mobileConv = true; render(); }
      },
      disable: function () { el.innerHTML = '<div class="chat-thread-empty"><div class="cte-icon">' + icon('lock') + '</div><b>' + esc(t('chatLocked')) + '</b><p>' + esc(t('chatLockedText')) + '</p></div>'; },
      destroy: function () { el.innerHTML = ''; }
    };
  }

  DS.chat = {
    mount: mount,
    scopes: SCOPES,
    canScope: canScope,
    contactsOf: contactsOf,
    roomsOf: function (user, scope) {
      return scope ? (DS.data.roomsForScope(user || DS.session(), scope) || []) : (DS.data.roomsFor(user || DS.session()) || []);
    }
  };

  console.log('%cDotStudio® POS · chat ready (1-on-1)', 'color:#82FF1F;font-weight:bold');
})();
