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
      { name: 'إسوارة فضة مطلية', name_en: 'Silver-plated bracelet', category: 'اكسسوارات', category_en: 'Accessories', sku: 'CAZ-ACC-001', cost: 110, price: 320, stock: 24, min_stock: 5, image: 'products/1-caznova/1-caznova-bracelet.webp', rating: 4.7, sold: 118 },
      { name: 'عطر Oud Noir 50ml', name_en: 'Oud Noir perfume 50ml', category: 'عطور', category_en: 'Perfumes', sku: 'CAZ-PRF-002', cost: 300, price: 850, stock: 12, min_stock: 3, image: 'products/1-caznova/2-caznova-perfume.webp', rating: 4.9, sold: 86 },
      { name: 'محفظة جلد طبيعي', name_en: 'Genuine leather wallet', category: 'محافظ', category_en: 'Wallets', sku: 'CAZ-WLT-003', cost: 160, price: 450, stock: 18, min_stock: 4, image: 'products/1-caznova/3-caznova-wallet.webp', rating: 4.6, sold: 74 },
      { name: 'خاتم فضة رجالي', name_en: 'Men’s silver ring', category: 'خواتم', category_en: 'Rings', sku: 'CAZ-RNG-004', cost: 90, price: 280, stock: 30, min_stock: 6, image: 'products/1-caznova/4-caznova-ring.webp', rating: 4.8, sold: 203 },
      { name: 'ساعة يد كلاسيك', name_en: 'Classic wrist watch', category: 'ساعات', category_en: 'Watches', sku: 'CAZ-WCH-005', cost: 480, price: 1250, stock: 10, min_stock: 3, image: 'products/1-caznova/5-caznova-watch.webp', rating: 4.9, sold: 64 },
      { name: 'طقم هدايا فاخر', name_en: 'Premium gift set', category: 'هدايا', category_en: 'Gifts', sku: 'CAZ-GFT-006', cost: 380, price: 990, stock: 8, min_stock: 2, image: 'products/1-caznova/6-caznova-giftset.webp', rating: 5.0, sold: 41 },
      { name: 'نظارة شمس UV400', name_en: 'UV400 sunglasses', category: 'نظارات', category_en: 'Sunglasses', sku: 'CAZ-SUN-007', cost: 180, price: 520, stock: 15, min_stock: 4, image: 'products/1-caznova/7-caznova-sunglasses.webp', rating: 4.5, sold: 57 },
      { name: 'حزام جلد كلاسيك', name_en: 'Classic leather belt', category: 'أحزمة', category_en: 'Belts', sku: 'CAZ-BLT-008', cost: 120, price: 360, stock: 22, min_stock: 5, image: 'products/1-caznova/8-caznova-belt.webp', rating: 4.6, sold: 93 },
      { name: 'حقيبة جلد صغيرة', name_en: 'Small leather bag', category: 'حقائب', category_en: 'Bags', sku: 'CAZ-BAG-009', cost: 280, price: 780, stock: 9, min_stock: 2, image: 'products/1-caznova/CAZNOVA_9.webp', rating: 4.8, sold: 38 }
    ],
    't-smozy': [
      { name: 'عصير مانجو طازج', name_en: 'Fresh mango juice', category: 'عصائر', category_en: 'Juices', sku: 'SMZ-JUI-001', cost: 20, price: 45, stock: 40, min_stock: 10, image: 'products/2-smozy/1-smozy-mango.webp', rating: 4.9, sold: 340 },
      { name: 'عصير برتقال طازج', name_en: 'Fresh orange juice', category: 'عصائر', category_en: 'Juices', sku: 'SMZ-JUI-002', cost: 15, price: 35, stock: 45, min_stock: 10, image: 'products/2-smozy/2-smozy-orange.webp', rating: 4.8, sold: 412 },
      { name: 'عصير فراولة', name_en: 'Strawberry juice', category: 'عصائر', category_en: 'Juices', sku: 'SMZ-JUI-003', cost: 18, price: 40, stock: 38, min_stock: 8, image: 'products/2-smozy/3-smozy-strawberry.webp', rating: 4.7, sold: 286 },
      { name: 'سموذي كيوي', name_en: 'Kiwi smoothie', category: 'سموذي', category_en: 'Smoothies', sku: 'SMZ-SMT-004', cost: 25, price: 55, stock: 30, min_stock: 6, image: 'products/2-smozy/4-smozy-kiwi.webp', rating: 4.8, sold: 198 },
      { name: 'عصير موز باللبن', name_en: 'Banana milk juice', category: 'عصائر', category_en: 'Juices', sku: 'SMZ-JUI-005', cost: 22, price: 50, stock: 32, min_stock: 6, image: 'products/2-smozy/5-smozy-banana.webp', rating: 4.6, sold: 174 },
      { name: 'سموذي توت مشكل', name_en: 'Mixed berry smoothie', category: 'سموذي', category_en: 'Smoothies', sku: 'SMZ-SMT-006', cost: 28, price: 60, stock: 26, min_stock: 6, image: 'products/2-smozy/6-smozy-mixed-berry.webp', rating: 4.9, sold: 221 },
      { name: 'ميلك شيك أوريو', name_en: 'Oreo milkshake', category: 'ميلك شيك', category_en: 'Milkshakes', sku: 'SMZ-MLK-007', cost: 32, price: 65, stock: 24, min_stock: 5, image: 'products/2-smozy/7-smozy-oreo.webp', rating: 4.9, sold: 311 },
      { name: 'ميلك شيك شوكولاتة', name_en: 'Chocolate milkshake', category: 'ميلك شيك', category_en: 'Milkshakes', sku: 'SMZ-MLK-008', cost: 32, price: 65, stock: 22, min_stock: 5, image: 'products/2-smozy/8-smozy-chocolate.webp', rating: 4.8, sold: 267 },
      { name: 'ميلك شيك لوتس', name_en: 'Lotus milkshake', category: 'ميلك شيك', category_en: 'Milkshakes', sku: 'SMZ-MLK-009', cost: 35, price: 70, stock: 20, min_stock: 5, image: 'products/2-smozy/9-smozy-lotus.webp', rating: 5.0, sold: 254 }
    ],
    't-bnsheikh': [
      { name: 'قهوة تركي', name_en: 'Turkish coffee', category: 'قهوة ساخنة', category_en: 'Hot coffee', sku: 'BNS-HCO-001', cost: 12, price: 25, stock: 60, min_stock: 15, image: 'products/3-bnsheikh/1-bnsheikh-turkish-coffee.webp', rating: 4.7, sold: 520 },
      { name: 'إسبريسو مزدوج', name_en: 'Double espresso', category: 'قهوة ساخنة', category_en: 'Hot coffee', sku: 'BNS-HCO-002', cost: 15, price: 30, stock: 50, min_stock: 12, image: 'products/3-bnsheikh/2-bnsheikh-espresso.webp', rating: 4.8, sold: 388 },
      { name: 'كابتشينو', name_en: 'Cappuccino', category: 'قهوة ساخنة', category_en: 'Hot coffee', sku: 'BNS-HCO-003', cost: 18, price: 35, stock: 38, min_stock: 8, image: 'products/3-bnsheikh/3-bnsheikh-cappuccino.webp', rating: 4.9, sold: 466 },
      { name: 'لاتيه', name_en: 'Latte', category: 'قهوة ساخنة', category_en: 'Coffee', sku: 'BNS-HCO-004', cost: 20, price: 38, stock: 35, min_stock: 8, image: 'products/3-bnsheikh/4-bnsheikh-latte.webp', rating: 4.8, sold: 402 },
      { name: 'موكا', name_en: 'Mocha', category: 'قهوة ساخنة', category_en: 'Hot coffee', sku: 'BNS-HCO-005', cost: 30, price: 65, stock: 18, min_stock: 4, image: 'products/3-bnsheikh/5-bnsheikh-mocha.webp', rating: 4.7, sold: 219 },
      { name: 'آيس لاتيه', name_en: 'Iced latte', category: 'قهوة باردة', category_en: 'Iced coffee', sku: 'BNS-ICO-006', cost: 22, price: 40, stock: 35, min_stock: 8, image: 'products/3-bnsheikh/6-bnsheikh-iced-latte.webp', rating: 4.9, sold: 355 },
      { name: 'قهوة تركي مطحونة 250g', name_en: 'Turkish ground coffee 250g', category: 'حبوب قهوة', category_en: 'Coffee beans', sku: 'BNS-BEA-007', cost: 55, price: 120, stock: 28, min_stock: 6, image: 'products/3-bnsheikh/7-bnsheikh-turkish-ground.webp', rating: 4.8, sold: 142 },
      { name: 'قهوة متوسطة 500g', name_en: 'Medium roast 500g', category: 'حبوب قهوة', category_en: 'Coffee beans', sku: 'BNS-BEA-008', cost: 120, price: 240, stock: 16, min_stock: 4, image: 'products/3-bnsheikh/8-bnsheikh-medium-ground.webp', rating: 4.9, sold: 97 },
      { name: 'حبوب قهوة كاملة 1kg', name_en: 'Whole beans 1kg', category: 'حبوب قهوة', category_en: 'Coffee beans', sku: 'BNS-BEA-009', cost: 260, price: 490, stock: 9, min_stock: 3, image: 'products/3-bnsheikh/9-bnsheikh-whole-beans.webp', rating: 5.0, sold: 63 }
    ],
    't-mastore': [
      { name: 'تيشيرت قطن أبيض', name_en: 'White cotton t-shirt', category: 'رجالي', category_en: 'Men', sku: 'MAS-MEN-001', cost: 120, price: 250, stock: 28, min_stock: 6, image: 'products/4-mastore/1-mastore-white-tshirt.webp', rating: 4.6, sold: 210 },
      { name: 'بولو أسود', name_en: 'Black polo', category: 'رجالي', category_en: 'Men', sku: 'MAS-MEN-002', cost: 160, price: 320, stock: 22, min_stock: 5, image: 'products/4-mastore/2-mastore-black-polo.webp', rating: 4.7, sold: 168 },
      { name: 'بنطلون جينز', name_en: 'Denim jeans', category: 'رجالي', category_en: 'Men', sku: 'MAS-MEN-003', cost: 250, price: 450, stock: 16, min_stock: 4, image: 'products/4-mastore/3-mastore-denim-jeans.webp', rating: 4.8, sold: 142 },
      { name: 'بنطلون شينو', name_en: 'Chino pants', category: 'رجالي', category_en: 'Men', sku: 'MAS-MEN-004', cost: 220, price: 390, stock: 14, min_stock: 4, image: 'products/4-mastore/4-mastore-chino-pants.webp', rating: 4.5, sold: 96 },
      { name: 'جاكيت جلد', name_en: 'Leather jacket', category: 'رجالي', category_en: 'Men', sku: 'MAS-MEN-005', cost: 850, price: 1450, stock: 5, min_stock: 2, image: 'products/4-mastore/5-mastore-leather-jacket.webp', rating: 4.9, sold: 31 },
      { name: 'قميص كاجوال', name_en: 'Casual shirt', category: 'نسائي', category_en: 'Women', sku: 'MAS-WMN-006', cost: 300, price: 550, stock: 11, min_stock: 3, image: 'products/4-mastore/6-mastore-casual-shirt.webp', rating: 4.7, sold: 74 },
      { name: 'ساعة رياضية', name_en: 'Sports watch', category: 'إكسسوارات', category_en: 'Accessories', sku: 'MAS-ACC-007', cost: 390, price: 690, stock: 8, min_stock: 2, image: 'products/4-mastore/7-mastore-sports-watch.webp', rating: 4.6, sold: 52 },
      { name: 'محفظة جلد', name_en: 'Leather wallet', category: 'إكسسوارات', category_en: 'Accessories', sku: 'MAS-ACC-008', cost: 200, price: 380, stock: 14, min_stock: 3, image: 'products/4-mastore/8-mastore-leather-wallet.webp', rating: 4.5, sold: 88 },
      { name: 'نظارة شمس', name_en: 'Sunglasses', category: 'إكسسوارات', category_en: 'Accessories', sku: 'MAS-ACC-009', cost: 180, price: 420, stock: 10, min_stock: 3, image: 'products/4-mastore/9-mastore-sunglasses.webp', rating: 4.4, sold: 66 }
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
    Object.keys(CATALOG).forEach(function (tid) {
      CATALOG[tid].forEach(function (p, i) {
        out.push(Object.assign({}, p, {
          id: 'p-' + tid.replace('t-', '') + '-' + (i + 1),
          tenant_id: tid,
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

  function buildChats() {
    var chats = [];
    TENANTS.forEach(function (tn, i) {
      var owner = USERS.filter(function (u) { return u.role === 'owner' && u.tenant_id === tn.id; })[0];
      var supportMsgs = [
        { id: 'm1', user_id: 'u-admin', name: 'DotStudio Support', role: 'superadmin', text: 'أهلاً ' + tn.owner + ' 👋 كيف نقدر نساعدك اليوم؟', text_en: 'Hi ' + tn.owner_en + ' 👋 How can we help you today?', at: hoursAgo(25 + i) },
        { id: 'm2', user_id: owner.id, name: owner.name, role: 'owner', text: i === 1 ? 'عايزين نفعّل شركة توصيل إضافية للمتجر.' : 'كل حاجة شغالة تمام، شكراً!', text_en: i === 1 ? 'We would like to add another delivery company.' : 'Everything is working great, thanks!', at: hoursAgo(24 + i) },
        { id: 'm3', user_id: 'u-admin', name: 'DotStudio Support', role: 'superadmin', text: 'تمام، فريقنا جاهز. لو احتجت أي حاجة ابعتلنا هنا في أي وقت.', text_en: 'Done — our team is ready. Message us here any time you need anything.', at: hoursAgo(23 + i) }
      ];
      if (tn.id === 't-caznova') {
        supportMsgs.push({ id: 'm4', user_id: 'u-customer', name: 'ياسمين محمد', role: 'customer', text: 'عندي سؤال بخصوص الشحن، الطلب بيوصل امتى؟', text_en: 'Quick question about shipping — when does my order arrive?', at: hoursAgo(6) });
        supportMsgs.push({ id: 'm5', user_id: 'u-admin', name: 'DotStudio Support', role: 'superadmin', text: 'أهلاً ياسمين 🌸 التوصيل داخل القاهرة من 30 لـ 45 دقيقة، وتقدري تتابعي الطلب لحظة بلحظة.', text_en: 'Hi Yasmin 🌸 Delivery inside Cairo takes 30–45 minutes, and you can track it live.', at: hoursAgo(5) });
      }
      chats.push({
        id: 'support-' + tn.id,
        scope: 'support',
        tenant_id: tn.id,
        title: 'دعم · ' + tn.name,
        title_en: 'Support · ' + tn.name,
        messages: supportMsgs
      });
      chats.push({
        id: 'direct-' + tn.id,
        scope: 'direct',
        tenant_id: tn.id,
        title: 'محادثة ' + tn.name,
        title_en: tn.name + ' chat',
        messages: tn.id === 't-caznova' ? [
          { id: 'dm1', user_id: 'u-customer', name: 'ياسمين محمد', role: 'customer', text: 'مساء الخير 👋 عايزة أعرف مقاس الخاتم الفضي متوفر؟', text_en: 'Good evening 👋 Is the silver ring available in my size?', at: hoursAgo(9) },
          { id: 'dm2', user_id: owner.id, name: owner.name, role: 'owner', text: 'أهلاً بيكي 🌟 متوفر مقاسات 16 و18، وقدرنا نحجزلك المقاس اللي تحبيه.', text_en: 'Welcome 🌟 Sizes 16 and 18 are in stock — we can reserve yours.', at: hoursAgo(8) },
          { id: 'dm3', user_id: 'u-customer', name: 'ياسمين محمد', role: 'customer', text: 'تمام جداً، هطلبه دلوقتي. شكراً!', text_en: 'Perfect, ordering now. Thank you!', at: hoursAgo(7) }
        ] : [
          { id: 'dm1', user_id: owner.id, name: owner.name, role: 'owner', text: 'أهلاً بيك في ' + tn.name + ' 👋 اسألنا عن أي منتج أو مقاس وإحنا هنا.', text_en: 'Welcome to ' + tn.name_en + ' 👋 Ask us about any product or size.', at: hoursAgo(30 + i) }
        ]
      });
    });
    chats.push({
      id: 'public',
      scope: 'public',
      tenant_id: null,
      title: 'المحادثة العامة',
      title_en: 'Public chat',
      messages: [
        { id: 'p1', user_id: 'u-admin', name: 'DotStudio', role: 'superadmin', text: 'مرحباً بالجميع في مجتمع DotStudio® 👋 شاركنا أفكارك واقتراحاتك.', text_en: 'Welcome to the DotStudio® community 👋 Share your ideas and suggestions.', at: hoursAgo(30) },
        { id: 'p2', user_id: 'u-owner-caznova', name: 'أحمد كازنوفا', role: 'owner', text: 'تجربة الكاشير الجديدة أسرع بكتير، شكراً للفريق!', text_en: 'The new POS experience is much faster — thanks team!', at: hoursAgo(20) },
        { id: 'p3', user_id: 'u-owner-smozy', name: 'سارة سميزي', role: 'owner', text: 'حد جرب تقارير المخزون الجديدة؟', text_en: 'Has anyone tried the new inventory reports?', at: hoursAgo(8) },
        { id: 'p4', user_id: 'u-del-hala', name: 'حالا', role: 'delivery', text: 'الخريطة اللحظية بتوفر علينا وقت كبير في التوصيل.', text_en: 'Live maps save us a lot of delivery time.', at: hoursAgo(3) },
        { id: 'p5', user_id: 'u-customer', name: 'ياسمين محمد', role: 'customer', text: 'أول تجربة ليا وكانت ممتازة، الطلب وصل أسرع من المتوقع ✨', text_en: 'My first order and it was great — arrived faster than expected ✨', at: hoursAgo(1) }
      ]
    });
    chats.push({
      id: 'stores',
      scope: 'stores',
      tenant_id: null,
      title: 'أصحاب المتاجر',
      title_en: 'Store owners',
      messages: [
        { id: 's1', user_id: 'u-owner-bnsheikh', name: 'بن الشيخ', role: 'owner', text: 'عندي فكرة نعمل عرض مشترك بين المتاجر الأربعة 😄', text_en: 'I have an idea for a joint campaign across the four stores 😄', at: hoursAgo(12) },
        { id: 's2', user_id: 'u-owner-mastore', name: 'محمود علي', role: 'owner', text: 'أنا معاك، ممكن نبدأ بعرض نهاية الأسبوع.', text_en: 'I am in — we can start with a weekend offer.', at: hoursAgo(11) },
        { id: 's3', user_id: 'u-owner-caznova', name: 'أحمد كازنوفا', role: 'owner', text: 'الفكرة ممتازة. خلينا ننسق في المحادثة دي.', text_en: 'Great idea. Let us coordinate in this chat.', at: hoursAgo(10) }
      ]
    });
    chats.push({
      id: 'delivery',
      scope: 'delivery',
      tenant_id: null,
      title: 'شركات التوصيل',
      title_en: 'Delivery companies',
      messages: [
        { id: 'd1', user_id: 'u-admin', name: 'DotStudio Ops', role: 'superadmin', text: 'تذكير: تأكيد التسليم لازم يكون مع صورة إثبات من اليوم.', text_en: 'Reminder: delivery confirmation now requires a proof photo.', at: hoursAgo(18) },
        { id: 'd2', user_id: 'u-del-talqa', name: 'طلقة', role: 'delivery', text: 'تمام، تم التطبيق على كل المندوبين ✅', text_en: 'Done — applied to all riders ✅', at: hoursAgo(16) },
        { id: 'd3', user_id: 'u-del-ahla', name: 'أهلا', role: 'delivery', text: 'هل في طلبات كثيرة متوقعة النهاردة؟', text_en: 'Are we expecting many orders today?', at: hoursAgo(5) },
        { id: 'd4', user_id: 'u-admin', name: 'DotStudio Ops', role: 'superadmin', text: 'متوقع زيادة بعد الساعة 7 مساءً. جهزوا الفريق.', text_en: 'Expect a surge after 7 PM. Get the team ready.', at: hoursAgo(4) }
      ]
    });
    chats.push({
      id: 'support-global',
      scope: 'support',
      tenant_id: null,
      title: 'دعم DotStudio®',
      title_en: 'DotStudio® support',
      messages: [
        { id: 'sg1', user_id: 'u-admin', name: 'DotStudio Support', role: 'superadmin', text: 'أهلاً بيك 👋 فريق الدعم متاح من 9 صباحاً لـ 9 مساءً.', text_en: 'Welcome 👋 Our support team is online 9 AM – 9 PM.', at: hoursAgo(14) },
        { id: 'sg2', user_id: 'u-del-talqa', name: 'طلقة', role: 'delivery', text: 'عندي استفسار عن إثبات التسليم.', text_en: 'I have a question about delivery proof.', at: hoursAgo(4) },
        { id: 'sg3', user_id: 'u-admin', name: 'DotStudio Support', role: 'superadmin', text: 'تحت أمرك، ابعت التفاصيل هنا وهنساعدك فوراً.', text_en: 'Sure — send the details here and we will help right away.', at: hoursAgo(3) }
      ]
    });
    return chats;
  }

  /* Migration: make sure every tenant has a support + direct room and that the
     shared channels exist. Runs on every load so old localStorage DBs upgrade. */
  function ensureChats(db) {
    if (!db || !Array.isArray(db.chats)) return;
    var tenants = Array.isArray(db.tenants) ? db.tenants : [];
    var has = function (id) { return db.chats.some(function (c) { return c.id === id; }); };
    tenants.forEach(function (tn) {
      if (!has('support-' + tn.id)) {
        db.chats.push({
          id: 'support-' + tn.id, scope: 'support', tenant_id: tn.id,
          title: 'دعم · ' + tn.name, title_en: 'Support · ' + tn.name,
          messages: [{ id: DS.uid('msg'), user_id: 'u-admin', name: 'DotStudio Support', role: 'superadmin', text: 'أهلاً بيك 👋 كيف نقدر نساعدك؟', text_en: 'Welcome 👋 How can we help?', at: nowISO() }]
        });
      }
      if (!has('direct-' + tn.id)) {
        db.chats.push({
          id: 'direct-' + tn.id, scope: 'direct', tenant_id: tn.id,
          title: 'محادثة ' + tn.name, title_en: tn.name + ' chat',
          messages: [{ id: DS.uid('msg'), user_id: 'u-admin', name: 'DotStudio', role: 'superadmin', text: 'محادثة المتجر جاهزة — اسأل عن أي منتج.', text_en: 'Store chat is ready — ask about any product.', at: nowISO() }]
        });
      }
    });
    [['public', 'المحادثة العامة', 'Public chat'], ['stores', 'أصحاب المتاجر', 'Store owners'], ['delivery', 'شركات التوصيل', 'Delivery companies'], ['support-global', 'دعم DotStudio®', 'DotStudio® support']].forEach(function (row) {
      if (has(row[0])) return;
      db.chats.push({
        id: row[0], scope: row[0] === 'support-global' ? 'support' : row[0], tenant_id: null,
        title: row[1], title_en: row[2],
        messages: [{ id: DS.uid('msg'), user_id: 'u-admin', name: 'DotStudio', role: 'superadmin', text: 'مرحباً 👋', text_en: 'Welcome 👋', at: nowISO() }]
      });
    });
    db.chats.forEach(function (c) { if (!Array.isArray(c.messages)) c.messages = []; });
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
    var before = (db.chats || []).map(function (c) { return c.id; }).join('|');
    ensureChats(db);
    var after = (db.chats || []).map(function (c) { return c.id; }).join('|');
    if (before !== after) save(db);
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
    return DB.orders.filter(function (o) { return o.tenant_id === user.tenant_id; });
  }

  function visibleInvoices(user) {
    user = user || DS.session();
    if (!user) return [];
    if (isAdmin(user)) return DB.invoices.slice();
    if (user.role === 'delivery' || user.role === 'customer') return [];
    return DB.invoices.filter(function (i) { return i.tenant_id === user.tenant_id; });
  }

  function ordersByTenant(tenantId) { return DB.orders.filter(function (o) { return o.tenant_id === tenantId; }); }
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
    if (user.role === 'superadmin') return false;
    DB.users = DB.users.filter(function (u) { return u.id !== id; });
    audit('حذف مستخدم «' + user.name + '»', 'Deleted user “' + user.name + '”', 'trash');
    commit();
    return true;
  }

  function addProduct(data) {
    var product = Object.assign({
      id: DS.uid('p'), is_active: true, rating: 4.8, sold: 0, created_at: nowISO(), updated_at: nowISO(), min_stock: 5
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
    invoice.items.forEach(function (it) {
      var p = DB.products.filter(function (x) { return x.id === it.product_id; })[0];
      if (p) p.stock = Math.max(0, p.stock - it.qty);
    });
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
    if (room.scope === 'public') return true;
    if (room.scope === 'stores') return user.role === 'owner' || isAdmin(user);
    if (room.scope === 'delivery') return user.role === 'delivery' || user.role === 'owner' || user.role === 'cashier' || isAdmin(user);
    if (room.scope === 'support') {
      if (isAdmin(user)) return true;
      if (room.tenant_id == null) return user.role === 'delivery' || user.role === 'customer';
      if (user.tenant_id) return room.tenant_id === user.tenant_id;
      return user.role === 'customer' && currentStoreId(user) === room.tenant_id;
    }
    if (room.scope === 'direct') {
      if (isAdmin(user)) return false;                 /* store ↔ customer stays private */
      var tid = user.tenant_id || (user.role === 'customer' ? currentStoreId(user) : null);
      return !!tid && room.tenant_id === tid;
    }
    return false;
  }

  function roomsFor(user) {
    user = user || DS.session();
    return DB.chats.filter(function (r) { return roomVisible(user, r); });
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
      DB.orders.filter(function (o) { return o.tenant_id === user.tenant_id && (o.status === 'pending' || o.status === 'delivering'); }).slice(0, 4).forEach(function (o) {
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
    roomsFor: roomsFor,
    roomVisible: roomVisible,
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
