# Tenant Back-office Benchmark
Status: draft (for review, not signed off)
Date: 2026-11-10
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff

Scope: what a production merchant (tenant owner) back-office contains, from official help centres. Research only; not authorization to implement. Pricing and statistics deliberately omitted. "unverified" = could not confirm in a primary source during this pass. Not covered this pass: Lightspeed Restaurant (K-Series), Toast staff permissions, Pawoon/ESB/iSeller staff modules.

Priority key: P0 = prototype must show for a credible SME MVP; P1 = show as secondary screen/state; P2 = mention or defer.

## Source shortlist (primary)
| Ref | Product | URL |
|---|---|---|
| M1 | Moka library (items, variants, modifiers, COGS) | https://help.mokapos.com/materi-3-mengisi-library-di-backoffice |
| M2 | Moka inventory (PO, transfer, adjustment) | https://help.mokapos.com/materi-4-mengatur-inventory-di-backoffice |
| M3 | Moka ingredients/recipes | https://help.mokapos.com/materi-11-pelajari-fitur-modular |
| M4 | Moka transfer/adjustment/PO + Excel import | https://help.mokapos.com/mengenal-transfer-adjustment-purchase-order-bahan-baku-dan-contoh-penerapannya |
| M5 | Moka inventory summary columns | https://help.mokapos.com/mengenal-summary-dan-cara-melihat-ringkasan-bahan-baku |
| M6 | Moka modifier stock | https://help.mokapos.com/modifier-stock-monitor-bahan-baku-jadi-lebih-mudah |
| M7 | Moka dashboard + reports list | https://help.mokapos.com/materi-10-melihat-analisis-dashboard-dan-reports-di-backoffice |
| M8 | Moka shift report | https://help.mokapos.com/cara-melihat-laporan-shift |
| M9 | Moka promo | https://help.mokapos.com/cara-membuat-promo |
| M10 | Moka billing page | https://help.mokapos.com/bagaimana-cara-melakukan-perpanjangan-langganan-akun-moka |
| M11 | Moka report retention change | https://help.mokapos.com/reporting-transaction-update |
| J1 | majoo hak akses / kustom akses | https://majoo.id/panduan-pengguna/detail/39 |
| J2 | majoo tambah karyawan (PIN, outlet) | https://majoo.id/panduan-pengguna/detail/359 |
| J3 | majoo absensi POS (PIN + foto) | https://majoo.id/panduan-pengguna/detail/316 |
| J4 | majoo produk (varian, ekstra, resep, toko online) | https://majoo.id/panduan-pengguna/detail/276 |
| J5 | majoo stok opname | https://majoo.id/panduan-pengguna/detail/80 |
| J6 | majoo inventori (stok produksi, terbuang, multisatuan) | https://majoo.id/aplikasi-inventori |
| J7 | majoo report grouping | https://majoo.id/informasi-update/penambahan-menu-grouping-laporan-pada-dashboard-majoo |
| J8 | majoo laporan void | https://majoo.id/panduan-pengguna/detail/189 |
| J9 | majoo loyalty program | https://majoo.id/panduan-pengguna/detail/665 |
| J10 | majoo FAQ (komisi, absensi, Akses Support) | https://majoo.id/panduan-pengguna/detail/381 , https://majoo.id/faq |
| J11 | majoo laporan produk / jenis bayar | https://majoo.id/panduan-pengguna/detail/191 , https://majoo.id/panduan-pengguna/detail/187 |
| P1 | Pawoon pajak & service (bertingkat) | https://www.pawoon-helpcenter.com/id/pajak-service-charge |
| P2 | Pawoon pembulatan + metode bayar | https://www.pawoon-helpcenter.com/pembulatan-dan-metode-pembayaran-di-pawoon |
| P3 | Pawoon desain struk | https://www.pawoon-helpcenter.com/id/desain-struk-di-pawoon-pos |
| Q1 | Qasir struk digital (WhatsApp) | https://bantuan.qasir.id/id/articles/2624511-kirim-struk-digital |
| Q2 | Qasir printer settings | https://bantuan.qasir.id/id/articles/1565922-pengaturan-menghubungkan-printer-dengan-aplikasi |
| Q3 | Qasir QRIS (saldo, pencairan) | https://bantuan.qasir.id/id/articles/5161480-qris-satu-qr-code-untuk-semua |
| Q4 | Qasir aktivasi pembayaran digital (KTP/NPWP) | https://bantuan.qasir.id/id/articles/3531981-aktivasi-pembayaran-digital-di-aplikasi-qasir |
| Q5 | Qasir pengaturan struk | https://bantuan.qasir.id/id/articles/2166668-pengaturan-struk-dasar |
| E1 | ESB Core module index | https://help.esb.id/content/esb-core |
| E2 | ESB POS module index | https://help.esb.id/content/esb-pos |
| E3 | ESB menu (BOM, menu template pricing) | https://help.esb.id/content/article/143620206555208 |
| I1 | iSeller product setup + CSV import | https://help.iseller.id/id/articles/2361009-getting-started-pengaturan-produk |
| I2 | iSeller Price Book | https://help.iseller.id/en/articles/3410867-introduction-to-price-book |
| O1 | Olsera pembulatan | https://crm.olsera.co.id/knowledge-base/article/cara-setting-pembulatan |
| O2 | Olsera POS settings index | https://crm.olsera.co.id/knowledge-base/category/pengaturan-pos |
| O3 | Olsera laporan shift | https://crm.olsera.co.id/knowledge-base/article/cara-melihat-laporan-shift |
| S1 | Square permission sets | https://squareup.com/help/us/en/article/5822-employee-permissions |
| S2 | Square passcodes | https://squareup.com/help/us/en/article/8357-require-passcodes-at-point-of-sale |
| S3 | Square reports list | https://squareup.com/help/us/en/article/5072-summaries-and-reports-from-the-online-dashboard |
| S4 | Square sales summary metrics | https://squareup.com/help/us/en/article/5381-in-app-summaries-and-reports |
| S5 | Square adjustment reasons | https://squareup.com/help/us/en/article/8670-create-and-manage-custom-inventory-adjustment-reasons |
| S6 | Square inventory counts | https://squareup.com/help/us/en/article/8249-conduct-full-inventory-counts-with-square-for-retail |
| S7 | Square bulk import | https://squareup.com/help/us/en/article/5153-import-items-online |
| S8 | Square stock history | https://squareup.com/help/us/en/article/6061-view-stock-adjustment-history-with-square-for-retail |
| S9 | Square scheduling | https://squareup.com/help/us/en/article/7155-scheduling-with-team-management |
| S10 | Square setup guide | https://squareup.com/help/ie/en/article/5123-square-get-started-guide |
| H1 | Shopify POS permissions (Allowed/Denied/Approval) | https://help.shopify.com/en/manual/your-account/users/roles/permissions/pos-permissions |
| H2 | Shopify POS PIN | https://help.shopify.com/en/manual/sell-in-person/shopify-pos/manage-your-shopify-pos-pin |
| H3 | Shopify Home (setup tasks, order tasks) | https://help.shopify.com/en/manual/shopify-admin/shopify-home |
| H4 | Shopify POS launch checklist | https://help.shopify.com/en/manual/intro-to-shopify/shopify-pos-launch-checklist |
| T1 | Toast pricing strategies (modifiers) | https://doc.toasttab.com/doc/platformguide/adminToastPosPricingFeatures.html |
| T2 | Toast cash drawers | https://support.toasttab.com/en/article/Use-Cash-Drawers-New-Experience |
| T3 | Toast coffee modifier groups | https://support.toasttab.com/en/article/Menu-Best-Practices-for-Bakeries-Coffee-Shops |
| L1 | Lightspeed X roles | https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534171377819-Setting-user-roles-and-permissions |
| L2 | Lightspeed X receive without PO | https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534174384539-Receiving-stock-without-a-purchase-order |
| L3 | Lightspeed X suppliers | https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534088679835-Managing-suppliers |
| V1 | Loyverse access rights | https://help.loyverse.com/help/how-manage-access-rights-employees |
| V2 | Loyverse shifts | https://help.loyverse.com/help/shift-management-loyverse-pos |
| V3 | Loyverse multi-store | https://help.loyverse.com/help/how-create-and-manage-multiple |
| V4 | Loyverse billing | https://help.loyverse.com/idn/help/how-use-paid-services-loyverse-pos |
| X1 | DJP: PMK 131/2024 (PPN 12%, DPP 11/12) | https://www.pajak.go.id/id/artikel/pmk-1312024-tarif-ppn-sebelas-dua-belas |
| X2 | DJP: restaurant food not PPN, PBJT max 10% | https://pajak.go.id/id/artikel/makan-di-restoran-tidak-kena-ppn |
| X3 | Bapenda DKI: PBJT makan/minum 10%, threshold | https://bapenda.jakarta.go.id/jenis/pajak-restoran |
| X4 | DJP: faktur code 04 for DPP nilai lain | https://www.pajak.go.id/id/artikel/mengapa-harus-menggunakan-dasar-pengenaan-pajak-nilai-lain |

