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
  var VERSION = 1;
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
  var PERMISSIONS_ALL = ['products', 'orders', 'customers', 'cashiers', 'delivery-companies', 'chats', 'jobs', 'reports', 'subscriptions', 'audit', 'settings', 'stores', 'sub-admins'];

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
    { id: 'u-cashier-smozy', username: 'sm_cashier', password: 'sm_cashier2026', role: 'cashier', name: 'كاشير Smozy', name_en: 'Smozy Cashier', tenant_id: 't-smozy', avatar_id: 'av6', is_active: true, created_at: daysAgo(190) },
    { id: 'u-cashier-bnsheikh', username: 'bn_cashier', password: 'bn_cashier2026', role: 'cashier', name: 'كاشير Bn Alsheikh', name_en: 'Bn Alsheikh Cashier', tenant_id: 't-bnsheikh', avatar_id: 'av7', is_active: true, created_at: daysAgo(180) },
    { id: 'u-cashier-mastore', username: 'ma_cashier', password: 'ma_cashier2026', role: 'cashier', name: 'كاشير MA Store', name_en: 'MA Store Cashier', tenant_id: 't-mastore', avatar_id: 'av8', is_active: true, created_at: daysAgo(170) },

    { id: 'u-del-talqa', username: 'talqa', password: 'talqa2026', role: 'delivery', name: 'طلقة', name_en: 'Talqa', delivery_company: 'dc-talqa', delivery_company_name: 'طلقة', avatar_id: 'av3', is_active: true, created_at: daysAgo(150) },
    { id: 'u-del-hala', username: 'hala', password: 'hala2026', role: 'delivery', name: 'حالا', name_en: 'Hala', delivery_company: 'dc-hala', delivery_company_name: 'حالا', avatar_id: 'av6', is_active: true, created_at: daysAgo(140) },
    { id: 'u-del-ahla', username: 'ahla', password: 'ahla2026', role: 'delivery', name: 'أهلا', name_en: 'Ahla', delivery_company: 'dc-ahla', delivery_company_name: 'أهلا', avatar_id: 'av9', is_active: true, created_at: daysAgo(130) },

    { id: 'u-customer', username: 'customer', password: 'customer2026', role: 'customer', name: 'ياسمين محمد', name_en: 'Yasmin Mohamed', tenant_id: 't-caznova', phone: '01123456789', city: 'القاهرة', city_en: 'Cairo', address: 'مدينة نصر · شارع مصطفى النحاس · عمارة 12', address_en: 'Nasr City · Mostafa El Nahas St. · Building 12', avatar_id: 'av5', is_active: true, created_at: daysAgo(90) }
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
      'delivering', 'delivering', 'delivering', 'delivering',
      'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered', 'delivered',
      'preparing', 'preparing', 'preparing', 'preparing',
      'confirmed', 'confirmed', 'confirmed', 'confirmed',
      'pending', 'pending', 'pending', 'pending',
      'cancelled', 'cancelled', 'cancelled',
      'delivered', 'delivered', 'delivering', 'preparing', 'pending'
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
      var company = status === 'delivering' || status === 'delivered' ? companies[i % companies.length] : null;
      var created;
      if (status === 'pending') created = hoursAgo(0.1 + i * 0.12);
      else if (status === 'confirmed') created = hoursAgo(0.7 + i * 0.1);
      else if (status === 'preparing') created = hoursAgo(0.5 + i * 0.08);
      else if (status === 'delivering') created = hoursAgo(0.5 + i * 0.09);
      else if (status === 'delivered') created = hoursAgo(4 + i * 3.2);
      else created = hoursAgo(30 + i * 4);
      var timeline = buildTimeline(status, created);
      var driver = company ? USERS.filter(function (u) { return u.role === 'delivery' && u.delivery_company === company.id; })[0] : null;
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
    var flow = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered'];
    var labels = { pending: 'تم إنشاء الطلب', confirmed: 'تم تأكيد الطلب', preparing: 'جاري تجهيز الطلب', delivering: 'المندوب في الطريق', delivered: 'تم تسليم الطلب', cancelled: 'تم إلغاء الطلب' };
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

  function buildInvoices(products) {
    var out = [];
    var methods = ['cash', 'card', 'vodafone'];
    TENANTS.forEach(function (tn, ti) {
      var tProducts = products.filter(function (p) { return p.tenant_id === tn.id; });
      for (var i = 0; i < 8; i++) {
        var p1 = tProducts[(i * 3) % tProducts.length];
        var p2 = tProducts[(i * 3 + 2) % tProducts.length];
        var q1 = 1 + (i % 3);
        var items = [{ product_id: p1.id, name: p1.name, image: p1.image, price: p1.price, qty: q1 }];
        if (i % 2 === 0) items.push({ product_id: p2.id, name: p2.name, image: p2.image, price: p2.price, qty: 1 });
        var total = items.reduce(function (s, it) { return s + it.price * it.qty; }, 0);
        out.push({
          id: 'inv-' + (2001 + ti * 20 + i),
          invoice_no: 'INV-' + (2001 + ti * 20 + i),
          tenant_id: tn.id,
          cashier_id: 'u-cashier-' + tn.slug,
          cashier_name: tn.name + ' Cashier',
          items: items,
          subtotal: total,
          discount: 0,
          total: total,
          method: methods[i % 3],
          created_at: hoursAgo(0.2 + i * 0.9)
        });
      }
    });
    return out;
  }

  /* ───────────────────────────── CHAT (1-ON-1) ─────────────────────────────
     Hierarchical inbox: support agents · stores · delivery companies.
     Every channel opens a focused direct conversation with the chosen peer.
     The old "General / عام" room is intentionally gone.                       */
  var CHAT_SCOPES = ['support', 'stores', 'delivery', 'driver'];

  function pairKey(a, b) { return [String(a), String(b)].sort().join('--'); }
  function supportRoomId(a, b) { return 'dm-support-' + pairKey(a, b); }
  /* Store threads are per person: a customer never shares a thread with
     another customer, while the whole store team answers the same thread. */
  function storeRoomId(tenantId, personId) { return 'dm-store-' + pairKey('tenant-' + tenantId, personId); }
  /* Delivery threads are per person too: two stores never share a company thread. */
  function deliveryRoomId(companyId, personId) { return 'dm-delivery-' + pairKey('company-' + companyId, personId); }
  /* Customer ↔ assigned rider: a private pair thread created from tracking. */
  function driverRoomId(a, b) { return 'dm-driver-' + pairKey(a, b); }
  function isStoreStaff(user) { return !!user && (user.role === 'owner' || user.role === 'cashier') && !!user.tenant_id; }
  function isDeliveryStaff(user) { return !!user && user.role === 'delivery' && !!user.delivery_company; }
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
      var driver = USERS.filter(function (u) { return u.role === 'delivery' && u.delivery_company === dc.id; })[0];
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
        return u.role === 'delivery' && u.delivery_company === companyId;
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

  function seed() {
    var products = buildProducts();
    var orders = buildOrders(products);
    var invoices = buildInvoices(products);
    var db = {
      version: VERSION,
      created_at: nowISO(),
      tenants: TENANTS,
      users: USERS,
      products: products,
      orders: orders,
      invoices: invoices,
      delivery_companies: DELIVERY_COMPANIES,
      chats: buildChats(),
      jobs: buildJobs(),
      applications: [],
      audit_logs: buildAudit(),
      payments: [
        { id: 'pay-1', tenant_id: 't-caznova', plan: 'yearly', amount: 2499, method: 'whatsapp', status: 'paid', at: daysAgo(120) },
        { id: 'pay-2', tenant_id: 't-smozy', plan: 'monthly', amount: 299, method: 'whatsapp', status: 'paid', at: daysAgo(20) },
        { id: 'pay-3', tenant_id: 't-bnsheikh', plan: 'sixmonths', amount: 1499, method: 'whatsapp', status: 'paid', at: daysAgo(80) },
        { id: 'pay-4', tenant_id: 't-mastore', plan: 'monthly', amount: 299, method: 'whatsapp', status: 'paid', at: daysAgo(12) }
      ],
      settings: {
        platform_name: 'DotStudio® POS',
        whatsapp: WHATSAPP,
        currency: 'EGP',
        support_email: 'hello@dotstudio.app',
        maintenance: false,
        allow_signups: true,
        default_delivery_fee: 30
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
    var before = (db.chats || []).map(function (c) { return c.id; }).join('|');
    ensureChats(db);
    var after = (db.chats || []).map(function (c) { return c.id; }).join('|');
    if (before !== after || changed) save(db);
    return db;
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
    if (!user || (user.password !== password && password !== aliasPassword)) return { ok: false, error: 'invalid' };
    if (user.is_active === false) return { ok: false, error: 'suspended' };
    if (user.tenant_id && (user.role === 'owner' || user.role === 'cashier')) {
      var tn = tenantById(user.tenant_id);
      if (tn && tn.status === 'suspended') return { ok: false, error: 'store_suspended' };
    }
    var clean = Object.assign({}, user);
    delete clean.password;
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
    if (user.role === 'delivery') return true;
    return user.tenant_id === tenantId || (user.role === 'customer' && currentStoreId(user) === tenantId);
  }

  function visibleProducts(user, tenantId) {
    user = user || DS.session();
    if (!user) return [];
    if (user.role === 'delivery') return [];
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
    if (user.role === 'delivery') {
      return DB.orders.filter(function (o) { return o.delivery_company_id === user.delivery_company; });
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
    if (user.role === 'delivery' || user.role === 'customer') return [];
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
    if (user.role === 'delivery') return all;
    return all.filter(function (c) { return c.tenant_ids.indexOf(user.tenant_id) > -1; });
  }

  /* ───────────────────────────── STATS ───────────────────────────── */
  function sum(arr, key) { return arr.reduce(function (s, x) { return s + (Number(x[key]) || 0); }, 0); }

  function revenueOf(orders) { return sum(orders.filter(function (o) { return o.status === 'delivered'; }), 'total'); }

  function statsFor(tenantId) {
    var orders = tenantId ? ordersByTenant(tenantId) : DB.orders.slice();
    var delivered = orders.filter(function (o) { return o.status === 'delivered'; });
    var active = orders.filter(function (o) { return ['pending', 'confirmed', 'preparing', 'delivering'].indexOf(o.status) > -1; });
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
      delivering: orders.filter(function (o) { return o.status === 'delivering'; }).length,
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
    DB.users[idx] = Object.assign({}, DB.users[idx], patch);
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
    var user = Object.assign({ id: DS.uid('u'), is_active: true, created_at: nowISO(), avatar_id: 'av1' }, data);
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

  function updateOrderStatus(id, status, meta) {
    var order = DB.orders.filter(function (o) { return o.id === id; })[0];
    if (!order) return null;
    meta = meta || {};
    var previous = order.status;
    order.status = status;
    order.updated_at = nowISO();
    if (meta.proof) order.proof = { url: meta.proof, at: nowISO(), by: (DS.session() || {}).name || 'Delivery' };
    if (meta.company_id) { order.delivery_company_id = meta.company_id; order.delivery_company_name = meta.company_name || order.delivery_company_name; }
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
    var labels = { pending: 'تم إنشاء الطلب', confirmed: 'تم تأكيد الطلب', preparing: 'جاري تجهيز الطلب', delivering: 'المندوب في الطريق', delivered: 'تم تسليم الطلب', cancelled: 'تم إلغاء الطلب' };
    if (!order.timeline) order.timeline = [];
    var last = order.timeline[order.timeline.length - 1];
    if (!last || last.status !== status) order.timeline.push({ status: status, at: nowISO(), label: labels[status] || status });
    audit('تحديث الطلب ' + order.order_no + ' إلى «' + (labels[status] || status) + '»', 'Order ' + order.order_no + ' → ' + status, 'orders');
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
    if (scope === 'stores') return user.role !== 'delivery';
    if (scope === 'delivery') return user.role !== 'customer';
    return false;
  }

  function chatPeerFor(scope, peerId) {
    if (scope === 'driver') return userById(peerId);
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
          subtitle: person.role === 'delivery' ? 'مندوب التوصيل' : 'عميل',
          subtitle_en: person.role === 'delivery' ? 'Delivery rider' : 'Customer',
          tone: 'orange', last_at: lastAt(room)
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
      DB.orders.filter(function (o) { return orderHasTenant(o, user.tenant_id) && (o.status === 'pending' || o.status === 'delivering'); }).slice(0, 4).forEach(function (o) {
        out.push({ icon: 'receipt', title: (en ? 'Order ' : 'طلب ') + o.order_no + ' · ' + tStatus(o.status), text: DS.loc(o.customer, 'name') + ' · ' + DS.money(o.total), at: o.created_at, href: 'owner/orders.html' });
      });
      var prods = productsByTenant(user.tenant_id).filter(function (p) { return p.stock <= p.min_stock; });
      if (prods.length) out.push({ icon: 'box', title: en ? 'Low stock' : 'مخزون منخفض', text: en ? prods.length + ' products need restocking' : prods.length + ' منتجات تحتاج إعادة تخزين', at: nowISO(), href: 'owner/products.html' });
    } else if (user.role === 'delivery') {
      DB.orders.filter(function (o) { return o.delivery_company_id === user.delivery_company && o.status === 'delivering'; }).slice(0, 4).forEach(function (o) {
        out.push({ icon: 'truck', title: (en ? 'Delivery ' : 'توصيل ') + o.order_no, text: DS.loc(o.customer, 'address'), at: o.created_at, href: 'delivery/orders.html' });
      });
    } else if (user.role === 'customer') {
      DB.orders.filter(function (o) { return o.customer && o.customer.phone === user.phone; }).slice(0, 3).forEach(function (o) {
        out.push({ icon: 'package', title: (en ? 'Your order ' : 'طلبك ') + o.order_no, text: tStatus(o.status), at: o.updated_at, href: 'customer/tracking.html' });
      });
    }
    return out.sort(function (a, b) { return new Date(b.at) - new Date(a.at); }).slice(0, 8);
  }

  /* Assigned rider for an order (used by "Chat with driver"). */
  function driverForOrder(order) {
    if (!order) return null;
    if (order.driver_id) {
      var byId = userById(order.driver_id);
      if (byId && byId.role === 'delivery') return byId;
    }
    if (order.delivery_company_id) {
      var rider = DB.users.filter(function (u) {
        return u.role === 'delivery' && u.delivery_company === order.delivery_company_id && u.is_active !== false;
      })[0];
      if (rider) return rider;
    }
    return DB.users.filter(function (u) { return u.role === 'delivery' && u.is_active !== false; })[0] || null;
  }

  function tStatus(status) {
    var map = {
      pending: DS.t('pending'), confirmed: DS.t('confirmed'), preparing: DS.t('preparing'),
      delivering: DS.t('delivering'), delivered: DS.t('delivered'), cancelled: DS.t('cancelled')
    };
    return map[status] || status;
  }

  /* ───────────────────────────── API ───────────────────────────── */
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
    ordersByTenant: ordersByTenant,
    productsByTenant: productsByTenant,
    customers: customers,
    customersFor: customersFor,
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
      try { localStorage.removeItem(KEY); } catch (e) {}
      DB = seed();
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
