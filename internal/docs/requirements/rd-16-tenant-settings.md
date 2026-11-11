# RD-16 Tenant settings (tax PBJT/PPN, rounding, payments, receipt) — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-10
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Benchmark: [`tenant back-office benchmark`](../references/2026-11-10-tenant-backoffice-benchmark.md) rows P1 (tax + service stacking), P2/O1 (pembulatan, payment methods), P3/Q5 (receipt design), Q1 (WhatsApp receipt), Q3 (QRIS MDR), X1/X4 (PPN 12% with DPP 11/12), X2/X3 (PBJT max 10%, DKI 10%). Prototype contract: `CONTRACT.md` (Extension points: `Orbis.hooks.charges`, `Orbis.hooks.tenderEnabled`).

Traceability: Screen `settings` (tabs Profil & struk, Pajak & service, Pembulatan, Metode pembayaran, Desain struk, Jam operasional) and POS checkout/receipt → Domain `Orbis.domain.bizSettings` (`js/domain/x-settings.js`) → Data `d.bizSettings[tenant] = {tax, outletTax{outletId}, rounding, payments, receipt}` → Permission `tenant.settings` (owner) → Tests `tests/x-settings.test.js` → Slice B6.

## Calculation rules (integer IDR)
- `base` = subtotal − discount. `bp` = tax rate in basis points; PPN with DPP 11/12 uses `bp = rate × 100 × 11/12` (12% → 1100 bp, effective 11%).
- Service = `Math.round(base × service% / 100)`. Taxable `G` = base + (taxOnService ? service : 0).
- Exclusive: tax = `Math.round(G × bp / 10000)`, added to the total.
- Inclusive: tax is extracted, `taxIncluded = Math.round(G × bp / (10000 + bp))`; order `tax` stays 0 and the total is unchanged (service still added on top).
- Rounding: grand = base + exclusive tax + service + delivery fee; `rounding = roundTo(grand, unit, mode) − grand` (can be negative); nearest = half up. Applied only when scope is `all` or the whole payment is cash (split payments are not rounded).
- Math.round on positive integers is half-up; every component is rounded separately before summing.

## Acceptance Criteria (EARS)
- **RD16-01** (Ubiquitous): While a tenant has no tax configuration, the system shall compute tax and service exactly as the legacy `orders.settings` percentages with no rounding. Tests: `settings: backward compat without config reproduces legacy tax/service`
- **RD16-02** (Event): When an order is priced with PBJT exclusive at rate r, the system shall add `Math.round(base × r / 100)` as tax and label it "PBJT r%". Tests: `settings: PBJT 10% exclusive exact rupiah`
- **RD16-03** (Event): When an order is priced with PPN 12% and DPP 11/12 enabled, the system shall use an effective rate of 11% (exclusive: 100.000 → 11.000). Tests: `settings: PPN DPP 11/12 exclusive is effective 11%`
- **RD16-04** (State): While price mode is inclusive, the system shall extract tax as `Math.round(G × bp / (10000 + bp))` and shall keep the order total equal to base + service + rounding. Tests: `settings: PPN 12% DPP 11/12 inclusive extracts tax, total unchanged`
- **RD16-05** (State): While "pajak dihitung dari subtotal + service" is on, the system shall compute tax on base + service; otherwise on base only. Tests: `settings: service then tax toggle`
- **RD16-06** (Unwanted): If a PBJT rate above 10%, a PPN rate other than 12%, or a service charge outside 0–20% is submitted, then the system shall reject it with VALIDATION and keep the previous configuration. Tests: `settings: tax bounds validated (PBJT max 10, PPN 12, service 0-20)`
- **RD16-07** (Event): When rounding is configured (unit 100/500/1000, mode down/nearest/up), the system shall add `roundTo(grand) − grand` as the order rounding component. Tests: `settings: rounding 100/500/1000 down/nearest/up`
- **RD16-08** (State): While rounding scope is cash only, the system shall round only orders paid fully in cash and shall leave QRIS, transfer and split orders unrounded. Tests: `settings: rounding applies to cash only through checkout`
- **RD16-09** (Unwanted): If a disabled tender is used at checkout, then the system shall reject the order with TENDER_DISABLED and shall not move stock. Tests: `settings: disabled QRIS rejected with TENDER_DISABLED`
- **RD16-10** (Unwanted): If a save would disable every in-store tender (cash, QRIS, transfer, EDC) or enable transfer without a valid bank account, then the system shall reject it with VALIDATION. Tests: `settings: cannot disable all tenders; bank account validated`
- **RD16-11** (State): While an outlet has its own tax configuration, the system shall use it instead of the tenant default, and other tenants' configuration shall never apply. Tests: `settings: outlet override beats tenant default`, `settings: other tenant isolated`
- **RD16-12** (Unwanted): If a role without `tenant.settings` saves any settings, then the system shall reject it with FORBIDDEN and write no audit row. Tests: `settings: forbidden role cannot save`
- **RD16-13** (Event): When a receipt is shared via WhatsApp, the system shall build a `wa.me/62…` link with the plain-text receipt only if the order has a customer phone. Tests: `settings: receipt config saved and WhatsApp link only with phone`

## Prototype notes
- Seed: Freshmart (t2) = PPN 12% DPP 11/12 inclusive. Kopi Awan (t1) keeps legacy (zero) tax in the base seed because existing sales tests assert zero tax on t1; PBJT 10% exclusive + rounding 100 nearest on cash is applied by "Terapkan preset Kopi Awan" and by `Orbis.demoHistory()` (after history is built). Tests: `settings: Freshmart seed PPN inclusive; Kopi Awan preset`
- Bridges until `sales.js` supports them natively (requested): `x-settings.js` wraps `orders.quote` to pass the tender to `charges`, and wraps `orders.place` to snapshot `taxIncluded` on the order inside the same transaction.
- QRIS MDR (default 0,3%) is informational only; settlement status list is out of scope.
- EDC can be enabled in settings but `sales.js` accepts only cash/transfer/QRIS tenders; COD bypasses `tenderEnabled` in `sales.js` (requested fix).

## Open review gates
Browser-local prototype only; server authorization, concurrency and production integrations are not covered. Tax model per outlet and e-Faktur/Coretax scope are open decisions in [RD-11](rd-11-open-decisions.md). Regional PBJT base (with or without service) is unverified and therefore a setting.
