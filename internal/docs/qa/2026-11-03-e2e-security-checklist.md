# Security & E2E Checklist — 2026-11-03
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Identity/authorization
- [ ] Attempt tenant A access to tenant B by guessed order/SKU/payment/POD/export ID.
- [ ] Verify PostgreSQL RLS with non-bypass application role, including pooled transactions/background jobs.
- [ ] Test tenant switching revokes old permissions; role downgrades prevent mutation immediately server-side.
- [ ] Test Platform Admin MFA, support JIT scope/expiry and independent approval.

## Offline POS
- [ ] PWA install/uninstall/restart durability for catalog/shift/local queue.
- [ ] Device TTL, revoke, lost device and network oscillation.
- [ ] Replay batch, reordered events, duplicate payment, malformed payload, clock skew and two-register stock race.
- [ ] Confirm offline gateway/QRIS/loyalty global redemption never marks paid prematurely.

## Finance and commerce
- [ ] Negative/oversized/fractional IDR amounts rejected; full/partial refund cap and line rounding.
- [ ] Idempotency exactly once for sale, receipt, stock, cash shift close, COD and webhook.
- [ ] COD collected/remitted/verified distinctions and return quarantine.
- [ ] Historical price/HPP immutable after catalog edit.

## Channels/AI/GPS/privacy
- [ ] Provider webhook signature+replay, secrets/log redaction, file upload scanning and signed URL scope.
- [ ] AI cross-tenant tool prompt injection, handoff no double reply, quota exhaustion and consent deletion.
- [ ] Explicit foreground GPS consent and safe fallback with no location.
- [ ] Export CSV injection; POD and CRM PII blocked for unauthorized roles.

## Operations
- [ ] Backup restore in disposable environment, RPO/RTO evidence, alert tests, dependency outages, structured logs.

**Status:** every box above is NOT RUN unless future linked evidence is recorded. Source Phase 2.3 test matrix provides planned IDs.
