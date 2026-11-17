/* DotStudio® POS — Floating AI chatbot (customer pages)
   Help (?) and the AI assistant share one fixed column at the bottom-left.
   The panel is dark glassmorphism and answers with a mock assistant reply. */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) return;
  var EN = DS.lang() === 'en';

  function reply(q) {
    q = String(q || '').toLowerCase();
    if (q.indexOf('شحن') > -1 || q.indexOf('delivery') > -1 || q.indexOf('توصيل') > -1) {
      return EN ? 'Shipping is FREE for orders over 100 EGP. Standard delivery takes 30–45 minutes.'
                : 'الشحن مجاني للطلبات فوق 100 جنيه. التوصيل القياسي يستغرق 30–45 دقيقة.';
    }
    if (q.indexOf('استرجاع') > -1 || q.indexOf('return') > -1 || q.indexOf('refund') > -1) {
      return EN ? 'You can return any item within 14 days of delivery, no questions asked.'
                : 'يمكنك إرجاع أي منتج خلال 14 يوماً من التسليم، بدون أسئلة.';
    }
    if (q.indexOf('دفع') > -1 || q.indexOf('payment') > -1) {
      return EN ? 'We accept Cash on Delivery, Fawry and Vodafone Cash.'
                : 'نقبل الدفع عند الاستلام، فوري، وفودافون كاش.';
    }
    if (q.indexOf('نقاط') > -1 || q.indexOf('points') > -1) {
      return EN ? 'You earn 1 point per 50 EGP spent. 100 points = 10 EGP off.'
                : 'تكسب نقطة واحدة لكل 50 جنيه. 100 نقطة = خصم 10 جنيه.';
    }
    return EN ? 'I can help with shipping, returns, payments and points. For anything else, talk to a human.'
              : 'يمكنني المساعدة في الشحن، الإرجاع، الدفع والنقاط. لأي شيء آخر، تواصل مع موظف.';
  }

  /* ── One fixed column: Help (?) above the AI chat button ───────── */
  var actions = document.querySelector('.floating-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'floating-actions';
    document.body.appendChild(actions);
  }

  var help = document.getElementById('helpBtn');
  if (help && help.parentNode !== actions) actions.appendChild(help);

  var fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'sf-chatbot-fab';
  fab.setAttribute('aria-label', EN ? 'AI assistant' : 'المساعد الذكي');
  fab.setAttribute('title', EN ? 'AI assistant' : 'المساعد الذكي');
  fab.innerHTML = '💬';
  actions.appendChild(fab);

  var panel = document.createElement('div');
  panel.className = 'sf-chatbot-panel';
  panel.innerHTML = '<div class="sf-cb-head">' +
      '<span class="sf-cb-dot"></span>' +
      '<b>' + (EN ? 'DotStudio Assistant' : 'مساعد DotStudio') + '</b>' +
      '<button type="button" class="sf-cb-close" data-cb-close aria-label="' + (EN ? 'Close' : 'إغلاق') + '">✕</button>' +
    '</div>' +
    '<div class="sf-cb-log" data-cb-log></div>' +
    '<div class="sf-cb-form">' +
      '<input data-cb-input class="sf-cb-input" placeholder="' + (EN ? 'Ask a question…' : 'اسأل سؤالاً…') + '">' +
      '<button type="button" class="sf-cb-send" data-cb-send>' + (EN ? 'Send' : 'إرسال') + '</button>' +
    '</div>' +
    '<div class="sf-cb-foot">' +
      '<button type="button" class="sf-cb-human" data-cb-handoff>' + (EN ? 'Talk to a human' : 'تحدث مع موظف') + '</button>' +
    '</div>';
  document.body.appendChild(panel);

  var log = panel.querySelector('[data-cb-log]');
  function addMsg(text, from) {
    var b = document.createElement('div');
    b.className = 'sf-cb-msg is-' + (from === 'user' ? 'user' : 'bot');
    b.textContent = text;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
  }
  var greeted = false;
  function greet() {
    if (greeted) return;
    greeted = true;
    /* Mock assistant response — bots answer after a short human pause. */
    setTimeout(function () { addMsg('كيف يمكنني مساعدتك؟', 'bot'); }, 420);
  }
  addMsg(EN ? 'Hi! Ask me about shipping, returns, payments or points.' : 'مرحباً! اسألني عن الشحن، الإرجاع، الدفع أو النقاط.', 'bot');

  function send() {
    var input = panel.querySelector('[data-cb-input]');
    var q = input.value.trim();
    if (!q) return;
    addMsg(q, 'user');
    input.value = '';
    setTimeout(function () { addMsg(reply(q), 'bot'); }, 600);
  }
  panel.querySelector('[data-cb-send]').addEventListener('click', send);
  panel.querySelector('[data-cb-input]').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  panel.querySelector('[data-cb-handoff]').addEventListener('click', function () {
    if (DS.openSupportHub) DS.openSupportHub({ tenantId: '', order: null });
    else location.href = DS.url('auth/public-chat.html');
  });
  panel.querySelector('[data-cb-close]').addEventListener('click', function () {
    panel.classList.remove('is-open');
    document.body.classList.remove('chat-panel-open');
  });

  fab.addEventListener('click', function () {
    var open = !panel.classList.contains('is-open');
    panel.classList.toggle('is-open', open);
    document.body.classList.toggle('chat-panel-open', open);
    if (open) {
      greet();
      setTimeout(function () {
        var input = panel.querySelector('[data-cb-input]');
        if (input) input.focus();
      }, 180);
    }
  });
})();
