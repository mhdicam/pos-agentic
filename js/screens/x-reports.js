/* Orbis v2 — tenant reports hub (RD-15). Replaces Orbis.screens.reports. Pure render over Orbis.domain.reports2. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions, R2 = Orbis.domain.reports2, CSV = Orbis.domain.reports;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.reports2 = Orbis.ui.reports2 || { rep: 'summary', preset: '7d', from: '', to: '', outlet: '', channel: '', staff: '' };
  function rerender() { if (Orbis.render) Orbis.render(); }
  function idr(n) { return Orbis.idr(n); }
  function pct(n) { return n == null ? '-' : (n > 0 ? '+' : '') + String(n).replace('.', ',') + '%'; }

  var M = 'money', N = 'num';
  var C = {
    name: { k: 'name', label: 'Nama' }, qty: { k: 'qty', label: 'Qty', t: N }, sales: { k: 'sales', label: 'Penjualan', t: M }, cogs: { k: 'cogs', label: 'HPP', t: M },
    profit: { k: 'profit', label: 'Laba kotor (estimasi)', t: M }, orders: { k: 'orders', label: 'Pesanan', t: N }, avg: { k: 'avg', label: 'Rata-rata', t: M }
  };
  /* key, label, fn, cols, kpis(totals) -> [[label,value]], chart: row key for bar values */
  var REPORTS = [
    ['summary', 'Ringkasan penjualan'], ['products', 'Per produk/varian'], ['categories', 'Per kategori'], ['modifiers', 'Per modifier'],
    ['payments', 'Metode pembayaran'], ['orderTypes', 'Jenis pesanan'], ['outlets', 'Per outlet'], ['hours', 'Per jam'], ['days', 'Per hari'],
    ['staff', 'Per staf'], ['shifts', 'Per shift'], ['discounts', 'Diskon & promo'], ['refunds', 'Refund'], ['voids', 'Pembatalan (void)'],
    ['taxes', 'Pajak'], ['margin', 'Laba kotor (estimasi)']
  ];
  var DEF = {
    summary: { cols: [{ k: 'label', label: 'Metrik' }, { k: 'value', label: 'Periode ini', t: 'mixed' }, { k: 'prev', label: 'Periode sebelumnya', t: 'mixed' }, { k: 'change', label: 'Perubahan', t: 'pct' }],
      kpis: function (t) { return [['Penjualan bersih', idr(t.net)], ['Total diterima', idr(t.collected)], ['Pesanan', String(t.orders)], ['Rata-rata pesanan', idr(t.avgOrder)]]; } },
    products: { cols: [C.name, C.qty, C.sales, C.cogs, C.profit], chart: 'sales', kpis: function (t) { return [['Item terjual', String(t.qty)], ['Penjualan', idr(t.sales)]]; } },
    categories: { cols: [C.name, C.qty, C.sales, C.cogs, C.profit], chart: 'sales', kpis: function (t) { return [['Item terjual', String(t.qty)], ['Penjualan', idr(t.sales)]]; } },
    modifiers: { cols: [C.name, C.qty, { k: 'sales', label: 'Tambahan harga', t: M }], chart: 'qty', empty: 'Belum ada data modifier. Tambahkan modifier di Produk lalu jual lewat POS.',
      kpis: function (t) { return [['Modifier terjual', String(t.qty)], ['Tambahan harga', idr(t.sales)]]; } },
    payments: { cols: [{ k: 'name', label: 'Metode' }, { k: 'count', label: 'Transaksi', t: N }, { k: 'received', label: 'Diterima', t: M }, { k: 'refunded', label: 'Refund', t: M }, { k: 'net', label: 'Bersih', t: M }], chart: 'net',
      note: 'COD dihitung setelah setoran diverifikasi finance.', kpis: function (t) { return [['Total bersih', idr(t.net)], ['Refund keluar', idr(t.refunded)], ['Transaksi', String(t.count)]]; } },
    orderTypes: { cols: [{ k: 'name', label: 'Kanal · jenis' }, C.orders, C.sales, C.avg], chart: 'sales', kpis: function (t) { return [['Pesanan', String(t.orders)], ['Penjualan', idr(t.sales)]]; } },
    outlets: { cols: [{ k: 'name', label: 'Outlet' }, C.orders, C.sales, { k: 'net', label: 'Bersih', t: M }, { k: 'collected', label: 'Diterima', t: M }], chart: 'sales',
      kpis: function (t) { return [['Penjualan', idr(t.sales)], ['Diterima', idr(t.collected)]]; } },
    hours: { cols: [{ k: 'name', label: 'Jam (WIB)' }, C.orders, C.sales], chart: 'sales', label: 'name', kpis: function (t) { return [['Pesanan', String(t.orders)], ['Penjualan', idr(t.sales)]]; } },
    days: { cols: [{ k: 'name', label: 'Tanggal (WIB)' }, C.orders, C.sales, C.avg], chart: 'sales', label: 'name', kpis: function (t) { return [['Pesanan', String(t.orders)], ['Penjualan', idr(t.sales)]]; } },
    staff: { cols: [{ k: 'name', label: 'Dibuat oleh' }, C.orders, C.sales, C.avg], chart: 'sales', note: 'Staf = pembuat pesanan (kasir/penagih). Pelayan belum dicatat terpisah.',
      kpis: function (t) { return [['Pesanan', String(t.orders)], ['Penjualan', idr(t.sales)]]; } },
    shifts: { cols: [{ k: 'name', label: 'Shift' }, { k: 'cashier', label: 'Kasir' }, { k: 'outlet', label: 'Outlet' }, { k: 'opened', label: 'Buka', t: 'time' }, { k: 'status', label: 'Status' }, C.orders, C.sales, { k: 'cash', label: 'Tunai bersih', t: M }, { k: 'variance', label: 'Selisih', t: M }],
      kpis: function (t) { return [['Penjualan', idr(t.sales)], ['Total selisih', idr(t.variance)], ['Shift kurang', String(t.shortCount)]]; } },
    discounts: { cols: [{ k: 'name', label: 'Kode / sumber' }, C.orders, { k: 'amount', label: 'Diskon', t: M }], chart: 'amount', empty: 'Belum ada diskon. Buat promo atau aktifkan tukar poin member.',
      kpis: function (t) { return [['Total diskon', idr(t.amount)], ['Pesanan berdiskon', String(t.orders)]]; } },
    refunds: { cols: [{ k: 'name', label: 'Refund' }, { k: 'orderId', label: 'Pesanan' }, { k: 'at', label: 'Waktu', t: 'time' }, { k: 'statusLabel', label: 'Status' }, { k: 'amount', label: 'Nominal', t: M }, { k: 'reason', label: 'Alasan' }, { k: 'requestedBy', label: 'Pemohon' }, { k: 'approver', label: 'Pemutus' }],
      kpis: function (t) { return [['Refund disetujui', idr(t.amount)], ['Jumlah disetujui', String(t.count)], ['Menunggu', String(t.pending)]]; } },
    voids: { cols: [{ k: 'name', label: 'Pesanan' }, { k: 'at', label: 'Waktu', t: 'time' }, { k: 'amount', label: 'Nominal', t: M }, { k: 'reason', label: 'Alasan' }, { k: 'cashier', label: 'Kasir' }, { k: 'approver', label: 'Dibatalkan oleh' }],
      empty: 'Tidak ada pesanan dibatalkan pada filter ini.', kpis: function (t) { return [['Pesanan batal', String(t.count)], ['Nominal', idr(t.amount)]]; } },
    taxes: { cols: [{ k: 'name', label: 'Nama pajak' }, C.orders, { k: 'base', label: 'DPP', t: M }, { k: 'tax', label: 'Pajak', t: M }, { k: 'service', label: 'Service', t: M }],
      kpis: function (t) { return [['Pajak', idr(t.tax)], ['Service', idr(t.service)], ['DPP', idr(t.base)]]; } },
    margin: { cols: [C.name, C.qty, C.sales, C.cogs, C.profit], chart: 'profit', note: 'Estimasi: penjualan bersih dikurangi HPP snapshot per baris; belum memperhitungkan susut, retur restok, dan biaya operasional.',
      kpis: function (t) { return [['Penjualan bersih', idr(t.net)], ['HPP', idr(t.cogs)], ['Laba kotor (estimasi)', idr(t.profit)], ['Margin (estimasi)', String(t.marginPct).replace('.', ',') + '%']]; } }
  };

  function fmt(c, r) {
    var v = r[c.k];
    if (c.t === M) return esc(idr(v));
    if (c.t === 'time') return esc(v ? Orbis.fmtTime(v) : '-');
    if (c.t === 'pct') return esc(pct(v));
    if (c.t === 'mixed') return esc(v == null ? '-' : /^(orders|items)$/.test(r.key) ? String(v) : idr(v));
    return esc(v);
  }
  function table(def, rows) {
    var cols = def.cols.map(function (c) { return { label: c.label, right: !!c.t && c.t !== 'time', fmt: function (r) { return fmt(c, r); } }; });
    return Orbis.table(cols, rows, def.empty || 'Tidak ada data pada filter ini.').replace('class="tbl"', 'class="tbl stack"');
  }
  /** Simple accessible bar chart (inline SVG, no style attr); values also in the table. */
  function chart(rows, key, labelKey) {
    rows = rows.slice(0, 31);
    if (!rows.length) return '';
    var max = Math.max.apply(null, rows.map(function (r) { return Math.max(0, r[key]); }).concat([1])), w = 100 / rows.length;
    var bars = rows.map(function (r, i) {
      var h = Math.round(Math.max(0, r[key]) / max * 100);
      return '<rect x="' + (i * w + w * 0.15).toFixed(2) + '" y="' + (100 - h) + '" width="' + (w * 0.7).toFixed(2) + '" height="' + h + '"><title>' + esc(r[labelKey || 'name'] + ': ' + (key === 'qty' ? r[key] : idr(r[key]))) + '</title></rect>';
    }).join('');
    var top = rows.slice().sort(function (a, b) { return b[key] - a[key]; })[0];
    return '<figure class="rpt-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="' + esc('Grafik ' + key + '; tertinggi ' + top[labelKey || 'name']) + '">' + bars + '</svg>' +
      '<figcaption>Tertinggi: ' + esc(top[labelKey || 'name']) + ' (' + esc(key === 'qty' ? String(top[key]) : idr(top[key])) + ')</figcaption></figure>';
  }

  function filt() {
    var p = ui.preset === 'custom' ? { from: ui.from, to: ui.to } : R2.preset(ui.preset);
    return { from: p.from, to: p.to, outlet: ui.outlet, channel: ui.channel, staff: ui.staff };
  }

  function screen(d) {
    if (!Orbis.can('report.read')) return Orbis.empty('Peran ini tidak punya akses laporan.');
    var f = R2.filter(d, filt()), opt = R2.options(d), def = DEF[ui.rep] || DEF.summary, label = (REPORTS.filter(function (r) { return r[0] === ui.rep; })[0] || REPORTS[0])[1];
    var res = R2[ui.rep] ? R2[ui.rep](d, f) : R2.summary(d, f);
    var nav = '<nav class="rpt-nav" aria-label="Jenis laporan">' + REPORTS.map(function (r) {
      return '<button type="button" class="rpt-link' + (r[0] === ui.rep ? ' on' : '') + '" aria-current="' + (r[0] === ui.rep ? 'page' : 'false') + '" data-act="rpt2Pick" data-args="' + esc(JSON.stringify([r[0]])) + '">' + esc(r[1]) + '</button>';
    }).join('') + '</nav>';
    var manager = d.session.role === 'manager';
    var filters = '<div id="rpt2f" class="filters">' +
      Orbis.field('Periode', 'preset', ui.preset, { type: 'select', options: [['today', 'Hari ini'], ['yesterday', 'Kemarin'], ['7d', '7 hari'], ['30d', '30 hari'], ['month', 'Bulan ini'], ['custom', 'Custom']] }) +
      Orbis.field('Dari', 'from', f.from, { type: 'date' }) + Orbis.field('Sampai', 'to', f.to, { type: 'date' }) +
      (manager ? '' : Orbis.field('Outlet', 'outlet', f.outlet, { type: 'select', options: [['', 'Semua outlet']].concat(opt.outlets) })) +
      Orbis.field('Kanal', 'channel', f.channel, { type: 'select', options: [['', 'Semua kanal'], ['pos', 'POS'], ['store', 'Toko online']] }) +
      Orbis.field('Staf', 'staff', f.staff, { type: 'select', options: [['', 'Semua staf']].concat(opt.staff) }) +
      Orbis.btn('Terapkan', 'rpt2Apply', null, { kind: 'primary' }) + '</div>';
    var t = res.totals, kpis = '<div class="stats">' + def.kpis(t).map(function (k) { return Orbis.stat(k[0], k[1]); }).join('') + '</div>';
    if (ui.rep === 'summary' && res.prevRange) kpis += '<p class="rpt-note">Dibandingkan dengan ' + esc(res.prevRange.from) + ' s/d ' + esc(res.prevRange.to) + ' (WIB).</p>';
    var visual = def.chart && res.rows.length ? chart(ui.rep === 'days' || ui.rep === 'hours' ? res.rows : res.rows.slice(0, 12), def.chart, def.label) : '';
    var csvCols = def.cols.map(function (c) { return { k: c.k, label: c.label }; });
    var href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + CSV.exportCsv(res.rows, csvCols));
    var dl = res.rows.length ? '<a class="btn" download="laporan-' + esc(ui.rep) + '-' + esc(f.from || 'semua') + '_' + esc(f.to || 'semua') + '.csv" href="' + esc(href) + '">Export CSV</a>' : '';
    var body = Orbis.card(label + (res.estimated ? ' · Estimasi' : ''), (def.note ? '<p class="rpt-note">' + esc(def.note) + '</p>' : '') + kpis + visual + table(def, res.rows), dl);
    return Orbis.pageHead('Laporan', 'Hari dihitung dengan zona WIB (UTC+7). ' + (manager ? 'Hanya outlet Anda.' : 'Pilih outlet atau semua outlet.')) + filters + '<div class="rpt">' + nav + '<div class="rpt-main">' + body + '</div></div>';
  }
  // screens/reports.js loads later in index.html and reassigns the route; re-claim it before app.js boots (its listener registers after ours).
  // ponytail: drop the listener once index.html loads this file after reports.js (or reports.js is removed).
  Orbis.screens.reports = screen;
  if (g.document && g.document.readyState === 'loading') g.document.addEventListener('DOMContentLoaded', function () { Orbis.screens.reports = screen; });

  A.rpt2Pick = function (k) { ui.rep = k; rerender(); };
  A.rpt2Apply = function () {
    var f = Orbis.readForm('#rpt2f'), custom = f.preset === 'custom' || (ui.preset === f.preset && (f.from !== filt().from || f.to !== filt().to));
    if (custom) {
      if (f.from && f.to && f.from > f.to) throw Orbis.Err('VALIDATION', 'Tanggal "dari" harus sebelum "sampai"');
      ui.preset = 'custom'; ui.from = f.from || ''; ui.to = f.to || '';
    } else ui.preset = f.preset;
    ui.outlet = f.outlet || ''; ui.channel = f.channel || ''; ui.staff = f.staff || '';
    rerender();
  };
})(typeof window !== 'undefined' ? window : globalThis);
