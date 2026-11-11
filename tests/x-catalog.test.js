/* RD-12 tenant catalog: categories, variants archive, modifier groups, per-outlet price/availability. */
// tenant.test.js deletes O.hooks.skuPrice after its own stub, so re-install ours per test
function XC(O) { O.hooks.skuPrice = O.domain.catalog.skuPrice; O.hooks.resolveModifiers = O.domain.catalog.resolveModifiers; return O.domain.catalog; }
function grp(O, name) { return XC(O).modifierGroups(O.db()).filter(function (g) { return g.name === name; })[0]; }
function opt(O, g, o) { return grp(O, g).options.filter(function (x) { return x.name === o; })[0].id; }
function q(O, items) { XC(O); return O.domain.orders.quote(O.db(), { channel: 'pos', items: items }); }

test('x-catalog: categories CRUD, rename propagates, reorder, archive', function (O, T) {
  var C = XC(O);
  T.eq(C.categories(O.db()).map(function (c) { return c.name; }), ['Minuman', 'Roti', 'Retail']);
  var a = O.db().audit.length;
  var c = C.createCategory('Snack');
  T.eq(O.db().audit.length, a + 1); T.eq(O.db().audit[a].action, 'catalog.category.create');
  var roti = C.categories(O.db()).filter(function (x) { return x.name === 'Roti'; })[0];
  C.renameCategory(roti.id, 'Bakery');
  T.ok(O.db().products.filter(function (p) { return p.id === 'p4'; })[0].category === 'Bakery', 'product category renamed');
  C.moveCategory(c.id, -1);
  T.eq(C.categories(O.db()).map(function (x) { return x.name; }), ['Minuman', 'Bakery', 'Snack', 'Retail']);
  T.throws(function () { C.moveCategory(C.categories(O.db())[0].id, -1); }, 'NO_CHANGE');
  C.archiveCategory(c.id, true);
  T.ok(!C.categories(O.db()).some(function (x) { return x.id === c.id; }) && C.categories(O.db(), true).some(function (x) { return x.id === c.id; }));
});

test('x-catalog: category duplicate name rejected', function (O, T) {
  T.throws(function () { XC(O).createCategory(' minuman '); }, 'DUPLICATE');
  T.throws(function () { XC(O).createCategory(''); }, 'VALIDATION');
});

test('x-catalog: archive variant blocks sale, last active variant protected', function (O, T) {
  var C = XC(O);
  T.throws(function () { C.archiveSku('k2', true); }, 'LAST_VARIANT');
  C.updateProduct('p2', { name: 'Americano', category: 'Minuman', skus: [{ id: 'k2', sku: 'KA-101', label: 'Regular', price: 24000, cost: 6500, barcode: '8991001' }, { sku: 'KA-101L', label: 'Large', price: 29000, cost: 8000, stock: 5 }] });
  var large = O.mine(O.db(), 'skus').filter(function (s) { return s.sku === 'KA-101L'; })[0];
  T.eq(q(O, [{ skuId: large.id, qty: 1 }]).subtotal, 29000);
  C.archiveSku(large.id, true);
  T.throws(function () { q(O, [{ skuId: large.id, qty: 1 }]); }, 'NOT_FOUND');
  T.eq(q(O, [{ skuId: 'k2', qty: 1 }]).subtotal, 24000, 'other variant still sells');
  C.archiveSku(large.id, false);
  T.eq(q(O, [{ skuId: large.id, qty: 1 }]).subtotal, 29000);
});

test('x-catalog: archive product unpublishes and blocks sale; unarchive restores', function (O, T) {
  var p = XC(O).archiveProduct('p4', true);
  T.ok(p.archived && !p.published);
  T.throws(function () { q(O, [{ skuId: 'k4', qty: 1 }]); }, 'NOT_FOUND');
  XC(O).archiveProduct('p4', false);
  T.eq(q(O, [{ skuId: 'k4', qty: 1 }]).subtotal, 26000);
});

