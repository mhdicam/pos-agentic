/* POS screen: product grid, cart, shift bar, checkout. Renders only; all writes via Orbis.domain.*. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions;
  Orbis.ui = Orbis.ui || {};
  var U = Orbis.ui.pos = Orbis.ui.pos || { cart: [], q: '', cat: 'Semua', member: '', promo: '', lastReceipt: null };

  function cartTotals(d) {
    var items = U.cart.map(function (c) {
      var sku = d.skus.filter(function (s) { return s.id === c.skuId && s.tenant === d.session.tenant; })[0];
      return sku ? { skuId: c.skuId, qty: c.qty, price: sku.price, sku: sku } : null;
    }).filter(Boolean);
    var sub = Orbis.sum(items, function (i) { return i.qty * i.price; });
    var q = null, err = null;
    if (items.length) {
      try { q = Orbis.domain.orders.quote(d, { channel: 'pos', items: items.map(function (i) { return { skuId: i.skuId, qty: i.qty }; }), promoCode: U.promo || undefined, memberId: U.member || undefined }); }
      catch (e) { err = e.message; try { q = Orbis.domain.orders.quote(d, { channel: 'pos', items: items.map(function (i) { return { skuId: i.skuId, qty: i.qty }; }) }); } catch (e2) { /* cart empty */ } }
    }
    return { items: items, sub: sub, q: q, err: err };
  }
  function productName(d, sku) { var p = d.products.filter(function (x) { return x.id === sku.productId; })[0]; return (p ? p.name : sku.sku); }

  function shiftBar(d, sh) {
    if (!sh) return '<div class="banner bad" role="alert">Belum ada shift terbuka. Buka shift untuk menerima pembayaran tunai. ' + Orbis.btn('Buka shift', 'posOpenShift', null, { kind: 'primary' }) + '</div>';
    var s = Orbis.domain.shifts.summary(d, sh);
    return '<div class="banner ok row sp"><span>Shift ' + esc(sh.id) + ' terbuka sejak ' + esc(Orbis.fmtTime(sh.openedAt)) + ' · kas seharusnya ' + esc(Orbis.idr(s.expected)) + '</span><span class="row">' +
      Orbis.btn('Kas masuk', 'posCash', ['IN'], { kind: 'sm' }) + Orbis.btn('Kas keluar', 'posCash', ['OUT'], { kind: 'sm' }) + Orbis.btn('Tutup shift', 'posCloseShift', null, { kind: 'sm' }) + '</span></div>';
  }

  Orbis.screens.pos = function (d) {
    var sh = Orbis.domain.shifts.current(d), t = cartTotals(d);
    var cats = ['Semua'];
    d.products.forEach(function (p) { if (p.tenant === d.session.tenant && cats.indexOf(p.category) < 0) cats.push(p.category); });
    var q = U.q.toLowerCase();
    var cat = Orbis.domain.inventory.catalog(d).filter(function (r) {
      return (U.cat === 'Semua' || r.product.category === U.cat) && (!q || (r.product.name + ' ' + r.sku.sku).toLowerCase().indexOf(q) >= 0);
    });
    var grid = cat.length ? '<div class="prod">' + cat.map(function (r) {
      var out = r.available <= 0;
      return '<button type="button" data-act="posAdd" data-args="' + esc(JSON.stringify([r.sku.id])) + '"' + (out ? ' disabled' : '') + '><b>' + esc(r.product.name) + '</b><span>' + esc(r.sku.label || '') + '</span><span>' + esc(Orbis.idr(r.sku.price)) + '</span><small>' + (out ? 'Stok habis' : 'Stok ' + esc(r.available)) + '</small></button>';
    }).join('') + '</div>' : Orbis.empty('Produk tidak ditemukan.');
    var lines = t.items.length ? t.items.map(function (i) {
      return '<div class="line"><div><b>' + esc(productName(d, i.sku)) + '</b><br><small>' + esc(i.sku.label || '') + ' · ' + esc(Orbis.idr(i.price)) + '</small></div><div class="row">' +
        Orbis.btn('-', 'posQty', [i.skuId, -1], { kind: 'sm', title: 'Kurangi' }) + '<span>' + esc(i.qty) + '</span>' + Orbis.btn('+', 'posQty', [i.skuId, 1], { kind: 'sm', title: 'Tambah' }) + '</div></div>';
    }).join('') : Orbis.empty('Keranjang kosong.');
    var held = Orbis.domain.carts.list(d);
    var q2 = t.q;
    var cart = '<div id="pos-cart">' + lines +
      '<div class="f2"><div class="fld"><label for="pos-member">Member (ID)</label><input id="pos-member" name="member" value="' + esc(U.member) + '" data-input="posField" placeholder="mis. m1"></div>' +
      '<div class="fld"><label for="pos-promo">Kode promo</label><input id="pos-promo" name="promo" value="' + esc(U.promo) + '" data-input="posPromo" placeholder="mis. AWAN10"></div></div>' +
      (t.err ? '<div class="banner bad">' + esc(t.err) + '</div>' : '') +
      '<div class="line"><span>Subtotal</span><b>' + esc(Orbis.idr(q2 ? q2.subtotal : 0)) + '</b></div>' +
      (q2 && q2.discount ? '<div class="line"><span>Diskon</span><b>-' + esc(Orbis.idr(q2.discount)) + '</b></div>' : '') +
      (q2 && q2.tax ? '<div class="line"><span>Pajak</span><b>' + esc(Orbis.idr(q2.tax)) + '</b></div>' : '') +
      (q2 && q2.service ? '<div class="line"><span>Service</span><b>' + esc(Orbis.idr(q2.service)) + '</b></div>' : '') +
      '<div class="line"><span>Total</span><b>' + esc(Orbis.idr(q2 ? q2.total : 0)) + '</b></div>' +
      '<div class="row">' + Orbis.btn('Bayar', 'posCheckout', null, { kind: 'primary', disabled: !sh || !t.items.length, title: sh ? '' : 'Buka shift dulu' }) +
      Orbis.btn('Tahan', 'posHold', null, { disabled: !t.items.length }) + Orbis.btn('Kosongkan', 'posClear', null, { disabled: !t.items.length }) + '</div>' +
      (held.length ? '<h4>Keranjang tertahan</h4>' + held.map(function (h) {
        return '<div class="line"><span>' + esc(h.label || h.id) + ' · ' + esc(h.items.length) + ' item</span>' + Orbis.btn('Lanjut', 'posResume', [h.id], { kind: 'sm' }) + '</div>';
      }).join('') : '') + '</div>';
    return Orbis.pageHead('POS Kasir', 'Penjualan langsung di outlet') + shiftBar(d, sh) +
      '<div class="grid g-pos"><div>' +
      '<div class="row"><div class="fld"><label for="pos-q">Cari produk</label><input id="pos-q" name="pos-q" value="' + esc(U.q) + '" data-input="posSearch" data-input-render placeholder="Nama atau SKU"></div></div>' +
      Orbis.tabs(cats.map(function (c) { return [c, c]; }), U.cat, 'posCat') + grid + '</div>' +
      Orbis.card('Keranjang', cart) + '</div>';
  };

  /* ---------- actions ---------- */
  function rerender() { Orbis.emit(); }
  A.posSearch = function (v) { U.q = v; };
  A.posCat = function (c) { U.cat = c; rerender(); };
  A.posField = function (v) { U.member = String(v).trim(); };
  A.posPromo = function (v) { U.promo = String(v).trim(); };
  A.posAdd = function (skuId) {
    var d = Orbis.db(), have = U.cart.filter(function (c) { return c.skuId === skuId; })[0];
    var avail = Orbis.domain.inventory.available(d, skuId, d.session.outlet);
    if ((have ? have.qty : 0) + 1 > avail) throw Orbis.Err('INSUFFICIENT_STOCK', 'Stok tidak cukup (tersedia ' + avail + ')');
    if (have) have.qty++; else U.cart.push({ skuId: skuId, qty: 1 });
    rerender();
  };
  A.posQty = function (skuId, delta) {
    var c = U.cart.filter(function (x) { return x.skuId === skuId; })[0]; if (!c) return;
    c.qty += delta;
    if (c.qty <= 0) U.cart = U.cart.filter(function (x) { return x !== c; });
    else { var d = Orbis.db(), avail = Orbis.domain.inventory.available(d, skuId, d.session.outlet); if (c.qty > avail) { c.qty = avail; rerender(); throw Orbis.Err('INSUFFICIENT_STOCK', 'Stok tidak cukup'); } }
    rerender();
  };
  A.posClear = function () { U.cart = []; U.member = ''; U.promo = ''; rerender(); };
  A.posHold = function () {
    Orbis.domain.carts.hold({ items: U.cart, memberId: U.member, promoCode: U.promo, label: 'Tahan ' + Orbis.fmtTime(Orbis.clock.now()) });
    U.cart = []; U.member = ''; U.promo = ''; Orbis.toast('Keranjang ditahan');
  };
  A.posResume = function (id) {
    var c = Orbis.domain.carts.resume(id);
    U.cart = c.items.slice(); U.member = c.memberId || ''; U.promo = c.promoCode || ''; Orbis.toast('Keranjang dilanjutkan');
  };

  A.posOpenShift = function () {
    Orbis.modal('Buka shift', Orbis.field('Kas awal (Rp)', 'opening', 0, { type: 'number', min: 0 }), Orbis.btn('Buka shift', 'posOpenShiftGo', null, { kind: 'primary' }));
  };
  A.posOpenShiftGo = function () {
    var f = Orbis.formData(); Orbis.domain.shifts.open(Number(f.opening)); Orbis.closeModal(); Orbis.toast('Shift dibuka');
  };
  A.posCash = function (type) {
    Orbis.modal(type === 'IN' ? 'Kas masuk' : 'Kas keluar', '<input type="hidden" name="type" value="' + esc(type) + '">' + Orbis.field('Nominal (Rp)', 'amount', 0, { type: 'number', min: 1 }) + Orbis.field('Alasan (min. 5 karakter)', 'reason', ''), Orbis.btn('Simpan', 'posCashGo', null, { kind: 'primary' }));
  };
  A.posCashGo = function () {
    var f = Orbis.formData(); Orbis.domain.shifts.cashEvent(f.type, Number(f.amount), f.reason); Orbis.closeModal(); Orbis.toast('Kas tercatat');
  };
  A.posCloseShift = function () {
    var d = Orbis.db(), sh = Orbis.domain.shifts.current(d); if (!sh) return;
    var s = Orbis.domain.shifts.summary(d, sh);
    var body = '<div class="line"><span>Kas awal</span><b>' + esc(Orbis.idr(s.opening)) + '</b></div><div class="line"><span>Tunai bersih</span><b>' + esc(Orbis.idr(s.cashNet)) + '</b></div>' +
      '<div class="line"><span>Kas masuk / keluar</span><b>' + esc(Orbis.idr(s.cashIn)) + ' / ' + esc(Orbis.idr(s.cashOut)) + '</b></div><div class="line"><span>Seharusnya</span><b>' + esc(Orbis.idr(s.expected)) + '</b></div>' +
      Orbis.field('Kas dihitung (Rp)', 'counted', s.expected, { type: 'number', min: 0, hint: 'Selisih wajib diberi catatan.' }) + Orbis.field('Catatan', 'note', '');
    Orbis.modal('Tutup shift', body, Orbis.btn('Tutup shift', 'posCloseShiftGo', null, { kind: 'primary' }));
  };
  A.posCloseShiftGo = function () {
    var f = Orbis.formData(), r = Orbis.domain.shifts.close(Number(f.counted), f.note);
    Orbis.closeModal(); Orbis.toast(r.variance === 0 ? 'Shift ditutup, kas pas' : 'Shift ditutup, selisih ' + Orbis.idr(r.variance));
  };

  A.posCheckout = function () {
    var d = Orbis.db(), t = cartTotals(d);
    if (!t.items.length || !t.q) throw Orbis.Err('EMPTY_CART', 'Keranjang kosong');
    var total = t.q.total;
    var body = '<div class="line"><span>Total tagihan</span><b>' + esc(Orbis.idr(total)) + '</b></div>' +
      Orbis.field('Metode', 'ptype', 'cash', { type: 'select', options: [['cash', 'Tunai'], ['transfer', 'Transfer'], ['qris', 'QRIS'], ['split', 'Split (tunai + transfer)']] }) +
      Orbis.field('Uang diterima (tunai)', 'tendered', total, { type: 'number', min: 0 }) +
      Orbis.field('Bagian tunai (khusus split)', 'splitCash', 0, { type: 'number', min: 0, hint: 'Sisanya otomatis transfer.' }) +
      '<div class="banner" id="pos-change">Kembalian dihitung saat bayar.</div>';
    Orbis.modal('Pembayaran', body, Orbis.btn('Selesaikan pembayaran', 'posPay', null, { kind: 'primary' }));
  };
  A.posPay = function () {
    var d = Orbis.db(), t = cartTotals(d), f = Orbis.formData(), total = t.q.total, pay;
    if (f.ptype === 'split') {
      var c = Number(f.splitCash);
      pay = { type: 'split', legs: [{ type: 'cash', amount: c }, { type: 'transfer', amount: total - c }].filter(function (l) { return l.amount !== 0; }), tendered: f.tendered === '' ? undefined : Number(f.tendered) };
    } else pay = { type: f.ptype, tendered: f.ptype === 'cash' ? Number(f.tendered) : undefined };
    var o = Orbis.domain.orders.checkout({ channel: 'pos', items: t.items.map(function (i) { return { skuId: i.skuId, qty: i.qty }; }), method: 'pickup', payment: pay, memberId: U.member || undefined, promoCode: U.promo || undefined });
    U.cart = []; U.member = ''; U.promo = ''; U.lastReceipt = o.id;
    showReceipt(Orbis.db(), o.id);
  };
  function showReceipt(d, id) {
    var o = Orbis.domain.orders.get(d, id); if (!o) return;
    var pays = Orbis.domain.orders.payments(d, id);
    var body = '<div class="receipt"><h4>' + esc(o.id) + '</h4><small>' + esc(Orbis.fmtTime(o.createdAt)) + '</small>' +
      o.items.map(function (i) { return '<div class="line"><span>' + esc(i.qty) + ' x ' + esc(i.name) + '</span><b>' + esc(Orbis.idr(i.qty * i.price)) + '</b></div>'; }).join('') +
      '<div class="line"><span>Subtotal</span><b>' + esc(Orbis.idr(o.subtotal)) + '</b></div>' +
      (o.discount ? '<div class="line"><span>Diskon</span><b>-' + esc(Orbis.idr(o.discount)) + '</b></div>' : '') +
      (o.tax ? '<div class="line"><span>Pajak</span><b>' + esc(Orbis.idr(o.tax)) + '</b></div>' : '') +
      (o.service ? '<div class="line"><span>Service</span><b>' + esc(Orbis.idr(o.service)) + '</b></div>' : '') +
      '<div class="line"><span>Total</span><b>' + esc(Orbis.idr(o.total)) + '</b></div>' +
      pays.map(function (p) { return '<div class="line"><span>' + esc(p.type.toUpperCase()) + '</span><b>' + esc(Orbis.idr(p.amount)) + '</b></div>'; }).join('') +
      (o.change ? '<div class="line"><span>Kembalian</span><b>' + esc(Orbis.idr(o.change)) + '</b></div>' : '') + '</div>';
    Orbis.modal('Struk', body, Orbis.btn('Selesai', 'closeModal', null, { kind: 'primary' }));
  }
})(window);
