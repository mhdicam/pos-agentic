/* RD-17 W1: sync visibility (G2) and audited void (G9). */
function as(O, role, actor, outlet) { O.tx(d => { d.session.role = role; d.session.actor = actor; if (outlet) d.session.outlet = outlet; }); }
function sell(O, pay, items) { return O.domain.orders.checkout({ channel: 'pos', items: items || [{ skuId: 'k2', qty: 2 }], payment: pay || { type: 'cash' } }); }

test('RD17-01/02 sync: per-device pending, conflicts, last sync; stale after 15 min', (O, T) => {
  const F = O.domain.fleet, TR = O.domain.trust;
  F.enqueue('DEV-001', { clientEventId: 'e1', payload: { items: [{ skuId: 'k1', qty: 1 }], payment: { type: 'cash' } } });
  let dv = TR.devices(O.db())[0];
  T.eq([dv.pending, dv.conflicts, dv.stale, dv.lastSyncAt], [1, 0, false, null]);
  O.clock.advance(TR.STALE_MS + 1);
  dv = TR.devices(O.db())[0];
  T.eq(dv.stale, true);
  T.ok(O.domain.tenant.attention(O.db()).some(a => a.route === 'sync' && /15 menit/.test(a.label)), 'owner overview flags it');
  O.domain.shifts.open(0);
  F.sync('DEV-001');
  dv = TR.devices(O.db())[0];
  T.eq([dv.pending, dv.stale], [0, false]); T.ok(dv.lastSyncAt > 0);
});

test('RD17-03 sync: rejected offline item kept as conflict with payload until resolved; DISCARD keeps the row', (O, T) => {
  const F = O.domain.fleet, TR = O.domain.trust;
  F.enqueue('DEV-001', { clientEventId: 'bad', payload: { items: [{ skuId: 'nope', qty: 1 }], payment: { type: 'cash' } } });
  F.sync('DEV-001');
  const c = TR.conflicts(O.db());
  T.eq(c.length, 1); T.eq(c[0].payload.items[0].skuId, 'nope'); T.ok(c[0].reason);
  F.resolve(c[0].id, 'DISCARD', 'SKU sudah dihapus');
  T.eq(TR.conflicts(O.db()).length, 0);
  T.eq(O.mine(O.db(), 'outbox').find(x => x.id === c[0].id).status, 'DISCARDED', 'never deleted');
  as(O, 'cashier', 'Sari');
  T.throws(() => TR.devices(O.db()), 'FORBIDDEN');
});

test('RD17-04 void: reason + permission, reverses money per tender, stock and points; original lines untouched', (O, T) => {
  const TR = O.domain.trust;
  O.domain.shifts.open(100000);
  const o = O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k2', qty: 2 }], payment: { type: 'cash' }, memberId: 'm1' });
  const stock0 = O.domain.inventory.available(O.db(), 'k2', 'o1'), pts0 = O.db().members.find(m => m.id === 'm1').points;
  const lines0 = JSON.stringify(o.items);
  T.throws(() => TR.voidSale(o.id, 'no'), 'REASON_REQUIRED');
  as(O, 'cashier', 'Sari');
  T.throws(() => TR.voidSale(o.id, 'salah input kasir'), 'FORBIDDEN');
  as(O, 'manager', 'Dewa (Manager)');
  const v = TR.voidSale(o.id, 'salah input kasir');
  const d = O.db();
  T.eq(v.status, 'CANCELLED'); T.eq(v.paymentStatus, 'REFUNDED'); T.eq(v.voided.amount, o.total);
  T.eq(O.mine(d, 'payments').filter(p => p.orderId === o.id).reduce((s, p) => s + p.amount, 0), 0, 'money nets to zero');
  T.eq(O.domain.inventory.available(d, 'k2', 'o1'), stock0 + 2);
  T.ok(d.members.find(m => m.id === 'm1').points < pts0, 'points reversed');
  T.eq(JSON.stringify(O.domain.orders.get(d, o.id).items), lines0, 'lines immutable');
  T.ok(d.audit.some(a => a.action === 'order.void' && a.entityId === o.id));
  T.throws(() => TR.voidSale(o.id, 'void kedua kali'), 'ALREADY_VOIDED');
});

test('RD17-05 void after shift closed: cash posted to current open shift, closed shift unchanged', (O, T) => {
  const TR = O.domain.trust, S = O.domain.shifts;
  const s1 = S.open(0); const o = sell(O); S.close(S.expected(O.db(), S.current(O.db())), '');
  const closed = JSON.stringify(O.db().shifts.find(x => x.id === s1.id));
  T.throws(() => TR.voidSale(o.id, 'pelanggan komplain'), 'NO_OPEN_SHIFT');
  const s2 = S.open(200000);
  const v = TR.voidSale(o.id, 'pelanggan komplain');
  T.eq(v.voided.originalShiftClosed, true); T.eq(v.voided.postedShiftId, s2.id);
  T.eq(JSON.stringify(O.db().shifts.find(x => x.id === s1.id)), closed, 'closed shift not edited');
  T.eq(S.expected(O.db(), S.current(O.db())), 200000 - o.total, 'cash leaves the open drawer');
});

test('RD17-04 void: QRIS money reversed without shift; unpaid and pending-refund orders refused', (O, T) => {
  const TR = O.domain.trust;
  const q = sell(O, { type: 'qris' });
  T.eq(TR.voidSale(q.id, 'double charge').voided.postedShiftId, null);
  const cod = O.domain.orders.checkout({ channel: 'store', items: [{ skuId: 'k1', qty: 1 }], method: 'delivery', address: 'Jl. A 1', customer: { name: 'Ani', phone: '081234567890' }, payment: { type: 'cod' } });
  T.throws(() => TR.voidSale(cod.id, 'belum dibayar'), 'NOT_VOIDABLE');
  const t = sell(O, { type: 'transfer' });
  as(O, 'cashier', 'Sari'); O.domain.refunds.request(t.id, [{ line: 0, qty: 1 }], 'satu rusak'); as(O, 'owner', 'Rina (Owner)');
  T.throws(() => TR.voidSale(t.id, 'void semua'), 'REFUND_PENDING');
});

test('RD17-04 void with manager PIN when role rule is approval', (O, T) => {
  const TR = O.domain.trust, tm = O.domain.team;
  const o = sell(O, { type: 'qris' });
  tm.setPerm('cashier', 'order.void', 'approval');
  as(O, 'cashier', 'Sari (Kasir)');
  T.throws(() => TR.voidSale(o.id, 'salah item'), 'FORBIDDEN');
  T.throws(() => tm.withApproval('3333', 'order.void', () => TR.voidSale(o.id, 'salah item')), 'FORBIDDEN', 'cashier PIN cannot approve');
  T.eq(tm.withApproval('2222', 'order.void', () => TR.voidSale(o.id, 'salah item')).status, 'CANCELLED');
});
