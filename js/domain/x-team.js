/* Orbis v2 — tenant back-office: team (staff profile, role overrides + manager approval, personal PIN, attendance,
   blind shift close / Z-report). Pure domain, no DOM. RD-14. Client-side simulation only: not a security boundary. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis;
  var team = Orbis.domain.team = {};
  var HOUR = 3600000;

  /* New permissions (benchmark V1: "view shift expected cash" is a POS toggle; J3 attendance; M8 shift report). */
  Orbis.PERMS['attendance.clock'] = ['owner', 'brand', 'manager', 'cashier', 'dispatcher', 'courier', 'ai', 'cs', 'finance'];
  Orbis.PERMS['attendance.read'] = ['owner', 'manager'];
  Orbis.PERMS['shift.viewExpected'] = ['owner', 'manager'];
  Orbis.PERMS['shift.report'] = ['owner', 'manager', 'finance'];

  team.STAFF_ROLES = Object.keys(Orbis.ROLES).filter(function (r) { return Orbis.ROLES[r].scope === 'tenant' && r !== 'owner'; });
  team.MODES = ['allow', 'deny', 'approval'];
  team.APPROVAL_TTL = 2 * 60000;
  team.MAX_PIN_FAILS = 5;
  team.DENOMS = [100000, 50000, 20000, 10000, 5000, 2000, 1000];
  /** POS-side keys (Loyverse V1 split); everything else tenant-scoped is "Back office". */
  team.POS_PERMS = ['pos.sell', 'shift.operate', 'shift.viewExpected', 'order.advance', 'order.cancel', 'refund.request', 'member.write', 'attendance.clock', 'catalog.read', 'order.read', 'delivery.courier'];
  team.LABELS = {
    'pos.sell': 'Jual di kasir', 'shift.operate': 'Buka/tutup shift & kas masuk/keluar', 'shift.viewExpected': 'Lihat kas seharusnya di laci',
    'order.advance': 'Ubah status pesanan', 'order.cancel': 'Batalkan pesanan', 'refund.request': 'Ajukan refund', 'member.write': 'Daftar/ubah member',
    'attendance.clock': 'Absen masuk/pulang', 'catalog.read': 'Lihat produk', 'order.read': 'Lihat semua pesanan', 'delivery.courier': 'Tugas kurir',
    'catalog.write': 'Kelola produk', 'stock.adjust': 'Penyesuaian stok', 'po.write': 'Buat PO', 'po.approve': 'Setujui PO', 'refund.approve': 'Setujui refund',
    'promo.write': 'Kelola promo', 'storefront.edit': 'Ubah storefront', 'expense.write': 'Catat biaya', 'expense.approve': 'Setujui biaya', 'expense.pay': 'Bayar biaya',
    'report.read': 'Lihat laporan', 'delivery.dispatch': 'Dispatch pengiriman', 'cod.review': 'Review COD & setoran', 'inbox.reply': 'Balas inbox',
    'ai.configure': 'Atur AI agent', 'integration.write': 'Kelola integrasi', 'attendance.read': 'Lihat laporan absensi', 'shift.report': 'Lihat riwayat & laporan shift'
  };
  /** Keys the matrix may override: tenant-scoped, minus platform.* and team.write (role changes stay owner-only). */
  team.editablePerms = function () {
    return Object.keys(Orbis.PERMS).filter(function (p) { return p.indexOf('platform.') !== 0 && p !== 'team.write'; });
  };

  function staffRow(d, id) {
    var s = Orbis.mine(d, 'staff').filter(function (x) { return x.id === id; })[0];
    Orbis.need(s, 'NOT_FOUND', 'Staf tidak ditemukan');
    return s;
  }
  function planStaffMax(d) {
    var t = d.tenants.filter(function (x) { return x.id === d.session.tenant; })[0] || {};
    return (d.plans.filter(function (p) { return p.id === t.plan; })[0] || {}).staff || 0;
  }

  /* ================= role overrides + Orbis.hooks.can ================= */
  /** Override mode for (role, perm) in the session tenant, or null (= default Orbis.PERMS). */
  team.mode = function (d, role, perm) {
    var r = (d.rolePerms || []).filter(function (x) { return x.tenant === d.session.tenant && x.role === role && x.perm === perm; })[0];
    return r ? r.mode : null;
  };
  function tokenValid(d, perm) {
    var a = d.session.approval;
    return !!(a && a.perm === perm && a.tenant === d.session.tenant && a.exp > Orbis.clock.now());
  }
  /** No override rows -> undefined, so Orbis.PERMS decides (existing behaviour unchanged). Owner is never reduced. */
  Orbis.hooks.can = function (perm, role, d) {
    if (!d || !d.rolePerms || !d.rolePerms.length || role === 'owner' || perm === 'team.write' || String(perm).indexOf('platform.') === 0) return undefined;
    if (!Orbis.ROLES[role] || Orbis.ROLES[role].scope !== 'tenant') return undefined;
    var m = team.mode(d, role, perm);
    if (m === 'allow') return true;
    if (m === 'deny') return false;
    if (m === 'approval') return tokenValid(d, perm);
    return undefined;
  };

  /** mode 'allow'|'deny'|'approval'|'default' (default removes the override). Owner-only. */
  team.setPerm = function (role, perm, mode) {
    Orbis.require('team.write');
    Orbis.need(role !== 'owner', 'OWNER_PROTECTED', 'Izin owner tidak dapat dikurangi');
    Orbis.need(team.STAFF_ROLES.indexOf(role) >= 0, 'VALIDATION', 'Peran tidak valid');
    Orbis.need(team.editablePerms().indexOf(perm) >= 0, 'VALIDATION', 'Izin tidak dapat diubah');
    Orbis.need(mode === 'default' || team.MODES.indexOf(mode) >= 0, 'VALIDATION', 'Mode izin tidak valid');
    return Orbis.tx(function (d) {
      d.rolePerms = (d.rolePerms || []).filter(function (x) { return !(x.tenant === d.session.tenant && x.role === role && x.perm === perm); });
      if (mode !== 'default') d.rolePerms.push({ tenant: d.session.tenant, role: role, perm: perm, mode: mode });
      return mode;
    }, { audit: { action: 'team.role.perm', entity: 'role', entityId: role, detail: perm + '=' + mode } });
  };
  team.resetRole = function (role) {
    Orbis.require('team.write');
    Orbis.need(team.STAFF_ROLES.indexOf(role) >= 0, 'VALIDATION', 'Peran tidak valid');
    return Orbis.tx(function (d) {
      d.rolePerms = (d.rolePerms || []).filter(function (x) { return !(x.tenant === d.session.tenant && x.role === role); });
    }, { audit: { action: 'team.role.reset', entity: 'role', entityId: role } });
  };

  /* ================= personal PIN ================= */
  /** ponytail: FNV-1a over tenant|staff|pin is a prototype stand-in; real systems hash server-side (argon2/bcrypt) and rate-limit there. */
  team.hashPin = function (tenant, staffId, pin) {
    var s = 'orbis|' + tenant + '|' + staffId + '|' + pin, h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return 'fnv1a$' + h.toString(16);
  };
  function pinMatches(s, pin) { return !!s.pinHash && s.pinHash === team.hashPin(s.tenant, s.id, String(pin)); }

  /** Owner sets/resets a 4-6 digit PIN; unique per tenant; clears lockout. */
  team.setPin = function (staffId, pin) {
    Orbis.require('team.write');
    pin = String(pin == null ? '' : pin);
    Orbis.need(/^\d{4,6}$/.test(pin), 'VALIDATION', 'PIN harus 4-6 digit angka');
    return Orbis.tx(function (d) {
      var s = staffRow(d, staffId);
      Orbis.need(!Orbis.mine(d, 'staff').some(function (x) { return x.id !== s.id && pinMatches(x, pin); }), 'PIN_TAKEN', 'PIN sudah dipakai staf lain');
      s.pinHash = team.hashPin(s.tenant, s.id, pin); s.pinFails = 0; s.pinLocked = false;
      return s.id;
    }, { audit: { action: 'team.pin.set', entity: 'staff', entityId: staffId } });
  };

  /** Checks a staff PIN. Wrong attempts are committed BEFORE throwing so lockout survives; 5 wrong = locked until owner resets. */
  team.verifyPin = function (staffId, pin) {
    var r = Orbis.tx(function (d) {
      var s = staffRow(d, staffId);
      if (!s.active) return { code: 'STAFF_INACTIVE' };
      if (s.pinLocked) return { code: 'PIN_LOCKED' };
      if (!s.pinHash) return { code: 'PIN_NOT_SET' };
      if (pinMatches(s, pin)) { s.pinFails = 0; return { ok: true, staff: Orbis.clone(s) }; }
      s.pinFails = (s.pinFails || 0) + 1;
      if (s.pinFails >= team.MAX_PIN_FAILS) s.pinLocked = true;
      return { code: s.pinLocked ? 'PIN_LOCKED' : 'PIN_WRONG', left: team.MAX_PIN_FAILS - s.pinFails };
    }, { audit: function (r) { return { action: r.ok ? 'team.pin.ok' : 'team.pin.fail', entity: 'staff', entityId: staffId, detail: r.code || null }; } });
    if (r.ok) return r.staff;
    var msg = { STAFF_INACTIVE: 'Staf nonaktif', PIN_LOCKED: 'PIN terkunci setelah 5 kali salah. Minta owner mereset PIN.', PIN_NOT_SET: 'PIN belum diatur', PIN_WRONG: 'PIN salah, sisa ' + r.left + ' percobaan' };
    throw Orbis.Err(r.code, msg[r.code]);
  };

  /* ================= manager approval ("Perlu PIN manajer") ================= */
  /** Manager/owner PIN records a short-lived approval token for ONE perm in d.session.approval (TTL 2 min).
      Use withApproval() to run exactly one action with it; the token is cleared right after (consumed once). */
  team.approve = function (pin, perm) {
    var d0 = Orbis.db();
    var approver = Orbis.mine(d0, 'staff').filter(function (s) { return s.active && !s.pinLocked && pinMatches(s, pin); })[0];
    Orbis.need(approver, 'PIN_WRONG', 'PIN manajer salah');
    var mm = team.mode(d0, 'manager', perm);   // a manager approves only what managers may do outright
    Orbis.need(approver.role === 'owner' || (approver.role === 'manager' && (mm === 'allow' || (!mm && (Orbis.PERMS[perm] || []).indexOf('manager') >= 0))),
      'FORBIDDEN', 'Staf ini tidak berwenang menyetujui aksi tersebut');
    return Orbis.tx(function (d) {
      d.session.approval = { perm: perm, tenant: d.session.tenant, by: approver.id, exp: Orbis.clock.now() + team.APPROVAL_TTL };
      return d.session.approval;
    }, { audit: { action: 'team.approval.grant', entity: 'staff', entityId: approver.id, detail: perm } });
  };
  team.consume = function () {
    if (!Orbis.db().session.approval) return;
    Orbis.tx(function (d) { delete d.session.approval; });
  };
  team.withApproval = function (pin, perm, fn) {
    team.approve(pin, perm);
    try { return Orbis.batch(fn); } finally { team.consume(); }
  };

  /* ================= staff profile ================= */
  /** id null = create. Owner row: only name/phone/email editable (role + active protected). */
  team.saveStaff = function (id, f) {
    Orbis.require('team.write');
    f = f || {};
    var name = String(f.name || '').trim(), phone = String(f.phone || '').replace(/[\s-]/g, ''), email = String(f.email || '').trim();
    Orbis.need(name.length >= 2 && name.length <= 60, 'VALIDATION', 'Nama 2-60 karakter');
    Orbis.need(!phone || /^(\+62|0)8\d{7,12}$/.test(phone), 'VALIDATION', 'Nomor HP tidak valid');
    Orbis.need(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'VALIDATION', 'Email tidak valid');
    return Orbis.tx(function (d) {
      var s = id ? staffRow(d, id) : null, isOwner = s && s.role === 'owner';
      var outlets = Orbis.mine(d, 'outlets').map(function (o) { return o.id; });
      var pick = (f.outlets || []).filter(function (o, i, a) { return a.indexOf(o) === i; });
      Orbis.need(pick.length >= 1 && pick.every(function (o) { return outlets.indexOf(o) >= 0; }), 'VALIDATION', 'Pilih minimal satu outlet milik tenant');
      if (!isOwner) Orbis.need(team.STAFF_ROLES.indexOf(f.role) >= 0, 'VALIDATION', 'Peran tidak valid');
      if (isOwner) Orbis.need((f.role == null || f.role === 'owner') && f.active !== false, 'OWNER_PROTECTED', 'Peran dan status owner tidak dapat diubah');
      var active = isOwner ? true : f.active !== false;
      if (active && !(s && s.active)) {
        var n = Orbis.mine(d, 'staff').filter(function (x) { return x.active; }).length;
        Orbis.need(n < planStaffMax(d), 'PLAN_LIMIT', 'Batas staf paket tercapai (' + planStaffMax(d) + ')');
      }
      if (!s) { s = { id: Orbis.nextId(d, 'STF', 3), tenant: d.session.tenant }; d.staff.push(s); }
      s.name = name; s.phone = phone; s.email = email; s.outlets = pick;
      if (!isOwner) { s.role = f.role; s.active = active; }
      return s;
    }, { audit: function (s) { return { action: id ? 'team.staff.edit' : 'team.staff.add', entity: 'staff', entityId: s.id }; } });
  };

  /* ================= attendance ================= */
  function openRow(d, staffId) { return Orbis.mine(d, 'attendance').filter(function (a) { return a.staffId === staffId && !a.outAt; })[0]; }
  team.clockIn = function (staffId, pin) {
    Orbis.require('attendance.clock');
    team.verifyPin(staffId, pin);
    return Orbis.tx(function (d) {
      var s = staffRow(d, staffId), outlet = d.session.outlet;
      Orbis.need(!s.outlets || s.outlets.indexOf(outlet) >= 0, 'OUTLET_NOT_ASSIGNED', 'Staf tidak ditugaskan di outlet ini');
      Orbis.need(!openRow(d, staffId), 'ALREADY_CLOCKED_IN', 'Staf sudah absen masuk');
      d.attendance = d.attendance || [];
      var a = { id: Orbis.nextId(d, 'ATT', 5), tenant: d.session.tenant, staffId: s.id, name: s.name, outlet: outlet, inAt: Orbis.clock.now(), outAt: null };
      d.attendance.push(a);
      return a;
    }, { audit: function (a) { return { action: 'attendance.in', entity: 'staff', entityId: staffId, detail: a.outlet }; } });
  };
  team.clockOut = function (staffId, pin) {
    Orbis.require('attendance.clock');
    team.verifyPin(staffId, pin);
    return Orbis.tx(function (d) {
      var a = openRow(d, staffId);
      Orbis.need(a, 'NOT_CLOCKED_IN', 'Staf belum absen masuk');
      a.outAt = Orbis.clock.now();
      return a;
    }, { audit: function (a) { return { action: 'attendance.out', entity: 'staff', entityId: staffId, detail: a.outlet }; } });
  };
  team.duration = function (a) { return Math.max(0, (a.outAt || Orbis.clock.now()) - a.inAt); };
  /** q: {from,to (YYYY-MM-DD, WIB day), outlet, staffId}. Newest first. */
  team.attendance = function (d, q) {
    q = q || {};
    return Orbis.mine(d, 'attendance').filter(function (a) {
      var day = team.wibDay(a.inAt);
      return (!q.from || day >= q.from) && (!q.to || day <= q.to) && (!q.outlet || a.outlet === q.outlet) && (!q.staffId || a.staffId === q.staffId);
    }).sort(function (a, b) { return b.inAt - a.inAt; });
  };
  team.wibDay = function (ms) { return new Date(ms + 7 * HOUR).toISOString().slice(0, 10); };

  /* ================= blind close + Z-report ================= */
  /** counts: {100000: n, ..., coins: rupiah}. Returns integer total. */
  team.countDenoms = function (counts) {
    counts = counts || {};
    var total = 0;
    team.DENOMS.forEach(function (v) {
      var n = Number(counts[v] || 0);
      Orbis.int(n, 'Jumlah lembar ' + v); Orbis.need(n >= 0, 'VALIDATION', 'Jumlah lembar tidak boleh negatif');
      total += n * v;
    });
    var coins = Number(counts.coins || 0);
    Orbis.int(coins, 'Koin'); Orbis.need(coins >= 0, 'VALIDATION', 'Koin tidak boleh negatif');
    return total + coins;
  };
  /** Cashier never sees expected before submitting: domain just delegates to shifts.close (variance-note rule stays there). */
  team.blindClose = function (counted, note) {
    var s = Orbis.domain.shifts.close(counted, note);
    return team.shiftReport(Orbis.db(), s.id);
  };
  /** Z-report for any shift of the session tenant (open shift = running numbers). */
  team.shiftReport = function (d, shiftId) {
    var sh = Orbis.mine(d, 'shifts').filter(function (s) { return s.id === shiftId; })[0];
    Orbis.need(sh, 'NOT_FOUND', 'Shift tidak ditemukan');
    var sum = Orbis.domain.shifts.summary(d, sh), pays = Orbis.mine(d, 'payments').filter(function (p) { return p.shiftId === sh.id; });
    var tenders = {};
    ['cash', 'qris', 'transfer', 'cod'].forEach(function (t) { tenders[t] = Orbis.sum(pays.filter(function (p) { return p.type === t && p.amount > 0; }), function (p) { return p.amount; }); });
    var outlet = Orbis.mine(d, 'outlets').filter(function (o) { return o.id === sh.outlet; })[0] || {};
    return {
      id: sh.id, outlet: sh.outlet, outletName: outlet.name || sh.outlet, cashier: sh.openedBy, closedBy: sh.closedBy || null,
      openedAt: sh.openedAt, closedAt: sh.closedAt, opening: sum.opening, tenders: tenders,
      sales: Orbis.sum(Object.keys(tenders), function (k) { return tenders[k]; }),
      orders: Orbis.mine(d, 'orders').filter(function (o) { return o.shiftId === sh.id; }).length,
      refunds: -Orbis.sum(pays.filter(function (p) { return p.amount < 0; }), function (p) { return p.amount; }),
      cashIn: sum.cashIn, cashOut: sum.cashOut, expected: sh.closedAt ? sh.expectedCash : sum.expected,
      counted: sh.countedCash, variance: sh.variance, note: sh.note
    };
  };

  /* ================= seed + demo ================= */
  Orbis.seedHooks.push(function (db) {
    db.rolePerms = db.rolePerms || []; db.attendance = db.attendance || [];
    var X = { s1: ['1111', ['o1', 'o2'], '081211110001'], s2: ['2222', ['o1', 'o2'], '081211110002'], s3: ['3333', ['o1'], '081211110003'],
      s4: ['4444', ['o1', 'o2'], '081211110004'] };
    db.staff.forEach(function (s) {
      var x = X[s.id];
      if (!x || s.tenant !== 't1') return;
      s.pinHash = team.hashPin(s.tenant, s.id, x[0]); s.pinFails = 0; s.pinLocked = false;
      s.outlets = x[1]; s.phone = x[2]; s.email = s.name.toLowerCase() + '@kopiawan.id';
    });
  });
  /** Demo: 2 extra staff (barista BSD, dispatcher) via real saveStaff/setPin — kept out of the base seed so t1 stays
      within 5 active staff (platform downgrade tests). Then ~2 weeks of attendance via clockIn/clockOut (PIN path). */
  (Orbis.demoHooks = Orbis.demoHooks || []).push(function (c) {
    c.as('owner', 'Rina (Owner)', 'o1');
    var ids = c.at(c.t0 - 2 * c.DAY, function () {
      return [['Putri', 'cashier', ['o2'], '081211110005', '5555'], ['Wawan', 'dispatcher', ['o1'], '081211110006', '6666']].map(function (x) {
        var s = team.saveStaff(null, { name: x[0], role: x[1], outlets: x[2], phone: x[3], email: x[0].toLowerCase() + '@kopiawan.id' });
        team.setPin(s.id, x[4]); return s.id;
      });
    });
    var crew = [['s3', '3333', 'o1', 7], [ids[1], '6666', 'o1', 9], ['s2', '2222', 'o2', 8], [ids[0], '5555', 'o2', 10]];
    for (var day = 13; day >= 0; day--) {
      var dayStart = c.now - day * c.DAY - ((new Date(c.now).getUTCHours() + 7) % 24) * c.HOUR;
      crew.forEach(function (m, i) {
        if (day > 0 && (day + i) % 6 === 0) return;   // a day off now and then
        var inAt = dayStart + m[3] * c.HOUR + ((day * 7 + i * 11) % 25) * 60000, outAt = inAt + (8 + (day + i) % 2) * c.HOUR;
        if (inAt > c.now) return;
        c.as('owner', 'Rina (Owner)', m[2]);
        c.at(inAt, function () { team.clockIn(m[0], m[1]); });
        if (day > 0 || (m[0] !== 's3' && m[0] !== ids[0])) { if (outAt <= c.now) c.at(outAt, function () { team.clockOut(m[0], m[1]); }); }
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