## (a) Per-module feature tables

### 1. Products / catalog
| Feature | Products | Priority | Source |
|---|---|---|---|
| Item: name, category, photo, price, SKU/barcode, description; "Save to all outlets" | Moka, iSeller | P0 | M1, I1 |
| Variants with own price + SKU (+ buy price in majoo); variant toggles visibility | Moka, majoo, Square | P0 | M1, J4 |
| Modifiers/add-ons as reusable sets (name + price options) | Moka, majoo ("Ekstra"), iSeller, Toast | P0 | M1, J4, I1 |
| Modifier rules: required/optional groups, size/sequence pricing, substitution | Toast | P1 | T1, T3 |
| Combo/package with groups, default choice, optional upcharge | ESB, iSeller (komboset) | P1 | https://help.esb.id/content/article/143620322710600 , I1 |
| Bulk import/export via Excel/CSV template; column matching; error report | Moka, Square, iSeller, Loyverse | P0 | M1, S7, I1 |
| Per-outlet price and stock/low-stock | Loyverse, iSeller (add-on), Toast (enterprise) | P1 | V3, I2, T1 |
| Price book: by outlet, customer, order type (dine-in/takeaway), % / Rp / special price, dated | iSeller, ESB (menu template) | P2 | I2, E3 |
| Separate online-store price per product | majoo | P1 | J4 |
| Units incl. decimal/custom units; multi-unit (beli kg, pakai gram) | Square, majoo | P1 | https://squareup.com/help/us/en/article/6678-item-unit-type-and-decimal-quantities-faqs , J6 |
| Ingredients (bahan baku) library, smallest unit, alert-at, COGS tracking | Moka (paid add-on), majoo, ESB (BOM) | P0 for F&B | M3, J4, E3 |
| Recipes per item/variant; total avg cost shown live | Moka, majoo (resep varian, master resep) | P0 for F&B | M3, J6 |
| Semi-finished ingredients / production (beras -> nasi) | Moka, majoo | P2 | M3/M5, J6 |
| Modifier consumes ingredient stock | Moka | P1 | M6 |
| Avg cost / COGS field on item | Moka, Loyverse ("View cost" permission) | P0 | M1, V1 |
| Recipe-limited "auto stock" for delivery channels (min ingredient) | majoo (GoFood) | P2 | https://majoo.id/panduan-pengguna/detail/617 |

