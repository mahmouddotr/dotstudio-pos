/* ═══════════════════════════════════════════════════════════════
   DotStudio® POS — APPLE 2026 i18n
   Global nested translation tables (AR/EN) + language switching.
   Standalone: loads in <head> before core.js and never depends on DS.

   Usage
   -----
   translations.ar.nav.dashboard            → direct table access
   DS.t('nav.dashboard') / window.dsT(...)  → dotted lookup
   applyLanguage('en')                      → switch + re-render DOM
   <span data-i18n="nav.dashboard">…</span>
   <input data-i18n-placeholder="login.usernamePlaceholder">
   <button data-set-lang="en">EN</button>
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var translations = {
    /* ───────────────────────────── العربية ───────────────────────────── */
    ar: {
      nav: {
        dashboard: 'لوحة التحكم', stores: 'المتاجر', products: 'المنتجات', orders: 'الطلبات',
        invoices: 'الفواتير', customers: 'العملاء', cashiers: 'الكاشير', deliveryCompanies: 'شركات التوصيل',
        chats: 'المحادثات', messages: 'الرسائل', jobs: 'الوظائف', reports: 'التقارير',
        subscriptions: 'الاشتراكات', audit: 'سجل النشاط', settings: 'الإعدادات', pos: 'نقطة البيع',
        storefront: 'المتجر', checkout: 'إتمام الطلب', tracking: 'تتبع الطلب', myOrders: 'طلباتي',
        subAdmins: 'المشرفون', marketing: 'الرئيسية', publicChat: 'المحادثة العامة',
        logout: 'تسجيل الخروج', workspace: 'مساحة العمل', operations: 'العمليات', growth: 'النمو',
        communication: 'التواصل', team: 'الفريق', system: 'النظام', community: 'المجتمع'
      },
      login: {
        title: 'مرحباً بك', subtitle: 'سجّل الدخول لإدارة متجرك ومتابعة كل شيء من مكان واحد.',
        username: 'اسم المستخدم', password: 'كلمة المرور',
        usernamePlaceholder: 'أدخل اسم المستخدم', passwordPlaceholder: 'أدخل كلمة المرور',
        signIn: 'تسجيل الدخول', signingIn: 'جارٍ تسجيل الدخول…', remember: 'تذكرني',
        forgot: 'نسيت كلمة المرور؟', welcomeBack: 'مرحباً بعودتك',
        demoTitle: 'حسابات تجريبية', showAll: 'عرض الكل', hideAll: 'إخفاء',
        allAccounts: 'كل الحسابات التجريبية', fillHint: 'اضغط أي حساب لتعبئة النموذج.',
        errorEmpty: 'من فضلك أدخل اسم المستخدم وكلمة المرور.',
        errorInvalid: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
        errorSuspended: 'هذا الحساب موقوف. تواصل مع الدعم.',
        secure: 'اتصال آمن', encrypted: 'بيانات مشفرة', trusted: 'موثوق من آلاف المتاجر',
        sessionActive: 'مسجل الدخول بالفعل', continue: 'متابعة', switchAccount: 'تبديل',
        signedOut: 'تم تسجيل الخروج. اختر حساباً بالأسفل.', welcome: 'أهلاً',
        tagline: 'نقطة بيع، متجر إلكتروني، توصيل، محادثات وتقارير — كل ما تحتاجه لإدارة تجارتك بتجربة واحدة أنيقة.',
        copyright: 'صُنع بواسطة DotStudio®'
      },
      common: {
        search: 'بحث', searchPlaceholder: 'ابحث عن أي شيء…', save: 'حفظ', saveChanges: 'حفظ التغييرات',
        cancel: 'إلغاء', delete: 'حذف', edit: 'تعديل', add: 'إضافة', view: 'عرض', viewAll: 'عرض الكل',
        details: 'تفاصيل', close: 'إغلاق', confirm: 'تأكيد', yes: 'نعم', no: 'لا', all: 'الكل',
        active: 'نشط', inactive: 'موقوف', status: 'الحالة', actions: 'إجراءات', name: 'الاسم',
        phone: 'الهاتف', email: 'البريد', address: 'العنوان', city: 'المدينة', date: 'التاريخ',
        total: 'الإجمالي', subtotal: 'المجموع', delivery: 'التوصيل', discount: 'الخصم',
        quantity: 'الكمية', price: 'السعر', stock: 'المخزون', category: 'الفئة', image: 'الصورة',
        customer: 'العميل', owner: 'المالك', store: 'المتجر', role: 'الدور', plan: 'الباقة',
        language: 'اللغة', theme: 'المظهر', logout: 'تسجيل الخروج', login: 'تسجيل الدخول',
        username: 'اسم المستخدم', password: 'كلمة المرور', welcome: 'أهلاً', today: 'اليوم',
        week: 'هذا الأسبوع', month: 'هذا الشهر', revenue: 'الإيرادات', print: 'طباعة',
        export: 'تصدير', filter: 'تصفية', from: 'من', to: 'إلى', apply: 'تطبيق', reset: 'إعادة تعيين',
        loading: 'جارٍ التحميل…', noData: 'لا توجد بيانات', noResults: 'لا توجد نتائج',
        accessDenied: 'لا تملك صلاحية الوصول', back: 'رجوع', next: 'التالي', previous: 'السابق',
        copy: 'نسخ', copied: 'تم النسخ', refresh: 'تحديث', open: 'فتح', required: 'مطلوب',
        of: 'من', results: 'نتيجة', showing: 'عرض', saved: 'تم الحفظ', deleted: 'تم الحذف',
        updated: 'تم التحديث', created: 'تم الإنشاء', confirmDelete: 'تأكيد الحذف',
        confirmDeleteText: 'هذا الإجراء لا يمكن التراجع عنه. هل أنت متأكد؟', noNotifications: 'لا توجد إشعارات',
        notifications: 'الإشعارات', profile: 'الملف الشخصي', profileSettings: 'إعدادات الملف',
        changeAvatar: 'تغيير الصورة', preferences: 'التفضيلات', security: 'الأمان', notes: 'ملاحظات',
        optional: 'اختياري', new: 'جديد', live: 'مباشر', minute: 'دقيقة', km: 'كم', currency: 'ج.م'
      },
      dashboard: {
        overview: 'نظرة عامة', platformOverview: 'ملخص المنصة', welcome: 'أهلاً',
        goodMorning: 'صباح الخير', goodAfternoon: 'مساء الخير', goodEvening: 'مساء النور',
        monthRevenue: 'إيرادات الشهر', ordersToday: 'طلبات اليوم', avgOrder: 'متوسط الطلب',
        lowStock: 'مخزون منخفض', activeOrders: 'طلبات جارية', delivered: 'تم التسليم',
        rating: 'التقييم', expiringSoon: 'اشتراكك ينتهي قريباً', daysRemaining: 'الأيام المتبقية',
        renew: 'تجديد', viewStore: 'زيارة المتجر', quickActions: 'إجراءات سريعة',
        recentOrders: 'أحدث الطلبات', topProducts: 'الأكثر مبيعاً', salesOverview: 'نظرة على المبيعات',
        last7: 'آخر 7 أيام', last30: 'آخر 30 يوم', liveActivity: 'النشاط اللحظي',
        revenueSplit: 'توزيع الإيرادات', totalRevenue: 'إجمالي الإيرادات', totalOrders: 'إجمالي الطلبات',
        totalStores: 'إجمالي المتاجر', totalCustomers: 'إجمالي العملاء', mrr: 'الإيراد الشهري',
        arr: 'الإيراد السنوي', auditLog: 'سجل النشاط', thisMonthRevenue: 'إيرادات هذا الشهر',
        runningSmoothly: 'متجرك شغّال بكفاءة.', wholePlatform: 'المنصة كاملة، في مكان واحد.',
        allStocked: 'كل المنتجات أعلى من حد المخزون الأدنى.', noOrders: 'لا توجد طلبات بعد'
      },
      product: {
        title: 'المنتجات', add: 'إضافة منتج', edit: 'تعديل المنتج', name: 'اسم المنتج',
        price: 'السعر', stock: 'المخزون', minStock: 'الحد الأدنى', category: 'الفئة',
        image: 'صورة المنتج', description: 'الوصف', save: 'حفظ المنتج', saved: 'تم حفظ المنتج',
        search: 'ابحث عن منتج…', inStock: 'متوفر', out: 'نفذ', low: 'منخفض', units: 'قطعة',
        noProducts: 'لا توجد منتجات', emptyText: 'ابدأ بإضافة منتجاتك لتظهر في المتجر ونقطة البيع.',
        addFirst: 'أضف أول منتج', stockValue: 'قيمة المخزون', all: 'كل المنتجات',
        catalog: 'الكتالوج', filters: 'التصفية', sortNewest: 'الأحدث', sortPrice: 'السعر', sortName: 'الاسم',
        general: 'عام', retail: 'تجارة', uploadImage: 'رفع صورة'
      },
      order: {
        title: 'الطلبات', id: 'رقم الطلب', status: 'الحالة', pending: 'قيد الانتظار',
        confirmed: 'مؤكد', preparing: 'قيد التحضير', delivering: 'في الطريق', delivered: 'تم التسليم',
        cancelled: 'ملغي', paymentMethod: 'طريقة الدفع', cash: 'نقدي', card: 'بطاقة',
        wallet: 'محفظة', vodafone: 'فودافون كاش', deliveryCompany: 'شركة التوصيل', driver: 'المندوب',
        timeline: 'مراحل الطلب', proof: 'إثبات التسليم', items: 'المنتجات', summary: 'الملخص',
        customerInfo: 'بيانات العميل', empty: 'لا توجد طلبات بعد',
        emptyText: 'عندما يصلك أول طلب ستجده هنا مع كل التفاصيل.',
        search: 'ابحث عن طلب…', allStatuses: 'كل الحالات', date: 'تاريخ الطلب',
        created: 'تم إنشاء الطلب', confirmedAt: 'تم تأكيد الطلب', preparingAt: 'جارٍ تجهيز الطلب',
        deliveringAt: 'المندوب في الطريق', deliveredAt: 'تم تسليم الطلب', cancelledAt: 'تم إلغاء الطلب',
        newSale: 'بيعة جديدة', markDelivered: 'تأكيد التسليم', markPicked: 'تم الاستلام',
        proofUpload: 'ارفع صورة الإثبات', orderSummary: 'ملخص الطلب', total: 'الإجمالي',
        deliveryFee: 'رسوم التوصيل', notes: 'ملاحظات الطلب', customer: 'العميل', phone: 'الهاتف',
        address: 'العنوان', city: 'المدينة', itemsCount: 'عدد المنتجات', qty: 'الكمية'
      },
      customer: {
        title: 'العملاء', add: 'إضافة عميل', name: 'اسم العميل', phone: 'الهاتف',
        orders: 'الطلبات', spent: 'إجمالي الشراء', lastOrder: 'آخر طلب', joined: 'تاريخ الانضمام',
        empty: 'لا يوجد عملاء بعد', emptyText: 'سيظهر العملاء هنا بمجرد إنشاء أول طلب.',
        search: 'ابحث عن عميل…', contact: 'تواصل واتساب', totalCustomers: 'إجمالي العملاء'
      },
      cashier: {
        title: 'الكاشير', add: 'إضافة كاشير', edit: 'تعديل كاشير', name: 'اسم الكاشير',
        store: 'المتجر', shift: 'الوردية', salary: 'الراتب', empty: 'لا يوجد كاشير بعد',
        emptyText: 'أضف أول كاشير لتبدأ البيع.', pos: 'نقطة البيع', newSale: 'بيعة جديدة'
      },
      delivery: {
        title: 'شركات التوصيل', company: 'شركة التوصيل', driver: 'المندوب', fee: 'العمولة',
        avgTime: 'متوسط الوقت', completed: 'مكتمل', assigned: 'مُسند', pickedUp: 'تم الاستلام',
        onTheWay: 'في الطريق', delivered: 'تم التسليم', earnings: 'الأرباح',
        empty: 'لا يوجد مندوبون مسجلون بعد.', dashboard: 'لوحة المندوب',
        noAssigned: 'لا توجد مهام مسندة', noAssignedText: 'ستظهر المهام الجديدة هنا فور إسنادها إليك.',
        accept: 'قبول المهمة', markPicked: 'تأكيد الاستلام', markDelivered: 'تأكيد التسليم',
        proofUpload: 'ارفع صورة إثبات التسليم', eta: 'الوقت المتوقع', distance: 'المسافة',
        liveTracking: 'تتبع لحظي', deliverTo: 'التوصيل إلى', rider: 'مندوب'
      },
      storefront: {
        title: 'المتجر', browse: 'تصفح المتجر', addToCart: 'أضف للسلة', added: 'تمت الإضافة',
        cart: 'السلة', emptyCart: 'سلتك فارغة', emptyCartText: 'أضف بعض المنتجات لتظهر هنا.',
        subtotal: 'المجموع', delivery: 'التوصيل', total: 'الإجمالي', checkout: 'إتمام الطلب',
        continueShopping: 'متابعة التسوق', search: 'ابحث في المتجر…', all: 'الكل',
        open: 'مفتوح الآن', closed: 'مغلق الآن', preview: 'معاينة المتجر', clear: 'تفريغ السلة',
        switchStore: 'تبديل المتجر', items: 'منتجات', remove: 'إزالة', outOfStock: 'نفذ المخزون',
        storePreview: 'أنت تعاين واجهة المتجر الحية.', deliveredIn: 'يصلك في حوالي 30 دقيقة.'
      },
      checkout: {
        title: 'إتمام الطلب', subtitle: 'أكد بياناتك وأكمل طلبك.', customerInfo: 'بيانات العميل',
        name: 'الاسم بالكامل', phone: 'رقم الهاتف', city: 'المدينة', address: 'العنوان بالتفصيل',
        notes: 'ملاحظات التوصيل', payment: 'طريقة الدفع', cash: 'الدفع عند الاستلام',
        card: 'بطاقة', wallet: 'محفظة', summary: 'ملخص الطلب', placeOrder: 'تأكيد الطلب',
        placing: 'جارٍ تأكيد الطلب…', orderPlaced: 'تم إنشاء طلبك', orderPlacedText: 'يمكنك تتبع طلبك لحظة بلحظة.',
        trackOrder: 'تتبع الطلب', emptyCart: 'سلتك فارغة', backToStore: 'العودة للمتجر',
        preview: 'معاينة', required: 'هذا الحقل مطلوب', invalidPhone: 'رقم الهاتف غير صحيح'
      },
      tracking: {
        title: 'تتبع الطلب', live: 'مباشر', eta: 'الوقت المتوقع', distance: 'المسافة',
        driverOnWay: 'المندوب في الطريق إليك', delivered: 'تم تسليم طلبك',
        pending: 'طلبك قيد المراجعة', preparing: 'جارٍ تجهيز طلبك', noActive: 'لا يوجد طلب نشط',
        noActiveText: 'أنشئ طلباً من المتجر لتتبعه من هنا.', orderId: 'رقم الطلب', call: 'اتصال'
      },
      reports: {
        title: 'التقارير', revenue: 'الإيرادات', profit: 'الربح', orders: 'الطلبات',
        avgTicket: 'متوسط الفاتورة', margin: 'هامش', salesOverview: 'نظرة على المبيعات',
        topProducts: 'الأكثر مبيعاً', categorySplit: 'توزيع الفئات', export: 'تصدير CSV',
        range: 'الفترة', days: 'يوم', last7: 'آخر 7 أيام', last30: 'آخر 30 يوم',
        bestDay: 'أفضل يوم', growth: 'النمو', transactions: 'المعاملات'
      },
      settings: {
        title: 'الإعدادات', platform: 'إعدادات المنصة', store: 'بيانات المتجر',
        account: 'الحساب', notifications: 'الإشعارات', security: 'الأمان', preferences: 'التفضيلات',
        name: 'الاسم', email: 'البريد الإلكتروني', phone: 'الهاتف', address: 'العنوان',
        save: 'حفظ الإعدادات', saved: 'تم الحفظ بنجاح', language: 'اللغة', theme: 'المظهر',
        dark: 'داكن', light: 'فاتح', maintenance: 'وضع الصيانة', allowSignups: 'السماح بمتاجر جديدة',
        oldPassword: 'كلمة المرور الحالية', newPassword: 'كلمة المرور الجديدة',
        confirmPassword: 'تأكيد كلمة المرور', dangerZone: 'منطقة الخطر', resetData: 'إعادة تعيين البيانات',
        resetText: 'إعادة قاعدة البيانات التجريبية إلى حالتها الأصلية. ستفقد كل التغييرات المحلية.'
      },
      chat: {
        title: 'المحادثات', support: 'الدعم', public: 'العام', stores: 'المتاجر',
        delivery: 'شركات التوصيل', send: 'إرسال', placeholder: 'اكتب رسالة…', you: 'أنت',
        online: 'متصل', offline: 'غير متصل', noChats: 'لا توجد محادثات',
        emptyText: 'اختر محادثة من القائمة أو ابدأ واحدة جديدة.'
      },
      jobs: {
        title: 'وظائف DotStudio®', subtitle: 'انضم إلى فريق نصنع به تجربة تجارة حديثة.',
        apply: 'قدّم الآن', applyFor: 'التقديم على وظيفة', fullTime: 'دوام كامل',
        partTime: 'دوام جزئي', remote: 'عن بعد', department: 'القسم', location: 'الموقع',
        salary: 'الراتب', experience: 'الخبرة', description: 'الوصف الوظيفي',
        requirements: 'المتطلبات', sent: 'تم إرسال طلبك بنجاح', sentText: 'سيتواصل معك فريق التوظيف قريباً.',
        noJobs: 'لا توجد وظائف متاحة حالياً', years: 'مثال: سنتان', note: 'قولنا ليه أنت الأنسب…',
        applications: 'طلبات التوظيف'
      },
      subscription: {
        title: 'الاشتراكات', choose: 'اختر الباقة المناسبة',
        subtitle: 'فعّل اشتراكك عبر واتساب في خطوة واحدة — بدون نماذج داخلية.',
        subscribe: 'اشترك الآن', current: 'باقتك الحالية', renew: 'تجديد', monthly: 'شهري',
        sixMonths: '6 أشهر', yearly: 'سنوي', perMonth: 'شهرياً', perSix: 'كل 6 أشهر',
        perYear: 'سنوياً', bestValue: 'الأفضل قيمة', mostPopular: 'الأكثر اختياراً',
        expires: 'تنتهي في', daysLeft: 'يوم متبقي', all: 'كل الاشتراكات', status: 'الحالة',
        expired: 'منتهي', active: 'نشط', contact: 'سيتم تحويلك إلى واتساب مع رسالة جاهزة باسم متجرك.'
      },
      marketing: {
        title: 'DotStudio® POS', hero: 'أدر متجرك بذكاء.', subtitle: 'منصة واحدة لكل تجارتك.',
        features: 'المزايا', pricing: 'الأسعار', stores: 'المتاجر', login: 'دخول',
        getStarted: 'ابدأ الآن', learnMore: 'اعرف أكثر', demo: 'جرّب الآن'
      },
      roles: {
        superadmin: 'مدير النظام', subadmin: 'مشرف', owner: 'صاحب متجر', cashier: 'كاشير',
        delivery: 'مندوب', customer: 'عميل', admin: 'الإدارة'
      }
    },

    /* ─────────────────────────────── English ─────────────────────────────── */
    en: {
      nav: {
        dashboard: 'Dashboard', stores: 'Stores', products: 'Products', orders: 'Orders',
        invoices: 'Invoices', customers: 'Customers', cashiers: 'Cashiers', deliveryCompanies: 'Delivery companies',
        chats: 'Chats', messages: 'Messages', jobs: 'Jobs', reports: 'Reports',
        subscriptions: 'Subscriptions', audit: 'Audit log', settings: 'Settings', pos: 'Point of sale',
        storefront: 'Storefront', checkout: 'Checkout', tracking: 'Track order', myOrders: 'My orders',
        subAdmins: 'Sub-admins', marketing: 'Home', publicChat: 'Public chat',
        logout: 'Sign out', workspace: 'Workspace', operations: 'Operations', growth: 'Growth',
        communication: 'Communication', team: 'Team', system: 'System', community: 'Community'
      },
      login: {
        title: 'Welcome back', subtitle: 'Sign in to run your store and keep everything in one place.',
        username: 'Username', password: 'Password',
        usernamePlaceholder: 'Enter your username', passwordPlaceholder: 'Enter your password',
        signIn: 'Sign in', signingIn: 'Signing in…', remember: 'Remember me',
        forgot: 'Forgot password?', welcomeBack: 'Welcome back',
        demoTitle: 'Demo accounts', showAll: 'Show all', hideAll: 'Hide',
        allAccounts: 'All demo accounts', fillHint: 'Tap any account to fill the form.',
        errorEmpty: 'Please enter your username and password.',
        errorInvalid: 'Incorrect username or password.',
        errorSuspended: 'This account is suspended. Contact support.',
        secure: 'Secure connection', encrypted: 'Encrypted data', trusted: 'Trusted by thousands of stores',
        sessionActive: 'Already signed in', continue: 'Continue', switchAccount: 'Switch',
        signedOut: 'Signed out. Pick an account below.', welcome: 'Welcome',
        tagline: 'Point of sale, storefront, delivery, chats and reports — everything you need in one elegant experience.',
        copyright: 'Crafted by DotStudio®'
      },
      common: {
        search: 'Search', searchPlaceholder: 'Search anything…', save: 'Save', saveChanges: 'Save changes',
        cancel: 'Cancel', delete: 'Delete', edit: 'Edit', add: 'Add', view: 'View', viewAll: 'View all',
        details: 'Details', close: 'Close', confirm: 'Confirm', yes: 'Yes', no: 'No', all: 'All',
        active: 'Active', inactive: 'Suspended', status: 'Status', actions: 'Actions', name: 'Name',
        phone: 'Phone', email: 'Email', address: 'Address', city: 'City', date: 'Date',
        total: 'Total', subtotal: 'Subtotal', delivery: 'Delivery', discount: 'Discount',
        quantity: 'Quantity', price: 'Price', stock: 'Stock', category: 'Category', image: 'Image',
        customer: 'Customer', owner: 'Owner', store: 'Store', role: 'Role', plan: 'Plan',
        language: 'Language', theme: 'Theme', logout: 'Sign out', login: 'Sign in',
        username: 'Username', password: 'Password', welcome: 'Welcome', today: 'Today',
        week: 'This week', month: 'This month', revenue: 'Revenue', print: 'Print',
        export: 'Export', filter: 'Filter', from: 'From', to: 'To', apply: 'Apply', reset: 'Reset',
        loading: 'Loading…', noData: 'No data yet', noResults: 'No results',
        accessDenied: 'You do not have access', back: 'Back', next: 'Next', previous: 'Previous',
        copy: 'Copy', copied: 'Copied', refresh: 'Refresh', open: 'Open', required: 'Required',
        of: 'of', results: 'results', showing: 'Showing', saved: 'Saved', deleted: 'Deleted',
        updated: 'Updated', created: 'Created', confirmDelete: 'Confirm deletion',
        confirmDeleteText: 'This action cannot be undone. Are you sure?', noNotifications: 'No notifications',
        notifications: 'Notifications', profile: 'Profile', profileSettings: 'Profile settings',
        changeAvatar: 'Change avatar', preferences: 'Preferences', security: 'Security', notes: 'Notes',
        optional: 'Optional', new: 'New', live: 'Live', minute: 'min', km: 'km', currency: 'EGP'
      },
      dashboard: {
        overview: 'Overview', platformOverview: 'Platform summary', welcome: 'Welcome',
        goodMorning: 'Good morning', goodAfternoon: 'Good afternoon', goodEvening: 'Good evening',
        monthRevenue: 'Monthly revenue', ordersToday: 'Orders today', avgOrder: 'Average order',
        lowStock: 'Low stock', activeOrders: 'Active orders', delivered: 'Delivered',
        rating: 'Rating', expiringSoon: 'Your subscription expires soon', daysRemaining: 'Days remaining',
        renew: 'Renew', viewStore: 'Visit store', quickActions: 'Quick actions',
        recentOrders: 'Recent orders', topProducts: 'Top products', salesOverview: 'Sales overview',
        last7: 'Last 7 days', last30: 'Last 30 days', liveActivity: 'Live activity',
        revenueSplit: 'Revenue split', totalRevenue: 'Total revenue', totalOrders: 'Total orders',
        totalStores: 'Total stores', totalCustomers: 'Total customers', mrr: 'MRR',
        arr: 'ARR', auditLog: 'Audit log', thisMonthRevenue: 'This month revenue',
        runningSmoothly: 'Your store is running smoothly.', wholePlatform: 'The whole platform, in one place.',
        allStocked: 'All products are above their minimum stock level.', noOrders: 'No orders yet'
      },
      product: {
        title: 'Products', add: 'Add product', edit: 'Edit product', name: 'Product name',
        price: 'Price', stock: 'Stock', minStock: 'Minimum stock', category: 'Category',
        image: 'Product image', description: 'Description', save: 'Save product', saved: 'Product saved',
        search: 'Search products…', inStock: 'In stock', out: 'Out', low: 'Low', units: 'units',
        noProducts: 'No products', emptyText: 'Add your first products to show them in the store and POS.',
        addFirst: 'Add first product', stockValue: 'Stock value', all: 'All products',
        catalog: 'Catalogue', filters: 'Filters', sortNewest: 'Newest', sortPrice: 'Price', sortName: 'Name',
        general: 'General', retail: 'Retail', uploadImage: 'Upload image'
      },
      order: {
        title: 'Orders', id: 'Order ID', status: 'Status', pending: 'Pending',
        confirmed: 'Confirmed', preparing: 'Preparing', delivering: 'On the way', delivered: 'Delivered',
        cancelled: 'Cancelled', paymentMethod: 'Payment method', cash: 'Cash', card: 'Card',
        wallet: 'Wallet', vodafone: 'Vodafone Cash', deliveryCompany: 'Delivery company', driver: 'Driver',
        timeline: 'Order timeline', proof: 'Delivery proof', items: 'Items', summary: 'Summary',
        customerInfo: 'Customer details', empty: 'No orders yet',
        emptyText: 'Your first order will appear here with every detail.',
        search: 'Search orders…', allStatuses: 'All statuses', date: 'Order date',
        created: 'Order created', confirmedAt: 'Order confirmed', preparingAt: 'Preparing your order',
        deliveringAt: 'Driver on the way', deliveredAt: 'Order delivered', cancelledAt: 'Order cancelled',
        newSale: 'New sale', markDelivered: 'Confirm delivery', markPicked: 'Picked up',
        proofUpload: 'Upload proof photo', orderSummary: 'Order summary', total: 'Total',
        deliveryFee: 'Delivery fee', notes: 'Order notes', customer: 'Customer', phone: 'Phone',
        address: 'Address', city: 'City', itemsCount: 'Items', qty: 'Qty'
      },
      customer: {
        title: 'Customers', add: 'Add customer', name: 'Customer name', phone: 'Phone',
        orders: 'Orders', spent: 'Total spent', lastOrder: 'Last order', joined: 'Joined',
        empty: 'No customers yet', emptyText: 'Customers appear here after their first order.',
        search: 'Search customers…', contact: 'WhatsApp', totalCustomers: 'Total customers'
      },
      cashier: {
        title: 'Cashiers', add: 'Add cashier', edit: 'Edit cashier', name: 'Cashier name',
        store: 'Store', shift: 'Shift', salary: 'Salary', empty: 'No cashiers yet',
        emptyText: 'Add your first cashier to start selling.', pos: 'Point of sale', newSale: 'New sale'
      },
      delivery: {
        title: 'Delivery companies', company: 'Delivery company', driver: 'Driver', fee: 'Fee',
        avgTime: 'Average time', completed: 'Completed', assigned: 'Assigned', pickedUp: 'Picked up',
        onTheWay: 'On the way', delivered: 'Delivered', earnings: 'Earnings',
        empty: 'No drivers assigned yet.', dashboard: 'Driver dashboard',
        noAssigned: 'No assigned tasks', noAssignedText: 'New tasks appear here as soon as they are assigned to you.',
        accept: 'Accept task', markPicked: 'Confirm pickup', markDelivered: 'Confirm delivery',
        proofUpload: 'Upload delivery proof', eta: 'ETA', distance: 'Distance',
        liveTracking: 'Live tracking', deliverTo: 'Deliver to', rider: 'Rider'
      },
      storefront: {
        title: 'Storefront', browse: 'Browse store', addToCart: 'Add to cart', added: 'Added',
        cart: 'Cart', emptyCart: 'Your cart is empty', emptyCartText: 'Add a few products and they will appear here.',
        subtotal: 'Subtotal', delivery: 'Delivery', total: 'Total', checkout: 'Checkout',
        continueShopping: 'Continue shopping', search: 'Search the store…', all: 'All',
        open: 'Open now', closed: 'Closed now', preview: 'Store preview', clear: 'Clear cart',
        switchStore: 'Switch store', items: 'items', remove: 'Remove', outOfStock: 'Out of stock',
        storePreview: 'You are previewing the live storefront.', deliveredIn: 'Delivered in about 30 minutes.'
      },
      checkout: {
        title: 'Checkout', subtitle: 'Confirm your details and place the order.', customerInfo: 'Customer details',
        name: 'Full name', phone: 'Phone number', city: 'City', address: 'Full address',
        notes: 'Delivery notes', payment: 'Payment method', cash: 'Cash on delivery',
        card: 'Card', wallet: 'Wallet', summary: 'Order summary', placeOrder: 'Place order',
        placing: 'Placing order…', orderPlaced: 'Order created', orderPlacedText: 'You can track your order live.',
        trackOrder: 'Track order', emptyCart: 'Your cart is empty', backToStore: 'Back to store',
        preview: 'Preview', required: 'This field is required', invalidPhone: 'Invalid phone number'
      },
      tracking: {
        title: 'Track order', live: 'Live', eta: 'ETA', distance: 'Distance',
        driverOnWay: 'Your driver is on the way', delivered: 'Your order was delivered',
        pending: 'Your order is being reviewed', preparing: 'Your order is being prepared', noActive: 'No active order',
        noActiveText: 'Create an order from the storefront to track it here.', orderId: 'Order ID', call: 'Call'
      },
      reports: {
        title: 'Reports', revenue: 'Revenue', profit: 'Profit', orders: 'Orders',
        avgTicket: 'Average ticket', margin: 'margin', salesOverview: 'Sales overview',
        topProducts: 'Top products', categorySplit: 'Category split', export: 'Export CSV',
        range: 'Range', days: 'days', last7: 'Last 7 days', last30: 'Last 30 days',
        bestDay: 'Best day', growth: 'Growth', transactions: 'Transactions'
      },
      settings: {
        title: 'Settings', platform: 'Platform settings', store: 'Store profile',
        account: 'Account', notifications: 'Notifications', security: 'Security', preferences: 'Preferences',
        name: 'Name', email: 'Email', phone: 'Phone', address: 'Address',
        save: 'Save settings', saved: 'Saved successfully', language: 'Language', theme: 'Theme',
        dark: 'Dark', light: 'Light', maintenance: 'Maintenance mode', allowSignups: 'Allow new stores',
        oldPassword: 'Current password', newPassword: 'New password',
        confirmPassword: 'Confirm new password', dangerZone: 'Danger zone', resetData: 'Reset demo data',
        resetText: 'Reset the demo database back to its original seed. All local changes will be lost.'
      },
      chat: {
        title: 'Chats', support: 'Support', public: 'Public', stores: 'Stores',
        delivery: 'Delivery companies', send: 'Send', placeholder: 'Write a message…', you: 'You',
        online: 'Online', offline: 'Offline', noChats: 'No conversations',
        emptyText: 'Pick a conversation or start a new one.'
      },
      jobs: {
        title: 'DotStudio® Careers', subtitle: 'Join a team building the future of modern commerce.',
        apply: 'Apply now', applyFor: 'Apply for', fullTime: 'Full-time',
        partTime: 'Part-time', remote: 'Remote', department: 'Department', location: 'Location',
        salary: 'Salary', experience: 'Experience', description: 'Job description',
        requirements: 'Requirements', sent: 'Application sent', sentText: 'Our hiring team will contact you soon.',
        noJobs: 'No open positions right now', years: 'e.g. 2 years', note: 'Tell us why you are a great fit…',
        applications: 'Applications'
      },
      subscription: {
        title: 'Subscriptions', choose: 'Choose the right plan',
        subtitle: 'Activate your plan on WhatsApp in one step — no internal forms.',
        subscribe: 'Subscribe', current: 'Your current plan', renew: 'Renew', monthly: 'Monthly',
        sixMonths: '6 months', yearly: 'Yearly', perMonth: 'per month', perSix: 'per 6 months',
        perYear: 'per year', bestValue: 'Best value', mostPopular: 'Most popular',
        expires: 'Expires', daysLeft: 'days left', all: 'All subscriptions', status: 'Status',
        expired: 'Expired', active: 'Active', contact: 'You will be redirected to WhatsApp with a ready message including your store name.'
      },
      marketing: {
        title: 'DotStudio® POS', hero: 'Run your store intelligently.', subtitle: 'One platform for your entire business.',
        features: 'Features', pricing: 'Pricing', stores: 'Stores', login: 'Sign in',
        getStarted: 'Get started', learnMore: 'Learn more', demo: 'Try the demo'
      },
      roles: {
        superadmin: 'Super admin', subadmin: 'Sub-admin', owner: 'Store owner', cashier: 'Cashier',
        delivery: 'Driver', customer: 'Customer', admin: 'Admin'
      }
    }
  };

  window.translations = translations;

  var LS_LANG = 'lang';
  var LEGACY_LS_LANG = 'ds_lang';

  function normalize(lang) { return String(lang || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'ar'; }

  function currentLang() {
    try {
      var stored = localStorage.getItem(LS_LANG) || localStorage.getItem(LEGACY_LS_LANG);
      if (stored) return normalize(stored);
    } catch (e) {}
    return normalize(document.documentElement.getAttribute('lang'));
  }

  function lookup(lang, path, vars) {
    lang = normalize(lang);
    var parts = String(path == null ? '' : path).split('.');
    var node = translations[lang];
    for (var i = 0; i < parts.length && node != null; i++) node = node[parts[i]];
    if (node == null) {
      node = translations.ar;
      for (var j = 0; j < parts.length && node != null; j++) node = node[parts[j]];
    }
    if (node == null || typeof node === 'object') return path;
    var str = String(node);
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
      });
    }
    return str;
  }

  function t(path, vars) { return lookup(currentLang(), path, vars); }

  function applyToDom(lang) {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      if (!key) continue;
      var value = lookup(lang, key);
      if (value === key) continue;
      var target = el.getAttribute('data-i18n-target');
      if (target) el.setAttribute(target, value);
      else el.textContent = value;
    }
    var phs = document.querySelectorAll('[data-i18n-placeholder], [data-i18n-ph]');
    for (var p = 0; p < phs.length; p++) {
      var input = phs[p];
      var pkey = input.getAttribute('data-i18n-placeholder') || input.getAttribute('data-i18n-ph');
      if (!pkey) continue;
      var pval = lookup(lang, pkey);
      if (pval !== pkey) input.setAttribute('placeholder', pval);
    }
    var titles = document.querySelectorAll('[data-i18n-title]');
    for (var ti = 0; ti < titles.length; ti++) {
      var tkey = titles[ti].getAttribute('data-i18n-title');
      var tval = lookup(lang, tkey);
      if (tval !== tkey) titles[ti].setAttribute('title', tval);
    }
    var aria = document.querySelectorAll('[data-i18n-aria-label]');
    for (var a = 0; a < aria.length; a++) {
      var akey = aria[a].getAttribute('data-i18n-aria-label');
      var aval = lookup(lang, akey);
      if (aval !== akey) aria[a].setAttribute('aria-label', aval);
    }
    /* Language pill state */
    var opts = document.querySelectorAll('[data-set-lang]');
    for (var o = 0; o < opts.length; o++) {
      opts[o].classList.toggle('active', normalize(opts[o].getAttribute('data-set-lang')) === lang);
      opts[o].setAttribute('aria-pressed', normalize(opts[o].getAttribute('data-set-lang')) === lang ? 'true' : 'false');
    }
    var htmlTitle = document.querySelector('title[data-i18n]');
    if (htmlTitle) document.title = lookup(lang, htmlTitle.getAttribute('data-i18n'));
  }

  function applyLanguage(lang, opts) {
    lang = normalize(lang);
    opts = opts || {};
    try {
      localStorage.setItem(LS_LANG, lang);
      localStorage.setItem(LEGACY_LS_LANG, lang);
    } catch (e) {}
    var html = document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    html.setAttribute('data-lang', lang);
    if (document.body) {
      document.body.classList.toggle('lang-ar', lang === 'ar');
      document.body.classList.toggle('lang-en', lang === 'en');
      document.body.setAttribute('data-lang', lang);
    }
    applyToDom(lang);
    /* Let legacy pages that already rendered with DS.t refresh */
    try { document.dispatchEvent(new CustomEvent('ds:lang', { detail: { lang: lang, source: 'i18n' } })); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('ds:lang', { detail: { lang: lang, source: 'i18n' } })); } catch (e) {}
    if (!opts.silent && window.DS && typeof window.DS.setLang === 'function' && !window.DS.__applyingLang) {
      /* core owns the page re-render; avoid double dispatch loops */
    }
    return lang;
  }

  window.dsT = t;
  window.applyLanguage = applyLanguage;
  window.currentLanguage = currentLang;

  /* Delegated language buttons — works on login, shells, marketing. */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-set-lang]') : null;
    if (!btn) return;
    var next = normalize(btn.getAttribute('data-set-lang'));
    if (next === currentLang()) return;
    e.preventDefault();
    if (window.DS && typeof window.DS.setLang === 'function') {
      window.DS.setLang(next);
      return;
    }
    applyLanguage(next);
    /* Static pages re-render themselves on reload for a clean RTL flip. */
    if (!document.body || !document.body.hasAttribute('data-no-reload-lang')) {
      setTimeout(function () { location.reload(); }, 40);
    }
  });

  function boot() {
    if (document.body) {
      document.body.classList.toggle('lang-ar', currentLang() === 'ar');
      document.body.classList.toggle('lang-en', currentLang() === 'en');
    }
    /* Keep the visual direction in sync even before core.js runs. */
    var lang = currentLang();
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    applyToDom(lang);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
