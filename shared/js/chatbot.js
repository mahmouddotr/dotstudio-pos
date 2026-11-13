/* DotStudio® POS — Floating AI chatbot (customer pages) */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) return;
  var EN = DS.lang() === 'en';

  function reply(q) {
    q = String(q || '').toLowerCase();
    if (q.indexOf('شحن') > -1 || q.indexOf('delivery') > -1 || q.indexOf('توصيل') > -1) {
      return EN ? 'Shipping is FREE for orders over 100 EGP. Standard delivery takes 30–45 minutes.'
                : 'الشحن مجاني للطلبات فوق 100 جنيه. التوصيل القياسي takes 30–45 دقيقة.';
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
      return EN ? 'You earn 1 point per 10 EGP spent. 100 points = 10 EGP off.'
                : 'تكسب نقطة واحدة لكل 10 جنيه. 100 نقطة = خصم 10 جنيه.';
    }
    return EN ? 'I can help with shipping, returns, payments and points. For anything else, talk to a human.'
              : 'يمكنني المساعدة في الشحن، الإرجاع، الدفع والنقاط. لأي شيء آخر، تواصل مع موظف.';
  }

  var fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'sf-chatbot-fab';
  fab.setAttribute('aria-label', EN ? 'Chat' : 'محادثة');
  fab.innerHTML = '💬';
  fab.style.cssText = 'position:fixed;bottom:90px;inset-inline-end:22px;z-index:999;width:52px;height:52px;border-radius:50%;border:0;background:#1d1d1f;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25);';
  document.body.appendChild(fab);

  var panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;bottom:150px;inset-inline-end:22px;width:320px;max-width:90vw;height:420px;background:#fff;border:1px solid #e5e5ea;border-radius:18px;box-shadow:0 18px 48px rgba(0,0,0,.25);display:none;flex-direction:column;overflow:hidden;z-index:1000;';
  panel.innerHTML = '<div style="padding:12px 14px;font-weight:700;border-bottom:1px solid #e5e5ea;background:#f5f5f7">' + (EN ? 'DotStudio Assistant' : 'مساعد DotStudio') + '</div>' +
    '<div data-cb-log style="flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px"></div>' +
    '<div style="padding:10px;border-top:1px solid #e5e5ea;display:flex;gap:6px">' +
      '<input data-cb-input style="flex:1;border:1px solid #e5e5ea;border-radius:10px;padding:8px 10px;font-size:13px" placeholder="' + (EN ? 'Ask a question…' : 'اسأل سؤالاً…') + '">' +
      '<button data-cb-send style="border:0;background:#1d1d1f;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer">' + (EN ? 'Send' : 'إرسال') + '</button>' +
    '</div>' +
    '<div style="padding:8px 10px;border-top:1px solid #e5e5ea">' +
      '<button data-cb-handoff style="width:100%;border:1px solid #e5e5ea;background:#fff;border-radius:10px;padding:8px;font-size:12px;cursor:pointer">' + (EN ? 'Talk to a human' : 'تحدث مع موظف') + '</button>' +
    '</div>';
  document.body.appendChild(panel);

  var log = panel.querySelector('[data-cb-log]');
  function addMsg(text, from) {
    var b = document.createElement('div');
    b.style.cssText = 'padding:8px 10px;border-radius:12px;max-width:85%;font-size:13px;line-height:1.5;' +
      (from === 'user' ? 'background:#1d1d1f;color:#fff;align-self:flex-end;' : 'background:#f5f5f7;color:#1d1d1f;align-self:flex-start;');
    b.textContent = text;
    log.appendChild(b);
    log.scrollTop = log.scrollHeight;
  }
  addMsg(EN ? 'Hi! Ask me about shipping, returns, payments or points.' : 'مرحباً! اسألني عن الشحن، الإرجاع، الدفع أو النقاط.', 'bot');

  function send() {
    var input = panel.querySelector('[data-cb-input]');
    var q = input.value.trim();
    if (!q) return;
    addMsg(q, 'user');
    input.value = '';
    setTimeout(function () { addMsg(reply(q), 'bot'); }, 300);
  }
  panel.querySelector('[data-cb-send]').addEventListener('click', send);
  panel.querySelector('[data-cb-input]').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  panel.querySelector('[data-cb-handoff]').addEventListener('click', function () {
    if (DS.openSupportHub) DS.openSupportHub({ tenantId: '', order: null });
    else location.href = DS.url('auth/public-chat.html');
  });

  fab.addEventListener('click', function () {
    panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  });
})();
