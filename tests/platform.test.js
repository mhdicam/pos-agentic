/* Platform domain tests: maker/checker, grants, billing, offline fleet. */
function pReq(O, T, action, o) {
  T.as('platform'); var P = O.domain.platform;
  O.tx(function (d) { d.platform.actor = 'admin_ops'; });
  return P.request(action, o);
}
function cashItem(id, skuId, qty) {
  return { clientEventId: id, payload: { items: [{ skuId: skuId, qty: qty }], payment: { type: 'cash' } } };
}
/* Own handler: really moves stock through inventory, so effects are observable. */
function useHandler(O) {
  O.domain.fleet.applyHandler = function (d, item) {
    var m = null;
    item.payload.items.forEach(function (i) {
      m = O.domain.inventory.move(d, { skuId: i.skuId, qty: -i.qty, type: 'SALE', ref: item.clientEventId });
    });
    return { ref: 'ORD-' + item.clientEventId };
  };
}

test('support cannot approve or reject; platform can with a different actor', function (O, T) {
  var P = O.domain.platform;
  var r = pReq(O, T, 'TENANT_STATUS', { tenantId: 't2', status: 'ACTIVE', reason: 'trial selesai' });
  T.eq(r.status, 'PENDING'); T.eq(r.maker, 'admin_ops');
  T.as('support');
  T.throws(function () { P.approve(r.id); }, 'FORBIDDEN');
  T.throws(function () { P.reject(r.id); }, 'FORBIDDEN');
  T.as('platform'); P.setActor('admin_sec');
  P.approve(r.id);
  T.eq(O.db().tenants.filter(function (t) { return t.id === 't2'; })[0].status, 'ACTIVE');
});

test('support can create a request (maker) but not change tenant status directly', function (O, T) {
  var P = O.domain.platform;
  T.as('support');
  var r = P.request('SUPPORT_GRANT', { tenantId: 't1', minutes: 30, reason: 'investigasi tiket' });
  T.eq(r.status, 'PENDING');
  T.as('owner');
  T.throws(function () { P.request('TENANT_STATUS', { tenantId: 't1', status: 'SUSPENDED', reason: 'coba coba' }); }, 'FORBIDDEN');
});

test('self-approval blocked', function (O, T) {
  var P = O.domain.platform;
  var r = pReq(O, T, 'TENANT_STATUS', { tenantId: 't1', status: 'SUSPENDED', reason: 'tunggakan 3 bulan' });
  T.throws(function () { P.approve(r.id); }, 'SELF_APPROVAL');
  T.throws(function () { P.reject(r.id); }, 'SELF_APPROVAL');
  T.eq(O.db().tenants[0].status, 'ACTIVE', 'status unchanged');
});

test('decided request is immutable (double decision)', function (O, T) {
  var P = O.domain.platform;
  var r = pReq(O, T, 'TENANT_STATUS', { tenantId: 't2', status: 'SUSPENDED', reason: 'abuse laporan' });
  P.setActor('admin_sec'); P.reject(r.id, 'tidak cukup bukti');
  T.throws(function () { P.approve(r.id); }, 'ALREADY_DECIDED');
  T.throws(function () { P.reject(r.id); }, 'ALREADY_DECIDED');
  T.eq(O.db().tenants[1].status, 'TRIALING', 'rejected request changes nothing');
});

test('request validation: reason, tenant, status, no-op', function (O, T) {
  var P = O.domain.platform;
  T.as('platform');
  T.throws(function () { P.request('TENANT_STATUS', { tenantId: 't1', status: 'SUSPENDED', reason: 'abc' }); }, 'REASON_REQUIRED');
  T.throws(function () { P.request('TENANT_STATUS', { tenantId: 'zz', status: 'SUSPENDED', reason: 'alasan valid' }); }, 'NOT_FOUND');
  T.throws(function () { P.request('TENANT_STATUS', { tenantId: 't1', status: 'BOGUS', reason: 'alasan valid' }); }, 'VALIDATION');
  T.throws(function () { P.request('TENANT_STATUS', { tenantId: 't1', status: 'ACTIVE', reason: 'alasan valid' }); }, 'NO_CHANGE');
});