### 2. Inventory & purchasing
| Feature | Products | Priority | Source |
|---|---|---|---|
| Stock adjustment with actual qty; Excel bulk adjustment | Moka, majoo | P0 | M2, M4 |
| Adjustment reasons: received, recount, damage, theft, loss, restock return, spoilage, internal use, samples + custom (up to 10) | Square | P0 | S5 |
| Stok opname as a document: draft, print, status, full vs partial count, review/approve, variance by qty and cost | majoo, Square | P0 | J5, S6 |
| Stok terbuang (waste) | majoo | P1 | J6 |
| Transfer between outlets (from/to, qty); request/pack/send/receive | Moka, Loyverse, Lightspeed, ESB | P0 multi-outlet | M2, https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534041856027-Transferring-stock-with-Lightspeed-Scanner |
| PO: outlet, supplier, qty, unit cost; Create vs Create & Fulfill; partial fulfil; email to supplier; print | Moka, Loyverse | P0 | M2, https://www.mokapos.com/manajemen-stok |
| Receive with landed cost (discount, shipping, duty) -> recalculates avg cost; receive without PO | Lightspeed X | P1 | L2 |
| Supplier profile; multiple suppliers per product with supplier code + price | Lightspeed X | P1 | L3 |
| Purchase request -> PO -> goods receipt -> purchase invoice -> payment, approval flow | ESB | P2 | E1 |
| Low-stock alert (item field + daily email/push) | Loyverse, Moka, Square | P0 | V2 manual, M1, S6 |
| Inventory summary: beginning, PO, usage, transfer, adjustment, ending | Moka | P0 | M5 |
| Stock history: who/when/cost/location, filter by reason | Square, Qasir | P0 | S8, https://www.qasir.id/ |
| Block selling when stock 0 (toggle) | Olsera | P1 | O2 |

