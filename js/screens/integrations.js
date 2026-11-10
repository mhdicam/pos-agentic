/* Integrations screen: provider cards, connect modal (alias/scope/sync only), unofficial WA risk gate. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, C = function () { return Orbis.domain.comms; };
  var KIND = { messaging: 'Pesan', payments: 'Pembayaran', logistics: 'Logistik', marketplace: 'Marketplace', developer: 'Developer' };
  var NOKEY = '<p class="banner">Tidak ada kunci API di browser. Kunci/token disimpan terisolasi di server; layar ini hanya menyimpan alias, scope, dan mode sinkron.</p>';

  Orbis.screens.integrations = function (d) {
    var can = Orbis.can('integration.write'), owner = d.session.role === 'owner';
    var flag = d.platform.flags.some(function (f) { return f.name === 'unofficial_wa' && f.on; });
    var cards = C().CATALOG.map(function (p) {
      var row = C().integrationRow(d, p.id), on = row && row.status === 'connected';
      var blockWhy = !can ? 'Peran Anda tidak boleh mengubah integrasi.' : (!p.official && !owner) ? 'Hanya Owner.' : (!p.official && !flag) ? 'Fitur dimatikan platform (flag unofficial_wa).' : '';
      var body = '<p>' + esc(p.desc) + '</p>' + (p.experimental ? '<div class="banner" role="note"><b>Eksperimental &amp; berisiko.</b> Nomor dapat diblokir dan pemakaian dapat melanggar ketentuan penyedia. Default mati; butuh persetujuan risiko, hanya Owner.</div>' : '') +
        (on ? '<small>Alias: ' + esc(row.alias) + ' · Scope: ' + esc(row.scope) + ' · Sinkron: ' + esc(row.sync) + '</small>' : '');
      if (on && row.checklist) body += '<ul>' + row.checklist.map(function (s) { return '<li>' + Orbis.icon('check', 14) + ' ' + esc(s.step) + '</li>'; }).join('') + '</ul>';
      var act = on ? Orbis.btn('Putuskan', 'intDisconnect', [p.id], { kind: 'danger', disabled: !can }) : Orbis.btn('Hubungkan', 'intConnect', [p.id], { kind: 'primary', disabled: !!blockWhy, title: blockWhy });
      return Orbis.card(p.name, body + '<div class="row">' + act + '</div>' + (blockWhy && !on ? '<small>' + esc(blockWhy) + '</small>' : ''),
        Orbis.chip(on ? 'connected' : 'OFFLINE', on ? 'Terhubung' : (row ? 'Terputus' : 'Belum terhubung')) + ' <small>' + esc(KIND[p.kind]) + '</small>');
    });
    return Orbis.pageHead('Integrasi', 'Hubungkan kanal dan penyedia. Rahasia penyedia tidak pernah disimpan di browser.') + NOKEY + '<div class="grid g2">' + cards.join('') + '</div>';
  };

  var A = Orbis.actions;
  A.intConnect = function (id) {
    var p = C().provider(id); if (!p) throw Orbis.Err('NOT_FOUND', 'Penyedia tidak dikenal');
    var body = NOKEY + Orbis.field('Alias koneksi', 'alias', '', { placeholder: 'mis. Toko Utama' }) +
      Orbis.field('Scope', 'scope', p.scopes[0], { type: 'select', options: p.scopes }) +
      Orbis.field('Mode sinkron', 'sync', 'manual', { type: 'select', options: [['manual', 'Manual'], ['hourly', 'Per jam'], ['realtime', 'Realtime']] });
    if (id === 'wa-official') body += '<p><b>Checklist (simulasi):</b></p><ul>' + C().WA_CHECKLIST.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    if (!p.official) body += '<div class="banner" role="alert"><b>Peringatan risiko.</b> Jalur tidak resmi dapat membuat nomor diblokir dan melanggar ketentuan platform. Tidak ada fitur penyamaran. Tanggung jawab di tangan Anda.</div>' + Orbis.field('Saya memahami dan menerima risiko ini', 'riskAck', false, { type: 'checkbox' });
    Orbis.modal('Hubungkan ' + p.name, body, Orbis.btn('Hubungkan', 'intSubmit', [id], { kind: 'primary' }));
  };
  A.intSubmit = function (id) {
    var f = Orbis.formData();
    C().connect(id, { alias: f.alias, scope: f.scope, sync: f.sync, riskAck: f.riskAck === true });
    Orbis.closeModal(); Orbis.toast('Integrasi terhubung');
  };
  A.intDisconnect = function (id) {
    var r = C().disconnect(id);
    Orbis.toast('Integrasi diputus' + (r.flipped ? '; ' + r.flipped + ' percakapan dialihkan ke staf' : ''));
  };
})(typeof window !== 'undefined' ? window : globalThis);
