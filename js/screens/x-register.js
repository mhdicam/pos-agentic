/* Orbis v2 — full-screen cashier register (route `pos`). Redesign of the POS views: register bar, product grid,
   order panel (member search, promo, totals), payment sheet (method buttons, quick cash, change), success screen.
   Pure render + thin actions; all writes reuse existing domain calls and the actions owned by other batches:
   posAdd/xcPick/posQty (catalog: variants & modifiers), posOpenShift/posCloseShift (team: blind close),
   posCash/posHold/posResume/posClear (pos), xsReceipt + bizSettings (settings: tenders, tax, rounding, WA). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions;
  var U = Orbis.ui.pos = Orbis.ui.pos || { cart: [], q: '', cat: 'Semua', member: '', promo: '', lastReceipt: null };
  var R = Orbis.ui.reg = Orbis.ui.reg || { pay: null, done: null, memberQ: '', promoOpen: false, cartOpen: false };
  var C = function () { return Orbis.domain.catalog; }, B = function () { return Orbis.domain.bizSettings; };
  var TONES = 6;
  var TENDER = { cash: ['Tunai', 'cash'], qris: ['QRIS', 'device'], transfer: ['Transfer', 'wallet'], split: ['Split', 'receipt'] };

  function idr(n) { return esc(Orbis.idr(n)); }
  function tone(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % TONES; }
  function initials(name) { return String(name).split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); }
  function specItems() { return U.cart.map(function (l) { return { skuId: l.skuId, qty: l.qty, modifiers: l.modifiers || [], note: l.note || '' }; }); }
  function spec(pay) { return { channel: 'pos', method: 'pickup', items: specItems(), payment: pay, memberId: U.member || undefined, promoCode: U.promo || undefined }; }
  function quote(d, type) {
    if (!U.cart.length) return { q: null, err: null };
    try { return { q: Orbis.domain.orders.quote(d, spec({ type: type || 'cash' })), err: null }; }
    catch (e) { var r = { q: null, err: e.message }; try { r.q = Orbis.domain.orders.quote(d, { channel: 'pos', items: specItems(), payment: { type: type || 'cash' } }); } catch (e2) { /* invalid line */ } return r; }
  }
  function tenders(d) {
    var b = B(); if (!b) return ['cash', 'qris', 'transfer'];
    var t = b.POS_TENDERS.filter(function (k) { return b.tenderEnabled(d, k); });
    if (t.indexOf('cash') >= 0 && t.length > 1) t.push('split');
    return t;
  }
  function member(d) { return U.member ? Orbis.mine(d, 'members').filter(function (m) { return m.id === U.member; })[0] : null; }

  /* ---------- pieces ---------- */
  function bar(d, sh) {
    var ol = Orbis.mine(d, 'outlets').filter(function (o) { return o.id === d.session.outlet; })[0] || {};
    var showExp = Orbis.can('shift.viewExpected');
    var shift = sh ? '<span class="rg-dot ok"></span><span>Shift buka ' + esc(Orbis.fmtTime(sh.openedAt)) + (showExp ? ' · kas ' + idr(Orbis.domain.shifts.summary(d, sh).expected) : '') + '</span>'
      : '<span class="rg-dot bad"></span><span>Shift belum dibuka</span>';
    return '<header class="rg-bar">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-act="regExit" title="Kembali ke back office">' + Orbis.icon('undo', 16) + '<span class="rg-hide-s">Keluar POS</span></button>' +
      '<div class="rg-where"><b>' + esc(ol.name || '-') + '</b><small>' + shift + ' · ' + esc(d.session.actor) + '</small></div>' +
      '<div class="rg-tools">' + (sh ? Orbis.btn('Kas masuk', 'posCash', ['IN'], { kind: 'sm' }) + Orbis.btn('Kas keluar', 'posCash', ['OUT'], { kind: 'sm' }) + Orbis.btn('Tutup shift', 'posCloseShift', null, { kind: 'sm' })
        : Orbis.btn('Buka shift', 'posOpenShift', null, { kind: 'primary' })) + '</div></header>';
  }

  function grid(d) {
    var inv = Orbis.domain.inventory, c = C(), q = U.q.toLowerCase(), outlet = d.session.outlet;
    var prods = Orbis.mine(d, 'products').filter(function (p) { return !p.archived; });
    var cats = ['Semua'].concat((c ? c.categories(d).map(function (x) { return x.name; }) : []).filter(function (n) { return prods.some(function (p) { return p.category === n; }); }));
    var tiles = prods.map(function (p) {
      var skus = Orbis.mine(d, 'skus').filter(function (s) { return s.productId === p.id && !s.archived && (!c || c.availableAt(d, s, outlet)); });
      if (!skus.length || (U.cat !== 'Semua' && p.category !== U.cat)) return '';
      if (q && (p.name + ' ' + skus.map(function (s) { return s.sku + ' ' + (s.barcode || ''); }).join(' ')).toLowerCase().indexOf(q) < 0) return '';
      var prices = skus.map(function (s) { var hp = c ? c.skuPrice(d, s, outlet) : null; return hp == null ? s.price : hp; });
      var avail = Orbis.sum(skus, function (s) { return Math.max(0, inv.available(d, s.id, outlet)); });
      var opts = skus.length > 1 || (c && c.groupsFor(d, p.id).length > 0), inCart = Orbis.sum(U.cart.filter(function (l) { return skus.some(function (s) { return s.id === l.skuId; }); }), function (l) { return l.qty; });
      var low = avail > 0 && avail <= 5;
      return '<button type="button" class="rg-tile" data-act="posAdd" data-args="' + esc(JSON.stringify([skus[0].id, p.id])) + '"' + (avail <= 0 ? ' disabled' : '') + ' aria-label="' + esc(p.name + ', ' + Orbis.idr(Math.min.apply(null, prices))) + '">' +
        '<span class="rg-art t' + tone(p.name) + '">' + esc(initials(p.name)) + (inCart ? '<span class="rg-badge">' + esc(inCart) + '</span>' : '') + '</span>' +
        '<span class="rg-name">' + esc(p.name) + '</span>' +
        '<span class="rg-price">' + (opts && skus.length > 1 ? 'mulai ' : '') + idr(Math.min.apply(null, prices)) + '</span>' +
        '<span class="rg-meta">' + (avail <= 0 ? '<span class="rg-out">Habis</span>' : low ? '<span class="rg-low">Sisa ' + esc(avail) + '</span>' : 'Stok ' + esc(avail)) + (opts ? ' · pilih opsi' : '') + '</span></button>';
    }).join('');
    return '<section class="rg-left" aria-label="Produk">' +
      '<div class="rg-search">' + Orbis.icon('list', 16) + '<input name="pos-q" value="' + esc(U.q) + '" data-input="posSearch" data-input-render placeholder="Cari produk, SKU, atau scan barcode" aria-label="Cari produk"></div>' +
      '<div class="rg-cats" role="tablist">' + cats.map(function (x) { return '<button type="button" role="tab" class="rg-cat' + (x === U.cat ? ' on' : '') + '" aria-selected="' + (x === U.cat) + '" data-act="posCat" data-args="' + esc(JSON.stringify([x])) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
      (tiles ? '<div class="rg-grid">' + tiles + '</div>' : Orbis.empty(q ? 'Tidak ada produk "' + U.q + '".' : 'Belum ada produk di kategori ini.')) + '</section>';
  }

  function memberBox(d) {
    var m = member(d);
    if (m) {
      var tier = Orbis.domain.members.tier(m.lifetime);
      return '<div class="rg-member on"><span class="rg-av">' + esc(initials(m.name)) + '</span><div><b>' + esc(m.name) + '</b><small>' + esc(tier) + ' · ' + esc(m.points) + ' poin · ' + esc(m.phone) + '</small></div>' +
        '<button type="button" class="ico" data-act="regMember" data-args="[&quot;&quot;]" aria-label="Lepas member">' + Orbis.icon('x', 16) + '</button></div>';
    }
    var hits = R.memberQ.length >= 2 ? Orbis.domain.members.search(d, R.memberQ).slice(0, 5) : [];
    return '<div class="rg-member"><input name="reg-mq" value="' + esc(R.memberQ) + '" data-input="regMemberQ" data-input-render placeholder="Cari member: nama atau no. HP" aria-label="Cari member">' +
      (hits.length ? '<ul class="rg-hits">' + hits.map(function (h) { return '<li><button type="button" data-act="regMember" data-args="' + esc(JSON.stringify([h.id])) + '"><b>' + esc(h.name) + '</b><small>' + esc(h.phone) + ' · ' + esc(h.points) + ' poin</small></button></li>'; }).join('') + '</ul>'
        : R.memberQ.length >= 2 ? '<small class="rg-none">Member tidak ditemukan.</small>' : '') + '</div>';
  }

  function orderPanel(d, sh) {
    var t = quote(d, 'cash'), q = t.q, held = Orbis.domain.carts.list(d), n = Orbis.sum(U.cart, function (l) { return l.qty; });
    var lines = U.cart.length ? '<ol class="rg-lines">' + U.cart.map(function (l, i) {
      var it = q && q.items[i], sku = Orbis.mine(d, 'skus').filter(function (s) { return s.id === l.skuId; })[0] || { sku: l.skuId };
      var mods = it && it.modifiers ? it.modifiers.map(function (m) { return m.name; }).join(', ') : '';
      return '<li><div class="rg-l-main"><b>' + esc(it ? it.name : sku.sku) + '</b>' + (mods ? '<small>' + esc(mods) + '</small>' : '') + (l.note ? '<small>“' + esc(l.note) + '”</small>' : '') + '</div>' +
        '<div class="rg-qty"><button type="button" data-act="posQty" data-args="' + esc(JSON.stringify([i, -1])) + '" aria-label="Kurangi">−</button><span>' + esc(l.qty) + '</span><button type="button" data-act="posQty" data-args="' + esc(JSON.stringify([i, 1])) + '" aria-label="Tambah">+</button></div>' +
        '<b class="rg-l-sum">' + (it ? idr(it.price * it.qty) : '-') + '</b></li>';
    }).join('') + '</ol>' : '<div class="rg-empty">' + Orbis.icon('cart', 28) + '<p>Ketuk produk untuk menambah ke pesanan.</p></div>';
    var row = function (k, v, cls) { return '<div class="rg-row' + (cls ? ' ' + cls : '') + '"><span>' + k + '</span><b>' + v + '</b></div>'; };
    var sums = q ? row('Subtotal', idr(q.subtotal)) + (q.discount ? row('Diskon', '−' + idr(q.discount), 'disc') : '') + (q.service ? row('Service', idr(q.service)) : '') +
      (q.tax ? row(esc(q.taxLabel || 'Pajak'), idr(q.tax)) : '') + (q.rounding ? row('Pembulatan (tunai)', (q.rounding < 0 ? '−' : '') + idr(Math.abs(q.rounding))) : '') : '';
    var promo = R.promoOpen || U.promo ? '<div class="rg-promo"><input name="reg-promo" value="' + esc(U.promo) + '" data-input="posPromo" placeholder="Kode promo" aria-label="Kode promo">' +
      Orbis.btn('Pakai', 'regRefresh', null, { kind: 'sm' }) + '</div>' : '';
    return '<aside class="rg-right' + (R.cartOpen ? ' open' : '') + '" aria-label="Pesanan">' +
      '<div class="rg-r-head"><h2>Pesanan' + (n ? ' <span class="rg-count">' + esc(n) + '</span>' : '') + '</h2>' +
      '<div class="row">' + (U.cart.length ? Orbis.btn('Kosongkan', 'posClear', null, { kind: 'sm' }) : '') + '<button type="button" class="ico rg-only-s" data-act="regCart" aria-label="Tutup pesanan">' + Orbis.icon('x', 18) + '</button></div></div>' +
      memberBox(d) + '<div class="rg-scroll">' + lines +
      (held.length ? '<div class="rg-held"><small>Pesanan ditahan</small>' + held.map(function (h) { return '<button type="button" data-act="posResume" data-args="' + esc(JSON.stringify([h.id])) + '">' + esc(h.label || h.id) + ' · ' + esc(h.items.length) + ' item</button>'; }).join('') + '</div>' : '') + '</div>' +
      '<div class="rg-foot">' + (t.err ? '<div class="banner bad">' + esc(t.err) + '</div>' : '') + sums + promo +
      '<div class="rg-actions">' + (R.promoOpen || U.promo ? '' : Orbis.btn('Promo', 'regPromo', null, { icon: 'tag', disabled: !U.cart.length })) +
      Orbis.btn('Tahan', 'posHold', null, { disabled: !U.cart.length }) + '</div>' +
      '<button type="button" class="rg-pay" data-act="regPay"' + (!sh || !q || t.err ? ' disabled' : '') + '>' +
        '<span>' + (!sh ? 'Buka shift dulu' : 'Bayar') + '</span><b>' + (q ? idr(q.total) : 'Rp 0') + '</b></button></div></aside>' +
      // mobile: sticky bar that opens the order drawer
      '<button type="button" class="rg-mbar" data-act="regCart"' + (U.cart.length ? '' : ' hidden') + '><span>' + Orbis.icon('cart', 18) + ' ' + esc(n) + ' item</span><b>' + (q ? idr(q.total) : '') + '</b><span>Lihat pesanan ›</span></button>';
  }

  /* ---------- payment sheet + success (inline, not a modal: one place to look) ---------- */
  function paySheet(d) {
    var types = tenders(d), m = R.pay.method;
    if (types.indexOf(m) < 0) m = R.pay.method = types[0];
    var q = Orbis.domain.orders.quote(d, spec({ type: m === 'split' ? 'split' : m })), total = q.total;
    var tendered = R.pay.tendered == null ? total : R.pay.tendered, change = Math.max(0, tendered - total);
    var quick = [total].concat([20000, 50000, 100000, 150000, 200000].filter(function (v) { return v > total; }).slice(0, 3));
    var body = '';
    if (m === 'cash') {
      body = '<label class="rg-big"><span>Uang diterima</span><input type="number" inputmode="numeric" name="reg-tendered" value="' + esc(tendered) + '" min="0" data-input="regTendered" data-input-render></label>' +
        '<div class="rg-quick">' + quick.map(function (v, i) { return '<button type="button" class="' + (v === tendered ? 'on' : '') + '" data-act="regQuick" data-args="' + esc(JSON.stringify([v])) + '">' + (i === 0 ? 'Uang pas' : idr(v)) + '</button>'; }).join('') + '</div>' +
        '<div class="rg-change' + (tendered < total ? ' short' : '') + '"><span>' + (tendered < total ? 'Kurang' : 'Kembalian') + '</span><b>' + idr(Math.abs(tendered < total ? total - tendered : change)) + '</b></div>';
    } else if (m === 'split') {
      var cashPart = R.pay.split == null ? Math.floor(total / 2) : R.pay.split, rest = types.filter(function (k) { return k !== 'cash' && k !== 'split'; })[0];
      body = '<label class="rg-big"><span>Bagian tunai</span><input type="number" inputmode="numeric" name="reg-split" value="' + esc(cashPart) + '" min="0" max="' + esc(total) + '" data-input="regSplit" data-input-render></label>' +
        '<div class="rg-change"><span>Sisa via ' + esc(TENDER[rest][0]) + '</span><b>' + idr(Math.max(0, total - cashPart)) + '</b></div><small class="muted">Split tidak dibulatkan.</small>';
    } else if (m === 'qris') {
      body = '<div class="rg-qr" aria-label="QRIS (simulasi)"><div class="rg-qr-box">' + qrSvg(String(total)) + '</div><p>Minta pelanggan scan QRIS, lalu konfirmasi setelah notifikasi masuk.</p><small class="muted">Simulasi: belum terhubung ke penyedia pembayaran.</small></div>';
    } else {
      var acc = B() ? (B().payments(d).transfer.accounts || [])[0] : null;
      body = '<div class="rg-qr"><p>' + (acc ? 'Transfer ke <b>' + esc(acc.bank) + ' ' + esc(acc.number) + '</b> a.n. ' + esc(acc.name) : 'Transfer bank') + '</p><small class="muted">Konfirmasi setelah dana diterima.</small></div>';
    }
    var ok = m !== 'cash' || tendered >= total;
    return '<div class="rg-sheet" role="dialog" aria-modal="true" aria-label="Pembayaran"><div class="rg-sheet-in">' +
      '<div class="rg-sheet-head"><button type="button" class="btn btn-ghost btn-sm" data-act="regPayBack">‹ Kembali</button><div><small>Total tagihan</small><b>' + idr(total) + '</b></div></div>' +
      '<div class="rg-methods" role="radiogroup" aria-label="Metode bayar">' + types.map(function (k) {
        return '<button type="button" role="radio" aria-checked="' + (k === m) + '" class="' + (k === m ? 'on' : '') + '" data-act="regMethod" data-args="' + esc(JSON.stringify([k])) + '">' + Orbis.icon(TENDER[k][1], 20) + '<span>' + esc(TENDER[k][0]) + '</span></button>';
      }).join('') + '</div>' + body +
      '<button type="button" class="rg-pay" data-act="regConfirm"' + (ok ? '' : ' disabled') + '><span>' + (m === 'cash' ? 'Terima pembayaran' : 'Konfirmasi lunas') + '</span><b>' + idr(total) + '</b></button></div></div>';
  }
  function done(d) {
    var o = Orbis.domain.orders.get(d, R.done); if (!o) { R.done = null; return ''; }
    var wa = B() && B().waLink ? B().waLink(d, o) : null;
    return '<div class="rg-sheet" role="dialog" aria-modal="true" aria-label="Pembayaran berhasil"><div class="rg-sheet-in rg-done">' +
      '<div class="rg-check">' + Orbis.icon('check', 36) + '</div><h2>Pembayaran berhasil</h2><p class="muted">' + esc(o.id) + ' · ' + esc(Orbis.fmtTime(o.createdAt)) + '</p>' +
      (o.change ? '<div class="rg-change"><span>Kembalian</span><b>' + idr(o.change) + '</b></div>' : '<div class="rg-change"><span>Total dibayar</span><b>' + idr(o.total) + '</b></div>') +
      '<div class="rg-done-actions">' + Orbis.btn('Lihat / cetak struk', 'regReceipt', [o.id], { icon: 'receipt' }) +
      (wa ? '<a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">' + Orbis.icon('chat', 16) + 'Kirim WA</a>' : '') + '</div>' +
      '<button type="button" class="rg-pay" data-act="regNew"><span>Pesanan baru</span><b>' + Orbis.icon('plus', 18) + '</b></button></div></div>';
  }
  /** Decorative deterministic QR-like pattern (simulation only; not a scannable code). */
  function qrSvg(seed) {
    var n = 21, cells = '', h = 7;
    for (var i = 0; i < seed.length; i++) h = (h * 131 + seed.charCodeAt(i)) >>> 0;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      var on = finder ? (x % 6 === 0 || y % 6 === 0 || (x % 7 > 1 && x % 7 < 5 && y % 7 > 1 && y % 7 < 5) || x === 20 || y === 20) : ((h = (h * 1103515245 + 12345) >>> 0) >> 16) & 1;
      if (finder && (x === 14 || y === 14)) on = (x === 14 && y < 7) || (y === 14 && x < 7) ? 0 : on;
      if (on) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg viewBox="-1 -1 23 23" role="img" aria-label="Kode QR simulasi"><rect x="-1" y="-1" width="23" height="23" fill="#fff"/><g fill="currentColor">' + cells + '</g></svg>';
  }

  /* ---------- screen ---------- */
  function screen(d) {
    if (!Orbis.can('pos.sell')) return Orbis.empty('Peran ini tidak bisa memakai kasir.');
    var sh = Orbis.domain.shifts.current(d);
    return '<div class="rg">' + bar(d, sh) + (sh ? '' : '<div class="rg-warn" role="alert">Buka shift untuk mulai berjualan. Pembayaran tunai butuh shift terbuka.</div>') +
      '<div class="rg-body">' + grid(d) + orderPanel(d, sh) + '</div>' +
      (R.done ? done(d) : R.pay ? paySheet(d) : '') + '</div>';
  }
  screen.fullscreen = true;
  Orbis.screens.pos = screen;

  /* ---------- actions ---------- */
  function rr() { Orbis.render(); }
  A.regExit = function () { R.pay = null; R.done = null; Orbis.go(Orbis.firstRoute(Orbis.db().session.role) === 'pos' ? 'orders' : Orbis.firstRoute(Orbis.db().session.role)); };
  A.regCart = function () { R.cartOpen = !R.cartOpen; rr(); };
  A.regMemberQ = function (v) { R.memberQ = String(v); };
  A.regMember = function (id) { U.member = id || ''; R.memberQ = ''; rr(); };
  A.regPromo = function () { R.promoOpen = true; rr(); };
  A.regRefresh = function () { rr(); };
  A.regPay = function () {
    var d = Orbis.db(), t = quote(d, 'cash');
    Orbis.need(U.cart.length && t.q, 'EMPTY_CART', t.err || 'Keranjang kosong');
    Orbis.need(!t.err, 'VALIDATION', t.err);
    Orbis.need(Orbis.domain.shifts.current(d), 'NO_OPEN_SHIFT', 'Buka shift dulu');
    R.pay = { method: tenders(d)[0], tendered: null, split: null }; R.cartOpen = false; rr();
  };
  A.regPayBack = function () { R.pay = null; rr(); };
  A.regMethod = function (m) { R.pay.method = m; R.pay.tendered = null; rr(); };
  A.regQuick = function (v) { R.pay.tendered = v; rr(); };
  A.regTendered = function (v) { R.pay.tendered = Math.max(0, Math.floor(Number(v) || 0)); };
  A.regSplit = function (v) { R.pay.split = Math.max(0, Math.floor(Number(v) || 0)); };
  A.regConfirm = function () {
    var d = Orbis.db(), m = R.pay.method, pay;
    if (m === 'split') {
      var total = Orbis.domain.orders.quote(d, spec({ type: 'split' })).total, c = R.pay.split == null ? Math.floor(total / 2) : R.pay.split;
      var rest = tenders(d).filter(function (k) { return k !== 'cash' && k !== 'split'; })[0];
      Orbis.need(c >= 0 && c <= total, 'VALIDATION', 'Bagian tunai harus 0 sampai total');
      pay = { type: 'split', legs: [{ type: 'cash', amount: c }, { type: rest, amount: total - c }].filter(function (l) { return l.amount > 0; }) };
    } else {
      var q = Orbis.domain.orders.quote(d, spec({ type: m }));
      pay = { type: m, tendered: m === 'cash' ? (R.pay.tendered == null ? q.total : R.pay.tendered) : undefined };
    }
    var o = Orbis.domain.orders.checkout(spec(pay));
    U.cart = []; U.member = ''; U.promo = ''; U.lastReceipt = o.id;
    R.pay = null; R.done = o.id; R.promoOpen = false; rr();
  };
  A.regReceipt = function (id) { if (A.xsReceipt) A.xsReceipt(id); };
  A.regNew = function () { R.done = null; rr(); };
  // Escape closes the payment sheet / drawer first (dialogs elsewhere are handled by app.js)
  if (g.document) g.document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Escape' || !g.document.querySelector('.rg')) return;
    if (R.pay) { R.pay = null; rr(); } else if (R.cartOpen) { R.cartOpen = false; rr(); }
  });
  // keep the old modal entry points working (other code/tests may call them) but route them through the new sheet
  A.posCheckout = A.regPay;
})(typeof window !== 'undefined' ? window : globalThis);
