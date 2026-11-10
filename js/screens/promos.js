/* Orbis v2 — screen: promos (tabs, create/edit modal, simulator). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.promos = Orbis.ui.promos || { tab: 'all', sim: { code: '', subtotal: '', channel: 'pos' }, result: null };
  var P = function () { return Orbis.domain.promos; };

  Orbis.screens.promos = function (d) {
    var can = Orbis.can('promo.write');
    var all = P().list(d);
    var rows = all.filter(function (p) {
      return ui.tab === 'all' || (ui.tab === 'active' && p.effective === 'ACTIVE') || (ui.tab === 'draft' && p.effective === 'DRAFT') || (ui.tab === 'paused' && p.effective === 'PAUSED');
    });
    var out = Orbis.pageHead('Promo', 'Kode promo tanpa penumpukan. Hanya promo aktif dalam periode yang bisa dipakai.',
      can ? Orbis.btn('Buat promo', 'promoOpen', [null], { kind: 'primary', icon: 'plus' }) : '');
    out += Orbis.tabs([['all', 'Semua'], ['active', 'Aktif'], ['draft', 'Draft'], ['paused', 'Dijeda']], ui.tab, 'promoTab');
    out += Orbis.table([
      { label: 'Promo', fmt: function (p) { return '<b>' + esc(p.name) + '</b><br><small>' + esc(p.code) + '</small>'; } },
      { label: 'Nilai', fmt: function (p) { return esc(p.type === 'percent' ? p.value + '%' : Orbis.idr(p.value)); } },
      { label: 'Periode', fmt: function (p) { return esc(p.start + ' s/d ' + p.end); } },
      { label: 'Pakai', right: true, fmt: function (p) { return esc(p.used + (p.quota == null ? '' : ' / ' + p.quota)); } },
      { label: 'Status', fmt: function (p) { return Orbis.chip(p.effective, ({ ACTIVE: 'Aktif', DRAFT: 'Draft', PAUSED: 'Dijeda', EXPIRED: 'Kedaluwarsa' })[p.effective]); } },
      { label: '', fmt: function (p) {
        if (!can || p.effective === 'EXPIRED') return '';
        return Orbis.btn('Ubah', 'promoOpen', [p.id]) + (p.effective === 'ACTIVE' ? Orbis.btn('Jeda', 'promoPause', [p.id]) : Orbis.btn('Aktifkan', 'promoActivate', [p.id], { kind: 'primary' }));
      } }
    ], rows, 'Belum ada promo di tab ini.');
    var r = ui.result;
    out += Orbis.card('Simulator promo',
      '<div id="p-sim" class="grid g3">' + Orbis.field('Kode', 'code', ui.sim.code) + Orbis.field('Subtotal (Rp)', 'subtotal', ui.sim.subtotal, { type: 'number', min: 0 }) +
      Orbis.field('Kanal', 'channel', ui.sim.channel, { type: 'select', options: [['pos', 'POS'], ['store', 'Toko online']] }) + '</div>' +
      Orbis.btn('Hitung', 'promoSim', null, { kind: 'primary' }) +
      (r ? '<div class="banner ' + (r.ok ? 'ok' : 'bad') + ' mt" role="status">' + esc(r.ok ? 'Diskon ' + Orbis.idr(r.discount) + ' — bayar ' + Orbis.idr(r.subtotal - r.discount) : r.message) + '</div>' : ''));
    return out;
  };

  var A = Orbis.actions;
  A.promoTab = function (t) { ui.tab = t; Orbis.render(); };
  A.promoOpen = function (id) {
    var p = id ? P().list(Orbis.db()).filter(function (x) { return x.id === id; })[0] : null;
    var v = p || { name: '', code: '', type: 'percent', value: 10, minPurchase: 0, maxDiscount: 0, quota: '', start: Orbis.clock.day(), end: Orbis.clock.day(), channels: ['pos', 'store'] };
    Orbis.modal(p ? 'Ubah promo' : 'Buat promo',
      '<input type="hidden" name="id" value="' + esc(p ? p.id : '') + '">' +
      Orbis.field('Nama', 'name', v.name) + Orbis.field('Kode', 'code', v.code, { hint: '3-24 karakter: A-Z, 0-9, _ , -' }) +
      Orbis.field('Tipe', 'type', v.type, { type: 'select', options: [['percent', 'Persen'], ['fixed', 'Nominal (Rp)']] }) +
      Orbis.field('Nilai', 'value', v.value, { type: 'number', min: 1 }) + Orbis.field('Min. belanja (Rp)', 'minPurchase', v.minPurchase, { type: 'number', min: 0 }) +
      Orbis.field('Maks. diskon (Rp, 0 = tanpa batas)', 'maxDiscount', v.maxDiscount, { type: 'number', min: 0 }) + Orbis.field('Kuota (kosong = tanpa batas)', 'quota', v.quota == null ? '' : v.quota, { type: 'number', min: 1 }) +
      Orbis.field('Mulai', 'start', v.start, { type: 'date' }) + Orbis.field('Berakhir', 'end', v.end, { type: 'date' }) +
      Orbis.field('Berlaku di POS', 'ch_pos', v.channels.indexOf('pos') >= 0, { type: 'checkbox' }) + Orbis.field('Berlaku di toko online', 'ch_store', v.channels.indexOf('store') >= 0, { type: 'checkbox' }),
      Orbis.btn('Batal', 'closeModal') + Orbis.btn('Simpan', 'promoSave', null, { kind: 'primary' }));
  };
  A.promoSave = function () {
    var f = Orbis.formData();
    var spec = { name: f.name, code: f.code, type: f.type, value: f.value, minPurchase: f.minPurchase, maxDiscount: f.maxDiscount, quota: f.quota, start: f.start, end: f.end, channels: [f.ch_pos ? 'pos' : null, f.ch_store ? 'store' : null].filter(Boolean) };
    if (f.id) P().update(f.id, spec); else P().create(spec);
    Orbis.closeModal(); Orbis.toast('Promo disimpan');
  };
  A.promoPause = function (id) { P().pause(id); Orbis.toast('Promo dijeda'); };
  A.promoActivate = function (id) { P().activate(id); Orbis.toast('Promo diaktifkan'); };
  A.promoSim = function () {
    var f = Orbis.readForm('#p-sim');
    ui.sim = { code: f.code, subtotal: f.subtotal, channel: f.channel };
    var sub = Math.floor(Number(f.subtotal) || 0);
    try { var q = Orbis.read(function (d) { return P().quote(d, { code: f.code, subtotal: sub, channel: f.channel }); }); ui.result = { ok: true, discount: q.discount, subtotal: sub }; }
    catch (e) { if (e.name !== 'OrbisError') throw e; ui.result = { ok: false, message: e.message }; }
    Orbis.render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
