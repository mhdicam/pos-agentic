/* Orbis v2 — team & outlets (owner only). Writes are plain tx with audit; no separate domain needed. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions;
  var STAFF_ROLES = ['manager', 'cashier', 'dispatcher', 'courier', 'cs', 'finance', 'brand', 'ai'];

  Orbis.screens.team = function (d) {
    var staff = Orbis.mine(d, 'staff'), outlets = Orbis.mine(d, 'outlets');
    var owner = Orbis.can('team.write');
    return Orbis.pageHead('Tim & Outlet', 'Kelola staf dan outlet.', owner ? Orbis.btn('Tambah staf', 'staffForm', null, { kind: 'primary', icon: 'plus' }) + Orbis.btn('Tambah outlet', 'outletForm', null, { icon: 'plus' }) : '') +
      Orbis.card('Staf', Orbis.table([
        { label: 'Nama', fmt: function (s) { return esc(s.name); } },
        { label: 'Peran', fmt: function (s) { return esc((Orbis.ROLES[s.role] || {}).label || s.role); } },
        { label: 'Status', fmt: function (s) { return Orbis.chip(s.active ? 'ACTIVE' : 'OFFLINE', s.active ? 'Aktif' : 'Nonaktif'); } },
        { label: '', right: true, fmt: function (s) { return owner && s.role !== 'owner' ? Orbis.btn(s.active ? 'Nonaktifkan' : 'Aktifkan', 'staffToggle', [s.id], { kind: 'sm' }) : ''; } }
      ], staff, 'Belum ada staf.')) +
      Orbis.card('Outlet', Orbis.table([
        { label: 'Nama', fmt: function (o) { return esc(o.name); } },
        { label: 'Alamat', fmt: function (o) { return esc(o.address); } },
        { label: 'Status', fmt: function (o) { return Orbis.chip(o.active ? 'ACTIVE' : 'OFFLINE', o.active ? 'Aktif' : 'Nonaktif'); } },
        { label: '', right: true, fmt: function (o) { return owner ? Orbis.btn(o.active ? 'Nonaktifkan' : 'Aktifkan', 'outletToggle', [o.id], { kind: 'sm' }) : ''; } }
      ], outlets, 'Belum ada outlet.'));
  };

  function planLimit(d, key) {
    var t = d.tenants.filter(function (x) { return x.id === d.session.tenant; })[0];
    var p = d.plans.filter(function (x) { return x.id === t.plan; })[0];
    return p ? p[key] : 0;
  }

  A.staffForm = function () {
    Orbis.require('team.write');
    Orbis.modal('Tambah staf', Orbis.field('Nama', 'name', '') + Orbis.field('Peran', 'role', 'cashier', { type: 'select', options: STAFF_ROLES.map(function (r) { return [r, Orbis.ROLES[r].label]; }) }),
      Orbis.btn('Batal', 'closeModal') + Orbis.btn('Simpan', 'staffSave', null, { kind: 'primary' }));
  };
  A.staffSave = function () {
    var f = Orbis.formData();
    Orbis.tx(function (d) {
      Orbis.require('team.write');
      var name = String(f.name || '').trim();
      Orbis.need(name.length >= 2 && name.length <= 60, 'VALIDATION', 'Nama 2-60 karakter');
      Orbis.need(STAFF_ROLES.indexOf(f.role) >= 0, 'VALIDATION', 'Peran tidak valid');
      var active = Orbis.mine(d, 'staff').filter(function (s) { return s.active; }).length;
      Orbis.need(active < planLimit(d, 'staff'), 'PLAN_LIMIT', 'Batas staf paket tercapai (' + planLimit(d, 'staff') + ')');
      d.staff.push({ id: Orbis.nextId(d, 'STF', 3), tenant: d.session.tenant, name: name, role: f.role, active: true });
    }, { audit: { action: 'team.staff.add', entity: 'staff' } });
    Orbis.closeModal(); Orbis.toast('Staf ditambahkan');
  };
  A.staffToggle = function (id) {
    Orbis.tx(function (d) {
      Orbis.require('team.write');
      var s = Orbis.mine(d, 'staff').filter(function (x) { return x.id === id; })[0];
      Orbis.need(s, 'NOT_FOUND', 'Staf tidak ditemukan');
      Orbis.need(s.role !== 'owner', 'FORBIDDEN', 'Owner tidak dapat dinonaktifkan');
      s.active = !s.active;
    }, { audit: { action: 'team.staff.toggle', entity: 'staff', entityId: id } });
  };
  A.outletForm = function () {
    Orbis.require('team.write');
    Orbis.modal('Tambah outlet', Orbis.field('Nama', 'name', '') + Orbis.field('Alamat', 'address', ''),
      Orbis.btn('Batal', 'closeModal') + Orbis.btn('Simpan', 'outletSave', null, { kind: 'primary' }));
  };
  A.outletSave = function () {
    var f = Orbis.formData();
    Orbis.tx(function (d) {
      Orbis.require('team.write');
      Orbis.need(String(f.name || '').trim().length >= 2, 'VALIDATION', 'Nama outlet wajib diisi');
      var count = Orbis.mine(d, 'outlets').length;
      Orbis.need(count < planLimit(d, 'outlets'), 'PLAN_LIMIT', 'Batas outlet paket tercapai (' + planLimit(d, 'outlets') + ')');
      d.outlets.push({ id: Orbis.nextId(d, 'OUT', 3), tenant: d.session.tenant, name: String(f.name).trim(), address: String(f.address || '').trim(), active: true });
    }, { audit: { action: 'team.outlet.add', entity: 'outlet' } });
    Orbis.closeModal(); Orbis.toast('Outlet ditambahkan');
  };
  A.outletToggle = function (id) {
    Orbis.tx(function (d) {
      Orbis.require('team.write');
      var o = Orbis.mine(d, 'outlets').filter(function (x) { return x.id === id; })[0];
      Orbis.need(o, 'NOT_FOUND', 'Outlet tidak ditemukan');
      if (o.active) Orbis.need(Orbis.mine(d, 'outlets').filter(function (x) { return x.active; }).length > 1, 'LAST_OUTLET', 'Minimal satu outlet harus aktif');
      o.active = !o.active;
    }, { audit: { action: 'team.outlet.toggle', entity: 'outlet', entityId: id } });
  };
})(typeof window !== 'undefined' ? window : globalThis);