test('x-catalog: modifier group validation', function (O, T) {
  var C = XC(O);
  T.throws(function () { C.saveModifierGroup({ name: 'X', options: [] }); }, 'VALIDATION');
  T.throws(function () { C.saveModifierGroup({ name: 'X', min: 2, max: 1, options: [{ name: 'a', price: 0 }, { name: 'b', price: 0 }] }); }, 'VALIDATION');
  T.throws(function () { C.saveModifierGroup({ name: 'X', max: 3, options: [{ name: 'a', price: 0 }] }); }, 'VALIDATION');
  T.throws(function () { C.saveModifierGroup({ name: 'X', options: [{ name: 'a', price: 1.5 }] }); }, 'VALIDATION');
  T.throws(function () { C.saveModifierGroup({ name: 'X', options: [{ name: 'a', price: 0 }, { name: 'A', price: 0 }] }); }, 'VALIDATION');
  var g = C.saveModifierGroup({ name: 'Saus', required: true, max: 1, options: [{ name: 'Sambal', price: '0' }, { name: 'Keju', price: 3000 }] });
  T.eq([g.min, g.max, g.options[1].price], [1, 1, 3000]);
  var keep = g.options[0].id;
  g = C.saveModifierGroup({ id: g.id, name: 'Saus', required: false, max: 2, options: [{ name: 'Sambal', price: 0 }, { name: 'Mayo', price: 2000 }] });
  T.eq(g.options[0].id, keep, 'option id stable across edit');
});

test('x-catalog: resolveModifiers prices options into the quote', function (O, T) {
  var ids = [opt(O, 'Suhu', 'Iced'), opt(O, 'Gula', 'Less sugar'), opt(O, 'Topping', 'Extra shot'), opt(O, 'Topping', 'Boba')];
  var r = q(O, [{ skuId: 'k1', qty: 2, modifiers: ids, note: 'Es sedikit' }]);
  var l = r.items[0];
  T.eq([l.basePrice, l.price, r.subtotal], [28000, 39000, 78000]);
  T.eq(l.modifiers.map(function (m) { return m.name; }), ['Iced', 'Less sugar', 'Extra shot', 'Boba']);
  T.eq(l.note, 'Es sedikit');
  var o = O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 1, modifiers: ids }], method: 'pickup', payment: { type: 'qris' } });
  T.eq(o.items[0].price, 39000);
});

test('x-catalog: modifier picks rejected (foreign, required missing, over max, duplicate)', function (O, T) {
  var hot = opt(O, 'Suhu', 'Hot'), normal = opt(O, 'Gula', 'Normal');
  var tops = ['Extra shot', 'Oat milk', 'Boba'].map(function (n) { return opt(O, 'Topping', n); });
  T.throws(function () { q(O, [{ skuId: 'k4', qty: 1, modifiers: [hot] }]); }, 'MODIFIER_INVALID');          // croissant has no groups
  T.throws(function () { q(O, [{ skuId: 'k2', qty: 1, modifiers: [hot, tops[0]] }]); }, 'MODIFIER_INVALID'); // topping not attached to Americano
  T.throws(function () { q(O, [{ skuId: 'k1', qty: 1, modifiers: [hot] }]); }, 'MODIFIER_INVALID');          // Gula required
  T.throws(function () { q(O, [{ skuId: 'k1', qty: 1, modifiers: [hot, normal, opt(O, 'Gula', 'No sugar')] }]); }, 'MODIFIER_INVALID'); // Gula max 1
  T.throws(function () { q(O, [{ skuId: 'k1', qty: 1, modifiers: [hot, normal, tops[0], tops[0]] }]); }, 'MODIFIER_INVALID');
  T.eq(q(O, [{ skuId: 'k1', qty: 1, modifiers: [hot, normal].concat(tops) }]).subtotal, 28000 + 19000, 'max 3 toppings ok');
  XC(O).archiveModifierGroup(grp(O, 'Topping').id, true);
  T.throws(function () { q(O, [{ skuId: 'k1', qty: 1, modifiers: [hot, normal, tops[0]] }]); }, 'MODIFIER_INVALID', 'archived group not selectable');
});

