# AI Agent / Coding Agent Operating Rules

## Authority and scope
- Read `internal/docs/README.md`, its entrypoints, `requirements/rd-11-open-decisions.md`, and the baseline sources before creating any implementation.
- All files are **Draft for Review**. Do not begin implementation or claim sign-off solely because this scaffold exists.
- Any changed domain rule needs FR mapping, negative tests, a migration/API review, and (for architecture decisions) an ADR.
- Maintain Phase 2.3 traceability: `Screen → FR → API → Data → Permission → Acceptance → Slice`.

## Non-negotiable security and correctness
- Tenant `tenant_id` must be derived from authenticated server-side scope; enforce authorization plus DB RLS, including background jobs.
- Use integer IDR, immutable stock/payment/refund/points/COD movements and idempotent writes.
- Offline POS P0 supports safely queued cash transactions only under documented device policy; online validation is required for live payment gateways and global quotas.
- AI never executes direct SQL/refunds/stock changes; channel provider secrets must remain isolated and server-side.
- Unofficial WhatsApp is experimental, explicit opt-in and subject to legal/security approval; do not add anti-detection or evasion behavior.
- No assumptions of real GPS background tracking for Courier PWA; real foreground location requires consent.

## Evidence protocol
Every task handoff must include: modified paths, FR/route mappings, tests executed and exact results, unsatisfied gates, documentation updates, and proposed decision requests. Never invent evidence or mark a test passed from a mockup.