test('suspend with open shift writes warning but is allowed', function (O, T) {
  var P = O.domain.platform;
  O.tx(function (d) { d.shifts.push({ id: 'SH-1', tenant: 't1', outlet: 'o1', closedAt: null }); d.orders.push({ id: 'O-1', tenant: 't1', status: 'READY' }); });
  var r = pReq(O, T, 'TENANT_STATUS', { tenantId: 't1', status: 'SUSPENDED', reason: 'pelanggaran ToS' });
  P.setActor('admin_sec');
  var out = P.approve(r.id);
  T.eq(O.db().tenants[0].status, 'SUSPENDED');
  T.eq(out.result.warnings.length, 2);
});

test('grant minutes bounds 15..240', function (O, T) {
  var P = O.domain.platform;
  T.as('support');
  [14, 241, 0, -5].forEach(function (m) {
    T.throws(function () { P.request('SUPPORT_GRANT', { tenantId: 't1', minutes: m, reason: 'investigasi' }); }, 'GRANT_MINUTES');
  });
  T.throws(function () { P.request('SUPPORT_GRANT', { tenantId: 't1', minutes: 30.5, reason: 'investigasi' }); }, 'VALIDATION');
  P.request('SUPPORT_GRANT', { tenantId: 't1', minutes: 15, reason: 'investigasi' });
  P.request('SUPPORT_GRANT', { tenantId: 't1', minutes: 240, reason: 'investigasi' });
  T.eq(O.db().platform.requests.length, 2);
});

function grantFlow(O, T, minutes) {
  var P = O.domain.platform;
  T.as('support'); O.tx(function (d) { d.platform.actor = 'admin_ops'; });
  var r = P.request('SUPPORT_GRANT', { tenantId: 't1', minutes: minutes, reason: 'investigasi tiket 42' });
  T.as('platform'); P.setActor('admin_sec'); var out = P.approve(r.id);
  T.as('support');
  return out.result.grantId;
}

test('support reads tenant detail only with active grant; reads are audited', function (O, T) {
  var P = O.domain.platform;
  T.as('support');
  T.throws(function () { P.openTenant('t1'); }, 'NO_ACTIVE_GRANT');
  var before = O.db().audit.length;
  grantFlow(O, T, 30);
  var v = P.openTenant('t1');
  T.eq(v.tenant.id, 't1');
  var reads = O.db().audit.filter(function (a) { return a.action === 'platform.tenant360.read'; });
  T.eq(reads.length, 1, 'read audited');
  P.openTenant('t1');
  T.eq(O.db().audit.filter(function (a) { return a.action === 'platform.tenant360.read'; }).length, 2);
  T.throws(function () { P.openTenant('t2'); }, 'NO_ACTIVE_GRANT');   // grant is per tenant
});

test('grant expiry enforced via clock', function (O, T) {
  var P = O.domain.platform;
  grantFlow(O, T, 15);
  T.ok(P.isActive(O.db(), 't1'));
  O.clock.advance(14 * 60000); T.ok(P.isActive(O.db(), 't1'), 'still active at 14m');
  P.openTenant('t1');
  O.clock.advance(2 * 60000);
  T.ok(!P.isActive(O.db(), 't1'), 'expired');
  T.throws(function () { P.openTenant('t1'); }, 'NO_ACTIVE_GRANT');
  T.throws(function () { O.read(function (d) { return P.tenant360(d, 't1'); }); }, 'NO_ACTIVE_GRANT');
});

test('revoked grant blocks support read; double revoke rejected; support cannot revoke', function (O, T) {
  var P = O.domain.platform;
  var gid = grantFlow(O, T, 60);
  P.openTenant('t1');
  T.throws(function () { P.revokeGrant(gid, 'selesai lebih awal'); }, 'FORBIDDEN');
  T.as('platform'); P.revokeGrant(gid, 'selesai lebih awal');
  T.throws(function () { P.revokeGrant(gid, 'sekali lagi'); }, 'ALREADY_REVOKED');
  T.as('support');
  T.throws(function () { P.openTenant('t1'); }, 'NO_ACTIVE_GRANT');
});

test('tenant roles cannot read platform data', function (O, T) {
  var P = O.domain.platform;
  ['owner', 'cashier', 'finance'].forEach(function (r) {
    T.as(r);
    T.throws(function () { P.tenant360(O.db(), 't1'); }, 'FORBIDDEN');
    T.throws(function () { P.auditQuery(O.db(), {}); }, 'FORBIDDEN');
    T.throws(function () { P.dashboard(O.db()); }, 'FORBIDDEN');
  });
});

