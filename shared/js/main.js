/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — MOTION LAYER (2026.11 · cleaned)
   The pointer/parallax, 3D-tilt, magnetic-button, scroll-reveal and
   ripple effects were removed because they caused jank on the
   storefront. Nothing here attaches event listeners.

   The tiny API surface is kept so any older page that still calls
   `DS.motion.refresh()` keeps working without errors.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.DSMotion) return;

  var api = {
    version: '2026.11-clean',
    pointer: false,
    refresh: function () {}
  };

  window.DSMotion = api;
  if (window.DS && typeof window.DS === 'object') window.DS.motion = api;
})();
