# Security Baseline Audit (Scaffold Assessment)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Current evidence
- Phase 2.3 route smoke checked 133 role/menu pairs on four viewport widths with JavaScript runtime monitoring. This does **not** establish server authorization or tenant isolation.
- Prototype uses browser demo state; sensitive credentials, real payment webhooks, RLS, encrypted device sync and production support grants have not been assessed as implemented.

## P0 gaps to resolve
| Control | Current status | Gate |
|---|---|---|
| RLS/cross-tenant isolation | unimplemented/unverified | S0 |
| POS offline provisioning/revoke | unimplemented/unverified | S0A–C |
| Payment/refund/stock financial integrity | unimplemented/unverified | S1–S5 |
| Platform MFA/support JIT access | unimplemented/unverified | S7 |
| Provider integration/AI tool policy | unimplemented/unverified | S6 if enabled |
| Restore drill/incident operations | unimplemented/unverified | S8 |

## Owner and evidence
Security reviewer is TBD. This audit is a gap classification, not a penetration-test report. Link future test logs and date/commit in an addendum.
