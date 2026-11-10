/* Orbis v2 — COD & remittance screen (route 'cod'). Verify/dispute only for cod.review roles. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, dv = Orbis.domain.delivery;

  Orbis.screens.cod = function (d) {
    var cods = dv.list(d).filter(function (x) { return x.codAmount > 0 && x.status === 'DELIVERED'; });
    var rems = dv.remittances(d).slice().reverse();
    var review = Orbis.can('cod.review');
    var perCourier = dv.couriers(d).map(function (c) {
      var mine = cods.filter(function (x) { return x.courierId === c.id; });
      var out = Orbis.sum(mine, function (x) { return dv.outstanding(d, x.id); });
      var pend = Orbis.sum(mine, function (x) { return dv.pendingAmount(d, x.id); });
      return { c: c, jobs: mine.length, out: out, pend: pend };
    }).filter(function (r) { return r.jobs > 0; });
    var totalOut = Orbis.sum(perCourier, function (r) { return r.out; });
    var totalPend = Orbis.sum(perCourier, function (r) { return r.pend; });

    var t1 = Orbis.table([
      { label: 'Kurir', fmt: function (r) { return '<b>' + esc(r.c.name) + '</b>'; } },
      { label: 'Pengiriman COD', right: true, fmt: function (r) { return esc(r.jobs); } },
      { label: 'Belum terverifikasi', right: true, fmt: function (r) { return esc(Orbis.idr(r.out)); } },
      { label: 'Menunggu verifikasi', right: true, fmt: function (r) { return esc(Orbis.idr(r.pend)); } }
    ], perCourier, 'Tidak ada COD berjalan.');

    var t2 = Orbis.table([
      { label: 'Setoran', fmt: function (r) { return '<b>' + esc(r.id) + '</b><br><small>' + esc(r.deliveryId) + ' · ' + esc(r.orderId) + '</small>'; } },
      { label: 'Kurir', fmt: function (r) { var c = dv.couriers(d).filter(function (k) { return k.id === r.courierId; })[0]; return esc(c ? c.name : r.courierId); } },
      { label: 'Nominal', right: true, fmt: function (r) { return esc(Orbis.idr(r.amount)); } },
      { label: 'Status', fmt: function (r) { return Orbis.chip(r.status) + (r.reason ? '<br><small>' + esc(r.reason) + '</small>' : ''); } },
      { label: 'Aksi', fmt: function (r) {
        if (r.status !== 'SUBMITTED' || !review) return '';
        return Orbis.btn('Verifikasi', 'codVerify', [r.id], { kind: 'primary' }) + Orbis.btn('Sengketa', 'codDisputeModal', [r.id], { kind: 'danger' });
      } }
    ], rems, 'Belum ada setoran.');

    return Orbis.pageHead('COD & Remitansi', 'Dikumpulkan, disetor, lalu diverifikasi. Pesanan baru lunas setelah verifikasi.') +
      '<div class="grid">' + Orbis.stat('Belum terverifikasi', Orbis.idr(totalOut)) + Orbis.stat('Menunggu verifikasi', Orbis.idr(totalPend)) + '</div>' +
      Orbis.card('COD per kurir', t1) + Orbis.card('Daftar setoran', t2);
  };

  var A = Orbis.actions;
  A.codVerify = function (id) { dv.reviewRemittance(id, 'VERIFY'); Orbis.toast('Setoran diverifikasi'); };
  A.codDisputeModal = function (id) {
    Orbis.modal('Sengketakan setoran', Orbis.field('Alasan (min. 5 karakter)', 'reason', ''), Orbis.btn('Sengketakan', 'codDispute', [id], { kind: 'danger' }));
  };
  A.codDispute = function (id) { dv.reviewRemittance(id, 'DISPUTE', Orbis.formData().reason); Orbis.closeModal(); Orbis.toast('Setoran disengketakan'); };
})(typeof window !== 'undefined' ? window : globalThis);