test('non-platform roles cannot change plan, status, flags, invoices', function (O, T) {
  var P = O.domain.platform;
  ['owner', 'support', 'cashier'].forEach(function (r) {
    T.as(r);
    T.throws(function () { P.changePlan('t1', 'scale'); }, 'FORBIDDEN');
    T.throws(function () { P.toggleFlag('ff1'); }, 'FORBIDDEN');
    T.throws(function () { P.createInvoice('t1', 1000); }, 'FORBIDDEN');
    T.throws(function () { P.markPaid('INV-002'); }, 'FORBIDDEN');
    T.throws(function () { P.setEntitlement('t1', 'module', 'ai', false, 'alasan valid'); }, 'FORBIDDEN');
  });
  T.eq(O.db().tenants[0].plan, 'growth');
  T.as('owner');
  T.throws(function () { P.request('TENANT_STATUS', { tenantId: 't2', status: 'SUSPENDED', reason: 'alasan valid' }); }, 'FORBIDDEN');
});

test('upgrade works; downgrade blocked with reasons and nothing deleted', function (O, T) {
  var P = O.domain.platform;
  T.as('platform');
  T.eq(P.changePlan('t1', 'scale').to, 'scale');
  var outletsBefore = O.db().outlets.length, staffBefore = O.db().staff.length;
  var err = null;
  try { P.changePlan('t1', 'starter'); } catch (e) { err = e; }
  T.ok(err && err.code === 'DOWNGRADE_BLOCKED', 'blocked');
  T.eq(err.blockers.map(function (b) { return b.limit; }), ['outlets']);
  T.eq(O.db().tenants[0].plan, 'scale', 'plan unchanged');
  T.eq(O.db().outlets.length, outletsBefore); T.eq(O.db().staff.length, staffBefore);
  T.throws(function () { P.changePlan('t1', 'scale'); }, 'NO_CHANGE');
  T.throws(function () { P.changePlan('t1', 'nope'); }, 'NOT_FOUND');
});

test('downgrade reports both exceeded limits', function (O, T) {
  var P = O.domain.platform;
  T.as('platform');
  var chk = O.read(function (d) { return P.planCheck(d, 't1', 'starter'); });
  T.ok(!chk.ok);
  T.eq(chk.blockers.map(function (b) { return b.limit + ':' + b.current + '>' + b.max; }), ['outlets:2>1']);
  O.tx(function (d) { for (var i = 0; i < 3; i++) d.staff.push({ id: 'sx' + i, tenant: 't1', name: 'X', role: 'cashier', active: true }); });
  chk = O.read(function (d) { return P.planCheck(d, 't1', 'starter'); });
  T.eq(chk.blockers.map(function (b) { return b.limit; }), ['outlets', 'staff']);
  T.ok(O.read(function (d) { return P.planCheck(d, 't2', 'starter'); }).ok, 'tenant within limits ok');
});

test('invoice: integer amount, markPaid idempotent', function (O, T) {
  var P = O.domain.platform;
  T.as('platform');
  T.throws(function () { P.createInvoice('t1', 100.5); }, 'VALIDATION');
  T.throws(function () { P.createInvoice('t1', 0); }, 'VALIDATION');
  T.throws(function () { P.createInvoice('zz', 1000); }, 'NOT_FOUND');
  var inv = P.createInvoice('t1', 399000);
  T.eq(inv.status, 'UNPAID');
  P.markPaid(inv.id);
  var n = O.db().audit.length;
  var again = P.markPaid(inv.id);
  T.eq(again.status, 'PAID'); T.eq(O.db().audit.length, n, 'second markPaid writes nothing');
  T.throws(function () { P.markPaid('INV-999'); }, 'NOT_FOUND');
});

test('entitlement overrides need reason, validate, and audit', function (O, T) {
  var P = O.domain.platform;
  T.as('platform');
  T.throws(function () { P.setEntitlement('t1', 'module', 'ai', false, 'x'); }, 'REASON_REQUIRED');
  T.throws(function () { P.setEntitlement('t1', 'quota', 'staff', -1, 'alasan valid'); }, 'VALIDATION');
  T.throws(function () { P.setEntitlement('t1', 'quota', 'staff', 2.5, 'alasan valid'); }, 'VALIDATION');
  T.throws(function () { P.setEntitlement('t1', 'module', 'ghost', true, 'alasan valid'); }, 'VALIDATION');
  P.setEntitlement('t1', 'module', 'ai', false, 'permintaan tenant');
  P.setEntitlement('t1', 'quota', 'staff', 30, 'kesepakatan khusus');
  var e = P.entitlements(O.db(), 't1');
  T.eq(e.modules.ai, false); T.eq(e.quotas.staff, 30); T.eq(e.quotas.outlets, 3);
  T.ok(O.db().audit.some(function (a) { return a.action === 'platform.entitlement.set'; }));
});

