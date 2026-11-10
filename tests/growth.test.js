/* Growth tests: promos, members, storefront. */
function G(O) { return O.domain; }
function mkPromo(O, o) {
  return G(O).promos.create(Object.assign({ name: 'Tes', code: 'TES10', type: 'percent', value: 10, minPurchase: 0, maxDiscount: 0, quota: 5, start: '2000-01-01', end: '2999-12-31', status: 'ACTIVE' }, o || {}));
}
function quote(O, o) { return O.read(function (d) { return G(O).promos.quote(d, o); }); }
var PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('promo: happy quote percent, fixed, cap, never exceeds subtotal', function (O, T) {
  T.eq(quote(O, { code: 'awan10', subtotal: 100000, channel: 'pos' }).discount, 10000, 'seed 10%');
  T.eq(quote(O, { code: 'AWAN10', subtotal: 1000000 }).discount, 20000, 'cap 20000');
  mkPromo(O, { code: 'FIX50K', type: 'fixed', value: 50000 });
  T.eq(quote(O, { code: 'FIX50K', subtotal: 30000 }).discount, 30000, 'fixed capped at subtotal');
});
test('promo: expired window rejected', function (O, T) {
  T.throws(function () { mkPromo(O, { code: 'OLD', start: '2020-01-01', end: '2020-02-01' }); }, 'VALIDATION', 'cannot activate past promo');
  var old = mkPromo(O, { code: 'OLD', status: 'DRAFT', start: '2020-01-01', end: '2020-02-01' });
  T.throws(function () { G(O).promos.activate(old.id); }, 'VALIDATION');
  O.tx(function (d) { d.promos.find(function (p) { return p.id === old.id; }).status = 'ACTIVE'; });
  T.eq(G(O).promos.list(O.db()).find(function (p) { return p.id === old.id; }).effective, 'EXPIRED');
  T.throws(function () { quote(O, { code: 'OLD', subtotal: 100000 }); }, 'PROMO_INVALID');
  mkPromo(O, { code: 'FUTURE', start: '2999-01-01', end: '2999-02-01' });
  T.throws(function () { quote(O, { code: 'FUTURE', subtotal: 100000 }); }, 'PROMO_INVALID');
});
test('promo: draft and paused not applicable; activate works', function (O, T) {
  var p = mkPromo(O, { code: 'DRF', status: 'DRAFT' });
  T.throws(function () { quote(O, { code: 'DRF', subtotal: 100000 }); }, 'PROMO_INVALID');
  G(O).promos.activate(p.id);
  T.eq(quote(O, { code: 'DRF', subtotal: 100000 }).discount, 10000);
  G(O).promos.pause(p.id);
  T.throws(function () { quote(O, { code: 'DRF', subtotal: 100000 }); }, 'PROMO_INVALID');
});
test('promo: minPurchase and quota enforced', function (O, T) {
  T.throws(function () { quote(O, { code: 'AWAN10', subtotal: 49999 }); }, 'PROMO_INVALID');
  var p = mkPromo(O, { code: 'ONE', quota: 1 });
  O.tx(function (d) { G(O).promos.consume(d, p.id, 'ORD-1'); });
  T.throws(function () { quote(O, { code: 'ONE', subtotal: 100000 }); }, 'PROMO_INVALID', 'quota exhausted');
  T.throws(function () { O.tx(function (d) { G(O).promos.consume(d, p.id, 'ORD-2'); }); }, 'PROMO_INVALID', 'consume beyond quota');
});
test('promo: channel restriction', function (O, T) {
  mkPromo(O, { code: 'POSONLY', channels: ['pos'] });
  T.throws(function () { quote(O, { code: 'POSONLY', subtotal: 100000, channel: 'store' }); }, 'PROMO_INVALID');
});
test('promo: duplicate code (case-insensitive) and invalid format rejected', function (O, T) {
  T.throws(function () { mkPromo(O, { code: 'awan10' }); }, 'DUPLICATE_CODE');
  T.throws(function () { mkPromo(O, { code: 'ab' }); }, 'VALIDATION');
  T.throws(function () { mkPromo(O, { code: 'BAD CODE!' }); }, 'VALIDATION');
  T.throws(function () { mkPromo(O, { code: 'X'.repeat(25) }); }, 'VALIDATION');
  T.throws(function () { mkPromo(O, { code: 'PCT', value: 101 }); }, 'VALIDATION');
  T.throws(function () { mkPromo(O, { code: 'DT', start: '2026-05-02', end: '2026-05-01' }); }, 'VALIDATION');
  T.throws(function () { mkPromo(O, { code: 'FLT', type: 'fixed', value: 10.5 }); }, 'VALIDATION');
});
test('promo: same code allowed in another tenant', function (O, T) {
  T.as('owner', 't2');
  mkPromo(O, { code: 'AWAN10' });
  T.eq(O.mine(O.db(), 'promos').length, 1);
});
test('promo: consume twice same order = one use', function (O, T) {
  var p = mkPromo(O, { code: 'IDEM' });
  O.tx(function (d) { G(O).promos.consume(d, p.id, 'ORD-9'); });
  O.tx(function (d) { G(O).promos.consume(d, p.id, 'ORD-9'); });
  T.eq(O.db().promos.find(function (x) { return x.id === p.id; }).used, 1);
  T.eq(O.db().promoUse.length, 1);
});
test('promo: wrong role cannot write', function (O, T) {
  T.as('cashier');
  T.throws(function () { mkPromo(O, { code: 'NOPE' }); }, 'FORBIDDEN');
  T.throws(function () { G(O).promos.pause('pr1'); }, 'FORBIDDEN');
  T.as('brand');
  mkPromo(O, { code: 'BRAND1' });
});
test('promo: cross-tenant promo not usable or editable', function (O, T) {
  T.as('owner', 't2');
  T.throws(function () { quote(O, { code: 'AWAN10', subtotal: 100000 }); }, 'PROMO_INVALID');
  T.throws(function () { G(O).promos.pause('pr1'); }, 'NOT_FOUND');
});

