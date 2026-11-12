/* Orbis v2 — RD-17 W1 "trust": offline sync visibility for the tenant owner (G2) and audited voids of paid sales (G9).
   Reuses the fleet outbox (platform.js) and the payment/stock ledgers; never edits an original order line or a closed shift. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, TR = Orbis.domain.trust = {};
  Orbis.PERMS['order.void'] = ['owner', 'manager'];
  Orbis.PERMS['sync.read'] = ['owner', 'manager'];
  TR.STALE_MS = 15 * 60000;   // RD17-02 default threshold (server clock)

  function F() { return Orbis.domain.fleet; }

  /* ================= G2: sync visibility ================= */
  /** Per device: counts derived from the outbox, last successful sync, oldest pending age and a stale flag (RD17-01/02). */
  TR.devices = function (d) {
    Orbis.require('sync.read', d.session.role);
    var now = Orbis.clock.now(), outlets = {};
    Orbis.mine(d, 'outlets').forEach(function (o) { outlets[o.id] = o.name; });
    return Orbis.mine(d, 'devices').map(function (dev) {
      var q = Orbis.mine(d, 'outbox').filter(function (x) { return x.deviceId === dev.id; });
      var pend = q.filter(function (x) { return x.status === 'PENDING_SYNC'; });
      var oldest = pend.reduce(function (m, x) { return Math.min(m, x.createdAt); }, Infinity);
      var last = q.reduce(function (m, x) { return Math.max(m, x.syncedAt || 0); }, 0);
      return {
        id: dev.id, name: dev.name, outlet: dev.outlet, outletName: outlets[dev.outlet] || dev.outlet, status: dev.status,
        grantExpiresAt: dev.grantExpiresAt, expired: dev.grantExpiresAt <= now,
        pending: pend.length, conflicts: q.filter(function (x) { return x.status === 'CONFLICT'; }).length,
        lastSyncAt: last || null, oldestPendingAt: pend.length ? oldest : null,
        stale: pend.length > 0 && now - oldest >= TR.STALE_MS
      };
    });
  };
  /** Conflicts kept with original payload + reason until resolved (RD17-03). */
  TR.conflicts = function (d) {
    Orbis.require('sync.read', d.session.role);
    return Orbis.mine(d, 'outbox').filter(function (x) { return x.status === 'CONFLICT'; }).slice().sort(function (a, b) { return a.createdAt - b.createdAt; });
  };
  /** Owner overview items (merged into tenant.attention). */
  TR.attention = function (d) {
    if (!Orbis.can('sync.read', d.session.role)) return [];
    var ds = TR.devices(d), out = [];
    var stale = ds.filter(function (x) { return x.stale; }).length, conf = Orbis.sum(ds, function (x) { return x.conflicts; });
    if (stale) out.push({ label: 'Perangkat belum sinkron > 15 menit', n: stale, route: 'sync', tone: 'FAILED' });
    if (conf) out.push({ label: 'Transaksi offline konflik', n: conf, route: 'sync', tone: 'FAILED' });
    return out;
  };

  /* ================= G9: audited void of a paid sale ================= */
  var VOIDABLE_PAY = ['PAID', 'PARTIALLY_REFUNDED', 'COD_COLLECTED'];
  /** What a void would reverse right now (read-only): remaining money per tender and remaining qty per line. */
  TR.voidPreview = function (d, orderId) {
    var o = Orbis.domain.orders.get(d, orderId);
    Orbis.need(o, 'NOT_FOUND', 'Pesanan tidak ditemukan');
    var legs = {}, order = [];
    Orbis.mine(d, 'payments').filter(function (p) { return p.orderId === o.id; }).forEach(function (p) {
      if (!(p.type in legs)) { legs[p.type] = 0; order.push(p.type); }
      legs[p.type] += p.amount;
    });
    var money = order.map(function (t) { return { type: t, amount: legs[t] }; }).filter(function (l) { return l.amount > 0; });
    var lines = Orbis.domain.refunds.remaining(d, o).filter(function (r) { return r.remaining > 0; });
    return { order: o, money: money, amount: Orbis.sum(money, function (l) { return l.amount; }), lines: lines };
  };
  /**
   * Void a paid sale (RD17-04/05): reason >= 5 chars, `order.void` (or manager PIN via team.withApproval).
   * Writes negative payment rows (cash to the CURRENT open shift of the order's outlet), restocks remaining qty,
   * reverses loyalty, marks the order CANCELLED with void metadata. Order lines and closed shifts are never edited.
   */
  TR.voidSale = function (orderId, reason) {
    Orbis.require('order.void');
    reason = Orbis.reason(reason, 'Alasan void');
    return Orbis.tx(function (d, ctx) {
      var pv = TR.voidPreview(d, orderId), o = pv.order;
      Orbis.need(!o.voided, 'ALREADY_VOIDED', 'Pesanan sudah di-void');
      Orbis.need(VOIDABLE_PAY.indexOf(o.paymentStatus) >= 0, 'NOT_VOIDABLE', 'Hanya penjualan yang sudah dibayar yang bisa di-void (status bayar ' + o.paymentStatus + ')');
      Orbis.need(['CANCELLED', 'RETURNED'].indexOf(o.status) < 0, 'NOT_VOIDABLE', 'Pesanan ' + o.status + ' tidak bisa di-void');
      Orbis.need(!Orbis.mine(d, 'refunds').some(function (r) { return r.orderId === o.id && r.status === 'REQUESTED'; }), 'REFUND_PENDING', 'Selesaikan dulu permintaan refund yang masih menunggu');
      var now = Orbis.clock.now(), cashLeg = pv.money.filter(function (l) { return l.type === 'cash'; })[0];
      var open = Orbis.mine(d, 'shifts').filter(function (s) { return s.outlet === o.outlet && !s.closedAt; })[0];
      if (cashLeg) Orbis.need(open, 'NO_OPEN_SHIFT', 'Void tunai butuh shift terbuka di outlet pesanan (uang keluar dari laci)');
      var origShift = o.shiftId ? Orbis.mine(d, 'shifts').filter(function (s) { return s.id === o.shiftId; })[0] : null;
      pv.money.forEach(function (l) {
        d.payments.push({ id: Orbis.nextId(d, 'PAY', 5), tenant: d.session.tenant, orderId: o.id, type: l.type, amount: -l.amount, at: now,
          shiftId: l.type === 'cash' ? open.id : null, voidOf: o.id, originalShiftId: o.shiftId || null });
      });
      var back = {}, keys = [];
      pv.lines.forEach(function (r) { if (!back[r.skuId]) { back[r.skuId] = 0; keys.push(r.skuId); } back[r.skuId] += r.remaining; });
      keys.forEach(function (k) { Orbis.domain.inventory.move(d, { skuId: k, qty: back[k], type: 'SALE_REVERSAL', ref: o.id, outlet: o.outlet, note: 'Void ' + o.id + ': ' + reason }); });
      (Orbis.hooks.afterReverse || []).forEach(function (fn) { fn(d, o, { ref: 'void:' + o.id, lines: pv.lines.map(function (r) { return { line: r.line, skuId: r.skuId, qty: r.remaining }; }), kind: 'void' }); });
      var mm = Orbis.domain.members; if (mm && o.memberId && o.total > 0 && pv.amount > 0) { try { mm.reverse(d, o.id, Math.min(1, pv.amount / o.total), 'void:' + o.id); } catch (e) { if (!e || e.code !== 'NOT_FOUND') throw e; } }
      o.history.push({ at: now, by: ctx.actor, from: o.status, to: 'CANCELLED', reason: 'VOID: ' + reason });
      o.status = 'CANCELLED'; o.cancelReason = 'VOID: ' + reason;
      o.refunded = (o.refunded || 0) + pv.amount; o.paymentStatus = 'REFUNDED'; o.refundDue = 0;
      o.voided = { at: now, by: ctx.actor, role: ctx.role, reason: reason, amount: pv.amount,
        originalShiftId: o.shiftId || null, originalShiftClosed: !!(origShift && origShift.closedAt), postedShiftId: cashLeg ? open.id : null };
      return o;
    }, { audit: function (o) { return { action: 'order.void', entity: 'order', entityId: o.id, detail: { amount: o.voided.amount, reason: o.voided.reason, postedShiftId: o.voided.postedShiftId } }; } });
  };

  /* ================= demo: one device behind, one conflict ================= */
  (Orbis.demoHooks = Orbis.demoHooks || []).push(function (c) {
    c.as('owner', 'Rina (Owner)', 'o2');
    Orbis.tx(function (d) {
      if (d.devices.some(function (x) { return x.id === 'DEV-002'; })) return;
      d.devices.push({ id: 'DEV-002', tenant: 't1', outlet: 'o2', name: 'Kasir BSD (Tablet)', status: 'ACTIVE', grantExpiresAt: c.now + 3 * c.DAY, createdAt: c.now - 20 * c.DAY, pending: 0, conflicts: 0 });
    });
    var sku = c.skus[1].id;
    c.at(c.now - 40 * 60000, function () { F().enqueue('DEV-002', { clientEventId: 'bsd-off-1', payload: { items: [{ skuId: sku, qty: 1 }], payment: { type: 'cash' }, method: 'pickup' } }); });
    c.at(c.now - 35 * 60000, function () { F().enqueue('DEV-002', { clientEventId: 'bsd-off-2', payload: { items: [{ skuId: sku, qty: 2 }], payment: { type: 'cash' }, method: 'pickup' } }); });
    // one rejected offline item at Senopati (unknown SKU) -> visible conflict; nothing new is sold, so demo order counts stay exact
    c.as('owner', 'Rina (Owner)', 'o1');
    c.at(c.now - 3 * c.HOUR, function () {
      F().enqueue('DEV-001', { clientEventId: 'snp-off-9', payload: { items: [{ skuId: 'k-hapus', qty: 1 }], payment: { type: 'cash' }, method: 'pickup' } });
      F().sync('DEV-001');
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
