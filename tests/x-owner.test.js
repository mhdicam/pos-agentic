/* RD-17 W3 owner value: auto promos (G3), P&L + daily summary (G4), payment fees & settlement (G5). */
var WIBMS = 7 * 3600000;
function wibAt(O, day, hhmm) { O.clock.set(Date.parse(day + 'T' + hhmm + ':00Z') - WIBMS); }
function q(O, items, extra) { return O.domain.orders.quote(O.db(), Object.assign({ channel: 'pos', items: items }, extra || {})); }
function sell(O, items, type) { return O.domain.orders.checkout({ channel: 'pos', items: items, payment: { type: type || 'cash' } }); }

test('RD17-10 happy hour: WIB window + category scope; outside window no discount', (O, T) => {
  const AP = O.domain.autopromo;
  AP.save(AP.SAMPLES[0]);
  wibAt(O, '2026-11-12', '14:30');
  let x = q(O, [{ skuId: 'k2', qty: 1 }, { skuId: 'k4', qty: 1 }]);   // Americano 24000 (Minuman), Croissant (Roti)
  T.eq(x.discount, 4800); T.eq(x.autoPromo.name, 'Happy Hour 14-16 Minuman 20%');
  wibAt(O, '2026-11-12', '16:00');
  T.eq(q(O, [{ skuId: 'k2', qty: 1 }]).discount, 0, 'end is exclusive');
  T.eq(AP.evaluate(O.db(), { items: q(O, [{ skuId: 'k2', qty: 1 }]).items, outlet: 'o1' })[0].reason, 'Di luar jam promo (WIB)');
  AP.save(Object.assign({}, AP.SAMPLES[0], { name: 'HH Sabtu', days: [6] }), AP.list(O.db())[0].id);
  wibAt(O, '2026-11-12', '15:00');   // Thursday
  T.eq(q(O, [{ skuId: 'k2', qty: 1 }]).discount, 0, 'day of week');
});

test('RD17-10 bxgy cheapest-first, bundle price, best-of single promo', (O, T) => {
  const AP = O.domain.autopromo;
  wibAt(O, '2026-11-12', '10:00');
  AP.loadSamples();
  T.eq(AP.list(O.db()).length, 3); T.eq(AP.loadSamples(), 0, 'idempotent');
  // 2 croissant + 1 cookie -> cookie free (18000); bundle not applicable (no k1)
  T.eq(q(O, [{ skuId: 'k4', qty: 2 }, { skuId: 'k5', qty: 1 }]).discount, 18000);
  // kopi susu 28000 + croissant 26000 = 54000 -> bundle 49000 saves 5000
  T.eq(q(O, [{ skuId: 'k1', qty: 1 }, { skuId: 'k4', qty: 1 }]).discount, 5000);
  // both eligible: bxgy 18000 beats bundle 5000 -> single best, not stacked
  const b = q(O, [{ skuId: 'k1', qty: 1 }, { skuId: 'k4', qty: 2 }, { skuId: 'k5', qty: 1 }]);
  T.eq(b.discount, 18000); T.eq(b.autoPromo.name, 'Beli 2 Croissant gratis 1 Cookie');
  // same-scope bxgy: buy 2 get 1 cheapest, any Roti
  AP.save({ name: 'Roti 3 bayar 2', type: 'bxgy', buy: { scope: 'category', ref: 'Roti', qty: 2 }, get: { scope: 'category', ref: 'Roti', qty: 1 }, pct: 100 });
  O.tx(d => { d.autoPromos.forEach(p => { if (p.name !== 'Roti 3 bayar 2') p.status = 'PAUSED'; }); });
  T.eq(q(O, [{ skuId: 'k8', qty: 1 }, { skuId: 'k4', qty: 1 }, { skuId: 'k5', qty: 1 }]).discount, 18000, 'cheapest of 3 free');
  T.eq(q(O, [{ skuId: 'k8', qty: 1 }, { skuId: 'k4', qty: 1 }]).discount, 0, 'only 2 items');
  T.eq(O.domain.autopromo.best(O.db(), { items: q(O, [{ skuId: 'k8', qty: 3 }]).items, outlet: 'o1', promoCode: 'X' }), null, 'not stacked with a promo code');
  T.throws(() => AP.save({ name: 'x', type: 'bundle', skus: ['k1'], price: 1 }), 'VALIDATION');
});