test('member: consent required, phone validated and unique per tenant', function (O, T) {
  T.throws(function () { G(O).members.register({ name: 'Budi', phone: '081234567890', consent: false }); }, 'CONSENT_REQUIRED');
  T.throws(function () { G(O).members.register({ name: 'Budi', phone: '123', consent: true }); }, 'VALIDATION');
  G(O).members.register({ name: 'Budi', phone: '081234567890', consent: true });
  T.throws(function () { G(O).members.register({ name: 'Budi2', phone: '081234567890', consent: true }); }, 'DUPLICATE_PHONE');
  T.throws(function () { G(O).members.register({ name: 'Andi', phone: '081200001111', consent: true }); }, 'DUPLICATE_PHONE');
  T.as('owner', 't2');
  G(O).members.register({ name: 'Budi', phone: '081234567890', consent: true });
});
test('member: cross-tenant member invisible', function (O, T) {
  T.as('owner', 't2');
  T.eq(G(O).members.search(O.db(), '').length, 0);
  T.eq(G(O).members.get(O.db(), 'm1'), null);
  T.throws(function () { O.read(function (d) { return G(O).members.preview(d, { memberId: 'm1', subtotal: 1000 }); }); }, 'NOT_FOUND');
});
test('member: tier boundaries', function (O, T) {
  var m = G(O).members;
  T.eq(m.tier(0), 'Bronze'); T.eq(m.tier(999999), 'Bronze');
  T.eq(m.tier(1000000), 'Silver'); T.eq(m.tier(2999999), 'Silver');
  T.eq(m.tier(3000000), 'Gold');
});
test('member: preview earn/redeem and limits', function (O, T) {
  var m = G(O).members;
  var p = O.read(function (d) { return m.preview(d, { memberId: 'm1', subtotal: 100000, redeemPoints: 100 }); });
  T.eq(p.redeemValue, 10000); T.eq(p.earn, 9);
  T.throws(function () { O.read(function (d) { return m.preview(d, { memberId: 'm1', subtotal: 100000, redeemPoints: 121 }); }); }, 'POINTS_NEGATIVE', 'over balance');
  T.throws(function () { O.read(function (d) { return m.preview(d, { memberId: 'm1', subtotal: 10000, redeemPoints: 60 }); }); }, 'REDEEM_LIMIT', 'over 50%');
  T.throws(function () { O.read(function (d) { return m.preview(d, { memberId: 'm1', subtotal: 10000, redeemPoints: -1 }); }); }, 'VALIDATION');
});
test('member: commit idempotent per order, writes ledger, tier moves', function (O, T) {
  var m = G(O).members;
  function c() { return O.tx(function (d) { return m.commit(d, { memberId: 'm1', orderId: 'ORD-A', total: 1800000, redeemPoints: 20 }); }); }
  c(); c();
  var d = O.db(), mem = d.members.find(function (x) { return x.id === 'm1'; });
  T.eq(d.pointLedger.length, 2, 'one REDEEM + one EARN');
  T.eq(mem.points, 120 - 20 + 180);
  T.eq(mem.lifetime, 1250000 + 1800000);
  T.eq(m.tier(mem.lifetime), 'Gold');
});
test('member: commit refuses redeem over balance and rolls back', function (O, T) {
  T.throws(function () { O.tx(function (d) { G(O).members.commit(d, { memberId: 'm1', orderId: 'ORD-B', total: 500000, redeemPoints: 999 }); }); }, 'POINTS_NEGATIVE');
  T.eq(O.db().pointLedger.length, 0);
});
test('member: reverse proportional, idempotent by key, cannot exceed 100%', function (O, T) {
  var m = G(O).members;
  O.tx(function (d) { m.commit(d, { memberId: 'm1', orderId: 'ORD-C', total: 200000, redeemPoints: 40 }); });
  // points: 120 -40 +20 = 100
  O.tx(function (d) { m.reverse(d, 'ORD-C', 0.5, 'R1'); });
  O.tx(function (d) { m.reverse(d, 'ORD-C', 0.5, 'R1'); });  // replay no-op
  var mem = O.db().members.find(function (x) { return x.id === 'm1'; });
  T.eq(mem.points, 100 - 10 + 20, 'half earn removed, half redeem returned');
  T.throws(function () { O.tx(function (d) { m.reverse(d, 'ORD-C', 0.6, 'R2'); }); }, 'REVERSE_EXCEEDS');
  O.tx(function (d) { m.reverse(d, 'ORD-C', 0.5, 'R3'); });
  mem = O.db().members.find(function (x) { return x.id === 'm1'; });
  T.eq(mem.points, 120, 'fully restored');
  T.eq(mem.lifetime, 1250000, 'lifetime restored');
  T.throws(function () { O.tx(function (d) { m.reverse(d, 'ORD-C', 0.01, 'R4'); }); }, 'REVERSE_EXCEEDS');
  T.throws(function () { O.tx(function (d) { m.reverse(d, 'ORD-NONE', 1); }); }, 'NOT_FOUND');
  T.throws(function () { O.tx(function (d) { m.reverse(d, 'ORD-C', 1.5); }); }, 'VALIDATION');
});
test('member: points never go negative on reverse', function (O, T) {
  var m = G(O).members;
  O.tx(function (d) { m.commit(d, { memberId: 'm1', orderId: 'ORD-D', total: 1000000, redeemPoints: 0 }); }); // +100 => 220
  O.tx(function (d) { d.members.find(function (x) { return x.id === 'm1'; }).points = 5; });             // spent elsewhere
  O.tx(function (d) { m.reverse(d, 'ORD-D', 1, 'K'); });
  T.ok(O.db().members.find(function (x) { return x.id === 'm1'; }).points >= 0, 'never negative');
});
test('member: settings role-gated and applied', function (O, T) {
  T.as('cashier');
  T.throws(function () { G(O).members.saveSettings({ earnUnit: 5000, redeemValue: 100, maxPercent: 50 }); }, 'FORBIDDEN');
  T.as('manager');
  G(O).members.saveSettings({ earnUnit: 5000, redeemValue: 100, maxPercent: 50 });
  T.eq(O.read(function (d) { return G(O).members.preview(d, { memberId: 'm1', subtotal: 100000 }); }).earn, 20);
  T.throws(function () { G(O).members.saveSettings({ earnUnit: 5000, redeemValue: 100, maxPercent: 101 }); }, 'VALIDATION');
});
test('member: register role-gated', function (O, T) {
  T.as('dispatcher');
  T.throws(function () { G(O).members.register({ name: 'X Y', phone: '081234567890', consent: true }); }, 'FORBIDDEN');
});