test('x-catalog: outlet price override applies only at that outlet', function (O, T) {
  XC(O).setOutletPrice('k1', 'o2', { price: 30000, available: true });
  T.eq(q(O, [{ skuId: 'k1', qty: 1 }]).subtotal, 28000, 'o1 base price');
  O.tx(function (d) { d.session.outlet = 'o2'; });
  T.eq(q(O, [{ skuId: 'k1', qty: 1 }]).subtotal, 30000);
  T.eq(q(O, [{ skuId: 'k6', qty: 1 }]).subtotal, 89000, 'seeded BSD price');
  XC(O).setOutletPrice('k1', 'o2', { price: null, available: true });
  T.eq(q(O, [{ skuId: 'k1', qty: 1 }]).subtotal, 28000, 'override removed');
  T.throws(function () { XC(O).setOutletPrice('k1', 'o2', { price: -1 }); }, 'VALIDATION');
  T.throws(function () { XC(O).setOutletPrice('k1', 'o3', { price: 1 }); }, 'NOT_FOUND');
});

test('x-catalog: unavailable at outlet blocks the sale', function (O, T) {
  XC(O).setOutletPrice('k3', 'o1', { available: false });
  T.throws(function () { q(O, [{ skuId: 'k3', qty: 1 }]); }, 'NOT_AVAILABLE');
  T.throws(function () { O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k3', qty: 1 }], method: 'pickup', payment: { type: 'qris' } }); }, 'NOT_AVAILABLE');
  O.tx(function (d) { d.session.outlet = 'o2'; });
  T.eq(q(O, [{ skuId: 'k3', qty: 1 }]).subtotal, 32000, 'still sold at o2');
});

test('x-catalog: forbidden roles and wrong tenant', function (O, T) {
  var C = XC(O), cat = C.categories(O.db())[0].id, g = grp(O, 'Gula').id;
  ['cashier', 'finance', 'courier'].forEach(function (r) {
    T.as(r);
    T.throws(function () { C.createCategory('Baru'); }, 'FORBIDDEN');
    T.throws(function () { C.archiveSku('k1', true); }, 'FORBIDDEN');
    T.throws(function () { C.saveModifierGroup({ name: 'X', options: [{ name: 'a', price: 0 }] }); }, 'FORBIDDEN');
    T.throws(function () { C.setOutletPrice('k1', 'o2', { price: 1 }); }, 'FORBIDDEN');
    T.throws(function () { C.archiveProduct('p1', true); }, 'FORBIDDEN');
  });
  T.as('manager'); C.createCategory('Musiman');
  T.as('owner', 't2');
  T.throws(function () { C.renameCategory(cat, 'Hack'); }, 'NOT_FOUND');
  T.throws(function () { C.archiveSku('k1', true); }, 'NOT_FOUND');
  T.throws(function () { C.setProductModifiers('p9', [g]); }, 'NOT_FOUND');
  T.throws(function () { C.setOutletPrice('k1', 'o3', { price: 1 }); }, 'NOT_FOUND');
  T.eq(C.modifierGroups(O.db()).length, 0, 't2 sees no t1 groups');
  T.eq(C.categories(O.db()).map(function (c) { return c.name; }), ['Sembako', 'Minuman']);
});

test('x-catalog: demo adds Large variant', function (O, T) {
  O.demoHistory();
  var d = O.db(), large = O.mine(d, 'skus').filter(function (s) { return s.sku === 'KA-100L'; })[0];
  T.ok(large && large.productId === 'p1' && large.price === 34000);
});
