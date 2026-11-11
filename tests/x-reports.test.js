/* RD-15 tenant reports: reconciliation invariants on demo history (~660 orders). */
var DAYMS = 86400000;
function demo(O) { O.demoHistory(); return O.db(); }
function wide(O) { var p = O.domain.reports2.preset('30d'); return { from: '2000-01-01', to: p.to }; }
function sumK(rows, k) { return rows.reduce(function (s, r) { return s + (r[k] || 0); }, 0); }

test('RD15 reconcile: per-payment net = summary collected; Σpayments rows = payment ledger', function (O, T) {
  var d = demo(O), R = O.domain.reports2, f = wide(O);
  var s = R.summary(d, f).totals, p = R.payments(d, f);
  T.ok(s.orders > 500, 'demo volume ' + s.orders);
  T.eq(p.totals.net, s.collected, 'payments net vs collected');
  T.eq(sumK(p.rows, 'net'), p.totals.net);
  T.eq(s.collected, O.mine(d, 'payments').reduce(function (a, x) { return a + x.amount; }, 0), 'ledger');
  T.eq(p.totals.received - p.totals.refunded, p.totals.net);
  var cod = p.rows.filter(function (r) { return r.key === 'cod'; })[0];
  var verified = O.mine(d, 'payments').filter(function (x) { return x.type === 'cod'; }).length;
  T.eq(cod ? cod.count : 0, verified, 'COD counted only from verified payment rows');
});

test('RD15 reconcile: per-outlet partitions all outlets; every breakdown sums to summary', function (O, T) {
  var d = demo(O), R = O.domain.reports2, f = wide(O), all = R.summary(d, f).totals;
  var parts = ['o1', 'o2'].map(function (o) { return R.summary(d, Object.assign({ outlet: o }, f)).totals; });
  ['orders', 'sales', 'gross', 'net', 'collected', 'refunds', 'items'].forEach(function (k) { T.eq(parts[0][k] + parts[1][k], all[k], 'outlet partition ' + k); });
  var ol = R.outlets(d, f).totals;
  T.eq(ol.sales, all.sales); T.eq(ol.collected, all.collected);
  T.eq(R.orderTypes(d, f).totals.sales, all.sales, 'order types');
  T.eq(R.staff(d, f).totals.sales, all.sales, 'staff');
  T.eq(R.hours(d, f).totals.sales, all.sales, 'hours');
  T.eq(R.days(d, f).totals.orders, all.orders, 'days');
  T.eq(R.products(d, f).totals.sales, all.gross, 'products = gross');
  T.eq(R.categories(d, f).totals.sales, all.gross, 'categories = gross');
  T.eq(R.discounts(d, f).totals.amount, all.discounts, 'discounts');
  T.eq(R.taxes(d, f).totals.tax, all.tax, 'tax');
  T.eq(R.refunds(d, f).totals.amount, all.refunds, 'refunds');
  T.eq(all.sales, all.gross - all.discounts + all.tax + all.service + all.rounding + all.deliveryFee, 'total identity');
  T.ok(R.discounts(d, f).rows.some(function (r) { return /PAGI15/.test(r.name); }), 'promo code row');
});

test('RD15 refunds reduce net; pending/rejected do not; approver shown', function (O, T) {
  var d = demo(O), R = O.domain.reports2, f = wide(O), s = R.summary(d, f).totals, rf = R.refunds(d, f);
  T.ok(s.refunds > 0, 'has approved refunds');
  T.eq(s.net, s.gross - s.discounts - s.refunds);
  var approved = O.mine(d, 'refunds').filter(function (r) { return r.status === 'APPROVED'; });
  T.eq(rf.totals.amount, approved.reduce(function (a, r) { return a + r.amount; }, 0));
  T.ok(rf.rows.some(function (r) { return r.status === 'REQUESTED'; }) && rf.rows.some(function (r) { return r.status === 'REJECTED'; }));
  rf.rows.filter(function (r) { return r.status === 'APPROVED'; }).forEach(function (r) { T.ok(r.approver && r.approver !== '-' && r.reason, 'approver+reason'); });
});

test('RD15 WIB day boundaries: 23:30 WIB counts today, 00:30 WIB next day', function (O, T) {
  var R = O.domain.reports2;
  T.eq(R.dayOf(Date.UTC(2026, 10, 10, 16, 30)), '2026-11-10');   // 23:30 WIB
  T.eq(R.dayOf(Date.UTC(2026, 10, 10, 17, 30)), '2026-11-11');   // 00:30 WIB
  T.eq(R.hourOf(Date.UTC(2026, 10, 10, 17, 30)), 0);
  var d = demo(O), f = wide(O), days = R.days(d, f).rows;
  days.forEach(function (r) {
    var one = R.summary(d, { from: r.key, to: r.key }).totals;
    T.eq(one.orders, r.orders, 'single-day filter ' + r.key);
  });
  T.eq(sumK(days, 'orders'), R.summary(d, f).totals.orders);
  O.mine(d, 'orders').forEach(function (o) { var h = R.hourOf(o.createdAt); T.ok(h >= 7 || o.channel === 'store', 'POS opens 07:00 WIB, got ' + h); });
});

