/* Orbis v2 — comms domain: inbox/handoff, AI reply engine (draft-only text, never actions), KB, CRM, integrations.
   HARD RULES (AGENTS.md / ADR-0007): AI never runs SQL/refund/price/stock/cancel; it only composes text from
   published KB + read-only order status. Inbound text and KB content are DATA, never instructions.
   No provider secret is ever accepted or stored here (alias/scope/sync only). Client simulation, not a security boundary. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, C = Orbis.domain.comms = {};

  Orbis.PERMS['inbox.simulate'] = ['owner', 'manager', 'cs', 'ai'];

  var DEFAULT_KEYWORDS = ['refund', 'komplain', 'marah', 'batalkan'];
  var INJECTION = /(ignore|abaikan|lupakan|disregard|forget)\s+(all\s+|semua\s+)?(the\s+)?(previous|prior|above|sebelumnya|instruksi|instructions?)|system\s*prompt|prompt\s*sistem|you\s+are\s+now|jailbreak/i;
  var STAGES = ['NEW', 'CONTACTED', 'QUOTED', 'WON', 'LOST'];
  var SYNC = ['manual', 'hourly', 'realtime'];

  /** Provider catalog. Config stored per tenant = alias, scope, sync only. */
  C.CATALOG = [
    { id: 'wa-official', kind: 'messaging', name: 'WhatsApp Cloud API', official: true, experimental: false, scopes: ['messages', 'templates', 'media'], desc: 'Jalur resmi Meta. Direkomendasikan untuk Inbox dan AI.' },
    { id: 'wa-unofficial', kind: 'messaging', name: 'WhatsApp tidak resmi (linked device)', official: false, experimental: true, scopes: ['messages'], desc: 'Eksperimental, default mati. Risiko pemblokiran nomor dan pelanggaran ketentuan platform.' },
    { id: 'midtrans', kind: 'payments', name: 'Midtrans', official: true, scopes: ['charge', 'status'], desc: 'Gateway pembayaran QRIS, VA, kartu.' },
    { id: 'xendit', kind: 'payments', name: 'Xendit', official: true, scopes: ['charge', 'status'], desc: 'Gateway pembayaran dan disbursement.' },
    { id: 'biteship', kind: 'logistics', name: 'Biteship (kurir pihak ketiga)', official: true, scopes: ['rates', 'booking', 'tracking'], desc: 'Tarif, booking dan pelacakan kurir.' },
    { id: 'marketplace', kind: 'marketplace', name: 'Marketplace (Shopee/Tokopedia)', official: true, scopes: ['orders', 'stock'], desc: 'Sinkron pesanan dan stok marketplace.' },
    { id: 'webhook', kind: 'developer', name: 'Webhook developer', official: true, scopes: ['order.events', 'stock.events'], desc: 'Kirim event ke endpoint Anda. Tanda tangan dibuat server-side.' }
  ];
  C.provider = function (id) { return C.CATALOG.filter(function (p) { return p.id === id; })[0] || null; };

  function tenantRow(d) { return d.tenants.filter(function (t) { return t.id === d.session.tenant; })[0]; }
  function conv(d, id) {
    var c = Orbis.mine(d, 'conversations').filter(function (x) { return x.id === id; })[0];
    if (!c) throw Orbis.Err('NOT_FOUND', 'Percakapan tidak ditemukan');
    if (c.version == null) c.version = 0;
    c.messages.forEach(function (m) { if (!m.id) m.id = Orbis.nextId(d, 'MSG', 5); });
    return c;
  }
  function norm(p) { var s = String(p || '').replace(/\D/g, ''); if (s.indexOf('62') === 0) s = '0' + s.slice(2); return s; }
  function phoneOf(d, c) {
    if (c.phone) return norm(c.phone);
    var ct = Orbis.mine(d, 'contacts').filter(function (x) { return x.name === c.contact; })[0];
    return ct ? norm(ct.phone) : '';
  }
  function say(d, c, by, text, extra) {
    var m = { id: Orbis.nextId(d, 'MSG', 5), by: by, text: text, at: Orbis.clock.now() };
    if (extra) for (var k in extra) m[k] = extra[k];
    c.messages.push(m); return m;
  }
  function setOwner(d, c, to, why, kind) {
    c.owner = to; c.version = (c.version || 0) + 1;
    say(d, c, 'system', why, { sys: kind || 'HANDOFF' });
  }

  /* ---------- AI budget ---------- */
  C.aiCap = function (d) { var t = tenantRow(d); return Math.max(0, Math.min(t.aiCredits || 0, t.aiBudget || 0)); };
  C.aiLeft = function (d) { return Math.max(0, C.aiCap(d) - (tenantRow(d).aiUsed || 0)); };
  C.channelConnected = function (d, channel) {
    return Orbis.mine(d, 'integrations').some(function (i) { return i.kind === 'messaging' && i.status === 'connected' && (channel === 'whatsapp' ? true : false); });
  };

  /* ---------- rule engine (read-only, deterministic) ---------- */
  var STOP = ['yang', 'dan', 'untuk', 'apa', 'ada', 'bisa', 'the', 'is', 'of', 'kah', 'nya', 'dari', 'ke', 'di'];
  function tokens(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9À-ɏ ]+/g, ' ').split(/\s+/).filter(function (w) { return w.length >= 3 && STOP.indexOf(w) < 0; }); }

  C.detectEscalation = function (d, text) {
    var t = tenantRow(d), kws = (t.escKeywords && t.escKeywords.length ? t.escKeywords : DEFAULT_KEYWORDS), low = String(text || '').toLowerCase();
    if (INJECTION.test(low)) return { escalate: true, reason: 'INJECTION', why: 'Pesan terdeteksi mencoba mengubah instruksi AI — dialihkan ke staf.' };
    var hit = kws.filter(function (k) { return k && low.indexOf(String(k).toLowerCase()) >= 0; })[0];
    if (hit) return { escalate: true, reason: 'KEYWORD', why: 'Kata kunci eskalasi "' + hit + '" — dialihkan ke staf.' };
    return { escalate: false };
  };

  /** Returns {kind:'kb'|'order'|'verify'|'none', text, kbId?}. Pure: reads d only. KB/inbound are data. */
  C.compose = function (d, text, c) {
    var low = String(text || '').toLowerCase();
    var intent = /pesanan|order|resi|status|paket|kiriman|ord-\d+/i.test(low);
    if (intent) {
      var phone = phoneOf(d, c || {}), orders = Orbis.mine(d, 'orders');
      var named = orders.filter(function (o) { return low.indexOf(String(o.id).toLowerCase()) >= 0; })[0];
      var mine = function (o) { return phone && o.customer && norm(o.customer.phone) === phone; };
      var found = named ? (mine(named) ? named : null) : orders.filter(mine).slice(-1)[0];
      if (found) return { kind: 'order', text: 'Pesanan ' + found.id + ' berstatus ' + found.status + '.' };
      return { kind: 'verify', text: 'Demi keamanan, kami tidak bisa menampilkan detail pesanan di chat. Silakan cek status lewat tautan pelacakan pesanan dengan nomor pesanan dan nomor telepon Anda.' };
    }
    var qt = tokens(text), best = null, bs = 0;
    Orbis.mine(d, 'kb').forEach(function (k) {
      if (!k.published) return;
      var kt = tokens(k.q); if (!kt.length) return;
      var hit = kt.filter(function (w) { return qt.indexOf(w) >= 0; }).length;
      var score = hit / kt.length;
      if (hit >= 1 && score >= 0.5 && score > bs) { best = k; bs = score; }
    });
    if (best) return { kind: 'kb', text: best.a, kbId: best.id };
    return { kind: 'none', text: '' };
  };

  /** Read-only test prompt (no state change, no credit). */
  C.testPrompt = function (d, text) {
    Orbis.require('ai.configure');
    var e = C.detectEscalation(d, text);
    if (e.escalate) return { escalate: true, reason: e.reason, text: '', note: e.why };
    var r = C.compose(d, text, { contact: '' });
    return { escalate: r.kind === 'none', reason: r.kind === 'none' ? 'NO_ANSWER' : null, kind: r.kind, text: r.text, note: r.kind === 'none' ? 'Tidak ada jawaban di KB terbit — akan dialihkan ke staf.' : '' };
  };

  function lastInbound(c) { for (var i = c.messages.length - 1; i >= 0; i--) if (c.messages[i].by === 'in') return c.messages[i]; return null; }

  /**
   * AI reply attempt inside an open tx. Never throws for business refusals; returns {sent, drafted, escalated, reason}.
   * opts.expectVersion: owner version the caller saw; opts.inboundId: message being answered.
   * Charges 1 credit atomically only when an AI message is actually sent.
   */
  C.aiReply = function (d, convId, opts) {
    opts = opts || {};
    var c = conv(d, convId), t = tenantRow(d);
    if (c.owner !== 'AI_ACTIVE') return { sent: false, reason: 'NOT_AI_ACTIVE' };            // human took over: no AI message
    if (opts.expectVersion != null && opts.expectVersion !== c.version) return { sent: false, reason: 'STALE_VERSION' };
    var inb = opts.inboundId ? c.messages.filter(function (m) { return m.id === opts.inboundId; })[0] : lastInbound(c);
    if (!inb) return { sent: false, reason: 'NO_INBOUND' };
    c.aiHandled = c.aiHandled || [];
    if (c.aiHandled.indexOf(inb.id) >= 0) return { sent: false, reason: 'DUPLICATE' };     // idempotent per (conv, inbound)
    if (t.aiMode === 'off') return { sent: false, reason: 'AI_DISABLED' };
    c.aiHandled.push(inb.id);
    var esc = C.detectEscalation(d, inb.text);
    if (esc.escalate) { setOwner(d, c, 'HUMAN_ACTIVE', esc.why, 'ESCALATION'); c.escalations = (c.escalations || 0) + 1; return { sent: false, escalated: true, reason: esc.reason }; }
    if ((t.aiUsed || 0) >= C.aiCap(d)) { setOwner(d, c, 'HUMAN_ACTIVE', 'Kredit/anggaran AI habis — percakapan dialihkan ke staf.', 'CREDITS'); return { sent: false, reason: 'CREDITS_EXHAUSTED', handoff: true }; }
    var r = C.compose(d, inb.text, c);
    if (r.kind === 'none') { setOwner(d, c, 'HUMAN_ACTIVE', 'AI tidak menemukan jawaban di KB — dialihkan ke staf.', 'ESCALATION'); c.escalations = (c.escalations || 0) + 1; return { sent: false, escalated: true, reason: 'NO_ANSWER' }; }
    if (t.aiMode === 'assist') { c.suggestion = r.text; c.suggestionFor = inb.id; return { sent: false, drafted: true, reason: 'ASSIST_DRAFT', text: r.text }; }
    t.aiUsed = (t.aiUsed || 0) + 1;                                                          // cost 1 per reply, same tx as the message
    say(d, c, 'ai', r.text, { kind: r.kind });
    return { sent: true, text: r.text, kind: r.kind };
  };

  /* ---------- conversation commands ---------- */
  C.handoff = function (convId, to, expectedVersion) {
    Orbis.require('inbox.reply');
    Orbis.need(to === 'HUMAN' || to === 'AI', 'VALIDATION', 'Tujuan handoff tidak valid');
    return Orbis.tx(function (d) {
      var c = conv(d, convId), t = tenantRow(d), target = to === 'AI' ? 'AI_ACTIVE' : 'HUMAN_ACTIVE';
      Orbis.need(Number.isInteger(expectedVersion), 'VALIDATION', 'Versi percakapan wajib');
      if (expectedVersion !== c.version) throw Orbis.Err('CONFLICT', 'Percakapan sudah berubah. Muat ulang lalu coba lagi.');
      if (c.owner === target) throw Orbis.Err('NO_CHANGE', 'Percakapan sudah dipegang pihak tersebut');
      if (to === 'AI') {
        if (t.aiMode === 'off') throw Orbis.Err('AI_DISABLED', 'AI sedang nonaktif. Aktifkan di menu AI Agent.');
        if ((t.aiUsed || 0) >= C.aiCap(d)) throw Orbis.Err('AI_CREDITS_EXHAUSTED', 'Kredit/anggaran AI habis');
      }
      setOwner(d, c, target, to === 'AI' ? d.session.actor + ' menyerahkan ke AI' : d.session.actor + ' mengambil alih', 'HANDOFF');
      return c;
    }, { audit: { action: 'inbox.handoff', entity: 'conversation', entityId: convId, detail: to } });
  };

  C.sendHuman = function (convId, text) {
    Orbis.require('inbox.reply');
    return Orbis.tx(function (d) {
      var c = conv(d, convId), s = String(text == null ? '' : text).trim();
      if (c.owner !== 'HUMAN_ACTIVE') throw Orbis.Err('NOT_HUMAN_ACTIVE', 'Ambil alih percakapan dulu sebelum membalas');
      Orbis.need(s.length > 0 && s.length <= 1000, 'VALIDATION', 'Pesan wajib diisi, maksimal 1000 karakter');
      if (!C.channelConnected(d, c.channel)) throw Orbis.Err('CHANNEL_DISCONNECTED', 'Kanal belum terhubung');
      say(d, c, 'human', s); c.unread = 0; c.draft = '';
      return c;
    }, { audit: { action: 'inbox.reply', entity: 'conversation', entityId: convId } });
  };

  /** Simulated inbound customer message. Triggers aiReply when AI owns the thread; copilot suggestion when human does. */
  C.receiveInbound = function (convId, text) {
    Orbis.require('inbox.simulate');
    return Orbis.tx(function (d) {
      var c = conv(d, convId), s = String(text == null ? '' : text).trim();
      Orbis.need(s.length > 0 && s.length <= 1000, 'VALIDATION', 'Pesan wajib diisi, maksimal 1000 karakter');
      if (!C.channelConnected(d, c.channel)) throw Orbis.Err('CHANNEL_DISCONNECTED', 'Kanal belum terhubung; pesan ditolak');
      var m = say(d, c, 'in', s); c.unread = (c.unread || 0) + 1;
      var res;
      if (c.owner === 'AI_ACTIVE') res = C.aiReply(d, convId, { inboundId: m.id, expectVersion: c.version });
      else {
        res = { sent: false, reason: 'HUMAN_ACTIVE' };
        if (tenantRow(d).aiMode !== 'off' && !C.detectEscalation(d, s).escalate) { var r = C.compose(d, s, c); if (r.kind !== 'none') { c.suggestion = r.text; c.suggestionFor = m.id; } }
      }
      return { messageId: m.id, ai: res };
    }, { audit: { action: 'inbox.inbound', entity: 'conversation', entityId: convId } });
  };

  C.useDraft = function (convId) {
    Orbis.require('inbox.reply');
    return Orbis.tx(function (d) {
      var c = conv(d, convId);
      if (!c.suggestion) throw Orbis.Err('NO_DRAFT', 'Belum ada draft AI');
      c.draft = c.suggestion; return c;
    });
  };
  C.markRead = function (convId) {
    Orbis.require('inbox.reply');
    return Orbis.tx(function (d) { var c = conv(d, convId); c.unread = 0; return c; });
  };
  C.saveDraft = function (convId, text) {
    Orbis.require('inbox.reply');
    return Orbis.tx(function (d) { var c = conv(d, convId); c.draft = String(text || '').slice(0, 1000); return c; });
  };

  C.stats = function (d) {
    var cs = Orbis.mine(d, 'conversations'), o = { ai: 0, human: 0, escalations: 0, handoffs: 0, aiConvs: 0, humanConvs: 0 };
    cs.forEach(function (c) {
      if (c.owner === 'AI_ACTIVE') o.aiConvs++; else o.humanConvs++;
      c.messages.forEach(function (m) {
        if (m.by === 'ai') o.ai++; else if (m.by === 'human') o.human++;
        if (m.sys === 'ESCALATION' || m.sys === 'CREDITS') o.escalations++;
        if (m.sys === 'HANDOFF') o.handoffs++;
      });
    });
    return o;
  };

  /* ---------- AI settings + KB ---------- */
  C.configureAi = function (s) {
    Orbis.require('ai.configure');
    return Orbis.tx(function (d) {
      var t = tenantRow(d);
      if (s.aiMode != null) { Orbis.need(['off', 'assist', 'auto'].indexOf(s.aiMode) >= 0, 'VALIDATION', 'Mode AI tidak valid'); t.aiMode = s.aiMode; }
      if (s.persona != null) { Orbis.need(String(s.persona).length <= 300, 'VALIDATION', 'Persona maksimal 300 karakter'); t.aiPersona = String(s.persona); }
      if (s.budget != null) {
        Orbis.int(s.budget, 'Anggaran'); Orbis.need(s.budget >= 0 && s.budget <= (t.aiCredits || 0), 'VALIDATION', 'Anggaran harus 0 sampai ' + (t.aiCredits || 0));
        t.aiBudget = s.budget;
      }
      if (s.keywords != null) {
        var arr = (Array.isArray(s.keywords) ? s.keywords : String(s.keywords).split(',')).map(function (k) { return String(k).trim().toLowerCase(); }).filter(Boolean);
        Orbis.need(arr.length <= 30 && arr.every(function (k) { return k.length <= 40; }), 'VALIDATION', 'Maksimal 30 kata kunci, 40 karakter');
        t.escKeywords = arr;
      }
      return t;
    }, { audit: { action: 'ai.configure', entity: 'tenant', entityId: Orbis.read(function (d) { return d.session.tenant; }) } });
  };

  C.kbSave = function (o) {
    Orbis.require('ai.configure');
    return Orbis.tx(function (d) {
      var q = String(o.q || '').trim(), a = String(o.a || '').trim();
      Orbis.need(q.length >= 3 && q.length <= 200, 'VALIDATION', 'Pertanyaan 3-200 karakter');
      Orbis.need(a.length >= 1 && a.length <= 1000, 'VALIDATION', 'Jawaban 1-1000 karakter');
      var k;
      if (o.id) { k = Orbis.mine(d, 'kb').filter(function (x) { return x.id === o.id; })[0]; if (!k) throw Orbis.Err('NOT_FOUND', 'Entri KB tidak ditemukan'); }
      else { k = { id: Orbis.nextId(d, 'KB', 3), tenant: d.session.tenant }; d.kb.push(k); }
      k.q = q; k.a = a; k.published = !!o.published;
      return k;
    }, { audit: { action: 'kb.save', entity: 'kb', entityId: o.id || null } });
  };
  C.kbToggle = function (id) {
    Orbis.require('ai.configure');
    return Orbis.tx(function (d) {
      var k = Orbis.mine(d, 'kb').filter(function (x) { return x.id === id; })[0];
      if (!k) throw Orbis.Err('NOT_FOUND', 'Entri KB tidak ditemukan');
      k.published = !k.published; return k;
    }, { audit: { action: 'kb.toggle', entity: 'kb', entityId: id } });
  };
  C.kbRemove = function (id) {
    Orbis.require('ai.configure');
    return Orbis.tx(function (d) {
      var n = d.kb.length;
      d.kb = d.kb.filter(function (x) { return !(x.id === id && x.tenant === d.session.tenant); });
      if (d.kb.length === n) throw Orbis.Err('NOT_FOUND', 'Entri KB tidak ditemukan');
    }, { audit: { action: 'kb.remove', entity: 'kb', entityId: id } });
  };

  /* ---------- CRM contacts ---------- */
  C.contactSave = function (o) {
    Orbis.require('member.write');
    return Orbis.tx(function (d) {
      var name = String(o.name || '').trim(), ph = norm(o.phone), label = String(o.label || '').trim(), stage = o.stage || 'NEW';
      Orbis.need(name.length >= 1 && name.length <= 80, 'VALIDATION', 'Nama wajib, maksimal 80 karakter');
      Orbis.need(/^\d{9,15}$/.test(ph), 'VALIDATION', 'Nomor telepon harus 9-15 digit');
      Orbis.need(label.length <= 40, 'VALIDATION', 'Label maksimal 40 karakter');
      Orbis.need(STAGES.indexOf(stage) >= 0, 'VALIDATION', 'Tahap tidak valid');
      var dup = Orbis.mine(d, 'contacts').filter(function (x) { return norm(x.phone) === ph && x.id !== o.id; })[0];
      if (dup) throw Orbis.Err('DUPLICATE_PHONE', 'Nomor telepon sudah terdaftar di kontak lain');
      var ct;
      if (o.id) { ct = Orbis.mine(d, 'contacts').filter(function (x) { return x.id === o.id; })[0]; if (!ct) throw Orbis.Err('NOT_FOUND', 'Kontak tidak ditemukan'); }
      else { ct = { id: Orbis.nextId(d, 'CT', 3), tenant: d.session.tenant }; d.contacts.push(ct); }
      ct.name = name; ct.phone = ph; ct.label = label; ct.stage = stage;
      return ct;
    }, { audit: { action: 'crm.contact.save', entity: 'contact', entityId: o.id || null } });
  };
  C.contactRemove = function (id) {
    Orbis.require('member.write');
    return Orbis.tx(function (d) {
      var n = d.contacts.length;
      d.contacts = d.contacts.filter(function (x) { return !(x.id === id && x.tenant === d.session.tenant); });
      if (d.contacts.length === n) throw Orbis.Err('NOT_FOUND', 'Kontak tidak ditemukan');
    }, { audit: { action: 'crm.contact.remove', entity: 'contact', entityId: id } });
  };

  /* ---------- integrations (alias/scope/sync only — never secrets) ---------- */
  C.WA_CHECKLIST = ['Bisnis terverifikasi di Meta (simulasi)', 'Nomor WhatsApp Business terdaftar (simulasi)', 'Template pesan disetujui (simulasi)', 'Webhook server-side aktif; token disimpan di server (simulasi)'];
  function flagOn(d, name) { return d.platform.flags.some(function (f) { return f.name === name && f.on; }); }

  C.connect = function (providerId, cfg) {
    Orbis.require('integration.write');
    cfg = cfg || {};
    return Orbis.tx(function (d) {
      var p = C.provider(providerId);
      if (!p) throw Orbis.Err('NOT_FOUND', 'Penyedia tidak dikenal');
      Object.keys(cfg).forEach(function (k) {
        if (/key|token|secret|password|kunci/i.test(k)) throw Orbis.Err('SECRET_NOT_ALLOWED', 'Kunci/token tidak boleh dimasukkan di browser; simpan di server');
      });
      if (!p.official) {
        if (d.session.role !== 'owner') throw Orbis.Err('FORBIDDEN', 'Hanya Owner yang dapat mengaktifkan jalur eksperimental');
        if (!flagOn(d, 'unofficial_wa')) throw Orbis.Err('UNOFFICIAL_BLOCKED', 'Fitur belum diaktifkan oleh platform (flag unofficial_wa)');
        if (cfg.riskAck !== true) throw Orbis.Err('UNOFFICIAL_BLOCKED', 'Anda harus menyetujui peringatan risiko terlebih dahulu');
      }
      var alias = String(cfg.alias || '').trim(), scope = cfg.scope || p.scopes[0], sync = cfg.sync || 'manual';
      Orbis.need(alias.length >= 2 && alias.length <= 40, 'VALIDATION', 'Alias 2-40 karakter');
      Orbis.need(p.scopes.indexOf(scope) >= 0, 'VALIDATION', 'Scope tidak valid');
      Orbis.need(SYNC.indexOf(sync) >= 0, 'VALIDATION', 'Mode sinkron tidak valid');
      var row = Orbis.mine(d, 'integrations').filter(function (i) { return i.id === providerId; })[0];
      if (!row) { row = { id: providerId, tenant: d.session.tenant }; d.integrations.push(row); }
      row.provider = p.name; row.kind = p.kind; row.official = p.official; row.status = 'connected';
      row.alias = alias; row.scope = scope; row.sync = sync; row.connectedAt = Orbis.clock.now();
      row.checklist = providerId === 'wa-official' ? C.WA_CHECKLIST.map(function (s) { return { step: s, done: true }; }) : null;
      row.riskAck = !p.official ? true : undefined;
      return row;
    }, { audit: { action: 'integration.connect', entity: 'integration', entityId: providerId } });
  };

  C.disconnect = function (providerId) {
    Orbis.require('integration.write');
    return Orbis.tx(function (d) {
      var row = Orbis.mine(d, 'integrations').filter(function (i) { return i.id === providerId && i.status === 'connected'; })[0];
      if (!row) throw Orbis.Err('NOT_FOUND', 'Integrasi tidak terhubung');
      row.status = 'disconnected'; row.disconnectedAt = Orbis.clock.now();
      var flipped = 0;
      if (row.kind === 'messaging' && !C.channelConnected(d, 'whatsapp')) {
        Orbis.mine(d, 'conversations').forEach(function (c) {
          if (c.owner === 'AI_ACTIVE') { conv(d, c.id); setOwner(d, c, 'HUMAN_ACTIVE', 'Kanal terputus — percakapan dialihkan ke staf.', 'HANDOFF'); flipped++; }
        });
      }
      return { row: row, flipped: flipped };
    }, { audit: { action: 'integration.disconnect', entity: 'integration', entityId: providerId } });
  };

  C.integrationRow = function (d, id) { return Orbis.mine(d, 'integrations').filter(function (i) { return i.id === id; })[0] || null; };
})(typeof window !== 'undefined' ? window : globalThis);