### 3. Staff
| Feature | Products | Priority | Source |
|---|---|---|---|
| Preset roles (Owner/Admin/Manager/Cashier) + custom roles | Loyverse, Lightspeed, majoo | P0 | V1, L1, J1 |
| Granular toggles split POS vs back office (e.g. view all receipts, apply restricted discounts, change taxes, refunds, void saved items, view shift expected cash, open drawer, reprint, view cost; BO: reports, cancel receipts, items, inventory, employees, customers, billing, payment types, taxes, printers, devices) | Loyverse | P0 | V1 |
| Per-permission view/create/edit/delete/void checkboxes; landing page per role | majoo | P1 | J1 |
| Three-state permission: Allowed / Denied / Approval required (manager PIN) | Shopify POS | P0 | H1 |
| Manager override by PIN for one-time access | Loyverse, Shopify | P0 | V1, H1 |
| Personal 4-digit PIN vs shared team passcode (no attribution) | Square, Shopify (4-6 digit), majoo | P0 | S2, H2, J2 |
| Staff record: photo, name, NIP, phone, email, position, role, outlets, PIN, active toggle; bulk Excel | majoo | P0 | J2, J10 |
| Location-scoped access (sees only assigned outlets) | Square, Loyverse, Shopify | P0 | S1, V3, H2 |
| Attendance clock-in/out by PIN + selfie photo; attendance report editable | majoo, Loyverse (time clock) | P1 | J3, J10 |
| Shift scheduling, availability, timecard edit requests | Square | P2 | S9 |
| Commission report per staff | majoo | P2 | J10 |
| Temporary vendor support access without sharing password | majoo ("Akses Support") | P1 | J10 |

### 4. Sales reports
| Report | Products | Priority | Source |
|---|---|---|---|
| Dashboard: gross sales, net sales, gross profit, transactions, avg sale, gross margin; top 10 items; category by volume/sales | Moka | P0 | M7 |
| Sales summary (gross/net/discount/refund/tax/rounding/tips) by hour/day/week | Moka, Square | P0 | M7, S4 |
| By item/variant, category, modifier/extra, brand/department | Moka, Square, majoo | P0 | M7, J7 |
| Payment method breakdown (cash, EDC, e-wallet, other) | Moka, majoo, Square | P0 | M7, J11 |
| Sales type / order type (dine-in, takeaway, delivery) | Moka, majoo | P0 | M7, J7 |
| Discounts/promo, comps, voids (void shows cashier, authoriser, reason) | Square, majoo | P0 | S3, J8 |
| Refunds | Moka, majoo | P0 | M7, J7 |
| Tax report per tax name; service charge/gratuity | Moka, Square, majoo | P0 | M7, S3 |
| By staff: collected by (cashier) vs served by (waiter) | Moka | P1 | M7 |
| Shift / tutup kasir, per terminal, per cashier | Moka, majoo, Olsera | P0 | M8, J7, O3 |
| Loyalty points, coupons, customer report | majoo | P1 | J7 |
| Filters: outlet(s), date range, device, channel; export CSV/Excel/ZIP; auto daily email | Moka, Square, Olsera | P0 | M7, S4, O2 |
| Data retention window shown (Moka: last year + current; older on request) | Moka | P2 | M11 |

### 5. Customers, loyalty, promos
| Feature | Products | Priority | Source |
|---|---|---|---|
| Customer list + Excel import, groups with special price/promo | majoo | P0 | https://majoo.id/panduan-pengguna |
| Member registration at POS by phone number; points on receipt | Moka | P0 | https://help.mokapos.com/cara-mendaftarkan-member-baru-loyalty-program-pada-aplikasi |
| Loyalty program: outlets, validity, participants (all/new/specific), requirement (min spend/product), reward (% with cap, Rp, bonus product), auto coupon code, per-customer limit | majoo | P1 | J9 |
| Promo types: % / Rp per item, free item (BOGO), category requirement, AND/OR, applies-in-multiple, day/time window (happy hour), scheduled; outlet + sales-type scope | Moka | P0 | M9 |
| Promo immutable after creation (only period editable) to keep reports stable | Moka | P1 | M9 |
| Restricted discounts usable only by permitted roles | Loyverse | P0 | V1 |

