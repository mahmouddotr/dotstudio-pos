/* DotStudio® POS — local preview bootstrap
 * Runs before core.js so a standalone dashboard can render without Firebase.
 * IMPORTANT: it must never overwrite a real login session. A real login always
 * wins; the folder-based preview is only seeded when there is no session yet.
 */
(function () {
  'use strict';

  /* Kill any stale service worker from older builds. */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) { registration.unregister(); });
    }).catch(function () {});
  }

  var existing = null;
  try { existing = JSON.parse(localStorage.getItem('cz_user') || 'null'); } catch (e) {}
  if (existing && existing.role) return;   /* real session — leave it alone */

  var path = window.location.pathname || '';
  var preview = null;
  if (/\/admin\//.test(path)) {
    preview = { id: 'u-admin', username: 'admin', role: 'superadmin', name: 'System Admin', name_en: 'System Admin', avatar_id: 'av9', is_active: true };
  } else if (/\/owner\//.test(path)) {
    preview = { id: 'u-owner-caznova', username: 'caznova', role: 'owner', name: 'أحمد كازنوفا', name_en: 'Ahmed Caznova', tenant_id: 't-caznova', avatar_id: 'av1', is_active: true };
  } else if (/\/cashier\//.test(path)) {
    preview = { id: 'u-cashier-caznova', username: 'ca_cashier', role: 'cashier', name: 'كاشير Caznova', name_en: 'Caznova Cashier', tenant_id: 't-caznova', avatar_id: 'av5', is_active: true };
  } else if (/\/customer\//.test(path)) {
    preview = { id: 'u-customer', username: 'customer', role: 'customer', name: 'ياسمين محمد', name_en: 'Yasmin Mohamed', tenant_id: 't-caznova', phone: '01123456789', city: 'القاهرة', city_en: 'Cairo', address: 'مدينة نصر · شارع مصطفى النحاس · عمارة 12', address_en: 'Nasr City · Mostafa El Nahas St. · Building 12', avatar_id: 'av5', is_active: true };
  } else if (/\/delivery\//.test(path)) {
    preview = { id: 'u-del-talqa', username: 'talqa', role: 'delivery', name: 'طلقة', name_en: 'Talqa', delivery_company: 'dc-talqa', delivery_company_name: 'طلقة', avatar_id: 'av3', is_active: true };
  }

  if (preview) {
    try {
      localStorage.setItem('cz_user', JSON.stringify(preview));
      localStorage.setItem('cz_session', preview.id);
      localStorage.setItem('cz_role', preview.role);
      localStorage.setItem('cz_mock', '1');
      localStorage.setItem('ds_preview_mode', '1');
      if (preview.tenant_id) localStorage.setItem('ds_customer_store', preview.tenant_id);
    } catch (e) {}
  }
})();
