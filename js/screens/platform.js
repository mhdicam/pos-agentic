/* Orbis v2 — platform screens: platform, platform-tenants, platform-billing, platform-approvals, platform-fleet, platform-audit.
   Pure renders; every dynamic string goes through Orbis.esc. Mutations only via Orbis.domain.platform / fleet. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, P = Orbis.domain.platform, F = Orbis.domain.fleet, A = Orbis.actions, S = Orbis.screens;
  var ui = (Orbis.ui = Orbis.ui || {}); ui.platform = ui.platform || { q: '', status: 'ALL', tab: 'overview', tenant: null, audit: {}, fleetTenant: null };
  var U = ui.platform;

  function tname(d, id) { var t = d.tenants.filter(function (x) { return x.id === id; })[0]; return t ? t.name : id; }
  function planName(d, id) { var p = d.plans.filter(function (x) { return x.id === id; })[0]; return p ? p.name : id; }
  function actorSwitch(d) {
    return '<label class="sel"><span>Aktor demo</span><select data-change="platformSetActor">' + P.ACTORS.map(function (a) {
      return '<option value="' + esc(a) + '"' + (a === d.platform.actor ? ' selected' : '') + '>' + esc(a) + '</option>';
    }).join('') + '</select></label>';
  }
  function denied() { return Orbis.empty('Layar ini hanya untuk peran platform.'); }
  function isPlat(d) { return Orbis.can('platform.read', d.session.role); }

  /* ---------- dashboard ---------- */
  S.platform = function (d) {
    if (!isPlat(d)) return denied();
    var k = P.dashboard(d);
    var inc = P.INCIDENTS.map(function (i) { return '<li>' + esc(i.title) + ' ' + Orbis.chip(i.status === 'RESOLVED' ? 'ACTIVE' : 'PENDING', i.status) + '</li>'; }).join('');
    var health = P.HEALTH.map(function (h) { return '<li>' + esc(h.name) + ' ' + Orbis.chip(h.status === 'OK' ? 'ACTIVE' : 'PENDING', h.status) + '</li>'; }).join('');
    var flags = d.platform.flags.map(function (f) {
      return '<li>' + esc(f.name) + ' ' + Orbis.chip(f.on ? 'ACTIVE' : 'OFFLINE', f.on ? 'ON' : 'OFF') + ' ' +
        Orbis.btn('Toggle', 'platformFlag', [f.id], { disabled: !Orbis.can('platform.tenant', d.session.role) }) + '</li>';
    }).join('');
    var ann = Orbis.can('platform.tenant', d.session.role) ?
      '<div id="ann-form"><div class="fld"><label for="ann-t">Judul</label><input id="ann-t" name="title"></div><div class="fld"><label for="ann-b">Isi</label><textarea id="ann-b" name="body" rows="2"></textarea></div>' +
      Orbis.btn('Simpan draft', 'platformAnnounce', null, { kind: 'primary' }) + '</div>' : '<p class="fine">Hanya platform admin yang dapat membuat pengumuman.</p>';
    var drafts = (d.platform.announcements || []).map(function (a) { return '<li>' + esc(a.title) + ' ' + Orbis.chip('DRAFT') + '</li>'; }).join('');
    return Orbis.pageHead('Dashboard Platform', 'Ringkasan lintas tenant', actorSwitch(d)) +
      '<div class="grid stats">' + Orbis.stat('MRR', Orbis.idr(k.mrr), 'Tenant ACTIVE saja; trial = 0') + Orbis.stat('Invoice lunas', String(k.paidInvoices)) +
      Orbis.stat('Antrean sinkron', String(k.pendingSync), k.conflicts + ' konflik') + Orbis.stat('Permintaan terbuka', String(k.openRequests)) + Orbis.stat('Grant aktif', String(k.activeGrants)) + '</div>' +
      '<div class="grid cols2">' + Orbis.card('Kesehatan sistem', '<ul class="list">' + health + '</ul>') + Orbis.card('Insiden', '<ul class="list">' + inc + '</ul>') +
      Orbis.card('Feature flag', '<ul class="list">' + flags + '</ul>') + Orbis.card('Pengumuman (draft)', ann + '<ul class="list">' + drafts + '</ul>') + '</div>';
  };
  A.platformFlag = function (id) { P.toggleFlag(id); Orbis.toast('Flag diubah'); };
  A.platformAnnounce = function () { P.saveAnnouncement(Orbis.readForm('#ann-form')); Orbis.toast('Draft tersimpan'); };
  A.platformSetActor = function (a) { P.setActor(a); Orbis.toast('Aktor demo: ' + a); };

  /* ---------- tenants ---------- */
  S['platform-tenants'] = function (d) {
    if (!isPlat(d)) return denied();
    var q = String(U.q || '').toLowerCase();
    var rows = P.tenants(d).filter(function (t) { return (U.status === 'ALL' || t.status === U.status) && (!q || (t.name + ' ' + t.slug).toLowerCase().indexOf(q) >= 0); });
    var chips = ['ALL'].concat(P.STATUSES).map(function (s) {
      return Orbis.btn(s === 'ALL' ? 'Semua' : s, 'platformStatusFilter', [s], { kind: U.status === s ? 'primary' : '' });
    }).join(' ');
    var support = d.session.role === 'support';
    var table = Orbis.table([
      { label: 'Tenant', fmt: function (t) { return '<b>' + esc(t.name) + '</b><br><small>' + esc(t.slug) + '</small>'; } },
      { label: 'Plan', fmt: function (t) { return esc(planName(d, t.plan)); } },
      { label: 'Status', fmt: function (t) { return Orbis.chip(t.status); } },
      { label: 'Akses', fmt: function (t) { return support ? (P.isActive(d, t.id) ? Orbis.chip('ACTIVE', 'Grant aktif') : Orbis.chip('PENDING', 'Butuh grant')) : '-'; } },
      { label: '', fmt: function (t) { return Orbis.btn('Tenant 360', 'platformOpen', [t.id]) + (Orbis.can('platform.request', d.session.role) ? ' ' + Orbis.btn('Ubah status', 'platformStatusModal', [t.id]) + ' ' + Orbis.btn('Minta grant', 'platformGrantModal', [t.id]) : ''); } }
    ], rows, 'Tidak ada tenant yang cocok.');
    return Orbis.pageHead('Tenant', 'Lifecycle: ACTIVE, TRIALING, SUSPENDED. Perubahan lewat maker/checker.') +
      '<div class="row"><input type="search" id="pt-q" name="q" value="' + esc(U.q) + '" placeholder="Cari tenant" aria-label="Cari tenant"> ' + Orbis.btn('Cari', 'platformSearch') + ' ' + chips + '</div>' + table;
  };
  A.platformSearch = function () { U.q = (Orbis.readForm('#main').q || ''); Orbis.render(); };
  A.platformStatusFilter = function (s) { U.status = s; Orbis.render(); };
  A.platformStatusModal = function (tid) {
    Orbis.modal('Ajukan perubahan status', '<input type="hidden" name="tenantId" value="' + esc(tid) + '">' +
      Orbis.field('Status baru', 'status', 'SUSPENDED', { type: 'select', options: P.STATUSES }) + Orbis.field('Alasan (min 5 karakter)', 'reason', '', { type: 'textarea' }) +
      '<p class="fine">Perlu persetujuan admin lain (maker/checker).</p>', Orbis.btn('Ajukan', 'platformStatusSubmit', null, { kind: 'primary' }));
  };
  A.platformStatusSubmit = function () { var f = Orbis.formData(); P.request('TENANT_STATUS', f); Orbis.closeModal(); Orbis.toast('Permintaan diajukan'); };
  A.platformGrantModal = function (tid) {
    Orbis.modal('Minta grant akses support', '<input type="hidden" name="tenantId" value="' + esc(tid) + '">' +
      Orbis.field('Durasi (menit, 15-240)', 'minutes', 30, { type: 'number', min: 15 }) + Orbis.field('Alasan (min 5 karakter)', 'reason', '', { type: 'textarea' }),
      Orbis.btn('Ajukan', 'platformGrantSubmit', null, { kind: 'primary' }));
  };
  A.platformGrantSubmit = function () { var f = Orbis.formData(); f.minutes = parseInt(f.minutes, 10); P.request('SUPPORT_GRANT', f); Orbis.closeModal(); Orbis.toast('Permintaan grant diajukan'); };
  A.platformOpen = function (tid) {
    var v = P.openTenant(tid);   // throws NO_ACTIVE_GRANT for support without grant -> toast; modal shows the state instead
    U.tenant = tid; U.tab = 'overview'; renderT360(v);
  };
  function t360Body(v, tab) {
    var d = Orbis.db();
    if (tab === 'billing') {
      return Orbis.table([{ label: 'Invoice', fmt: function (i) { return esc(i.id); } }, { label: 'Nominal', right: true, fmt: function (i) { return esc(Orbis.idr(i.amount)); } }, { label: 'Status', fmt: function (i) { return Orbis.chip(i.status); } }], v.invoices, 'Belum ada invoice.') +
        '<p>Plan: <b>' + esc(v.plan.name) + '</b> (' + esc(Orbis.idr(v.plan.price)) + '/bulan)</p>';
    }
    if (tab === 'devices') {
      return Orbis.table([{ label: 'Perangkat', fmt: function (x) { return esc(x.device.name); } }, { label: 'Status', fmt: function (x) { return Orbis.chip(x.device.status); } },
        { label: 'Pending', right: true, fmt: function (x) { return esc(x.stats.pending); } }, { label: 'Konflik', right: true, fmt: function (x) { return esc(x.stats.conflicts); } }], v.devices, 'Belum ada perangkat.');
    }
    var e = v.entitlements;
    return '<p>' + Orbis.chip(v.tenant.status) + ' ' + esc(v.tenant.name) + ' &middot; ' + esc(v.plan.name) + '</p><p>Outlet: ' + esc(v.outlets) + ' / ' + esc(e.quotas.outlets) + ' &middot; Staf: ' + esc(v.staff) + ' / ' + esc(e.quotas.staff) + '</p>' +
      '<p>Modul: ' + Object.keys(e.modules).map(function (m) { return esc(m) + ' ' + Orbis.chip(e.modules[m] ? 'ACTIVE' : 'OFFLINE', e.modules[m] ? 'ON' : 'OFF'); }).join(' &middot; ') + '</p>' +
      (v.viaGrant ? '<p class="fine">Dibuka lewat grant support; akses ini dicatat di audit.</p>' : '');
  }
  function renderT360(v) {
    var tabs = Orbis.tabs([['overview', 'Ringkasan'], ['billing', 'Billing'], ['devices', 'Perangkat']], U.tab, 'platformTab');
    Orbis.modal('Tenant 360: ' + v.tenant.name, tabs + '<div id="t360">' + t360Body(v, U.tab) + '</div>');
  }
  A.platformTab = function (tab) {
    U.tab = tab;
    var v = Orbis.read(function (d) { return P.tenant360(d, U.tenant); });   // re-check grant on every tab switch (expiry enforced)
    renderT360(v);
  };

  /* ---------- billing ---------- */
  S['platform-billing'] = function (d) {
    if (!isPlat(d)) return denied();
    var can = Orbis.can('platform.tenant', d.session.role);
    var plans = Orbis.table([{ label: 'Plan', fmt: function (p) { return '<b>' + esc(p.name) + '</b>'; } }, { label: 'Harga', right: true, fmt: function (p) { return esc(Orbis.idr(p.price)); } },
      { label: 'Outlet', right: true, fmt: function (p) { return esc(p.outlets); } }, { label: 'Staf', right: true, fmt: function (p) { return esc(p.staff); } }, { label: 'Register', right: true, fmt: function (p) { return esc(p.registers); } }, { label: 'Kredit AI', right: true, fmt: function (p) { return esc(p.ai); } }], P.plans(d));
    var tenants = Orbis.table([{ label: 'Tenant', fmt: function (t) { return esc(t.name); } }, { label: 'Plan', fmt: function (t) { return esc(planName(d, t.plan)); } }, { label: 'Status', fmt: function (t) { return Orbis.chip(t.status); } },
      { label: '', fmt: function (t) { return Orbis.btn('Ubah plan', 'platformPlanModal', [t.id], { disabled: !can, title: can ? '' : 'Hanya platform admin' }); } }], d.tenants);
    var inv = Orbis.table([{ label: 'Invoice', fmt: function (i) { return esc(i.id); } }, { label: 'Tenant', fmt: function (i) { return esc(tname(d, i.tenant)); } }, { label: 'Nominal', right: true, fmt: function (i) { return esc(Orbis.idr(i.amount)); } },
      { label: 'Status', fmt: function (i) { return Orbis.chip(i.status); } },
      { label: '', fmt: function (i) { return i.status === 'UNPAID' ? Orbis.btn('Tandai lunas', 'platformPaid', [i.id], { disabled: !can }) : ''; } }], P.invoices(d), 'Belum ada invoice.');
    var form = can ? '<div id="inv-form" class="row">' + Orbis.field('Tenant', 'tenantId', d.tenants[0].id, { type: 'select', options: d.tenants.map(function (t) { return [t.id, t.name]; }) }) + Orbis.field('Nominal (IDR)', 'amount', '', { type: 'number', min: 1 }) + Orbis.btn('Buat invoice', 'platformInvoice', null, { kind: 'primary' }) + '</div>' : '';
    var preq = Orbis.table([{ label: 'ID', fmt: function (r) { return esc(r.id); } }, { label: 'Tenant', fmt: function (r) { return esc(tname(d, r.tenant)); } },
      { label: 'Perubahan', fmt: function (r) { return esc(planName(d, r.from) + ' → ' + planName(d, r.to)); } }, { label: 'Catatan', fmt: function (r) { return esc(r.note || '-'); } },
      { label: 'Status', fmt: function (r) { return Orbis.chip(r.status); } },
      { label: '', fmt: function (r) { return r.status === 'PENDING' ? Orbis.btn('Setujui', 'platformPlanReq', [r.id, true], { kind: 'primary', disabled: !can }) + ' ' + Orbis.btn('Tolak', 'platformPlanReq', [r.id, false], { disabled: !can }) : ''; } }],
      (d.planRequests || []).slice().reverse(), 'Tidak ada permintaan paket dari tenant.');
    return Orbis.pageHead('Billing & Plan', 'MRR ' + Orbis.idr(P.mrr(d)) + ' (tenant ACTIVE)') + Orbis.card('Permintaan paket tenant', preq) + Orbis.card('Plan', plans) + Orbis.card('Plan tenant', tenants) + Orbis.card('Invoice', form + inv);
  };
  A.platformPlanModal = function (tid) {
    var d = Orbis.db(), t = d.tenants.filter(function (x) { return x.id === tid; })[0];
    var opts = d.plans.map(function (p) { return [p.id, p.name + ' - ' + Orbis.idr(p.price)]; });
    var checks = d.plans.map(function (p) {
      var c = P.planCheck(d, tid, p.id);
      return '<li><b>' + esc(p.name) + '</b>: ' + (c.ok ? Orbis.chip('ACTIVE', 'Boleh') : Orbis.chip('REJECTED', 'Diblokir') + ' ' + c.blockers.map(function (b) { return esc(b.limit + ' ' + b.current + ' melebihi batas ' + b.max); }).join('; ')) + '</li>';
    }).join('');
    Orbis.modal('Ubah plan: ' + t.name, '<input type="hidden" name="tenantId" value="' + esc(tid) + '">' + Orbis.field('Plan baru', 'planId', t.plan, { type: 'select', options: opts }) +
      '<ul class="list">' + checks + '</ul><p class="fine">Downgrade ditolak bila outlet/staf melebihi batas; data tidak pernah dihapus otomatis.</p>', Orbis.btn('Terapkan', 'platformPlanSubmit', null, { kind: 'primary' }));
  };
  A.platformPlanSubmit = function () { var f = Orbis.formData(); P.changePlan(f.tenantId, f.planId); Orbis.closeModal(); Orbis.toast('Plan diubah'); };
  A.platformPlanReq = function (id, ok) {
    var why = ok ? '' : (g.prompt ? g.prompt('Alasan penolakan (min. 5 karakter):') : '');
    if (!ok && why === null) return;
    Orbis.domain.tenant.resolvePlanRequest(id, ok, why); Orbis.toast(ok ? 'Paket tenant diubah' : 'Permintaan ditolak');
  };
  A.platformPaid = function (id) { P.markPaid(id); Orbis.toast('Invoice lunas'); };
  A.platformInvoice = function () { var f = Orbis.readForm('#inv-form'); P.createInvoice(f.tenantId, parseInt(f.amount, 10)); Orbis.toast('Invoice dibuat'); };

  /* ---------- approvals ---------- */
  S['platform-approvals'] = function (d) {
    if (!isPlat(d)) return denied();
    var actor = d.platform.actor, canApprove = Orbis.can('platform.approve', d.session.role);
    var rows = P.requests(d);
    var table = Orbis.table([
      { label: 'ID', fmt: function (r) { return esc(r.id); } },
      { label: 'Permintaan', fmt: function (r) { return '<b>' + esc(r.action) + '</b><br>' + esc(tname(d, r.tenantId)) + '<br><small>' + esc(r.action === 'TENANT_STATUS' ? r.fromStatus + ' → ' + r.toStatus : r.minutes + ' menit') + '</small>'; } },
      { label: 'Alasan', fmt: function (r) { return esc(r.reason); } },
      { label: 'Maker', fmt: function (r) { return esc(r.maker); } },
      { label: 'Status', fmt: function (r) { return Orbis.chip(r.status) + (r.decidedBy ? '<br><small>oleh ' + esc(r.decidedBy) + '</small>' : '') + (r.result && r.result.warnings && r.result.warnings.length ? '<br><small>Peringatan: ' + esc(r.result.warnings.join('; ')) + '</small>' : ''); } },
      { label: '', fmt: function (r) {
        if (r.status !== 'PENDING') return '';
        var self = r.maker === actor, why = !canApprove ? 'Hanya platform admin yang dapat memutuskan' : (self ? 'Pembuat tidak boleh menyetujui permintaannya sendiri' : '');
        var o = { disabled: !!why, title: why };
        return Orbis.btn('Setujui', 'platformApprove', [r.id], Object.assign({ kind: 'primary' }, o)) + ' ' + Orbis.btn('Tolak', 'platformReject', [r.id], o) + (why ? '<br><small>' + esc(why) + '</small>' : '');
      } }
    ], rows, 'Belum ada permintaan.');
    var grants = Orbis.table([{ label: 'Grant', fmt: function (x) { return esc(x.id); } }, { label: 'Tenant', fmt: function (x) { return esc(tname(d, x.tenantId)); } }, { label: 'Berakhir', fmt: function (x) { return esc(Orbis.fmtTime(x.expiresAt)); } },
      { label: '', fmt: function (x) { return Orbis.btn('Cabut', 'platformRevokeGrant', [x.id], { disabled: !Orbis.can('platform.tenant', d.session.role) }); } }], P.activeGrants(d), 'Tidak ada grant aktif.');
    return Orbis.pageHead('Approval', 'Maker/checker (ADR-0008). Aktor saat ini: ' + actor, actorSwitch(d)) + Orbis.card('Permintaan', table) + Orbis.card('Grant aktif', grants);
  };
  A.platformApprove = function (id) { var r = P.approve(id); Orbis.toast(r.result && r.result.warnings && r.result.warnings.length ? 'Disetujui dengan peringatan: ' + r.result.warnings.join('; ') : 'Disetujui'); };
  A.platformReject = function (id) { P.reject(id); Orbis.toast('Ditolak'); };
  A.platformRevokeGrant = function (id) { P.revokeGrant(id, 'dicabut oleh platform admin'); Orbis.toast('Grant dicabut'); };

  /* ---------- fleet ---------- */
  S['platform-fleet'] = function (d) {
    if (d.session.role !== 'platform') return denied();
    var tid = d.session.tenant, can = Orbis.can('platform.tenant', d.session.role);
    var scope = '<label class="sel"><span>Tenant</span><select data-change="platformScope">' + d.tenants.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === tid ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select></label>';
    var devs = F.devices(d);
    var table = Orbis.table([
      { label: 'Perangkat', fmt: function (x) { return '<b>' + esc(x.device.name) + '</b><br><small>' + esc(x.device.id) + '</small>'; } },
      { label: 'Status', fmt: function (x) { return Orbis.chip(x.device.status) + (x.device.status !== 'REVOKED' && F.expired(x.device) ? ' ' + Orbis.chip('FAILED', 'Grant kedaluwarsa') : ''); } },
      { label: 'Grant s/d', fmt: function (x) { return esc(Orbis.fmtTime(x.device.grantExpiresAt)); } },
      { label: 'Pending', right: true, fmt: function (x) { return esc(x.stats.pending); } },
      { label: 'Konflik', right: true, fmt: function (x) { return esc(x.stats.conflicts); } },
      { label: '', fmt: function (x) { return Orbis.btn('Sinkron', 'fleetSync', [x.device.id], { disabled: x.device.status === 'REVOKED' }) + ' ' + Orbis.btn('Cabut', 'fleetRevoke', [x.device.id], { disabled: x.device.status === 'REVOKED' }); } }
    ], devs, 'Belum ada perangkat untuk tenant ini.');
    var q = F.queue(d);
    var queue = Orbis.table([
      { label: 'Item', fmt: function (i) { return esc(i.id) + '<br><small>' + esc(i.clientEventId) + '</small>'; } },
      { label: 'Perangkat', fmt: function (i) { return esc(i.deviceId); } },
      { label: 'Status', fmt: function (i) { return Orbis.chip(i.status) + (i.reason ? '<br><small>' + esc(i.reason) + '</small>' : '') + (i.serverRef ? '<br><small>' + esc(i.serverRef) + '</small>' : ''); } },
      { label: '', fmt: function (i) { return i.status === 'CONFLICT' ? Orbis.btn('Coba lagi', 'fleetResolve', [i.id, 'RETRY']) + ' ' + Orbis.btn('Buang', 'fleetResolve', [i.id, 'DISCARD']) : ''; } }
    ], q, 'Antrean kosong.');
    var skus = Orbis.mine(d, 'skus');
    var devOpts = devs.map(function (x) { return [x.device.id, x.device.name]; });
    var enq = devs.length && skus.length ? '<div id="enq-form" class="row">' + Orbis.field('Perangkat', 'deviceId', devs[0].device.id, { type: 'select', options: devOpts }) +
      Orbis.field('SKU', 'skuId', skus[0].id, { type: 'select', options: skus.map(function (s) { return [s.id, s.sku]; }) }) + Orbis.field('Qty', 'qty', 1, { type: 'number', min: 1 }) +
      Orbis.field('Pembayaran', 'pay', 'cash', { type: 'select', options: [['cash', 'Tunai'], ['qris', 'QRIS (akan ditolak)']] }) + Orbis.btn('Antre transaksi demo', 'fleetEnqueue', null, { kind: 'primary' }) + '</div>' : '';
    var prov = can ? '<div id="prov-form" class="row">' + Orbis.field('Nama perangkat', 'name', '', {}) + Orbis.field('Outlet', 'outlet', (Orbis.mine(d, 'outlets')[0] || {}).id, { type: 'select', options: Orbis.mine(d, 'outlets').map(function (o) { return [o.id, o.name]; }) }) +
      Orbis.field('TTL (jam, 1-72)', 'ttl', 24, { type: 'number', min: 1 }) + Orbis.btn('Provision', 'fleetProvision') + '</div>' : '';
    return Orbis.pageHead('Armada POS Offline', 'Antrean offline hanya tunai; sinkron once-only dengan idempotency key.', scope) + Orbis.card('Perangkat', table + prov) + Orbis.card('Antrean transaksi', enq + queue);
  };
  A.platformScope = function (tid) { P.scopeTenant(tid); };
  A.fleetSync = function (id) { var r = F.sync(id); Orbis.toast('Sinkron: ' + r.synced + ' ok, ' + r.stub + ' stub, ' + r.conflicts + ' konflik'); };
  A.fleetRevoke = function (id) { F.revoke(id); Orbis.toast('Perangkat dicabut; antrean tetap tersimpan'); };
  A.fleetResolve = function (id, mode) { F.resolve(id, mode, mode === 'RETRY' ? 'dicoba ulang dari konsol platform' : 'dibuang dari konsol platform'); Orbis.toast('Konflik diselesaikan: ' + mode); };
  A.fleetEnqueue = function () {
    var f = Orbis.readForm('#enq-form'), n = parseInt(f.qty, 10);
    var ev = Orbis.read(function (d) { return 'demo-' + d.outbox.length + '-' + Orbis.clock.now(); });
    F.enqueue(f.deviceId, { clientEventId: ev, payload: { items: [{ skuId: f.skuId, qty: n }], payment: { type: f.pay }, customer: { name: 'Walk-in' }, channel: 'pos', method: 'pickup' } });
    Orbis.toast('Transaksi diantre');
  };
  A.fleetProvision = function () { var f = Orbis.readForm('#prov-form'); F.provision(f.name, f.outlet, parseInt(f.ttl, 10)); Orbis.toast('Perangkat dibuat'); };

  /* ---------- audit ---------- */
  S['platform-audit'] = function (d) {
    if (!isPlat(d)) return denied();
    var f = U.audit || {};
    var rows = P.auditQuery(d, f).slice(0, 200);
    var form = '<div id="aud-form" class="row">' + Orbis.field('Tenant', 'tenant', f.tenant || '', { type: 'select', options: [['', 'Semua']].concat(d.tenants.map(function (t) { return [t.id, t.name]; })) }) +
      Orbis.field('Aktor', 'actor', f.actor || '') + Orbis.field('Aksi', 'action', f.action || '') + Orbis.field('Cari', 'q', f.q || '') + Orbis.btn('Filter', 'platformAuditFilter', null, { kind: 'primary' }) + ' ' + Orbis.btn('Reset', 'platformAuditReset') + '</div>';
    var table = Orbis.table([{ label: 'Waktu', fmt: function (a) { return esc(Orbis.fmtTime(a.at)); } }, { label: 'Aktor', fmt: function (a) { return esc(a.actor) + '<br><small>' + esc(a.role) + '</small>'; } },
      { label: 'Tenant', fmt: function (a) { return esc(a.tenant); } }, { label: 'Aksi', fmt: function (a) { return esc(a.action); } }, { label: 'Entitas', fmt: function (a) { return esc((a.entity || '') + ' ' + (a.entityId || '')); } }], rows, 'Tidak ada entri audit.');
    return Orbis.pageHead('Audit', 'Lintas tenant, hanya platform/support. Maks 200 entri terbaru.') + form + table;
  };
  A.platformAuditFilter = function () { U.audit = Orbis.readForm('#aud-form'); Orbis.render(); };
  A.platformAuditReset = function () { U.audit = {}; Orbis.render(); };
})(typeof window !== 'undefined' ? window : globalThis);