test('MRR counts only ACTIVE tenants (trial = 0, suspended = 0)', function (O, T) {
  var P = O.domain.platform;
  T.eq(P.mrr(O.db()), 399000, 't1 growth active, t2 trialing');
  T.as('platform');
  var r = P.request('TENANT_STATUS', { tenantId: 't2', status: 'ACTIVE', reason: 'trial lunas' });
  P.setActor('admin_sec'); P.approve(r.id);
  T.eq(P.mrr(O.db()), 399000 + 149000);
  P.setActor('admin_ops');
  r = P.request('TENANT_STATUS', { tenantId: 't1', status: 'SUSPENDED', reason: 'tunggakan' });
  P.setActor('admin_sec'); P.approve(r.id);
  T.eq(P.mrr(O.db()), 149000);
});

test('platform audit invisible to tenant roles, filterable for platform', function (O, T) {
  var P = O.domain.platform;
  T.as('platform'); P.toggleFlag('ff1');
  T.as('owner', 't1');
  O.tx(function () {}, { audit: { action: 'x.test', entity: 'x', entityId: '1' } });
  T.throws(function () { P.auditQuery(O.db(), {}); }, 'FORBIDDEN');
  T.as('support');
  T.ok(P.auditQuery(O.db(), {}).length >= 2);
  T.eq(P.auditQuery(O.db(), { action: 'platform.flag' }).length, 1);
  T.eq(P.auditQuery(O.db(), { tenant: 'zzz' }).length, 0);
});

test('flag toggle and announcement draft', function (O, T) {
  var P = O.domain.platform;
  T.as('platform');
  var on = O.db().platform.flags[0].on;
  P.toggleFlag('ff1'); T.eq(O.db().platform.flags[0].on, !on);
  T.throws(function () { P.toggleFlag('nope'); }, 'NOT_FOUND');
  T.throws(function () { P.saveAnnouncement({ title: '', body: '' }); }, 'VALIDATION');
  T.eq(P.saveAnnouncement({ title: 'Maintenance', body: 'Minggu malam 22.00' }).status, 'DRAFT');
});

/* ---------------- fleet ---------------- */

test('fleet: provision bounds; enqueue cash ok', function (O, T) {
  var F = O.domain.fleet;
  T.as('platform', 't1');
  T.throws(function () { F.provision('Kasir 2', 'o1', 0); }, 'GRANT_TTL');
  T.throws(function () { F.provision('Kasir 2', 'o1', 73); }, 'GRANT_TTL');
  T.throws(function () { F.provision('Kasir 2', 'o3', 24); }, 'NOT_FOUND', 'other tenant outlet');
  var dev = F.provision('Kasir 2', 'o1', 24);
  var it = F.enqueue(dev.id, cashItem('ev1', 'k1', 1));
  T.eq(it.status, 'PENDING_SYNC');
  T.eq(F.stats(O.db(), dev.id).pending, 1);
  T.ok(!('pending' in O.db().devices.filter(function (x) { return x.id === dev.id; })[0]), 'counts not stored');
});

test('fleet: non-cash payload rejected offline', function (O, T) {
  var F = O.domain.fleet;
  T.as('cashier', 't1');
  ['qris', 'transfer', 'cod'].forEach(function (t) {
    T.throws(function () { F.enqueue('DEV-001', { clientEventId: 'e-' + t, payload: { items: [], payment: { type: t } } }); }, 'OFFLINE_CASH_ONLY');
  });
  T.throws(function () { F.enqueue('DEV-001', { clientEventId: 'e-np', payload: { items: [] } }); }, 'OFFLINE_CASH_ONLY');
  T.eq(O.db().outbox.length, 0);
});

test('fleet: expired device grant rejects enqueue', function (O, T) {
  var F = O.domain.fleet;
  T.as('platform', 't1');
  var dev = F.provision('Kasir 3', 'o1', 1);
  F.enqueue(dev.id, cashItem('a', 'k1', 1));
  O.clock.advance(61 * 60000);
  T.throws(function () { F.enqueue(dev.id, cashItem('b', 'k1', 1)); }, 'GRANT_EXPIRED');
  T.eq(F.stats(O.db(), dev.id).pending, 1, 'earlier item still there');
});

