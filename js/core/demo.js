/* Orbis v2 — demo history generator. Drives the REAL domain functions (orders, shifts, deliveries/COD, refunds,
   POs, expenses, members) as different roles, so every number on every screen comes from ledgers.
   Deterministic (no Math.random): same seed -> same demo. Runs only from the UI ("Isi data demo") or tests.
   ponytail: fixed patterns, one courier flow per delivery; add scenario fixtures when demos need edge cases. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis;
  var DAY = 86400000, HOUR = 3600000;
  Orbis.demoHooks = Orbis.demoHooks || [];   // push(fn(ctx)) from feature files; runs inside the demo batch as owner-capable roles via ctx.as

  function as(role, actor, outlet, courierId) {
    Orbis.tx(function (d) {
      d.session.role = role; d.session.actor = actor;
      if (outlet) d.session.outlet = outlet;
      if (courierId) d.session.courierId = courierId;
    });
  }
  /** Run fn with the clock moved to `at`; restores even on throw. */
  function at(ms, fn) {
    var now = Orbis.clock.now(); Orbis.clock.advance(ms - now);
    try { return fn(); } finally { Orbis.clock.advance(now - Orbis.clock.now()); }
  }
  /** Simple deterministic sequence 0..n-1 */
  function pick(list, i) { return list[((i % list.length) + list.length) % list.length]; }

  /**
   * Fill tenant t1 with ~30 days of history across both outlets.
   * Guard: only when the tenant has no orders yet (idempotent per tenant).
   * @returns {{orders:number, deliveries:number, refunds:number, shifts:number}}
   */
  Orbis.demoHistory = function (opts) { return Orbis.batch(function () { return run(opts); }); };
  function run(opts) {
    opts = opts || {};
    var days = opts.days || 30;
    var D = Orbis.domain, O = D.orders, S = D.shifts, DV = D.delivery, R = D.refunds, P = D.procurement, E = D.expenses, M = D.members, PR = D.promos;
    var start = Orbis.db();
    Orbis.need(start.session.tenant === 't1' || opts.tenant === start.session.tenant, 'VALIDATION', 'Data demo hanya untuk tenant Kopi Awan');
    Orbis.need(!Orbis.mine(start, 'orders').length, 'NO_CHANGE', 'Tenant sudah punya pesanan; data demo hanya untuk tenant kosong');
    var saved = Orbis.clone(start.session);
    var now = Orbis.clock.now(), t0 = now - days * DAY;
    var stats = { orders: 0, deliveries: 0, refunds: 0, shifts: 0 };

    try {
      /* ---- master data: suppliers, members, promos, stock for BSD ---- */
      as('owner', 'Rina (Owner)', 'o1');
      at(t0 - 2 * DAY, function () {
        [['PT Sumber Biji', '021-555-0101'], ['CV Susu Segar Nusantara', '021-555-0202'], ['Toko Roti Mentari', '021-555-0303'], ['UD Kemasan Jaya', '021-555-0404']].forEach(function (s, i) {
          if (!Orbis.mine(Orbis.db(), 'suppliers').some(function (x) { return x.name === s[0]; })) P.saveSupplier({ name: s[0], phone: s[1] });
        });
        var names = ['Budi Santoso', 'Citra Lestari', 'Dimas Prakoso', 'Eka Wulandari', 'Fajar Nugroho', 'Gita Maharani', 'Hadi Wijaya', 'Indah Permata', 'Joko Susilo', 'Kartika Sari', 'Lukman Hakim', 'Maya Anggraini', 'Nanda Putra', 'Oki Setiawan', 'Putri Ayu', 'Rizky Ramadhan', 'Sinta Dewi', 'Taufik Hidayat'];
        names.forEach(function (n, i) { M.register({ name: n, phone: '0813' + String(20000000 + i * 1371), consent: true }); });
        PR.create({ name: 'Ngopi Pagi 15%', code: 'PAGI15', type: 'percent', value: 15, minPurchase: 30000, maxDiscount: 15000, quota: 300, start: Orbis.clock.day(), end: new Date(now + 60 * DAY).toISOString().slice(0, 10), status: 'ACTIVE' });
        PR.create({ name: 'Potongan 10rb', code: 'HEMAT10', type: 'fixed', value: 10000, minPurchase: 75000, quota: 50, start: Orbis.clock.day(), end: new Date(now + 30 * DAY).toISOString().slice(0, 10), status: 'ACTIVE' });
        PR.create({ name: 'Gajian Akhir Bulan', code: 'GAJIAN', type: 'percent', value: 20, minPurchase: 100000, maxDiscount: 30000, start: new Date(now + 15 * DAY).toISOString().slice(0, 10), end: new Date(now + 20 * DAY).toISOString().slice(0, 10) });
        PR.create({ name: 'Promo Lebaran', code: 'LEBARAN', type: 'percent', value: 10, start: new Date(t0 - 20 * DAY).toISOString().slice(0, 10), end: new Date(t0 - 2 * DAY).toISOString().slice(0, 10) });
      });
      // opening stock for BSD via a received PO (real procurement flow)
      var skus = Orbis.mine(Orbis.db(), 'skus');
      var sup = Orbis.mine(Orbis.db(), 'suppliers');
      at(t0 - DAY, function () {
        as('owner', 'Rina (Owner)', 'o2');
        var po = P.createPo({ supplierId: sup[0].id, lines: skus.map(function (s) { return { skuId: s.id, qty: 60, unitCost: s.cost }; }), note: 'Stok awal outlet BSD' });
        P.submit(po.id); P.approve(po.id); P.receive(po.id, skus.map(function (s) { return { skuId: s.id, qty: 60 }; }), 'RCV-BSD-OPEN');
        as('owner', 'Rina (Owner)', 'o1');
        var po2 = P.createPo({ supplierId: sup[0].id, lines: skus.map(function (s) { return { skuId: s.id, qty: 60, unitCost: s.cost }; }), note: 'Restock Senopati' });
        P.submit(po2.id); P.approve(po2.id); P.receive(po2.id, skus.map(function (s) { return { skuId: s.id, qty: 60 }; }), 'RCV-SNP-01');
      });

      /* ---- daily operations ---- */
      var outlets = [['o1', 'Sari (Kasir)'], ['o2', 'Dewa (Manager)']];
      var members = Orbis.mine(Orbis.db(), 'members');
      var payCycle = ['cash', 'qris', 'qris', 'cash', 'transfer', 'qris', 'cash'];
      var n = 0;
      var restockN = 0;
      function restock(outlet, when) {
        // weekly top-up to 70 per SKU via a received PO; skip k6 ("Biji Kopi") at o1 so low-stock shows in the demo
        at(when, function () {
          as('owner', 'Rina (Owner)', outlet);
          var d0 = Orbis.db(), lines = skus.map(function (s) {
            var need = 70 - D.inventory.available(d0, s.id, outlet);
            return (outlet === 'o1' && s.id === 'k6') || need <= 0 ? null : { skuId: s.id, qty: need, unitCost: s.cost };
          }).filter(Boolean);
          if (!lines.length) return;
          var po = P.createPo({ supplierId: pick(sup, restockN++).id, lines: lines, note: 'Restock mingguan ' + (outlet === 'o1' ? 'Senopati' : 'BSD') });
          P.submit(po.id); P.approve(po.id); P.receive(po.id, lines.map(function (l) { return { skuId: l.skuId, qty: l.qty }; }), 'RCV-W' + restockN);
        });
      }
      for (var day = days - 1; day >= 0; day--) {
        var dayStart = now - day * DAY - ((new Date(now).getUTCHours() + 7) % 24) * HOUR;   // ~00:00 WIB of that day
        if (dayStart > now) dayStart -= DAY;
        if (day % 3 === 0 && day > 0) { restock('o1', dayStart + 6 * HOUR); restock('o2', dayStart + 6 * HOUR); }
        outlets.forEach(function (ol, oi) {
          var open = dayStart + 7 * HOUR;
          var isToday = day === 0;
          if (open > now) return;
          var cashierRole = oi === 0 ? 'cashier' : 'manager';
          as(cashierRole, ol[1], ol[0]);
          var opening = 300000 + oi * 200000;
          at(open, function () { S.open(opening); });
          stats.shifts++;
          var weekend = [0, 6].indexOf(new Date(dayStart + 12 * HOUR).getUTCDay()) >= 0;
          var count = (oi === 0 ? 9 : 6) + (weekend ? 4 : 0) + (day % 3);
          for (var k = 0; k < count; k++, n++) {
            var t = open + HOUR + Math.floor(k * (13 * HOUR) / count);
            if (t > now - 5 * 60000) break;
            var a = pick(skus, n * 7 + oi), b = pick(skus, n * 3 + 1);
            var dNow = Orbis.db(), has = function (s, q) { return D.inventory.available(dNow, s.id, ol[0]) >= q; };
            var q1 = 1 + (n % 3 === 0 ? 1 : 0);
            if (!has(a, q1 + 2)) a = skus.filter(function (s) { return has(s, q1 + 2); })[0];   // sold out: cashier sells something else
            if (!a) continue;
            var items = [{ skuId: a.id, qty: q1 }];
            if (b.id !== a.id && n % 2 === 0 && has(b, 3)) items.push({ skuId: b.id, qty: 1 });
            var ptype = pick(payCycle, n + oi);
            var spec = { channel: 'pos', items: items, method: n % 5 === 0 ? 'dine' : 'pickup', payment: { type: ptype } };
            if (n % 4 === 0) spec.memberId = pick(members, n).id;
            var sub = Orbis.sum(items, function (it) { return it.qty * (skus.filter(function (s) { return s.id === it.skuId; })[0].price); });
            if (n % 5 === 1 && sub >= 30000) spec.promoCode = 'PAGI15';
            at(t, function () {
              var o = O.checkout(spec);
              stats.orders++;
              if (!(isToday && k >= count - 2)) { O.advance(o.id); O.advance(o.id); O.advance(o.id); }
            });
          }
          // cash movements and close (today stays open)
          at(open + 3 * HOUR, function () { S.cashEvent('OUT', 25000 + oi * 10000, 'Beli es batu dan gas'); });
          if (!isToday) {
            at(open + 14 * HOUR, function () {
              var sh = S.current(Orbis.db());
              var exp = S.expected(Orbis.db(), sh);
              var variance = day % 9 === 4 ? -15000 : day % 13 === 6 ? 5000 : 0;
              S.close(exp + variance, variance ? (variance < 0 ? 'Kurang uang kembalian di laci' : 'Lebih bayar pelanggan, disimpan') : '');
            });
          }
        });

        /* online store: delivery (COD + transfer) and pickup, fulfilled by dispatcher + courier */
        var onlineCount = 2 + (day % 3);
        for (var j = 0; j < onlineCount; j++, n++) {
          var tt = dayStart + (10 + j * 3) * HOUR;
          if (tt > now - 2 * HOUR) break;
          var ol2 = j % 3 === 2 ? 'o2' : 'o1';
          var cour = ol2 === 'o1' ? pick(['c1', 'c2'], n) : null;
          var delivery = ol2 === 'o1' && j % 2 === 0;
          var cod = delivery && n % 2 === 0;
          var dN = Orbis.db(), okS = skus.filter(function (s) { return D.inventory.available(dN, s.id, ol2) >= 4; });
          if (okS.length < 2) continue;
          var sp = { channel: 'store', items: [{ skuId: pick(okS, n * 5).id, qty: 2 }, { skuId: pick(okS, n * 5 + 3).id, qty: 1 }], method: delivery ? 'delivery' : 'pickup',
            customer: { name: pick(['Ayu', 'Bagas', 'Clara', 'Doni', 'Elsa', 'Ferry', 'Gilang'], n) + ' ' + pick(['Pratama', 'Saputra', 'Wijaya', 'Hartono'], j), phone: '0821' + String(30000000 + n * 97) },
            address: delivery ? 'Jl. ' + pick(['Kemang Raya', 'Wolter Monginsidi', 'Gunawarman', 'Suryo', 'Tulodong Atas'], n) + ' No. ' + (5 + n % 40) + ', Jakarta Selatan' : '',
            payment: { type: cod ? 'cod' : 'transfer' } };
          at(tt, function () {
            as('owner', 'Rina (Owner)', ol2);
            var o = O.checkout(sp); stats.orders++;
            var recent = day === 0;
            if (recent && j === onlineCount - 1) return;            // leave newest online order waiting (PLACED/ACCEPTED)
            if (o.status === 'PLACED') O.advance(o.id);
            O.advance(o.id); O.advance(o.id);                       // PREPARING -> READY (delivery enqueued)
            if (!delivery) { O.advance(o.id); return; }
            stats.deliveries++;
            var dl = Orbis.mine(Orbis.db(), 'deliveries').filter(function (x) { return x.orderId === o.id; })[0];
            if (recent) return;                                     // today's deliveries wait for dispatch
            as('dispatcher', 'Wawan (Dispatcher)', ol2);
            DV.assign(dl.id, cour, dl.version);
            as('courier', cour === 'c1' ? 'Joko (Kurir)' : 'Tika (Kurir)', ol2, cour);
            var v = function () { return DV.get(Orbis.db(), dl.id).version; };
            DV.accept(dl.id, v());
            DV.pickup(dl.id, { items: true, packaging: true, label: true, address: true }, v());
            DV.start(dl.id, v()); DV.arrive(dl.id, v());
            DV.pod(dl.id, { receiver: sp.customer.name, method: n % 2 ? 'otp' : 'signature', otp: DV.DEMO_OTP, signature: sp.customer.name, codAmount: cod ? o.total : undefined }, v());
            if (cod && day > 1) {
              DV.submitRemittance(dl.id, o.total);
              if (day > 3) {
                as('finance', 'Bima (Finance)', ol2);
                var rm = Orbis.mine(Orbis.db(), 'remittances').filter(function (x) { return x.deliveryId === dl.id; })[0];
                DV.reviewRemittance(rm.id, day === 9 ? 'DISPUTE' : 'VERIFY', 'Uang setoran kurang Rp 5.000');
              }
            }
            if (day > 2) { as('owner', 'Rina (Owner)', ol2); DV.reviewProof(dl.id, 'APPROVED'); }
          });
        }
      }

      /* ---- refunds: approved, rejected, pending ---- */
      var paidOrders = Orbis.mine(Orbis.db(), 'orders').filter(function (o) { return o.paymentStatus === 'PAID' && o.channel === 'pos'; });
      [[5, 'approve'], [17, 'reject'], [29, 'approve'], [41, 'pending'], [53, 'pending']].forEach(function (x, i) {
        var o = paidOrders[x[0] % paidOrders.length];
        if (!o) return;
        at(o.createdAt + 2 * HOUR, function () {
          as('cashier', 'Sari (Kasir)', o.outlet);
          var r = R.request(o.id, [{ skuId: o.items[0].skuId, qty: 1 }], pick(['Minuman tumpah sebelum diminum', 'Pesanan salah varian', 'Produk kurang matang', 'Pelanggan batal setelah bayar'], i));
          stats.refunds++;
          as('owner', 'Rina (Owner)', o.outlet);
          if (x[1] === 'approve') R.approve(r.id, { condition: i === 0 ? 'GOOD' : 'DAMAGED', restock: i === 0 });
          else if (x[1] === 'reject') R.reject(r.id, 'Sudah lewat batas waktu retur');
        });
      });

      /* ---- expenses: paid, approved, pending, rejected ---- */
      as('finance', 'Bima (Finance)', 'o1');
      [['Sewa', 8500000, 'Sewa ruko Senopati bulan ini', 'pay'], ['Utilitas', 1250000, 'Listrik dan air', 'pay'], ['Gaji', 6000000, 'Gaji barista part-time', 'pay'],
       ['Bahan Baku', 750000, 'Susu UHT 2 karton', 'approve'], ['Pemasaran', 450000, 'Iklan Instagram minggu ini', 'pending'], ['Operasional', 180000, 'Servis mesin kopi', 'pending'],
       ['Transport', 95000, 'Ongkir bahan baku', 'reject']].forEach(function (e, i) {
        at(t0 + (3 + i * 4) * DAY, function () {
          as('finance', 'Bima (Finance)', 'o1');
          var x = E.create({ amount: e[1], category: e[0], note: e[2] });
          if (e[3] === 'pending') return;
          as('owner', 'Rina (Owner)', 'o1');
          if (e[3] === 'reject') { E.reject(x.id, 'Nota tidak dilampirkan'); return; }
          E.approve(x.id);
          if (e[3] === 'pay') { as('finance', 'Bima (Finance)', 'o1'); E.pay(x.id); }
        });
      });

      /* ---- purchasing in progress: submitted + partial ---- */
      at(now - 2 * DAY, function () {
        as('manager', 'Dewa (Manager)', 'o1');
        var pa = P.createPo({ supplierId: sup[1].id, lines: [{ skuId: skus[0].id, qty: 40, unitCost: skus[0].cost }, { skuId: skus[2].id, qty: 30, unitCost: skus[2].cost }], note: 'Restock minuman susu' });
        P.submit(pa.id);
        as('owner', 'Rina (Owner)', 'o1');
        var pb = P.createPo({ supplierId: sup[2].id, lines: [{ skuId: skus[3].id, qty: 50, unitCost: skus[3].cost }, { skuId: skus[4].id, qty: 50, unitCost: skus[4].cost }], note: 'Roti & cookie mingguan' });
        P.submit(pb.id); P.approve(pb.id); P.receive(pb.id, [{ skuId: skus[3].id, qty: 30 }], 'RCV-RT-01');
      });
      /* feature modules append their own history (stock counts, transfers, attendance ...) */
      (Orbis.demoHooks || []).forEach(function (fn) { fn({ now: now, t0: t0, DAY: DAY, HOUR: HOUR, as: as, at: at, pick: pick, skus: skus, suppliers: sup }); });
    } finally {
      Orbis.tx(function (d) { d.session = Object.assign(d.session, saved); });
    }
    return stats;
  }
})(typeof window !== 'undefined' ? window : globalThis);
