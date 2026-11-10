/* Orbis v2 — screen: storefront builder (draft vs published, ADR-0006). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc;
  var S = function () { return Orbis.domain.storefront; };
  var LABELS = { banner: 'Banner', voucher: 'Voucher', flash: 'Flash sale', best: 'Terlaris', new: 'Terbaru', bundle: 'Paket bundling', products: 'Daftar produk', reviews: 'Ulasan', social: 'Media sosial', footer: 'Footer', wa: 'Tombol WhatsApp', share: 'Bagikan' };

  /** Render a storefront page object (draft or published). Shared with the customer view. */
  Orbis.renderStorePage = function (page, products, tenantName, opts) {
    opts = opts || {};
    var sec = page.sections || {};
    var h = '<div class="phone"><div class="sf-pad">';
    if (page.logo) h += '<img src="' + esc(page.logo) + '" alt="Logo" class="sf-logo"> ';
    h += '<b>' + esc(page.title || tenantName) + '</b>';
    if (sec.banner) {
      h += '<div class="sf-hero">' +
        (page.heroImage ? '<img src="' + esc(page.heroImage) + '" alt="">' : '') +
        '<h2>' + esc(page.heroTitle) + '</h2><p>' + esc(page.heroSubtitle) + '</p></div>';
    }
    if (page.deliveryEta) h += '<p><small>Estimasi kirim: ' + esc(page.deliveryEta) + '</small></p>';
    ['voucher', 'flash', 'best', 'new', 'bundle'].forEach(function (k) { if (sec[k]) h += '<p>' + Orbis.chip('ACTIVE', LABELS[k]) + '</p>'; });
    if (sec.products) {
      h += '<div class="prod">' + (products.length ? products.map(function (p) {
        return '<div class="sf-item"><div>' + esc(p.name) + '</div><b>' + esc(Orbis.idr(p.price)) + '</b>' +
          (opts.cart ? '<div>' + Orbis.btn('Tambah', 'storeAdd', [p.skuId]) + '</div>' : '') + '</div>';
      }).join('') : '<p>Belum ada produk tersedia.</p>') + '</div>';
    }
    if (sec.reviews) h += '<p><small>Ulasan pelanggan akan tampil di sini.</small></p>';
    if (sec.social) h += '<p><small>Ikuti kami di media sosial.</small></p>';
    if (sec.wa) h += '<p><small>Tanya via WhatsApp</small></p>';
    if (sec.share) h += '<p><small>Bagikan toko ini</small></p>';
    if (sec.footer) h += '<hr><small>' + esc(tenantName) + '</small>';
    return h + '</div></div>';
  };

  Orbis.screens.storefront = function (d) {
    var can = Orbis.can('storefront.edit');
    var st = S().status(d), t = d.tenants.filter(function (x) { return x.id === d.session.tenant; })[0] || {};
    var out = Orbis.pageHead('Storefront', 'Draf dan versi terbit terpisah. Pelanggan hanya melihat versi terbit.');
    if (!st.exists) return out + Orbis.empty('Storefront belum dibuat.', can ? Orbis.btn('Mulai draf', 'sfSaveDraft', null, { kind: 'primary' }) : '');
    var dr = st.draft;
    out += '<div class="banner ' + (st.published && !st.dirty ? 'ok' : '') + '">' + esc(st.published ? 'Versi terbit ' + st.version : 'Belum pernah terbit') +
      (st.dirty && st.published ? ' — draf berbeda dari versi terbit (' + st.changed.join(', ') + ')' : st.published ? ' — draf sama dengan versi terbit' : '') + '</div>';
    if (!can) out += '<div class="banner">Hanya owner/brand admin yang dapat mengubah storefront.</div>';
    var toggles = S().SECTIONS.map(function (k) { return Orbis.field(LABELS[k], 'sec_' + k, !!(dr.sections || {})[k], { type: 'checkbox' }); }).join('');
    var form = '<div id="sf-form">' + Orbis.field('Judul toko', 'title', dr.title || '') + Orbis.field('Judul hero', 'heroTitle', dr.heroTitle || '') +
      Orbis.field('Subjudul hero', 'heroSubtitle', dr.heroSubtitle || '') + Orbis.field('Estimasi kirim', 'deliveryEta', dr.deliveryEta || '') +
      '<div class="fld"><label for="f-logo">Logo (PNG/JPG/WebP, maks. 1 MB)</label><input id="f-logo" type="file" accept="image/png,image/jpeg,image/webp" data-change="sfImage" data-kind="logo"></div>' +
      '<fieldset><legend>Seksi</legend>' + toggles + '</fieldset></div>' +
      (can ? '<div class="step">' + Orbis.btn('Simpan draf', 'sfSaveDraft', null) + Orbis.btn('Terbitkan', 'sfPublish', null, { kind: 'primary' }) + Orbis.btn('Buang draf', 'sfDiscard', null, { kind: 'danger' }) + '</div>' : '');
    var preview = Orbis.renderStorePage(dr, S().products(d, d.session.tenant), t.name || '', {});
    out += '<div class="grid g2">' + Orbis.card('Pengaturan', form) + Orbis.card('Pratinjau draf', preview) + '</div>';
    return out;
  };

  function readPatch() {
    var f = Orbis.readForm('#sf-form'), sections = {};
    S().SECTIONS.forEach(function (k) { sections[k] = !!f['sec_' + k]; });
    return { title: f.title, heroTitle: f.heroTitle, heroSubtitle: f.heroSubtitle, deliveryEta: f.deliveryEta, sections: sections };
  }
  var A = Orbis.actions;
  A.sfSaveDraft = function () {
    S().saveDraft(document.getElementById('sf-form') ? readPatch() : {});
    Orbis.toast('Draf disimpan');
  };
  A.sfPublish = function () { A.sfSaveDraft(); var r = S().publish(); Orbis.toast('Versi ' + r.version + ' diterbitkan'); };
  A.sfDiscard = function () { S().discardDraft(); Orbis.toast('Draf dipulihkan ke versi terbit'); };
  A.sfImage = function (v, ev) {
    var input = ev && ev.target, file = input && input.files && input.files[0];
    if (!file) return;
    var kind = input.getAttribute('data-kind') || 'logo';
    if (file.size > 1048576) throw Orbis.Err('IMAGE_TOO_LARGE', 'Gambar maksimal 1 MB');
    var fr = new FileReader();
    fr.onload = function () {
      Orbis.attempt(function () { var p = {}; p[kind] = fr.result; S().saveDraft(p); Orbis.toast('Gambar disimpan ke draf'); });
    };
    fr.readAsDataURL(file);
  };
})(typeof window !== 'undefined' ? window : globalThis);
