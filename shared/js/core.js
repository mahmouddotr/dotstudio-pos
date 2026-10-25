/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — CORE
   Utilities, i18n, auth/session, toasts, modals, avatar picker,
   command palette, icons and small UI helpers.
   Exposes window.DS (and a few globals for inline handlers).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var DS = window.DS = window.DS || {};
  var LS_LANG = 'ds_lang';
  var LS_THEME = 'ds_theme';

  /* ───────────────────────── ROOT RESOLUTION ───────────────────────── */
  function detectRoot() {
    try {
      var sc = document.currentScript;
      if (!sc || !sc.src) {
        var all = document.getElementsByTagName('script');
        for (var i = all.length - 1; i >= 0; i--) {
          if (all[i].src && /shared\/js\/core\.js/.test(all[i].src)) { sc = all[i]; break; }
        }
      }
      if (sc && sc.src) return sc.src.replace(/shared\/js\/core\.js.*$/, '');
    } catch (e) {}
    return '';
  }
  var ROOT = detectRoot();
  DS.ROOT = ROOT;
  function url(path) {
    path = path == null ? '' : String(path);
    if (/^(?:[a-z]+:|\/\/|#|data:|blob:)/i.test(path)) return path;
    return ROOT + path.replace(/^\.?\//, '');
  }
  DS.url = url;

  /* ───────────────────────────── HELPERS ───────────────────────────── */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  DS.$ = $; DS.$$ = $$;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  DS.esc = esc;

  /* Locale-aware field picker: DS.loc(obj, 'city') → city_en in English. */
  function loc(obj, base) {
    if (!obj) return '';
    var en = obj[base + '_en'];
    var ar = obj[base];
    if (lang() === 'en') return en || ar || '';
    return ar || en || '';
  }
  DS.loc = loc;

  function attr(value) { return esc(value).replace(/`/g, '&#96;'); }
  DS.attr = attr;

  function uid(prefix) { return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
  DS.uid = uid;

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  DS.clamp = clamp;

  function debounce(fn, wait) {
    var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, wait || 180); };
  }
  DS.debounce = debounce;

  function on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }
  DS.on = on;

  function formatNumber(n) {
    n = Number(n) || 0;
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  DS.num = formatNumber;

  function money(n) {
    var lang = DS.lang();
    var value = Number(n) || 0;
    var str = value.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
    return str + ' ' + (lang === 'ar' ? 'ج.م' : 'EGP');
  }
  DS.money = money;
  DS.moneyRaw = function (n) { var v = Number(n) || 0; return v.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }); };

  function pct(part, whole) { return whole ? Math.round((Number(part) / Number(whole)) * 100) : 0; }
  DS.pct = pct;

  var LOCALES = { ar: 'ar-EG-u-nu-latn', en: 'en-GB' };
  function date(value, withTime) {
    try {
      var d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return '—';
      var opts = withTime
        ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
        : { day: 'numeric', month: 'short', year: 'numeric' };
      return d.toLocaleDateString(LOCALES[DS.lang()] || LOCALES.en, opts);
    } catch (e) { return '—'; }
  }
  DS.date = date;
  DS.datetime = function (v) { return date(v, true); };

  function timeAgo(ts) {
    var ar = DS.lang() === 'ar';
    var diff = Math.max(0, Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return ar ? 'الآن' : 'just now';
    if (diff < 3600) { var m = Math.floor(diff / 60); return ar ? ('منذ ' + m + ' د') : (m + 'm ago'); }
    if (diff < 86400) { var h = Math.floor(diff / 3600); return ar ? ('منذ ' + h + ' س') : (h + 'h ago'); }
    if (diff < 604800) { var d = Math.floor(diff / 86400); return ar ? ('منذ ' + d + ' يوم') : (d + 'd ago'); }
    return date(ts);
  }
  DS.timeAgo = timeAgo;

  function timeShort(ts) {
    try { return new Date(ts).toLocaleTimeString(LOCALES[DS.lang()] || LOCALES.en, { hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return '—'; }
  }
  DS.timeShort = timeShort;

  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
  }
  DS.initials = initials;

  /* ───────────────────────────── STORAGE ───────────────────────────── */
  var storage = {
    get: function (key, fallback) {
      try { var raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
      catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return value; }
      catch (e) { return null; }
    },
    remove: function (key) { try { localStorage.removeItem(key); } catch (e) {} },
    raw: {
      get: function (key, fallback) { try { var v = localStorage.getItem(key); return v == null ? fallback : v; } catch (e) { return fallback; } },
      set: function (key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
    }
  };
  DS.store = storage;

  /* ─────────────────────────────── I18N ────────────────────────────── */
  var I18N = {
    ar: {
      /* nav / roles */
      admin: 'الإدارة', subadmin: 'مشرف', owner: 'صاحب متجر', cashier: 'كاشير', delivery: 'مندوب', customer: 'عميل',
      dashboard: 'لوحة التحكم', overview: 'نظرة عامة', stores: 'المتاجر', products: 'المنتجات', orders: 'الطلبات',
      invoices: 'الفواتير', customers: 'العملاء', cashiers: 'الكاشير', 'delivery-companies': 'شركات التوصيل',
      chats: 'المحادثات', messages: 'الرسائل', jobs: 'الوظائف', reports: 'التقارير', subscriptions: 'الاشتراكات',
      audit: 'سجل النشاط', settings: 'الإعدادات', pos: 'نقطة البيع', storefront: 'المتجر', checkout: 'إتمام الطلب',
      tracking: 'تتبع الطلب', 'my-orders': 'طلباتي', 'sub-admins': 'المشرفون', marketing: 'الرئيسية',
      /* common */
      search: 'بحث', searchPlaceholder: 'ابحث عن أي شيء…', save: 'حفظ', cancel: 'إلغاء', delete: 'حذف',
      edit: 'تعديل', add: 'إضافة', view: 'عرض', details: 'تفاصيل', close: 'إغلاق', confirm: 'تأكيد',
      yes: 'نعم', no: 'لا', all: 'الكل', active: 'نشط', inactive: 'موقوف', status: 'الحالة', actions: 'إجراءات',
      name: 'الاسم', phone: 'الهاتف', email: 'البريد', address: 'العنوان', city: 'المدينة', date: 'التاريخ',
      total: 'الإجمالي', subtotal: 'المجموع', delivery: 'التوصيل', discount: 'الخصم', quantity: 'الكمية',
      price: 'السعر', stock: 'المخزون', category: 'الفئة', image: 'الصورة', customerLabel: 'العميل',
      ownerLabel: 'المالك', store: 'المتجر', role: 'الدور', plan: 'الباقة', language: 'اللغة', theme: 'المظهر',
      logout: 'تسجيل الخروج', login: 'تسجيل الدخول', username: 'اسم المستخدم', password: 'كلمة المرور',
      welcome: 'أهلاً', today: 'اليوم', week: 'هذا الأسبوع', month: 'هذا الشهر', revenue: 'الإيرادات',
      print: 'طباعة', export: 'تصدير', filter: 'تصفية', from: 'من', to: 'إلى', apply: 'تطبيق', reset: 'إعادة تعيين',
      loading: 'جارٍ التحميل…', noData: 'لا توجد بيانات', noResults: 'لا توجد نتائج', accessDenied: 'لا تملك صلاحية الوصول',
      accessDeniedText: 'هذه الصفحة غير متاحة لدورك الحالي. تواصل مع مدير النظام إذا كنت تعتقد أن هذا خطأ.',
      back: 'رجوع', next: 'التالي', previous: 'السابق', copy: 'نسخ', copied: 'تم النسخ', refresh: 'تحديث',
      addProduct: 'إضافة منتج', editProduct: 'تعديل المنتج', addCashier: 'إضافة كاشير', editCashier: 'تعديل كاشير',
      addStore: 'إضافة متجر', addAdmin: 'إضافة مشرف', addCompany: 'إضافة شركة', addJob: 'إضافة وظيفة',
      viewAll: 'عرض الكل', quickActions: 'إجراءات سريعة', recentOrders: 'أحدث الطلبات', topProducts: 'الأكثر مبيعاً',
      lowStock: 'مخزون منخفض', salesOverview: 'نظرة على المبيعات', last7: 'آخر 7 أيام', last30: 'آخر 30 يوم',
      vsLast: 'مقارنة بالفترة السابقة', pending: 'قيد الانتظار', confirmed: 'مؤكد', preparing: 'قيد التحضير',
      delivering: 'في الطريق', delivered: 'تم التسليم', cancelled: 'ملغي', orderId: 'رقم الطلب',
      paymentMethod: 'طريقة الدفع', cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة', vodafone: 'فودافون كاش',
      deliveryCompany: 'شركة التوصيل', driver: 'المندوب', timeline: 'مراحل الطلب', proof: 'إثبات التسليم',
      noProof: 'لا يوجد إثبات تسليم بعد', customerInfo: 'بيانات العميل', items: 'المنتجات', summary: 'الملخص',
      emptyOrders: 'لا توجد طلبات بعد', emptyOrdersText: 'عندما يصلك أول طلب ستجده هنا مع كل التفاصيل.',
      emptyProducts: 'لا توجد منتجات', emptyProductsText: 'ابدأ بإضافة منتجاتك لتظهر في المتجر ونقطة البيع.',
      emptyCustomers: 'لا يوجد عملاء بعد', emptyCustomersText: 'سيظهر العملاء هنا بمجرد إنشاء أول طلب.',
      emptyChats: 'لا توجد محادثات', emptyChatsText: 'اختر محادثة من القائمة أو ابدأ واحدة جديدة.',
      addFirstProduct: 'أضف أول منتج', browseStore: 'تصفح المتجر', createOrder: 'إنشاء طلب',
      outOfStock: 'نفذ المخزون', inStock: 'متوفر', low: 'منخفض', units: 'قطعة',
      profit: 'الربح', avgOrder: 'متوسط الطلب', completed: 'مكتمل', rating: 'التقييم', fee: 'العمولة',
      joined: 'تاريخ الانضمام', lastOrder: 'آخر طلب', ordersCount: 'الطلبات', spent: 'إجمالي الشراء',
      users: 'المستخدمون', permissions: 'الصلاحيات', saveChanges: 'حفظ التغييرات', profile: 'الملف الشخصي',
      storeProfile: 'بيانات المتجر', notifications: 'الإشعارات', security: 'الأمان', preferences: 'التفضيلات',
      markAllRead: 'تعليم الكل كمقروء', noNotifications: 'لا توجد إشعارات', online: 'متصل', offline: 'غير متصل',
      chatSupport: 'الدعم', chatPublic: 'العام', chatStores: 'المتاجر', chatDelivery: 'شركات التوصيل',
      chatAdminOnly: 'للإدارة فقط', chatOwnersOnly: 'لأصحاب المتاجر فقط', chatLocked: 'هذه المحادثة غير متاحة لدورك',
      chatLockedText: 'يمكنك التواصل عبر القنوات المتاحة لك فقط. هذه القناة مخصصة لدور آخر.',
      sendMessage: 'اكتب رسالة…', send: 'إرسال', you: 'أنت', support: 'الدعم الفني',
      chatDirect: 'المتجر', chatDirectTitle: 'محادثة المتجر', chatChannels: 'القنوات', chatChannelPick: 'اختر قناة',
      chatDirectHint: 'محادثة مباشرة مع المتجر', chatSupportHint: 'فريق DotStudio® معك',
      chatPublicHint: 'الجميع يمكنه المشاركة', chatStoresHint: 'أصحاب المتاجر فقط',
      chatDeliveryHint: 'شركات التوصيل والمندوبون', chatOnline: 'متصل الآن',
      chatPick: 'اختر محادثة', chatPickText: 'اختر قناة من القائمة لتبدأ الدردشة.',
      chatNoRooms: 'لا توجد محادثات هنا بعد', chatStartConversation: 'ابدأ المحادثة',
      chatEmptyHint: 'لا رسائل بعد — ابدأ الحديث.', chatSendHint: 'Enter للإرسال · Shift+Enter لسطر جديد',
      chatMessages: 'رسائل', chatWith: 'مع', chatBack: 'المحادثات',
      storeHeroKicker: 'توصيل سريع · جودة مضمونة', storeHeroTitle: 'كل ما تحبه،',
      storeHeroTitleAccent: 'في مكان واحد.', storeHeroSub: 'منتجات مختارة بعناية من أفضل المتاجر، تصلك في أسرع وقت.',
      shopNow: 'تسوق الآن', exploreStore: 'استكشف المتجر', trustedBy: 'يثق بنا أكثر من 12 ألف عميل',
      freeDelivery: 'توصيل سريع', freeDeliveryText: 'خلال 30–45 دقيقة داخل القاهرة',
      securePayment: 'دفع آمن', securePaymentText: 'نقدي · بطاقة · محفظة إلكترونية',
      qualityGuarantee: 'جودة مضمونة', qualityGuaranteeText: 'منتجات أصلية أو استرداد كامل',
      shopByCategory: 'تسوق حسب الفئة', featuredPicks: 'مختارات المتجر', allProducts: 'كل المنتجات',
      bestSeller: 'الأكثر مبيعاً', newArrival: 'جديد', quickView: 'نظرة سريعة',
      addToBag: 'أضف للسلة', inBag: 'في السلة', addedToBag: 'أُضيف إلى سلتك',
      viewBag: 'عرض السلة', itemsInBag: 'منتج في السلة', yourBag: 'سلة التسوق',
      keepShopping: 'متابعة التسوق', deliveryIn: 'التوصيل خلال', minutes: 'دقيقة',
      openNow: 'مفتوح الآن', closedNow: 'مغلق الآن', storeRating: 'تقييم المتجر',
      seeAll: 'عرض الكل', resultsFor: 'نتائج البحث عن', noItems: 'لا توجد منتجات مطابقة',
      subtotalLabel: 'المجموع الفرعي', deliveryLabel: 'التوصيل', totalLabel: 'الإجمالي',
      checkoutNow: 'إتمام الطلب', orderSummaryHint: 'الأسعار تشمل ضريبة القيمة المضافة',
      profileTitle: 'الملف الشخصي', accountType: 'نوع الحساب', storeLabel: 'المتجر',
      subscriptionTitle: 'اختر الباقة المناسبة', subscriptionSub: 'فعّل اشتراكك عبر واتساب في خطوة واحدة — بدون نماذج داخلية.',
      subscribe: 'اشترك الآن', currentPlan: 'باقتك الحالية', renew: 'تجديد', monthly: 'شهري', sixMonths: '6 أشهر', sixmonths: '6 أشهر', yearly: 'سنوي',
      perMonth: 'شهرياً', perSix: 'كل 6 أشهر', perYear: 'سنوياً', bestValue: 'الأفضل قيمة', mostPopular: 'الأكثر اختياراً',
      planMonthly: 'باقة شهرية', planSix: 'باقة 6 أشهر', planYearly: 'باقة سنوية', expires: 'تنتهي في', daysLeft: 'يوم متبقي',
      subscriptionContact: 'سيتم تحويلك إلى واتساب مع رسالة جاهزة باسم متجرك.',
      jobsTitle: 'وظائف DotStudio®', jobsSub: 'انضم إلى فريق نصنع به تجربة تجارة حديثة.',
      applyNow: 'قدّم الآن', applyFor: 'التقديم على وظيفة', fullTime: 'دوام كامل', partTime: 'دوام جزئي', remote: 'عن بعد',
      department: 'القسم', location: 'الموقع', salary: 'الراتب', experience: 'الخبرة', jobDesc: 'الوصف الوظيفي',
      requirements: 'المتطلبات', applicationSent: 'تم إرسال طلبك بنجاح', applicationSentText: 'سيتواصل معك فريق التوظيف قريباً.',
      myApplications: 'طلبات التوظيف', noJobs: 'لا توجد وظائف متاحة حالياً', publicChat: 'المحادثة العامة', 'public-chat': 'المحادثة العامة',
      storeOpen: 'مفتوح الآن', viewStore: 'زيارة المتجر', continueShopping: 'متابعة التسوق', placeOrder: 'تأكيد الطلب',
      orderPlaced: 'تم إنشاء طلبك', orderPlacedText: 'يمكنك تتبع طلبك لحظة بلحظة.', trackOrder: 'تتبع الطلب',
      emptyCart: 'سلتك فارغة', emptyCartText: 'أضف بعض المنتجات لتظهر هنا.', continue: 'متابعة', choosePayment: 'طريقة الدفع',
      deliveryTo: 'التوصيل إلى', change: 'تغيير', orderSummary: 'ملخص الطلب', confirmOrder: 'تأكيد الطلب',
      trackingTitle: 'تتبع طلبك', live: 'مباشر', eta: 'الوقت المتوقع', distance: 'المسافة', driverOnWay: 'المندوب في الطريق إليك',
      orderDelivered: 'تم تسليم طلبك', orderPending: 'طلبك قيد المراجعة', orderPreparing: 'جاري تجهيز طلبك',
      noActiveOrder: 'لا يوجد طلب نشط', noActiveOrderText: 'أنشئ طلباً من المتجر لتتمكن من تتبعه هنا.',
      myOrders: 'طلباتي', orderDate: 'تاريخ الطلب', reorder: 'إعادة الطلب', invoice: 'فاتورة',
      totalOrders: 'إجمالي الطلبات', activeOrders: 'طلبات جارية', deliveredOrders: 'طلبات مسلّمة', revenueToday: 'إيرادات اليوم',
      assigned: 'مُسندة', pickedUp: 'تم الاستلام', onTheWay: 'في الطريق', completedToday: 'مكتمل اليوم',
      acceptTask: 'قبول', markPicked: 'تم الاستلام', markDelivered: 'تم التسليم', proofUpload: 'رفع إثبات التسليم',
      proofRequired: 'أرفق صورة إثبات قبل تأكيد التسليم.', earnings: 'الأرباح', avgTime: 'متوسط الوقت',
      platformOverview: 'ملخص المنصة', liveActivity: 'النشاط اللحظي', totalRevenue: 'إجمالي الإيرادات', totalOrdersLabel: 'إجمالي الطلبات',
      totalStores: 'إجمالي المتاجر', totalCustomers: 'إجمالي العملاء', mrr: 'الإيراد الشهري المتكرر', arr: 'الإيراد السنوي',
      topStores: 'أفضل المتاجر', revenueSplit: 'توزيع الإيرادات', auditLog: 'سجل النشاط', auditSub: 'كل حركة على المنصة مسجلة.',
      settingsSub: 'تحكم في إعدادات المنصة والمتجر حسب دورك.', saveSettings: 'حفظ الإعدادات',
      saved: 'تم الحفظ بنجاح', deleted: 'تم الحذف', updated: 'تم التحديث', created: 'تم الإنشاء',
      confirmDelete: 'تأكيد الحذف', confirmDeleteText: 'لا يمكن التراجع عن هذه الخطوة. هل أنت متأكد؟',
      noPermission: 'لا تملك الصلاحية', allStores: 'كل المتاجر', allStatuses: 'كل الحالات', allCompanies: 'كل الشركات',
      filterBy: 'تصفية', exportCsv: 'تصدير CSV', showing: 'عرض', of: 'من', results: 'نتيجة',
      thisMonthRevenue: 'إيرادات الشهر', monthRevenue: 'إيرادات الشهر', growth: 'النمو', sinceLastMonth: 'منذ الشهر الماضي', avgBasket: 'متوسط السلة',
      info: 'معلومة', platform: 'المنصة',
      newCustomers: 'عملاء جدد', returning: 'عملاء عائدون', ordersToday: 'طلبات اليوم', pendingNow: 'بانتظار الإجراء',
      manage: 'إدارة', activate: 'تفعيل', deactivate: 'إيقاف', extend: 'تمديد', impersonate: 'الدخول كصاحب المتجر',
      planExpiry: 'انتهاء الاشتراك', daysRemaining: 'الأيام المتبقية', expired: 'منتهي', expiringSoon: 'قارب على الانتهاء',
      markPaid: 'تسجيل الدفع', contactWhatsapp: 'تواصل واتساب', sendWhatsapp: 'إرسال واتساب',
      overviewFor: 'مرحباً', workspace: 'مساحة العمل', switchAccount: 'تبديل الحساب', profileSettings: 'إعدادات الحساب',
      commandPalette: 'لوحة الأوامر', searchAnything: 'ابحث عن صفحة، منتج، طلب…', noCommandResults: 'لا توجد نتائج مطابقة',
      navigate: 'تنقل', open: 'فتح', closeEsc: 'إغلاق', searchProducts: 'المنتجات', searchPages: 'الصفحات', searchOrders: 'الطلبات',
      storeName: 'اسم المتجر', storePhone: 'هاتف المتجر', storeAddress: 'عنوان المتجر', storeDesc: 'وصف المتجر',
      logoAvatar: 'شعار المتجر', changeAvatar: 'تغيير الصورة', uploadImage: 'رفع صورة', chooseAvatar: 'اختر صورتك',
      receipt: 'الإيصال', printReceipt: 'طباعة الإيصال', newSale: 'بيعة جديدة', clearCart: 'تفريغ السلة',
      customerName: 'اسم العميل', customerPhone: 'هاتف العميل', notes: 'ملاحظات', applyDiscount: 'تطبيق خصم',
      paid: 'المدفوع', change: 'الباقي', checkout: 'الدفع', cart: 'السلة', item: 'عنصر', empty: 'فارغ',
      walkIn: 'عميل نقدي', searchProduct: 'ابحث عن منتج…', noProducts: 'لا توجد منتجات في هذه الفئة',
      todaySales: 'مبيعات اليوم', transactions: 'العمليات', avgTicket: 'متوسط الفاتورة', shift: 'الوردية',
      addToCart: 'أضف للسلة', storeClosed: 'المتجر مغلق', storeClosedText: 'هذا المتجر غير متاح حالياً. جرّب متجراً آخر.',
      liveOrders: 'الطلبات الجارية', deliveryChat: 'محادثة التوصيل', deliveryDashboard: 'لوحة المندوب',
      assignedOrders: 'طلبات مُسندة إليك', noAssigned: 'لا توجد طلبات مُسندة', noAssignedText: 'ستظهر الطلبات الجديدة هنا فور إسنادها.',
      mapTitle: 'خريطة التتبع', statusUpdated: 'تم تحديث حالة الطلب', pickOrder: 'اختر طلباً لعرض التفاصيل',
      loginTitle: 'مرحباً بعودتك', loginSub: 'سجّل الدخول لإدارة متجرك ومتابعة كل شيء من مكان واحد.',
      loginBtn: 'دخول إلى لوحة التحكم', demoAccounts: 'حسابات تجريبية', useAccount: 'استخدم', fill: 'تعبئة',
      invalidLogin: 'اسم المستخدم أو كلمة المرور غير صحيحة.', emptyLogin: 'يرجى إدخال اسم المستخدم وكلمة المرور.',
      loggedIn: 'تم تسجيل الدخول بنجاح', signingIn: 'جارٍ تسجيل الدخول…', forgot: 'نسيت كلمة المرور؟',
      remember: 'تذكرني', secure: 'اتصال آمن', encrypted: 'بيانات مشفرة', trusted: 'موثوق من آلاف المتاجر',
      liveSupport: 'دعم مباشر', heroLine1: 'أدر متجرك', heroLine2: 'بذكاء.', loginHero: 'منصة واحدة. أربعة متاجر. صفر تعقيد.',
      loginHeroSub: 'نقطة بيع، متجر إلكتروني، توصيل، محادثات وتقارير — كل ما تحتاجه لإدارة تجارتك بتجربة واحدة أنيقة.',
      statStores: 'متاجر نشطة', statOrders: 'طلب هذا الشهر', statUptime: 'وقت التشغيل', copyright: 'جميع الحقوق محفوظة',
      marketingTitle: 'نظام إدارة متاجر متكامل', marketingSub: 'كل أدوات التجارة الحديثة في منصة واحدة — سريعة، آمنة، ومصممة للنمو.',
      features: 'المزايا', pricing: 'الأسعار', startNow: 'ابدأ الآن', learnMore: 'اعرف أكثر', seeDemo: 'تجربة مباشرة',
      featurePos: 'نقطة بيع سريعة', featurePosText: 'واجهة كاشير تعمل بلمسة واحدة، مع دعم الباركود والدفع المتعدد.',
      featureStore: 'متجر إلكتروني', featureStoreText: 'واجهة متجر أنيقة لكل علامة تجارية مع سلة ودفع وتوصيل.',
      featureTracking: 'تتبع لحظي', featureTrackingText: 'خريطة حية للمندوب مع وقت وصول دقيق وتحديث تلقائي.',
      featureChat: 'محادثات موحدة', featureChatText: 'دعم، عملاء، متاجر وشركات توصيل — كلها في صندوق واحد.',
      featureReports: 'تقارير ذكية', featureReportsText: 'أرباح، مخزون وأداء الفريق في لوحات واضحة وقابلة للتصدير.',
      featureSecurity: 'أمان مؤسسي', featureSecurityText: 'عزل كامل لبيانات كل متجر، صلاحيات دقيقة وسجل نشاط كامل.',
      finalCta: 'جاهز تنقل متجرك لمستوى تالي؟', finalCtaText: 'جرّب DotStudio® POS الآن بحساب تجريبي — بدون إعداد.',
      footerRights: 'جميع الحقوق محفوظة.',
      error: 'حدث خطأ', retry: 'إعادة المحاولة', required: 'هذا الحقل مطلوب', invalidPhone: 'رقم هاتف غير صحيح',
      addedToCart: 'تمت الإضافة إلى السلة', removedFromCart: 'تم الحذف من السلة', copiedLink: 'تم نسخ الرابط',
      orderCancelled: 'تم إلغاء الطلب', orderConfirmed: 'تم تأكيد الطلب', orderDelivering: 'الطلب في الطريق',
      orderDeliveredMsg: 'تم تسليم الطلب بنجاح', orderCreated: 'تم إنشاء الطلب بنجاح',
      userSaved: 'تم حفظ المستخدم', productSaved: 'تم حفظ المنتج', storeSaved: 'تم حفظ المتجر',
      companySaved: 'تم حفظ شركة التوصيل', settingsSaved: 'تم حفظ الإعدادات', passwordCopied: 'تم نسخ كلمة المرور',
      selectStore: 'اختر المتجر', allRights: 'جميع الحقوق محفوظة', builtBy: 'صُنع بواسطة DotStudio®',
      version: 'الإصدار', dateRange: 'الفترة', applyFilter: 'تطبيق', clearFilter: 'مسح',
      viewDetails: 'عرض التفاصيل', noCompany: 'بدون شركة', unassigned: 'غير مُسند', storeInfo: 'بيانات المتجر',
      totalSpent: 'إجمالي الإنفاق', lastSeen: 'آخر ظهور', suspend: 'إيقاف', restore: 'استعادة',
      permissionsHint: 'اختر الصفحات التي يمكن للمشرف الوصول إليها.',
      catalog: 'الكتالوج', filters: 'الفلاتر', sortNewest: 'الأحدث', sortPrice: 'السعر', sortName: 'الاسم',
      searchInStore: 'ابحث في المتجر…', added: 'أُضيف', out: 'نفذ', lowStockShort: 'منخفض'
    },
    en: {
      admin: 'Admin', subadmin: 'Sub-admin', owner: 'Store owner', cashier: 'Cashier', delivery: 'Driver', customer: 'Customer',
      dashboard: 'Dashboard', overview: 'Overview', stores: 'Stores', products: 'Products', orders: 'Orders',
      invoices: 'Invoices', customers: 'Customers', cashiers: 'Cashiers', 'delivery-companies': 'Delivery companies',
      chats: 'Chats', messages: 'Messages', jobs: 'Jobs', reports: 'Reports', subscriptions: 'Subscriptions',
      audit: 'Audit log', settings: 'Settings', pos: 'Point of sale', storefront: 'Storefront', checkout: 'Checkout',
      tracking: 'Order tracking', 'my-orders': 'My orders', 'sub-admins': 'Sub-admins', marketing: 'Home',
      search: 'Search', searchPlaceholder: 'Search anything…', save: 'Save', cancel: 'Cancel', delete: 'Delete',
      edit: 'Edit', add: 'Add', view: 'View', details: 'Details', close: 'Close', confirm: 'Confirm',
      yes: 'Yes', no: 'No', all: 'All', active: 'Active', inactive: 'Suspended', status: 'Status', actions: 'Actions',
      name: 'Name', phone: 'Phone', email: 'Email', address: 'Address', city: 'City', date: 'Date',
      total: 'Total', subtotal: 'Subtotal', delivery: 'Delivery', discount: 'Discount', quantity: 'Quantity',
      price: 'Price', stock: 'Stock', category: 'Category', image: 'Image', customerLabel: 'Customer',
      ownerLabel: 'Owner', store: 'Store', role: 'Role', plan: 'Plan', language: 'Language', theme: 'Theme',
      logout: 'Log out', login: 'Sign in', username: 'Username', password: 'Password',
      welcome: 'Welcome', today: 'Today', week: 'This week', month: 'This month', revenue: 'Revenue',
      print: 'Print', export: 'Export', filter: 'Filter', from: 'From', to: 'To', apply: 'Apply', reset: 'Reset',
      loading: 'Loading…', noData: 'No data', noResults: 'No results', accessDenied: 'Access denied',
      accessDeniedText: 'This page is not available for your role. Contact an administrator if you believe this is a mistake.',
      back: 'Back', next: 'Next', previous: 'Previous', copy: 'Copy', copied: 'Copied', refresh: 'Refresh',
      addProduct: 'Add product', editProduct: 'Edit product', addCashier: 'Add cashier', editCashier: 'Edit cashier',
      addStore: 'Add store', addAdmin: 'Add sub-admin', addCompany: 'Add company', addJob: 'Add job',
      viewAll: 'View all', quickActions: 'Quick actions', recentOrders: 'Recent orders', topProducts: 'Top products',
      lowStock: 'Low stock', salesOverview: 'Sales overview', last7: 'Last 7 days', last30: 'Last 30 days',
      vsLast: 'vs. previous period', pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
      delivering: 'On the way', delivered: 'Delivered', cancelled: 'Cancelled', orderId: 'Order ID',
      paymentMethod: 'Payment method', cash: 'Cash', card: 'Card', wallet: 'Wallet', vodafone: 'Vodafone Cash',
      deliveryCompany: 'Delivery company', driver: 'Driver', timeline: 'Order timeline', proof: 'Delivery proof',
      noProof: 'No delivery proof yet', customerInfo: 'Customer info', items: 'Items', summary: 'Summary',
      emptyOrders: 'No orders yet', emptyOrdersText: 'Your first order will appear here with full details.',
      emptyProducts: 'No products yet', emptyProductsText: 'Add your first product to make it visible in the store and POS.',
      emptyCustomers: 'No customers yet', emptyCustomersText: 'Customers appear here after their first order.',
      emptyChats: 'No conversations', emptyChatsText: 'Pick a conversation or start a new one.',
      addFirstProduct: 'Add first product', browseStore: 'Browse store', createOrder: 'Create order',
      outOfStock: 'Out of stock', inStock: 'In stock', low: 'Low', units: 'units',
      profit: 'Profit', avgOrder: 'Average order', completed: 'Completed', rating: 'Rating', fee: 'Fee',
      joined: 'Joined', lastOrder: 'Last order', ordersCount: 'Orders', spent: 'Total spent',
      users: 'Users', permissions: 'Permissions', saveChanges: 'Save changes', profile: 'Profile',
      storeProfile: 'Store profile', notifications: 'Notifications', security: 'Security', preferences: 'Preferences',
      markAllRead: 'Mark all as read', noNotifications: 'No notifications', online: 'Online', offline: 'Offline',
      chatSupport: 'Support', chatPublic: 'Public', chatStores: 'Stores', chatDelivery: 'Delivery companies',
      chatAdminOnly: 'Admins only', chatOwnersOnly: 'Store owners only', chatLocked: 'This channel is not available for your role',
      chatLockedText: 'You can use the channels available to you. This one belongs to another role.',
      sendMessage: 'Write a message…', send: 'Send', you: 'You', support: 'Support',
      chatDirect: 'Store', chatDirectTitle: 'Store chat', chatChannels: 'Channels', chatChannelPick: 'Pick a channel',
      chatDirectHint: 'Chat directly with the store', chatSupportHint: 'The DotStudio® team is here',
      chatPublicHint: 'Everyone can join', chatStoresHint: 'Store owners only',
      chatDeliveryHint: 'Delivery companies & riders', chatOnline: 'Online now',
      chatPick: 'Pick a conversation', chatPickText: 'Choose a channel from the list to start chatting.',
      chatNoRooms: 'No conversations here yet', chatStartConversation: 'Start the conversation',
      chatEmptyHint: 'No messages yet — say hello.', chatSendHint: 'Enter to send · Shift+Enter for a new line',
      chatMessages: 'messages', chatWith: 'with', chatBack: 'Chats',
      storeHeroKicker: 'Fast delivery · Guaranteed quality', storeHeroTitle: 'Everything you love,',
      storeHeroTitleAccent: 'in one place.', storeHeroSub: 'Hand-picked products from the best stores, delivered fast.',
      shopNow: 'Shop now', exploreStore: 'Explore store', trustedBy: 'Trusted by 12,000+ customers',
      freeDelivery: 'Fast delivery', freeDeliveryText: 'In 30–45 minutes across Cairo',
      securePayment: 'Secure payment', securePaymentText: 'Cash · Card · Mobile wallet',
      qualityGuarantee: 'Quality guaranteed', qualityGuaranteeText: 'Authentic products or full refund',
      shopByCategory: 'Shop by category', featuredPicks: 'Store picks', allProducts: 'All products',
      bestSeller: 'Best seller', newArrival: 'New', quickView: 'Quick view',
      addToBag: 'Add to bag', inBag: 'In bag', addedToBag: 'Added to your bag',
      viewBag: 'View bag', itemsInBag: 'items in bag', yourBag: 'Your bag',
      keepShopping: 'Keep shopping', deliveryIn: 'Delivery in', minutes: 'min',
      openNow: 'Open now', closedNow: 'Closed now', storeRating: 'Store rating',
      seeAll: 'See all', resultsFor: 'Results for', noItems: 'No matching products',
      subtotalLabel: 'Subtotal', deliveryLabel: 'Delivery', totalLabel: 'Total',
      checkoutNow: 'Checkout', orderSummaryHint: 'Prices include VAT',
      profileTitle: 'Profile', accountType: 'Account type', storeLabel: 'Store',
      subscriptionTitle: 'Choose the right plan', subscriptionSub: 'Activate your plan on WhatsApp in one step — no internal forms.',
      subscribe: 'Subscribe', currentPlan: 'Your current plan', renew: 'Renew', monthly: 'Monthly', sixMonths: '6 months', sixmonths: '6 months', yearly: 'Yearly',
      perMonth: 'per month', perSix: 'per 6 months', perYear: 'per year', bestValue: 'Best value', mostPopular: 'Most popular',
      planMonthly: 'Monthly plan', planSix: '6-month plan', planYearly: 'Yearly plan', expires: 'Expires', daysLeft: 'days left',
      subscriptionContact: 'You will be redirected to WhatsApp with a ready message including your store name.',
      jobsTitle: 'DotStudio® Careers', jobsSub: 'Join a team building the future of modern commerce.',
      applyNow: 'Apply now', applyFor: 'Apply for', fullTime: 'Full-time', partTime: 'Part-time', remote: 'Remote',
      department: 'Department', location: 'Location', salary: 'Salary', experience: 'Experience', jobDesc: 'Job description',
      requirements: 'Requirements', applicationSent: 'Application sent', applicationSentText: 'Our hiring team will contact you soon.',
      myApplications: 'My applications', noJobs: 'No open positions right now', publicChat: 'Public chat', 'public-chat': 'Public chat',
      storeOpen: 'Open now', viewStore: 'Visit store', continueShopping: 'Continue shopping', placeOrder: 'Place order',
      orderPlaced: 'Order created', orderPlacedText: 'You can track your order live.', trackOrder: 'Track order',
      emptyCart: 'Your cart is empty', emptyCartText: 'Add a few products and they will appear here.', continue: 'Continue', choosePayment: 'Payment method',
      deliveryTo: 'Deliver to', change: 'Change', orderSummary: 'Order summary', confirmOrder: 'Confirm order',
      trackingTitle: 'Track your order', live: 'Live', eta: 'ETA', distance: 'Distance', driverOnWay: 'Your driver is on the way',
      orderDelivered: 'Your order was delivered', orderPending: 'Your order is being reviewed', orderPreparing: 'Your order is being prepared',
      noActiveOrder: 'No active order', noActiveOrderText: 'Create an order from the storefront to track it here.',
      myOrders: 'My orders', orderDate: 'Order date', reorder: 'Reorder', invoice: 'Invoice',
      totalOrders: 'Total orders', activeOrders: 'Active orders', deliveredOrders: 'Delivered', revenueToday: 'Revenue today',
      assigned: 'Assigned', pickedUp: 'Picked up', onTheWay: 'On the way', completedToday: 'Completed today',
      acceptTask: 'Accept', markPicked: 'Picked up', markDelivered: 'Delivered', proofUpload: 'Upload delivery proof',
      proofRequired: 'Attach a photo before marking as delivered.', earnings: 'Earnings', avgTime: 'Average time',
      platformOverview: 'Platform summary', liveActivity: 'Live activity', totalRevenue: 'Total revenue', totalOrdersLabel: 'Total orders',
      totalStores: 'Total stores', totalCustomers: 'Total customers', mrr: 'MRR', arr: 'ARR',
      topStores: 'Top stores', revenueSplit: 'Revenue split', auditLog: 'Audit log', auditSub: 'Every action on the platform is recorded.',
      settingsSub: 'Manage platform or store settings based on your role.', saveSettings: 'Save settings',
      saved: 'Saved successfully', deleted: 'Deleted', updated: 'Updated', created: 'Created',
      confirmDelete: 'Confirm deletion', confirmDeleteText: 'This action cannot be undone. Are you sure?',
      noPermission: 'Permission denied', allStores: 'All stores', allStatuses: 'All statuses', allCompanies: 'All companies',
      filterBy: 'Filter', exportCsv: 'Export CSV', showing: 'Showing', of: 'of', results: 'results',
      thisMonthRevenue: 'This month revenue', monthRevenue: 'Monthly revenue', growth: 'Growth', sinceLastMonth: 'since last month', avgBasket: 'Average basket',
      info: 'Info', platform: 'Platform',
      newCustomers: 'New customers', returning: 'Returning customers', ordersToday: 'Orders today', pendingNow: 'Awaiting action',
      manage: 'Manage', activate: 'Activate', deactivate: 'Suspend', extend: 'Extend', impersonate: 'Impersonate',
      planExpiry: 'Subscription expiry', daysRemaining: 'Days remaining', expired: 'Expired', expiringSoon: 'Expiring soon',
      markPaid: 'Mark as paid', contactWhatsapp: 'WhatsApp', sendWhatsapp: 'Send WhatsApp',
      overviewFor: 'Welcome', workspace: 'Workspace', switchAccount: 'Switch account', profileSettings: 'Account settings',
      commandPalette: 'Command palette', searchAnything: 'Search pages, products, orders…', noCommandResults: 'No matching results',
      navigate: 'Navigate', open: 'Open', closeEsc: 'Close', searchProducts: 'Products', searchPages: 'Pages', searchOrders: 'Orders',
      storeName: 'Store name', storePhone: 'Store phone', storeAddress: 'Store address', storeDesc: 'Store description',
      logoAvatar: 'Store logo', changeAvatar: 'Change avatar', uploadImage: 'Upload image', chooseAvatar: 'Choose your avatar',
      receipt: 'Receipt', printReceipt: 'Print receipt', newSale: 'New sale', clearCart: 'Clear cart',
      customerName: 'Customer name', customerPhone: 'Customer phone', notes: 'Notes', applyDiscount: 'Apply discount',
      paid: 'Paid', change: 'Change', checkout: 'Checkout', cart: 'Cart', item: 'item', empty: 'Empty',
      walkIn: 'Walk-in customer', searchProduct: 'Search products…', noProducts: 'No products in this category',
      todaySales: 'Today sales', transactions: 'Transactions', avgTicket: 'Average ticket', shift: 'Shift',
      addToCart: 'Add to cart', storeClosed: 'Store is closed', storeClosedText: 'This store is not available right now. Try another store.',
      liveOrders: 'Live orders', deliveryChat: 'Delivery chat', deliveryDashboard: 'Driver console',
      assignedOrders: 'Assigned to you', noAssigned: 'No assigned orders', noAssignedText: 'New orders will appear here as soon as they are assigned.',
      mapTitle: 'Tracking map', statusUpdated: 'Order status updated', pickOrder: 'Pick an order to see details',
      loginTitle: 'Welcome back', loginSub: 'Sign in to run your store and keep everything in one place.',
      loginBtn: 'Sign in to dashboard', demoAccounts: 'Demo accounts', useAccount: 'Use', fill: 'Fill',
      invalidLogin: 'Incorrect username or password.', emptyLogin: 'Enter your username and password.',
      loggedIn: 'Signed in successfully', signingIn: 'Signing in…', forgot: 'Forgot password?',
      remember: 'Remember me', secure: 'Secure connection', encrypted: 'Encrypted data', trusted: 'Trusted by thousands of stores',
      liveSupport: 'Live support', heroLine1: 'Run your store', heroLine2: 'smarter.', loginHero: 'One platform. Four stores. Zero complexity.',
      loginHeroSub: 'POS, storefront, delivery, chats and reports — everything you need to run your business beautifully.',
      statStores: 'Active stores', statOrders: 'Orders this month', statUptime: 'Uptime', copyright: 'All rights reserved',
      marketingTitle: 'The complete commerce platform', marketingSub: 'Every modern retail tool in one place — fast, secure, built to grow.',
      features: 'Features', pricing: 'Pricing', startNow: 'Start now', learnMore: 'Learn more', seeDemo: 'Live demo',
      featurePos: 'Lightning POS', featurePosText: 'A cashier experience that works in one tap, with barcode and split payments.',
      featureStore: 'Storefront', featureStoreText: 'A beautiful storefront for every brand with cart, checkout and delivery.',
      featureTracking: 'Live tracking', featureTrackingText: 'A real-time driver map with accurate ETA and automatic updates.',
      featureChat: 'Unified inbox', featureChatText: 'Support, customers, stores and delivery companies in one inbox.',
      featureReports: 'Smart reports', featureReportsText: 'Profit, stock and team performance in clear, exportable dashboards.',
      featureSecurity: 'Enterprise security', featureSecurityText: 'Strict tenant isolation, granular permissions and a full audit trail.',
      finalCta: 'Ready to take your store to the next level?', finalCtaText: 'Try DotStudio® POS now with a demo account — no setup required.',
      footerRights: 'All rights reserved.',
      error: 'Something went wrong', retry: 'Retry', required: 'This field is required', invalidPhone: 'Invalid phone number',
      addedToCart: 'Added to cart', removedFromCart: 'Removed from cart', copiedLink: 'Link copied',
      orderCancelled: 'Order cancelled', orderConfirmed: 'Order confirmed', orderDelivering: 'Order is on the way',
      orderDeliveredMsg: 'Order delivered successfully', orderCreated: 'Order created successfully',
      userSaved: 'User saved', productSaved: 'Product saved', storeSaved: 'Store saved',
      companySaved: 'Delivery company saved', settingsSaved: 'Settings saved', passwordCopied: 'Password copied',
      selectStore: 'Select store', allRights: 'All rights reserved', builtBy: 'Built by DotStudio®',
      version: 'Version', dateRange: 'Date range', applyFilter: 'Apply', clearFilter: 'Clear',
      viewDetails: 'View details', noCompany: 'No company', unassigned: 'Unassigned', storeInfo: 'Store info',
      totalSpent: 'Total spent', lastSeen: 'Last seen', suspend: 'Suspend', restore: 'Restore',
      permissionsHint: 'Choose the pages this sub-admin can access.',
      catalog: 'Catalogue', filters: 'Filters', sortNewest: 'Newest', sortPrice: 'Price', sortName: 'Name',
      searchInStore: 'Search the store…', added: 'Added', out: 'Out', lowStockShort: 'Low'
    }
  };

  function lang() {
    try {
      var stored = localStorage.getItem('lang') || localStorage.getItem(LS_LANG);
      return stored === 'en' ? 'en' : 'ar';
    } catch (e) { return 'ar'; }
  }
  DS.lang = lang;

  function t(key, vars) {
    /* Nested APPLE 2026 tables (shared/js/i18n.js) take dotted paths. */
    if (key && String(key).indexOf('.') > -1 && window.translations) {
      var nested = window.translations[lang()] || {};
      var parts = String(key).split('.');
      var node = nested;
      for (var i = 0; i < parts.length && node != null; i++) node = node[parts[i]];
      if (node == null) {
        node = window.translations.ar || {};
        for (var j = 0; j < parts.length && node != null; j++) node = node[parts[j]];
      }
      if (typeof node === 'string') {
        var out = node;
        if (vars) Object.keys(vars).forEach(function (k) { out = out.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); });
        return out;
      }
    }
    var table = I18N[lang()] || I18N.ar;
    var str = table[key];
    if (str == null) str = I18N.ar[key];
    if (str == null) str = key;
    if (vars) {
      Object.keys(vars).forEach(function (k) { str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]); });
    }
    return str;
  }
  DS.t = t;
  DS.t2 = function (ar, en) { return lang() === 'ar' ? ar : en; };

  function applyLangAttrs() {
    var l = lang();
    document.documentElement.setAttribute('lang', l);
    document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('data-lang', l);
    if (document.body) {
      document.body.classList.toggle('lang-ar', l === 'ar');
      document.body.classList.toggle('lang-en', l === 'en');
      document.body.setAttribute('data-lang', l);
    }
  }
  DS.applyLangAttrs = applyLangAttrs;

  function setLang(next) {
    next = next === 'en' ? 'en' : 'ar';
    try {
      localStorage.setItem(LS_LANG, next);
      localStorage.setItem('lang', next);
    } catch (e) {}
    if (typeof window.applyLanguage === 'function') {
      window.applyLanguage(next, { silent: true });
    }
    applyLangAttrs();
    DS.$$('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (!key) return;
      var target = el.getAttribute('data-i18n-target');
      var value = t(key);
      if (value === key) return;
      if (target) el.setAttribute(target, value);
      else el.textContent = value;
    });
    DS.$$('[data-i18n-ph], [data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-ph') || el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });
    document.dispatchEvent(new CustomEvent('ds:lang', { detail: { lang: next } }));
    if (DS.page && typeof DS.page.render === 'function') {
      try { DS.page.render(); } catch (e) { console.error('[DS] page render failed', e); }
    }
  }
  DS.setLang = setLang;
  DS.toggleLang = function () { setLang(lang() === 'ar' ? 'en' : 'ar'); };

  /* ───────────────────────────── THEME ─────────────────────────────── */
  function theme() { try { return localStorage.getItem(LS_THEME) === 'light' ? 'light' : 'dark'; } catch (e) { return 'dark'; } }
  function applyTheme() { document.documentElement.setAttribute('data-theme', theme()); }
  DS.theme = theme;
  DS.applyTheme = applyTheme;
  DS.toggleTheme = function () {
    var next = theme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(LS_THEME, next); } catch (e) {}
    applyTheme();
    document.dispatchEvent(new CustomEvent('ds:theme', { detail: { theme: next } }));
    if (DS.page && typeof DS.page.render === 'function') { try { DS.page.render(); } catch (e) {} }
  };

  /* ───────────────────────────── SESSION ───────────────────────────── */
  function session() {
    try {
      var user = JSON.parse(localStorage.getItem('cz_user') || 'null');
      if (user && !user.role && user.username && DS.data && DS.data.users) {
        /* Legacy sessions (old login only stored {username}). Hydrate the full
           profile from the seeded database so routing, avatars and tenant
           isolation keep working instead of bouncing the user to the login. */
        var seeded = DS.data.users.filter(function (u) { return String(u.username).toLowerCase() === String(user.username).toLowerCase(); })[0];
        if (seeded) {
          var clean = Object.assign({}, seeded);
          delete clean.password;
          user = Object.assign(clean, user, { role: clean.role, name: clean.name, name_en: clean.name_en, tenant_id: clean.tenant_id || user.tenant_id });
          try {
            localStorage.setItem('cz_user', JSON.stringify(user));
            localStorage.setItem('cz_role', user.role);
            if (user.id) localStorage.setItem('cz_session', user.id);
          } catch (e) {}
        }
      }
      if (user && user.role) {
        if (!user.tenant_id && user.role === 'owner') {
          var tn = (DS.data && DS.data.tenants || []).filter(function (x) { return x.owner_username === user.username; })[0];
          if (tn) user.tenant_id = tn.id;
        }
        return user;
      }
    } catch (e) {}
    return null;
  }
  DS.session = session;

  function roleHome(user) {
    user = user || session();
    if (!user) return 'index.html';
    if (user.role === 'superadmin' || user.role === 'subadmin') return 'admin/dashboard.html';
    if (user.role === 'owner') return 'owner/dashboard.html';
    if (user.role === 'cashier') return 'cashier/pos.html';
    if (user.role === 'delivery') return 'delivery/dashboard.html';
    return 'customer/storefront.html';
  }
  DS.roleHome = roleHome;

  function requireAuth(roles) {
    var user = session();
    if (!user) { window.location.replace(url('index.html')); return null; }
    if (roles && roles.length && roles.indexOf(user.role) === -1) {
      window.location.replace(url(roleHome(user)));
      return null;
    }
    return user;
  }
  DS.requireAuth = requireAuth;

  DS.logout = function (silent) {
    ['cz_session', 'cz_user', 'cz_role', 'cz_mock', 'ds_permissions'].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    if (!silent) window.location.href = url('index.html');
  };

  /* Apply language/theme immediately */
  applyLangAttrs();
  applyTheme();

  /* ───────────────────────────── TOASTS ────────────────────────────── */
  var ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    store: '<path d="m2 7 2-4h16l2 4"/><path d="M2 7h20v3a4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1-4 4"/><path d="M4 14v6h16v-6"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    orders: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    cart: '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2 3h2.2l2.3 11.2a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.55L21 7H6"/>',
    bag: '<path d="M6 8h12l1.2 12.2a1.5 1.5 0 0 1-1.5 1.8H6.3a1.5 1.5 0 0 1-1.5-1.8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    heart: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
    spark: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    cashier: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h2M12 15h5"/>',
    truck: '<path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    jobs: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    chartBar: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="4" width="3" height="14"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61M2 2l20 20"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    arrowLeft: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    arrowUpRight: '<path d="M7 17 17 7M7 7h10v10"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.84Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4M3 5h4M19 17v4M17 19h4"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
    bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6h4l-2 6M5.5 17.5 9 8h5l2 5.5M9 8H6"/>',
    navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    trendingUp: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    trendingDown: '<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.15-.29-.3-.46-.7-.46-1.16 0-.93.75-1.69 1.69-1.69H16c3.31 0 6-2.69 6-6 0-4.96-4.5-9-10-9z"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    fingerprint: '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4M14 13.12c0 2.38 0 6.38-1 8.88M17.29 21.02c.12-.6.43-2.3.5-3.02M2 12a10 10 0 0 1 18-6M2 16h.01M21.8 16c.2-2 .131-5.354 0-6M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2M8.65 22c.21-.66.45-1.32.57-2M9 6.8a6 6 0 0 1 9 5.2v2"/>',
    wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    whatsapp: '<path d="M3 21l1.65-4.95A8 8 0 1 1 8 19.34L3 21z"/><path d="M8.5 8.5c.5 2.5 2 4 4.5 4.5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    building: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 22V12h6v10M9 7h.01M15 7h.01M9 11h.01M15 11h.01"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    checkSquare: '<path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    archive: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>'
  };

  function icon(name, cls) {
    var svg = ICONS[name] || ICONS.info;
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + svg + '</svg>';
  }
  DS.icon = icon;
  DS.icons = ICONS;

  function toast(message, type, title) {
    type = type || 'info';
    var stack = $('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    var ico = type === 'success' ? 'checkCircle' : type === 'error' ? 'alert' : type === 'warning' ? 'alert' : 'info';
    el.innerHTML = '<div class="toast-icon">' + icon(ico) + '</div>' +
      '<div class="toast-body"><div class="toast-title">' + esc(title || (type === 'success' ? t('saved') : type === 'error' ? t('error') : t('info'))) + '</div>' +
      '<div class="toast-msg">' + esc(message) + '</div></div>' +
      '<button class="toast-x" aria-label="close">' + icon('x') + '</button>';
    stack.appendChild(el);
    var remove = function () {
      if (!el.parentNode) return;
      el.style.transition = 'opacity .2s, transform .2s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    };
    el.querySelector('.toast-x').addEventListener('click', remove);
    setTimeout(remove, type === 'error' ? 5200 : 3400);
  }
  DS.toast = toast;
  DS.showToast = toast;
  window.showToast = toast;

  /* Compact Apple-style confirmation pill (used by the storefront add-to-cart). */
  function pillToast(message, opts) {
    opts = opts || {};
    var host = $('.ds-pill-stack');
    if (!host) {
      host = document.createElement('div');
      host.className = 'ds-pill-stack';
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'ds-pill-toast';
    el.innerHTML = (opts.image ? '<img src="' + attr(opts.image) + '" alt="">' : '<span class="pt-ico">' + icon(opts.icon || 'check') + '</span>') +
      '<span class="pt-text"><b>' + esc(message || t('addedToCart')) + '</b>' + (opts.sub ? '<small>' + esc(opts.sub) + '</small>' : '') + '</span>' +
      (opts.action ? '<button type="button" class="pt-action">' + esc(opts.action) + '</button>' : '');
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('in'); });
    var remove = function () {
      el.classList.remove('in');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    };
    if (opts.action && opts.onAction) {
      el.querySelector('.pt-action').addEventListener('click', function () { opts.onAction(); remove(); });
    }
    setTimeout(remove, opts.duration || 2400);
    return el;
  }
  DS.pillToast = pillToast;

  /* ───────────────────────────── MODALS ───────────────────────────── */
  var openModals = [];

  function modal(opts) {
    opts = opts || {};
    var size = opts.size ? ' ' + opts.size : '';
    var dismissible = opts.dismissible !== false;
    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    var actions = (opts.actions || []).map(function (a, i) {
      return '<button type="button" class="btn ' + (a.variant || 'btn-secondary') + '" data-action="' + i + '"' + (a.disabled ? ' disabled' : '') + '>' + (a.icon || '') + esc(a.label) + '</button>';
    }).join('');
    backdrop.innerHTML =
      '<div class="modal' + size + '">' +
        '<div class="modal-head"><div><div class="modal-title">' + (opts.title || '') + '</div>' +
          (opts.sub ? '<div class="modal-sub">' + opts.sub + '</div>' : '') + '</div>' +
          (dismissible ? '<button type="button" class="modal-close" data-close aria-label="close">' + icon('x') + '</button>' : '') +
        '</div>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        (actions ? '<div class="modal-foot">' + (opts.footLeft || '') + '<div class="spacer"></div>' + actions + '</div>' : (opts.footLeft ? '<div class="modal-foot">' + opts.footLeft + '</div>' : '')) +
      '</div>';
    document.body.appendChild(backdrop);
    document.body.classList.add('modal-open');
    openModals.push(backdrop);

    function close() {
      var idx = openModals.indexOf(backdrop);
      if (idx > -1) openModals.splice(idx, 1);
      backdrop.style.opacity = '0';
      backdrop.style.transition = 'opacity .15s';
      setTimeout(function () {
        if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
        if (!openModals.length) document.body.classList.remove('modal-open');
      }, 150);
      if (opts.onClose) try { opts.onClose(); } catch (e) {}
    }

    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop && dismissible) close();
    });
    backdrop.querySelectorAll('[data-close]').forEach(function (btn) { btn.addEventListener('click', close); });
    backdrop.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = opts.actions[Number(btn.getAttribute('data-action'))];
        if (!a) return;
        var res = a.onClick ? a.onClick(backdrop, close) : null;
        if (res !== false && a.close !== false) close();
      });
    });
    if (opts.onMount) setTimeout(function () { try { opts.onMount(backdrop, close); } catch (e) { console.error(e); } }, 0);

    setTimeout(function () {
      var input = backdrop.querySelector('input:not([type=hidden]),textarea,select');
      if (input && opts.autofocus !== false) input.focus();
    }, 60);

    return { el: backdrop, close: close };
  }
  DS.modal = modal;

  function confirm(opts) {
    if (typeof opts === 'string') opts = { text: opts };
    return new Promise(function (resolve) {
      var handled = false;
      var m = modal({
        size: 'sm',
        title: opts.title || t('confirm'),
        body: '<div style="font-size:var(--fs-md);color:var(--text-secondary);line-height:1.7">' + esc(opts.text || t('confirmDeleteText')) + '</div>',
        actions: [
          { label: opts.cancelText || t('cancel'), variant: 'btn-secondary', onClick: function () { handled = true; resolve(false); } },
          { label: opts.confirmText || t('confirm'), variant: opts.danger === false ? 'btn-primary' : 'btn-danger', onClick: function () { handled = true; resolve(true); } }
        ],
        onClose: function () { if (!handled) resolve(false); }
      });
      m.el.querySelector('[data-action="1"]').focus();
    });
  }
  DS.confirm = confirm;

  /* ─────────────────────────── AVATAR PICKER ───────────────────────── */
  var AVATARS = ['av1', 'av2', 'av3', 'av4', 'av5', 'av6', 'av7', 'av8', 'av9'].map(function (id) {
    return { id: id, file: 'assets/img/avatars/' + id + '.jpg' };
  });
  DS.avatars = AVATARS;

  function currentAvatarUrl(entity) {
    entity = entity || session() || {};
    var custom = entity.avatar_custom;
    if (typeof custom === 'string' && custom.indexOf('data:') === 0) return custom;
    if (entity.avatar && typeof entity.avatar === 'string') {
      if (/^(data:|https?:)/.test(entity.avatar)) return entity.avatar;
      if (entity.avatar.indexOf('avatars/') === 0) return url('assets/img/' + entity.avatar);
      if (entity.avatar.indexOf('assets/') === 0) return url(entity.avatar);
    }
    if (entity.avatar_id) return url('assets/img/avatars/' + entity.avatar_id + '.jpg');
    return url('assets/img/avatars/av1.jpg');
  }
  DS.avatarUrl = currentAvatarUrl;

  function avatarPicker() {
    var user = session();
    if (!user) return;
    var isOwner = user.role === 'owner';
    var tenant = isOwner && DS.data ? DS.data.tenantById(user.tenant_id) : null;
    var current = tenant || user;
    var html = '<div class="av-grid" id="avGrid">' +
      AVATARS.map(function (a) {
        var selected = (current.avatar_id === a.id && !current.avatar_custom) ? ' selected' : '';
        return '<button type="button" class="av-opt' + selected + '" data-avatar="' + a.id + '"><img src="' + url(a.file) + '" alt="' + a.id + '" loading="lazy"></button>';
      }).join('') +
      '<label class="av-opt upload' + (current.avatar_custom ? ' selected' : '') + '" for="dsAvatarUpload" title="' + esc(t('uploadImage')) + '">' + icon('plus') + '</label>' +
    '</div>' +
    '<input type="file" id="dsAvatarUpload" accept="image/*" hidden>' +
    '<p class="hint" style="margin-top:10px">' + esc(t('uploadImage')) + ' · PNG / JPG · ≤ 500KB</p>';

    var m = modal({
      title: t('chooseAvatar'),
      body: html,
      actions: [{ label: t('close'), variant: 'btn-secondary' }],
      onMount: function (root) {
        root.querySelectorAll('[data-avatar]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-avatar');
            var file = 'avatars/' + id + '.jpg';
            if (tenant && DS.data) DS.data.saveTenant({ id: tenant.id, avatar_id: id, avatar_custom: null });
            if (DS.data) DS.data.saveUser({ id: user.id, avatar_id: id, avatar_custom: null, avatar: file });
            user.avatar_id = id; user.avatar_custom = null; user.avatar = file;
            localStorage.setItem('cz_user', JSON.stringify(user));
            m.close();
            toast(t('saved'), 'success');
            if (DS.shell && DS.shell.refreshUser) DS.shell.refreshUser();
            if (DS.page && DS.page.render) DS.page.render();
          });
        });
        var fileInput = root.querySelector('#dsAvatarUpload');
        fileInput.addEventListener('change', function () {
          var file = fileInput.files && fileInput.files[0];
          if (!file) return;
          if (file.size > 500 * 1024) { toast(t('uploadImage') + ' ≤ 500KB', 'error'); fileInput.value = ''; return; }
          var reader = new FileReader();
          reader.onload = function (ev) {
            var data = ev.target.result;
            if (tenant && DS.data) DS.data.saveTenant({ id: tenant.id, avatar_custom: data, avatar_id: null });
            if (DS.data) DS.data.saveUser({ id: user.id, avatar_custom: data, avatar_id: null, avatar: data });
            user.avatar_custom = data; user.avatar_id = null; user.avatar = data;
            localStorage.setItem('cz_user', JSON.stringify(user));
            m.close();
            toast(t('saved'), 'success');
            if (DS.shell && DS.shell.refreshUser) DS.shell.refreshUser();
            if (DS.page && DS.page.render) DS.page.render();
          };
          reader.readAsDataURL(file);
        });
      }
    });
    return m;
  }
  DS.avatarPicker = avatarPicker;

  /* ────────────────────────── COMMAND PALETTE ─────────────────────── */
  function commandPalette() {
    if ($('.cmd-backdrop')) return;
    var backdrop = document.createElement('div');
    backdrop.className = 'cmd-backdrop';
    backdrop.innerHTML =
      '<div class="cmd" role="dialog" aria-modal="true">' +
        '<div class="cmd-input">' + icon('search') + '<input id="cmdInput" autocomplete="off" spellcheck="false" placeholder="' + esc(t('searchAnything')) + '"><span class="kbd">ESC</span></div>' +
        '<div class="cmd-list" id="cmdList"></div>' +
        '<div class="cmd-foot"><span>' + icon('arrowUpRight') + ' ' + esc(t('navigate')) + '</span><span><span class="kbd">↑</span><span class="kbd">↓</span> ' + esc(t('navigate')) + ' · <span class="kbd">↵</span> ' + esc(t('open')) + '</span></div>' +
      '</div>';
    document.body.appendChild(backdrop);
    var input = backdrop.querySelector('#cmdInput');
    var list = backdrop.querySelector('#cmdList');
    var active = 0;
    var items = [];

    function gather(q) {
      q = (q || '').trim().toLowerCase();
      var out = [];
      var nav = (DS.shell && DS.shell.getNavItems) ? DS.shell.getNavItems() : [];
      nav.filter(function (n) {
        return !q || (n.label || '').toLowerCase().indexOf(q) > -1 || (n.key || '').toLowerCase().indexOf(q) > -1;
      }).slice(0, 6).forEach(function (n) {
        out.push({ group: t('searchPages'), title: n.label, sub: n.sub || '', href: n.href, icon: n.icon, type: 'page' });
      });
      if (DS.data) {
        var user = session();
        var products = DS.data.visibleProducts(user);
        products.filter(function (p) {
          return q && (String(p.name).toLowerCase().indexOf(q) > -1 || String(p.name_en || '').toLowerCase().indexOf(q) > -1 || String(p.sku || '').toLowerCase().indexOf(q) > -1);
        }).slice(0, 5).forEach(function (p) {
          out.push({ group: t('searchProducts'), title: (lang() === 'ar' ? p.name : (p.name_en || p.name)), sub: DS.money(p.price) + ' · ' + (p.category || ''), img: p.image, type: 'product', product: p });
        });
        var orders = DS.data.visibleOrders(user);
        orders.filter(function (o) { return q && (String(o.order_no).toLowerCase().indexOf(q) > -1 || String(o.customer && o.customer.name || '').toLowerCase().indexOf(q) > -1); }).slice(0, 4).forEach(function (o) {
          out.push({ group: t('searchOrders'), title: o.order_no, sub: (o.customer ? o.customer.name : '') + ' · ' + DS.money(o.total), icon: 'receipt', type: 'order', order: o });
        });
      }
      return out;
    }

    function render() {
      var q = input.value;
      items = gather(q);
      if (!items.length) { list.innerHTML = '<div class="cmd-empty">' + esc(t('noCommandResults')) + '</div>'; return; }
      var groups = {};
      items.forEach(function (it, i) { (groups[it.group] = groups[it.group] || []).push({ it: it, i: i }); });
      var html = '';
      Object.keys(groups).forEach(function (g) {
        html += '<div class="cmd-group">' + esc(g) + '</div>';
        groups[g].forEach(function (x) {
          var it = x.it;
          html += '<button class="cmd-item' + (x.i === active ? ' active' : '') + '" data-index="' + x.i + '">' +
            '<span class="ci-icon">' + (it.img ? '<img src="' + attr(DS.data.img(it.img)) + '" alt="">' : icon(it.icon || 'file')) + '</span>' +
            '<span class="ci-main"><span class="ci-title">' + esc(it.title) + '</span><span class="ci-sub">' + esc(it.sub || '') + '</span></span>' +
            '<span class="kbd">↵</span></button>';
        });
      });
      list.innerHTML = html;
      list.querySelectorAll('.cmd-item').forEach(function (btn) {
        btn.addEventListener('click', function () { select(Number(btn.getAttribute('data-index'))); });
        btn.addEventListener('mouseenter', function () { active = Number(btn.getAttribute('data-index')); highlight(); });
      });
    }

    function highlight() {
      list.querySelectorAll('.cmd-item').forEach(function (btn) {
        btn.classList.toggle('active', Number(btn.getAttribute('data-index')) === active);
      });
      var el = list.querySelector('.cmd-item.active');
      if (el) el.scrollIntoView({ block: 'nearest' });
    }

    function close() {
      backdrop.style.opacity = '0';
      backdrop.style.transition = 'opacity .12s';
      setTimeout(function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }, 120);
      document.removeEventListener('keydown', onKey, true);
    }

    function select(i) {
      var item = items[i];
      if (!item) return;
      close();
      if (item.type === 'order') { if (DS.openOrder) DS.openOrder(item.order.id); return; }
      if (item.type === 'product') {
        if (window.location.pathname.indexOf('/owner/') > -1 || window.location.pathname.indexOf('/cashier/') > -1) {
          location.href = 'products.html';
        } else {
          location.href = (DS.shell && DS.shell.hrefFor) ? DS.shell.hrefFor('products') : 'products.html';
        }
        return;
      }
      if (item.href) window.location.href = item.href;
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); highlight(); }
      else if (e.key === 'Enter') { e.preventDefault(); select(active); }
    }

    input.addEventListener('input', function () { active = 0; render(); });
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey, true);
    render();
    setTimeout(function () { input.focus(); }, 30);
  }
  DS.commandPalette = commandPalette;

  /* Global shortcut */
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      commandPalette();
    }
    if (e.key === 'Escape' && openModals.length) {
      var top = openModals[openModals.length - 1];
      var closeBtn = top.querySelector('[data-close]');
      if (closeBtn) closeBtn.click();
    }
  });

  /* ───────────────────────────── UI HELPERS ───────────────────────── */
  DS.empty = function (opts) {
    opts = opts || {};
    return '<div class="empty-state">' +
      '<div class="empty-icon">' + icon(opts.icon || 'box') + '</div>' +
      '<div class="empty-title">' + esc(opts.title || t('noData')) + '</div>' +
      '<div class="empty-text">' + esc(opts.text || '') + '</div>' +
      (opts.cta ? '<div class="empty-actions"><button class="btn btn-primary" onclick="' + attr(opts.cta.onclick || '') + '">' + icon(opts.cta.icon || 'plus') + esc(opts.cta.label) + '</button></div>' : '') +
    '</div>';
  };

  DS.skeleton = {
    grid: function (n) {
      var html = '<div class="skeleton-grid">';
      for (var i = 0; i < (n || 6); i++) html += '<div class="skeleton-card"><div class="skeleton" style="aspect-ratio:1;border-radius:10px"></div><div class="skeleton skeleton-line w-75"></div><div class="skeleton skeleton-line w-50"></div></div>';
      return html + '</div>';
    },
    rows: function (n) {
      var html = '<div class="skeleton-table">';
      for (var i = 0; i < (n || 6); i++) html += '<div class="skeleton-row"><div class="skeleton circle" style="width:36px;height:36px"></div><div class="skeleton skeleton-line" style="width:' + (26 + Math.random() * 34) + '%"></div><div class="skeleton skeleton-line" style="width:14%"></div><div class="skeleton skeleton-line" style="width:10%;margin-inline-start:auto"></div></div>';
      return html + '</div>';
    },
    cards: function (n) {
      var html = '<div class="kpi-grid">';
      for (var i = 0; i < (n || 4); i++) html += '<div class="skeleton-card"><div class="skeleton skeleton-line w-30"></div><div class="skeleton skeleton-line w-50" style="height:26px"></div><div class="skeleton skeleton-line w-75"></div></div>';
      return html + '</div>';
    }
  };

  DS.badge = function (status, label) {
    var map = {
      pending: 'warning', confirmed: 'info', preparing: 'orange', delivering: 'lime', delivered: 'success', cancelled: 'danger',
      active: 'success', inactive: 'neutral', suspended: 'danger', expired: 'danger', paid: 'success', unpaid: 'warning',
      owner: 'lime', cashier: 'info', delivery: 'purple', customer: 'neutral', superadmin: 'lime', subadmin: 'purple'
    };
    return '<span class="badge ' + (map[status] || 'neutral') + '">' + (map[status] ? '<i class="dot"></i>' : '') + esc(label || t(status) || status) + '</span>';
  };

  DS.statusMeta = function (status) {
    var map = {
      pending: { label: t('pending'), badge: 'warning', icon: 'clock', step: 0, pct: 12 },
      confirmed: { label: t('confirmed'), badge: 'info', icon: 'checkCircle', step: 1, pct: 30 },
      preparing: { label: t('preparing'), badge: 'orange', icon: 'package', step: 2, pct: 52 },
      delivering: { label: t('delivering'), badge: 'lime', icon: 'bike', step: 3, pct: 78 },
      delivered: { label: t('delivered'), badge: 'success', icon: 'checkCircle', step: 4, pct: 100 },
      cancelled: { label: t('cancelled'), badge: 'danger', icon: 'x', step: -1, pct: 0 }
    };
    return map[status] || map.pending;
  };

  DS.statusFlow = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered'];

  DS.copy = function (text) {
    var done = function () { toast(t('copied'), 'success'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(text)).then(done).catch(function () { fallback(); });
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = String(text); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast(t('error'), 'error'); }
      document.body.removeChild(ta);
    }
  };

  DS.qs = function (key) {
    try { return new URLSearchParams(location.search).get(key); } catch (e) { return null; }
  };

  DS.download = function (filename, content, mime) {
    var blob = new Blob(['\ufeff' + content], { type: mime || 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  DS.csv = function (rows) {
    return rows.map(function (row) {
      return row.map(function (cell) {
        var v = cell == null ? '' : String(cell);
        return '"' + v.replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');
  };

  DS.safeImage = function (src, fallback) {
    var f = fallback || url('assets/product-placeholder.svg');
    return 'onerror="this.onerror=null;this.src=\'' + attr(f) + '\'"';
  };

  /* Audit shortcut */
  DS.audit = function (action, detail) {
    if (DS.data && DS.data.audit) DS.data.audit(action, detail);
  };

  console.log('%cDotStudio® POS · core ready', 'color:#82FF1F;font-weight:bold');
})();
