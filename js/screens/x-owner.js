/* Orbis v2 — RD-17 W3 screens: `autopromos` (Promo Otomatis), `pnl` (Laba Rugi + Ringkasan harian), `fees` (Biaya & Pencairan). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, idr = Orbis.idr, A = Orbis.actions;
  var AP = function () { return Orbis.domain.autopromo; }, PNL = function () { return Orbis.domain.pnl; }, FEES = function () { return Orbis.domain.fees; }, R2 = function () { return Orbis.domain.reports2; };
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.owner3 = Orbis.ui.owner3 || { preset: 'month', outlet: '', type: 'happyhour' };
  function rerender() { if (Orbis.render) Orbis.render(); }
  function stack(h) { return h.replace('class="tbl"', 'class="tbl stack"'); }

  Orbis.addNav('owner', 'Pelanggan', ['autopromos', 'Promo Otomatis', 'tag'], 'promos');
  Orbis.addNav('manager', 'Operasional', ['autopromos', 'Promo Otomatis', 'tag'], 'promos');
  Orbis.addNav('owner', 'Keuangan', ['pnl', 'Laba Rugi', 'chart'], 'expenses');
  Orbis.addNav('owner', 'Keuangan', ['fees', 'Biaya & Pencairan', 'cash'], 'pnl');
  Orbis.addNav('finance', 'Keuangan', ['pnl', 'Laba Rugi', 'chart'], 'reports');
  Orbis.addNav('finance', 'Keuangan', ['fees', 'Biaya & Pencairan', 'cash'], 'pnl');

  /* ---------------- G3 Promo Otomatis ---------------- */
  var DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  function names(d) {
    var prod = {}, sk = {};
    Orbis.mine(d, 'products').forEach(function (p) { prod[p.id] = p; });
    Orbis.mine(d, 'skus').forEach(function (k) { var p = prod[k.productId] || {}; sk[k.id] = (p.name || k.sku) + (k.label && k.label !== 'Standar' ? ' - ' + k.label : ''); });
    var cats = Object.keys(Orbis.mine(d, 'products').reduce(function (m, p) { if (p.category) m[p.category] = 1; return m; }, {})).sort();
    return { sku: sk, cats: cats };
  }
  function scopeText(sc, n) { return sc.scope === 'all' ? 'semua produk' : sc.scope === 'sku' ? (n.sku[sc.ref] || sc.ref) : 'kategori ' + sc.ref; }
  function rule(p, n) {
    if (p.type === 'happyhour') return p.pct + '% ' + scopeText(p.target, n) + ', ' + p.from + '-' + p.to + ' WIB' + (p.days.length ? ' (' + p.days.map(function (x) { return DAYS[x]; }).join(', ') + ')' : ' (setiap hari)');
    if (p.type === 'bxgy') return 'Beli ' + p.buy.qty + ' ' + scopeText(p.buy, n) + ', dapat ' + p.get.qty + ' ' + scopeText(p.get, n) + (p.pct === 100 ? ' gratis' : ' diskon ' + p.pct + '%') + ' (termurah)';
    return p.skus.map(function (k) { return n.sku[k] || k; }).join(' + ') + ' = ' + idr(p.price);
  }
  Orbis.screens.autopromos = function (d) {
    if (!Orbis.can('promo.write')) return Orbis.empty('Peran ini tidak bisa mengatur promo otomatis.');
    var list = AP().list(d), n = names(d);
    var tbl = stack(Orbis.table([
      { label: 'Promo', fmt: function (p) { return '<b>' + esc(p.name) + '</b><br><small>' + esc(AP().TYPES[p.type]) + '</small>'; } },
      { label: 'Aturan', fmt: function (p) { return esc(rule(p, n)); } },
      { label: 'Periode', fmt: function (p) { return esc((p.start || 'sekarang') + ' s/d ' + (p.end || 'seterusnya')) + (p.outlets.length ? '<br><small>' + esc(p.outlets.length + ' outlet') + '</small>' : ''); } },
      { label: 'Terpakai', right: true, fmt: function (p) { return esc(p.used + (p.quota ? ' / ' + p.quota : '')); } },
      { label: 'Status', fmt: function (p) { return Orbis.chip(p.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING', p.status === 'ACTIVE' ? 'Aktif' : 'Dijeda'); } },
      { label: '', right: true, fmt: function (p) { return '<div class="actions">' + Orbis.btn('Ubah', 'opEdit', [p.id], { kind: 'sm' }) + Orbis.btn(p.status === 'ACTIVE' ? 'Jeda' : 'Aktifkan', 'opStatus', [p.id, p.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'], { kind: 'sm' }) + '</div>'; } }
    ], list, 'Belum ada promo otomatis.'));
    var head = Orbis.btn('Muat contoh promo', 'opSamples') + Orbis.btn('Promo baru', 'opNew', null, { kind: 'primary', icon: 'tag' });
    return Orbis.pageHead('Promo Otomatis', 'Diterapkan otomatis di kasir & toko online tanpa kode. Per pesanan hanya 1 promo terbaik (potongan terbesar); tidak digabung dengan kode promo.', head) +
      Orbis.card('Daftar promo', tbl + '<p class="fine mt">Waktu happy hour memakai jam WIB. Potongan tidak pernah melebihi harga item.</p>');
  };
  function scopeFields(prefix, sc, n) {
    sc = sc || { scope: 'all', ref: '' };
    return '<div class="op-row">' + Orbis.field('Cakupan', prefix + 'Scope', sc.scope, { type: 'select', options: [['all', 'Semua produk'], ['sku', 'Produk'], ['category', 'Kategori']] }) +
      Orbis.field('Produk', prefix + 'Sku', sc.scope === 'sku' ? sc.ref : '', { type: 'select', options: [['', '-']].concat(Object.keys(n.sku).map(function (k) { return [k, n.sku[k]]; })) }) +
      Orbis.field('Kategori', prefix + 'Cat', sc.scope === 'category' ? sc.ref : '', { type: 'select', options: [['', '-']].concat(n.cats) }) + '</div>';
  }
  function form(d, type, p) {
    var n = names(d), outs = Orbis.mine(d, 'outlets');
    p = p || { name: '', start: '', end: '', quota: '', outlets: [] };
    var h = '<input type="hidden" name="type" value="' + esc(type) + '"><input type="hidden" name="id" value="' + esc(p.id || '') + '">' +
      Orbis.field('Nama promo', 'name', p.name) +
      '<div class="op-row">' + Orbis.field('Mulai', 'start', p.start, { type: 'date' }) + Orbis.field('Selesai', 'end', p.end, { type: 'date' }) + Orbis.field('Kuota pemakaian (kosong = tanpa batas)', 'quota', p.quota || '', { type: 'number', min: 0 }) + '</div>';
    if (type === 'happyhour') {
      h += '<div class="op-row">' + Orbis.field('Jam mulai (WIB)', 'from', p.from || '14:00', { type: 'time' }) + Orbis.field('Jam selesai (WIB)', 'to', p.to || '16:00', { type: 'time' }) + Orbis.field('Diskon %', 'pct', p.pct || 20, { type: 'number', min: 1 }) + '</div>' +
        '<fieldset class="op-days"><legend>Hari (kosong = setiap hari)</legend>' + DAYS.map(function (x, i) { return Orbis.field(x, 'day' + i, (p.days || []).indexOf(i) >= 0, { type: 'checkbox' }); }).join('') + '</fieldset>' +
        scopeFields('t', p.target, n);
    } else if (type === 'bxgy') {
      h += '<p class="fine">Beli</p>' + Orbis.field('Jumlah beli', 'buyQty', (p.buy || {}).qty || 2, { type: 'number', min: 1 }) + scopeFields('b', p.buy, n) +
        '<p class="fine">Dapat (item termurah)</p>' + Orbis.field('Jumlah dapat', 'getQty', (p.get || {}).qty || 1, { type: 'number', min: 1 }) + scopeFields('g', p.get, n) +
        Orbis.field('Diskon item dapat % (100 = gratis)', 'pct', p.pct || 100, { type: 'number', min: 1 });
    } else {
      var opts = [['', '-']].concat(Object.keys(n.sku).map(function (k) { return [k, n.sku[k]]; }));
      h += [0, 1, 2, 3].map(function (i) { return Orbis.field('Produk paket ' + (i + 1) + (i > 1 ? ' (opsional)' : ''), 'sku' + i, (p.skus || [])[i] || '', { type: 'select', options: opts }); }).join('') +
        Orbis.field('Harga paket (Rp)', 'price', p.price || '', { type: 'number', min: 1 });
    }
    h += '<fieldset class="op-days"><legend>Outlet (kosong = semua outlet)</legend>' + outs.map(function (o) { return Orbis.field(o.name, 'out_' + o.id, p.outlets.indexOf(o.id) >= 0, { type: 'checkbox' }); }).join('') + '</fieldset>';
    return h;
  }
  function openForm(type, p) {
    var d = Orbis.db(), tabs = p ? '' : Orbis.tabs(Object.keys(AP().TYPES).map(function (k) { return [k, AP().TYPES[k]]; }), type, 'opType');
    Orbis.modal(p ? 'Ubah promo otomatis' : 'Promo otomatis baru', tabs + form(d, type, p), Orbis.btn('Batal', 'closeModal') + Orbis.btn('Simpan', 'opSave', null, { kind: 'primary' }));
  }
  A.opNew = function () { openForm(ui.type); };
  A.opType = function (t) { ui.type = t; openForm(t); };
  A.opEdit = function (id) { var p = Orbis.mine(Orbis.db(), 'autoPromos').filter(function (x) { return x.id === id; })[0]; if (p) openForm(p.type, p); };
  A.opStatus = function (id, st) { AP().setStatus(id, st); Orbis.toast(st === 'ACTIVE' ? 'Promo diaktifkan' : 'Promo dijeda'); };
  A.opSamples = function () { var n = AP().loadSamples(); Orbis.toast(n ? n + ' contoh promo ditambahkan' : 'Contoh promo sudah ada'); };
  function sc(f, p) { var s = f[p + 'Scope']; return { scope: s, ref: s === 'sku' ? f[p + 'Sku'] : s === 'category' ? f[p + 'Cat'] : '' }; }
  A.opSave = function () {
    var f = Orbis.formData(), num = function (v) { return v === '' || v == null ? '' : Number(v); };
    var spec = { name: f.name, type: f.type, start: f.start, end: f.end, quota: num(f.quota) || 0, pct: num(f.pct),
      outlets: Orbis.mine(Orbis.db(), 'outlets').filter(function (o) { return f['out_' + o.id]; }).map(function (o) { return o.id; }) };
    if (f.type === 'happyhour') { spec.from = f.from; spec.to = f.to; spec.days = DAYS.map(function (x, i) { return f['day' + i] ? i : -1; }).filter(function (i) { return i >= 0; }); spec.target = sc(f, 't'); }
    else if (f.type === 'bxgy') { spec.buy = Object.assign(sc(f, 'b'), { qty: num(f.buyQty) }); spec.get = Object.assign(sc(f, 'g'), { qty: num(f.getQty) }); }
    else { spec.skus = [f.sku0, f.sku1, f.sku2, f.sku3].filter(Boolean); spec.price = num(f.price); }
    AP().save(spec, f.id || undefined); Orbis.closeModal(); Orbis.toast('Promo disimpan');
  };

  /* ---------------- G4 Laba Rugi ---------------- */
  function filt(d) { var p = R2().preset(ui.preset); return { from: p.from, to: p.to, outlet: d.session.role === 'manager' ? d.session.outlet : ui.outlet }; }
  function filters(d, id, act) {
    return '<div id="' + id + '" class="filters">' +
      Orbis.field('Periode', 'preset', ui.preset, { type: 'select', options: [['today', 'Hari ini'], ['yesterday', 'Kemarin'], ['7d', '7 hari'], ['30d', '30 hari'], ['month', 'Bulan ini']] }) +
      Orbis.field('Outlet', 'outlet', ui.outlet, { type: 'select', options: [['', 'Semua outlet']].concat(R2().options(d).outlets) }) +
      Orbis.btn('Terapkan', act, null, { kind: 'primary' }) + '</div>';
  }
  function csvHref(rows, cols) { return 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + Orbis.domain.reports.exportCsv(rows, cols)); }
  Orbis.screens.pnl = function (d) {
    if (!Orbis.can('report.read')) return Orbis.empty('Peran ini tidak punya akses laporan.');
    var f = filt(d), r = PNL().report(d, f), t = r.totals, s = PNL().daily(d, f.outlet);
    var kpi = '<div class="stats">' + Orbis.stat('Penjualan bersih', idr(t.net), t.orders + ' pesanan') + Orbis.stat('Laba kotor', idr(t.grossProfit)) +
      Orbis.stat('Estimasi laba bersih', idr(t.profit), 'Margin ' + t.marginPct + '%') + '</div>';
    var wf = '<ul class="op-wf">' + r.rows.map(function (x) {
      return '<li class="op-wf-' + esc(x.kind) + '"><span>' + esc(x.label) + '</span><b>' + esc((x.amount < 0 ? '−' : '') + idr(Math.abs(x.amount))) + '</b></li>';
    }).join('') + '</ul>';
    var note = '<p class="fine mt">Estimasi: HPP dari snapshot biaya per baris pesanan; biaya pembayaran dari tarif di "Biaya & Pencairan". Biaya operasional belum punya outlet, jadi hanya dihitung pada "Semua outlet".</p>';
    var dl = '<a class="btn" download="laba-rugi-' + esc(f.from) + '_' + esc(f.to) + (f.outlet ? '-' + esc(f.outlet) : '') + '.csv" href="' + esc(csvHref(r.rows, [{ k: 'label', label: 'Pos' }, { k: 'amount', label: 'Jumlah (IDR)' }])) + '">Export CSV</a>';
    var daily = '<div class="stats">' + Orbis.stat('Penjualan bersih', idr(s.net)) + Orbis.stat('Pesanan', String(s.orders)) +
      Orbis.stat('Selisih kas', idr(s.cashVariance), s.shiftsClosed + ' shift ditutup') + '</div>' +
      '<p><b>Terlaris:</b> ' + (s.top.length ? s.top.map(function (x, i) { return esc((i + 1) + '. ' + x.name + ' (' + x.qty + ')'); }).join(', ') : '-') + '</p>' +
      '<p><b>Menunggu persetujuan:</b> ' + esc('Biaya ' + s.pending.expenses + ' · PO ' + s.pending.purchaseOrders + ' · Refund ' + s.pending.refunds + ' · Opname ' + s.pending.stockCounts) + '</p>' +
      '<p class="fine">Tanpa nama atau nomor pelanggan.</p>';
    var share = '<a class="btn btn-primary" target="_blank" rel="noopener" href="' + esc(s.waUrl) + '">Bagikan ke WhatsApp</a>';
    return Orbis.pageHead('Laba Rugi', 'Periode ' + f.from + ' s/d ' + f.to + ' (WIB).') + filters(d, 'opPnlF', 'opPnlApply') + kpi +
      Orbis.card('Laba rugi · Estimasi', wf + note, dl) + Orbis.card('Ringkasan harian · ' + s.day, daily, share);
  };
  A.opPnlApply = function () { var f = Orbis.readForm('#opPnlF'); ui.preset = f.preset || 'month'; ui.outlet = f.outlet || ''; rerender(); };

  /* ---------------- G5 Biaya & Pencairan ---------------- */
  Orbis.screens.fees = function (d) {
    if (!Orbis.can('report.read')) return Orbis.empty('Peran ini tidak punya akses laporan.');
    var f = filt(d), cfg = FEES().config(d), edit = Orbis.can('tenant.settings'), r = FEES().report(d, f);
    var cfgRows = FEES().METHODS.map(function (m) { return Object.assign({ key: m[0], name: m[1] }, cfg[m[0]]); });
    var cfgTbl = stack(Orbis.table([
      { label: 'Metode', k: 'name' },
      { label: 'Biaya % (basis poin, 70 = 0,7%)', fmt: function (x) { return edit ? '<input type="number" min="0" name="bp_' + esc(x.key) + '" value="' + esc(x.percentBp) + '" aria-label="' + esc('Basis poin ' + x.name) + '">' : esc(x.percentBp / 100 + '%'); } },
      { label: 'Biaya tetap (Rp)', fmt: function (x) { return edit ? '<input type="number" min="0" name="fx_' + esc(x.key) + '" value="' + esc(x.fixed) + '" aria-label="' + esc('Biaya tetap ' + x.name) + '">' : esc(idr(x.fixed)); } },
      { label: 'Cair (hari, T+n)', fmt: function (x) { return edit ? '<input type="number" min="0" max="7" name="sd_' + esc(x.key) + '" value="' + esc(x.settleDays) + '" aria-label="' + esc('Hari cair ' + x.name) + '">' : esc('T+' + x.settleDays); } }
    ], cfgRows));
    var cfgCard = Orbis.card('Tarif per metode', '<div id="opFeeF">' + cfgTbl + '</div><p class="fine mt">Biaya dihitung per transaksi (dibulatkan ke rupiah). Refund tidak mengembalikan biaya.</p>', edit ? Orbis.btn('Simpan tarif', 'opFeeSave', null, { kind: 'primary' }) : '');
    var t = r.totals;
    var rep = '<div class="stats">' + Orbis.stat('Diterima kotor', idr(t.gross)) + Orbis.stat('Biaya pembayaran', idr(t.fee)) + Orbis.stat('Bersih diterima', idr(t.net)) + '</div>' + stack(Orbis.table([
      { label: 'Metode', k: 'name' }, { label: 'Transaksi', right: true, k: 'count' },
      { label: 'Kotor', right: true, fmt: function (x) { return esc(idr(x.gross)); } }, { label: 'Biaya', right: true, fmt: function (x) { return esc(idr(x.fee)); } },
      { label: 'Bersih', right: true, fmt: function (x) { return esc(idr(x.net)); } }, { label: 'Cair', fmt: function (x) { return esc('T+' + x.settleDays); } }
    ], r.rows, 'Tidak ada pembayaran pada periode ini.'));
    var up = stack(Orbis.table([
      { label: 'Tanggal cair', k: 'date' }, { label: 'Metode', k: 'name' }, { label: 'Transaksi', right: true, k: 'count' },
      { label: 'Bersih', right: true, fmt: function (x) { return esc(idr(x.net)); } }
    ], r.upcoming, 'Tidak ada dana yang menunggu cair.'));
    var dl = r.rows.length ? '<a class="btn" download="biaya-pembayaran-' + esc(f.from) + '_' + esc(f.to) + '.csv" href="' + esc(csvHref(r.rows, [{ k: 'name', label: 'Metode' }, { k: 'count', label: 'Transaksi' }, { k: 'gross', label: 'Kotor' }, { k: 'fee', label: 'Biaya' }, { k: 'net', label: 'Bersih' }, { k: 'settleDays', label: 'Hari cair' }])) + '">Export CSV</a>' : '';
    return Orbis.pageHead('Biaya & Pencairan', 'Estimasi biaya MDR dan jadwal dana masuk per metode bayar. Bukan data settlement dari bank/PJP.') + filters(d, 'opFeesF', 'opFeesApply') +
      Orbis.card('Ringkasan per metode · Estimasi', rep, dl) + Orbis.card('Akan cair', up) + cfgCard;
  };
  A.opFeesApply = function () { var f = Orbis.readForm('#opFeesF'); ui.preset = f.preset || 'month'; ui.outlet = f.outlet || ''; rerender(); };
  A.opFeeSave = function () {
    var f = Orbis.readForm('#opFeeF'), cfg = {};
    FEES().METHODS.forEach(function (m) { var k = m[0]; cfg[k] = { percentBp: Number(f['bp_' + k] || 0), fixed: Number(f['fx_' + k] || 0), settleDays: Number(f['sd_' + k] || 0) }; });
    FEES().save(cfg); Orbis.toast('Tarif disimpan');
  };
})(typeof window !== 'undefined' ? window : globalThis);
