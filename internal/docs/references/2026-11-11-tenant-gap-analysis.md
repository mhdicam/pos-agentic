# Tenant Gap Analysis (review-driven)
Status: draft (for review, not signed off)
Date: 2026-11-11
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff

## Sources
- [`Indonesian POS review mining`](2026-11-11-id-pos-review-mining.md) — Google Play ranking (Kasir Pintar 4.8/53.6K, Qasir 4.3/31.9K, Loyverse 4.8/18.1K, Moka 4.5/12.6K; majoo benchmarked by features).
- [`Global POS review mining`](2026-11-11-global-pos-review-mining.md) — G2/Capterra ranking (Square 4.6/~4.3K, Lightspeed Retail, Toast, Shopify POS, Clover, Loyverse).
- [`Tenant back-office benchmark`](2026-11-10-tenant-backoffice-benchmark.md) — feature-level baseline already implemented as RD-12..16.

Prototype state compared: branch `feat/tenant-backoffice` (245 tests), owner/manager/cashier/finance navigation, RD-12..16 EARS.

## What we already match (review praise themes)
| Theme (reviews) | Prototype today |
|---|---|
| Fast, simple cashier (top praise ID + global) | Full-screen register, tap-to-add, picker, quick cash, success screen (RD10-POS) |
| Variants + modifiers | RD12 (groups, required/default, outlet price) |
| Stock accuracy & transfers (top ID complaint) | Immutable ledger, stock card, opname, transfers with discrepancy (RD13) |
| Multi-outlet control | Outlet switcher, per-outlet price/tax/stock, all-outlet reports (RD15-02) |
| Granular staff permissions in base tier (global complaint) | Role matrix allow/deny/manager PIN (RD14) |
| Shift close that computes itself | Blind close + Z-report (RD14-10) |
| Payments QRIS/split, per-method on/off | RD16 tenders, split, QRIS (simulated) |
| Report comparison + CSV export (global complaint) | Previous-period compare, CSV per report (RD15-05/12) |
| Tax correctness per rate | PBJT/PPN per outlet, report by tax label incl. inclusive tax (RD16, RD15) |

## Gaps (ranked by review weight × fit for SME F&B/retail)
| # | Gap | Evidence (reviews) | Have today | Size |
|---|---|---|---|---|
| G1 | **Recipe / ingredient stock (bahan baku) incl. modifier deduction**, live HPP per menu | Global theme 6 (Loyverse can't track stock via modifiers); Moka sells recipes as add-on | Stock only per sold SKU; COGS from static cost | L |
| G2 | **Offline/sync status visible to the owner** (devices, pending, conflicts) and "no lost sale" guarantee UX | ID theme 2 (most damaging complaint), global theme 8 | Outbox exists; owner sees only a PENDING_SYNC banner; fleet is platform-only | M |
| G3 | **Promotion builder**: buy X get Y, bundle/paket, happy hour (time window), per-category/product scope, auto-apply | ID theme 7; table-stakes globally | Code promos %/fixed only | M |
| G4 | **Owner daily summary + profit & loss** (sales − COGS − expenses per period/outlet), sent/sharable via WhatsApp | ID theme 10 (Moka lacks P&L); global theme 3 | Gross margin estimate only; expenses separate | M |
| G5 | **Payment fees & settlement**: MDR per method, net received, settlement date/status report | ID theme 6 (fee per method, next-day settlement); global theme 2 | MDR shown as info text only | M |
| G6 | **Delivery-platform channel** (GoFood/GrabFood/ShopeeFood): per-channel price & availability, channel in reports, order intake simulation | ID theme 8 (widely advertised; late/partial sync complaints) | Not present | L |
| G7 | **Restaurant ops**: table/dine-in with open bills, kitchen ticket/printer view (KDS-lite) | ID extra theme (kitchen printer, tables); Toast/TouchBistro core | `dine` method exists, no tables/tickets | L |
| G8 | **Customer credit (kasbon/piutang) & wholesale tier prices** | ID local needs (Kasir Pintar, Qasir reviews) | Not present | M |
| G9 | **Audited corrections to posted sales** (void with reason & approver, post-close edits) | Global theme (corrections), void reports | Cancel exists; void report exists; no post-payment correction flow | S |
| G10 | **Transparent plan page**: what each plan includes (feature matrix, add-ons), usage-based upgrade nudges | ID theme 9, global theme 2 (fees/paywalls) | Plans show limits only | S |
| G11 | **Gift card / voucher saldo** | Table-stakes globally | Not present | M |
| G12 | **Support & onboarding inside the app** (help center links, guided setup, contact human) | ID theme 5, global theme 4 | Onboarding checklist only | S |

Out of scope for the prototype (needs real infrastructure): actual QRIS/EDC settlement, printer/hardware drivers, accounting sync (Jurnal/Accurate/QuickBooks), real marketplace APIs.

## Decision requests
- Pick the next batch from G1–G12 (recommended order below), confirm scope per item before EARS are written.
- G6 needs a product decision: simulated channel orders only, or a full menu-sync model (per-channel price lists).

## Recommended order
1. **G2 + G9** (trust: no lost sales, audited corrections) — protects the top complaint, mostly S/M.
2. **G1** (recipes/HPP) — biggest F&B differentiator vs Loyverse/Moka basic tiers.
3. **G3 + G4 + G5** (promos, P&L/daily WA summary, fees/settlement) — owner value, reuse reports2.
4. **G7** (tables/kitchen) then **G6** (delivery channels) — restaurant depth.
5. **G8, G10, G11, G12** — local needs and polish.
