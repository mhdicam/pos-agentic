/* Orbis v2 — screen: catalog (produk, varian, publish, impor CSV). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions, C = Orbis.domain.catalog;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.catalog = Orbis.ui.catalog || { tab: 'list', q: '', csv: '', preview: null };
  function rerender() { if (Orbis.render) Orbis.render(); }

  Orbis.screens.catalog = function (d) {
    var can = Orbis.can('catalog.write');
    var rows = C.list(d), q = ui.q.toLowerCase();
    if (q) rows = rows.filter(function (r) { return r.product.name.toLowerCase().indexOf(q) >= 0 || r.skus.some(function (s) { return String(s.sku).toLowerCase().indexOf(q) >= 0 || (s.barcode || '').indexOf(q) >= 0; }); });
    var head = Orbis.pageHead('Produk', 'Produk, varian (SKU), harga, dan status publikasi.', can ? Orbis.btn('Produk baru', 'catalogEdit', [''], { kind: 'primary', icon: 'plus' }) : '');
    var tabs = Orbis.tabs([['list', 'Daftar produk'], ['import', 'Impor CSV']], ui.tab, 'catalogTab');
    var body = ui.tab === 'import' ? importView(can) : listView(rows, can);
    return head + tabs + body;
  };

  function listView(rows, can) {
    var search = '<div class="fld"><label for="cq">Cari nama / SKU / barcode</label><input id="cq" type="search" value="' + esc(ui.q) + '" data-change="catalogSearch"></div>';
    return search + Orbis.table([
      { label: 'Produk', fmt: function (r) { return '<b>' + esc(r.product.name) + '</b><br><small>' + esc(r.product.category) + '</small>'; } },
      { label: 'Varian', fmt: function (r) { return r.skus.map(function (s) { return esc(s.sku) + ' · ' + esc(s.label) + ' · ' + esc(Orbis.idr(s.price)); }).join('<br>'); } },
      { label: 'HPP', right: true, fmt: function (r) { return r.skus.map(function (s) { return esc(Orbis.idr(s.cost)); }).join('<br>'); } },
      { label: 'Stok', right: true, fmt: function (r) { return esc(r.onHand); } },
      { label: 'Status', fmt: function (r) { return Orbis.chip(r.product.published ? 'ACTIVE' : 'DRAFT', r.product.published ? 'Terbit' : 'Draft'); } },
      { label: 'Aksi', fmt: function (r) { return can ? Orbis.btn('Ubah', 'catalogEdit', [r.product.id]) + ' ' + Orbis.btn(r.product.published ? 'Sembunyikan' : 'Terbitkan', 'catalogToggle', [r.product.id]) : ''; } }
    ], rows, 'Belum ada produk.');
  }

  function importView(can) {
    var p = ui.preview, h = '<p>Kolom wajib: <code>name,sku,price,cost,stock,category</code> (opsional <code>barcode</code>). Harga/HPP/stok bilangan bulat. Produk hasil impor berstatus draft. Jika ada satu baris salah, tidak ada yang disimpan.</p>';
    h += '<div id="imp"><div class="fld"><label for="impfile">Berkas CSV</label><input id="impfile" type="file" accept=".csv,text/csv" data-change="catalogFile"></div>' +
      '<div class="fld"><label for="impcsv">Atau tempel isi CSV</label><textarea id="impcsv" name="csv" rows="6">' + esc(ui.csv) + '</textarea></div></div>';
    h += Orbis.btn('Pratinjau', 'catalogPreview', null, { kind: 'primary' });
    if (p) {
      if (p.errors.length) h += '<div class="card-b"><h4>' + esc(p.errors.length) + ' kesalahan</h4><ul>' + p.errors.map(function (e) { return '<li>Baris ' + esc(e.line) + ': ' + esc(e.message) + '</li>'; }).join('') + '</ul></div>';
      h += Orbis.table([{ label: 'Baris', k: 'line' }, { label: 'Nama', k: 'name' }, { label: 'SKU', k: 'sku' }, { label: 'Harga', right: true, fmt: function (r) { return esc(r.price); } }, { label: 'HPP', right: true, fmt: function (r) { return esc(r.cost); } }, { label: 'Stok', right: true, k: 'stock' }, { label: 'Kategori', k: 'category' }], p.rows, 'Tidak ada baris valid.');
      h += Orbis.btn('Impor ' + p.rows.length + ' produk', 'catalogCommit', null, { kind: 'primary', disabled: !can || p.errors.length > 0 || !p.rows.length });
    }
    return h;
  }

  function variantRow(v, i) {
    var n = function (k) { return 'v' + i + '_' + k; };
    return '<fieldset class="fld"><legend>Varian ' + (i + 1) + '</legend>' +
      '<input type="hidden" name="' + n('id') + '" value="' + esc(v.id || '') + '">' +
      Orbis.field('Kode SKU', n('sku'), v.sku || '') + Orbis.field('Label', n('label'), v.label || 'Standar') +
      Orbis.field('Harga jual (Rp)', n('price'), v.price == null ? '' : v.price, { type: 'number', min: 0 }) +
      Orbis.field('HPP (Rp)', n('cost'), v.cost == null ? '' : v.cost, { type: 'number', min: 0 }) +
      Orbis.field('Barcode', n('barcode'), v.barcode || '') +
      (v.id ? '' : Orbis.field('Stok awal', n('stock'), v.stock == null ? 0 : v.stock, { type: 'number', min: 0, hint: 'Dicatat sebagai mutasi OPENING' })) + '</fieldset>';
  }
  function editModal(productId, nVar, draft) {
    var d = Orbis.db(), p = productId ? d.products.filter(function (x) { return x.id === productId && x.tenant === d.session.tenant; })[0] : null;
    var skus = draft || (p ? d.skus.filter(function (s) { return s.productId === p.id && s.tenant === d.session.tenant; }) : [{}]);
    while (skus.length < nVar) skus.push({});
    var cats = ['Minuman', 'Roti', 'Retail', 'Sembako', 'Umum'];
    var body = '<input type="hidden" name="productId" value="' + esc(productId || '') + '"><input type="hidden" name="nVar" value="' + skus.length + '">' +
      Orbis.field('Nama produk', 'name', p ? p.name : (draft && draft._name) || '') + Orbis.field('Kategori', 'category', p ? p.category : 'Umum', { hint: 'Contoh: ' + cats.join(', ') }) +
      skus.map(variantRow).join('');
    Orbis.modal(p ? 'Ubah produk' : 'Produk baru', body, Orbis.btn('Tambah varian', 'catalogAddVariant', null) + Orbis.btn('Simpan', 'catalogSave', null, { kind: 'primary' }));
  }
  function readSpec() {
    var f = Orbis.formData(), n = Number(f.nVar) || 1, skus = [];
    for (var i = 0; i < n; i++) {
      var num = function (k) { var v = String(f['v' + i + '_' + k] == null ? '' : f['v' + i + '_' + k]).trim(); return v === '' ? NaN : Number(v); };
      if (!String(f['v' + i + '_sku'] || '').trim() && i > 0 && !f['v' + i + '_price']) continue;
      var o = { id: f['v' + i + '_id'] || null, sku: f['v' + i + '_sku'], label: f['v' + i + '_label'], barcode: f['v' + i + '_barcode'], price: num('price'), cost: num('cost') };
      if (!o.id) o.stock = f['v' + i + '_stock'] === undefined || f['v' + i + '_stock'] === '' ? 0 : num('stock');
      skus.push(o);
    }
    return { productId: f.productId, name: f.name, category: f.category, skus: skus };
  }
  function draftFromForm() { var s = readSpec(); var arr = s.skus.slice(); arr._name = s.name; return arr; }

  A.catalogTab = function (t) { ui.tab = t; rerender(); };
  A.catalogSearch = function (v) { ui.q = v; rerender(); };
  A.catalogEdit = function (id) { editModal(id || '', 1); };
  A.catalogAddVariant = function () { var s = readSpec(); var f = Orbis.formData(); var arr = s.skus.slice(); arr.push({}); arr._name = s.name; editModal(s.productId, arr.length, arr); var fm = document.getElementById('modal-form'); if (fm && fm.elements.category) fm.elements.category.value = f.category; };
  A.catalogSave = function () {
    var s = readSpec();
    if (s.productId) C.updateProduct(s.productId, s); else C.createProduct(s);
    Orbis.closeModal(); Orbis.toast('Produk disimpan');
  };
  A.catalogToggle = function (id) { var p = C.togglePublish(id); Orbis.toast(p.published ? 'Produk diterbitkan' : 'Produk disembunyikan'); };
  A.catalogFile = function (v, ev) {
    var el = ev && ev.target, f = el && el.files && el.files[0];
    if (!f) return;
    if (f.size > 1024 * 1024) throw Orbis.Err('VALIDATION', 'Berkas CSV maksimal 1 MB');
    var r = new FileReader();
    r.onload = function () { ui.csv = String(r.result); ui.preview = C.parseCsv(ui.csv); rerender(); };
    r.readAsText(f);
  };
  A.catalogPreview = function () { var f = Orbis.readForm('#imp'); ui.csv = f.csv || ui.csv; ui.preview = C.parseCsv(ui.csv); rerender(); };
  A.catalogCommit = function () {
    if (!ui.preview) throw Orbis.Err('VALIDATION', 'Buat pratinjau dulu');
    try { var n = C.commitImport(ui.preview.rows); ui.preview = null; ui.csv = ''; ui.tab = 'list'; Orbis.toast(n + ' produk diimpor sebagai draft'); }
    catch (e) { if (e.errors) { ui.preview.errors = e.errors; rerender(); } throw e; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
