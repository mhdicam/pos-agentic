/* Orbis v2 — courier PWA screens: 'courier' (tasks) and 'courier-cash' (COD remittance). Mobile first. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, dv = Orbis.domain.delivery;

  var LABEL = { ASSIGNED: 'Tawaran baru', ACCEPTED: 'Siap diambil', PICKED_UP: 'Sudah diambil', IN_TRANSIT: 'Dalam perjalanan', ARRIVED: 'Tiba di tujuan', DELIVERED: 'Terkirim', DELIVERY_FAILED: 'Gagal kirim', RETURN_TO_STORE: 'Kembalikan ke toko', RETURNED: 'Sudah retur' };
  function ord(d, dl) { return Orbis.mine(d, 'orders').filter(function (o) { return o.id === dl.orderId; })[0] || {}; }

  /** Only the next valid action(s) for the state. */
  function actions(dl, now) {
    var a = [], id = dl.id, v = dl.version;
    switch (dl.status) {
      case 'ASSIGNED':
        if (dv.offerExpired(dl, now)) return Orbis.chip('FAILED', 'Tawaran habis');
        return Orbis.btn('Terima', 'crrAccept', [id, v], { kind: 'primary' }) + Orbis.btn('Tolak', 'crrRejectModal', [id, v]);
      case 'ACCEPTED': return Orbis.btn('Pickup', 'crrPickupModal', [id, v], { kind: 'primary' });
      case 'PICKED_UP': return Orbis.btn('Mulai antar', 'crrStart', [id, v], { kind: 'primary' });
      case 'IN_TRANSIT': return Orbis.btn('Tiba di tujuan', 'crrArrive', [id, v], { kind: 'primary' }) + Orbis.btn('Gagal kirim', 'crrFailModal', [id, v], { kind: 'danger' });
      case 'ARRIVED': return Orbis.btn('Selesaikan (POD)', 'crrPodModal', [id, v], { kind: 'primary' }) + Orbis.btn('Gagal kirim', 'crrFailModal', [id, v], { kind: 'danger' });
      case 'RETURN_TO_STORE': return dl.returnHandoffAt ? Orbis.chip('APPROVED', 'Sudah diserahkan') : Orbis.btn('Serahkan ke toko', 'crrHandoff', [id, v], { kind: 'primary' });
    }
    return a.join('');
  }

  function locationCard(d) {
    var c = dv.myCourier(d), now = Orbis.clock.now();
    if (!c) return '';
    var on = !!c.location;
    var txt = on ? (dv.isStale(c, now) ? 'Lokasi kedaluwarsa (lebih dari 5 menit)' : 'Lokasi aktif, hanya saat aplikasi terbuka') : 'Lokasi mati';
    return Orbis.card('Lokasi (foreground)', '<p>' + Orbis.chip(on && !dv.isStale(c, now) ? 'ONLINE' : 'OFFLINE', on && !dv.isStale(c, now) ? 'Aktif' : 'Mati') + ' ' + esc(txt) + '</p>' +
      '<p class="fine">Lokasi dipakai hanya untuk navigasi saat aplikasi terbuka dan atas persetujuan Anda. Tidak ada pelacakan latar belakang.</p>' +
      (on ? Orbis.btn('Matikan lokasi', 'crrLocOff', []) + Orbis.btn('Perbarui', 'crrLocOn', []) : Orbis.btn('Izinkan & bagikan lokasi', 'crrLocOn', [], { kind: 'primary' })));
  }

  Orbis.screens.courier = function (d) {
    var c = dv.myCourier(d), now = Orbis.clock.now();
    if (!c) return Orbis.pageHead('Tugas Saya') + Orbis.empty('Profil kurir tidak ditemukan untuk sesi ini.');
    var tasks = dv.myTasks(d).filter(function (x) { return x.status !== 'CANCELLED' && x.status !== 'RETURNED' && x.status !== 'DELIVERED' && x.status !== 'READY_FOR_ASSIGNMENT' && x.status !== 'RETRY_PENDING'; });
    var cards = tasks.map(function (x) {
      var o = ord(d, x);
      return '<section class="card"><div class="card-b"><p><b>' + esc(x.id) + '</b> ' + Orbis.chip(x.status, LABEL[x.status]) + (dv.deliveryOverdue(x, now) ? ' ' + Orbis.chip('FAILED', 'Lewat target') : '') + '</p>' +
        '<p>' + esc((o.customer || {}).name || '-') + '<br><small>' + esc(o.address || '-') + '</small></p>' +
        '<p>' + (x.codAmount ? Orbis.chip('COLLECTION_PENDING', 'COD ' + Orbis.idr(x.codAmount)) : Orbis.chip('PAID', 'Sudah dibayar')) + (x.dueAt ? ' <small>Target ' + esc(Orbis.fmtTime(x.dueAt)) + '</small>' : '') + '</p>' +
        '<div class="actions">' + actions(x, now) + '</div></div></section>';
    }).join('');
    return Orbis.pageHead('Tugas Saya', c.name + ' · ' + tasks.length + ' tugas aktif') + locationCard(d) + (cards || Orbis.empty('Belum ada tugas.'));
  };

  Orbis.screens['courier-cash'] = function (d) {
    var c = dv.myCourier(d);
    if (!c) return Orbis.pageHead('Setoran COD') + Orbis.empty('Profil kurir tidak ditemukan untuk sesi ini.');
    var due = dv.cashDue(d, c.id);
    var total = Orbis.sum(due, function (r) { return r.outstanding; });
    var rows = Orbis.table([
      { label: 'Pengiriman', fmt: function (r) { return '<b>' + esc(r.delivery.id) + '</b><br><small>' + esc(r.delivery.orderId) + '</small>'; } },
      { label: 'Wajib setor', right: true, fmt: function (r) { return esc(Orbis.idr(r.outstanding)); } },
      { label: 'Menunggu verifikasi', right: true, fmt: function (r) { return esc(Orbis.idr(r.pending)); } },
      { label: 'Aksi', fmt: function (r) { return r.submittable > 0 ? Orbis.btn('Setor', 'crrRemitModal', [r.delivery.id, r.submittable], { kind: 'primary' }) : Orbis.chip('SUBMITTED', 'Menunggu'); } }
    ], due.filter(function (r) { return r.outstanding > 0; }), 'Tidak ada uang COD yang perlu disetor.');
    var hist = Orbis.table([
      { label: 'Setoran', fmt: function (r) { return esc(r.id) + '<br><small>' + esc(r.deliveryId) + '</small>'; } },
      { label: 'Nominal', right: true, fmt: function (r) { return esc(Orbis.idr(r.amount)); } },
      { label: 'Status', fmt: function (r) { return Orbis.chip(r.status) + (r.reason ? '<br><small>' + esc(r.reason) + '</small>' : ''); } }
    ], dv.remittances(d).filter(function (r) { return r.courierId === c.id; }), 'Belum ada setoran.');
    return Orbis.pageHead('Setoran COD', 'Uang tunai yang harus disetor ke toko.') + Orbis.stat('Total belum terverifikasi', Orbis.idr(total)) + Orbis.card('Perlu disetor', rows) + Orbis.card('Riwayat setoran', hist);
  };

  var A = Orbis.actions;
  A.crrAccept = function (id, v) { dv.accept(id, v); Orbis.toast('Tugas diterima'); };
  A.crrRejectModal = function (id, v) { Orbis.modal('Tolak tugas', Orbis.field('Alasan (min. 5 karakter)', 'reason', ''), Orbis.btn('Tolak tugas', 'crrReject', [id, v], { kind: 'danger' })); };
  A.crrReject = function (id, v) { dv.reject(id, Orbis.formData().reason, v); Orbis.closeModal(); Orbis.toast('Tugas ditolak'); };
  A.crrPickupModal = function (id, v) {
    Orbis.modal('Checklist pickup',
      Orbis.field('Jumlah & jenis item sesuai', 'items', false, { type: 'checkbox' }) + Orbis.field('Kemasan rapi dan tersegel', 'packaging', false, { type: 'checkbox' }) +
      Orbis.field('Label / nomor pesanan cocok', 'label', false, { type: 'checkbox' }) + Orbis.field('Alamat tujuan jelas', 'address', false, { type: 'checkbox' }),
      Orbis.btn('Konfirmasi pickup', 'crrPickup', [id, v], { kind: 'primary' }));
  };
  A.crrPickup = function (id, v) {
    var f = Orbis.formData();
    dv.pickup(id, { items: f.items === true, packaging: f.packaging === true, label: f.label === true, address: f.address === true }, v);
    Orbis.closeModal(); Orbis.toast('Pickup dicatat');
  };
  A.crrStart = function (id, v) { dv.start(id, v); Orbis.toast('Perjalanan dimulai'); };
  A.crrArrive = function (id, v) { dv.arrive(id, v); Orbis.toast('Tiba di tujuan'); };
  A.crrFailModal = function (id, v) { Orbis.modal('Gagal kirim', Orbis.field('Alasan (min. 5 karakter)', 'reason', ''), Orbis.btn('Catat gagal kirim', 'crrFail', [id, v], { kind: 'danger' })); };
  A.crrFail = function (id, v) { dv.fail(id, Orbis.formData().reason, v); Orbis.closeModal(); Orbis.toast('Gagal kirim dicatat'); };
  A.crrPodModal = function (id, v) {
    var d = Orbis.db(), dl = dv.get(d, id);
    var cod = dl ? dl.codAmount : 0;
    Orbis.modal('Bukti pengiriman (POD)',
      Orbis.field('Nama penerima', 'receiver', '') +
      Orbis.field('Metode', 'method', 'otp', { type: 'select', options: [['otp', 'Kode OTP'], ['photo', 'Foto (jpg/png, maks 3 MB)'], ['signature', 'Tanda tangan (ketik nama)']] }) +
      Orbis.field('Kode OTP', 'otp', '', { hint: 'Demo: 4826' }) +
      '<div class="fld"><label for="f-photo">Foto</label><input id="f-photo" type="file" name="photo" accept="image/jpeg,image/png"></div>' +
      Orbis.field('Tanda tangan', 'signature', '') +
      (cod ? Orbis.field('Uang COD diterima (Rp)', 'codAmount', '', { type: 'number', hint: 'Harus tepat ' + Orbis.idr(cod) }) : ''),
      Orbis.btn('Selesaikan pengiriman', 'crrPod', [id, v], { kind: 'primary' }));
  };
  A.crrPod = function (id, v) {
    var f = Orbis.formData(), el = document.getElementById('f-photo'), file = el && el.files && el.files[0];
    var spec = { receiver: f.receiver, method: f.method, otp: f.otp, signature: f.signature, photo: file ? { name: file.name, size: file.size } : null };
    if (f.codAmount !== undefined && f.codAmount !== '') spec.codAmount = Number(f.codAmount);
    else if (f.codAmount === '') spec.codAmount = NaN;   // forces a validation error instead of silently skipping COD
    dv.pod(id, spec, v);
    Orbis.closeModal(); Orbis.toast('Pengiriman selesai');
  };
  A.crrHandoff = function (id, v) { dv.returnHandoff(id, v); Orbis.toast('Barang diserahkan ke toko'); };
  A.crrLocOn = function () {
    if (!g.navigator || !g.navigator.geolocation) {   // demo fallback: fixed coordinates, consent still explicit via this click
      dv.setLocation({ lat: -6.2297, lng: 106.8076, consent: true }); Orbis.toast('Lokasi demo dibagikan'); return;
    }
    g.navigator.geolocation.getCurrentPosition(function (p) {
      Orbis.attempt(function () { dv.setLocation({ lat: p.coords.latitude, lng: p.coords.longitude, consent: true }); Orbis.toast('Lokasi dibagikan'); });
    }, function () { Orbis.toast('Izin lokasi ditolak', true); }, { maximumAge: 0, timeout: 8000 });
  };
  A.crrLocOff = function () { dv.clearLocation(); Orbis.toast('Lokasi dimatikan'); };
  A.crrRemitModal = function (id, max) {
    Orbis.modal('Setor uang COD', Orbis.field('Nominal setoran (Rp)', 'amount', max, { type: 'number', min: 1, hint: 'Maksimal ' + Orbis.idr(max) }), Orbis.btn('Kirim setoran', 'crrRemit', [id], { kind: 'primary' }));
  };
  A.crrRemit = function (id) { dv.submitRemittance(id, Number(Orbis.formData().amount)); Orbis.closeModal(); Orbis.toast('Setoran dikirim, menunggu verifikasi'); };
})(typeof window !== 'undefined' ? window : globalThis);
