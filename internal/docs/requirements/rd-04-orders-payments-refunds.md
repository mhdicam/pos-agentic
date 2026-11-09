# Orders, Pricing, Payment, Returns & Loyalty — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Baseline FR: FR-06, FR-08, FR-L22, FR-E22; Phase 2.2E/L/M. Primary crosswalk: [`handoff traceability`](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv).

## Canonical product requirements / proposed technical contract
**Snapshot:** order line records SKU ID, quantity, price/HPP version, allocated promotion, loyalty spend, tax/service charge rules and rounding. Never reconstruct original checkout from present price. Payment allocations can include multiple tenders online; payment gateway status is verified server-side.

**Rules:** full/partial refund uses cumulative per-line allocation; no over-refund, no double reversal or point mismatch. Refund amount, inventory restock eligibility, cash shift movement, gateway refund and COD are separate states. Refund after closed shift creates new authorized cash movement, not modification of closed snapshot.

## Acceptance Criteria (EARS)
- **RD04-01** (Ubiquitous): The system shall record on each order line the SKU ID, quantity, price version, HPP version, allocated promotion, loyalty spend, tax and service-charge rules and rounding. Tests: `P23-X12`, `P23-X23`, `P23-ROLE-006`, `P23-UX-transaction-integrity`
- **RD04-02** (Ubiquitous): The system shall use integer IDR for every monetary amount. Tests: `P23-X12`
- **RD04-03** (Ubiquitous): The system shall verify payment gateway status on the server. Tests: NONE (gap)
- **RD04-04** (Event): When a refund is requested, the system shall allocate it per line against cumulative net sold-not-refunded quantity. Tests: `P23-X12`, `P23-UX-lifecycle-closure`, `P23-UX-pos-reconcile`
- **RD04-05** (Event): When the same refund request ID is submitted again, the system shall return the existing result without a second cash or points movement. Tests: `P23-X15`
- **RD04-06** (Event): When a refund is requested after the shift closed, the system shall create a new authorized cash movement and leave the closed shift snapshot unchanged. Tests: `P23-X14`, `P23-ROLE-034`
- **RD04-07** (State): While a payment has multiple online tenders, the system shall store one allocation record per tender. Tests: `P23-X11`, `P23-UX-pos`
- **RD04-08** (Unwanted): If refund quantity exceeds the net sold-not-refunded quantity, then the system shall reject the refund. Tests: `P23-X12`, `P23-UX-lifecycle-closure`
- **RD04-09** (Unwanted): If a refund would double-reverse a payment or leave points mismatched, then the system shall reject it. Tests: `P23-X15`, `P23-UX-membership`
- **RD04-10** (Unwanted): If a checkout snapshot is requested after a price change, then the system shall return the original snapshot and not rebuild it from current prices. Tests: `P23-X23`, `P23-UX-transaction-integrity`

## Primary workflow
Checkout breakdown → promo/loyalty eligibility → payment allocation → order snapshot → return inspection → partial refund → payment/cash/points reconciliation.

## API, state and data handoff
- All proposed endpoints and schemas must be finalized via `architecture/api-contract.md`, `architecture/data-model.md`, and an ADR where architectural boundaries change.
- Include `tenant_id`, `outlet_id`/`brand_id` as relevant, actor identity, version/expected state, idempotency and immutable audit/correlation IDs.
- Unit, integration, negative and UI tests must be linked to actual `P23-*` IDs before development ticket is accepted.

## Open review gates
Full business E2E, server authorization, concurrent writes, migration/recovery and production integrations are not covered by the current browser-local prototype. Consult `rd-11-open-decisions.md` and `qa/2026-11-03-mvp-acceptance-spec.md`.
