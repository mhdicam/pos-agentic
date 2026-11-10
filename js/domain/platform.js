/* Orbis v2 — platform domain: tenant lifecycle (maker/checker, ADR-0008), support grants with ENFORCED expiry,
   billing/plans/entitlements, offline POS fleet with a real outbox queue (ADR-0003). Client simulation only.
   Platform staff act across tenants: tenant ids passed here are TARGETS of a platform action, never a way for a
   tenant role to widen scope (every entry point checks a platform permission first). Fleet functions operate on
   the session tenant (d.session.tenant), like every other tenant-scoped module. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, P = Orbis.domain.platform = {}, F = Orbis.domain.fleet = {};

  Orbis.PERMS['fleet.operate'] = ['owner', 'manager', 'cashier', 'platform'];
  Orbis.PERMS['fleet.resolve'] = ['owner', 'manager', 'platform'];

  P.STATUSES = ['ACTIVE', 'TRIALING', 'SUSPENDED'];
  P.ACTORS = ['admin_ops', 'admin_sec'];
  P.ACTIONS = ['TENANT_STATUS', 'SUPPORT_GRANT'];
  P.MODULES = ['pos', 'storefront', 'delivery', 'inbox', 'ai'];
  P.QUOTAS = ['outlets', 'staff', 'registers', 'ai'];
  P.GRANT_MIN = 15; P.GRANT_MAX = 240;
  P.INCIDENTS = [
    { id: 'inc1', title: 'Latensi webhook WhatsApp meningkat', severity: 'MINOR', status: 'MONITORING' },
    { id: 'inc2', title: 'Sinkronisasi pembayaran QRIS tertunda 4 menit', severity: 'RESOLVED', status: 'RESOLVED' }
  ];
  P.HEALTH = [
    { name: 'API', status: 'OK' }, { name: 'Database', status: 'OK' }, { name: 'Antrean job', status: 'OK' }, { name: 'Webhook kanal', status: 'DEGRADED' }
  ];

  function tenantOf(d, id) {
    var t = d.tenants.filter(function (x) { return x.id === id; })[0];
    if (!t) throw Orbis.Err('NOT_FOUND', 'Tenant tidak ditemukan');
    return t;
  }
  function planOf(d, id) {
    var p = d.plans.filter(function (x) { return x.id === id; })[0];
    if (!p) throw Orbis.Err('NOT_FOUND', 'Plan tidak ditemukan');
    return p;
  }
  function pf(d) {
    var p = d.platform;
    ['requests', 'grants', 'flags', 'invoices', 'entitlements', 'announcements'].forEach(function (k) { p[k] = p[k] || []; });
    return p;
  }

  /* ---------- maker / checker ---------- */
  P.actor = function (d) { return d.platform.actor; };
  P.setActor = function (actor) {
    Orbis.require('platform.read');
    Orbis.need(P.ACTORS.indexOf(actor) >= 0, 'VALIDATION', 'Aktor demo tidak dikenal');
    return Orbis.tx(function (d) { d.platform.actor = actor; return actor; });
  };

  /** action: 'TENANT_STATUS' {tenantId,status,reason} | 'SUPPORT_GRANT' {tenantId,minutes,reason}. Creates PENDING request. */
  P.request = function (action, o) {
    Orbis.require('platform.request'); o = o || {};
    return Orbis.tx(function (d, ctx) {
      Orbis.need(P.ACTIONS.indexOf(action) >= 0, 'VALIDATION', 'Jenis permintaan tidak dikenal');
      var t = tenantOf(d, o.tenantId), reason = Orbis.reason(o.reason);
      var r = { id: Orbis.nextId(d, 'REQ', 4), action: action, tenantId: t.id, reason: reason, maker: pf(d).actor, makerRole: ctx.role, status: 'PENDING', createdAt: Orbis.clock.now() };
      if (action === 'TENANT_STATUS') {
        Orbis.need(P.STATUSES.indexOf(o.status) >= 0, 'VALIDATION', 'Status tenant tidak valid');
        Orbis.need(o.status !== t.status, 'NO_CHANGE', 'Tenant sudah berstatus ' + o.status);
        r.toStatus = o.status; r.fromStatus = t.status;
      } else {
        Orbis.int(o.minutes, 'Durasi grant');
        Orbis.need(o.minutes >= P.GRANT_MIN && o.minutes <= P.GRANT_MAX, 'GRANT_MINUTES', 'Durasi grant harus ' + P.GRANT_MIN + '-' + P.GRANT_MAX + ' menit');
        r.minutes = o.minutes;
      }
      d.platform.requests.push(r);
      return r;
    }, { audit: function (r) { return { action: 'platform.request.' + action, entity: 'request', entityId: r.id, detail: { tenantId: r.tenantId, maker: r.maker } }; } });
  };

  function openWarnings(d, tenantId) {
    var w = [];
    var shifts = d.shifts.filter(function (s) { return s.tenant === tenantId && !s.closedAt; }).length;
    var undelivered = d.orders.filter(function (o) { return o.tenant === tenantId && ['COMPLETED', 'CANCELLED', 'RETURNED'].indexOf(o.status) < 0; }).length;
    if (shifts) w.push(shifts + ' shift masih terbuka');
    if (undelivered) w.push(undelivered + ' pesanan belum selesai/terkirim');
    return w;
  }

  function decide(id, verdict, note) {
    Orbis.require('platform.approve');
    return Orbis.tx(function (d, ctx) {
      var r = d.platform.requests.filter(function (x) { return x.id === id; })[0];
      if (!r) throw Orbis.Err('NOT_FOUND', 'Permintaan tidak ditemukan');
      if (r.status !== 'PENDING') throw Orbis.Err('ALREADY_DECIDED', 'Permintaan sudah diputuskan dan tidak dapat diubah');
      if (d.platform.actor === r.maker) throw Orbis.Err('SELF_APPROVAL', 'Pembuat permintaan tidak boleh menyetujui/menolak permintaannya sendiri');
      r.status = verdict; r.decidedBy = d.platform.actor; r.decidedAt = Orbis.clock.now(); r.note = note ? String(note) : null;
      if (verdict === 'APPROVED') {
        var t = tenantOf(d, r.tenantId);
        if (r.action === 'TENANT_STATUS') {
          t.status = r.toStatus;
          r.result = { warnings: r.toStatus === 'SUSPENDED' ? openWarnings(d, t.id) : [] };
        } else {
          Orbis.need(r.minutes >= P.GRANT_MIN && r.minutes <= P.GRANT_MAX, 'GRANT_MINUTES', 'Durasi grant di luar batas');
          var gr = { id: Orbis.nextId(d, 'GRT', 4), tenantId: t.id, by: r.maker, requestId: r.id, approvedBy: d.platform.actor, createdAt: Orbis.clock.now(), expiresAt: Orbis.clock.now() + r.minutes * 60000, revokedAt: null };
          d.platform.grants.push(gr);
          r.result = { grantId: gr.id, expiresAt: gr.expiresAt };
        }
      }
      return r;
    }, { audit: function (r) { return { action: 'platform.request.' + verdict, entity: 'request', entityId: r.id, detail: { tenantId: r.tenantId, maker: r.maker, checker: r.decidedBy } }; } });
  }
  P.approve = function (id, note) { return decide(id, 'APPROVED', note); };
  P.reject = function (id, note) { return decide(id, 'REJECTED', note); };
  P.requests = function (d) { Orbis.require('platform.read', d.session.role); return d.platform.requests.slice().reverse(); };

  /* ---------- grants (expiry enforced via Orbis.clock) ---------- */
  P.isActive = function (d, tenantId) {
    var now = Orbis.clock.now();
    return (d.platform.grants || []).some(function (x) { return x.tenantId === tenantId && !x.revokedAt && x.expiresAt > now; });
  };
  P.activeGrants = function (d) {
    var now = Orbis.clock.now();
    return (d.platform.grants || []).filter(function (x) { return !x.revokedAt && x.expiresAt > now; });
  };
  P.revokeGrant = function (grantId, reason) {
    Orbis.require('platform.tenant');
    return Orbis.tx(function (d) {
      var gr = d.platform.grants.filter(function (x) { return x.id === grantId; })[0];
      if (!gr) throw Orbis.Err('NOT_FOUND', 'Grant tidak ditemukan');
      reason = Orbis.reason(reason);
      if (gr.revokedAt) throw Orbis.Err('ALREADY_REVOKED', 'Grant sudah dicabut');
      gr.revokedAt = Orbis.clock.now(); gr.revokeReason = reason;
      return gr;
    }, { audit: function (gr) { return { action: 'platform.grant.revoke', entity: 'grant', entityId: gr.id, detail: { tenantId: gr.tenantId } }; } });
  };

  /* ---------- tenant 360 ---------- */
  P.tenants = function (d) { Orbis.require('platform.read', d.session.role); return d.tenants.slice(); };

  /** Pure read. Support role needs an active grant for this tenant. */
  P.tenant360 = function (d, tenantId) {
    Orbis.require('platform.read', d.session.role);
    var viaGrant = d.session.role === 'support';
    if (viaGrant && !P.isActive(d, tenantId)) throw Orbis.Err('NO_ACTIVE_GRANT', 'Butuh grant akses aktif untuk membuka detail tenant ini');
    var t = tenantOf(d, tenantId);
    return {
      tenant: t, plan: planOf(d, t.plan), viaGrant: viaGrant,
      outlets: d.outlets.filter(function (o) { return o.tenant === t.id; }).length,
      staff: d.staff.filter(function (s) { return s.tenant === t.id && s.active; }).length,
      invoices: d.platform.invoices.filter(function (i) { return i.tenant === t.id; }),
      devices: d.devices.filter(function (x) { return x.tenant === t.id; }).map(function (x) { return { device: x, stats: F.stats(d, x.id, t.id) }; }),
      entitlements: P.entitlements(d, t.id)
    };
  };
  /** Opening tenant detail through a support grant is audited on every read; platform reads are plain reads. */
  P.openTenant = function (tenantId) {
    if (Orbis.db().session.role !== 'support') return Orbis.read(function (d) { return P.tenant360(d, tenantId); });
    return Orbis.tx(function (d) { return P.tenant360(d, tenantId); },
      { audit: { action: 'platform.tenant360.read', entity: 'tenant', entityId: tenantId, detail: { viaGrant: true } } });
  };

  /* ---------- billing ---------- */
  P.plans = function (d) { return d.plans.slice(); };
  /** -> {ok, blockers:[{limit,current,max}]} (never mutates). */
  P.planCheck = function (d, tenantId, planId) {
    var p = planOf(d, planId), b = [];
    var outlets = d.outlets.filter(function (o) { return o.tenant === tenantId && o.active !== false; }).length;
    var staff = d.staff.filter(function (s) { return s.tenant === tenantId && s.active; }).length;
    if (outlets > p.outlets) b.push({ limit: 'outlets', current: outlets, max: p.outlets });
    if (staff > p.staff) b.push({ limit: 'staff', current: staff, max: p.staff });
    return { ok: !b.length, blockers: b };
  };
  P.changePlan = function (tenantId, planId) {
    Orbis.require('platform.tenant');
    return Orbis.tx(function (d) {
      var t = tenantOf(d, tenantId); planOf(d, planId);
      Orbis.need(t.plan !== planId, 'NO_CHANGE', 'Tenant sudah memakai plan ini');
      var chk = P.planCheck(d, tenantId, planId);
      if (!chk.ok) {
        var e = Orbis.Err('DOWNGRADE_BLOCKED', 'Downgrade diblokir: ' + chk.blockers.map(function (x) { return x.limit + ' ' + x.current + ' > batas ' + x.max; }).join('; '));
        e.blockers = chk.blockers; throw e;
      }
      var from = t.plan; t.plan = planId;
      return { tenantId: t.id, from: from, to: planId };
    }, { audit: function (r) { return { action: 'platform.plan.change', entity: 'tenant', entityId: r.tenantId, detail: { from: r.from, to: r.to } }; } });
  };
  P.createInvoice = function (tenantId, amount, note) {
    Orbis.require('platform.tenant');
    return Orbis.tx(function (d) {
      tenantOf(d, tenantId); Orbis.int(amount, 'Nominal invoice');
      Orbis.need(amount > 0, 'VALIDATION', 'Nominal invoice harus lebih dari 0');
      var inv = { id: Orbis.nextId(d, 'INV', 3), tenant: tenantId, amount: amount, status: 'UNPAID', note: note ? String(note) : '', createdAt: Orbis.clock.now() };
      d.platform.invoices.push(inv); return inv;
    }, { audit: function (i) { return { action: 'platform.invoice.create', entity: 'invoice', entityId: i.id, detail: { tenantId: i.tenant, amount: i.amount } }; } });
  };
  /** Idempotent: a second call on a PAID invoice returns it without a new write. */
  P.markPaid = function (invoiceId) {
    Orbis.require('platform.tenant');
    var cur = Orbis.read(function (d) { return d.platform.invoices.filter(function (i) { return i.id === invoiceId; })[0]; });
    if (!cur) throw Orbis.Err('NOT_FOUND', 'Invoice tidak ditemukan');
    if (cur.status === 'PAID') return cur;
    return Orbis.tx(function (d) {
      var inv = d.platform.invoices.filter(function (i) { return i.id === invoiceId; })[0];
      Orbis.need(inv.status === 'UNPAID', 'INVALID_STATE', 'Invoice berstatus ' + inv.status + ' tidak dapat dibayar');
      inv.status = 'PAID'; inv.paidAt = Orbis.clock.now(); return inv;
    }, { audit: function (i) { return { action: 'platform.invoice.paid', entity: 'invoice', entityId: i.id, detail: { tenantId: i.tenant, amount: i.amount } }; } });
  };
  P.invoices = function (d) { Orbis.require('platform.read', d.session.role); return d.platform.invoices.slice(); };
  /** MRR = sum of ACTIVE tenants' plan price; TRIALING and SUSPENDED count 0. */
  P.mrr = function (d) {
    return Orbis.sum(d.tenants.filter(function (t) { return t.status === 'ACTIVE'; }), function (t) { return planOf(d, t.plan).price; });
  };

  P.entitlements = function (d, tenantId) {
    var t = tenantOf(d, tenantId), plan = planOf(d, t.plan), mods = {}, q = {};
    P.MODULES.forEach(function (m) { mods[m] = true; });
    P.QUOTAS.forEach(function (k) { q[k] = plan[k] || 0; });
    var ov = (d.platform.entitlements || []).filter(function (x) { return x.tenantId === tenantId; });
    ov.forEach(function (x) { if (x.kind === 'module') mods[x.key] = x.value; else q[x.key] = x.value; });
    return { modules: mods, quotas: q, overrides: ov };
  };
  /** kind 'module' (value boolean) | 'quota' (value integer >= 0). Override with mandatory reason + audit. */
  P.setEntitlement = function (tenantId, kind, key, value, reason) {
    Orbis.require('platform.tenant');
    return Orbis.tx(function (d, ctx) {
      tenantOf(d, tenantId); reason = Orbis.reason(reason);
      if (kind === 'module') {
        Orbis.need(P.MODULES.indexOf(key) >= 0, 'VALIDATION', 'Modul tidak dikenal');
        Orbis.need(typeof value === 'boolean', 'VALIDATION', 'Nilai modul harus aktif/nonaktif');
      } else if (kind === 'quota') {
        Orbis.need(P.QUOTAS.indexOf(key) >= 0, 'VALIDATION', 'Kuota tidak dikenal');
        Orbis.int(value, 'Kuota'); Orbis.need(value >= 0, 'VALIDATION', 'Kuota tidak boleh negatif');
      } else throw Orbis.Err('VALIDATION', 'Jenis entitlement tidak dikenal');
      var list = pf(d).entitlements;
      var row = list.filter(function (x) { return x.tenantId === tenantId && x.kind === kind && x.key === key; })[0];
      if (!row) { row = { id: Orbis.nextId(d, 'ENT', 4), tenantId: tenantId, kind: kind, key: key }; list.push(row); }
      row.value = value; row.reason = reason; row.by = ctx.actor; row.at = Orbis.clock.now();
      return row;
    }, { audit: function (r) { return { action: 'platform.entitlement.set', entity: 'tenant', entityId: r.tenantId, detail: { kind: r.kind, key: r.key, value: r.value } }; } });
  };

  /* ---------- flags, announcements, audit ---------- */
  P.toggleFlag = function (flagId) {
    Orbis.require('platform.tenant');
    return Orbis.tx(function (d) {
      var f = d.platform.flags.filter(function (x) { return x.id === flagId; })[0];
      if (!f) throw Orbis.Err('NOT_FOUND', 'Flag tidak ditemukan');
      f.on = !f.on; return f;
    }, { audit: function (f) { return { action: 'platform.flag.toggle', entity: 'flag', entityId: f.id, detail: { name: f.name, on: f.on } }; } });
  };
  P.saveAnnouncement = function (o) {
    Orbis.require('platform.tenant'); o = o || {};
    return Orbis.tx(function (d) {
      var title = String(o.title || '').trim(), body = String(o.body || '').trim();
      Orbis.need(title.length >= 3 && body.length >= 5, 'VALIDATION', 'Judul (min 3) dan isi (min 5) wajib diisi');
      var a = { id: Orbis.nextId(d, 'ANN', 3), title: title, body: body, status: 'DRAFT', createdAt: Orbis.clock.now() };
      pf(d).announcements.push(a); return a;
    }, { audit: function (a) { return { action: 'platform.announcement.draft', entity: 'announcement', entityId: a.id }; } });
  };
  /** Cross-tenant audit view: platform/support only. filters {tenant, actor, action, q, from, to}. Newest first. */
  P.auditQuery = function (d, f) {
    Orbis.require('platform.read', d.session.role); f = f || {};
    var q = String(f.q || '').toLowerCase();
    return d.audit.filter(function (a) {
      if (f.tenant && a.tenant !== f.tenant) return false;
      if (f.actor && String(a.actor).toLowerCase().indexOf(String(f.actor).toLowerCase()) < 0) return false;
      if (f.action && String(a.action).indexOf(f.action) < 0) return false;
      if (f.from && a.at < f.from) return false;
      if (f.to && a.at > f.to) return false;
      if (q && JSON.stringify(a).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).reverse();
  };
  P.dashboard = function (d) {
    Orbis.require('platform.read', d.session.role);
    return {
      mrr: P.mrr(d),
      paidInvoices: d.platform.invoices.filter(function (i) { return i.status === 'PAID'; }).length,
      pendingSync: d.outbox.filter(function (x) { return x.status === 'PENDING_SYNC'; }).length,
      conflicts: d.outbox.filter(function (x) { return x.status === 'CONFLICT'; }).length,
      openRequests: d.platform.requests.filter(function (r) { return r.status === 'PENDING'; }).length,
      activeGrants: P.activeGrants(d).length
    };
  };

  /** Platform staff pick which tenant the fleet console operates on (session scope switch, audited). */
  P.scopeTenant = function (tenantId) {
    Orbis.require('platform.tenant');
    return Orbis.tx(function (d) {
      tenantOf(d, tenantId); d.session.tenant = tenantId;
      d.session.outlet = (d.outlets.filter(function (o) { return o.tenant === tenantId; })[0] || {}).id;
      return tenantId;
    }, { audit: { action: 'platform.scope', entity: 'tenant', entityId: tenantId } });
  };

  /* ---------- offline POS fleet (session tenant) ---------- */
  function device(d, id) {
    var x = Orbis.mine(d, 'devices').filter(function (v) { return v.id === id; })[0];
    if (!x) throw Orbis.Err('NOT_FOUND', 'Perangkat tidak ditemukan');
    return x;
  }
  /** Counts are derived from the outbox, never stored on the device row. */
  F.stats = function (d, deviceId, tenant) {
    var t = tenant || d.session.tenant, s = { pending: 0, conflicts: 0, synced: 0, discarded: 0 };
    d.outbox.forEach(function (x) {
      if (x.tenant !== t || x.deviceId !== deviceId) return;
      if (x.status === 'PENDING_SYNC') s.pending++; else if (x.status === 'CONFLICT') s.conflicts++;
      else if (x.status === 'DISCARDED') s.discarded++; else s.synced++;
    });
    return s;
  };
  F.devices = function (d) {
    return Orbis.mine(d, 'devices').map(function (x) { return { device: x, stats: F.stats(d, x.id) }; });
  };
  F.queue = function (d, deviceId) {
    return Orbis.mine(d, 'outbox').filter(function (x) { return !deviceId || x.deviceId === deviceId; });
  };
  F.expired = function (dev) { return dev.grantExpiresAt <= Orbis.clock.now(); };

  F.provision = function (name, outlet, ttlHours) {
    Orbis.require('platform.tenant');
    return Orbis.tx(function (d) {
      name = String(name || '').trim();
      Orbis.need(name.length >= 3, 'VALIDATION', 'Nama perangkat minimal 3 karakter');
      Orbis.need(Orbis.mine(d, 'outlets').some(function (o) { return o.id === outlet; }), 'NOT_FOUND', 'Outlet tidak ditemukan');
      Orbis.int(ttlHours, 'TTL grant');
      Orbis.need(ttlHours >= 1 && ttlHours <= 72, 'GRANT_TTL', 'TTL grant perangkat harus 1-72 jam');
      var dev = { id: Orbis.nextId(d, 'POS', 3), tenant: d.session.tenant, outlet: outlet, name: name, status: 'ACTIVE', grantExpiresAt: Orbis.clock.now() + ttlHours * 3600000, createdAt: Orbis.clock.now() };
      d.devices.push(dev); return dev;
    }, { audit: function (v) { return { action: 'fleet.provision', entity: 'device', entityId: v.id }; } });
  };

  /** Append one offline transaction. item = {clientEventId, payload}. Cash only; idempotent per (device, clientEventId). */
  F.enqueue = function (deviceId, item) {
    Orbis.require('fleet.operate'); item = item || {};
    var prior = Orbis.read(function (d) { return F.queue(d, deviceId).filter(function (x) { return x.clientEventId === item.clientEventId; })[0]; });
    if (prior) return prior;
    return Orbis.tx(function (d) {
      var dev = device(d, deviceId);
      Orbis.need(typeof item.clientEventId === 'string' && item.clientEventId.length > 0, 'VALIDATION', 'clientEventId wajib diisi');
      if (dev.status === 'REVOKED') throw Orbis.Err('DEVICE_REVOKED', 'Perangkat dicabut aksesnya; antrean baru ditolak');
      if (F.expired(dev)) throw Orbis.Err('GRANT_EXPIRED', 'Grant offline perangkat kedaluwarsa; hubungkan online untuk memperbarui');
      var p = item.payload;
      if (!p || !p.payment || p.payment.type !== 'cash') throw Orbis.Err('OFFLINE_CASH_ONLY', 'Mode offline hanya menerima pembayaran tunai');
      // RD03-12: global loyalty redemption needs online validation; a promo code is also a global quota (RD03 scope note).
      if (p.redeemPoints || p.promoCode) throw Orbis.Err('OFFLINE_ONLINE_ONLY', 'Penukaran poin dan kode promo membutuhkan koneksi online');
      var row = { id: Orbis.nextId(d, 'OBX', 4), tenant: d.session.tenant, deviceId: deviceId, clientEventId: item.clientEventId, payload: Orbis.clone(p), status: 'PENDING_SYNC', createdAt: Orbis.clock.now(), attempts: 0, reason: null, serverRef: null };
      d.outbox.push(row); return row;
    }, { audit: function (r) { return { action: 'fleet.enqueue', entity: 'outbox', entityId: r.id, detail: { deviceId: r.deviceId } }; } });
  };

  /** Injectable apply handler: (d, itemClone) -> {ref, stub?}; throw Orbis.Err to mark the item CONFLICT. */
  F.defaultHandler = function (d, item) {
    var o = Orbis.domain.orders;
    if (o && typeof o.place === 'function') {
      // Server-side replay runs as the registered device (a cashier register), never as whoever pressed Sync.
      var saved = { role: d.session.role, actor: d.session.actor, outlet: d.session.outlet };
      var dev = (d.devices || []).filter(function (x) { return x.id === item.deviceId; })[0];
      d.session.role = 'cashier'; d.session.actor = 'device:' + item.deviceId; if (dev && dev.outlet) d.session.outlet = dev.outlet;
      try {
        var payload = Orbis.clone(item.payload); payload.channel = 'pos';
        var open = d.shifts.filter(function (x) { return x.tenant === d.session.tenant && x.outlet === d.session.outlet && !x.closedAt; })[0];
        if (open) payload.shiftId = open.id;
        return { ref: o.place(d, payload).id };
      } finally { d.session.role = saved.role; d.session.actor = saved.actor; d.session.outlet = saved.outlet; }
    }
    return { ref: 'STUB-' + item.clientEventId, stub: true };
  };

  F.applyHandler = F.defaultHandler;

  function replay(deviceId, actionPrefix) {
    var ids = Orbis.read(function (d) {
      return F.queue(d, deviceId).filter(function (x) { return x.status === 'PENDING_SYNC'; }).map(function (x) { return x.id; });
    });
    var sum = { synced: 0, stub: 0, conflicts: 0, skipped: 0 };
    ids.forEach(function (id) {
      try {
        var st = Orbis.tx(function (d) {
          var it = Orbis.mine(d, 'outbox').filter(function (x) { return x.id === id; })[0];
          if (!it || it.status !== 'PENDING_SYNC') return 'SKIP';          // exactly-once guard
          var res = F.applyHandler(d, Orbis.clone(it)) || {};
          it.status = res.stub ? 'ACCEPTED_STUB' : 'SYNCED'; it.serverRef = res.ref || null;
          it.syncedAt = Orbis.clock.now(); it.attempts = (it.attempts || 0) + 1; it.reason = null;
          return it.status;
        }, { audit: function (s) { return { action: actionPrefix + '.apply', entity: 'outbox', entityId: id, detail: { result: s } }; } });
        if (st === 'SKIP') sum.skipped++; else if (st === 'ACCEPTED_STUB') sum.stub++; else sum.synced++;
      } catch (e) {
        if (!e || e.name !== 'OrbisError') throw e;
        Orbis.tx(function (d) {   // handler's partial writes were rolled back with its tx; record only the conflict
          var it = Orbis.mine(d, 'outbox').filter(function (x) { return x.id === id; })[0];
          it.status = 'CONFLICT'; it.reason = e.message; it.reasonCode = e.code; it.attempts = (it.attempts || 0) + 1;
        }, { audit: { action: 'fleet.conflict', entity: 'outbox', entityId: id, detail: { code: e.code } } });
        sum.conflicts++;
      }
    });
    return sum;
  }
  /** Replay PENDING_SYNC items in order, once each. A conflict never blocks later items. Revoked devices cannot sync. */
  F.sync = function (deviceId) {
    Orbis.require('fleet.operate');
    var dev = Orbis.read(function (d) { return device(d, deviceId); });
    if (dev.status === 'REVOKED') throw Orbis.Err('DEVICE_REVOKED', 'Perangkat dicabut; gunakan pemulihan oleh platform');
    return replay(deviceId, 'fleet.sync');
  };
  /** Platform-reviewed recovery of a revoked device's pending queue (items were never deleted). */
  F.recover = function (deviceId, reason) {
    Orbis.require('platform.tenant');
    Orbis.read(function (d) { device(d, deviceId); });
    Orbis.reason(reason);
    return replay(deviceId, 'fleet.recover');
  };
  F.resolve = function (itemId, mode, reason) {
    Orbis.require('fleet.resolve');
    return Orbis.tx(function (d) {
      var it = Orbis.mine(d, 'outbox').filter(function (x) { return x.id === itemId; })[0];
      if (!it) throw Orbis.Err('NOT_FOUND', 'Item antrean tidak ditemukan');
      Orbis.need(mode === 'RETRY' || mode === 'DISCARD', 'VALIDATION', 'Mode harus RETRY atau DISCARD');
      reason = Orbis.reason(reason);
      if (it.status !== 'CONFLICT') throw Orbis.Err('NOT_CONFLICT', 'Hanya item CONFLICT yang dapat diselesaikan');
      it.resolution = { mode: mode, reason: reason, by: d.session.actor, at: Orbis.clock.now(), previous: it.reason };
      if (mode === 'RETRY') { it.status = 'PENDING_SYNC'; it.reason = null; } else { it.status = 'DISCARDED'; }   // DISCARD keeps the row + payload
      return it;
    }, { audit: function (it) { return { action: 'fleet.resolve.' + it.resolution.mode, entity: 'outbox', entityId: it.id, detail: { reason: it.resolution.reason } }; } });
  };
  F.revoke = function (deviceId) {
    Orbis.require('platform.tenant');
    var cur = Orbis.read(function (d) { return device(d, deviceId); });
    if (cur.status === 'REVOKED') return cur;
    return Orbis.tx(function (d) {
      var dev = device(d, deviceId); dev.status = 'REVOKED'; dev.revokedAt = Orbis.clock.now(); return dev;
    }, { audit: function (v) { return { action: 'fleet.revoke', entity: 'device', entityId: v.id }; } });
  };
})(typeof window !== 'undefined' ? window : globalThis);
