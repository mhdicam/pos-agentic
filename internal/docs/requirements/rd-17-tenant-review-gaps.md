# RD-17 Tenant Review-Driven Gaps (G1–G12) — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-11
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff

## Source and traceability
- Evidence: [`tenant gap analysis`](../research/2026-11-11-tenant-gap-analysis.md), built from [`Indonesian POS review mining`](../research/2026-11-11-id-pos-review-mining.md) and [`global POS review mining`](../research/2026-11-11-global-pos-review-mining.md).
- Baseline already implemented: RD-12 catalog, RD-13 stock, RD-14 team, RD-15 reports, RD-16 settings, RD10-POS register.
- Sequencing: roadmap slice **S9 Tenant review gaps** in [`roadmap`](../operations/roadmap.md). Decisions: `D-RD17-*` in [`open decisions`](rd-11-open-decisions.md). Architecture: [ADR-0011](../adr/0011-recipe-ingredient-stock.md) (G1).
- This RD is a **recommendation**, not implementation authorization (AGENTS.md). Every criterion below is a target; all are `Tests: NONE (gap)` until a test ID exists.

## Scope (recommended order)
| Wave | Gaps | Why first | Size |
|---|---|---|---|
| W1 Trust | G2 sync visibility, G9 audited corrections | Lost/unrecorded sales is the most damaging Indonesian complaint (review mining theme 2) | M + S |
| W2 F&B core | G1 recipes & ingredient stock | Global theme 6 (stock via modifiers/recipes); Moka sells it as add-on | L |
| W3 Owner value | G3 promo builder, G4 P&L + daily summary, G5 payment fees & settlement | ID themes 6, 7, 10; global theme 3 | M ×3 |
| W4 Restaurant | G7 tables & kitchen tickets, then G6 delivery-platform channels | ID extra theme (kitchen/tables); ID theme 8 (GoFood/GrabFood/ShopeeFood) | L ×2 |
| W5 Local & polish | G8 customer credit + wholesale price, G10 plan matrix, G11 gift card, G12 in-app help | ID local needs; ID theme 9 / global theme 2 (fees, paywalls); global theme 4 (support) | M/S |

Out of scope for the prototype: real QRIS/EDC settlement, printer drivers, accounting sync, real marketplace APIs (need provider contracts).

## Acceptance Criteria (EARS)
### W1 — Trust (G2, G9)
- **RD17-01** (Ubiquitous): The system shall show the tenant owner, per outlet and device, the count of transactions pending sync, the count of sync conflicts and the time of the last successful sync. Tests: NONE (gap)
- **RD17-02** (State): While a device has transactions pending sync for longer than the configured threshold (default 15 minutes, server time), the system shall flag that device on the owner overview with a "perlu perhatian" item. Tests: NONE (gap)
- **RD17-03** (Unwanted): If an offline transaction is rejected during sync, then the system shall keep it in a conflict list with the original payload and reason, and shall not drop it until an owner or manager resolves it. Tests: NONE (gap)
- **RD17-04** (Event): When a paid sale is voided or corrected, the system shall require a reason of at least 5 characters and an approver with `order.void` (or a manager PIN under RD14-02), write reversing stock and payment movements, and leave the original order immutable. Tests: NONE (gap)
- **RD17-05** (Unwanted): If a void is attempted on a sale whose shift is closed, then the system shall post the reversal to the current open shift and reference the original shift, never edit the closed shift. Tests: NONE (gap)

### W2 — Recipes & ingredient stock (G1)
- **RD17-06** (Ubiquitous): The system shall let a variant or a modifier option carry a recipe of ingredient SKUs with integer quantities in the ingredient's base unit (g, ml, pcs). Tests: NONE (gap)
- **RD17-07** (Event): When an order with recipe items is placed, the system shall write one ingredient stock movement per (ingredient, order) in the same transaction, including ingredients consumed through modifier options. Tests: NONE (gap)
- **RD17-08** (Ubiquitous): The system shall compute a menu item's cost (HPP) as the sum of ingredient quantity × ingredient moving-average cost, rounded to integer IDR, and snapshot it on the order line. Tests: NONE (gap)
- **RD17-09** (Unwanted): If an ingredient would go below zero at the outlet, then the system shall follow the tenant's recipe stock policy (block sale or allow negative with a flagged movement) recorded in D-RD17-c. Tests: NONE (gap)

### W3 — Owner value (G3, G4, G5)
- **RD17-10** (Optional): Where an automatic promotion is active, the system shall apply the single best eligible promotion per order for these types: buy X get Y, bundle price, time window (happy hour, WIB), and product/category scope. Tests: NONE (gap)
- **RD17-11** (Unwanted): If a promotion would make an order line price negative or exceed its usage quota, then the system shall not apply it and shall show the reason to the cashier. Tests: NONE (gap)
- **RD17-12** (Ubiquitous): The system shall report profit and loss per period and outlet as net sales − COGS snapshot − paid expenses − payment fees, labelled "Estimasi" while COGS is estimated. Tests: NONE (gap)
- **RD17-13** (Event): When the owner opens or shares the daily summary, the system shall show yesterday's (WIB) net sales, orders, top 3 items, cash variance and pending approvals, and offer a WhatsApp share link containing no customer PII. Tests: NONE (gap)
- **RD17-14** (Ubiquitous): The system shall record a fee per payment method (percentage in basis points and/or fixed IDR) and report gross, fee and net received per method, with expected settlement date per method. Tests: NONE (gap)

### W4 — Restaurant (G7, G6)
- **RD17-15** (State): While dine-in table service is enabled for an outlet, the system shall let staff open a bill on a table, add items over time, move or merge tables, and close the bill with payment; an open bill shall not count as a sale until paid. Tests: NONE (gap)
- **RD17-16** (Event): When items are sent to the kitchen, the system shall create a kitchen ticket per station with item, modifiers, note and time, and track it to "selesai". Tests: NONE (gap)
- **RD17-17** (Optional): Where a delivery-platform channel (GoFood, GrabFood, ShopeeFood) is enabled, the system shall keep a per-channel price and availability per variant and tag orders and reports with that channel. Tests: NONE (gap)

### W5 — Local needs & polish (G8, G10, G11, G12)
- **RD17-18** (Event): When a sale is put on customer credit (kasbon), the system shall require a registered customer and a credit limit, record a receivable, and accept partial repayments; the sale counts as revenue, the receivable shows as outstanding. Tests: NONE (gap)
- **RD17-19** (Optional): Where wholesale price tiers exist for a variant, the system shall price a line by the highest tier whose minimum quantity is met. Tests: NONE (gap)
- **RD17-20** (Ubiquitous): The plan page shall show, per plan, the included modules, limits and paid add-ons in one matrix, and the owner's current usage against each limit. Tests: NONE (gap)
- **RD17-21** (Event): When a gift card is sold or redeemed, the system shall keep a balance ledger in integer IDR and shall reject redemption beyond the remaining balance. Tests: NONE (gap)
- **RD17-22** (Ubiquitous): Every owner screen shall link to contextual help and a "hubungi tim" action that records a support request with the screen and tenant context. Tests: NONE (gap)

## Open review gates
- Product Owner selects waves and confirms D-RD17-a..e before EARS are frozen and tests are assigned in `handoff/EARS_TEST_TRACEABILITY.csv`.
- Finance signs off P&L and receivable treatment (RD17-12, RD17-18); Engineering signs off ADR-0011 (G1).
