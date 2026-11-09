# MVP Acceptance Specification — 2026-11-03
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Evidence status
109 Phase 2.3 acceptance cases and 36 cross-role journeys are designed, **not fully executed**. 532 route smoke checks passed in Chromium under restricted external assets. Treat the CSV registries as the canonical case inventory.

## P0 critical suites
| Group | Acceptance gate |
|---|---|
| S0 tenancy | cross-tenant API/DB/cache/worker/exports denied |
| S0A–C offline | installation, local durability, expired/revoked devices, idempotent sync, conflict recovery |
| S1 inventory | SKU and receiving, reserve/adjust/quarantine; concurrency and source-event uniqueness |
| S2 POS/finance | shift, cash in/out, promo/points/split, cumulative refund, closed shift invariant |
| S3 storefront | preview/publish separation, guest flow, token security, public data minimization |
| S4 courier | reassign/timeout, pickup checklist, POD, failed return, COD collect/remit/verify |
| S5 finance | expense maker/checker, reconciliation, report filters/drilldown, period closure |
| S6 AI optional | approved channels, human handoff, consent, hard budget, safe tool access |
| S7 platform | MFA, billing entitlement, approved suspend, fleet, support JIT/backup drill |
| S8 UI/a11y | 12-role E2E, 320/390/768/1440, keyboard/screenreader, real-device performance |

## Test record template
`case_id; commit_SHA; environment; OS/browser/device; fixture; steps; expected; actual; pass/fail/not_run; logs/screenshots; issue; reviewer; date`.

## References
- [Acceptance 109 cases](../handoff/PHASE_2_3_UX_ACCEPTANCE_CASES.csv)
- [Role journeys 36 cases](../handoff/PHASE_2_3_12_ROLE_E2E_JOURNEYS.csv)
- [Prior scoped smoke evidence](../handoff/PHASE_2_3_ROUTE_REGRESSION_EVIDENCE.json)