test('storefront: draft invisible in publicView until publish; discard restores', function (O, T) {
  var s = G(O).storefront;
  var v0 = O.read(function (d) { return s.publicView(d, 't1'); });
  T.eq(v0.version, 1);
  s.saveDraft({ heroTitle: 'JUDUL BARU', sections: { flash: true } });
  var v1 = O.read(function (d) { return s.publicView(d, 't1'); });
  T.eq(v1.page.heroTitle, 'Kopi segar, diantar cepat', 'public still old');
  T.ok(!v1.page.sections.flash);
  T.ok(O.read(function (d) { return s.status(d); }).dirty);
  s.discardDraft();
  T.eq(O.db().storefront.t1.draft.heroTitle, 'Kopi segar, diantar cepat');
  s.saveDraft({ heroTitle: 'JUDUL BARU' });
  var r = s.publish();
  T.eq(r.version, 2);
  T.eq(O.read(function (d) { return s.publicView(d, 't1'); }).page.heroTitle, 'JUDUL BARU');
  T.throws(function () { s.publish(); }, 'NO_CHANGE');
});
test('storefront: validation (title, section, image type/size)', function (O, T) {
  var s = G(O).storefront;
  T.throws(function () { s.saveDraft({ title: 'x'.repeat(81) }); }, 'VALIDATION');
  T.throws(function () { s.saveDraft({ sections: { hacker: true } }); }, 'VALIDATION');
  T.throws(function () { s.saveDraft({ cost: 1 }); }, 'VALIDATION');
  T.throws(function () { s.saveDraft({ logo: 'data:image/svg+xml;base64,PHN2Zz4=' }); }, 'IMAGE_INVALID');
  T.throws(function () { s.saveDraft({ logo: 'https://evil.example/x.png' }); }, 'IMAGE_INVALID');
  T.throws(function () { s.saveDraft({ logo: 'data:image/png;base64,' + 'A'.repeat(1500000) }); }, 'IMAGE_TOO_LARGE');
  s.saveDraft({ logo: PNG });
  T.eq(O.db().storefront.t1.draft.logo, PNG);
  T.eq(O.read(function (d) { return s.publicView(d, 't1'); }).page.logo, undefined, 'unpublished logo hidden');
});
test('storefront: cashier cannot save/publish/discard', function (O, T) {
  var s = G(O).storefront;
  T.as('cashier');
  T.throws(function () { s.saveDraft({ title: 'x' }); }, 'FORBIDDEN');
  T.throws(function () { s.publish(); }, 'FORBIDDEN');
  T.throws(function () { s.discardDraft(); }, 'FORBIDDEN');
  T.as('brand');
  s.saveDraft({ title: 'ok' });
});
test('storefront: products only with stock at first active outlet, tenant-scoped', function (O, T) {
  var s = G(O).storefront;
  var n = O.read(function (d) { return s.publicView(d, 't1').products.length; });
  T.eq(n, 8);
  O.tx(function (d) { O.domain.inventory.move(d, { skuId: 'k1', qty: -40, type: 'SALE', ref: 'X1' }); });
  var v = O.read(function (d) { return s.publicView(d, 't1'); });
  T.eq(v.products.length, 7, 'sold-out hidden');
  T.ok(v.products.every(function (p) { return p.skuId !== 'k1' && p.cost === undefined; }));
  O.tx(function (d) { d.products.find(function (p) { return p.id === 'p2'; }).published = false; });
  T.eq(O.read(function (d) { return s.publicView(d, 't1').products.length; }), 6, 'unpublished product hidden');
  T.ok(O.read(function (d) { return s.publicView(d, 't2').products.every(function (p) { return /^k(9|1[0-2])$/.test(p.skuId); }); }));
});
test('storefront: tenant isolation on edit', function (O, T) {
  var s = G(O).storefront;
  T.as('owner', 't2');
  s.saveDraft({ title: 'Freshmart!' });
  T.eq(O.db().storefront.t1.draft.title, undefined, 't1 untouched');
});
test('track: needs order id AND phone last 4; generic error', function (O, T) {
  O.tx(function (d) {
    d.orders.push({ id: 'ORD-0001', tenant: 't1', customer: { name: 'A', phone: '081200001111' }, items: [{ name: 'Kopi', qty: 1 }], total: 28000, status: 'PLACED', paymentStatus: 'PENDING', method: 'pickup', history: [{ at: 1, by: 'x', from: null, to: 'PLACED' }] });
  });
  var s = G(O).storefront;
  var r = O.read(function (d) { return s.track(d, 'ORD-0001', '1111'); });
  T.eq(r.history.length, 1);
  T.eq(O.read(function (d) { return s.track(d, 'ORD-0001', '0812 0000 1111'); }).id, 'ORD-0001');
  T.throws(function () { O.read(function (d) { return s.track(d, 'ORD-0001', '9999'); }); }, 'NOT_FOUND');
  T.throws(function () { O.read(function (d) { return s.track(d, 'ORD-0001', ''); }); }, 'NOT_FOUND');
  T.throws(function () { O.read(function (d) { return s.track(d, 'ORD-0001'); }); }, 'NOT_FOUND', 'id alone rejected');
  T.throws(function () { O.read(function (d) { return s.track(d, 'ORD-9999', '1111'); }); }, 'NOT_FOUND');
});
