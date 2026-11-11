/* Orbis v2 — tenant back-office screens: team (staff profile + PIN), roles matrix, attendance, blind close, shift history.
   Overrides Orbis.screens.team and the POS shift actions by assignment (loads after base + x-catalog screens). RD-14. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions, T = Orbis.domain.team;
  Orbis.ui = Orbis.ui || {};
  var U = Orbis.ui.team = Orbis.ui.team || { role: 'cashier', from: '', to: '', outlet: '', staffId: '', closeDraft: null };
  var MODE_LABEL = { allow: 'Diizinkan', deny: 'Ditolak', approval: 'Perlu PIN manajer' };
  var DEMO_PINS = 'PIN demo: Rina 1111, Dewa 2222, Sari 3333, Bima 4444 (setelah "Isi data demo": Putri 5555, Wawan 6666).';

  Orbis.addNav('owner', 'Pengaturan', ['roles', 'Peran & Izin', 'shield'], 'team');
  Orbis.addNav('owner', 'Pengaturan', ['attendance', 'Absensi', 'users'], 'team');
  Orbis.addNav('owner', 'Keuangan', ['shifts', 'Riwayat Shift', 'cash']);
  Orbis.addNav('manager', 'Pengiriman & Keuangan', ['shifts', 'Riwayat Shift', 'cash']);
  Orbis.addNav('manager', 'Operasional', ['attendance', 'Absensi', 'users']);
  Orbis.addNav('finance', 'Keuangan', ['shifts', 'Riwayat Shift', 'cash']);
  Orbis.addNav('cashier', 'Kasir', ['attendance', 'Absensi', 'users']);

  function outletName(d, id) { return (Orbis.mine(d, 'outlets').filter(function (o) { return o.id === id; })[0] || {}).name || id; }
  function dur(ms) { var m = Math.round(ms / 60000); return Math.floor(m / 60) + 'j ' + (m % 60) + 'm'; }
  function pinChip(s) { return s.pinLocked ? Orbis.chip('FLAGGED', 'Terkunci') : s.pinHash ? Orbis.chip('ACTIVE', 'Diatur') : Orbis.chip('PENDING', 'Belum'); }

  /* ---------- Tim & Outlet (staff profile, PIN) ---------- */
  Orbis.screens.team = function (d) {
    var staff = Orbis.mine(d, 'staff'), outlets = Orbis.mine(d, 'outlets'), owner = Orbis.can('team.write');
    return Orbis.pageHead('Tim & Outlet', 'Kelola staf, PIN pribadi, dan outlet.', owner ? Orbis.btn('Tambah staf', 'teamStaffEdit', [null], { kind: 'primary', icon: 'plus' }) + Orbis.btn('Tambah outlet', 'outletForm', null, { icon: 'plus' }) : '') +
      '<p class="muted xt-hint">' + esc(DEMO_PINS) + '</p>' +
      Orbis.card('Staf', Orbis.table([
        { label: 'Nama', fmt: function (s) { return esc(s.name) + (s.phone ? '<div class="muted">' + esc(s.phone) + '</div>' : ''); } },
        { label: 'Peran', fmt: function (s) { return esc((Orbis.ROLES[s.role] || {}).label || s.role); } },
        { label: 'Outlet', fmt: function (s) { return esc((s.outlets || []).map(function (o) { return outletName(d, o); }).join(', ') || 'Semua'); } },
        { label: 'PIN', fmt: pinChip },
        { label: 'Status', fmt: function (s) { return Orbis.chip(s.active ? 'ACTIVE' : 'OFFLINE', s.active ? 'Aktif' : 'Nonaktif'); } },
        { label: '', right: true, fmt: function (s) { return owner ? Orbis.btn('Ubah', 'teamStaffEdit', [s.id], { kind: 'sm' }) + Orbis.btn(s.pinLocked ? 'Reset PIN' : 'PIN', 'teamPinForm', [s.id], { kind: 'sm' }) : ''; } }
      ], staff, 'Belum ada staf.')) +
      Orbis.card('Outlet', Orbis.table([
        { label: 'Nama', fmt: function (o) { return esc(o.name); } },
        { label: 'Alamat', fmt: function (o) { return esc(o.address); } },
        { label: 'Status', fmt: function (o) { return Orbis.chip(o.active ? 'ACTIVE' : 'OFFLINE', o.active ? 'Aktif' : 'Nonaktif'); } },
        { label: '', right: true, fmt: function (o) { return owner ? Orbis.btn(o.active ? 'Nonaktifkan' : 'Aktifkan', 'outletToggle', [o.id], { kind: 'sm' }) : ''; } }
      ], outlets, 'Belum ada outlet.'));
  };
  A.teamStaffEdit = function (id) {
    Orbis.require('team.write');
    var d = Orbis.db(), s = id ? Orbis.mine(d, 'staff').filter(function (x) { return x.id === id; })[0] : { role: 'cashier', active: true, outlets: [d.session.outlet] };
    var isOwner = s.role === 'owner';
    var body = '<input type="hidden" name="id" value="' + esc(id || '') + '">' + Orbis.field('Nama', 'name', s.name || '') +
      '<div class="f2">' + Orbis.field('No. HP', 'phone', s.phone || '', { placeholder: '0812...' }) + Orbis.field('Email', 'email', s.email || '', { type: 'email' }) + '</div>' +
      (isOwner ? '<p class="muted">Peran dan status owner dilindungi.</p>' : Orbis.field('Peran', 'role', s.role, { type: 'select', options: T.STAFF_ROLES.map(function (r) { return [r, Orbis.ROLES[r].label]; }) })) +
      '<fieldset class="xt-outlets"><legend>Outlet ditugaskan</legend>' + Orbis.mine(d, 'outlets').map(function (o) { return Orbis.field(o.name, 'out_' + o.id, !s.outlets || s.outlets.indexOf(o.id) >= 0, { type: 'checkbox' }); }).join('') + '</fieldset>' +
      (isOwner ? '' : Orbis.field('Aktif', 'active', s.active !== false, { type: 'checkbox' }));
    Orbis.modal(id ? 'Ubah staf' : 'Tambah staf', body, Orbis.btn('Batal', 'closeModal') + Orbis.btn('Simpan', 'teamStaffSave', null, { kind: 'primary' }));
  };
  A.teamStaffSave = function () {
    var f = Orbis.formData();
    f.outlets = Object.keys(f).filter(function (k) { return k.indexOf('out_') === 0 && f[k]; }).map(function (k) { return k.slice(4); });
    if (!('role' in f)) { f.role = 'owner'; f.active = true; }
    T.saveStaff(f.id || null, f); Orbis.closeModal(); Orbis.toast('Staf disimpan');
  };
  A.teamPinForm = function (id) {
    Orbis.require('team.write');
    Orbis.modal('Atur PIN pribadi', '<input type="hidden" name="id" value="' + esc(id) + '">' + Orbis.field('PIN baru (4-6 digit)', 'pin', '', { type: 'password', hint: 'PIN unik per tenant. Mengatur ulang PIN juga membuka kunci.' }),
      Orbis.btn('Batal', 'closeModal') + Orbis.btn('Simpan PIN', 'teamPinSave', null, { kind: 'primary' }));
  };
  A.teamPinSave = function () { var f = Orbis.formData(); T.setPin(f.id, f.pin); Orbis.closeModal(); Orbis.toast('PIN disimpan'); };

  /* ---------- Peran & Izin ---------- */
  Orbis.screens.roles = function (d) {
    var role = T.STAFF_ROLES.indexOf(U.role) >= 0 ? U.role : 'cashier', owner = Orbis.can('team.write');
    var perms = T.editablePerms();
    function group(title, list) {
      return Orbis.card(title, Orbis.table([
        { label: 'Izin', fmt: function (p) { return esc(T.LABELS[p] || p) + '<div class="muted">' + esc(p) + '</div>'; } },
        { label: 'Bawaan', fmt: function (p) { return (Orbis.PERMS[p] || []).indexOf(role) >= 0 ? Orbis.chip('ACTIVE', 'Diizinkan') : Orbis.chip('OFFLINE', 'Ditolak'); } },
        { label: 'Aturan tenant', fmt: function (p) {
          var m = T.mode(d, role, p) || 'default';
          if (!owner) return esc(MODE_LABEL[m] || 'Bawaan');
          return '<select aria-label="' + esc('Aturan ' + (T.LABELS[p] || p)) + '" data-change="teamPerm">' + [['default', 'Bawaan'], ['allow', MODE_LABEL.allow], ['deny', MODE_LABEL.deny], ['approval', MODE_LABEL.approval]].map(function (o) {
            return '<option value="' + esc(role + '|' + p + '|' + o[0]) + '"' + (o[0] === m ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
          }).join('') + '</select>';
        } }
      ], list));
    }
    return Orbis.pageHead('Peran & Izin', 'Atur izin per peran untuk tenant ini. Owner selalu punya semua izin.', owner ? Orbis.btn('Kembalikan ke bawaan', 'teamRoleReset', [role], { kind: 'sm' }) : '') +
      '<p class="muted xt-hint">"Perlu PIN manajer": aksi ditolak kecuali owner/manajer memasukkan PIN; persetujuan berlaku 2 menit untuk satu aksi.</p>' +
      Orbis.tabs(T.STAFF_ROLES.map(function (r) { return [r, Orbis.ROLES[r].label]; }), role, 'teamRoleTab') +
      group('Aplikasi kasir (POS)', perms.filter(function (p) { return T.POS_PERMS.indexOf(p) >= 0; })) +
      group('Back office', perms.filter(function (p) { return T.POS_PERMS.indexOf(p) < 0; }));
  };
  A.teamRoleTab = function (r) { U.role = r; Orbis.render(); };
  A.teamPerm = function (v) { var x = String(v).split('|'); T.setPerm(x[0], x[1], x[2]); Orbis.toast('Izin diperbarui'); };
  A.teamRoleReset = function (r) { T.resetRole(r); Orbis.toast('Izin peran dikembalikan ke bawaan'); };

  /* ---------- Absensi ---------- */
  Orbis.screens.attendance = function (d) {
    var staff = Orbis.mine(d, 'staff').filter(function (s) { return s.active; }), all = Orbis.can('attendance.read');
    var q = all ? { from: U.from, to: U.to, outlet: U.outlet, staffId: U.staffId } : { from: T.wibDay(Orbis.clock.now()), outlet: d.session.outlet };
    var rows = T.attendance(d, q);
    var clock = Orbis.card('Absen di ' + outletName(d, d.session.outlet), '<div id="xt-clock" class="f2">' +
      Orbis.field('Staf', 'staffId', staff[0] && staff[0].id, { type: 'select', options: staff.map(function (s) { return [s.id, s.name]; }) }) +
      Orbis.field('PIN pribadi', 'pin', '', { type: 'password' }) + '</div><div class="row">' +
      Orbis.btn('Absen masuk', 'teamClock', ['in'], { kind: 'primary' }) + Orbis.btn('Absen pulang', 'teamClock', ['out']) + '</div><p class="muted xt-hint">' + esc(DEMO_PINS) + '</p>');
    var filters = all ? Orbis.card('Filter', '<div id="xt-att-f" class="xt-filters">' +
      Orbis.field('Dari', 'from', U.from, { type: 'date' }) + Orbis.field('Sampai', 'to', U.to, { type: 'date' }) +
      Orbis.field('Outlet', 'outlet', U.outlet, { type: 'select', options: [['', 'Semua outlet']].concat(Orbis.mine(d, 'outlets').map(function (o) { return [o.id, o.name]; })) }) +
      Orbis.field('Staf', 'staffId', U.staffId, { type: 'select', options: [['', 'Semua staf']].concat(Orbis.mine(d, 'staff').map(function (s) { return [s.id, s.name]; })) }) +
      '</div>' + Orbis.btn('Terapkan', 'teamAttFilter', null, { kind: 'sm' })) : '';
    var total = Orbis.sum(rows, T.duration);
    return Orbis.pageHead('Absensi', all ? 'Rekap masuk/pulang staf per hari.' : 'Absen masuk/pulang dengan PIN pribadi.') + clock + filters +
      Orbis.card(all ? 'Rekap (' + rows.length + ' baris · ' + dur(total) + ')' : 'Hari ini di outlet ini', Orbis.table([
        { label: 'Tanggal', fmt: function (a) { return esc(T.wibDay(a.inAt)); } },
        { label: 'Staf', fmt: function (a) { return esc(a.name); } },
        { label: 'Outlet', fmt: function (a) { return esc(outletName(d, a.outlet)); } },
        { label: 'Masuk', fmt: function (a) { return esc(Orbis.fmtTime(a.inAt)); } },
        { label: 'Pulang', fmt: function (a) { return a.outAt ? esc(Orbis.fmtTime(a.outAt)) : Orbis.chip('ACTIVE', 'Masih bekerja'); } },
        { label: 'Durasi', right: true, fmt: function (a) { return esc(dur(T.duration(a))); } }
      ], rows, 'Belum ada absensi.'));
  };
  A.teamClock = function (kind) {
    var f = Orbis.readForm('#xt-clock');
    var a = kind === 'in' ? T.clockIn(f.staffId, f.pin) : T.clockOut(f.staffId, f.pin);
    Orbis.toast((kind === 'in' ? 'Absen masuk ' : 'Absen pulang ') + a.name);
  };
  A.teamAttFilter = function () { var f = Orbis.readForm('#xt-att-f'); U.from = f.from; U.to = f.to; U.outlet = f.outlet; U.staffId = f.staffId; Orbis.render(); };

  /* ---------- POS: blind close (wrap shift bar, override close actions only) ---------- */
  var basePos = Orbis.screens.pos;
  Orbis.screens.pos = function (d, ctx) {
    var html = basePos(d, ctx);
    return Orbis.can('shift.viewExpected') ? html : html.replace(/ · kas seharusnya [^<]*/, '');   // blind: cashier never sees expected (V2, O2)
  };
  /** Runs fn directly when allowed; when the role's rule is "Perlu PIN manajer", runs it once under the manager PIN. */
  function gated(perm, pin, fn) {
    var d = Orbis.db();
    if (Orbis.can(perm) || T.mode(d, d.session.role, perm) !== 'approval') return fn();
    Orbis.need(pin, 'APPROVAL_REQUIRED', 'Aksi ini perlu PIN manajer');
    return T.withApproval(pin, perm, fn);
  }
  function needsPin(perm) { var d = Orbis.db(); return !Orbis.can(perm) && T.mode(d, d.session.role, perm) === 'approval'; }
  var pinField = function (perm) { return needsPin(perm) ? Orbis.field('PIN manajer', 'mgrPin', '', { type: 'password', hint: 'Aksi ini perlu persetujuan manajer.' }) : ''; };

  A.posOpenShift = function () {
    Orbis.modal('Buka shift', Orbis.field('Kas awal (Rp)', 'opening', 0, { type: 'number', min: 0 }) + pinField('shift.operate'), Orbis.btn('Buka shift', 'posOpenShiftGo', null, { kind: 'primary' }));
  };
  A.posOpenShiftGo = function () {
    var f = Orbis.formData();
    gated('shift.operate', f.mgrPin, function () { return Orbis.domain.shifts.open(Number(f.opening)); });
    Orbis.closeModal(); Orbis.toast('Shift dibuka');
  };
  A.posCloseShift = function (warn) {
    var d = Orbis.db(), sh = Orbis.domain.shifts.current(d); if (!sh) return;
    var c = U.closeDraft || {};
    var denoms = '<div class="xt-denoms">' + T.DENOMS.map(function (v) { return Orbis.field(Orbis.idr(v), 'd' + v, c['d' + v] || 0, { type: 'number', min: 0 }); }).join('') +
      Orbis.field('Koin (Rp)', 'coins', c.coins || 0, { type: 'number', min: 0 }) + '</div>';
    var body = (warn ? '<div class="banner bad" role="alert">Ada selisih kas. Isi catatan minimal 5 karakter.</div>' : '') +
      '<p class="muted">Hitung uang di laci tanpa melihat angka sistem. Isi per pecahan, atau isi total langsung.</p>' + denoms +
      Orbis.field('Atau total dihitung (Rp)', 'total', c.total || '', { type: 'number', min: 0, hint: 'Dipakai bila semua pecahan 0.' }) +
      Orbis.field('Catatan', 'note', c.note || '') + pinField('shift.operate');
    Orbis.modal('Tutup kasir (blind)', body, Orbis.btn('Batal', 'closeModal') + Orbis.btn('Hitung & tutup', 'posCloseShiftGo', null, { kind: 'primary' }));
  };
  A.posCloseShiftGo = function () {
    var f = Orbis.formData(), counts = { coins: Number(f.coins || 0) };
    T.DENOMS.forEach(function (v) { counts[v] = Number(f['d' + v] || 0); });
    var counted = T.countDenoms(counts);
    if (!counted && f.total !== '') counted = Number(f.total);
    U.closeDraft = f;
    var rep;
    try { rep = gated('shift.operate', f.mgrPin, function () { return T.blindClose(counted, f.note); }); }
    catch (e) { if (e && e.code === 'REASON_REQUIRED') return A.posCloseShift(true); throw e; }
    U.closeDraft = null;
    Orbis.closeModal(); showReport(rep);
  };

  /* ---------- Z-report + Riwayat Shift ---------- */
  function zReport(r) {
    var L = function (k, v, strong) { return '<div class="line"><span>' + esc(k) + '</span>' + (strong ? '<b>' : '<span>') + esc(v) + (strong ? '</b>' : '</span>') + '</div>'; };
    return '<div class="xt-zr">' + L('Shift', r.id) + L('Outlet', r.outletName) + L('Kasir', r.cashier) + L('Buka', Orbis.fmtTime(r.openedAt)) + L('Tutup', r.closedAt ? Orbis.fmtTime(r.closedAt) + ' · ' + (r.closedBy || '') : 'Masih terbuka') +
      '<h4>Penjualan per metode</h4>' + L('Tunai', Orbis.idr(r.tenders.cash)) + L('QRIS', Orbis.idr(r.tenders.qris)) + L('Transfer', Orbis.idr(r.tenders.transfer)) + L('COD', Orbis.idr(r.tenders.cod)) +
      L('Total (' + r.orders + ' pesanan)', Orbis.idr(r.sales), true) +
      '<h4>Laci kas</h4>' + L('Kas awal', Orbis.idr(r.opening)) + L('Kas masuk', Orbis.idr(r.cashIn)) + L('Kas keluar', Orbis.idr(r.cashOut)) + L('Refund', Orbis.idr(r.refunds)) +
      L('Seharusnya', Orbis.idr(r.expected), true) + L('Dihitung', r.counted == null ? '-' : Orbis.idr(r.counted), true) +
      L('Selisih', r.variance == null ? '-' : Orbis.idr(r.variance), true) + (r.note ? L('Catatan', r.note) : '') + '</div>';
  }
  function showReport(r) {
    Orbis.modal('Laporan shift (Z) ' + r.id, (r.variance ? '<div class="banner bad">Selisih ' + esc(Orbis.idr(r.variance)) + '</div>' : r.closedAt ? '<div class="banner ok">Kas pas</div>' : '') + zReport(r),
      Orbis.btn('Cetak', 'teamPrint', null, { icon: 'receipt' }) + Orbis.btn('Tutup', 'closeModal', null, { kind: 'primary' }));
  }
  A.teamPrint = function () { if (g.print) g.print(); };
  A.teamShiftReport = function (id) { Orbis.require('shift.report'); showReport(T.shiftReport(Orbis.db(), id)); };

  Orbis.screens.shifts = function (d) {
    var q = U.sh || {}, list = Orbis.domain.shifts.list(d).filter(function (s) {
      var day = T.wibDay(s.openedAt);
      return (!q.outlet || s.outlet === q.outlet) && (!q.from || day >= q.from) && (!q.to || day <= q.to);
    });
    var reports = Orbis.routeAllowed(d.session.role, 'reports') ? Orbis.btn('Rekap di Laporan', 'teamShiftsReport', null, { kind: 'sm', icon: 'chart' }) : '';
    return Orbis.pageHead('Riwayat Shift', 'Semua shift kasir per outlet. Buka laporan Z untuk detail dan cetak.', reports) +
      Orbis.card('Filter', '<div id="xt-sh-f" class="xt-filters">' + Orbis.field('Dari', 'from', q.from || '', { type: 'date' }) + Orbis.field('Sampai', 'to', q.to || '', { type: 'date' }) +
        Orbis.field('Outlet', 'outlet', q.outlet || '', { type: 'select', options: [['', 'Semua outlet']].concat(Orbis.mine(d, 'outlets').map(function (o) { return [o.id, o.name]; })) }) + '</div>' +
        Orbis.btn('Terapkan', 'teamShiftFilter', null, { kind: 'sm' })) +
      Orbis.card('Shift (' + list.length + ')', Orbis.table([
        { label: 'Shift', fmt: function (s) { return esc(s.id); } },
        { label: 'Outlet', fmt: function (s) { return esc(outletName(d, s.outlet)); } },
        { label: 'Kasir', fmt: function (s) { return esc(s.openedBy); } },
        { label: 'Buka', fmt: function (s) { return esc(Orbis.fmtTime(s.openedAt)); } },
        { label: 'Status', fmt: function (s) { return s.closedAt ? Orbis.chip('COMPLETED', 'Ditutup') : Orbis.chip('ACTIVE', 'Terbuka'); } },
        { label: 'Selisih', right: true, fmt: function (s) { return s.variance == null ? '-' : s.variance ? Orbis.chip('FLAGGED', Orbis.idr(s.variance)) : esc(Orbis.idr(0)); } },
        { label: '', right: true, fmt: function (s) { return Orbis.btn('Laporan', 'teamShiftReport', [s.id], { kind: 'sm' }); } }
      ], list, 'Belum ada shift.'));
  };
  A.teamShiftFilter = function () { U.sh = Orbis.readForm('#xt-sh-f'); Orbis.render(); };
  A.teamShiftsReport = function () { if (Orbis.ui.reports2) Orbis.ui.reports2.rep = 'shifts'; Orbis.go('reports'); };
})(typeof window !== 'undefined' ? window : globalThis);
