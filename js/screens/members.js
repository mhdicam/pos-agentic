/* Orbis v2 — screen: members (list, register, detail + ledger, settings). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc;
  Orbis.ui = Orbis.ui || {};
  var ui = Orbis.ui.members = Orbis.ui.members || { q: '', sel: null };
  var M = function () { return Orbis.domain.members; };

  var TIER_TONE = { Bronze: 'mute', Silver: 'warn', Gold: 'ok' };
  function tierChip(t) { return '<span class="chip chip-' + TIER_TONE[t] + '">' + esc(t) + '</span>'; }

  function detail(d) {
    var m = ui.sel && M().get(d, ui.sel);
    if (!m) return '';
    var rows = M().ledger(d, m.id).slice().reverse();
    var tbl = Orbis.table([
      { label: 'Waktu', fmt: function (r) { return esc(Orbis.fmtTime(r.at)); } },
      { label: 'Jenis', fmt: function (r) { return esc(r.type); } },
      { label: 'Pesanan', fmt: function (r) { return esc(r.orderId); } },
      { label: 'Poin', right: true, fmt: function (r) { return esc((r.points > 0 ? '+' : '') + r.points); } },
      { label: 'Saldo', right: true, fmt: function (r) { return esc(r.balance); } }
    ], rows, 'Belum ada mutasi poin.');
    var tier = M().tier(m.lifetime);
    return Orbis.card('Detail: ' + m.name,
      '<div class="grid g3">' + Orbis.stat('Saldo poin', m.points) + Orbis.stat('Total belanja', Orbis.idr(m.lifetime)) + Orbis.stat('Tier', tier) + '</div>' +
      '<p>' + esc(m.phone) + ' ' + (m.consent ? Orbis.chip('ACTIVE', 'Consent ya') : Orbis.chip('REJECTED', 'Tanpa consent')) + '</p>' + tbl,
      Orbis.btn('Tutup', 'membersSelect', [null]));
  }

  Orbis.screens.members = function (d) {
    var can = Orbis.can('member.write'), canSet = Orbis.can('member.settings');
    var list = M().search(d, ui.q);
    var s = M().getSettings(d);
    var out = Orbis.pageHead('Member', 'Poin & tier pelanggan. Tier: Bronze, Silver (>= Rp 1.000.000), Gold (>= Rp 3.000.000).',
      can ? Orbis.btn('Daftar member', 'memberRegisterOpen', null, { kind: 'primary', icon: 'plus' }) : '');
    out += '<div class="fld"><label for="m-q">Cari nama / HP</label><input id="m-q" type="search" value="' + esc(ui.q) + '" data-change="membersSearch" placeholder="Ketik lalu tekan Enter"></div>';
    out += Orbis.card('Daftar member (' + list.length + ')', Orbis.table([
      { label: 'Nama', fmt: function (m) { return esc(m.name); } },
      { label: 'HP', fmt: function (m) { return esc(m.phone); } },
      { label: 'Tier', fmt: function (m) { return tierChip(M().tier(m.lifetime)); } },
      { label: 'Poin', right: true, fmt: function (m) { return esc(m.points); } },
      { label: 'Belanja', right: true, fmt: function (m) { return esc(Orbis.idr(m.lifetime)); } },
      { label: '', fmt: function (m) { return Orbis.btn('Detail', 'membersSelect', [m.id]); } }
    ], list, 'Belum ada member.'));
    out += detail(d);
    out += Orbis.card('Pengaturan poin', canSet ?
      '<div id="m-set" class="grid g3">' + Orbis.field('Poin per belanja (Rp)', 'earnUnit', s.earnUnit, { type: 'number', min: 1000 }) +
      Orbis.field('Nilai 1 poin (Rp)', 'redeemValue', s.redeemValue, { type: 'number', min: 1 }) +
      Orbis.field('Maks. tukar (% belanja)', 'maxPercent', s.maxPercent, { type: 'number', min: 0 }) + '</div>' + Orbis.btn('Simpan pengaturan', 'memberSettingsSave', null, { kind: 'primary' }) :
      '<p>Dapat 1 poin per ' + esc(Orbis.idr(s.earnUnit)) + '; 1 poin = ' + esc(Orbis.idr(s.redeemValue)) + '; maks. ' + esc(s.maxPercent) + '% belanja. Hanya owner/manager yang bisa mengubah.</p>');
    return out;
  };

  var A = Orbis.actions;
  A.membersSelect = function (id) { ui.sel = id; Orbis.render && Orbis.render(); };
  A.membersSearch = function (v) { ui.q = v; Orbis.render && Orbis.render(); };
  A.memberRegisterOpen = function () {
    Orbis.modal('Daftar member',
      Orbis.field('Nama', 'name', '') + Orbis.field('No. HP', 'phone', '', { type: 'tel', placeholder: '08xxxxxxxxxx' }) +
      Orbis.field('Pelanggan menyetujui data pribadinya disimpan untuk program member', 'consent', false, { type: 'checkbox' }),
      Orbis.btn('Batal', 'closeModal') + Orbis.btn('Daftarkan', 'memberRegisterSave', null, { kind: 'primary' }));
  };
  A.memberRegisterSave = function () {
    var f = Orbis.formData();
    var m = M().register({ name: f.name, phone: f.phone, consent: f.consent === true });
    Orbis.closeModal(); ui.sel = m.id; Orbis.toast('Member terdaftar');
  };
  A.memberSettingsSave = function () {
    var f = Orbis.readForm('#m-set');
    M().saveSettings({ earnUnit: Number(f.earnUnit), redeemValue: Number(f.redeemValue), maxPercent: Number(f.maxPercent) });
    Orbis.toast('Pengaturan poin disimpan');
  };
})(typeof window !== 'undefined' ? window : globalThis);
