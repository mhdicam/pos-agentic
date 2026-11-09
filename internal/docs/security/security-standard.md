# Security Standard — Multi-Tenant Commerce
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Mandatory controls
- RBAC/ABAC and PostgreSQL RLS on every tenant row; non-bypass DB role; explicit worker tenant context.
- MFA/least privilege for Platform Admin and high-risk approvals; JIT support access with approver distinct from requester.
- Cash/POS/device signed identity, offline TTL and revoke handling, local queue protection and recovery after device loss.
- Idempotent payment, refund, inventory, COD and loyalty mutations; immutable audit/outbox.
- Webhook signature verification, provider event dedupe, secret rotation and PII-redacted logging.
- Private upload and POD storage; signed URL only after tenant/action authorization; file MIME/type/size scanning.
- AI prompt injection defenses: deny direct SQL, tool allowlist, minimum fields and policy-mediated actions; stop auto-replies on human handoff.
- Consent/retention for customer memories, contact channels and GPS; unofficial WA pilot requires explicit legal/security approval.

## Required proof
Automated cross-tenant API/DB/worker/cache probes; authentication abuse/rate limit; object-level auth; supply chain audit; offline device tamper/replay; payment/COD/refund double-submit; data export/CSV injection; support access expiry. Follow `qa/2026-11-03-e2e-security-checklist-spec.md`.
