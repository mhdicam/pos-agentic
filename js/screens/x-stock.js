/* Orbis v2 — tenant back-office screens: stock (RD-13). Route `stock` (ringkasan, kartu stok, penyesuaian, opname, transfer)
   and an upgraded `procurement` screen (multi-line PO, PO detail, reject/cancel, supplier detail). Loads after base screens. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions, S = Orbis.domain.stock, P = Orbis.domain.procurement, I = Orbis.domain.inventory;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.stock = Orbis.ui.stock || { tab: 'sum', sku: 'k1', from: '', to: '', type: '', doc: null };
  var pu = Orbis.ui.procurement = Orbis.ui.procurement || { tab: 'po' };
  var DAY = 86400000;

  ['owner', 'manager'].forEach(function (r) { Orbis.addNav(r, r === 'owner' ? 'Produk & Stok' : 'Operasional', ['stock', 'Stok & Opname', 'box'], 'procurement'); });

  function rerender() { if (Orbis.render) Orbis.render(); }
  function skuName(d, id) { var s = d.skus.filter(function (x) { return x.id === id; })[0]; if (!s) return id; var p = d.products.filter(function (x) { return x.id === s.productId; })[0]; return (p ? p.name : '') + ' (' + s.sku + (s.label && s.label !== 'Standar' ? ' ' + s.label : '') + ')'; }
  function olName(d, id) { var o = d.outlets.filter(function (x) { return x.id === id; })[0]; return o ? o.name : id; }
  function supName(d, id) { var s = Orbis.mine(d, 'suppliers').filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  function skus(d) { return Orbis.mine(d, 'skus').filter(function (s) { return !s.archived; }); }
  function dayMs(v, end) { if (!v) return null; var t = Date.parse(v + 'T00:00:00+07:00'); return isNaN(t) ? null : t + (end ? DAY - 1 : 0); }
  function signed(n) { return (n > 0 ? '+' : '') + n; }
  function num(v) { return v === '' || v == null ? null : Number(v); }
  function cell(cls, html) { return '<span class="' + cls + '">' + html + '</span>'; }

  /* ======================= route: stock ======================= */
  Orbis.screens.stock = function (d) {
    var tabs = Orbis.tabs([['sum', 'Ringkasan'], ['card', 'Kartu stok'], ['adj', 'Penyesuaian'], ['so', 'Stok opname'], ['trf', 'Transfer']], ui.tab, 'stkTab');
    var head = Orbis.pageHead('Stok & Opname', 'Outlet: ' + olName(d, d.session.outlet) + '. Semua angka dihitung dari mutasi stok, bukan total yang disimpan.');
    var body = ui.tab === 'card' ? cardView(d) : ui.tab === 'adj' ? adjView(d) : ui.tab === 'so' ? (ui.doc ? soDetail(d) : soList(d)) : ui.tab === 'trf' ? trfView(d) : sumView(d);
    return head + tabs + body;
  };

  function filters(withType) {
    return '<div class="filters" id="stk-f">' + Orbis.field('Dari', 'from', ui.from, { type: 'date' }) + Orbis.field('Sampai', 'to', ui.to, { type: 'date' }) +
      (withType ? Orbis.field('Jenis', 'type', ui.type, { type: 'select', options: [['', 'Semua']].concat(Object.keys(S.TYPE_LABEL).map(function (k) { return [k, S.TYPE_LABEL[k]]; })) }) : '') +
      Orbis.btn('Terapkan', 'stkFilter') + '</div>';
  }

  function sumView(d) {
    var ol = d.session.outlet, sm = S.summary(d, ol, dayMs(ui.from), dayMs(ui.to, true)), need = S.needsOrder(d, ol), canPo = Orbis.can('po.write'), canAdj = Orbis.can('stock.adjust');
    var q = function (k) { return function (r) { return esc(r[k] ? signed(r[k]) : '0'); }; };
    var needCard = Orbis.card('Perlu dipesan (' + need.length + ')', Orbis.table([
      { label: 'Produk', fmt: function (r) { return esc(skuName(d, r.skuId)); } },
      { label: 'Tersedia', right: true, fmt: function (r) { return esc(r.available); } },
      { label: 'Batas pesan', right: true, fmt: function (r) { return esc(r.point); } },
      { label: 'Saran qty', right: true, fmt: function (r) { return esc(r.qty); } }
    ], need, 'Tidak ada SKU di bawah batas pesan ulang.'), need.length && canPo ? Orbis.btn('Buat PO dari daftar', 'procPoNew', [true], { kind: 'primary', icon: 'plus' }) : '');
    return needCard + filters(false) + '<div class="stats">' + Orbis.stat('Nilai stok akhir (HPP)', Orbis.idr(sm.totalValue)) + Orbis.stat('SKU', String(sm.rows.length)) + '</div>' +
      Orbis.table([
        { label: 'Produk', fmt: function (r) { return esc(r.name) + '<br><small>' + esc(r.sku) + '</small>'; } },
        { label: 'Awal', right: true, fmt: function (r) { return esc(r.begin); } },
        { label: 'Pembelian', right: true, fmt: q('purchase') }, { label: 'Penjualan', right: true, fmt: q('sale') },
        { label: 'Retur', right: true, fmt: q('ret') }, { label: 'Transfer masuk', right: true, fmt: q('tin') },
        { label: 'Transfer keluar', right: true, fmt: q('tout') }, { label: 'Penyesuaian', right: true, fmt: q('adjust') },
        { label: 'Akhir', right: true, fmt: function (r) { return '<b>' + esc(r.end) + '</b>'; } },
        { label: 'Nilai', right: true, fmt: function (r) { return esc(Orbis.idr(r.value)); } },
        { label: 'Batas pesan', right: true, fmt: function (r) { var p = S.reorderPoint(d, r.skuId, ol); return esc(p || '-') + (canAdj ? ' ' + Orbis.btn('Ubah', 'stkReorderOpen', [r.skuId], { kind: 'ghost' }) : ''); } }
      ], sm.rows, 'Belum ada SKU.');
  }

  function cardView(d) {
    var list = skus(d), sel = list.some(function (s) { return s.id === ui.sku; }) ? ui.sku : (list[0] || {}).id;
    if (!sel) return Orbis.empty('Belum ada SKU.');
    var c = S.card(d, sel, d.session.outlet, { from: dayMs(ui.from), to: dayMs(ui.to, true), type: ui.type || null });
    return '<div class="filters">' + '<label class="sel"><span>SKU</span><select data-change="stkSku">' + list.map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(skuName(d, s.id)) + '</option>'; }).join('') + '</select></label></div>' +
      filters(true) + '<div class="stats">' + Orbis.stat('Saldo awal periode', String(c.opening)) + Orbis.stat('Stok saat ini', String(c.onHand)) + '</div>' +
      Orbis.table([
        { label: 'Waktu', fmt: function (r) { return esc(Orbis.fmtTime(r.at)); } },
        { label: 'Jenis', fmt: function (r) { return esc(r.label); } },
        { label: 'Qty', right: true, fmt: function (r) { return cell(r.qty < 0 ? 'stk-neg' : 'stk-pos', esc(signed(r.qty))); } },
        { label: 'Saldo', right: true, fmt: function (r) { return '<b>' + esc(r.balance) + '</b>'; } },
        { label: 'Referensi', fmt: function (r) { return '<span class="mono">' + esc(r.ref) + '</span>' + (r.note ? '<br><small>' + esc(r.note) + '</small>' : ''); } },
        { label: 'Oleh', fmt: function (r) { return esc(r.by); } }
      ], c.rows.slice().reverse(), 'Tidak ada mutasi pada filter ini.');
  }

  function adjView(d) {
    var can = Orbis.can('stock.adjust');
    var rows = Orbis.mine(d, 'stockMoves').filter(function (m) { return m.type === 'ADJUSTMENT' && m.outlet === d.session.outlet; }).sort(function (a, b) { return b.at - a.at; });
    return (can ? '<p>' + Orbis.btn('Penyesuaian baru', 'stkAdjOpen', null, { kind: 'primary', icon: 'plus' }) + '</p>' : '') + Orbis.table([
      { label: 'Waktu', fmt: function (m) { return esc(Orbis.fmtTime(m.at)); } },
      { label: 'Produk', fmt: function (m) { return esc(skuName(d, m.skuId)); } },
      { label: 'Qty', right: true, fmt: function (m) { return cell(m.qty < 0 ? 'stk-neg' : 'stk-pos', esc(signed(m.qty))); } },
      { label: 'Alasan', fmt: function (m) { return esc(m.note || '-'); } },
      { label: 'Ref', fmt: function (m) { return '<span class="mono">' + esc(m.ref) + '</span>'; } },
      { label: 'Oleh', fmt: function (m) { return esc(m.by); } }
    ], rows, 'Belum ada penyesuaian di outlet ini.');
  }

  function soList(d) {
    var can = Orbis.can('stock.opname');
    var rows = Orbis.mine(d, 'stockCounts').slice().reverse();
    return (can ? '<p class="row">' + Orbis.btn('Opname penuh', 'stkSoNew', [false], { kind: 'primary', icon: 'plus' }) + Orbis.btn('Opname sebagian', 'stkSoNew', [true]) + '</p>' : '') + Orbis.table([
      { label: 'Dokumen', fmt: function (x) { return '<b>' + esc(x.id) + '</b><br><small>' + esc(x.scope === 'full' ? 'Penuh' : 'Sebagian') + ' · ' + esc(x.createdBy) + '</small>'; } },
      { label: 'Outlet', fmt: function (x) { return esc(olName(d, x.outlet)); } },
      { label: 'Tanggal', fmt: function (x) { return esc(Orbis.fmtTime(x.createdAt)); } },
      { label: 'Selisih', right: true, fmt: function (x) { var v = S.variance(x); return esc(signed(v.qty)) + '<br><small>' + esc(Orbis.idr(v.value)) + '</small>'; } },
      { label: 'Status', fmt: function (x) { return Orbis.chip(x.status) + (x.rejectReason ? '<br><small>' + esc(x.rejectReason) + '</small>' : ''); } },
      { label: 'Aksi', fmt: function (x) { return Orbis.btn('Buka', 'stkSoOpen', [x.id]); } }
    ], rows, 'Belum ada dokumen opname.');
  }
  function soDetail(d) {
    var x = Orbis.mine(d, 'stockCounts').filter(function (r) { return r.id === ui.doc; })[0];
    if (!x) { ui.doc = null; return soList(d); }
    var v = S.variance(x), edit = x.status === 'DRAFT' && Orbis.can('stock.opname'), appr = x.status === 'SUBMITTED' && Orbis.can('stock.opname.approve');
    var after = x.status === 'SUBMITTED' || x.status === 'DRAFT' ? S.movesAfterSnapshot(d, x) : 0;
    var acts = Orbis.btn('Kembali', 'stkSoOpen', [null], { kind: 'ghost' }) +
      (edit ? Orbis.btn('Simpan hitungan', 'stkSoSave', [x.id]) + Orbis.btn('Ajukan', 'stkSoSubmit', [x.id], { kind: 'primary' }) : '') +
      (appr ? Orbis.btn('Setujui', 'stkSoApprove', [x.id], { kind: 'primary' }) + Orbis.btn('Tolak', 'stkSoRejectOpen', [x.id], { kind: 'danger' }) : '');
    var byId = {}; v.lines.forEach(function (l) { byId[l.skuId] = l; });
    return Orbis.card('Opname ' + x.id + ' · ' + olName(d, x.outlet), '<p class="row">' + Orbis.chip(x.status) + '<small>Snapshot ' + esc(Orbis.fmtTime(x.snapshotAt)) + ' · dibuat ' + esc(x.createdBy) +
      (x.approvedBy ? ' · disetujui ' + esc(x.approvedBy) : '') + '</small></p>' +
      (after ? '<div class="banner">' + esc(after) + ' mutasi terjadi setelah snapshot. Saat disetujui, selisih (hitung − sistem saat snapshot) ditambahkan ke stok terkini, sehingga mutasi tersebut tetap terjaga.</div>' : '') +
      '<div class="stats">' + Orbis.stat('Selisih qty', signed(v.qty)) + Orbis.stat('Selisih nilai (HPP)', Orbis.idr(v.value)) + '</div>' +
      '<div id="so-form">' + Orbis.table([
        { label: 'Produk', fmt: function (l) { return esc(skuName(d, l.skuId)); } },
        { label: 'Sistem', right: true, fmt: function (l) { return esc(l.system); } },
        { label: 'Hitung fisik', right: true, fmt: function (l) { return edit ? '<input class="stk-qty" type="number" min="0" name="c_' + esc(l.skuId) + '" value="' + esc(l.counted == null ? '' : l.counted) + '" aria-label="Hitung ' + esc(skuName(d, l.skuId)) + '">' : esc(l.counted == null ? '-' : l.counted); } },
        { label: 'Selisih', right: true, fmt: function (l) { var b = byId[l.skuId]; return cell(b.variance < 0 ? 'stk-neg' : b.variance > 0 ? 'stk-pos' : '', esc(signed(b.variance))); } },
        { label: 'Nilai', right: true, fmt: function (l) { return esc(Orbis.idr(byId[l.skuId].value)); } }
      ], x.lines) + '</div>', '<div class="actions">' + acts + '</div>');
  }

  function trfView(d) {
    var can = Orbis.can('stock.transfer'), here = d.session.outlet;
    var rows = Orbis.mine(d, 'stockTransfers').slice().reverse();
    return (can ? '<p>' + Orbis.btn('Transfer baru', 'stkTrfNew', null, { kind: 'primary', icon: 'plus' }) + '</p>' : '') + Orbis.table([
      { label: 'Transfer', fmt: function (t) { return '<b>' + esc(t.id) + '</b><br><small>' + esc(Orbis.fmtTime(t.createdAt)) + ' · ' + esc(t.createdBy) + '</small>'; } },
      { label: 'Rute', fmt: function (t) { return esc(olName(d, t.from)) + ' → ' + esc(olName(d, t.to)); } },
      { label: 'Item', fmt: function (t) { return t.lines.map(function (l) { return esc(skuName(d, l.skuId)) + ' ×' + esc(l.qty) + (l.received != null ? ' (terima ' + esc(l.received) + ')' : ''); }).join('<br>'); } },
      { label: 'Status', fmt: function (t) { return Orbis.chip(t.status) + (t.discrepancy.length ? '<br><small>Selisih: ' + t.discrepancy.map(function (x) { return esc(skuName(d, x.skuId)) + ' −' + esc(x.qty); }).join(', ') + '</small>' : ''); } },
      { label: 'Aksi', fmt: function (t) {
        if (!can) return '';
        var h = '';
        if (t.status === 'DRAFT' && t.from === here) h += Orbis.btn('Kirim', 'stkTrfSend', [t.id], { kind: 'primary' }) + Orbis.btn('Batal', 'stkTrfCancelOpen', [t.id], { kind: 'danger' });
        if (t.status === 'SENT') h += t.to === here ? Orbis.btn('Terima', 'stkTrfRcvOpen', [t.id], { kind: 'primary' }) : '<small>Terima di ' + esc(olName(d, t.to)) + '</small>';
        return h;
      } }
    ], rows, 'Belum ada transfer.');
  }

  A.stkTab = function (t) { ui.tab = t; ui.doc = null; rerender(); };
  A.stkSku = function (v) { ui.sku = v; rerender(); };
  A.stkFilter = function () { var f = Orbis.readForm('#stk-f'); ui.from = f.from || ''; ui.to = f.to || ''; ui.type = f.type || ''; rerender(); };
  A.stkReorderOpen = function (skuId) {
    var d = Orbis.db();
    Orbis.modal('Batas pesan ulang', '<input type="hidden" name="skuId" value="' + esc(skuId) + '">' + Orbis.field(skuName(d, skuId), 'point', S.reorderPoint(d, skuId, d.session.outlet), { type: 'number', min: 0, hint: 'Masuk daftar "Perlu dipesan" saat stok tersedia ≤ batas ini. 0 = nonaktif.' }),
      Orbis.btn('Simpan', 'stkReorderSave', null, { kind: 'primary' }));
  };
  A.stkReorderSave = function () { var f = Orbis.formData(); S.setReorderPoint(f.skuId, Number(f.point)); Orbis.closeModal(); Orbis.toast('Batas pesan ulang disimpan'); };
  A.stkAdjOpen = function () {
    var d = Orbis.db();
    Orbis.modal('Penyesuaian stok', Orbis.field('Produk', 'skuId', '', { type: 'select', options: skus(d).map(function (s) { return [s.id, skuName(d, s.id) + ' · stok ' + I.onHand(d, s.id, d.session.outlet)]; }) }) +
      Orbis.field('Perubahan qty (+/−)', 'qty', '', { type: 'number', placeholder: '-2', hint: 'Negatif untuk mengurangi. Stok tidak boleh menjadi negatif.' }) +
      Orbis.field('Alasan', 'reason', 'damaged', { type: 'select', options: S.REASONS }) + Orbis.field('Keterangan', 'note', '', { hint: 'Wajib (min. 5 karakter) untuk alasan Lainnya.' }),
      Orbis.btn('Simpan penyesuaian', 'stkAdjSave', null, { kind: 'primary' }));
  };
  A.stkAdjSave = function () { var f = Orbis.formData(); S.adjust({ skuId: f.skuId, qty: Number(f.qty), reason: f.reason, note: f.note }); Orbis.closeModal(); Orbis.toast('Penyesuaian dicatat'); };

  A.stkSoNew = function (partial) {
    if (!partial) { ui.doc = S.createCount({}).id; Orbis.toast('Opname dibuat, stok sistem disnapshot'); return; }
    var d = Orbis.db();
    Orbis.modal('Opname sebagian', skus(d).map(function (s) { return Orbis.field(skuName(d, s.id), 'k_' + s.id, false, { type: 'checkbox' }); }).join(''), Orbis.btn('Mulai opname', 'stkSoCreate', null, { kind: 'primary' }));
  };
  A.stkSoCreate = function () {
    var f = Orbis.formData(), ids = Object.keys(f).filter(function (k) { return f[k] === true; }).map(function (k) { return k.slice(2); });
    if (!ids.length) throw Orbis.Err('VALIDATION', 'Pilih minimal satu SKU');
    ui.doc = S.createCount({ skuIds: ids }).id; Orbis.closeModal(); Orbis.toast('Opname dibuat');
  };
  A.stkSoOpen = function (id) { ui.doc = id; rerender(); };
  function soCounts() { var f = Orbis.readForm('#so-form'), c = {}; Object.keys(f).forEach(function (k) { if (k.indexOf('c_') === 0) c[k.slice(2)] = num(f[k]); }); return c; }
  A.stkSoSave = function (id) { S.setCounts(id, soCounts()); Orbis.toast('Hitungan disimpan'); };
  A.stkSoSubmit = function (id) { var c = soCounts(); Orbis.batch(function () { S.setCounts(id, c); S.submitCount(id); }); Orbis.toast('Opname diajukan untuk persetujuan'); };
  A.stkSoApprove = function (id) { S.approveCount(id); Orbis.toast('Opname disetujui, selisih dicatat sebagai penyesuaian'); };
  A.stkSoRejectOpen = function (id) {
    Orbis.modal('Tolak opname ' + id, '<input type="hidden" name="id" value="' + esc(id) + '">' + Orbis.field('Alasan (min. 5 karakter)', 'reason', '', { type: 'textarea' }), Orbis.btn('Tolak', 'stkSoReject', null, { kind: 'danger' }));
  };
  A.stkSoReject = function () { var f = Orbis.formData(); S.rejectCount(f.id, f.reason); Orbis.closeModal(); Orbis.toast('Opname ditolak, stok tidak berubah'); };

  A.stkTrfNew = function () {
    var d = Orbis.db(), here = d.session.outlet;
    var to = Orbis.mine(d, 'outlets').filter(function (o) { return o.id !== here && o.active !== false; }).map(function (o) { return [o.id, o.name]; });
    if (!to.length) throw Orbis.Err('VALIDATION', 'Tidak ada outlet tujuan aktif lain');
    Orbis.modal('Transfer dari ' + olName(d, here), Orbis.field('Outlet tujuan', 'to', '', { type: 'select', options: to }) +
      skus(d).map(function (s) { return Orbis.field(skuName(d, s.id) + ' (tersedia ' + I.available(d, s.id, here) + ')', 'q_' + s.id, 0, { type: 'number', min: 0 }); }).join('') + Orbis.field('Catatan', 'note', ''),
      Orbis.btn('Simpan draft', 'stkTrfSave', null, { kind: 'primary' }));
  };
  A.stkTrfSave = function () {
    var f = Orbis.formData(), lines = Object.keys(f).filter(function (k) { return k.indexOf('q_') === 0 && Number(f[k]); }).map(function (k) { return { skuId: k.slice(2), qty: Number(f[k]) }; });
    S.createTransfer({ to: f.to, lines: lines, note: f.note }); Orbis.closeModal(); Orbis.toast('Transfer dibuat (DRAFT)');
  };
  A.stkTrfSend = function (id) { S.sendTransfer(id); Orbis.toast('Transfer dikirim, stok outlet asal berkurang'); };
  A.stkTrfCancelOpen = function (id) { Orbis.modal('Batalkan ' + id, '<input type="hidden" name="id" value="' + esc(id) + '">' + Orbis.field('Alasan (min. 5 karakter)', 'reason', ''), Orbis.btn('Batalkan transfer', 'stkTrfCancel', null, { kind: 'danger' })); };
  A.stkTrfCancel = function () { var f = Orbis.formData(); S.cancelTransfer(f.id, f.reason); Orbis.closeModal(); Orbis.toast('Transfer dibatalkan'); };
  A.stkTrfRcvOpen = function (id) {
    var d = Orbis.db(), t = Orbis.mine(d, 'stockTransfers').filter(function (x) { return x.id === id; })[0];
    if (!t) throw Orbis.Err('NOT_FOUND', 'Transfer tidak ditemukan');
    Orbis.modal('Terima ' + id, '<input type="hidden" name="id" value="' + esc(id) + '">' + t.lines.map(function (l) { return Orbis.field(skuName(d, l.skuId) + ' (dikirim ' + l.qty + ')', 'r_' + l.skuId, l.qty, { type: 'number', min: 0 }); }).join('') +
      '<small>Kekurangan dicatat sebagai selisih transfer.</small>', Orbis.btn('Catat penerimaan', 'stkTrfRcv', null, { kind: 'primary' }));
  };
  A.stkTrfRcv = function () {
    var f = Orbis.formData(), r = {};
    Object.keys(f).forEach(function (k) { if (k.indexOf('r_') === 0) r[k.slice(2)] = Number(f[k]); });
    S.receiveTransfer(f.id, r); Orbis.closeModal(); Orbis.toast('Transfer diterima');
  };

  /* ======================= route: procurement (upgrade) ======================= */
  Orbis.screens.procurement = function (d) {
    if (pu.tab === 'stk') pu.tab = 'po';   // stock moved to route `stock`
    var tabs = Orbis.tabs([['po', 'Pembelian'], ['rcv', 'Penerimaan'], ['sup', 'Pemasok']], pu.tab, 'procTab');
    var head = Orbis.pageHead('Pembelian', 'Penerimaan barang menambah stok dan akrual pembelian, bukan biaya.', Orbis.btn('Stok & Opname', 'go', ['stock'], { kind: 'ghost', icon: 'box' }));
    if (pu.tab === 'po' && pu.po) return head + tabs + poDetail(d);
    if (pu.tab === 'sup' && pu.sup) return head + tabs + supDetail(d);
    if (pu.tab === 'po') return head + tabs + poList(d);
    return head + tabs + (pu.tab === 'sup' ? supList(d) : rcvList(d));
  };
  function rcvList(d) {
    var rows = [];
    Orbis.mine(d, 'purchaseOrders').forEach(function (p) { p.receipts.forEach(function (r) { rows.push({ po: p.id, r: r }); }); });
    rows.sort(function (a, b) { return b.r.at - a.r.at; });
    return Orbis.table([
      { label: 'Penerimaan', fmt: function (x) { return '<span class="mono">' + esc(x.r.id) + '</span>'; } },
      { label: 'PO', fmt: function (x) { return Orbis.btn(x.po, 'procPoOpen', [x.po], { kind: 'ghost' }); } },
      { label: 'Waktu', fmt: function (x) { return esc(Orbis.fmtTime(x.r.at)) + '<br><small>' + esc(x.r.by) + '</small>'; } },
      { label: 'Item', fmt: function (x) { return x.r.lines.map(function (l) { return esc(skuName(d, l.skuId)) + ' ×' + esc(l.qty); }).join('<br>'); } },
      { label: 'Nilai akrual', right: true, fmt: function (x) { return esc(Orbis.idr(x.r.amount)); } }
    ], rows, 'Belum ada penerimaan.');
  }
  function supList(d) {
    var can = Orbis.can('po.write');
    return (can ? '<p>' + Orbis.btn('Pemasok baru', 'procSupEdit', [''], { kind: 'primary', icon: 'plus' }) + '</p>' : '') + Orbis.table([
      { label: 'Nama', fmt: function (s) { return esc(s.name); } }, { label: 'Telepon', fmt: function (s) { return esc(s.phone); } },
      { label: 'PO', right: true, fmt: function (s) { return esc(Orbis.mine(d, 'purchaseOrders').filter(function (p) { return p.supplierId === s.id; }).length); } },
      { label: 'Aksi', fmt: function (s) { return '<div class="actions">' + Orbis.btn('Detail', 'procSupOpen', [s.id]) + (can ? Orbis.btn('Ubah', 'procSupEdit', [s.id]) + Orbis.btn('Hapus', 'procSupDel', [s.id], { kind: 'danger' }) : '') + '</div>'; } }
    ], Orbis.mine(d, 'suppliers'), 'Belum ada pemasok.');
  }
  function poActions(p) {
    var can = Orbis.can('po.write'), appr = Orbis.can('po.approve'), h = '';
    if (can && p.status === 'DRAFT') h += Orbis.btn('Ajukan', 'procSubmit', [p.id]);
    if (appr && p.status === 'SUBMITTED') h += Orbis.btn('Setujui', 'procApprove', [p.id], { kind: 'primary' }) + Orbis.btn('Tolak', 'procRejectOpen', [p.id], { kind: 'danger' });
    if (can && (p.status === 'APPROVED' || p.status === 'PARTIAL')) h += Orbis.btn('Terima', 'procRcvOpen', [p.id], { kind: 'primary' });
    if (can && ['DRAFT', 'SUBMITTED', 'APPROVED'].indexOf(p.status) >= 0 && !p.receipts.length) h += Orbis.btn('Batalkan', 'procCancelOpen', [p.id], { kind: 'ghost' });
    return h;
  }
  function poTable(d, rows) {
    return Orbis.table([
      { label: 'PO', fmt: function (p) { return '<b>' + esc(p.id) + '</b><br><small>' + esc(Orbis.fmtTime(p.createdAt)) + ' · ' + esc(p.createdBy) + '</small>'; } },
      { label: 'Pemasok', fmt: function (p) { return esc(supName(d, p.supplierId)); } },
      { label: 'Baris', right: true, fmt: function (p) { return esc(p.lines.length); } },
      { label: 'Total', right: true, fmt: function (p) { return esc(Orbis.idr(p.total)); } },
      { label: 'Status', fmt: function (p) { return Orbis.chip(p.status); } },
      { label: 'Aksi', fmt: function (p) { return '<div class="actions">' + Orbis.btn('Detail', 'procPoOpen', [p.id]) + poActions(p) + '</div>'; } }
    ], rows, 'Belum ada PO.');
  }
  function poList(d) {
    return (Orbis.can('po.write') ? '<p>' + Orbis.btn('PO baru', 'procPoNew', [false], { kind: 'primary', icon: 'plus' }) + '</p>' : '') + poTable(d, Orbis.mine(d, 'purchaseOrders').slice().reverse());
  }
  function poDetail(d) {
    var p = Orbis.mine(d, 'purchaseOrders').filter(function (x) { return x.id === pu.po; })[0];
    if (!p) { pu.po = null; return poList(d); }
    return Orbis.card('PO ' + p.id + ' · ' + supName(d, p.supplierId), '<p class="row">' + Orbis.chip(p.status) + '<small>' + esc(p.note || '') + '</small></p>' +
      (p.rejectReason || p.cancelReason ? '<div class="banner bad">' + esc(p.rejectReason || p.cancelReason) + '</div>' : '') +
      Orbis.table([
        { label: 'Produk', fmt: function (l) { return esc(skuName(d, l.skuId)); } }, { label: 'Qty', right: true, fmt: function (l) { return esc(l.qty); } },
        { label: 'Diterima', right: true, fmt: function (l) { return esc(l.received); } }, { label: 'Harga beli', right: true, fmt: function (l) { return esc(Orbis.idr(l.unitCost)); } },
        { label: 'Subtotal', right: true, fmt: function (l) { return esc(Orbis.idr(l.qty * l.unitCost)); } }
      ], p.lines) + '<h4 class="mt">Riwayat penerimaan</h4>' + Orbis.table([
        { label: 'Penerimaan', fmt: function (r) { return '<span class="mono">' + esc(r.id) + '</span>'; } }, { label: 'Waktu', fmt: function (r) { return esc(Orbis.fmtTime(r.at)) + '<br><small>' + esc(r.by) + '</small>'; } },
        { label: 'Item', fmt: function (r) { return r.lines.map(function (l) { return esc(skuName(d, l.skuId)) + ' ×' + esc(l.qty); }).join('<br>'); } },
        { label: 'Nilai', right: true, fmt: function (r) { return esc(Orbis.idr(r.amount)); } }
      ], p.receipts, 'Belum ada penerimaan.') + '<h4 class="mt">Riwayat status</h4>' + Orbis.table([
        { label: 'Waktu', fmt: function (h) { return esc(Orbis.fmtTime(h.at)); } }, { label: 'Status', fmt: function (h) { return esc((h.from || '-') + ' → ' + h.to); } },
        { label: 'Oleh', fmt: function (h) { return esc(h.by) + (h.note ? '<br><small>' + esc(h.note) + '</small>' : ''); } }
      ], p.history), '<div class="actions">' + Orbis.btn('Kembali', 'procPoOpen', [null], { kind: 'ghost' }) + poActions(p) + '</div>');
  }
  function supDetail(d) {
    var s = Orbis.mine(d, 'suppliers').filter(function (x) { return x.id === pu.sup; })[0];
    if (!s) { pu.sup = null; return ''; }
    var pos = Orbis.mine(d, 'purchaseOrders').filter(function (p) { return p.supplierId === s.id; }).reverse();
    var spent = Orbis.sum(pos, function (p) { return Orbis.sum(p.receipts, function (r) { return r.amount; }); });
    return Orbis.card(s.name, '<p><small>Telepon: ' + esc(s.phone || '-') + '</small></p><div class="stats">' + Orbis.stat('Jumlah PO', String(pos.length)) + Orbis.stat('Total diterima', Orbis.idr(spent)) + '</div>' + poTable(d, pos),
      Orbis.btn('Kembali', 'procSupOpen', [null], { kind: 'ghost' }));
  }
  var baseTab = A.procTab;
  A.procTab = function (t) { pu.po = null; pu.sup = null; baseTab(t); };
  A.procPoOpen = function (id) { pu.tab = 'po'; pu.po = id; rerender(); };
  A.procSupOpen = function (id) { pu.tab = 'sup'; pu.sup = id; rerender(); };
  /** Multi-line PO: one row per SKU, qty 0 = skip. prefill=true takes qty from "Perlu dipesan". */
  A.procPoNew = function (prefill) {
    var d = Orbis.db(), sups = Orbis.mine(d, 'suppliers').map(function (s) { return [s.id, s.name]; }), need = {};
    if (!sups.length) throw Orbis.Err('VALIDATION', 'Tambahkan pemasok terlebih dahulu');
    if (prefill === true) S.needsOrder(d, d.session.outlet).forEach(function (n) { need[n.skuId] = n.qty; });
    var list = skus(d).filter(function (s) { return prefill !== true || need[s.id]; });
    Orbis.modal('PO baru', Orbis.field('Pemasok', 'supplierId', '', { type: 'select', options: sups }) +
      '<div class="stk-lines">' + list.map(function (s) {
        return '<div class="stk-line"><b>' + esc(skuName(d, s.id)) + '</b>' + Orbis.field('Qty', 'q_' + s.id, need[s.id] || 0, { type: 'number', min: 0 }) + Orbis.field('Harga beli (Rp)', 'c_' + s.id, s.cost, { type: 'number', min: 0 }) + '</div>';
      }).join('') + '</div>' + Orbis.field('Catatan', 'note', prefill === true ? 'Dari daftar perlu dipesan' : ''),
      Orbis.btn('Simpan draft', 'procPoSave', null, { kind: 'primary' }));
  };
  A.procPoSave = function () {
    var f = Orbis.formData(), lines = Object.keys(f).filter(function (k) { return k.indexOf('q_') === 0 && Number(f[k]); }).map(function (k) { var id = k.slice(2); return { skuId: id, qty: Number(f[k]), unitCost: Number(f['c_' + id]) }; });
    var po = P.createPo({ supplierId: f.supplierId, note: f.note, lines: lines });
    Orbis.closeModal(); pu.tab = 'po'; pu.po = po.id; Orbis.toast('PO dibuat (DRAFT)');
  };
  function reasonModal(title, id, act, label) { Orbis.modal(title + ' ' + id, '<input type="hidden" name="id" value="' + esc(id) + '">' + Orbis.field('Alasan (min. 5 karakter)', 'reason', '', { type: 'textarea' }), Orbis.btn(label, act, null, { kind: 'danger' })); }
  A.procRejectOpen = function (id) { reasonModal('Tolak PO', id, 'procReject', 'Tolak PO'); };
  A.procReject = function () { var f = Orbis.formData(); S.rejectPo(f.id, f.reason); Orbis.closeModal(); Orbis.toast('PO ditolak'); };
  A.procCancelOpen = function (id) { reasonModal('Batalkan PO', id, 'procCancel', 'Batalkan PO'); };
  A.procCancel = function () { var f = Orbis.formData(); S.cancelPo(f.id, f.reason); Orbis.closeModal(); Orbis.toast('PO dibatalkan'); };
})(typeof window !== 'undefined' ? window : globalThis);
