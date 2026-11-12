/* Orbis v2 — tenant domain (owner): business profile, opening hours, receipt, plan usage, plan-change request, audit read.
   Tenant always from session. Plan change is a REQUEST only: the platform applies it (FR-13, maker/checker). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, T = Orbis.domain.tenant = {};
  Orbis.PERMS['tenant.settings'] = ['owner'];
  Orbis.PERMS['billing.read'] = ['owner', 'finance'];
  Orbis.PERMS['billing.request'] = ['owner'];
  Orbis.PERMS['audit.read'] = ['owner'];

  T.DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  var CATEGORIES = ['F&B', 'Retail', 'Sembako', 'Fashion', 'Kesehatan', 'Jasa', 'Lainnya'];
  T.CATEGORIES = CATEGORIES;

  function me(d) { return d.tenants.filter(function (t) { return t.id === d.session.tenant; })[0]; }
  function planOf(d, id) { return d.plans.filter(function (p) { return p.id === id; })[0]; }
  function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200); }
  var HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

  /** Read model with defaults (never mutates). */
  T.profile = function (d) {
    var t = me(d), p = (d.tenantProfile || {})[t.id] || {};
    return {
      name: t.name, category: t.category || 'Lainnya', email: p.email || '', phone: p.phone || '', address: p.address || '',
      npwp: p.npwp || '', receiptHeader: p.receiptHeader || t.name, receiptFooter: p.receiptFooter || 'Terima kasih!', showNpwp: !!p.showNpwp
    };
  };
  T.hours = function (d, outletId) {
    var h = ((d.outletHours || {})[outletId]) || null;
    return h || T.DAYS.map(function () { return { open: '08:00', close: '22:00', closed: false }; });
  };

  T.saveProfile = function (f) {
    Orbis.require('tenant.settings');
    f = f || {};
    var name = str(f.name, 60), email = str(f.email, 120), phone = str(f.phone, 20).replace(/[\s-]/g, ''), npwp = str(f.npwp, 25).replace(/[.\-\s]/g, '');
    Orbis.need(name.length >= 2, 'VALIDATION', 'Nama bisnis 2-60 karakter');
    Orbis.need(CATEGORIES.indexOf(f.category) >= 0, 'VALIDATION', 'Kategori tidak valid');
    Orbis.need(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'VALIDATION', 'Format email tidak valid');
    Orbis.need(!phone || /^\+?\d{9,15}$/.test(phone), 'VALIDATION', 'Nomor telepon harus 9-15 digit');
    Orbis.need(!npwp || /^\d{15,16}$/.test(npwp), 'VALIDATION', 'NPWP harus 15 atau 16 digit');
    return Orbis.tx(function (d) {
      var t = me(d);
      d.tenantProfile = d.tenantProfile || {};
      t.name = name; t.category = f.category;
      d.tenantProfile[t.id] = {
        email: email, phone: phone, address: str(f.address, 200), npwp: npwp,
        receiptHeader: str(f.receiptHeader, 60) || name, receiptFooter: str(f.receiptFooter, 120), showNpwp: !!f.showNpwp && !!npwp
      };
      return d.tenantProfile[t.id];
    }, { audit: { action: 'tenant.profile.update', entity: 'tenant', entityId: Orbis.db().session.tenant } });
  };

  /** rows: 7 x {open, close, closed}. Close must be after open (no overnight shifts in prototype). */
  T.saveHours = function (outletId, rows) {
    Orbis.require('tenant.settings');
    Orbis.need(Array.isArray(rows) && rows.length === 7, 'VALIDATION', 'Jam buka harus 7 hari');
    var clean = rows.map(function (r, i) {
      if (r.closed) return { open: '', close: '', closed: true };
      Orbis.need(HHMM.test(r.open) && HHMM.test(r.close), 'VALIDATION', 'Format jam ' + T.DAYS[i] + ' harus HH:MM');
      Orbis.need(r.close > r.open, 'VALIDATION', 'Jam tutup ' + T.DAYS[i] + ' harus setelah jam buka');
      return { open: r.open, close: r.close, closed: false };
    });
    return Orbis.tx(function (d) {
      var o = Orbis.mine(d, 'outlets').filter(function (x) { return x.id === outletId; })[0];
      Orbis.need(o, 'NOT_FOUND', 'Outlet tidak ditemukan');
      d.outletHours = d.outletHours || {};
      d.outletHours[o.id] = clean;
      return clean;
    }, { audit: { action: 'outlet.hours.update', entity: 'outlet', entityId: outletId } });
  };

  /* ---------- billing (read: owner/finance) ---------- */
  T.usage = function (d) {
    Orbis.require('billing.read', d.session.role);
    var t = me(d), p = planOf(d, t.plan) || {};
    var count = function (c, f) { return Orbis.mine(d, c).filter(f || function () { return true; }).length; };
    return {
      tenant: t, plan: p,
      rows: [
        { key: 'outlets', label: 'Outlet aktif', used: count('outlets', function (o) { return o.active !== false; }), max: p.outlets },
        { key: 'staff', label: 'Staf aktif', used: count('staff', function (s) { return s.active; }), max: p.staff },
        { key: 'registers', label: 'Register POS', used: count('devices', function (x) { return x.status !== 'REVOKED'; }), max: p.registers },
        { key: 'ai', label: 'Kredit AI bulan ini', used: t.aiUsed || 0, max: p.ai }
      ]
    };
  };
  T.invoices = function (d) {
    Orbis.require('billing.read', d.session.role);
    return d.platform.invoices.filter(function (i) { return i.tenant === d.session.tenant; }).slice().reverse();
  };
  T.planRequests = function (d) {
    return (d.planRequests || []).filter(function (r) { return r.tenant === d.session.tenant; }).slice().reverse();
  };
  /** Owner asks the platform to change plan. One PENDING request per tenant; downgrade checked against current usage. */
  T.requestPlan = function (planId, note) {
    Orbis.require('billing.request');
    return Orbis.tx(function (d, ctx) {
      var t = me(d), p = planOf(d, planId);
      Orbis.need(p, 'NOT_FOUND', 'Paket tidak ditemukan');
      Orbis.need(p.id !== t.plan, 'NO_CHANGE', 'Anda sudah memakai paket ' + p.name);
      d.planRequests = d.planRequests || [];
      Orbis.need(!d.planRequests.some(function (r) { return r.tenant === t.id && r.status === 'PENDING'; }), 'DUPLICATE', 'Masih ada permintaan paket yang menunggu');
      var u = T.usage(d).rows.filter(function (r) { return r.key !== 'ai' && r.used > p[r.key]; });
      Orbis.need(!u.length, 'DOWNGRADE_BLOCKED', 'Turun paket diblokir: ' + u.map(function (r) { return r.label + ' ' + r.used + ' > ' + p[r.key]; }).join('; '));
      var r = { id: Orbis.nextId(d, 'PLR', 4), tenant: t.id, from: t.plan, to: p.id, note: str(note, 200), status: 'PENDING', by: ctx.actor, at: Orbis.clock.now() };
      d.planRequests.push(r);
      return r;
    }, { audit: function (r) { return { action: 'billing.plan.request', entity: 'tenant', entityId: r.tenant, detail: { from: r.from, to: r.to } }; } });
  };
  T.cancelPlanRequest = function (id) {
    Orbis.require('billing.request');
    return Orbis.tx(function (d) {
      var r = (d.planRequests || []).filter(function (x) { return x.id === id && x.tenant === d.session.tenant; })[0];
      Orbis.need(r, 'NOT_FOUND', 'Permintaan tidak ditemukan');
      Orbis.need(r.status === 'PENDING', 'INVALID_STATE', 'Permintaan sudah ' + r.status);
      r.status = 'CANCELLED';
      return r;
    }, { audit: { action: 'billing.plan.cancel', entity: 'planRequest', entityId: id } });
  };

  /** Platform admin applies or rejects a tenant's plan request. Apply reuses platform.changePlan rules (downgrade guard). */
  T.resolvePlanRequest = function (id, approve, reason) {
    Orbis.require('platform.tenant');
    var r = Orbis.read(function (d) { return (d.planRequests || []).filter(function (x) { return x.id === id; })[0]; });
    Orbis.need(r, 'NOT_FOUND', 'Permintaan tidak ditemukan');
    Orbis.need(r.status === 'PENDING', 'INVALID_STATE', 'Permintaan sudah ' + r.status);
    if (approve) {
      var P = Orbis.domain.platform;
      Orbis.need(P && P.changePlan, 'UNAVAILABLE', 'Modul platform belum tersedia');
      P.changePlan(r.tenant, r.to);
    } else {
      reason = Orbis.reason(reason, 'Alasan penolakan');
    }
    return Orbis.tx(function (d) {
      var x = d.planRequests.filter(function (y) { return y.id === id; })[0];
      x.status = approve ? 'APPROVED' : 'REJECTED'; x.decidedAt = Orbis.clock.now(); x.reason = approve ? '' : reason;
      return x;
    }, { audit: function (x) { return { action: 'platform.plan.request.' + (approve ? 'approve' : 'reject'), entity: 'planRequest', entityId: x.id, tenant: x.tenant }; } });
  };

  /** Onboarding checklist (PRD activation: outlet + 5 items + 1 sale; plus store published, team invited). */
  T.onboarding = function (d) {
    var sf = (d.storefront || {})[d.session.tenant];
    var steps = [
      { key: 'profile', label: 'Lengkapi profil bisnis', done: !!((d.tenantProfile || {})[d.session.tenant] || {}).phone, route: 'settings' },
      { key: 'catalog', label: 'Tambah minimal 5 produk', done: Orbis.mine(d, 'products').length >= 5, route: 'catalog' },
      { key: 'team', label: 'Undang tim (minimal 2 staf)', done: Orbis.mine(d, 'staff').filter(function (s) { return s.active && s.role !== 'owner'; }).length >= 2, route: 'team' },
      { key: 'store', label: 'Terbitkan toko online', done: !!(sf && sf.published), route: 'storefront' },
      { key: 'sale', label: 'Catat transaksi pertama', done: Orbis.mine(d, 'orders').length > 0, route: 'pos' }
    ];
    return { steps: steps, done: steps.filter(function (s) { return s.done; }).length };
  };

  /** Items waiting on someone (owner "needs action" panel). Counts only; screens link to the owning route. */
  T.attention = function (d) {
    var c = function (coll, f) { return Orbis.mine(d, coll).filter(f).length; };
    var inv = Orbis.domain.inventory;
    return [
      { label: 'Biaya menunggu persetujuan', n: c('expenses', function (e) { return e.status === 'PENDING'; }), route: 'expenses', tone: 'PENDING' },
      { label: 'PO menunggu persetujuan', n: c('purchaseOrders', function (p) { return p.status === 'SUBMITTED'; }), route: 'procurement', tone: 'PENDING' },
      { label: 'Refund menunggu keputusan', n: c('refunds', function (r) { return r.status === 'REQUESTED'; }), route: 'refunds', tone: 'PENDING' },
      { label: 'Setoran COD belum diverifikasi', n: c('remittances', function (r) { return r.status === 'SUBMITTED'; }), route: 'cod', tone: 'PENDING' },
      { label: 'Pesanan online menunggu diproses', n: c('orders', function (o) { return o.channel === 'store' && o.status === 'PLACED'; }), route: 'orders', tone: 'PENDING' },
      { label: 'Stok menipis', n: inv ? inv.catalog(d).filter(function (r) { return !r.sku.archived && inv.isLow(d, r); }).length : 0, route: Orbis.domain.stock ? 'stock' : 'procurement', tone: 'FAILED' },
      { label: 'Transaksi offline belum sinkron', n: c('outbox', function (x) { return x.status === 'PENDING_SYNC'; }), route: Orbis.domain.trust ? 'sync' : 'overview', tone: 'FAILED' }
    ].filter(function (x) { return x.n > 0; }).concat(Orbis.domain.trust ? Orbis.domain.trust.attention(d) : []);
  };

  /* ---------- audit (owner, own tenant only, newest first) ---------- */
  T.audit = function (d, f) {
    Orbis.require('audit.read', d.session.role);
    f = f || {};
    var q = str(f.q, 60).toLowerCase();
    return d.audit.filter(function (a) {
      if (a.tenant !== d.session.tenant) return false;
      if (f.area && String(a.action).split('.')[0] !== f.area) return false;
      if (q && (String(a.action) + ' ' + a.actor + ' ' + (a.entityId || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).slice().reverse();
  };
})(typeof window !== 'undefined' ? window : globalThis);
