/* Regression tests for the cross-batch code review (2026-11-11). One test per fixed finding. */
function as(O, role, actor, outlet) { O.tx(d => { d.session.role = role; d.session.actor = actor; if (outlet) d.session.outlet = outlet; }); }
function hooks(O) { const C = O.domain.catalog; O.hooks.skuPrice = C.skuPrice; O.hooks.resolveModifiers = C.resolveModifiers; return C; }

test('review fixes: approval PIN brute force throttled; token bound to one action', (O, T) => {
  const tm = O.domain.team;
  tm.setPerm('cashier', 'refund.approve', 'approval');
  as(O, 'cashier', 'Sari (Kasir)');
  for (let i = 0; i < 5; i++) T.throws(() => tm.approve('9' + String(i).padStart(3, '0'), 'refund.approve'), 'PIN_WRONG');
  T.throws(() => tm.approve('2222', 'refund.approve'), 'PIN_LOCKED', 'correct PIN refused while throttled');
  T.ok(O.db().audit.filter(a => a.action === 'team.approval.fail').length >= 5, 'failures audited');
  O.clock.advance(tm.APPROVAL_TTL + 1);
  tm.approve('2222', 'refund.approve');
  T.eq(O.can('refund.approve'), false, 'raw approve() alone grants nothing');
  T.eq(tm.withApproval('2222', 'refund.approve', () => O.can('refund.approve')), true, 'valid inside the one approved action');
  T.eq(O.can('refund.approve'), false, 'consumed afterwards');
});

test('review fixes: required modifier group from UI gets a default; renaming keeps option ids', (O, T) => {
  const C = hooks(O);
  const g = C.saveModifierGroup({ name: 'Ukuran', required: true, options: [{ name: 'Reguler', price: 0 }, { name: 'Besar', price: 4000 }] });
  O.tx(d => { d.products.find(p => p.id === 'p2').modifierGroupIds = (d.products.find(p => p.id === 'p2').modifierGroupIds || []).concat([g.id]); });
  const q = () => O.domain.orders.quote(O.db(), { channel: 'store', items: [{ skuId: 'k2', qty: 1 }], method: 'pickup' });
  T.ok(q().items[0].modifiers.some(m => m.name === 'Reguler'), 'storefront sale works with default');
  const suhu = C.modifierGroups(O.db()).find(x => x.name === 'Suhu'), hotId = suhu.options[0].id;
  C.saveModifierGroup({ id: suhu.id, name: 'Suhu', required: true, options: [{ id: hotId, name: 'Panas', price: 0 }, { id: suhu.options[1].id, name: 'Dingin', price: 0 }] });
  const s2 = C.modifierGroups(O.db()).find(x => x.name === 'Suhu');
  T.eq(s2.options[0].id, hotId, 'renamed option keeps id'); T.eq(s2.defaultOptionId, hotId);
  T.eq(O.domain.orders.quote(O.db(), { channel: 'pos', items: [{ skuId: 'k1', qty: 1, modifiers: [hotId] }] }).items[0].modifiers[0].name, 'Panas');
});

test('review fixes: refund pays the chosen line, not the sku average', (O, T) => {
  const C = hooks(O);
  const oat = C.modifierGroups(O.db()).find(x => x.name === 'Topping').options.find(o => o.name === 'Oat milk').id;
  O.domain.shifts.open(0);
  const o = O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 1 }, { skuId: 'k1', qty: 1, modifiers: [oat] }], payment: { type: 'transfer' } });
  T.eq(o.items.length, 2); T.eq(o.items[0].price, 28000); T.eq(o.items[1].price, 36000);
  const rem = O.domain.refunds.remaining(O.db(), o);
  T.eq(rem.map(r => r.price), [28000, 36000]);
  const r = O.domain.refunds.request(o.id, [{ line: 0, qty: 1 }], 'salah pesan plain');
  T.eq(r.amount, 28000, 'plain line refunded at its own price');
  T.throws(() => O.domain.refunds.request(o.id, [{ line: 0, qty: 1 }], 'retur kedua'), 'OVER_REFUND');
  T.eq(O.domain.refunds.request(o.id, [{ skuId: 'k1', qty: 1 }], 'legacy by sku').amount, 36000, 'legacy sku call takes the remaining line');
});

test('review fixes: report net uses goods part of refunds and ignores cancelled orders', (O, T) => {
  O.hooks.charges = (d, x) => ({ tax: Math.round(x.base / 10), service: Math.round(x.base / 20), rounding: 0, taxLabel: 'PBJT 10%' });
  try {
    O.domain.shifts.open(0);
    const o = O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k2', qty: 1 }], payment: { type: 'transfer' } });
    T.eq(o.total, 27600);
    as(O, 'cashier', 'Sari (Kasir)');
    const r = O.domain.refunds.request(o.id, [{ line: 0, qty: 1 }], 'pelanggan batal');
    as(O, 'owner', 'Rina (Owner)');
    O.domain.refunds.approve(r.id, {});
    const day = O.domain.reports2.preset('today');
    const t = O.domain.reports2.summary(O.db(), day).totals;
    T.eq(t.gross, 24000); T.eq(t.refunds, 24000, 'goods part only'); T.eq(t.net, 0, 'net never negative from tax/service');
    T.eq(t.refundsPaid, 27600, 'cash refunded still visible');
  } finally { delete O.hooks.charges; }
});

test('review fixes: transfer sent only from origin; opname shrink capped, never stuck', (O, T) => {
  const S = O.domain.stock;
  const t = S.createTransfer({ to: 'o2', lines: [{ skuId: 'k1', qty: 3 }] });
  O.tx(d => { d.session.outlet = 'o2'; });
  T.throws(() => S.sendTransfer(t.id), 'OUTLET_MISMATCH');
  O.tx(d => { d.session.outlet = 'o1'; });
  T.eq(S.sendTransfer(t.id).status, 'SENT');
  as(O, 'manager', 'Dewa (Manager)', 'o1');
  const doc = S.createCount({ skuIds: ['k2'] });
  S.setCounts(doc.id, { k2: 2 });            // system 40 -> counted 2 (-38)
  S.submitCount(doc.id);
  O.tx(d => { O.domain.inventory.move(d, { skuId: 'k2', qty: -35, type: 'SALE', ref: 'X-after-snapshot' }); });   // 5 left
  as(O, 'owner', 'Rina (Owner)', 'o1');
  const ok = S.approveCount(doc.id);
  T.eq(ok.status, 'APPROVED');
  T.eq(O.domain.inventory.available(O.db(), 'k2', 'o1'), 0, 'capped at zero, not negative');
  T.eq(ok.capped[0].applied, -5);
});

test('review fixes: PIN lock expires after 15 minutes', (O, T) => {
  const tm = O.domain.team, sari = O.mine(O.db(), 'staff').find(s => s.name === 'Sari');
  for (let i = 0; i < 5; i++) { try { tm.verifyPin(sari.id, '0000'); } catch (e) { /* expected */ } }
  T.throws(() => tm.verifyPin(sari.id, '3333'), 'PIN_LOCKED');
  O.clock.advance(tm.PIN_LOCK_MS + 1);
  T.eq(tm.verifyPin(sari.id, '3333').id, sari.id);
});
