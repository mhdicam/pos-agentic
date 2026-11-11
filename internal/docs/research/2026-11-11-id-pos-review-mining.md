# Indonesian POS Review Mining
Status: draft (for review, not signed off)
Date: 2026-11-11
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff

Purpose: rank Indonesian POS/merchant apps by public review signal, mine praise and complaints, and list gaps the tenant (merchant owner) back-office prototype should check. Desk research only; no claims about Orbis behavior.

Method notes:
- Play numbers read 2026-11-11 from the listing page (`hl=en` and `hl=id`). The header count ("12.6K reviews") is the total rating count. The lower "Ratings and reviews" block can show a smaller, phone-only count; the header figure is used.
- "unverified" means the listing did not show the number on the read date. A third-party figure, when one exists, is in Notes with its source and date. No figure was estimated.
- Quotes are short excerpts (max 15 words), in the original language and lightly trimmed with "…".

## 1. Ranking table

| App | Play rating | #ratings | Installs | Source URL | Read date | Notes |
|---|---|---|---|---|---|---|
| BukuWarung | 4.4 | 94.7K | 5M+ | https://play.google.com/store/apps/details?id=com.bukuwarung | 2026-11-11 | Bookkeeping/PPOB/EDC agent app, not a full POS. Kasirnesia read 3.19 / 94,651 on 2026-08-13 (https://kasirnesia.com/riset/google-play-kasir-umkm-2026); the rating differs, so it is excluded from the top 5. |
| Kasir Pintar (Free) | 4.8 | 53.6K | 1M+ | https://play.google.com/store/apps/details?id=org.owline.kasirpintar | 2026-11-11 | chrome-stats: 4.79 / 53,618 |
| Qasir | 4.3 | 31.9K | 1M+ | https://play.google.com/store/apps/details?id=com.innovecto.etalastic | 2026-11-11 | chrome-stats 4.28. Kasirnesia read 3.62 on 2026-08-13; the two sources disagree. 32% of recent reviews are 1-star (chrome-stats). |
| Loyverse | 4.8 | 18.1K | 1M+ | https://play.google.com/store/apps/details?id=com.loyverse.sale | 2026-11-11 | Global count, not Indonesia-only. |
| Moka POS (GoTo) | 4.5 | 12.6K | 1M+ | https://play.google.com/store/apps/details?id=com.mokapos.android | 2026-11-11 | chrome-stats recent average 3.00 (61% of recent reviews are 1-star) |
| Kasir Pintar Pro | 4.3 | 12.3K | 1M+ | https://play.google.com/store/apps/details?id=org.owline.kasirpintarpro | 2026-11-11 | Same vendor as Kasir Pintar |
| iReap POS Pro | 5.0 | 1.26K | unverified | https://play.google.com/store/apps/details?id=com.sterling.ireappro | 2026-11-11 | Kasirnesia: 4.63 / 1,250 / 100K+ |
| iReap POS Lite | unverified | unverified | 100K+ | https://play.google.com/store/apps/details?id=com.sterling.ireap | 2026-11-11 | Kasirnesia: 4.76 / 4,881 |
| majoo | unverified | unverified | 100K+ | https://play.google.com/store/apps/details?id=com.klopos | 2026-11-11 | App Store ID: 4.2 / 691 ratings (https://apps.apple.com/id/app/aplikasi-kasir-wirausaha-majoo/id1642259472). An SVM study gives Play 3.7 with >5,000 reviews as of 2025-04-01 (https://doi.org/10.36040/jati.v9i5.14951). chrome-stats: ~476K downloads. |
| Pawoon | 4.2 (search snippet) | 650 (search snippet) | unverified | https://play.google.com/store/apps/details?id=com.pawoon.pos | 2026-11-11 | Last update Aug 2025. The direct fetch showed no rating. |
| Olsera POS | 4.5 | 218 | unverified | https://play.google.com/store/apps/details?id=com.olserapratama.pos | 2026-11-11 | |
| Youtap POS | unverified | unverified | 50K+ | https://play.google.com/store/apps/details?id=id.youtap.merchant.tablet | 2026-11-11 | Kasirnesia: 3.64 / 1,299 |
| ESB POSLite | unverified | unverified | 50K+ | https://play.google.com/store/apps/details?id=id.co.esb.esb_pos | 2026-11-11 | ESB targets enterprise F&B; its main POS is web-based |

