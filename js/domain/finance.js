/* Orbis v2 — finance domain: catalog, procurement, expenses (approval matrix), reports.
   Pure (no DOM). Money = integer IDR. Stock only via Orbis.domain.inventory. Receiving PO is NOT an expense
   (purchase accrual ledger row); expense is posted only on pay (EXPENSE_PAID). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis;
  /* lazy: inventory.js may load after this file (alphabetical in test harness) */
  var inv = { move: function (d, o) { return Orbis.domain.inventory.move(d, o); }, onHand: function (d, s, o) { return Orbis.domain.inventory.onHand(d, s, o); }, catalog: function (d) { return Orbis.domain.inventory.catalog(d); } };
  var catalog = Orbis.domain.catalog = {};
  var procurement = Orbis.domain.procurement = {};
  var expenses = Orbis.domain.expenses = {};
  var reports = Orbis.domain.reports = {};

  function tenantRows(d, c) { return (d[c] || []).filter(function (r) { return r.tenant === d.session.tenant; }); }
  function find(d, c, id, label) {
    var r = tenantRows(d, c).filter(function (x) { return x.id === id; })[0];
    if (!r) throw Orbis.Err('NOT_FOUND', (label || 'Data') + ' tidak ditemukan');
    return r;
  }
  function str(v) { return String(v == null ? '' : v).trim(); }
  function ledger(d) { d.ledger = d.ledger || []; return d.ledger; }
  function dayOf(ms) { return new Date(ms).toISOString().slice(0, 10); }

  /* ======================= CATALOG ======================= */
  catalog.MAX_ROWS = 500;

  function normSku(v, label) {
    var o = {
      id: v.id || null, sku: str(v.sku), label: str(v.label) || 'Standar', barcode: str(v.barcode),
      price: v.price, cost: v.cost, stock: v.stock == null || v.stock === '' ? 0 : v.stock
    };
    Orbis.need(o.sku, 'VALIDATION', (label || 'Varian') + ': kode SKU wajib diisi');
    Orbis.int(o.price, 'Harga'); Orbis.int(o.cost, 'HPP'); Orbis.int(o.stock, 'Stok awal');
    Orbis.need(o.price >= 0 && o.cost >= 0 && o.stock >= 0, 'VALIDATION', (label || 'Varian') + ': harga, HPP, stok tidak boleh negatif');
    return o;
  }
  /** Check uniqueness (case-insensitive sku, barcode) against tenant skus + `seen` batch. ignoreId = sku being edited. */
  function checkUnique(d, o, seen, ignoreId) {
    var low = o.sku.toLowerCase();
    tenantRows(d, 'skus').forEach(function (s) {
      if (s.id === ignoreId) return;
      if (String(s.sku).toLowerCase() === low) throw Orbis.Err('DUPLICATE_SKU', 'SKU "' + o.sku + '" sudah dipakai');
      if (o.barcode && s.barcode && s.barcode === o.barcode) throw Orbis.Err('DUPLICATE_BARCODE', 'Barcode "' + o.barcode + '" sudah dipakai');
    });
    if (seen.sku[low]) throw Orbis.Err('DUPLICATE_SKU', 'SKU "' + o.sku + '" dobel dalam input');
    seen.sku[low] = 1;
    if (o.barcode) {
      if (seen.bar[o.barcode]) throw Orbis.Err('DUPLICATE_BARCODE', 'Barcode "' + o.barcode + '" dobel dalam input');
      seen.bar[o.barcode] = 1;
    }
  }
  function addProduct(d, spec, published) {
    var name = str(spec.name), category = str(spec.category) || 'Umum';
    Orbis.need(name, 'VALIDATION', 'Nama produk wajib diisi');
    Orbis.need(Array.isArray(spec.skus) && spec.skus.length >= 1, 'VALIDATION', 'Produk minimal punya satu varian (SKU)');
    var seen = { sku: {}, bar: {} };
    var norm = spec.skus.map(function (v) { var o = normSku(v); checkUnique(d, o, seen, null); return o; });
    var p = { id: Orbis.nextId(d, 'PRD', 4), tenant: d.session.tenant, name: name, category: category, published: !!published, art: d.products.length % 8 };
    d.products.push(p);
    norm.forEach(function (o) {
      var s = { id: Orbis.nextId(d, 'SKU', 4), tenant: d.session.tenant, productId: p.id, sku: o.sku, label: o.label, price: o.price, cost: o.cost, barcode: o.barcode };
      d.skus.push(s);
      if (o.stock > 0) inv.move(d, { skuId: s.id, qty: o.stock, type: 'OPENING', ref: s.id, note: 'Stok awal' });
    });
    return p;
  }

  catalog.createProduct = function (spec) {
    Orbis.require('catalog.write');
    return Orbis.tx(function (d) { return addProduct(d, spec || {}, spec && spec.published === true); },
      { audit: function (p) { return { action: 'catalog.create', entity: 'product', entityId: p.id }; } });
  };

  /** spec {name, category, skus:[{id?, sku, label, price, cost, barcode}]}. Stock is never edited here (new sku may carry opening stock). */
  catalog.updateProduct = function (productId, spec) {
    Orbis.require('catalog.write');
    spec = spec || {};
    return Orbis.tx(function (d) {
      var p = find(d, 'products', productId, 'Produk');
      var name = str(spec.name); Orbis.need(name, 'VALIDATION', 'Nama produk wajib diisi');
      Orbis.need(Array.isArray(spec.skus) && spec.skus.length >= 1, 'VALIDATION', 'Produk minimal punya satu varian (SKU)');
      var seen = { sku: {}, bar: {} }, existing = tenantRows(d, 'skus');
      var pending = spec.skus.map(function (v) {
        var o = normSku(v);
        if (o.id) { var cur = existing.filter(function (s) { return s.id === o.id && s.productId === p.id; })[0]; Orbis.need(cur, 'NOT_FOUND', 'Varian tidak ditemukan'); }
        checkUnique(d, o, seen, o.id);
        return o;
      });
      p.name = name; p.category = str(spec.category) || p.category;
      pending.forEach(function (o) {
        if (o.id) {
          var s = existing.filter(function (x) { return x.id === o.id; })[0];
          s.sku = o.sku; s.label = o.label; s.price = o.price; s.cost = o.cost; s.barcode = o.barcode;
        } else {
          var n = { id: Orbis.nextId(d, 'SKU', 4), tenant: d.session.tenant, productId: p.id, sku: o.sku, label: o.label, price: o.price, cost: o.cost, barcode: o.barcode };
          d.skus.push(n);
          if (o.stock > 0) inv.move(d, { skuId: n.id, qty: o.stock, type: 'OPENING', ref: n.id, note: 'Stok awal' });
        }
      });
      return p;
    }, { audit: { action: 'catalog.update', entity: 'product', entityId: productId } });
  };

  catalog.togglePublish = function (productId) {
    Orbis.require('catalog.write');
    return Orbis.tx(function (d) { var p = find(d, 'products', productId, 'Produk'); p.published = !p.published; return p; },
      { audit: function (p) { return { action: p.published ? 'catalog.publish' : 'catalog.unpublish', entity: 'product', entityId: p.id }; } });
  };

  /* ---- CSV import ---- */
  var REQUIRED = ['name', 'sku', 'price', 'cost', 'stock', 'category'];
  function splitCsv(text) {
    var rows = [], row = [], cell = '', q = false, line = 1, startLine = 1, i, c;
    text = String(text || '').replace(/^﻿/, '');
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else { if (c === '\n') line++; cell += c; }
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        rows.push({ line: startLine, cells: row }); row = []; line++; startLine = line;
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push({ line: startLine, cells: row }); }
    return rows.filter(function (r) { return !(r.cells.length === 1 && str(r.cells[0]) === ''); });
  }
  var INT_RE = /^\d+$/;
  /** Validate rows against rules + (optionally) db. Returns errors [{line,message}]. */
  function validateRows(rows, d) {
    var errors = [], seen = {}, seenBar = {};
    var skus = d ? tenantRows(d, 'skus') : [];
    rows.forEach(function (r) {
      var l = r.line;
      if (!str(r.name)) errors.push({ line: l, message: 'name wajib diisi' });
      if (!str(r.sku)) errors.push({ line: l, message: 'sku wajib diisi' });
      if (!str(r.category)) errors.push({ line: l, message: 'category wajib diisi' });
      ['price', 'cost', 'stock'].forEach(function (k) {
        if (!INT_RE.test(String(r[k] == null ? '' : r[k]).trim())) errors.push({ line: l, message: k + ' harus bilangan bulat >= 0' });
      });
      var low = str(r.sku).toLowerCase();
      if (low) {
        if (seen[low]) errors.push({ line: l, message: 'sku "' + r.sku + '" dobel dengan baris ' + seen[low] });
        else seen[low] = l;
        if (skus.some(function (s) { return String(s.sku).toLowerCase() === low; })) errors.push({ line: l, message: 'sku "' + r.sku + '" sudah ada' });
      }
      var bar = str(r.barcode);
      if (bar) {
        if (seenBar[bar]) errors.push({ line: l, message: 'barcode "' + bar + '" dobel dengan baris ' + seenBar[bar] });
        else seenBar[bar] = l;
        if (skus.some(function (s) { return s.barcode === bar; })) errors.push({ line: l, message: 'barcode "' + bar + '" sudah ada' });
      }
    });
    return errors;
  }
  /** parseCsv(text) -> {rows, errors}. Header required: name,sku,price,cost,stock,category (barcode optional). Line numbers are 1-based file lines. */
  catalog.parseCsv = function (text) {
    var recs = splitCsv(text), errors = [], rows = [];
    if (!recs.length) return { rows: [], errors: [{ line: 1, message: 'File kosong' }] };
    var head = recs[0].cells.map(function (h) { return str(h).toLowerCase(); });
    var missing = REQUIRED.filter(function (c) { return head.indexOf(c) < 0; });
    if (missing.length) return { rows: [], errors: [{ line: recs[0].line, message: 'Kolom wajib tidak ada: ' + missing.join(', ') }] };
    if (recs.length - 1 > catalog.MAX_ROWS) return { rows: [], errors: [{ line: 1, message: 'Maksimal ' + catalog.MAX_ROWS + ' baris per impor' }] };
    recs.slice(1).forEach(function (r) {
      if (r.cells.length !== head.length) { errors.push({ line: r.line, message: 'Jumlah kolom ' + r.cells.length + ', seharusnya ' + head.length }); return; }
      var o = { line: r.line };
      head.forEach(function (h, i) { o[h] = str(r.cells[i]); });
      rows.push(o);
    });
    if (!recs.slice(1).length) errors.push({ line: recs[0].line, message: 'Tidak ada baris data' });
    var db = null; try { db = Orbis.db(); } catch (e) { db = null; }
    errors = errors.concat(validateRows(rows, db));
    errors.sort(function (a, b) { return a.line - b.line; });
    return { rows: rows, errors: errors };
  };
  /** ATOMIC: any error -> nothing written, all errors on err.errors. Imported products are unpublished drafts. */
  catalog.commitImport = function (rows) {
    Orbis.require('catalog.write');
    Orbis.need(Array.isArray(rows) && rows.length, 'VALIDATION', 'Tidak ada baris untuk diimpor');
    return Orbis.tx(function (d) {
      var errs = validateRows(rows, d);
      if (errs.length) { var e = Orbis.Err('IMPORT_INVALID', 'Impor ditolak: ' + errs.length + ' kesalahan, tidak ada data ditulis'); e.errors = errs; throw e; }
      rows.forEach(function (r) {
        addProduct(d, { name: r.name, category: r.category, skus: [{ sku: r.sku, price: Number(r.price), cost: Number(r.cost), stock: Number(r.stock), barcode: r.barcode }] }, false);
      });
      return rows.length;
    }, { audit: function (n) { return { action: 'catalog.import', entity: 'product', detail: n + ' produk (draft)' }; } });
  };

  catalog.list = function (d) {
    return tenantRows(d, 'products').map(function (p) {
      var skus = tenantRows(d, 'skus').filter(function (s) { return s.productId === p.id; });
      return { product: p, skus: skus, onHand: Orbis.sum(skus, function (s) { return inv.onHand(d, s.id); }) };
    });
  };

  /* ======================= PROCUREMENT ======================= */
  procurement.saveSupplier = function (spec) {
    Orbis.require('po.write'); spec = spec || {};
    return Orbis.tx(function (d) {
      var name = str(spec.name); Orbis.need(name, 'VALIDATION', 'Nama pemasok wajib diisi');
      if (spec.id) { var s = find(d, 'suppliers', spec.id, 'Pemasok'); s.name = name; s.phone = str(spec.phone); return s; }
      var n = { id: Orbis.nextId(d, 'SUP', 3), tenant: d.session.tenant, name: name, phone: str(spec.phone) };
      d.suppliers.push(n); return n;
    }, { audit: function (s) { return { action: spec.id ? 'supplier.update' : 'supplier.create', entity: 'supplier', entityId: s.id }; } });
  };
  procurement.removeSupplier = function (id) {
    Orbis.require('po.write');
    return Orbis.tx(function (d) {
      find(d, 'suppliers', id, 'Pemasok');
      Orbis.need(!tenantRows(d, 'purchaseOrders').some(function (p) { return p.supplierId === id; }), 'IN_USE', 'Pemasok masih dipakai pada PO');
      d.suppliers = d.suppliers.filter(function (s) { return !(s.id === id && s.tenant === d.session.tenant); });
      return id;
    }, { audit: { action: 'supplier.delete', entity: 'supplier', entityId: id } });
  };

  /** spec {supplierId, lines:[{skuId,qty,unitCost}], note}. Creates DRAFT. */
  procurement.createPo = function (spec) {
    Orbis.require('po.write'); spec = spec || {};
    return Orbis.tx(function (d) {
      find(d, 'suppliers', spec.supplierId, 'Pemasok');
      Orbis.need(Array.isArray(spec.lines) && spec.lines.length, 'VALIDATION', 'PO minimal punya satu baris');
      var seen = {};
      var lines = spec.lines.map(function (l) {
        find(d, 'skus', l.skuId, 'SKU');
        Orbis.need(!seen[l.skuId], 'VALIDATION', 'SKU dobel pada PO'); seen[l.skuId] = 1;
        Orbis.int(l.qty, 'Qty'); Orbis.int(l.unitCost, 'Harga beli');
        Orbis.need(l.qty > 0, 'VALIDATION', 'Qty harus lebih dari 0');
        Orbis.need(l.unitCost >= 0, 'VALIDATION', 'Harga beli tidak boleh negatif');
        return { skuId: l.skuId, qty: l.qty, unitCost: l.unitCost, received: 0 };
      });
      var po = { id: Orbis.nextId(d, 'PO', 4), tenant: d.session.tenant, supplierId: spec.supplierId, lines: lines,
        total: Orbis.sum(lines, function (l) { return l.qty * l.unitCost; }), note: str(spec.note), status: 'DRAFT',
        createdBy: d.session.actor, createdAt: Orbis.clock.now(), approvedBy: null, receipts: [], history: [] };
      po.history.push({ at: po.createdAt, by: d.session.actor, from: null, to: 'DRAFT' });
      d.purchaseOrders.push(po); return po;
    }, { audit: function (po) { return { action: 'po.create', entity: 'po', entityId: po.id }; } });
  };
  function poMove(po, d, to) { po.history.push({ at: Orbis.clock.now(), by: d.session.actor, from: po.status, to: to }); po.status = to; }
  procurement.submit = function (id) {
    Orbis.require('po.write');
    return Orbis.tx(function (d) {
      var po = find(d, 'purchaseOrders', id, 'PO');
      Orbis.need(po.status === 'DRAFT', 'INVALID_STATE', 'Hanya PO DRAFT yang bisa diajukan');
      poMove(po, d, 'SUBMITTED'); return po;
    }, { audit: { action: 'po.submit', entity: 'po', entityId: id } });
  };
  /** Owner only. Creator may approve own PO (owner) but approver is recorded. */
  procurement.approve = function (id) {
    Orbis.require('po.approve');
    return Orbis.tx(function (d) {
      var po = find(d, 'purchaseOrders', id, 'PO');
      Orbis.need(po.status === 'SUBMITTED', 'INVALID_STATE', 'Hanya PO SUBMITTED yang bisa disetujui');
      po.approvedBy = d.session.actor; po.approvedAt = Orbis.clock.now();
      poMove(po, d, 'APPROVED'); return po;
    }, { audit: { action: 'po.approve', entity: 'po', entityId: id } });
  };
  /** receive(poId, [{skuId,qty}], receiptId?). Idempotent per receiptId. Writes PURCHASE_RECEIPT moves + purchaseAccrual ledger row (not an expense). */
  procurement.receive = function (poId, lines, receiptId) {
    Orbis.require('po.write');
    return Orbis.tx(function (d) {
      var po = find(d, 'purchaseOrders', poId, 'PO');
      var rid = str(receiptId) || Orbis.nextId(d, 'RCV', 4);
      if (po.receipts.some(function (r) { return r.id === rid; })) return po;      // idempotent replay
      Orbis.need(po.status === 'APPROVED' || po.status === 'PARTIAL', 'INVALID_STATE', 'PO harus APPROVED/PARTIAL untuk diterima');
      Orbis.need(Array.isArray(lines) && lines.length, 'VALIDATION', 'Tidak ada baris penerimaan');
      var seen = {}, amount = 0, rec = [];
      lines.forEach(function (l) {
        Orbis.int(l.qty, 'Qty terima');
        if (l.qty === 0) return;
        Orbis.need(l.qty > 0, 'VALIDATION', 'Qty terima harus lebih dari 0');
        Orbis.need(!seen[l.skuId], 'VALIDATION', 'SKU dobel pada penerimaan'); seen[l.skuId] = 1;
        var pl = po.lines.filter(function (x) { return x.skuId === l.skuId; })[0];
        Orbis.need(pl, 'NOT_FOUND', 'SKU tidak ada di PO');
        Orbis.need(l.qty <= pl.qty - pl.received, 'OVER_RECEIPT', 'Penerimaan melebihi sisa PO (sisa ' + (pl.qty - pl.received) + ')');
        rec.push({ pl: pl, qty: l.qty });
      });
      Orbis.need(rec.length, 'VALIDATION', 'Qty terima semuanya 0');
      rec.forEach(function (x) {
        inv.move(d, { skuId: x.pl.skuId, qty: x.qty, type: 'PURCHASE_RECEIPT', ref: po.id + ':' + rid, note: 'Penerimaan ' + po.id });
        x.pl.received += x.qty; amount += x.qty * x.pl.unitCost;
      });
      po.receipts.push({ id: rid, at: Orbis.clock.now(), by: d.session.actor, lines: rec.map(function (x) { return { skuId: x.pl.skuId, qty: x.qty }; }), amount: amount });
      ledger(d).push({ id: Orbis.nextId(d, 'LED', 5), tenant: d.session.tenant, type: 'PURCHASE_ACCRUAL', ref: po.id, receiptId: rid, amount: amount, at: Orbis.clock.now(), by: d.session.actor });
      var done = po.lines.every(function (x) { return x.received >= x.qty; });
      poMove(po, d, done ? 'RECEIVED' : 'PARTIAL');
      return po;
    }, { audit: { action: 'po.receive', entity: 'po', entityId: poId } });
  };
  procurement.stock = function (d) { return inv.catalog(d); };

  /* ======================= EXPENSES ======================= */
  expenses.CATEGORIES = ['Operasional', 'Bahan Baku', 'Gaji', 'Sewa', 'Utilitas', 'Pemasaran', 'Transport', 'Lainnya'];
  expenses.MAX_ATTACHMENT = 2 * 1024 * 1024;
  var ATT_TYPES = { pdf: 'pdf', 'application/pdf': 'pdf', png: 'png', 'image/png': 'png', jpg: 'jpg', jpeg: 'jpg', 'image/jpeg': 'jpg' };

  function ruleFor(d, amount) {
    return tenantRows(d, 'approvalRules').filter(function (r) { return amount >= r.min && amount <= r.max; })[0] || null;
  }
  function expAudit(e, d, action) { e.history.push({ at: Orbis.clock.now(), by: d.session.actor, action: action, status: e.status }); }

  expenses.create = function (spec) {
    Orbis.require('expense.write'); spec = spec || {};
    return Orbis.tx(function (d) {
      Orbis.int(spec.amount, 'Nominal'); Orbis.need(spec.amount > 0, 'VALIDATION', 'Nominal harus lebih dari 0');
      Orbis.need(expenses.CATEGORIES.indexOf(spec.category) >= 0, 'VALIDATION', 'Kategori tidak valid');
      var note = str(spec.note); Orbis.need(note, 'VALIDATION', 'Catatan wajib diisi');
      var att = null;
      if (spec.attachment) {
        var a = spec.attachment, t = ATT_TYPES[String(a.type || '').toLowerCase()];
        Orbis.int(a.size, 'Ukuran lampiran');
        Orbis.need(a.size >= 0 && a.size <= expenses.MAX_ATTACHMENT, 'ATTACHMENT_TOO_LARGE', 'Lampiran maksimal 2 MB');
        Orbis.need(t, 'ATTACHMENT_TYPE', 'Lampiran harus pdf, png, atau jpg');
        Orbis.need(str(a.name), 'VALIDATION', 'Nama lampiran wajib');
        att = { name: str(a.name).slice(0, 120), size: a.size, type: t };
      }
      var e = { id: Orbis.nextId(d, 'EXP', 4), tenant: d.session.tenant, amount: spec.amount, category: spec.category, note: note,
        attachment: att, status: 'PENDING', createdBy: d.session.actor, createdAt: Orbis.clock.now(), approvedBy: null, rejectReason: null, paidAt: null, history: [] };
      expAudit(e, d, 'create'); d.expenses.push(e); return e;
    }, { audit: function (e) { return { action: 'expense.create', entity: 'expense', entityId: e.id }; } });
  };
  expenses.approve = function (id) {
    Orbis.require('expense.approve');
    return Orbis.tx(function (d, ctx) {
      var e = find(d, 'expenses', id, 'Biaya');
      Orbis.need(e.status === 'PENDING', 'INVALID_STATE', 'Hanya biaya PENDING yang bisa disetujui');
      var rule = ruleFor(d, e.amount);
      if (!rule) throw Orbis.Err('NO_APPROVAL_RULE', 'Tidak ada aturan persetujuan untuk nominal ini');
      if (ctx.role !== 'owner' && ctx.role !== rule.role) throw Orbis.Err('WRONG_APPROVER', 'Nominal ini harus disetujui oleh ' + rule.role);
      if (e.createdBy === ctx.actor) throw Orbis.Err('SELF_APPROVAL', 'Pembuat biaya tidak boleh menyetujui sendiri');
      e.status = 'APPROVED'; e.approvedBy = ctx.actor; e.approvedAt = Orbis.clock.now(); expAudit(e, d, 'approve'); return e;
    }, { audit: { action: 'expense.approve', entity: 'expense', entityId: id } });
  };
  expenses.reject = function (id, reason) {
    Orbis.require('expense.approve');
    return Orbis.tx(function (d, ctx) {
      var e = find(d, 'expenses', id, 'Biaya');
      var why = Orbis.reason(reason, 'Alasan penolakan');
      Orbis.need(e.status === 'PENDING', 'INVALID_STATE', 'Hanya biaya PENDING yang bisa ditolak');
      var rule = ruleFor(d, e.amount);
      if (!rule) throw Orbis.Err('NO_APPROVAL_RULE', 'Tidak ada aturan persetujuan untuk nominal ini');
      if (ctx.role !== 'owner' && ctx.role !== rule.role) throw Orbis.Err('WRONG_APPROVER', 'Nominal ini harus diproses oleh ' + rule.role);
      e.status = 'REJECTED'; e.rejectReason = why; e.rejectedBy = ctx.actor; expAudit(e, d, 'reject'); return e;
    }, { audit: { action: 'expense.reject', entity: 'expense', entityId: id } });
  };
  expenses.pay = function (id) {
    Orbis.require('expense.pay');
    return Orbis.tx(function (d, ctx) {
      var e = find(d, 'expenses', id, 'Biaya');
      if (e.status === 'PAID' || e.paidAt) throw Orbis.Err('ALREADY_PAID', 'Biaya sudah dibayar');
      Orbis.need(e.status === 'APPROVED', 'INVALID_STATE', 'Biaya harus APPROVED sebelum dibayar');
      e.status = 'PAID'; e.paidAt = Orbis.clock.now(); e.paidBy = ctx.actor; expAudit(e, d, 'pay');
      ledger(d).push({ id: Orbis.nextId(d, 'LED', 5), tenant: d.session.tenant, type: 'EXPENSE_PAID', ref: e.id, category: e.category, amount: e.amount, at: e.paidAt, by: ctx.actor });
      return e;
    }, { audit: { action: 'expense.pay', entity: 'expense', entityId: id } });
  };
  expenses.rules = function (d) { return tenantRows(d, 'approvalRules').slice().sort(function (a, b) { return a.min - b.min; }); };
  expenses.addRule = function (spec) {
    Orbis.require('team.write'); spec = spec || {};
    return Orbis.tx(function (d) {
      Orbis.int(spec.min, 'Batas bawah'); Orbis.int(spec.max, 'Batas atas');
      Orbis.need(spec.min >= 0 && spec.max >= spec.min, 'VALIDATION', 'Rentang tidak valid (min <= max, min >= 0)');
      Orbis.need(['manager', 'owner', 'finance'].indexOf(spec.role) >= 0, 'VALIDATION', 'Peran penyetuju tidak valid');
      var clash = tenantRows(d, 'approvalRules').filter(function (r) { return spec.min <= r.max && spec.max >= r.min; })[0];
      if (clash) throw Orbis.Err('OVERLAP', 'Rentang tumpang tindih dengan aturan ' + clash.min + ' - ' + clash.max);
      var r = { id: Orbis.nextId(d, 'AR', 3), tenant: d.session.tenant, min: spec.min, max: spec.max, role: spec.role };
      d.approvalRules.push(r); return r;
    }, { audit: function (r) { return { action: 'approvalRule.create', entity: 'approvalRule', entityId: r.id }; } });
  };
  expenses.removeRule = function (id) {
    Orbis.require('team.write');
    return Orbis.tx(function (d) {
      find(d, 'approvalRules', id, 'Aturan');
      d.approvalRules = d.approvalRules.filter(function (r) { return !(r.id === id && r.tenant === d.session.tenant); });
      return id;
    }, { audit: { action: 'approvalRule.delete', entity: 'approvalRule', entityId: id } });
  };
  /** Rule matching an amount (UI hint), or null. */
  expenses.ruleFor = function (d, amount) { return ruleFor(d, amount); };

  /* ======================= REPORTS ======================= */
  function inRange(ms, f) {
    if (ms == null) return true;
    var day = dayOf(ms);
    return (!f.from || day >= f.from) && (!f.to || day <= f.to);
  }
  function payTypes(d, orderId) { return tenantRows(d, 'payments').filter(function (p) { return p.orderId === orderId; }).map(function (p) { return p.type; }); }
  function ordersIn(d, f) {
    f = f || {};
    return tenantRows(d, 'orders').filter(function (o) {
      if (o.status === 'CANCELLED') return false;
      if (!inRange(o.createdAt, f)) return false;
      if (f.channel && o.channel !== f.channel) return false;
      if (f.payment && payTypes(d, o.id).indexOf(f.payment) < 0) return false;
      return true;
    });
  }
  function itemsOf(o) { return Array.isArray(o.items) ? o.items : []; }
  function orderCogs(o) { return Orbis.sum(itemsOf(o), function (i) { return (i.qty || 0) * (i.cost || 0); }); }

  reports.sales = function (d, f) {
    Orbis.require('report.read'); f = f || {};
    var os = ordersIn(d, f), byDay = {};
    os.forEach(function (o) { var k = dayOf(o.createdAt || 0); byDay[k] = byDay[k] || { day: k, orders: 0, revenue: 0 }; byDay[k].orders++; byDay[k].revenue += o.total || 0; });
    return { orders: os.length, revenue: Orbis.sum(os, function (o) { return o.total || 0; }), items: Orbis.sum(os, function (o) { return Orbis.sum(itemsOf(o), function (i) { return i.qty || 0; }); }),
      byDay: Object.keys(byDay).sort().map(function (k) { return byDay[k]; }) };
  };
  reports.products = function (d, f, sortBy) {
    Orbis.require('report.read');
    var m = {};
    ordersIn(d, f).forEach(function (o) {
      itemsOf(o).forEach(function (i) {
        var r = m[i.skuId] = m[i.skuId] || { skuId: i.skuId, name: i.name, qty: 0, revenue: 0, cogs: 0, margin: 0 };
        r.qty += i.qty || 0; r.revenue += (i.qty || 0) * (i.price || 0); r.cogs += (i.qty || 0) * (i.cost || 0);
      });
    });
    var rows = Object.keys(m).map(function (k) { var r = m[k]; r.margin = r.revenue - r.cogs; return r; });
    var key = sortBy === 'revenue' ? 'revenue' : 'qty';
    return rows.sort(function (a, b) { return b[key] - a[key] || (a.skuId < b.skuId ? -1 : 1); });
  };
  function paidExpenses(d, f) {
    return tenantRows(d, 'expenses').filter(function (e) { return e.status === 'PAID' && inRange(e.paidAt, f || {}); });
  }
  reports.expenses = function (d, f) {
    Orbis.require('report.read');
    var m = {};
    paidExpenses(d, f).forEach(function (e) { m[e.category] = (m[e.category] || 0) + e.amount; });
    var rows = Object.keys(m).sort().map(function (k) { return { category: k, amount: m[k] }; });
    return { rows: rows, total: Orbis.sum(rows, function (r) { return r.amount; }) };
  };
  var NOT_REFUNDED = { REJECTED: 1, PENDING: 1, REQUESTED: 1, CANCELLED: 1 };
  function refundsIn(d, f) {
    return tenantRows(d, 'refunds').filter(function (r) { return !NOT_REFUNDED[r.status] && inRange(r.at || r.createdAt, f || {}); });
  }
  /** profit = revenue - cogs - expenses(paid) - refunds. All integer IDR. */
  reports.profit = function (d, f) {
    Orbis.require('report.read');
    var os = ordersIn(d, f);
    var revenue = Orbis.sum(os, function (o) { return o.total || 0; });
    var cogs = Orbis.sum(os, orderCogs);
    var exp = Orbis.sum(paidExpenses(d, f), function (e) { return e.amount; });
    var ref = Orbis.sum(refundsIn(d, f), function (r) { return r.amount != null ? r.amount : (r.total || 0); });
    return { revenue: revenue, cogs: cogs, expenses: exp, refunds: ref, profit: revenue - cogs - exp - ref };
  };
  reports.inventoryValuation = function (d) {
    Orbis.require('report.read');
    var rows = tenantRows(d, 'skus').map(function (s) {
      var p = tenantRows(d, 'products').filter(function (x) { return x.id === s.productId; })[0] || {};
      var oh = inv.onHand(d, s.id);
      return { skuId: s.id, sku: s.sku, name: p.name || s.sku, onHand: oh, cost: s.cost, value: oh * s.cost };
    });
    return { rows: rows, total: Orbis.sum(rows, function (r) { return r.value; }) };
  };
  reports.delivery = function (d, f) {
    Orbis.require('report.read');
    var ds = tenantRows(d, 'deliveries').filter(function (x) { var t = x.createdAt || (x.history && x.history[0] && x.history[0].at); return inRange(t, f || {}); });
    var byStatus = {};
    ds.forEach(function (x) { byStatus[x.status] = (byStatus[x.status] || 0) + 1; });
    var os = tenantRows(d, 'orders');
    var pending = Orbis.sum(os.filter(function (o) { return o.paymentStatus === 'COLLECTION_PENDING'; }), function (o) { return o.total || 0; });
    var collected = Orbis.sum(os.filter(function (o) { return o.paymentStatus === 'COD_COLLECTED'; }), function (o) { return o.total || 0; });
    var remitted = Orbis.sum(tenantRows(d, 'remittances').filter(function (r) { return r.status === 'VERIFIED'; }), function (r) { return r.amount || 0; });
    return { total: ds.length, byStatus: byStatus, codPending: pending, codCollected: collected, codRemitted: remitted, codOutstanding: pending + Math.max(0, collected - remitted) };
  };
  reports.payments = function (d, f) {
    Orbis.require('report.read'); f = f || {};
    var m = {};
    tenantRows(d, 'payments').filter(function (p) { return inRange(p.at, f) && (!f.payment || p.type === f.payment); }).forEach(function (p) {
      var r = m[p.type] = m[p.type] || { type: p.type, count: 0, amount: 0 }; r.count++; r.amount += p.amount || 0;
    });
    var rows = Object.keys(m).sort().map(function (k) { return m[k]; });
    return { rows: rows, total: Orbis.sum(rows, function (r) { return r.amount; }) };
  };
  reports.customers = function (d, f) {
    Orbis.require('report.read');
    var m = {};
    ordersIn(d, f).forEach(function (o) {
      var c = o.customer || {}, k = c.phone || c.name || 'tamu';
      var r = m[k] = m[k] || { key: k, name: c.name || 'Tamu', phone: c.phone || '', orders: 0, spend: 0 };
      r.orders++; r.spend += o.total || 0;
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.spend - a.spend || (a.key < b.key ? -1 : 1); });
  };

  /** CSV with formula-injection defence (leading = + - @ tab CR -> apostrophe) and RFC4180 quoting. cols: [{k,label}] or strings. */
  reports.csvCell = function (v) {
    var s = v == null ? '' : String(v);
    if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  reports.exportCsv = function (rows, cols) {
    cols = cols.map(function (c) { return typeof c === 'string' ? { k: c, label: c } : c; });
    var out = [cols.map(function (c) { return reports.csvCell(c.label); }).join(',')];
    rows.forEach(function (r) { out.push(cols.map(function (c) { return reports.csvCell(r[c.k]); }).join(',')); });
    return out.join('\n');
  };
})(typeof window !== 'undefined' ? window : globalThis);
