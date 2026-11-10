/* Orbis v2 — seed data = the data contract. Collections are flat arrays; every tenant-owned row has `tenant`.
   Orders embed line snapshots (price/cost/name) so history never depends on mutable product values (ADR-0005).
   Stock is never stored as an editable total: Orbis.domain.inventory derives balance from `stockMoves`. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis;

  Orbis.seed = function () {
    var T0 = Orbis.clock.now();
    var db = {
      version: Orbis.VERSION, seq: {},
      session: { actor: 'Rina (Owner)', role: 'owner', tenant: 't1', outlet: 'o1', courierId: 'c1', view: 'landing' },
      plans: [
        { id: 'starter', name: 'Starter', price: 149000, outlets: 1, staff: 5, registers: 1, ai: 0 },
        { id: 'growth',  name: 'Growth',  price: 399000, outlets: 3, staff: 20, registers: 3, ai: 800 },
        { id: 'scale',   name: 'Scale',   price: 899000, outlets: 10, staff: 80, registers: 10, ai: 5000 }
      ],
      tenants: [
        { id: 't1', name: 'Kopi Awan', slug: 'kopi-awan', plan: 'growth', status: 'ACTIVE', category: 'F&B', color: '#2f5bff', aiMode: 'assist', aiCredits: 800, aiUsed: 120, aiBudget: 600 },
        { id: 't2', name: 'Freshmart', slug: 'freshmart', plan: 'starter', status: 'TRIALING', category: 'Retail', color: '#16966c', aiMode: 'off', aiCredits: 0, aiUsed: 0, aiBudget: 0 }
      ],
      outlets: [
        { id: 'o1', tenant: 't1', name: 'Kopi Awan Senopati', address: 'Jl. Senopati 12, Jakarta Selatan', active: true },
        { id: 'o2', tenant: 't1', name: 'Kopi Awan BSD', address: 'Jl. BSD Raya 5, Tangerang', active: true },
        { id: 'o3', tenant: 't2', name: 'Freshmart Depok', address: 'Jl. Margonda 88, Depok', active: true }
      ],
      staff: [
        { id: 's1', tenant: 't1', name: 'Rina', role: 'owner', active: true },
        { id: 's2', tenant: 't1', name: 'Dewa', role: 'manager', active: true },
        { id: 's3', tenant: 't1', name: 'Sari', role: 'cashier', active: true },
        { id: 's4', tenant: 't1', name: 'Bima', role: 'finance', active: true }
      ],
      products: [], skus: [], stockMoves: [], suppliers: [], purchaseOrders: [],
      orders: [], payments: [], refunds: [], returnCases: [],
      shifts: [], cashEvents: [], heldCarts: [],
      members: [], pointLedger: [], promos: [], promoUse: [],
      storefront: {}, couriers: [], deliveries: [], deliveryEvents: [], remittances: [],
      expenses: [], approvalRules: [],
      conversations: [], contacts: [], kb: [],
      integrations: [],
      outbox: [], devices: [],
      platform: { requests: [], grants: [], tickets: [], flags: [], invoices: [], actor: 'admin_ops' },
      audit: []
    };

    // Catalog: product -> sku (variant) ; stock via movements
    var P = [
      ['p1', 'Kopi Susu Awan', 'Minuman', 28000, 9000], ['p2', 'Americano', 'Minuman', 24000, 6500],
      ['p3', 'Matcha Latte', 'Minuman', 32000, 12000], ['p4', 'Croissant Butter', 'Roti', 26000, 11000],
      ['p5', 'Choco Cookie', 'Roti', 18000, 6000], ['p6', 'Biji Kopi 250g', 'Retail', 85000, 52000],
      ['p7', 'Es Teh Lemon', 'Minuman', 20000, 5000], ['p8', 'Sandwich Tuna', 'Roti', 38000, 17000]
    ];
    P.forEach(function (r, i) {
      db.products.push({ id: r[0], tenant: 't1', name: r[1], category: r[2], published: true, art: i });
      db.skus.push({ id: 'k' + (i + 1), tenant: 't1', productId: r[0], sku: 'KA-' + (100 + i), label: 'Standar', price: r[3], cost: r[4], barcode: '899' + (1000 + i) });
      db.stockMoves.push({ id: Orbis.nextId(db, 'MOV', 5), tenant: 't1', outlet: 'o1', skuId: 'k' + (i + 1), qty: 40, type: 'OPENING', ref: 'seed', at: T0 });
    });
    [['p9', 'Beras 5kg', 'Sembako', 69000, 61000], ['p10', 'Minyak Goreng 2L', 'Sembako', 38000, 33000],
     ['p11', 'Susu UHT 1L', 'Minuman', 19000, 16000], ['p12', 'Telur 1kg', 'Sembako', 31000, 27000]].forEach(function (r, i) {
      db.products.push({ id: r[0], tenant: 't2', name: r[1], category: r[2], published: true, art: i });
      db.skus.push({ id: 'k' + (9 + i), tenant: 't2', productId: r[0], sku: 'FM-' + (200 + i), label: 'Standar', price: r[3], cost: r[4], barcode: '899' + (2000 + i) });
      db.stockMoves.push({ id: Orbis.nextId(db, 'MOV', 5), tenant: 't2', outlet: 'o3', skuId: 'k' + (9 + i), qty: 60, type: 'OPENING', ref: 'seed', at: T0 });
    });
    db.suppliers.push({ id: 'sup1', tenant: 't1', name: 'PT Sumber Biji', phone: '021-555-0101' });

    db.members.push({ id: 'm1', tenant: 't1', name: 'Andi Pratama', phone: '081200001111', consent: true, lifetime: 1250000, points: 120 });
    db.promos.push({ id: 'pr1', tenant: 't1', name: 'Diskon Awan 10%', code: 'AWAN10', type: 'percent', value: 10, minPurchase: 50000, maxDiscount: 20000, quota: 100, used: 0, start: '2026-01-01', end: '2026-12-31', status: 'ACTIVE' });

    db.couriers.push(
      { id: 'c1', tenant: 't1', outlet: 'o1', name: 'Joko', phone: '0812-000-111', status: 'ONLINE', maxActive: 3 },
      { id: 'c2', tenant: 't1', outlet: 'o1', name: 'Tika', phone: '0812-000-222', status: 'ONLINE', maxActive: 3 },
      { id: 'c3', tenant: 't1', outlet: 'o1', name: 'Rudi', phone: '0812-000-333', status: 'OFFLINE', maxActive: 3 },
      { id: 'c4', tenant: 't2', outlet: 'o3', name: 'Mira', phone: '0812-000-444', status: 'ONLINE', maxActive: 3 }
    );
    db.approvalRules.push(
      { id: 'ar1', tenant: 't1', min: 0, max: 499999, role: 'manager' },
      { id: 'ar2', tenant: 't1', min: 500000, max: 999999999, role: 'owner' },
      { id: 'ar3', tenant: 't2', min: 0, max: 999999999, role: 'owner' }
    );
    db.storefront['t1'] = { heroTitle: 'Kopi segar, diantar cepat', heroSubtitle: 'Pesan online, ambil di outlet atau kirim ke rumah.', published: null, draft: { heroTitle: 'Kopi segar, diantar cepat', heroSubtitle: 'Pesan online, ambil di outlet atau kirim ke rumah.', sections: { banner: true, best: true, products: true, reviews: false, footer: true }, deliveryEta: '30-45 menit' }, version: 0 };
    db.storefront['t2'] = { published: null, draft: { heroTitle: 'Belanja harian hemat', heroSubtitle: 'Antar ke rumah.', sections: { products: true, footer: true }, deliveryEta: '60 menit' }, version: 0 };
    db.storefront['t1'].published = JSON.parse(JSON.stringify(db.storefront['t1'].draft)); db.storefront['t1'].version = 1;

    db.conversations.push(
      { id: 'cv1', tenant: 't1', channel: 'whatsapp', contact: 'Andi Pratama', owner: 'AI_ACTIVE', unread: 1, messages: [{ by: 'in', text: 'Jam buka outlet Senopati?', at: T0 }] },
      { id: 'cv2', tenant: 't1', channel: 'whatsapp', contact: 'Lia', owner: 'HUMAN_ACTIVE', unread: 0, messages: [{ by: 'in', text: 'Pesanan saya belum sampai', at: T0 }] }
    );
    db.contacts.push({ id: 'ct1', tenant: 't1', name: 'Andi Pratama', phone: '081200001111', label: 'Pelanggan', stage: 'WON' });
    db.kb.push({ id: 'kb1', tenant: 't1', q: 'Jam buka?', a: 'Setiap hari 07.00 - 22.00 WIB.', published: true });
    db.integrations.push({ id: 'wa-official', tenant: 't1', provider: 'WhatsApp Cloud API', kind: 'messaging', status: 'connected', official: true });

    db.devices.push({ id: 'DEV-001', tenant: 't1', outlet: 'o1', name: 'Kasir 1 (Tablet)', status: 'ACTIVE', grantExpiresAt: T0 + 7 * 86400000, pending: 0, conflicts: 0 });
    db.platform.flags.push({ id: 'ff1', name: 'ai_inbox', on: true }, { id: 'ff2', name: 'unofficial_wa', on: false });
    db.platform.invoices.push({ id: 'INV-001', tenant: 't1', amount: 399000, status: 'PAID' }, { id: 'INV-002', tenant: 't2', amount: 0, status: 'TRIAL' });
    return db;
  };
})(typeof window !== 'undefined' ? window : globalThis);
