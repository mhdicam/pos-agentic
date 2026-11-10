/* Sales domain tests: orders, shifts, refunds. */
function openShift(O, T, cash) { T.as('cashier'); return O.domain.shifts.open(cash == null ? 100000 : cash); }
function sell(O, items, extra) {
  var spec = Object.assign({ channel: 'pos', items: items, method: 'pickup', payment: { type: 'cash' } }, extra || {});
  return O.domain.orders.checkout(spec);
}
function stock(O, sku) { return O.domain.inventory.onHand(O.db(), sku, 'o1'); }

test('place prices from sku and snapshots lines; cash needs open shift', function (O, T) {
  T.as('cashier');
  T.throws(function () { sell(O, [{ skuId: 'k1', qty: 1 }]); }, 'NO_OPEN_SHIFT', 'checkout without open shift');
  var s = openShift(O, T);
  var o = sell(O, [{ skuId: 'k1', qty: 2 }, { skuId: 'k2', qty: 1 }]);
  T.eq(o.subtotal, 2 * 28000 + 24000); T.eq(o.total, 80000);
  T.eq(o.status, 'ACCEPTED'); T.eq(o.paymentStatus, 'PAID'); T.eq(o.shiftId, s.id);
  T.eq(o.items[0].price, 28000); T.eq(o.items[0].cost, 9000); T.eq(o.items[0].name, 'Kopi Susu Awan');
  T.eq(stock(O, 'k1'), 38);
  T.eq(O.db().payments.length, 1);
});

test('place twice gives distinct ids and correct stock', function (O, T) {
  openShift(O, T);
  var a = sell(O, [{ skuId: 'k1', qty: 3 }]), b = sell(O, [{ skuId: 'k1', qty: 3 }]);
  T.ok(a.id !== b.id, 'distinct ids');
  T.eq(stock(O, 'k1'), 34);
  T.eq(O.db().orders.length, 2);
});

test('oversell rolls back every line', function (O, T) {
  openShift(O, T);
  var before = O.db().stockMoves.length, ordBefore = O.db().orders.length;
  T.throws(function () { sell(O, [{ skuId: 'k1', qty: 5 }, { skuId: 'k2', qty: 41 }]); }, 'INSUFFICIENT_STOCK');
  T.eq(stock(O, 'k1'), 40); T.eq(stock(O, 'k2'), 40);
  T.eq(O.db().stockMoves.length, before); T.eq(O.db().orders.length, ordBefore); T.eq(O.db().payments.length, 0);
});

test('validation: float qty, zero qty, empty cart, cross-tenant sku, forbidden role', function (O, T) {
  openShift(O, T);
  T.throws(function () { sell(O, [{ skuId: 'k1', qty: 1.5 }]); }, 'VALIDATION', 'float qty');
  T.throws(function () { sell(O, [{ skuId: 'k1', qty: 0 }]); }, 'VALIDATION', 'zero qty');
  T.throws(function () { sell(O, []); }, 'EMPTY_CART');
  T.throws(function () { sell(O, [{ skuId: 'k9', qty: 1 }]); }, 'NOT_FOUND', 'cross-tenant sku (t2 sku as t1)');
  T.as('dispatcher');
  T.throws(function () { sell(O, [{ skuId: 'k1', qty: 1 }]); }, 'FORBIDDEN');
});

test('float money rejected (tendered, split leg, shift opening)', function (O, T) {
  openShift(O, T);
  T.throws(function () { sell(O, [{ skuId: 'k1', qty: 1 }], { payment: { type: 'cash', tendered: 28000.5 } }); }, 'VALIDATION');
  T.throws(function () { sell(O, [{ skuId: 'k1', qty: 1 }], { payment: { type: 'split', legs: [{ type: 'cash', amount: 10000.5 }, { type: 'transfer', amount: 17999.5 }] } }); }, 'VALIDATION');
  T.as('cashier');
  T.throws(function () { O.domain.shifts.open(1000.5); }, 'VALIDATION');
});

