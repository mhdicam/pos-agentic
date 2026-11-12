/* Orbis v2 — RD-17 W3 owner value: automatic promotions (G3), estimated P&L + daily summary (G4), payment fees & settlement (G5).
   autopromo: types bxgy | bundle | happyhour; Orbis.hooks.autoDiscount returns the single best eligible promo (largest IDR).
   Auto promos do not stack with a promo code (decision). Quota uses are counted once per order id via afterPlace.
   Times/days are WIB (via reports2.dayOf/hourOf). Pure domain, tenant-scoped, integer IDR.
   ponytail: quota uses are not released on cancel/refund/void; add an afterReverse release when Finance asks for it. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, WIB = 7 * 3600000, DAY = 86400000;
  var R2 = function () { return Orbis.domain.reports2; };
  var AP = Orbis.domain.autopromo = {}, PNL = Orbis.domain.pnl = {}, FEES = Orbis.domain.fees = {};
  var DATE = /^\d{4}-\d{2}-\d{2}$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

  Orbis.seedHooks.push(function (db) { db.autoPromos = []; db.autoPromoUses = []; db.paymentFees = {}; });
  function rows(d, k) { d[k] = d[k] || []; return d[k]; }
  function wibMin(ms) { var x = new Date(ms + WIB); return x.getUTCHours() * 60 + x.getUTCMinutes(); }
  function wibDow(ms) { return new Date(ms + WIB).getUTCDay(); }
  function dayOf(ms) { return new Date(ms + WIB).toISOString().slice(0, 10); }
  function addDays(day, n) { return new Date(Date.parse(day + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }

  /* ======================= G3 automatic promotions ======================= */
  AP.TYPES = { bxgy: 'Beli X gratis/diskon Y', bundle: 'Harga paket', happyhour: 'Happy hour' };

  function cleanScope(s, label) {
    s = s || {};
    var scope = s.scope || 'all';
    Orbis.need(['all', 'sku', 'category'].indexOf(scope) >= 0, 'VALIDATION', label + ': cakupan tidak valid');
    Orbis.need(scope === 'all' || String(s.ref || '').trim(), 'VALIDATION', label + ': pilih produk atau kategori');
    return { scope: scope, ref: scope === 'all' ? '' : String(s.ref).trim() };
  }
  function posInt(v, label, min, max) {
    v = Number(v); Orbis.int(v, label);
    Orbis.need(v >= min && v <= max, 'VALIDATION', label + ' harus ' + min + '-' + max);
    return v;
  }
  /** Validate + normalise a promo spec (throws VALIDATION). */
  AP.clean = function (d, s) {
    s = s || {};
    var p = { name: String(s.name || '').trim(), type: s.type, start: s.start || '', end: s.end || '', quota: s.quota ? posInt(s.quota, 'Kuota', 1, 1000000) : 0 };
    Orbis.need(p.name.length >= 3, 'VALIDATION', 'Nama promo minimal 3 karakter');
    Orbis.need(AP.TYPES[p.type], 'VALIDATION', 'Jenis promo tidak valid');
    Orbis.need((!p.start || DATE.test(p.start)) && (!p.end || DATE.test(p.end)), 'VALIDATION', 'Format tanggal harus YYYY-MM-DD');
    Orbis.need(!p.start || !p.end || p.start <= p.end, 'VALIDATION', 'Tanggal mulai harus sebelum tanggal selesai');
    var outlets = Orbis.mine(d, 'outlets').map(function (o) { return o.id; });
    p.outlets = (s.outlets || []).filter(function (o, i, a) { return a.indexOf(o) === i; });
    p.outlets.forEach(function (o) { Orbis.need(outlets.indexOf(o) >= 0, 'NOT_FOUND', 'Outlet tidak ditemukan'); });
    var skus = Orbis.mine(d, 'skus').map(function (k) { return k.id; });
    function checkRef(sc) { if (sc.scope === 'sku') Orbis.need(skus.indexOf(sc.ref) >= 0, 'NOT_FOUND', 'Produk tidak ditemukan'); return sc; }
    if (p.type === 'happyhour') {
      Orbis.need(TIME.test(s.from || '') && TIME.test(s.to || '') && s.from < s.to, 'VALIDATION', 'Jam mulai/selesai tidak valid (HH:MM, mulai < selesai)');
      p.from = s.from; p.to = s.to;
      p.days = (s.days || []).map(Number).filter(function (x, i, a) { return x >= 0 && x <= 6 && a.indexOf(x) === i; }).sort();
      p.target = checkRef(cleanScope(s.target, 'Cakupan'));
      p.pct = posInt(s.pct, 'Diskon %', 1, 100);
    } else if (p.type === 'bxgy') {
      p.buy = checkRef(cleanScope(s.buy, 'Beli')); p.buy.qty = posInt(s.buy && s.buy.qty, 'Jumlah beli', 1, 50);
      p.get = checkRef(cleanScope(s.get, 'Dapat')); p.get.qty = posInt(s.get && s.get.qty, 'Jumlah dapat', 1, 50);
      p.pct = posInt(s.pct == null ? 100 : s.pct, 'Diskon item gratis %', 1, 100);
    } else {
      p.skus = (s.skus || []).filter(Boolean);
      Orbis.need(p.skus.length >= 2 && p.skus.length <= 6, 'VALIDATION', 'Paket butuh 2-6 produk');
      p.skus.forEach(function (k) { Orbis.need(skus.indexOf(k) >= 0, 'NOT_FOUND', 'Produk paket tidak ditemukan'); });
      p.price = posInt(s.price, 'Harga paket', 1, 100000000);
    }
    return p;
  };

  function uses(d, id) { return Orbis.mine(d, 'autoPromoUses').filter(function (u) { return u.promoId === id; }).length; }
  AP.list = function (d) {
    Orbis.require('promo.write');
    var count = {};
    Orbis.mine(d, 'autoPromoUses').forEach(function (u) { count[u.promoId] = (count[u.promoId] || 0) + 1; });
    return Orbis.mine(d, 'autoPromos').map(function (p) { return Object.assign({}, p, { used: count[p.id] || 0 }); });
  };
  AP.save = function (spec, id) {
    Orbis.require('promo.write');
    return Orbis.tx(function (d, ctx) {
      var p = AP.clean(d, spec), list = rows(d, 'autoPromos');
      if (id) {
        var cur = list.filter(function (x) { return x.id === id && x.tenant === ctx.tenant; })[0];
        Orbis.need(cur, 'NOT_FOUND', 'Promo tidak ditemukan');
        Orbis.need(cur.type === p.type, 'VALIDATION', 'Jenis promo tidak bisa diubah');
        ['buy', 'get', 'target', 'skus', 'price', 'from', 'to', 'days'].forEach(function (k) { delete cur[k]; });
        return Object.assign(cur, p, { updatedAt: Orbis.clock.now(), updatedBy: ctx.actor });
      }
      var row = Object.assign({ id: Orbis.nextId(d, 'APR', 4), tenant: ctx.tenant, status: 'ACTIVE', createdAt: Orbis.clock.now(), createdBy: ctx.actor }, p);
      list.push(row); return row;
    }, { audit: function (x) { return { action: id ? 'autopromo.update' : 'autopromo.create', entity: 'autoPromo', entityId: x.id }; } });
  };
  AP.setStatus = function (id, status) {
    Orbis.require('promo.write');
    Orbis.need(status === 'ACTIVE' || status === 'PAUSED', 'VALIDATION', 'Status tidak valid');
    return Orbis.tx(function (d) {
      var p = Orbis.mine(d, 'autoPromos').filter(function (x) { return x.id === id; })[0];
      Orbis.need(p, 'NOT_FOUND', 'Promo tidak ditemukan');
      Orbis.need(p.status !== status, 'NO_CHANGE', 'Status sudah ' + status);
      p.status = status; return p;
    }, { audit: { action: status === 'ACTIVE' ? 'autopromo.activate' : 'autopromo.pause', entity: 'autoPromo', entityId: id } });
  };

  /** Expand order lines into units with category, so per-unit discounts never exceed a unit price. */
  function units(d, items) {
    var cat = {}, out = [];
    Orbis.mine(d, 'products').forEach(function (p) { cat[p.id] = p.category; });
    var sk = {}; Orbis.mine(d, 'skus').forEach(function (k) { sk[k.id] = cat[k.productId] || ''; });
    (items || []).forEach(function (i) { for (var n = 0; n < (i.qty || 0); n++) out.push({ skuId: i.skuId, category: sk[i.skuId] || '', price: i.price || 0, used: false }); });
    return out;
  }
  function hit(sc, u) { return sc.scope === 'all' || (sc.scope === 'sku' ? u.skuId === sc.ref : u.category === sc.ref); }
  function pctOf(price, pct) { return Math.round(price * pct / 100); }

  /** Discount (IDR) one promo gives these units, or a reason string. */
  function amountFor(p, us) {
    us.forEach(function (u) { u.used = false; });
    if (p.type === 'happyhour') {
      var a = 0; us.forEach(function (u) { if (hit(p.target, u)) a += pctOf(u.price, p.pct); });
      return a || 'Tidak ada item yang masuk cakupan';
    }
    if (p.type === 'bxgy') {
      // greedy sets: Y cheapest unused "get" units, then X most expensive unused "buy" units (overlapping scopes allowed)
      var gets = us.filter(function (u) { return hit(p.get, u); }).sort(function (a, b) { return a.price - b.price; });
      var buys = us.filter(function (u) { return hit(p.buy, u); }).sort(function (a, b) { return b.price - a.price; });
      var disc = 0;
      for (;;) {
        var gs = gets.filter(function (u) { return !u.used; }).slice(0, p.get.qty);
        if (gs.length < p.get.qty) break;
        gs.forEach(function (u) { u.used = true; });
        var bs = buys.filter(function (u) { return !u.used; }).slice(0, p.buy.qty);
        if (bs.length < p.buy.qty) break;
        bs.forEach(function (u) { u.used = true; });
        disc += Orbis.sum(gs, function (u) { return pctOf(u.price, p.pct); });
      }
      return disc || 'Syarat beli ' + p.buy.qty + ' + dapat ' + p.get.qty + ' belum terpenuhi';
    }
    var need = {}; p.skus.forEach(function (k) { need[k] = (need[k] || 0) + 1; });
    var pools = {}; Object.keys(need).forEach(function (k) { pools[k] = us.filter(function (u) { return u.skuId === k; }).sort(function (a, b) { return a.price - b.price; }); });
    var sets = Math.min.apply(null, Object.keys(need).map(function (k) { return Math.floor(pools[k].length / need[k]); }));
    if (!sets) return 'Isi paket belum lengkap';
    var value = 0;
    Object.keys(need).forEach(function (k) { value += Orbis.sum(pools[k].slice(0, sets * need[k]), function (u) { return u.price; }); });
    if (value <= sets * p.price) return 'Harga paket tidak lebih murah dari harga normal';
    return value - sets * p.price;
  }

  /** Every tenant auto promo with {amount} or {reason}; pure (no mutation, no permission: called from orders.quote). */
  AP.evaluate = function (d, c) {
    c = c || {};
    var now = Orbis.clock.now(), today = dayOf(now), min = wibMin(now), dow = wibDow(now), us = units(d, c.items);
    return Orbis.mine(d, 'autoPromos').map(function (p) {
      var why = null;
      if (p.status !== 'ACTIVE') why = 'Promo dijeda';
      else if ((p.start && today < p.start) || (p.end && today > p.end)) why = 'Di luar periode promo';
      else if (p.outlets && p.outlets.length && p.outlets.indexOf(c.outlet) < 0) why = 'Tidak berlaku di outlet ini';
      else if (p.quota && uses(d, p.id) >= p.quota) why = 'Kuota promo habis';
      else if (c.promoCode) why = 'Tidak digabung dengan kode promo';
      else if (p.type === 'happyhour' && (p.days.length && p.days.indexOf(dow) < 0 || min < toMin(p.from) || min >= toMin(p.to))) why = 'Di luar jam promo (WIB)';
      var amt = why ? 0 : amountFor(p, us);
      if (typeof amt === 'string') { why = amt; amt = 0; }
      return { promoId: p.id, name: p.name, type: p.type, amount: Math.min(amt, c.subtotal == null ? amt : c.subtotal), reason: why };
    });
  };
  function toMin(t) { return Number(t.slice(0, 2)) * 60 + Number(t.slice(3)); }
  /** Single best eligible promo (largest IDR; ties -> lowest id). */
  AP.best = function (d, c) {
    var ok = AP.evaluate(d, c).filter(function (r) { return !r.reason && r.amount > 0; });
    ok.sort(function (a, b) { return b.amount - a.amount || (a.promoId < b.promoId ? -1 : 1); });
    return ok[0] ? { amount: ok[0].amount, promoId: ok[0].promoId, name: ok[0].name } : null;
  };
  Orbis.hooks.autoDiscount = function (d, c) { return AP.best(d, c); };
  Orbis.hooks.afterPlace.push(function (d, order) {
    var a = order.autoPromo;
    if (!a || !a.promoId) return;
    var u = rows(d, 'autoPromoUses');
    if (u.some(function (x) { return x.orderId === order.id && x.tenant === order.tenant; })) return;
    u.push({ tenant: order.tenant, promoId: a.promoId, orderId: order.id, amount: a.amount, at: Orbis.clock.now() });
  });

  /** The 3 sample promos (idempotent by name). */
  AP.SAMPLES = [
    { name: 'Happy Hour 14-16 Minuman 20%', type: 'happyhour', from: '14:00', to: '16:00', days: [], target: { scope: 'category', ref: 'Minuman' }, pct: 20 },
    { name: 'Beli 2 Croissant gratis 1 Cookie', type: 'bxgy', buy: { scope: 'sku', ref: 'k4', qty: 2 }, get: { scope: 'sku', ref: 'k5', qty: 1 }, pct: 100, quota: 200 },
    { name: 'Paket Ngopi: Kopi Susu + Croissant Rp 49.000', type: 'bundle', skus: ['k1', 'k4'], price: 49000 }
  ];
  AP.loadSamples = function () {
    Orbis.require('promo.write');
    return Orbis.batch(function () {
      var have = Orbis.mine(Orbis.db(), 'autoPromos').map(function (p) { return p.name; }), skus = Orbis.mine(Orbis.db(), 'skus').map(function (k) { return k.id; });
      return AP.SAMPLES.filter(function (s) {
        var refs = [s.buy && s.buy.ref, s.get && s.get.ref].concat(s.skus || []).filter(Boolean);
        return have.indexOf(s.name) < 0 && refs.every(function (r) { return skus.indexOf(r) >= 0; });
      }).map(function (s) { return AP.save(s); }).length;
    });
  };
  // demo: seeded AFTER the 30-day history (demoHooks run last), so demo order totals and reports tests stay unchanged
  (Orbis.demoHooks = Orbis.demoHooks || []).push(function (x) { x.as('owner', 'Rina (Owner)', 'o1'); AP.loadSamples(); });

  /* ======================= G5 payment fees & settlement ======================= */
  FEES.METHODS = [['cash', 'Tunai'], ['qris', 'QRIS'], ['transfer', 'Transfer'], ['edc', 'EDC / Kartu'], ['cod', 'COD']];
  FEES.DEFAULTS = { cash: { percentBp: 0, fixed: 0, settleDays: 0 }, qris: { percentBp: 70, fixed: 0, settleDays: 1 }, transfer: { percentBp: 0, fixed: 0, settleDays: 0 },
    edc: { percentBp: 150, fixed: 0, settleDays: 1 }, cod: { percentBp: 0, fixed: 0, settleDays: 0 } };
  FEES.config = function (d) {
    var own = (d.paymentFees || {})[d.session.tenant] || {}, out = {};
    FEES.METHODS.forEach(function (m) { out[m[0]] = Object.assign({}, FEES.DEFAULTS[m[0]], own[m[0]] || {}); });
    return out;
  };
  /** cfg = {method: {percentBp, fixed, settleDays}} (partial ok). Owner only (`tenant.settings`). */
  FEES.save = function (cfg) {
    Orbis.require('tenant.settings');
    return Orbis.tx(function (d) {
      var cur = FEES.config(d);
      Object.keys(cfg || {}).forEach(function (k) {
        Orbis.need(FEES.DEFAULTS[k], 'VALIDATION', 'Metode bayar tidak dikenal');
        var c = cfg[k] || {};
        cur[k] = { percentBp: posInt(c.percentBp, 'Biaya % (basis poin)', 0, 1000), fixed: posInt(c.fixed, 'Biaya tetap', 0, 100000), settleDays: posInt(c.settleDays, 'Hari cair', 0, 7) };
      });
      d.paymentFees = d.paymentFees || {};
      d.paymentFees[d.session.tenant] = cur; return cur;
    }, { audit: { action: 'settings.paymentFees', entity: 'paymentFees' } });
  };
  /** Fee for one payment leg; refund legs (negative) carry no fee (MDR is not refunded). */
  FEES.feeOf = function (c, amount) { return amount > 0 ? Math.round(amount * c.percentBp / 10000) + c.fixed : 0; };

  /** Per method: count, gross (Σ legs incl. negative refund legs = reports2 payments net), fee, net received; settlement by date. */
  FEES.report = function (d, f) {
    Orbis.require('report.read');
    f = R2().filter(d, f);
    var cfg = FEES.config(d), byId = {}, today = dayOf(Orbis.clock.now()), m = {}, st = {};
    Orbis.mine(d, 'orders').forEach(function (o) { byId[o.id] = o; });
    Orbis.mine(d, 'payments').forEach(function (p) {
      var o = byId[p.orderId], day = dayOf(p.at);
      if (!o || (f.from && day < f.from) || (f.to && day > f.to) || (f.outlet && o.outlet !== f.outlet) || (f.channel && o.channel !== f.channel) || (f.staff && o.createdBy !== f.staff)) return;
      var c = cfg[p.type] || { percentBp: 0, fixed: 0, settleDays: 0 }, fee = FEES.feeOf(c, p.amount), name = (FEES.METHODS.filter(function (x) { return x[0] === p.type; })[0] || [0, p.type])[1];
      var r = m[p.type] = m[p.type] || { key: p.type, name: name, count: 0, gross: 0, fee: 0, net: 0, settleDays: c.settleDays };
      if (p.amount > 0) r.count++;
      r.gross += p.amount; r.fee += fee; r.net += p.amount - fee;
      var date = addDays(day, c.settleDays), k = date + '|' + p.type;
      var s = st[k] = st[k] || { key: k, date: date, method: p.type, name: name, count: 0, net: 0, status: date > today ? 'Akan cair' : 'Sudah cair (estimasi)' };
      s.count++; s.net += p.amount - fee;
    });
    var list = Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.gross - a.gross; });
    var settle = Object.keys(st).map(function (k) { return st[k]; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.method < b.method ? -1 : 1; });
    function tot(k) { return Orbis.sum(list, function (r) { return r[k]; }); }
    return { rows: list, settlement: settle, upcoming: settle.filter(function (s) { return s.date > today; }),
      totals: { count: tot('count'), gross: tot('gross'), fee: tot('fee'), net: tot('net') } };
  };

  /* ======================= G4 P&L + daily summary ======================= */
  /** Estimated P&L: net sales − COGS (line snapshots) − paid expenses (by paidAt; tenant-level, only when no outlet filter) − payment fees. */
  PNL.report = function (d, f) {
    Orbis.require('report.read');
    f = R2().filter(d, f);
    var s = R2().summary(d, f).totals, cogs = R2().products(d, f).totals.cogs, fee = FEES.report(d, f).totals.fee;
    var exp = f.outlet ? 0 : Orbis.sum(Orbis.mine(d, 'expenses').filter(function (e) {
      if (e.status !== 'PAID' || !e.paidAt) return false;
      var day = dayOf(e.paidAt); return (!f.from || day >= f.from) && (!f.to || day <= f.to);
    }), function (e) { return e.amount; });
    var gp = s.net - cogs, profit = gp - exp - fee;
    var rows = [
      { key: 'gross', label: 'Penjualan kotor', amount: s.gross, kind: 'base' },
      { key: 'discounts', label: 'Diskon', amount: -s.discounts, kind: 'minus' },
      { key: 'refunds', label: 'Refund (porsi barang)', amount: -s.refunds, kind: 'minus' },
      { key: 'net', label: 'Penjualan bersih', amount: s.net, kind: 'total' },
      { key: 'cogs', label: 'HPP (snapshot baris)', amount: -cogs, kind: 'minus' },
      { key: 'grossProfit', label: 'Laba kotor', amount: gp, kind: 'total' },
      { key: 'expenses', label: f.outlet ? 'Biaya operasional (hanya di Semua outlet)' : 'Biaya operasional dibayar', amount: -exp, kind: 'minus' },
      { key: 'fees', label: 'Biaya pembayaran (MDR)', amount: -fee, kind: 'minus' },
      { key: 'profit', label: 'Estimasi laba bersih', amount: profit, kind: 'result' }
    ];
    return { rows: rows, estimated: true, filter: f, expensesExcluded: !!f.outlet,
      totals: { gross: s.gross, net: s.net, cogs: cogs, grossProfit: gp, expenses: exp, fees: fee, profit: profit, orders: s.orders, marginPct: s.net ? Math.round(profit * 1000 / s.net) / 10 : 0 } };
  };

  /** Yesterday (WIB): net sales, orders, top 3 items, cash variance of shifts closed that day, pending approvals; WhatsApp text without customer PII. */
  PNL.daily = function (d, outlet) {
    Orbis.require('report.read');
    var y = R2().preset('yesterday'), f = R2().filter(d, { from: y.from, to: y.to, outlet: outlet || '' });
    var s = R2().summary(d, f).totals;
    var top = R2().products(d, f).rows.slice().sort(function (a, b) { return b.qty - a.qty || b.sales - a.sales; }).slice(0, 3).map(function (r) { return { name: r.name, qty: r.qty, sales: r.sales }; });
    var sh = Orbis.mine(d, 'shifts').filter(function (x) { return x.closedAt && dayOf(x.closedAt) === y.from && (!f.outlet || x.outlet === f.outlet); });
    var pend = {
      expenses: Orbis.mine(d, 'expenses').filter(function (e) { return e.status === 'PENDING'; }).length,
      purchaseOrders: Orbis.mine(d, 'purchaseOrders').filter(function (p) { return p.status === 'SUBMITTED'; }).length,
      refunds: Orbis.mine(d, 'refunds').filter(function (r) { return r.status === 'REQUESTED'; }).length,
      stockCounts: Orbis.mine(d, 'stockCounts').filter(function (c) { return c.status === 'SUBMITTED'; }).length
    };
    var variance = Orbis.sum(sh, function (x) { return x.variance || 0; });
    var tenant = (d.tenants.filter(function (t) { return t.id === d.session.tenant; })[0] || {}).name || '';
    var outName = f.outlet ? (Orbis.mine(d, 'outlets').filter(function (o) { return o.id === f.outlet; })[0] || {}).name : 'Semua outlet';
    var text = ['Ringkasan ' + tenant + ' ' + y.from + ' (WIB) - ' + outName,
      'Penjualan bersih: ' + Orbis.idr(s.net), 'Pesanan: ' + s.orders,
      'Terlaris: ' + (top.length ? top.map(function (t, i) { return (i + 1) + '. ' + t.name + ' (' + t.qty + ')'; }).join(', ') : '-'),
      'Selisih kas: ' + Orbis.idr(variance) + ' dari ' + sh.length + ' shift ditutup',
      'Menunggu persetujuan: biaya ' + pend.expenses + ', PO ' + pend.purchaseOrders + ', refund ' + pend.refunds + ', opname ' + pend.stockCounts].join('\n');
    return { day: y.from, outlet: f.outlet, net: s.net, orders: s.orders, top: top, cashVariance: variance, shiftsClosed: sh.length, shortShifts: sh.filter(function (x) { return x.variance < 0; }).length,
      pending: pend, text: text, waUrl: 'https://wa.me/?text=' + encodeURIComponent(text) };
  };
})(typeof window !== 'undefined' ? window : globalThis);
