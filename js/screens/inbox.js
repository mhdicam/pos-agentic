/* Inbox screen: list | thread | AI draft + send box. Pure render; actions call Orbis.domain.comms. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, C = function () { return Orbis.domain.comms; };
  var ui = (Orbis.ui = Orbis.ui || {}); ui.inbox = ui.inbox || { filter: 'all', sel: null, sim: '' };

  function ownerChip(c) { return c.owner === 'AI_ACTIVE' ? Orbis.chip('ACTIVE', 'AI aktif') : Orbis.chip('PENDING', 'Staf aktif'); }

  function handoffBlock(d, c, t) {
    var can = Orbis.can('inbox.reply'), v = c.version || 0, ai = c.owner === 'AI_ACTIVE';
    var why = '', cap = C().aiLeft(d);
    if (!can) why = 'Peran Anda tidak boleh membalas.';
    var toAiWhy = '';
    if (ai) toAiWhy = 'AI sudah memegang percakapan ini.';
    else if (t.aiMode === 'off') toAiWhy = 'AI nonaktif (ubah di menu AI Agent).';
    else if (cap <= 0) toAiWhy = 'Kredit/anggaran AI habis.';
    var toHumanWhy = !ai ? 'Staf sudah memegang percakapan ini.' : '';
    return '<div class="hand"><div><b>Dipegang oleh:</b> ' + (ai ? 'AI' : 'Staf') + ' ' + ownerChip(c) + ' <small>v' + esc(v) + '</small></div>' +
      '<div class="row">' +
      Orbis.btn('Ambil alih (Staf)', 'inboxHandoff', [c.id, 'HUMAN', v], { disabled: !can || !ai, title: why || toHumanWhy }) +
      Orbis.btn('Serahkan ke AI', 'inboxHandoff', [c.id, 'AI', v], { disabled: !can || !!toAiWhy, title: why || toAiWhy }) + '</div>' +
      ((why || toAiWhy || toHumanWhy) ? '<small class="muted">' + esc(why || (ai ? toHumanWhy : '') || toAiWhy) + (ai ? '' : ' ' + esc(toAiWhy && !why ? toAiWhy : '')) + '</small>' : '') + '</div>';
  }

  function thread(d, c, t) {
    var msgs = c.messages.map(function (m) {
      var who = m.by === 'in' ? c.contact : m.by === 'ai' ? 'AI' : m.by === 'human' ? 'Staf' : 'Sistem';
      return '<div class="msg msg-' + esc(m.by) + '"><small>' + esc(who) + ' · ' + esc(Orbis.fmtTime(m.at)) + '</small><div>' + esc(m.text) + '</div></div>';
    }).join('');
    var human = c.owner === 'HUMAN_ACTIVE', canReply = Orbis.can('inbox.reply');
    var draft = c.suggestion ? '<div class="draft"><b>Draft AI</b> <small>(' + (t.aiMode === 'off' ? 'AI nonaktif' : 'tidak dikirim otomatis') + ')</small><p>' + esc(c.suggestion) + '</p>' +
      Orbis.btn('Pakai draft', 'inboxUseDraft', [c.id], { disabled: !canReply || !human, title: human ? '' : 'Ambil alih dulu untuk memakai draft' }) + '</div>' : '<div class="draft muted">Belum ada draft AI.</div>';
    var send = '<div id="inbox-send"><div class="fld"><label for="f-inbox-text">Balasan staf</label><textarea id="f-inbox-text" name="text" rows="3" maxlength="1000" ' + (human && canReply ? '' : 'disabled') + '>' + esc(c.draft || '') + '</textarea>' +
      (human && canReply ? '' : '<small>' + esc(!canReply ? 'Peran Anda tidak boleh membalas.' : 'Ambil alih percakapan untuk membalas.') + '</small>') + '</div>' +
      Orbis.btn('Kirim', 'inboxSend', [c.id], { kind: 'primary', disabled: !human || !canReply, title: human ? '' : 'Percakapan dipegang AI' }) + '</div>';
    var sim = Orbis.can('inbox.simulate') ? '<div id="inbox-sim" class="fld"><label for="f-inbox-sim">Simulasi pesan masuk pelanggan</label><input id="f-inbox-sim" name="sim" maxlength="1000" placeholder="mis. Jam buka outlet?">' + Orbis.btn('Terima pesan (simulasi)', 'inboxSimulate', [c.id]) + '</div>' : '';
    return '<div class="thread-h"><h3>' + esc(c.contact) + '</h3> <small>' + esc(c.channel) + '</small></div>' + handoffBlock(d, c, t) +
      '<div class="msgs" aria-live="polite">' + msgs + '</div>' + draft + send + sim;
  }

  Orbis.screens.inbox = function (d) {
    var u = ui.inbox, t = d.tenants.filter(function (x) { return x.id === d.session.tenant; })[0];
    var all = Orbis.mine(d, 'conversations');
    var list = all.filter(function (c) { return u.filter === 'human' ? c.owner === 'HUMAN_ACTIVE' : u.filter === 'ai' ? c.owner === 'AI_ACTIVE' : u.filter === 'unread' ? c.unread > 0 : true; });
    var sel = all.filter(function (c) { return c.id === u.sel; })[0] || list[0] || null;
    var unread = all.reduce(function (s, c) { return s + (c.unread || 0); }, 0);
    var items = list.length ? list.map(function (c) {
      var last = c.messages[c.messages.length - 1];
      return '<button type="button" class="conv' + (sel && sel.id === c.id ? ' on' : '') + '" data-act="inboxSelect" data-args="' + esc(JSON.stringify([c.id])) + '"><b>' + esc(c.contact) + '</b> ' + ownerChip(c) + (c.unread ? ' <span class="chip chip-warn">' + esc(c.unread) + ' baru</span>' : '') + '<small>' + esc(last ? last.text : '') + '</small></button>';
    }).join('') : Orbis.empty('Tidak ada percakapan pada filter ini.');
    var conn = Orbis.mine(d, 'integrations').some(function (i) { return i.kind === 'messaging' && i.status === 'connected'; });
    return Orbis.pageHead('Inbox', 'Percakapan pelanggan. AI hanya menyusun teks dari KB terbit; tidak pernah mengubah pesanan, harga, stok, atau refund.', unread ? Orbis.chip('PENDING', unread + ' belum dibaca') : '') +
      (conn ? '' : '<div class="banner">Kanal pesan belum terhubung. Pesan masuk ditolak sampai integrasi tersambung.</div>') +
      '<div class="inbox3"><aside class="card"><div class="card-b">' + Orbis.tabs([['all', 'Semua'], ['human', 'Staf'], ['ai', 'AI'], ['unread', 'Belum dibaca']], u.filter, 'inboxFilter') + items + '</div></aside>' +
      '<section class="card"><div class="card-b">' + (sel ? thread(d, sel, t) : Orbis.empty('Pilih percakapan.')) + '</div></section></div>';
  };

  var A = Orbis.actions;
  A.inboxFilter = function (f) { ui.inbox.filter = f; Orbis.render && Orbis.render(); };
  A.inboxSelect = function (id) { ui.inbox.sel = id; C().markRead(id); };
  A.inboxHandoff = function (id, to, v) { C().handoff(id, to, v); Orbis.toast('Handoff berhasil'); };
  A.inboxUseDraft = function (id) { C().useDraft(id); Orbis.toast('Draft dimasukkan ke kotak balasan (belum dikirim)'); };
  A.inboxSend = function (id) { var f = Orbis.readForm('#inbox-send'); C().sendHuman(id, f.text); Orbis.toast('Pesan terkirim'); };
  A.inboxSimulate = function (id) {
    var f = Orbis.readForm('#inbox-sim'), r = C().receiveInbound(id, f.sim);
    Orbis.toast(r.ai.sent ? 'AI membalas (1 kredit)' : r.ai.drafted ? 'Draft AI disiapkan' : r.ai.escalated ? 'Dieskalasi ke staf' : 'Pesan diterima');
  };
})(typeof window !== 'undefined' ? window : globalThis);