test('fleet: duplicate clientEventId is idempotent; same id on other device is separate', function (O, T) {
  var F = O.domain.fleet;
  T.as('platform', 't1');
  var dev2 = F.provision('Kasir 2', 'o1', 24);
  var a = F.enqueue('DEV-001', cashItem('dup', 'k1', 1));
  var b = F.enqueue('DEV-001', cashItem('dup', 'k1', 5));
  T.eq(a.id, b.id); T.eq(O.db().outbox.length, 1);
  F.enqueue(dev2.id, cashItem('dup', 'k1', 1));
  T.eq(O.db().outbox.length, 2);
});

test('fleet: sync applies once; running twice does not duplicate effects', function (O, T) {
  var F = O.domain.fleet, inv = O.domain.inventory;
  useHandler(O);
  T.as('manager', 't1');
  F.enqueue('DEV-001', cashItem('s1', 'k1', 3));
  var r1 = F.sync('DEV-001');
  T.eq(r1.synced, 1);
  T.eq(inv.onHand(O.db(), 'k1', 'o1'), 37);
  var r2 = F.sync('DEV-001');
  T.eq(r2.synced, 0); T.eq(inv.onHand(O.db(), 'k1', 'o1'), 37, 'no second deduction');
  var it = O.db().outbox[0];
  T.eq(it.status, 'SYNCED'); T.eq(it.serverRef, 'ORD-s1');
});

test('fleet: conflict does not block later items; failed effects rolled back', function (O, T) {
  var F = O.domain.fleet, inv = O.domain.inventory;
  useHandler(O);
  T.as('manager', 't1');
  F.enqueue('DEV-001', cashItem('c1', 'k1', 1));
  F.enqueue('DEV-001', cashItem('c2', 'k2', 999));  // insufficient
  F.enqueue('DEV-001', cashItem('c3', 'k3', 2));
  var r = F.sync('DEV-001');
  T.eq(r.synced, 2); T.eq(r.conflicts, 1);
  var by = {}; O.db().outbox.forEach(function (x) { by[x.clientEventId] = x; });
  T.eq(by.c1.status, 'SYNCED'); T.eq(by.c2.status, 'CONFLICT'); T.eq(by.c3.status, 'SYNCED');
  T.ok(/tidak cukup/.test(by.c2.reason), 'reason recorded');
  T.eq(inv.onHand(O.db(), 'k2', 'o1'), 40, 'no partial effect');
  var st = F.stats(O.db(), 'DEV-001'); T.eq(st.conflicts, 1); T.eq(st.pending, 0);
  F.sync('DEV-001'); T.eq(O.db().outbox.filter(function (x) { return x.status === 'CONFLICT'; }).length, 1, 'conflict not retried implicitly');
});

test('fleet: resolve RETRY re-queues; DISCARD keeps row and audit', function (O, T) {
  var F = O.domain.fleet, inv = O.domain.inventory;
  useHandler(O);
  T.as('manager', 't1');
  F.enqueue('DEV-001', cashItem('r1', 'k2', 999));
  F.enqueue('DEV-001', cashItem('r2', 'k2', 999));
  F.sync('DEV-001');
  var ids = O.db().outbox.map(function (x) { return x.id; });
  T.throws(function () { F.resolve(ids[0], 'RETRY', 'x'); }, 'REASON_REQUIRED');
  T.throws(function () { F.resolve(ids[0], 'MAYBE', 'alasan valid'); }, 'VALIDATION');
  T.as('cashier', 't1');
  T.throws(function () { F.resolve(ids[0], 'DISCARD', 'alasan valid'); }, 'FORBIDDEN');
  T.as('manager', 't1');
  F.resolve(ids[0], 'DISCARD', 'barang rusak, transaksi dibatalkan');
  var it = O.db().outbox[0];
  T.eq(it.status, 'DISCARDED'); T.ok(it.payload && it.payload.items.length === 1, 'payload retained');
  T.ok(O.db().audit.some(function (a) { return a.action === 'fleet.resolve.DISCARD' && a.entityId === ids[0]; }), 'audit written');
  T.throws(function () { F.resolve(ids[0], 'RETRY', 'alasan valid'); }, 'NOT_CONFLICT');
  // restock then retry second
  T.as('owner', 't1'); inv.adjust('k2', 1000, 'restock sebelum retry');
  T.as('manager', 't1');
  F.resolve(ids[1], 'RETRY', 'stok sudah ditambah');
  T.eq(O.db().outbox[1].status, 'PENDING_SYNC');
  F.sync('DEV-001');
  T.eq(O.db().outbox[1].status, 'SYNCED');
  T.eq(inv.onHand(O.db(), 'k2', 'o1'), 1000 - 999);
});

