/* Orbis v2 — tenant back-office reports (RD-15). Pure, read-only, tenant-scoped; permission `report.read`.
   Filter {from, to, outlet, channel, staff}: dates YYYY-MM-DD inclusive, day boundaries in WIB (UTC+7).
   Sales = non-cancelled orders by createdAt; money in/out = payment rows by `at` (refund legs are negative, COD only once verified);
   refunds = APPROVED refunds by decidedAt. Every report builds id maps once per call (no O(n^2) lookups).
   ponytail: fixed WIB offset (no per-tenant timezone); add tenant tz setting when tenants outside WIB exist. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis;
  var R = Orbis.domain.reports2 = {};
  var DAY = 86400000, WIB = 7 * 3600000;
  var DATE = /^\d{4}-\d{2}-\d{2}$/;

  R.dayOf = function (ms) { return new Date(ms + WIB).toISOString().slice(0, 10); };
  R.hourOf = function (ms) { return new Date(ms + WIB).getUTCHours(); };
  function addDays(day, n) { return new Date(Date.parse(day + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
  function span(f) { return Math.round((Date.parse(f.to + 'T00:00:00Z') - Date.parse(f.from + 'T00:00:00Z')) / DAY) + 1; }

  /** Date-range presets relative to Orbis.clock (WIB). */
  R.preset = function (name) {
    var today = R.dayOf(Orbis.clock.now());
    if (name === 'yesterday') { var y = addDays(today, -1); return { from: y, to: y }; }
    if (name === '7d') return { from: addDays(today, -6), to: today };
    if (name === '30d') return { from: addDays(today, -29), to: today };
    if (name === 'month') return { from: today.slice(0, 8) + '01', to: today };
    return { from: today, to: today };
  };

  /** Validate + scope the filter. Managers are pinned to their session outlet (RD09-09). */
  R.filter = function (d, f) {
    f = f || {};
    var o = { from: f.from || '', to: f.to || '', outlet: f.outlet || '', channel: f.channel || '', staff: f.staff || '' };
    Orbis.need((!o.from || DATE.test(o.from)) && (!o.to || DATE.test(o.to)), 'VALIDATION', 'Format tanggal harus YYYY-MM-DD');
    Orbis.need(!o.from || !o.to || o.from <= o.to, 'VALIDATION', 'Tanggal "dari" harus sebelum "sampai"');
    Orbis.need(!o.channel || o.channel === 'pos' || o.channel === 'store', 'VALIDATION', 'Kanal tidak valid');
    if (d.session.role === 'manager') o.outlet = d.session.outlet;
    Orbis.need(!o.outlet || Orbis.mine(d, 'outlets').some(function (x) { return x.id === o.outlet; }), 'NOT_FOUND', 'Outlet tidak ditemukan');
    return o;
  };

  function inDay(ms, f) {
    if (ms == null) return false;
    var day = R.dayOf(ms);
    return (!f.from || day >= f.from) && (!f.to || day <= f.to);
  }
  function sum(a, k) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i][k] || 0; return s; }
  function rowsOf(m) { return Object.keys(m).map(function (k) { return m[k]; }); }
  function byDesc(k) { return function (a, b) { return b[k] - a[k] || (String(a.key) < String(b.key) ? -1 : 1); }; }

  /** One pass over tenant rows: in-scope sales orders, payments and refunds. */
  function scope(d, f) {
    var all = Orbis.mine(d, 'orders'), byId = {};
    all.forEach(function (o) { byId[o.id] = o; });
    function match(o) { return !!o && (!f.outlet || o.outlet === f.outlet) && (!f.channel || o.channel === f.channel) && (!f.staff || o.createdBy === f.staff); }
    return {
      all: all, byId: byId, match: match,
      sales: all.filter(function (o) { return o.status !== 'CANCELLED' && match(o) && inDay(o.createdAt, f); }),
      payments: Orbis.mine(d, 'payments').filter(function (p) { return inDay(p.at, f) && match(byId[p.orderId]); }),
      refunds: Orbis.mine(d, 'refunds').filter(function (r) { return match(byId[r.orderId]); })
    };
  }
  function approvedIn(s, f) { return s.refunds.filter(function (r) { return r.status === 'APPROVED' && inDay(r.decidedAt, f); }); }
  function itemsOf(o) { return Array.isArray(o.items) ? o.items : []; }

  function core(s, f) {
    var os = s.sales, refunds = sum(approvedIn(s, f), 'amount');
    var t = { gross: sum(os, 'subtotal'), discounts: sum(os, 'discount'), refunds: refunds, tax: sum(os, 'tax'), service: sum(os, 'service'),
      rounding: sum(os, 'rounding'), deliveryFee: sum(os, 'deliveryFee'), sales: sum(os, 'total'), collected: sum(s.payments, 'amount'), orders: os.length, items: 0 };
    os.forEach(function (o) { itemsOf(o).forEach(function (i) { t.items += i.qty || 0; }); });
    t.net = t.gross - t.discounts - t.refunds;
    t.avgOrder = t.orders ? Math.round(t.sales / t.orders) : 0;
    return t;
  }
  function start(d, f) { Orbis.require('report.read'); f = R.filter(d, f); return { f: f, s: scope(d, f) }; }

  var SUMMARY = [['gross', 'Penjualan kotor'], ['discounts', 'Diskon'], ['refunds', 'Refund'], ['net', 'Penjualan bersih'], ['tax', 'Pajak'], ['service', 'Service'],
    ['rounding', 'Pembulatan'], ['deliveryFee', 'Ongkir'], ['sales', 'Total tagihan pesanan'], ['collected', 'Total diterima (bayar - refund)'], ['orders', 'Jumlah pesanan'], ['avgOrder', 'Rata-rata pesanan'], ['items', 'Item terjual']];
  /** Ringkasan + comparison vs the previous period of equal length (only when from & to are set). */
  R.summary = function (d, f) {
    var x = start(d, f), t = core(x.s, x.f), prev = null, pf = null;
    if (x.f.from && x.f.to) {
      var n = span(x.f);
      pf = Object.assign({}, x.f, { from: addDays(x.f.from, -n), to: addDays(x.f.from, -1) });
      prev = core(scope(d, pf), pf);
    }
    var rows = SUMMARY.map(function (m) {
      var p = prev ? prev[m[0]] : null;
      return { key: m[0], label: m[1], value: t[m[0]], prev: p, change: p ? Math.round((t[m[0]] - p) * 1000 / Math.abs(p)) / 10 : null };
    });
    return { rows: rows, totals: t, prevRange: pf ? { from: pf.from, to: pf.to } : null };
  };

  function catalog(d) {
    var prod = {}, sku = {};
    Orbis.mine(d, 'products').forEach(function (p) { prod[p.id] = p; });
    Orbis.mine(d, 'skus').forEach(function (k) { sku[k.id] = { sku: k, product: prod[k.productId] || {} }; });
    return sku;
  }
  function lineGroup(d, f, keyFn) {
    var x = start(d, f), cat = catalog(d), m = {};
    x.s.sales.forEach(function (o) {
      itemsOf(o).forEach(function (i) {
        var c = cat[i.skuId] || { sku: {}, product: {} }, k = keyFn(i, c);
        var r = m[k[0]] = m[k[0]] || { key: k[0], name: k[1], qty: 0, sales: 0, cogs: 0, profit: 0 };
        r.qty += i.qty || 0; r.sales += (i.qty || 0) * (i.price || 0); r.cogs += (i.qty || 0) * (i.cost || 0);
      });
    });
    var rows = rowsOf(m).map(function (r) { r.profit = r.sales - r.cogs; return r; }).sort(byDesc('sales'));
    return { rows: rows, totals: { qty: sum(rows, 'qty'), sales: sum(rows, 'sales'), cogs: sum(rows, 'cogs'), profit: sum(rows, 'profit') } };
  }
  /** Per produk/varian (line snapshot price incl. modifiers, before order discount). */
  R.products = function (d, f) {
    return lineGroup(d, f, function (i, c) { var lbl = c.sku.label && c.sku.label !== 'Standar' ? ' · ' + c.sku.label : ''; return [i.skuId, (c.product.name || i.name) + lbl]; });
  };
  R.categories = function (d, f) { return lineGroup(d, f, function (i, c) { var k = c.product.category || 'Tanpa kategori'; return [k, k]; }); };

  /** Per modifier, from line `modifiers` snapshots; rows [] when no order used modifiers. */
  R.modifiers = function (d, f) {
    var x = start(d, f), m = {};
    x.s.sales.forEach(function (o) {
      itemsOf(o).forEach(function (i) {
        (i.modifiers || []).forEach(function (md) {
          var r = m[md.id] = m[md.id] || { key: md.id, name: md.name, qty: 0, sales: 0 };
          r.qty += i.qty || 0; r.sales += (i.qty || 0) * (md.price || 0);
        });
      });
    });
    var rows = rowsOf(m).sort(byDesc('qty'));
    return { rows: rows, totals: { qty: sum(rows, 'qty'), sales: sum(rows, 'sales') } };
  };

  var PAY = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', cod: 'COD (terverifikasi)' };
  /** Per metode bayar: payment legs in, refund legs out (negative rows), net. Σnet = summary.collected. */
  R.payments = function (d, f) {
    var x = start(d, f), m = {};
    x.s.payments.forEach(function (p) {
      var r = m[p.type] = m[p.type] || { key: p.type, name: PAY[p.type] || p.type, count: 0, received: 0, refunded: 0, net: 0 };
      if (p.amount >= 0) { r.count++; r.received += p.amount; } else r.refunded += -p.amount;
      r.net += p.amount;
    });
    var rows = rowsOf(m).sort(byDesc('net'));
    return { rows: rows, totals: { count: sum(rows, 'count'), received: sum(rows, 'received'), refunded: sum(rows, 'refunded'), net: sum(rows, 'net') } };
  };

  var METHOD = { pickup: 'Ambil sendiri', dine: 'Makan di tempat', delivery: 'Antar' }, CHANNEL = { pos: 'POS', store: 'Toko online' };
  function group(os, keyFn) {
    var m = {};
    os.forEach(function (o) {
      var k = keyFn(o), r = m[k[0]] = m[k[0]] || { key: k[0], name: k[1], orders: 0, sales: 0, avg: 0 };
      r.orders++; r.sales += o.total || 0;
    });
    var rows = rowsOf(m).map(function (r) { r.avg = Math.round(r.sales / r.orders); return r; });
    return { rows: rows, totals: { orders: sum(rows, 'orders'), sales: sum(rows, 'sales') } };
  }
  R.orderTypes = function (d, f) {
    var g2 = group(start(d, f).s.sales, function (o) { return [o.channel + ':' + o.method, (CHANNEL[o.channel] || o.channel) + ' · ' + (METHOD[o.method] || o.method)]; });
    g2.rows.sort(byDesc('sales')); return g2;
  };
  R.staff = function (d, f) {
    var g2 = group(start(d, f).s.sales, function (o) { var n = o.createdBy || 'Tidak diketahui'; return [n, n]; });
    g2.rows.sort(byDesc('sales')); return g2;
  };
  R.outlets = function (d, f) {
    Orbis.require('report.read');
    var base = R.filter(d, f), names = {};
    Orbis.mine(d, 'outlets').forEach(function (o) { names[o.id] = o.name; });
    var rows = Object.keys(names).filter(function (id) { return !base.outlet || id === base.outlet; }).map(function (id) {
      var ff = Object.assign({}, base, { outlet: id }), t = core(scope(d, ff), ff);
      return { key: id, name: names[id], orders: t.orders, sales: t.sales, net: t.net, collected: t.collected };
    });
    return { rows: rows, totals: { orders: sum(rows, 'orders'), sales: sum(rows, 'sales'), net: sum(rows, 'net'), collected: sum(rows, 'collected') } };
  };
  /** 24 rows, WIB hour of day. */
  R.hours = function (d, f) {
    var rows = [];
    for (var h = 0; h < 24; h++) rows.push({ key: h, name: (h < 10 ? '0' : '') + h + ':00', orders: 0, sales: 0 });
    start(d, f).s.sales.forEach(function (o) { var r = rows[R.hourOf(o.createdAt)]; r.orders++; r.sales += o.total || 0; });
    return { rows: rows, totals: { orders: sum(rows, 'orders'), sales: sum(rows, 'sales') } };
  };
  R.days = function (d, f) {
    var g2 = group(start(d, f).s.sales, function (o) { var k = R.dayOf(o.createdAt); return [k, k]; });
    g2.rows.sort(function (a, b) { return a.key < b.key ? -1 : 1; }); return g2;
  };

  /** Per shift (opened in range): cashier, outlet, sales, net cash, variance. */
  R.shifts = function (d, f) {
    var x = start(d, f), names = {}, sales = {}, cash = {};
    Orbis.mine(d, 'outlets').forEach(function (o) { names[o.id] = o.name; });
    x.s.all.forEach(function (o) { if (o.shiftId && o.status !== 'CANCELLED' && (!x.f.channel || o.channel === x.f.channel)) { var a = sales[o.shiftId] = sales[o.shiftId] || { orders: 0, sales: 0 }; a.orders++; a.sales += o.total || 0; } });
    Orbis.mine(d, 'payments').forEach(function (p) { if (p.shiftId && p.type === 'cash') cash[p.shiftId] = (cash[p.shiftId] || 0) + p.amount; });
    var rows = Orbis.mine(d, 'shifts').filter(function (s) {
      return inDay(s.openedAt, x.f) && (!x.f.outlet || s.outlet === x.f.outlet) && (!x.f.staff || s.openedBy === x.f.staff);
    }).sort(function (a, b) { return b.openedAt - a.openedAt; }).map(function (s) {
      var a = sales[s.id] || { orders: 0, sales: 0 };
      return { key: s.id, name: s.id, cashier: s.openedBy, outlet: names[s.outlet] || s.outlet, opened: s.openedAt, status: s.closedAt ? 'Tutup' : 'Buka',
        orders: a.orders, sales: a.sales, cash: cash[s.id] || 0, variance: s.variance || 0 };
    });
    return { rows: rows, totals: { orders: sum(rows, 'orders'), sales: sum(rows, 'sales'), cash: sum(rows, 'cash'), variance: sum(rows, 'variance'), shortCount: rows.filter(function (r) { return r.variance < 0; }).length } };
  };

  /** Diskon: promo part per code + member point redemption; Σamount = summary.discounts. */
  R.discounts = function (d, f) {
    var x = start(d, f), promos = {}, redeem = {}, m = {};
    Orbis.mine(d, 'promos').forEach(function (p) { promos[p.id] = p; });
    Orbis.mine(d, 'pointLedger').forEach(function (r) { if (r.type === 'EARN' && r.redeemValue) redeem[r.orderId] = r.redeemValue; });
    function add(k, name, amt) { if (amt <= 0) return; var r = m[k] = m[k] || { key: k, name: name, orders: 0, amount: 0 }; r.orders++; r.amount += amt; }
    x.s.sales.forEach(function (o) {
      var disc = o.discount || 0; if (!disc) return;
      var pts = Math.min(disc, redeem[o.id] || 0), pr = promos[o.promoId] || {};   // order.discount = promo + point redemption (capped at subtotal)
      add('member', 'Tukar poin member', pts);
      add(o.promoId || 'lain', pr.code ? pr.code + ' · ' + pr.name : 'Diskon lain', disc - pts);
    });
    var rows = rowsOf(m).sort(byDesc('amount'));
    return { rows: rows, totals: { amount: sum(rows, 'amount'), orders: x.s.sales.filter(function (o) { return o.discount > 0; }).length } };
  };

  var RF = { REQUESTED: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak' };
  /** Refund requests decided (or requested, if pending) in range; totals.amount = approved only = summary.refunds. */
  R.refunds = function (d, f) {
    var x = start(d, f);
    var rows = x.s.refunds.filter(function (r) { return inDay(r.decidedAt || r.requestedAt, x.f); }).map(function (r) {
      return { key: r.id, name: r.id, orderId: r.orderId, at: r.decidedAt || r.requestedAt, status: r.status, statusLabel: RF[r.status] || r.status, amount: r.amount, reason: r.reason,
        requestedBy: r.requestedBy, approver: r.decidedBy || '-' };
    }).sort(function (a, b) { return b.at - a.at; });
    var ok = rows.filter(function (r) { return r.status === 'APPROVED'; });
    return { rows: rows, totals: { count: ok.length, amount: sum(ok, 'amount'), pending: rows.filter(function (r) { return r.status === 'REQUESTED'; }).length } };
  };
  /** Void / pembatalan: cancelled orders by cancel time, with actor (authoriser) and reason. */
  R.voids = function (d, f) {
    var x = start(d, f);
    var rows = x.s.all.filter(function (o) { return o.status === 'CANCELLED' && x.s.match(o); }).map(function (o) {
      var h = (o.history || []).filter(function (e) { return e.to === 'CANCELLED'; }).pop() || {};
      return { key: o.id, name: o.id, at: h.at, amount: o.total || 0, reason: o.cancelReason || h.reason || '', cashier: o.createdBy || '', approver: h.by || '-' };
    }).filter(function (r) { return inDay(r.at, x.f); }).sort(function (a, b) { return b.at - a.at; });
    return { rows: rows, totals: { count: rows.length, amount: sum(rows, 'amount') } };
  };
  /** Pajak per taxLabel; Σtax = summary.tax. */
  R.taxes = function (d, f) {
    var m = {};
    start(d, f).s.sales.forEach(function (o) {
      var k = o.taxLabel || 'Pajak', r = m[k] = m[k] || { key: k, name: k, orders: 0, base: 0, tax: 0, taxIncluded: 0, service: 0 };
      r.orders++; r.base += (o.subtotal || 0) - (o.discount || 0); r.tax += o.tax || 0; r.taxIncluded += o.taxIncluded || 0; r.service += o.service || 0;
    });
    var rows = rowsOf(m).sort(byDesc('tax'));
    return { rows: rows, totals: { base: sum(rows, 'base'), tax: sum(rows, 'tax'), taxIncluded: sum(rows, 'taxIncluded'), service: sum(rows, 'service') } };
  };
  /** Laba kotor ESTIMASI (RD09-03): net sales - COGS from line cost snapshots; ignores restock of refunds and waste. */
  R.margin = function (d, f) {
    var p = R.products(d, f), t = R.summary(d, f).totals;
    var profit = t.net - p.totals.cogs;
    return { rows: p.rows, estimated: true,
      totals: { gross: t.gross, discounts: t.discounts, refunds: t.refunds, net: t.net, cogs: p.totals.cogs, profit: profit, marginPct: t.net ? Math.round(profit * 1000 / t.net) / 10 : 0 } };
  };

  /** Filter option lists (tenant-scoped). */
  R.options = function (d) {
    var staff = {};
    Orbis.mine(d, 'orders').forEach(function (o) { if (o.createdBy) staff[o.createdBy] = 1; });
    return { outlets: Orbis.mine(d, 'outlets').map(function (o) { return [o.id, o.name]; }), staff: Object.keys(staff).sort() };
  };
})(typeof window !== 'undefined' ? window : globalThis);
