/* Orbis v2 prototype — core utilities. Client-side simulation only; not a security boundary. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis = g.Orbis || { domain: {}, screens: {}, actions: {}, tests: [] };

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  /** Escape any value for safe interpolation into HTML text or attribute values. */
  Orbis.esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  };

  /** Single-slot extension points owned by feature modules (last assignment wins). Core code calls them only if set:
      skuPrice(d, sku, outlet) -> int | undefined      per-outlet price (B2)
      resolveModifiers(d, sku, ids) -> [{id,name,price}] validates modifier picks (B2)
      charges(d, {base, outlet, channel, method}) -> {tax, service, rounding}  tax/service/rounding (B6)
      tenderEnabled(d, type) -> bool                   payment-method switch (B6)
      can(perm, role, d) -> true|false|undefined        tenant role overrides (B4) */
  Orbis.hooks = Orbis.hooks || {};

  /** Integer IDR only. Throws on non-integers so float money can never enter the ledger. */
  Orbis.int = function (n, label) {
    if (typeof n !== 'number' || !isFinite(n) || Math.floor(n) !== n) {
      throw new Orbis.Err('VALIDATION', (label || 'Nilai') + ' harus bilangan bulat (IDR)');
    }
    return n;
  };
  Orbis.idr = function (n) {
    return 'Rp ' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  /** Typed domain error: code is stable for tests, message is user-facing Indonesian copy. */
  Orbis.Err = function (code, message) {
    var e = new Error(message); e.name = 'OrbisError'; e.code = code; return e;
  };

  /** Injectable clock so domain tests are deterministic. */
  var offset = 0;
  Orbis.clock = {
    now: function () { return Date.now() + offset; },
    set: function (ms) { offset = ms - Date.now(); },
    advance: function (ms) { offset += ms; },
    reset: function () { offset = 0; },
    iso: function () { return new Date(Orbis.clock.now()).toISOString(); },
    day: function () { return Orbis.clock.iso().slice(0, 10); }
  };

  /** Deterministic counters stored in db.seq (no Math.random in ids). */
  Orbis.nextId = function (db, prefix, pad) {
    db.seq = db.seq || {};
    db.seq[prefix] = (db.seq[prefix] || 0) + 1;
    var n = String(db.seq[prefix]);
    while (n.length < (pad || 4)) n = '0' + n;
    return prefix + '-' + n;
  };

  Orbis.clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  Orbis.sum = function (a, f) { return a.reduce(function (s, x) { return s + (f ? f(x) : x); }, 0); };
  Orbis.fmtTime = function (ms) {
    var d = new Date(ms);
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  Orbis.need = function (cond, code, msg) { if (!cond) throw Orbis.Err(code, msg); };
  Orbis.reason = function (text, label) {
    var t = String(text || '').trim();
    if (t.length < 5) throw Orbis.Err('REASON_REQUIRED', (label || 'Alasan') + ' minimal 5 karakter');
    return t;
  };
})(typeof window !== 'undefined' ? window : globalThis);
