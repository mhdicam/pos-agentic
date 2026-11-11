/* Orbis v2 — UI kit. Everything returns HTML strings built with Orbis.esc; handlers are looked up by
   name in Orbis.actions via data-act (no inline JS strings with user data). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc;

  var ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l3 12h11l2-8H6"/>',
    receipt: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', store: '<path d="M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>', truck: '<path d="M2 6h11v10H2zM13 10h5l3 3v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 4a3.5 3.5 0 010 7M22 21c0-3-2-5-5-5.7"/>',
    tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>', chat: '<path d="M4 4h16v12H8l-4 4z"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3 3 0 000-6H9a3 3 0 010-6h7"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', wallet: '<path d="M3 7h16a2 2 0 012 2v10H5a2 2 0 01-2-2zM3 7l2-3h12M17 13h4"/>',
    undo: '<path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3"/>', plug: '<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 01-12 0zM12 18v4"/>',
    spark: '<path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>', building: '<path d="M4 21V3h10v18M14 9h6v12M8 7h2M8 11h2M8 15h2"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>', device: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>', list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 13l4 4L19 7"/>'
  };
  Orbis.icon = function (n, size) {
    return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || ICONS.grid) + '</svg>';
  };

  /** Status chips always carry text (never colour alone) — design-system rule. */
  var TONE = {
    ACTIVE: 'ok', PAID: 'ok', DELIVERED: 'ok', COMPLETED: 'ok', VERIFIED: 'ok', APPROVED: 'ok', RECEIVED: 'ok', ONLINE: 'ok', ACCEPTED: 'ok', READY: 'ok', connected: 'ok', RECONCILED: 'ok', WON: 'ok',
    PENDING: 'warn', PLACED: 'warn', PREPARING: 'warn', ASSIGNED: 'warn', SUBMITTED: 'warn', REQUESTED: 'warn', TRIALING: 'warn', DRAFT: 'warn', COLLECTION_PENDING: 'warn', PENDING_SYNC: 'warn', PARTIAL: 'warn', READY_FOR_ASSIGNMENT: 'warn', SENT: 'warn', SUBMITTED_COUNT: 'warn', COUNTING: 'warn', RETRY_PENDING: 'warn', AWAITING_APPROVAL: 'warn',
    CANCELLED: 'bad', REJECTED: 'bad', FAILED: 'bad', DELIVERY_FAILED: 'bad', DISPUTED: 'bad', SUSPENDED: 'bad', REVOKED: 'bad', FLAGGED: 'bad', CONFLICT: 'bad', OFFLINE: 'mute', RETURN_TO_STORE: 'bad', RETURNED: 'mute', REFUNDED: 'mute'
  };
  Orbis.chip = function (status, label) {
    return '<span class="chip chip-' + (TONE[status] || 'mute') + '">' + esc(label || String(status).replace(/_/g, ' ')) + '</span>';
  };

  Orbis.btn = function (label, act, args, opts) {
    opts = opts || {};
    var data = args ? ' data-args="' + esc(JSON.stringify(args)) + '"' : '';
    var dis = opts.disabled ? ' disabled' : '';
    return '<button type="button" class="btn ' + (opts.kind ? 'btn-' + opts.kind : '') + '" data-act="' + esc(act) + '"' + data + dis + (opts.title ? ' title="' + esc(opts.title) + '"' : '') + '>' + (opts.icon ? Orbis.icon(opts.icon, 16) : '') + esc(label) + '</button>';
  };

  Orbis.card = function (title, body, right) {
    return '<section class="card"><header class="card-h"><h3>' + esc(title) + '</h3><div>' + (right || '') + '</div></header><div class="card-b">' + body + '</div></section>';
  };
  Orbis.stat = function (label, value, sub) {
    return '<div class="stat"><div class="stat-l">' + esc(label) + '</div><div class="stat-v">' + esc(value) + '</div>' + (sub ? '<div class="stat-s">' + esc(sub) + '</div>' : '') + '</div>';
  };
  Orbis.empty = function (msg, cta) {
    return '<div class="empty"><p>' + esc(msg) + '</p>' + (cta || '') + '</div>';
  };
  /** cols: [{k, label, fmt?(row)->html, right?}] ; fmt output is trusted HTML so it must use esc itself. */
  Orbis.table = function (cols, rows, emptyMsg) {
    if (!rows.length) return Orbis.empty(emptyMsg || 'Belum ada data.');
    var h = '<div class="tbl-wrap"><table class="tbl"><thead><tr>' + cols.map(function (c) { return '<th' + (c.right ? ' class="r"' : '') + '>' + esc(c.label) + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr>' + cols.map(function (c) { return '<td' + (c.right ? ' class="r"' : '') + ' data-l="' + esc(c.label) + '">' + (c.fmt ? c.fmt(r) : esc(r[c.k])) + '</td>'; }).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  };
  Orbis.field = function (label, name, value, o) {
    o = o || {};
    var t = o.type || 'text';
    var id = 'f-' + name;
    var inner;
    if (t === 'select') {
      inner = '<select id="' + id + '" name="' + esc(name) + '">' + (o.options || []).map(function (x) {
        var v = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x;
        return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + esc(l) + '</option>';
      }).join('') + '</select>';
    } else if (t === 'textarea') {
      inner = '<textarea id="' + id + '" name="' + esc(name) + '" rows="3">' + esc(value) + '</textarea>';
    } else if (t === 'checkbox') {
      return '<label class="chk"><input id="' + id + '" type="checkbox" name="' + esc(name) + '"' + (value ? ' checked' : '') + '> ' + esc(label) + '</label>';
    } else {
      inner = '<input id="' + id + '" type="' + t + '" name="' + esc(name) + '" value="' + esc(value) + '"' + (o.min != null ? ' min="' + o.min + '"' : '') + (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + '>';
    }
    return '<div class="fld"><label for="' + id + '">' + esc(label) + '</label>' + inner + (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</div>';
  };
  Orbis.tabs = function (items, active, act) {
    return '<div class="tabs" role="tablist">' + items.map(function (t) {
      return '<button type="button" role="tab" class="tab' + (t[0] === active ? ' on' : '') + '" aria-selected="' + (t[0] === active) + '" data-act="' + esc(act) + '" data-args="' + esc(JSON.stringify([t[0]])) + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
  };
  Orbis.pageHead = function (title, sub, right) {
    return '<div class="ph"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div><div class="ph-r">' + (right || '') + '</div></div>';
  };

  /* ---------- modal ---------- */
  var lastFocus = null;
  Orbis.modal = function (title, bodyHtml, footHtml) {
    Orbis.closeModal(true);
    lastFocus = document.activeElement;
    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="ov" data-act="closeModal"></div><div class="mdl" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><header class="mdl-h"><h3>' + esc(title) + '</h3><button type="button" class="ico" data-act="closeModal" aria-label="Tutup">' + Orbis.icon('x') + '</button></header><form class="mdl-b" id="modal-form" onsubmit="return false">' + bodyHtml + '</form>' + (footHtml ? '<footer class="mdl-f">' + footHtml + '</footer>' : '') + '</div>';
    document.body.classList.add('lock');
    var first = root.querySelector('input,select,textarea,button.btn');
    if (first) first.focus();
  };
  Orbis.closeModal = function (silent) {
    var root = document.getElementById('modal-root');
    if (!root || !root.innerHTML) return;
    root.innerHTML = ''; document.body.classList.remove('lock');
    if (!silent && lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* element gone */ } }
  };
  /** Read the open modal form into a plain object. */
  Orbis.formData = function () {
    var f = document.getElementById('modal-form'); var o = {};
    if (!f) return o;
    Array.prototype.forEach.call(f.elements, function (el) {
      if (!el.name) return;
      o[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return o;
  };
  /** Read inputs from any container by name (for inline forms). */
  Orbis.readForm = function (selector) {
    var root = document.querySelector(selector); var o = {};
    if (!root) return o;
    Array.prototype.forEach.call(root.querySelectorAll('[name]'), function (el) { o[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
    return o;
  };

  /* ---------- toast (aria-live) ---------- */
  Orbis.toast = function (msg, bad) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg; el.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(Orbis._tt); Orbis._tt = setTimeout(function () { el.className = 'toast'; }, 3600);
  };
})(typeof window !== 'undefined' ? window : globalThis);
