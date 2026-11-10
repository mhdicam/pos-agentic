/* Orbis v2 — public landing page (view === 'landing'). Pure render; CTAs reuse the shell action `enter`.
   Copy follows PRD v1.4.5 §01 (value proposition) and FR-13 plans from seed. No invented metrics:
   PRD KPIs are pilot targets, so the page does not show them as results. */
(function (g) {
  'use strict';
  var Orbis = g.Orbis, esc = Orbis.esc;

  var FEATURES = [
    ['cart', 'POS kasir & offline', 'Shift, split tender, struk, dan antrean offline yang tersinkron tanpa transaksi ganda.'],
    ['store', 'Toko online merek sendiri', 'Storefront white-label per tenant: pickup atau kirim, satu sistem pesanan dengan kasir.'],
    ['truck', 'Pengiriman & COD', 'Dispatch, kurir mobile, bukti antar (POD), dan remitansi COD yang diverifikasi keuangan.'],
    ['box', 'Stok & pembelian', 'Pergerakan stok immutable, purchase order, dan penerimaan barang per outlet.'],
    ['tag', 'Member & promo', 'Poin loyalti, kode promo dengan kuota dan batas diskon, dihitung di sisi server.'],
    ['chat', 'AI Inbox WhatsApp', 'AI menjawab dari knowledge base terbit, serah-terima ke staf, dan batas anggaran kredit.'],
    ['chart', 'Keuangan & laporan', 'Biaya dengan approval, retur & refund, laporan penjualan dan ekspor CSV.'],
    ['building', 'Platform multi-tenant', 'Provisioning tenant, paket & tagihan, maker-checker, dan audit lintas tenant.']
  ];
  var STEPS = [
    ['Daftar & pilih paket', 'Platform menyiapkan tenant, outlet pertama, dan hak akses sesuai paket.'],
    ['Atur katalog & tim', 'Tambah produk, stok awal, kasir, kurir, dan peran lain.'],
    ['Terbitkan toko', 'Atur tampilan storefront dengan merek Anda lalu publikasikan.'],
    ['Mulai berjualan', 'Terima pesanan dari kasir dan toko online dalam satu antrean.']
  ];
  var TRUST = [
    ['shield', 'Data terisolasi per tenant', 'Setiap baris data milik satu tenant; peran dibatasi deny-by-default.'],
    ['device', 'Mobile-first', 'Alur kasir, kurir, dan inbox dirancang untuk layar 360px.'],
    ['wallet', 'Uang & stok tidak ditebak', 'Harga dihitung ulang di server; status lunas hanya setelah dikonfirmasi.'],
    ['spark', 'AI dengan pagar', 'AI tidak pernah mengubah pesanan, harga, stok, atau refund.']
  ];
  var FAQ = [
    ['Apakah bisa dipakai saat internet putus?', 'Ya untuk POS: transaksi masuk antrean offline berstatus menunggu sinkron, lalu dikirim ulang secara idempoten saat online. Statusnya ditampilkan jelas, tidak dianggap lunas sebelum dikonfirmasi server.'],
    ['Apakah toko online memakai merek saya sendiri?', 'Ya. Setiap tenant mengatur logo, judul, banner, dan bagian toko. Tema merek hanya berlaku di storefront publik.'],
    ['Bagaimana dengan WhatsApp?', 'Kanal resmi menjadi jalur utama. Opsi linked-device tidak resmi hanya eksperimen opt-in dengan penjelasan risiko.'],
    ['Bisa untuk beberapa outlet?', 'Bisa. Batas outlet, staf, dan register mengikuti paket; saat batas tercapai Anda diminta upgrade, data tidak hilang.'],
    ['Apakah ini sistem produksi?', 'Belum. Halaman ini bagian dari prototipe interaktif v2: data tersimpan lokal di browser dan otorisasi nyata wajib ditegakkan di server.']
  ];

  function logo(size) { return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="2.4"/><ellipse cx="16" cy="16" rx="14" ry="6" fill="none" stroke="currentColor" stroke-width="2"/></svg>'; }
  function head(eyebrow, title, sub) {
    return '<div class="lp-head"><span class="lp-eyebrow">' + esc(eyebrow) + '</span><h2>' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>';
  }
  function tiles(list, cls) {
    return '<div class="' + cls + '">' + list.map(function (f) {
      return '<article class="lp-tile"><span class="lp-ico">' + Orbis.icon(f[0], 20) + '</span><h3>' + esc(f[1]) + '</h3><p>' + esc(f[2]) + '</p></article>';
    }).join('') + '</div>';
  }

  /** Static illustration of one order flowing POS -> delivery. Labelled as illustration, not live data. */
  function preview() {
    var flow = [['PLACED', 'Masuk'], ['PREPARING', 'Disiapkan'], ['READY', 'Siap'], ['DELIVERED', 'Diantar']];
    return '<figure class="lp-preview" aria-label="Ilustrasi alur pesanan">' +
      '<div class="lp-pv-bar"><span></span><span></span><span></span><small>Ilustrasi</small></div>' +
      '<div class="lp-pv-body">' +
      '<div class="lp-pv-stats"><div><small>Pendapatan hari ini</small><b>Rp 2.480.000</b></div><div><small>Pesanan</small><b>64</b></div><div><small>Dalam pengiriman</small><b>7</b></div></div>' +
      '<div class="lp-pv-order"><div class="row sp"><b>ORD-0142 · Toko online</b>' + Orbis.chip('PAID', 'Lunas') + '</div>' +
      '<div class="lp-pv-items"><span>2 × Kopi Susu Awan</span><span>Rp 56.000</span></div><div class="lp-pv-items"><span>1 × Croissant Butter</span><span>Rp 26.000</span></div>' +
      '<ol class="lp-flow">' + flow.map(function (s, i) { return '<li class="' + (i < 3 ? 'done' : '') + '">' + esc(s[1]) + '</li>'; }).join('') + '</ol></div>' +
      '<div class="lp-pv-ai">' + Orbis.icon('chat', 16) + '<span><b>AI Inbox:</b> “Jam buka outlet Senopati?” — draft balasan siap, menunggu staf.</span></div>' +
      '</div></figure>';
  }

  function pricing(d) {
    return '<div class="lp-plans">' + (d.plans || []).map(function (p) {
      var hot = p.id === 'growth';
      var rows = [
        p.outlets + ' outlet', p.staff + ' staf', p.registers + ' register POS',
        p.ai ? p.ai.toLocaleString('id-ID') + ' kredit AI / bulan' : 'Tanpa AI Inbox'
      ];
      return '<article class="lp-plan' + (hot ? ' hot' : '') + '">' + (hot ? '<span class="lp-badge">Paling populer</span>' : '') +
        '<h3>' + esc(p.name) + '</h3><div class="lp-price"><b>' + esc(Orbis.idr(p.price)) + '</b><span>/ bulan</span></div>' +
        '<ul>' + rows.map(function (r) { return '<li>' + Orbis.icon('check', 16) + esc(r) + '</li>'; }).join('') + '</ul>' +
        Orbis.btn('Coba demo ' + p.name, 'enter', ['owner'], { kind: hot ? 'primary' : '' }) + '</article>';
    }).join('') + '</div><p class="lp-note">Harga ilustrasi prototipe, belum termasuk pajak. Paket dinyatakan sebagai entitlement dan perubahan berlaku pada tanggal efektif.</p>';
  }

  Orbis.landing = function (d) {
    var roles = [['cashier', 'Kasir', 'cart'], ['dispatcher', 'Dispatcher', 'route'], ['courier', 'Kurir', 'truck'], ['finance', 'Keuangan', 'wallet'], ['platform', 'Platform Admin', 'building'], ['customer', 'Pelanggan', 'store']];
    return '<div class="lp">' +
      '<header class="lp-nav"><div class="lp-wrap"><a class="brand" href="#top">' + logo(26) + '<b>Orbis Commerce</b></a>' +
      '<nav aria-label="Bagian halaman"><a href="#fitur">Fitur</a><a href="#cara-kerja">Cara kerja</a><a href="#harga">Harga</a><a href="#faq">FAQ</a></nav>' +
      Orbis.btn('Coba demo', 'enter', ['owner'], { kind: 'primary' }) + '</div></header>' +

      '<main id="main" tabindex="-1">' +
      '<section class="lp-hero" id="top"><div class="lp-wrap lp-hero-in"><div>' +
      '<span class="lp-pill">' + Orbis.icon('spark', 14) + 'Prototipe interaktif v2</span>' +
      '<h1>POS, toko online, dan pengiriman dalam satu sistem.</h1>' +
      '<p class="lp-lead">Satu platform untuk transaksi kasir, toko online dengan merek sendiri, pengantaran yang terlacak, dan layanan pelanggan berbasis AI di WhatsApp — aman, mobile-first, dan terisolasi per tenant.</p>' +
      '<div class="lp-cta">' + Orbis.btn('Masuk sebagai Owner', 'enter', ['owner'], { kind: 'primary' }) + Orbis.btn('Lihat toko pelanggan', 'enter', ['customer'], { icon: 'store' }) + '</div>' +
      '<div class="lp-roles"><span>Atau coba sebagai</span>' + roles.map(function (r) { return Orbis.btn(r[1], 'enter', [r[0]], { kind: 'ghost', icon: r[2] }); }).join('') + '</div>' +
      '</div>' + preview() + '</div></section>' +

      '<section class="lp-sec" id="fitur"><div class="lp-wrap">' + head('Fitur', 'Semua operasional toko, satu tempat', 'Dari kasir di outlet sampai paket tiba di pintu pelanggan, setiap modul berbagi data pesanan, stok, dan pembayaran yang sama.') + tiles(FEATURES, 'lp-grid4') + '</div></section>' +

      '<section class="lp-sec lp-alt" id="cara-kerja"><div class="lp-wrap">' + head('Cara kerja', 'Mulai jualan dalam empat langkah') +
      '<ol class="lp-steps">' + STEPS.map(function (s, i) { return '<li><span class="lp-num">' + (i + 1) + '</span><h3>' + esc(s[0]) + '</h3><p>' + esc(s[1]) + '</p></li>'; }).join('') + '</ol></div></section>' +

      '<section class="lp-sec" id="harga"><div class="lp-wrap">' + head('Harga', 'Paket yang tumbuh bersama bisnis Anda', 'Mulai dari satu outlet, naik paket saat butuh lebih banyak outlet, staf, atau kredit AI.') + pricing(d) + '</div></section>' +

      '<section class="lp-sec lp-alt"><div class="lp-wrap">' + head('Keamanan & keandalan', 'Dirancang agar uang dan data tidak tertukar') + tiles(TRUST, 'lp-grid4') + '</div></section>' +

      '<section class="lp-sec" id="faq"><div class="lp-wrap lp-narrow">' + head('FAQ', 'Pertanyaan umum') +
      '<div class="lp-faq">' + FAQ.map(function (q) { return '<details><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('') + '</div></div></section>' +

      '<section class="lp-sec"><div class="lp-wrap"><div class="lp-final"><h2>Siap mencoba?</h2><p>Jelajahi prototipe sebagai Owner — data demo sudah terisi dan bisa direset kapan saja.</p>' +
      '<div class="lp-cta">' + Orbis.btn('Masuk sebagai Owner', 'enter', ['owner'], { kind: 'primary' }) + Orbis.btn('Masuk sebagai Kasir', 'enter', ['cashier']) + '</div></div></div></section>' +
      '</main>' +

      '<footer class="lp-foot"><div class="lp-wrap"><div class="brand">' + logo(20) + '<b>Orbis Commerce</b></div>' +
      '<p class="fine">Simulasi sisi klien. Otorisasi, RLS tenant, sinkronisasi offline, dan pembayaran nyata wajib ditegakkan di server (lihat internal/docs).</p></div></footer>' +
      '</div>';
  };
})(typeof window !== 'undefined' ? window : globalThis);
