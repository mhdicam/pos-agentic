/* Delivery / courier / POD / COD tests. Order rows are created directly; Orbis.domain.orders is stubbed if absent. */
(function () {
  var O = Orbis, dv = O.domain.delivery;
  var STUBBED = false;
  function ensureOrderStub() {
    if (O.domain.orders && O.domain.orders.complete && O.domain.orders.markReturned && O.domain.orders.setPaymentStatus) return;
    STUBBED = true;
    var o = O.domain.orders = O.domain.orders || {};
    function row(d, id) { return d.orders.filter(function (x) { return x.id === id && x.tenant === d.session.tenant; })[0]; }
    o.complete = o.complete || function (d, id) { row(d, id).status = 'COMPLETED'; };
    o.markReturned = o.markReturned || function (d, id) { row(d, id).status = 'RETURNED'; };
    o.setPaymentStatus = o.setPaymentStatus || function (d, id, s) { row(d, id).paymentStatus = s; };
  }
  ensureOrderStub();

  /** Creates a READY delivery order (cod=true -> COLLECTION_PENDING 56000+10000). Returns delivery. */
  function mk(opts) {
    opts = opts || {};
    return O.tx(function (d) {
      var oid = O.nextId(d, 'ORD', 4);
      var cod = opts.cod !== false;
      var o = { id: oid, tenant: d.session.tenant, outlet: opts.outlet || d.session.outlet, channel: 'store',
        customer: { name: 'Budi', phone: '0811' }, items: [{ skuId: 'k1', qty: 2, name: 'Kopi', price: 28000, cost: 9000 }],
        subtotal: 56000, discount: 0, tax: 0, service: 0, deliveryFee: 10000, total: 66000, method: 'delivery', address: 'Jl. A',
        status: opts.status || 'READY', paymentStatus: cod ? 'COLLECTION_PENDING' : 'PAID', createdAt: O.clock.now(), history: [] };
      d.orders.push(o);
      return dv.enqueue(d, o);
    });
  }
  function get(id) { return dv.get(O.db(), id); }
  function ver(id) { return get(id).version; }
  function order(id) { var d = O.db(); return d.orders.filter(function (o) { return o.id === get(id).orderId; })[0]; }
  function onHand() { return O.domain.inventory.onHand(O.db(), 'k1', 'o1'); }
  var CK = { items: true, packaging: true, label: true, address: true };

  /** Drive a delivery to a given state as dispatcher/courier. */
  function drive(id, upTo) {
    var steps = ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'];
    var n = steps.indexOf(upTo);
    for (var i = 0; i <= n; i++) {
      var s = steps[i];
      if (s === 'ASSIGNED') { T.as('dispatcher'); dv.assign(id, 'c1', ver(id)); }
      if (s === 'ACCEPTED') { T.as('courier'); dv.accept(id, ver(id)); }
      if (s === 'PICKED_UP') dv.pickup(id, CK, ver(id));
      if (s === 'IN_TRANSIT') dv.start(id, ver(id));
      if (s === 'ARRIVED') dv.arrive(id, ver(id));
    }
  }
  function deliver(id) {
    drive(id, 'ARRIVED');
    dv.pod(id, { receiver: 'Budi', method: 'otp', otp: '4826', codAmount: get(id).codAmount }, ver(id));
  }

  test('enqueue: idempotent per order, COD amount from payment status', function (O, T) {
    var a = mk({ cod: true });
    T.eq(a.status, 'READY_FOR_ASSIGNMENT'); T.eq(a.codAmount, 66000); T.eq(a.version, 0);
    var b = mk({ cod: false }); T.eq(b.codAmount, 0);
    O.tx(function (d) { dv.enqueue(d, d.orders.filter(function (o) { return o.id === a.orderId; })[0]); });
    T.eq(O.db().deliveries.length, 2, 'no duplicate for same order');
  });

  test('enqueue refuses foreign-tenant order', function (O, T) {
    var a = mk();
    T.as('owner', 't2');
    T.throws(function () { O.tx(function (d) { dv.enqueue(d, { id: 'X', tenant: 't1' }); }); }, 'NOT_FOUND');
    T.eq(dv.list(O.db()).length, 0, 'cross-tenant delivery invisible');
    T.throws(function () { O.tx(function (d) { dv.assign; return dv.get(d, a.id) || (function () { throw O.Err('NOT_FOUND', 'x'); })(); }); }, 'NOT_FOUND');
  });

  test('happy path through to DELIVERED with history and version bumps', function (O, T) {
    var a = mk(); deliver(a.id);
    var x = get(a.id);
    T.eq(x.status, 'DELIVERED'); T.eq(x.version, 6);
    T.eq(x.history.map(function (h) { return h.to; }).join(','), 'READY_FOR_ASSIGNMENT,ASSIGNED,ACCEPTED,PICKED_UP,IN_TRANSIT,ARRIVED,DELIVERED');
    T.eq(x.proofReview.status, 'PENDING');
    T.eq(order(a.id).status, 'COMPLETED'); T.eq(order(a.id).paymentStatus, 'COD_COLLECTED');
  });

  test('every illegal transition is rejected (full matrix)', function (O, T) {
    var states = dv.STATES, bad = 0;
    states.forEach(function (from) {
      states.forEach(function (to) {
        var okMove = dv.ALLOWED[from].indexOf(to) >= 0;
        var a = mk();
        O.tx(function (d) { d.deliveries.filter(function (x) { return x.id === a.id; })[0].status = from; });
        var res = null;
        try { O.tx(function (d) { dv.transition(d, d.deliveries.filter(function (x) { return x.id === a.id; })[0], to, {}); }); res = 'ok'; }
        catch (e) { res = e.code; }
        if (okMove) T.eq(res, 'ok', from + '->' + to);
        else { T.eq(res, 'INVALID_TRANSITION', from + '->' + to); bad++; }
      });
    });
    T.ok(bad > 100, 'matrix covered ' + bad + ' illegal pairs');
  });

  test('pre-pickup states may be CANCELLED, later states may not', function (O, T) {
    ['READY_FOR_ASSIGNMENT', 'ASSIGNED', 'ACCEPTED'].forEach(function (s) { T.ok(dv.ALLOWED[s].indexOf('CANCELLED') >= 0, s); });
    ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED'].forEach(function (s) { T.ok(dv.ALLOWED[s].indexOf('CANCELLED') < 0, s); });
    var a = mk(); T.as('dispatcher');
    T.throws(function () { dv.cancel(a.id, 'abc', ver(a.id)); }, 'REASON_REQUIRED');
    dv.cancel(a.id, 'pelanggan batal', ver(a.id));
    T.eq(get(a.id).status, 'CANCELLED');
  });

  test('stale expectedVersion -> CONFLICT; double accept is safe', function (O, T) {
    var a = mk(); T.as('dispatcher');
    var v0 = ver(a.id);
    dv.assign(a.id, 'c1', v0);
    T.throws(function () { dv.assign(a.id, 'c2', v0); }, 'CONFLICT');
    T.as('courier');
    var v1 = ver(a.id);
    dv.accept(a.id, v1);
    T.throws(function () { dv.accept(a.id, v1); }, 'CONFLICT', 'double click');
    T.eq(get(a.id).status, 'ACCEPTED'); T.eq(get(a.id).version, 2);
    // fresh version but wrong state
    T.throws(function () { dv.accept(a.id, ver(a.id)); }, 'INVALID_TRANSITION');
  });

  test('assign: role, offline, busy, other outlet, other tenant, not READY', function (O, T) {
    var a = mk();
    T.as('cashier'); T.throws(function () { dv.assign(a.id, 'c1', 0); }, 'FORBIDDEN');
    T.as('courier'); T.throws(function () { dv.assign(a.id, 'c1', 0); }, 'FORBIDDEN');
    T.as('dispatcher');
    T.throws(function () { dv.assign(a.id, 'c3', 0); }, 'COURIER_OFFLINE');
    T.throws(function () { dv.assign(a.id, 'c4', 0); }, 'NOT_FOUND', 'other tenant courier');
    O.tx(function (d) { d.couriers.push({ id: 'c9', tenant: 't1', outlet: 'o2', name: 'Lain', status: 'ONLINE', maxActive: 3 }); });
    T.throws(function () { dv.assign(a.id, 'c9', 0); }, 'OUTLET_MISMATCH');
    var notReady = mk({ status: 'PREPARING' });
    T.throws(function () { dv.assign(notReady.id, 'c1', 0); }, 'ORDER_NOT_READY');
    T.eq(get(notReady.id).status, 'READY_FOR_ASSIGNMENT', 'rolled back');
    // busy: 3 active for c1
    var xs = [mk(), mk(), mk()];
    xs.forEach(function (x) { dv.assign(x.id, 'c1', 0); });
    T.throws(function () { dv.assign(a.id, 'c1', 0); }, 'COURIER_BUSY');
    dv.assign(a.id, 'c2', 0);
    var al = get(a.id);
    T.eq(al.offerExpiresAt - al.history[1].at, 600000); T.eq(al.dueAt - al.history[1].at, 90 * 60000);
  });

  test('assigning a delivery of another tenant is NOT_FOUND', function (O, T) {
    var a = mk(); T.as('dispatcher', 't2');
    T.throws(function () { dv.assign(a.id, 'c4', 0); }, 'NOT_FOUND');
  });

  test('courier cannot act on another courier delivery', function (O, T) {
    var a = mk(); T.as('dispatcher'); dv.assign(a.id, 'c2', 0);
    T.as('courier');  // session courier defaults to c1
    T.throws(function () { dv.accept(a.id, ver(a.id)); }, 'FORBIDDEN');
    T.throws(function () { dv.reject(a.id, 'tidak bisa', ver(a.id)); }, 'FORBIDDEN');
    T.throws(function () { dv.pickup(a.id, CK, ver(a.id)); }, 'FORBIDDEN');
    T.throws(function () { dv.fail(a.id, 'alasan sah', ver(a.id)); }, 'FORBIDDEN');
    T.eq(get(a.id).status, 'ASSIGNED');
    O.tx(function (d) { d.session.courierId = 'c2'; });
    dv.accept(a.id, ver(a.id));
    T.eq(get(a.id).status, 'ACCEPTED');
  });

  test('dispatch roles cannot use courier actions and vice versa', function (O, T) {
    var a = mk(); T.as('dispatcher'); dv.assign(a.id, 'c1', 0);
    T.throws(function () { dv.accept(a.id, ver(a.id)); }, 'FORBIDDEN');
    T.as('courier');
    T.throws(function () { dv.retry(a.id, ver(a.id)); }, 'FORBIDDEN');
    T.throws(function () { dv.reviewProof(a.id, 'APPROVED'); }, 'FORBIDDEN');
  });

  test('offer expires after 10 minutes; accept after expiry -> OFFER_EXPIRED', function (O, T) {
    var a = mk(); T.as('dispatcher'); dv.assign(a.id, 'c1', 0);
    var v = ver(a.id);
    O.clock.advance(10 * 60000 + 1000);
    T.as('courier');
    T.throws(function () { dv.accept(a.id, v); }, 'OFFER_EXPIRED');
    var x = get(a.id);
    T.eq(x.status, 'READY_FOR_ASSIGNMENT'); T.eq(x.courierId, null);
  });

  test('expireOffers is idempotent', function (O, T) {
    var a = mk(); T.as('dispatcher'); dv.assign(a.id, 'c1', 0);
    T.eq(dv.sweepOffers().length, 0, 'not yet');
    O.clock.advance(11 * 60000);
    T.eq(dv.sweepOffers().length, 1);
    var v = ver(a.id);
    T.eq(dv.sweepOffers().length, 0); T.eq(ver(a.id), v, 'no second bump');
  });

  test('reject needs reason >= 5 and returns to queue', function (O, T) {
    var a = mk(); T.as('dispatcher'); dv.assign(a.id, 'c1', 0); T.as('courier');
    T.throws(function () { dv.reject(a.id, 'no', ver(a.id)); }, 'REASON_REQUIRED');
    dv.reject(a.id, 'motor mogok', ver(a.id));
    T.eq(get(a.id).status, 'READY_FOR_ASSIGNMENT');
  });

  test('pickup needs all four checklist items', function (O, T) {
    var a = mk(); drive(a.id, 'ACCEPTED');
    T.throws(function () { dv.pickup(a.id, {}, ver(a.id)); }, 'CHECKLIST_INCOMPLETE');
    T.throws(function () { dv.pickup(a.id, { items: true, packaging: true, label: true, address: false }, ver(a.id)); }, 'CHECKLIST_INCOMPLETE');
    T.throws(function () { dv.pickup(a.id, { items: 'yes', packaging: true, label: true, address: true }, ver(a.id)); }, 'CHECKLIST_INCOMPLETE');
    T.eq(get(a.id).status, 'ACCEPTED');
    dv.pickup(a.id, CK, ver(a.id)); T.eq(get(a.id).status, 'PICKED_UP');
  });

  test('courier steps cannot skip states', function (O, T) {
    var a = mk(); drive(a.id, 'ACCEPTED');
    T.throws(function () { dv.start(a.id, ver(a.id)); }, 'INVALID_TRANSITION');
    T.throws(function () { dv.arrive(a.id, ver(a.id)); }, 'INVALID_TRANSITION');
    T.throws(function () { dv.pod(a.id, { receiver: 'Budi', method: 'otp', otp: '4826', codAmount: 66000 }, ver(a.id)); }, 'INVALID_TRANSITION');
    T.throws(function () { dv.fail(a.id, 'alasan sah', ver(a.id)); }, 'INVALID_TRANSITION');
  });

  test('POD: COD mismatch, wrong OTP, short receiver, bad photo, short signature', function (O, T) {
    var a = mk(); drive(a.id, 'ARRIVED');
    var id = a.id;
    T.throws(function () { dv.pod(id, { receiver: 'Budi', method: 'otp', otp: '4826', codAmount: 65999 }, ver(id)); }, 'COD_MISMATCH');
    T.throws(function () { dv.pod(id, { receiver: 'Budi', method: 'otp', otp: '4826', codAmount: 66001 }, ver(id)); }, 'COD_MISMATCH');
    T.throws(function () { dv.pod(id, { receiver: 'Budi', method: 'otp', otp: '4826' }, ver(id)); }, 'VALIDATION');
    T.throws(function () { dv.pod(id, { receiver: 'Budi', method: 'otp', otp: '0000', codAmount: 66000 }, ver(id)); }, 'POD_INVALID');
    T.throws(function () { dv.pod(id, { receiver: 'Bu', method: 'otp', otp: '4826', codAmount: 66000 }, ver(id)); }, 'POD_INVALID');
    T.throws(function () { dv.pod(id, { receiver: 'Budi', method: 'photo', photo: { name: 'a.gif', size: 100 }, codAmount: 66000 }, ver(id)); }, 'POD_INVALID');
    T.throws(function () { dv.pod(id, { receiver: 'Budi', method: 'photo', photo: { name: 'a.jpg', size: 3 * 1024 * 1024 + 1 }, codAmount: 66000 }, ver(id)); }, 'POD_INVALID');
    T.throws(function () { dv.pod(id, { receiver: 'Budi', method: 'signature', signature: 'x', codAmount: 66000 }, ver(id)); }, 'POD_INVALID');
    T.throws(function () { dv.pod(id, { receiver: 'Budi', codAmount: 66000 }, ver(id)); }, 'POD_INVALID');
    T.eq(get(id).status, 'ARRIVED'); T.eq(order(id).status, 'READY', 'order untouched by failed POD');
    dv.pod(id, { receiver: 'Budi', method: 'photo', photo: { name: 'bukti.PNG', size: 3 * 1024 * 1024 }, codAmount: 66000 }, ver(id));
    T.eq(get(id).pod.proof.filename, 'bukti.PNG'); T.ok(!('data' in get(id).pod.proof));
  });

  test('POD signature works; non-COD needs no amount', function (O, T) {
    var a = mk({ cod: false }); drive(a.id, 'ARRIVED');
    dv.pod(a.id, { receiver: 'Siti', method: 'signature', signature: 'Siti' }, ver(a.id));
    T.eq(get(a.id).status, 'DELIVERED'); T.eq(order(a.id).paymentStatus, 'PAID', 'non-COD stays PAID');
  });

  test('fail needs reason, counts attempts; retry capped at 3', function (O, T) {
    var a = mk(); var id = a.id;
    for (var i = 1; i <= 3; i++) {
      drive(id, 'ARRIVED');
      T.throws(function () { dv.fail(id, 'x', ver(id)); }, 'REASON_REQUIRED');
      dv.fail(id, 'pelanggan tidak ada', ver(id));
      T.eq(get(id).attempts, i);
      T.as('dispatcher');
      if (i < 3) { dv.retry(id, ver(id)); T.eq(get(id).status, 'READY_FOR_ASSIGNMENT'); }
    }
    T.throws(function () { dv.retry(id, ver(id)); }, 'MAX_ATTEMPTS');
    T.eq(get(id).status, 'DELIVERY_FAILED');
    dv.returnToStore(id, ver(id)); T.eq(get(id).status, 'RETURN_TO_STORE');
  });

  test('retry only from DELIVERY_FAILED', function (O, T) {
    var a = mk(); T.as('dispatcher');
    T.throws(function () { dv.retry(a.id, ver(a.id)); }, 'INVALID_TRANSITION');
    T.throws(function () { dv.returnToStore(a.id, ver(a.id)); }, 'INVALID_TRANSITION');
  });

  function failed(cod) {
    var a = mk({ cod: cod }); drive(a.id, 'ARRIVED');
    dv.fail(a.id, 'pelanggan menolak', ver(a.id));
    T.as('dispatcher'); dv.returnToStore(a.id, ver(a.id));
    return a.id;
  }

  test('return check-in blocked before courier handoff', function (O, T) {
    var id = failed(true);
    T.throws(function () { dv.returnCheckin(id, 'SELLABLE', ver(id)); }, 'HANDOFF_REQUIRED');
    T.eq(onHand(), 40, 'no restock');
    T.as('courier');
    dv.returnHandoff(id, ver(id));
    T.throws(function () { dv.returnHandoff(id, ver(id)); }, 'ALREADY_DECIDED');
    T.as('dispatcher');
    T.throws(function () { dv.returnCheckin(id, 'BROKEN', ver(id)); }, 'VALIDATION');
    T.as('cashier'); T.throws(function () { dv.returnCheckin(id, 'SELLABLE', ver(id)); }, 'FORBIDDEN');
  });

  test('SELLABLE return restocks once; order RETURNED', function (O, T) {
    var id = failed(true);
    T.as('courier'); dv.returnHandoff(id, ver(id)); T.as('dispatcher');
    dv.returnCheckin(id, 'SELLABLE', ver(id));
    T.eq(onHand(), 42); T.eq(get(id).status, 'RETURNED'); T.eq(order(id).status, 'RETURNED');
    T.throws(function () { dv.returnCheckin(id, 'SELLABLE', ver(id)); }, 'INVALID_TRANSITION');
    // direct replay of the movement is idempotent via ref
    O.tx(function (d) { O.domain.inventory.move(d, { skuId: 'k1', qty: 2, type: 'RETURN_RESTOCK', ref: id, outlet: 'o1' }); });
    T.eq(onHand(), 42, 'replay no double restock');
  });

  test('DAMAGED / QUARANTINE returns do not restock', function (O, T) {
    ['DAMAGED', 'QUARANTINE'].forEach(function (cond) {
      O.reset();
      var id = failed(true);
      T.as('courier'); dv.returnHandoff(id, ver(id)); T.as('dispatcher');
      dv.returnCheckin(id, cond, ver(id));
      T.eq(onHand(), 40, cond + ' no restock'); T.eq(get(id).returnCondition, cond);
    });
  });

  test('reassign only before pickup, needs reason and eligible courier', function (O, T) {
    var a = mk(); T.as('dispatcher'); dv.assign(a.id, 'c1', 0);
    T.throws(function () { dv.reassign(a.id, 'c2', 'x', ver(a.id)); }, 'REASON_REQUIRED');
    T.throws(function () { dv.reassign(a.id, 'c3', 'kurir sakit', ver(a.id)); }, 'COURIER_OFFLINE');
    T.throws(function () { dv.reassign(a.id, 'c1', 'kurir sakit', ver(a.id)); }, 'VALIDATION');
    dv.reassign(a.id, 'c2', 'kurir sakit', ver(a.id));
    T.eq(get(a.id).courierId, 'c2'); T.eq(get(a.id).status, 'ASSIGNED');
    T.as('courier');  // c1 lost ownership
    T.throws(function () { dv.accept(a.id, ver(a.id)); }, 'FORBIDDEN');
    var b = mk(); drive(b.id, 'PICKED_UP'); T.as('dispatcher');
    T.throws(function () { dv.reassign(b.id, 'c2', 'sudah diambil', ver(b.id)); }, 'INVALID_TRANSITION');
  });

  test('location requires consent, is foreground and goes stale after 5 min', function (O, T) {
    T.as('courier');
    T.throws(function () { dv.setLocation({ lat: -6.2, lng: 106.8 }); }, 'CONSENT_REQUIRED');
    T.throws(function () { dv.setLocation({ lat: -6.2, lng: 106.8, consent: 'true' }); }, 'CONSENT_REQUIRED');
    T.eq(dv.myCourier(O.db()).location, undefined, 'nothing stored without consent');
    T.throws(function () { dv.setLocation({ lat: 999, lng: 0, consent: true }); }, 'VALIDATION');
    dv.setLocation({ lat: -6.2, lng: 106.8, consent: true });
    var c = dv.myCourier(O.db());
    T.eq(c.location.foreground, true); T.ok(!dv.isStale(c));
    O.clock.advance(5 * 60000 + 1);
    T.ok(dv.isStale(dv.myCourier(O.db())), 'stale');
    dv.clearLocation(); T.ok(dv.isStale(dv.myCourier(O.db())));
    T.as('dispatcher'); T.throws(function () { dv.setLocation({ lat: 1, lng: 1, consent: true }); }, 'FORBIDDEN');
  });

  test('SLA helpers', function (O, T) {
    var a = mk();
    T.ok(!dv.assignmentOverdue(get(a.id)));
    O.clock.advance(16 * 60000);
    T.ok(dv.assignmentOverdue(get(a.id)));
    T.as('dispatcher'); dv.assign(a.id, 'c1', ver(a.id));
    T.ok(!dv.assignmentOverdue(get(a.id)) && !dv.deliveryOverdue(get(a.id)));
    O.clock.advance(91 * 60000);
    T.ok(dv.deliveryOverdue(get(a.id)));
  });

  /* ---------- COD ---------- */
  test('remittance: over outstanding (incl. pending), non-delivered, zero, float, other courier', function (O, T) {
    var a = mk(); var id = a.id;
    drive(id, 'ARRIVED');
    T.throws(function () { dv.submitRemittance(id, 1000); }, 'INVALID_TRANSITION', 'not delivered yet');
    dv.pod(id, { receiver: 'Budi', method: 'otp', otp: '4826', codAmount: 66000 }, ver(id));
    T.throws(function () { dv.submitRemittance(id, 66001); }, 'REMIT_EXCEEDS');
    T.throws(function () { dv.submitRemittance(id, 0); }, 'REMIT_EXCEEDS');
    T.throws(function () { dv.submitRemittance(id, -5); }, 'REMIT_EXCEEDS');
    T.throws(function () { dv.submitRemittance(id, 100.5); }, 'VALIDATION');
    dv.submitRemittance(id, 40000);
    T.throws(function () { dv.submitRemittance(id, 26001); }, 'REMIT_EXCEEDS', 'pending counts');
    dv.submitRemittance(id, 26000);
    T.throws(function () { dv.submitRemittance(id, 1); }, 'REMIT_EXCEEDS');
    O.tx(function (d) { d.session.courierId = 'c2'; });
    T.throws(function () { dv.submitRemittance(id, 1); }, 'FORBIDDEN');
  });

  test('courier cannot verify own remittance; only owner/manager/finance', function (O, T) {
    var a = mk(); deliver(a.id);
    var r = dv.submitRemittance(a.id, 66000);
    T.throws(function () { dv.reviewRemittance(r.id, 'VERIFY'); }, 'FORBIDDEN');
    T.as('dispatcher'); T.throws(function () { dv.reviewRemittance(r.id, 'VERIFY'); }, 'FORBIDDEN');
    T.as('cashier'); T.throws(function () { dv.reviewRemittance(r.id, 'VERIFY'); }, 'FORBIDDEN');
    T.eq(O.db().remittances[0].status, 'SUBMITTED'); T.eq(order(a.id).paymentStatus, 'COD_COLLECTED', 'not PAID without verification');
  });

  test('dispute needs reason; decided remittance is final; no PAID on dispute', function (O, T) {
    var a = mk(); deliver(a.id);
    var r = dv.submitRemittance(a.id, 66000);
    T.as('finance');
    T.throws(function () { dv.reviewRemittance(r.id, 'DISPUTE', 'no'); }, 'REASON_REQUIRED');
    T.throws(function () { dv.reviewRemittance(r.id, 'MAYBE'); }, 'VALIDATION');
    T.throws(function () { dv.reviewRemittance('RMT-9999', 'VERIFY'); }, 'NOT_FOUND');
    dv.reviewRemittance(r.id, 'DISPUTE', 'uang kurang saat dihitung');
    T.eq(O.db().remittances[0].status, 'DISPUTED');
    T.throws(function () { dv.reviewRemittance(r.id, 'VERIFY'); }, 'ALREADY_DECIDED');
    T.eq(order(a.id).paymentStatus, 'COD_COLLECTED');
    T.eq(dv.outstanding(O.db(), a.id), 66000, 'disputed does not reduce outstanding');
    T.as('courier'); dv.submitRemittance(a.id, 66000);   // can resubmit after dispute
  });

  test('partial remittances summing to full make order PAID only when verified', function (O, T) {
    var a = mk(); deliver(a.id);
    var r1 = dv.submitRemittance(a.id, 30000), r2 = dv.submitRemittance(a.id, 36000);
    T.as('manager');
    dv.reviewRemittance(r1.id, 'VERIFY');
    T.eq(dv.outstanding(O.db(), a.id), 36000); T.eq(order(a.id).paymentStatus, 'COD_COLLECTED');
    T.throws(function () { dv.reviewRemittance(r1.id, 'VERIFY'); }, 'ALREADY_DECIDED');
    dv.reviewRemittance(r2.id, 'VERIFY');
    T.eq(dv.outstanding(O.db(), a.id), 0); T.eq(order(a.id).paymentStatus, 'PAID');
  });

  test('remittance of other tenant is invisible/NOT_FOUND', function (O, T) {
    var a = mk(); deliver(a.id); var r = dv.submitRemittance(a.id, 66000);
    T.as('finance', 't2');
    T.throws(function () { dv.reviewRemittance(r.id, 'VERIFY'); }, 'NOT_FOUND');
    T.eq(dv.remittances(O.db()).length, 0);
  });

  test('proof review: owner approves, flag needs reason, decided once', function (O, T) {
    var a = mk(); deliver(a.id);
    T.as('dispatcher'); T.throws(function () { dv.reviewProof(a.id, 'APPROVED'); }, 'FORBIDDEN');
    T.as('manager');
    T.throws(function () { dv.reviewProof(a.id, 'FLAGGED', 'x'); }, 'REASON_REQUIRED');
    dv.reviewProof(a.id, 'FLAGGED', 'foto buram');
    T.eq(get(a.id).proofReview.status, 'FLAGGED');
    T.throws(function () { dv.reviewProof(a.id, 'APPROVED'); }, 'ALREADY_DECIDED');
    var b = mk(); T.throws(function () { dv.reviewProof(b.id, 'APPROVED'); }, 'INVALID_TRANSITION');
  });

  test('cross-tenant delivery invisible to other tenant actions', function (O, T) {
    var a = mk(); T.as('courier', 't2');
    T.eq(dv.myTasks(O.db()).length, 0);
    T.throws(function () { dv.accept(a.id, 0); }, 'NOT_FOUND');
    T.as('finance', 't2'); T.throws(function () { dv.reviewProof(a.id, 'APPROVED'); }, 'NOT_FOUND');
  });
})();
