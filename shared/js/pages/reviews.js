/* DotStudio® POS — Product reviews (admin moderation) */
(function () {
  'use strict';
  var DS = window.DS;
  var t = DS.t, esc = DS.esc, icon = DS.icon, money = DS.money;
  var EN = DS.lang() === 'en';
  var user = DS.session();
  if (!user) return;

  var page = DS.shell.mount({
    roles: ['superadmin', 'subadmin'],
    permission: 'products',
    active: 'reviews',
    title: t('reviews'),
    eyebrow: t('admin'),
    icon: 'star',
    sub: EN ? 'Moderate customer reviews, reply-worthy photos and star ratings.' : 'راجع تقييمات العملاء وصورهم ونجومهم قبل ظهورها في المتجر.',
    actions: '<button class="btn btn-secondary" data-refresh>' + icon('refresh') + esc(t('refresh')) + '</button>',
    content: DS.skeleton.rows(7)
  });
  if (!page) return;

  var state = { q: '', store: '', stars: '' };

  function reviews() {
    return (DS.data.reviews || []).slice().sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }
  function productOf(r) {
    return (DS.data.products || []).filter(function (p) { return p.id === r.product_id; })[0] || null;
  }
  function storeOf(r) {
    return (DS.data.tenants || []).filter(function (tn) { return tn.id === r.tenant_id; })[0] || null;
  }
  function nameOf(o) { return EN ? (o.name_en || o.name) : (o.name || o.name_en); }
  function stars(n) {
    var v = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
    var out = '<span class="rv-stars" aria-label="' + v + ' / 5">';
    for (var i = 1; i <= 5; i++) out += icon('star').replace('<svg', '<svg class="rv-star' + (i <= v ? ' on' : '') + '"');
    return out + '</span>';
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return reviews().filter(function (r) {
      if (state.store && r.tenant_id !== state.store) return false;
      if (state.stars && Math.round(Number(r.rating) || 0) !== Number(state.stars)) return false;
      if (!q) return true;
      var p = productOf(r);
      var hay = [r.name, r.name_en, r.text, r.text_en, p && p.name, p && p.name_en].join(' ').toLowerCase();
      return hay.indexOf(q) > -1;
    });
  }

  function stat(label, value, ico, tone) {
    return '<div class="stat"><div class="stat-top"><span class="stat-label">' + esc(label) + '</span>' +
      '<span class="stat-icon ' + tone + '">' + icon(ico) + '</span></div>' +
      '<div class="stat-value" style="font-size:26px">' + value + '</div></div>';
  }

  function render() {
    var all = reviews();
    var rows = filtered();
    var avg = all.length
      ? Math.round((all.reduce(function (s, r) { return s + (Number(r.rating) || 0); }, 0) / all.length) * 10) / 10
      : 0;
    var withPhoto = all.filter(function (r) { return !!r.image; }).length;

    var stats = '<div class="kpi-grid">' +
      stat(EN ? 'Total reviews' : 'إجمالي التقييمات', all.length, 'star', 'lime') +
      stat(EN ? 'Average rating' : 'متوسط التقييم', avg.toFixed(1), 'star', 'orange') +
      stat(EN ? 'With photos' : 'بتقييمات مصوّرة', withPhoto, 'image', 'info') +
      stat(EN ? 'Showing' : 'المعروض الآن', rows.length, 'eye', 'green') +
      '</div>';

    var toolbar = '<div class="rv-toolbar">' +
      '<div class="rv-search">' + icon('search') +
        '<input class="input" data-rv-q value="' + esc(state.q) + '" placeholder="' + esc(EN ? 'Search review, customer or product' : 'ابحث في التقييم أو العميل أو المنتج') + '"></div>' +
      '<select class="select" data-rv-store><option value="">' + esc(EN ? 'All stores' : 'كل المتاجر') + '</option>' +
        (DS.data.tenants || []).map(function (tn) {
          return '<option value="' + esc(tn.id) + '"' + (state.store === tn.id ? ' selected' : '') + '>' + esc(nameOf(tn)) + '</option>';
        }).join('') + '</select>' +
      '<select class="select" data-rv-stars><option value="">' + esc(EN ? 'All ratings' : 'كل التقييمات') + '</option>' +
        [5, 4, 3, 2, 1].map(function (n) {
          return '<option value="' + n + '"' + (String(state.stars) === String(n) ? ' selected' : '') + '>' + n + ' ★</option>';
        }).join('') + '</select>' +
      '</div>';

    var list = rows.length
      ? '<div class="rv-list">' + rows.map(function (r) {
          var p = productOf(r);
          var tn = storeOf(r);
          var text = EN ? (r.text_en || r.text) : (r.text || r.text_en);
          return '<article class="rv-card" data-rv="' + esc(r.id) + '">' +
            '<div class="rv-main">' +
              '<div class="rv-head">' +
                '<span class="avatar sm" style="background:var(--surface-3);color:var(--lime)">' + esc(DS.initials(nameOf(r) || '?')) + '</span>' +
                '<div class="rv-id"><b>' + esc(nameOf(r) || '—') + '</b>' +
                  '<span>' + stars(r.rating) + '<i class="rv-date">' + esc(DS.date(r.created_at)) + '</i>' +
                  (r.verified ? '<i class="rv-ok">' + icon('checkCircle') + esc(EN ? 'Verified' : 'موثّق') + '</i>' : '') + '</span></div>' +
                '<div class="rv-actions">' +
                  '<button class="btn btn-ghost btn-sm" data-rv-edit="' + esc(r.id) + '" aria-label="edit" title="' + esc(t('edit')) + '">' + icon('edit') + '</button>' +
                  '<button class="btn btn-ghost btn-sm" style="color:var(--danger)" data-rv-del="' + esc(r.id) + '" aria-label="delete" title="' + esc(t('delete')) + '">' + icon('trash') + '</button>' +
                '</div>' +
              '</div>' +
              (text ? '<p class="rv-text">' + esc(text) + '</p>' : '') +
              '<div class="rv-meta">' +
                (p ? '<span class="rv-chip">' + icon('box') + esc(nameOf(p)) + '</span>' : '') +
                (tn ? '<span class="rv-chip">' + icon('store') + esc(nameOf(tn)) + '</span>' : '') +
                (p ? '<span class="rv-chip">' + money(p.price) + '</span>' : '') +
              '</div>' +
            '</div>' +
            (r.image ? '<button type="button" class="rv-photo" data-rv-photo="' + esc(r.image) + '"><img src="' + esc(r.image) + '" alt=""></button>' : '') +
          '</article>';
        }).join('') + '</div>'
      : DS.empty({
          icon: 'star',
          title: EN ? 'No reviews found' : 'لا توجد تقييمات',
          text: EN ? 'Try another filter, or wait for customers to review a product.' : 'جرّب فلتراً آخر، أو انتظر تقييم العملاء للمنتجات.'
        });

    page.setContent(stats + toolbar + list);
    bind();
  }

  function bind() {
    var q = page.body.querySelector('[data-rv-q]');
    if (q) q.addEventListener('input', DS.debounce(function () { state.q = q.value; render(); }, 180));
    var st = page.body.querySelector('[data-rv-store]');
    if (st) st.addEventListener('change', function () { state.store = st.value; render(); });
    var sr = page.body.querySelector('[data-rv-stars]');
    if (sr) sr.addEventListener('change', function () { state.stars = sr.value; render(); });
    var rf = page.root.querySelector('[data-refresh]');
    if (rf) rf.addEventListener('click', function () { DS.toast(t('updated'), 'success'); render(); });

    DS.$$('[data-rv-edit]', page.body).forEach(function (b) {
      b.addEventListener('click', function () { edit(b.getAttribute('data-rv-edit')); });
    });
    DS.$$('[data-rv-del]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        DS.confirm({
          title: t('confirmDelete'),
          text: EN ? 'Delete this review permanently?' : 'حذف هذا التقييم نهائياً؟',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          DS.data.deleteReview(b.getAttribute('data-rv-del'));
          DS.toast(t('deleted'), 'success');
          render();
        });
      });
    });
    DS.$$('[data-rv-photo]', page.body).forEach(function (b) {
      b.addEventListener('click', function () {
        DS.modal({
          size: 'lg',
          title: icon('image') + ' ' + esc(EN ? 'Customer photo' : 'صورة العميل'),
          body: '<img src="' + esc(b.getAttribute('data-rv-photo')) + '" alt="" style="width:100%;border-radius:14px">',
          actions: [{ label: t('close'), variant: 'btn-secondary' }]
        });
      });
    });
  }

  function edit(id) {
    var r = (DS.data.reviews || []).filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    var p = productOf(r);
    var body = '<div class="field-grid">' +
      '<div class="field"><label>' + esc(EN ? 'Rating' : 'التقييم') + '</label><select class="select" id="rvEditRating">' +
        [5, 4, 3, 2, 1].map(function (n) {
          return '<option value="' + n + '"' + (Math.round(Number(r.rating)) === n ? ' selected' : '') + '>' + n + ' ★</option>';
        }).join('') + '</select></div>' +
      '<div class="field"><label>' + esc(EN ? 'Customer name' : 'اسم العميل') + '</label>' +
        '<input class="input" id="rvEditName" maxlength="60" value="' + esc(nameOf(r)) + '"></div>' +
      '<div class="field" style="grid-column:1/-1"><label>' + esc(EN ? 'Comment' : 'التعليق') + '</label>' +
        '<textarea class="textarea" id="rvEditText" rows="4" maxlength="700">' + esc(EN ? (r.text_en || r.text) : r.text) + '</textarea></div>' +
      (p ? '<div class="field" style="grid-column:1/-1"><label>' + esc(EN ? 'Product' : 'المنتج') + '</label>' +
        '<input class="input" value="' + esc(nameOf(p)) + '" disabled></div>' : '') +
      (r.image ? '<div class="field" style="grid-column:1/-1"><label>' + esc(EN ? 'Attached photo' : 'الصورة المرفقة') + '</label>' +
        '<div class="rv-edit-photo"><img src="' + esc(r.image) + '" alt="">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-rv-drop-photo>' + icon('trash') + esc(EN ? 'Remove photo' : 'حذف الصورة') + '</button></div></div>' : '') +
      '</div>';

    var dropPhoto = false;
    var m = DS.modal({
      size: 'md',
      title: icon('star') + ' ' + esc(EN ? 'Edit review' : 'تعديل التقييم'),
      sub: p ? esc(nameOf(p)) : '',
      body: body,
      actions: [
        { label: t('cancel'), variant: 'btn-secondary' },
        { label: t('save'), variant: 'btn-primary', icon: icon('check'), onClick: function (root) {
            var rating = Number(root.querySelector('#rvEditRating').value) || 5;
            var nm = root.querySelector('#rvEditName').value.trim();
            var text = root.querySelector('#rvEditText').value.trim();
            if (!nm) { DS.toast(t('required'), 'error'); return false; }
            DS.data.updateReview(r.id, {
              rating: rating,
              name: nm, name_en: nm,
              text: text, text_en: text,
              image: dropPhoto ? null : r.image
            });
            DS.toast(t('updated'), 'success');
            render();
            return true;
          } }
      ],
      onMount: function (root) {
        var drop = root.querySelector('[data-rv-drop-photo]');
        if (drop) drop.addEventListener('click', function () {
          dropPhoto = true;
          var box = root.querySelector('.rv-edit-photo');
          if (box) { box.innerHTML = '<div class="cell-sub">' + esc(EN ? 'Photo will be removed on save.' : 'ستُحذف الصورة عند الحفظ.') + '</div>'; }
        });
      }
    });
    return m;
  }

  render();
})();
