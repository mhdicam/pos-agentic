/* Finance: catalog, procurement, expenses, reports. */
function prod(over) { return Object.assign({ name: 'Teh Botol', category: 'Minuman', skus: [{ sku: 'TB-1', price: 5000, cost: 3000, stock: 10, barcode: 'BC1' }] }, over || {}); }
function mkPo(O, T, qty) {
  var F = O.domain.procurement;
  var po = F.createPo({ supplierId: 'sup1', lines: [{ skuId: 'k1', qty: qty || 10, unitCost: 8000 }] });
  F.submit(po.id); T.as('owner'); F.approve(po.id); return po.id;
}

test('catalog: create product with opening stock via inventory move', function (O, T) {
  var p = O.domain.catalog.createProduct(prod());
  var d = O.db(), sku = d.skus.filter(function (s) { return s.productId === p.id; })[0];
  T.eq(O.domain.inventory.onHand(d, sku.id, 'o1'), 10);
  T.ok(d.stockMoves.some(function (m) { return m.type === 'OPENING' && m.ref === sku.id; }), 'OPENING move');
  T.eq(p.published, false);
  T.as('brand'); O.domain.catalog.createProduct(prod({ skus: [{ sku: 'TB-2', price: 1, cost: 0 }] }));
});
test('catalog: duplicate sku (case-insensitive) rejected', function (O, T) {
  T.throws(function () { O.domain.catalog.createProduct(prod({ skus: [{ sku: 'ka-100', price: 1, cost: 1 }] })); }, 'DUPLICATE_SKU');
  T.throws(function () { O.domain.catalog.createProduct(prod({ skus: [{ sku: 'X1', price: 1, cost: 1 }, { sku: 'x1', price: 1, cost: 1 }] })); }, 'DUPLICATE_SKU');
});
test('catalog: sku code may repeat in another tenant', function (O, T) {
  T.as('owner', 't2');
  O.domain.catalog.createProduct(prod({ skus: [{ sku: 'KA-100', price: 1, cost: 1 }] }));
});
test('catalog: duplicate barcode rejected', function (O, T) {
  T.throws(function () { O.domain.catalog.createProduct(prod({ skus: [{ sku: 'NEW-1', price: 1, cost: 1, barcode: '8991000' }] })); }, 'DUPLICATE_BARCODE');
});
test('catalog: float / negative price rejected, nothing written', function (O, T) {
  var n = O.db().products.length;
  T.throws(function () { O.domain.catalog.createProduct(prod({ skus: [{ sku: 'F1', price: 10.5, cost: 1 }] })); }, 'VALIDATION');
  T.throws(function () { O.domain.catalog.createProduct(prod({ skus: [{ sku: 'F2', price: -1, cost: 1 }] })); }, 'VALIDATION');
  T.throws(function () { O.domain.catalog.createProduct(prod({ skus: [] })); }, 'VALIDATION');
  T.eq(O.db().products.length, n);
});
test('catalog: cashier cannot create or publish', function (O, T) {
  T.as('cashier');
  T.throws(function () { O.domain.catalog.createProduct(prod()); }, 'FORBIDDEN');
  T.throws(function () { O.domain.catalog.togglePublish('p1'); }, 'FORBIDDEN');
  T.as('finance');
  T.throws(function () { O.domain.catalog.updateProduct('p1', prod()); }, 'FORBIDDEN');
});
test('catalog: update keeps sku uniqueness, never touches stock; publish toggles', function (O, T) {
  var C = O.domain.catalog;
  C.updateProduct('p1', { name: 'Kopi Baru', category: 'Minuman', skus: [{ id: 'k1', sku: 'KA-100', price: 30000, cost: 9000, barcode: '8991000' }] });
  T.eq(O.db().skus[0].price, 30000); T.eq(O.domain.inventory.onHand(O.db(), 'k1', 'o1'), 40);
  T.throws(function () { C.updateProduct('p1', { name: 'x', skus: [{ id: 'k1', sku: 'KA-101', price: 1, cost: 1 }] }); }, 'DUPLICATE_SKU');
  C.togglePublish('p1'); T.eq(O.db().products[0].published, false);
  T.as('owner', 't2');
  T.throws(function () { C.togglePublish('p1'); }, 'NOT_FOUND');
});
test('catalog: csv parse reports line numbers and missing columns', function (O, T) {
  var C = O.domain.catalog;
  var r = C.parseCsv('name,sku\nA,S1');
  T.ok(r.errors.length === 1 && /price/.test(r.errors[0].message));
  r = C.parseCsv('name,sku,price,cost,stock,category\nA,S1,100,50,5,Cat\nB,S2,1.5,50,5,Cat\n"C, Inc",S3,10,5,1,Cat');
  T.eq(r.rows.length, 3); T.eq(r.rows[2].name, 'C, Inc');
  T.eq(r.errors.length, 1); T.eq(r.errors[0].line, 3);
});
test('catalog: import with one bad line writes nothing (atomic) and valid import is draft', function (O, T) {
  var C = O.domain.catalog, n = O.db().products.length, m = O.db().stockMoves.length;
  var r = C.parseCsv('name,sku,price,cost,stock,category\nA,S1,100,50,5,Cat\nB,KA-100,10,5,1,Cat');
  T.eq(r.errors.length, 1);
  var err = null; try { C.commitImport(r.rows); } catch (e) { err = e; }
  T.ok(err && err.code === 'IMPORT_INVALID' && err.errors.length === 1);
  T.eq(O.db().products.length, n); T.eq(O.db().stockMoves.length, m);
  r = C.parseCsv('name,sku,price,cost,stock,category\nA,S1,100,50,5,Cat\nB,S2,10,5,0,Cat');
  T.eq(r.errors.length, 0); C.commitImport(r.rows);
  T.eq(O.db().products.length, n + 2);
  T.ok(O.db().products.slice(n).every(function (p) { return p.published === false; }), 'drafts');
  T.eq(O.db().stockMoves.length, m + 1);
  T.as('cashier'); T.throws(function () { C.commitImport(r.rows); }, 'FORBIDDEN');
});
test('procurement: PO lifecycle, receive writes stock and accrual, not expense', function (O, T) {
  var F = O.domain.procurement; T.as('manager');
  var id = mkPo(O, T, 10);
  T.as('manager'); F.receive(id, [{ skuId: 'k1', qty: 4 }], 'R1');
  var d = O.db(), po = d.purchaseOrders[0];
  T.eq(po.status, 'PARTIAL'); T.eq(O.domain.inventory.onHand(d, 'k1', 'o1'), 44);
  F.receive(id, [{ skuId: 'k1', qty: 6 }], 'R2');
  T.eq(O.db().purchaseOrders[0].status, 'RECEIVED');
  d = O.db();
  T.eq(d.expenses.length, 0, 'no expense');
  T.eq(d.ledger.filter(function (l) { return l.type === 'PURCHASE_ACCRUAL'; }).length, 2);
  T.eq(d.ledger.filter(function (l) { return l.type === 'EXPENSE_PAID'; }).length, 0);
  T.eq(O.domain.reports.expenses(d, {}).total, 0);
});
test('procurement: over-receipt rejected, nothing written', function (O, T) {
  var F = O.domain.procurement; T.as('manager'); var id = mkPo(O, T, 5); T.as('manager');
  var m = O.db().stockMoves.length;
  T.throws(function () { F.receive(id, [{ skuId: 'k1', qty: 6 }], 'R1'); }, 'OVER_RECEIPT');
  F.receive(id, [{ skuId: 'k1', qty: 3 }], 'R2');
  T.throws(function () { F.receive(id, [{ skuId: 'k1', qty: 3 }], 'R3'); }, 'OVER_RECEIPT');
  T.eq(O.db().stockMoves.length, m + 1);
});
test('procurement: same receipt id twice is idempotent', function (O, T) {
  var F = O.domain.procurement; T.as('manager'); var id = mkPo(O, T, 10); T.as('manager');
  F.receive(id, [{ skuId: 'k1', qty: 4 }], 'R1'); F.receive(id, [{ skuId: 'k1', qty: 4 }], 'R1');
  T.eq(O.domain.inventory.onHand(O.db(), 'k1', 'o1'), 44);
  T.eq(O.db().ledger.length, 1); T.eq(O.db().purchaseOrders[0].lines[0].received, 4);
});
test('procurement: manager cannot approve PO; cannot receive unapproved', function (O, T) {
  var F = O.domain.procurement; T.as('manager');
  var po = F.createPo({ supplierId: 'sup1', lines: [{ skuId: 'k1', qty: 2, unitCost: 100 }] });
  F.submit(po.id);
  T.throws(function () { F.approve(po.id); }, 'FORBIDDEN');
  T.throws(function () { F.receive(po.id, [{ skuId: 'k1', qty: 1 }], 'R'); }, 'INVALID_STATE');
  T.as('cashier'); T.throws(function () { F.createPo({ supplierId: 'sup1', lines: [{ skuId: 'k1', qty: 1, unitCost: 1 }] }); }, 'FORBIDDEN');
});
test('procurement: validation and cross-tenant', function (O, T) {
  var F = O.domain.procurement;
  T.throws(function () { F.createPo({ supplierId: 'sup1', lines: [{ skuId: 'k1', qty: 1.5, unitCost: 1 }] }); }, 'VALIDATION');
  T.throws(function () { F.createPo({ supplierId: 'sup1', lines: [{ skuId: 'k1', qty: 0, unitCost: 1 }] }); }, 'VALIDATION');
  T.throws(function () { F.createPo({ supplierId: 'sup1', lines: [{ skuId: 'k9', qty: 1, unitCost: 1 }] }); }, 'NOT_FOUND');
  var po = F.createPo({ supplierId: 'sup1', lines: [{ skuId: 'k1', qty: 1, unitCost: 1 }] });
  T.throws(function () { F.approve(po.id); }, 'INVALID_STATE');
  T.as('owner', 't2'); T.eq(O.mine(O.db(), 'purchaseOrders').length, 0);
  T.throws(function () { F.submit(po.id); }, 'NOT_FOUND');
});
function exp(E, amt) { return E.create({ amount: amt, category: 'Operasional', note: 'beli galon' }); }
test('expense: manager creates, owner approves, finance pays once, ledger + audit', function (O, T) {
  var E = O.domain.expenses; T.as('manager'); var e = exp(E, 100000);
  T.as('owner'); E.approve(e.id);
  T.as('finance'); E.pay(e.id);
  var d = O.db();
  T.eq(d.expenses[0].status, 'PAID');
  T.eq(d.ledger.filter(function (l) { return l.type === 'EXPENSE_PAID'; })[0].amount, 100000);
  T.eq(d.audit.filter(function (a) { return /^expense\./.test(a.action); }).length, 3);
  T.throws(function () { E.pay(e.id); }, 'ALREADY_PAID');
  T.eq(O.db().ledger.length, 1);
});
test('expense: self-approval blocked', function (O, T) {
  var E = O.domain.expenses; T.as('manager'); var e = exp(E, 100000);
  T.throws(function () { E.approve(e.id); }, 'SELF_APPROVAL');
  T.as('owner'); var e2 = exp(E, 100000);
  T.throws(function () { E.approve(e2.id); }, 'SELF_APPROVAL');
});
test('expense: wrong role for amount, and no rule', function (O, T) {
  var E = O.domain.expenses; T.as('finance'); var big = exp(E, 600000), small = exp(E, 1000);
  T.as('manager');
  T.throws(function () { E.approve(big.id); }, 'WRONG_APPROVER');
  E.approve(small.id);
  T.as('owner', 't1');
  O.tx(function (d) { d.approvalRules = d.approvalRules.filter(function (r) { return r.tenant !== 't1' || r.id !== 'ar1'; }); });
  T.as('finance'); var gap = exp(E, 1234);
  T.as('owner'); T.throws(function () { E.approve(gap.id); }, 'NO_APPROVAL_RULE');
});
test('expense: reject needs reason; rejected cannot be paid; unapproved cannot be paid', function (O, T) {
  var E = O.domain.expenses; T.as('finance'); var e = exp(E, 1000);
  T.as('manager'); T.throws(function () { E.reject(e.id, 'no'); }, 'REASON_REQUIRED');
  E.reject(e.id, 'tidak sesuai kebijakan'); T.eq(O.db().expenses[0].status, 'REJECTED');
  T.as('finance'); T.throws(function () { E.pay(e.id); }, 'INVALID_STATE');
  var e2 = exp(E, 1000); T.throws(function () { E.pay(e2.id); }, 'INVALID_STATE');
  T.as('manager'); T.throws(function () { E.pay(e2.id); }, 'FORBIDDEN');
});
test('expense: validation + attachment limits', function (O, T) {
  var E = O.domain.expenses;
  T.throws(function () { E.create({ amount: 0, category: 'Gaji', note: 'x' }); }, 'VALIDATION');
  T.throws(function () { E.create({ amount: 10.5, category: 'Gaji', note: 'x' }); }, 'VALIDATION');
  T.throws(function () { E.create({ amount: 5, category: 'Hantu', note: 'x' }); }, 'VALIDATION');
  T.throws(function () { E.create({ amount: 5, category: 'Gaji', note: 'x', attachment: { name: 'a.pdf', type: 'pdf', size: 2 * 1024 * 1024 + 1 } }); }, 'ATTACHMENT_TOO_LARGE');
  T.throws(function () { E.create({ amount: 5, category: 'Gaji', note: 'x', attachment: { name: 'a.exe', type: 'application/x-msdownload', size: 10 } }); }, 'ATTACHMENT_TYPE');
  var e = E.create({ amount: 5, category: 'Gaji', note: 'x', attachment: { name: 'a.pdf', type: 'application/pdf', size: 2 * 1024 * 1024 } });
  T.eq(e.attachment.type, 'pdf');
  T.as('cashier'); T.throws(function () { E.create({ amount: 5, category: 'Gaji', note: 'x' }); }, 'FORBIDDEN');
});
test('expense: approval rules cannot overlap; owner only', function (O, T) {
  var E = O.domain.expenses;
  T.throws(function () { E.addRule({ min: 100, max: 600000, role: 'manager' }); }, 'OVERLAP');
  T.throws(function () { E.addRule({ min: 5, max: 1, role: 'manager' }); }, 'VALIDATION');
  E.removeRule('ar2'); E.addRule({ min: 500000, max: 999999, role: 'finance' });
  T.as('manager'); T.throws(function () { E.addRule({ min: 1000000, max: 2000000, role: 'owner' }); }, 'FORBIDDEN');
});
test('expense: cross-tenant isolation', function (O, T) {
  var E = O.domain.expenses; T.as('manager'); var e = exp(E, 1000);
  T.as('owner', 't2'); T.eq(O.mine(O.db(), 'expenses').length, 0);
  T.throws(function () { E.approve(e.id); }, 'NOT_FOUND');
});
test('reports: csv escapes formula injection and quotes', function (O, T) {
  var R = O.domain.reports;
  var csv = R.exportCsv([{ a: '=1+1', b: 'x,y', c: 'say "hi"', d: '@cmd', e: -5, f: '+9', g: '-2', h: 'l1\nl2' }], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  var line = csv.split('\n').slice(1).join('\n');
  T.eq(line, "'=1+1,\"x,y\",\"say \"\"hi\"\"\",'@cmd,-5,'+9,'-2,\"l1\nl2\"");
});
test('reports: profit arithmetic exact in integers, ranges, filters', function (O, T) {
  var R = O.domain.reports, E = O.domain.expenses, day = O.clock.day(), now = O.clock.now();
  O.tx(function (d) {
    d.orders.push({ id: 'O1', tenant: 't1', channel: 'pos', customer: { name: 'A', phone: '1' }, items: [{ skuId: 'k1', name: 'Kopi', qty: 2, price: 28000, cost: 9000 }], total: 56000, status: 'COMPLETED', paymentStatus: 'PAID', createdAt: now });
    d.orders.push({ id: 'O2', tenant: 't1', channel: 'store', customer: { name: 'B', phone: '2' }, items: [{ skuId: 'k2', name: 'Ame', qty: 1, price: 24000, cost: 6500 }], total: 34000, status: 'COMPLETED', paymentStatus: 'PAID', createdAt: now });
    d.orders.push({ id: 'O3', tenant: 't2', channel: 'pos', items: [{ skuId: 'k9', qty: 1, price: 99, cost: 1 }], total: 99, status: 'COMPLETED', createdAt: now });
    d.payments.push({ id: 'P1', tenant: 't1', orderId: 'O1', type: 'cash', amount: 56000, at: now }, { id: 'P2', tenant: 't1', orderId: 'O2', type: 'qris', amount: 34000, at: now });
    d.refunds.push({ id: 'R1', tenant: 't1', orderId: 'O2', amount: 4000, status: 'APPROVED', at: now });
  });
  T.as('manager'); var e = exp(E, 10000); T.as('owner'); E.approve(e.id); E.pay(e.id);
  var p = R.profit(O.db(), { from: day, to: day });
  T.eq(p, { revenue: 90000, cogs: 24500, expenses: 10000, refunds: 4000, profit: 51500 });
  T.eq(R.profit(O.db(), { from: '2000-01-01', to: '2000-01-02' }).revenue, 0);
  T.eq(R.sales(O.db(), { channel: 'pos' }).revenue, 56000);
  T.eq(R.sales(O.db(), { payment: 'qris' }).revenue, 34000);
  T.eq(R.payments(O.db(), {}).total, 90000);
  T.eq(R.products(O.db(), {}, 'revenue')[0].margin, 38000);
  T.eq(R.customers(O.db(), {}).length, 2);
  T.eq(R.expenses(O.db(), {}).rows[0].category, 'Operasional');
  T.eq(R.inventoryValuation(O.db()).rows.length, 8);
  T.eq(R.delivery(O.db(), {}).total, 0);
  T.as('owner', 't2'); T.eq(R.profit(O.db(), {}).revenue, 99, 'tenant isolation');
  T.as('cashier'); T.throws(function () { R.profit(O.db(), {}); }, 'FORBIDDEN');
});
