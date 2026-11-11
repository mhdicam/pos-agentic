/* RD-16 settings: tax PBJT/PPN, service stacking, pembulatan, tenders, receipt. */
Orbis.domain.bizSettings.install();   // tenant.test.js deletes hooks.charges after its own hook test
(function () {
  var B = function (O) { return O.domain.bizSettings; };
  var q = function (O, sku, qty, pay) { return O.domain.orders.quote(O.db(), { channel: 'pos', items: [{ skuId: sku, qty: qty || 1 }], payment: pay }); };
  var pbjt = function (rate, extra) { return Object.assign({ type: 'pbjt', rate: rate, mode: 'exclusive', service: 0 }, extra || {}); };

  test('settings: backward compat without config reproduces legacy tax/service', function (O, T) {
    T.as('owner');
    var a = q(O, 'k1'); T.eq([a.tax, a.service, a.rounding, a.total, a.taxLabel], [0, 0, 0, 28000, 'Pajak']);
    O.domain.orders.setSettings(10, 5);
    var b = q(O, 'k1'); T.eq([b.tax, b.service, b.rounding, b.total], [2800, 1400, 0, 32200]);
  });

  test('settings: PBJT 10% exclusive exact rupiah', function (O, T) {
    T.as('owner'); B(O).saveTax('', pbjt(10));
    var a = q(O, 'k1', 3); T.eq([a.subtotal, a.tax, a.total, a.taxLabel], [84000, 8400, 92400, 'PBJT 10%']);
  });

  test('settings: PPN DPP 11/12 exclusive is effective 11%', function (O, T) {
    var t = { type: 'ppn', rate: 12, dpp: true, mode: 'exclusive', service: 0 };
    T.eq(B(O).bp(t), 1100);
    T.eq(B(O).calc(t, null, null, 100000, 0).tax, 11000);
    T.eq(B(O).calc(Object.assign({}, t, { dpp: false }), null, null, 100000, 0).tax, 12000, 'luxury 12% nominal');
  });

  test('settings: PPN 12% DPP 11/12 inclusive extracts tax, total unchanged', function (O, T) {
    T.as('owner', 't2');
    var a = q(O, 'k9');   // 69000 x 1100/11100 = 6837.84 -> 6838
    T.eq([a.subtotal, a.tax, a.total, a.taxLabel], [69000, 0, 69000, 'PPN 12% DPP 11/12 (termasuk)']);
    var o = O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k9', qty: 1 }], payment: { type: 'qris' } });
    T.eq([o.total, o.tax, o.taxIncluded], [69000, 0, 6838]);
  });

  test('settings: service then tax toggle', function (O, T) {
    var off = B(O).calc(pbjt(10, { service: 10 }), null, null, 100000, 0);
    var on = B(O).calc(pbjt(10, { service: 10, taxOnService: true }), null, null, 100000, 0);
    T.eq([off.service, off.tax, off.total], [10000, 10000, 120000]);
    T.eq([on.service, on.tax, on.total], [10000, 11000, 121000]);
    var inc = B(O).calc(pbjt(10, { service: 5, taxOnService: true, mode: 'inclusive' }), null, null, 100000, 0);
    T.eq([inc.service, inc.tax, inc.taxIncluded, inc.total], [5000, 0, 9545, 105000], '105000 x 1000/11000 = 9545.45');
  });

  test('settings: tax bounds validated (PBJT max 10, PPN 12, service 0-20)', function (O, T) {
    T.as('owner'); B(O).saveTax('', pbjt(10));
    var audits = O.db().audit.length;
    T.throws(function () { B(O).saveTax('', pbjt(10.5)); }, 'VALIDATION');
    T.throws(function () { B(O).saveTax('', { type: 'ppn', rate: 11, dpp: false }); }, 'VALIDATION');
    T.throws(function () { B(O).saveTax('', pbjt(5, { service: 21 })); }, 'VALIDATION');
    T.throws(function () { B(O).saveTax('', pbjt(5, { mode: 'x' })); }, 'VALIDATION');
    T.throws(function () { B(O).saveTax('o3', pbjt(5)); }, 'NOT_FOUND', 'outlet of other tenant');
    T.eq(B(O).taxFor(O.db(), 'o1').rate, 10); T.eq(O.db().audit.length, audits);
    B(O).saveTax('', pbjt(0)); B(O).saveTax('', pbjt(10, { service: 20 }));
  });

  test('settings: rounding 100/500/1000 down/nearest/up', function (O, T) {
    var r = function (unit, mode, base) { return B(O).calc(null, { tax: 0, service: 0 }, { unit: unit, mode: mode, scope: 'all' }, base, 0).rounding; };
    T.eq([r(100, 'down', 30850), r(100, 'nearest', 30850), r(100, 'up', 30850), r(100, 'nearest', 30849)], [-50, 50, 50, -49]);
    T.eq([r(500, 'down', 30850), r(500, 'nearest', 30850), r(500, 'up', 30850)], [-350, 150, 150]);
    T.eq([r(1000, 'down', 30850), r(1000, 'nearest', 30850), r(1000, 'up', 30850), r(1000, 'up', 31000)], [-850, 150, 150, 0]);
    T.eq(r(0, 'up', 30850), 0, 'off');
    T.as('owner'); T.throws(function () { B(O).saveRounding({ unit: 200, mode: 'up' }); }, 'VALIDATION');
  });

  test('settings: rounding applies to cash only through checkout', function (O, T) {
    T.as('owner'); B(O).saveTax('', pbjt(10)); B(O).saveRounding({ unit: 500, mode: 'nearest', scope: 'cash' });
    T.as('cashier'); O.domain.shifts.open(100000);
    var c = O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 1 }], payment: { type: 'cash', tendered: 50000 } });
    T.eq([c.tax, c.rounding, c.total, c.change, c.taxLabel], [2800, 200, 31000, 19000, 'PBJT 10%']);
    T.eq(O.db().payments.filter(function (p) { return p.orderId === c.id; })[0].amount, 31000);
    var x = O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 1 }], payment: { type: 'qris' } });
    T.eq([x.rounding, x.total], [0, 30800]);
    var s = O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 1 }], payment: { type: 'split', legs: [{ type: 'cash', amount: 10800 }, { type: 'qris', amount: 20000 }] } });
    T.eq(s.rounding, 0, 'split not rounded');
  });

  test('settings: disabled QRIS rejected with TENDER_DISABLED', function (O, T) {
    T.as('owner'); B(O).savePayments({ cash: true, qris: false, transfer: false, cod: false });
    var before = O.domain.inventory.onHand(O.db(), 'k1', 'o1');
    T.throws(function () { O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 1 }], payment: { type: 'qris' } }); }, 'TENDER_DISABLED');
    T.throws(function () { O.domain.orders.checkout({ channel: 'store', items: [{ skuId: 'k1', qty: 1 }], method: 'delivery', address: 'Jl. A 1', customer: { name: 'Ani', phone: '081234567890' }, payment: { type: 'cod' } }); }, 'TENDER_DISABLED');
    T.eq(O.domain.inventory.onHand(O.db(), 'k1', 'o1'), before, 'no stock moved');
    T.eq(O.hooks.tenderEnabled(O.db(), 'cash'), true);
  });

  test('settings: cannot disable all tenders; bank account validated', function (O, T) {
    T.as('owner');
    T.throws(function () { B(O).savePayments({ edc: true, cod: true }); }, 'VALIDATION', 'no counter tender');
    T.throws(function () { B(O).savePayments({ transfer: true }); }, 'VALIDATION', 'transfer without account');
    T.throws(function () { B(O).savePayments({ transfer: true, accounts: [{ bank: 'BCA', number: '12', name: 'Rina' }] }); }, 'VALIDATION', 'short number');
    T.throws(function () { B(O).savePayments({ cash: true, qrisMdr: 9 }); }, 'VALIDATION', 'mdr');
    var p = B(O).savePayments({ transfer: true, qris: true, qrisMdr: '0.3', accounts: [{ bank: 'BCA', number: '123-456-7890', name: 'Kopi Awan' }, { bank: '', number: '', name: '' }] });
    T.eq(p.transfer.accounts, [{ bank: 'BCA', number: '1234567890', name: 'Kopi Awan' }]); T.eq(p.qris.mdr, 0.3); T.eq(p.cash.enabled, false);
  });

  test('settings: outlet override beats tenant default', function (O, T) {
    T.as('owner'); B(O).saveTax('', pbjt(10)); B(O).saveTax('o2', pbjt(5));
    var a = q(O, 'k1');
    O.tx(function (d) { d.session.outlet = 'o2'; });
    var b = q(O, 'k1');
    T.eq(a.tax, Math.round(a.subtotal / 10)); T.eq(b.tax, Math.round(b.subtotal * 5 / 100)); T.eq(b.taxLabel, 'PBJT 5%');
    B(O).clearOutletTax('o2'); T.eq(q(O, 'k1').taxLabel, 'PBJT 10%');
  });

  test('settings: other tenant isolated', function (O, T) {
    T.as('owner'); B(O).applyPreset();
    T.as('owner', 't2');
    var a = q(O, 'k9', 1, { type: 'cash' });
    T.eq([a.tax, a.rounding, a.total], [0, 0, 69000], 't2 keeps its own PPN inclusive, no t1 rounding');
    T.throws(function () { B(O).clearOutletTax('o1'); }, 'NOT_FOUND');
    B(O).saveTax('', pbjt(5));
    T.as('owner', 't1'); T.eq(B(O).taxFor(O.db(), 'o1').rate, 10);
  });

  test('settings: forbidden role cannot save', function (O, T) {
    ['cashier', 'manager', 'finance'].forEach(function (r) {
      T.as(r); var n = O.db().audit.length;
      T.throws(function () { B(O).saveTax('', pbjt(10)); }, 'FORBIDDEN');
      T.throws(function () { B(O).saveRounding({ unit: 100 }); }, 'FORBIDDEN');
      T.throws(function () { B(O).savePayments({ cash: true }); }, 'FORBIDDEN');
      T.throws(function () { B(O).saveReceipt({ paper: '58' }); }, 'FORBIDDEN');
      T.throws(function () { B(O).applyPreset(); }, 'FORBIDDEN');
      T.eq(O.db().audit.length, n, r + ' wrote no audit');
    });
  });

  test('settings: receipt config saved and WhatsApp link only with phone', function (O, T) {
    T.as('owner');
    T.throws(function () { B(O).saveReceipt({ paper: '70' }); }, 'VALIDATION');
    B(O).saveTax('', pbjt(10));
    var r = B(O).saveReceipt({ paper: '80', logo: true, header: 'Kopi Awan\nSenopati', footer: 'Terima kasih', showTax: true, showCashier: true, showQr: true });
    T.eq([r.paper, r.header], ['80', 'Kopi Awan\nSenopati']);
    T.ok(O.db().audit.some(function (a) { return a.action === 'settings.receipt'; }));
    T.as('cashier'); O.domain.shifts.open(0);
    var o1 = O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 1 }], payment: { type: 'qris' } });
    T.eq(B(O).waLink(O.db(), o1), null);
    var o2 = O.domain.orders.checkout({ channel: 'pos', items: [{ skuId: 'k1', qty: 1 }], customer: { name: 'Andi', phone: '0812-0000-1111' }, payment: { type: 'qris' } });
    var link = B(O).waLink(O.db(), o2), text = decodeURIComponent(link.split('?text=')[1]);
    T.ok(link.indexOf('https://wa.me/6281200001111?text=') === 0, link);
    T.ok(text.indexOf('PBJT 10% Rp 2.800') >= 0 && text.indexOf('Total Rp 30.800') >= 0 && text.indexOf('Senopati') >= 0, text);
  });

  test('settings: Freshmart seed PPN inclusive; Kopi Awan preset', function (O, T) {
    var d = O.db();
    T.eq(d.bizSettings.t2.tax, { type: 'ppn', rate: 12, dpp: true, mode: 'inclusive', service: 0, taxOnService: false });
    T.eq(B(O).taxFor(d, 'o1'), null, 't1 legacy in base seed');
    T.as('owner'); B(O).applyPreset();
    T.eq(B(O).taxFor(O.db(), 'o1'), { type: 'pbjt', rate: 10, dpp: false, mode: 'exclusive', service: 0, taxOnService: false });
    T.eq(B(O).rounding(O.db()), { unit: 100, mode: 'nearest', scope: 'cash' });
  });
})();
