# Product, SKU, Procurement & Inventory — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Baseline FR: FR-04, FR-09, FR-TXI; Phase 2.2C/D/E. Primary crosswalk: [`handoff traceability`](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv).

## Canonical product requirements / proposed technical contract
**Model:** products, categories, variants with unique tenant/outlet SKU, barcodes, unit, HPP, price versions, modifiers, PO, receipts, reservations, stock movements, stock opname.

**Authority:** one authoritative stock balance per `(tenant,outlet,variant)` computed/updated atomically with movement. `available = on_hand - active_reserved`; no blind client stock writes. Supplier receiving increases stock exactly once after accepted quantity.

## Acceptance Criteria (EARS)
- **RD02-01** (Ubiquitous): The system shall keep one authoritative stock balance per `(tenant, outlet, variant)` and update it atomically with its stock movement. Tests: `P23-X17`, `P23-UX-inventory`, `P23-UX-product-ops`
- **RD02-02** (Ubiquitous): The system shall compute `available = on_hand - active_reserved`. Tests: `P23-UX-inventory`
- **RD02-03** (Ubiquitous): The system shall keep SKU unique per tenant and outlet scope. Tests: `P23-UX-catalog`
- **RD02-04** (Event): When a supplier receipt is accepted, the system shall increase stock by the accepted quantity exactly once. Tests: `P23-X20`, `P23-ROLE-005`, `P23-UX-tenant-operations`
- **RD02-05** (Event): When the same receipt or idempotency key is submitted again, the system shall return the original result and not increase stock again. Tests: `P23-X20`, `P23-UX-tenant-operations`
- **RD02-06** (Event): When returned goods are received, the system shall hold them in quarantine until inspection passes. Tests: `P23-X18`, `P23-X27`, `P23-UX-lifecycle-closure`, `P23-UX-o22-exceptions`
- **RD02-07** (State): While goods are in quarantine, the system shall exclude them from sellable stock. Tests: `P23-X18`
- **RD02-08** (Optional): Where an approved backorder state is configured, the system shall allow checkout above available stock only in that explicit state. Tests: NONE (gap)
- **RD02-09** (Unwanted): If requested checkout quantity exceeds available stock and no approved backorder state applies, then the system shall fail the checkout. Tests: `P23-X08`, `P23-ROLE-012`
- **RD02-10** (Unwanted): If a client attempts to write a stock balance directly, then the system shall reject the write. Tests: `P23-UX-transaction-integrity`
- **RD02-11** (Unwanted): If a stock movement would result in negative stock silently, then the system shall reject it. Tests: `P23-X08`, `P23-UX-inventory`

## Primary workflow
Variant CRUD → bulk import preview/commit → purchase order approval → partial receiving → stock reservation → sale/return → stock count/adjustment → audit.

## API, state and data handoff
- All proposed endpoints and schemas must be finalized via `architecture/api-contract.md`, `architecture/data-model.md`, and an ADR where architectural boundaries change.
- Include `tenant_id`, `outlet_id`/`brand_id` as relevant, actor identity, version/expected state, idempotency and immutable audit/correlation IDs.
- Unit, integration, negative and UI tests must be linked to actual `P23-*` IDs before development ticket is accepted.

## Open review gates
Full business E2E, server authorization, concurrent writes, migration/recovery and production integrations are not covered by the current browser-local prototype. Consult `rd-11-open-decisions.md` and `qa/2026-11-03-mvp-acceptance-spec.md`.
