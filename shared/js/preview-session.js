/* DotStudio® POS — local preview bootstrap
 * Runs before core.js so every standalone dashboard can render without Firebase.
 * The normal login flow still writes the same cz_user session shape.
 */
(function () {
  'use strict';
  var path = window.location.pathname || '';
  var preview = null;
  if (/\/admin\//.test(path)) {
    preview = { id: 'u-admin', username: 'admin', role: 'superadmin', name: 'System Admin', name_en: 'System Admin', avatar_id: 'av9', is_active: true };
  } else if (/\/owner\//.test(path)) {
    preview = { id: 'u-owner-caznova', username: 'caznova', role: 'owner', name: 'أحمد كازنوفا', name_en: 'Ahmed Caznova', tenant_id: 't-caznova', avatar_id: 'av1', is_active: true };
  } else if (/\/cashier\//.test(path)) {
    preview = { id: 'u-cashier-caznova', username: 'ca_cashier', role: 'cashier', name: 'كاشير Caznova', name_en: 'Caznova Cashier', tenant_id: 't-caznova', avatar_id: 'av5', is_active: true };
  } else if (/\/customer\//.test(path)) {
    preview = { id: 'u-customer', username: 'customer', role: 'customer', name: 'ياسمين محمد', name_en: 'Yasmin Mohamed', tenant_id: 't-caznova', avatar_id: 'av5', is_active: true };
  } else if (/\/delivery\//.test(path)) {
    preview = { id: 'u-del-talqa', username: 'talqa', role: 'delivery', name: 'طلقة', name_en: 'Talqa', delivery_company: 'dc-talqa', delivery_company_name: 'طلقة', avatar_id: 'av3', is_active: true };
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) { registration.unregister(); });
    }).catch(function () {});
  }
  if (preview) {
    try {
      localStorage.setItem('cz_user', JSON.stringify(preview));
      localStorage.setItem('cz_session', 'active');
      localStorage.setItem('cz_role', preview.role);
      localStorage.setItem('ds_preview_mode', '1');
    } catch (e) {}
  }
})();
