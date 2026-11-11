/* Orbis v2 — overview. Every number is computed from ledgers; nothing hard-coded (the old chart was static). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc;

  function bars(rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    return '<div class="bars" role="img" aria-label="Penjualan 7 hari terakhir">' + rows.map(function (r) {
      var h = Math.round((r.v / max) * 100);
      return '<div class="bar"><div class="bar-f" style="height:' + h + '%"></div><div class="bar-l">' + esc(r.l) + '</div><div class="bar-v">' + esc(r.v ? Orbis.idr(r.v) : '-') + '</div></div>';
    }).join('') + '</div>';
  }

  Orbis.screens.overview = function (d, ctx) {
    var orders = Orbis.mine(d, 'orders');
    var live = orders.filter(function (o) { return o.status !== 'CANCELLED'; });
    var paid = live.filter(function (o) { return o.paymentStatus === 'PAID' || o.paymentStatus === 'COD_COLLECTED' || o.paymentStatus === 'PARTIALLY_REFUNDED'; });
    var revenue = Orbis.sum(paid, function (o) { return o.total; });
    var open = live.filter(function (o) { return o.status !== 'COMPLETED' && o.status !== 'RETURNED'; });
    var deliveries = Orbis.mine(d, 'deliveries').filter(function (x) { return ['DELIVERED', 'RETURNED', 'CANCELLED'].indexOf(x.status) < 0; });
    var inv = Orbis.domain.inventory;
    var low = inv.catalog(d).filter(function (r) { return !r.sku.archived && inv.isLow(d, r); });
    var pendingSync = Orbis.mine(d, 'outbox').filter(function (x) { return x.status === 'PENDING_SYNC'; }).length;

    var days = [];
    for (var i = 6; i >= 0; i--) {
      var day = new Date(Orbis.clock.now() - i * 86400000).toISOString().slice(0, 10);  // UTC day buckets (prototype)
      days.push({ l: day.slice(5), v: Orbis.sum(paid.filter(function (o) { return new Date(o.createdAt).toISOString().slice(0, 10) === day; }), function (o) { return o.total; }) });
    }
    var recent = live.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 6);

    var T = Orbis.domain.tenant, isOwner = d.session.role === 'owner';
    var ob = isOwner && T ? T.onboarding(d) : null, att = T ? T.attention(d) : [];
    var todayRev = days[6].v, yRev = days[5].v;
    var delta = yRev ? Math.round((todayRev - yRev) / yRev * 100) : null;
    var aov = paid.length ? Math.round(revenue / paid.length) : 0;
    var byOutlet = Orbis.mine(d, 'outlets').map(function (o) {
      var rows = paid.filter(function (x) { return x.outlet === o.id; });
      return { name: o.name, n: rows.length, v: Orbis.sum(rows, function (x) { return x.total; }) };
    });
    var byChannel = [['pos', 'POS'], ['store', 'Toko online']].map(function (c) {
      var rows = paid.filter(function (x) { return x.channel === c[0]; });
      return { name: c[1], n: rows.length, v: Orbis.sum(rows, function (x) { return x.total; }) };
    });
    var qty = {};
    paid.forEach(function (o) { o.items.forEach(function (i) { qty[i.name] = (qty[i.name] || 0) + i.qty; }); });
    var top = Object.keys(qty).map(function (k) { return { name: k, qty: qty[k] }; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);
    var split = function (rows) {
      var tot = Orbis.sum(rows, function (r) { return r.v; }) || 1;
      return '<ul class="split">' + rows.map(function (r) { var pct = Math.round(r.v / tot * 100); return '<li><div class="row sp"><span>' + esc(r.name) + ' <small>' + esc(r.n) + ' pesanan</small></span><b class="mono">' + esc(Orbis.idr(r.v)) + '</b></div><div class="meter"><div style="width:' + pct + '%"></div></div></li>'; }).join('') + '</ul>';
    };
    var hello = isOwner ? Orbis.btn('Pengaturan', 'go', ['settings'], { icon: 'grid' }) + Orbis.btn('Buka POS', 'go', ['pos'], { kind: 'primary', icon: 'cart' }) : '';

    return Orbis.pageHead('Overview', 'Ringkasan operasional tenant ini, dihitung dari data transaksi.', hello) +
      (ob && ob.done < ob.steps.length ? Orbis.card('Mulai jualan · ' + ob.done + '/' + ob.steps.length + ' selesai',
        '<div class="meter mb"><div style="width:' + Math.round(ob.done / ob.steps.length * 100) + '%"></div></div><ol class="checklist">' + ob.steps.map(function (s) {
          return '<li class="' + (s.done ? 'done' : '') + '"><span class="ck">' + (s.done ? Orbis.icon('check', 14) : '') + '</span><span>' + esc(s.label) + '</span>' + (s.done ? Orbis.chip('ACTIVE', 'Selesai') : Orbis.btn('Kerjakan', 'go', [s.route], { kind: 'sm' })) + '</li>';
        }).join('') + '</ol>') : '') +
      (isOwner && !orders.length ? '<div class="banner row sp"><span>Belum ada transaksi. Isi riwayat demo 30 hari di kedua outlet (kasir, toko online, kurir & COD, refund, biaya, pembelian) lewat alur asli agar semua menu terisi.</span>' + Orbis.btn('Isi data demo', 'ownerDemoSales', null, { kind: 'primary' }) + '</div>' : '') +
      '<div class="grid g4">' +
      Orbis.stat('Penjualan hari ini', Orbis.idr(todayRev), delta == null ? 'belum ada pembanding' : (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta) + '% vs kemarin') +
      Orbis.stat('Pendapatan 7 hari', Orbis.idr(Orbis.sum(days, function (x) { return x.v; })), 'rata-rata ' + Orbis.idr(aov) + ' / pesanan') +
      Orbis.stat('Pesanan berjalan', String(open.length), deliveries.length + ' pengiriman aktif') +
      Orbis.stat('Stok menipis', String(low.length), 'di bawah titik pesan ulang') + '</div>' +
      (att.length ? Orbis.card('Perlu tindakan', '<ul class="list">' + att.map(function (x) {
        return '<li><span>' + Orbis.chip(x.tone, String(x.n)) + ' ' + esc(x.label) + '</span>' + Orbis.btn('Buka', 'go', [x.route], { kind: 'sm' }) + '</li>';
      }).join('') + '</ul>') : '') +
      (pendingSync ? '<div class="banner mt">' + pendingSync + ' transaksi offline menunggu sinkronisasi (PENDING_SYNC) — belum dihitung sebagai lunas di server.</div>' : '') +
      '<div class="grid g2 mt">' +
      Orbis.card('Penjualan 7 hari', bars(days)) +
      Orbis.card('Pesanan terbaru', Orbis.table([
        { label: 'ID', fmt: function (o) { return '<span class="mono">' + esc(o.id) + '</span>'; } },
        { label: 'Pelanggan', fmt: function (o) { return esc((o.customer && o.customer.name) || 'Umum'); } },
        { label: 'Total', right: true, fmt: function (o) { return esc(Orbis.idr(o.total)); } },
        { label: 'Status', fmt: function (o) { return Orbis.chip(o.status); } }
      ], recent, 'Belum ada pesanan.')) + '</div>' +
      '<div class="grid g2 mt">' + Orbis.card('Penjualan per outlet', split(byOutlet)) + Orbis.card('Penjualan per kanal', split(byChannel)) + '</div>' +
      (top.length ? Orbis.card('Produk terlaris', Orbis.table([
        { label: '#', fmt: function (r) { return esc(top.indexOf(r) + 1); } },
        { label: 'Produk', fmt: function (r) { return esc(r.name); } },
        { label: 'Terjual', right: true, fmt: function (r) { return esc(r.qty); } }
      ], top)) : '') +
      (low.length ? Orbis.card('Perlu restock', Orbis.table([
        { label: 'SKU', fmt: function (r) { return esc(r.sku.sku); } },
        { label: 'Produk', fmt: function (r) { return esc(r.product.name); } },
        { label: 'Tersedia', right: true, fmt: function (r) { return esc(r.available); } }
      ], low)) : '');
  };
  Orbis.actions.ownerDemoSales = function () {
    var s = Orbis.demoHistory();
    Orbis.toast('Data demo 30 hari: ' + s.orders + ' pesanan, ' + s.deliveries + ' pengiriman, ' + s.shifts + ' shift');
  };
})(typeof window !== 'undefined' ? window : globalThis);
