/* Orbis v2 — tenant back-office: Indonesian business settings (RD-16). Tax PBJT/PPN per outlet, service, pembulatan,
   payment methods, receipt design. Implements Orbis.hooks.charges / tenderEnabled. Pure domain, integer IDR.
   Data: d.bizSettings[tenant] = { tax, outletTax:{outletId: tax}, rounding, payments, receipt }. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, B = Orbis.domain.bizSettings = {};
  var orders = Orbis.domain.orders;

  B.TENDERS = ['cash', 'qris', 'transfer', 'edc', 'cod'];
  B.POS_TENDERS = ['cash', 'qris', 'transfer'];          // tenders sales.js can actually take at the counter
  B.UNITS = [0, 100, 500, 1000];
  B.MODES = ['down', 'nearest', 'up'];
  var DEF_PAY = { cash: { enabled: true }, qris: { enabled: true, mdr: 0.3 }, transfer: { enabled: true, accounts: [] }, edc: { enabled: false }, cod: { enabled: true } };
  var DEF_RECEIPT = { paper: '58', logo: true, header: '', footer: '', showNpwp: false, showTax: true, showCashier: true, showQr: false };

  function cfg(d) { return ((d.bizSettings || {})[d.session.tenant]) || {}; }
  function num(v) { return typeof v === 'number' ? v : Number(v); }
  function bool(v) { return v === true || v === 'true' || v === 'on' || v === 1; }
  function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }
  function audit(action, id) { return { audit: { action: action, entity: 'tenant', entityId: id || Orbis.db().session.tenant } }; }
  function save(key, val, action) {
    return Orbis.tx(function (d) {
      d.bizSettings = d.bizSettings || {};
      var c = d.bizSettings[d.session.tenant] = d.bizSettings[d.session.tenant] || {};
      c[key] = val; return val;
    }, audit(action));
  }

  /* ---------- reads (defaults merged, never mutate) ---------- */
  /** Effective tax config for an outlet: outlet override > tenant default > null (legacy orders.settings). */
  B.taxFor = function (d, outlet) { var c = cfg(d); return (c.outletTax && c.outletTax[outlet]) || c.tax || null; };
  B.rounding = function (d) { return cfg(d).rounding || { unit: 0, mode: 'nearest', scope: 'cash' }; };
  B.payments = function (d) { var p = cfg(d).payments || {}, o = {}; B.TENDERS.forEach(function (k) { o[k] = Object.assign({}, DEF_PAY[k], p[k] || {}); }); return o; };
  B.receipt = function (d) {
    var r = Object.assign({}, DEF_RECEIPT, cfg(d).receipt || {}), p = Orbis.domain.tenant.profile(d);
    if (!cfg(d).receipt) r.showNpwp = p.showNpwp;
    r.header = r.header || p.receiptHeader; r.footer = r.footer || p.receiptFooter;
    return r;
  };

  /* ---------- pure math ---------- */
  /** Basis points of the effective rate. PPN with DPP 11/12: 12% -> 1100 bp (effective 11%). */
  B.bp = function (t) { if (!t || t.type === 'none') return 0; var bp = Math.round(t.rate * 100); return t.type === 'ppn' && t.dpp ? Math.round(bp * 11 / 12) : bp; };
  B.label = function (t) {
    if (!t || t.type === 'none') return undefined;
    var l = t.type === 'pbjt' ? 'PBJT ' + t.rate + '%' : 'PPN ' + t.rate + '%' + (t.dpp ? ' DPP 11/12' : '');
    return t.mode === 'inclusive' ? l + ' (termasuk)' : l;
  };
  B.roundTo = function (x, unit, mode) {
    if (!unit) return x;
    if (mode === 'down') return Math.floor(x / unit) * unit;
    if (mode === 'up') return Math.ceil(x / unit) * unit;
    return Math.floor((x + unit / 2) / unit) * unit;          // nearest, half up
  };
  /** Full breakdown. t = tax config or null (legacy {tax, service} percents). Every component Math.round-ed separately. */
  B.calc = function (t, legacy, rnd, base, fee, tender) {
    var service, tax = 0, taxIncluded = 0, label;
    if (!t) {
      tax = Math.round(base * legacy.tax / 100); service = Math.round(base * legacy.service / 100);
    } else {
      var bp = B.bp(t), G;
      service = Math.round(base * (t.service || 0) / 100);
      G = base + (t.taxOnService ? service : 0);
      if (t.mode === 'inclusive') taxIncluded = Math.round(G * bp / (10000 + bp)); else tax = Math.round(G * bp / 10000);
      label = B.label(t);
    }
    var grand = base + tax + service + (fee || 0), rounding = 0;
    if (rnd && rnd.unit && (rnd.scope === 'all' || tender === 'cash')) {
      var r = B.roundTo(grand, rnd.unit, rnd.mode);
      rounding = r > 0 ? r - grand : 0;
    }
    return { tax: tax, service: service, rounding: rounding, taxLabel: label, taxIncluded: taxIncluded, total: grand + rounding };
  };

  /* ---------- hooks ---------- */
  B.charges = function (d, x) {
    return B.calc(B.taxFor(d, x.outlet || d.session.outlet), orders.settings(d), B.rounding(d), x.base, x.method === 'delivery' ? orders.DELIVERY_FEE : 0, x.tender);
  };
  B.tenderEnabled = function (d, type) { var p = B.payments(d)[type]; return !!(p && p.enabled); };
  B.install = function () { Orbis.hooks.charges = B.charges; Orbis.hooks.tenderEnabled = B.tenderEnabled; };
  B.install();

  /* ---------- validation + writes (owner: tenant.settings) ---------- */
  function cleanTax(f) {
    var type = f.type || 'none';
    Orbis.need(['none', 'pbjt', 'ppn'].indexOf(type) >= 0, 'VALIDATION', 'Jenis pajak tidak valid');
    var rate = type === 'none' ? 0 : num(f.rate), service = num(f.service || 0), mode = f.mode || 'exclusive';
    Orbis.need(isFinite(rate) && Math.abs(rate * 100 - Math.round(rate * 100)) < 1e-9, 'VALIDATION', 'Tarif pajak maksimal 2 desimal');
    if (type === 'pbjt') Orbis.need(rate >= 0 && rate <= 10, 'VALIDATION', 'Tarif PBJT 0-10% (batas UU HKPD)');
    if (type === 'ppn') Orbis.need(rate === 12, 'VALIDATION', 'Tarif PPN 12% (pakai DPP 11/12 untuk tarif efektif 11%)');
    Orbis.need(isFinite(service) && service >= 0 && service <= 20, 'VALIDATION', 'Service charge 0-20%');
    Orbis.need(mode === 'exclusive' || mode === 'inclusive', 'VALIDATION', 'Mode harga tidak valid');
    return { type: type, rate: rate, dpp: type === 'ppn' && bool(f.dpp), mode: mode, service: service, taxOnService: bool(f.taxOnService) };
  }
  B.cleanTax = cleanTax;
  /** outlet = '' (tenant default) or an outlet id of this tenant. */
  B.saveTax = function (outlet, f) {
    Orbis.require('tenant.settings');
    var t = cleanTax(f || {});
    return Orbis.tx(function (d) {
      d.bizSettings = d.bizSettings || {};
      var c = d.bizSettings[d.session.tenant] = d.bizSettings[d.session.tenant] || {};
      if (!outlet) { c.tax = t; return t; }
      Orbis.need(Orbis.mine(d, 'outlets').some(function (o) { return o.id === outlet; }), 'NOT_FOUND', 'Outlet tidak ditemukan');
      c.outletTax = c.outletTax || {}; c.outletTax[outlet] = t; return t;
    }, audit('settings.tax', outlet));
  };
  B.clearOutletTax = function (outlet) {
    Orbis.require('tenant.settings');
    return Orbis.tx(function (d) {
      var c = (d.bizSettings || {})[d.session.tenant];
      Orbis.need(c && c.outletTax && c.outletTax[outlet], 'NOT_FOUND', 'Outlet memakai pengaturan tenant');
      delete c.outletTax[outlet];
    }, audit('settings.tax.reset', outlet));
  };
  B.cleanRounding = function (f) {
    var unit = num(f.unit), mode = f.mode || 'nearest', scope = f.scope || 'cash';
    Orbis.need(B.UNITS.indexOf(unit) >= 0, 'VALIDATION', 'Pembulatan: pilih 0, 100, 500 atau 1.000');
    Orbis.need(B.MODES.indexOf(mode) >= 0, 'VALIDATION', 'Mode pembulatan tidak valid');
    Orbis.need(scope === 'cash' || scope === 'all', 'VALIDATION', 'Cakupan pembulatan tidak valid');
    return { unit: unit, mode: mode, scope: scope };
  };
  B.saveRounding = function (f) { Orbis.require('tenant.settings'); return save('rounding', B.cleanRounding(f || {}), 'settings.rounding'); };
  /** f = {cash, qris, transfer, edc, cod: bool, qrisMdr: number, accounts: [{bank, number, name}]} */
  B.savePayments = function (f) {
    Orbis.require('tenant.settings');
    f = f || {};
    var accounts = (f.accounts || []).map(function (a) { return { bank: str(a.bank, 40), number: str(a.number, 30).replace(/[\s-]/g, ''), name: str(a.name, 60) }; })
      .filter(function (a) { return a.bank || a.number || a.name; });
    accounts.forEach(function (a) { Orbis.need(a.bank && /^\d{6,20}$/.test(a.number) && a.name.length >= 2, 'VALIDATION', 'Rekening: bank, no rek (6-20 digit) dan atas nama wajib'); });
    var p = {};
    B.TENDERS.forEach(function (k) { p[k] = { enabled: bool(f[k]) }; });
    Orbis.need(B.POS_TENDERS.some(function (k) { return p[k].enabled; }), 'VALIDATION', 'Minimal satu metode bayar kasir (tunai, QRIS, transfer) aktif');
    Orbis.need(!p.transfer.enabled || accounts.length, 'VALIDATION', 'Transfer bank butuh minimal satu rekening');
    var mdr = num(f.qrisMdr == null || f.qrisMdr === '' ? 0.3 : f.qrisMdr);
    Orbis.need(isFinite(mdr) && mdr >= 0 && mdr <= 5, 'VALIDATION', 'MDR QRIS 0-5%');
    p.qris.mdr = mdr; p.transfer.accounts = accounts;
    return save('payments', p, 'settings.payments');
  };
  B.saveReceipt = function (f) {
    Orbis.require('tenant.settings');
    f = f || {};
    Orbis.need(f.paper === '58' || f.paper === '80', 'VALIDATION', 'Lebar kertas 58 atau 80 mm');
    var lines = function (v) { return str(v, 400).split('\n').map(function (l) { return l.trim().slice(0, 48); }).filter(Boolean).slice(0, 4).join('\n'); };
    return save('receipt', { paper: f.paper, logo: bool(f.logo), header: lines(f.header), footer: lines(f.footer), showNpwp: bool(f.showNpwp),
      showTax: bool(f.showTax), showCashier: bool(f.showCashier), showQr: bool(f.showQr) }, 'settings.receipt');
  };
  /** Kopi Awan preset: PBJT 10% exclusive (DKI, X3), service 0, rounding nearest 100 on cash. */
  B.applyPreset = function () {
    return Orbis.batch(function () {
      B.saveTax('', { type: 'pbjt', rate: 10, mode: 'exclusive', service: 0 });
      return B.saveRounding({ unit: 100, mode: 'nearest', scope: 'cash' });
    });
  };

  /* ---------- receipt text + WhatsApp ---------- */
  B.waPhone = function (phone) {
    var s = String(phone || '').replace(/\D/g, '');
    if (s.indexOf('62') === 0) return s; if (s.indexOf('0') === 0) return '62' + s.slice(1);
    return s.length >= 9 ? '62' + s : '';
  };
  /** r = receipt config override (screen preview of an unsaved draft). */
  B.receiptLines = function (d, o, r) {
    r = r || B.receipt(d); var p = Orbis.domain.tenant.profile(d), L = [], idr = Orbis.idr;
    r.header.split('\n').forEach(function (l) { L.push(l); });
    if (r.showNpwp && p.npwp) L.push('NPWP ' + p.npwp);
    L.push(o.id + ' · ' + Orbis.fmtTime(o.createdAt));
    if (r.showCashier && o.createdBy) L.push('Kasir: ' + o.createdBy);
    o.items.forEach(function (i) {
      L.push(i.qty + ' x ' + i.name + ' ' + idr(i.qty * i.price));
      if (i.modifiers && i.modifiers.length) L.push('  + ' + i.modifiers.map(function (m) { return m.name + (m.price ? ' ' + idr(m.price) : ''); }).join(', '));
      if (i.note) L.push('  "' + i.note + '"');
    });
    L.push('Subtotal ' + idr(o.subtotal));
    if (o.discount) L.push('Diskon -' + idr(o.discount));
    if (o.service) L.push('Service ' + idr(o.service));
    if (r.showTax && o.tax) L.push((o.taxLabel || 'Pajak') + ' ' + idr(o.tax));
    if (r.showTax && o.taxIncluded) L.push((o.taxLabel || 'Pajak') + ' ' + idr(o.taxIncluded));
    if (o.deliveryFee) L.push('Ongkir ' + idr(o.deliveryFee));
    if (o.rounding) L.push('Pembulatan ' + (o.rounding < 0 ? '-' : '') + idr(Math.abs(o.rounding)));
    L.push('Total ' + idr(o.total));
    if (o.change) L.push('Kembalian ' + idr(o.change));
    if (r.showQr) L.push('Lacak pesanan: #/track ' + o.id);
    r.footer.split('\n').forEach(function (l) { L.push(l); });
    return L.filter(function (l) { return l !== ''; });
  };
  /** wa.me link with the text receipt, or null when the order has no valid customer phone. */
  B.waLink = function (d, o) {
    var ph = B.waPhone(o && o.customer && o.customer.phone);
    return ph ? 'https://wa.me/' + ph + '?text=' + encodeURIComponent(B.receiptLines(d, o).join('\n')) : null;
  };

  /* ---------- seed: Freshmart retail = PPN 12% DPP 11/12 inclusive. Kopi Awan stays legacy (sales tests assume 0 tax) ---------- */
  Orbis.seedHooks.push(function (db) {
    db.bizSettings = db.bizSettings || {};
    db.bizSettings.t2 = { tax: { type: 'ppn', rate: 12, dpp: true, mode: 'inclusive', service: 0, taxOnService: false } };
  });
  // demo history: after 30 days of history, Kopi Awan switches to the PBJT preset so new orders show PBJT + rounding
  (Orbis.demoHooks = Orbis.demoHooks || []).push(function (ctx) { ctx.as('owner', 'Rina (Owner)', 'o1'); B.applyPreset(); });
})(typeof window !== 'undefined' ? window : globalThis);
