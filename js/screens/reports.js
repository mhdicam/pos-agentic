/* Orbis v2 — screen: reports (8 tab, filter, ekspor CSV aman). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions, R = Orbis.domain.reports;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.reports = Orbis.ui.reports || { tab: 'sales', from: '', to: '', channel: '', payment: '' };
  function rerender() { if (Orbis.render) Orbis.render(); }
  var TABS = [['sales', 'Penjualan'], ['products', 'Produk'], ['expenses', 'Biaya'], ['profit', 'Laba'], ['inventory', 'Nilai stok'], ['delivery', 'Pengiriman'], ['payments', 'Pembayaran'], ['customers', 'Pelanggan']];
  function F() { return { from: ui.from || null, to: ui.to || null, channel: ui.channel || null, payment: ui.payment || null }; }
  function idr(k) { return function (r) { return esc(Orbis.idr(r[k])); }; }

  /** Returns {html, rows, cols} per tab. */
  function build(d) {
    var f = F(), t = ui.tab, cols, rows, html, tot;
    if (t === 'products') {
      rows = R.products(d, f, 'revenue'); cols = [{ k: 'name', label: 'Produk' }, { k: 'qty', label: 'Qty' }, { k: 'revenue', label: 'Omzet' }, { k: 'cogs', label: 'HPP' }, { k: 'margin', label: 'Margin' }];
    } else if (t === 'expenses') {
      var e = R.expenses(d, f); rows = e.rows; cols = [{ k: 'category', label: 'Kategori' }, { k: 'amount', label: 'Nominal' }]; tot = Orbis.stat('Total biaya dibayar', Orbis.idr(e.total));
    } else if (t === 'profit') {
      var p = R.profit(d, f); rows = [{ item: 'Omzet', amount: p.revenue }, { item: 'HPP', amount: -p.cogs }, { item: 'Biaya dibayar', amount: -p.expenses }, { item: 'Refund', amount: -p.refunds }, { item: 'Laba', amount: p.profit }];
      cols = [{ k: 'item', label: 'Komponen' }, { k: 'amount', label: 'Nominal' }];
    } else if (t === 'inventory') {
      var v = R.inventoryValuation(d); rows = v.rows; cols = [{ k: 'sku', label: 'SKU' }, { k: 'name', label: 'Produk' }, { k: 'onHand', label: 'Stok' }, { k: 'cost', label: 'HPP' }, { k: 'value', label: 'Nilai' }]; tot = Orbis.stat('Total nilai stok', Orbis.idr(v.total));
    } else if (t === 'delivery') {
      var dl = R.delivery(d, f); rows = Object.keys(dl.byStatus).sort().map(function (k) { return { status: k, count: dl.byStatus[k] }; });
      cols = [{ k: 'status', label: 'Status' }, { k: 'count', label: 'Jumlah' }];
      tot = Orbis.stat('COD belum disetor', Orbis.idr(dl.codOutstanding), 'Tertagih ' + Orbis.idr(dl.codCollected) + ' · disetor terverifikasi ' + Orbis.idr(dl.codRemitted));
    } else if (t === 'payments') {
      var pm = R.payments(d, f); rows = pm.rows; cols = [{ k: 'type', label: 'Metode' }, { k: 'count', label: 'Transaksi' }, { k: 'amount', label: 'Nominal' }]; tot = Orbis.stat('Total pembayaran', Orbis.idr(pm.total));
    } else if (t === 'customers') {
      rows = R.customers(d, f); cols = [{ k: 'name', label: 'Pelanggan' }, { k: 'phone', label: 'Telepon' }, { k: 'orders', label: 'Pesanan' }, { k: 'spend', label: 'Belanja' }];
    } else {
      var s = R.sales(d, f); rows = s.byDay; cols = [{ k: 'day', label: 'Tanggal' }, { k: 'orders', label: 'Pesanan' }, { k: 'revenue', label: 'Omzet' }];
      tot = '<div class="stats">' + Orbis.stat('Omzet', Orbis.idr(s.revenue)) + Orbis.stat('Pesanan', String(s.orders)) + Orbis.stat('Item terjual', String(s.items)) + '</div>';
    }
    var money = { amount: 1, revenue: 1, cogs: 1, margin: 1, cost: 1, value: 1, spend: 1 };
    var tcols = cols.map(function (c) { return { label: c.label, right: !!money[c.k] || c.k === 'qty' || c.k === 'count' || c.k === 'orders' || c.k === 'onHand', fmt: function (r) { return money[c.k] ? esc(Orbis.idr(r[c.k])) : esc(r[c.k]); } }; });
    return { html: (tot || '') + Orbis.table(tcols, rows, 'Tidak ada data pada filter ini.'), rows: rows, cols: cols };
  }

  Orbis.screens.reports = function (d) {
    if (!Orbis.can('report.read')) return Orbis.empty('Peran ini tidak punya akses laporan.');
    var b = build(d);
    var filters = '<div id="rptf" class="filters">' + Orbis.field('Dari', 'from', ui.from, { type: 'date' }) + Orbis.field('Sampai', 'to', ui.to, { type: 'date' }) +
      Orbis.field('Kanal', 'channel', ui.channel, { type: 'select', options: [['', 'Semua'], ['pos', 'POS'], ['store', 'Toko online']] }) +
      Orbis.field('Pembayaran', 'payment', ui.payment, { type: 'select', options: [['', 'Semua'], 'cash', 'transfer', 'qris', 'cod'] }) + Orbis.btn('Terapkan', 'rptApply', null, { kind: 'primary' }) + '</div>';
    var csv = R.exportCsv(b.rows, b.cols);
    var href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv);
    var dl = '<a class="btn" download="laporan-' + esc(ui.tab) + '.csv" href="' + esc(href) + '" data-blob="1">Unduh CSV</a>';
    return Orbis.pageHead('Laporan', 'Angka dihitung dari pesanan, pembayaran, refund, dan biaya dibayar.', dl) + Orbis.tabs(TABS, ui.tab, 'rptTab') + filters + b.html;
  };

  A.rptTab = function (t) { ui.tab = t; rerender(); };
  A.rptApply = function () {
    var f = Orbis.readForm('#rptf');
    if (f.from && f.to && f.from > f.to) throw Orbis.Err('VALIDATION', 'Tanggal "dari" harus sebelum "sampai"');
    ui.from = f.from || ''; ui.to = f.to || ''; ui.channel = f.channel || ''; ui.payment = f.payment || ''; rerender();
  };
})(typeof window !== 'undefined' ? window : globalThis);
