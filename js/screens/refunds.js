/* Refunds screen: requests list with approve/reject, plus request form. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions;
  Orbis.ui = Orbis.ui || {};
  var U = Orbis.ui.refunds = Orbis.ui.refunds || { orderId: '' };

  Orbis.screens.refunds = function (d) {
    var R = Orbis.domain.refunds, canApprove = Orbis.can('refund.approve'), canReq = Orbis.can('refund.request');
    var table = Orbis.table([
      { label: 'ID', fmt: function (r) { return '<b>' + esc(r.id) + '</b><br><small>' + esc(Orbis.fmtTime(r.requestedAt)) + '</small>'; } },
      { label: 'Pesanan', fmt: function (r) { return esc(r.orderId); } },
      { label: 'Item', fmt: function (r) { return r.lines.map(function (l) { return esc(l.qty) + ' x ' + esc(l.skuId); }).join(', '); } },
      { label: 'Nominal', right: true, fmt: function (r) { return esc(Orbis.idr(r.amount)); } },
      { label: 'Alasan', fmt: function (r) { return esc(r.reason); } },
      { label: 'Pemohon', fmt: function (r) { return esc(r.requestedBy); } },
      { label: 'Status', fmt: function (r) { return Orbis.chip(r.status === 'APPROVED' ? 'APPROVED' : r.status); } },
      { label: '', fmt: function (r) {
        if (r.status !== 'REQUESTED' || !canApprove) return '';
        return Orbis.btn('Setujui', 'refundApproveDlg', [r.id], { kind: 'sm' }) + ' ' + Orbis.btn('Tolak', 'refundRejectDlg', [r.id], { kind: 'sm' });
      } }
    ], R.list(d), 'Belum ada permintaan refund.').replace('class="tbl"', 'class="tbl stack"');
    var elig = R.eligibleOrders(d);
    var form = '';
    if (canReq) {
      form = '<div id="rf-form">' + Orbis.field('Pesanan', 'orderId', U.orderId, { type: 'select', options: [['', '- pilih pesanan -']].concat(elig.map(function (o) { return [o.id, o.id + ' · ' + Orbis.idr(o.total)]; })) }).replace('<select', '<select data-change="refundPick"');
      var o = U.orderId ? Orbis.domain.orders.get(d, U.orderId) : null;
      if (o) {
        form += R.remaining(d, o).map(function (r) {
          return '<div class="fld"><label for="rf-' + esc(r.skuId) + '">' + esc(r.name) + ' (sisa ' + esc(r.remaining) + ' dari ' + esc(r.sold) + ')</label><input id="rf-' + esc(r.skuId) + '" type="number" min="0" max="' + esc(r.remaining) + '" name="qty:' + esc(r.skuId) + '" value="0"></div>';
        }).join('') + Orbis.field('Alasan (min. 5 karakter)', 'reason', '') + Orbis.btn('Ajukan refund', 'refundSubmit', null, { kind: 'primary' });
      }
      form += '</div>';
    }
    return Orbis.pageHead('Retur & Refund', 'Satu alur: ajukan, lalu disetujui manajer/owner/finance') +
      (canReq ? Orbis.card('Ajukan retur', form) : '') + Orbis.card('Permintaan', table);
  };

  A.refundPick = function (id) { U.orderId = id; Orbis.emit(); };
  A.refundSubmit = function () {
    var f = Orbis.readForm('#rf-form'), lines = [];
    Object.keys(f).forEach(function (k) { if (k.indexOf('qty:') === 0 && Number(f[k]) > 0) lines.push({ skuId: k.slice(4), qty: Number(f[k]) }); });
    Orbis.domain.refunds.request(U.orderId, lines, f.reason);
    U.orderId = ''; Orbis.toast('Permintaan refund diajukan');
  };
  A.refundApproveDlg = function (id) {
    Orbis.modal('Setujui refund ' + id, Orbis.field('Masukkan kembali ke stok jual', 'restock', true, { type: 'checkbox' }) +
      Orbis.field('Kondisi barang', 'condition', 'GOOD', { type: 'select', options: [['GOOD', 'Baik'], ['DAMAGED', 'Rusak']] }), Orbis.btn('Setujui', 'refundApprove', [id], { kind: 'primary' }));
  };
  A.refundApprove = function (id) {
    var f = Orbis.formData(); Orbis.domain.refunds.approve(id, { restock: !!f.restock, condition: f.condition });
    Orbis.closeModal(); Orbis.toast('Refund disetujui');
  };
  A.refundRejectDlg = function (id) {
    Orbis.modal('Tolak refund ' + id, Orbis.field('Alasan (min. 5 karakter)', 'reason', ''), Orbis.btn('Tolak', 'refundReject', [id], { kind: 'danger' }));
  };
  A.refundReject = function (id) { var f = Orbis.formData(); Orbis.domain.refunds.reject(id, f.reason); Orbis.closeModal(); Orbis.toast('Refund ditolak'); };
})(window);