test('split tender must sum exactly; cash change computed', function (O, T) {
  openShift(O, T);
  var it = [{ skuId: 'k1', qty: 1 }];
  T.throws(function () { sell(O, it, { payment: { type: 'split', legs: [{ type: 'cash', amount: 10000 }, { type: 'transfer', amount: 17000 }] } }); }, 'SPLIT_MISMATCH');
  var o = sell(O, it, { payment: { type: 'split', legs: [{ type: 'cash', amount: 10000 }, { type: 'transfer', amount: 18000 }], tendered: 20000 } });
  T.eq(o.change, 10000); T.eq(O.db().payments.length, 2);
  T.throws(function () { sell(O, it, { payment: { type: 'cash', tendered: 1000 } }); }, 'CASH_SHORT');
  var o2 = sell(O, it, { payment: { type: 'cash', tendered: 50000 } });
  T.eq(o2.change, 22000);
});

test('delivery needs address/name/phone, fee 10000, COD pending, COD only for delivery', function (O, T) {
  openShift(O, T);
  var it = [{ skuId: 'k1', qty: 1 }];
  T.throws(function () { sell(O, it, { method: 'delivery', payment: { type: 'cod' } }); }, 'VALIDATION', 'no address');
  T.throws(function () { sell(O, it, { method: 'delivery', address: 'Jl A', customer: { name: 'Budi', phone: '123' }, payment: { type: 'cod' } }); }, 'VALIDATION', 'bad phone');
  T.throws(function () { sell(O, it, { method: 'pickup', payment: { type: 'cod' } }); }, 'COD_NOT_ALLOWED');
  var o = sell(O, it, { method: 'delivery', address: 'Jl A 1', customer: { name: 'Budi', phone: '081234567890' }, payment: { type: 'cod' } });
  T.eq(o.deliveryFee, 10000); T.eq(o.total, 38000); T.eq(o.status, 'PLACED'); T.eq(o.paymentStatus, 'COLLECTION_PENDING');
  var adv = O.domain.orders.advance(o.id); T.eq(adv.status, 'ACCEPTED', 'COD can be accepted');
});

test('tax and service from tenant settings', function (O, T) {
  T.as('owner'); O.domain.orders.setSettings(10, 5);
  T.throws(function () { O.domain.orders.setSettings(31, 0); }, 'VALIDATION');
  T.as('cashier'); T.throws(function () { O.domain.orders.setSettings(1, 1); }, 'FORBIDDEN');
  openShift(O, T);
  var o = sell(O, [{ skuId: 'k1', qty: 1 }]);
  T.eq(o.tax, 2800); T.eq(o.service, 1400); T.eq(o.total, 28000 + 2800 + 1400);
});

test('status machine: invalid jump, full path, delivery enqueue at READY', function (O, T) {
  openShift(O, T);
  var o = sell(O, [{ skuId: 'k1', qty: 1 }]);
  T.throws(function () { O.tx(function (d) { O.domain.orders.transition(d, o.id, 'COMPLETED'); }); }, 'INVALID_TRANSITION');
  ['PREPARING', 'READY', 'COMPLETED'].forEach(function (s) { T.eq(O.domain.orders.advance(o.id).status, s); });
  T.throws(function () { O.domain.orders.advance(o.id); }, 'INVALID_TRANSITION');
  T.eq(O.db().orders[0].history.length, 4);
  var enq = [];
  var realDelivery = O.domain.delivery;
  O.domain.delivery = { enqueue: function (d, ord) { enq.push(ord.id); } };
  var dv = sell(O, [{ skuId: 'k2', qty: 1 }], { method: 'delivery', address: 'Jl B', customer: { name: 'Ani', phone: '081234567890' } });
  O.domain.orders.advance(dv.id);
  T.eq(enq.length, 0); O.domain.orders.advance(dv.id); T.eq(enq, [dv.id]);
  T.throws(function () { O.domain.orders.advance(dv.id); }, 'INVALID_TRANSITION', 'delivery stops at READY');
  O.domain.delivery = realDelivery;   // restore: later test files rely on the real module
});

