/* Orbis v2 — inventory domain. Stock is DERIVED from immutable movements (ADR-0004); never an editable total.
   Movement types: OPENING, SALE, SALE_REVERSAL, PURCHASE_RECEIPT, ADJUSTMENT, RETURN_RESTOCK, RESERVE, RESERVE_RELEASE.
   One movement per (type, ref, skuId) — replaying the same source event is a no-op (idempotent). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, inv = Orbis.domain.inventory = {};

  /** On-hand for sku at outlet. Reservations reduce availability, not on-hand. */
  inv.onHand = function (d, skuId, outlet) {
    return Orbis.sum(d.stockMoves.filter(function (m) { return m.skuId === skuId && (!outlet || m.outlet === outlet) && m.type !== 'RESERVE' && m.type !== 'RESERVE_RELEASE'; }), function (m) { return m.qty; });
  };
  inv.reserved = function (d, skuId, outlet) {
    return -Orbis.sum(d.stockMoves.filter(function (m) { return m.skuId === skuId && (!outlet || m.outlet === outlet) && (m.type === 'RESERVE' || m.type === 'RESERVE_RELEASE'); }), function (m) { return m.qty; });
  };
  inv.available = function (d, skuId, outlet) { return inv.onHand(d, skuId, outlet) - inv.reserved(d, skuId, outlet); };

  /**
   * Append a movement inside an open transaction `d`. Idempotent on (type, ref, skuId).
   * Returns the movement, or the existing one when replayed.
   */
  inv.move = function (d, o) {
    Orbis.int(o.qty, 'Qty');
    Orbis.need(o.qty !== 0, 'VALIDATION', 'Qty tidak boleh 0');
    var sku = d.skus.filter(function (s) { return s.id === o.skuId && s.tenant === d.session.tenant; })[0];
    Orbis.need(sku, 'NOT_FOUND', 'SKU tidak ditemukan');
    var dup = d.stockMoves.filter(function (m) { return m.type === o.type && m.ref === o.ref && m.skuId === o.skuId; })[0];
    if (dup) return dup;
    var outlet = o.outlet || d.session.outlet;
    if (o.qty < 0 && o.type !== 'ADJUSTMENT_ALLOW_NEGATIVE') {
      var avail = inv.available(d, o.skuId, outlet);
      Orbis.need(avail + o.qty >= 0, 'INSUFFICIENT_STOCK', 'Stok ' + sku.sku + ' tidak cukup (tersedia ' + avail + ')');
    }
    var m = { id: Orbis.nextId(d, 'MOV', 5), tenant: d.session.tenant, outlet: outlet, skuId: o.skuId, qty: o.qty, type: o.type, ref: o.ref, at: Orbis.clock.now(), by: d.session.actor, note: o.note || null };
    d.stockMoves.push(m);
    return m;
  };

  /** Manual stock correction: owner/manager, needs a reason, writes one ADJUSTMENT movement of the delta. */
  inv.adjust = function (skuId, newCount, reason) {
    Orbis.require('stock.adjust');
    Orbis.int(newCount, 'Hitungan stok');
    Orbis.need(newCount >= 0, 'VALIDATION', 'Hitungan stok tidak boleh negatif');
    reason = Orbis.reason(reason, 'Alasan koreksi');
    return Orbis.tx(function (d) {
      var delta = newCount - inv.onHand(d, skuId, d.session.outlet);
      if (delta === 0) throw Orbis.Err('NO_CHANGE', 'Hitungan sama dengan stok tercatat');
      return inv.move(d, { skuId: skuId, qty: delta, type: 'ADJUSTMENT', ref: Orbis.nextId(d, 'ADJ', 4), note: reason });
    }, { audit: { action: 'stock.adjust', entity: 'sku', entityId: skuId } });
  };

  /** Low stock: available <= the SKU's reorder point at this outlet (stock batch), else <= 5. */
  inv.isLow = function (d, row) {
    var S = Orbis.domain.stock, p = S && S.reorderPoint ? S.reorderPoint(d, row.sku.id, d.session.outlet) : 0;
    return row.available <= (p || 5);
  };
  inv.catalog = function (d) {
    var t = d.session.tenant;
    return d.skus.filter(function (s) { return s.tenant === t; }).map(function (s) {
      var p = d.products.filter(function (x) { return x.id === s.productId; })[0] || {};
      return { sku: s, product: p, onHand: inv.onHand(d, s.id, d.session.outlet), available: inv.available(d, s.id, d.session.outlet) };
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
