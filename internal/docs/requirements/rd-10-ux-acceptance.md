# Responsive UX, States & Acceptance — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Baseline FR: FR-18; Phase 2.3 UX registry. Primary crosswalk: [`handoff traceability`](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv).

## Canonical product requirements / proposed technical contract
**UX contract:** separate navigation for 12 roles; mobile-first Courier, POS usable at 320/390/768/1440 widths; no page horizontal overflow; accessible focus/modal/touch targets, offline pending sync state, loading/empty/error/permission denied surfaces.

**Evidence:** route smoke **532/532** under isolated external assets does not prove full user journeys. 109 cases and 36 role journey cases from Phase 2.3 remain specified, not executed.

## Acceptance Criteria (EARS)
- **RD10-01** (Ubiquitous): The system shall provide separate navigation for each of the 12 roles. Tests: `P23-X45`
- **RD10-02** (Ubiquitous): The system shall render POS and Courier screens without page horizontal overflow at 320, 390, 768 and 1440 px widths. Tests: `P23-X43`, `P23-X44`
- **RD10-03** (Ubiquitous): The system shall provide loading, empty, error and permission-denied states for each screen. Tests: `P23-X47`
- **RD10-04** (Event): When a user navigates by keyboard, the system shall make every interactive action reachable and show visible focus. Tests: `P23-X43`
- **RD10-05** (Event): When the device loses internet, the POS shall show connection and pending-sync status without false success. Tests: `P23-X04`, `P23-X47`
- **RD10-06** (Event): When a role requests an unauthorized screen, the system shall render a safe denial that exposes no data. Tests: `P23-X47`
- **RD10-07** (Optional): Where an action is sensitive, the system shall show pending, failed or conflict state with a recovery action and an immutable audit entry, not only a success toast. Tests: `P23-X47`
- **RD10-08** (Unwanted): If route smoke passes but a role journey has not been executed, then the release gate shall not count the journey as accepted. Tests: `P23-X45`, `P23-UX-n22-acceptance`

## Primary workflow
Run positive/negative journeys for 12 roles on desktop/mobile, including public auth, checkout, offline queue, cross-tenant, courier/COD and Super Admin approval.

## API, state and data handoff
- All proposed endpoints and schemas must be finalized via `architecture/api-contract.md`, `architecture/data-model.md`, and an ADR where architectural boundaries change.
- Include `tenant_id`, `outlet_id`/`brand_id` as relevant, actor identity, version/expected state, idempotency and immutable audit/correlation IDs.
- Unit, integration, negative and UI tests must be linked to actual `P23-*` IDs before development ticket is accepted.

## Open review gates
Full business E2E, server authorization, concurrent writes, migration/recovery and production integrations are not covered by the current browser-local prototype. Consult `rd-11-open-decisions.md` and `qa/2026-11-03-mvp-acceptance-spec.md`.
