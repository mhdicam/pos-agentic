/* AI settings screen: mode, persona, budget, credit meter, analytics, KB manager, test prompt (no send, no credit). */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc, C = function () { return Orbis.domain.comms; };
  var ui = (Orbis.ui = Orbis.ui || {}); ui.ai = ui.ai || { test: null };

  Orbis.screens.ai = function (d) {
    var t = d.tenants.filter(function (x) { return x.id === d.session.tenant; })[0], can = Orbis.can('ai.configure');
    var cap = C().aiCap(d), used = t.aiUsed || 0, pct = cap ? Math.min(100, Math.round(used * 100 / cap)) : 100, st = C().stats(d);
    var dis = can ? '' : ' disabled';
    var settings = '<div id="ai-set"><fieldset' + dis + '>' +
      Orbis.field('Mode AI', 'aiMode', t.aiMode, { type: 'select', options: [['off', 'Mati'], ['assist', 'Assist (draft saja, staf yang kirim)'], ['auto', 'Auto (AI mengirim balasan)']] }) +
      Orbis.field('Persona (maks 300 karakter)', 'persona', t.aiPersona || '', { type: 'textarea' }) +
      Orbis.field('Anggaran kredit (0-' + (t.aiCredits || 0) + ')', 'budget', t.aiBudget || 0, { type: 'number', min: 0, hint: 'Batas efektif = min(kredit paket, anggaran). Habis: AI berhenti dan percakapan diserahkan ke staf.' }) +
      Orbis.field('Kata kunci eskalasi (pisahkan koma)', 'keywords', (t.escKeywords && t.escKeywords.length ? t.escKeywords : ['refund', 'komplain', 'marah', 'batalkan']).join(', ')) +
      '</fieldset>' + Orbis.btn('Simpan pengaturan', 'aiSave', null, { kind: 'primary', disabled: !can, title: can ? '' : 'Hanya Owner / AI Manager' }) + '</div>';
    var meter = '<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="' + esc(cap) + '" aria-valuenow="' + esc(used) + '"><div style="width:' + pct + '%"></div></div>' +
      '<p><b>' + esc(used) + ' / ' + esc(cap) + '</b> kredit terpakai ' + (used >= cap ? Orbis.chip('FAILED', 'Batas tercapai') : Orbis.chip('ACTIVE', 'Tersedia ' + (cap - used))) + '</p><small>Paket: ' + esc(t.aiCredits || 0) + ' kredit. Biaya 1 kredit per balasan terkirim.</small>';
    var stats = '<div class="grid g4">' + Orbis.stat('Balasan AI', st.ai) + Orbis.stat('Balasan staf', st.human) + Orbis.stat('Eskalasi', st.escalations) + Orbis.stat('Handoff', st.handoffs) + '</div>';
    var kb = Orbis.table([
      { label: 'Pertanyaan', fmt: function (k) { return esc(k.q); } },
      { label: 'Jawaban', fmt: function (k) { return esc(k.a); } },
      { label: 'Status', fmt: function (k) { return Orbis.chip(k.published ? 'ACTIVE' : 'DRAFT', k.published ? 'Terbit' : 'Draft'); } },
      { label: 'Aksi', fmt: function (k) { return Orbis.btn(k.published ? 'Batal terbit' : 'Terbitkan', 'kbToggle', [k.id], { disabled: !can }) + Orbis.btn('Edit', 'kbEdit', [k.id], { disabled: !can }) + Orbis.btn('Hapus', 'kbRemove', [k.id], { kind: 'danger', disabled: !can }); } }
    ], Orbis.mine(d, 'kb'), 'KB kosong. Tanpa KB terbit, AI akan mengeskalasi semua pertanyaan.');
    var tp = ui.ai.test;
    var test = '<div id="ai-test">' + Orbis.field('Uji prompt (tidak dikirim, tanpa kredit)', 'prompt', '', { placeholder: 'mis. Jam buka?' }) + Orbis.btn('Lihat draft', 'aiTest', null, { disabled: !can }) + '</div>' +
      (tp ? '<div class="draft"><b>Hasil:</b> ' + (tp.escalate ? Orbis.chip('PENDING', 'Eskalasi ke staf') : Orbis.chip('ACTIVE', 'Draft')) + '<p>' + esc(tp.text || tp.note || '') + '</p>' + (tp.text && tp.note ? '<small>' + esc(tp.note) + '</small>' : '') + '</div>' : '');
    return Orbis.pageHead('AI Agent', 'AI hanya menyusun teks dari KB terbit dan status pesanan (baca saja). Tidak pernah menjalankan refund, ubah harga/stok, atau batalkan pesanan.') +
      '<div class="grid g2">' + Orbis.card('Pengaturan', settings) + '<div>' + Orbis.card('Kredit', meter) + Orbis.card('Uji prompt', test) + '</div></div>' +
      Orbis.card('Analitik', stats) +
      Orbis.card('Knowledge base', kb, Orbis.btn('Tambah entri', 'kbEdit', [''], { disabled: !can }));
  };

  var A = Orbis.actions;
  A.aiSave = function () {
    var f = Orbis.readForm('#ai-set');
    C().configureAi({ aiMode: f.aiMode, persona: f.persona, budget: Number(f.budget), keywords: f.keywords });
    Orbis.toast('Pengaturan AI disimpan');
  };
  A.aiTest = function () {
    var f = Orbis.readForm('#ai-test');
    ui.ai.test = Orbis.read(function (d) { return C().testPrompt(d, f.prompt); }); Orbis.render && Orbis.render();
  };
  A.kbToggle = function (id) { C().kbToggle(id); };
  A.kbRemove = function (id) { C().kbRemove(id); Orbis.toast('Entri dihapus'); };
  A.kbEdit = function (id) {
    var k = id ? Orbis.mine(Orbis.db(), 'kb').filter(function (x) { return x.id === id; })[0] : null; k = k || {};
    Orbis.modal(k.id ? 'Edit entri KB' : 'Entri KB baru',
      '<input type="hidden" name="id" value="' + esc(k.id || '') + '">' + Orbis.field('Pertanyaan', 'q', k.q || '') + Orbis.field('Jawaban', 'a', k.a || '', { type: 'textarea' }) + Orbis.field('Terbitkan', 'published', !!k.published, { type: 'checkbox' }),
      Orbis.btn('Simpan', 'kbSave', null, { kind: 'primary' }));
  };
  A.kbSave = function () { var f = Orbis.formData(); C().kbSave({ id: f.id || null, q: f.q, a: f.a, published: f.published }); Orbis.closeModal(); Orbis.toast('KB disimpan'); };
})(typeof window !== 'undefined' ? window : globalThis);