test('fleet: revoke by platform only; pending kept; enqueue and sync refused', function (O, T) {
  var F = O.domain.fleet;
  useHandler(O);
  T.as('manager', 't1');
  F.enqueue('DEV-001', cashItem('v1', 'k1', 1));
  T.throws(function () { F.revoke('DEV-001'); }, 'FORBIDDEN');
  T.as('platform', 't1'); F.revoke('DEV-001');
  T.eq(O.db().devices[0].status, 'REVOKED');
  T.eq(O.db().outbox.length, 1, 'pending item kept');
  T.eq(F.stats(O.db(), 'DEV-001').pending, 1);
  T.throws(function () { F.enqueue('DEV-001', cashItem('v2', 'k1', 1)); }, 'DEVICE_REVOKED');
  T.throws(function () { F.sync('DEV-001'); }, 'DEVICE_REVOKED');
  T.eq(F.recover('DEV-001', 'audit disetujui keamanan').synced, 1, 'platform recovery drains queue');
  T.throws(function () { F.recover('DEV-001', 'x'); }, 'REASON_REQUIRED');
});

test('fleet: devices are tenant scoped', function (O, T) {
  var F = O.domain.fleet;
  T.as('manager', 't2');
  T.throws(function () { F.enqueue('DEV-001', cashItem('x', 'k9', 1)); }, 'NOT_FOUND');
  T.eq(F.devices(O.db()).length, 0);
});

test('fleet: default handler without orders module records ACCEPTED_STUB', function (O, T) {
  var F = O.domain.fleet, saved = O.domain.orders;
  delete O.domain.orders; F.applyHandler = F.defaultHandler;
  try {
    T.as('manager', 't1');
    F.enqueue('DEV-001', cashItem('st1', 'k1', 1));
    var r = F.sync('DEV-001');
    T.eq(r.stub, 1);
    T.eq(O.db().outbox[0].status, 'ACCEPTED_STUB');
    T.eq(F.sync('DEV-001').stub, 0, 'not replayed');
  } finally { if (saved) O.domain.orders = saved; }
});

test('fleet: offline enqueue rejects loyalty redemption and promo codes (RD03-12)', function (O, T) {
  var F = O.domain.fleet;
  T.as('owner');
  T.throws(function () { F.enqueue('DEV-001', { clientEventId: 'e-pts', payload: { items: [], payment: { type: 'cash' }, redeemPoints: 50 } }); }, 'OFFLINE_ONLINE_ONLY');
  T.throws(function () { F.enqueue('DEV-001', { clientEventId: 'e-promo', payload: { items: [], payment: { type: 'cash' }, promoCode: 'AWAN10' } }); }, 'OFFLINE_ONLINE_ONLY');
  T.eq(O.db().outbox.length, 0, 'nothing queued');
});

test('fleet: sync as platform admin replays under the device register identity (QA D3)', function (O, T) {
  var F = O.domain.fleet;
  T.as('owner');
  O.domain.orders && O.domain.orders.shifts;
  O.tx(function (d) { d.shifts.push({ id: 'SHF-T', tenant: 't1', outlet: 'o1', register: 't1|o1', openedBy: 'x', openedAt: O.clock.now(), openingCash: 0, closedAt: null }); });
  F.enqueue('DEV-001', { clientEventId: 'e-d3', payload: { items: [{ skuId: 'k1', qty: 1 }], method: 'pickup', customer: { name: 'Walk-in' }, payment: { type: 'cash' } } });
  T.as('platform', 't1');
  F.sync('DEV-001');
  var it = O.db().outbox.filter(function (x) { return x.clientEventId === 'e-d3'; })[0];
  T.eq(it.status, 'SYNCED', 'synced, not conflict: ' + it.reason);
  T.eq(O.db().orders.length, 1);
  T.eq(O.db().session.role, 'platform', 'session role restored after replay');
});
