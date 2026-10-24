/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — Service Worker
   • Precache the shared shell and every app page
   • Cache-first for static assets, network-first for navigation
   • Never intercept cross-origin / API requests
   ═══════════════════════════════════════════════════════════════ */
'use strict';

var VERSION = 'dotstudio-pos-v9';
var SHELL = [
  './',
  './index.html',
  './manifest.json',
  './marketing/index.html',
  './auth/jobs/jobs.html',
  './auth/public-chat.html',
  './shared/css/design-system.css',
  './shared/css/components.css',
  './shared/css/app.css',
  './shared/js/core.js',
  './shared/js/data.js',
  './shared/js/shell.js',
  './shared/js/ui.js',
  './shared/js/chat.js',
  './shared/js/gps-track.js',
  './shared/js/pages/dashboard.js',
  './shared/js/pages/products.js',
  './shared/js/pages/orders.js',
  './shared/js/pages/stores.js',
  './shared/js/pages/subadmins.js',
  './shared/js/pages/cashiers.js',
  './shared/js/pages/companies.js',
  './shared/js/pages/customers.js',
  './shared/js/pages/chats.js',
  './shared/js/pages/admin-jobs.js',
  './shared/js/pages/jobs-public.js',
  './shared/js/pages/reports.js',
  './shared/js/pages/subscriptions.js',
  './shared/js/pages/audit.js',
  './shared/js/pages/settings.js',
  './shared/js/pages/pos.js',
  './shared/js/pages/invoices.js',
  './shared/js/pages/storefront.js',
  './shared/js/pages/checkout.js',
  './shared/js/pages/my-orders.js',
  './shared/js/pages/tracking.js',
  './shared/js/pages/delivery-dashboard.js',
  './shared/js/pages/delivery-orders.js',
  './shared/js/pages/delivery-tracking.js',
  './shared/js/pages/public-chat.js',
  './assets/img/LOGO-WHAIT.png',
  './assets/img/LOGO-BLACK.png',
  './assets/img/LOGO-ICON-DONE.png',
  './assets/img/logo-192.png',
  './assets/img/logo-512.png',
  './assets/img/logo.png',
  './assets/product-placeholder.svg',
  './assets/fonts/ClashDisplay-Regular.otf',
  './assets/fonts/ClashDisplay-Medium.otf',
  './assets/fonts/ClashDisplay-Semibold.otf',
  './assets/fonts/ClashDisplay-Bold.otf',
  './assets/fonts/inter/inter-latin.woff2',
  './assets/fonts/inter/inter-latin-ext.woff2',
  './assets/fonts/plex/ibm-plex-arabic-400-arabic.woff2',
  './assets/fonts/plex/ibm-plex-arabic-600-arabic.woff2',
  './assets/fonts/plex/ibm-plex-arabic-700-arabic.woff2'
];

var PAGES = [
  './admin/dashboard.html', './admin/orders.html', './admin/products.html', './admin/stores.html',
  './admin/customers.html', './admin/cashiers.html', './admin/delivery-companies.html',
  './admin/sub-admins.html', './admin/reports.html', './admin/subscriptions.html', './admin/jobs.html',
  './admin/audit-logs.html', './admin/chats.html', './admin/settings.html',
  './owner/dashboard.html', './owner/orders.html', './owner/products.html', './owner/customers.html',
  './owner/cashiers.html', './owner/delivery-companies.html', './owner/reports.html',
  './owner/subscriptions.html', './owner/chats.html', './owner/settings.html',
  './cashier/pos.html', './cashier/orders.html', './cashier/invoices.html', './cashier/settings.html',
  './delivery/dashboard.html', './delivery/orders.html', './delivery/tracking.html', './delivery/messages.html',
  './customer/storefront.html', './customer/checkout.html', './customer/my-orders.html', './customer/tracking.html'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return Promise.all(SHELL.concat(PAGES).map(function (path) {
        return cache.add(new Request(path, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== VERSION) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isCacheable(request) {
  if (request.method !== 'GET') return false;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.indexOf('/api/') !== -1) return false;
  return true;
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (!isCacheable(request)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        var copy = response.clone();
        caches.open(VERSION).then(function (cache) { cache.put(request, copy); });
        return response;
      }).catch(function () {
        return caches.match(request).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (hit) {
      var network = fetch(request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(VERSION).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});

/* ───────────────────────── Push notifications ───────────────────────── */
function dsShowNotification(payload) {
  payload = payload || {};
  return self.registration.showNotification(payload.title || 'DotStudio® POS', {
    body: payload.body || 'لديك تحديث جديد في طلبك',
    icon: payload.icon || './assets/img/logo-192.png',
    badge: payload.badge || './assets/img/logo-192.png',
    tag: payload.tag || ('dotstudio-' + Date.now()),
    renotify: true,
    vibrate: [90, 40, 90],
    timestamp: Date.now(),
    dir: 'rtl',
    lang: 'ar',
    data: {
      url: payload.url || './customer/tracking.html',
      order_id: payload.order_id || '',
      type: payload.type || 'order_update'
    },
    actions: [
      { action: 'track', title: 'تتبّع الطلب' },
      { action: 'close', title: 'إغلاق' }
    ]
  });
}

self.addEventListener('push', function (event) {
  var data = {};
  try {
    if (event.data) data = event.data.json();
    else data = { title: 'DotStudio® POS', body: 'لديك تحديث جديد' };
  } catch (e) {
    try { data = { title: 'DotStudio® POS', body: event.data.text() }; }
    catch (e2) { data = { title: 'DotStudio® POS', body: 'لديك تحديث جديد' }; }
  }
  event.waitUntil(dsShowNotification(data));
});

self.addEventListener('message', function (event) {
  var msg = event.data || {};
  if (msg.type !== 'DS_PUSH' || !msg.notification) return;
  event.waitUntil(dsShowNotification(msg.notification));
});

self.addEventListener('notificationclick', function (event) {
  var n = event.notification || {};
  var data = n.data || {};
  if (event.action === 'close') { n.close(); return; }
  n.close();
  var target = data.url || './customer/tracking.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        try {
          if (data.order_id) c.postMessage({ type: 'DS_NOTIFICATION_CLICK', order_id: data.order_id, url: target });
          if ('focus' in c) {
            c.focus();
            if ('navigate' in c) return c.navigate(target).catch(function () { return c; });
            return c;
          }
        } catch (e) {}
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
