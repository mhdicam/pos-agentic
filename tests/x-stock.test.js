/* RD-13 tenant stock: card, summary, adjustments, opname, transfers, reorder, PO reject/cancel. */
function asActor(O, role, actor, outlet) { O.tx(d => { d.session.role = role; d.session.actor = actor; if (outlet) d.session.outlet = outlet; }); }

test('stock card: running balance and type filter', (O, T) => {
  const S = O.domain.stock;
  S.adjust({ skuId: 'k1', qty: -3, reason: 'damaged' });
  S.adjust({ skuId: 'k1', qty: 2, reason: 'recount' });
  const c = S.card(O.db(), 'k1', 'o1');
  T.eq(c.rows.map(r => r.balance), [40, 37, 39]);
  T.eq(c.onHand, 39);
  T.eq(S.card(O.db(), 'k1', 'o1', { type: 'ADJUSTMENT' }).rows.length, 2);
  T.eq(c.rows[1].label, 'Penyesuaian');
});

test('summary: columns derive from moves and end = begin + changes; value at cost', (O, T) => {
  const S = O.domain.stock, t0 = O.clock.now();
  O.clock.advance(1000);
  S.adjust({ skuId: 'k1', qty: -4, reason: 'lost' });
  const t = S.createTransfer({ to: 'o2', lines: [{ skuId: 'k1', qty: 6 }] }); S.sendTransfer(t.id);
  O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 2 }], method: 'pickup', payment: { type: 'qris' } });
  const r = S.summary(O.db(), 'o1', t0 + 1).rows.find(x => x.skuId === 'k1');
  T.eq([r.begin, r.adjust, r.tout, r.sale, r.end], [40, -4, -6, -2, 28]);
  T.eq(r.end, O.domain.inventory.onHand(O.db(), 'k1', 'o1'));
  T.eq(r.value, 28 * 9000);
});

test('adjust: reason required, other needs note, negative result forbidden, cashier forbidden', (O, T) => {
  const S = O.domain.stock;
  T.throws(() => S.adjust({ skuId: 'k1', qty: -1 }), 'VALIDATION');
  T.throws(() => S.adjust({ skuId: 'k1', qty: -1, reason: 'other', note: 'x' }), 'REASON_REQUIRED');
  T.throws(() => S.adjust({ skuId: 'k1', qty: -41, reason: 'lost' }), 'INSUFFICIENT_STOCK');
  T.throws(() => S.adjust({ skuId: 'k1', qty: 1.5, reason: 'lost' }), 'VALIDATION');
  const m = S.adjust({ skuId: 'k1', qty: -1, reason: 'other', note: 'Dipakai untuk foto menu' });
  T.eq(m.reason, 'other'); T.ok(/Lainnya/.test(m.note));
  T.as('cashier');
  T.throws(() => S.adjust({ skuId: 'k1', qty: -1, reason: 'lost' }), 'FORBIDDEN');
});

test('adjust: other tenant sku not found', (O, T) => {
  T.throws(() => O.domain.stock.adjust({ skuId: 'k9', qty: 1, reason: 'recount' }), 'NOT_FOUND');
});

test('opname: snapshot, variance qty/value, approve writes one ADJUSTMENT per variance, replay idempotent', (O, T) => {
  const S = O.domain.stock;
  asActor(O, 'manager', 'Dewa', 'o1');
  const so = S.createCount({ skuIds: ['k1', 'k2', 'k3'] });
  T.eq(so.lines.map(l => l.system), [40, 40, 40]);
  T.throws(() => S.submitCount(so.id), 'VALIDATION');                 // not all counted
  S.setCounts(so.id, { k1: 38, k2: 40, k3: 41 });
  S.submitCount(so.id);
  const v = S.variance(O.db().stockCounts.find(x => x.id === so.id));
  T.eq([v.qty, v.value], [-1, -2 * 9000 + 12000]);
  T.throws(() => S.approveCount(so.id), 'SELF_APPROVAL');
  asActor(O, 'owner', 'Rina', 'o1');
  S.approveCount(so.id);
  const moves = () => O.db().stockMoves.filter(m => m.ref === so.id);
  T.eq(moves().length, 2);
  const n = O.db().audit.length;
  S.approveCount(so.id);
  T.eq(moves().length, 2); T.eq(O.db().audit.length, n, 'replay writes nothing');
  T.eq(O.domain.inventory.onHand(O.db(), 'k1', 'o1'), 38);
});