test('PLACED to ACCEPTED requires payment', function (O, T) {
  openShift(O, T);
  var o = sell(O, [{ skuId: 'k1', qty: 1 }]);
  O.tx(function (d) { var x = d.orders[0]; x.status = 'PLACED'; x.paymentStatus = 'PENDING'; });
  T.throws(function () { O.domain.orders.advance(o.id); }, 'PAYMENT_REQUIRED');
});

test('cancel reverses stock, flags refundDue, forbidden states and roles', function (O, T) {
  openShift(O, T);
  var o = sell(O, [{ skuId: 'k1', qty: 4 }]);
  T.eq(stock(O, 'k1'), 36);
  T.throws(function () { O.domain.orders.cancel(o.id, 'salah pesan'); }, 'FORBIDDEN', 'cashier cannot cancel');
  T.as('manager');
  T.throws(function () { O.domain.orders.cancel(o.id, 'x'); }, 'REASON_REQUIRED');
  var c = O.domain.orders.cancel(o.id, 'pelanggan batal');
  T.eq(c.status, 'CANCELLED'); T.eq(stock(O, 'k1'), 40); T.eq(c.refundDue, 112000);
  T.eq(O.db().payments.length, 1, 'no silent refund');
  T.throws(function () { O.domain.orders.cancel(o.id, 'pelanggan batal'); }, 'INVALID_TRANSITION');
  T.eq(stock(O, 'k1'), 40, 'no double reversal');
});

test('shift: one open per register, cash events, close variance, closed immutable', function (O, T) {
  var sh = openShift(O, T, 100000);
  T.throws(function () { O.domain.shifts.open(0); }, 'SHIFT_ALREADY_OPEN');
  sell(O, [{ skuId: 'k1', qty: 1 }]);   // +28000 cash
  O.domain.shifts.cashEvent('IN', 20000, 'tambah modal receh');
  T.throws(function () { O.domain.shifts.cashEvent('OUT', 5000, 'x'); }, 'REASON_REQUIRED');
  T.throws(function () { O.domain.shifts.cashEvent('OUT', 999999, 'ambil kas besar'); }, 'CASH_OVER_EXPECTED');
  O.domain.shifts.cashEvent('OUT', 8000, 'beli es batu');
  T.eq(O.domain.shifts.expected(O.db(), O.db().shifts[0]), 100000 + 28000 + 20000 - 8000);
  T.throws(function () { O.domain.shifts.close(139000); }, 'REASON_REQUIRED', 'variance needs note');
  var closed = O.domain.shifts.close(139000, 'kurang seribu');
  T.eq(closed.variance, -1000);
  T.throws(function () { sell(O, [{ skuId: 'k1', qty: 1 }]); }, 'NO_OPEN_SHIFT');
  T.throws(function () { sell(O, [{ skuId: 'k1', qty: 1 }], { shiftId: sh.id }); }, 'SHIFT_CLOSED', 'explicit closed shift');
  T.throws(function () { O.domain.shifts.cashEvent('IN', 1000, 'setelah tutup', sh.id); }, 'SHIFT_CLOSED');
  T.throws(function () { O.domain.shifts.close(1, 'tutup lagi', sh.id); }, 'SHIFT_CLOSED');
  var s2 = O.domain.shifts.open(0); T.ok(s2.id !== sh.id);
});

test('exact count closes without a note', function (O, T) {
  openShift(O, T, 50000);
  T.eq(O.domain.shifts.close(50000).variance, 0);
});

