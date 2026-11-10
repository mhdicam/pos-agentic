/* Orbis v2 — customer screens: 'store' (public storefront + cart + checkout) and 'track'. Public view reads ONLY published data. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.store = Orbis.ui.store || { tenant: null, cart: {}, step: 'shop', done: null, form: { name: '', phone: '', method: 'pickup', address: '', payment: 'cash', promo: '' }, track: { id: '', phone: '', result: null, error: null } };
  var S = function () { return Orbis.domain.storefront; };

  function tenantId(d) {
    var list = S().publicTenants(d);
    if (!ui.tenant || !list.some(function (t) { return t.id === ui.tenant; })) ui.tenant = list.length ? list[0].id : null;
    return ui.tenant;
  }
  function nav(cur) {
    return '<div class="step">' + Orbis.btn('Toko', 'storeStep', ['shop'], { kind: cur === 'shop' || cur === 'checkout' ? 'primary' : '' }) + Orbis.btn('Lacak pesanan', 'storeGoTrack', null) + '</div>';
  }
  function cartLines(view) {
    var lines = [];
    view.products.forEach(function (p) { var q = ui.cart[p.skuId]; if (q > 0) lines.push({ p: p, qty: Math.min(q, p.available) }); });
    return lines;
  }

  Orbis.screens.store = function (d) {
    var tid = tenantId(d);
    var out = '<div class="phone flat">' + Orbis.pageHead('Toko online', 'Pesan online, ambil di outlet atau kirim ke rumah.');
    if (ui.step === 'done' && ui.done) {
      return out + Orbis.card('Pesanan diterima',
        '<p>Nomor pesanan: <b>' + esc(ui.done.id) + '</b></p><p>Simpan nomor ini dan 4 digit akhir HP Anda untuk melacak pesanan.</p>' +
        Orbis.btn('Lacak pesanan', 'storeGoTrack', [ui.done.id], { kind: 'primary' }) + Orbis.btn('Belanja lagi', 'storeStep', ['shop'])) + '</div>';
    }
    var tenants = S().publicTenants(d);
    out += '<div class="fld"><label for="st-t">Pilih toko</label><select id="st-t" data-change="storeTenant">' + tenants.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === tid ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select></div>' + nav(ui.step);
    var view = tid && S().publicView(d, tid);
    if (!view || !view.published) return out + Orbis.empty('Toko belum tersedia.') + '</div>';
    var lines = cartLines(view);
    var subtotal = Orbis.sum(lines, function (l) { return l.p.price * l.qty; });
    var cart = lines.length ? lines.map(function (l) {
      return '<div class="line"><span>' + esc(l.p.name) + ' x' + esc(l.qty) + '</span><span>' + esc(Orbis.idr(l.p.price * l.qty)) + ' ' + Orbis.btn('-', 'storeDec', [l.p.skuId]) + '</span></div>';
    }).join('') + '<div class="line"><b>Subtotal</b><b>' + esc(Orbis.idr(subtotal)) + '</b></div>' : '<p>Keranjang kosong.</p>';
    if (ui.step === 'checkout') {
      var f = ui.form;
      out += Orbis.card('Checkout', cart + '<div id="st-form">' + Orbis.field('Nama', 'name', f.name) + Orbis.field('No. HP', 'phone', f.phone, { type: 'tel' }) +
        Orbis.field('Metode', 'method', f.method, { type: 'select', options: [['pickup', 'Ambil di outlet'], ['delivery', 'Antar ke alamat']] }) +
        Orbis.field('Alamat (untuk antar)', 'address', f.address) +
        Orbis.field('Pembayaran', 'payment', f.payment, { type: 'select', options: [['cash', 'Tunai saat ambil'], ['cod', 'COD (bayar di tempat)'], ['transfer', 'Transfer']] }) +
        Orbis.field('Kode promo (opsional)', 'promo', f.promo) + '</div>' +
        Orbis.btn('Kembali', 'storeStep', ['shop']) + Orbis.btn('Kirim pesanan', 'storeSubmit', null, { kind: 'primary', disabled: !lines.length }));
      return out + '</div>';
    }
    out += Orbis.renderStorePage(view.page, view.products, view.tenant.name, { cart: true });
    out += Orbis.card('Keranjang', cart + (lines.length ? Orbis.btn('Lanjut checkout', 'storeStep', ['checkout'], { kind: 'primary' }) : ''));
    return out + '</div>';
  };

  Orbis.screens.track = function () {
    var t = ui.track;
    var out = '<div class="phone flat">' + Orbis.pageHead('Lacak pesanan', 'Masukkan nomor pesanan dan nomor HP pemesan.') + nav('track');
    out += '<div id="tr-form">' + Orbis.field('Nomor pesanan', 'id', t.id) + Orbis.field('No. HP (4 digit akhir cukup)', 'phone', t.phone, { type: 'tel' }) + '</div>' + Orbis.btn('Cari', 'trackLookup', null, { kind: 'primary' });
    if (t.error) out += '<div class="banner bad mt" role="alert">' + esc(t.error) + '</div>';
    var r = t.result;
    if (r) {
      out += Orbis.card('Pesanan ' + r.id, '<p>' + Orbis.chip(r.status) + ' ' + Orbis.chip(r.paymentStatus) + (r.deliveryStatus ? ' ' + Orbis.chip(r.deliveryStatus) : '') + '</p>' +
        '<p>Total: <b>' + esc(Orbis.idr(r.total)) + '</b></p><ul>' + r.items.map(function (i) { return '<li>' + esc(i.name) + ' x' + esc(i.qty) + '</li>'; }).join('') + '</ul>' +
        '<h4>Riwayat status</h4>' + (r.history.length ? '<ol>' + r.history.map(function (h) { return '<li>' + esc(Orbis.fmtTime(h.at)) + ' — ' + esc(h.to) + '</li>'; }).join('') + '</ol>' : '<p>Belum ada pembaruan.</p>'));
    }
    return out + '</div>';
  };

  var A = Orbis.actions;
  function keepForm() { if (document.getElementById('st-form')) ui.form = Orbis.readForm('#st-form'); }
  A.storeTenant = function (id) { ui.tenant = id; ui.cart = {}; ui.step = 'shop'; Orbis.render(); };
  A.storeAdd = function (sku) { ui.cart[sku] = (ui.cart[sku] || 0) + 1; Orbis.render(); };
  A.storeDec = function (sku) { ui.cart[sku] = Math.max(0, (ui.cart[sku] || 0) - 1); Orbis.render(); };
  A.storeStep = function (s) { keepForm(); ui.step = s; Orbis.go('store'); };
  A.storeGoTrack = function (id) { if (id) ui.track.id = id; ui.track.error = null; ui.track.result = null; Orbis.go('track'); };
  A.storeSubmit = function () {
    keepForm();
    var f = ui.form, tid = ui.tenant;
    if (!(Orbis.domain.orders && Orbis.domain.orders.place)) { Orbis.toast('Checkout belum tersedia'); return; }
    var items = Object.keys(ui.cart).filter(function (k) { return ui.cart[k] > 0; }).map(function (k) { return { skuId: k, qty: ui.cart[k] }; });
    Orbis.need(items.length, 'VALIDATION', 'Keranjang kosong');
    Orbis.need(String(f.name).trim().length >= 2, 'VALIDATION', 'Nama wajib diisi');
    Orbis.need(/^\d{9,15}$/.test(String(f.phone).replace(/[\s\-+]/g, '')), 'VALIDATION', 'No. HP harus 9-15 digit');
    if (f.method === 'delivery') Orbis.need(String(f.address).trim().length >= 5, 'VALIDATION', 'Alamat wajib untuk pengantaran');
    var order = Orbis.tx(function (d) {
      // Customer picks a store: scope the session to that tenant for this transaction only (client simulation).
      var prev = { tenant: d.session.tenant, outlet: d.session.outlet };
      d.session.tenant = tid;
      d.session.outlet = (d.outlets.filter(function (o) { return o.tenant === tid && o.active; })[0] || {}).id;
      var spec = { channel: 'store', items: items, method: f.method, customer: { name: String(f.name).trim(), phone: String(f.phone).replace(/[\s\-+]/g, '') }, address: f.method === 'delivery' ? f.address : '', payment: { type: f.payment } };
      if (String(f.promo).trim()) spec.promoCode = String(f.promo).trim();
      var placed = Orbis.domain.orders.place(d, spec);
      // Audit must be attributed to the store tenant; restore the visitor scope right after (set via audit callback below).
      d.__restore = prev;
      return placed;
    }, { audit: function (o, d) { var a = { action: 'store.checkout', entity: 'order', entityId: o && o.id, tenant: tid }; if (d.__restore) { d.session.tenant = d.__restore.tenant; d.session.outlet = d.__restore.outlet; delete d.__restore; } return a; } });
    ui.cart = {}; ui.done = { id: order.id }; ui.step = 'done'; ui.form.promo = '';
    ui.track.phone = '';
  };
  A.trackLookup = function () {
    var f = Orbis.readForm('#tr-form');
    ui.track.id = f.id; ui.track.phone = f.phone; ui.track.result = null; ui.track.error = null;
    try { ui.track.result = Orbis.read(function (d) { return S().track(d, f.id, f.phone); }); }
    catch (e) { if (e.name !== 'OrbisError') throw e; ui.track.error = e.message; }
    Orbis.render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
