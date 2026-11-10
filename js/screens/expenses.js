/* Orbis v2 — screen: expenses (biaya, persetujuan bertingkat, aturan). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, A = Orbis.actions, E = Orbis.domain.expenses;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.expenses = Orbis.ui.expenses || { tab: 'list', status: '', open: '' };
  function rerender() { if (Orbis.render) Orbis.render(); }

  Orbis.screens.expenses = function (d) {
    var role = d.session.role, tabs = [['list', 'Biaya']];
    if (role === 'owner') tabs.push(['rules', 'Aturan persetujuan']);
    var tab = ui.tab === 'rules' && role === 'owner' ? 'rules' : 'list';
    var head = Orbis.pageHead('Biaya', 'Pengajuan, persetujuan sesuai nominal, lalu pembayaran.', Orbis.can('expense.write') ? Orbis.btn('Biaya baru', 'expNew', null, { kind: 'primary', icon: 'plus' }) : '');
    return head + (tabs.length > 1 ? Orbis.tabs(tabs, tab, 'expTab') : '') + (tab === 'rules' ? rulesView(d) : listView(d));
  };
  function listView(d) {
    var rows = Orbis.mine(d, 'expenses').slice().reverse();
    if (ui.status) rows = rows.filter(function (e) { return e.status === ui.status; });
    var filter = Orbis.field('Status', 'status', ui.status, { type: 'select', options: [['', 'Semua'], 'PENDING', 'APPROVED', 'REJECTED', 'PAID'] }).replace('<select', '<select data-change="expFilter"');
    var out = filter + Orbis.table([
      { label: 'Biaya', fmt: function (e) { return '<b>' + esc(e.id) + '</b><br>' + esc(e.category) + '<br><small>' + esc(e.note) + '</small>'; } },
      { label: 'Nominal', right: true, fmt: function (e) { return esc(Orbis.idr(e.amount)); } },
      { label: 'Lampiran', fmt: function (e) { return e.attachment ? esc(e.attachment.name) + '<br><small>' + esc(e.attachment.type) + ' · ' + esc(Math.ceil(e.attachment.size / 1024)) + ' KB</small>' : '-'; } },
      { label: 'Status', fmt: function (e) { return Orbis.chip(e.status) + (e.rejectReason ? '<br><small>' + esc(e.rejectReason) + '</small>' : ''); } },
      { label: 'Aksi', fmt: function (e) {
        var h = Orbis.btn('Riwayat', 'expTrail', [e.id]);
        if (e.status === 'PENDING' && Orbis.can('expense.approve')) h += Orbis.btn('Setujui', 'expApprove', [e.id], { kind: 'primary' }) + Orbis.btn('Tolak', 'expRejectOpen', [e.id]);
        if (e.status === 'APPROVED' && Orbis.can('expense.pay')) h += Orbis.btn('Bayar', 'expPay', [e.id], { kind: 'primary' });
        return h;
      } }
    ], rows, 'Belum ada biaya.');
    if (ui.open) {
      var e = rows.filter(function (x) { return x.id === ui.open; })[0];
      if (e) out += Orbis.card('Riwayat ' + e.id, '<ul>' + e.history.map(function (h) { return '<li>' + esc(Orbis.fmtTime(h.at)) + ' · ' + esc(h.by) + ' · ' + esc(h.action) + ' → ' + esc(h.status) + '</li>'; }).join('') + '</ul>');
    }
    return out;
  }
  function rulesView(d) {
    return '<p>' + Orbis.btn('Aturan baru', 'expRuleNew', null, { kind: 'primary', icon: 'plus' }) + '</p>' + Orbis.table([
      { label: 'Dari', right: true, fmt: function (r) { return esc(Orbis.idr(r.min)); } }, { label: 'Sampai', right: true, fmt: function (r) { return esc(Orbis.idr(r.max)); } },
      { label: 'Penyetuju', fmt: function (r) { return esc(r.role) + ' (owner selalu bisa)'; } },
      { label: 'Aksi', fmt: function (r) { return Orbis.btn('Hapus', 'expRuleDel', [r.id], { kind: 'danger' }); } }
    ], E.rules(d), 'Belum ada aturan. Biaya tanpa aturan tidak bisa disetujui.');
  }

  A.expTab = function (t) { ui.tab = t; rerender(); };
  A.expFilter = function (v) { ui.status = v; rerender(); };
  A.expTrail = function (id) { ui.open = ui.open === id ? '' : id; rerender(); };
  A.expNew = function () {
    Orbis.modal('Biaya baru', Orbis.field('Kategori', 'category', E.CATEGORIES[0], { type: 'select', options: E.CATEGORIES }) + Orbis.field('Nominal (Rp)', 'amount', '', { type: 'number', min: 1 }) +
      Orbis.field('Catatan', 'note', '') + '<div class="fld"><label for="f-att">Lampiran (pdf/png/jpg, maks 2 MB)</label><input id="f-att" type="file" accept=".pdf,.png,.jpg,.jpeg"></div>',
      Orbis.btn('Ajukan', 'expSave', null, { kind: 'primary' }));
  };
  A.expSave = function () {
    var f = Orbis.formData(), el = document.getElementById('f-att'), file = el && el.files && el.files[0];
    var att = file ? { name: file.name, size: file.size, type: (file.type || (file.name.split('.').pop() || '')).toLowerCase() } : null;
    E.create({ category: f.category, amount: f.amount === '' ? NaN : Number(f.amount), note: f.note, attachment: att });
    Orbis.closeModal(); Orbis.toast('Biaya diajukan');
  };
  A.expApprove = function (id) { E.approve(id); Orbis.toast('Biaya disetujui'); };
  A.expRejectOpen = function (id) { Orbis.modal('Tolak biaya', '<input type="hidden" name="id" value="' + esc(id) + '">' + Orbis.field('Alasan (min. 5 karakter)', 'reason', ''), Orbis.btn('Tolak', 'expReject', null, { kind: 'danger' })); };
  A.expReject = function () { var f = Orbis.formData(); E.reject(f.id, f.reason); Orbis.closeModal(); Orbis.toast('Biaya ditolak'); };
  A.expPay = function (id) { E.pay(id); Orbis.toast('Biaya dibayar'); };
  A.expRuleNew = function () {
    Orbis.modal('Aturan persetujuan', Orbis.field('Dari (Rp)', 'min', 0, { type: 'number', min: 0 }) + Orbis.field('Sampai (Rp)', 'max', '', { type: 'number', min: 0 }) + Orbis.field('Penyetuju', 'role', 'manager', { type: 'select', options: ['manager', 'finance', 'owner'] }), Orbis.btn('Simpan', 'expRuleSave', null, { kind: 'primary' }));
  };
  A.expRuleSave = function () { var f = Orbis.formData(); E.addRule({ min: Number(f.min), max: f.max === '' ? NaN : Number(f.max), role: f.role }); Orbis.closeModal(); Orbis.toast('Aturan disimpan'); };
  A.expRuleDel = function (id) { E.removeRule(id); Orbis.toast('Aturan dihapus'); };
})(typeof window !== 'undefined' ? window : globalThis);
