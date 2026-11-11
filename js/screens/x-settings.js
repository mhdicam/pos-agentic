/* Orbis v2 — settings screen (RD-16): replaces Orbis.screens.settings with 6 tabs, and POS checkout/receipt
   (enabled tenders only, tax label, pembulatan, WhatsApp share). Profile and hours tabs reuse owner.js rendering + actions. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, S = Orbis.screens, A = Orbis.actions;
  var B = function () { return Orbis.domain.bizSettings; };
  var ui = Orbis.ui = Orbis.ui || {};
  var U = ui.xs = ui.xs || { tab: 'profile', outlet: '', draft: null };
  var base = S.settings;   // owner.js: profile + hours tabs
  var TABS = [['profile', 'Profil & struk'], ['tax', 'Pajak & service'], ['round', 'Pembulatan'], ['pay', 'Metode pembayaran'], ['receipt', 'Desain struk'], ['hours', 'Jam operasional']];
  var TENDER_LABEL = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer bank', edc: 'EDC (kartu)', cod: 'COD (bayar di tempat)' };
  var opts = function (pairs) { return pairs.map(function (p) { return [String(p[0]), p[1]]; }); };
  var line = function (k, v) { return '<div class="line"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>'; };
  var minus = function (n) { return (n < 0 ? '-' : '') + Orbis.idr(Math.abs(n)); };
  var chk = function (label, name, on) { return Orbis.field(label, name, on, { type: 'checkbox' }); };

  /* ---------- draft: form changes re-render previews without saving ---------- */
  function draft(key, saved) { return U.draft && U.draft.key === key ? U.draft.v : saved; }
  A.xsDraft = function () {
    var f = Orbis.readForm('#xs-form'), k = U.tab === 'tax' ? 'tax:' + U.outlet : U.tab;
    if (U.tab === 'tax') { f.dpp = !!f.dpp; f.taxOnService = !!f.taxOnService; f.rate = Number(f.rate); f.service = Number(f.service); }
    if (U.tab === 'round') f.unit = Number(f.unit);
    U.draft = { key: k, v: f }; Orbis.render();
  };
  A.xsTab = function (t) { U.tab = t; U.draft = null; ui.owner.tab = t; Orbis.render(); };
  A.xsOutlet = function (v) { U.outlet = v; U.draft = null; Orbis.render(); };
  function saved(msg) { U.draft = null; Orbis.toast(msg); }

  function taxTab(d) {
    var outlets = Orbis.mine(d, 'outlets'), c = (d.bizSettings || {})[d.session.tenant] || {};
    var own = U.outlet ? (c.outletTax || {})[U.outlet] : c.tax;
    var t = draft('tax:' + U.outlet, own || B().taxFor(d, U.outlet) || { type: 'none', rate: 0, mode: 'exclusive', service: Orbis.domain.orders.settings(d).service });
    var pv, err = '';
    try { pv = B().calc(B().cleanTax(t), null, null, 100000, 0); } catch (e) { err = e.message; }
    var preview = err ? '<div class="banner bad" role="alert">' + esc(err) + '</div>' : '<div class="receipt-pv" aria-label="Contoh perhitungan">' + line('Subtotal', Orbis.idr(100000)) +
      (pv.service ? line('Service ' + t.service + '%', Orbis.idr(pv.service)) : '') + (pv.tax ? line(pv.taxLabel, Orbis.idr(pv.tax)) : '') + line('Total', Orbis.idr(pv.total)) +
      (pv.taxIncluded ? '<small>Termasuk ' + esc(pv.taxLabel) + ' ' + esc(Orbis.idr(pv.taxIncluded)) + '</small>' : '') + '</div>';
    return Orbis.card('Pajak & service', Orbis.field('Berlaku untuk', 'xsOutlet', U.outlet, { type: 'select', options: [['', 'Default tenant (semua outlet)']].concat(outlets.map(function (o) { return [o.id, o.name + ((c.outletTax || {})[o.id] ? ' · khusus' : '')]; })) }).replace('<select ', '<select data-change="xsOutlet" ') +
      (!own && U.outlet ? '<p class="fine">Outlet ini memakai default tenant sampai disimpan.</p>' : '') +
      (!c.tax && !U.outlet ? '<p class="fine">Belum diatur: memakai pajak/service lama (' + esc(Orbis.domain.orders.settings(d).tax) + '% / ' + esc(Orbis.domain.orders.settings(d).service) + '%).</p>' : '') +
      '<div id="xs-form" data-change="xsDraft"><div class="f2">' +
      Orbis.field('Jenis pajak', 'type', t.type, { type: 'select', options: [['none', 'Tanpa pajak'], ['pbjt', 'PBJT (ex-PB1) — restoran, maks 10%'], ['ppn', 'PPN 12% — retail/barang']] }) +
      Orbis.field('Tarif %', 'rate', t.rate, { type: 'number', min: 0, hint: t.type === 'ppn' ? 'PPN wajib 12%.' : 'PBJT 0-10% sesuai perda (DKI 10%).' }) +
      Orbis.field('Mode harga', 'mode', t.mode, { type: 'select', options: [['exclusive', 'Belum termasuk pajak (ditambahkan)'], ['inclusive', 'Sudah termasuk pajak (dipisahkan)']] }) +
      Orbis.field('Service charge %', 'service', t.service || 0, { type: 'number', min: 0, hint: '0-20%.' }) + '</div>' +
      (t.type === 'ppn' ? chk('DPP nilai lain 11/12 (tarif efektif 11%, barang non-mewah)', 'dpp', t.dpp) : '') +
      chk('Pajak dihitung dari subtotal + service', 'taxOnService', t.taxOnService) + '</div>' +
      '<h4 class="mt">Contoh pesanan Rp 100.000</h4>' + preview +
      '<div class="row mt">' + Orbis.btn('Simpan', 'xsSaveTax', null, { kind: 'primary' }) + (own && U.outlet ? Orbis.btn('Pakai default tenant', 'xsClearOutlet') : '') + Orbis.btn('Terapkan preset Kopi Awan', 'xsPreset') + '</div>' +
      '<p class="fine mt">Tarif dibulatkan per komponen (Math.round). Dasar PBJT dengan/tanpa service berbeda per daerah; pastikan dengan Bapenda setempat. Perubahan hanya berlaku untuk pesanan baru.</p>');
  }
  function roundTab(d) {
    var r = draft('round', B().rounding(d)), samples = [12345, 28050, 30850, 47499, 99950];
    var rows = samples.map(function (x) { var y = B().roundTo(x, r.unit, r.mode); return { x: x, y: y }; });
    return Orbis.card('Pembulatan', '<div id="xs-form" data-change="xsDraft"><div class="f2">' +
      Orbis.field('Bulatkan ke', 'unit', r.unit, { type: 'select', options: opts([[0, 'Tidak dibulatkan'], [100, 'Rp 100'], [500, 'Rp 500'], [1000, 'Rp 1.000']]) }) +
      Orbis.field('Arah', 'mode', r.mode, { type: 'select', options: [['nearest', 'Terdekat'], ['down', 'Ke bawah'], ['up', 'Ke atas']] }) +
      Orbis.field('Berlaku untuk', 'scope', r.scope, { type: 'select', options: [['cash', 'Hanya pembayaran tunai'], ['all', 'Semua metode']] }) + '</div></div>' +
      '<h4 class="mt">Simulasi</h4>' + Orbis.table([
        { label: 'Total', right: true, fmt: function (x) { return esc(Orbis.idr(x.x)); } },
        { label: 'Pembulatan', right: true, fmt: function (x) { return esc(minus(x.y - x.x)); } },
        { label: 'Dibayar', right: true, fmt: function (x) { return '<b>' + esc(Orbis.idr(x.y)) + '</b>'; } }], rows) +
      '<div class="row mt">' + Orbis.btn('Simpan', 'xsSaveRound', null, { kind: 'primary' }) + '</div>' +
      '<p class="fine mt">Selisih pembulatan dicatat sebagai komponen pesanan (bisa negatif) dan muncul di struk serta laporan. Split payment tidak dibulatkan.</p>');
  }
  function payTab(d) {
    var p = B().payments(d), acc = p.transfer.accounts.concat([{}, {}]).slice(0, Math.max(2, p.transfer.accounts.length + 1));
    return Orbis.card('Metode pembayaran', '<div id="xs-pay">' + B().TENDERS.map(function (k) { return chk(TENDER_LABEL[k], k, p[k].enabled); }).join('') +
      '<div class="f2 mt">' + Orbis.field('MDR QRIS % (simulasi)', 'qrisMdr', p.qris.mdr, { type: 'number', min: 0, hint: 'Informasi saja: MDR 0,3% dipotong penyedia saat settlement, tidak ditagihkan ke pelanggan.' }) + '</div>' +
      '<h4 class="mt">Rekening transfer</h4>' + acc.map(function (a, i) {
        return '<div class="f3">' + Orbis.field('Bank', 'bank' + i, a.bank || '', { placeholder: 'BCA' }) + Orbis.field('No. rekening', 'number' + i, a.number || '', { placeholder: '1234567890' }) + Orbis.field('Atas nama', 'name' + i, a.name || '') + '</div>';
      }).join('') + '<input type="hidden" name="nacc" value="' + acc.length + '">' +
      '<div class="row mt">' + Orbis.btn('Simpan', 'xsSavePay', null, { kind: 'primary' }) + '</div>' +
      '<p class="fine mt">Minimal satu metode kasir (tunai, QRIS, transfer) aktif. EDC belum bisa dipakai di kasir prototipe. Status settlement QRIS di luar cakupan.</p></div>');
  }
  function sampleOrder(d) {
    return Orbis.domain.orders.list(d)[0] || { id: 'ORD-CONTOH', createdAt: Orbis.clock.now(), createdBy: d.session.actor, items: [{ qty: 2, name: 'Contoh produk', price: 25000 }],
      subtotal: 50000, discount: 0, service: 0, tax: 5000, taxLabel: 'PBJT 10%', deliveryFee: 0, rounding: 0, total: 55000, customer: {} };
  }
  function paper(d, o, r) {
    return '<div class="xs-paper xs-' + esc(r.paper) + '" aria-label="Pratinjau struk ' + esc(r.paper) + ' mm">' + (r.logo ? '<div class="xs-logo" aria-hidden="true">' + esc((Orbis.domain.tenant.profile(d).name || 'O').charAt(0)) + '</div>' : '') +
      B().receiptLines(d, o, r).map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + (r.showQr ? '<div class="xs-qr" aria-hidden="true">QR</div>' : '') + '</div>';
  }
  function receiptTab(d) {
    var r = draft('receipt', B().receipt(d));
    ['logo', 'showNpwp', 'showTax', 'showCashier', 'showQr'].forEach(function (k) { r[k] = !!r[k]; });
    return '<div class="grid g2">' + Orbis.card('Desain struk', '<div id="xs-form" data-change="xsDraft">' +
      Orbis.field('Lebar kertas', 'paper', r.paper, { type: 'select', options: [['58', '58 mm'], ['80', '80 mm']] }) +
      Orbis.field('Header (maks 4 baris)', 'header', r.header, { type: 'textarea' }) + Orbis.field('Footer (maks 4 baris)', 'footer', r.footer, { type: 'textarea' }) +
      chk('Tampilkan logo', 'logo', r.logo) + chk('Tampilkan NPWP', 'showNpwp', r.showNpwp) + chk('Rincian pajak', 'showTax', r.showTax) + chk('Nama kasir', 'showCashier', r.showCashier) + chk('QR lacak pesanan', 'showQr', r.showQr) + '</div>' +
      '<div class="row mt">' + Orbis.btn('Simpan', 'xsSaveReceipt', null, { kind: 'primary' }) + '</div>') +
      Orbis.card('Pratinjau', paper(d, sampleOrder(d), r) + '<p class="fine mt">Memakai pesanan terakhir bila ada. NPWP diambil dari Profil.</p>') + '</div>';
  }

  S.settings = function (d, ctx) {
    if (!Orbis.can('tenant.settings')) return Orbis.empty('Hanya Owner yang dapat mengubah pengaturan bisnis.');
    var tabs = Orbis.tabs(TABS, U.tab, 'xsTab');
    if (U.tab === 'profile' || U.tab === 'hours') {
      ui.owner.tab = U.tab;
      var old = Orbis.tabs([['profile', 'Profil & struk'], ['tax', 'Pajak & service'], ['hours', 'Jam operasional']], U.tab, 'ownerTab');
      return base(d, ctx).replace(old, tabs);
    }
    var body = U.tab === 'tax' ? taxTab(d) : U.tab === 'round' ? roundTab(d) : U.tab === 'pay' ? payTab(d) : receiptTab(d);
    return Orbis.pageHead('Pengaturan Bisnis', 'Profil, pajak, pembulatan, pembayaran, struk, dan jam operasional.') + tabs + body;
  };

  A.xsSaveTax = function () { B().saveTax(U.outlet, Orbis.readForm('#xs-form')); saved('Pajak & service disimpan'); };
  A.xsClearOutlet = function () { B().clearOutletTax(U.outlet); saved('Outlet kembali memakai default tenant'); };
  A.xsPreset = function () { B().applyPreset(); U.outlet = ''; saved('Preset Kopi Awan: PBJT 10%, pembulatan Rp 100 tunai'); };
  A.xsSaveRound = function () { B().saveRounding(Orbis.readForm('#xs-form')); saved('Pembulatan disimpan'); };
  A.xsSavePay = function () {
    var f = Orbis.readForm('#xs-pay'), acc = [];
    for (var i = 0; i < Number(f.nacc); i++) acc.push({ bank: f['bank' + i], number: f['number' + i], name: f['name' + i] });
    f.accounts = acc; B().savePayments(f); saved('Metode pembayaran disimpan');
  };
  A.xsSaveReceipt = function () { B().saveReceipt(Orbis.readForm('#xs-form')); saved('Desain struk disimpan'); };

  /* ---------- POS checkout + receipt (overrides pos.js actions) ---------- */
  function posSpec(pay) {
    var P = ui.pos || { cart: [] };
    return { channel: 'pos', method: 'pickup', payment: pay, memberId: P.member || undefined, promoCode: P.promo || undefined,
      items: P.cart.map(function (c) { var x = { skuId: c.skuId, qty: c.qty }; if (c.modifiers) x.modifiers = c.modifiers; if (c.note) x.note = c.note; return x; }) };
  }
  A.posCheckout = function () {
    var d = Orbis.db();
    if (!(ui.pos && ui.pos.cart.length)) throw Orbis.Err('EMPTY_CART', 'Keranjang kosong');
    var cash = Orbis.domain.orders.quote(d, posSpec({ type: 'cash' })), other = Orbis.domain.orders.quote(d, posSpec({ type: 'qris' }));
    var types = B().POS_TENDERS.filter(function (k) { return B().tenderEnabled(d, k); });
    var o = types.map(function (k) { return [k, TENDER_LABEL[k]]; });
    if (types.indexOf('cash') >= 0 && types.length > 1) o.push(['split', 'Split (tunai + ' + TENDER_LABEL[types.filter(function (k) { return k !== 'cash'; })[0]] + ')']);
    var body = line('Subtotal', Orbis.idr(cash.subtotal)) + (cash.discount ? line('Diskon', '-' + Orbis.idr(cash.discount)) : '') + (cash.service ? line('Service', Orbis.idr(cash.service)) : '') +
      (cash.tax ? line(cash.taxLabel, Orbis.idr(cash.tax)) : '') + (cash.rounding ? line('Pembulatan (tunai)', minus(cash.rounding)) : '') +
      line(cash.rounding ? 'Total tunai' : 'Total tagihan', Orbis.idr(cash.total)) + (other.total !== cash.total ? line('Total non-tunai', Orbis.idr(other.total)) : '') +
      (cash.taxLabel !== 'Pajak' && !cash.tax ? '<small>' + esc(cash.taxLabel) + '</small>' : '') +
      Orbis.field('Metode', 'ptype', types[0], { type: 'select', options: o }) +
      (types.indexOf('cash') >= 0 ? Orbis.field('Uang diterima (tunai)', 'tendered', cash.total, { type: 'number', min: 0 }) +
        (o.length > types.length ? Orbis.field('Bagian tunai (khusus split)', 'splitCash', 0, { type: 'number', min: 0, hint: 'Sisanya non-tunai; split tidak dibulatkan.' }) : '') : '');
    Orbis.modal('Pembayaran', body, Orbis.btn('Selesaikan pembayaran', 'posPay', null, { kind: 'primary' }));
  };
  A.posPay = function () {
    var d = Orbis.db(), f = Orbis.formData(), pay;
    if (f.ptype === 'split') {
      var rest = B().POS_TENDERS.filter(function (k) { return k !== 'cash' && B().tenderEnabled(d, k); })[0];
      var total = Orbis.domain.orders.quote(d, posSpec({ type: 'split' })).total, c = Number(f.splitCash);
      pay = { type: 'split', legs: [{ type: 'cash', amount: c }, { type: rest, amount: total - c }].filter(function (l) { return l.amount !== 0; }), tendered: f.tendered === '' ? undefined : Number(f.tendered) };
    } else pay = { type: f.ptype, tendered: f.ptype === 'cash' ? Number(f.tendered) : undefined };
    var o = Orbis.domain.orders.checkout(posSpec(pay));
    ui.pos.cart = []; ui.pos.member = ''; ui.pos.promo = ''; ui.pos.lastReceipt = o.id;
    A.xsReceipt(o.id);
  };
  A.xsReceipt = function (id) {
    var d = Orbis.db(), o = Orbis.domain.orders.get(d, id); if (!o) return;
    var r = B().receipt(d), wa = B().waLink(d, o);
    var pays = Orbis.domain.orders.payments(d, id).map(function (p) { return line(p.type.toUpperCase(), Orbis.idr(p.amount)); }).join('');
    Orbis.modal('Struk', paper(d, o, r) + '<div class="mt">' + pays + '</div>',
      (wa ? '<a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">Kirim WA</a>' : '<small>Kirim WA butuh nomor pelanggan.</small>') + Orbis.btn('Selesai', 'closeModal', null, { kind: 'primary' }));
  };
})(typeof window !== 'undefined' ? window : globalThis);
