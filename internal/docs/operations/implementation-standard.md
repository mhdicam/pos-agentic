# Implementation Standard
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Before coding
Read relevant RD and FRD, handoff and open decisions. Identify owner, boundary, state machine, negative paths and evidence gate. Do not infer that Draft for Review is authorization to implement.

## During coding
One canonical mutation per event; integer IDR; server-side validation and entitlement; transaction-aware outbox; strict request/idempotency mapping; no DB bypass; no PII in logs; prefer small domain slices and explicit typed contracts.

## Testing
Unit/domain invariants; integration with PostgreSQL RLS and concurrency; POS offline refresh/crash/replay; E2E 12 role + guest, 320/390/768/1440 and real mobile accessibility; provider sandbox; backup/restore drills. Test invalid input/permission/cancel/retry in addition to happy path.

## Documentation changes
Update domain RD before entrypoint, add ADR for architecture, traceability row/test mapping, QA evidence (command/env/commit/result), then `README.md` registry. Never call a mock run production acceptance.

## Handoff format
Changed files; contract/diff; tests actually run; evidence paths; unresolved blockers; decision owner; rollout/rollback. Do not claim success for unexecuted tests.
