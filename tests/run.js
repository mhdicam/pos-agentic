#!/usr/bin/env node
/* Node test harness for Orbis v2 domain logic (no browser needed).
   Usage: node tests/run.js
   Loads core + domain modules into a sandbox global, then every tests/*.test.js file.
   A test file calls: test('name', fn) and uses assert/throws helpers. Exit 1 on any failure. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const sandbox = { console, Date, JSON, Math, setTimeout, clearTimeout };
sandbox.globalThis = sandbox; sandbox.window = undefined;
vm.createContext(sandbox);

function load(rel) {
  const f = path.join(root, rel);
  vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: rel });
}
// order matters: util -> store(needs seed fn at call time) -> rbac -> seed -> domain
['js/core/util.js', 'js/core/store.js', 'js/core/rbac.js', 'js/core/seed.js'].forEach(load);
const domainDir = path.join(root, 'js/domain');
if (fs.existsSync(domainDir)) fs.readdirSync(domainDir).filter(f => f.endsWith('.js')).sort().forEach(f => load('js/domain/' + f));
load('js/core/demo.js');

const Orbis = sandbox.Orbis;
const results = [];
let failed = 0;

const T = {
  test(name, fn) {
    Orbis.clock.reset();
    Orbis.reset();                 // fresh seed per test (persist is a no-op without localStorage)
    try { fn(Orbis, T); results.push([true, name]); }
    catch (e) { failed++; results.push([false, name, e && e.stack || String(e)]); }
  },
  eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || 'eq') + ': expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); },
  ok(c, msg) { if (!c) throw new Error(msg || 'expected truthy'); },
  /** Assert fn throws an OrbisError with this code. */
  throws(fn, code, msg) {
    try { fn(); } catch (e) {
      if (e && e.name === 'OrbisError' && (!code || e.code === code)) return;
      throw new Error((msg || 'throws') + ': expected ' + code + ' got ' + (e && (e.code || e.message)));
    }
    throw new Error((msg || 'throws') + ': expected ' + code + ' but nothing was thrown');
  },
  /** Switch session role/tenant like the UI does. */
  as(role, tenant) {
    Orbis.tx(d => { d.session.role = role; d.session.actor = role; if (tenant) { d.session.tenant = tenant; d.session.outlet = (d.outlets.find(o => o.tenant === tenant) || {}).id; } });
  }
};
sandbox.test = T.test; sandbox.T = T;
sandbox.Orbis.tests = results;

fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort().forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), sandbox, { filename: 'tests/' + f });
});

results.forEach(r => console.log((r[0] ? 'PASS ' : 'FAIL ') + r[1] + (r[0] ? '' : '\n' + r[2].split('\n').slice(0, 4).join('\n'))));
console.log('\n' + (results.length - failed) + ' passed, ' + failed + ' failed, ' + results.length + ' total');
process.exit(failed ? 1 : 0);
