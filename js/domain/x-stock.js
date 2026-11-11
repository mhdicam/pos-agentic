/* Orbis v2 — tenant back-office: stock (RD-13). Pure domain, no DOM.
   Stock card, inventory summary, reasoned adjustments, stok opname documents, outlet transfers, reorder points,
   PO reject/cancel. Every quantity is DERIVED from immutable `stockMoves` (ADR-0004); this file never stores totals.
   New movement types: TRANSFER_OUT, TRANSFER_IN (idempotent on type+ref+sku via inventory.move). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, inv = Orbis.domain.inventory, S = Orbis.domain.stock = {};

  Orbis.PERMS['stock.opname'] = ['owner', 'manager'];
  Orbis.PERMS['stock.opname.approve'] = ['owner', 'manager'];
  Orbis.PERMS['stock.transfer'] = ['owner', 'manager'];

  Orbis.seedHooks.push(function (db) { db.stockCounts = []; db.stockTransfers = []; db.reorderPoints = []; });

  /** Adjustment reasons (Square S5 / majoo J6). 'other' needs a note. */
  S.REASONS = [['damaged', 'Rusak'], ['expired', 'Kedaluwarsa'], ['lost', 'Hilang'], ['internal', 'Pemakaian internal'], ['sample', 'Sampel'], ['recount', 'Hitung ulang'], ['other', 'Lainnya']];
  S.TYPE_LABEL = { OPENING: 'Stok awal', SALE: 'Penjualan', SALE_REVERSAL: 'Batal jual', PURCHASE_RECEIPT: 'Penerimaan PO', ADJUSTMENT: 'Penyesuaian',
    RETURN_RESTOCK: 'Retur masuk', TRANSFER_OUT: 'Transfer keluar', TRANSFER_IN: 'Transfer masuk' };

  function rows(d, c) { d[c] = d[c] || []; return d[c]; }
  function sku(d, id) { var s = Orbis.mine(d, 'skus').filter(function (x) { return x.id === id; })[0]; Orbis.need(s, 'NOT_FOUND', 'SKU tidak ditemukan'); return s; }
  function outlet(d, id) {
    var o = Orbis.mine(d, 'outlets').filter(function (x) { return x.id === id; })[0];
    Orbis.need(o, 'NOT_FOUND', 'Outlet tidak ditemukan');
    Orbis.need(o.active !== false, 'OUTLET_INACTIVE', 'Outlet nonaktif');
    return o;
  }
  function find(d, c, id, label) { var r = Orbis.mine(d, c).filter(function (x) { return x.id === id; })[0]; Orbis.need(r, 'NOT_FOUND', label + ' tidak ditemukan'); return r; }
  function hist(doc, d, to, note) { doc.history.push({ at: Orbis.clock.now(), by: d.session.actor, from: doc.status, to: to, note: note || null }); doc.status = to; }
  function stockable(m) { return m.type !== 'RESERVE' && m.type !== 'RESERVE_RELEASE'; }
  function reasonLabel(code) { var r = S.REASONS.filter(function (x) { return x[0] === code; })[0]; return r ? r[1] : null; }

  /* ---------- reads ---------- */
  /** Kartu stok: chronological moves of one SKU at one outlet with running balance. f = {from, to (ms), type}. */
  S.card = function (d, skuId, outletId, f) {
    f = f || {};
    var bal = 0, opening = 0, out = [];
    Orbis.mine(d, 'stockMoves').filter(function (m) { return m.skuId === skuId && m.outlet === outletId && stockable(m); })
      .sort(function (a, b) { return a.at - b.at || (a.id < b.id ? -1 : 1); })
      .forEach(function (m) {
        bal += m.qty;
        if (f.from && m.at < f.from) { opening = bal; return; }
        if (f.to && m.at > f.to) return;
        if (f.type && m.type !== f.type) return;
        out.push({ id: m.id, at: m.at, type: m.type, label: S.TYPE_LABEL[m.type] || m.type, qty: m.qty, balance: bal, ref: m.ref, by: m.by || '-', note: m.note || '', reason: m.reason || null });
      });
    return { opening: opening, rows: out, onHand: inv.onHand(d, skuId, outletId) };
  };

  var COLS = { PURCHASE_RECEIPT: 'purchase', SALE: 'sale', SALE_REVERSAL: 'sale', RETURN_RESTOCK: 'ret', TRANSFER_IN: 'tin', TRANSFER_OUT: 'tout' };
  /** Ringkasan inventori (Moka M5) per outlet & period. Unknown types (OPENING, ADJUSTMENT) count as adjustment. end = begin + Σ columns. */
  S.summary = function (d, outletId, from, to) {
    var moves = Orbis.mine(d, 'stockMoves').filter(function (m) { return m.outlet === outletId && stockable(m) && (!to || m.at <= to); });
    var list = Orbis.mine(d, 'skus').map(function (s) {
      var p = d.products.filter(function (x) { return x.id === s.productId; })[0] || {};
      var r = { skuId: s.id, sku: s.sku, name: p.name || s.sku, cost: s.cost, begin: 0, purchase: 0, sale: 0, ret: 0, tin: 0, tout: 0, adjust: 0 };
      moves.forEach(function (m) {
        if (m.skuId !== s.id) return;
        if (from && m.at < from) r.begin += m.qty; else r[COLS[m.type] || 'adjust'] += m.qty;
      });
      r.end = r.begin + r.purchase + r.sale + r.ret + r.tin + r.tout + r.adjust;
      r.value = r.end * s.cost;
      return r;
    });
    return { rows: list, totalValue: Orbis.sum(list, function (r) { return r.value; }) };
  };

  /** Reorder point for sku at outlet (0 = not set). */
  S.reorderPoint = function (d, skuId, outletId) {
    var r = Orbis.mine(d, 'reorderPoints').filter(function (x) { return x.skuId === skuId && x.outlet === outletId; })[0];
    return r ? r.point : 0;
  };
  /** "Perlu dipesan": available <= reorder point. Suggested qty tops up to 2x the point; lines are createPo-ready. */
  S.needsOrder = function (d, outletId) {
    return Orbis.mine(d, 'skus').filter(function (s) { return !s.archived; }).map(function (s) {
      var point = S.reorderPoint(d, s.id, outletId), avail = inv.available(d, s.id, outletId);
      return point > 0 && avail <= point ? { skuId: s.id, available: avail, point: point, qty: 2 * point - avail, unitCost: s.cost } : null;
    }).filter(Boolean);
  };

  /* ---------- adjustments ---------- */
  /** spec {skuId, qty (signed delta), reason (code), note}. Writes one ADJUSTMENT at the session outlet; negative result is refused by inventory.move. */
  S.adjust = function (spec) {
    Orbis.require('stock.adjust'); spec = spec || {};
    Orbis.int(spec.qty, 'Qty penyesuaian');
    Orbis.need(spec.qty !== 0, 'VALIDATION', 'Qty penyesuaian tidak boleh 0');
    var label = reasonLabel(spec.reason);
    Orbis.need(label, 'VALIDATION', 'Pilih alasan penyesuaian');
    var note = String(spec.note || '').trim();
    if (spec.reason === 'other') note = Orbis.reason(note, 'Keterangan alasan lainnya');
    return Orbis.tx(function (d) {
      sku(d, spec.skuId);
      var m = inv.move(d, { skuId: spec.skuId, qty: spec.qty, type: 'ADJUSTMENT', ref: Orbis.nextId(d, 'ADJ', 4), note: label + (note ? ': ' + note : '') });
      m.reason = spec.reason;
      return m;
    }, { audit: function (m) { return { action: 'stock.adjust', entity: 'sku', entityId: spec.skuId, detail: m.qty + ' (' + label + ')' }; } });
  };

  /* ---------- stok opname ----------
     Rule (RD13-05): system qty is snapshotted at creation; variance = counted - snapshot; on approval the VARIANCE is applied as a
     delta on top of current stock, so sales/receipts recorded after the snapshot are preserved, not overwritten. */
  S.createCount = function (spec) {
    Orbis.require('stock.opname'); spec = spec || {};
    return Orbis.tx(function (d) {
      var ol = outlet(d, d.session.outlet);
      var ids = spec.skuIds && spec.skuIds.length ? spec.skuIds : Orbis.mine(d, 'skus').filter(function (s) { return !s.archived; }).map(function (s) { return s.id; });
      var seen = {};
      var lines = ids.map(function (id) {
        var s = sku(d, id);
        Orbis.need(!seen[id], 'VALIDATION', 'SKU dobel pada opname'); seen[id] = 1;
        return { skuId: id, system: inv.onHand(d, id, ol.id), counted: null, cost: s.cost };
      });
      Orbis.need(lines.length, 'VALIDATION', 'Opname minimal satu SKU');
      var doc = { id: Orbis.nextId(d, 'SO', 4), tenant: d.session.tenant, outlet: ol.id, scope: spec.skuIds && spec.skuIds.length ? 'partial' : 'full', lines: lines,
        note: String(spec.note || '').trim(), status: 'DRAFT', createdBy: d.session.actor, createdAt: Orbis.clock.now(), snapshotAt: Orbis.clock.now(),
        submittedBy: null, approvedBy: null, rejectReason: null, history: [] };
      doc.history.push({ at: doc.createdAt, by: d.session.actor, from: null, to: 'DRAFT' });
      rows(d, 'stockCounts').push(doc);
      return doc;
    }, { audit: function (x) { return { action: 'opname.create', entity: 'opname', entityId: x.id }; } });
  };
  /** counts: {skuId: qty}. Only while DRAFT. */
  S.setCounts = function (id, counts) {
    Orbis.require('stock.opname');
    return Orbis.tx(function (d) {
      var doc = find(d, 'stockCounts', id, 'Opname');
      Orbis.need(doc.status === 'DRAFT', 'INVALID_STATE', 'Hitungan hanya bisa diubah saat DRAFT');
      Object.keys(counts || {}).forEach(function (k) {
        var l = doc.lines.filter(function (x) { return x.skuId === k; })[0];
        Orbis.need(l, 'NOT_FOUND', 'SKU tidak ada di opname');
        var q = counts[k];
        if (q === null || q === '') { l.counted = null; return; }
        Orbis.int(q, 'Qty hitung'); Orbis.need(q >= 0, 'VALIDATION', 'Qty hitung tidak boleh negatif');
        l.counted = q;
      });
      return doc;
    }, { audit: { action: 'opname.count', entity: 'opname', entityId: id } });
  };
  S.submitCount = function (id) {
    Orbis.require('stock.opname');
    return Orbis.tx(function (d) {
      var doc = find(d, 'stockCounts', id, 'Opname');
      Orbis.need(doc.status === 'DRAFT', 'INVALID_STATE', 'Hanya opname DRAFT yang bisa diajukan');
      Orbis.need(doc.lines.every(function (l) { return l.counted !== null; }), 'VALIDATION', 'Semua SKU harus dihitung sebelum diajukan');
      doc.submittedBy = d.session.actor; hist(doc, d, 'SUBMITTED');
      return doc;
    }, { audit: { action: 'opname.submit', entity: 'opname', entityId: id } });
  };
  /** Variance per line + totals (qty and value at cost). */
  S.variance = function (doc) {
    var ls = doc.lines.map(function (l) { var v = l.counted === null ? 0 : l.counted - l.system; return { skuId: l.skuId, system: l.system, counted: l.counted, variance: v, value: v * l.cost }; });
    return { lines: ls, qty: Orbis.sum(ls, function (l) { return l.variance; }), value: Orbis.sum(ls, function (l) { return l.value; }) };
  };
  /** Moves at the opname outlet after the snapshot, for the counted SKUs (UI warning). */
  S.movesAfterSnapshot = function (d, doc) {
    var ids = doc.lines.map(function (l) { return l.skuId; });
    return Orbis.mine(d, 'stockMoves').filter(function (m) { return m.outlet === doc.outlet && m.at > doc.snapshotAt && stockable(m) && ids.indexOf(m.skuId) >= 0 && m.ref !== doc.id; }).length;
  };
  /** Approve: one ADJUSTMENT per non-zero variance, ref = opname id. Replay on APPROVED is a no-op. Counter/creator cannot approve. */
  S.approveCount = function (id) {
    Orbis.require('stock.opname.approve');
    var d0 = Orbis.db(), cur = Orbis.mine(d0, 'stockCounts').filter(function (x) { return x.id === id; })[0];
    if (cur && cur.status === 'APPROVED') return cur;   // idempotent replay: no tx, no moves, no audit
    return Orbis.tx(function (d) {
      var doc = find(d, 'stockCounts', id, 'Opname');
      Orbis.need(doc.status === 'SUBMITTED', 'INVALID_STATE', 'Hanya opname SUBMITTED yang bisa disetujui');
      Orbis.need(d.session.actor !== doc.createdBy && d.session.actor !== doc.submittedBy, 'SELF_APPROVAL', 'Penghitung tidak boleh menyetujui opname sendiri');
      S.variance(doc).lines.forEach(function (l) {
        if (!l.variance) return;
        var m = inv.move(d, { skuId: l.skuId, qty: l.variance, type: 'ADJUSTMENT', ref: doc.id, outlet: doc.outlet, note: 'Stok opname ' + doc.id });
        m.reason = 'recount';
      });
      doc.approvedBy = d.session.actor; doc.approvedAt = Orbis.clock.now(); hist(doc, d, 'APPROVED');
      return doc;
    }, { audit: { action: 'opname.approve', entity: 'opname', entityId: id } });
  };
  S.rejectCount = function (id, reason) {
    Orbis.require('stock.opname.approve');
    reason = Orbis.reason(reason, 'Alasan penolakan');
    return Orbis.tx(function (d) {
      var doc = find(d, 'stockCounts', id, 'Opname');
      Orbis.need(doc.status === 'SUBMITTED', 'INVALID_STATE', 'Hanya opname SUBMITTED yang bisa ditolak');
      doc.rejectReason = reason; hist(doc, d, 'REJECTED', reason);
      return doc;
    }, { audit: { action: 'opname.reject', entity: 'opname', entityId: id, detail: reason } });
  };

  /* ---------- transfers ---------- */
  /** spec {to, lines:[{skuId,qty}], note}. From = session outlet. DRAFT. */
  S.createTransfer = function (spec) {
    Orbis.require('stock.transfer'); spec = spec || {};
    return Orbis.tx(function (d) {
      var from = outlet(d, d.session.outlet), to = outlet(d, spec.to);
      Orbis.need(from.id !== to.id, 'SAME_OUTLET', 'Outlet tujuan harus berbeda');
      Orbis.need(Array.isArray(spec.lines) && spec.lines.length, 'VALIDATION', 'Transfer minimal satu baris');
      var seen = {};
      var lines = spec.lines.map(function (l) {
        sku(d, l.skuId); Orbis.int(l.qty, 'Qty transfer');
        Orbis.need(l.qty > 0, 'VALIDATION', 'Qty transfer harus lebih dari 0');
        Orbis.need(!seen[l.skuId], 'VALIDATION', 'SKU dobel pada transfer'); seen[l.skuId] = 1;
        var avail = inv.available(d, l.skuId, from.id);
        Orbis.need(l.qty <= avail, 'INSUFFICIENT_STOCK', 'Qty transfer melebihi stok tersedia (' + avail + ')');
        return { skuId: l.skuId, qty: l.qty, received: null };
      });
      var t = { id: Orbis.nextId(d, 'TRF', 4), tenant: d.session.tenant, from: from.id, to: to.id, lines: lines, note: String(spec.note || '').trim(),
        status: 'DRAFT', createdBy: d.session.actor, createdAt: Orbis.clock.now(), discrepancy: [], history: [] };
      t.history.push({ at: t.createdAt, by: d.session.actor, from: null, to: 'DRAFT' });
      rows(d, 'stockTransfers').push(t);
      return t;
    }, { audit: function (t) { return { action: 'transfer.create', entity: 'transfer', entityId: t.id }; } });
  };
  /** SENT: TRANSFER_OUT at source (availability re-checked by inventory.move). */
  S.sendTransfer = function (id) {
    Orbis.require('stock.transfer');
    return Orbis.tx(function (d) {
      var t = find(d, 'stockTransfers', id, 'Transfer');
      Orbis.need(t.status === 'DRAFT', 'INVALID_STATE', 'Hanya transfer DRAFT yang bisa dikirim');
      t.lines.forEach(function (l) { inv.move(d, { skuId: l.skuId, qty: -l.qty, type: 'TRANSFER_OUT', ref: t.id, outlet: t.from, note: 'Transfer ke ' + t.to }); });
      t.sentAt = Orbis.clock.now(); hist(t, d, 'SENT');
      return t;
    }, { audit: { action: 'transfer.send', entity: 'transfer', entityId: id } });
  };
  /** RECEIVED at destination (session outlet must be the destination). received: {skuId: qty} (default = sent). Shortfall -> discrepancy. */
  S.receiveTransfer = function (id, received) {
    Orbis.require('stock.transfer');
    return Orbis.tx(function (d) {
      var t = find(d, 'stockTransfers', id, 'Transfer');
      Orbis.need(t.status === 'SENT', 'INVALID_STATE', 'Hanya transfer SENT yang bisa diterima');
      Orbis.need(d.session.outlet === t.to, 'OUTLET_MISMATCH', 'Penerimaan harus dilakukan di outlet tujuan');
      received = received || {};
      t.lines.forEach(function (l) {
        var q = received[l.skuId] == null ? l.qty : received[l.skuId];
        Orbis.int(q, 'Qty terima'); Orbis.need(q >= 0 && q <= l.qty, 'VALIDATION', 'Qty terima harus 0..' + l.qty);
        l.received = q;
        if (q) inv.move(d, { skuId: l.skuId, qty: q, type: 'TRANSFER_IN', ref: t.id, outlet: t.to, note: 'Transfer dari ' + t.from });
        if (q < l.qty) t.discrepancy.push({ skuId: l.skuId, qty: l.qty - q });
      });
      t.receivedAt = Orbis.clock.now(); t.receivedBy = d.session.actor; hist(t, d, 'RECEIVED');
      return t;
    }, { audit: function (t) { return { action: 'transfer.receive', entity: 'transfer', entityId: id, detail: t.discrepancy.length ? 'selisih ' + t.discrepancy.length + ' SKU' : null }; } });
  };
  S.cancelTransfer = function (id, reason) {
    Orbis.require('stock.transfer');
    reason = Orbis.reason(reason, 'Alasan batal');
    return Orbis.tx(function (d) {
      var t = find(d, 'stockTransfers', id, 'Transfer');
      Orbis.need(t.status === 'DRAFT', 'INVALID_STATE', 'Transfer yang sudah dikirim tidak bisa dibatalkan');
      hist(t, d, 'CANCELLED', reason);
      return t;
    }, { audit: { action: 'transfer.cancel', entity: 'transfer', entityId: id, detail: reason } });
  };

  /* ---------- reorder points ---------- */
  S.setReorderPoint = function (skuId, point) {
    Orbis.require('stock.adjust');
    Orbis.int(point, 'Batas pesan ulang'); Orbis.need(point >= 0, 'VALIDATION', 'Batas pesan ulang tidak boleh negatif');
    return Orbis.tx(function (d) {
      sku(d, skuId); outlet(d, d.session.outlet);
      var list = rows(d, 'reorderPoints'), r = list.filter(function (x) { return x.tenant === d.session.tenant && x.skuId === skuId && x.outlet === d.session.outlet; })[0];
      if (!r) { r = { tenant: d.session.tenant, outlet: d.session.outlet, skuId: skuId, point: 0 }; list.push(r); }
      r.point = point;
      return r;
    }, { audit: { action: 'stock.reorder', entity: 'sku', entityId: skuId, detail: String(point) } });
  };

  /* ---------- purchase orders: reject / cancel (finance.js keeps create/submit/approve/receive) ---------- */
  function poHist(po, d, to, note) { po.history.push({ at: Orbis.clock.now(), by: d.session.actor, from: po.status, to: to, note: note }); po.status = to; }
  S.rejectPo = function (id, reason) {
    Orbis.require('po.approve');
    reason = Orbis.reason(reason, 'Alasan penolakan');
    return Orbis.tx(function (d) {
      var po = find(d, 'purchaseOrders', id, 'PO');
      Orbis.need(po.status === 'SUBMITTED', 'INVALID_STATE', 'Hanya PO SUBMITTED yang bisa ditolak');
      po.rejectReason = reason; poHist(po, d, 'REJECTED', reason);
      return po;
    }, { audit: { action: 'po.reject', entity: 'po', entityId: id, detail: reason } });
  };
  S.cancelPo = function (id, reason) {
    Orbis.require('po.write');
    reason = Orbis.reason(reason, 'Alasan batal');
    return Orbis.tx(function (d) {
      var po = find(d, 'purchaseOrders', id, 'PO');
      Orbis.need(['DRAFT', 'SUBMITTED', 'APPROVED'].indexOf(po.status) >= 0 && !po.receipts.length, 'INVALID_STATE', 'PO yang sudah diterima tidak bisa dibatalkan');
      po.cancelReason = reason; poHist(po, d, 'CANCELLED', reason);
      return po;
    }, { audit: { action: 'po.cancel', entity: 'po', entityId: id, detail: reason } });
  };

  /* ---------- demo history (runs inside Orbis.demoHistory batch) ---------- */
  Orbis.demoHooks.push(function (ctx) {
    var now = ctx.now, H = ctx.HOUR, D = ctx.DAY;
    function avail(id, ol) { return inv.available(Orbis.db(), id, ol); }
    ctx.as('owner', 'Rina (Owner)', 'o1');
    ctx.at(now - 4 * D, function () {
      S.setReorderPoint('k6', 20); S.setReorderPoint('k1', 15); S.setReorderPoint('k4', 12);
      [['k4', -2, 'damaged', 'Croissant jatuh saat display'], ['k1', -1, 'internal', 'Tes resep baru'], ['k5', -1, 'sample', 'Sampel untuk pelanggan']].forEach(function (a) {
        if (avail(a[0], 'o1') >= 10) S.adjust({ skuId: a[0], qty: a[1], reason: a[2], note: a[3] });
      });
    });
    // approved opname at BSD: counted by manager, approved by owner
    ctx.at(now - 3 * D, function () {
      ctx.as('manager', 'Dewa (Manager)', 'o2');
      var so = S.createCount({ skuIds: ['k2', 'k3', 'k5', 'k7'], note: 'Opname mingguan BSD' });
      var c = {}; so.lines.forEach(function (l, i) { c[l.skuId] = Math.max(0, l.system + [-2, 0, -1, 1][i]); });
      S.setCounts(so.id, c); S.submitCount(so.id);
      ctx.as('owner', 'Rina (Owner)', 'o2');
      S.approveCount(so.id);
    });
    // transfer Senopati -> BSD, sent and received
    ctx.at(now - 2 * D, function () {
      ctx.as('manager', 'Dewa (Manager)', 'o1');
      if (avail('k2', 'o1') < 15) return;
      var t = S.createTransfer({ to: 'o2', lines: [{ skuId: 'k2', qty: 5 }], note: 'Pinjam stok Americano' });
      S.sendTransfer(t.id);
      ctx.at(now - 2 * D + 3 * H, function () { ctx.as('manager', 'Dewa (Manager)', 'o2'); S.receiveTransfer(t.id); });
    });
    // submitted opname at Senopati, waiting for owner
    ctx.at(now - 6 * H, function () {
      ctx.as('manager', 'Dewa (Manager)', 'o1');
      var so = S.createCount({ skuIds: ['k1', 'k4', 'k8'], note: 'Opname harian roti' });
      var c = {}; so.lines.forEach(function (l, i) { c[l.skuId] = Math.max(0, l.system + [0, -1, -2][i]); });
      S.setCounts(so.id, c); S.submitCount(so.id);
    });
    // transfer sent, not yet received at BSD
    ctx.at(now - 3 * H, function () {
      ctx.as('owner', 'Rina (Owner)', 'o1');
      if (avail('k7', 'o1') < 12) return;
      var t = S.createTransfer({ to: 'o2', lines: [{ skuId: 'k7', qty: 6 }], note: 'Es teh untuk BSD' });
      S.sendTransfer(t.id);
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
