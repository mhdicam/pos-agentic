# POS, Registers, Shifts & Offline Sync — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Baseline FR: FR-05, FR-18, FR-TXI; Phase 2.2J/K/L/M; offline MVP P0. Primary crosswalk: [`handoff traceability`](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv).

## Canonical product requirements / proposed technical contract
**MVP P0:** installable PWA shell, registered cashier device, bounded authorization TTL, cached authorized catalog/price, IndexedDB transaction outbox, cash-only offline payments, shift cash in/out, receipt `PENDING_SYNC`, reconciliation on reconnect. The single HTML prototype is **not** an offline PWA.

**Rules:** offline session uses durable local transaction ID, strictly ordered local mutations, sync idempotency, conflict inbox; server confirms final stock/payment once. Encrypted-at-rest where possible, but browser storage is **not** hardware KMS. Gateway/QRIS payments and global loyalty redemption are not marked paid offline.

## Acceptance Criteria (EARS)
- **RD03-01** (Ubiquitous): The system shall assign each offline transaction a durable local transaction ID and apply local mutations in strict order. Tests: `P23-X06`
- **RD03-02** (Ubiquitous): The system shall confirm final stock and payment effects on the server exactly once per transaction. Tests: `P23-X05`
- **RD03-03** (Ubiquitous): The system shall accept only cash tender for offline payments in MVP P0. Tests: `P23-X04`
- **RD03-04** (Event): When the network drops after a local cash sale, the device shall retain the order, the receipt and the pending queue through an application restart. Tests: `P23-X04`, `P23-X06`
- **RD03-05** (Event): When a local cash sale is stored offline, the device shall show the receipt with status `PENDING_SYNC`. Tests: `P23-X04`
- **RD03-06** (Event): When the same sync event is replayed, the server shall record one sale, one inventory decrement and one financial entry. Tests: `P23-X05`
- **RD03-07** (Event): When the device reconnects, the system shall reconcile queued transactions and place conflicts in the conflict inbox. Tests: `P23-X08`, `P23-UX-n22-fleet`
- **RD03-08** (Event): When a shift closes, the system shall compute cash variance from opening cash, cash in/out and cash sales. Tests: `P23-X09`, `P23-X13`, `P23-ROLE-006`, `P23-ROLE-034`, `P23-UX-pos-operations`
- **RD03-09** (State): While the device authorization is expired or revoked under the approved TTL policy, the device shall stop offline operations. Tests: `P23-X07`, `P23-ROLE-024`, `P23-UX-n22-fleet`
- **RD03-10** (Optional): Where the device cache holds an authorized catalog and price list, the POS shall sell from that cache while offline. Tests: `P23-X04`
- **RD03-11** (Unwanted): If a payment uses a gateway or QRIS while offline, then the system shall not mark it as paid. Tests: NONE (gap)
- **RD03-12** (Unwanted): If global loyalty redemption is requested while offline, then the system shall not apply it. Tests: NONE (gap)
- **RD03-13** (Unwanted): If an offline sale exceeds server stock at sync, then the system shall raise a conflict and not decrement stock below the approved policy. Tests: `P23-X08`

## Primary workflow
Device provision → open shift with cash → offline SKU scan/cart → local cash payment → pending receipt → reconnect/sync → conflict resolve → closing and variance.

## API, state and data handoff
- All proposed endpoints and schemas must be finalized via `architecture/api-contract.md`, `architecture/data-model.md`, and an ADR where architectural boundaries change.
- Include `tenant_id`, `outlet_id`/`brand_id` as relevant, actor identity, version/expected state, idempotency and immutable audit/correlation IDs.
- Unit, integration, negative and UI tests must be linked to actual `P23-*` IDs before development ticket is accepted.

## Open review gates
Full business E2E, server authorization, concurrent writes, migration/recovery and production integrations are not covered by the current browser-local prototype. Consult `rd-11-open-decisions.md` and `qa/2026-11-03-mvp-acceptance-spec.md`.
