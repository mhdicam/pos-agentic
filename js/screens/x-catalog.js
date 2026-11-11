/* Orbis v2 — tenant back-office screens: catalog (RD-12). Overrides `catalog` and `pos` renders (loads after base screens).
   Catalog: list with search/category/status filters, product detail (variants, archive, outlet price, modifier groups),
   categories tab, modifier groups tab; CSV import reuses the base screen. POS: product grid grouped per product,
   variant/modifier picker, cart lines {skuId, qty, modifiers:[ids], note}. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions, C = Orbis.domain.catalog;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.catalog = Orbis.ui.catalog || { tab: 'list', q: '', csv: '', preview: null };
  ui.cat = ui.cat || ''; ui.status = ui.status || 'active'; ui.detail = ui.detail || null;
  var baseCatalog = Orbis.screens.catalog, baseEdit = A.catalogEdit, baseAddVariant = A.catalogAddVariant, baseSave = A.catalogSave;
  function rerender() { if (Orbis.render) Orbis.render(); }
  function tenantSkus(d, pid) { return Orbis.mine(d, 'skus').filter(function (s) { return s.productId === pid; }); }
  function product(d, id) { return Orbis.mine(d, 'products').filter(function (p) { return p.id === id; })[0]; }
  function status(p) { return p.archived ? ['ARCHIVED', 'Arsip'] : p.published ? ['ACTIVE', 'Terbit'] : ['DRAFT', 'Draft']; }
  function chipFor(p) { var s = status(p); return Orbis.chip(s[0] === 'ARCHIVED' ? 'RETURNED' : s[0], s[1]); }

  /* =================== catalog =================== */
  var TABS = [['list', 'Produk'], ['categories', 'Kategori'], ['modifiers', 'Modifier'], ['import', 'Impor CSV']];
  Orbis.screens.catalog = function (d) {
    var can = Orbis.can('catalog.write');
    var tabs = Orbis.tabs(TABS, ui.tab, 'catalogTab');
    if (ui.tab === 'import') {
      // ponytail: base import view is private; reuse its render and swap its 2-tab bar for ours. Move importView here if catalog.js changes.
      return baseCatalog(d).replace(Orbis.tabs([['list', 'Daftar produk'], ['import', 'Impor CSV']], 'import', 'catalogTab'), tabs);
    }
    if (ui.tab === 'list' && ui.detail && product(d, ui.detail)) return detailView(d, product(d, ui.detail), can);
    var head = Orbis.pageHead('Produk', 'Produk, varian, kategori, modifier, dan harga per outlet.',
      can && ui.tab === 'list' ? Orbis.btn('Produk baru', 'catalogEdit', [''], { kind: 'primary', icon: 'plus' }) :
      can && ui.tab === 'categories' ? Orbis.btn('Kategori baru', 'xcCatEdit', [''], { kind: 'primary', icon: 'plus' }) :
      can && ui.tab === 'modifiers' ? Orbis.btn('Grup modifier baru', 'xcModEdit', [''], { kind: 'primary', icon: 'plus' }) : '');
    var body = ui.tab === 'categories' ? categoriesView(d, can) : ui.tab === 'modifiers' ? modifiersView(d, can) : listView(d);
    return head + tabs + body;
  };

  function listView(d) {
    var q = ui.q.toLowerCase();
    var rows = C.list(d).filter(function (r) {
      var p = r.product;
      if (ui.cat && p.category !== ui.cat) return false;
      if (ui.status === 'active' && p.archived) return false;
      if (ui.status === 'draft' && (p.archived || p.published)) return false;
      if (ui.status === 'archived' && !p.archived) return false;
      return !q || p.name.toLowerCase().indexOf(q) >= 0 || r.skus.some(function (s) { return String(s.sku).toLowerCase().indexOf(q) >= 0 || (s.barcode || '').indexOf(q) >= 0; });
    });
    var cats = [['', 'Semua kategori']].concat(C.categories(d).map(function (c) { return [c.name, c.name]; }));
    var filters = '<div class="xc-filters"><div class="fld"><label for="cq">Cari nama / SKU / barcode</label><input id="cq" type="search" value="' + esc(ui.q) + '" data-change="catalogSearch"></div>' +
      '<div class="fld"><label for="xc-cat">Kategori</label><select id="xc-cat" data-change="xcFilterCat">' + cats.map(function (c) { return '<option value="' + esc(c[0]) + '"' + (c[0] === ui.cat ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fld"><label for="xc-st">Status</label><select id="xc-st" data-change="xcFilterStatus">' + [['active', 'Aktif'], ['draft', 'Draft'], ['archived', 'Arsip'], ['all', 'Semua']].map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === ui.status ? ' selected' : '') + '>' + s[1] + '</option>'; }).join('') + '</select></div></div>';
    return filters + Orbis.table([
      { label: 'Produk', fmt: function (r) { return '<b>' + esc(r.product.name) + '</b><br><small>' + esc(r.product.category) + '</small>'; } },
      { label: 'Varian', fmt: function (r) { return r.skus.map(function (s) { return esc(s.label) + ' · ' + esc(Orbis.idr(s.price)) + (s.archived ? ' (arsip)' : ''); }).join('<br>'); } },
      { label: 'Modifier', fmt: function (r) { return esc(C.groupsFor(d, r.product.id).map(function (m) { return m.name; }).join(', ') || '-'); } },
      { label: 'Stok', right: true, fmt: function (r) { return esc(r.onHand); } },
      { label: 'Status', fmt: function (r) { return chipFor(r.product); } },
      { label: 'Aksi', fmt: function (r) { return Orbis.btn('Detail', 'xcDetail', [r.product.id], { kind: 'sm' }); } }
    ], rows, 'Tidak ada produk yang cocok.');
  }

  function detailView(d, p, can) {
    var skus = tenantSkus(d, p.id), outlets = Orbis.mine(d, 'outlets');
    var actions = Orbis.btn('Kembali', 'xcDetail', [''], { kind: 'ghost' }) + (can ? Orbis.btn('Ubah produk', 'catalogEdit', [p.id]) +
      (p.archived ? Orbis.btn('Pulihkan', 'xcArchive', [p.id, false]) : Orbis.btn(p.published ? 'Sembunyikan' : 'Terbitkan', 'catalogToggle', [p.id]) + Orbis.btn('Arsipkan', 'xcArchive', [p.id, true], { kind: 'danger' })) : '');
    var head = Orbis.pageHead(p.name, p.category, actions);
    var info = '<div class="row">' + chipFor(p) + (p.archived ? '<small>Produk arsip tidak bisa dijual dan tidak tampil di toko online.</small>' : '') + '</div>';
    var vars = Orbis.table([
      { label: 'Varian', fmt: function (s) { return '<b>' + esc(s.label) + '</b><br><small>' + esc(s.sku) + (s.barcode ? ' · ' + esc(s.barcode) : '') + '</small>'; } },
      { label: 'Harga', right: true, fmt: function (s) { return esc(Orbis.idr(s.price)); } },
      { label: 'HPP', right: true, fmt: function (s) { return esc(Orbis.idr(s.cost)); } },
      { label: 'Per outlet', fmt: function (s) {
        return outlets.map(function (o) { var r = C.outletRow(d, s.id, o.id); return esc(o.name) + ': ' + (r && r.available === false ? 'tidak dijual' : esc(Orbis.idr(r && r.price != null ? r.price : s.price))); }).join('<br>');
      } },
      { label: 'Stok', right: true, fmt: function (s) { return esc(Orbis.domain.inventory.onHand(d, s.id)); } },
      { label: 'Status', fmt: function (s) { return s.archived ? Orbis.chip('RETURNED', 'Arsip') : Orbis.chip('ACTIVE', 'Aktif'); } },
      { label: 'Aksi', fmt: function (s) { return can ? Orbis.btn('Harga outlet', 'xcOutlet', [s.id], { kind: 'sm' }) + ' ' + Orbis.btn(s.archived ? 'Pulihkan' : 'Arsipkan', 'xcSkuArchive', [s.id, !s.archived], { kind: 'sm' }) : ''; } }
    ], skus);
    var attached = p.modifierGroupIds || [], groups = C.modifierGroups(d);
    var mods = groups.length ? '<div id="xc-attach" class="xc-opts">' + groups.map(function (m) {
      return '<label class="chk"><input type="checkbox" name="' + esc(m.id) + '"' + (attached.indexOf(m.id) >= 0 ? ' checked' : '') + (can ? '' : ' disabled') + '> ' + esc(m.name) + ' <small>' + esc(rule(m)) + '</small></label>';
    }).join('') + '</div>' + (can ? Orbis.btn('Simpan modifier', 'xcAttach', [p.id], { kind: 'primary' }) : '') : Orbis.empty('Belum ada grup modifier. Buat di tab Modifier.');
    return head + info + Orbis.card('Varian (SKU)', vars) + Orbis.card('Grup modifier', mods);
  }
  function rule(m) { return (m.required ? 'wajib' : 'opsional') + ', pilih ' + (m.min === m.max ? m.max : m.min + '-' + m.max); }

  function categoriesView(d, can) {
    var list = C.categories(d, true), count = function (c) { return Orbis.mine(d, 'products').filter(function (p) { return p.category === c.name && !p.archived; }).length; };
    return Orbis.table([
      { label: 'Urutan', fmt: function (c) { return esc(c.sort + 1); } },
      { label: 'Kategori', fmt: function (c) { return '<b>' + esc(c.name) + '</b>'; } },
      { label: 'Produk aktif', right: true, fmt: function (c) { return esc(count(c)); } },
      { label: 'Status', fmt: function (c) { return c.archived ? Orbis.chip('RETURNED', 'Arsip') : Orbis.chip('ACTIVE', 'Aktif'); } },
      { label: 'Aksi', fmt: function (c) { return can ? Orbis.btn('Naik', 'xcCatMove', [c.id, -1], { kind: 'sm' }) + ' ' + Orbis.btn('Turun', 'xcCatMove', [c.id, 1], { kind: 'sm' }) + ' ' + Orbis.btn('Ubah', 'xcCatEdit', [c.id], { kind: 'sm' }) + ' ' + Orbis.btn(c.archived ? 'Pulihkan' : 'Arsipkan', 'xcCatArchive', [c.id, !c.archived], { kind: 'sm' }) : ''; } }
    ], list, 'Belum ada kategori.');
  }

  function modifiersView(d, can) {
    return '<p><small>Grup modifier (mis. Gula, Topping) dipasang ke produk di halaman detail produk. Harga pilihan ditambahkan ke harga varian.</small></p>' + Orbis.table([
      { label: 'Grup', fmt: function (m) { return '<b>' + esc(m.name) + '</b><br><small>' + esc(rule(m)) + '</small>'; } },
      { label: 'Pilihan', fmt: function (m) { return m.options.map(function (o) { return esc(o.name) + (o.price ? ' +' + esc(Orbis.idr(o.price)) : ''); }).join('<br>'); } },
      { label: 'Dipakai', right: true, fmt: function (m) { return esc(Orbis.mine(d, 'products').filter(function (p) { return (p.modifierGroupIds || []).indexOf(m.id) >= 0; }).length); } },
      { label: 'Status', fmt: function (m) { return m.archived ? Orbis.chip('RETURNED', 'Arsip') : Orbis.chip('ACTIVE', 'Aktif'); } },
      { label: 'Aksi', fmt: function (m) { return can ? Orbis.btn('Ubah', 'xcModEdit', [m.id], { kind: 'sm' }) + ' ' + Orbis.btn(m.archived ? 'Pulihkan' : 'Arsipkan', 'xcModArchive', [m.id, !m.archived], { kind: 'sm' }) : ''; } }
    ], C.modifierGroups(d, true), 'Belum ada grup modifier.');
  }

  /* product edit modal (base): category becomes a select of managed categories */
  function swapCategory() {
    var f = document.getElementById('modal-form'), el = f && f.elements.category;
    if (!el || el.tagName === 'SELECT') return;
    var d = Orbis.db(), names = C.categories(d).map(function (c) { return c.name; });
    if (el.value && names.indexOf(el.value) < 0) names.push(el.value);
    var sel = document.createElement('select'); sel.id = el.id; sel.name = 'category';
    names.forEach(function (n) { var o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); });
    sel.value = el.value && names.indexOf(el.value) >= 0 ? el.value : names[0] || '';
    el.parentNode.replaceChild(sel, el);
    var hint = sel.parentNode.querySelector('small'); if (hint) hint.textContent = 'Kelola daftar di tab Kategori';
  }
  A.catalogEdit = function (id) { baseEdit(id); swapCategory(); };
  A.catalogAddVariant = function () { baseAddVariant(); swapCategory(); };
  A.catalogSave = function () { baseSave(); };
  A.catalogTab = function (t) { ui.tab = t; ui.detail = null; rerender(); };
  A.xcFilterCat = function (v) { ui.cat = v; rerender(); };
  A.xcFilterStatus = function (v) { ui.status = v; rerender(); };
  A.xcDetail = function (id) { ui.detail = id || null; rerender(); };
  A.xcArchive = function (id, on) { C.archiveProduct(id, on); Orbis.toast(on ? 'Produk diarsipkan' : 'Produk dipulihkan (draft)'); };
  A.xcSkuArchive = function (id, on) { C.archiveSku(id, on); Orbis.toast(on ? 'Varian diarsipkan' : 'Varian dipulihkan'); };
  A.xcAttach = function (pid) {
    var f = Orbis.readForm('#xc-attach');
    C.setProductModifiers(pid, Object.keys(f).filter(function (k) { return f[k]; })); Orbis.toast('Modifier produk disimpan');
  };
  A.xcOutlet = function (skuId) {
    var d = Orbis.db(), s = Orbis.mine(d, 'skus').filter(function (x) { return x.id === skuId; })[0]; if (!s) return;
    var body = '<input type="hidden" name="skuId" value="' + esc(skuId) + '"><p><small>Kosongkan harga untuk memakai harga dasar ' + esc(Orbis.idr(s.price)) + '.</small></p>' +
      Orbis.mine(d, 'outlets').map(function (o) {
        var r = C.outletRow(d, skuId, o.id);
        return '<fieldset class="fld"><legend>' + esc(o.name) + '</legend>' + Orbis.field('Harga outlet (Rp)', 'p_' + o.id, r && r.price != null ? r.price : '', { type: 'number', min: 0 }) +
          Orbis.field('Dijual di outlet ini', 'a_' + o.id, !r || r.available !== false, { type: 'checkbox' }) + '</fieldset>';
      }).join('');
    Orbis.modal('Harga & ketersediaan: ' + s.label, body, Orbis.btn('Simpan', 'xcOutletSave', null, { kind: 'primary' }));
  };
  A.xcOutletSave = function () {
    var f = Orbis.formData(), d = Orbis.db();
    Orbis.batch(function () {
      Orbis.mine(d, 'outlets').forEach(function (o) {
        var v = String(f['p_' + o.id] || '').trim();
        C.setOutletPrice(f.skuId, o.id, { price: v === '' ? null : Number(v), available: !!f['a_' + o.id] });
      });
    });
    Orbis.closeModal(); Orbis.toast('Harga outlet disimpan');
  };
  A.xcCatEdit = function (id) {
    var c = id ? C.categories(Orbis.db(), true).filter(function (x) { return x.id === id; })[0] : null;
    Orbis.modal(c ? 'Ubah kategori' : 'Kategori baru', '<input type="hidden" name="id" value="' + esc(id || '') + '">' + Orbis.field('Nama kategori', 'name', c ? c.name : '', { hint: 'Mengubah nama juga mengubah kategori di semua produknya.' }), Orbis.btn('Simpan', 'xcCatSave', null, { kind: 'primary' }));
  };
  A.xcCatSave = function () { var f = Orbis.formData(); if (f.id) C.renameCategory(f.id, f.name); else C.createCategory(f.name); Orbis.closeModal(); Orbis.toast('Kategori disimpan'); };
  A.xcCatMove = function (id, dir) { C.moveCategory(id, dir); };
  A.xcCatArchive = function (id, on) { C.archiveCategory(id, on); Orbis.toast(on ? 'Kategori diarsipkan' : 'Kategori dipulihkan'); };
  A.xcModEdit = function (id) {
    var m = id ? C.modifierGroups(Orbis.db(), true).filter(function (x) { return x.id === id; })[0] : null;
    var opts = m ? m.options.map(function (o) { return o.name + '=' + o.price; }).join('\n') : '';
    var body = '<input type="hidden" name="id" value="' + esc(id || '') + '">' + Orbis.field('Nama grup', 'name', m ? m.name : '', { placeholder: 'mis. Topping' }) +
      Orbis.field('Wajib dipilih', 'required', m ? m.required : false, { type: 'checkbox' }) +
      '<div class="f2">' + Orbis.field('Minimal pilih', 'min', m ? m.min : 0, { type: 'number', min: 0 }) + Orbis.field('Maksimal pilih', 'max', m ? m.max : 1, { type: 'number', min: 1 }) + '</div>' +
      Orbis.field('Pilihan (satu per baris: nama=harga)', 'options', opts, { type: 'textarea', hint: 'Contoh: Extra shot=6000 · harga 0 untuk tanpa biaya. Baris pertama jadi pilihan bawaan bila grup wajib.' });
    Orbis.modal(m ? 'Ubah grup modifier' : 'Grup modifier baru', body, Orbis.btn('Simpan', 'xcModSave', null, { kind: 'primary' }));
  };
  A.xcModSave = function () {
    var f = Orbis.formData();
    var cur = f.id ? C.modifierGroups(Orbis.db(), true).filter(function (x) { return x.id === f.id; })[0] : null;
    // line N keeps option N's id, so renaming "Hot" -> "Panas" does not orphan held carts or the default
    var options = String(f.options || '').split('\n').filter(function (l) { return l.trim(); }).map(function (l, i) {
      var p = l.split('='); return { id: cur && cur.options[i] ? cur.options[i].id : undefined, name: p[0], price: p.length > 1 ? Number(String(p[1]).trim() || 0) : 0 };
    });
    C.saveModifierGroup({ id: f.id || null, name: f.name, required: !!f.required, min: f.min, max: f.max, options: options });
    Orbis.closeModal(); Orbis.toast('Grup modifier disimpan');
  };
  A.xcModArchive = function (id, on) { C.archiveModifierGroup(id, on); Orbis.toast(on ? 'Grup diarsipkan' : 'Grup dipulihkan'); };

  /* =================== POS =================== */
  var U = Orbis.ui.pos = Orbis.ui.pos || { cart: [], q: '', cat: 'Semua', member: '', promo: '', lastReceipt: null };
  function sellable(d, s) { return !s.archived && C.availableAt(d, s, d.session.outlet); }
  function lineKey(l) { return l.skuId + '|' + (l.modifiers || []).slice().sort().join(',') + '|' + (l.note || ''); }
  function specItems() { return U.cart.map(function (l) { return { skuId: l.skuId, qty: l.qty, modifiers: l.modifiers || [], note: l.note || '' }; }); }
  /** Quote the cart as-is (lines are kept unique by key so quote items map 1:1 to cart lines). */
  function totals(d) {
    if (!U.cart.length) return { q: null, err: null };
    var base = { channel: 'pos', items: specItems() };
    try { return { q: Orbis.domain.orders.quote(d, Object.assign({ promoCode: U.promo || undefined, memberId: U.member || undefined }, base)), err: null }; }
    catch (e) { var r = { q: null, err: e.message }; try { r.q = Orbis.domain.orders.quote(d, base); } catch (e2) { /* line itself invalid */ } return r; }
  }
  function cartQty(skuId) { return Orbis.sum(U.cart.filter(function (l) { return l.skuId === skuId; }), function (l) { return l.qty; }); }
  function addLine(line) {
    var d = Orbis.db(), avail = Orbis.domain.inventory.available(d, line.skuId, d.session.outlet);
    if (cartQty(line.skuId) + 1 > avail) throw Orbis.Err('INSUFFICIENT_STOCK', 'Stok tidak cukup (tersedia ' + avail + ')');
    var sku = Orbis.mine(d, 'skus').filter(function (s) { return s.id === line.skuId; })[0];
    Orbis.need(sku, 'NOT_FOUND', 'SKU tidak ditemukan');
    if (line.modifiers.length || C.groupsFor(d, sku.productId).length) C.resolveModifiers(d, sku, line.modifiers);   // required groups checked even with no picks
    var k = lineKey(line), have = U.cart.filter(function (l) { return lineKey(l) === k; })[0];
    if (have) have.qty++; else U.cart.push({ skuId: line.skuId, qty: 1, modifiers: line.modifiers, note: line.note });
    Orbis.emit();
  }

  Orbis.screens.pos = function (d) {
    var sh = Orbis.domain.shifts.current(d), t = totals(d), q = U.q.toLowerCase(), inv = Orbis.domain.inventory;
    var prods = Orbis.mine(d, 'products').filter(function (p) { return !p.archived; });
    var cats = ['Semua'].concat(C.categories(d).map(function (c) { return c.name; }).filter(function (n) { return prods.some(function (p) { return p.category === n; }); }));
    var grid = prods.map(function (p) {
      var skus = tenantSkus(d, p.id).filter(function (s) { return sellable(d, s); });
      if (!skus.length || (U.cat !== 'Semua' && p.category !== U.cat)) return '';
      if (q && (p.name + ' ' + skus.map(function (s) { return s.sku + ' ' + (s.barcode || ''); }).join(' ')).toLowerCase().indexOf(q) < 0) return '';
      var prices = skus.map(function (s) { var hp = C.skuPrice(d, s, d.session.outlet); return hp == null ? s.price : hp; });
      var avail = Orbis.sum(skus, function (s) { return Math.max(0, inv.available(d, s.id, d.session.outlet)); });
      var multi = skus.length > 1 || C.groupsFor(d, p.id).length > 0, min = Math.min.apply(null, prices);
      return '<button type="button" data-act="posAdd" data-args="' + esc(JSON.stringify([skus[0].id, p.id])) + '"' + (avail <= 0 ? ' disabled' : '') + '><b>' + esc(p.name) + '</b><span>' + esc(skus.length > 1 ? skus.length + ' varian' : (skus[0].label || '')) + (multi ? ' · pilih' : '') + '</span><span>' + (skus.length > 1 && Math.max.apply(null, prices) !== min ? 'mulai ' : '') + esc(Orbis.idr(min)) + '</span><small>' + (avail <= 0 ? 'Stok habis' : 'Stok ' + esc(avail)) + '</small></button>';
    }).join('');
    grid = grid ? '<div class="prod">' + grid + '</div>' : Orbis.empty('Produk tidak ditemukan.');
    var lines = U.cart.length ? U.cart.map(function (l, i) {
      var it = t.q && t.q.items[i], sku = Orbis.mine(d, 'skus').filter(function (s) { return s.id === l.skuId; })[0] || { sku: l.skuId };
      var name = it ? it.name : sku.sku, mods = it && it.modifiers ? it.modifiers.map(function (m) { return m.name + (m.price ? ' +' + Orbis.idr(m.price) : ''); }).join(', ') : '';
      return '<div class="line"><div><b>' + esc(name) + '</b>' + (mods ? '<br><small class="xc-mods">' + esc(mods) + '</small>' : '') + (l.note ? '<br><small class="xc-mods">Catatan: ' + esc(l.note) + '</small>' : '') +
        '<br><small>' + esc(it ? Orbis.idr(it.price) + ' · ' + Orbis.idr(it.price * it.qty) : 'tidak bisa dijual') + '</small></div><div class="row">' +
        Orbis.btn('-', 'posQty', [i, -1], { kind: 'sm', title: 'Kurangi' }) + '<span>' + esc(l.qty) + '</span>' + Orbis.btn('+', 'posQty', [i, 1], { kind: 'sm', title: 'Tambah' }) + '</div></div>';
    }).join('') : Orbis.empty('Keranjang kosong.');
    var held = Orbis.domain.carts.list(d), q2 = t.q, money = function (label, v, neg) { return '<div class="line"><span>' + label + '</span><b>' + (neg ? '-' : '') + esc(Orbis.idr(v)) + '</b></div>'; };
    var cart = '<div id="pos-cart">' + lines +
      '<div class="f2"><div class="fld"><label for="pos-member">Member (ID)</label><input id="pos-member" name="member" value="' + esc(U.member) + '" data-input="posField" placeholder="mis. m1"></div>' +
      '<div class="fld"><label for="pos-promo">Kode promo</label><input id="pos-promo" name="promo" value="' + esc(U.promo) + '" data-input="posPromo" placeholder="mis. AWAN10"></div></div>' +
      (t.err ? '<div class="banner bad">' + esc(t.err) + '</div>' : '') +
      money('Subtotal', q2 ? q2.subtotal : 0) + (q2 && q2.discount ? money('Diskon', q2.discount, true) : '') + (q2 && q2.tax ? money(esc(q2.taxLabel || 'Pajak'), q2.tax) : '') +
      (q2 && q2.service ? money('Service', q2.service) : '') + (q2 && q2.rounding ? money('Pembulatan', q2.rounding) : '') + money('Total', q2 ? q2.total : 0) +
      '<div class="row">' + Orbis.btn('Bayar', 'posCheckout', null, { kind: 'primary', disabled: !sh || !U.cart.length || !q2, title: sh ? '' : 'Buka shift dulu' }) +
      Orbis.btn('Tahan', 'posHold', null, { disabled: !U.cart.length }) + Orbis.btn('Kosongkan', 'posClear', null, { disabled: !U.cart.length }) + '</div>' +
      (held.length ? '<h4>Keranjang tertahan</h4>' + held.map(function (h) { return '<div class="line"><span>' + esc(h.label || h.id) + ' · ' + esc(h.items.length) + ' item</span>' + Orbis.btn('Lanjut', 'posResume', [h.id], { kind: 'sm' }) + '</div>'; }).join('') : '') + '</div>';
    var bar = sh ? '<div class="banner ok row sp"><span>Shift ' + esc(sh.id) + ' terbuka sejak ' + esc(Orbis.fmtTime(sh.openedAt)) + ' · kas seharusnya ' + esc(Orbis.idr(Orbis.domain.shifts.summary(d, sh).expected)) + '</span><span class="row">' +
      Orbis.btn('Kas masuk', 'posCash', ['IN'], { kind: 'sm' }) + Orbis.btn('Kas keluar', 'posCash', ['OUT'], { kind: 'sm' }) + Orbis.btn('Tutup shift', 'posCloseShift', null, { kind: 'sm' }) + '</span></div>'
      : '<div class="banner bad" role="alert">Belum ada shift terbuka. Buka shift untuk menerima pembayaran tunai. ' + Orbis.btn('Buka shift', 'posOpenShift', null, { kind: 'primary' }) + '</div>';
    return Orbis.pageHead('POS Kasir', 'Penjualan langsung di outlet') + bar + '<div class="grid g-pos"><div>' +
      '<div class="row"><div class="fld"><label for="pos-q">Cari produk</label><input id="pos-q" name="pos-q" value="' + esc(U.q) + '" data-input="posSearch" data-input-render placeholder="Nama, SKU, barcode"></div></div>' +
      Orbis.tabs(cats.map(function (c) { return [c, c]; }), U.cat, 'posCat') + grid + '</div>' + Orbis.card('Keranjang', cart) + '</div>';
  };

  /** Tap: plain product adds directly; variants/modifiers open the picker. Old callers (skuId only) still work. */
  A.posAdd = function (skuId, productId) {
    var d = Orbis.db(), sku = Orbis.mine(d, 'skus').filter(function (s) { return s.id === skuId; })[0];
    Orbis.need(sku, 'NOT_FOUND', 'SKU tidak ditemukan');
    var pid = productId || sku.productId, skus = tenantSkus(d, pid).filter(function (s) { return sellable(d, s); }), groups = C.groupsFor(d, pid);
    if (skus.length <= 1 && !groups.length) return addLine({ skuId: skuId, modifiers: [], note: '' });
    var p = product(d, pid), inv = Orbis.domain.inventory;
    var body = '<input type="hidden" name="pid" value="' + esc(pid) + '">' + (skus.length > 1 ? '<fieldset class="fld"><legend>Varian</legend><div class="xc-opts">' + skus.map(function (s, i) {
      var hp = C.skuPrice(d, s, d.session.outlet), av = inv.available(d, s.id, d.session.outlet);
      return '<label class="chk"><input type="radio" name="xc-sku" value="' + esc(s.id) + '"' + (i === 0 ? ' checked' : '') + (av <= 0 ? ' disabled' : '') + '> ' + esc(s.label) + ' · ' + esc(Orbis.idr(hp == null ? s.price : hp)) + (av <= 0 ? ' (habis)' : '') + '</label>';
    }).join('') + '</div></fieldset>' : '<input type="hidden" name="xc-sku" value="' + esc(skus[0].id) + '">') +
      groups.map(function (m) {
        var type = m.max === 1 ? 'radio' : 'checkbox';
        return '<fieldset class="fld"><legend>' + esc(m.name) + ' <small>(' + esc(rule(m)) + ')</small></legend><div class="xc-opts">' + m.options.map(function (o, i) {
          return '<label class="chk"><input type="' + type + '" name="xc-m-' + esc(m.id) + '" value="' + esc(o.id) + '" data-xc-mod' + (m.required && type === 'radio' && i === 0 ? ' checked' : '') + '> ' + esc(o.name) + (o.price ? ' +' + esc(Orbis.idr(o.price)) : '') + '</label>';
        }).join('') + '</div></fieldset>';
      }).join('') + Orbis.field('Catatan (opsional)', 'note', '', { placeholder: 'mis. es sedikit' });
    Orbis.modal(p ? p.name : 'Pilih varian', body, Orbis.btn('Tambah ke keranjang', 'xcPick', null, { kind: 'primary' }));
  };
  A.xcPick = function () {
    var f = document.getElementById('modal-form'); if (!f) return;
    var sk = f.querySelector('input[name="xc-sku"]:checked') || f.querySelector('input[type="hidden"][name="xc-sku"]');
    Orbis.need(sk, 'VALIDATION', 'Pilih varian');
    var mods = Array.prototype.map.call(f.querySelectorAll('input[data-xc-mod]:checked'), function (el) { return el.value; });
    addLine({ skuId: sk.value, modifiers: mods, note: String(f.elements.note.value || '').trim().slice(0, 120) });
    Orbis.closeModal(); Orbis.toast('Ditambahkan ke keranjang');
  };
  /** Qty per cart line (index), stock checked against all lines of the same sku. */
  A.posQty = function (i, delta) {
    var l = U.cart[i]; if (!l) return;
    if (delta > 0) { var d = Orbis.db(), avail = Orbis.domain.inventory.available(d, l.skuId, d.session.outlet); if (cartQty(l.skuId) + delta > avail) throw Orbis.Err('INSUFFICIENT_STOCK', 'Stok tidak cukup (tersedia ' + avail + ')'); }
    l.qty += delta;
    if (l.qty <= 0) U.cart.splice(i, 1);
    Orbis.emit();
  };

  A.posResume = function (id) {
    var c = Orbis.domain.carts.resume(id);
    U.cart = c.items.map(function (i) { return { skuId: i.skuId, qty: i.qty, modifiers: i.modifiers || [], note: i.note || '' }; }); U.member = c.memberId || ''; U.promo = c.promoCode || ''; Orbis.toast('Keranjang dilanjutkan');
  };
  A.posCheckout = function () {
    var t = totals(Orbis.db());
    if (!U.cart.length || !t.q) throw Orbis.Err('EMPTY_CART', t.err || 'Keranjang kosong');
    if (t.err) throw Orbis.Err('VALIDATION', t.err);
    var total = t.q.total;
    var body = '<div class="line"><span>Total tagihan</span><b>' + esc(Orbis.idr(total)) + '</b></div>' +
      Orbis.field('Metode', 'ptype', 'cash', { type: 'select', options: [['cash', 'Tunai'], ['transfer', 'Transfer'], ['qris', 'QRIS'], ['split', 'Split (tunai + transfer)']] }) +
      Orbis.field('Uang diterima (tunai)', 'tendered', total, { type: 'number', min: 0 }) +
      Orbis.field('Bagian tunai (khusus split)', 'splitCash', 0, { type: 'number', min: 0, hint: 'Sisanya otomatis transfer.' });
    Orbis.modal('Pembayaran', body, Orbis.btn('Selesaikan pembayaran', 'posPay', null, { kind: 'primary' }));
  };
  A.posPay = function () {
    var t = totals(Orbis.db()), f = Orbis.formData(), pay;
    Orbis.need(t.q && !t.err, 'VALIDATION', t.err || 'Keranjang kosong');
    if (f.ptype === 'split') {
      var c = Number(f.splitCash);
      pay = { type: 'split', legs: [{ type: 'cash', amount: c }, { type: 'transfer', amount: t.q.total - c }].filter(function (l) { return l.amount !== 0; }), tendered: f.tendered === '' ? undefined : Number(f.tendered) };
    } else pay = { type: f.ptype, tendered: f.ptype === 'cash' ? Number(f.tendered) : undefined };
    var o = Orbis.domain.orders.checkout({ channel: 'pos', items: specItems(), method: 'pickup', payment: pay, memberId: U.member || undefined, promoCode: U.promo || undefined });
    U.cart = []; U.member = ''; U.promo = ''; U.lastReceipt = o.id;
    var pays = Orbis.domain.orders.payments(Orbis.db(), o.id), row = function (a, b) { return '<div class="line"><span>' + a + '</span><b>' + esc(Orbis.idr(b)) + '</b></div>'; };
    Orbis.modal('Struk', '<div class="receipt"><h4>' + esc(o.id) + '</h4><small>' + esc(Orbis.fmtTime(o.createdAt)) + '</small>' +
      o.items.map(function (i) { return '<div class="line"><span>' + esc(i.qty) + ' x ' + esc(i.name) + (i.modifiers ? '<br><small class="xc-mods">' + esc(i.modifiers.map(function (m) { return m.name; }).join(', ')) + '</small>' : '') + (i.note ? '<br><small class="xc-mods">' + esc(i.note) + '</small>' : '') + '</span><b>' + esc(Orbis.idr(i.qty * i.price)) + '</b></div>'; }).join('') +
      row('Subtotal', o.subtotal) + (o.discount ? row('Diskon', -o.discount) : '') + (o.tax ? row(esc(o.taxLabel || 'Pajak'), o.tax) : '') + (o.service ? row('Service', o.service) : '') + (o.rounding ? row('Pembulatan', o.rounding) : '') + row('Total', o.total) +
      pays.map(function (p) { return row(esc(p.type.toUpperCase()), p.amount); }).join('') + (o.change ? row('Kembalian', o.change) : '') + '</div>',
      Orbis.btn('Selesai', 'closeModal', null, { kind: 'primary' }));
  };
})(typeof window !== 'undefined' ? window : globalThis);
