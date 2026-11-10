/* Core + inventory contract tests. */
test('seed is tenant-scoped and integer IDR', function (O, T) {
  var d = O.db();
  T.ok(d.skus.every(function (s) { return Number.isInteger(s.price) && Number.isInteger(s.cost); }), 'integer money');
  T.eq(O.mine(d, 'skus').length, 8, 't1 sees 8 skus');
  T.as('owner', 't2');
  T.eq(O.mine(O.db(), 'skus').length, 4, 't2 sees only its 4 skus');
});

test('tx rolls back on throw (atomic)', function (O, T) {
  var before = JSON.stringify(O.db().stockMoves.length);
  T.throws(function () { O.tx(function (d) { d.stockMoves.push({ junk: 1 }); throw O.Err('X', 'boom'); }); }, 'X');
  T.eq(JSON.stringify(O.db().stockMoves.length), before, 'no partial write');
});

test('esc neutralises HTML', function (O, T) {
  T.eq(O.esc('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
});

test('money must be integer IDR', function (O, T) {
  T.throws(function () { O.int(10.5, 'x'); }, 'VALIDATION');
  T.eq(O.int(1000, 'x'), 1000);
});

test('rbac deny-by-default', function (O, T) {
  T.ok(!O.can('refund.approve', 'cashier'), 'cashier cannot approve refunds');
  T.ok(!O.routeAllowed('cashier', 'platform'), 'cashier cannot open platform');
  T.ok(O.routeAllowed('dispatcher', 'dispatch'));
  T.throws(function () { O.require('po.approve', 'manager'); }, 'FORBIDDEN');
});

test('stock derives from movements and blocks oversell', function (O, T) {
  var inv = O.domain.inventory, d = O.db();
  T.eq(inv.onHand(d, 'k1', 'o1'), 40);
  O.tx(function (dd) { inv.move(dd, { skuId: 'k1', qty: -5, type: 'SALE', ref: 'ORD-X' }); });
  T.eq(inv.onHand(O.db(), 'k1', 'o1'), 35);
  T.throws(function () { O.tx(function (dd) { inv.move(dd, { skuId: 'k1', qty: -99, type: 'SALE', ref: 'ORD-Y' }); }); }, 'INSUFFICIENT_STOCK');
  T.eq(inv.onHand(O.db(), 'k1', 'o1'), 35, 'failed sale leaves stock untouched');
});

test('stock movement is idempotent on (type, ref, sku)', function (O, T) {
  var inv = O.domain.inventory;
  O.tx(function (dd) { inv.move(dd, { skuId: 'k2', qty: -2, type: 'SALE', ref: 'ORD-Z' }); });
  O.tx(function (dd) { inv.move(dd, { skuId: 'k2', qty: -2, type: 'SALE', ref: 'ORD-Z' }); });
  T.eq(inv.onHand(O.db(), 'k2', 'o1'), 38, 'replay does not double-deduct');
});

test('cross-tenant sku is not movable', function (O, T) {
  var inv = O.domain.inventory;
  T.throws(function () { O.tx(function (dd) { inv.move(dd, { skuId: 'k9', qty: -1, type: 'SALE', ref: 'ORD-T' }); }); }, 'NOT_FOUND');
});

test('stock adjust requires permission, reason, and writes audit', function (O, T) {
  var inv = O.domain.inventory;
  T.as('cashier');
  T.throws(function () { inv.adjust('k1', 30, 'hitung ulang'); }, 'FORBIDDEN');
  T.as('owner');
  T.throws(function () { inv.adjust('k1', 30, 'x'); }, 'REASON_REQUIRED');
  inv.adjust('k1', 30, 'stok opname bulanan');
  T.eq(inv.onHand(O.db(), 'k1', 'o1'), 30);
  T.ok(O.db().audit.some(function (a) { return a.action === 'stock.adjust'; }), 'audit written');
});