test('RD17-11 never negative, quota counted once per order, outlet list, paused', (O, T) => {
  const AP = O.domain.autopromo;
  wibAt(O, '2026-11-12', '10:00');
  const p = AP.save({ name: 'Paket mahal', type: 'bundle', skus: ['k1', 'k4'], price: 60000 });
  T.eq(AP.evaluate(O.db(), { items: q(O, [{ skuId: 'k1', qty: 1 }, { skuId: 'k4', qty: 1 }]).items, outlet: 'o1' })[0].reason, 'Harga paket tidak lebih murah dari harga normal');
  const hh = AP.save({ name: 'Gratis semua', type: 'happyhour', from: '00:00', to: '23:59', days: [], target: { scope: 'all' }, pct: 100, quota: 1, outlets: ['o1'] });
  const x = q(O, [{ skuId: 'k2', qty: 2 }]);
  T.eq([x.discount, x.subtotal, x.total >= 0], [48000, 48000, true], '100% capped at line price');
  AP.save({ name: 'Gratis semua', type: 'happyhour', from: '00:00', to: '23:59', days: [], target: { scope: 'all' }, pct: 50, quota: 1, outlets: ['o1'] }, hh.id);   // zero-total sale is rejected by sales
  O.domain.shifts.open(0);
  const o = sell(O, [{ skuId: 'k2', qty: 1 }]);
  T.eq(o.autoPromo.promoId, hh.id);
  O.tx(d => { O.hooks.afterPlace.forEach(fn => fn(d, d.orders.find(z => z.id === o.id))); });   // replay: idempotent per order id
  T.eq(AP.list(O.db()).find(r => r.id === hh.id).used, 1);
  const r = AP.evaluate(O.db(), { items: x.items, outlet: 'o1' }).find(e => e.promoId === hh.id);
  T.eq(r.reason, 'Kuota promo habis'); T.eq(q(O, [{ skuId: 'k2', qty: 1 }]).discount, 0);
  T.eq(AP.evaluate(O.db(), { items: x.items, outlet: 'o2' }).find(e => e.promoId === hh.id).reason, 'Tidak berlaku di outlet ini');
  AP.setStatus(p.id, 'PAUSED'); T.throws(() => AP.setStatus(p.id, 'PAUSED'), 'NO_CHANGE');
  T.throws(() => AP.save({ name: 'Bad', type: 'happyhour', from: '16:00', to: '14:00', target: { scope: 'all' }, pct: 10 }), 'VALIDATION');
});

test('RD17-10 forbidden role + tenant isolation for auto promos', (O, T) => {
  const AP = O.domain.autopromo;
  wibAt(O, '2026-11-12', '15:00');
  AP.save(AP.SAMPLES[0]);
  T.as('cashier');
  T.throws(() => AP.save(AP.SAMPLES[1]), 'FORBIDDEN'); T.throws(() => AP.list(O.db()), 'FORBIDDEN');
  T.ok(q(O, [{ skuId: 'k2', qty: 1 }]).discount > 0, 'cashier still gets the promo at checkout');
  T.as('owner', 't2');
  T.eq(AP.list(O.db()).length, 0);
  T.eq(AP.best(O.db(), { items: [{ skuId: 'k2', qty: 1, price: 24000 }], subtotal: 24000, outlet: 'o3' }), null);
});

test('RD17-14 fees: bp + fixed math, Math.round per row, settlement T+n WIB, owner-only edit', (O, T) => {
  const F = O.domain.fees;
  wibAt(O, '2026-11-12', '23:30');   // late WIB evening: settlement day must follow the WIB day
  O.domain.shifts.open(0);
  sell(O, [{ skuId: 'k1', qty: 1 }], 'qris');    // 28000 (+charges) via QRIS
  sell(O, [{ skuId: 'k2', qty: 1 }], 'cash');
  const f = { from: '2026-11-12', to: '2026-11-12' };
  let r = F.report(O.db(), f);
  const qr = r.rows.find(x => x.key === 'qris'), pay = O.mine(O.db(), 'payments').find(p => p.type === 'qris');
  T.eq(qr.fee, Math.round(pay.amount * 70 / 10000)); T.eq(qr.net, qr.gross - qr.fee);
  T.eq(r.rows.find(x => x.key === 'cash').fee, 0);
  T.eq(r.settlement.find(s => s.method === 'qris').date, '2026-11-13');
  T.eq(r.upcoming.length, 1, 'only QRIS is still to settle');
  F.save({ qris: { percentBp: 100, fixed: 500, settleDays: 2 } });
  r = F.report(O.db(), f);
  T.eq(r.rows.find(x => x.key === 'qris').fee, Math.round(pay.amount / 100) + 500);
  T.eq(r.settlement.find(s => s.method === 'qris').date, '2026-11-14');
  T.eq(r.totals.gross, O.domain.reports2.payments(O.db(), f).totals.net, 'gross = payments net');
  T.throws(() => F.save({ qris: { percentBp: 0.5, fixed: 0, settleDays: 1 } }), 'VALIDATION');
  T.throws(() => F.save({ qris: { percentBp: 10, fixed: 0, settleDays: 8 } }), 'VALIDATION');
  T.as('finance');
  T.ok(F.report(O.db(), f).rows.length === 2); T.throws(() => F.save({ cash: { percentBp: 0, fixed: 0, settleDays: 0 } }), 'FORBIDDEN');
  T.as('cashier'); T.throws(() => F.report(O.db(), f), 'FORBIDDEN');
  T.as('owner', 't2'); T.eq(F.report(O.db(), f).rows.length, 0); T.eq(F.config(O.db()).qris.percentBp, 70, 't2 keeps defaults');
});

