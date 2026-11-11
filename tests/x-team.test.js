/* RD-14 tenant team: role overrides, manager approval, PIN, attendance, blind close. */
test('team: no overrides = hook returns undefined (defaults unchanged)', (O, T) => {
  T.eq(O.hooks.can('pos.sell', 'cashier', O.db()), undefined);
  T.ok(O.can('pos.sell', 'cashier')); T.ok(!O.can('order.cancel', 'cashier'));
});

test('team: override deny and allow per tenant role', (O, T) => {
  const tm = O.domain.team;
  tm.setPerm('cashier', 'pos.sell', 'deny');
  tm.setPerm('cashier', 'order.cancel', 'allow');
  T.ok(!O.can('pos.sell', 'cashier')); T.ok(O.can('order.cancel', 'cashier'));
  T.as('cashier');
  T.throws(() => O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 1 }], method: 'pickup', payment: { type: 'qris' } }), 'FORBIDDEN');
  T.as('owner'); tm.setPerm('cashier', 'pos.sell', 'default');
  T.ok(O.can('pos.sell', 'cashier'));
  T.ok(O.db().audit.some(a => a.action === 'team.role.perm' && a.detail === 'pos.sell=deny'));
});

test('team: approval-required needs manager PIN and is consumed once', (O, T) => {
  const tm = O.domain.team;
  tm.setPerm('cashier', 'shift.operate', 'approval');
  T.as('cashier');
  T.throws(() => O.domain.shifts.open(100000), 'FORBIDDEN');
  T.throws(() => tm.approve('3333', 'shift.operate'), 'FORBIDDEN');      // cashier PIN cannot approve
  T.throws(() => tm.approve('9999', 'shift.operate'), 'PIN_WRONG');
  const s = tm.withApproval('2222', 'shift.operate', () => O.domain.shifts.open(100000));
  T.ok(s.id);
  T.eq(O.db().session.approval, undefined);
  T.throws(() => O.domain.shifts.cashEvent('IN', 1000, 'tambah kas'), 'FORBIDDEN');   // token gone
  tm.approve('1111', 'shift.operate');
  O.clock.advance(tm.APPROVAL_TTL + 1);
  T.throws(() => O.domain.shifts.cashEvent('IN', 1000, 'tambah kas'), 'FORBIDDEN');   // expired
});

test('team: owner cannot be reduced, team.write not overridable, non-owner cannot edit roles', (O, T) => {
  const tm = O.domain.team;
  T.throws(() => tm.setPerm('owner', 'pos.sell', 'deny'), 'OWNER_PROTECTED');
  T.throws(() => tm.setPerm('manager', 'team.write', 'allow'), 'VALIDATION');
  T.throws(() => tm.setPerm('manager', 'platform.read', 'allow'), 'VALIDATION');
  O.tx(d => { d.rolePerms.push({ tenant: 't1', role: 'owner', perm: 'pos.sell', mode: 'deny' }); });
  T.ok(O.can('pos.sell', 'owner'));
  T.throws(() => tm.saveStaff('s1', { name: 'Rina', role: 'cashier', outlets: ['o1'] }), 'OWNER_PROTECTED');
  T.as('manager');
  T.throws(() => tm.setPerm('cashier', 'pos.sell', 'deny'), 'FORBIDDEN');
  T.throws(() => tm.setPin('s3', '7777'), 'FORBIDDEN');
});

test('team: staff profile validation, outlets of own tenant, plan limit', (O, T) => {
  const tm = O.domain.team;
  T.throws(() => tm.saveStaff(null, { name: 'A', role: 'cashier', outlets: ['o1'] }), 'VALIDATION');
  T.throws(() => tm.saveStaff(null, { name: 'Ani', role: 'cashier', outlets: ['o1'], phone: '123' }), 'VALIDATION');
  T.throws(() => tm.saveStaff(null, { name: 'Ani', role: 'cashier', outlets: ['o3'] }), 'VALIDATION');
  T.throws(() => tm.saveStaff(null, { name: 'Ani', role: 'platform', outlets: ['o1'] }), 'VALIDATION');
  const s = tm.saveStaff(null, { name: 'Ani', role: 'cashier', outlets: ['o2'], phone: '0812-3456-7890', email: 'ani@x.id' });
  T.eq(s.phone, '081234567890');
  tm.saveStaff(s.id, { name: 'Ani S', role: 'manager', outlets: ['o1', 'o2'], active: false });
  const r = O.db().staff.find(x => x.id === s.id);
  T.eq([r.name, r.role, r.active, r.outlets], ['Ani S', 'manager', false, ['o1', 'o2']]);
});

