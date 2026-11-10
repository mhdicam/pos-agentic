/* Orbis v2 — dispatch screen (route 'dispatch'). Pure render; handlers call Orbis.domain.delivery. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, dv = Orbis.domain.delivery;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.dispatch = Orbis.ui.dispatch || { tab: 'queue' };

  var STATE_LABEL = {
    READY_FOR_ASSIGNMENT: 'Menunggu kurir', ASSIGNED: 'Ditawarkan', ACCEPTED: 'Diterima', PICKED_UP: 'Dipickup', IN_TRANSIT: 'Dalam perjalanan',
    ARRIVED: 'Tiba', DELIVERED: 'Terkirim', DELIVERY_FAILED: 'Gagal kirim', RETRY_PENDING: 'Menunggu ulang', RETURN_TO_STORE: 'Kembali ke toko', RETURNED: 'Sudah retur', CANCELLED: 'Dibatalkan'
  };
  function stChip(s) { return Orbis.chip(s, STATE_LABEL[s] || s); }
  function ordOf(d, dl) { return Orbis.mine(d, 'orders').filter(function (o) { return o.id === dl.orderId; })[0] || {}; }
  function courierName(d, id) { var c = Orbis.mine(d, 'couriers').filter(function (x) { return x.id === id; })[0]; return c ? c.name : '-'; }
  function slaChips(dl, now) {
    var h = '';
    if (dv.assignmentOverdue(dl, now)) h += Orbis.chip('FAILED', 'Telat ditugaskan');
    if (dv.deliveryOverdue(dl, now)) h += ' ' + Orbis.chip('FAILED', 'Lewat target antar');
    if (dl.status === 'ASSIGNED') h += ' ' + (dv.offerExpired(dl, now) ? Orbis.chip('FAILED', 'Tawaran habis') : Orbis.chip('PENDING', 'Tawaran sampai ' + Orbis.fmtTime(dl.offerExpiresAt)));
    return h;
  }
  function dlHead(d, dl) {
    var o = ordOf(d, dl);
    return '<b>' + esc(dl.id) + '</b> <span class="muted">' + esc(dl.orderId) + '</span><br><small>' + esc((o.customer || {}).name || '-') + ' · ' + esc(o.address || '-') + '</small>';
  }
  function can(perm) { return Orbis.can(perm); }

  function boardTab(d) {
    var list = dv.list(d), cols = ['READY_FOR_ASSIGNMENT', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'DELIVERY_FAILED', 'RETURN_TO_STORE'];
    return '<div class="grid">' + cols.map(function (s) {
      var rows = list.filter(function (x) { return x.status === s; });
      return Orbis.card(STATE_LABEL[s] + ' (' + rows.length + ')', rows.length ? rows.map(function (x) {
        return '<p>' + dlHead(d, x) + '<br>' + esc(x.courierId ? courierName(d, x.courierId) : 'Belum ada kurir') + '</p>';
      }).join('') : '<p class="muted">Kosong</p>');
    }).join('') + '</div>';
  }

  function queueTab(d) {
    var rows = dv.list(d).filter(function (x) { return x.status === 'READY_FOR_ASSIGNMENT' || x.status === 'ASSIGNED' || x.status === 'ACCEPTED' || x.status === 'RETRY_PENDING'; });
    var now = Orbis.clock.now();
    return Orbis.table([
      { label: 'Pengiriman', fmt: function (x) { return dlHead(d, x); } },
      { label: 'Status', fmt: function (x) { return stChip(x.status) + ' ' + slaChips(x, now); } },
      { label: 'Kurir', fmt: function (x) { return esc(x.courierId ? courierName(d, x.courierId) : '-'); } },
      { label: 'COD', right: true, fmt: function (x) { return x.codAmount ? esc(Orbis.idr(x.codAmount)) : '-'; } },
      { label: 'Aksi', fmt: function (x) {
        if (!can('delivery.dispatch')) return '';
        var a = '';
        if (x.status === 'READY_FOR_ASSIGNMENT' || x.status === 'ASSIGNED' && dv.offerExpired(x, now)) a += Orbis.btn('Tugaskan', 'dlvAssignModal', [x.id, x.version, false], { kind: 'primary' });
        if (x.status === 'ASSIGNED' || x.status === 'ACCEPTED') a += Orbis.btn('Reassign', 'dlvAssignModal', [x.id, x.version, true]);
        if (x.status === 'READY_FOR_ASSIGNMENT' || x.status === 'ASSIGNED' || x.status === 'ACCEPTED') a += Orbis.btn('Batalkan', 'dlvCancelModal', [x.id, x.version], { kind: 'ghost' });
        return a;
      } }
    ], rows, 'Tidak ada pengiriman di antrean.');
  }

  function trackTab(d) {
    var rows = dv.list(d).filter(function (x) { return dv.ACTIVE.indexOf(x.status) >= 0; }), now = Orbis.clock.now();
    return Orbis.table([
      { label: 'Pengiriman', fmt: function (x) { return dlHead(d, x); } },
      { label: 'Status', fmt: function (x) { return stChip(x.status) + ' ' + slaChips(x, now); } },
      { label: 'Kurir', fmt: function (x) {
        var c = Orbis.mine(d, 'couriers').filter(function (k) { return k.id === x.courierId; })[0];
        return esc(c ? c.name : '-') + (c ? '<br><small>' + (dv.isStale(c, now) ? 'Lokasi tidak aktif / kedaluwarsa' : 'Lokasi ' + esc(Orbis.fmtTime(c.location.at))) + '</small>' : '');
      } },
      { label: 'Target', fmt: function (x) { return esc(x.dueAt ? Orbis.fmtTime(x.dueAt) : '-'); } }
    ], rows, 'Tidak ada pengiriman aktif.');
  }

  function exceptionsTab(d) {
    var rows = dv.list(d).filter(function (x) { return x.status === 'DELIVERY_FAILED' || x.status === 'RETURN_TO_STORE'; });
    return Orbis.table([
      { label: 'Pengiriman', fmt: function (x) { return dlHead(d, x); } },
      { label: 'Status', fmt: function (x) { return stChip(x.status) + (x.status === 'RETURN_TO_STORE' ? ' ' + Orbis.chip(x.returnHandoffAt ? 'APPROVED' : 'PENDING', x.returnHandoffAt ? 'Sudah diserahkan' : 'Belum diserahkan') : ''); } },
      { label: 'Percobaan', fmt: function (x) { return esc(x.attempts + '/' + dv.MAX_ATTEMPTS) + '<br><small>' + esc(x.failReason || '') + '</small>'; } },
      { label: 'Aksi', fmt: function (x) {
        if (!can('delivery.dispatch')) return '';
        if (x.status === 'DELIVERY_FAILED') return Orbis.btn('Coba lagi', 'dlvRetry', [x.id, x.version], { disabled: x.attempts >= dv.MAX_ATTEMPTS, title: x.attempts >= dv.MAX_ATTEMPTS ? 'Batas percobaan tercapai' : '' }) + Orbis.btn('Retur ke toko', 'dlvReturn', [x.id, x.version], { kind: 'danger' });
        return Orbis.btn('Check-in retur', 'dlvCheckinModal', [x.id, x.version], { kind: 'primary', disabled: !x.returnHandoffAt, title: x.returnHandoffAt ? '' : 'Kurir belum menyerahkan barang' });
      } }
    ], rows, 'Tidak ada pengecualian.');
  }

  function podTab(d) {
    var rows = dv.list(d).filter(function (x) { return x.status === 'DELIVERED' && x.proofReview; });
    return Orbis.table([
      { label: 'Pengiriman', fmt: function (x) { return dlHead(d, x); } },
      { label: 'Bukti', fmt: function (x) { return esc(x.pod.method) + ' · ' + esc(x.pod.receiver) + (x.pod.proof.filename ? '<br><small>' + esc(x.pod.proof.filename) + ' (' + esc(Math.round(x.pod.proof.size / 1024)) + ' KB)</small>' : ''); } },
      { label: 'COD', right: true, fmt: function (x) { return x.pod.codCollected ? esc(Orbis.idr(x.pod.codCollected)) : '-'; } },
      { label: 'Tinjauan', fmt: function (x) { return Orbis.chip(x.proofReview.status) + (x.proofReview.reason ? '<br><small>' + esc(x.proofReview.reason) + '</small>' : ''); } },
      { label: 'Aksi', fmt: function (x) {
        if (x.proofReview.status !== 'PENDING' || !can('cod.review')) return '';
        return Orbis.btn('Setujui', 'dlvProofApprove', [x.id], { kind: 'primary' }) + Orbis.btn('Flag', 'dlvProofFlagModal', [x.id], { kind: 'danger' });
      } }
    ], rows, 'Belum ada bukti pengiriman.');
  }

  function fleetTab(d) {
    var now = Orbis.clock.now();
    return Orbis.table([
      { label: 'Kurir', fmt: function (c) { return '<b>' + esc(c.name) + '</b><br><small>' + esc(c.phone) + '</small>'; } },
      { label: 'Status', fmt: function (c) { return Orbis.chip(c.status); } },
      { label: 'Tugas aktif', fmt: function (c) { return esc(dv.activeCount(d, c.id) + '/' + (c.maxActive || 3)); } },
      { label: 'Lokasi', fmt: function (c) { return c.location ? (dv.isStale(c, now) ? Orbis.chip('OFFLINE', 'Kedaluwarsa') : Orbis.chip('ONLINE', 'Aktif')) : Orbis.chip('OFFLINE', 'Tanpa izin'); } }
    ], dv.couriers(d), 'Belum ada kurir.');
  }

  Orbis.screens.dispatch = function (d) {
    var list = dv.list(d);
    var tabs = [['queue', 'Antrean'], ['board', 'Papan'], ['track', 'Pelacakan'], ['exc', 'Pengecualian'], ['pod', 'Review POD'], ['fleet', 'Armada']];
    var body = { queue: queueTab, board: boardTab, track: trackTab, exc: exceptionsTab, pod: podTab, fleet: fleetTab }[ui.tab] || queueTab;
    var now = Orbis.clock.now();
    var stats = '<div class="grid">' +
      Orbis.stat('Menunggu kurir', list.filter(function (x) { return x.status === 'READY_FOR_ASSIGNMENT'; }).length) +
      Orbis.stat('Aktif', list.filter(function (x) { return dv.ACTIVE.indexOf(x.status) >= 0; }).length) +
      Orbis.stat('Telat', list.filter(function (x) { return dv.assignmentOverdue(x, now) || dv.deliveryOverdue(x, now); }).length) +
      Orbis.stat('Pengecualian', list.filter(function (x) { return x.status === 'DELIVERY_FAILED' || x.status === 'RETURN_TO_STORE'; }).length) + '</div>';
    return Orbis.pageHead('Dispatch', 'Tugaskan kurir, pantau SLA, tangani retur.') + stats + Orbis.tabs(tabs, ui.tab, 'dlvTab') + body(d);
  };

  var A = Orbis.actions;
  A.dlvTab = function (t) { ui.tab = t; Orbis.render(); };

  A.dlvAssignModal = function (id, version, isReassign) {
    var d = Orbis.db(), dl = dv.get(d, id);
    Orbis.need(dl, 'NOT_FOUND', 'Pengiriman tidak ditemukan');
    var rows = dv.couriers(d).map(function (c) {
      var bad = c.id === dl.courierId ? { msg: 'Sedang memegang tugas ini' } : dv.eligibility(d, c, dl);
      return '<div class="row"><b>' + esc(c.name) + '</b> ' + Orbis.chip(c.status) + ' <small>' + esc(dv.activeCount(d, c.id) + '/' + (c.maxActive || 3)) + ' aktif</small> ' +
        (bad ? '<small class="muted">Tidak memenuhi syarat: ' + esc(bad.msg) + '</small>' : Orbis.btn('Pilih', 'dlvAssign', [id, c.id, version, !!isReassign], { kind: 'primary' })) + '</div>';
    }).join('');
    Orbis.modal(isReassign ? 'Reassign kurir' : 'Tugaskan kurir',
      (isReassign ? Orbis.field('Alasan reassign (min. 5 karakter)', 'reason', '') : '') + '<div class="list">' + (rows || Orbis.empty('Tidak ada kurir.')) + '</div>');
  };
  A.dlvAssign = function (id, courierId, version, isReassign) {
    if (isReassign) { dv.reassign(id, courierId, Orbis.formData().reason, version); }
    else dv.assign(id, courierId, version);
    Orbis.closeModal(); Orbis.toast('Kurir ditugaskan');
  };
  A.dlvCancelModal = function (id, version) {
    Orbis.modal('Batalkan pengiriman', Orbis.field('Alasan (min. 5 karakter)', 'reason', ''), Orbis.btn('Batalkan pengiriman', 'dlvCancel', [id, version], { kind: 'danger' }));
  };
  A.dlvCancel = function (id, version) { dv.cancel(id, Orbis.formData().reason, version); Orbis.closeModal(); Orbis.toast('Pengiriman dibatalkan'); };
  A.dlvRetry = function (id, version) { dv.retry(id, version); Orbis.toast('Masuk antrean ulang'); };
  A.dlvReturn = function (id, version) { dv.returnToStore(id, version); Orbis.toast('Dikembalikan ke toko'); };
  A.dlvCheckinModal = function (id, version) {
    Orbis.modal('Check-in barang retur',
      Orbis.field('Kondisi barang', 'condition', 'SELLABLE', { type: 'select', options: [['SELLABLE', 'Layak jual (stok dikembalikan)'], ['DAMAGED', 'Rusak (tanpa stok)'], ['QUARANTINE', 'Karantina (tanpa stok)']] }),
      Orbis.btn('Simpan check-in', 'dlvCheckin', [id, version], { kind: 'primary' }));
  };
  A.dlvCheckin = function (id, version) { dv.returnCheckin(id, Orbis.formData().condition, version); Orbis.closeModal(); Orbis.toast('Check-in retur selesai'); };
  A.dlvProofApprove = function (id) { dv.reviewProof(id, 'APPROVED'); Orbis.toast('Bukti disetujui'); };
  A.dlvProofFlagModal = function (id) {
    Orbis.modal('Flag bukti pengiriman', Orbis.field('Alasan (min. 5 karakter)', 'reason', ''), Orbis.btn('Flag bukti', 'dlvProofFlag', [id], { kind: 'danger' }));
  };
  A.dlvProofFlag = function (id) { dv.reviewProof(id, 'FLAGGED', Orbis.formData().reason); Orbis.closeModal(); Orbis.toast('Bukti di-flag'); };
})(typeof window !== 'undefined' ? window : globalThis);
