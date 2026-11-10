/* Orbis v2 — sales domain: orders (place + status machine), shifts/cash drawer, held carts, refunds/returns.
   ONE refund path (request -> approve/reject) replaces the three conflicting ones in the old prototype.
   Money is integer IDR; stock only via inventory.move; every mutation is a tx with audit. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis;
  var inv = Orbis.domain.inventory;
  var orders = Orbis.domain.orders = {};
  var shifts = Orbis.domain.shifts = {};
  var carts = Orbis.domain.carts = {};
  var refunds = Orbis.domain.refunds = {};

  Orbis.PERMS['pos.settings'] = ['owner', 'manager'];

  var DELIVERY_FEE = 10000;
  var METHODS = ['pickup', 'dine', 'delivery'];
  var TENDERS = ['cash', 'transfer', 'qris'];
  var PAY_STATUSES = ['PENDING', 'PAID', 'COLLECTION_PENDING', 'COD_COLLECTED', 'PARTIALLY_REFUNDED', 'REFUNDED'];
  var NEXT = { PLACED: ['ACCEPTED', 'CANCELLED'], ACCEPTED: ['PREPARING', 'CANCELLED'], PREPARING: ['READY', 'CANCELLED'], READY: ['COMPLETED', 'RETURNED', 'CANCELLED'] };
  var REFUNDABLE = ['PAID', 'PARTIALLY_REFUNDED', 'COD_COLLECTED'];

  orders.DELIVERY_FEE = DELIVERY_FEE;

  function sameTenant(r, d) { return r.tenant === d.session.tenant; }
  function find(d, coll, id) { return (d[coll] || []).filter(function (r) { return r.id === id && sameTenant(r, d); })[0]; }
  function registerKey(d) { return d.session.tenant + '|' + d.session.outlet; }
  function dom(name, fn) { var m = Orbis.domain[name]; return m && typeof m[fn] === 'function' ? m : null; }

  /* ================= settings ================= */
  orders.settings = function (d) {
    var s = (d.posSettings || {})[d.session.tenant] || {};
    return { tax: s.tax || 0, service: s.service || 0 };
  };
  orders.setSettings = function (tax, service) {
    Orbis.require('pos.settings');
    [tax, service].forEach(function (v) {
      if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 30) throw Orbis.Err('VALIDATION', 'Pajak/service harus 0-30%');
    });
    return Orbis.tx(function (d) {
      d.posSettings = d.posSettings || {};
      d.posSettings[d.session.tenant] = { tax: tax, service: service };
      return d.posSettings[d.session.tenant];
    }, { audit: { action: 'pos.settings', entity: 'tenant', entityId: Orbis.db().session.tenant } });
  };

  /* ================= reads ================= */
  orders.list = function (d) { return Orbis.mine(d, 'orders').slice().sort(function (a, b) { return b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1); }); };
  orders.get = function (d, id) { return find(d, 'orders', id) || null; };
  orders.payments = function (d, orderId) { return Orbis.mine(d, 'payments').filter(function (p) { return p.orderId === orderId; }); };
  function must(d, id) { var o = find(d, 'orders', id); if (!o) throw Orbis.Err('NOT_FOUND', 'Pesanan tidak ditemukan'); return o; }

  /* ================= pricing (pure) ================= */
  function validPhone(p) {
    var s = String(p == null ? '' : p).trim();
    if (!/^\+?[0-9\s-]+$/.test(s)) return false;
    var n = s.replace(/\D/g, '').length;
    return n >= 9 && n <= 15;
  }

  /** Compute lines and totals from server-side prices. Does NOT mutate; promo.quote/member.preview must not mutate either. */
  orders.quote = function (d, spec) {
    spec = spec || {};
    var channel = spec.channel || 'pos';
    Orbis.need(channel === 'pos' || channel === 'store', 'VALIDATION', 'Kanal tidak valid');
    var method = spec.method || 'pickup';
    Orbis.need(METHODS.indexOf(method) >= 0, 'VALIDATION', 'Metode pesanan tidak valid');
    Orbis.need(Array.isArray(spec.items) && spec.items.length > 0, 'EMPTY_CART', 'Keranjang kosong');
    // lines with identical sku + modifier set + note merge; different modifiers stay separate lines
    var picks = {}, order = [];
    spec.items.forEach(function (it) {
      Orbis.int(it.qty, 'Qty');
      Orbis.need(it.qty >= 1, 'VALIDATION', 'Qty minimal 1');
      var mods = Array.isArray(it.modifiers) ? it.modifiers.slice().sort() : [];
      var key = it.skuId + '|' + mods.join(',') + '|' + (it.note || '');
      if (!picks[key]) { picks[key] = { skuId: it.skuId, qty: 0, modifiers: mods, note: it.note || '' }; order.push(key); }
      picks[key].qty += it.qty;
    });
    var H = Orbis.hooks, outlet = d.session.outlet;
    var items = order.map(function (key) {
      var src = picks[key], skuId = src.skuId;
      var sku = d.skus.filter(function (s) { return s.id === skuId && s.tenant === d.session.tenant; })[0];
      Orbis.need(sku, 'NOT_FOUND', 'SKU tidak ditemukan');
      Orbis.need(!sku.archived, 'NOT_FOUND', 'SKU sudah diarsipkan');
      var p = d.products.filter(function (x) { return x.id === sku.productId; })[0] || {};
      Orbis.need(!p.archived, 'NOT_FOUND', 'Produk sudah diarsipkan');
      var name = (p.name || sku.sku) + (sku.label && sku.label !== 'Standar' ? ' - ' + sku.label : '');
      var hp = H.skuPrice ? H.skuPrice(d, sku, outlet) : undefined;
      var price = Orbis.int(hp == null ? sku.price : hp, 'Harga');
      var mods = src.modifiers && src.modifiers.length ? (H.resolveModifiers ? H.resolveModifiers(d, sku, src.modifiers) : null) : [];
      Orbis.need(mods, 'VALIDATION', 'Modifier belum didukung');
      var line = { skuId: skuId, name: name, qty: src.qty, price: price + Orbis.sum(mods, function (m) { return Orbis.int(m.price, 'Harga modifier'); }), cost: Orbis.int(sku.cost, 'HPP') };
      if (mods.length) { line.modifiers = mods.map(function (m) { return { id: m.id, name: m.name, price: m.price }; }); line.basePrice = price; }
      if (src.note) line.note = String(src.note).trim().slice(0, 120);
      return line;
    });
    var subtotal = Orbis.sum(items, function (i) { return i.qty * i.price; });
    var customer = { name: String((spec.customer && spec.customer.name) || '').trim(), phone: String((spec.customer && spec.customer.phone) || '').trim() };
    var address = String(spec.address || '').trim();
    if (method === 'delivery') {
      Orbis.need(address, 'VALIDATION', 'Alamat pengiriman wajib diisi');
      Orbis.need(customer.name, 'VALIDATION', 'Nama penerima wajib diisi');
      Orbis.need(validPhone(customer.phone), 'VALIDATION', 'Nomor telepon harus 9-15 digit');
    } else if (customer.phone) {
      Orbis.need(validPhone(customer.phone), 'VALIDATION', 'Nomor telepon harus 9-15 digit');
    }
    var promo = null, redeem = 0, redeemPoints = 0;
    if (spec.promoCode) {
      var pm = dom('promos', 'quote');
      Orbis.need(pm, 'PROMO_UNAVAILABLE', 'Fitur promo belum tersedia');
      var q = pm.quote(d, { code: spec.promoCode, subtotal: subtotal, channel: channel });
      promo = { promoId: q.promoId, discount: Orbis.int(q.discount, 'Diskon') };
    }
    if (spec.redeemPoints) {
      Orbis.int(spec.redeemPoints, 'Poin');
      Orbis.need(spec.redeemPoints > 0 && spec.memberId, 'VALIDATION', 'Penukaran poin butuh member');
      var mm = dom('members', 'preview');
      Orbis.need(mm, 'MEMBER_UNAVAILABLE', 'Fitur member belum tersedia');
      var pv = mm.preview(d, { memberId: spec.memberId, subtotal: subtotal, redeemPoints: spec.redeemPoints });
      redeem = Orbis.int(pv.redeemValue || 0, 'Nilai poin'); redeemPoints = spec.redeemPoints;
    }
    var discount = Math.min(subtotal, (promo ? promo.discount : 0) + redeem);
    var st = orders.settings(d);
    var base = subtotal - discount;
    var tax = Math.round(base * st.tax / 100), service = Math.round(base * st.service / 100), rounding = 0;
    if (H.charges) {
      var ch = H.charges(d, { base: base, outlet: outlet, channel: channel, method: method });
      tax = Orbis.int(ch.tax, 'Pajak'); service = Orbis.int(ch.service, 'Service'); rounding = Orbis.int(ch.rounding || 0, 'Pembulatan');
      if (ch.taxLabel) var taxLabel = String(ch.taxLabel);
    }
    var deliveryFee = method === 'delivery' ? DELIVERY_FEE : 0;
    return {
      channel: channel, method: method, items: items, customer: customer, address: address, subtotal: subtotal, discount: discount,
      promo: promo, redeemValue: redeem, redeemPoints: redeemPoints, tax: tax, taxLabel: taxLabel || 'Pajak', service: service, rounding: rounding, deliveryFee: deliveryFee,
      total: base + tax + service + rounding + deliveryFee
    };
  };

  /* ================= payment normalisation ================= */
  function normalisePayment(spec, total, method) {
    var pay = spec.payment || { type: 'cash' };
    var type = pay.type || 'cash', legs;
    Orbis.need(total > 0, 'VALIDATION', 'Total pesanan harus lebih dari 0');
    if (type === 'cod') {
      Orbis.need(method === 'delivery', 'COD_NOT_ALLOWED', 'COD hanya untuk pesanan delivery');
      return { legs: [{ type: 'cod', amount: total }], status: 'COLLECTION_PENDING', tendered: 0, change: 0 };
    }
    if (type === 'split') {
      Orbis.need(Array.isArray(pay.legs) && pay.legs.length >= 1, 'VALIDATION', 'Pembayaran split butuh minimal satu bagian');
      legs = pay.legs.map(function (l) {
        Orbis.need(TENDERS.indexOf(l.type) >= 0, 'VALIDATION', 'Jenis pembayaran tidak valid');
        Orbis.int(l.amount, 'Nominal pembayaran');
        Orbis.need(l.amount > 0, 'VALIDATION', 'Nominal pembayaran harus lebih dari 0');
        return { type: l.type, amount: l.amount };
      });
      var s = Orbis.sum(legs, function (l) { return l.amount; });
      Orbis.need(s === total, 'SPLIT_MISMATCH', 'Total split (' + Orbis.idr(s) + ') harus sama dengan total (' + Orbis.idr(total) + ')');
    } else {
      Orbis.need(TENDERS.indexOf(type) >= 0, 'VALIDATION', 'Jenis pembayaran tidak valid');
      legs = [{ type: type, amount: total }];
    }
    if (Orbis.hooks.tenderEnabled && spec._d) {
      legs.forEach(function (l) { Orbis.need(Orbis.hooks.tenderEnabled(spec._d, l.type) !== false, 'TENDER_DISABLED', 'Metode ' + l.type + ' tidak aktif di pengaturan'); });
    }
    var cashDue = Orbis.sum(legs.filter(function (l) { return l.type === 'cash'; }), function (l) { return l.amount; });
    var tendered = cashDue, change = 0;
    if (cashDue > 0 && pay.tendered != null) {
      Orbis.int(pay.tendered, 'Uang diterima');
      Orbis.need(pay.tendered >= cashDue, 'CASH_SHORT', 'Uang diterima kurang dari tagihan tunai');
      tendered = pay.tendered; change = tendered - cashDue;
    }
    return { legs: legs, status: 'PAID', tendered: cashDue ? tendered : 0, change: change };
  }

  /* ================= place order (inside caller's tx) ================= */
  orders.place = function (d, spec) {
    spec = spec || {};
    var channel = spec.channel || 'pos';
    if (channel === 'pos') Orbis.require('pos.sell');
    var tenantRow = d.tenants.filter(function (t) { return t.id === d.session.tenant; })[0];
    Orbis.need(tenantRow && tenantRow.status !== 'SUSPENDED', 'TENANT_SUSPENDED', 'Tenant sedang ditangguhkan; transaksi baru ditolak');
    var q = orders.quote(d, spec);
    var pay = normalisePayment(Object.assign({ _d: d }, spec), q.total, q.method);
    var hasCash = pay.legs.some(function (l) { return l.type === 'cash'; });
    var shift = null;
    if (channel === 'pos') {
      if (spec.shiftId) {
        shift = find(d, 'shifts', spec.shiftId);
        Orbis.need(shift && shift.register === registerKey(d), 'NOT_FOUND', 'Shift tidak ditemukan');
        Orbis.need(!shift.closedAt, 'SHIFT_CLOSED', 'Shift sudah ditutup');
      } else {
        shift = shifts.current(d);
      }
      if (hasCash) Orbis.need(shift, 'NO_OPEN_SHIFT', 'Buka shift kasir sebelum menerima pembayaran tunai');
    }
    var id = Orbis.nextId(d, 'ORD', 4), now = Orbis.clock.now();
    // atomic stock: any shortage throws and the caller's tx rolls back every line
    q.items.forEach(function (it) { inv.move(d, { skuId: it.skuId, qty: -it.qty, type: 'SALE', ref: id, note: 'Penjualan ' + id }); });
    var status = pay.status === 'PAID' ? 'ACCEPTED' : 'PLACED';
    var order = {
      id: id, tenant: d.session.tenant, outlet: d.session.outlet, channel: channel, customer: q.customer, items: q.items,
      subtotal: q.subtotal, discount: q.discount, tax: q.tax, taxLabel: q.taxLabel, service: q.service, rounding: q.rounding, deliveryFee: q.deliveryFee, total: q.total,
      method: q.method, address: q.address, status: status, paymentStatus: pay.status, shiftId: shift ? shift.id : null,
      memberId: spec.memberId || null, promoId: q.promo ? q.promo.promoId : null, tendered: pay.tendered, change: pay.change,
      refunded: 0, refundDue: 0, createdAt: now, createdBy: d.session.actor,
      history: [{ at: now, by: d.session.actor, from: null, to: status }]
    };
    d.orders.push(order);
    pay.legs.filter(function (l) { return l.type !== 'cod'; }).forEach(function (l) {   // COD cash is recorded only when verified
      d.payments.push({ id: Orbis.nextId(d, 'PAY', 5), tenant: d.session.tenant, orderId: id, type: l.type, amount: l.amount, at: now, shiftId: shift ? shift.id : null });
    });
    if (q.promo) { var pm = dom('promos', 'consume'); if (pm) pm.consume(d, q.promo.promoId, id); }
    if (spec.memberId) { var mm = dom('members', 'commit'); if (mm) mm.commit(d, { memberId: spec.memberId, orderId: id, total: q.total, redeemPoints: q.redeemPoints }); }
    return order;
  };

  /** Public wrapper for screens: one atomic transaction. */
  orders.checkout = function (spec) {
    return Orbis.tx(function (d) { return orders.place(d, spec); }, { audit: function (o) { return { action: 'order.place', entity: 'order', entityId: o.id }; } });
  };

  /* ================= status machine ================= */
  function pushHistory(d, o, to) {
    o.history.push({ at: Orbis.clock.now(), by: d.session.actor, from: o.status, to: to });
    o.status = to;
  }
  /** Generic guarded transition (inside caller's tx). */
  orders.transition = function (d, id, to) {
    var o = must(d, id);
    var allowed = NEXT[o.status] || [];
    if (allowed.indexOf(to) < 0) throw Orbis.Err('INVALID_TRANSITION', 'Status ' + o.status + ' tidak bisa menjadi ' + to);
    if (o.status === 'PLACED' && to === 'ACCEPTED' && o.paymentStatus !== 'PAID' && o.paymentStatus !== 'COLLECTION_PENDING') {
      throw Orbis.Err('PAYMENT_REQUIRED', 'Pesanan belum dibayar');
    }
    pushHistory(d, o, to);
    if (to === 'READY' && o.method === 'delivery') {
      var dl = dom('delivery', 'enqueue'); if (dl) dl.enqueue(d, o);
    }
    return o;
  };
  orders.complete = function (d, id) { return orders.transition(d, id, 'COMPLETED'); };

  /** Advance one step. Delivery orders stop at READY (finished by the delivery module via orders.complete). */
  orders.advanceIn = function (d, id) {
    Orbis.require('order.advance');
    var o = must(d, id);
    var map = { PLACED: 'ACCEPTED', ACCEPTED: 'PREPARING', PREPARING: 'READY', READY: 'COMPLETED' };
    var to = map[o.status];
    if (!to) throw Orbis.Err('INVALID_TRANSITION', 'Pesanan sudah selesai atau dibatalkan');
    if (o.status === 'READY' && o.method === 'delivery') throw Orbis.Err('INVALID_TRANSITION', 'Pesanan delivery diselesaikan lewat modul pengiriman');
    return orders.transition(d, id, to);
  };
  orders.advance = function (id) {
    return Orbis.tx(function (d) { return orders.advanceIn(d, id); }, { audit: function (o) { return { action: 'order.advance', entity: 'order', entityId: o.id, detail: o.status }; } });
  };

  function refundDueNow(o) {
    return REFUNDABLE.indexOf(o.paymentStatus) >= 0 ? Math.max(0, o.total - (o.refunded || 0)) : 0;
  }

  /** Returned-to-store (delivery failed). Money is never silently refunded; paid orders get refundDue. */
  orders.markReturned = function (d, id, opts) {
    var o = must(d, id);
    if ((NEXT[o.status] || []).indexOf('RETURNED') < 0) throw Orbis.Err('INVALID_TRANSITION', 'Pesanan tidak bisa ditandai retur dari status ' + o.status);
    pushHistory(d, o, 'RETURNED');
    if (opts && opts.restock === true) {
      o.items.forEach(function (it) { inv.move(d, { skuId: it.skuId, qty: it.qty, type: 'SALE_REVERSAL', ref: o.id, outlet: o.outlet, note: 'Retur pengiriman ' + o.id }); });
    }
    o.refundDue = refundDueNow(o);
    return o;
  };

  orders.setPaymentStatus = function (d, id, status) {
    Orbis.need(PAY_STATUSES.indexOf(status) >= 0, 'VALIDATION', 'Status pembayaran tidak valid');
    var o = must(d, id);
    // COD cash becomes a payment row only once finance verifies it (QA D7); written once per order
    if (status === 'PAID' && (o.paymentStatus === 'COLLECTION_PENDING' || o.paymentStatus === 'COD_COLLECTED') &&
        !Orbis.mine(d, 'payments').some(function (p) { return p.orderId === o.id && p.type === 'cod'; })) {
      d.payments.push({ id: Orbis.nextId(d, 'PAY', 5), tenant: d.session.tenant, orderId: o.id, type: 'cod', amount: o.total, at: Orbis.clock.now(), shiftId: null });
    }
    o.paymentStatus = status;
    return o;
  };

  orders.cancel = function (id, reason) {
    Orbis.require('order.cancel');
    reason = Orbis.reason(reason, 'Alasan pembatalan');
    return Orbis.tx(function (d) {
      var o = must(d, id);
      if (o.status === 'COMPLETED' || o.status === 'CANCELLED' || o.status === 'RETURNED') throw Orbis.Err('INVALID_TRANSITION', 'Pesanan ' + o.status + ' tidak bisa dibatalkan');
      pushHistory(d, o, 'CANCELLED');
      o.history[o.history.length - 1].reason = reason;
      o.cancelReason = reason;
      o.items.forEach(function (it) { inv.move(d, { skuId: it.skuId, qty: it.qty, type: 'SALE_REVERSAL', ref: o.id, outlet: o.outlet, note: 'Batal: ' + reason }); });
      var mm = dom('members', 'reverse'); if (mm && o.memberId) mm.reverse(d, o.id, 1);
      o.refundDue = refundDueNow(o);   // flag only: the refund itself goes through refunds.request/approve
      return o;
    }, { audit: function (o) { return { action: 'order.cancel', entity: 'order', entityId: o.id, detail: reason }; } });
  };

  /* ================= shifts ================= */
  shifts.current = function (d) {
    var key = registerKey(d);
    return Orbis.mine(d, 'shifts').filter(function (s) { return s.register === key && !s.closedAt; })[0] || null;
  };
  shifts.list = function (d) { return Orbis.mine(d, 'shifts').slice().sort(function (a, b) { return b.openedAt - a.openedAt; }); };
  shifts.events = function (d, shiftId) { return Orbis.mine(d, 'cashEvents').filter(function (e) { return e.shiftId === shiftId; }); };
  /** Breakdown: expected = opening + cash payments (net of refunds) + IN - OUT. */
  shifts.summary = function (d, shift) {
    var cashNet = Orbis.sum(Orbis.mine(d, 'payments').filter(function (p) { return p.shiftId === shift.id && p.type === 'cash'; }), function (p) { return p.amount; });
    var ev = shifts.events(d, shift.id);
    var cin = Orbis.sum(ev.filter(function (e) { return e.type === 'IN'; }), function (e) { return e.amount; });
    var cout = Orbis.sum(ev.filter(function (e) { return e.type === 'OUT'; }), function (e) { return e.amount; });
    return { opening: shift.openingCash, cashNet: cashNet, cashIn: cin, cashOut: cout, expected: shift.openingCash + cashNet + cin - cout };
  };
  shifts.expected = function (d, shift) { return shifts.summary(d, shift).expected; };

  shifts.open = function (openingCash) {
    Orbis.require('shift.operate');
    Orbis.int(openingCash, 'Kas awal');
    Orbis.need(openingCash >= 0, 'VALIDATION', 'Kas awal tidak boleh negatif');
    return Orbis.tx(function (d) {
      if (shifts.current(d)) throw Orbis.Err('SHIFT_ALREADY_OPEN', 'Register ini masih punya shift terbuka');
      var s = { id: Orbis.nextId(d, 'SHF', 4), tenant: d.session.tenant, outlet: d.session.outlet, register: registerKey(d), openedBy: d.session.actor, openedAt: Orbis.clock.now(), openingCash: openingCash, closedAt: null, countedCash: null, variance: null, note: null };
      d.shifts.push(s);
      return s;
    }, { audit: function (s) { return { action: 'shift.open', entity: 'shift', entityId: s.id }; } });
  };

  function target(d, shiftId) {
    var s = shiftId ? find(d, 'shifts', shiftId) : shifts.current(d);
    if (!s) throw Orbis.Err(shiftId ? 'NOT_FOUND' : 'NO_OPEN_SHIFT', shiftId ? 'Shift tidak ditemukan' : 'Tidak ada shift terbuka');
    if (s.closedAt) throw Orbis.Err('SHIFT_CLOSED', 'Shift sudah ditutup');
    return s;
  }

  /** type 'IN'|'OUT'. shiftId optional (defaults to the open shift of this register). */
  shifts.cashEvent = function (type, amount, reason, shiftId) {
    Orbis.require('shift.operate');
    Orbis.need(type === 'IN' || type === 'OUT', 'VALIDATION', 'Jenis kas harus IN atau OUT');
    Orbis.int(amount, 'Nominal kas');
    Orbis.need(amount > 0, 'VALIDATION', 'Nominal harus lebih dari 0');
    reason = Orbis.reason(reason, 'Alasan kas');
    return Orbis.tx(function (d) {
      var s = target(d, shiftId);
      if (type === 'OUT' && amount > shifts.expected(d, s)) throw Orbis.Err('CASH_OVER_EXPECTED', 'Kas keluar melebihi kas yang seharusnya ada di laci');
      var e = { id: Orbis.nextId(d, 'CEV', 4), tenant: d.session.tenant, shiftId: s.id, type: type, amount: amount, reason: reason, at: Orbis.clock.now(), by: d.session.actor };
      d.cashEvents.push(e);
      return e;
    }, { audit: function (e) { return { action: 'shift.cash' + e.type.toLowerCase(), entity: 'shift', entityId: e.shiftId, detail: e.amount + ' ' + e.reason }; } });
  };

  shifts.close = function (countedCash, note, shiftId) {
    Orbis.require('shift.operate');
    Orbis.int(countedCash, 'Kas dihitung');
    Orbis.need(countedCash >= 0, 'VALIDATION', 'Kas dihitung tidak boleh negatif');
    return Orbis.tx(function (d) {
      var s = target(d, shiftId);
      var exp = shifts.expected(d, s), variance = countedCash - exp;
      if (variance !== 0) note = Orbis.reason(note, 'Catatan selisih kas');
      s.closedAt = Orbis.clock.now(); s.closedBy = d.session.actor; s.countedCash = countedCash; s.expectedCash = exp; s.variance = variance; s.note = note ? String(note).trim() : null;
      return s;
    }, { audit: function (s) { return { action: 'shift.close', entity: 'shift', entityId: s.id, detail: 'selisih ' + s.variance }; } });
  };

  /* ================= held carts ================= */
  carts.list = function (d) { return Orbis.mine(d, 'heldCarts').filter(function (c) { return c.outlet === d.session.outlet; }); };
  carts.hold = function (cart) {
    Orbis.require('pos.sell');
    Orbis.need(cart && Array.isArray(cart.items) && cart.items.length > 0, 'EMPTY_CART', 'Keranjang kosong');
    cart.items.forEach(function (it) { Orbis.int(it.qty, 'Qty'); Orbis.need(it.qty >= 1, 'VALIDATION', 'Qty minimal 1'); });
    return Orbis.tx(function (d) {
      var c = { id: Orbis.nextId(d, 'HLD', 3), tenant: d.session.tenant, outlet: d.session.outlet, items: cart.items.map(function (i) { return { skuId: i.skuId, qty: i.qty }; }), memberId: cart.memberId || null, promoCode: cart.promoCode || '', label: String(cart.label || '').trim(), at: Orbis.clock.now(), by: d.session.actor };
      d.heldCarts.push(c);
      return c;
    }, { audit: function (c) { return { action: 'cart.hold', entity: 'cart', entityId: c.id }; } });
  };
  /** Remove and return the held cart (idempotent failure: second resume -> NOT_FOUND). */
  carts.resume = function (id) {
    Orbis.require('pos.sell');
    return Orbis.tx(function (d) {
      var c = find(d, 'heldCarts', id);
      if (!c) throw Orbis.Err('NOT_FOUND', 'Keranjang tertahan tidak ditemukan');
      d.heldCarts = d.heldCarts.filter(function (x) { return x !== c; });
      return c;
    }, { audit: { action: 'cart.resume', entity: 'cart', entityId: id } });
  };

  /* ================= refunds / returns ================= */
  refunds.list = function (d) { return Orbis.mine(d, 'refunds').slice().sort(function (a, b) { return b.requestedAt - a.requestedAt || (a.id < b.id ? 1 : -1); }); };
  refunds.get = function (d, id) { return find(d, 'refunds', id) || null; };

  /** Qty still returnable per sku = sold - (REQUESTED + APPROVED). */
  refunds.remaining = function (d, order) {
    var used = {};
    Orbis.mine(d, 'refunds').forEach(function (r) {
      if (r.orderId !== order.id || r.status === 'REJECTED') return;
      r.lines.forEach(function (l) { used[l.skuId] = (used[l.skuId] || 0) + l.qty; });
    });
    var agg = {}, keys = [];   // one row per sku even when lines differ by modifiers
    order.items.forEach(function (it) {
      if (!agg[it.skuId]) { agg[it.skuId] = { skuId: it.skuId, name: it.name, price: it.price, sold: 0 }; keys.push(it.skuId); }
      agg[it.skuId].sold += it.qty;
    });
    return keys.map(function (k) { var a = agg[k]; a.remaining = a.sold - (used[k] || 0); return a; });
  };
  /** Orders a refund may still be requested for. */
  refunds.eligibleOrders = function (d) {
    return orders.list(d).filter(function (o) {
      var ok = REFUNDABLE.indexOf(o.paymentStatus) >= 0 && o.paymentStatus !== 'REFUNDED';
      return ok && refunds.remaining(d, o).some(function (r) { return r.remaining > 0; });
    });
  };

  /** Share of the refundable pool (total minus delivery fee) owed to one sku; the last sku absorbs rounding. */
  function skuPools(o) {
    var pool = o.total - o.deliveryFee, out = {}, left = pool;
    if (!o.subtotal) { o.items.forEach(function (it, i) { out[it.skuId] = (out[it.skuId] || 0) + (i === 0 ? pool : 0); }); return out; }
    o.items.forEach(function (it, i) {
      var share = i === o.items.length - 1 ? left : Math.round(it.qty * it.price * pool / o.subtotal);
      out[it.skuId] = (out[it.skuId] || 0) + share; left -= share;
    });
    return out;
  }
  function shareOf(pool, sold, q) { return q >= sold ? pool : Math.floor(pool * q / sold); }

  refunds.request = function (orderId, lines, reason) {
    Orbis.require('refund.request');
    reason = Orbis.reason(reason, 'Alasan retur');
    Orbis.need(Array.isArray(lines) && lines.length > 0, 'VALIDATION', 'Pilih minimal satu item');
    return Orbis.tx(function (d) {
      var o = must(d, orderId);
      var cancelledPaid = o.status === 'CANCELLED' && o.refundDue > 0;
      if (!cancelledPaid && (REFUNDABLE.indexOf(o.paymentStatus) < 0 || o.paymentStatus === 'REFUNDED')) throw Orbis.Err('NOT_REFUNDABLE', 'Pesanan ini belum bisa di-refund (status bayar ' + o.paymentStatus + ')');
      var rem = refunds.remaining(d, o), pools = skuPools(o), merged = {}, order = [];
      lines.forEach(function (l) {
        Orbis.int(l.qty, 'Qty retur'); Orbis.need(l.qty >= 1, 'VALIDATION', 'Qty retur minimal 1');
        if (!merged[l.skuId]) { merged[l.skuId] = 0; order.push(l.skuId); }
        merged[l.skuId] += l.qty;
      });
      var out = [];
      order.forEach(function (skuId) {
        var r = rem.filter(function (x) { return x.skuId === skuId; })[0];
        Orbis.need(r, 'VALIDATION', 'Item tidak ada di pesanan');
        if (merged[skuId] > r.remaining) throw Orbis.Err('OVER_REFUND', 'Qty retur ' + r.name + ' melebihi sisa (' + r.remaining + ')');
        var before = r.sold - r.remaining;
        out.push({ skuId: skuId, qty: merged[skuId], amount: shareOf(pools[skuId], r.sold, before + merged[skuId]) - shareOf(pools[skuId], r.sold, before) });
      });
      var amount = Orbis.sum(out, function (l) { return l.amount; });
      var allDone = refunds.remaining(d, o).every(function (r) { var m = merged[r.skuId] || 0; return r.remaining - m === 0; });
      if (allDone) amount += o.deliveryFee;   // full return also gives back the delivery fee, so cumulative refund == total
      var r = { id: Orbis.nextId(d, 'RFD', 4), tenant: d.session.tenant, orderId: o.id, lines: out, amount: amount, deliveryFeeIncluded: allDone, reason: reason, status: 'REQUESTED', requestedBy: d.session.actor, requestedRole: d.session.role, requestedAt: Orbis.clock.now(), decidedBy: null, decidedAt: null };
      d.refunds.push(r);
      return r;
    }, { audit: function (r) { return { action: 'refund.request', entity: 'refund', entityId: r.id, detail: r.orderId + ' ' + r.amount }; } });
  };

  function legRemaining(d, orderId) {
    var legs = {}, order = [];
    Orbis.mine(d, 'payments').filter(function (p) { return p.orderId === orderId; }).forEach(function (p) {
      if (!(p.type in legs)) { legs[p.type] = 0; order.push(p.type); }
      legs[p.type] += p.amount;
    });
    return order.map(function (t) { return { type: t, remaining: legs[t] }; }).filter(function (l) { return l.remaining > 0; });
  }
  /** Pro-rata split over remaining capacity per leg; last leg absorbs the remainder; result sums exactly to amount. */
  function allocate(amount, legs) {
    var R = Orbis.sum(legs, function (l) { return l.remaining; });
    Orbis.need(amount <= R, 'OVER_REFUND', 'Nominal refund melebihi pembayaran tersisa');
    var out = legs.map(function (l) { return { type: l.type, cap: l.remaining, amount: 0 }; }), used = 0;
    out.forEach(function (x, i) {
      x.amount = i === out.length - 1 ? amount - used : Math.floor(amount * x.cap / R);
      used += x.amount;
    });
    // rounding can push the last leg over its capacity: spill the excess back onto legs with room
    var last = out[out.length - 1];
    if (last.amount > last.cap) {
      var excess = last.amount - last.cap; last.amount = last.cap;
      out.forEach(function (x) { var room = x.cap - x.amount, mv = Math.min(room, excess); x.amount += mv; excess -= mv; });
    }
    return out.filter(function (x) { return x.amount > 0; }).map(function (x) { return { type: x.type, amount: x.amount }; });
  }

  refunds.approve = function (id, opts) {
    Orbis.require('refund.approve');
    opts = opts || {};
    var condition = opts.condition || 'GOOD';
    Orbis.need(condition === 'GOOD' || condition === 'DAMAGED', 'VALIDATION', 'Kondisi barang harus GOOD atau DAMAGED');
    Orbis.need(!(opts.restock === true && condition === 'DAMAGED'), 'VALIDATION', 'Barang rusak tidak boleh masuk stok jual');
    return Orbis.tx(function (d) {
      var r = find(d, 'refunds', id);
      if (!r) throw Orbis.Err('NOT_FOUND', 'Permintaan refund tidak ditemukan');
      if (r.status !== 'REQUESTED') throw Orbis.Err('ALREADY_DECIDED', 'Permintaan ini sudah diputuskan (' + r.status + ')');
      if (r.requestedBy === d.session.actor) throw Orbis.Err('SELF_APPROVAL', 'Pemohon tidak boleh menyetujui permintaannya sendiri');
      var o = must(d, r.orderId), now = Orbis.clock.now();
      var legs = legRemaining(d, o.id);
      var alloc = allocate(r.amount, legs);
      var shift = shifts.current(d);
      alloc.forEach(function (a) {
        d.payments.push({ id: Orbis.nextId(d, 'PAY', 5), tenant: d.session.tenant, orderId: o.id, type: a.type, amount: -a.amount, at: now, shiftId: a.type === 'cash' && shift ? shift.id : null, refundId: r.id });
      });
      var restock = opts.restock === true && o.status !== 'CANCELLED';
      if (restock) r.lines.forEach(function (l) { inv.move(d, { skuId: l.skuId, qty: l.qty, type: 'RETURN_RESTOCK', ref: r.id, outlet: o.outlet, note: 'Retur ' + o.id }); });
      o.refunded = (o.refunded || 0) + r.amount;
      o.paymentStatus = o.refunded >= o.total ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      if (o.refundDue) o.refundDue = Math.max(0, o.total - o.refunded);
      var mm = dom('members', 'reverse'); if (mm && o.memberId) mm.reverse(d, o.id, r.amount / o.total);
      r.status = 'APPROVED'; r.decidedBy = d.session.actor; r.decidedAt = now; r.restock = restock; r.condition = condition; r.allocations = alloc;
      return r;
    }, { audit: function (r) { return { action: 'refund.approve', entity: 'refund', entityId: r.id, detail: r.orderId + ' ' + r.amount }; } });
  };

  refunds.reject = function (id, reason) {
    Orbis.require('refund.approve');
    reason = Orbis.reason(reason, 'Alasan penolakan');
    return Orbis.tx(function (d) {
      var r = find(d, 'refunds', id);
      if (!r) throw Orbis.Err('NOT_FOUND', 'Permintaan refund tidak ditemukan');
      if (r.status !== 'REQUESTED') throw Orbis.Err('ALREADY_DECIDED', 'Permintaan ini sudah diputuskan (' + r.status + ')');
      r.status = 'REJECTED'; r.decidedBy = d.session.actor; r.decidedAt = Orbis.clock.now(); r.decisionReason = reason;
      return r;
    }, { audit: { action: 'refund.reject', entity: 'refund', entityId: id } });
  };
})(typeof window !== 'undefined' ? window : globalThis);
