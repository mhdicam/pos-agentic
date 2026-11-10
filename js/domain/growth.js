/* Orbis v2 — growth domain: promos, members (points/tiers), storefront (draft vs published, ADR-0006).
   Pure logic, no DOM. Tenant always from d.session.tenant except storefront.publicView/track (public reads).
   Functions taking `d` first run inside the CALLER's transaction (called by sales/orders.place). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis;
  Orbis.PERMS['member.settings'] = ['owner', 'manager'];

  var promos = Orbis.domain.promos = {};
  var members = Orbis.domain.members = {};
  var storefront = Orbis.domain.storefront = {};

  function find(d, coll, id) { return Orbis.mine(d, coll).filter(function (r) { return r.id === id; })[0]; }
  function str(v) { return String(v == null ? '' : v).trim(); }
  function isDay(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var t = new Date(s + 'T00:00:00Z');
    return !isNaN(t.getTime()) && t.toISOString().slice(0, 10) === s;
  }
  function toInt(v, label) {
    if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) v = parseInt(v, 10);
    return Orbis.int(v, label);
  }

  /* ======================= PROMOS ======================= */
  var CHANNELS = ['pos', 'store'];
  var CODE_RE = /^[A-Z0-9_-]{3,24}$/;

  function normPromo(d, spec, selfId) {
    var name = str(spec.name);
    Orbis.need(name.length >= 2 && name.length <= 60, 'VALIDATION', 'Nama promo 2-60 karakter');
    var code = str(spec.code).toUpperCase();
    Orbis.need(CODE_RE.test(code), 'VALIDATION', 'Kode promo 3-24 karakter: huruf, angka, _ atau -');
    Orbis.need(!Orbis.mine(d, 'promos').some(function (p) { return p.id !== selfId && p.code.toUpperCase() === code; }), 'DUPLICATE_CODE', 'Kode promo sudah dipakai');
    Orbis.need(spec.type === 'percent' || spec.type === 'fixed', 'VALIDATION', 'Tipe promo harus percent atau fixed');
    var value = toInt(spec.value, 'Nilai promo');
    if (spec.type === 'percent') Orbis.need(value >= 1 && value <= 100, 'VALIDATION', 'Persen harus 1-100');
    else Orbis.need(value >= 1, 'VALIDATION', 'Nilai potongan minimal Rp 1');
    var minPurchase = spec.minPurchase == null || spec.minPurchase === '' ? 0 : toInt(spec.minPurchase, 'Min. belanja');
    var maxDiscount = spec.maxDiscount == null || spec.maxDiscount === '' ? 0 : toInt(spec.maxDiscount, 'Maks. diskon');
    Orbis.need(minPurchase >= 0 && maxDiscount >= 0, 'VALIDATION', 'Min. belanja / maks. diskon tidak boleh negatif');
    var quota = null;
    if (spec.quota != null && spec.quota !== '') { quota = toInt(spec.quota, 'Kuota'); Orbis.need(quota >= 1, 'VALIDATION', 'Kuota minimal 1'); }
    var start = str(spec.start), end = str(spec.end);
    Orbis.need(isDay(start) && isDay(end), 'VALIDATION', 'Tanggal harus format YYYY-MM-DD');
    Orbis.need(start <= end, 'VALIDATION', 'Tanggal mulai tidak boleh setelah tanggal akhir');
    var channels = Array.isArray(spec.channels) && spec.channels.length ? spec.channels : CHANNELS.slice();
    Orbis.need(channels.every(function (c) { return CHANNELS.indexOf(c) >= 0; }), 'VALIDATION', 'Kanal promo tidak dikenal');
    return { name: name, code: code, type: spec.type, value: value, minPurchase: minPurchase, maxDiscount: maxDiscount, quota: quota, start: start, end: end, channels: channels.slice() };
  }

  /** Display status: an ACTIVE promo past its end date is EXPIRED. */
  promos.statusOf = function (d, p) {
    if (p.status === 'ACTIVE' && Orbis.clock.day() > p.end) return 'EXPIRED';
    return p.status;
  };
  promos.list = function (d) {
    return Orbis.mine(d, 'promos').map(function (p) { var c = Orbis.clone(p); c.effective = promos.statusOf(d, p); return c; });
  };

  promos.create = function (spec) {
    Orbis.require('promo.write');
    return Orbis.tx(function (d) {
      var f = normPromo(d, spec);
      var status = spec.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT';
      if (status === 'ACTIVE') Orbis.need(f.end >= Orbis.clock.day(), 'VALIDATION', 'Promo sudah melewati tanggal akhir');
      var p = Object.assign({ id: Orbis.nextId(d, 'PRM', 4), tenant: d.session.tenant, used: 0, status: status, createdAt: Orbis.clock.now() }, f);
      d.promos.push(p);
      return Orbis.clone(p);
    }, { audit: function (r) { return { action: 'promo.create', entity: 'promo', entityId: r.id }; } });
  };

  promos.update = function (id, patch) {
    Orbis.require('promo.write');
    return Orbis.tx(function (d) {
      var p = find(d, 'promos', id);
      Orbis.need(p, 'NOT_FOUND', 'Promo tidak ditemukan');
      Orbis.need(promos.statusOf(d, p) !== 'EXPIRED', 'INVALID_STATE', 'Promo kedaluwarsa tidak dapat diubah');
      var merged = Object.assign({}, p, patch || {});
      var f = normPromo(d, merged, id);
      Orbis.need(f.quota == null || f.quota >= p.used, 'VALIDATION', 'Kuota tidak boleh di bawah pemakaian (' + p.used + ')');
      Object.assign(p, f);
      return Orbis.clone(p);
    }, { audit: { action: 'promo.update', entity: 'promo', entityId: id } });
  };

  function setStatus(id, to, from, action) {
    Orbis.require('promo.write');
    return Orbis.tx(function (d) {
      var p = find(d, 'promos', id);
      Orbis.need(p, 'NOT_FOUND', 'Promo tidak ditemukan');
      Orbis.need(from.indexOf(p.status) >= 0 && promos.statusOf(d, p) !== 'EXPIRED', 'INVALID_STATE', 'Status promo ' + p.status + ' tidak bisa diubah ke ' + to);
      if (to === 'ACTIVE') Orbis.need(p.end >= Orbis.clock.day(), 'VALIDATION', 'Promo sudah melewati tanggal akhir');
      p.status = to;
      return Orbis.clone(p);
    }, { audit: { action: action, entity: 'promo', entityId: id } });
  }
  promos.pause = function (id) { return setStatus(id, 'PAUSED', ['ACTIVE'], 'promo.pause'); };
  promos.activate = function (id) { return setStatus(id, 'ACTIVE', ['DRAFT', 'PAUSED'], 'promo.activate'); };

  /** Validate and price a promo code. Does NOT consume. Throws PROMO_INVALID with a specific reason. */
  promos.quote = function (d, o) {
    function bad(msg) { throw Orbis.Err('PROMO_INVALID', msg); }
    o = o || {};
    var code = str(o.code).toUpperCase();
    if (!code) bad('Kode promo kosong');
    var subtotal = Orbis.int(o.subtotal, 'Subtotal');
    if (subtotal <= 0) bad('Subtotal harus lebih dari 0');
    var p = Orbis.mine(d, 'promos').filter(function (x) { return x.code.toUpperCase() === code; })[0];
    if (!p) bad('Kode promo tidak ditemukan');
    if (p.status === 'DRAFT') bad('Promo belum aktif (masih draft)');
    if (p.status === 'PAUSED') bad('Promo sedang dijeda');
    if (p.status === 'EXPIRED') bad('Promo sudah kedaluwarsa');
    if (p.status !== 'ACTIVE') bad('Promo tidak dapat dipakai');
    var day = Orbis.clock.day();
    if (day < p.start) bad('Promo belum dimulai (mulai ' + p.start + ')');
    if (day > p.end) bad('Promo sudah berakhir (' + p.end + ')');
    if (o.channel && p.channels && p.channels.indexOf(o.channel) < 0) bad('Promo tidak berlaku di kanal ini');
    if (p.quota != null && p.used >= p.quota) bad('Kuota promo habis');
    if (subtotal < p.minPurchase) bad('Belanja minimal ' + Orbis.idr(p.minPurchase) + ' untuk promo ini');
    var disc = p.type === 'percent' ? Math.floor(subtotal * p.value / 100) : p.value;
    if (p.maxDiscount > 0) disc = Math.min(disc, p.maxDiscount);
    disc = Math.min(disc, subtotal);
    return { promoId: p.id, discount: disc };
  };

  /** Count one use for orderId. Idempotent per orderId; refuses beyond quota. Runs in caller's tx. */
  promos.consume = function (d, promoId, orderId) {
    Orbis.need(orderId, 'VALIDATION', 'orderId wajib');
    var p = find(d, 'promos', promoId);
    Orbis.need(p, 'NOT_FOUND', 'Promo tidak ditemukan');
    d.promoUse = d.promoUse || [];
    var prev = d.promoUse.filter(function (u) { return u.tenant === d.session.tenant && u.orderId === orderId; })[0];
    if (prev) {
      Orbis.need(prev.promoId === promoId, 'PROMO_INVALID', 'Satu pesanan hanya boleh satu promo (tanpa penumpukan)');
      return { promoId: promoId, used: p.used, idempotent: true };
    }
    Orbis.need(p.quota == null || p.used < p.quota, 'PROMO_INVALID', 'Kuota promo habis');
    p.used += 1;
    d.promoUse.push({ id: Orbis.nextId(d, 'PUS', 5), tenant: d.session.tenant, promoId: promoId, orderId: orderId, at: Orbis.clock.now() });
    return { promoId: promoId, used: p.used, idempotent: false };
  };

  /* ======================= MEMBERS ======================= */
  var DEFAULT_SETTINGS = { earnUnit: 10000, redeemValue: 100, maxPercent: 50 };

  members.tier = function (lifetime) { return lifetime >= 3000000 ? 'Gold' : lifetime >= 1000000 ? 'Silver' : 'Bronze'; };
  members.getSettings = function (d) {
    var s = (d.memberSettings || {})[d.session.tenant] || {};
    return Object.assign({}, DEFAULT_SETTINGS, s);
  };
  members.saveSettings = function (spec) {
    Orbis.require('member.settings');
    return Orbis.tx(function (d) {
      var earnUnit = toInt(spec.earnUnit, 'Kelipatan poin'), redeemValue = toInt(spec.redeemValue, 'Nilai tukar poin'), maxPercent = toInt(spec.maxPercent, 'Maks. persen');
      Orbis.need(earnUnit >= 1000, 'VALIDATION', 'Kelipatan poin minimal Rp 1.000');
      Orbis.need(redeemValue >= 1, 'VALIDATION', 'Nilai tukar minimal Rp 1 per poin');
      Orbis.need(maxPercent >= 0 && maxPercent <= 100, 'VALIDATION', 'Maks. persen 0-100');
      d.memberSettings = d.memberSettings || {};
      d.memberSettings[d.session.tenant] = { earnUnit: earnUnit, redeemValue: redeemValue, maxPercent: maxPercent };
      return members.getSettings(d);
    }, { audit: { action: 'member.settings', entity: 'memberSettings', entityId: null } });
  };

  members.register = function (spec) {
    Orbis.require('member.write');
    return Orbis.tx(function (d) {
      var name = str(spec.name);
      Orbis.need(name.length >= 2 && name.length <= 60, 'VALIDATION', 'Nama 2-60 karakter');
      Orbis.need(spec.consent === true, 'CONSENT_REQUIRED', 'Persetujuan (consent) pelanggan wajib');
      var phone = String(spec.phone == null ? '' : spec.phone).replace(/[\s\-+().]/g, '');
      Orbis.need(/^\d{9,15}$/.test(phone), 'VALIDATION', 'Nomor HP harus 9-15 digit');
      Orbis.need(!Orbis.mine(d, 'members').some(function (m) { return m.phone === phone; }), 'DUPLICATE_PHONE', 'Nomor HP sudah terdaftar sebagai member');
      var m = { id: Orbis.nextId(d, 'MBR', 4), tenant: d.session.tenant, name: name, phone: phone, consent: true, consentAt: Orbis.clock.now(), lifetime: 0, points: 0, createdAt: Orbis.clock.now() };
      d.members.push(m);
      return Orbis.clone(m);
    }, { audit: function (r) { return { action: 'member.register', entity: 'member', entityId: r.id }; } });
  };

  members.get = function (d, id) { return find(d, 'members', id) || null; };
  members.search = function (d, q) {
    q = str(q).toLowerCase();
    return Orbis.mine(d, 'members').filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) >= 0 || m.phone.indexOf(q) >= 0; });
  };
  members.ledger = function (d, memberId) {
    return Orbis.mine(d, 'pointLedger').filter(function (r) { return r.memberId === memberId; });
  };

  function redeemCheck(d, m, redeemPoints, base) {
    var s = members.getSettings(d);
    Orbis.int(redeemPoints, 'Poin tukar');
    Orbis.need(redeemPoints >= 0, 'VALIDATION', 'Poin tukar tidak boleh negatif');
    Orbis.need(redeemPoints <= m.points, 'POINTS_NEGATIVE', 'Poin tidak cukup (saldo ' + m.points + ')');
    var value = redeemPoints * s.redeemValue;
    var cap = Math.floor(base * s.maxPercent / 100);
    Orbis.need(value <= cap, 'REDEEM_LIMIT', 'Penukaran maksimal ' + s.maxPercent + '% dari belanja (' + Orbis.idr(cap) + ')');
    return value;
  }

  members.preview = function (d, o) {
    var m = members.get(d, o.memberId);
    Orbis.need(m, 'NOT_FOUND', 'Member tidak ditemukan');
    var subtotal = Orbis.int(o.subtotal, 'Subtotal');
    Orbis.need(subtotal >= 0, 'VALIDATION', 'Subtotal tidak boleh negatif');
    var rp = o.redeemPoints == null ? 0 : o.redeemPoints;
    var value = redeemCheck(d, m, rp, subtotal);
    var s = members.getSettings(d);
    return { redeemValue: value, earn: Math.floor((subtotal - value) / s.earnUnit), points: m.points, tier: members.tier(m.lifetime) };
  };

  /** Write EARN (+REDEEM) ledger rows once per orderId; updates balance and lifetime. Caller's tx. */
  members.commit = function (d, o) {
    var m = members.get(d, o.memberId);
    Orbis.need(m, 'NOT_FOUND', 'Member tidak ditemukan');
    Orbis.need(o.orderId, 'VALIDATION', 'orderId wajib');
    var total = Orbis.int(o.total, 'Total');
    Orbis.need(total >= 0, 'VALIDATION', 'Total tidak boleh negatif');
    var prior = Orbis.mine(d, 'pointLedger').filter(function (r) { return r.orderId === o.orderId && r.type === 'EARN'; })[0];
    if (prior) {
      Orbis.need(prior.memberId === o.memberId, 'CONFLICT', 'Pesanan sudah tercatat untuk member lain');
      return { earn: prior.points, idempotent: true, points: m.points };
    }
    var s = members.getSettings(d);
    var rp = o.redeemPoints == null ? 0 : o.redeemPoints;
    var value = redeemCheck(d, m, rp, o.subtotal != null ? o.subtotal : total + rp * s.redeemValue);
    var earn = Math.floor(total / s.earnUnit);
    var at = Orbis.clock.now();
    function row(type, pts) {
      m.points += pts;
      Orbis.need(m.points >= 0, 'POINTS_NEGATIVE', 'Poin tidak boleh negatif');
      var r = { id: Orbis.nextId(d, 'PTL', 5), tenant: d.session.tenant, memberId: m.id, orderId: o.orderId, type: type, points: pts, balance: m.points, at: at, by: d.session.actor };
      d.pointLedger.push(r); return r;
    }
    if (rp > 0) row('REDEEM', -rp);
    var e = row('EARN', earn); e.total = total; e.redeemValue = value;
    m.lifetime += total;
    return { earn: earn, redeemValue: value, points: m.points, idempotent: false };
  };

  /** Reverse earn/redeem proportionally (refund ratio 0..1). Cumulative reversal can never exceed 100%.
      Optional `key` (e.g. refund id) makes one reversal event idempotent. Earn reversal is clamped so balance stays >= 0. */
  members.reverse = function (d, orderId, ratio, key) {
    Orbis.need(typeof ratio === 'number' && isFinite(ratio) && ratio > 0 && ratio <= 1, 'VALIDATION', 'Rasio pembalikan harus 0 < r <= 1');
    var rows = Orbis.mine(d, 'pointLedger').filter(function (r) { return r.orderId === orderId; });
    var earnRow = rows.filter(function (r) { return r.type === 'EARN'; })[0];
    Orbis.need(earnRow, 'NOT_FOUND', 'Tidak ada poin tercatat untuk pesanan ini');
    var m = members.get(d, earnRow.memberId);
    var revs = rows.filter(function (r) { return r.type === 'EARN_REVERSAL'; });
    if (key != null && revs.some(function (r) { return r.key === key; })) return { idempotent: true, points: m.points };
    var cumOld = Orbis.sum(revs, function (r) { return r.ratio; });
    var cumNew = Math.round((cumOld + ratio) * 1e9) / 1e9;
    Orbis.need(cumNew <= 1, 'REVERSE_EXCEEDS', 'Pembalikan poin melebihi 100% pesanan');
    var full = cumNew >= 1;
    var redeemRow = rows.filter(function (r) { return r.type === 'REDEEM'; })[0];
    var at = Orbis.clock.now();
    function target(totalPts) { return full ? totalPts : Math.floor(totalPts * cumNew); }
    function push(type, pts, extra) {
      m.points += pts;
      var r = Object.assign({ id: Orbis.nextId(d, 'PTL', 5), tenant: d.session.tenant, memberId: m.id, orderId: orderId, type: type, points: pts, balance: m.points, at: at, by: d.session.actor, ratio: ratio, key: key == null ? null : key }, extra || {});
      d.pointLedger.push(r); return r;
    }
    var doneEarn = -Orbis.sum(revs, function (r) { return r.points; });
    var earnDelta = Math.max(0, Math.min(target(earnRow.points) - doneEarn, m.points));
    var lifeDone = Orbis.sum(revs, function (r) { return r.lifetime || 0; });
    var lifeDelta = Math.max(0, Math.min(target(earnRow.total || 0) - lifeDone, m.lifetime));
    push('EARN_REVERSAL', -earnDelta, { lifetime: lifeDelta });
    m.lifetime -= lifeDelta;
    if (redeemRow) {
      var doneRedeem = Orbis.sum(rows.filter(function (r) { return r.type === 'REDEEM_REVERSAL'; }), function (r) { return r.points; });
      var back = target(-redeemRow.points) - doneRedeem;
      if (back > 0) push('REDEEM_REVERSAL', back);
    }
    return { idempotent: false, points: m.points, cumulative: cumNew };
  };

  /* ======================= STOREFRONT ======================= */
  var SECTIONS = ['banner', 'voucher', 'flash', 'best', 'new', 'bundle', 'products', 'reviews', 'social', 'footer', 'wa', 'share'];
  var MAX_IMG = 1048576;
  storefront.SECTIONS = SECTIONS;

  function checkImage(v, label) {
    if (v == null || v === '') return null;
    var m = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+\/]+={0,2})$/.exec(String(v));
    Orbis.need(m, 'IMAGE_INVALID', label + ' harus berupa gambar PNG, JPG, atau WebP');
    var b64 = m[2];
    var bytes = Math.floor(b64.length * 3 / 4) - (b64.slice(-2) === '==' ? 2 : b64.slice(-1) === '=' ? 1 : 0);
    Orbis.need(bytes <= MAX_IMG, 'IMAGE_TOO_LARGE', label + ' maksimal 1 MB');
    return String(v);
  }
  function txt(v, max, label) {
    var s = str(v);
    Orbis.need(s.length <= max, 'VALIDATION', label + ' maksimal ' + max + ' karakter');
    return s;
  }
  function sfRow(d, create) {
    var t = d.session.tenant;
    d.storefront = d.storefront || {};
    var row = d.storefront[t];
    if (!row && create) row = d.storefront[t] = { published: null, draft: { heroTitle: '', heroSubtitle: '', sections: { products: true, footer: true }, deliveryEta: '' }, version: 0 };
    return row;
  }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  storefront.saveDraft = function (patch) {
    Orbis.require('storefront.edit');
    patch = patch || {};
    var allowed = ['title', 'heroTitle', 'heroSubtitle', 'sections', 'deliveryEta', 'logo', 'heroImage'];
    Object.keys(patch).forEach(function (k) { Orbis.need(allowed.indexOf(k) >= 0, 'VALIDATION', 'Kolom storefront tidak dikenal: ' + k); });
    return Orbis.tx(function (d) {
      var row = sfRow(d, true), dr = row.draft;
      if ('title' in patch) dr.title = txt(patch.title, 80, 'Judul');
      if ('heroTitle' in patch) dr.heroTitle = txt(patch.heroTitle, 80, 'Judul hero');
      if ('heroSubtitle' in patch) dr.heroSubtitle = txt(patch.heroSubtitle, 200, 'Subjudul');
      if ('deliveryEta' in patch) dr.deliveryEta = txt(patch.deliveryEta, 40, 'Estimasi kirim');
      if ('logo' in patch) dr.logo = checkImage(patch.logo, 'Logo');
      if ('heroImage' in patch) dr.heroImage = checkImage(patch.heroImage, 'Gambar hero');
      if ('sections' in patch) {
        var sec = patch.sections || {};
        Object.keys(sec).forEach(function (k) { Orbis.need(SECTIONS.indexOf(k) >= 0, 'VALIDATION', 'Seksi tidak dikenal: ' + k); });
        dr.sections = dr.sections || {};
        Object.keys(sec).forEach(function (k) { dr.sections[k] = !!sec[k]; });
      }
      return Orbis.clone(dr);
    }, { audit: { action: 'storefront.saveDraft', entity: 'storefront', entityId: null } });
  };

  storefront.publish = function () {
    Orbis.require('storefront.edit');
    return Orbis.tx(function (d) {
      var row = sfRow(d, false);
      Orbis.need(row, 'NOT_FOUND', 'Draf storefront belum ada');
      Orbis.need(!row.published || !same(row.draft, row.published), 'NO_CHANGE', 'Tidak ada perubahan untuk diterbitkan');
      row.published = Orbis.clone(row.draft);
      row.version = (row.version || 0) + 1;
      row.publishedAt = Orbis.clock.now();
      row.publishedBy = d.session.actor;
      return { version: row.version };
    }, { audit: function (r) { return { action: 'storefront.publish', entity: 'storefront', entityId: null, detail: 'v' + r.version }; } });
  };

  storefront.discardDraft = function () {
    Orbis.require('storefront.edit');
    return Orbis.tx(function (d) {
      var row = sfRow(d, false);
      Orbis.need(row && row.published, 'NO_CHANGE', 'Belum ada versi terbit untuk dipulihkan');
      row.draft = Orbis.clone(row.published);
      return { version: row.version };
    }, { audit: { action: 'storefront.discardDraft', entity: 'storefront', entityId: null } });
  };

  /** Session-tenant builder state (read only). */
  storefront.status = function (d) {
    var row = (d.storefront || {})[d.session.tenant];
    if (!row) return { exists: false, version: 0, published: false, dirty: true, changed: [], draft: null };
    var changed = [];
    if (!row.published) changed.push('(belum pernah terbit)');
    else {
      var keys = {}; Object.keys(row.draft).concat(Object.keys(row.published)).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (k) { if (!same(row.draft[k], row.published[k])) changed.push(k); });
    }
    return { exists: true, version: row.version || 0, published: !!row.published, dirty: changed.length > 0, changed: changed, draft: row.draft };
  };

  function firstOutlet(d, tenantId) {
    return d.outlets.filter(function (o) { return o.tenant === tenantId && o.active; })[0] || null;
  }
  /** Sellable products of a tenant: published products, stock available > 0 at the first active outlet. */
  storefront.products = function (d, tenantId) {
    var o = firstOutlet(d, tenantId);
    if (!o) return [];
    var inv = Orbis.domain.inventory, out = [];
    d.skus.filter(function (s) { return s.tenant === tenantId; }).forEach(function (s) {
      var p = d.products.filter(function (x) { return x.id === s.productId && x.tenant === tenantId && x.published; })[0];
      if (!p) return;
      var av = inv.available(d, s.id, o.id);
      if (av > 0) out.push({ skuId: s.id, productId: p.id, name: p.name, category: p.category, price: s.price, available: av, art: p.art });
    });
    return out;
  };

  /** Public read: ONLY the published version. Never exposes draft, cost or internal fields. */
  storefront.publicView = function (d, tenantId) {
    var t = d.tenants.filter(function (x) { return x.id === tenantId; })[0];
    if (!t || t.status === 'SUSPENDED') return null;
    var row = (d.storefront || {})[tenantId];
    var o = firstOutlet(d, tenantId);
    var base = { tenant: { id: t.id, name: t.name, slug: t.slug }, outlet: o ? { id: o.id, name: o.name, address: o.address } : null };
    if (!row || !row.published) return Object.assign(base, { published: false, version: 0, page: null, products: [] });
    return Object.assign(base, { published: true, version: row.version, page: Orbis.clone(row.published), products: storefront.products(d, tenantId) });
  };
  storefront.publicTenants = function (d) {
    return d.tenants.filter(function (t) { return t.status !== 'SUSPENDED' && (d.storefront || {})[t.id] && d.storefront[t.id].published; })
      .map(function (t) { return { id: t.id, name: t.name }; });
  };

  /** Public order tracking: order id AND phone (last 4 digits) must match. Generic error to prevent enumeration. */
  storefront.track = function (d, orderId, phone) {
    var fail = function () { return Orbis.Err('NOT_FOUND', 'Pesanan tidak ditemukan atau nomor HP tidak cocok'); };
    var digits = String(phone == null ? '' : phone).replace(/\D/g, '');
    if (digits.length < 4 || !str(orderId)) throw fail();
    var o = d.orders.filter(function (x) { return x.id === str(orderId); })[0];
    var op = o && o.customer ? String(o.customer.phone || '').replace(/\D/g, '') : '';
    if (!o || op.length < 4 || op.slice(-4) !== digits.slice(-4)) throw fail();
    var dl = (d.deliveries || []).filter(function (x) { return x.orderId === o.id; })[0];
    return {
      id: o.id, status: o.status, paymentStatus: o.paymentStatus, method: o.method, total: o.total, createdAt: o.createdAt,
      items: (o.items || []).map(function (i) { return { name: i.name, qty: i.qty }; }),
      history: (o.history || []).map(function (h) { return { at: h.at, from: h.from, to: h.to }; }),
      deliveryStatus: dl ? dl.status : null
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