test('RD15 previous-period comparison and presets', function (O, T) {
  var d = demo(O), R = O.domain.reports2, w = R.preset('7d'), s = R.summary(d, w);
  T.eq(s.prevRange.to, new Date(Date.parse(w.from + 'T00:00:00Z') - DAYMS).toISOString().slice(0, 10));
  var prev = R.summary(d, s.prevRange).totals;
  var row = s.rows.filter(function (r) { return r.key === 'sales'; })[0];
  T.eq(row.prev, prev.sales);
  T.eq(row.change, Math.round((row.value - prev.sales) * 1000 / prev.sales) / 10);
  T.eq(R.preset('today').from, R.dayOf(O.clock.now()));
  T.throws(function () { R.summary(d, { from: '2026-11-10', to: '2026-11-01' }); }, 'VALIDATION');
  T.throws(function () { R.summary(d, { outlet: 'o3' }); }, 'NOT_FOUND');
});

test('RD15 shifts: sales and variance per shift; estimated margin', function (O, T) {
  var d = demo(O), R = O.domain.reports2, f = wide(O), sh = R.shifts(d, f);
  T.eq(sh.rows.length, O.mine(d, 'shifts').length);
  T.ok(sh.totals.shortCount > 0 && sh.totals.variance !== 0, 'variance visible');
  var pos = O.mine(d, 'orders').filter(function (o) { return o.status !== 'CANCELLED' && o.shiftId; });
  T.eq(sh.totals.sales, pos.reduce(function (a, o) { return a + o.total; }, 0));
  var m = R.margin(d, f);
  T.ok(m.estimated === true);
  T.eq(m.totals.profit, m.totals.net - m.totals.cogs);
  T.ok(m.totals.cogs > 0 && m.totals.marginPct > 0 && m.totals.marginPct < 100);
});

test('RD15 modifiers: empty without modifier data, aggregated when lines carry modifiers', function (O, T) {
  var R = O.domain.reports2;
  T.eq(R.modifiers(O.db(), wide(O)).rows.length, 0, 'no orders yet');
  var d = demo(O);
  var m = R.modifiers(d, wide(O));
  T.ok(m.rows.some(function (r) { return r.name === 'Hot'; }), 'default modifiers from demo coffee sales');
  var lines = 0; d.orders.forEach(function (o) { if (o.tenant === 't1' && o.status !== 'CANCELLED') o.items.forEach(function (i) { (i.modifiers || []).forEach(function (x) { if (x.name === 'Hot') lines += i.qty; }); }); });
  T.eq(m.rows.filter(function (r) { return r.name === 'Hot'; })[0].qty, lines, 'qty aggregated from order lines');
});

test('RD15 permission and scope: cashier FORBIDDEN, manager pinned to own outlet, other tenant sees nothing', function (O, T) {
  demo(O);
  var R = O.domain.reports2, f = wide(O);
  T.as('cashier');
  T.throws(function () { R.summary(O.db(), f); }, 'FORBIDDEN');
  T.throws(function () { R.payments(O.db(), f); }, 'FORBIDDEN');
  T.as('owner');
  var o2 = R.summary(O.db(), Object.assign({ outlet: 'o2' }, f)).totals;
  O.tx(function (d) { d.session.role = 'manager'; d.session.outlet = 'o2'; });
  T.eq(R.summary(O.db(), Object.assign({ outlet: '' }, f)).totals, o2, 'manager sees only o2');
  T.as('owner', 't2');
  var s = R.summary(O.db(), f).totals;
  T.eq(s.orders, 0); T.eq(s.collected, 0);
  T.eq(R.shifts(O.db(), f).rows.length, 0); T.eq(R.refunds(O.db(), f).rows.length, 0);
  T.throws(function () { R.summary(O.db(), { outlet: 'o1' }); }, 'NOT_FOUND');
});

test('RD15 performance: every report under 50ms on demo data', function (O, T) {
  var d = demo(O), R = O.domain.reports2, f = wide(O);
  ['summary', 'products', 'categories', 'modifiers', 'payments', 'orderTypes', 'outlets', 'hours', 'days', 'staff', 'shifts', 'discounts', 'refunds', 'voids', 'taxes', 'margin'].forEach(function (k) {
    var t = Date.now(); R[k](d, f); var ms = Date.now() - t;
    T.ok(ms < 50, k + ' took ' + ms + 'ms');
  });
});