### 6. Settings
| Feature | Products | Priority | Source |
|---|---|---|---|
| Outlet profile: name, address + map pin, phone (prints on receipt); warehouse as outlet | Pawoon | P0 | https://www.pawoon-helpcenter.com/id/menambahkan-outlet-melalui-back-office |
| Receipt designer: logo, unit price toggle, socials, footer note (Wi-Fi), "powered by" removal by plan, live preview per printer type | Pawoon, Qasir, Olsera | P0 | P3, Q5, O2 |
| Tax and service charge per outlet, multiple taxes, stacked calculation (service then tax) | Pawoon | P0 | P1 |
| Tax-exempt products | Olsera | P1 | https://crm.olsera.co.id/knowledge-base/category/faq |
| Rounding: off / auto / down / up, divisor (50, 100), simulation | Pawoon, Olsera; Square reports "cash rounding" | P0 | P2, O1, S4 |
| Payment methods: add custom (e.g. EDC BCA/Mandiri/BRI); Cash/Card default | Pawoon, Olsera | P0 | P2, O2 |
| QRIS activation: owner accepts T&C once; settlement account required; pending vs active balance; payout history | Qasir | P0 | Q3 |
| Digital payment KYC: KTP, NPWP, photos, bank info, individual vs business | Qasir | P1 | Q4 |
| Printers: Bluetooth/LAN, auto print on pay/save, kitchen ticket, auto cut, open drawer, 58/80 mm, test print | Qasir, Loyverse (kitchen printers) | P0 | Q2, V1 |
| Device management: limit/remove logged-in POS devices | Olsera, Qasir | P1 | O2, https://bantuan.qasir.id/id/collections/420634-6-pengaturan-kasir |
| Dining options / sales types; table module; queue number; pay-before-serve | Loyverse, Pawoon, Olsera | P1 | V1, O2 |
| Opening hours (business) | Qasir collects at digital payment signup; dedicated setting unverified | P2 | Q4 |
| Sales targets per day/hour | Pawoon | P2 | https://www.pawoon.com/manajemen-operasional/ |

### 7. Cash management
| Feature | Products | Priority | Source |
|---|---|---|---|
| Open shift with starting cash | Loyverse, Moka | P0 | V2, M8 |
| Pay in / pay out (kas masuk/keluar) with history | Loyverse, Moka (income/expense) | P0 | V2, M8 |
| Close shift: expected vs actual vs difference, per tender (cash, e-wallet, EDC, other) | Moka, Loyverse | P0 | M8, V2 |
| Blind close (hide expected from cashier) | Loyverse, Olsera | P0 | V2, O2 |
| Count by denomination; reopen/adjust closed drawer; drawers not auto-closed at business-day cutoff | Toast | P1 | T2 |
| Day start / day end | ESB | P1 | E2 |
| Export shift summary + pay-in/out | Loyverse, Moka, Olsera | P0 | V2, M8, O3 |

### 8. Subscription, billing, onboarding
| Feature | Products | Priority | Source |
|---|---|---|---|
| Billing page: current plan, active outlets with expiry each, add-on subscriptions, amount due, monthly/annual cycle, coupon, billing history | Moka | P0 | M10 |
| Trial per add-on, activate, payment method, billing details for invoice, PDF invoices, unsubscribe | Loyverse | P0 | V4 |
| Grace then lock: 7 days after unpaid, back office locked except billing/stores/devices/employees | Loyverse | P1 | V4 |
| Proration/credit on downgrade; annual-monthly switch rules | Loyverse | P2 | V4 |
| Setup guide checklist on home (verify identity, bank, hardware, items, team) | Square, Shopify | P0 | S10, H3 |
| Launch checklist with timeline (hardware, admin config, devices) | Shopify POS | P2 | H4 |

