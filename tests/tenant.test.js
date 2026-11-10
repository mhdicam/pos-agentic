/* Owner tenant domain: settings, plan request, audit scope, demo sales, onboarding. */
test('saveProfile validates and is owner-only', (O, T) => {
  const t = O.domain.tenant;
  T.throws(() => t.saveProfile({ name: 'X', category: 'F&B' }), 'VALIDATION');
  T.throws(() => t.saveProfile({ name: 'Kopi Awan', category: 'F&B', npwp: '123' }), 'VALIDATION');
  T.throws(() => t.saveProfile({ name: 'Kopi Awan', category: 'Nope' }), 'VALIDATION');
  t.saveProfile({ name: 'Kopi Awan Baru', category: 'F&B', phone: '0812-3456-7890', npwp: '01.234.567.8-901.000', showNpwp: true });
  const d = O.db();
  T.eq(d.tenants.find(x => x.id === 't1').name, 'Kopi Awan Baru');
  T.eq(t.profile(d).npwp, '012345678901000');
  T.ok(d.audit.some(a => a.action === 'tenant.profile.update' && a.tenant === 't1'));
  T.as('manager');
  T.throws(() => t.saveProfile({ name: 'Hack', category: 'F&B' }), 'FORBIDDEN');
});

test('saveHours rejects close before open and unknown outlet of other tenant', (O, T) => {
  const t = O.domain.tenant, ok = Array(7).fill({ open: '08:00', close: '22:00', closed: false });
  T.throws(() => t.saveHours('o1', ok.map((r, i) => i === 2 ? { open: '22:00', close: '08:00' } : r)), 'VALIDATION');
  T.throws(() => t.saveHours('o3', ok), 'NOT_FOUND');
  t.saveHours('o1', ok.map((r, i) => i === 6 ? { closed: true } : r));
  T.eq(t.hours(O.db(), 'o1')[6].closed, true);
});

test('requestPlan: one pending, no-op and downgrade guards, platform applies', (O, T) => {
  const t = O.domain.tenant;
  T.throws(() => t.requestPlan('growth'), 'NO_CHANGE');
  T.throws(() => t.requestPlan('starter'), 'DOWNGRADE_BLOCKED');   // 2 outlets > starter 1
  const r = t.requestPlan('scale', 'buka cabang');
  T.throws(() => t.requestPlan('scale'), 'DUPLICATE');
  T.throws(() => t.resolvePlanRequest(r.id, true), 'FORBIDDEN');    // owner cannot self-approve
  T.as('platform');
  t.resolvePlanRequest(r.id, true);
  T.eq(O.db().tenants.find(x => x.id === 't1').plan, 'scale');
  T.throws(() => t.resolvePlanRequest(r.id, true), 'INVALID_STATE');
});

test('reject plan request needs reason; owner can cancel pending', (O, T) => {
  const t = O.domain.tenant;
  const r = t.requestPlan('scale');
  t.cancelPlanRequest(r.id);
  T.throws(() => t.cancelPlanRequest(r.id), 'INVALID_STATE');
  const r2 = t.requestPlan('scale');
  T.as('platform');
  T.throws(() => t.resolvePlanRequest(r2.id, false, 'no'), 'REASON_REQUIRED');
  t.resolvePlanRequest(r2.id, false, 'Tagihan belum lunas');
  T.eq(O.db().tenants.find(x => x.id === 't1').plan, 'growth');
});

test('billing read: owner and finance only; cashier forbidden', (O, T) => {
  const t = O.domain.tenant;
  T.eq(t.usage(O.db()).rows.find(r => r.key === 'outlets').used, 2);
  T.as('finance'); t.invoices(O.db());
  T.as('cashier');
  T.throws(() => t.usage(O.db()), 'FORBIDDEN');
  T.throws(() => t.requestPlan('scale'), 'FORBIDDEN');
});

