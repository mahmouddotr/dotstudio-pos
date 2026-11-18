/* ═══════════════════════════════════════════════════════════════════
   DotStudio® — STORE STUDIO controller
   Clean, department-based storefront. No legacy shell / no extra layers.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) return;
  var user = DS.session();
  if (!user) { location.replace(DS.url('index.html')); return; }

  var EN = DS.lang() === 'en';
  var esc = DS.esc, url = DS.url, money = DS.money;
  var app = document.getElementById('app');
  if (!app) return;

  /* ── theme (light by default — editorial look) ─────────────────── */
  var theme = 'light';
  try { var t0 = localStorage.getItem('ds_customer_theme'); if (t0 === 'dark' || t0 === 'light') theme = t0; } catch (e) {}
  document.documentElement.setAttribute('data-st-theme', theme);
  document.body.className = 'st-body';
  document.body.setAttribute('dir', EN ? 'ltr' : 'rtl');

  /* ── departments keep the catalogue tidy ───────────────────────── */
  var DEPTS = [
    { id: 'fashion', slug: 'mastore', ar: 'الأزياء', en: 'Fashion',
      subAr: 'قطع مختارة بعناية لكل مناسبة', subEn: 'Considered pieces for every occasion',
      cats: ['رجالي', 'نسائي', 'إكسسوارات'],
      art: DS.url('products/4-mastore/5-mastore-leather-jacket.webp') },
    { id: 'luxury', slug: 'caznova', ar: 'الساعات والعطور', en: 'Watches & Perfumes',
      subAr: 'تفاصيل فخامة تكمل إطلالتك', subEn: 'The finishing touches of luxury',
      cats: ['ساعات', 'خواتم', 'عطور', 'اكسسوارات'],
      art: DS.url('products/1-caznova/5-caznova-watch.webp') },
    { id: 'juices', slug: 'smozy', ar: 'العصائر والمشروبات', en: 'Juices & Drinks',
      subAr: 'طازج كل يوم — من الطبيعة إليك', subEn: 'Fresh every day — straight from nature',
      cats: ['عصائر', 'سموذي', 'ميلك شيك'],
      art: DS.url('products/2-smozy/1-smozy-mango.webp') },
    { id: 'coffee', slug: 'bnsheikh', ar: 'القهوة المختصة', en: 'Specialty Coffee',
      subAr: 'حبوب مختارة ومحمصة طازجة', subEn: 'Selected beans, freshly roasted',
      cats: ['قهوة ساخنة', 'قهوة باردة', 'حبوب قهوة'],
      art: DS.url('products/3-bnsheikh/3-bnsheikh-cappuccino.webp') }
  ];

  var HERO = [
    { ar: 'أناقتك تبدأ من هنا', en: 'Your style starts here',
      subAr: 'مجموعة جديدة من القطع الأساسية بتصميم نظيف وجودة تدوم.',
      subEn: 'A new edit of essential pieces — clean design, lasting quality.',
      btnAr: 'تسوق الأزياء', btnEn: 'Shop fashion', dept: 'fashion',
      img: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=2000&q=85',
      fallback: url('assets/images/hero/slide-04.jpg') },
    { ar: 'وقتك يهمنا', en: 'Your time matters',
      subAr: 'ساعات وإكسسوارات تجمع بين الكلاسيكية والحداثة.',
      subEn: 'Watches and accessories that blend classic with modern.',
      btnAr: 'تسوق الساعات', btnEn: 'Shop watches', dept: 'luxury',
      img: url('assets/images/hero/slide-06.jpg'), fallback: url('assets/images/hero/slide-06.jpg') },
    { ar: 'انتعاش كل يوم', en: 'Freshness, every day',
      subAr: 'عصائر طازجة وسموذي وميلك شيك بمكونات طبيعية ١٠٠٪.',
      subEn: 'Fresh juices, smoothies and milkshakes — 100% natural.',
      btnAr: 'تسوق العصائر', btnEn: 'Shop juices', dept: 'juices',
      img: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=2000&q=85',
      fallback: url('assets/images/hero/slide-05.jpg') },
    { ar: 'طعم يستاهل الوقت', en: 'A taste worth the time',
      subAr: 'قهوة مختصة محمصة طازجة — من أول رشفة للآخيرة.',
      subEn: 'Specialty coffee, freshly roasted — from the first sip to the last.',
      btnAr: 'تسوق القهوة', btnEn: 'Shop coffee', dept: 'coffee',
      img: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=2000&q=85',
      fallback: url('assets/images/hero/slide-01.jpg') }
  ];

  var AV = { caznova: 'av1', smozy: 'av2', bnsheikh: 'av3', mastore: 'av4' };

  /* ── state ─────────────────────────────────────────────────────── */
  var apiProducts = null;
  var cart = DS.cart ? DS.cart.read() : { items: [] };
  var slide = 0, heroTimer = null;
  var filters = {};
  DEPTS.forEach(function (d) { filters[d.id] = 'all'; });

  function products() {
    var src = (apiProducts && apiProducts.length) ? apiProducts : (DS.data.products || []);
    return src.filter(function (p) { return p.is_active !== false; });
  }
  function productsFor(dep) {
    var tn = tenantFor(dep);
    if (!tn) return [];
    return products().filter(function (p) { return p.tenant_id === tn.id; });
  }
  function tenantFor(dep) {
    return (DS.data.tenants || []).filter(function (tn) { return tn.slug === dep.slug || tn.id === dep.id; })[0] || null;
  }
  function name(p) { return EN ? (p.name_en || p.name) : p.name; }
  function cat(p) { return EN ? (p.category_en || p.category) : p.category; }
  function image(p) { return DS.data.img(p.image); }
  function label(dep) { return EN ? dep.en : dep.ar; }
  function sub(dep) { return EN ? dep.subEn : dep.subAr; }

  function stars(r) {
    var n = Math.round(Number(r) || 0);
    var s = '';
    for (var i = 0; i < 5; i++) s += i < n ? '★' : '<span>★</span>';
    return '<span class="st-stars">' + s + '</span>';
  }
  function discount(p) {
    var old = Number(p.compare_at || p.old_price || 0);
    return old > Number(p.price) ? Math.round((1 - p.price / old) * 100) : 0;
  }
  function price(p) {
    var old = Number(p.compare_at || p.old_price || 0);
    return '<span class="st-card-price">' + esc(money(p.price)) +
      (old > p.price ? '<s>' + esc(money(old)) + '</s>' : '') + '</span>';
  }
  function isWished(id) {
    try { var w = JSON.parse(localStorage.getItem('ds_wishlist') || '[]'); return w.indexOf(id) > -1; } catch (e) { return false; }
  }
  function toggleWish(id) {
    var w = [];
    try { w = JSON.parse(localStorage.getItem('ds_wishlist') || '[]'); } catch (e) {}
    var i = w.indexOf(id);
    if (i > -1) w.splice(i, 1); else w.push(id);
    try { localStorage.setItem('ds_wishlist', JSON.stringify(w)); } catch (e) {}
    toast(i > -1 ? (EN ? 'Removed from wishlist' : 'تمت الإزالة من المفضلة') : (EN ? 'Added to wishlist' : 'تمت الإضافة للمفضلة'));
    DS.$$('[data-fav="' + id + '"]').forEach(function (b) { b.classList.toggle('is-on', i === -1); });
  }

  /* ── icon set (inline SVG, no external dependency) ─────────────── */
  var I = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1Z"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5m6 6-6-6 6-6"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    head: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a1 1 0 0 1-1-1v-5Zm16 0h-3v6h2a1 1 0 0 0 1-1v-5Z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m3 11 9-8 9 8v9H3v-9Z"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.2-4 4-6 8-6s6.8 2 8 6"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3 1.2-5A8 8 0 1 1 21 12Z"/></svg>'
  };

  /* ── markup ────────────────────────────────────────────────────── */
  function heroMarkup() {
    return '<section class="st-hero" id="home">' +
      '<div class="st-hero-track">' + HERO.map(function (h, i) {
        return '<div class="st-slide' + (i === 0 ? ' is-active' : '') + '" data-slide="' + i + '">' +
          '<img src="' + esc(h.img) + '" data-fallback="' + esc(h.fallback) + '" alt="" ' + (i ? 'loading="lazy"' : '') + '>' +
          '<div class="st-slide-inner"><div class="st-wrap"><div class="st-slide-copy">' +
          '<span class="st-kicker">DotStudio® · ' + esc(EN ? 'NEW SEASON' : 'الموسم الجديد') + '</span>' +
          '<h1 class="st-slide-title">' + esc(EN ? h.en : h.ar) + '</h1>' +
          '<p class="st-slide-sub">' + esc(EN ? h.subEn : h.subAr) + '</p>' +
          '<button class="st-cta" data-go-dept="' + h.dept + '">' + esc(EN ? h.btnEn : h.btnAr) + I.arrow + '</button>' +
          '</div></div></div></div>';
      }).join('') + '</div>' +
      '<button class="st-hero-arrow prev" data-slide-prev aria-label="previous">' + I.back + '</button>' +
      '<button class="st-hero-arrow next" data-slide-next aria-label="next">' + I.arrow + '</button>' +
      '<div class="st-dots">' + HERO.map(function (_, i) {
        return '<button class="st-dot' + (i === 0 ? ' is-active' : '') + '" data-dot="' + i + '" aria-label="slide ' + (i + 1) + '"></button>';
      }).join('') + '</div></section>';
  }
  function trustMarkup() {
    var items = [
      [I.truck, EN ? 'Free shipping' : 'شحن مجاني', EN ? 'On orders over 299 EGP' : 'للطلبات فوق ٢٩٩ ج.م'],
      [I.shield, EN ? 'Secure payment' : 'دفع آمن', EN ? '100% protected checkout' : 'إتمام طلب محمي ١٠٠٪'],
      [I.clock, EN ? 'Open 24 hours' : 'متاح 24 ساعة', EN ? 'Shop any time' : 'تسوق في أي وقت'],
      [I.head, EN ? 'Real support' : 'دعم حقيقي', EN ? 'We are here to help' : 'نحن هنا لمساعدتك']
    ];
    return '<div class="st-trust">' + items.map(function (x) {
      return '<div class="st-trust-item"><div class="st-ti">' + x[0] + '</div><div><b>' + esc(x[1]) + '</b><small>' + esc(x[2]) + '</small></div></div>';
    }).join('') + '</div>';
  }
  function catsMarkup() {
    return '<section class="st-section" id="categories"><div class="st-wrap">' +
      '<div class="st-section-head"><div><span class="st-kicker">Shop by category</span>' +
      '<h2>' + esc(EN ? 'Shop by department' : 'تسوق حسب القسم') + '</h2>' +
      '<p>' + esc(EN ? 'Everything in its place — find what you love faster.' : 'كل حاجة في مكانها — لاقي اللي تحبه أسرع.') + '</p></div>' +
      '<button class="st-link" data-scroll="stores">' + esc(EN ? 'All stores' : 'كل المتاجر') + I.arrow + '</button></div>' +
      '<div class="st-cats">' + DEPTS.map(function (d) {
        var first = productsFor(d)[0];
        return '<a class="st-cat" href="#' + d.id + '">' +
          '<img src="' + esc(first ? image(first) : d.art) + '" alt="' + esc(label(d)) + '" loading="lazy">' +
          '<div class="st-cat-body"><b>' + esc(label(d)) + '</b><span>' + I.arrow + '</span></div></a>';
      }).join('') + '</div></div></section>';
  }
  function cardMarkup(p) {
    var d = discount(p);
    return '<article class="st-card" data-product="' + esc(p.id) + '">' +
      '<div class="st-card-media">' +
        (d ? '<div class="st-card-top"><span class="st-tag">-' + d + '%</span></div>' : '') +
        '<button class="st-fav' + (isWished(p.id) ? ' is-on' : '') + '" data-fav="' + esc(p.id) + '" aria-label="wishlist">' + I.heart + '</button>' +
        '<img src="' + esc(image(p)) + '" alt="' + esc(name(p)) + '" loading="lazy">' +
        '<button class="st-add" data-add="' + esc(p.id) + '" aria-label="add">' + I.plus + '</button>' +
      '</div>' +
      '<div class="st-card-body">' +
        '<div class="st-card-cat">' + esc(cat(p)) + '</div>' +
        '<h3 class="st-card-name">' + esc(name(p)) + '</h3>' +
        price(p) + ' ' + stars(p.rating) +
      '</div></article>';
  }
  function deptMarkup(d, idx) {
    var list = productsFor(d);
    var cats = [];
    list.forEach(function (p) { if (cats.indexOf(cat(p)) === -1) cats.push(cat(p)); });
    var shown = filters[d.id] === 'all' ? list : list.filter(function (p) { return cat(p) === filters[d.id]; });
    return '<section class="st-section" id="' + d.id + '"><div class="st-wrap">' +
      '<div class="st-section-head"><div><span class="st-kicker">0' + (idx + 1) + ' / Collection</span>' +
      '<h2>' + esc(label(d)) + '</h2><p>' + esc(sub(d)) + '</p></div>' +
      '<button class="st-link" data-filter-all="' + d.id + '">' + esc(EN ? 'View all' : 'عرض الكل') + I.arrow + '</button></div>' +
      '<div class="st-pills" data-pills="' + d.id + '">' +
        '<button class="st-pill' + (filters[d.id] === 'all' ? ' is-active' : '') + '" data-pill="' + d.id + '|all">' + esc(EN ? 'All' : 'الكل') + '</button>' +
        cats.map(function (c) {
          return '<button class="st-pill' + (filters[d.id] === c ? ' is-active' : '') + '" data-pill="' + d.id + '|' + esc(c) + '">' + esc(c) + '</button>';
        }).join('') + '</div>' +
      '<div class="st-grid" data-grid="' + d.id + '">' + shown.map(cardMarkup).join('') + '</div>' +
      '</div></section>';
  }
  function promoMarkup() {
    return '<div class="st-wrap"><section class="st-promo">' +
      '<div class="st-promo-copy"><span class="st-kicker">' + esc(EN ? 'Limited time' : 'لفترة محدودة') + '</span>' +
      '<h2>' + esc(EN ? 'New season.\nNew you.' : 'موسم جديد.\nإطلالة جديدة.') + '</h2>' +
      '<p>' + esc(EN ? 'Fresh arrivals, considered prices. Discover the pieces everyone is talking about.' : 'وصلات جديدة بأسعار مدروسة. اكتشف القطع اللي الكل بيتكلم عنها.') + '</p>' +
      '<button class="st-cta" data-go-dept="fashion">' + esc(EN ? 'Shop the edit' : 'تسوق المجموعة') + I.arrow + '</button></div>' +
      '<div class="st-promo-art"><div class="st-promo-badge">' + esc(EN ? 'UP TO\n20%' : 'خصم\n٢٠٪') + '</div>' +
      '<img src="' + esc(DEPTS[0].art) + '" alt="collection" loading="lazy"></div>' +
      '</section></div>';
  }
  function storesMarkup() {
    return '<section class="st-section" id="stores" style="background:var(--st-bg-2)"><div class="st-wrap">' +
      '<div class="st-section-head"><div><span class="st-kicker">Our stores</span><h2>' + esc(EN ? 'Meet our stores' : 'متاجرنا') + '</h2>' +
      '<p>' + esc(EN ? 'Four brands, one seamless experience.' : '٤ براندات — تجربة واحدة متكاملة.') + '</p></div></div>' +
      '<div class="st-stores">' + DEPTS.map(function (d) {
        var tn = tenantFor(d); if (!tn) return '';
        var st = DS.data.storeStatus ? DS.data.storeStatus(tn) : { open: true, hoursLabel: EN ? 'Open 24 hours' : 'مفتوح 24 ساعة' };
        return '<div class="st-store"><div class="st-store-top">' +
          '<img class="st-store-av" src="' + url('assets/img/avatars/' + (AV[d.slug] || 'av1') + '.jpg') + '" alt="">' +
          '<div><b>' + esc(DS.loc(tn, 'name')) + '</b><small>' + esc(DS.loc(tn, 'industry') || '') + '</small></div></div>' +
          '<p>' + esc(DS.loc(tn, 'description') || '') + '</p>' +
          '<div class="st-store-foot"><span class="st-open">' + esc(st.open ? (EN ? 'Open now' : 'مفتوح الآن') : (EN ? 'Closed' : 'مغلق')) + '</span>' +
          '<span>' + esc(st.hoursLabel) + '</span></div></div>';
      }).join('') + '</div></div></section>';
  }
  function footerMarkup() {
    return '<footer class="st-foot"><div class="st-wrap"><div class="st-foot-grid">' +
      '<div class="st-foot-brand"><img src="' + url('assets/img/LOGO-WHAIT.png') + '" alt="DotStudio">' +
      '<p>' + esc(EN ? 'A complete platform for retail, sales and delivery — built for the way you work.' : 'منصة متكاملة للتجارة والمبيعات والتوصيل — مصممة بطريقة تناسب شغلك.') + '</p>' +
      '<div class="st-pay"><span>VISA</span><span>MASTERCARD</span><span>INSTAPAY</span><span>VODAFONE CASH</span></div></div>' +
      '<div><h4>' + esc(EN ? 'Shop' : 'تسوق') + '</h4><ul>' + DEPTS.map(function (d) {
        return '<li><a href="#' + d.id + '">' + esc(label(d)) + '</a></li>';
      }).join('') + '</ul></div>' +
      '<div><h4>' + esc(EN ? 'Help' : 'المساعدة') + '</h4><ul>' +
        '<li><a href="' + url('customer/my-orders.html') + '">' + esc(EN ? 'Track your order' : 'تتبع طلبك') + '</a></li>' +
        '<li><a href="' + url('auth/public-chat.html') + '">' + esc(EN ? 'Contact us' : 'اتصل بنا') + '</a></li>' +
        '<li><a href="' + url('customer/cart.html') + '">' + esc(EN ? 'Your cart' : 'سلتك') + '</a></li>' +
      '</ul></div>' +
      '<div><h4>' + esc(EN ? 'Company' : 'الشركة') + '</h4><ul>' +
        '<li><a href="' + url('marketing/index.html') + '">' + esc(EN ? 'About us' : 'من نحن') + '</a></li>' +
        '<li><a href="' + url('marketing/index.html') + '">' + esc(EN ? 'Careers' : 'الوظائف') + '</a></li>' +
        '<li><a href="' + url('auth/public-chat.html') + '">' + esc(EN ? 'Support' : 'الدعم') + '</a></li>' +
      '</ul></div></div>' +
      '<div class="st-foot-bottom"><span>© 2026 DotStudio® — ' + esc(EN ? 'All rights reserved' : 'كل الحقوق محفوظة') + '</span>' +
      '<span>' + esc(EN ? 'Designed with care · Built to last' : 'مصمم بعناية · مبني ليدوم') + '</span></div></div></footer>';
  }
  function overlaysMarkup() {
    return '<div class="st-shade" data-shade></div>' +
      '<aside class="st-drawer" data-drawer>' +
        '<div class="st-drawer-head"><h3>' + esc(EN ? 'Your cart' : 'سلة مشترياتك') + '</h3><button class="st-x" data-close-drawer>' + I.x + '</button></div>' +
        '<div class="st-drawer-body" data-drawer-body></div>' +
        '<div class="st-drawer-foot" data-drawer-foot></div>' +
      '</aside>' +
      '<div class="st-modal" data-modal><div class="st-modal-card" data-modal-card>' +
        '<button class="st-x" data-close-modal>' + I.x + '</button><div data-modal-content></div></div></div>' +
      '<div class="st-toasts" data-toasts></div>';
  }
  function bottomNavMarkup() {
    return '<nav class="st-bottom">' +
      '<button data-scroll="home" class="is-active">' + I.home + '<span>' + esc(EN ? 'Home' : 'الرئيسية') + '</span></button>' +
      '<button data-scroll="categories">' + I.grid + '<span>' + esc(EN ? 'Shop' : 'المتجر') + '</span></button>' +
      '<button data-open-cart>' + I.bag + '<span>' + esc(EN ? 'Cart' : 'السلة') + '</span></button>' +
      '<button data-go="orders">' + I.shield + '<span>' + esc(EN ? 'Orders' : 'طلباتي') + '</span></button>' +
      '<button data-go="account">' + I.user + '<span>' + esc(EN ? 'Account' : 'حسابي') + '</span></button>' +
      '</nav>';
  }
  function headerMarkup() {
    return '<header class="st-head"><div class="st-wrap st-head-inner">' +
      '<a class="st-brand" href="' + url('customer/storefront.html') + '"><img src="' + url('assets/img/LOGO-BLACK.png') + '" alt="DotStudio"></a>' +
      '<nav class="st-nav"><a href="#home">' + esc(EN ? 'Home' : 'الرئيسية') + '</a><a href="#categories">' + esc(EN ? 'Shop' : 'المتجر') + '</a>' +
      '<a href="#fashion">' + esc(EN ? 'Collections' : 'التجميعات') + '</a><a href="#stores">' + esc(EN ? 'Our stores' : 'متاجرنا') + '</a>' +
      '<a href="' + url('auth/public-chat.html') + '">' + esc(EN ? 'Contact' : 'اتصل بنا') + '</a></nav>' +
      '<div class="st-tools">' +
        '<button class="st-icon-btn" data-search aria-label="search">' + I.search + '</button>' +
        '<button class="st-icon-btn" data-st-theme-toggle aria-label="theme">' + (theme === 'dark' ? I.sun : I.moon) + '</button>' +
        '<button class="st-icon-btn" data-wishlist aria-label="wishlist">' + I.heart + '</button>' +
        '<button class="st-icon-btn st-cart-btn" data-open-cart>' + I.bag + '<span>' + esc(EN ? 'Cart' : 'السلة') + '</span><span class="st-badge" data-count>0</span></button>' +
      '</div></div></header>';
  }
  function announceMarkup() {
    return '<div class="st-announce"><span class="st-dot"></span><span>' +
      esc(EN ? 'Free shipping on orders over 299 EGP' : 'شحن مجاني للطلبات فوق ٢٩٩ ج.م') +
      '</span><span class="st-dot"></span><span>' +
      esc(EN ? 'All stores open 24 hours' : 'كل المتاجر مفتوحة 24 ساعة') + '</span></div>';
  }
  function shell() {
    return '<div class="st-app">' + announceMarkup() + headerMarkup() +
      '<main style="flex:1">' + heroMarkup() + trustMarkup() + catsMarkup() +
      DEPTS.map(deptMarkup).join('') + promoMarkup() + storesMarkup() + '</main>' +
      footerMarkup() + bottomNavMarkup() + overlaysMarkup() + '</div>';
  }

  /* ── rendering & binding ───────────────────────────────────────── */
  function toast(msg) {
    var box = DS.$('[data-toasts]'); if (!box) return;
    var el = document.createElement('div'); el.className = 'st-toast'; el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }
  function refreshCount() {
    var n = (cart.items || []).reduce(function (s, l) { return s + (Number(l.qty) || 0); }, 0);
    DS.$$('[data-count]').forEach(function (el) { el.textContent = n; });
  }
  function saveCart() { if (DS.cart) DS.cart.persist(cart); refreshCount(); }
  function find(id) { return products().filter(function (p) { return p.id === id; })[0]; }
  function add(id) {
    var p = find(id); if (!p) return;
    var line = (cart.items || []).filter(function (l) { return l.id === id; })[0];
    if (line) line.qty = (Number(line.qty) || 0) + 1;
    else cart.items.push({ id: p.id, name: p.name, name_en: p.name_en, price: Number(p.price) || 0, qty: 1, image: p.image, stock: p.stock, tenant_id: p.tenant_id });
    saveCart(); renderDrawer();
    toast(EN ? 'Added to your cart' : 'تمت الإضافة للسلة');
  }
  function setQty(id, q) {
    var line = (cart.items || []).filter(function (l) { return l.id === id; })[0];
    if (!line) return;
    line.qty = q;
    if (line.qty <= 0) cart.items = cart.items.filter(function (l) { return l.id !== id; });
    saveCart(); renderDrawer();
  }
  function renderDrawer() {
    var body = DS.$('[data-drawer-body]'), foot = DS.$('[data-drawer-foot]');
    if (!body || !foot) return;
    if (!(cart.items || []).length) {
      body.innerHTML = '<div class="st-empty">' + I.bag + '<p>' + esc(EN ? 'Your cart is empty.' : 'سلتك فارغة.') + '</p>' +
        '<button class="st-cta" data-close-drawer>' + esc(EN ? 'Continue shopping' : 'متابعة التسوق') + '</button></div>';
      foot.innerHTML = ''; return;
    }
    body.innerHTML = cart.items.map(function (l) {
      var p = find(l.id) || l;
      var im = p.image ? DS.data.img(p.image) : DS.url('assets/product-placeholder.svg');
      return '<div class="st-line"><img src="' + esc(im) + '" alt="">' +
        '<div><b>' + esc(EN ? (l.name_en || l.name) : l.name) + '</b><small>' + esc(money(l.price)) + '</small>' +
        '<div class="st-qty"><button data-qty="' + esc(l.id) + '|-1">−</button><span>' + esc(l.qty) + '</span><button data-qty="' + esc(l.id) + '|1">+</button></div></div>' +
        '<div class="st-line-price">' + esc(money(l.price * l.qty)) + '<button data-remove="' + esc(l.id) + '">' + esc(EN ? 'Remove' : 'إزالة') + '</button></div></div>';
    }).join('');
    var total = cart.items.reduce(function (s, l) { return s + Number(l.price) * Number(l.qty); }, 0);
    foot.innerHTML = '<div class="st-total-row"><span>' + esc(EN ? 'Subtotal' : 'المجموع') + '</span><b>' + esc(money(total)) + '</b></div>' +
      '<button class="st-btn-block" data-checkout>' + esc(EN ? 'Proceed to checkout' : 'إتمام الطلب') + ' ' + I.arrow + '</button>' +
      '<p style="text-align:center;font-size:11px;color:var(--st-grey);margin:12px 0 0">' +
      esc(EN ? 'Secure & encrypted checkout' : 'إتمام طلب آمن ومشفّر') + '</p>';
  }
  function openDrawer() { renderDrawer(); DS.$('[data-drawer]').classList.add('is-open'); DS.$('[data-shade]').classList.add('is-open'); }
  function closeAll() {
    DS.$('[data-drawer]').classList.remove('is-open');
    DS.$('[data-modal]').classList.remove('is-open');
    DS.$('[data-shade]').classList.remove('is-open');
  }
  function openProduct(id) {
    var p = find(id); if (!p) return;
    var tn = DS.data.tenantById(p.tenant_id);
    var cats = productsFor(DEPTS.filter(function (d) { return tenantFor(d) && tenantFor(d).id === p.tenant_id; })[0] || DEPTS[0]);
    var opts = [];
    cats.forEach(function (x) { if (cat(x) && opts.indexOf(cat(x)) === -1) opts.push(cat(x)); });
    var content = DS.$('[data-modal-content]');
    DS.$('[data-modal-card]').classList.remove('is-wide');
    content.innerHTML = '<div class="st-modal-media"><img src="' + esc(image(p)) + '" alt="' + esc(name(p)) + '"></div>' +
      '<div class="st-modal-info"><span class="st-kicker">' + esc(DS.loc(tn, 'name') || '') + '</span>' +
      '<h2>' + esc(name(p)) + '</h2>' + stars(p.rating) +
      '<div class="st-price">' + esc(money(p.price)) + '</div>' +
      '<p>' + esc(EN ? (p.description_en || p.description || 'A carefully selected piece from ' + (DS.loc(tn, 'name') || 'our store') + '.') :
        (p.description || 'قطعة مختارة بعناية من ' + (DS.loc(tn, 'name') || 'متاجرنا') + '.')) + '</p>' +
      '<span class="st-option-label">' + esc(EN ? 'Category' : 'القسم') + '</span>' +
      '<div class="st-options">' + opts.map(function (c, i) {
        return '<button class="st-opt' + (cat(p) === c || (!i && !cat(p)) ? ' is-active' : '') + '">' + esc(c) + '</button>';
      }).join('') + '</div>' +
      '<div style="margin-top:28px;display:flex;gap:10px"><button class="st-cta" data-modal-add="' + esc(p.id) + '">' +
      esc(EN ? 'Add to cart' : 'أضف للسلة') + I.plus + '</button>' +
      '<button class="st-icon-btn" data-fav="' + esc(p.id) + '">' + I.heart + '</button></div>' +
      '<div style="display:flex;gap:18px;margin-top:26px;font-size:11px;color:var(--st-grey);flex-wrap:wrap">' +
      '<span>✓ ' + esc(EN ? 'Free shipping' : 'شحن مجاني') + '</span><span>✓ ' + esc(EN ? 'Easy returns' : 'إرجاع سهل') + '</span>' +
      '<span>✓ ' + esc(EN ? 'Secure payment' : 'دفع آمن') + '</span></div></div>';
    DS.$('[data-modal]').classList.add('is-open');
    DS.$('[data-shade]').classList.add('is-open');
  }
  function openSearch() {
    var content = DS.$('[data-modal-content]');
    DS.$('[data-modal-card]').classList.add('is-wide');
    content.innerHTML = '<div style="padding:clamp(24px,5vw,54px);min-width:min(560px,90vw)">' +
      '<h2 style="margin:0 0 20px">' + esc(EN ? 'What are you looking for?' : 'بتدور على إيه؟') + '</h2>' +
      '<input class="st-input" id="stSearch" placeholder="' + esc(EN ? 'Search products…' : 'ابحث عن منتج…') + '" ' +
      'style="width:100%;border:1px solid var(--st-line);background:var(--st-bg-2);color:var(--st-text);border-radius:12px;padding:15px 18px;font-size:15px">' +
      '<div id="stSearchResults" style="margin-top:18px;display:grid;gap:8px;max-height:50vh;overflow:auto"></div></div>';
    DS.$('[data-modal]').classList.add('is-open');
    DS.$('[data-shade]').classList.add('is-open');
    var input = DS.$('#stSearch'); if (input) { input.focus(); input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      var res = DS.$('#stSearchResults'); if (!res) return;
      if (!q) { res.innerHTML = ''; return; }
      var hits = products().filter(function (p) { return (name(p) + ' ' + cat(p)).toLowerCase().indexOf(q) > -1; }).slice(0, 8);
      res.innerHTML = hits.length ? hits.map(function (p) {
        return '<button data-search-product="' + esc(p.id) + '" style="display:flex;align-items:center;gap:12px;border:0;background:var(--st-bg-2);color:var(--st-text);border-radius:12px;padding:9px;text-align:start">' +
          '<img src="' + esc(image(p)) + '" style="width:44px;height:44px;border-radius:9px;object-fit:cover">' +
          '<span style="font-size:13px;font-weight:700">' + esc(name(p)) + '</span><span style="margin-inline-start:auto;font-size:12px">' + esc(money(p.price)) + '</span></button>';
      }).join('') : '<p style="color:var(--st-grey);font-size:13px">' + esc(EN ? 'No results' : 'مفيش نتائج') + '</p>';
    }); }
  }
  function openWishlist() {
    var w = []; try { w = JSON.parse(localStorage.getItem('ds_wishlist') || '[]'); } catch (e) {}
    var list = w.map(find).filter(Boolean);
    var content = DS.$('[data-modal-content]');
    DS.$('[data-modal-card]').classList.add('is-wide');
    content.innerHTML = '<div style="padding:clamp(24px,5vw,54px);min-width:min(620px,90vw)">' +
      '<h2 style="margin:0 0 22px">' + esc(EN ? 'Your wishlist' : 'المفضلة') + '</h2>' +
      (list.length ? '<div class="st-grid" style="grid-template-columns:repeat(3,1fr)">' + list.map(cardMarkup).join('') + '</div>' :
        '<div class="st-empty">' + I.heart + '<p>' + esc(EN ? 'Nothing saved yet.' : 'لسه مفيش حاجة محفوظة.') + '</p></div>') + '</div>';
    DS.$('[data-modal]').classList.add('is-open'); DS.$('[data-shade]').classList.add('is-open');
  }
  function goDept(id) {
    closeAll();
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function goto(name) {
    var map = { orders: 'customer/my-orders.html', account: 'customer/account.html' };
    location.href = url(map[name] || 'customer/my-orders.html');
  }

  function bind() {
    DS.$$('[data-slide] img').forEach(function (img) {
      img.addEventListener('error', function () { if (img.dataset.fallback && img.src !== img.dataset.fallback) img.src = img.dataset.fallback; });
    });
    DS.$$('[data-dot]').forEach(function (b) { b.addEventListener('click', function () { goSlide(Number(b.dataset.dot)); }); });
    var prev = DS.$('[data-slide-prev]'), next = DS.$('[data-slide-next]');
    if (prev) prev.addEventListener('click', function () { goSlide(slide - 1); });
    if (next) next.addEventListener('click', function () { goSlide(slide + 1); });
    startSlider();

    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-product],[data-add],[data-fav],[data-open-cart],[data-close-drawer],[data-close-modal],[data-shade],' +
        '[data-pill],[data-filter-all],[data-go-dept],[data-scroll],[data-go],[data-qty],[data-remove],[data-checkout],' +
        '[data-modal-add],[data-search],[data-wishlist],[data-st-theme-toggle],[data-search-product]');
      if (!el || el === document.documentElement || el === document.body) return;
      if (el.hasAttribute('data-shade') || el.hasAttribute('data-close-drawer') || el.hasAttribute('data-close-modal')) { closeAll(); return; }
      if (el.hasAttribute('data-open-cart')) { openDrawer(); return; }
      if (el.hasAttribute('data-add')) { add(el.getAttribute('data-add')); return; }
      if (el.hasAttribute('data-fav')) { toggleWish(el.getAttribute('data-fav')); return; }
      if (el.hasAttribute('data-pill')) {
        var bits = el.getAttribute('data-pill').split('|');
        filters[bits[0]] = bits[1];
        DS.$$('[data-pills="' + bits[0] + '"] .st-pill').forEach(function (b) { b.classList.toggle('is-active', b === el); });
        var d = DEPTS.filter(function (x) { return x.id === bits[0]; })[0];
        DS.$('[data-grid="' + bits[0] + '"]').innerHTML = (bits[1] === 'all' ? productsFor(d) : productsFor(d).filter(function (p) { return cat(p) === bits[1]; })).map(cardMarkup).join('');
        return;
      }
      if (el.hasAttribute('data-filter-all')) { goDept(el.getAttribute('data-filter-all')); return; }
      if (el.hasAttribute('data-go-dept')) { goDept(el.getAttribute('data-go-dept')); return; }
      if (el.hasAttribute('data-scroll')) {
        var t = document.getElementById(el.getAttribute('data-scroll')); if (t) t.scrollIntoView({ behavior: 'smooth' });
        DS.$$('.st-bottom button').forEach(function (b) { b.classList.toggle('is-active', b === el); });
        return;
      }
      if (el.hasAttribute('data-go')) { goto(el.getAttribute('data-go')); return; }
      if (el.hasAttribute('data-qty')) {
        var q = el.getAttribute('data-qty').split('|'); setQty(q[0], (function () {
          var line = cart.items.filter(function (l) { return l.id === q[0]; })[0];
          return (line ? Number(line.qty) : 0) + Number(q[1]);
        })());
        return;
      }
      if (el.hasAttribute('data-remove')) { setQty(el.getAttribute('data-remove'), 0); return; }
      if (el.hasAttribute('data-checkout')) {
        if (DS.cart) DS.cart.flush();
        location.href = url('customer/checkout.html'); return;
      }
      if (el.hasAttribute('data-modal-add')) { add(el.getAttribute('data-modal-add')); closeAll(); return; }
      if (el.hasAttribute('data-search')) { openSearch(); return; }
      if (el.hasAttribute('data-wishlist')) { openWishlist(); return; }
      if (el.hasAttribute('data-st-theme-toggle')) {
        theme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-st-theme', theme);
        try { localStorage.setItem('ds_customer_theme', theme); } catch (e) {}
        el.innerHTML = theme === 'dark' ? I.sun : I.moon;
        var logo = DS.$('.st-brand img');
        if (logo) logo.src = url(theme === 'dark' ? 'assets/img/LOGO-WHAIT.png' : 'assets/img/LOGO-BLACK.png');
        return;
      }
      if (el.hasAttribute('data-search-product')) { closeAll(); openProduct(el.getAttribute('data-search-product')); return; }
      if (el.hasAttribute('data-product')) { openProduct(el.getAttribute('data-product')); return; }
    });
  }
  function goSlide(n) {
    slide = (n + HERO.length) % HERO.length;
    DS.$$('.st-slide').forEach(function (s, i) { s.classList.toggle('is-active', i === slide); });
    DS.$$('.st-dot').forEach(function (d, i) { d.classList.toggle('is-active', i === slide); });
    restart();
  }
  function startSlider() {
    heroTimer = setInterval(function () { goSlide(slide + 1); }, 6000);
  }
  function restart() { clearInterval(heroTimer); startSlider(); }

  /* ── boot ──────────────────────────────────────────────────────── */
  app.innerHTML = shell();
  refreshCount();
  bind();
  renderDrawer();
  if (DS.api && typeof DS.api.getProducts === 'function') {
    DS.api.getProducts().then(function (list) {
      if (Array.isArray(list) && list.length) {
        apiProducts = list;
        var grids = DS.$$('[data-grid]');
        grids.forEach(function (g) {
          var id = g.getAttribute('data-grid');
          var d = DEPTS.filter(function (x) { return x.id === id; })[0];
          var list2 = filters[id] === 'all' ? productsFor(d) : productsFor(d).filter(function (p) { return cat(p) === filters[id]; });
          g.innerHTML = list2.map(cardMarkup).join('');
        });
      }
    }).catch(function () {});
  }
})();