test('opname: variance applied as delta on top of moves after snapshot', (O, T) => {
  const S = O.domain.stock;
  asActor(O, 'manager', 'Dewa', 'o1');
  const so = S.createCount({ skuIds: ['k1'] });
  S.setCounts(so.id, { k1: 37 }); S.submitCount(so.id);   // variance -3
  O.clock.advance(1000);
  S.adjust({ skuId: 'k1', qty: -5, reason: 'damaged' });  // after snapshot
  T.eq(S.movesAfterSnapshot(O.db(), O.db().stockCounts[0]), 1);
  asActor(O, 'owner', 'Rina', 'o1');
  S.approveCount(so.id);
  T.eq(O.domain.inventory.onHand(O.db(), 'k1', 'o1'), 32);
});

test('opname: rejected writes no moves; cashier cannot create; counts only in DRAFT', (O, T) => {
  const S = O.domain.stock;
  asActor(O, 'manager', 'Dewa', 'o1');
  const so = S.createCount({});
  T.eq(so.scope, 'full'); T.eq(so.lines.length, 8);
  const c = {}; so.lines.forEach(l => { c[l.skuId] = 0; });
  S.setCounts(so.id, c); S.submitCount(so.id);
  T.throws(() => S.setCounts(so.id, { k1: 1 }), 'INVALID_STATE');
  asActor(O, 'owner', 'Rina', 'o1');
  T.throws(() => S.rejectCount(so.id, 'no'), 'REASON_REQUIRED');
  S.rejectCount(so.id, 'Hitungan tidak masuk akal');
  T.eq(O.db().stockMoves.filter(m => m.ref === so.id).length, 0);
  T.throws(() => S.approveCount(so.id), 'INVALID_STATE');
  T.as('cashier');
  T.throws(() => S.createCount({}), 'FORBIDDEN');
});

test('transfer: send/receive with shortfall discrepancy; balances move between outlets', (O, T) => {
  const S = O.domain.stock, I = O.domain.inventory;
  const t = S.createTransfer({ to: 'o2', lines: [{ skuId: 'k1', qty: 10 }, { skuId: 'k2', qty: 4 }] });
  T.throws(() => S.receiveTransfer(t.id), 'INVALID_STATE');
  S.sendTransfer(t.id);
  T.eq(I.onHand(O.db(), 'k1', 'o1'), 30);
  T.throws(() => S.cancelTransfer(t.id, 'salah kirim'), 'INVALID_STATE');
  T.throws(() => S.receiveTransfer(t.id), 'OUTLET_MISMATCH');
  O.tx(d => { d.session.outlet = 'o2'; });
  T.throws(() => S.receiveTransfer(t.id, { k1: 11 }), 'VALIDATION');
  S.receiveTransfer(t.id, { k1: 9 });
  const d = O.db(), tr = d.stockTransfers[0];
  T.eq(tr.status, 'RECEIVED'); T.eq(tr.discrepancy, [{ skuId: 'k1', qty: 1 }]);
  T.eq([I.onHand(d, 'k1', 'o2'), I.onHand(d, 'k2', 'o2')], [9, 4]);
});