test('RD17-12 P&L reconciles net - cogs - expenses - fees on demo; outlet filter excludes expenses', (O, T) => {
  O.demoHistory();
  const d = O.db(), P = O.domain.pnl, R = O.domain.reports2, f = { from: '2000-01-01', to: R.preset('today').to };
  const p = P.report(d, f), s = R.summary(d, f).totals;
  const exp = O.mine(d, 'expenses').filter(e => e.status === 'PAID').reduce((a, e) => a + e.amount, 0);
  T.ok(exp > 0 && p.totals.fees > 0 && p.totals.cogs > 0);
  T.eq(p.totals.net, s.net); T.eq(p.totals.cogs, R.margin(d, f).totals.cogs); T.eq(p.totals.expenses, exp);
  T.eq(p.totals.profit, s.net - p.totals.cogs - exp - p.totals.fees);
  T.eq(p.totals.fees, O.domain.fees.report(d, f).totals.fee); T.eq(p.estimated, true);
  T.eq(p.rows[p.rows.length - 1].amount, p.totals.profit);
  const o1 = P.report(d, Object.assign({}, f, { outlet: 'o1' })), o2 = P.report(d, Object.assign({}, f, { outlet: 'o2' }));
  T.eq([o1.totals.expenses, o1.expensesExcluded], [0, true]);
  T.eq(o1.totals.net + o2.totals.net, p.totals.net); T.eq(o1.totals.fees + o2.totals.fees, p.totals.fees);
  T.eq(O.mine(d, 'autoPromos').length, 3, 'demo seeds sample promos after history');
  T.as('cashier'); T.throws(() => P.report(O.db(), f), 'FORBIDDEN');
});

test('RD17-13 daily summary: yesterday WIB, top 3, cash variance, pending, WA link without PII', (O, T) => {
  const P = O.domain.pnl;
  wibAt(O, '2026-11-11', '23:30');   // 16:30 UTC; still 11 Nov in WIB
  O.domain.shifts.open(0);
  O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 3 }, { skuId: 'k2', qty: 1 }], customer: { name: 'Budi Rahasia', phone: '081299998888' }, payment: { type: 'cash' } });
  sell(O, [{ skuId: 'k4', qty: 2 }, { skuId: 'k5', qty: 1 }]);
  const exp = O.domain.shifts.expected(O.db(), O.mine(O.db(), 'shifts')[0]);
  O.domain.shifts.close(exp - 2000, 'Kurang uang kembalian');
  O.domain.expenses.create({ amount: 50000, category: 'Operasional', note: 'Gas' });
  wibAt(O, '2026-11-12', '00:30');   // 11 Nov 17:30 UTC = 12 Nov WIB -> "yesterday" = 11 Nov
  const s = P.daily(O.db());
  T.eq(s.day, '2026-11-11'); T.eq(s.orders, 2);
  T.eq(s.top.map(t => t.name), ['Kopi Susu Awan', 'Croissant Butter', 'Americano']);
  T.eq([s.cashVariance, s.shiftsClosed, s.shortShifts], [-2000, 1, 1]);
  T.eq(s.pending.expenses, 1);
  T.ok(s.waUrl.indexOf('https://wa.me/?text=') === 0);
  const txt = decodeURIComponent(s.waUrl.slice(20));
  T.ok(txt === s.text && !/Budi|Rahasia|0812/.test(txt), 'no customer PII');
  T.eq(P.daily(O.db(), 'o2').orders, 0, 'outlet filter');
  T.as('cashier'); T.throws(() => P.daily(O.db()), 'FORBIDDEN');
  T.as('owner', 't2'); T.eq(P.daily(O.db()).orders, 0, 'tenant isolation');
});
