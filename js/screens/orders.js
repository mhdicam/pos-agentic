/* Orders screen: filter, table, detail modal with advance/cancel and payment history. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions;
  Orbis.ui = Orbis.ui || {};
  var U = Orbis.ui.orders = Orbis.ui.orders || { status: 'ALL', q: '' };
  var STATUSES = ['ALL', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'RETURNED'];

  Orbis.screens.orders = function (d) {
    var q = U.q.toLowerCase();
    var rows = Orbis.domain.orders.list(d).filter(function (o) {
      return (U.status === 'ALL' || o.status === U.status) && (!q || (o.id + ' ' + (o.customer.name || '')).toLowerCase().indexOf(q) >= 0);
    });
    var table = Orbis.table([
      { label: 'Pesanan', fmt: function (o) { return '<b>' + esc(o.id) + '</b><br><small>' + esc(Orbis.fmtTime(o.createdAt)) + '</small>'; } },
      { label: 'Pelanggan', fmt: function (o) { return esc(o.customer.name || '-'); } },
      { label: 'Metode', fmt: function (o) { return esc(o.method) + ' · ' + esc(o.channel); } },
      { label: 'Total', right: true, fmt: function (o) { return esc(Orbis.idr(o.total)); } },
      { label: 'Status', fmt: function (o) { return Orbis.chip(o.status); } },
      { label: 'Bayar', fmt: function (o) { return Orbis.chip(o.paymentStatus); } },
      { label: '', fmt: function (o) { return Orbis.btn('Detail', 'orderDetail', [o.id], { kind: 'sm' }); } }
    ], rows, 'Belum ada pesanan.').replace('class="tbl"', 'class="tbl stack"');
    return Orbis.pageHead('Pesanan', 'Semua pesanan POS dan toko online') +
      Orbis.tabs(STATUSES.map(function (s) { return [s, s === 'ALL' ? 'Semua' : s]; }), U.status, 'ordersFilter') +
      '<div class="fld"><label for="ord-q">Cari</label><input id="ord-q" name="ord-q" value="' + esc(U.q) + '" data-input="ordersSearch" data-input-render placeholder="ID atau nama"></div>' + table;
  };

  A.ordersFilter = function (s) { U.status = s; Orbis.emit(); };
  A.ordersSearch = function (v) { U.q = v; };

  function detail(id) {
    var d = Orbis.db(), o = Orbis.domain.orders.get(d, id);
    if (!o) throw Orbis.Err('NOT_FOUND', 'Pesanan tidak ditemukan');
    var pays = Orbis.domain.orders.payments(d, id);
    var canAdv = Orbis.can('order.advance') && ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'].indexOf(o.status) >= 0 && !(o.status === 'READY' && o.method === 'delivery');
    var next = { PLACED: 'Terima', ACCEPTED: 'Mulai siapkan', PREPARING: 'Tandai siap', READY: 'Selesaikan' }[o.status];
    var canCancel = Orbis.can('order.cancel') && ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'].indexOf(o.status) >= 0;
    var body = '<div class="row">' + Orbis.chip(o.status) + Orbis.chip(o.paymentStatus) + '</div>' +
      '<p>' + esc(o.customer.name || 'Tanpa nama') + (o.customer.phone ? ' · ' + esc(o.customer.phone) : '') + (o.address ? '<br>' + esc(o.address) : '') + '</p>' +
      o.items.map(function (i) { return '<div class="line"><span>' + esc(i.qty) + ' x ' + esc(i.name) + '</span><b>' + esc(Orbis.idr(i.qty * i.price)) + '</b></div>'; }).join('') +
      '<div class="line"><span>Diskon / Pajak / Service / Ongkir</span><b>' + esc(Orbis.idr(o.discount)) + ' / ' + esc(Orbis.idr(o.tax)) + ' / ' + esc(Orbis.idr(o.service)) + ' / ' + esc(Orbis.idr(o.deliveryFee)) + '</b></div>' +
      '<div class="line"><span>Total</span><b>' + esc(Orbis.idr(o.total)) + '</b></div>' +
      (o.refundDue ? '<div class="banner bad">Perlu refund: ' + esc(Orbis.idr(o.refundDue)) + ' (proses lewat menu Retur &amp; Refund)</div>' : '') +
      '<h4>Pembayaran</h4>' + (pays.length ? pays.map(function (p) { return '<div class="line"><span>' + esc(p.type.toUpperCase()) + (p.amount < 0 ? ' (refund)' : '') + ' · ' + esc(Orbis.fmtTime(p.at)) + '</span><b>' + esc(Orbis.idr(p.amount)) + '</b></div>'; }).join('') : '<p>Belum ada pembayaran.</p>') +
      '<h4>Riwayat</h4>' + o.history.map(function (h) { return '<div class="line"><span>' + esc((h.from || 'baru') + ' → ' + h.to) + '</span><small>' + esc(h.by) + ' · ' + esc(Orbis.fmtTime(h.at)) + '</small></div>'; }).join('') +
      (canCancel ? Orbis.field('Alasan batal (min. 5 karakter)', 'reason', '') : '');
    var foot = (canAdv ? Orbis.btn(next, 'orderAdvance', [o.id], { kind: 'primary' }) : '') + (canCancel ? Orbis.btn('Batalkan', 'orderCancel', [o.id], { kind: 'danger' }) : '');
    Orbis.modal('Pesanan ' + o.id, body, foot);
  }
  A.orderDetail = detail;
  A.orderAdvance = function (id) { Orbis.domain.orders.advance(id); Orbis.closeModal(); Orbis.toast('Status diperbarui'); };
  A.orderCancel = function (id) { var f = Orbis.formData(); Orbis.domain.orders.cancel(id, f.reason); Orbis.closeModal(); Orbis.toast('Pesanan dibatalkan'); };
})(window);
