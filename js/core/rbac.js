/* Orbis v2 — roles, permissions, navigation. One table drives nav, route guards and action checks.
   Client-side only: production must enforce the same matrix on the server (ADR-0002/0008). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis;

  Orbis.ROLES = {
    platform:   { label: 'Platform Super Admin', scope: 'platform' },
    support:    { label: 'Platform Support',     scope: 'platform' },
    owner:      { label: 'Tenant Owner',         scope: 'tenant' },
    brand:      { label: 'Brand Admin',          scope: 'tenant' },
    manager:    { label: 'Outlet Manager',       scope: 'tenant' },
    cashier:    { label: 'Cashier',              scope: 'tenant' },
    dispatcher: { label: 'Dispatcher',           scope: 'tenant' },
    courier:    { label: 'Courier',              scope: 'tenant' },
    ai:         { label: 'AI Manager',           scope: 'tenant' },
    cs:         { label: 'CS / CRM Agent',       scope: 'tenant' },
    finance:    { label: 'Finance / Viewer',     scope: 'tenant' },
    customer:   { label: 'Customer / Guest',     scope: 'public' }
  };

  /** permission -> roles allowed. Verbs are domain-specific so tests can assert negatives. */
  Orbis.PERMS = {
    'catalog.read':    ['owner', 'brand', 'manager', 'cashier', 'finance'],
    'catalog.write':   ['owner', 'brand', 'manager'],
    'stock.adjust':    ['owner', 'manager'],
    'po.write':        ['owner', 'manager'],
    'po.approve':      ['owner'],
    'pos.sell':        ['owner', 'manager', 'cashier'],
    'shift.operate':   ['owner', 'manager', 'cashier'],
    'order.read':      ['owner', 'brand', 'manager', 'cashier', 'dispatcher', 'finance', 'cs'],
    'order.advance':   ['owner', 'manager', 'cashier'],
    'order.cancel':    ['owner', 'manager'],
    'refund.request':  ['owner', 'manager', 'cashier'],
    'refund.approve':  ['owner', 'manager', 'finance'],
    'promo.write':     ['owner', 'brand', 'manager'],
    'member.write':    ['owner', 'manager', 'cashier', 'cs'],
    'storefront.edit': ['owner', 'brand'],
    'expense.write':   ['owner', 'manager', 'finance'],
    'expense.approve': ['owner', 'manager'],
    'expense.pay':     ['owner', 'finance'],
    'report.read':     ['owner', 'brand', 'manager', 'finance'],
    'delivery.dispatch': ['owner', 'manager', 'dispatcher'],
    'delivery.courier':  ['courier'],
    'cod.review':      ['owner', 'manager', 'finance'],
    'inbox.reply':     ['owner', 'manager', 'cs'],
    'ai.configure':    ['owner', 'ai'],
    'integration.write': ['owner', 'brand', 'ai'],
    'team.write':      ['owner'],
    'platform.read':   ['platform', 'support'],
    'platform.tenant': ['platform'],
    'platform.request': ['platform', 'support'],
    'platform.approve': ['platform']
  };

  Orbis.can = function (perm, role) {
    var d = Orbis._txDraft || Orbis.db(), r = role || d.session.role;
    var o = Orbis.hooks.can ? Orbis.hooks.can(perm, r, d) : undefined;
    if (o === true || o === false) return o;
    return (Orbis.PERMS[perm] || []).indexOf(r) >= 0;
  };
  /** Domain guard: throws FORBIDDEN so negative tests and UI share one code path. */
  Orbis.require = function (perm, role) {
    if (!Orbis.can(perm, role)) throw Orbis.Err('FORBIDDEN', 'Peran ini tidak memiliki izin untuk aksi tersebut');
  };

  /** Navigation: groups of [route, label, icon]. A screen registers itself under the same route. */
  var G = function (title, items) { return { title: title, items: items }; };
  Orbis.NAV = {
    owner: [
      G('Ringkasan', [['overview', 'Overview', 'grid'], ['reports', 'Laporan', 'chart']]),
      G('Penjualan', [['pos', 'POS Kasir', 'cart'], ['orders', 'Pesanan', 'receipt'], ['storefront', 'Storefront', 'store']]),
      G('Produk & Stok', [['catalog', 'Produk', 'box'], ['procurement', 'Pembelian & Stok', 'truck']]),
      G('Pelanggan', [['members', 'Member', 'users'], ['promos', 'Promo', 'tag'], ['inbox', 'Inbox', 'chat']]),
      G('Pengiriman', [['dispatch', 'Dispatch', 'route'], ['cod', 'COD & Remitansi', 'cash']]),
      G('Keuangan', [['expenses', 'Biaya', 'wallet'], ['refunds', 'Retur & Refund', 'undo']]),
      G('Pengaturan', [['settings', 'Pengaturan Bisnis', 'building'], ['team', 'Tim & Outlet', 'users'], ['billing', 'Langganan & Tagihan', 'receipt'], ['integrations', 'Integrasi', 'plug'], ['ai', 'AI Agent', 'spark'], ['audit', 'Log Audit', 'list']])
    ],
    brand: [
      G('Brand', [['overview', 'Overview', 'grid'], ['storefront', 'Storefront', 'store'], ['catalog', 'Produk', 'box'], ['promos', 'Promo', 'tag'], ['integrations', 'Integrasi', 'plug'], ['reports', 'Laporan', 'chart']])
    ],
    manager: [
      G('Operasional', [['overview', 'Overview', 'grid'], ['pos', 'POS Kasir', 'cart'], ['orders', 'Pesanan', 'receipt'], ['procurement', 'Pembelian & Stok', 'truck'], ['catalog', 'Produk', 'box'], ['promos', 'Promo', 'tag'], ['members', 'Member', 'users']]),
      G('Pengiriman & Keuangan', [['dispatch', 'Dispatch', 'route'], ['cod', 'COD & Remitansi', 'cash'], ['expenses', 'Biaya', 'wallet'], ['refunds', 'Retur & Refund', 'undo'], ['reports', 'Laporan', 'chart'], ['inbox', 'Inbox', 'chat']])
    ],
    cashier: [
      G('Kasir', [['pos', 'POS Kasir', 'cart'], ['orders', 'Pesanan', 'receipt'], ['members', 'Member', 'users'], ['refunds', 'Retur & Refund', 'undo']])
    ],
    dispatcher: [
      G('Pengiriman', [['dispatch', 'Dispatch', 'route'], ['orders', 'Pesanan', 'receipt'], ['cod', 'COD & Remitansi', 'cash']])
    ],
    courier: [
      G('Ruang Kurir', [['courier', 'Tugas Saya', 'route'], ['courier-cash', 'Setoran COD', 'cash']])
    ],
    ai: [
      G('AI & Kanal', [['ai', 'AI Agent', 'spark'], ['integrations', 'Integrasi', 'plug'], ['inbox', 'Inbox', 'chat']])
    ],
    cs: [
      G('Layanan', [['inbox', 'Inbox', 'chat'], ['members', 'Member', 'users'], ['orders', 'Pesanan', 'receipt']])
    ],
    finance: [
      G('Keuangan', [['reports', 'Laporan', 'chart'], ['expenses', 'Biaya', 'wallet'], ['cod', 'COD & Remitansi', 'cash'], ['refunds', 'Retur & Refund', 'undo'], ['orders', 'Pesanan', 'receipt'], ['billing', 'Langganan & Tagihan', 'receipt']])
    ],
    platform: [
      G('Platform', [['platform', 'Dashboard', 'grid'], ['platform-tenants', 'Tenant', 'building'], ['platform-billing', 'Billing & Plan', 'wallet']]),
      G('Governance', [['platform-approvals', 'Approval', 'shield'], ['platform-fleet', 'Armada POS', 'device'], ['platform-audit', 'Audit', 'list']])
    ],
    support: [
      G('Support', [['platform', 'Dashboard', 'grid'], ['platform-tenants', 'Tenant', 'building'], ['platform-approvals', 'Permintaan Akses', 'shield'], ['platform-audit', 'Audit', 'list']])
    ],
    customer: []
  };

  Orbis.navFor = function (role) { return Orbis.NAV[role] || []; };
  Orbis.firstRoute = function (role) {
    if (role === 'customer') return 'store';
    var n = Orbis.navFor(role);
    return n.length ? n[0].items[0][0] : 'overview';
  };
  Orbis.routeAllowed = function (role, route) {
    if (role === 'customer') return route === 'store' || route === 'track';
    return Orbis.navFor(role).some(function (grp) { return grp.items.some(function (i) { return i[0] === route; }); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
