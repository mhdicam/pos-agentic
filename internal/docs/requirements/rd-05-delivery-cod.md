# Dispatch, Courier, POD & COD — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Baseline FR: FR-10, FR-DLV-001–032; Phase 2.2O. Primary crosswalk: [`handoff traceability`](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv).

## Canonical product requirements / proposed technical contract
**Model:** delivery job, assignment version/lease, courier availability/capacity/outlet, pickup checklist, state events, exception/retry/return, POD private media and COD collection/remittance/verification.

**Rules:** only the assigned courier may mutate a task. Assignment reassign invalidates previous ownership. POD never publicly exposes GPS/photo/PII. COD `COLLECTED`, `REMITTED`, `VERIFIED`, and order `PAID` are separate phases. Return-to-store does not auto-restock or refund.

## Acceptance Criteria (EARS)
- **RD05-01** (Ubiquitous): The system shall keep refund amount, restock eligibility, COD `COLLECTED`, `REMITTED`, `VERIFIED` and order `PAID` as separate states. Tests: `P23-X28`, `P23-ROLE-008`, `P23-UX-o22-cod`
- **RD05-02** (Ubiquitous): The system shall store POD photo, GPS and PII as private media that is never publicly exposed. Tests: `P23-X24`, `P23-X29`, `P23-UX-o22-pods`
- **RD05-03** (Event): When an assignment is reassigned, the system shall invalidate the previous courier's ownership. Tests: `P23-X25`, `P23-ROLE-026`
- **RD05-04** (Event): When a stale assignment version is acted on, the system shall reject the action. Tests: `P23-X25`
- **RD05-05** (Event): When COD is collected, the system shall record `COLLECTED` and shall not mark the delivery financially reconciled. Tests: `P23-X28`, `P23-ROLE-008`, `P23-UX-o22-courier-cash`
- **RD05-06** (Event): When Finance verifies a remittance, the system shall move COD to `VERIFIED` and record the outcome. Tests: `P23-X28`, `P23-ROLE-007`, `P23-UX-o22-cod`
- **RD05-07** (State): While a courier is not the assigned courier, the system shall deny task mutations to that courier. Tests: `P23-X26`, `P23-ROLE-028`, `P23-UX-o22-courier-tasks`
- **RD05-08** (Optional): Where the courier grants foreground location consent, the system shall use foreground location for navigation only. Tests: `P23-X30`, `P23-UX-o22-courier-profile`
- **RD05-09** (Unwanted): If delivery is marked complete while mandatory POD is missing, then the system shall block completion. Tests: `P23-X29`
- **RD05-10** (Unwanted): If the COD amount collected is below the required value, then the system shall not reconcile the job. Tests: `P23-X28`
- **RD05-11** (Unwanted): If a delivery is returned to store, then the system shall not restock or refund automatically. Tests: `P23-X18`, `P23-X27`
- **RD05-12** (Unwanted): If background GPS tracking is assumed for the Courier PWA, then the system shall not rely on it. Tests: `P23-X30`

## Primary workflow
Ready → assign/reject/timeout/reassign → accept → pickup checklist → navigate foreground opt-in → delivery/POD → COD collect → remit → Finance verify; failure → retry/return/check-in.

## API, state and data handoff
- All proposed endpoints and schemas must be finalized via `architecture/api-contract.md`, `architecture/data-model.md`, and an ADR where architectural boundaries change.
- Include `tenant_id`, `outlet_id`/`brand_id` as relevant, actor identity, version/expected state, idempotency and immutable audit/correlation IDs.
- Unit, integration, negative and UI tests must be linked to actual `P23-*` IDs before development ticket is accepted.

## Open review gates
Full business E2E, server authorization, concurrent writes, migration/recovery and production integrations are not covered by the current browser-local prototype. Consult `rd-11-open-decisions.md` and `qa/2026-11-03-mvp-acceptance-spec.md`.