test('audit is tenant-scoped and owner-only', (O, T) => {
  const t = O.domain.tenant;
  t.saveProfile({ name: 'Kopi Awan', category: 'F&B' });
  T.as('owner', 't2');
  t.saveProfile({ name: 'Freshmart', category: 'Retail' });
  const rows = t.audit(O.db());
  T.ok(rows.length >= 1 && rows.every(a => a.tenant === 't2'), 'only t2 rows');
  T.as('manager', 't2');
  T.throws(() => t.audit(O.db()), 'FORBIDDEN');
});

test('demoHistory: 30 days via real flows, both outlets, once, rolls back on failure', (O, T) => {
  const t = O.domain.tenant;
  T.eq(t.onboarding(O.db()).steps.find(s => s.key === 'sale').done, false);
  const st = O.demoHistory();
  const d = O.db(), orders = O.mine(d, 'orders');
  T.eq(orders.length, st.orders);
  T.ok(orders.some(o => o.outlet === 'o1') && orders.some(o => o.outlet === 'o2'), 'both outlets');
  T.ok(orders.some(o => o.channel === 'store') && O.mine(d, 'deliveries').some(x => x.status === 'DELIVERED'), 'online + delivered');
  T.ok(orders.filter(o => o.paymentStatus === 'PAID').every(o => d.payments.some(p => p.orderId === o.id)), 'paid orders have payment rows (incl. verified COD)');
  T.ok(orders.filter(o => o.paymentStatus === 'COD_COLLECTED').every(o => !d.payments.some(p => p.orderId === o.id)), 'unverified COD has no payment row');
  T.ok(O.mine(d, 'shifts').some(s => s.variance < 0), 'a closed shift with shortage');
  T.ok(O.mine(d, 'refunds').some(r => r.status === 'REQUESTED') && O.mine(d, 'expenses').some(e => e.status === 'PENDING'), 'pending approvals');
  T.ok(O.domain.inventory.catalog(d).every(r => r.available >= 0), 'no negative stock');
  T.eq(d.session.role, 'owner'); T.eq(d.session.outlet, 'o1');
  T.eq(t.onboarding(d).steps.find(s => s.key === 'sale').done, true);
  T.throws(() => O.demoHistory(), 'NO_CHANGE');
  const before = JSON.stringify(O.db());
  T.throws(() => O.batch(() => { O.tx(x => { x.members.push({ id: 'X', tenant: 't1' }); }); throw O.Err('BOOM', 'x'); }), 'BOOM');
  T.eq(JSON.stringify(O.db()), before, 'batch rolled back');
});

test('outlet switch hooks: per-outlet price and charges flow into the quote', (O, T) => {
  O.hooks.skuPrice = (d, sku, outlet) => outlet === 'o2' ? sku.price + 2000 : undefined;
  O.hooks.charges = (d, x) => ({ tax: Math.round(x.base / 10), service: 0, rounding: 0, taxLabel: 'PBJT 10%' });
  try {
    const q1 = O.domain.orders.quote(O.db(), { channel: 'pos', items: [{ skuId: 'k1', qty: 1 }] });
    O.tx(d => { d.session.outlet = 'o2'; });
    const q2 = O.domain.orders.quote(O.db(), { channel: 'pos', items: [{ skuId: 'k1', qty: 1 }] });
    T.eq(q2.subtotal - q1.subtotal, 2000); T.eq(q1.tax, 2800); T.eq(q1.taxLabel, 'PBJT 10%');
  } finally { delete O.hooks.skuPrice; delete O.hooks.charges; }
});

test('attention lists pending refunds-free baseline and counts store orders', (O, T) => {
  const t = O.domain.tenant;
  T.eq(t.attention(O.db()).length, 0);
  O.domain.orders.checkout({ channel: 'store', items: [{ skuId: 'k1', qty: 1 }], method: 'delivery', address: 'Jl. A 1', customer: { name: 'Ani', phone: '081234567890' }, payment: { type: 'cod' } });
  T.ok(t.attention(O.db()).some(x => x.route === 'orders' && x.n === 1));
});
