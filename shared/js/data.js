/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — DATA LAYER
   Offline-first demo database with STRICT tenant isolation.
   All reads go through role-aware helpers; every write persists to
   localStorage and is mirrored into the audit log.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var DS = window.DS;
  if (!DS) { console.error('[DS] core.js must load before data.js'); return; }

  var KEY = 'ds_db_v1';
  var VERSION = 2;
  var WHATSAPP = '201226770582';

  /* ───────────────────────────── HELPERS ───────────────────────────── */
  function nowISO() { return new Date().toISOString(); }
  function hoursAgo(h) { return new Date(Date.now() - h * 3600 * 1000).toISOString(); }
  function daysAgo(d) { return new Date(Date.now() - d * 86400 * 1000).toISOString(); }
  function daysAhead(d) { return new Date(Date.now() + d * 86400 * 1000).toISOString(); }

  /* Deterministic RNG so demo data is stable across reloads */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20261023);
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function between(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

  /* ───────────────────────────── TENANTS ───────────────────────────── */
  var TENANTS = [
    {
      id: 't-caznova', slug: 'caznova', name: 'Caznova', name_en: 'Caznova',
      owner: 'أحمد كازنوفا', owner_en: 'Ahmed Caznova', owner_username: 'caznova',
      phone: '01000000001', email: 'ahmed@caznova.com', city: 'القاهرة', city_en: 'Cairo', address: 'مدينة نصر · شارع عباس العقاد', address_en: 'Nasr City · Abbas El Akkad St.',
      industry: 'أزياء وإكسسوارات', industry_en: 'Fashion & accessories',
      plan: 'yearly', subscription_start: daysAgo(120), subscription_end: daysAhead(245),
      status: 'active', avatar_id: 'av1', color: '#82FF1F', rating: 4.9, delivery_fee: 35,
      openTime: '00:00', closeTime: '24:00', offline: false,
      lat: 30.0511, lng: 31.3656,
      description: 'ساعات، خواتم، عطور وإكسسوارات مختارة بعناية.', description_en: 'Curated watches, rings, perfumes and accessories.',
      created_at: daysAgo(420)
    },
    {
      id: 't-smozy', slug: 'smozy', name: 'Smozy Fresh', name_en: 'Smozy Fresh',
      owner: 'سارة سميزي', owner_en: 'Sara Smozy', owner_username: 'smozy',
      phone: '01000000002', email: 'sara@smozy.com', city: 'القاهرة', city_en: 'Cairo', address: 'المعادي · شارع 9', address_en: 'Maadi · Street 9',
      industry: 'عصائر طازجة', industry_en: 'Fresh juices',
      plan: 'monthly', subscription_start: daysAgo(20), subscription_end: daysAhead(10),
      status: 'active', avatar_id: 'av2', color: '#FF6B9D', rating: 4.8, delivery_fee: 25,
      openTime: '00:00', closeTime: '24:00', offline: false,
      lat: 29.9602, lng: 31.2569,
      description: 'عصائر وسموذي وميلك شيك طازج يومياً.', description_en: 'Fresh juices, smoothies and milkshakes every day.',
      created_at: daysAgo(300)
    },
    {
      id: 't-bnsheikh', slug: 'bnsheikh', name: 'Bn Alsheikh', name_en: 'Bn Alsheikh',
      owner: 'بن الشيخ', owner_en: 'Bn Alsheikh', owner_username: 'bnsheikh',
      phone: '01000000003', email: 'hello@bnsheikh.com', city: 'القاهرة', city_en: 'Cairo', address: 'مصر الجديدة · شارع الحجاز', address_en: 'Heliopolis · Al Hegaz St.',
      industry: 'قهوة مختصة', industry_en: 'Specialty coffee',
      plan: 'sixmonths', subscription_start: daysAgo(80), subscription_end: daysAhead(100),
      status: 'active', avatar_id: 'av3', color: '#F59E0B', rating: 4.9, delivery_fee: 30,
      openTime: '00:00', closeTime: '24:00', offline: false,
      lat: 30.0912, lng: 31.3275,
      description: 'قهوة مختصة محمصة طازجة وحبوب مختارة.', description_en: 'Specialty coffee, freshly roasted beans.',
      created_at: daysAgo(260)
    },
    {
      id: 't-mastore', slug: 'mastore', name: 'MA Store', name_en: 'MA Store',
      owner: 'محمود علي', owner_en: 'Mahmoud Ali', owner_username: 'mastore',
      phone: '01000000004', email: 'mahmoud@mastore.com', city: 'الجيزة', city_en: 'Giza', address: '6 أكتوبر · الحي الأول', address_en: '6th of October · First District',
      industry: 'ملابس وإكسسوارات', industry_en: 'Apparel & accessories',
      plan: 'monthly', subscription_start: daysAgo(12), subscription_end: daysAhead(18),
      status: 'active', avatar_id: 'av4', color: '#60A5FA', rating: 4.7, delivery_fee: 40,
      openTime: '00:00', closeTime: '24:00', offline: false,
      lat: 29.9285, lng: 30.9188,
      description: 'ملابس عصرية بجودة عالية لكل المناسبات.', description_en: 'Modern quality apparel for every occasion.',
      created_at: daysAgo(210)
    }
  ];

  /* ─────────────────────────────── USERS ───────────────────────────── */
  var PERMISSIONS_ALL = ['products', 'orders', 'customers', 'cashiers', 'delivery-companies', 'chats', 'jobs', 'reports', 'subscriptions', 'discounts', 'audit', 'settings', 'stores', 'sub-admins'];

  var USERS = [
    { id: 'u-admin', username: 'admin', password: 'admin2026', role: 'superadmin', name: 'System Admin', name_en: 'System Admin', email: 'admin@dotstudio.app', phone: '01226770582', avatar_id: 'av9', is_active: true, created_at: daysAgo(500) },
    { id: 'u-dina', username: 'dina', password: 'dina2026', role: 'subadmin', name: 'دينا', name_en: 'Dina', permissions: ['chats'], avatar_id: 'av5', is_active: true, created_at: daysAgo(160) },
    { id: 'u-amal', username: 'amal', password: 'amal2026', role: 'subadmin', name: 'أمل', name_en: 'Amal', permissions: ['reports'], avatar_id: 'av6', is_active: true, created_at: daysAgo(150) },
    { id: 'u-fatma', username: 'fatma', password: 'fatma2026', role: 'subadmin', name: 'فاطمة', name_en: 'Fatma', permissions: ['orders', 'products'], avatar_id: 'av7', is_active: true, created_at: daysAgo(140) },
    { id: 'u-nada', username: 'nada', password: 'nada2026', role: 'subadmin', name: 'ندى', name_en: 'Nada', permissions: ['customers', 'delivery-companies'], avatar_id: 'av8', is_active: true, created_at: daysAgo(130) },
    { id: 'u-basmala', username: 'basmala', password: 'basmala2026', role: 'subadmin', name: 'بسملة', name_en: 'Basmala', permissions: ['cashiers', 'jobs'], avatar_id: 'av2', is_active: true, created_at: daysAgo(120) },

    { id: 'u-owner-caznova', username: 'caznova', password: 'caznova2026', role: 'owner', name: 'أحمد كازنوفا', name_en: 'Ahmed Caznova', tenant_id: 't-caznova', avatar_id: 'av1', is_active: true, created_at: daysAgo(420) },
    { id: 'u-owner-smozy', username: 'smozy', password: 'smozy2026', role: 'owner', name: 'سارة سميزي', name_en: 'Sara Smozy', tenant_id: 't-smozy', avatar_id: 'av2', is_active: true, created_at: daysAgo(300) },
    { id: 'u-owner-bnsheikh', username: 'bnsheikh', password: 'bnsheikh2026', role: 'owner', name: 'بن الشيخ', name_en: 'Bn Alsheikh', tenant_id: 't-bnsheikh', avatar_id: 'av3', is_active: true, created_at: daysAgo(260) },
    { id: 'u-owner-mastore', username: 'mastore', password: 'mastore2026', role: 'owner', name: 'محمود علي', name_en: 'Mahmoud Ali', tenant_id: 't-mastore', avatar_id: 'av4', is_active: true, created_at: daysAgo(210) },

    { id: 'u-cashier-caznova', username: 'ca_cashier', password: 'ca_cashier2026', role: 'cashier', name: 'كاشير Caznova', name_en: 'Caznova Cashier', tenant_id: 't-caznova', avatar_id: 'av5', is_active: true, created_at: daysAgo(200) },
    { id: 'u-del-caznova', username: 'caznova_driver', password: 'caznova_driver2026', role: 'delivery', name: 'مندوب كازنوفا', name_en: 'Caznova Driver', tenant_id: 't-caznova', phone: '01000000011', avatar_id: 'av4', is_active: true, online: true, company_id: 'in_house', delivery_company: null, delivery_company_name: 'توصيل المحل (داخلي)', created_at: daysAgo(60) },
    { id: 'u-cashier-smozy', username: 'sm_cashier', password: 'sm_cashier2026', role: 'cashier', name: 'كاشير Smozy', name_en: 'Smozy Cashier', tenant_id: 't-smozy', avatar_id: 'av6', is_active: true, created_at: daysAgo(190) },
    { id: 'u-cashier-bnsheikh', username: 'bn_cashier', password: 'bn_cashier2026', role: 'cashier', name: 'كاشير Bn Alsheikh', name_en: 'Bn Alsheikh Cashier', tenant_id: 't-bnsheikh', avatar_id: 'av7', is_active: true, created_at: daysAgo(180) },
    { id: 'u-cashier-mastore', username: 'ma_cashier', password: 'ma_cashier2026', role: 'cashier', name: 'كاشير MA Store', name_en: 'MA Store Cashier', tenant_id: 't-mastore', avatar_id: 'av8', is_active: true, created_at: daysAgo(170) },

    { id: 'u-del-talqa', username: 'talqa', password: 'talqa2026', role: 'delivery', name: 'طلقة', name_en: 'Talqa', delivery_company: 'dc-talqa', company_id: 'dc-talqa', delivery_company_name: 'طلقة', company_owner: true, avatar_id: 'av3', is_active: true, online: true, created_at: daysAgo(150) },
    { id: 'u-del-hala', username: 'hala', password: 'hala2026', role: 'delivery', name: 'حالا', name_en: 'Hala', delivery_company: 'dc-hala', company_id: 'dc-hala', delivery_company_name: 'حالا', company_owner: true, avatar_id: 'av6', is_active: true, online: true, created_at: daysAgo(140) },
    { id: 'u-del-ahla', username: 'ahla', password: 'ahla2026', role: 'delivery', name: 'أهلا', name_en: 'Ahla', delivery_company: 'dc-ahla', company_id: 'dc-ahla', delivery_company_name: 'أهلا', company_owner: true, avatar_id: 'av9', is_active: true, online: true, created_at: daysAgo(130) },

    /* B2B sub-drivers working for a delivery company (managed by its owner). */
    { id: 'u-del-talqa-ahmed', username: 'ahmed', password: 'ahmed2026', role: 'driver', name: 'أحمد', name_en: 'Ahmed', delivery_company: 'dc-talqa', company_id: 'dc-talqa', delivery_company_name: 'طلقة', parent_id: 'u-del-talqa', company_owner: false, phone: '01011110001', avatar_id: 'av1', is_active: true, online: true, created_at: daysAgo(45) },
    { id: 'u-del-talqa-mostafa', username: 'mostafa', password: 'mostafa2026', role: 'driver', name: 'مصطفى', name_en: 'Mostafa', delivery_company: 'dc-talqa', company_id: 'dc-talqa', delivery_company_name: 'طلقة', parent_id: 'u-del-talqa', company_owner: false, phone: '01011110002', avatar_id: 'av2', is_active: true, online: true, created_at: daysAgo(40) },

    { id: 'u-customer', username: 'customer', password: 'customer2026', role: 'customer', name: 'ياسمين محمد', name_en: 'Yasmin Mohamed', tenant_id: 't-caznova', phone: '01123456789', city: 'القاهرة', city_en: 'Cairo', address: 'مدينة نصر · شارع مصطفى النحاس · عمارة 12', address_en: 'Nasr City · Mostafa El Nahas St. · Building 12', avatar_id: 'av5', is_active: true, created_at: daysAgo(90),
      addresses: [
        { id: 'addr-home', label: 'المنزل', label_en: 'Home', address: 'مدينة نصر · شارع مصطفى النحاس · عمارة 12', address_en: 'Nasr City · Mostafa El Nahas St. · Building 12', city: 'القاهرة', city_en: 'Cairo', lat: 30.0601, lng: 31.3488, phone: '01123456789', is_default: true },
        { id: 'addr-work', label: 'العمل', label_en: 'Work', address: 'التجمع الخامس · شارع التسعين · برج بلاتينيوم', address_en: 'Fifth Settlement · 90th Street · Platinum Tower', city: 'القاهرة', city_en: 'Cairo', lat: 30.0070, lng: 31.4910, phone: '01123456789', is_default: false }
      ] }
  ];

  /* ─────────────────────────────── PLANS ───────────────────────────── */
  var PLANS = [
    {
      id: 'monthly', name: 'باقة شهرية', name_en: 'Monthly plan', price: 299, months: 1, period: 'شهرياً', period_en: 'per month',
      features: ['متجر إلكتروني كامل', 'نقطة بيع وكاشير', 'تتبع توصيل لحظي', 'محادثات ودعم', 'تقارير أساسية'],
      features_en: ['Full storefront', 'POS & cashier', 'Live delivery tracking', 'Chats & support', 'Core reports']
    },
    {
      id: 'sixmonths', name: 'باقة 6 أشهر', name_en: '6-month plan', price: 1499, months: 6, period: 'كل 6 أشهر', period_en: 'per 6 months', featured: true, save: 'وفّر 20%',
      features: ['كل مزايا الباقة الشهرية', 'تقارير متقدمة وتصدير', 'شركات توصيل غير محدودة', 'أولوية دعم', 'خصم 20%'],
      features_en: ['Everything in monthly', 'Advanced reports & export', 'Unlimited delivery companies', 'Priority support', 'Save 20%']
    },
    {
      id: 'yearly', name: 'باقة سنوية', name_en: 'Yearly plan', price: 2499, months: 12, period: 'سنوياً', period_en: 'per year', best: true, save: 'وفّر 30%',
      features: ['كل مزايا باقة 6 أشهر', 'مدير حساب مخصص', 'تدريب فريقك', 'نسخ احتياطي يومي', 'خصم 30%'],
      features_en: ['Everything in 6-month', 'Dedicated account manager', 'Team training', 'Daily backups', 'Save 30%']
    }
  ];

  /* ────────────────────────────── CATALOGUE ───────────────────────────── */
  var CATALOG = {
    't-caznova': [
      { name: 'إسوارة فضة مطلية', name_en: 'Silver-plated bracelet', category: 'اكسسوارات', category_en: 'Accessories', sku: 'CAZ-ACC-001', barcode: '628100100001', cost: 110, price: 320, stock: 24, min_stock: 5, image: 'products/1-caznova/1-caznova-bracelet.webp', rating: 4.7, sold: 118 },
      { name: 'عطر Oud Noir 50ml', name_en: 'Oud Noir perfume 50ml', category: 'عطور', category_en: 'Perfumes', sku: 'CAZ-PRF-002', barcode: '628100100002', cost: 300, price: 850, stock: 12, min_stock: 3, image: 'products/1-caznova/2-caznova-perfume.webp', rating: 4.9, sold: 86 },
      { name: 'محفظة جلد طبيعي', name_en: 'Genuine leather wallet', category: 'محافظ', category_en: 'Wallets', sku: 'CAZ-WLT-003', barcode: '628100100003', cost: 160, price: 450, stock: 18, min_stock: 4, image: 'products/1-caznova/3-caznova-wallet.webp', rating: 4.6, sold: 74 },
      { name: 'خاتم فضة رجالي', name_en: 'Men’s silver ring', category: 'خواتم', category_en: 'Rings', sku: 'CAZ-RNG-004', barcode: '628100100004', cost: 90, price: 280, stock: 30, min_stock: 6, image: 'products/1-caznova/4-caznova-ring.webp', rating: 4.8, sold: 203 },
      { name: 'ساعة يد كلاسيك', name_en: 'Classic wrist watch', category: 'ساعات', category_en: 'Watches', sku: 'CAZ-WCH-005', barcode: '628100100005', cost: 480, price: 1250, stock: 10, min_stock: 3, image: 'products/1-caznova/5-caznova-watch.webp', rating: 4.9, sold: 64 },
      { name: 'طقم هدايا فاخر', name_en: 'Premium gift set', category: 'هدايا', category_en: 'Gifts', sku: 'CAZ-GFT-006', barcode: '628100100006', cost: 380, price: 990, stock: 8, min_stock: 2, image: 'products/1-caznova/6-caznova-giftset.webp', rating: 5.0, sold: 41 },
      { name: 'نظارة شمس UV400', name_en: 'UV400 sunglasses', category: 'نظارات', category_en: 'Sunglasses', sku: 'CAZ-SUN-007', barcode: '628100100007', cost: 180, price: 520, stock: 15, min_stock: 4, image: 'products/1-caznova/7-caznova-sunglasses.webp', rating: 4.5, sold: 57 },
      { name: 'حزام جلد كلاسيك', name_en: 'Classic leather belt', category: 'أحزمة', category_en: 'Belts', sku: 'CAZ-BLT-008', barcode: '628100100008', cost: 120, price: 360, stock: 22, min_stock: 5, image: 'products/1-caznova/8-caznova-belt.webp', rating: 4.6, sold: 93 },
      { name: 'حقيبة جلد صغيرة', name_en: 'Small leather bag', category: 'حقائب', category_en: 'Bags', sku: 'CAZ-BAG-009', barcode: '628100100009', cost: 280, price: 780, stock: 9, min_stock: 2, image: 'products/1-caznova/CAZNOVA_9.webp', rating: 4.8, sold: 38 }
    ],
    't-smozy': [
      { name: 'عصير مانجو طازج', name_en: 'Fresh mango juice', category: 'عصائر', category_en: 'Juices', sku: 'SMZ-JUI-001', barcode: '628200100001', cost: 20, price: 45, stock: 40, min_stock: 10, image: 'products/2-smozy/1-smozy-mango.webp', rating: 4.9, sold: 340 },
      { name: 'عصير برتقال طازج', name_en: 'Fresh orange juice', category: 'عصائر', category_en: 'Juices', sku: 'SMZ-JUI-002', barcode: '628200100002', cost: 15, price: 35, stock: 45, min_stock: 10, image: 'products/2-smozy/2-smozy-orange.webp', rating: 4.8, sold: 412 },
      { name: 'عصير فراولة', name_en: 'Strawberry juice', category: 'عصائر', category_en: 'Juices', sku: 'SMZ-JUI-003', barcode: '628200100003', cost: 18, price: 40, stock: 38, min_stock: 8, image: 'products/2-smozy/3-smozy-strawberry.webp', rating: 4.7, sold: 286 },
      { name: 'سموذي كيوي', name_en: 'Kiwi smoothie', category: 'سموذي', category_en: 'Smoothies', sku: 'SMZ-SMT-004', barcode: '628200100004', cost: 25, price: 55, stock: 30, min_stock: 6, image: 'products/2-smozy/4-smozy-kiwi.webp', rating: 4.8, sold: 198 },
      { name: 'عصير موز باللبن', name_en: 'Banana milk juice', category: 'عصائر', category_en: 'Juices', sku: 'SMZ-JUI-005', barcode: '628200100005', cost: 22, price: 50, stock: 32, min_stock: 6, image: 'products/2-smozy/5-smozy-banana.webp', rating: 4.6, sold: 174 },
      { name: 'سموذي توت مشكل', name_en: 'Mixed berry smoothie', category: 'سموذي', category_en: 'Smoothies', sku: 'SMZ-SMT-006', barcode: '628200100006', cost: 28, price: 60, stock: 26, min_stock: 6, image: 'products/2-smozy/6-smozy-mixed-berry.webp', rating: 4.9, sold: 221 },
      { name: 'ميلك شيك أوريو', name_en: 'Oreo milkshake', category: 'ميلك شيك', category_en: 'Milkshakes', sku: 'SMZ-MLK-007', barcode: '628200100007', cost: 32, price: 65, stock: 24, min_stock: 5, image: 'products/2-smozy/7-smozy-oreo.webp', rating: 4.9, sold: 311 },
      { name: 'ميلك شيك شوكولاتة', name_en: 'Chocolate milkshake', category: 'ميلك شيك', category_en: 'Milkshakes', sku: 'SMZ-MLK-008', barcode: '628200100008', cost: 32, price: 65, stock: 22, min_stock: 5, image: 'products/2-smozy/8-smozy-chocolate.webp', rating: 4.8, sold: 267 },
      { name: 'ميلك شيك لوتس', name_en: 'Lotus milkshake', category: 'ميلك شيك', category_en: 'Milkshakes', sku: 'SMZ-MLK-009', barcode: '628200100009', cost: 35, price: 70, stock: 20, min_stock: 5, image: 'products/2-smozy/9-smozy-lotus.webp', rating: 5.0, sold: 254 }
    ],
    't-bnsheikh': [
      { name: 'قهوة تركي', name_en: 'Turkish coffee', category: 'قهوة ساخنة', category_en: 'Hot coffee', sku: 'BNS-HCO-001', barcode: '628300100001', cost: 12, price: 25, stock: 60, min_stock: 15, image: 'products/3-bnsheikh/1-bnsheikh-turkish-coffee.webp', rating: 4.7, sold: 520 },
      { name: 'إسبريسو مزدوج', name_en: 'Double espresso', category: 'قهوة ساخنة', category_en: 'Hot coffee', sku: 'BNS-HCO-002', barcode: '628300100002', cost: 15, price: 30, stock: 50, min_stock: 12, image: 'products/3-bnsheikh/2-bnsheikh-espresso.webp', rating: 4.8, sold: 388 },
      { name: 'كابتشينو', name_en: 'Cappuccino', category: 'قهوة ساخنة', category_en: 'Hot coffee', sku: 'BNS-HCO-003', barcode: '628300100003', cost: 18, price: 35, stock: 38, min_stock: 8, image: 'products/3-bnsheikh/3-bnsheikh-cappuccino.webp', rating: 4.9, sold: 466 },
      { name: 'لاتيه', name_en: 'Latte', category: 'قهوة ساخنة', category_en: 'Coffee', sku: 'BNS-HCO-004', barcode: '628300100004', cost: 20, price: 38, stock: 35, min_stock: 8, image: 'products/3-bnsheikh/4-bnsheikh-latte.webp', rating: 4.8, sold: 402 },
      { name: 'موكا', name_en: 'Mocha', category: 'قهوة ساخنة', category_en: 'Hot coffee', sku: 'BNS-HCO-005', barcode: '628300100005', cost: 30, price: 65, stock: 18, min_stock: 4, image: 'products/3-bnsheikh/5-bnsheikh-mocha.webp', rating: 4.7, sold: 219 },
      { name: 'آيس لاتيه', name_en: 'Iced latte', category: 'قهوة باردة', category_en: 'Iced coffee', sku: 'BNS-ICO-006', barcode: '628300100006', cost: 22, price: 40, stock: 35, min_stock: 8, image: 'products/3-bnsheikh/6-bnsheikh-iced-latte.webp', rating: 4.9, sold: 355 },
      { name: 'قهوة تركي مطحونة 250g', name_en: 'Turkish ground coffee 250g', category: 'حبوب قهوة', category_en: 'Coffee beans', sku: 'BNS-BEA-007', barcode: '628300100007', cost: 55, price: 120, stock: 28, min_stock: 6, image: 'products/3-bnsheikh/7-bnsheikh-turkish-ground.webp', rating: 4.8, sold: 142 },
      { name: 'قهوة متوسطة 500g', name_en: 'Medium roast 500g', category: 'حبوب قهوة', category_en: 'Coffee beans', sku: 'BNS-BEA-008', barcode: '628300100008', cost: 120, price: 240, stock: 16, min_stock: 4, image: 'products/3-bnsheikh/8-bnsheikh-medium-ground.webp', rating: 4.9, sold: 97 },
      { name: 'حبوب قهوة كاملة 1kg', name_en: 'Whole beans 1kg', category: 'حبوب قهوة', category_en: 'Coffee beans', sku: 'BNS-BEA-009', barcode: '628300100009', cost: 260, price: 490, stock: 9, min_stock: 3, image: 'products/3-bnsheikh/9-bnsheikh-whole-beans.webp', rating: 5.0, sold: 63 }
    ],
    't-mastore': [
      { name: 'تيشيرت قطن أبيض', name_en: 'White cotton t-shirt', category: 'رجالي', category_en: 'Men', sku: 'MAS-MEN-001', barcode: '628400100001', cost: 120, price: 250, stock: 28, min_stock: 6, image: 'products/4-mastore/1-mastore-white-tshirt.webp', rating: 4.6, sold: 210 },
      { name: 'بولو أسود', name_en: 'Black polo', category: 'رجالي', category_en: 'Men', sku: 'MAS-MEN-002', barcode: '628400100002', cost: 160, price: 320, stock: 22, min_stock: 5, image: 'products/4-mastore/2-mastore-black-polo.webp', rating: 4.7, sold: 168 },
      { name: 'بنطلون جينز', name_en: 'Denim jeans', category: 'رجالي', category_en: 'Men', sku: 'MAS-MEN-003', barcode: '628400100003', cost: 250, price: 450, stock: 16, min_stock: 4, image: 'products/4-mastore/3-mastore-denim-jeans.webp', rating: 4.8, sold: 142 },
      { name: 'بنطلون شينو', name_en: 'Chino pants', category: 'رجالي', category_en: 'Men', sku: 'MAS-MEN-004', barcode: '628400100004', cost: 220, price: 390, stock: 14, min_stock: 4, image: 'products/4-mastore/4-mastore-chino-pants.webp', rating: 4.5, sold: 96 },
      { name: 'جاكيت جلد', name_en: 'Leather jacket', category: 'رجالي', category_en: 'Men', sku: 'MAS-MEN-005', barcode: '628400100005', cost: 850, price: 1450, stock: 5, min_stock: 2, image: 'products/4-mastore/5-mastore-leather-jacket.webp', rating: 4.9, sold: 31 },
      { name: 'قميص كاجوال', name_en: 'Casual shirt', category: 'نسائي', category_en: 'Women', sku: 'MAS-WMN-006', barcode: '628400100006', cost: 300, price: 550, stock: 11, min_stock: 3, image: 'products/4-mastore/6-mastore-casual-shirt.webp', rating: 4.7, sold: 74 },
      { name: 'ساعة رياضية', name_en: 'Sports watch', category: 'إكسسوارات', category_en: 'Accessories', sku: 'MAS-ACC-007', barcode: '628400100007', cost: 390, price: 690, stock: 8, min_stock: 2, image: 'products/4-mastore/7-mastore-sports-watch.webp', rating: 4.6, sold: 52 },
      { name: 'محفظة جلد', name_en: 'Leather wallet', category: 'إكسسوارات', category_en: 'Accessories', sku: 'MAS-ACC-008', barcode: '628400100008', cost: 200, price: 380, stock: 14, min_stock: 3, image: 'products/4-mastore/8-mastore-leather-wallet.webp', rating: 4.5, sold: 88 },
      { name: 'نظارة شمس', name_en: 'Sunglasses', category: 'إكسسوارات', category_en: 'Accessories', sku: 'MAS-ACC-009', barcode: '628400100009', cost: 180, price: 420, stock: 10, min_stock: 3, image: 'products/4-mastore/9-mastore-sunglasses.webp', rating: 4.4, sold: 66 }
    ]
  };

  var DELIVERY_COMPANIES = [
    { id: 'dc-talqa', name: 'طلقة', name_en: 'Talqa', emoji: '🛵', phone: '01011112222', fee: 30, city: 'القاهرة', city_en: 'Cairo', rating: 4.8, completed: 1284, avg_time: 28, status: 'active', username: 'talqa', created_at: daysAgo(300) },
    { id: 'dc-hala', name: 'حالا', name_en: 'Hala', emoji: '🏍️', phone: '01033334444', fee: 35, city: 'القاهرة والجيزة', city_en: 'Cairo & Giza', rating: 4.7, completed: 962, avg_time: 32, status: 'active', username: 'hala', created_at: daysAgo(260) },
    { id: 'dc-ahla', name: 'أهلا', name_en: 'Ahla', emoji: '🚚', phone: '01055556666', fee: 40, city: 'كل المحافظات', city_en: 'Nationwide', rating: 4.6, completed: 2140, avg_time: 35, status: 'active', username: 'ahla', created_at: daysAgo(220) }
  ];

  /* ─────────────────────────── BUILD DATABASE ─────────────────────────── */
  function buildProducts() {
    var out = [];
    Object.keys(CATALOG).forEach(function (tid, tidx) {
      CATALOG[tid].forEach(function (p, i) {
        var defBarcode = '628' + (tidx + 1) + String(10000000 + i + 1).slice(1);
        out.push(Object.assign({}, p, {
          id: 'p-' + tid.replace('t-', '') + '-' + (i + 1),
          tenant_id: tid,
          barcode: p.barcode || defBarcode,
          is_active: true,
          /* Admin-controllable merchandising flags. */
          featured: p.featured != null ? p.featured : (Number(p.rating) || 0) >= 4.9,
          best_seller: p.best_seller != null ? p.best_seller : (Number(p.sold) || 0) >= 250,
          review_count: Number(p.review_count) || 0,
          created_at: daysAgo(200 - i * 3),
          updated_at: daysAgo(4 + i)
        }));
      });
    });
    return out;
  }

  var CUSTOMER_NAMES = [
    { name: 'ياسمين محمد', name_en: 'Yasmin Mohamed', phone: '01123456789', address: 'مدينة نصر · شارع مصطفى النحاس · عمارة 12', address_en: 'Nasr City · Mostafa El Nahas St. · Building 12', city: 'القاهرة', city_en: 'Cairo', lat: 30.0601, lng: 31.3488 },
    { name: 'كريم حسن', name_en: 'Karim Hassan', phone: '01098765432', address: 'المعادي · شارع 9 · برج النيل', address_en: 'Maadi · Street 9 · Nile Tower', city: 'القاهرة', city_en: 'Cairo', lat: 29.9520, lng: 31.2680 },
    { name: 'منى عبد الله', name_en: 'Mona Abdallah', phone: '01155667788', address: 'مصر الجديدة · شارع الحجاز · عمارة 8', address_en: 'Heliopolis · Al Hegaz St. · Building 8', city: 'القاهرة', city_en: 'Cairo', lat: 30.0980, lng: 31.3380 },
    { name: 'أحمد فؤاد', name_en: 'Ahmed Fouad', phone: '01233445566', address: '6 أكتوبر · الحي الأول · فيلا 4', address_en: '6th of October · First District · Villa 4', city: 'الجيزة', city_en: 'Giza', lat: 29.9350, lng: 30.9250 },
    { name: 'سلمى عادل', name_en: 'Salma Adel', phone: '01566778899', address: 'التجمع الخامس · شارع التسعين', address_en: 'Fifth Settlement · 90th Street', city: 'القاهرة', city_en: 'Cairo', lat: 30.0070, lng: 31.4910 },
    { name: 'عمر شريف', name_en: 'Omar Sherif', phone: '01011223344', address: 'الزمالك · شارع 26 يوليو', address_en: 'Zamalek · 26th of July St.', city: 'القاهرة', city_en: 'Cairo', lat: 30.0620, lng: 31.2190 },
    { name: 'نور الدين', name_en: 'Nour Eldin', phone: '01277889900', address: 'الشيخ زايد · الحي الثاني', address_en: 'Sheikh Zayed · Second District', city: 'الجيزة', city_en: 'Giza', lat: 30.0120, lng: 31.0050 },
    { name: 'هبة سامي', name_en: 'Heba Samy', phone: '01122334455', address: 'حلوان · شارع راغب', address_en: 'Helwan · Ragheb St.', city: 'القاهرة', city_en: 'Cairo', lat: 29.8500, lng: 31.3330 },
    { name: 'مصطفى علي', name_en: 'Mostafa Ali', phone: '01066554433', address: 'شبرا · شارع الترعة', address_en: 'Shubra · El Teraa St.', city: 'القاهرة', city_en: 'Cairo', lat: 30.1180, lng: 31.2450 },
    { name: 'دينا رضا', name_en: 'Dina Reda', phone: '01555443322', address: 'المهندسين · شارع جامعة الدول', address_en: 'Mohandessin · Gameat El Dowal St.', city: 'الجيزة', city_en: 'Giza', lat: 30.0560, lng: 31.2000 },
    { name: 'طارق مجدي', name_en: 'Tarek Magdy', phone: '01288990011', address: 'الرحاب · البوابة الثالثة', address_en: 'Rehab · Gate 3', city: 'القاهرة', city_en: 'Cairo', lat: 30.0640, lng: 31.4920 },
    { name: 'ريم خالد', name_en: 'Reem Khaled', phone: '01099887766', address: 'المرج · شارع المحطة', address_en: 'El Marg · Station St.', city: 'القاهرة', city_en: 'Cairo', lat: 30.1520, lng: 31.3340 }
  ];

  function proofData(orderNo, at) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B2414"/><stop offset="1" stop-color="#0C0F0A"/></linearGradient></defs>' +
      '<rect width="320" height="240" fill="url(#g)"/>' +
      '<g opacity=".16" stroke="#82FF1F" stroke-width="1">' +
      '<path d="M0 60h320M0 120h320M0 180h320M80 0v240M160 0v240M240 0v240"/></g>' +
      '<circle cx="160" cy="92" r="34" fill="rgba(130,255,31,.14)" stroke="#82FF1F" stroke-width="2"/>' +
      '<path d="m145 92 11 11 22-24" fill="none" stroke="#82FF1F" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="160" y="154" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#F5F5F7">PROOF OF DELIVERY</text>' +
      '<text x="160" y="174" text-anchor="middle" font-family="Arial" font-size="10" fill="#A1A1A6">' + orderNo + '</text>' +
      '<text x="160" y="190" text-anchor="middle" font-family="Arial" font-size="9" fill="#6E6E73">' + String(at).slice(0, 16).replace('T', ' ') + '</text>' +
      '<text x="160" y="222" text-anchor="middle" font-family="Arial" font-size="8" fill="#4A4A4F">DOTSTUDIO® POS · VERIFIED HANDOFF</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function buildOrders(products) {
    var out = [];
    var statusPlan = [
      'out_for_delivery', 'out_for_delivery', 'out_for_delivery', 'out_for_delivery',
      'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered',
      'handed_to_company', 'handed_to_company', 'handed_to_company', 'handed_to_company',
      'preparing', 'preparing', 'preparing', 'preparing',
      'pending', 'pending', 'pending', 'pending',
      'cancelled', 'cancelled', 'cancelled',
      'delivered', 'delivered', 'out_for_delivery', 'handed_to_company', 'pending'
    ];
    var companies = DELIVERY_COMPANIES;
    statusPlan.forEach(function (status, i) {
      var tn = TENANTS[i % TENANTS.length];
      var tProducts = products.filter(function (p) { return p.tenant_id === tn.id; });
      var customer = i === 0 ? CUSTOMER_NAMES[0] : CUSTOMER_NAMES[(i + 1) % CUSTOMER_NAMES.length];
      var count = 1 + (i % 3);
      var items = [], subtotal = 0;
      for (var j = 0; j < count; j++) {
        var p = tProducts[(i * 2 + j) % tProducts.length];
        var qty = 1 + ((i + j) % 2);
        subtotal += p.price * qty;
        items.push({ product_id: p.id, name: p.name, name_en: p.name_en, image: p.image, price: p.price, qty: qty });
      }
      var discount = i % 7 === 0 ? 50 : 0;
      var fee = tn.delivery_fee;
      var total = Math.max(0, subtotal - discount) + fee;
      var deliverableCompanies = companies.filter(function (c) {
        return USERS.some(function (u) { return isRider(u) && u.delivery_company === c.id && u.is_active !== false; });
      });
      var company = ['handed_to_company', 'out_for_delivery', 'delivered'].indexOf(status) > -1 ? (deliverableCompanies[i % deliverableCompanies.length] || companies[i % companies.length]) : null;
      var created;
      if (status === 'pending') created = hoursAgo(0.1 + i * 0.12);
      else if (status === 'preparing') created = hoursAgo(0.5 + i * 0.08);
      else if (status === 'handed_to_company') created = hoursAgo(0.45 + i * 0.09);
      else if (status === 'out_for_delivery') created = hoursAgo(0.35 + i * 0.09);
      else if (status === 'delivered') created = hoursAgo(4 + i * 3.2);
      else created = hoursAgo(30 + i * 4);
      var timeline = buildTimeline(status, created);
      var driver = company && status !== 'handed_to_company' ? USERS.filter(function (u) { return isDeliveryRole(u) && u.delivery_company === company.id && !isCompanyOwner(u); })[0] : null;
      out.push({
        id: 'ord-' + (1001 + i),
        order_no: 'ORD-' + (1001 + i),
        tenant_id: tn.id,
        customer_id: customer.phone === '01123456789' ? 'u-customer' : null,
        customer: customer,
        items: items,
        subtotal: subtotal,
        discount: discount,
        delivery_fee: fee,
        total: total,
        status: status,
        payment_method: ['cash', 'card', 'vodafone'][i % 3],
        delivery_company_id: company ? company.id : null,
        delivery_company_name: company ? company.name : null,
        driver_id: driver ? driver.id : null,
        driver_name: driver ? driver.name : null,
        source: i % 6 === 0 ? 'pos' : 'store',
        notes: i % 9 === 0 ? 'بدون بصل · اتصل قبل الوصول' : '',
        notes_en: i % 9 === 0 ? 'No onions · Call before arrival' : '',
        proof: status === 'delivered' ? { url: proofData('ORD-' + (1001 + i), created), at: timeline[timeline.length - 1].at, by: driver ? driver.name : 'الفريق' } : null,
        created_at: created,
        updated_at: timeline[timeline.length - 1].at,
        timeline: timeline
      });
    });
    return out;
  }

  function buildTimeline(status, created) {
    var flow = ['pending', 'preparing', 'handed_to_company', 'out_for_delivery', 'delivered'];
    var labels = { pending: 'تم إنشاء الطلب', preparing: 'جاري تجهيز الطلب', handed_to_company: 'تم التسليم لشركة التوصيل', out_for_delivery: 'المندوب في الطريق', delivered: 'تم تسليم الطلب', cancelled: 'تم إلغاء الطلب' };
    var base = new Date(created).getTime();
    if (status === 'cancelled') {
      return [
        { status: 'pending', at: new Date(base).toISOString(), label: labels.pending },
        { status: 'cancelled', at: new Date(base + 18 * 60000).toISOString(), label: labels.cancelled }
      ];
    }
    var idx = flow.indexOf(status);
    var out = [];
    for (var i = 0; i <= idx; i++) {
      out.push({ status: flow[i], at: new Date(base + i * 11 * 60000).toISOString(), label: labels[flow[i]] });
    }
    return out;
  }

  /* Invoices mirror real orders (same order number, customer, items and
     totals) so the printed 80 mm receipt always shows authentic data. */
  function buildInvoices(products, orders) {
    var out = [];
    var methods = ['cash', 'card', 'vodafone'];
    TENANTS.forEach(function (tn, ti) {
      var tOrders = (orders || []).filter(function (o) {
        return o.tenant_id === tn.id && o.status !== 'cancelled';
      });
      var tProducts = products.filter(function (p) { return p.tenant_id === tn.id; });
      for (var i = 0; i < 8; i++) {
        var order = tOrders[i % Math.max(1, tOrders.length)] || null;
        var items, subtotal, discount, delivery, total, customer, orderId, orderNo, createdAt, method;

        if (order) {
          items = (order.items || []).map(function (it) { return Object.assign({}, it); });
          subtotal = order.subtotal;
          discount = order.discount || 0;
          delivery = order.delivery_fee || 0;
          total = order.total;
          customer = order.customer;
          orderId = order.id;
          orderNo = order.order_no;
          createdAt = order.created_at;
          method = order.payment_method || methods[i % 3];
        } else {
          var p1 = tProducts[(i * 3) % tProducts.length];
          var p2 = tProducts[(i * 3 + 2) % tProducts.length];
          var q1 = 1 + (i % 3);
          items = [{ product_id: p1.id, name: p1.name, name_en: p1.name_en, image: p1.image, price: p1.price, qty: q1 }];
          if (i % 2 === 0) items.push({ product_id: p2.id, name: p2.name, name_en: p2.name_en, image: p2.image, price: p2.price, qty: 1 });
          subtotal = items.reduce(function (s, it) { return s + it.price * it.qty; }, 0);
          discount = 0;
          delivery = 0;
          total = subtotal;
          customer = null;
          orderId = null;
          orderNo = null;
          createdAt = hoursAgo(0.2 + i * 0.9);
          method = methods[i % 3];
        }

        out.push({
          id: 'inv-' + (2001 + ti * 20 + i),
          invoice_no: 'INV-' + (2001 + ti * 20 + i),
          tenant_id: tn.id,
          order_id: orderId,
          order_no: orderNo,
          customer: customer,
          cashier_id: 'u-cashier-' + tn.slug,
          cashier_name: tn.name + ' Cashier',
          items: items,
          subtotal: subtotal,
          discount: discount,
          delivery_fee: delivery,
          total: total,
          payment_method: method,
          method: method,
          status: 'paid',
          created_at: createdAt
        });
      }
    });
    return out;
  }

  /* ───────────────────────────── CHAT (1-ON-1) ─────────────────────────────
     Hierarchical inbox: support agents · stores · delivery companies.
     Every channel opens a focused direct conversation with the chosen peer.
     The old "General / عام" room is intentionally gone.                       */
  var CHAT_SCOPES = ['support', 'stores', 'delivery', 'driver', 'team'];

  function pairKey(a, b) { return [String(a), String(b)].sort().join('--'); }
  function supportRoomId(a, b) { return 'dm-support-' + pairKey(a, b); }
  /* Store threads are per person: a customer never shares a thread with
     another customer, while the whole store team answers the same thread. */
  function storeRoomId(tenantId, personId) { return 'dm-store-' + pairKey('tenant-' + tenantId, personId); }
  /* Delivery threads are per person too: two stores never share a company thread. */
  function deliveryRoomId(companyId, personId) { return 'dm-delivery-' + pairKey('company-' + companyId, personId); }
  /* Customer ↔ assigned rider: a private pair thread created from tracking. */
  function driverRoomId(a, b) { return 'dm-driver-' + pairKey(a, b); }
  /* Delivery company owner ↔ company rider: internal team thread. */
  function teamRoomId(a, b) { return 'dm-team-' + pairKey(a, b); }
  function isStoreStaff(user) { return !!user && (user.role === 'owner' || user.role === 'cashier') && !!user.tenant_id; }
  function isDeliveryRole(user) { return !!user && (user.role === 'delivery' || user.role === 'driver'); }
  function isDeliveryStaff(user) { return isDeliveryRole(user) && !!user.delivery_company; }
  /* Company owners manage the fleet; sub-drivers only see their own tasks. */
  function isCompanyOwner(user) { return isDeliveryStaff(user) && !user.tenant_id && user.company_owner !== false && !user.parent_id; }
  /* A rider who actually performs the hand-off (company sub-driver or an
     in-house store driver). Company owners never close a delivery. */
  function isRider(user) { return isDeliveryRole(user) && !isCompanyOwner(user); }
  function isSubDriver(user) {
    if (!isDeliveryRole(user)) return false;
    if (user.role === 'driver' || user.parent_id || user.company_owner === false) return true;
    return !!user.delivery_company && !user.tenant_id && !isCompanyOwner(user);
  }
  function companyDrivers(companyId) {
    return DB.users.filter(function (u) {
      return isDeliveryRole(u) && u.delivery_company === companyId && u.is_active !== false;
    });
  }
  function deliveryPair(user, peerId) {
    return isDeliveryStaff(user)
      ? { companyId: user.delivery_company, personId: String(peerId), staff: true }
      : { companyId: String(peerId), personId: user.id, staff: false };
  }
  /* Who talks to whom on a store thread: staff act as the store, everyone
     else talks to the store as themselves. */
  function storePair(user, peerId) {
    return isStoreStaff(user)
      ? { tenantId: user.tenant_id, personId: String(peerId), staff: true }
      : { tenantId: String(peerId), personId: user.id, staff: false };
  }

  function buildChats() {
    var chats = [];
    var ownerOf = function (tid) { return USERS.filter(function (u) { return u.role === 'owner' && u.tenant_id === tid; })[0]; };
    var caznovaOwner = ownerOf('t-caznova');
    var smozyOwner = ownerOf('t-smozy');

    /* Support — private pair rooms between a user and a specific agent. */
    chats.push({
      id: supportRoomId('u-admin', 'u-customer'),
      scope: 'support', peer_type: 'user', users: ['u-admin', 'u-customer'].sort(),
      title: 'دعم DotStudio®', title_en: 'DotStudio® support',
      messages: [
        { id: 'sc1', user_id: 'u-customer', name: 'ياسمين محمد', name_en: 'Yasmin Mohamed', role: 'customer', text: 'عندي سؤال بخصوص الشحن، الطلب بيوصل امتى؟', text_en: 'Quick question about shipping — when does my order arrive?', at: hoursAgo(6) },
        { id: 'sc2', user_id: 'u-admin', name: 'DotStudio Support', name_en: 'DotStudio Support', role: 'superadmin', text: 'أهلاً ياسمين 🌸 التوصيل داخل القاهرة من 30 لـ 45 دقيقة، وتقدري تتابعي الطلب لحظة بلحظة.', text_en: 'Hi Yasmin 🌸 Delivery inside Cairo takes 30–45 minutes, and you can track it live.', at: hoursAgo(5) },
        { id: 'sc3', user_id: 'u-customer', name: 'ياسمين محمد', name_en: 'Yasmin Mohamed', role: 'customer', text: 'ممتاز، شكراً جداً 🙏', text_en: 'Perfect, thank you so much 🙏', at: hoursAgo(4.5) }
      ]
    });
    chats.push({
      id: supportRoomId('u-dina', smozyOwner.id),
      scope: 'support', peer_type: 'user', users: ['u-dina', smozyOwner.id].sort(),
      title: 'دعم · دينا', title_en: 'Support · Dina',
      messages: [
        { id: 'sd1', user_id: smozyOwner.id, name: smozyOwner.name, name_en: smozyOwner.name_en, role: 'owner', text: 'عايزين نفعّل شركة توصيل إضافية للمتجر.', text_en: 'We would like to add another delivery company.', at: hoursAgo(22) },
        { id: 'sd2', user_id: 'u-dina', name: 'دينا', name_en: 'Dina', role: 'subadmin', text: 'تمام يا فندم ✅ جهزت الطلب وفريق التوصيل هيتواصل معاك.', text_en: 'Done ✅ I prepared the request and the delivery team will contact you.', at: hoursAgo(21) }
      ]
    });
    chats.push({
      id: supportRoomId('u-amal', caznovaOwner.id),
      scope: 'support', peer_type: 'user', users: ['u-amal', caznovaOwner.id].sort(),
      title: 'دعم · أمل', title_en: 'Support · Amal',
      messages: [
        { id: 'sa1', user_id: caznovaOwner.id, name: caznovaOwner.name, name_en: caznovaOwner.name_en, role: 'owner', text: 'محتاج تقرير مبيعات الشهر ده.', text_en: 'I need this month’s sales report.', at: hoursAgo(30) },
        { id: 'sa2', user_id: 'u-amal', name: 'أمل', name_en: 'Amal', role: 'subadmin', text: 'التقرير جاهز في صفحة التقارير، وتقدر تصدره CSV.', text_en: 'The report is ready in the reports page, and you can export it as CSV.', at: hoursAgo(29) }
      ]
    });

    /* Stores — one private thread per person, shared with the store team. */
    var adminUser = USERS.filter(function (u) { return u.role === 'superadmin'; })[0];
    TENANTS.forEach(function (tn, i) {
      var owner = ownerOf(tn.id);
      var person = tn.id === 't-caznova' ? 'u-customer' : (adminUser ? adminUser.id : owner.id);
      chats.push({
        id: storeRoomId(tn.id, person),
        scope: 'stores', peer_type: 'tenant', peer_id: tn.id, tenant_id: tn.id,
        person_id: person, users: [person, 'tenant-' + tn.id].sort(),
        title: tn.name, title_en: tn.name_en,
        messages: tn.id === 't-caznova' ? [
          { id: 'st1', user_id: 'u-customer', name: 'ياسمين محمد', name_en: 'Yasmin Mohamed', role: 'customer', text: 'مساء الخير 👋 عايزة أعرف مقاس الخاتم الفضي متوفر؟', text_en: 'Good evening 👋 Is the silver ring available in my size?', at: hoursAgo(9) },
          { id: 'st2', user_id: owner.id, name: owner.name, name_en: owner.name_en, role: 'owner', text: 'أهلاً بيكي 🌟 متوفر مقاسات 16 و18، وقدرنا نحجزلك المقاس اللي تحبيه.', text_en: 'Welcome 🌟 Sizes 16 and 18 are in stock — we can reserve yours.', at: hoursAgo(8) },
          { id: 'st3', user_id: 'u-customer', name: 'ياسمين محمد', name_en: 'Yasmin Mohamed', role: 'customer', text: 'تمام جداً، هطلبه دلوقتي. شكراً!', text_en: 'Perfect, ordering now. Thank you!', at: hoursAgo(7) }
        ] : [
          { id: 'st' + i + 'a', user_id: owner.id, name: owner.name, name_en: owner.name_en, role: 'owner', text: 'أهلاً بيك في ' + tn.name + ' 👋 اسألنا عن أي منتج أو مقاس وإحنا هنا.', text_en: 'Welcome to ' + tn.name_en + ' 👋 Ask us about any product or size.', at: hoursAgo(30 + i) },
          { id: 'st' + i + 'b', user_id: adminUser ? adminUser.id : owner.id, name: 'DotStudio Ops', name_en: 'DotStudio Ops', role: 'superadmin', text: 'تمام، متابعين معاك ✅ أي تحديثات على الباقة أو الطلبات هنبعتلك هنا.', text_en: 'Noted ✅ Any plan or order updates will land here.', at: hoursAgo(28 + i) }
        ]
      });
    });

    /* Delivery — one private thread per person, shared with the company team. */
    DELIVERY_COMPANIES.forEach(function (dc, i) {
      var driver = USERS.filter(function (u) { return isDeliveryRole(u) && u.delivery_company === dc.id; })[0];
      var person = adminUser ? adminUser.id : (driver ? driver.id : 'u-admin');
      chats.push({
        id: deliveryRoomId(dc.id, person),
        scope: 'delivery', peer_type: 'company', peer_id: dc.id,
        person_id: person, users: [person, 'company-' + dc.id].sort(),
        title: dc.name, title_en: dc.name_en,
        messages: [
          { id: 'dc' + i + 'a', user_id: 'u-admin', name: 'DotStudio Ops', name_en: 'DotStudio Ops', role: 'superadmin', text: 'تذكير: تأكيد التسليم لازم يكون مع صورة إثبات من اليوم.', text_en: 'Reminder: delivery confirmation now requires a proof photo.', at: hoursAgo(18 + i) },
          { id: 'dc' + i + 'b', user_id: driver ? driver.id : 'u-admin', name: driver ? driver.name : 'DotStudio Ops', name_en: driver ? driver.name_en : 'DotStudio Ops', role: driver ? 'delivery' : 'superadmin', text: 'تمام، تم التطبيق على كل المندوبين ✅', text_en: 'Done — applied to all riders ✅', at: hoursAgo(16 + i) }
        ]
      });
    });
    return chats;
  }

  /* Migration: strip the retired General/public rooms, unfold old group chats
     into 1-on-1 rooms, and keep old localStorage databases healthy. */
  function ensureChats(db) {
    if (!db) return;
    if (!Array.isArray(db.chats)) db.chats = [];
    if (!Array.isArray(db.chat_blocks)) db.chat_blocks = [];
    if (!Array.isArray(db.chat_reports)) db.chat_reports = [];
    var tenants = Array.isArray(db.tenants) ? db.tenants : [];
    var users = Array.isArray(db.users) ? db.users : [];
    var out = [], seen = {};

    /* A legacy store room had no person attached; infer it from the thread
       (first non-employee author) or fall back to the platform admin. */
    function personFor(room, staffIds) {
      var guest = (room.messages || []).filter(function (m) {
        return m && m.user_id && staffIds.indexOf(m.user_id) === -1;
      })[0];
      if (guest) return guest.user_id;
      var admin = users.filter(function (u) { return u.role === 'superadmin'; })[0];
      return admin ? admin.id : (staffIds[0] || null);
    }
    function storePerson(room, tenantId) {
      return personFor(room, users.filter(function (u) {
        return u.tenant_id === tenantId && (u.role === 'owner' || u.role === 'cashier');
      }).map(function (u) { return u.id; }));
    }
    function deliveryPerson(room, companyId) {
      return personFor(room, users.filter(function (u) {
        return isDeliveryRole(u) && u.delivery_company === companyId;
      }).map(function (u) { return u.id; }));
    }

    function add(room) {
      if (!room || !room.id || CHAT_SCOPES.indexOf(room.scope) === -1) return;
      if (!Array.isArray(room.messages)) room.messages = [];
      if (seen[room.id]) {
        var existing = out.filter(function (r) { return r.id === room.id; })[0];
        if (existing) {
          room.messages.forEach(function (m) {
            if (!existing.messages.some(function (x) { return x.id === m.id; })) existing.messages.push(m);
          });
        }
        return;
      }
      seen[room.id] = 1;
      out.push(room);
    }

    db.chats.forEach(function (room) {
      if (!room) return;
      /* General / public chat is fully retired. */
      if (room.scope === 'public' || room.id === 'public' || room.id === 'support-global') return;
      if (room.id === 'stores' || room.id === 'delivery') return;

      if (room.scope === 'direct') {
        if (room.tenant_id) {
          var dPerson = storePerson(room, room.tenant_id);
          if (dPerson) {
            add({
              id: storeRoomId(room.tenant_id, dPerson), scope: 'stores', peer_type: 'tenant',
              peer_id: room.tenant_id, tenant_id: room.tenant_id, person_id: dPerson,
              users: [dPerson, 'tenant-' + room.tenant_id].sort(),
              title: room.title, title_en: room.title_en, messages: room.messages
            });
          }
        }
        return;
      }

      if (/^support-/.test(room.id || '')) {
        var tid = room.tenant_id || String(room.id).replace(/^support-/, '');
        var owner = users.filter(function (u) { return u.role === 'owner' && u.tenant_id === tid; })[0];
        var admin = users.filter(function (u) { return u.role === 'superadmin'; })[0];
        if (owner && admin) {
          add({ id: supportRoomId(admin.id, owner.id), scope: 'support', peer_type: 'user', users: [admin.id, owner.id].sort(), title: 'دعم DotStudio®', title_en: 'DotStudio® support', messages: room.messages });
        }
        return;
      }

      if (room.scope === 'support') {
        if (!Array.isArray(room.users) || room.users.length !== 2) return;
        room.id = supportRoomId(room.users[0], room.users[1]);
        room.peer_type = 'user';
      } else if (room.scope === 'stores') {
        if (!room.peer_id && room.tenant_id) room.peer_id = room.tenant_id;
        if (!room.peer_id) return;
        room.tenant_id = room.peer_id;
        room.peer_type = 'tenant';
        if (room.person_id && !users.some(function (u) { return u.id === room.person_id; })) room.person_id = null;
        if (!room.person_id) room.person_id = storePerson(room, room.peer_id);
        if (!room.person_id) return;
        room.person_id = String(room.person_id);
        room.users = [room.person_id, 'tenant-' + room.peer_id].sort();
        room.id = storeRoomId(room.peer_id, room.person_id);
      } else if (room.scope === 'delivery') {
        if (!room.peer_id) return;
        room.peer_type = 'company';
        if (room.person_id && !users.some(function (u) { return u.id === room.person_id; })) room.person_id = null;
        if (!room.person_id) room.person_id = deliveryPerson(room, room.peer_id);
        if (!room.person_id) return;
        room.person_id = String(room.person_id);
        room.users = [room.person_id, 'company-' + room.peer_id].sort();
        room.id = deliveryRoomId(room.peer_id, room.person_id);
      } else if (room.scope === 'driver') {
        if (!Array.isArray(room.users) || room.users.length !== 2) return;
        room.peer_type = 'user';
        room.id = driverRoomId(room.users[0], room.users[1]);
      }
      add(room);
    });
    db.chats = out;
  }

  function buildJobs() {
    return [
      { id: 'job-1', title: 'كاشير نقطة بيع', title_en: 'POS Cashier', department: 'العمليات', department_en: 'Operations', type: 'fullTime', type_en: 'Full-time', location: 'القاهرة · مدينة نصر', location_en: 'Cairo · Nasr City', salary: '8,000 – 11,000 ج.م', salary_en: 'EGP 8,000 – 11,000', experience: '0–2 سنة', experience_en: '0–2 years', description: 'نبحث عن كاشير سريع ودقيق لإدارة نقطة البيع اليومية والتعامل مع العملاء.', description_en: 'We are looking for a fast and accurate cashier to run daily POS operations.', requirements: ['إجادة استخدام الحاسب', 'مهارات تواصل ممتازة', 'القدرة على العمل بنظام الورديات'], requirements_en: ['Computer literacy', 'Excellent communication', 'Shift availability'], created_at: daysAgo(4), active: true },
      { id: 'job-2', title: 'مندوب توصيل', title_en: 'Delivery Rider', department: 'التوصيل', department_en: 'Delivery', type: 'partTime', type_en: 'Part-time', location: 'القاهرة والجيزة', location_en: 'Cairo & Giza', salary: 'على الطلب + حوافز', salary_en: 'Per delivery + incentives', experience: 'لا يشترط', experience_en: 'Not required', description: 'انضم لشبكة توصيل DotStudio وسلّم الطلبات في أسرع وقت.', description_en: 'Join the DotStudio delivery network and deliver orders fast.', requirements: ['رخصة سارية', 'موتوسيكل أو دراجة', 'معرفة جيدة بالمناطق'], requirements_en: ['Valid licence', 'Motorcycle or bicycle', 'Good area knowledge'], created_at: daysAgo(6), active: true },
      { id: 'job-3', title: 'مصمم UI/UX', title_en: 'UI/UX Designer', department: 'التصميم', department_en: 'Design', type: 'remote', type_en: 'Remote', location: 'عن بعد', location_en: 'Remote', salary: '20,000 – 30,000 ج.م', salary_en: 'EGP 20,000 – 30,000', experience: '3+ سنوات', experience_en: '3+ years', description: 'صمم تجارب متاجر ولوحات تحكم بمعايير عالمية.', description_en: 'Design world-class storefront and dashboard experiences.', requirements: [' portfolio قوي', 'إجادة Figma', 'حس تصميمي عالي'], requirements_en: ['Strong portfolio', 'Figma mastery', 'Great design taste'], created_at: daysAgo(9), active: true },
      { id: 'job-4', title: 'مسؤول دعم عملاء', title_en: 'Customer Support Specialist', department: 'الدعم', department_en: 'Support', type: 'fullTime', type_en: 'Full-time', location: 'القاهرة · المعادي', location_en: 'Cairo · Maadi', salary: '10,000 – 14,000 ج.م', salary_en: 'EGP 10,000 – 14,000', experience: '1–3 سنوات', experience_en: '1–3 years', description: 'كن صوت DotStudio لدى أصحاب المتاجر وحل مشاكلهم بسرعة.', description_en: 'Be the voice of DotStudio for store owners and resolve issues fast.', requirements: ['لباقة في التواصل', 'إجادة الإنجليزية', 'تفكير تحليلي'], requirements_en: ['Friendly communication', 'Fluent English', 'Analytical thinking'], created_at: daysAgo(12), active: true },
      { id: 'job-5', title: 'محاسب', title_en: 'Accountant', department: 'المالية', department_en: 'Finance', type: 'fullTime', type_en: 'Full-time', location: 'الجيزة · المهندسين', location_en: 'Giza · Mohandessin', salary: '12,000 – 16,000 ج.م', salary_en: 'EGP 12,000 – 16,000', experience: '2+ سنوات', experience_en: '2+ years', description: 'إدارة الفواتير والتقارير المالية الشهرية.', description_en: 'Manage invoices and monthly financial reporting.', requirements: ['خبرة في المحاسبة', 'إجادة Excel', 'دقة عالية'], requirements_en: ['Accounting experience', 'Excel skills', 'High accuracy'], created_at: daysAgo(15), active: true },
      { id: 'job-6', title: 'مسوق رقمي', title_en: 'Digital Marketer', department: 'التسويق', department_en: 'Marketing', type: 'remote', type_en: 'Remote', location: 'عن بعد', location_en: 'Remote', salary: '15,000 – 22,000 ج.م', salary_en: 'EGP 15,000 – 22,000', experience: '2+ سنوات', experience_en: '2+ years', description: 'قد حملات أداء لمتاجرنا وشريكاً في النمو.', description_en: 'Run performance campaigns for our stores and drive growth.', requirements: ['خبرة في Meta Ads', 'تحليل بيانات', 'كتابة إعلانية'], requirements_en: ['Meta Ads experience', 'Data analysis', 'Copywriting'], created_at: daysAgo(18), active: true }
    ];
  }

  function buildAudit() {
    var base = [
      { actor: 'System Admin', actor_en: 'System Admin', role: 'superadmin', action: 'تم تحديث إعدادات المنصة', action_en: 'Platform settings updated', icon: 'settings', at: hoursAgo(2) },
      { actor: 'أحمد كازنوفا', actor_en: 'Ahmed Caznova', role: 'owner', action: 'أضاف منتج «ساعة يد كلاسيك»', action_en: 'Added product “Classic wrist watch”', icon: 'box', at: hoursAgo(4) },
      { actor: 'سارة سميزي', actor_en: 'Sara Smozy', role: 'owner', action: 'حدّثت سعر «ميلك شيك لوتس»', action_en: 'Updated price of “Lotus milkshake”', icon: 'tag', at: hoursAgo(6) },
      { actor: 'كاشير Bn Alsheikh', actor_en: 'Bn Alsheikh Cashier', role: 'cashier', action: 'أصدر فاتورة INV-2041 بقيمة 145 ج.م', action_en: 'Issued invoice INV-2041 for EGP 145', icon: 'receipt', at: hoursAgo(7) },
      { actor: 'طلقة', actor_en: 'Talqa', role: 'delivery', action: 'سلّم الطلب ORD-1005', action_en: 'Delivered order ORD-1005', icon: 'truck', at: hoursAgo(9) },
      { actor: 'System Admin', actor_en: 'System Admin', role: 'superadmin', action: 'فعّل اشتراك متجر MA Store', action_en: 'Activated MA Store subscription', icon: 'card', at: hoursAgo(14) },
      { actor: 'فاطمة', actor_en: 'Fatma', role: 'subadmin', action: 'حدّثت حالة الطلب ORD-1012', action_en: 'Updated order ORD-1012 status', icon: 'orders', at: hoursAgo(18) },
      { actor: 'محمود علي', actor_en: 'Mahmoud Ali', role: 'owner', action: 'غيّر صورة المتجر', action_en: 'Changed store avatar', icon: 'image', at: hoursAgo(22) },
      { actor: 'دينا', actor_en: 'Dina', role: 'subadmin', action: 'ردت على تذكرة دعم', action_en: 'Replied to a support ticket', icon: 'chat', at: hoursAgo(26) },
      { actor: 'System Admin', actor_en: 'System Admin', role: 'superadmin', action: 'أضاف مشرف جديد «بسملة»', action_en: 'Added sub-admin “Basmala”', icon: 'shield', at: hoursAgo(30) }
    ];
    return base.map(function (x, i) { return Object.assign({ id: 'log-' + (i + 1) }, x); });
  }

  /* ─────────────────────────── DISCOUNTS ─────────────────────────── */
  function seedDiscounts() {
    var in30 = daysAhead(30);
    return [
      { id: 'disc-save20', code: 'SAVE20', type: 'percent', value: 20, min_order: 0, max_uses: 0, used: 0,
        active: true, expires_at: in30, created_at: nowISO(),
        note: 'خصم افتتاحي 20%', note_en: 'Launch offer · 20% off' }
    ];
  }

  /* ─────────────────────────── REVIEWS ─────────────────────────── */
  /* Seeded reviews keep the storefront alive from the first visit. Each
     review can carry a customer-uploaded photo (data URL). */
  var REVIEW_SEED = [
    { p: 0, name: 'سارة ع.', name_en: 'Sara A.', rating: 5, text: 'جودة ممتازة والتغليف أنيق جداً. وصل قبل الميعاد.', text_en: 'Excellent quality and beautiful packaging. Arrived early.' },
    { p: 1, name: 'محمد ك.', name_en: 'Mohamed K.', rating: 5, text: 'ريحته تدوم طول اليوم. هطلب تاني أكيد.', text_en: 'The scent lasts all day. Definitely reordering.' },
    { p: 4, name: 'ياسمين م.', name_en: 'Yasmin M.', rating: 5, text: 'الساعة أجمل من الصور بمراحل. خدمة عملاء محترمة.', text_en: 'The watch looks even better than the photos. Great support.' },
    { p: 10, name: 'كريم ح.', name_en: 'Karim H.', rating: 5, text: 'أحلى مانجو في القاهرة، طازة وباردة.', text_en: 'Best mango in Cairo — fresh and cold.' },
    { p: 13, name: 'منى ع.', name_en: 'Mona A.', rating: 4, text: 'طعم رائع لكن كنت أتمنى حجم أكبر.', text_en: 'Great taste, wish the size was bigger.' },
    { p: 16, name: 'أحمد ف.', name_en: 'Ahmed F.', rating: 5, text: 'أوريو ميلك شيك مفيش زيه. التوصيل سريع.', text_en: 'The Oreo milkshake is unmatched. Fast delivery too.' },
    { p: 20, name: 'نور الدين', name_en: 'Nour Eldin', rating: 5, text: 'قهوة تركي مضبوطة زي بتاعة البيت.', text_en: 'Turkish coffee brewed exactly right.' },
    { p: 22, name: 'هبة س.', name_en: 'Heba S.', rating: 5, text: 'الكابتشينو رغوة مثالية وطعم غني.', text_en: 'Perfect cappuccino foam and a rich taste.' },
    { p: 27, name: 'مصطفى ع.', name_en: 'Mostafa A.', rating: 4, text: 'خامة التيشيرت ممتازة والمقاس مظبوط.', text_en: 'Great fabric and true to size.' },
    { p: 32, name: 'دينا ر.', name_en: 'Dina R.', rating: 5, text: 'الجاكيت جلد حقيقي وشكله فخم جداً.', text_en: 'Real leather jacket and looks very premium.' },
    { p: 35, name: 'ريم خ.', name_en: 'Reem K.', rating: 5, text: 'نظارة شمس خفيفة وأنيقة.', text_en: 'Lightweight and stylish sunglasses.' }
  ];
  function seedReviews(products) {
    return REVIEW_SEED.map(function (r, i) {
      var p = products[r.p % products.length] || products[0];
      var at = daysAgo(i + 2);
      return {
        id: 'rev-' + (i + 1),
        product_id: p.id,
        tenant_id: p.tenant_id,
        user_id: 'seed-' + i,
        name: r.name, name_en: r.name_en,
        rating: r.rating,
        text: r.text, text_en: r.text_en,
        image: null,
        verified: true,
        created_at: at,
        updated_at: at
      };
    });
  }

  function normalizeCode(code) {
    return String(code == null ? '' : code).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  }

  function findDiscount(code) {
    var c = normalizeCode(code);
    if (!c) return null;
    return (DB.discounts || []).filter(function (d) { return normalizeCode(d.code) === c; })[0] || null;
  }

  function validateDiscount(code, subtotal) {
    var d = findDiscount(code);
    if (!d) return { ok: false, error: 'invalid' };
    if (d.active === false) return { ok: false, error: 'inactive' };
    if (d.expires_at && new Date(d.expires_at).getTime() < Date.now()) return { ok: false, error: 'expired' };
    if (Number(d.max_uses) > 0 && Number(d.used) >= Number(d.max_uses)) return { ok: false, error: 'used' };
    var sub = Number(subtotal);
    if (subtotal != null && !isFinite(sub)) sub = 0;
    if (isFinite(sub) && Number(d.min_order) > 0 && sub < Number(d.min_order)) return { ok: false, error: 'min', min_order: Number(d.min_order) };
    var amount = 0;
    if (isFinite(sub) && sub > 0) {
      amount = d.type === 'fixed' ? Number(d.value) || 0 : sub * (Number(d.value) || 0) / 100;
      amount = Math.max(0, Math.min(sub, Math.round(amount * 100) / 100));
    }
    return { ok: true, discount: d, amount: amount };
  }

  function addDiscount(data) {
    var clean = Object.assign({}, data || {});
    clean.code = normalizeCode(clean.code);
    if (!clean.code) return null;
    clean.id = DS.uid('disc');
    clean.type = clean.type === 'fixed' ? 'fixed' : 'percent';
    clean.value = Math.max(0, Number(clean.value) || 0);
    clean.min_order = Math.max(0, Number(clean.min_order) || 0);
    clean.max_uses = Math.max(0, Number(clean.max_uses) || 0);
    clean.used = 0;
    clean.active = clean.active !== false;
    clean.created_at = nowISO();
    DB.discounts = DB.discounts || [];
    DB.discounts.unshift(clean);
    commit();
    return clean;
  }

  function saveDiscount(patch) {
    if (!patch || !patch.id) return null;
    var idx = (DB.discounts || []).findIndex(function (d) { return d.id === patch.id; });
    if (idx === -1) return null;
    var next = Object.assign({}, DB.discounts[idx], patch);
    next.code = normalizeCode(next.code);
    next.value = Math.max(0, Number(next.value) || 0);
    next.min_order = Math.max(0, Number(next.min_order) || 0);
    next.max_uses = Math.max(0, Number(next.max_uses) || 0);
    DB.discounts[idx] = next;
    commit();
    return next;
  }

  function deleteDiscount(id) {
    DB.discounts = (DB.discounts || []).filter(function (d) { return d.id !== id; });
    commit();
    return true;
  }

  function consumeDiscount(code) {
    var d = findDiscount(code);
    if (!d) return null;
    d.used = (Number(d.used) || 0) + 1;
    commit();
    return d;
  }

  /* ─────────────────────── REVIEWS + RATINGS ─────────────────────── */
  function reviewsFor(productId) {
    return (DB.reviews || []).filter(function (r) { return r.product_id === productId; })
      .sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
  }

  /* Weighted average: the seeded product rating counts as 10 votes so a
     single new review nudges the score instead of flipping it. */
  function ratingFor(productId) {
    var p = DB.products.filter(function (x) { return x.id === productId; })[0];
    var base = p ? (Number(p.rating) || 4.8) : 4.8;
    var rs = reviewsFor(productId);
    if (!rs.length) return { rating: base, count: Number(p && p.review_count) || 0, reviews: rs };
    var sum = base * 10, n = 10;
    rs.forEach(function (r) { sum += Math.max(1, Math.min(5, Number(r.rating) || 5)); n++; });
    return { rating: Math.round((sum / n) * 10) / 10, count: rs.length, reviews: rs };
  }

  function refreshProductRating(productId) {
    var p = DB.products.filter(function (x) { return x.id === productId; })[0];
    if (!p) return;
    var r = ratingFor(productId);
    p.rating = r.rating;
    p.review_count = r.count;
    p.updated_at = nowISO();
  }

  function addReview(data) {
    data = data || {};
    var p = DB.products.filter(function (x) { return x.id === data.product_id; })[0];
    if (!p) return null;
    var s = DS.session() || {};
    var clean = {
      id: DS.uid('rev'),
      product_id: p.id,
      tenant_id: p.tenant_id,
      user_id: data.user_id || s.id || 'guest',
      name: DS.sanitize ? DS.sanitize(data.name || s.name || 'Customer', 60) : (data.name || s.name || 'Customer'),
      name_en: DS.sanitize ? DS.sanitize(data.name_en || s.name_en || data.name || s.name || 'Customer', 60) : (data.name_en || data.name || 'Customer'),
      rating: Math.max(1, Math.min(5, Math.round(Number(data.rating) || 5))),
      text: DS.sanitize ? DS.sanitize(data.text || '', 700) : String(data.text || '').slice(0, 700),
      text_en: DS.sanitize ? DS.sanitize(data.text_en || data.text || '', 700) : String(data.text_en || data.text || '').slice(0, 700),
      image: typeof data.image === 'string' && /^data:image\//.test(data.image) ? data.image : null,
      verified: !!s.id,
      created_at: nowISO(),
      updated_at: nowISO()
    };
    DB.reviews = DB.reviews || [];
    DB.reviews.unshift(clean);
    refreshProductRating(p.id);
    audit('أضاف تقييم ' + clean.rating + '★ لمنتج «' + p.name + '»', 'Reviewed “' + (p.name_en || p.name) + '” · ' + clean.rating + '★', 'star');
    commit();
    return clean;
  }

  function updateReview(id, patch) {
    var idx = (DB.reviews || []).findIndex(function (r) { return r.id === id; });
    if (idx === -1) return null;
    var next = Object.assign({}, DB.reviews[idx], patch || {}, { updated_at: nowISO() });
    next.rating = Math.max(1, Math.min(5, Math.round(Number(next.rating) || 5)));
    next.text = String(next.text || '').slice(0, 700);
    next.text_en = String(next.text_en || next.text || '').slice(0, 700);
    if (next.image && !/^data:image\//.test(next.image)) next.image = null;
    DB.reviews[idx] = next;
    refreshProductRating(next.product_id);
    commit();
    return next;
  }

  function deleteReview(id) {
    var r = (DB.reviews || []).filter(function (x) { return x.id === id; })[0];
    if (!r) return false;
    DB.reviews = DB.reviews.filter(function (x) { return x.id !== id; });
    refreshProductRating(r.product_id);
    audit('حذف تقييم منتج', 'Deleted a product review', 'trash');
    commit();
    return true;
  }

  /* ─────────────────── CUSTOMER SAVED ADDRESSES ─────────────────── */
  function addressesFor(user) {
    var u = user && user.id ? (DB.users.filter(function (x) { return x.id === user.id; })[0] || user) : (DS.session() || {});
    if (Array.isArray(u.addresses) && u.addresses.length) return u.addresses;
    var fallback = u.address ? [{
      id: 'addr-default', label: 'المنزل', label_en: 'Home',
      address: u.address, address_en: u.address_en || u.address,
      city: u.city, city_en: u.city_en || u.city,
      phone: u.phone, is_default: true
    }] : [];
    return fallback;
  }

  function saveAddress(data) {
    var s = DS.session();
    if (!s) return null;
    var u = DB.users.filter(function (x) { return x.id === s.id; })[0];
    if (!u) return null;
    var list = Array.isArray(u.addresses) ? u.addresses.slice() : addressesFor(u).slice();
    var item = {
      id: data.id || DS.uid('addr'),
      label: DS.sanitize ? DS.sanitize(data.label || 'المنزل', 24) : (data.label || 'المنزل'),
      label_en: DS.sanitize ? DS.sanitize(data.label_en || data.label || 'Home', 24) : (data.label_en || data.label || 'Home'),
      address: DS.sanitize ? DS.sanitize(data.address || '', 240) : String(data.address || '').slice(0, 240),
      address_en: DS.sanitize ? DS.sanitize(data.address_en || data.address || '', 240) : String(data.address_en || data.address || '').slice(0, 240),
      city: DS.sanitize ? DS.sanitize(data.city || '', 80) : String(data.city || '').slice(0, 80),
      city_en: DS.sanitize ? DS.sanitize(data.city_en || data.city || '', 80) : String(data.city_en || data.city || '').slice(0, 80),
      phone: String(data.phone || u.phone || '').slice(0, 20),
      lat: Number(data.lat) || u.lat || null,
      lng: Number(data.lng) || u.lng || null,
      is_default: !!data.is_default
    };
    if (!item.address) return null;
    var idx = -1;
    list.forEach(function (a, i) { if (a.id === item.id) idx = i; });
    if (idx > -1) list[idx] = item; else list.push(item);
    if (item.is_default) list.forEach(function (a) { a.is_default = a.id === item.id; });
    u.addresses = list;
    try {
      var sess = (DS.session && DS.session()) || JSON.parse((DS.sessionGet ? DS.sessionGet('cz_user') : localStorage.getItem('cz_user')) || '{}');
      sess.addresses = list;
      if (DS.writeSession) DS.writeSession(sess);
      else localStorage.setItem('cz_user', JSON.stringify(sess));
    } catch (e) {}
    commit();
    return item;
  }

  function deleteAddress(id) {
    var s = DS.session();
    if (!s) return false;
    var u = DB.users.filter(function (x) { return x.id === s.id; })[0];
    if (!u || !Array.isArray(u.addresses)) return false;
    u.addresses = u.addresses.filter(function (a) { return a.id !== id; });
    try {
      var sess = (DS.session && DS.session()) || JSON.parse((DS.sessionGet ? DS.sessionGet('cz_user') : localStorage.getItem('cz_user')) || '{}');
      sess.addresses = u.addresses;
      if (DS.writeSession) DS.writeSession(sess);
      else localStorage.setItem('cz_user', JSON.stringify(sess));
    } catch (e) {}
    commit();
    return true;
  }

  /* ───────────────────── FREE DELIVERY SETTINGS ───────────────────── */
  function freeDelivery() {
    return (DB.settings && DB.settings.free_delivery) || { enabled: false };
  }
  function saveFreeDelivery(patch) {
    DB.settings = DB.settings || {};
    DB.settings.free_delivery = Object.assign({ enabled: false, mode: 'threshold', min_order: 0, company_id: '', note: '', note_en: '', until: null }, DB.settings.free_delivery || {}, patch || {});
    commit();
    return DB.settings.free_delivery;
  }
  /* Returns 0 when the rule applies, otherwise null (caller keeps its fee). */
  function freeDeliveryFee(subtotal) {
    var f = freeDelivery();
    if (!f.enabled) return null;
    if (f.until && new Date(f.until).getTime() < Date.now()) return null;
    var sub = Number(subtotal) || 0;
    if (f.mode === 'threshold' && sub < (Number(f.min_order) || 0)) return null;
    if (f.mode === 'companies' && f.company_id) return null; /* handled by company */
    return 0;
  }

  /* ─────────────────── STORE-WIDE SALE SETTINGS ─────────────────── */
  function storeSale() {
    return (DB.settings && DB.settings.store_sale) || { enabled: false, percent: 0 };
  }
  function saveStoreSale(patch) {
    DB.settings = DB.settings || {};
    DB.settings.store_sale = Object.assign({ enabled: false, percent: 10, label: 'تخفيضات المتجر', label_en: 'Store sale' }, DB.settings.store_sale || {}, patch || {});
    DB.settings.store_sale.percent = Math.max(0, Math.min(90, Number(DB.settings.store_sale.percent) || 0));
    commit();
    return DB.settings.store_sale;
  }
  function storeSaleAmount(subtotal) {
    var s = storeSale();
    if (!s.enabled || !(Number(s.percent) > 0)) return 0;
    return Math.round((Number(subtotal) || 0) * Number(s.percent)) / 100;
  }

  function seed() {
    /* CLEAN INSTALL — brand-new demo database.
       Only the 18 default accounts, the 36-product catalogue, the four stores,
       the delivery companies and the (empty) chat rooms are created.
       No orders, sales, invoices, audit noise or chat history. */
    var products = buildProducts();
    var db = {
      version: VERSION,
      created_at: nowISO(),
      tenants: TENANTS,
      users: USERS,
      products: products,
      orders: [],
      invoices: [],
      delivery_companies: DELIVERY_COMPANIES,
      chats: buildChats().map(function (room) { return Object.assign({}, room, { messages: [] }); }),
      jobs: buildJobs(),
      applications: [],
      audit_logs: [],
      payments: [],
      discounts: seedDiscounts(),
      reviews: seedReviews(products),
      settings: {
        platform_name: 'DotStudio® POS',
        whatsapp: WHATSAPP,
        currency: 'EGP',
        support_email: 'hello@dotstudio.app',
        maintenance: false,
        allow_signups: true,
        default_delivery_fee: 30,
        store_sale: { enabled: false, percent: 10, label: 'تخفيضات المتجر', label_en: 'Store sale' },
        free_delivery: { enabled: false, mode: 'threshold', min_order: 500, company_id: '', note: '', note_en: '', until: null }
      }
    };
    return db;
  }

  function load() {
    var db = null;
    try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (!db || db.version !== VERSION || !Array.isArray(db.tenants) || !db.tenants.length) {
      db = seed();
      save(db);
      return db;
    }
    var changed = false;
    /* Migration — business hours (offline mode) added in the 2026 release. */
    if (Array.isArray(db.tenants)) {
      db.tenants.forEach(function (tn, i) {
        var seedTn = TENANTS.filter(function (x) { return x.id === tn.id; })[0];
        if (!tn.openTime) { tn.openTime = seedTn ? seedTn.openTime : '10:00'; changed = true; }
        if (!tn.closeTime) { tn.closeTime = seedTn ? seedTn.closeTime : '22:00'; changed = true; }
        if (typeof tn.offline !== 'boolean') { tn.offline = false; changed = true; }
      });
    }
    /* Migration — 2026.10: demo stores trade around the clock by default so the
       storefront is always demo-ready; owners pause ordering explicitly with the
       "accept orders" switch instead of hitting a scheduled closing time. */
    db.migrations = db.migrations || {};
    if (!db.migrations.allDayStores) {
      var LEGACY_HOURS = {
        't-caznova': ['10:00', '23:00'],
        't-smozy': ['00:00', '24:00'],
        't-bnsheikh': ['07:00', '23:30'],
        't-mastore': ['10:00', '22:00']
      };
      (db.tenants || []).forEach(function (tn) {
        var legacy = LEGACY_HOURS[tn.id];
        if (legacy && tn.openTime === legacy[0] && tn.closeTime === legacy[1]) {
          tn.openTime = '00:00';
          tn.closeTime = '24:00';
        }
      });
      db.migrations.allDayStores = true;
      changed = true;
    }
    /* Migration — remove the legacy demo orders ORD-1001 … ORD-1003 once.
       Match the seeded ids only: a real first order can legitimately reuse
       the ORD-1001 order number, so order_no must never be the filter. */
    if (!db.migrations.demoOrdersPurged) {
      var LEGACY_IDS = { 'ord-1001': 1, 'ord-1002': 1, 'ord-1003': 1 };
      db.orders = (db.orders || []).filter(function (o) {
        return o && !LEGACY_IDS[o.id];
      });
      db.invoices = (db.invoices || []).filter(function (inv) {
        return inv && !LEGACY_IDS[inv.order_id];
      });
      db.migrations.demoOrdersPurged = true;
      changed = true;
    }
    if (Array.isArray(db.products)) {
      db.products.forEach(function (p, i) {
        if (!p.barcode) {
          // Check matching in CATALOG
          var match = null;
          if (p.tenant_id && CATALOG[p.tenant_id]) {
            match = CATALOG[p.tenant_id].filter(function (cp) { return cp.sku === p.sku || cp.name === p.name; })[0];
          }
          p.barcode = match && match.barcode ? match.barcode : ('628' + String(1000000000 + i).slice(1));
          changed = true;
        }
      });
    }
    if (!Array.isArray(db.discounts) || !db.discounts.length) { db.discounts = seedDiscounts(); changed = true; }
    if (!Array.isArray(db.reviews)) { db.reviews = seedReviews(db.products || []); changed = true; }
    if (!db.settings) db.settings = {};
    if (!db.settings.free_delivery) {
      db.settings.free_delivery = { enabled: false, mode: 'threshold', min_order: 500, company_id: '', note: '', note_en: '', until: null };
      changed = true;
    }
    if (!db.settings.store_sale) {
      db.settings.store_sale = { enabled: false, percent: 10, label: 'تخفيضات المتجر', label_en: 'Store sale' };
      changed = true;
    }
    /* Merchandising flags for databases created before they existed. */
    (db.products || []).forEach(function (p) {
      if (typeof p.featured !== 'boolean') { p.featured = (Number(p.rating) || 0) >= 4.9; changed = true; }
      if (typeof p.best_seller !== 'boolean') { p.best_seller = (Number(p.sold) || 0) >= 250; changed = true; }
      if (p.review_count == null) { p.review_count = 0; changed = true; }
    });
    var before = (db.chats || []).map(function (c) { return c.id; }).join('|');
    ensureChats(db);
    var after = (db.chats || []).map(function (c) { return c.id; }).join('|');
    if (ensureDeliveryTeams(db)) changed = true;
    if (migrateOrderLifecycle(db)) changed = true;
    if (before !== after || changed) save(db);
    if (migrateSecurity(db) || ensureInvoiceLinks(db)) save(db);
    return db;
  }

  /* ───────────────────── SECURITY MIGRATIONS ─────────────────────
     Passwords are never kept in plain text. Legacy demo databases are
     upgraded in place: every `password` becomes a salted SHA-256 hash. */
  function migrateSecurity(db) {
    if (!db || !Array.isArray(db.users) || !DS.security) return false;
    var changed = false;
    db.users.forEach(function (u) {
      if (!u) return;
      if (typeof u.password === 'string' && u.password) {
        if (!u.password_hash) u.password_hash = DS.security.hashPassword(u.password);
        delete u.password;
        changed = true;
      } else if (Object.prototype.hasOwnProperty.call(u, 'password')) {
        delete u.password;
        changed = true;
      }
    });
    return changed;
  }

  /* Strict delivery lifecycle — upgrades legacy statuses in place:
     confirmed → preparing, delivering → out_for_delivery.
     A live rider task must have a real sub-driver, otherwise it goes back
     to «handed to company» so the owner can assign one. */
  function migrateOrderLifecycle(db) {
    if (!db || !Array.isArray(db.orders)) return false;
    db.migrations = db.migrations || {};
    var changed = false;
    var LEGACY = { confirmed: 'preparing', delivering: 'out_for_delivery' };
    var KNOWN = ['pending', 'preparing', 'handed_to_company', 'out_for_delivery', 'delivered', 'cancelled'];
    db.orders.forEach(function (o) {
      if (!o) return;
      if (LEGACY[o.status]) { o.status = LEGACY[o.status]; changed = true; }
      if (KNOWN.indexOf(o.status) === -1) { o.status = 'pending'; changed = true; }
      (o.timeline || []).forEach(function (ev) {
        if (ev && LEGACY[ev.status]) { ev.status = LEGACY[ev.status]; changed = true; }
      });
      if (o.status === 'out_for_delivery') {
        var rider = o.driver_id ? db.users.filter(function (u) { return u.id === o.driver_id && isDeliveryRole(u) && !isCompanyOwner(u); })[0] : null;
        if (!rider && o.delivery_company_id) {
          rider = db.users.filter(function (u) {
            return isDeliveryRole(u) && !isCompanyOwner(u) && u.is_active !== false && u.delivery_company === o.delivery_company_id;
          })[0] || null;
          if (rider) { o.driver_id = rider.id; o.driver_name = rider.name; changed = true; }
        }
        if (!rider) { o.status = 'handed_to_company'; changed = true; }
      }
    });
    if (!db.migrations.strictOrderLifecycle) { db.migrations.strictOrderLifecycle = true; changed = true; }
    return changed;
  }

  /* B2B delivery teams — make sure company owners keep their owner flag,
     Talqa has two demo sub-drivers, and active Talqa tasks are dispatched
     between them so the rider dashboard is never empty on a legacy install. */
  function ensureDeliveryTeams(db) {
    if (!db || !Array.isArray(db.users)) return false;
    var changed = false;
    var driverSeeds = [
      { id: 'u-del-talqa-ahmed', username: 'ahmed', password: 'ahmed2026', name: 'أحمد', name_en: 'Ahmed', phone: '01011110001', avatar_id: 'av1' },
      { id: 'u-del-talqa-mostafa', username: 'mostafa', password: 'mostafa2026', name: 'مصطفى', name_en: 'Mostafa', phone: '01011110002', avatar_id: 'av2' }
    ];
    var talqa = db.users.filter(function (u) { return u.username === 'talqa'; })[0];
    if (talqa) {
      if (talqa.company_owner !== true) { talqa.company_owner = true; changed = true; }
      if (talqa.company_id !== 'dc-talqa') { talqa.company_id = 'dc-talqa'; changed = true; }
      if (typeof talqa.online !== 'boolean') { talqa.online = true; changed = true; }
    }
    driverSeeds.forEach(function (seed) {
      if (db.users.some(function (u) { return u.id === seed.id || u.username === seed.username; })) return;
      var hash = null;
      try { hash = DS.security && DS.security.hashPassword ? DS.security.hashPassword(seed.password) : null; } catch (e) {}
      db.users.push({
        id: seed.id, username: seed.username, role: 'driver',
        name: seed.name, name_en: seed.name_en, phone: seed.phone,
        delivery_company: 'dc-talqa', company_id: 'dc-talqa', delivery_company_name: 'طلقة',
        parent_id: 'u-del-talqa', company_owner: false,
        avatar_id: seed.avatar_id, is_active: true, online: true,
        created_at: nowISO(), password_hash: hash
      });
      changed = true;
    });
    /* Caznova in-house rider — seeded once for legacy installs. */
    db.migrations = db.migrations || {};
    if (!db.migrations.caznovaInHouseDriver) {
      if (!db.users.some(function (u) { return u.id === 'u-del-caznova' || u.username === 'caznova_driver'; })) {
        var caznovaHash = null;
        try { caznovaHash = DS.security && DS.security.hashPassword ? DS.security.hashPassword('caznova_driver2026') : null; } catch (e) {}
        db.users.push({
          id: 'u-del-caznova', username: 'caznova_driver', role: 'delivery',
          name: 'مندوب كازنوفا', name_en: 'Caznova Driver', phone: '01000000011',
          tenant_id: 't-caznova', company_id: 'in_house', delivery_company: null,
          delivery_company_name: 'توصيل المحل (داخلي)',
          avatar_id: 'av4', is_active: true, online: true,
          created_at: nowISO(), password_hash: caznovaHash
        });
      }
      db.migrations.caznovaInHouseDriver = true;
      changed = true;
    }
    /* Normalise company ids on every delivery account. */
    db.users.forEach(function (u) {
      if (!u || (u.role !== 'delivery' && u.role !== 'driver')) return;
      if (u.delivery_company && u.company_id !== u.delivery_company) { u.company_id = u.delivery_company; changed = true; }
      if (typeof u.online !== 'boolean' && u.is_active !== false) { u.online = true; changed = true; }
    });
    /* One-time dispatch so a legacy Talqa install has live rider tasks. */
    db.migrations = db.migrations || {};
    if (!db.migrations.b2bDeliveryTeams) {
      var riders = db.users.filter(function (u) { return u.role === 'driver' && u.delivery_company === 'dc-talqa'; });
      if (riders.length) {
        var idx = 0;
        (db.orders || []).forEach(function (o) {
          if (!o || o.delivery_company_id !== 'dc-talqa') return;
          if (['pending', 'preparing', 'handed_to_company', 'out_for_delivery', 'delivering'].indexOf(o.status) === -1) return;
          if (o.driver_id && o.driver_id !== 'u-del-talqa') return;
          var rider = riders[idx % riders.length]; idx++;
          o.driver_id = rider.id;
          o.driver_name = rider.name;
          changed = true;
        });
      }
      db.migrations.b2bDeliveryTeams = true;
      changed = true;
    }
    return changed;
  }

  /* Older demo databases shipped invoices without an order link, which
     made the printed receipt show empty customer / store details. */
  function ensureInvoiceLinks(db) {
    if (!db || !Array.isArray(db.invoices) || !Array.isArray(db.orders)) return false;
    var changed = false;
    db.invoices.forEach(function (inv) {
      if (!inv) return;
      var order = null;
      if (inv.order_id) order = db.orders.filter(function (o) { return o.id === inv.order_id; })[0];
      if (!order && inv.order_no) order = db.orders.filter(function (o) { return o.order_no === inv.order_no; })[0];
      if (!order) {
        order = db.orders.filter(function (o) {
          return o.tenant_id === inv.tenant_id && Number(o.total) === Number(inv.total);
        })[0];
      }
      if (!order) return;
      if (!inv.order_id) { inv.order_id = order.id; changed = true; }
      if (!inv.order_no) { inv.order_no = order.order_no; changed = true; }
      if (!inv.customer && order.customer) { inv.customer = order.customer; changed = true; }
      if (inv.delivery_fee == null && order.delivery_fee != null) { inv.delivery_fee = order.delivery_fee; changed = true; }
      if (!inv.created_at) { inv.created_at = order.created_at; changed = true; }
    });
    return changed;
  }

  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); }
    catch (e) { console.warn('[DS] storage write failed', e); }
  }

  var DB = load();

  function commit() {
    save(DB);
    try { window.dispatchEvent(new CustomEvent('ds:data', { detail: { at: Date.now() } })); } catch (e) {}
  }

  /* ───────────────────────────── AUTH ───────────────────────────── */
  /* Demo aliases requested by the Apple 2026 login (keep the real DB usernames). */
  var LOGIN_ALIASES = {
    owner: 'caznova',
    cashier: 'ca_cashier',
    delivery: 'talqa',
    customer: 'customer',
    subadmin: 'dina',
    admin: 'admin',
    caznova: 'caznova',
    smozy: 'smozy',
    dina: 'dina'
  };

  function login(username, password) {
    var entered = String(username || '').trim().toLowerCase();
    var aliasPassword = null;
    var canonical = LOGIN_ALIASES[entered];
    if (canonical) {
      aliasPassword = entered + '2026';
      username = canonical;
    } else {
      username = entered;
    }
    var user = DB.users.filter(function (u) { return String(u.username).toLowerCase() === username; })[0];
    if (!user) return { ok: false, error: 'invalid' };
    /* Passwords are salted hashes; legacy plaintext values still validate. */
    var stored = user.password_hash || user.password;
    var ok = DS.security ? DS.security.verifyPassword(password, stored) : String(password) === String(stored);
    if (!ok && aliasPassword && DS.security) ok = DS.security.verifyPassword(aliasPassword, stored);
    if (!ok) return { ok: false, error: 'invalid' };
    if (user.is_active === false) return { ok: false, error: 'suspended' };
    if (user.tenant_id && (user.role === 'owner' || user.role === 'cashier')) {
      var tn = tenantById(user.tenant_id);
      if (tn && tn.status === 'suspended') return { ok: false, error: 'store_suspended' };
    }
    var clean = Object.assign({}, user);
    delete clean.password;
    delete clean.password_hash;
    try {
      localStorage.setItem('cz_session', clean.id);
      localStorage.setItem('cz_user', JSON.stringify(clean));
      localStorage.setItem('cz_role', clean.role);
      localStorage.setItem('cz_mock', '1');
      if (clean.role === 'subadmin') localStorage.setItem('ds_permissions', JSON.stringify(clean.permissions || []));
      if (clean.role === 'owner' && clean.tenant_id) localStorage.setItem('ds_customer_store', clean.tenant_id);
      if (clean.role === 'customer' && clean.tenant_id) localStorage.setItem('ds_customer_store', clean.tenant_id);
    } catch (e) {}
    audit('تسجيل دخول · ' + (clean.name || username), 'Signed in · ' + (clean.name || username), 'shield', clean);
    return { ok: true, user: clean, redirect: DS.roleHome(clean) };
  }

  /* ───────────────────────────── QUERIES ───────────────────────────── */
  function tenantById(id) { return DB.tenants.filter(function (t) { return t.id === id; })[0] || null; }
  function tenantBySlug(slug) { return DB.tenants.filter(function (t) { return t.slug === slug || t.id === slug; })[0] || null; }

  /* ─────────────────────── Store business hours ───────────────────────
     Each tenant carries openTime / closeTime ("HH:MM"). Windows crossing
     midnight (e.g. 18:00 → 02:00) are supported, and equal times mean the
     store is open 24 hours.                                        */
  function parseHM(value) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(value == null ? '' : value).trim());
    if (!m) return null;
    var h = Number(m[1]), mi = Number(m[2]);
    if (h > 24 || mi > 59 || h < 0 || mi < 0) return null;
    return h * 60 + mi;
  }
  function storeHours(tn) {
    tn = tn || {};
    return { open: tn.openTime || '10:00', close: tn.closeTime || '22:00' };
  }
  function isStoreOpen(tn, when) {
    if (!tn || tn.status === 'suspended' || tn.offline === true) return false;
    var hours = storeHours(tn);
    var open = parseHM(hours.open), close = parseHM(hours.close);
    if (open == null || close == null) return true;
    if (open === close) return true;
    if (open === 0 && close >= 1440) return true;             /* 00:00 → 24:00 */
    var now = when ? new Date(when) : new Date();
    var mins = now.getHours() * 60 + now.getMinutes();
    if (close > open) return mins >= open && mins < close;
    return mins >= open || mins < close;                      /* crosses midnight */
  }
  function nextOpenLabel(tn) {
    var hours = storeHours(tn);
    return hours.open;
  }
  function userByUsername(name) { return DB.users.filter(function (u) { return u.username === name; })[0] || null; }
  function userById(id) { return DB.users.filter(function (u) { return u.id === id; })[0] || null; }

  function isAdmin(user) { return !!user && (user.role === 'superadmin' || user.role === 'subadmin'); }
  function isSuperAdmin(user) { return !!user && user.role === 'superadmin'; }

  function currentStoreId(user) {
    user = user || DS.session();
    if (user && (user.role === 'owner' || user.role === 'cashier') && user.tenant_id) return user.tenant_id;
    var stored = DS.store.get('ds_customer_store', null);
    if (stored && tenantById(stored)) return stored;
    return (user && user.tenant_id) || (DB.tenants[0] && DB.tenants[0].id);
  }

  function canAccessTenant(user, tenantId) {
    if (!user) return false;
    if (isAdmin(user)) return true;
    if (isDeliveryRole(user)) return true;
    return user.tenant_id === tenantId || (user.role === 'customer' && currentStoreId(user) === tenantId);
  }

  function visibleProducts(user, tenantId) {
    user = user || DS.session();
    if (!user) return [];
    if (isDeliveryRole(user)) return [];
    if (isAdmin(user)) {
      return tenantId ? DB.products.filter(function (p) { return p.tenant_id === tenantId; }) : DB.products.slice();
    }
    var tid = tenantId || currentStoreId(user);
    return DB.products.filter(function (p) { return p.tenant_id === tid; });
  }

  /* Multi-vendor orders carry a vendor_ids[] list while keeping a legacy
     tenant_id (the first vendor) for older screens. */
  function orderHasTenant(order, tenantId) {
    if (!order || !tenantId) return false;
    if (order.tenant_id === tenantId) return true;
    return Array.isArray(order.vendor_ids) && order.vendor_ids.indexOf(tenantId) > -1;
  }

  function visibleOrders(user) {
    user = user || DS.session();
    if (!user) return [];
    if (isAdmin(user)) {
      if (user.role === 'subadmin' && user.permissions && user.permissions.indexOf('orders') === -1) return [];
      return DB.orders.slice();
    }
    if (isDeliveryRole(user)) {
      /* B2B sub-driver: created by a delivery company → only sees the orders
         assigned to him. Company owners see their whole company queue. */
      if (isSubDriver(user)) {
        return DB.orders.filter(function (o) { return o.driver_id && o.driver_id === user.id; });
      }
      /* Store-managed driver: only that store's orders. */
      if (user.tenant_id) {
        return DB.orders.filter(function (o) {
          return orderHasTenant(o, user.tenant_id) || (o.driver_id && o.driver_id === user.id);
        });
      }
      return DB.orders.filter(function (o) {
        if (o.driver_id && o.driver_id === user.id) return true;
        return !!(user.delivery_company && o.delivery_company_id === user.delivery_company);
      });
    }
    if (user.role === 'customer') {
      return DB.orders.filter(function (o) { return (o.customer && o.customer.phone === user.phone) || o.customer_id === user.id; });
    }
    return DB.orders.filter(function (o) { return orderHasTenant(o, user.tenant_id); });
  }

  function visibleInvoices(user) {
    user = user || DS.session();
    if (!user) return [];
    if (isAdmin(user)) return DB.invoices.slice();
    if (user.role === 'delivery' || user.role === 'driver' || user.role === 'customer') return [];
    return DB.invoices.filter(function (i) { return i.tenant_id === user.tenant_id; });
  }

  function ordersByTenant(tenantId) { return DB.orders.filter(function (o) { return orderHasTenant(o, tenantId); }); }
  function productsByTenant(tenantId) { return DB.products.filter(function (p) { return p.tenant_id === tenantId; }); }

  function customers() {
    var map = {};
    DB.orders.forEach(function (o) {
      if (!o.customer || !o.customer.phone) return;
      var key = o.customer.phone;
      if (!map[key]) {
        map[key] = { id: 'c-' + key, name: o.customer.name, name_en: o.customer.name_en || o.customer.name, phone: key, address: o.customer.address, address_en: o.customer.address_en || o.customer.address, city: o.customer.city, city_en: o.customer.city_en || o.customer.city, lat: o.customer.lat, lng: o.customer.lng, tenant_ids: [], orders: 0, spent: 0, last_order: o.created_at, first_order: o.created_at };
      }
      if (map[key].tenant_ids.indexOf(o.tenant_id) === -1) map[key].tenant_ids.push(o.tenant_id);
      map[key].orders++;
      map[key].spent += Number(o.total) || 0;
      if (new Date(o.created_at) > new Date(map[key].last_order)) map[key].last_order = o.created_at;
      if (new Date(o.created_at) < new Date(map[key].first_order)) map[key].first_order = o.created_at;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.spent - a.spent; });
  }

  function customersFor(user) {
    var all = customers();
    if (!user || isAdmin(user)) return all;
    if (isDeliveryRole(user)) return all;
    return all.filter(function (c) { return c.tenant_ids.indexOf(user.tenant_id) > -1; });
  }

  /* ─────────── PRO MAX · CUSTOMER LIFETIME VALUE (CRM) ───────────
     Total spend per customer, average basket and the top 10% "Diamond"
     tier. Pure read-model: it never mutates orders or users. */
  function customerLifetime(tenantId) {
    var base = customers();
    if (tenantId) base = base.filter(function (c) { return c.tenant_ids.indexOf(tenantId) > -1; });
    var ranked = base.slice().sort(function (a, b) { return b.spent - a.spent; });
    var vipCount = ranked.length ? Math.max(1, Math.ceil(ranked.length * 0.1)) : 0;
    var cutoff = vipCount ? Number(ranked[vipCount - 1].spent) || 0 : 0;
    base.forEach(function (c) {
      c.ltv = Number(c.spent) || 0;
      c.avg = c.orders ? c.ltv / c.orders : 0;
      c.vip = vipCount > 0 && c.ltv > 0 && c.ltv >= cutoff;
    });
    var total = base.reduce(function (s, c) { return s + c.ltv; }, 0);
    return {
      customers: base.slice().sort(function (a, b) { return b.ltv - a.ltv; }),
      vipCount: vipCount,
      cutoff: cutoff,
      count: base.length,
      total: total,
      avg: base.length ? total / base.length : 0
    };
  }

  /* ─────────── PRO MAX · SMART INVENTORY FORECASTING ───────────
     A product's daily velocity is measured from real order lines in the
     last 14 days. When the remaining stock covers 3 days or less we
     surface a restock alert with a suggested purchase quantity. */
  function inventoryForecast(tenantId, opts) {
    opts = opts || {};
    var windowDays = Math.max(1, Number(opts.days) || 14);
    var horizon = Math.max(1, Number(opts.horizon) || 3);
    var since = Date.now() - windowDays * 86400000;
    var list = tenantId ? productsByTenant(tenantId) : DB.products.slice();
    var out = [];
    list.forEach(function (p) {
      var units = 0;
      DB.orders.forEach(function (o) {
        if (o.status === 'cancelled') return;
        if (tenantId && !orderHasTenant(o, tenantId)) return;
        if (new Date(o.created_at).getTime() < since) return;
        (o.items || []).forEach(function (it) {
          if (it.product_id === p.id) units += Number(it.qty) || 0;
        });
      });
      var velocity = units / windowDays;
      var stock = Number(p.stock) || 0;
      if (!(velocity > 0)) return;
      var daysLeft = stock / velocity;
      if (daysLeft > horizon) return;
      var target = Math.max(14, Math.ceil(velocity * 21));
      var suggested = Math.max(10, Math.ceil(Math.max(0, target - stock) / 10) * 10);
      out.push({
        id: p.id,
        name: p.name,
        name_en: p.name_en || p.name,
        image: p.image,
        stock: stock,
        velocity: Math.round(velocity * 100) / 100,
        units: units,
        days_left: Math.max(1, Math.round(daysLeft)),
        suggested: suggested
      });
    });
    return out.sort(function (a, b) { return a.days_left - b.days_left; });
  }

  /* ───────────────────────────── STATS ───────────────────────────── */
  function sum(arr, key) { return arr.reduce(function (s, x) { return s + (Number(x[key]) || 0); }, 0); }

  function revenueOf(orders) { return sum(orders.filter(function (o) { return o.status === 'delivered'; }), 'total'); }

  function statsFor(tenantId) {
    var orders = tenantId ? ordersByTenant(tenantId) : DB.orders.slice();
    var delivered = orders.filter(function (o) { return o.status === 'delivered'; });
    var active = orders.filter(function (o) { return ['pending', 'preparing', 'handed_to_company', 'out_for_delivery'].indexOf(o.status) > -1; });
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var todayOrders = orders.filter(function (o) { return new Date(o.created_at) >= today; });
    var revenue = revenueOf(orders);
    var cost = 0;
    delivered.forEach(function (o) { o.items.forEach(function (it) { var p = DB.products.filter(function (x) { return x.id === it.product_id; })[0]; cost += (p ? p.cost : it.price * 0.55) * it.qty; }); });
    var monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    var monthOrders = orders.filter(function (o) { return new Date(o.created_at) >= monthStart; });
    return {
      revenue: revenue,
      profit: Math.max(0, revenue - cost),
      orders: orders.length,
      delivered: delivered.length,
      active: active.length,
      pending: orders.filter(function (o) { return o.status === 'pending'; }).length,
      preparing: orders.filter(function (o) { return o.status === 'preparing'; }).length,
      handedToCompany: orders.filter(function (o) { return o.status === 'handed_to_company'; }).length,
      outForDelivery: orders.filter(function (o) { return o.status === 'out_for_delivery'; }).length,
      delivering: orders.filter(function (o) { return o.status === 'out_for_delivery'; }).length,
      cancelled: orders.filter(function (o) { return o.status === 'cancelled'; }).length,
      todayOrders: todayOrders.length,
      todayRevenue: revenueOf(todayOrders),
      monthRevenue: revenueOf(monthOrders),
      monthOrders: monthOrders.length,
      avgOrder: delivered.length ? revenue / delivered.length : 0,
      customers: customers().length,
      products: (tenantId ? productsByTenant(tenantId) : DB.products).length,
      lowStock: (tenantId ? productsByTenant(tenantId) : DB.products).filter(function (p) { return p.stock <= p.min_stock; }).length
    };
  }

  function platformStats() {
    var s = statsFor(null);
    s.tenants = DB.tenants.length;
    s.activeTenants = DB.tenants.filter(function (t) { return t.status === 'active'; }).length;
    s.users = DB.users.length;
    s.mrr = DB.tenants.reduce(function (sum2, t) { return sum2 + (t.plan === 'monthly' ? 299 : t.plan === 'sixmonths' ? 249.8 : 208.25); }, 0);
    s.arr = s.mrr * 12;
    return s;
  }

  function series(days, tenantId) {
    days = days || 7;
    var out = [];
    for (var i = days - 1; i >= 0; i--) {
      var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      var next = new Date(d); next.setDate(next.getDate() + 1);
      var orders = DB.orders.filter(function (o) {
        var t = new Date(o.created_at);
        return t >= d && t < next && o.status !== 'cancelled' && (!tenantId || o.tenant_id === tenantId);
      });
      out.push({ date: d.toISOString(), label: d.toLocaleDateString(DS.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { weekday: 'short' }), value: revenueOf(orders), orders: orders.length });
    }
    return out;
  }

  function categoryBreakdown(tenantId) {
    var orders = tenantId ? ordersByTenant(tenantId) : DB.orders;
    var map = {};
    orders.filter(function (o) { return o.status !== 'cancelled'; }).forEach(function (o) {
      o.items.forEach(function (it) {
        var p = DB.products.filter(function (x) { return x.id === it.product_id; })[0];
        var cat = p ? p.category : 'أخرى';
        var catEn = p ? (p.category_en || p.category) : 'Other';
        if (!map[cat]) map[cat] = { value: 0, name_en: catEn };
        map[cat].value += it.price * it.qty;
      });
    });
    return Object.keys(map).map(function (k) { return { name: k, name_en: map[k].name_en || k, value: map[k].value }; }).sort(function (a, b) { return b.value - a.value; });
  }

  function topProducts(tenantId, limit) {
    var orders = tenantId ? ordersByTenant(tenantId) : DB.orders;
    var map = {};
    orders.filter(function (o) { return o.status !== 'cancelled'; }).forEach(function (o) {
      o.items.forEach(function (it) {
        if (!map[it.product_id]) map[it.product_id] = { id: it.product_id, name: it.name, name_en: it.name_en, image: it.image, qty: 0, revenue: 0 };
        map[it.product_id].qty += it.qty;
        map[it.product_id].revenue += it.price * it.qty;
      });
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, limit || 5);
  }

  /* ───────────────────────────── MUTATIONS ───────────────────────────── */
  function audit(action, actionEn, icon, user) {
    user = user || DS.session() || {};
    DB.audit_logs.unshift({
      id: DS.uid('log'),
      actor: user.name || 'System',
      role: user.role || 'system',
      action: action,
      action_en: actionEn || action,
      icon: icon || 'activity',
      at: nowISO()
    });
    if (DB.audit_logs.length > 200) DB.audit_logs.length = 200;
    commit();
  }

  function saveUser(patch) {
    if (!patch || !patch.id) return null;
    var idx = DB.users.findIndex(function (u) { return u.id === patch.id; });
    if (idx === -1) return null;
    var next = Object.assign({}, DB.users[idx], patch);
    if (Object.prototype.hasOwnProperty.call(patch, 'password')) {
      if (patch.password) next.password_hash = DS.security.hashPassword(String(patch.password));
      delete next.password;
    }
    DB.users[idx] = next;
    commit();
    return DB.users[idx];
  }

  function saveTenant(patch) {
    if (!patch || !patch.id) return null;
    var idx = DB.tenants.findIndex(function (t) { return t.id === patch.id; });
    if (idx === -1) return null;
    DB.tenants[idx] = Object.assign({}, DB.tenants[idx], patch);
    commit();
    return DB.tenants[idx];
  }

  function addUser(data) {
    var clean = Object.assign({}, data);
    if (clean.password) {
      clean.password_hash = DS.security.hashPassword(String(clean.password));
      delete clean.password;
    }
    var user = Object.assign({ id: DS.uid('u'), is_active: true, created_at: nowISO(), avatar_id: 'av1' }, clean);
    DB.users.push(user);
    audit('أضاف مستخدم «' + user.name + '»', 'Added user “' + user.name + '”', 'user');
    commit();
    return user;
  }

  function deleteUser(id) {
    var user = userById(id);
    if (!user) return false;
    var me = DS.session();
    if (me && me.id === id) return false;                       /* never delete yourself */
    if (user.role === 'superadmin') {
      var supers = DB.users.filter(function (u) { return u.role === 'superadmin'; });
      if (supers.length <= 1) return false;                     /* keep at least one super admin */
    }
    DB.users = DB.users.filter(function (u) { return u.id !== id; });
    audit('حذف مستخدم «' + user.name + '»', 'Deleted user “' + (user.name_en || user.name) + '”', 'trash');
    commit();
    return true;
  }

  /* Clone a user with a brand-new id + username, same data and role. */
  function duplicateUser(id) {
    var src = userById(id);
    if (!src) return null;
    var base = String(src.username || 'user') + '_copy';
    var username = base, n = 2;
    while (DB.users.some(function (u) { return u.username === username; })) {
      username = base + n; n++;
    }
    var copy = Object.assign({}, src, {
      id: DS.uid('u'),
      username: username,
      name: src.name + ' (نسخة)',
      name_en: (src.name_en || src.name) + ' (Copy)',
      is_active: true,
      created_at: nowISO()
    });
    delete copy.permissions_override;
    if (src.email) copy.email = String(src.email).replace('@', '+copy@');
    DB.users.push(copy);
    audit('نسخ مستخدم «' + src.name + '»', 'Duplicated user “' + (src.name_en || src.name) + '”', 'copy');
    commit();
    return copy;
  }

  function setUserActive(id, active) {
    var user = userById(id);
    if (!user) return null;
    user.is_active = !!active;
    audit((active ? 'تفعيل' : 'إيقاف') + ' مستخدم «' + user.name + '»', (active ? 'Activated' : 'Suspended') + ' user “' + (user.name_en || user.name) + '”', 'shield');
    commit();
    return user;
  }

  /* ───────────────────── Subscription management ───────────────────── */
  function manageSubscription(tenantId, patch) {
    var tn = tenantById(tenantId);
    if (!tn) return null;
    patch = patch || {};
    var changed = [];

    if (patch.plan && PLANS.some(function (p) { return p.id === patch.plan; })) {
      if (tn.plan !== patch.plan) { tn.plan = patch.plan; changed.push('plan'); }
    }
    if (patch.extendDays) {
      var base = new Date(tn.subscription_end).getTime();
      if (isNaN(base)) base = Date.now();
      tn.subscription_end = new Date(base + Number(patch.extendDays) * 86400000).toISOString();
      changed.push('end');
    }
    if (patch.end) {
      var d = new Date(patch.end);
      if (!isNaN(d.getTime())) {
        /* Plain dates pick the end of that day so "active" never flips early. */
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(patch.end))) d.setHours(23, 59, 59, 999);
        tn.subscription_end = d.toISOString();
        changed.push('end');
      }
    }
    if (patch.status && ['active', 'suspended', 'expired'].indexOf(patch.status) > -1) {
      if (tn.status !== patch.status) { tn.status = patch.status; changed.push('status'); }
    }
    if (patch.recordPayment) {
      DB.payments.unshift({
        id: DS.uid('pay'), tenant_id: tn.id, plan: tn.plan,
        amount: patch.amount != null ? Number(patch.amount) : (PLANS.filter(function (p) { return p.id === tn.plan; })[0] || PLANS[0]).price,
        method: 'manual', status: 'paid', at: nowISO()
      });
      changed.push('payment');
    }
    if (changed.length) {
      audit(
        'تحديث اشتراك «' + tn.name + '» (' + changed.join(' · ') + ')',
        'Updated subscription of “' + (tn.name_en || tn.name) + '” (' + changed.join(' · ') + ')',
        'card'
      );
      commit();
    }
    return tn;
  }

  function setTenantStatus(tenantId, status) {
    var tn = tenantById(tenantId);
    if (!tn) return null;
    tn.status = status;
    audit((status === 'active' ? 'تفعيل متجر ' : 'إيقاف متجر ') + tn.name, (status === 'active' ? 'Activated ' : 'Suspended ') + (tn.name_en || tn.name), 'store');
    commit();
    return tn;
  }

  /* Owner-controlled "accept orders" switch. `offline: true` closes the store
     immediately — the storefront disables its products and checkout blocks the
     order until it is switched back on. */
  function setStoreOffline(tenantId, offline) {
    var tn = tenantById(tenantId);
    if (!tn) return null;
    tn.offline = !!offline;
    audit(
      (offline ? 'إيقاف استقبال طلبات ' : 'استئناف استقبال طلبات ') + tn.name,
      (offline ? 'Paused orders for ' : 'Resumed orders for ') + (tn.name_en || tn.name),
      'store'
    );
    commit();
    return tn;
  }

  function addProduct(data) {
    var product = Object.assign({
      id: DS.uid('p'),
      barcode: data.barcode || ('628' + String(Date.now()).slice(-9)),
      is_active: true, rating: 4.8, sold: 0, created_at: nowISO(), updated_at: nowISO(), min_stock: 5
    }, data);
    DB.products.push(product);
    audit('أضاف منتج «' + product.name + '»', 'Added product “' + (product.name_en || product.name) + '”', 'box');
    commit();
    return product;
  }

  function updateProduct(id, patch) {
    var idx = DB.products.findIndex(function (p) { return p.id === id; });
    if (idx === -1) return null;
    DB.products[idx] = Object.assign({}, DB.products[idx], patch, { updated_at: nowISO() });
    audit('حدّث منتج «' + DB.products[idx].name + '»', 'Updated product “' + (DB.products[idx].name_en || DB.products[idx].name) + '”', 'edit');
    commit();
    return DB.products[idx];
  }

  function deleteProduct(id) {
    var p = DB.products.filter(function (x) { return x.id === id; })[0];
    if (!p) return false;
    DB.products = DB.products.filter(function (x) { return x.id !== id; });
    audit('حذف منتج «' + p.name + '»', 'Deleted product “' + (p.name_en || p.name) + '”', 'trash');
    commit();
    return true;
  }

  function nextOrderNo() {
    var nums = DB.orders.map(function (o) { return parseInt(String(o.order_no).replace(/\D/g, ''), 10) || 1000; });
    var max = nums.length ? Math.max.apply(null, nums) : 1000;
    return 'ORD-' + (max + 1);
  }

  function createOrder(data) {
    var orderNo = nextOrderNo();
    var now = nowISO();
    var order = Object.assign({
      id: DS.uid('ord'),
      order_no: orderNo,
      status: 'pending',
      source: 'store',
      payment_method: 'cash',
      notes: '',
      created_at: now,
      updated_at: now,
      timeline: [{ status: 'pending', at: now, label: 'تم إنشاء الطلب' }],
      proof: null
    }, data);
    order.order_no = orderNo;
    DB.orders.unshift(order);
    /* Keep stock truthful: every ordered unit leaves inventory. */
    (order.items || []).forEach(function (it) {
      var p = DB.products.filter(function (x) { return x.id === it.product_id; })[0];
      if (!p) return;
      p.stock = Math.max(0, (Number(p.stock) || 0) - (Number(it.qty) || 0));
      p.sold = (Number(p.sold) || 0) + (Number(it.qty) || 0);
      p.updated_at = now;
    });
    audit('طلب جديد ' + orderNo + ' بقيمة ' + order.total, 'New order ' + orderNo + ' for ' + order.total, 'receipt');
    commit();
    return order;
  }

  /* Strict pipeline — an order can only move one step forward and every
     step belongs to exactly one side of the hand-off:
     pending → preparing (store) → handed_to_company (store stops here)
     → out_for_delivery (delivery company / rider) → delivered (rider only). */
  var NEXT_STATUS = { pending: 'preparing', confirmed: 'preparing', preparing: 'handed_to_company', handed_to_company: 'out_for_delivery', out_for_delivery: 'delivered' };
  function canTransition(from, to) {
    if (to === 'cancelled') return ['pending', 'preparing', 'handed_to_company'].indexOf(from) > -1;
    return NEXT_STATUS[from] === to;
  }

  /* Role-aware permission check used by both the UI and the data layer. */
  function canTransitionForUser(user, order, to) {
    user = user || DS.session();
    order = order || {};
    if (!user || !order) return false;
    var admin = isAdmin(user);
    var storeSide = (user.role === 'owner' || user.role === 'cashier') && !!user.tenant_id && orderHasTenant(order, user.tenant_id);
    var rider = isRider(user);
    var companyOwner = isCompanyOwner(user);
    /* Nobody, not even the assigned rider, may skip a lifecycle step. */
    if (order.status && order.status !== to && !canTransition(order.status, to)) return false;
    if (to === 'cancelled') return admin || storeSide;
    if (to === 'preparing') return admin || storeSide;
    if (to === 'handed_to_company') return admin || storeSide;
    if (to === 'out_for_delivery') {
      if (!order.driver_id) return false;
      if (admin) return true;
      if (companyOwner) return order.delivery_company_id === user.delivery_company;
      return rider && order.driver_id === user.id;
    }
    /* Delivered is exclusive to the assigned rider — never the store, never
       the delivery company owner, never an admin override. */
    if (to === 'delivered') return rider && !!order.driver_id && order.driver_id === user.id;
    return false;
  }

  /* Admin edit: discount, notes and status in one save. Status still uses the
     strict pipeline; a direct jump is rejected instead of silently corrupting
     the order. */
  function updateOrder(id, patch) {
    var order = DB.orders.filter(function (o) { return o.id === id; })[0];
    if (!order) return null;
    patch = patch || {};
    if (patch.status && patch.status !== order.status) {
      if (!canTransition(order.status, patch.status)) return null;
      var moved = updateOrderStatus(id, patch.status, {});
      if (!moved) return null;
    }
    var sub = Number(order.subtotal) || (order.items || []).reduce(function (s, it) { return s + (Number(it.price) || 0) * (Number(it.qty) || 0); }, 0);
    var disc = patch.discount != null ? Math.max(0, Math.min(sub, Number(patch.discount) || 0)) : Number(order.discount) || 0;
    var fee = patch.delivery_fee != null ? Math.max(0, Number(patch.delivery_fee) || 0) : Number(order.delivery_fee) || 0;
    order.subtotal = sub;
    order.discount = disc;
    order.delivery_fee = fee;
    order.total = Math.max(0, sub - disc + fee);
    if (patch.notes != null) order.notes = String(patch.notes).slice(0, 500);
    order.updated_at = nowISO();
    audit('تعديل الطلب ' + order.order_no, 'Edited order ' + order.order_no, 'edit');
    commit();
    return order;
  }

  function updateOrderStatus(id, status, meta) {
    var order = DB.orders.filter(function (o) { return o.id === id; })[0];
    if (!order) return null;
    meta = meta || {};
    var previous = order.status;
    if (previous === status) return order;
    if (!canTransition(previous, status)) {
      console.warn('[DS] refused status jump ' + previous + ' → ' + status);
      return null;
    }
    var actor = meta.actor || DS.session();
    if (actor && !canTransitionForUser(actor, order, status)) {
      console.warn('[DS] role is not allowed to move ' + order.order_no + ' to ' + status);
      return null;
    }
    var proofUrl = meta.proof && (typeof meta.proof === 'string' ? meta.proof : meta.proof.url);
    if (status === 'delivered' && !proofUrl && !meta.force) {
      console.warn('[DS] delivery proof photo is required');
      return null;
    }
    order.status = status;
    order.updated_at = nowISO();
    if (proofUrl) order.proof = { url: proofUrl, at: nowISO(), by: (DS.session() || {}).name || 'Delivery' };
    if (meta.company_id) { order.delivery_company_id = meta.company_id; order.delivery_company_name = meta.company_name || order.delivery_company_name; }
    if (meta.driver_id) order.driver_id = meta.driver_id;
    if (meta.driver_name) order.driver_name = meta.driver_name;
    /* Cancelling returns the units to inventory (once). */
    if (status === 'cancelled' && previous !== 'cancelled') {
      (order.items || []).forEach(function (it) {
        var p = DB.products.filter(function (x) { return x.id === it.product_id; })[0];
        if (!p) return;
        p.stock = (Number(p.stock) || 0) + (Number(it.qty) || 0);
        p.sold = Math.max(0, (Number(p.sold) || 0) - (Number(it.qty) || 0));
        p.updated_at = nowISO();
      });
    }
    var labels = { pending: 'تم إنشاء الطلب', confirmed: 'تم تأكيد الطلب', preparing: 'جاري تجهيز الطلب', handed_to_company: 'تم التسليم لشركة التوصيل', out_for_delivery: 'المندوب في الطريق', delivering: 'المندوب في الطريق', delivered: 'تم تسليم الطلب', cancelled: 'تم إلغاء الطلب' };
    if (!order.timeline) order.timeline = [];
    var last = order.timeline[order.timeline.length - 1];
    if (!last || last.status !== status) order.timeline.push({ status: status, at: nowISO(), label: labels[status] || status });
    audit('تحديث الطلب ' + order.order_no + ' إلى «' + (labels[status] || status) + '»', 'Order ' + order.order_no + ' → ' + status, 'orders');
    commit();
    /* Smart web push: any open page can react to the new status. The shell
       notification bridge listens for this event and paints a native
       browser notification for the matching customer. */
    try {
      window.dispatchEvent(new CustomEvent('ds:order-status', {
        detail: {
          order_id: order.id,
          order_no: order.order_no,
          status: status,
          previous: previous,
          label: labels[status] || status,
          customer_id: order.customer_id,
          customer_phone: order.customer && order.customer.phone,
          customer_name: order.customer && order.customer.name,
          tenant_id: order.tenant_id
        }
      }));
    } catch (e) {}
    return order;
  }

  /* B2B dispatch — the delivery company owner assigns one of the company's
     active sub-drivers once the store has handed the order over. A rider can
     still transfer his own task to a teammate while it is on the way. */
  function assignOrder(id, driverId) {
    var order = DB.orders.filter(function (o) { return o.id === id; })[0];
    var driver = userById(driverId);
    var actor = DS.session();
    if (!order || !isRider(driver) || driver.is_active === false) return null;
    if (!isSubDriver(driver) && !driver.tenant_id) return null;
    if (order.delivery_company_id && driver.delivery_company && order.delivery_company_id !== driver.delivery_company) return null;
    if (actor) {
      var allowed = isAdmin(actor)
        || (isCompanyOwner(actor) && actor.delivery_company === driver.delivery_company)
        || (isRider(actor) && order.driver_id === actor.id);
      if (!allowed) return null;
      if (!isAdmin(actor) && ['handed_to_company', 'out_for_delivery'].indexOf(order.status) === -1) return null;
    }
    order.driver_id = driver.id;
    order.driver_name = driver.name;
    order.delivery_company_id = driver.delivery_company || order.delivery_company_id;
    order.delivery_company_name = driver.delivery_company_name || order.delivery_company_name;
    order.updated_at = nowISO();
    audit('إسناد الطلب ' + order.order_no + ' إلى «' + driver.name + '»', 'Assigned ' + order.order_no + ' to “' + (driver.name_en || driver.name) + '”', 'bike');
    commit();
    return order;
  }

  function unassignOrder(id) {
    var order = DB.orders.filter(function (o) { return o.id === id; })[0];
    if (!order) return null;
    order.driver_id = null;
    order.driver_name = null;
    order.updated_at = nowISO();
    audit('إلغاء إسناد الطلب ' + order.order_no, 'Unassigned ' + order.order_no, 'bike');
    commit();
    return order;
  }

  function addInvoice(data) {
    var invoice = Object.assign({ id: DS.uid('inv'), invoice_no: 'INV-' + Math.floor(3000 + Math.random() * 6000), created_at: nowISO() }, data);
    DB.invoices.unshift(invoice);
    /* Inventory already left the shelf when the order was created. Only a
       standalone invoice (no linked order) adjusts stock here — otherwise a
       POS sale would deduct every unit twice. */
    if (!invoice.order_id) {
      (invoice.items || []).forEach(function (it) {
        var p = DB.products.filter(function (x) { return x.id === it.product_id; })[0];
        if (!p) return;
        p.stock = Math.max(0, (Number(p.stock) || 0) - (Number(it.qty) || 0));
        p.sold = (Number(p.sold) || 0) + (Number(it.qty) || 0);
        p.updated_at = nowISO();
      });
    }
    audit('فاتورة ' + invoice.invoice_no + ' بقيمة ' + invoice.total, 'Invoice ' + invoice.invoice_no + ' for ' + invoice.total, 'receipt');
    commit();
    return invoice;
  }

  function saveCompany(data) {
    if (data.id) {
      var idx = DB.delivery_companies.findIndex(function (c) { return c.id === data.id; });
      if (idx > -1) DB.delivery_companies[idx] = Object.assign({}, DB.delivery_companies[idx], data);
    } else {
      data.id = DS.uid('dc');
      DB.delivery_companies.push(Object.assign({ emoji: '🛵', rating: 4.5, completed: 0, avg_time: 30, status: 'active', fee: 30, created_at: nowISO() }, data));
    }
    audit('حفظ شركة توصيل «' + data.name + '»', 'Saved delivery company “' + data.name + '”', 'truck');
    commit();
    return data;
  }

  function saveJob(data) {
    if (data.id) {
      var idx = DB.jobs.findIndex(function (j) { return j.id === data.id; });
      if (idx > -1) DB.jobs[idx] = Object.assign({}, DB.jobs[idx], data);
    } else {
      data.id = DS.uid('job');
      data.created_at = nowISO();
      data.active = true;
      data.requirements = data.requirements || [];
      DB.jobs.unshift(data);
    }
    audit('حفظ وظيفة «' + data.title + '»', 'Saved job “' + data.title + '”', 'jobs');
    commit();
    return data;
  }

  function applyJob(jobId, form) {
    var app = Object.assign({ id: DS.uid('app'), job_id: jobId, at: nowISO(), status: 'new' }, form);
    DB.applications.unshift(app);
    audit('طلب توظيف جديد · ' + (form.name || ''), 'New job application · ' + (form.name || ''), 'jobs');
    commit();
    return app;
  }

  /* ─────────────── 1-on-1 directory (support · stores · delivery) ───────────────
     Every scope lists real peers; picking one focuses that direct thread.
     There is no group / general room any more.                                 */

  var ROLE_LABELS = {
    superadmin: ['إدارة المنصة', 'Platform admin'],
    subadmin: ['فريق الدعم', 'Support team'],
    owner: ['صاحب متجر', 'Store owner'],
    cashier: ['كاشير', 'Cashier'],
    delivery: ['مندوب توصيل', 'Delivery rider'],
    driver: ['مندوب توصيل', 'Delivery rider'],
    customer: ['عميل', 'Customer']
  };

  function roleLabel(user, en) {
    var pair = ROLE_LABELS[user && user.role] || ['مستخدم', 'User'];
    return en ? pair[1] : pair[0];
  }

  function chatCanScope(user, scope) {
    if (!user) return false;
    if (scope === 'support') return true;
    if (scope === 'driver') return true;
    if (scope === 'team') return isDeliveryStaff(user);
    if (scope === 'stores') return !isDeliveryRole(user);
    if (scope === 'delivery') return ['customer', 'owner', 'cashier', 'delivery', 'driver', 'subadmin', 'superadmin'].indexOf(user.role) > -1;
    return false;
  }

  function chatPeerFor(scope, peerId) {
    if (scope === 'driver') return userById(peerId);
    if (scope === 'team') return userById(peerId);
    if (scope === 'support') return userById(peerId);
    /* Store / company peers may be the entity (customer view) or a person
       (the business team's view); resolve whichever exists. */
    if (scope === 'stores') return tenantById(peerId) || userById(peerId);
    if (scope === 'delivery') {
      return (DB.delivery_companies || []).filter(function (c) { return c.id === peerId; })[0] || userById(peerId);
    }
    return null;
  }

  function chatRoomIdFor(scope, peerId, user) {
    user = user || DS.session();
    if (!user) return null;
    if (scope === 'support') return supportRoomId(user.id, peerId);
    if (scope === 'driver') return driverRoomId(user.id, peerId);
    if (scope === 'team') return teamRoomId(user.id, peerId);
    if (scope === 'stores') {
      var pair = storePair(user, peerId);
      return storeRoomId(pair.tenantId, pair.personId);
    }
    if (scope === 'delivery') {
      var dpair = deliveryPair(user, peerId);
      return deliveryRoomId(dpair.companyId, dpair.personId);
    }
    return null;
  }

  function lastAt(room) {
    var msgs = (room && room.messages) || [];
    return msgs.length ? (msgs[msgs.length - 1].at || '') : '';
  }

  /* Contact list the UI renders for a scope. */
  function chatContacts(user, scope) {
    user = user || DS.session();
    if (!user || !chatCanScope(user, scope)) return [];
    var en = DS.lang() === 'en';
    var out = [];

    if (scope === 'support') {
      var pool;
      if (isAdmin(user)) {
        pool = DB.users.filter(function (u) {
          return u.id !== user.id && u.is_active !== false;
        });
      } else {
        var roomPeers = DB.chats.filter(function (r) {
          return r.scope === 'support' && Array.isArray(r.users) && r.users.indexOf(user.id) > -1;
        }).reduce(function (acc, r) {
          r.users.forEach(function (id) { if (id !== user.id) acc.push(id); });
          return acc;
        }, []);
        pool = DB.users.filter(function (u) {
          if (u.id === user.id || u.is_active === false) return false;
          if (u.role === 'superadmin' || u.role === 'subadmin') return true;
          return roomPeers.indexOf(u.id) > -1;
        });
      }
      pool.forEach(function (u) {
        out.push({
          key: u.id, type: 'user', id: u.id,
          roomId: supportRoomId(user.id, u.id),
          name: u.name, name_en: u.name_en || u.name,
          avatar_id: u.avatar_id, avatar: null,
          subtitle: roleLabel(u, false), subtitle_en: roleLabel(u, true),
          tone: 'lime'
        });
      });
      out.sort(function (a, b) {
        var rank = { superadmin: 0, subadmin: 1, owner: 2, cashier: 3, delivery: 4, customer: 5 };
        var ua = userById(a.id), ub = userById(b.id);
        var ra = rank[ua && ua.role]; var rb = rank[ub && ub.role];
        if (ra == null) ra = 9; if (rb == null) rb = 9;
        return ra - rb || String(en ? a.name_en : a.name).localeCompare(String(en ? b.name_en : b.name));
      });
      return out;
    }

    if (scope === 'stores') {
      /* Store staff answer the people who wrote to them — never a shared inbox. */
      if (isStoreStaff(user)) {
        DB.chats.filter(function (r) {
          return r && r.scope === 'stores' && r.peer_id === user.tenant_id && r.person_id;
        }).forEach(function (room) {
          var person = userById(room.person_id);
          if (!person || person.id === user.id || person.is_active === false) return;
          out.push({
            key: person.id, type: 'user', id: person.id,
            roomId: room.id,
            name: person.name, name_en: person.name_en || person.name,
            avatar_id: person.avatar_id, avatar: null,
            subtitle: roleLabel(person, false), subtitle_en: roleLabel(person, true),
            tone: 'blue', last_at: lastAt(room)
          });
        });
        out.sort(function (a, b) { return (b.last_at || '').localeCompare(a.last_at || '') || String(a.name).localeCompare(String(b.name)); });
        return out;
      }

      var tenants = DB.tenants.filter(function (t) { return true; });
      tenants.forEach(function (t) {
        out.push({
          key: t.id, type: 'tenant', id: t.id,
          roomId: storeRoomId(t.id, user.id),
          name: t.name, name_en: t.name_en || t.name,
          avatar_id: t.avatar_id, avatar: null, entity: t,
          subtitle: DS.lang() === 'en' ? (t.industry_en || t.industry) : (t.industry || t.industry_en),
          subtitle_en: t.industry_en || t.industry || '',
          tone: 'blue'
        });
      });
      return out;
    }

    if (scope === 'delivery') {
      /* Riders answer the people who wrote to their company. */
      if (isDeliveryStaff(user)) {
        DB.chats.filter(function (r) {
          return r && r.scope === 'delivery' && r.peer_id === user.delivery_company && r.person_id;
        }).forEach(function (room) {
          var person = userById(room.person_id);
          if (!person || person.id === user.id || person.is_active === false) return;
          out.push({
            key: person.id, type: 'user', id: person.id,
            roomId: room.id,
            name: person.name, name_en: person.name_en || person.name,
            avatar_id: person.avatar_id, avatar: null,
            subtitle: roleLabel(person, false), subtitle_en: roleLabel(person, true),
            tone: 'teal', last_at: lastAt(room)
          });
        });
        out.sort(function (a, b) { return (b.last_at || '').localeCompare(a.last_at || '') || String(a.name).localeCompare(String(b.name)); });
        return out;
      }

      (DB.delivery_companies || []).forEach(function (c) {
        out.push({
          key: c.id, type: 'company', id: c.id,
          roomId: deliveryRoomId(c.id, user.id),
          name: c.name, name_en: c.name_en || c.name,
          avatar_id: null, avatar: null, entity: c,
          subtitle: (c.avg_time || 30) + (en ? ' min avg' : ' دقيقة متوسط'),
          subtitle_en: (c.avg_time || 30) + ' min avg',
          tone: 'teal'
        });
      });
      return out;
    }
    if (scope === 'driver') {
      /* Customer ↔ rider threads: each side sees the other participant. */
      DB.chats.filter(function (r) {
        return r && r.scope === 'driver' && Array.isArray(r.users) && r.users.indexOf(user.id) > -1;
      }).forEach(function (room) {
        var other = room.users.filter(function (id) { return id !== user.id; })[0];
        var person = userById(other);
        if (!person || person.is_active === false) return;
        out.push({
          key: person.id, type: 'user', id: person.id,
          roomId: room.id,
          name: person.name, name_en: person.name_en || person.name,
          avatar_id: person.avatar_id, avatar: null,
          subtitle: isDeliveryRole(person) ? 'مندوب التوصيل' : 'عميل',
          subtitle_en: isDeliveryRole(person) ? 'Delivery rider' : 'Customer',
          tone: 'orange', last_at: lastAt(room)
        });
      });
      out.sort(function (a, b) { return (b.last_at || '').localeCompare(a.last_at || '') || String(a.name).localeCompare(String(b.name)); });
      return out;
    }
    if (scope === 'team') {
      /* Delivery company internal team: owner ↔ riders, rider ↔ owner/mates. */
      var teamPeers = companyDrivers(user.delivery_company).filter(function (u) {
        if (!isRider(u) || u.id === user.id) return false;
        if (isCompanyOwner(user)) return true;
        return isCompanyOwner(u) || isSubDriver(u);
      });
      teamPeers.forEach(function (u) {
        var room = DB.chats.filter(function (r) { return r && r.id === teamRoomId(user.id, u.id); })[0];
        out.push({
          key: u.id, type: 'user', id: u.id,
          roomId: teamRoomId(user.id, u.id),
          name: u.name, name_en: u.name_en || u.name,
          avatar_id: u.avatar_id, avatar: null,
          subtitle: isCompanyOwner(u) ? (en ? 'Company owner' : 'صاحب الشركة') : (en ? 'Delivery rider' : 'مندوب توصيل'),
          subtitle_en: isCompanyOwner(u) ? 'Company owner' : 'Delivery rider',
          tone: 'teal', last_at: lastAt(room)
        });
      });
      out.sort(function (a, b) { return (b.last_at || '').localeCompare(a.last_at || '') || String(a.name).localeCompare(String(b.name)); });
      return out;
    }
    return out;
  }

  /* Get (or lazily create) the direct room for a scope + peer. */
  function chatRoom(user, scope, peerId, create) {
    user = user || DS.session();
    if (!user || !chatCanScope(user, scope) || !peerId) return null;
    var roomId = chatRoomIdFor(scope, peerId, user);
    var room = DB.chats.filter(function (c) { return c.id === roomId; })[0];
    if (room || !create) return room || null;

    if (scope === 'stores') {
      var pair = storePair(user, peerId);
      var tn = tenantById(pair.tenantId);
      var person = userById(pair.personId);
      if (!tn || !person) return null;
      room = {
        id: roomId, scope: 'stores', peer_type: 'tenant',
        peer_id: tn.id, tenant_id: tn.id, person_id: person.id,
        users: [person.id, 'tenant-' + tn.id].sort(),
        title: tn.name, title_en: tn.name_en || tn.name, messages: []
      };
    } else if (scope === 'support') {
      var peer = userById(peerId);
      if (!peer) return null;
      room = {
        id: roomId, scope: 'support', peer_type: 'user',
        users: [user.id, String(peerId)].sort(),
        title: 'دعم · ' + (peer.name || ''), title_en: 'Support · ' + (peer.name_en || peer.name || ''),
        messages: []
      };
    } else if (scope === 'driver') {
      var driver = userById(peerId);
      if (!driver) return null;
      room = {
        id: roomId, scope: 'driver', peer_type: 'user',
        peer_id: driver.id, users: [user.id, driver.id].sort(),
        title: 'المندوب · ' + (driver.name || ''), title_en: 'Rider · ' + (driver.name_en || driver.name || ''),
        messages: []
      };
    } else if (scope === 'team') {
      var mate = userById(peerId);
      if (!mate || !isDeliveryStaff(user) || mate.delivery_company !== user.delivery_company) return null;
      room = {
        id: roomId, scope: 'team', peer_type: 'user',
        peer_id: mate.id, users: [user.id, mate.id].sort(),
        title: (mate.name || ''), title_en: (mate.name_en || mate.name || ''), messages: []
      };
    } else if (scope === 'delivery') {
      var dpair = deliveryPair(user, peerId);
      var company = (DB.delivery_companies || []).filter(function (c) { return c.id === dpair.companyId; })[0];
      var dperson = userById(dpair.personId);
      if (!company || !dperson) return null;
      room = {
        id: roomId, scope: 'delivery', peer_type: 'company',
        peer_id: company.id, person_id: dperson.id,
        users: [dperson.id, 'company-' + company.id].sort(),
        title: company.name, title_en: company.name_en || company.name, messages: []
      };
    }
    if (!room) return null;
    DB.chats.push(room);
    commit();
    return room;
  }

  function chatThread(user, scope, peerId) {
    return chatRoom(user, scope, peerId, false);
  }

  function sendMessageTo(scope, peerId, text) {
    var user = DS.session();
    text = String(text == null ? '' : text).trim();
    if (!user || !text) return null;
    if (isPeerBlocked(scope, peerId, user)) return { blocked: true };
    var room = chatRoom(user, scope, peerId, true);
    if (!room) return null;
    var msg = {
      id: DS.uid('msg'), user_id: user.id, name: user.name, name_en: user.name_en,
      role: user.role, text: text.slice(0, 2000), at: nowISO()
    };
    room.messages.push(msg);
    commit();
    return msg;
  }

  /* Keep the legacy room-id send path working for the dock / future callers. */
  function sendMessage(roomId, text) {
    var user = DS.session();
    if (!user || !text) return null;
    var room = DB.chats.filter(function (c) { return c.id === roomId; })[0];
    if (!room) return null;
    if (!roomVisible(user, room)) return null;
    var msg = { id: DS.uid('msg'), user_id: user.id, name: user.name, name_en: user.name_en, role: user.role, text: String(text).slice(0, 2000), at: nowISO() };
    room.messages.push(msg);
    commit();
    return msg;
  }

  function roomVisible(user, room) {
    if (!user || !room) return false;
    var scope = room.scope;
    if (scope === 'driver') {
      return Array.isArray(room.users) && room.users.indexOf(user.id) > -1;
    }
    if (scope === 'support') {
      if (isAdmin(user) && user.role === 'superadmin') return true;
      return Array.isArray(room.users) && room.users.indexOf(user.id) > -1;
    }
    if (scope === 'stores') {
      if (Array.isArray(room.users) && room.users.indexOf(user.id) > -1) return true;
      if (isStoreStaff(user) && room.peer_id === user.tenant_id) return true;
      return user.role === 'superadmin';
    }
    if (scope === 'delivery') {
      if (Array.isArray(room.users) && room.users.indexOf(user.id) > -1) return true;
      if (isDeliveryStaff(user) && room.peer_id === user.delivery_company) return true;
      return user.role === 'superadmin';
    }
    return false;
  }

  function roomsFor(user) {
    user = user || DS.session();
    return DB.chats.filter(function (r) { return roomVisible(user, r); });
  }

  function roomsForScope(user, scope) {
    user = user || DS.session();
    return roomsFor(user).filter(function (r) { return r.scope === scope; });
  }

  /* ─────────────────────── Blocking & reporting ─────────────────────── */
  function blockKey(scope, peerId) { return String(scope) + ':' + String(peerId); }

  function isPeerBlocked(scope, peerId, user) {
    user = user || DS.session();
    if (!user) return false;
    return (DB.chat_blocks || []).some(function (b) {
      return b.user_id === user.id && blockKey(b.scope, b.peer_id) === blockKey(scope, peerId);
    });
  }

  function blockedPeers(user) {
    user = user || DS.session();
    if (!user) return [];
    return (DB.chat_blocks || []).filter(function (b) { return b.user_id === user.id; });
  }

  function togglePeerBlock(scope, peerId, user) {
    user = user || DS.session();
    if (!user) return false;
    if (!Array.isArray(DB.chat_blocks)) DB.chat_blocks = [];
    var idx = DB.chat_blocks.findIndex(function (b) {
      return b.user_id === user.id && blockKey(b.scope, b.peer_id) === blockKey(scope, peerId);
    });
    if (idx > -1) {
      DB.chat_blocks.splice(idx, 1);
      commit();
      return false;
    }
    var peer = chatPeerFor(scope, peerId);
    DB.chat_blocks.push({
      id: DS.uid('block'), user_id: user.id, scope: scope, peer_id: peerId,
      peer_name: peer ? peer.name : String(peerId), at: nowISO()
    });
    audit('حظر محادثة «' + (peer ? peer.name : peerId) + '»', 'Blocked chat “' + (peer ? (peer.name_en || peer.name) : peerId) + '”', 'lock');
    commit();
    return true;
  }

  function reportPeer(scope, peerId, reason, user) {
    user = user || DS.session();
    if (!user) return null;
    if (!Array.isArray(DB.chat_reports)) DB.chat_reports = [];
    var peer = chatPeerFor(scope, peerId);
    var report = {
      id: DS.uid('report'), reporter_id: user.id,
      reporter_name: user.name, reporter_name_en: user.name_en,
      scope: scope, peer_id: peerId,
      peer_name: peer ? peer.name : String(peerId),
      reason: String(reason || '').slice(0, 500),
      status: 'open', at: nowISO()
    };
    DB.chat_reports.unshift(report);
    audit('بلاغ عن «' + report.peer_name + '»', 'Reported “' + (peer ? (peer.name_en || peer.name) : peerId) + '”', 'alert');
    commit();
    return report;
  }

  function saveSettings(patch) {
    DB.settings = Object.assign({}, DB.settings, patch);
    audit('تم تحديث إعدادات المنصة', 'Platform settings updated', 'settings');
    commit();
    return DB.settings;
  }

  function subscriptionPayload(planId, tenant) {
    var plan = PLANS.filter(function (p) { return p.id === planId; })[0] || PLANS[0];
    var name = tenant ? tenant.name : '';
    var text = 'مرحباً، أريد الاشتراك في ' + plan.name + ' لحساب ' + name;
    return {
      plan: plan,
      text: text,
      url: 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text)
    };
  }

  function activeSubscription(tenantId) {
    var tn = tenantById(tenantId);
    if (!tn) return null;
    var end = new Date(tn.subscription_end).getTime();
    return {
      plan: PLANS.filter(function (p) { return p.id === tn.plan; })[0] || PLANS[0],
      end: tn.subscription_end,
      daysLeft: Math.ceil((end - Date.now()) / 86400000),
      expired: end < Date.now()
    };
  }

  /* Notifications derived live from data */
  function notifications(user) {
    user = user || DS.session();
    var out = [];
    var en = DS.lang() === 'en';
    if (!user) return out;
    if (isAdmin(user)) {
      DB.orders.filter(function (o) { return o.status === 'pending'; }).slice(0, 4).forEach(function (o) {
        out.push({ icon: 'receipt', title: (en ? 'New order ' : 'طلب جديد ') + o.order_no, text: DS.loc(o.customer, 'name') + ' · ' + DS.money(o.total), at: o.created_at, href: 'admin/orders.html' });
      });
      DB.tenants.filter(function (t) { var d = Math.ceil((new Date(t.subscription_end) - Date.now()) / 86400000); return d <= 15; }).forEach(function (t) {
        out.push({ icon: 'card', title: (en ? t.name + ' subscription expires soon' : 'اشتراك ' + t.name + ' ينتهي قريباً'), text: (en ? Math.max(0, Math.ceil((new Date(t.subscription_end) - Date.now()) / 86400000)) + ' days left' : 'متبقي ' + Math.max(0, Math.ceil((new Date(t.subscription_end) - Date.now()) / 86400000)) + ' يوم'), at: nowISO(), href: 'admin/subscriptions.html' });
      });
    } else if (user.role === 'owner') {
      DB.orders.filter(function (o) { return orderHasTenant(o, user.tenant_id) && (o.status === 'pending' || o.status === 'preparing'); }).slice(0, 4).forEach(function (o) {
        out.push({ icon: 'receipt', title: (en ? 'Order ' : 'طلب ') + o.order_no + ' · ' + tStatus(o.status), text: DS.loc(o.customer, 'name') + ' · ' + DS.money(o.total), at: o.created_at, href: 'owner/orders.html' });
      });
      var prods = productsByTenant(user.tenant_id).filter(function (p) { return p.stock <= p.min_stock; });
      if (prods.length) out.push({ icon: 'box', title: en ? 'Low stock' : 'مخزون منخفض', text: en ? prods.length + ' products need restocking' : prods.length + ' منتجات تحتاج إعادة تخزين', at: nowISO(), href: 'owner/products.html' });
    } else if (isDeliveryRole(user)) {
      var feed = isSubDriver(user)
        ? DB.orders.filter(function (o) { return o.driver_id === user.id; })
        : DB.orders.filter(function (o) { return o.delivery_company_id === user.delivery_company; });
      feed.filter(function (o) { return ['handed_to_company', 'out_for_delivery'].indexOf(o.status) > -1; }).slice(0, 4).forEach(function (o) {
        out.push({ icon: 'truck', title: (en ? 'Delivery ' : 'توصيل ') + o.order_no, text: DS.loc(o.customer, 'address'), at: o.created_at, href: 'delivery/orders.html' });
      });
    } else if (user.role === 'customer') {
      DB.orders.filter(function (o) { return o.customer && o.customer.phone === user.phone; }).slice(0, 3).forEach(function (o) {
        out.push({ icon: 'package', title: (en ? 'Your order ' : 'طلبك ') + o.order_no, text: tStatus(o.status), at: o.updated_at, href: 'customer/tracking.html' });
      });
    }
    return out.sort(function (a, b) { return new Date(b.at) - new Date(a.at); }).slice(0, 8);
  }

  /* Assigned rider for an order (used by "Chat with driver"). Only the rider
     explicitly assigned by the delivery company is returned — never a guess. */
  function driverForOrder(order) {
    if (!order || !order.driver_id) return null;
    var byId = userById(order.driver_id);
    return isRider(byId) ? byId : null;
  }

  function customerUserForOrder(order) {
    if (!order) return null;
    if (order.customer_id) {
      var byId = userById(order.customer_id);
      if (byId && byId.role === 'customer') return byId;
    }
    var phone = order.customer && order.customer.phone;
    if (!phone) return null;
    return DB.users.filter(function (u) { return u.role === 'customer' && u.phone === phone; })[0] || null;
  }

  function monitorDriverRoom(order) {
    var driver = driverForOrder(order);
    var customer = customerUserForOrder(order);
    if (!driver || !customer) return null;
    return DB.chats.filter(function (c) { return c.id === driverRoomId(driver.id, customer.id); })[0] || null;
  }

  function tStatus(status) {
    var map = {
      pending: DS.t('pending'), confirmed: DS.t('preparing'), preparing: DS.t('preparing'),
      handed_to_company: DS.t('handed_to_company'), out_for_delivery: DS.t('out_for_delivery'),
      delivering: DS.t('out_for_delivery'), delivered: DS.t('delivered'), cancelled: DS.t('cancelled')
    };
    return map[status] || status;
  }

  /* ───────────────────────────── API ───────────────────────────── */
  /* CLEAN SLATE builder — kept for Settings → Reset demo database. */
  function cleanSlate() {
    var db = seed();
    /* Keep every default demo account, the 36-product catalogue, the four
       stores and the delivery companies. Wipe the noisy test data only. */
    var KEEP = ['admin', 'dina', 'amal', 'fatma', 'nada', 'basmala',
      'caznova', 'smozy', 'bnsheikh', 'mastore',
      'ca_cashier', 'sm_cashier', 'bn_cashier', 'ma_cashier', 'caznova_driver',
      'talqa', 'hala', 'ahla', 'customer', 'ahmed', 'mostafa'];
    db.users = (db.users || []).filter(function (u) { return KEEP.indexOf(u.username) > -1; });
    db.orders = [];
    db.sales = [];
    db.invoices = [];
    db.payments = [];
    db.applications = [];
    db.audit_logs = [];
    db.chats = [];
    db.reviews = [];
    /* Clear the merchandising counters that the test orders inflated. */
    (db.products || []).forEach(function (p) {
      p.sold = 0;
      p.review_count = 0;
      p.updated_at = nowISO();
    });
    db.created_at = nowISO();
    return db;
  }

  DS.data = {
    KEY: KEY,
    WHATSAPP: WHATSAPP,
    PLANS: PLANS,
    PERMISSIONS_ALL: PERMISSIONS_ALL,
    get db() { return DB; },
    get tenants() { return DB.tenants; },
    get users() { return DB.users; },
    get products() { return DB.products; },
    get orders() { return DB.orders; },
    get invoices() { return DB.invoices; },
    get companies() { return DB.delivery_companies; },
    get chats() { return DB.chats; },
    get jobs() { return DB.jobs; },
    get applications() { return DB.applications; },
    get auditLogs() { return DB.audit_logs; },
    get settings() { return DB.settings; },
    get payments() { return DB.payments; },
    login: login,
    logout: DS.logout,
    tenantById: tenantById,
    tenantBySlug: tenantBySlug,
    storeHours: storeHours,
    isStoreOpen: isStoreOpen,
    nextOpenLabel: nextOpenLabel,
    driverForOrder: driverForOrder,
    customerUserForOrder: customerUserForOrder,
    monitorDriverRoom: monitorDriverRoom,
    isDeliveryRole: isDeliveryRole,
    isCompanyOwner: isCompanyOwner,
    isSubDriver: isSubDriver,
    isRider: isRider,
    canTransitionForUser: canTransitionForUser,
    companyDrivers: companyDrivers,
    orderHasTenant: orderHasTenant,
    userById: userById,
    userByUsername: userByUsername,
    isAdmin: isAdmin,
    isSuperAdmin: isSuperAdmin,
    currentStoreId: currentStoreId,
    canAccessTenant: canAccessTenant,
    visibleProducts: visibleProducts,
    visibleOrders: visibleOrders,
    visibleInvoices: visibleInvoices,
    get discounts() { return DB.discounts || []; },
    findDiscount: findDiscount,
    validateDiscount: validateDiscount,
    addDiscount: addDiscount,
    saveDiscount: saveDiscount,
    deleteDiscount: deleteDiscount,
    consumeDiscount: consumeDiscount,
    get reviews() { return DB.reviews || []; },
    reviewsFor: reviewsFor,
    ratingFor: ratingFor,
    addReview: addReview,
    updateReview: updateReview,
    deleteReview: deleteReview,
    addressesFor: addressesFor,
    saveAddress: saveAddress,
    deleteAddress: deleteAddress,
    freeDelivery: freeDelivery,
    saveFreeDelivery: saveFreeDelivery,
    freeDeliveryFee: freeDeliveryFee,
    storeSale: storeSale,
    saveStoreSale: saveStoreSale,
    storeSaleAmount: storeSaleAmount,
    canTransition: canTransition,
    ordersByTenant: ordersByTenant,
    productsByTenant: productsByTenant,
    customers: customers,
    customersFor: customersFor,
    customerLifetime: customerLifetime,
    inventoryForecast: inventoryForecast,
    statsFor: statsFor,
    platformStats: platformStats,
    series: series,
    categoryBreakdown: categoryBreakdown,
    topProducts: topProducts,
    revenueOf: revenueOf,
    audit: audit,
    saveUser: saveUser,
    saveTenant: saveTenant,
    addUser: addUser,
    deleteUser: deleteUser,
    duplicateUser: duplicateUser,
    setUserActive: setUserActive,
    addProduct: addProduct,
    updateProduct: updateProduct,
    deleteProduct: deleteProduct,
    nextOrderNo: nextOrderNo,
    createOrder: createOrder,
    updateOrderStatus: updateOrderStatus,
    assignOrder: assignOrder,
    unassignOrder: unassignOrder,
    updateOrder: updateOrder,
    addInvoice: addInvoice,
    saveCompany: saveCompany,
    saveJob: saveJob,
    applyJob: applyJob,
    sendMessage: sendMessage,
    sendMessageTo: sendMessageTo,
    chatContacts: chatContacts,
    chatCanScope: chatCanScope,
    chatRoom: chatRoom,
    chatThread: chatThread,
    chatRoomIdFor: chatRoomIdFor,
    roomsFor: roomsFor,
    roomsForScope: roomsForScope,
    roomVisible: roomVisible,
    isPeerBlocked: isPeerBlocked,
    blockedPeers: blockedPeers,
    togglePeerBlock: togglePeerBlock,
    reportPeer: reportPeer,
    get chatBlocks() { return DB.chat_blocks || []; },
    get chatReports() { return DB.chat_reports || []; },
    manageSubscription: manageSubscription,
    setTenantStatus: setTenantStatus,
    setStoreOffline: setStoreOffline,
    saveSettings: saveSettings,
    subscriptionPayload: subscriptionPayload,
    activeSubscription: activeSubscription,
    notifications: notifications,
    statusLabel: tStatus,
    img: function (src) {
      if (!src) return DS.url('assets/product-placeholder.svg');
      if (/^(data:|https?:|blob:)/.test(src)) return src;
      return DS.url(src);
    },
    reset: function () {
      /* CLEAN SLATE — admin + caznova only, the 36 default products,
         and empty orders / chats / sales arrays. */
      try { localStorage.removeItem(KEY); } catch (e) {}
      try {
        if (DS.firebase && DS.firebase.clearRemoteData) DS.firebase.clearRemoteData();
      } catch (e) {}
      try { localStorage.removeItem('ds_cart'); localStorage.removeItem('ds_promo'); } catch (e) {}
      /* Pro Max local state: saved checkout identity, branch ledger,
         transfer log and notification opt-in/session flags. */
      try {
        localStorage.removeItem('ds_quick_customer');
        localStorage.removeItem('ds_notify_optin');
        sessionStorage.removeItem('ds_notify_seen');
        Object.keys(localStorage).forEach(function (k) {
          if (k.indexOf('ds_branch_stock_') === 0 || k.indexOf('ds_branch_transfers_') === 0 || k.indexOf('ds_branches_') === 0) localStorage.removeItem(k);
        });
      } catch (e) {}
      DB = cleanSlate();
      save(DB);
      location.reload();
    }
  };

  window.addEventListener('storage', function (e) {
    if (e.key === KEY) {
      DB = load();
      try { window.dispatchEvent(new CustomEvent('ds:data', { detail: { external: true } })); } catch (err) {}
    }
  });

  console.log('[DS] data ready ·', DB.tenants.length, 'tenants ·', DB.products.length, 'products ·', DB.orders.length, 'orders');
})();
