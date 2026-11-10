/* Orbis v2 — delivery domain: dispatch, courier actions, POD, COD remittance.
   One state machine (transition), optimistic concurrency via `version`, COD single path:
   COLLECTED (POD) -> SUBMITTED (courier) -> VERIFIED (finance) -> order PAID. Never PAID without verification. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, dv = Orbis.domain.delivery = {};
  var MIN = 60000;

  var STATES = ['READY_FOR_ASSIGNMENT', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'DELIVERY_FAILED', 'RETRY_PENDING', 'RETURN_TO_STORE', 'RETURNED', 'CANCELLED'];
  var ALLOWED = {
    READY_FOR_ASSIGNMENT: ['ASSIGNED', 'CANCELLED'],
    ASSIGNED: ['ACCEPTED', 'READY_FOR_ASSIGNMENT', 'CANCELLED'],
    ACCEPTED: ['PICKED_UP', 'CANCELLED'],
    PICKED_UP: ['IN_TRANSIT'],
    IN_TRANSIT: ['ARRIVED', 'DELIVERY_FAILED'],
    ARRIVED: ['DELIVERED', 'DELIVERY_FAILED'],
    DELIVERED: [],
    DELIVERY_FAILED: ['RETRY_PENDING', 'RETURN_TO_STORE'],
    RETRY_PENDING: ['READY_FOR_ASSIGNMENT'],
    RETURN_TO_STORE: ['RETURNED'],
    RETURNED: [],
    CANCELLED: []
  };
  var ACTIVE = ['ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED'];
  var OFFER_TTL = 10 * MIN, DUE_TTL = 90 * MIN, ASSIGN_SLA = 15 * MIN, STALE_LOC = 5 * MIN;
  var DEMO_OTP = '4826', MAX_ATTEMPTS = 3, MAX_PHOTO = 3 * 1024 * 1024;
  var CHECKLIST = ['items', 'packaging', 'label', 'address'];
  dv.STATES = STATES; dv.ALLOWED = ALLOWED; dv.ACTIVE = ACTIVE; dv.CHECKLIST = CHECKLIST; dv.MAX_ATTEMPTS = MAX_ATTEMPTS; dv.DEMO_OTP = DEMO_OTP;

  /* ---------- lookups ---------- */
  function orderOf(d, dl) {
    return Orbis.mine(d, 'orders').filter(function (o) { return o.id === dl.orderId; })[0];
  }
  function find(d, id) {
    var dl = Orbis.mine(d, 'deliveries').filter(function (x) { return x.id === id; })[0];
    Orbis.need(dl, 'NOT_FOUND', 'Pengiriman tidak ditemukan');
    return dl;
  }
  function courierRow(d, id) { return (d.couriers || []).filter(function (c) { return c.id === id; })[0]; }
  /** Courier record linked to the session (demo link: session.courierId, default 'c1'). */
  function sessionCourierId(d) { return d.session.courierId || 'c1'; }
  dv.get = function (d, id) { return Orbis.mine(d, 'deliveries').filter(function (x) { return x.id === id; })[0] || null; };
  dv.list = function (d) { return Orbis.mine(d, 'deliveries'); };
  dv.couriers = function (d) { return Orbis.mine(d, 'couriers'); };
  dv.myCourier = function (d) {
    return Orbis.mine(d, 'couriers').filter(function (c) { return c.id === sessionCourierId(d); })[0] || null;
  };
  dv.myTasks = function (d) {
    var c = dv.myCourier(d);
    return c ? Orbis.mine(d, 'deliveries').filter(function (x) { return x.courierId === c.id; }) : [];
  };
  dv.activeCount = function (d, courierId) {
    return Orbis.mine(d, 'deliveries').filter(function (x) { return x.courierId === courierId && ACTIVE.indexOf(x.status) >= 0; }).length;
  };

  /* ---------- state machine ---------- */
  /** The ONLY place that changes status. meta {reason, expectedVersion?, reassign?} */
  var transition = dv.transition = function (d, dl, to, meta) {
    meta = meta || {};
    if (meta.expectedVersion !== undefined && meta.expectedVersion !== dl.version) {
      throw Orbis.Err('CONFLICT', 'Data pengiriman sudah berubah, muat ulang lalu coba lagi');
    }
    var from = dl.status;
    var ok = (ALLOWED[from] || []).indexOf(to) >= 0 || (meta.reassign && to === 'ASSIGNED' && (from === 'ASSIGNED' || from === 'ACCEPTED'));
    if (!ok) throw Orbis.Err('INVALID_TRANSITION', 'Transisi ' + from + ' -> ' + to + ' tidak diizinkan');
    dl.status = to;
    dl.version += 1;
    dl.history.push({ at: Orbis.clock.now(), by: d.session.actor, from: from, to: to, reason: meta.reason || null });
    return dl;
  };
  function checkVersion(dl, expectedVersion) {
    if (expectedVersion !== dl.version) throw Orbis.Err('CONFLICT', 'Data pengiriman sudah berubah, muat ulang lalu coba lagi');
  }
  /** Non-status mutation (e.g. return handoff): still bumps version + history. */
  function touch(d, dl, note) {
    dl.version += 1;
    dl.history.push({ at: Orbis.clock.now(), by: d.session.actor, from: dl.status, to: dl.status, reason: note });
  }

  /* ---------- order bridge (sales owns orders; defensive) ---------- */
  function orderCall(d, fn, orderId, arg, fallback) {
    var o = Orbis.domain.orders;
    if (o && typeof o[fn] === 'function') return o[fn](d, orderId, arg);
    var row = Orbis.mine(d, 'orders').filter(function (x) { return x.id === orderId; })[0];
    if (row) fallback(row);
  }
  function orderComplete(d, orderId) { orderCall(d, 'complete', orderId, undefined, function (o) { o.status = 'COMPLETED'; }); }
  function orderReturned(d, orderId) { orderCall(d, 'markReturned', orderId, undefined, function (o) { o.status = 'RETURNED'; }); }
  function orderPay(d, orderId, st) { orderCall(d, 'setPaymentStatus', orderId, st, function (o) { o.paymentStatus = st; }); }

  /* ---------- enqueue (called by sales inside its tx) ---------- */
  dv.enqueue = function (d, order) {
    Orbis.need(order && order.tenant === d.session.tenant, 'NOT_FOUND', 'Pesanan tidak ditemukan');
    var ex = Orbis.mine(d, 'deliveries').filter(function (x) { return x.orderId === order.id; })[0];
    if (ex) return ex;
    var now = Orbis.clock.now();
    var dl = {
      id: Orbis.nextId(d, 'DLV', 4), tenant: d.session.tenant, orderId: order.id, outlet: order.outlet,
      status: 'READY_FOR_ASSIGNMENT', courierId: null, version: 0, attempts: 0, offerExpiresAt: null, dueAt: null,
      createdAt: now, history: [{ at: now, by: d.session.actor, from: null, to: 'READY_FOR_ASSIGNMENT', reason: 'Pesanan siap dikirim' }],
      pod: null, proofReview: null, codAmount: order.paymentStatus === 'COLLECTION_PENDING' ? order.total : 0,
      returnCondition: null, returnHandoffAt: null, checklist: null
    };
    d.deliveries.push(dl);
    return dl;
  };

  /* ---------- offers / expiry ---------- */
  dv.offerExpired = function (dl, now) {
    return dl.status === 'ASSIGNED' && dl.offerExpiresAt != null && (now == null ? Orbis.clock.now() : now) >= dl.offerExpiresAt;
  };
  function release(d, dl, reason) {
    transition(d, dl, 'READY_FOR_ASSIGNMENT', { reason: reason });
    dl.rejectedBy = (dl.rejectedBy || []).concat([dl.courierId]);
    dl.courierId = null; dl.offerExpiresAt = null; dl.dueAt = null;
  }
  /** Idempotent: returns expired ASSIGNED offers to the queue. Runs inside an open tx. */
  dv.expireOffers = function (d) {
    var out = [], now = Orbis.clock.now();
    Orbis.mine(d, 'deliveries').forEach(function (dl) {
      if (dv.offerExpired(dl, now)) { release(d, dl, 'Penawaran kedaluwarsa'); out.push(dl.id); }
    });
    return out;
  };
  dv.sweepOffers = function () {
    return Orbis.tx(function (d) { return dv.expireOffers(d); }, { audit: function (r) { return { action: 'delivery.expire', entity: 'delivery', detail: r.join(',') }; } });
  };

  /* ---------- eligibility / assign ---------- */
  /** null when eligible, else {code, msg}. */
  dv.eligibility = function (d, courier, dl) {
    if (!courier || courier.tenant !== d.session.tenant) return { code: 'NOT_FOUND', msg: 'Kurir tidak ditemukan' };
    if (courier.status !== 'ONLINE') return { code: 'COURIER_OFFLINE', msg: 'Kurir sedang offline' };
    if (courier.outlet !== dl.outlet) return { code: 'OUTLET_MISMATCH', msg: 'Beda outlet' };
    var max = courier.maxActive || 3;
    if (dv.activeCount(d, courier.id) >= max) return { code: 'COURIER_BUSY', msg: 'Tugas aktif penuh (' + max + ')' };
    return null;
  };
  function offer(d, dl, courierId, reassign, reason) {
    var c = courierRow(d, courierId);
    var bad = dv.eligibility(d, c, dl);
    if (bad) throw Orbis.Err(bad.code, bad.msg);
    var order = orderOf(d, dl);
    Orbis.need(order && order.status === 'READY', 'ORDER_NOT_READY', 'Pesanan belum berstatus READY');
    transition(d, dl, 'ASSIGNED', { reason: reason || 'Ditugaskan ke ' + c.name, reassign: reassign });
    var now = Orbis.clock.now();
    dl.courierId = c.id; dl.offerExpiresAt = now + OFFER_TTL; dl.dueAt = now + DUE_TTL;
  }
  dv.assign = function (deliveryId, courierId, expectedVersion) {
    Orbis.require('delivery.dispatch');
    return Orbis.tx(function (d) {
      dv.expireOffers(d);
      var dl = find(d, deliveryId);
      checkVersion(dl, expectedVersion);
      offer(d, dl, courierId, false);
      return dl;
    }, { audit: { action: 'delivery.assign', entity: 'delivery', entityId: deliveryId } });
  };
  dv.reassign = function (deliveryId, courierId, reason, expectedVersion) {
    Orbis.require('delivery.dispatch');
    return Orbis.tx(function (d) {
      dv.expireOffers(d);
      var dl = find(d, deliveryId);
      checkVersion(dl, expectedVersion);
      Orbis.need(dl.status === 'ASSIGNED' || dl.status === 'ACCEPTED', 'INVALID_TRANSITION', 'Reassign hanya sebelum pickup');
      reason = Orbis.reason(reason, 'Alasan reassign');
      Orbis.need(dl.courierId !== courierId, 'VALIDATION', 'Pilih kurir yang berbeda');
      offer(d, dl, courierId, true, 'Reassign: ' + reason);
      return dl;
    }, { audit: { action: 'delivery.reassign', entity: 'delivery', entityId: deliveryId } });
  };
  dv.cancel = function (deliveryId, reason, expectedVersion) {
    Orbis.require('delivery.dispatch');
    return Orbis.tx(function (d) {
      dv.expireOffers(d);
      var dl = find(d, deliveryId);
      checkVersion(dl, expectedVersion);
      reason = Orbis.reason(reason, 'Alasan batal');
      transition(d, dl, 'CANCELLED', { reason: reason });
      dl.courierId = null; dl.offerExpiresAt = null;
      return dl;
    }, { audit: { action: 'delivery.cancel', entity: 'delivery', entityId: deliveryId } });
  };

  /* ---------- courier actions ---------- */
  function courierRun(deliveryId, expectedVersion, action, fn, noExpire) {
    Orbis.require('delivery.courier');
    return Orbis.tx(function (d) {
      if (!noExpire) dv.expireOffers(d);
      var dl = find(d, deliveryId);
      if (dl.courierId !== sessionCourierId(d)) throw Orbis.Err('FORBIDDEN', 'Tugas ini bukan milik kurir Anda');
      checkVersion(dl, expectedVersion);
      return fn(d, dl);
    }, { audit: { action: action, entity: 'delivery', entityId: deliveryId } });
  }
  dv.accept = function (deliveryId, expectedVersion) {
    var res = courierRun(deliveryId, expectedVersion, 'delivery.accept', function (d, dl) {
      if (dv.offerExpired(dl)) { release(d, dl, 'Penawaran kedaluwarsa saat diterima'); return { expired: true }; }
      transition(d, dl, 'ACCEPTED', { reason: 'Diterima kurir' });
      return { expired: false, delivery: dl };
    }, true);
    if (res.expired) throw Orbis.Err('OFFER_EXPIRED', 'Penawaran sudah kedaluwarsa dan dikembalikan ke antrean');
    return res.delivery;
  };
  dv.reject = function (deliveryId, reason, expectedVersion) {
    return courierRun(deliveryId, expectedVersion, 'delivery.reject', function (d, dl) {
      reason = Orbis.reason(reason, 'Alasan menolak');
      release(d, dl, 'Ditolak kurir: ' + reason);
      return dl;
    });
  };
  dv.pickup = function (deliveryId, checklist, expectedVersion) {
    return courierRun(deliveryId, expectedVersion, 'delivery.pickup', function (d, dl) {
      checklist = checklist || {};
      CHECKLIST.forEach(function (k) {
        if (checklist[k] !== true) throw Orbis.Err('CHECKLIST_INCOMPLETE', 'Checklist pickup belum lengkap (' + k + ')');
      });
      transition(d, dl, 'PICKED_UP', { reason: 'Checklist pickup lengkap' });
      dl.checklist = { items: true, packaging: true, label: true, address: true, at: Orbis.clock.now() };
      return dl;
    });
  };
  dv.start = function (deliveryId, expectedVersion) {
    return courierRun(deliveryId, expectedVersion, 'delivery.start', function (d, dl) { return transition(d, dl, 'IN_TRANSIT', { reason: 'Mulai antar' }); });
  };
  dv.arrive = function (deliveryId, expectedVersion) {
    return courierRun(deliveryId, expectedVersion, 'delivery.arrive', function (d, dl) { return transition(d, dl, 'ARRIVED', { reason: 'Tiba di tujuan' }); });
  };
  dv.fail = function (deliveryId, reason, expectedVersion) {
    return courierRun(deliveryId, expectedVersion, 'delivery.fail', function (d, dl) {
      reason = Orbis.reason(reason, 'Alasan gagal kirim');
      transition(d, dl, 'DELIVERY_FAILED', { reason: reason });
      dl.attempts += 1; dl.failReason = reason;
      return dl;
    });
  };
  /** spec {receiver, method:'otp'|'photo'|'signature', otp?, photo?:{name,size}, signature?, codAmount?} */
  dv.pod = function (deliveryId, spec, expectedVersion) {
    return courierRun(deliveryId, expectedVersion, 'delivery.pod', function (d, dl) {
      spec = spec || {};
      var receiver = String(spec.receiver || '').trim();
      Orbis.need(receiver.length >= 3, 'POD_INVALID', 'Nama penerima minimal 3 karakter');
      var proof;
      if (spec.method === 'otp') {
        Orbis.need(String(spec.otp || '') === DEMO_OTP, 'POD_INVALID', 'Kode OTP salah');
        proof = { kind: 'otp' };
      } else if (spec.method === 'photo') {
        var p = spec.photo || {};
        Orbis.need(/\.(jpe?g|png)$/i.test(String(p.name || '')), 'POD_INVALID', 'Foto harus berformat JPG atau PNG');
        Orbis.need(typeof p.size === 'number' && p.size > 0 && p.size <= MAX_PHOTO, 'POD_INVALID', 'Ukuran foto maksimal 3 MB');
        proof = { kind: 'photo', filename: String(p.name), size: p.size };   // metadata only; media stays private
      } else if (spec.method === 'signature') {
        Orbis.need(String(spec.signature || '').trim().length >= 3, 'POD_INVALID', 'Tanda tangan (nama) minimal 3 karakter');
        proof = { kind: 'signature', signedBy: String(spec.signature).trim() };
      } else throw Orbis.Err('POD_INVALID', 'Metode bukti belum dipilih');
      var cod = dl.codAmount || 0;
      if (cod > 0) {
        Orbis.int(spec.codAmount, 'Nominal COD');
        if (spec.codAmount !== cod) throw Orbis.Err('COD_MISMATCH', 'Nominal COD harus tepat ' + Orbis.idr(cod));
      }
      transition(d, dl, 'DELIVERED', { reason: 'POD ' + proof.kind });
      dl.pod = { receiver: receiver, method: proof.kind, proof: proof, at: Orbis.clock.now(), codCollected: cod };
      dl.proofReview = { status: 'PENDING', by: null, at: null, reason: null };
      orderComplete(d, dl.orderId);
      if (cod > 0) orderPay(d, dl.orderId, 'COD_COLLECTED');
      return dl;
    });
  };
  dv.returnHandoff = function (deliveryId, expectedVersion) {
    return courierRun(deliveryId, expectedVersion, 'delivery.returnHandoff', function (d, dl) {
      Orbis.need(dl.status === 'RETURN_TO_STORE', 'INVALID_TRANSITION', 'Serah terima retur hanya saat RETURN_TO_STORE');
      Orbis.need(!dl.returnHandoffAt, 'ALREADY_DECIDED', 'Barang sudah diserahkan');
      dl.returnHandoffAt = Orbis.clock.now();
      touch(d, dl, 'Barang retur diserahkan kurir ke toko');
      return dl;
    });
  };

  /* ---------- exceptions (dispatch side) ---------- */
  dv.retry = function (deliveryId, expectedVersion) {
    Orbis.require('delivery.dispatch');
    return Orbis.tx(function (d) {
      var dl = find(d, deliveryId);
      checkVersion(dl, expectedVersion);
      Orbis.need(dl.status === 'DELIVERY_FAILED', 'INVALID_TRANSITION', 'Retry hanya untuk pengiriman gagal');
      if (dl.attempts >= MAX_ATTEMPTS) throw Orbis.Err('MAX_ATTEMPTS', 'Batas percobaan (' + MAX_ATTEMPTS + ') tercapai, lakukan retur');
      transition(d, dl, 'RETRY_PENDING', { reason: 'Percobaan ulang' });
      transition(d, dl, 'READY_FOR_ASSIGNMENT', { reason: 'Masuk antrean ulang' });
      dl.courierId = null; dl.offerExpiresAt = null; dl.dueAt = null;
      return dl;
    }, { audit: { action: 'delivery.retry', entity: 'delivery', entityId: deliveryId } });
  };
  dv.returnToStore = function (deliveryId, expectedVersion) {
    Orbis.require('delivery.dispatch');
    return Orbis.tx(function (d) {
      var dl = find(d, deliveryId);
      checkVersion(dl, expectedVersion);
      return transition(d, dl, 'RETURN_TO_STORE', { reason: 'Dikembalikan ke toko' });
    }, { audit: { action: 'delivery.return', entity: 'delivery', entityId: deliveryId } });
  };
  /** condition SELLABLE restocks the order items; DAMAGED / QUARANTINE never touch stock. */
  dv.returnCheckin = function (deliveryId, condition, expectedVersion) {
    Orbis.require('delivery.dispatch');
    return Orbis.tx(function (d) {
      var dl = find(d, deliveryId);
      checkVersion(dl, expectedVersion);
      Orbis.need(['SELLABLE', 'DAMAGED', 'QUARANTINE'].indexOf(condition) >= 0, 'VALIDATION', 'Kondisi barang tidak valid');
      Orbis.need(dl.status === 'RETURN_TO_STORE', 'INVALID_TRANSITION', 'Check-in hanya untuk RETURN_TO_STORE');
      Orbis.need(dl.returnHandoffAt, 'HANDOFF_REQUIRED', 'Kurir harus menyerahkan barang terlebih dahulu');
      var order = orderOf(d, dl);
      if (condition === 'SELLABLE' && order) {
        order.items.forEach(function (it) {
          Orbis.domain.inventory.move(d, { skuId: it.skuId, qty: it.qty, type: 'RETURN_RESTOCK', ref: dl.id, outlet: dl.outlet, note: 'Retur COD/kirim gagal' });
        });
      }
      transition(d, dl, 'RETURNED', { reason: 'Check-in ' + condition });
      dl.returnCondition = condition;
      orderReturned(d, dl.orderId);
      return dl;
    }, { audit: { action: 'delivery.returnCheckin', entity: 'delivery', entityId: deliveryId } });
  };
  dv.reviewProof = function (deliveryId, decision, reason) {
    Orbis.require('cod.review');
    return Orbis.tx(function (d) {
      var dl = find(d, deliveryId);
      Orbis.need(dl.status === 'DELIVERED' && dl.proofReview, 'INVALID_TRANSITION', 'Belum ada bukti untuk ditinjau');
      Orbis.need(dl.proofReview.status === 'PENDING', 'ALREADY_DECIDED', 'Bukti sudah ditinjau');
      Orbis.need(decision === 'APPROVED' || decision === 'FLAGGED', 'VALIDATION', 'Keputusan tidak valid');
      if (decision === 'FLAGGED') reason = Orbis.reason(reason, 'Alasan flag');
      dl.proofReview = { status: decision, by: d.session.actor, at: Orbis.clock.now(), reason: reason || null };
      return dl;
    }, { audit: { action: 'delivery.proofReview', entity: 'delivery', entityId: deliveryId } });
  };

  /* ---------- location (foreground, consent) ---------- */
  dv.setLocation = function (loc) {
    Orbis.require('delivery.courier');
    return Orbis.tx(function (d) {
      loc = loc || {};
      if (loc.consent !== true) throw Orbis.Err('CONSENT_REQUIRED', 'Lokasi hanya dibagikan dengan persetujuan Anda');
      Orbis.need(typeof loc.lat === 'number' && typeof loc.lng === 'number' && Math.abs(loc.lat) <= 90 && Math.abs(loc.lng) <= 180, 'VALIDATION', 'Koordinat tidak valid');
      var c = dv.myCourier(d);
      Orbis.need(c, 'NOT_FOUND', 'Profil kurir tidak ditemukan');
      var row = courierRow(d, c.id);
      row.location = { lat: loc.lat, lng: loc.lng, at: Orbis.clock.now(), foreground: true };
      return row.location;
    }, { audit: { action: 'courier.location', entity: 'courier' } });
  };
  dv.clearLocation = function () {
    Orbis.require('delivery.courier');
    return Orbis.tx(function (d) {
      var c = dv.myCourier(d);
      Orbis.need(c, 'NOT_FOUND', 'Profil kurir tidak ditemukan');
      courierRow(d, c.id).location = null;
      return true;
    }, { audit: { action: 'courier.locationOff', entity: 'courier' } });
  };
  dv.isStale = function (courier, now) {
    if (!courier || !courier.location) return true;
    return (now == null ? Orbis.clock.now() : now) - courier.location.at > STALE_LOC;
  };

  /* ---------- COD / remittance (single path) ---------- */
  function rems(d, deliveryId, status) {
    return Orbis.mine(d, 'remittances').filter(function (r) { return r.deliveryId === deliveryId && (!status || r.status === status); });
  }
  dv.outstanding = function (d, deliveryId) {
    var dl = find(d, deliveryId);
    return (dl.codAmount || 0) - Orbis.sum(rems(d, deliveryId, 'VERIFIED'), function (r) { return r.amount; });
  };
  dv.pendingAmount = function (d, deliveryId) { return Orbis.sum(rems(d, deliveryId, 'SUBMITTED'), function (r) { return r.amount; }); };
  dv.remittances = function (d) { return Orbis.mine(d, 'remittances'); };
  /** COD deliveries delivered by this courier that still have money to submit. */
  dv.cashDue = function (d, courierId) {
    return Orbis.mine(d, 'deliveries').filter(function (x) {
      return x.courierId === courierId && x.status === 'DELIVERED' && x.codAmount > 0;
    }).map(function (x) {
      var out = dv.outstanding(d, x.id), pend = dv.pendingAmount(d, x.id);
      return { delivery: x, outstanding: out, pending: pend, submittable: out - pend };
    });
  };
  dv.submitRemittance = function (deliveryId, amount) {
    Orbis.require('delivery.courier');
    return Orbis.tx(function (d) {
      var dl = find(d, deliveryId);
      if (dl.courierId !== sessionCourierId(d)) throw Orbis.Err('FORBIDDEN', 'Pengiriman ini bukan milik kurir Anda');
      Orbis.need(dl.status === 'DELIVERED', 'INVALID_TRANSITION', 'Setoran hanya untuk pengiriman yang sudah terkirim');
      Orbis.int(amount, 'Nominal setoran');
      var room = dv.outstanding(d, deliveryId) - dv.pendingAmount(d, deliveryId);
      if (!(amount > 0 && amount <= room)) throw Orbis.Err('REMIT_EXCEEDS', 'Setoran harus > 0 dan maksimal ' + Orbis.idr(Math.max(room, 0)));
      var r = { id: Orbis.nextId(d, 'RMT', 4), tenant: d.session.tenant, deliveryId: dl.id, orderId: dl.orderId, courierId: dl.courierId, amount: amount, status: 'SUBMITTED', reason: null, at: Orbis.clock.now(), decidedBy: null };
      d.remittances.push(r);
      return r;
    }, { audit: { action: 'cod.submit', entity: 'delivery', entityId: deliveryId } });
  };
  dv.reviewRemittance = function (remittanceId, decision, reason) {
    Orbis.require('cod.review');
    return Orbis.tx(function (d) {
      var r = Orbis.mine(d, 'remittances').filter(function (x) { return x.id === remittanceId; })[0];
      Orbis.need(r, 'NOT_FOUND', 'Setoran tidak ditemukan');
      Orbis.need(decision === 'VERIFY' || decision === 'DISPUTE', 'VALIDATION', 'Keputusan tidak valid');
      if (r.status !== 'SUBMITTED') throw Orbis.Err('ALREADY_DECIDED', 'Setoran sudah diputuskan');
      if (decision === 'DISPUTE') {
        r.reason = Orbis.reason(reason, 'Alasan sengketa');
        r.status = 'DISPUTED';
      } else {
        r.status = 'VERIFIED';
      }
      r.decidedBy = d.session.actor; r.decidedAt = Orbis.clock.now();
      if (r.status === 'VERIFIED' && dv.outstanding(d, r.deliveryId) <= 0) orderPay(d, r.orderId, 'PAID');
      return r;
    }, { audit: { action: 'cod.' + String(decision).toLowerCase(), entity: 'remittance', entityId: remittanceId } });
  };

  /* ---------- SLA ---------- */
  dv.assignmentOverdue = function (dl, now) {
    return dl.status === 'READY_FOR_ASSIGNMENT' && (now == null ? Orbis.clock.now() : now) - dl.createdAt > ASSIGN_SLA;
  };
  dv.deliveryOverdue = function (dl, now) {
    return ACTIVE.indexOf(dl.status) >= 0 && dl.dueAt != null && (now == null ? Orbis.clock.now() : now) > dl.dueAt;
  };
})(typeof window !== 'undefined' ? window : globalThis);
