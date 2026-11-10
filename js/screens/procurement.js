/* Orbis v2 — screen: procurement (PO, penerimaan, pemasok, stok). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions, P = Orbis.domain.procurement;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.procurement = Orbis.ui.procurement || { tab: 'po' };
  function rerender() { if (Orbis.render) Orbis.render(); }
  function skuName(d, id) { var s = d.skus.filter(function (x) { return x.id === id; })[0]; if (!s) return id; var p = d.products.filter(function (x) { return x.id === s.productId; })[0]; return (p ? p.name : '') + ' (' + s.sku + ')'; }
  function supName(d, id) { var s = Orbis.mine(d, 'suppliers').filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }

  Orbis.screens.procurement = function (d) {
    var tab = ui.tab;
    var tabs = Orbis.tabs([['po', 'Pembelian'], ['rcv', 'Penerimaan'], ['sup', 'Pemasok'], ['stk', 'Stok']], tab, 'procTab');
    var head = Orbis.pageHead('Pembelian & Stok', 'Penerimaan barang menambah stok dan akrual pembelian, bukan biaya.');
    if (tab === 'rcv') return head + tabs + rcvView(d);
    if (tab === 'sup') return head + tabs + supView(d);
    if (tab === 'stk') return head + tabs + stkView(d);
    return head + tabs + poView(d);
  };
  function poView(d) {
    var can = Orbis.can('po.write'), appr = Orbis.can('po.approve');
    var rows = Orbis.mine(d, 'purchaseOrders').slice().reverse();
    return (can ? '<p>' + Orbis.btn('PO baru', 'procPoNew', null, { kind: 'primary', icon: 'plus' }) + '</p>' : '') + Orbis.table([
      { label: 'PO', fmt: function (p) { return '<b>' + esc(p.id) + '</b><br><small>' + esc(p.createdBy) + '</small>'; } },
      { label: 'Pemasok', fmt: function (p) { return esc(supName(d, p.supplierId)); } },
      { label: 'Baris', fmt: function (p) { return p.lines.map(function (l) { return esc(skuName(d, l.skuId)) + ' ' + esc(l.received) + '/' + esc(l.qty); }).join('<br>'); } },
      { label: 'Total', right: true, fmt: function (p) { return esc(Orbis.idr(p.total)); } },
      { label: 'Status', fmt: function (p) { return Orbis.chip(p.status) + (p.approvedBy ? '<br><small>Disetujui: ' + esc(p.approvedBy) + '</small>' : ''); } },
      { label: 'Aksi', fmt: function (p) {
        var h = '';
        if (can && p.status === 'DRAFT') h += Orbis.btn('Ajukan', 'procSubmit', [p.id]);
        if (appr && p.status === 'SUBMITTED') h += Orbis.btn('Setujui', 'procApprove', [p.id], { kind: 'primary' });
        if (can && (p.status === 'APPROVED' || p.status === 'PARTIAL')) h += Orbis.btn('Terima', 'procRcvOpen', [p.id], { kind: 'primary' });
        return h;
      } }
    ], rows, 'Belum ada PO.');
  }
  function rcvView(d) {
    var rows = [];
    Orbis.mine(d, 'purchaseOrders').forEach(function (p) { p.receipts.forEach(function (r) { rows.push({ po: p.id, r: r }); }); });
    rows.sort(function (a, b) { return b.r.at - a.r.at; });
    return Orbis.table([
      { label: 'Penerimaan', fmt: function (x) { return esc(x.r.id); } }, { label: 'PO', fmt: function (x) { return esc(x.po); } },
      { label: 'Waktu', fmt: function (x) { return esc(Orbis.fmtTime(x.r.at)); } },
      { label: 'Item', fmt: function (x) { return x.r.lines.map(function (l) { return esc(skuName(d, l.skuId)) + ' x' + esc(l.qty); }).join('<br>'); } },
      { label: 'Nilai akrual', right: true, fmt: function (x) { return esc(Orbis.idr(x.r.amount)); } }
    ], rows, 'Belum ada penerimaan.');
  }
  function supView(d) {
    var can = Orbis.can('po.write');
    return (can ? '<p>' + Orbis.btn('Pemasok baru', 'procSupEdit', [''], { kind: 'primary', icon: 'plus' }) + '</p>' : '') + Orbis.table([
      { label: 'Nama', fmt: function (s) { return esc(s.name); } }, { label: 'Telepon', fmt: function (s) { return esc(s.phone); } },
      { label: 'Aksi', fmt: function (s) { return can ? Orbis.btn('Ubah', 'procSupEdit', [s.id]) + Orbis.btn('Hapus', 'procSupDel', [s.id], { kind: 'danger' }) : ''; } }
    ], Orbis.mine(d, 'suppliers'), 'Belum ada pemasok.');
  }
  function stkView(d) {
    var can = Orbis.can('stock.adjust');
    return Orbis.table([
      { label: 'Produk', fmt: function (r) { return esc(r.product.name || r.sku.sku); } }, { label: 'SKU', fmt: function (r) { return esc(r.sku.sku); } },
      { label: 'Stok', right: true, fmt: function (r) { return esc(r.onHand); } }, { label: 'Tersedia', right: true, fmt: function (r) { return esc(r.available); } },
      { label: 'Aksi', fmt: function (r) { return can ? Orbis.btn('Koreksi', 'procAdjOpen', [r.sku.id]) : ''; } }
    ], Orbis.domain.inventory.catalog(d), 'Belum ada stok.');
  }

  A.procTab = function (t) { ui.tab = t; rerender(); };
  A.procPoNew = function () {
    var d = Orbis.db(), sups = Orbis.mine(d, 'suppliers').map(function (s) { return [s.id, s.name]; });
    var skus = Orbis.mine(d, 'skus').map(function (s) { return [s.id, skuName(d, s.id)]; });
    Orbis.modal('PO baru', Orbis.field('Pemasok', 'supplierId', '', { type: 'select', options: sups }) + Orbis.field('SKU', 'skuId', '', { type: 'select', options: skus }) +
      Orbis.field('Qty', 'qty', 1, { type: 'number', min: 1 }) + Orbis.field('Harga beli satuan (Rp)', 'unitCost', 0, { type: 'number', min: 0 }) + Orbis.field('Catatan', 'note', ''),
      Orbis.btn('Simpan draft', 'procPoSave', null, { kind: 'primary' }));
  };
  A.procPoSave = function () {
    var f = Orbis.formData();
    P.createPo({ supplierId: f.supplierId, note: f.note, lines: [{ skuId: f.skuId, qty: Number(f.qty), unitCost: Number(f.unitCost) }] });
    Orbis.closeModal(); Orbis.toast('PO dibuat (DRAFT)');
  };
  A.procSubmit = function (id) { P.submit(id); Orbis.toast('PO diajukan'); };
  A.procApprove = function (id) { P.approve(id); Orbis.toast('PO disetujui'); };
  A.procRcvOpen = function (id) {
    var d = Orbis.db(), po = Orbis.mine(d, 'purchaseOrders').filter(function (p) { return p.id === id; })[0];
    if (!po) throw Orbis.Err('NOT_FOUND', 'PO tidak ditemukan');
    var rid = 'RCV-' + id + '-' + (po.receipts.length + 1);
    Orbis.modal('Terima barang ' + id, '<input type="hidden" name="poId" value="' + esc(id) + '"><input type="hidden" name="rid" value="' + esc(rid) + '">' +
      po.lines.map(function (l, i) { return '<input type="hidden" name="s' + i + '" value="' + esc(l.skuId) + '">' + Orbis.field(skuName(d, l.skuId) + ' (sisa ' + (l.qty - l.received) + ')', 'q' + i, 0, { type: 'number', min: 0 }); }).join(''),
      Orbis.btn('Catat penerimaan', 'procRcv', [po.lines.length], { kind: 'primary' }));
  };
  A.procRcv = function (n) {
    var f = Orbis.formData(), lines = [];
    for (var i = 0; i < n; i++) { var q = Number(f['q' + i]); if (q) lines.push({ skuId: f['s' + i], qty: q }); }
    P.receive(f.poId, lines, f.rid);
    Orbis.closeModal(); Orbis.toast('Penerimaan dicatat');
  };
  A.procSupEdit = function (id) {
    var d = Orbis.db(), s = Orbis.mine(d, 'suppliers').filter(function (x) { return x.id === id; })[0] || {};
    Orbis.modal(s.id ? 'Ubah pemasok' : 'Pemasok baru', '<input type="hidden" name="id" value="' + esc(s.id || '') + '">' + Orbis.field('Nama', 'name', s.name || '') + Orbis.field('Telepon', 'phone', s.phone || ''), Orbis.btn('Simpan', 'procSupSave', null, { kind: 'primary' }));
  };
  A.procSupSave = function () { var f = Orbis.formData(); P.saveSupplier({ id: f.id || null, name: f.name, phone: f.phone }); Orbis.closeModal(); Orbis.toast('Pemasok disimpan'); };
  A.procSupDel = function (id) { if (g.confirm && !g.confirm('Hapus pemasok ini?')) return; P.removeSupplier(id); Orbis.toast('Pemasok dihapus'); };
  A.procAdjOpen = function (skuId) {
    var d = Orbis.db();
    Orbis.modal('Koreksi stok ' + skuName(d, skuId), '<input type="hidden" name="skuId" value="' + esc(skuId) + '">' + Orbis.field('Hitungan fisik', 'count', Orbis.domain.inventory.onHand(d, skuId, d.session.outlet), { type: 'number', min: 0 }) + Orbis.field('Alasan (min. 5 karakter)', 'reason', ''), Orbis.btn('Simpan koreksi', 'procAdj', null, { kind: 'primary' }));
  };
  A.procAdj = function () { var f = Orbis.formData(); Orbis.domain.inventory.adjust(f.skuId, Number(f.count), f.reason); Orbis.closeModal(); Orbis.toast('Stok dikoreksi'); };
})(typeof window !== 'undefined' ? window : globalThis);