App Store figures were not collected, except majoo above.

**Top 5 by rating × volume (full-POS apps only):** 1) Kasir Pintar (Free + Pro, ~65.9K ratings, 4.3–4.8), 2) Qasir, 3) Loyverse, 4) Moka. 5) majoo is added as the all-in-one benchmark: its volume is significant but its Play rating was not shown on the read date. BukuWarung would rank 1st on volume but is a bookkeeping/PPOB app.

## 2. Per-app praise and complaints

### 2.1 Kasir Pintar / Kasir Pintar Pro
Praise:
1. Easy and fast for non-technical sellers: "Kasir Pintar cukup enak dan nggak ribet" ([Play Free](https://play.google.com/store/apps/details?id=org.owline.kasirpintar&hl=id)).
2. Monitoring each branch in real time: "langsung keliatan penjualan tiap cabang real-time" ([Play Pro](https://play.google.com/store/apps/details?id=org.owline.kasirpintarpro&hl=id)).
3. Complete payment methods: "bisa tunai, QRIS, transfer, sampai e-wallet" (Play Pro, same URL).
4. Low-stock notification and daily profit view: "Stok barang otomatis kepantau… kalau mau restock udah ada notifnya" (Play Pro).
5. Barcode scanning and fast product entry from the phone camera ([chrome-stats](https://chrome-stats.com/d/org.owline.kasirpintar/reviews)).

Complaints / missing capability:
1. Many features are paid plugins, even on Pro: "now you want to charge for it extra money even if you have the pro" ([Play EN](https://play.google.com/store/apps/details?id=org.owline.kasirpintar&hl=en)). Offline mode, multi-device real-time sync, loyalty, variants, bundles and split bill all sit in paid plugins ([help](https://help.kasirpintar.co.id/knowledge-base/apa-itu-plugin-pada-kasir-pintar/)).
2. The free plan caps data: "I need more than 1000 items data" (Play EN).
3. A server outage locked owners out mid-shift: "my shop was a caos since i cant login" (Play EN). Vendor advice was not to log out while offline to avoid data loss.
4. A plugin cannot be cancelled before it is paid: "u cannot cancel it unless wait till got paid" ([Play Pro EN](https://play.google.com/store/apps/details?id=org.owline.kasirpintarpro&hl=en)).
5. Catalog data bug: uploading one photo "produk yang lain ikut terganti foto nya" (Play Free ID).

### 2.2 Qasir
Praise:
1. Cheap and simple for new SMEs: "Biaya langganan yg sangat terjangkau dibandingkan dengan kompetitor" ([Play ID](https://play.google.com/store/apps/details?id=com.innovecto.etalastic&hl=id)).
2. Fast checkout: "Tampilan yang simpel dan juga proses transaksi yang cepat" (Play ID).
3. Goods-in records cost at the actual purchase price: "harga modalnya bisa disesuaikan dengan harga beli" (Play ID).
4. Named, responsive CS staff over WhatsApp ([chrome-stats](https://chrome-stats.com/d/com.innovecto.etalastic/reviews)).
5. Reliable QRIS and steady improvement ([rizalfikry.com](https://rizalfikry.com/ulasan-aplikasi-qasir/)).

Complaints / missing capability:
1. Multi-outlet stock gets mixed up: "When u have 2 outlets, stocks if often mixed" ([Play EN](https://play.google.com/store/apps/details?id=com.innovecto.etalastic&hl=en)).
2. The web back office lacks config parity with mobile. The reviewer asked to make "the web apps… a back office apps with better configuration" (Play EN).
3. Stock does not match sales: "jual barang stok ga berkurang, di riwayat transaksi ada penjualan" (Play ID). Devices drift apart: "selisih stok produk antara dua akun" (rizalfikry).
4. Missing promo types and loyalty: "consider discount with buy 2 get 3"; "add a royalty system for customers" (Play EN).
5. GrabFood integration is incomplete: "the grab option group feature was not available" (Play EN). The free tier was cut to 30 active products, which pushed users to churn (rizalfikry).

### 2.3 Loyverse
Praise:
1. Quick setup and CSV inventory import: "super easy to set up the receipt printer and import our inventory" ([Play EN](https://play.google.com/store/apps/details?id=com.loyverse.sale&hl=en)).
2. Free with no ads, and fast support ([chrome-stats](https://chrome-stats.com/d/com.loyverse.sale/reviews)).
3. Easy for first-time digital sellers: "I can understand most of the concept in few hours" (Play EN).
4. Customer display and kitchen display work well (chrome-stats summary).
5. Easy to edit item data: "mudah untuk mengatur merubah dan menambah data barang" ([Play ID](https://play.google.com/store/apps/details?id=com.loyverse.sale&hl=id)).

Complaints / missing capability:
1. No Windows, PC or web POS. This is the most frequent ask (chrome-stats summary).
2. Label printer support: "loyverse tidak mendukung mode tspl" (Play ID).
3. Negotiated prices need a floor price: "I need at least 2 price label… as limiter" (Play EN).
4. Unknown barcode at checkout: "ask if you want to add a new item with this barcode" (Play EN).
5. The free plan has no cashier account besides the owner: "1 additional free employee (cashier role) for free subscribers" (chrome-stats). Receipt notes cannot be edited after the sale (Play ID).

### 2.4 Moka POS
Praise:
1. Easy to use, with strong onboarding trainers: "trainernya juga sangat membantu mengajari sistemnya" ([chrome-stats](https://chrome-stats.com/d/com.mokapos.android/reviews)).
2. Accurate stock data: "Easy to operate,acurate DataStock" (chrome-stats).
3. Real-time multi-outlet dashboard, per a vendor-site testimonial: "membantu kami mengembangkan 27 outlets dalam waktu 5 bulan" ([mokapos.com](https://www.mokapos.com)).
4. Central, automatic stock and sales records replace manual Telegram tracking ([journal](https://doi.org/10.31004/riggs.v4i2.809)).
5. Peak-hour analysis: "kami juga tahu kapan waktunya toko paling ramai" (mokapos.com).

Complaints / missing capability:
1. Multi-outlet stock is not consolidated. The vendor FAQ says the stock report shows "per masing-masing outlet dan belum bisa secara keseluruhan" ([help](https://help.mokapos.com/pertanyaan-yang-sering-ditanyakan-faq-terkait-inventory)). Inter-store transfers fail: "sistem transfer inventory antar toko (gudang) mereka mulai error" ([Reddit](https://www.reddit.com/r/finansial/comments/1g73ttf/moka_pos_is_a_pos/)).
2. Promotions are rigid: "theres no way you can make unique promo or package" ([Play EN](https://play.google.com/store/apps/details?id=com.mokapos.android&hl=en)).
3. Phone validation is Indonesia-only (+62), which blocks foreign customers in CRM (Play EN).
4. Online orders arrive late and the back office does not match the POS. HashMicro reports GoFood orders arriving hours late and POS/web data out of sync ([HashMicro](https://www.hashmicro.com/id/blog/review-aplikasi-moka-pos/)). Daily report emails arrive late; one 3-outlet owner wrote "data/ transaksi sering hilang" ([mediakonsumen](https://mediakonsumen.com/2023/03/30/surat-pembaca/aplikasi-moka-sering-bermasalah-tapi-tidak-ditanggapi-tim-support)).
5. Onboarding and finance gaps. KYC is heavy: "udah kayak mau buka rekening aja" ([Play ID](https://play.google.com/store/apps/details?id=com.mokapos.android&hl=id)). There is no P&L or balance sheet, and no payroll (HashMicro). Cash in/out broke after an update (Play ID).

### 2.5 majoo (all-in-one benchmark)
Praise:
1. Easy and suited to SMEs: "aplikasi yg cocok untuk umkm"; "mudah di gunakan" ([chrome-stats](https://chrome-stats.com/d/com.klopos)).
2. Complete reports that help run an outlet: "Membantu operational outlet, laporan lengkap" ([chrome-stats reviews](https://chrome-stats.com/d/com.klopos/reviews)).
3. Good CS and field agents: "pelayanan sangat baik dari CS dan agen majoo" (chrome-stats reviews).
4. Trainer-led onboarding: "trainer", "paham" and "ramah" are among the top positive words ([SVM study](https://doi.org/10.36040/jati.v9i5.14951)).
5. Breadth: accounting, attendance, CRM and marketplace in one app, with sales reports via WhatsApp ([Play](https://play.google.com/store/apps/details?id=com.klopos&hl=en)).

Complaints / missing capability:
1. Master data lost after an update: "update aplikasi versi terbaru malah data master saya pada hilang" ([App Store](https://apps.apple.com/id/app/aplikasi-kasir-wirausaha-majoo/id1642259472?see-all=reviews)).
2. Hard catalog maintenance: "Hapus produk susah… update produk dan ganti harga gak bisa" (App Store).
3. Template-only support: "Mengulang terus pertanyaan dengan template yang sama" (App Store).
4. Unrecorded sales: "penjualan tiba tiba gak tertulis" (App Store). "stok" is a top negative word (SVM study).
5. Too complex, with a crowded UI: "ribet" is a top negative word (SVM study); "Sering banget error aplikasinya, UI/UX jelek" (App Store).

### 2.6 Other notable signals
- Pawoon: members are not shared across branches, so the owner must open a browser to check another branch: "harusnya mamber itu sinkron dari semu cabang" ([Play](https://play.google.com/store/apps/details?hl=id&id=com.pawoon.pos)). Cash recap loses connection: "setiap mau rekap kas, selalu koneksi hilang" (same URL).
- iReap Pro: users ask for invoicing from any store on the web, editable roles on the web, loyalty points and multi-currency ([Play](https://play.google.com/store/apps/details?id=com.sterling.ireappro&hl=en)).
- BukuWarung: one user lost bookkeeping data after reinstalling: "stelah di instal ulang catatan pmbukuannya hilang" ([Play ID](https://play.google.com/store/apps/details?id=com.bukuwarung&hl=id)). Another reports AI-only CS with slow human handoff.

## 3. Advertised differentiators (official listing or site)

| App | Differentiators | URL |
|---|---|---|
| Moka | GoFood and GrabFood orders in one dashboard, with menus synced across platforms. E-wallet acceptance (GoPay, OVO, ShopeePay, DANA, LinkAja, Kredivo, Akulaku). T+1 consolidated settlement. ECR link to GoBiz EDC. Kitchen ticket printer. Recipes and semi-finished goods. Loyalty CRM. GoStore online shop. Capital loans. GoPay Bio link page. | https://play.google.com/store/apps/details?id=com.mokapos.android ; https://www.mokapos.com |
| majoo | Reservation, QR ordering, kitchen display and online payment. GrabFood, GoFood and ShopeeFood integration. Automatic accounting. Photo attendance and commissions. CRM with WhatsApp, SMS and email blasts. Owner app. AI sales reports over WhatsApp. Table-plan editor. Medical records for clinics. | https://play.google.com/store/apps/details?id=com.klopos ; https://majoo.id |
| Kasir Pintar | Free forever tier. Receipts via WhatsApp. Kasbon (credit) tracking. Free online catalog (Olshopin). PPOB. Transfers between branches. FIFO, LIFO or average costing. Desktop, Food Menu, Ingredient, Offline and StaffPlus plugins. MDR auto-calculation per payment method. | https://play.google.com/store/apps/details?id=org.owline.kasirpintarpro ; help URL in §2.1 |
| Qasir | Free QRIS. Kasbon. Stock opname on the free tier. GrabFood integration on Pro. Self-order menu. Wholesale (grosir) price. Online-shop website with automatic shipping cost and VA/e-wallet payment. Employee attendance. Required-customer toggle (5.6.0). | https://play.google.com/store/apps/details?id=com.innovecto.etalastic&hl=id |
| Loyverse | Free core. Offline selling. Kitchen display app and customer display app. Dine-in/takeout/delivery options. Open tickets for tables. CSV import and export. Loyalty card scanning. | https://play.google.com/store/apps/details?id=com.loyverse.sale |
| Pawoon | Promo engine (buy A get B free, happy hour, vouchers, points). Split payment. Table management. Samsung Knox kiosk mode. PPOB. | https://play.google.com/store/apps/details?id=com.pawoon.pos |
| Olsera | Unlimited users and devices. Central CRM shared by all outlets. Installments, deposits and debt payments. Shipping-cost calculation at the POS. Seating and reservations. Kitchen display. Runs on Android, iOS and Windows. QRIS BCA. Notes shared via WhatsApp. | https://play.google.com/store/apps/details?id=com.olserapratama.pos&hl=en |
| ESB | Table management (link, move, split). AI fraud detection. ERP auto-journal and reconciliation. GoFood, GrabFood and ShopeeFood plus ESB Order. Couriers (GrabExpress, GoSend, Paxel, Lalamove). PB1 + service-charge handling. Careline 24/7. | https://www.esb.id/id/solusi/produk/pos |
| iReap Pro | Full offline mode with a local DB. Salesman sales orders with GPS tracking. Store transfers. Purchase orders. Attendance. Web dashboard. | https://play.google.com/store/apps/details?id=com.sterling.ireappro&hl=en |
| Youtap | QRIS with H+1 settlement. QR sent over WhatsApp for remote payment. e-Menu and "Pesan dari HP" ordering. Sales reports delivered via WhatsApp. Stamp loyalty. | https://play.google.com/store/apps/details?id=id.youtap.merchant.tablet |

## 4. Cross-app themes (what merchants value most, ranked)

The ranking weighs how often a theme appears across sources and how strongly reviewers react to it. Each theme lists a check for the tenant back office.

1. **Simple, fast and learnable without training.** This is the top praise for Kasir Pintar, Qasir, Loyverse and majoo, and "ribet" is the top complaint. Check: owner setup flows have few steps, defaults are sane, and there is no KYC wall before first use.
2. **Trustworthy data with no lost or unrecorded sales.** Data loss after updates, reinstalls, outages or logout is the most damaging complaint (majoo, Moka, BukuWarung, Kasir Pintar). Check: the owner can see sync and offline queue status, there is an audit trail, and data can be exported and backed up.
3. **Stock that matches reality across devices and outlets.** Qasir, Moka and majoo all show stock drift and broken transfers. Moka cannot show stock consolidated across outlets. Check: a consolidated all-outlet stock view, a transfer lifecycle with status, and a stock movement ledger.
4. **Multi-outlet control from one place.** Merchants praise a per-branch real-time view (Kasir Pintar Pro, Moka) and complain when members are not shared across branches (Pawoon). Check: a branch comparison dashboard, CRM and members shared across outlets, and cloning outlet config.
5. **Responsive human support.** Template replies, AI-only CS and no phone line appear for majoo, Moka, Qasir and BukuWarung, while named CS staff and trainers are praised. Check: an in-app help or WhatsApp link from the back office, and visible system status.
6. **Payment breadth with QRIS/e-wallet and fast settlement.** QRIS, split payment and MDR per method are table stakes. Check: payment-method config per outlet, an MDR/fee field, and a settlement report.
7. **Flexible promotions and loyalty.** Moka, Qasir and iReap reviewers ask for buy X get Y, packages, points and happy hour. Check: a promo builder (BxGy, bundle, time window, category) and loyalty points.
8. **Food-delivery aggregator integration (GoFood, GrabFood, ShopeeFood).** This is advertised by Moka, majoo and ESB, and incomplete or late integration is a complaint. Check: menu sync and price-per-channel, and order-arrival latency visibility.
9. **Transparent pricing with no surprise paid add-ons.** Plugin paywalls (Kasir Pintar), free-tier cuts (Qasir) and per-outlet pricing (Moka) drive churn. Check: billing and plan pages show what is included, and owners can cancel cleanly.
10. **Owner reporting beyond sales: P&L, cash recap, WhatsApp reports, peak hours.** majoo and Youtap send reports over WhatsApp. Moka is criticised for having no P&L. Check: a daily owner digest, a P&L/cash summary, and a cash-in/out (kas) log.
11. **Restaurant operations: kitchen printer/KDS, tables, open bills.** These are advertised as standard by Moka, Pawoon, Loyverse, ESB and Olsera.
12. **Hardware breadth: Bluetooth/LAN thermal, TSPL label printers, desktop/PC POS.** Loyverse's top ask is a PC/web POS, and TSPL label printing is missing.
13. **Staff controls: roles, shifts, attendance, commission, activity log.** majoo, Kasir Pintar and iReap advertise these. iReap users ask for editable roles on the web.
14. **Local fit: kasbon (credit), wholesale price tiers, negotiated-price floor, PB1 + service charge, foreign phone numbers.**

Not verified in this pass: App Store ratings except majoo, current Play ratings for majoo, iReap Lite, ESB and Youtap, and installs for Pawoon and Olsera.