## Indonesia-specific notes
- PPN: statutory 12% since 1 Jan 2025, but non-luxury goods use DPP nilai lain 11/12, so effective 11%; luxury goods 12% (X1). Faktur code 04 for DPP nilai lain (X4). Implication: tax settings need "rate" and "DPP basis", not a single %.
- Restaurant food/drink is not PPN; it is PBJT (formerly pajak restoran / "PB1"), set by regional regulation, max 10% (X2). DKI: 10%, exempt below Rp42,000,000/month turnover; base is amount paid by consumer (X3). Implication: per-outlet regional tax config, label "PBJT (PB1)".
- Stacking order: Pawoon computes service charge first then tax on top (P1). Whether PBJT base includes service charge is regional; unverified.
- e-Faktur / Coretax: no Indonesian POS help article found showing direct e-Faktur export; ERPs (Accurate, Bee) export Coretax XML. Treat POS e-Faktur as unverified; an MVP needs NPWP/PKP fields + exportable sales data. Ref (non-POS): https://www.bee.id/kba/cara-update-ekspor-e-faktur-coretax-beeaccounting/
- QRIS: all POS list it as tender; Qasir shows settlement account, pending balance, H+3 payout and MDR disclosure in-app (Q3).
- WhatsApp receipts: Qasir shares digital receipt via Android share sheet to WhatsApp (Q1); Moka sends via SMS/email (https://help.mokapos.com/cara-mendaftarkan-member-baru-loyalty-program-pada-aplikasi). Native WhatsApp API sending: unverified for these products.
- Rounding (pembulatan): standard setting in Pawoon/Olsera with mode + divisor (P2, O1).
- Copy conventions observed: "Outlet", "Stok Opname", "Bahan Baku", "Resep", "Tutup Kasir", "Kas Masuk/Keluar", "Hak Akses", "Ekstra" (majoo) for modifiers, "Jenis Bayar", "Jenis Order". Moka back office mixes English labels (Library, Adjustment).

## (b) Top 15 gaps the prototype must show (ranked)
1. Product form with variants + modifier groups (required/optional, min/max) + per-outlet price/availability (M1, J4, T3, V3).
2. Bahan baku + resep with live HPP per menu, and modifier-to-ingredient deduction (M3, M6, J6).
3. Stok opname document flow: draft, count, variance qty/value, approve, print (J5, S6).
4. Adjustment reasons list + stock history (who/when/why/cost) (S5, S8).
5. PO -> receive (partial) -> avg cost update, with supplier master (M2, L2, L3).
6. Transfer antar outlet with sent/received states (M2, Lightspeed transfer page).
7. Role editor: POS vs back-office toggles, Allowed/Denied/Approval-required, manager PIN override (V1, H1, J1).
8. Staff form: PIN, outlets, role, active; attendance report (J2, J3).
9. Shift/tutup kasir: opening cash, kas masuk/keluar, blind close, expected vs actual per tender, export (M8, V2, O2).
10. Report set: summary, item, category, modifier, payment method, order type, hourly, discount, void (with authoriser + reason), refund, tax, per cashier, shift; outlet/date filters; Excel export (M7, J7, J8, S3).
11. Tax config split: PPN (12% x 11/12) vs PBJT/PB1 per outlet, service charge, stacking order shown in preview (X1–X3, P1).
12. Rounding setting with simulation; rounding line in reports (O1, S4).
13. Payment methods incl. QRIS activation + settlement status, custom EDC entries (Q3, P2).
14. Receipt designer with live 58/80 mm preview; printer + kitchen ticket settings; WhatsApp share (P3, Q2, Q1).
15. Billing page: plan, outlet count + expiry, add-ons, invoices, grace/lock banner; home setup checklist (M10, V4, S10, H3).

## (c) UX patterns worth copying
| Pattern | Where | Source |
|---|---|---|
| Home setup checklist (collapsible tasks, one CTA each); swaps to metrics after first sale | Shopify Home, Square Setup Guide | H3, S10 |
| Home "order tasks" with counts (fulfil, returns, risky orders) | Shopify | H3 |
| Empty report states explain prerequisites ("create discounts first to see this report") | Square | S3, https://squareup.com/help/us/en/article/8363-view-item-category-and-modifiers-sales-reports |
| Renaming an item/discount creates a separate report row: warn in edit form | Square | S3 |
| Live preview beside settings form (receipt per printer type; rounding simulation) | Pawoon, Olsera | P3, O1 |
| Destructive/irreversible confirmations ("Receive delivery can't be undone"; "Ya, Lanjutkan") | Lightspeed, majoo | L2, J5 |
| Draft save for long documents (opname, PO, receiving) | majoo, Lightspeed | J5, L2 |
| Template download -> fill -> upload -> column match -> error report | Square, Moka | S7, M4 |
| Stock filter chips: all / low / out of stock, colour-coded | Loyverse | https://help.loyverse.com/help/using-dashboard |
| Feature locked by plan shows trial CTA in place | Loyverse, Moka (Ingredients add-on) | V4, M3 |
| Report "compare" overlay (payment method A vs B) and granularity switch hour/day/week/month | majoo | J11 |
| Lock banner with remaining grace days; billing still reachable when locked | Loyverse | V4 |

## Unverified / open
- Toast, Lightspeed Restaurant staff permission and reports detail: not checked.
- Native WhatsApp Business API receipts in any benchmarked POS: unverified.
- Direct e-Faktur/Coretax export from Moka/majoo/Pawoon/Qasir/Olsera: not found.
- Whether PBJT base includes service charge: region-specific, unverified.
- Opening hours as a dedicated back-office setting in benchmarked POS: unverified.