test('team: PIN format, uniqueness per tenant, lockout after 5, owner reset', (O, T) => {
  const tm = O.domain.team;
  T.throws(() => tm.setPin('s3', '12'), 'VALIDATION');
  T.throws(() => tm.setPin('s3', '12ab'), 'VALIDATION');
  T.throws(() => tm.setPin('s3', '2222'), 'PIN_TAKEN');
  T.eq(tm.verifyPin('s3', '3333').id, 's3');
  T.ok(O.db().staff.find(x => x.id === 's3').pinHash.indexOf('3333') < 0);
  for (let i = 0; i < 4; i++) T.throws(() => tm.verifyPin('s3', '0000'), 'PIN_WRONG');
  T.throws(() => tm.verifyPin('s3', '0000'), 'PIN_LOCKED');
  T.throws(() => tm.verifyPin('s3', '3333'), 'PIN_LOCKED');   // correct PIN still locked
  tm.setPin('s3', '3434');
  T.eq(tm.verifyPin('s3', '3434').id, 's3');
});

test('team: clock-in by PIN, no double clock-in, outlet assignment, duration', (O, T) => {
  const tm = O.domain.team;
  T.as('cashier');
  T.throws(() => tm.clockIn('s3', '9999'), 'PIN_WRONG');
  const a = tm.clockIn('s3', '3333');
  T.eq(a.outlet, 'o1');
  T.throws(() => tm.clockIn('s3', '3333'), 'ALREADY_CLOCKED_IN');
  O.clock.advance(8 * 3600000);
  tm.clockOut('s3', '3333');
  const row = O.db().attendance[0];
  T.ok(tm.duration(row) === row.outAt - row.inAt && row.outAt - row.inAt >= 8 * 3600000);
  T.throws(() => tm.clockOut('s3', '3333'), 'NOT_CLOCKED_IN');
  O.tx(d => { d.session.outlet = 'o2'; });
  T.throws(() => tm.clockIn('s3', '3333'), 'OUTLET_NOT_ASSIGNED');
  T.eq(tm.attendance(O.db(), { staffId: 's3' }).length, 1);
});

test('team: blind close reports variance and Z-report by tender', (O, T) => {
  const tm = O.domain.team;
  T.as('cashier');
  T.ok(!O.can('shift.viewExpected'));
  O.domain.shifts.open(200000);
  O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 2 }], method: 'pickup', payment: { type: 'cash' } });
  O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k2', qty: 1 }], method: 'pickup', payment: { type: 'qris' } });
  O.domain.shifts.cashEvent('OUT', 10000, 'beli es batu');
  const counted = tm.countDenoms({ 100000: 2, 50000: 1, 1000: 6, coins: 0 });   // 256000
  T.eq(counted, 256000);
  T.throws(() => tm.countDenoms({ 50000: -1 }), 'VALIDATION');
  T.throws(() => tm.blindClose(counted, ''), 'REASON_REQUIRED');               // variance needs note (sales rule)
  const r = tm.blindClose(counted, 'kurang kembalian');
  const cash = r.tenders.cash;
  T.eq(r.expected, 200000 + cash - 10000);
  T.eq(r.variance, counted - r.expected);
  T.eq(r.tenders.qris > 0 && r.orders, 2);
  T.eq(r.cashOut, 10000);
  T.ok(O.db().shifts[0].closedAt);
});

test('team: other-tenant isolation for overrides, staff, reports', (O, T) => {
  const tm = O.domain.team;
  tm.setPerm('cashier', 'pos.sell', 'deny');
  T.as('owner', 't2');
  T.ok(O.can('pos.sell', 'cashier'));                       // t1 rule does not leak
  T.throws(() => tm.setPin('s3', '7777'), 'NOT_FOUND');
  T.throws(() => tm.verifyPin('s3', '3333'), 'NOT_FOUND');
  T.as('owner', 't1'); T.as('cashier'); O.domain.shifts.open(0);
  const id = O.db().shifts[0].id;
  T.as('owner', 't2');
  T.throws(() => tm.shiftReport(O.db(), id), 'NOT_FOUND');
});

test('team: demo adds 2 staff and ~2 weeks attendance', (O, T) => {
  O.demoHistory();
  const d = O.db();
  T.ok(d.staff.some(s => s.name === 'Putri' && s.role === 'cashier' && s.outlets[0] === 'o2'));
  T.ok(d.staff.some(s => s.name === 'Wawan' && s.role === 'dispatcher'));
  T.ok(d.attendance.length >= 40);
  T.eq(d.attendance.filter(a => !a.outAt).length >= 1, true);
});