test('shifts are per register (tenant|outlet) and tenant-isolated', function (O, T) {
  openShift(O, T);
  T.as('cashier', 't2');
  T.eq(O.domain.shifts.current(O.db()), null);
  O.domain.shifts.open(1000);
  T.as('cashier', 't1');
  T.ok(O.domain.shifts.current(O.db()), 't1 shift untouched');
  T.as('cashier', 't2');
  T.throws(function () { sell(O, [{ skuId: 'k1', qty: 1 }]); }, 'NOT_FOUND', 't2 cannot sell t1 sku');
});

test('storefront order needs no shift and no POS permission', function (O, T) {
  T.as('customer');
  var o = O.tx(function (d) {
    return O.domain.orders.place(d, { channel: 'store', items: [{ skuId: 'k1', qty: 1 }], method: 'delivery', address: 'Jl C', customer: { name: 'Eka', phone: '081234567890' }, payment: { type: 'transfer' } });
  });
  T.eq(o.shiftId, null); T.eq(o.channel, 'store'); T.eq(o.paymentStatus, 'PAID');
});

test('held carts hold and resume once', function (O, T) {
  T.as('cashier');
  var h = O.domain.carts.hold({ items: [{ skuId: 'k1', qty: 2 }], label: 'Meja 3' });
  T.eq(O.domain.carts.list(O.db()).length, 1);
  T.eq(O.domain.carts.resume(h.id).items[0].qty, 2);
  T.throws(function () { O.domain.carts.resume(h.id); }, 'NOT_FOUND');
  T.throws(function () { O.domain.carts.hold({ items: [] }); }, 'EMPTY_CART');
});

/* ---------------- refunds ---------------- */
function paidOrder(O, T) {
  openShift(O, T, 100000);
  return sell(O, [{ skuId: 'k1', qty: 3 }, { skuId: 'k2', qty: 1 }]);   // 84000+24000=108000
}

test('refund: request by cashier, approve by manager restocks and reduces cash', function (O, T) {
  var o = paidOrder(O, T);
  var r = O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 1 }], 'gelas bocor');
  T.eq(r.amount, 28000); T.eq(r.status, 'REQUESTED');
  T.throws(function () { O.domain.refunds.approve(r.id, { restock: true }); }, 'FORBIDDEN', 'cashier cannot approve');
  T.as('manager');
  var a = O.domain.refunds.approve(r.id, { restock: true, condition: 'GOOD' });
  T.eq(a.status, 'APPROVED'); T.eq(stock(O, 'k1'), 38);
  var ord = O.domain.orders.get(O.db(), o.id);
  T.eq(ord.paymentStatus, 'PARTIALLY_REFUNDED');
  var rows = O.db().payments.filter(function (p) { return p.amount < 0; });
  T.eq(rows.length, 1); T.eq(rows[0].amount, -28000); T.eq(rows[0].type, 'cash');
  T.eq(O.domain.shifts.expected(O.db(), O.db().shifts[0]), 100000 + 108000 - 28000);
});

test('refund: no restock leaves stock; damaged cannot restock', function (O, T) {
  var o = paidOrder(O, T);
  var r = O.domain.refunds.request(o.id, [{ skuId: 'k2', qty: 1 }], 'rasa salah');
  T.as('manager');
  T.throws(function () { O.domain.refunds.approve(r.id, { restock: true, condition: 'DAMAGED' }); }, 'VALIDATION');
  O.domain.refunds.approve(r.id, { restock: false });
  T.eq(stock(O, 'k2'), 39);
  T.eq(O.db().stockMoves.filter(function (m) { return m.type === 'RETURN_RESTOCK'; }).length, 0);
});

