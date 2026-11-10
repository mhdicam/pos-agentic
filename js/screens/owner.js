/* Orbis v2 — owner screens: settings (Pengaturan Bisnis), billing (Langganan & Tagihan), audit (Log Audit).
   Pure render; mutations go through Orbis.domain.tenant / orders. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, S = Orbis.screens, A = Orbis.actions;
  var T = function () { return Orbis.domain.tenant; };
  var ui = Orbis.ui = Orbis.ui || {};
  ui.owner = ui.owner || { tab: 'profile', outlet: null, area: '', q: '' };

  /* ---------------- settings ---------------- */
  S.settings = function (d) {
    if (!Orbis.can('tenant.settings')) return Orbis.empty('Hanya Owner yang dapat mengubah pengaturan bisnis.');
    var u = ui.owner, tab = u.tab, body;
    var p = T().profile(d);
    if (tab === 'profile') {
      body = '<div id="set-profile">' + Orbis.card('Profil bisnis',
        '<div class="f2">' + Orbis.field('Nama bisnis', 'name', p.name) + Orbis.field('Kategori', 'category', p.category, { type: 'select', options: T().CATEGORIES }) +
        Orbis.field('Email', 'email', p.email, { type: 'email', placeholder: 'owner@bisnis.id' }) + Orbis.field('Telepon', 'phone', p.phone, { placeholder: '0812xxxxxxx' }) + '</div>' +
        Orbis.field('Alamat kantor', 'address', p.address, { type: 'textarea' }) +
        Orbis.field('NPWP', 'npwp', p.npwp, { placeholder: '15/16 digit', hint: 'Opsional. Hanya digit; titik dan strip diabaikan.' })) +
        Orbis.card('Struk', '<div class="f2">' + Orbis.field('Judul struk', 'receiptHeader', p.receiptHeader) + Orbis.field('Catatan kaki', 'receiptFooter', p.receiptFooter) + '</div>' +
          Orbis.field('Tampilkan NPWP di struk', 'showNpwp', p.showNpwp, { type: 'checkbox' }) + receiptPreview(p)) +
        '<div class="row">' + Orbis.btn('Simpan profil', 'ownerSaveProfile', null, { kind: 'primary' }) + '</div></div>';
    } else if (tab === 'tax') {
      var st = Orbis.domain.orders.settings(d);
      var base = 100000, tx = Math.round(base * st.tax / 100), sv = Math.round(base * st.service / 100);
      body = Orbis.card('Pajak & service', '<div id="set-tax"><div class="f2">' +
        Orbis.field('Pajak (PB1/PPN) %', 'tax', st.tax, { type: 'number', min: 0, hint: '0-30%. Dihitung dari subtotal setelah diskon.' }) +
        Orbis.field('Service charge %', 'service', st.service, { type: 'number', min: 0, hint: '0-30%. Berlaku untuk POS dan toko online.' }) + '</div>' +
        '<div class="banner ok">Contoh pesanan ' + esc(Orbis.idr(base)) + ': pajak ' + esc(Orbis.idr(tx)) + ' + service ' + esc(Orbis.idr(sv)) + ' = total ' + esc(Orbis.idr(base + tx + sv)) + '</div>' +
        Orbis.btn('Simpan', 'ownerSaveTax', null, { kind: 'primary' }) + '<p class="fine mt">Perubahan hanya berlaku untuk pesanan baru; pesanan lama tetap memakai nilai saat dibuat.</p></div>');
    } else {
      var outlets = Orbis.mine(d, 'outlets');
      var oid = u.outlet && outlets.some(function (o) { return o.id === u.outlet; }) ? u.outlet : (outlets[0] || {}).id;
      var hrs = T().hours(d, oid);
      body = Orbis.card('Jam operasional',
        Orbis.field('Outlet', 'hoursOutlet', oid, { type: 'select', options: outlets.map(function (o) { return [o.id, o.name]; }) }).replace('<select ', '<select data-change="ownerHoursOutlet" ') +
        '<div id="set-hours"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Hari</th><th>Tutup</th><th>Buka</th><th>Tutup jam</th></tr></thead><tbody>' +
        hrs.map(function (h, i) {
          return '<tr><td>' + esc(T().DAYS[i]) + '</td><td><input type="checkbox" name="closed' + i + '"' + (h.closed ? ' checked' : '') + ' aria-label="Libur ' + esc(T().DAYS[i]) + '"></td>' +
            '<td><input type="time" name="open' + i + '" value="' + esc(h.open) + '" aria-label="Jam buka ' + esc(T().DAYS[i]) + '"></td><td><input type="time" name="close' + i + '" value="' + esc(h.close) + '" aria-label="Jam tutup ' + esc(T().DAYS[i]) + '"></td></tr>';
        }).join('') + '</tbody></table></div><input type="hidden" name="outletId" value="' + esc(oid) + '">' +
        '<div class="row mt">' + Orbis.btn('Simpan jam', 'ownerSaveHours', null, { kind: 'primary' }) + Orbis.btn('Salin Senin ke semua hari', 'ownerCopyMonday') + '</div></div>');
    }
    return Orbis.pageHead('Pengaturan Bisnis', 'Profil, struk, pajak, dan jam operasional outlet.') +
      Orbis.tabs([['profile', 'Profil & struk'], ['tax', 'Pajak & service'], ['hours', 'Jam operasional']], tab, 'ownerTab') + body;
  };
  function receiptPreview(p) {
    return '<div class="receipt-pv" aria-label="Pratinjau struk"><b>' + esc(p.receiptHeader) + '</b>' + (p.address ? '<small>' + esc(p.address) + '</small>' : '') +
      (p.showNpwp && p.npwp ? '<small>NPWP ' + esc(p.npwp) + '</small>' : '') + '<div class="line"><span>1 x Contoh produk</span><b>Rp 25.000</b></div>' +
      '<div class="line"><span>Total</span><b>Rp 25.000</b></div><small>' + esc(p.receiptFooter) + '</small></div>';
  }
  A.ownerTab = function (t) { ui.owner.tab = t; Orbis.render(); };
  A.ownerHoursOutlet = function (id) { ui.owner.outlet = id; Orbis.render(); };
  A.ownerSaveProfile = function () { T().saveProfile(Orbis.readForm('#set-profile')); Orbis.toast('Profil disimpan'); };
  A.ownerSaveTax = function () {
    var f = Orbis.readForm('#set-tax');
    Orbis.domain.orders.setSettings(Number(f.tax), Number(f.service)); Orbis.toast('Pajak & service disimpan');
  };
  function hoursRows(f) { return T().DAYS.map(function (_, i) { return { closed: !!f['closed' + i], open: f['open' + i], close: f['close' + i] }; }); }
  A.ownerSaveHours = function () { var f = Orbis.readForm('#set-hours'); T().saveHours(f.outletId, hoursRows(f)); Orbis.toast('Jam operasional disimpan'); };
  A.ownerCopyMonday = function () {
    var f = Orbis.readForm('#set-hours'), rows = hoursRows(f);
    T().saveHours(f.outletId, rows.map(function () { return rows[0]; })); Orbis.toast('Jam Senin disalin ke semua hari');
  };

  /* ---------------- billing ---------------- */
  S.billing = function (d) {
    if (!Orbis.can('billing.read')) return Orbis.empty('Peran ini tidak punya akses tagihan.');
    var u = T().usage(d), t = u.tenant, p = u.plan, canReq = Orbis.can('billing.request');
    var reqs = T().planRequests(d), pending = reqs.filter(function (r) { return r.status === 'PENDING'; })[0];
    var statusTxt = { ACTIVE: 'Aktif', TRIALING: 'Masa uji coba', SUSPENDED: 'Ditangguhkan' }[t.status] || t.status;
    var meters = u.rows.map(function (r) {
      var pct = r.max ? Math.min(100, Math.round(r.used / r.max * 100)) : (r.used ? 100 : 0);
      var tone = !r.max ? 'mute' : pct >= 100 ? 'bad' : pct >= 80 ? 'warn' : 'ok';
      return '<div class="use"><div class="row sp"><span>' + esc(r.label) + '</span><b class="mono">' + esc(r.used) + ' / ' + esc(r.max || 0) + '</b></div>' +
        '<div class="meter meter-' + tone + '" role="progressbar" aria-label="' + esc(r.label) + '" aria-valuemin="0" aria-valuemax="' + esc(r.max || 0) + '" aria-valuenow="' + esc(r.used) + '"><div style="width:' + pct + '%"></div></div>' +
        (tone === 'bad' ? '<small class="t-bad">Batas tercapai — upgrade untuk menambah.</small>' : tone === 'warn' ? '<small>Hampir mencapai batas.</small>' : '') + '</div>';
    }).join('');
    var plans = '<div class="plan-grid">' + d.plans.map(function (x) {
      var cur = x.id === t.plan, up = x.price > p.price;
      return '<article class="plan-c' + (cur ? ' cur' : '') + '"><div class="row sp"><h3>' + esc(x.name) + '</h3>' + (cur ? Orbis.chip('ACTIVE', 'Paket Anda') : '') + '</div>' +
        '<div class="plan-p">' + esc(Orbis.idr(x.price)) + '<small> / bulan</small></div><ul><li>' + esc(x.outlets) + ' outlet</li><li>' + esc(x.staff) + ' staf</li><li>' + esc(x.registers) + ' register</li><li>' + (x.ai ? esc(x.ai.toLocaleString('id-ID')) + ' kredit AI' : 'Tanpa AI') + '</li></ul>' +
        (cur ? '' : Orbis.btn(up ? 'Minta upgrade' : 'Minta turun paket', 'ownerPlanModal', [x.id], { kind: up ? 'primary' : '', disabled: !canReq || !!pending, title: pending ? 'Masih ada permintaan yang menunggu' : canReq ? '' : 'Hanya Owner' })) + '</article>';
    }).join('') + '</div>';
    var reqTbl = Orbis.table([
      { label: 'ID', fmt: function (r) { return '<span class="mono">' + esc(r.id) + '</span>'; } },
      { label: 'Perubahan', fmt: function (r) { return esc(planName(d, r.from) + ' → ' + planName(d, r.to)); } },
      { label: 'Waktu', fmt: function (r) { return esc(Orbis.fmtTime(r.at)); } },
      { label: 'Status', fmt: function (r) { return Orbis.chip(r.status === 'PENDING' ? 'PENDING' : r.status) + (r.reason ? ' <small>' + esc(r.reason) + '</small>' : ''); } },
      { label: '', right: true, fmt: function (r) { return r.status === 'PENDING' && canReq ? Orbis.btn('Batalkan', 'ownerPlanCancel', [r.id], { kind: 'sm' }) : ''; } }
    ], reqs, 'Belum ada permintaan perubahan paket.');
    var invTbl = Orbis.table([
      { label: 'Invoice', fmt: function (i) { return '<span class="mono">' + esc(i.id) + '</span>'; } },
      { label: 'Tanggal', fmt: function (i) { return esc(i.createdAt ? Orbis.fmtTime(i.createdAt) : '-'); } },
      { label: 'Nominal', right: true, fmt: function (i) { return esc(Orbis.idr(i.amount)); } },
      { label: 'Status', fmt: function (i) { return Orbis.chip(i.status === 'UNPAID' ? 'PENDING' : i.status, i.status === 'UNPAID' ? 'Belum dibayar' : i.status === 'PAID' ? 'Lunas' : i.status); } }
    ], T().invoices(d), 'Belum ada invoice.');
    return Orbis.pageHead('Langganan & Tagihan', 'Paket aktif, pemakaian kuota, dan riwayat invoice.') +
      (t.status === 'SUSPENDED' ? '<div class="banner bad">Tenant ditangguhkan: transaksi baru ditolak. Pesanan berjalan dan ekspor data tetap tersedia. Hubungi platform untuk aktivasi kembali.</div>' : '') +
      (pending ? '<div class="banner">Permintaan ' + esc(planName(d, pending.from) + ' → ' + planName(d, pending.to)) + ' menunggu persetujuan platform. Paket berubah setelah disetujui.</div>' : '') +
      '<div class="grid g2">' + Orbis.card('Paket saat ini', '<div class="plan-now"><div><small>Paket</small><b>' + esc(p.name) + '</b></div><div><small>Status</small>' + Orbis.chip(t.status, statusTxt) + '</div><div><small>Biaya</small><b>' + esc(Orbis.idr(p.price)) + '<small> / bulan</small></b></div></div>') +
      Orbis.card('Pemakaian kuota', meters) + '</div>' +
      Orbis.card('Pilihan paket', plans + '<p class="fine mt">Perubahan paket diajukan ke platform admin dan berlaku setelah disetujui. Turun paket ditolak bila pemakaian melebihi batas paket tujuan; data tidak dihapus otomatis.</p>') +
      '<div class="grid g2">' + Orbis.card('Permintaan paket', reqTbl) + Orbis.card('Invoice', invTbl) + '</div>';
  };
  function planName(d, id) { var p = d.plans.filter(function (x) { return x.id === id; })[0]; return p ? p.name : id; }
  A.ownerPlanModal = function (planId) {
    var d = Orbis.db(), cur = T().usage(d).plan, to = d.plans.filter(function (x) { return x.id === planId; })[0];
    Orbis.modal('Ajukan paket ' + to.name, '<input type="hidden" name="planId" value="' + esc(planId) + '">' +
      '<div class="line"><span>Dari</span><b>' + esc(cur.name + ' · ' + Orbis.idr(cur.price)) + '</b></div><div class="line"><span>Ke</span><b>' + esc(to.name + ' · ' + Orbis.idr(to.price)) + '</b></div>' +
      '<div class="line"><span>Selisih / bulan</span><b>' + esc((to.price >= cur.price ? '+' : '-') + Orbis.idr(Math.abs(to.price - cur.price))) + '</b></div>' +
      '<div class="mt">' + Orbis.field('Catatan untuk platform (opsional)', 'note', '', { type: 'textarea' }) + '</div>',
      Orbis.btn('Batal', 'closeModal') + Orbis.btn('Kirim permintaan', 'ownerPlanSubmit', null, { kind: 'primary' }));
  };
  A.ownerPlanSubmit = function () { var f = Orbis.formData(); T().requestPlan(f.planId, f.note); Orbis.closeModal(); Orbis.toast('Permintaan dikirim ke platform'); };
  A.ownerPlanCancel = function (id) { T().cancelPlanRequest(id); Orbis.toast('Permintaan dibatalkan'); };

  /* ---------------- audit ---------------- */
  var AREAS = [['', 'Semua area'], ['order', 'Pesanan'], ['pos', 'POS'], ['shift', 'Shift'], ['refund', 'Refund'], ['stock', 'Stok'], ['po', 'Pembelian'], ['expense', 'Biaya'], ['team', 'Tim'], ['tenant', 'Pengaturan'], ['outlet', 'Outlet'], ['billing', 'Tagihan'], ['promo', 'Promo'], ['member', 'Member'], ['storefront', 'Storefront'], ['delivery', 'Pengiriman'], ['ai', 'AI'], ['inbox', 'Inbox']];
  S.audit = function (d) {
    if (!Orbis.can('audit.read')) return Orbis.empty('Hanya Owner yang dapat melihat log audit.');
    var u = ui.owner, rows = T().audit(d, { area: u.area, q: u.q }), shown = rows.slice(0, 200);
    return Orbis.pageHead('Log Audit', 'Jejak aktivitas tenant ini. Hanya-baca; catatan tidak dapat diubah atau dihapus.') +
      '<div class="filters">' + Orbis.field('Area', 'auditArea', u.area, { type: 'select', options: AREAS }).replace('<select ', '<select data-change="ownerAuditArea" ') +
      '<div class="fld"><label for="f-auditQ">Cari</label><input id="f-auditQ" name="auditQ" value="' + esc(u.q) + '" placeholder="aksi, aktor, atau ID" data-input="ownerAuditQ" data-input-render></div></div>' +
      Orbis.card(rows.length + ' kejadian' + (rows.length > shown.length ? ' (200 terbaru ditampilkan)' : ''), Orbis.table([
        { label: 'Waktu', fmt: function (a) { return '<span class="mono">' + esc(Orbis.fmtTime(a.at)) + '</span>'; } },
        { label: 'Aktor', fmt: function (a) { var rl = (Orbis.ROLES[a.role] || {}).label || a.role; return esc(a.actor) + (rl !== a.actor ? ' <small>' + esc(rl) + '</small>' : ''); } },
        { label: 'Aksi', fmt: function (a) { return '<code>' + esc(a.action) + '</code>'; } },
        { label: 'Objek', fmt: function (a) { return esc((a.entity || '-') + (a.entityId ? ' · ' + a.entityId : '')); } }
      ], shown, 'Belum ada aktivitas pada filter ini.'));
  };
  A.ownerAuditArea = function (v) { ui.owner.area = v; Orbis.render(); };
  A.ownerAuditQ = function (v) { ui.owner.q = v; };
})(typeof window !== 'undefined' ? window : globalThis);
