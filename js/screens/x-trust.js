/* Orbis v2 — RD-17 W1 screens: "Sinkron Offline" (route `sync`) for owner/manager, and "Void penjualan" on the order detail. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions, TR = function () { return Orbis.domain.trust; }, F = function () { return Orbis.domain.fleet; };
  Orbis.addNav('owner', 'Penjualan', ['sync', 'Sinkron Offline', 'device'], 'orders');
  Orbis.addNav('manager', 'Operasional', ['sync', 'Sinkron Offline', 'device'], 'orders');

  function ago(ms) {
    if (!ms) return '-';
    var m = Math.max(0, Math.round((Orbis.clock.now() - ms) / 60000));
    return m < 1 ? 'baru saja' : m < 60 ? m + ' menit lalu' : m < 1440 ? Math.floor(m / 60) + ' jam lalu' : Math.floor(m / 1440) + ' hari lalu';
  }
  function payloadText(d, p) {
    return (p.items || []).map(function (i) {
      var s = Orbis.mine(d, 'skus').filter(function (x) { return x.id === i.skuId; })[0];
      var pr = s && d.products.filter(function (x) { return x.id === s.productId; })[0];
      return i.qty + ' x ' + (pr ? pr.name : i.skuId + ' (tidak dikenal)');
    }).join(', ');
  }

  Orbis.screens.sync = function (d) {
    if (!Orbis.can('sync.read')) return Orbis.empty('Peran ini tidak bisa melihat status sinkron.');
    var ds = TR().devices(d), cs = TR().conflicts(d), canFix = Orbis.can('fleet.resolve');
    var pend = Orbis.sum(ds, function (x) { return x.pending; }), stale = ds.filter(function (x) { return x.stale; }).length;
    var kpi = '<div class="grid g4">' + Orbis.stat('Perangkat', String(ds.length), ds.filter(function (x) { return x.status === 'ACTIVE' && !x.expired; }).length + ' aktif') +
      Orbis.stat('Menunggu sinkron', String(pend), 'belum dihitung lunas di server') + Orbis.stat('Konflik', String(cs.length), 'perlu keputusan') +
      Orbis.stat('Terlambat > 15 mnt', String(stale), 'perangkat') + '</div>';
    var devs = Orbis.card('Perangkat kasir', Orbis.table([
      { label: 'Perangkat', fmt: function (x) { return '<b>' + esc(x.name) + '</b><br><small>' + esc(x.id + ' · ' + x.outletName) + '</small>'; } },
      { label: 'Status', fmt: function (x) { return x.status === 'REVOKED' ? Orbis.chip('REVOKED', 'Dicabut') : x.expired ? Orbis.chip('FAILED', 'Grant habis') : x.stale ? Orbis.chip('FAILED', 'Terlambat') : x.pending ? Orbis.chip('PENDING_SYNC', 'Menunggu') : Orbis.chip('ACTIVE', 'Tersinkron'); } },
      { label: 'Menunggu', right: true, fmt: function (x) { return esc(x.pending) + (x.oldestPendingAt ? '<br><small>tertua ' + esc(ago(x.oldestPendingAt)) + '</small>' : ''); } },
      { label: 'Konflik', right: true, fmt: function (x) { return x.conflicts ? '<b class="t-bad">' + esc(x.conflicts) + '</b>' : '0'; } },
      { label: 'Sinkron terakhir', fmt: function (x) { return esc(ago(x.lastSyncAt)); } },
      { label: '', right: true, fmt: function (x) { return x.pending && x.status !== 'REVOKED' && Orbis.can('fleet.operate') ? Orbis.btn('Sinkronkan', 'trSync', [x.id], { kind: 'sm' }) : ''; } }
    ], ds, 'Belum ada perangkat kasir offline.').replace('class="tbl"', 'class="tbl stack"'));
    var conf = Orbis.card('Konflik sinkron', cs.length ? '<ul class="list">' + cs.map(function (x) {
      return '<li><div><b>' + esc(x.clientEventId) + '</b> · <small>' + esc(x.deviceId) + ' · ' + esc(Orbis.fmtTime(x.createdAt)) + '</small><br>' +
        '<small>Isi: ' + esc(payloadText(d, x.payload)) + ' · tunai</small><br><span class="t-bad">' + esc(x.reason || x.reasonCode || 'Ditolak server') + '</span></div>' +
        (canFix ? '<div class="actions">' + Orbis.btn('Coba lagi', 'trResolve', [x.id, 'RETRY'], { kind: 'sm' }) + Orbis.btn('Abaikan (simpan arsip)', 'trResolve', [x.id, 'DISCARD'], { kind: 'sm' }) + '</div>' : '') + '</li>';
    }).join('') + '</ul><p class="fine mt">Transaksi konflik tidak pernah dihapus: "Abaikan" menyimpan payload asli sebagai arsip dengan alasan Anda.</p>' : Orbis.empty('Tidak ada konflik. Semua transaksi offline diterima server.'));
    return Orbis.pageHead('Sinkron Offline', 'Status antrean transaksi offline per perangkat. Transaksi menunggu belum dihitung lunas sampai diterima server.') +
      (stale ? '<div class="banner bad">' + esc(stale) + ' perangkat belum sinkron lebih dari 15 menit. Pastikan perangkat online.</div>' : '') + kpi + '<div class="mt">' + devs + conf + '</div>';
  };

  A.trSync = function (id) { var r = F().sync(id); Orbis.toast(r.synced + ' tersinkron' + (r.conflicts ? ', ' + r.conflicts + ' konflik' : '')); };
  A.trResolve = function (id, mode) {
    Orbis.modal(mode === 'RETRY' ? 'Coba sinkron lagi' : 'Abaikan transaksi', '<input type="hidden" name="id" value="' + esc(id) + '"><input type="hidden" name="mode" value="' + esc(mode) + '">' +
      Orbis.field('Alasan (min. 5 karakter)', 'reason', '', { hint: mode === 'RETRY' ? 'Item kembali ke antrean dan dikirim ulang saat sinkron berikutnya.' : 'Item tidak diproses, tetapi payload asli tetap tersimpan untuk audit.' }),
      Orbis.btn('Batal', 'closeModal') + Orbis.btn('Simpan', 'trResolveGo', null, { kind: 'primary' }));
  };
  A.trResolveGo = function () { var f = Orbis.formData(); F().resolve(f.id, f.mode, f.reason); Orbis.closeModal(); Orbis.toast(f.mode === 'RETRY' ? 'Dikembalikan ke antrean' : 'Disimpan sebagai arsip'); };

  /* ---------- G9: void from the order detail ---------- */
  function needsPin(d) {
    var T = Orbis.domain.team;
    return !Orbis.can('order.void') && T && T.mode(d, d.session.role, 'order.void') === 'approval';
  }
  function canVoid(d, o) {
    return o && !o.voided && ['PAID', 'PARTIALLY_REFUNDED', 'COD_COLLECTED'].indexOf(o.paymentStatus) >= 0 && ['CANCELLED', 'RETURNED'].indexOf(o.status) < 0 && (Orbis.can('order.void') || needsPin(d));
  }
  var baseDetail = A.orderDetail;
  A.orderDetail = function (id) {
    baseDetail(id);
    var d = Orbis.db(), o = Orbis.domain.orders.get(d, id), foot = g.document && g.document.querySelector('#modal-root .mdl');
    if (!foot) return;
    if (o && o.voided) {
      var b = g.document.createElement('div'); b.className = 'banner bad';
      b.textContent = 'VOID ' + Orbis.idr(o.voided.amount) + ' oleh ' + o.voided.by + ': ' + o.voided.reason + (o.voided.originalShiftClosed ? ' (shift asal sudah tutup; dibukukan ke shift ' + o.voided.postedShiftId + ')' : '');
      var body = foot.querySelector('.mdl-b'); if (body) body.insertBefore(b, body.firstChild);
    }
    if (!canVoid(d, o)) return;
    var f = foot.querySelector('.mdl-f');
    if (!f) { f = g.document.createElement('footer'); f.className = 'mdl-f'; foot.appendChild(f); }
    f.insertAdjacentHTML('afterbegin', Orbis.btn('Void penjualan', 'trVoid', [id], { kind: 'danger', icon: 'undo' }));
  };
  A.trVoid = function (id) {
    var d = Orbis.db(), pv = TR().voidPreview(d, id), o = pv.order;
    var sh = Orbis.mine(d, 'shifts').filter(function (s) { return s.id === o.shiftId; })[0];
    var body = '<input type="hidden" name="id" value="' + esc(id) + '">' +
      '<p>Void membatalkan penjualan yang sudah dibayar: uang dikembalikan per metode, stok dikembalikan, poin member dibalik. Pesanan asli tidak diubah, hanya ditandai VOID.</p>' +
      pv.money.map(function (l) { return '<div class="line"><span>Kembalikan ' + esc(l.type.toUpperCase()) + '</span><b>' + esc(Orbis.idr(l.amount)) + '</b></div>'; }).join('') +
      pv.lines.map(function (r) { return '<div class="line"><span>Stok kembali: ' + esc(r.remaining) + ' x ' + esc(r.name) + '</span></div>'; }).join('') +
      (sh && sh.closedAt ? '<div class="banner">Shift asal ' + esc(sh.id) + ' sudah ditutup. Uang tunai dikeluarkan dari laci shift yang sedang buka; shift lama tidak diubah.</div>' : '') +
      Orbis.field('Alasan void (min. 5 karakter)', 'reason', '') +
      (needsPin(d) ? Orbis.field('PIN manajer', 'mgrPin', '', { type: 'password', hint: 'Aksi ini perlu persetujuan manajer.' }) : '');
    Orbis.modal('Void ' + id, body, Orbis.btn('Batal', 'closeModal') + Orbis.btn('Void ' + Orbis.idr(pv.amount), 'trVoidGo', null, { kind: 'danger' }));
  };
  A.trVoidGo = function () {
    var f = Orbis.formData(), d = Orbis.db(), T = Orbis.domain.team;
    var run = function () { return TR().voidSale(f.id, f.reason); };
    var o = needsPin(d) ? (Orbis.need(f.mgrPin, 'APPROVAL_REQUIRED', 'Masukkan PIN manajer'), T.withApproval(f.mgrPin, 'order.void', run)) : run();
    Orbis.closeModal(); Orbis.toast('Penjualan ' + o.id + ' di-void (' + Orbis.idr(o.voided.amount) + ')');
  };
})(typeof window !== 'undefined' ? window : globalThis);