test('transfer: same outlet, other tenant outlet, over available, cashier forbidden, cancel draft', (O, T) => {
  const S = O.domain.stock;
  T.throws(() => S.createTransfer({ to: 'o1', lines: [{ skuId: 'k1', qty: 1 }] }), 'SAME_OUTLET');
  T.throws(() => S.createTransfer({ to: 'o3', lines: [{ skuId: 'k1', qty: 1 }] }), 'NOT_FOUND');
  T.throws(() => S.createTransfer({ to: 'o2', lines: [{ skuId: 'k1', qty: 41 }] }), 'INSUFFICIENT_STOCK');
  const t = S.createTransfer({ to: 'o2', lines: [{ skuId: 'k1', qty: 5 }] });
  S.cancelTransfer(t.id, 'Batal, stok cukup');
  T.throws(() => S.sendTransfer(t.id), 'INVALID_STATE');
  T.eq(O.db().stockMoves.filter(m => m.ref === t.id).length, 0);
  T.as('cashier');
  T.throws(() => S.createTransfer({ to: 'o2', lines: [{ skuId: 'k1', qty: 1 }] }), 'FORBIDDEN');
});

test('reorder point: needsOrder lists low SKUs with createPo-ready lines', (O, T) => {
  const S = O.domain.stock;
  T.throws(() => S.setReorderPoint('k1', -1), 'VALIDATION');
  S.setReorderPoint('k1', 45);
  const n = S.needsOrder(O.db(), 'o1');
  T.eq(n, [{ skuId: 'k1', available: 40, point: 45, qty: 50, unitCost: 9000 }]);
  T.eq(S.needsOrder(O.db(), 'o2').length, 0, 'per outlet');
  const po = O.domain.procurement.createPo({ supplierId: 'sup1', lines: n.map(l => ({ skuId: l.skuId, qty: l.qty, unitCost: l.unitCost })) });
  T.eq(po.total, 450000);
});

test('PO reject (owner, SUBMITTED) and cancel (before receipt only)', (O, T) => {
  const S = O.domain.stock, P = O.domain.procurement;
  const a = P.createPo({ supplierId: 'sup1', lines: [{ skuId: 'k1', qty: 5, unitCost: 9000 }] });
  T.throws(() => S.rejectPo(a.id, 'Harga terlalu mahal'), 'INVALID_STATE');
  P.submit(a.id);
  T.as('manager');
  T.throws(() => S.rejectPo(a.id, 'Harga terlalu mahal'), 'FORBIDDEN');
  T.as('owner');
  S.rejectPo(a.id, 'Harga terlalu mahal');
  T.eq(O.db().purchaseOrders.find(p => p.id === a.id).status, 'REJECTED');
  const b = P.createPo({ supplierId: 'sup1', lines: [{ skuId: 'k1', qty: 5, unitCost: 9000 }] });
  P.submit(b.id); P.approve(b.id); P.receive(b.id, [{ skuId: 'k1', qty: 2 }]);
  T.throws(() => S.cancelPo(b.id, 'Tidak jadi beli'), 'INVALID_STATE');
  const c = P.createPo({ supplierId: 'sup1', lines: [{ skuId: 'k2', qty: 5, unitCost: 6500 }] });
  S.cancelPo(c.id, 'Tidak jadi beli');
  T.throws(() => P.submit(c.id), 'INVALID_STATE');
});

test('demo hook: opname approved + submitted, transfers received + sent, adjustments with reasons', (O, T) => {
  O.demoHistory();
  const d = O.db();
  T.ok(O.mine(d, 'stockCounts').some(x => x.status === 'APPROVED') && O.mine(d, 'stockCounts').some(x => x.status === 'SUBMITTED'));
  T.ok(O.mine(d, 'stockTransfers').some(x => x.status === 'RECEIVED') && O.mine(d, 'stockTransfers').some(x => x.status === 'SENT'));
  T.ok(d.stockMoves.filter(m => m.type === 'ADJUSTMENT' && m.reason).length >= 3);
  T.ok(O.domain.stock.needsOrder(d, 'o1').length >= 1);
});
