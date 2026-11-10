/* Orbis v2 — shell: router, role switcher, event delegation, render loop.
   Contract for modules:
     Orbis.screens[route] = function (db, ctx) -> HTML string          (pure render, no mutation)
     Orbis.actions[name]  = function (args, event) -> void             (mutations only via Orbis.tx)
   Everything the user can click is <button data-act="name" data-args='[...]'>. */
(function (g) {
  'use strict';
  if (typeof document === 'undefined') return;
  var Orbis = g.Orbis, esc = Orbis.esc;
  var state = { route: null };

  function logoSvg() { return '<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2.4"/><ellipse cx="16" cy="16" rx="14" ry="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>'; }

  Orbis.go = function (route) {
    var d = Orbis.db(), role = d.session.role;
    if (d.session.view !== 'app' && route !== 'store' && route !== 'track') d.session.view = 'app';
    if (!Orbis.routeAllowed(role, route)) route = Orbis.firstRoute(role);   // deny-by-default guard
    state.route = route;
    if (g.history && g.history.replaceState) g.history.replaceState(null, '', '#/' + route);
    Orbis.render();
    var main = document.getElementById('main'); if (main) main.focus({ preventScroll: true });
    g.scrollTo && g.scrollTo(0, 0);
  };

  function sidebar(d) {
    var role = d.session.role;
    return navHtml(role) ;
  }
  function navHtml(role) {
    return Orbis.navFor(role).map(function (grp) {
      return '<div class="nav-g"><div class="nav-t">' + esc(grp.title) + '</div>' + grp.items.map(function (i) {
        return '<a href="#/' + esc(i[0]) + '" class="nav-i' + (state.route === i[0] ? ' on' : '') + '" data-act="go" data-args="' + esc(JSON.stringify([i[0]])) + '"' + (state.route === i[0] ? ' aria-current="page"' : '') + '>' + Orbis.icon(i[2]) + '<span>' + esc(i[1]) + '</span></a>';
      }).join('') + '</div>';
    }).join('');
  }

  function topbar(d) {
    var s = d.session, t = d.tenants.filter(function (x) { return x.id === s.tenant; })[0];
    var scope = Orbis.ROLES[s.role].scope;
    var roles = Object.keys(Orbis.ROLES).map(function (r) { return '<option value="' + r + '"' + (r === s.role ? ' selected' : '') + '>' + esc(Orbis.ROLES[r].label) + '</option>'; }).join('');
    var tenants = d.tenants.map(function (x) { return '<option value="' + x.id + '"' + (x.id === s.tenant ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('');
    return '<header class="top"><button type="button" class="ico only-m" data-act="toggleNav" aria-label="Buka menu">' + Orbis.icon('menu') + '</button>' +
      '<div class="brand">' + logoSvg() + '<b>Orbis</b><span class="chip chip-mute">Demo</span></div><div class="top-sp"></div>' +
      '<label class="sel"><span>Peran (demo)</span><select data-change="setRole">' + roles + '</select></label>' +
      (scope === 'tenant' ? '<label class="sel"><span>Tenant</span><select data-change="setTenant">' + tenants + '</select></label>' : '') +
      (scope === 'tenant' && s.role !== 'courier' ? '<label class="sel"><span>Outlet</span><select data-change="setOutlet">' + d.outlets.filter(function (o) { return o.tenant === s.tenant && o.active !== false; }).map(function (o) {
        return '<option value="' + esc(o.id) + '"' + (o.id === s.outlet ? ' selected' : '') + '>' + esc(o.name) + '</option>'; }).join('') + '</select></label>' : '') +
      (t && scope === 'tenant' ? '' : '') +
      '<button type="button" class="btn btn-sm top-reset" data-act="resetDemo" aria-label="Reset demo" title="Reset data demo">' + Orbis.icon('undo', 16) + '<span>Reset demo</span></button></header>';
  }

  /** Keep focus + caret across full re-renders (search boxes, inline forms). */
  function keepFocus(fn) {
    var el = document.activeElement, key = null, start = null, end = null;
    if (el && el.name && el.closest && el.closest('#app')) {
      key = el.name; try { start = el.selectionStart; end = el.selectionEnd; } catch (e) { /* non-text input */ }
    }
    fn();
    if (key) {
      var n = document.querySelector('#app [name="' + key.replace(/"/g, '') + '"]');
      if (n) { n.focus(); try { if (start != null) n.setSelectionRange(start, end); } catch (e) { /* ignore */ } }
    }
  }
  Orbis.render = function () { keepFocus(renderNow); };
  function renderNow() {
    var d = Orbis.db(), root = document.getElementById('app'), s = d.session;
    if (s.view === 'landing') { root.innerHTML = Orbis.landing(d); return; }
    if (!state.route) state.route = Orbis.firstRoute(s.role);
    if (s.role === 'customer') {
      var fn0 = Orbis.screens[state.route] || Orbis.screens.store;
      root.innerHTML = topbar(d) + '<main id="main" tabindex="-1" class="main solo">' + safe(fn0, d) + '</main>';
      return;
    }
    if (!Orbis.routeAllowed(s.role, state.route)) state.route = Orbis.firstRoute(s.role);
    var fn = Orbis.screens[state.route];
    var body = fn ? safe(fn, d) : Orbis.empty('Layar "' + state.route + '" belum tersedia.');
    root.innerHTML = topbar(d) +
      '<div class="shell' + (Orbis._navOpen ? ' nav-open' : '') + '"><nav class="side" aria-label="Navigasi utama">' + sidebar(d) + '</nav><div class="scrim" data-act="toggleNav"></div>' +
      '<main id="main" tabindex="-1" class="main">' + body + '</main></div>';
  }
  function safe(fn, d) {
    try { return fn(d, Orbis.session(d)); }
    catch (e) { console.error(e); return '<div class="empty"><p>Layar gagal dimuat: ' + esc(e.message) + '</p></div>'; }
  }

  /* ---------- delegated events ---------- */
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var name = el.getAttribute('data-act');
    if (name === 'go') ev.preventDefault();
    var args = [];
    try { args = JSON.parse(el.getAttribute('data-args') || '[]'); } catch (e) { args = []; }
    if (!Array.isArray(args)) args = [args];
    var fn = Orbis.actions[name];
    if (!fn) { console.warn('Unknown action', name); return; }
    Orbis.attempt(function () { return fn.apply(null, args.concat([ev])); });
  });
  document.addEventListener('change', function (ev) {
    var el = ev.target.closest('[data-change]');
    if (!el) return;
    var fn = Orbis.actions[el.getAttribute('data-change')];
    if (fn) Orbis.attempt(function () { return fn(el.value, ev); });
  });
  /* Text fields marked data-input update UI state on every keystroke WITHOUT re-rendering (no focus loss).
     data-input-render re-renders after a short debounce for live filters such as search. */
  var inputTimer = null;
  document.addEventListener('input', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-input]');
    if (!el) return;
    var fn = Orbis.actions[el.getAttribute('data-input')];
    if (fn) Orbis.attempt(function () { return fn(el.value, ev); });
    if (el.hasAttribute('data-input-render')) { clearTimeout(inputTimer); inputTimer = setTimeout(function () { Orbis.render(); }, 180); }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') Orbis.closeModal(); });

  /* ---------- shell actions ---------- */
  var A = Orbis.actions;
  A.go = function (route) { Orbis._navOpen = false; Orbis.go(route); };
  A.toggleNav = function () { Orbis._navOpen = !Orbis._navOpen; Orbis.render(); };
  A.closeModal = function () { Orbis.closeModal(); };
  A.enter = function (role) {
    Orbis.tx(function (d) { d.session.role = role; d.session.view = 'app'; d.session.actor = Orbis.ROLES[role].label; if (role === 'platform' || role === 'support') d.session.tenant = d.session.tenant || 't1'; });
    state.route = null; Orbis.go(Orbis.firstRoute(role));
  };
  A.setRole = function (role) {
    Orbis.tx(function (d) { d.session.role = role; d.session.actor = Orbis.ROLES[role].label; });
    state.route = null; Orbis.go(Orbis.firstRoute(role));
  };
  A.setTenant = function (tenant) {
    Orbis.tx(function (d) {
      if (!d.tenants.some(function (t) { return t.id === tenant; })) throw Orbis.Err('NOT_FOUND', 'Tenant tidak ditemukan');
      d.session.tenant = tenant;
      d.session.outlet = (d.outlets.filter(function (o) { return o.tenant === tenant; })[0] || {}).id;
      d.session.courierId = (d.couriers.filter(function (c) { return c.tenant === tenant; })[0] || {}).id || null;
    });
    state.route = null; Orbis.go(Orbis.firstRoute(Orbis.db().session.role));
  };
  /** Outlet scopes POS, shift, stock and outlet-filtered views. Must belong to the session tenant and be active. */
  A.setOutlet = function (outlet) {
    Orbis.tx(function (d) {
      var o = d.outlets.filter(function (x) { return x.id === outlet && x.tenant === d.session.tenant; })[0];
      if (!o) throw Orbis.Err('NOT_FOUND', 'Outlet tidak ditemukan');
      if (o.active === false) throw Orbis.Err('OUTLET_INACTIVE', 'Outlet nonaktif');
      d.session.outlet = o.id;
    });
    Orbis.toast('Outlet: ' + (Orbis.db().outlets.filter(function (x) { return x.id === outlet; })[0] || {}).name);
  };
  A.resetDemo = function () {
    if (!g.confirm('Reset seluruh data demo ke kondisi awal?')) return;
    Orbis.reset(); state.route = null; Orbis.render();
    Orbis.toast('Data demo direset');
  };

  function boot() {
    Orbis.init();
    Orbis.on(function () { Orbis.render(); });
    var m = /^#\/([\w-]+)/.exec(g.location.hash || '');
    var d = Orbis.db();
    if (m && d.session.view === 'app') state.route = m[1];
    Orbis.render();
  }
  g.addEventListener('hashchange', function () {
    var m = /^#\/([\w-]+)/.exec(g.location.hash || '');
    if (m && m[1] !== state.route && Orbis.db().session.view === 'app') Orbis.go(m[1]);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