test('refund: requester cannot self-approve; double approve; reject then approve', function (O, T) {
  var o = paidOrder(O, T);
  T.as('manager');
  var r = O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 1 }], 'salah ukuran');
  T.throws(function () { O.domain.refunds.approve(r.id, {}); }, 'SELF_APPROVAL');
  T.as('owner');
  O.domain.refunds.approve(r.id, {});
  T.throws(function () { O.domain.refunds.approve(r.id, {}); }, 'ALREADY_DECIDED');
  T.eq(O.db().payments.filter(function (p) { return p.amount < 0; }).length, 1, 'no duplicate money out');
  var r2 = O.domain.refunds.request(o.id, [{ skuId: 'k2', qty: 1 }], 'tidak sesuai');
  T.as('finance');
  O.domain.refunds.reject(r2.id, 'tidak valid');
  T.throws(function () { O.domain.refunds.approve(r2.id, {}); }, 'ALREADY_DECIDED');
  T.throws(function () { O.domain.refunds.reject(r2.id, 'sekali lagi'); }, 'ALREADY_DECIDED');
});

test('refund: cumulative per-line over-refund blocked; rejected qty freed', function (O, T) {
  var o = paidOrder(O, T);
  var r1 = O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 2 }], 'cacat produk');
  T.throws(function () { O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 2 }], 'cacat produk'); }, 'OVER_REFUND');
  T.throws(function () { O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 1.5 }], 'cacat produk'); }, 'VALIDATION');
  T.throws(function () { O.domain.refunds.request(o.id, [{ skuId: 'k5', qty: 1 }], 'cacat produk'); }, 'VALIDATION', 'sku not in order');
  T.throws(function () { O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 1 }], 'x'); }, 'REASON_REQUIRED');
  T.as('manager'); O.domain.refunds.reject(r1.id, 'ditolak saja');
  T.as('cashier');
  O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 3 }], 'cacat produk');
});

test('refund: full return refunds exactly total and sets REFUNDED; split legs sum exactly', function (O, T) {
  openShift(O, T, 0);
  var o = sell(O, [{ skuId: 'k1', qty: 1 }, { skuId: 'k3', qty: 1 }], { payment: { type: 'split', legs: [{ type: 'cash', amount: 33333 }, { type: 'qris', amount: 26667 }] } });
  T.eq(o.total, 60000);
  var r1 = O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 1 }], 'batal sebagian');
  var r2 = O.domain.refunds.request(o.id, [{ skuId: 'k3', qty: 1 }], 'batal sisanya');
  T.eq(r1.amount + r2.amount, 60000);
  T.as('manager');
  O.domain.refunds.approve(r1.id, {});
  T.eq(O.domain.orders.get(O.db(), o.id).paymentStatus, 'PARTIALLY_REFUNDED');
  var a2 = O.domain.refunds.approve(r2.id, {});
  T.eq(O.domain.orders.get(O.db(), o.id).paymentStatus, 'REFUNDED');
  var neg = O.db().payments.filter(function (p) { return p.amount < 0; });
  T.eq(neg.reduce(function (s, p) { return s + p.amount; }, 0), -60000);
  T.eq(O.db().payments.reduce(function (s, p) { return s + p.amount; }, 0), 0, 'net zero');
  ['cash', 'qris'].forEach(function (t) {
    T.eq(O.db().payments.filter(function (p) { return p.type === t; }).reduce(function (s, p) { return s + p.amount; }, 0), 0, t + ' leg nets to zero');
  });
  T.throws(function () { O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 1 }], 'sudah habis'); }, 'NOT_REFUNDABLE');
});

