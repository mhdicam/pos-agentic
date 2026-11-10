/* Orbis v2 — single store. All mutations go through Orbis.tx(): atomic, rollback on throw,
   audit entry written in the same transaction, persisted once. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis;
  var KEY = 'orbis-v2-prototype';
  var VERSION = 3;   // bump when seed shape changes so stale localStorage reseeds
  var listeners = [];
  var batchDepth = 0, batchDirty = false;
  var db = null;

  function storage() { try { return g.localStorage; } catch (e) { return null; } }

  function load() {
    var s = storage();
    if (s) {
      try {
        var raw = s.getItem(KEY);
        if (raw) { var p = JSON.parse(raw); if (p && p.version === VERSION) return p; }
      } catch (e) { /* corrupt or blocked storage: fall through to seed */ }
    }
    return Orbis.seed();
  }
  function persist() {
    var s = storage();
    if (!s) return;
    try { s.setItem(KEY, JSON.stringify(db)); } catch (e) { Orbis.persistFailed = true; }
  }

  Orbis.init = function () { db = load(); return db; };
  Orbis.db = function () { if (!db) Orbis.init(); return db; };
  Orbis.reset = function () {
    db = Orbis.seed(); persist(); Orbis.emit(); return db;
  };
  Orbis.VERSION = VERSION;

  Orbis.on = function (fn) { listeners.push(fn); };
  Orbis.emit = function () { listeners.forEach(function (fn) { try { fn(db); } catch (e) { console.error(e); } }); };

  /**
   * Run fn(draft, ctx) against a deep copy. Commit only if fn returns without throwing.
   * ctx = { actor, role, tenant } — tenant always comes from the session, never from arguments.
   * opts.audit = { action, entity, entityId } writes an immutable audit event atomically.
   */
  Orbis.tx = function (fn, opts) {
    opts = opts || {};
    var base = Orbis.db();
    // inside a batch the whole batch is the rollback unit (snapshot taken once), so skip the per-tx deep copy
    var draft = batchDepth ? base : Orbis.clone(base);
    var ctx = Orbis.session(draft);
    var outer = Orbis._txDraft; Orbis._txDraft = draft;   // permission checks inside fn read THIS draft's session
    var result;
    try { result = fn(draft, ctx); } finally { Orbis._txDraft = outer; }
    if (opts.audit) {
      var a = typeof opts.audit === 'function' ? opts.audit(result, draft, ctx) : opts.audit;
      draft.audit.push({
        id: Orbis.nextId(draft, 'AUD', 5), at: Orbis.clock.now(), actor: ctx.actor, role: ctx.role,
        tenant: a.tenant || ctx.tenant, action: a.action, entity: a.entity || null, entityId: a.entityId || null, detail: a.detail || null
      });
    }
    db = draft;
    if (batchDepth) batchDirty = true; else { persist(); Orbis.emit(); }
    return result;
  };
  /** Run many tx with ONE persist + render at the end (bulk demo/import). The whole batch is the rollback unit:
      any throw restores the snapshot taken at batch start (callers must not catch-and-continue inside a batch). */
  Orbis.batch = function (fn) {
    if (batchDepth) return fn();
    var snapshot = Orbis.clone(Orbis.db());
    batchDepth = 1;
    try { return fn(); }
    catch (e) { db = snapshot; batchDirty = false; throw e; }   // all-or-nothing
    finally { batchDepth = 0; if (batchDirty) { batchDirty = false; persist(); Orbis.emit(); } }
  };

  /** Read-only view; callers must not mutate. */
  Orbis.read = function (fn) { return fn(Orbis.db(), Orbis.session(Orbis.db())); };

  Orbis.session = function (d) {
    var s = (d || Orbis.db()).session;
    return { actor: s.actor, role: s.role, tenant: s.tenant, outlet: s.outlet };
  };

  /** Rows visible to the session tenant. Every domain list read goes through this. */
  Orbis.mine = function (d, collection) {
    var t = d.session.tenant;
    return (d[collection] || []).filter(function (r) { return r.tenant === t; });
  };

  /** Run an action and turn a thrown OrbisError into a toast instead of a crash. */
  Orbis.attempt = function (fn) {
    try { var r = fn(); return { ok: true, value: r }; }
    catch (e) {
      if (e && e.name === 'OrbisError') { Orbis.toast(e.message, true); return { ok: false, code: e.code, message: e.message }; }
      console.error(e); Orbis.toast('Terjadi kesalahan tak terduga', true);
      return { ok: false, code: 'UNEXPECTED', message: String(e && e.message) };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