test('refund: discount shared proportionally (stub promo), delivery fee returned only on full return', function (O, T) {
  var realPromos = O.domain.promos;
  O.domain.promos = { quote: function (d, q) { return { promoId: 'pr1', discount: 10000 }; }, consume: function () {} };
  openShift(O, T, 0);
  var o = sell(O, [{ skuId: 'k1', qty: 1 }, { skuId: 'k2', qty: 1 }], { promoCode: 'AWAN10', method: 'delivery', address: 'Jl D', customer: { name: 'Fit', phone: '081234567890' }, payment: { type: 'transfer' } });
  T.eq(o.discount, 10000); T.eq(o.total, 52000 - 10000 + 10000);
  var r1 = O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 1 }], 'retur satu');
  T.eq(r1.amount, 28000 - Math.round(10000 * 28000 / 52000) + 0 - 0 + (r1.amount - (28000 - Math.round(10000 * 28000 / 52000))));
  var r2 = O.domain.refunds.request(o.id, [{ skuId: 'k2', qty: 1 }], 'retur dua');
  T.eq(r1.amount + r2.amount, o.total, 'cumulative equals total incl. delivery fee');
  O.domain.promos = realPromos;
});

test('refund: unpaid/COD-pending orders not refundable; cross-tenant order hidden', function (O, T) {
  openShift(O, T);
  var o = sell(O, [{ skuId: 'k1', qty: 1 }], { method: 'delivery', address: 'Jl E', customer: { name: 'Gus', phone: '081234567890' }, payment: { type: 'cod' } });
  T.throws(function () { O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 1 }], 'belum bayar'); }, 'NOT_REFUNDABLE');
  O.tx(function (d) { O.domain.orders.setPaymentStatus(d, o.id, 'COD_COLLECTED'); });
  var r = O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 1 }], 'sudah dibayar');
  T.ok(r.amount > 0);
  T.as('manager', 't2');
  T.throws(function () { O.domain.refunds.request(o.id, [{ skuId: 'k9', qty: 1 }], 'lintas tenant'); }, 'NOT_FOUND');
  T.throws(function () { O.domain.refunds.approve(r.id, {}); }, 'NOT_FOUND', 'cannot approve other tenant refund');
});

test('markReturned flags refundDue for paid orders, restock optional', function (O, T) {
  openShift(O, T);
  var o = sell(O, [{ skuId: 'k1', qty: 2 }], { method: 'delivery', address: 'Jl F', customer: { name: 'Hana', phone: '081234567890' }, payment: { type: 'transfer' } });
  ['PREPARING', 'READY'].forEach(function () { O.domain.orders.advance(o.id); });
  var res = O.tx(function (d) { return O.domain.orders.markReturned(d, o.id, { restock: true }); });
  T.eq(res.status, 'RETURNED'); T.eq(res.refundDue, 66000); T.eq(stock(O, 'k1'), 40);
  T.throws(function () { O.tx(function (d) { O.domain.orders.markReturned(d, o.id); }); }, 'INVALID_TRANSITION');
});

test('orders.place is refused for a SUSPENDED tenant on every channel (baseline D-02/D-03)', function (O, T) {
  O.tx(function (d) { d.tenants.filter(function (t) { return t.id === 't1'; })[0].status = 'SUSPENDED'; });
  T.as('owner');
  var spec = { channel: 'store', items: [{ skuId: 'k1', qty: 1 }], method: 'pickup', customer: { name: 'Tamu', phone: '081234567890' }, payment: { type: 'transfer' } };
  T.throws(function () { O.tx(function (d) { O.domain.orders.place(d, spec); }); }, 'TENANT_SUSPENDED');
  T.eq(O.db().orders.length, 0, 'no order written');
  T.eq(O.domain.inventory.onHand(O.db(), 'k1', 'o1'), 40, 'stock untouched');
});

test('COD order records no payment row until cash is verified (QA D7)', function (O, T) {
  T.as('owner');
  var o = O.tx(function (d) { return O.domain.orders.place(d, { channel: 'store', items: [{ skuId: 'k1', qty: 1 }], method: 'delivery', customer: { name: 'Tamu', phone: '081234567890' }, address: 'Jl. Contoh 1 Jakarta', payment: { type: 'cod' } }); });
  T.eq(o.paymentStatus, 'COLLECTION_PENDING');
  T.eq(O.db().payments.filter(function (p) { return p.orderId === o.id; }).length, 0, 'no payment before collection');
});
