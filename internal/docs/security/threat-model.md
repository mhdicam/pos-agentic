# Threat model — multi-tenant commerce
Status: draft (for review, not signed off)
Date: 2026-11-10

Summary of [Master PRD §12](../references/MASTER_PRD_SaaS_POS_MultiTenant_Delivery_AI_v1.4.5.md) plus offline POS
threats. Controls are **required**, not implemented. Mandatory controls: [security standard](security-standard.md);
current gaps: [baseline audit](2026-11-03-baseline-audit.md).

## Trust boundaries
1. Browser/PWA (POS, storefront, courier) ↔ API — untrusted client; `tenant_id` never accepted from client.
2. API/worker ↔ PostgreSQL — RLS with non-bypass app role; tenant context set per transaction.
3. Offline POS device ↔ sync API — device grant, TTL, signed batches, idempotent replay.
4. API ↔ providers (payment, WhatsApp official/unofficial, LLM) — signed webhooks, isolated secrets.
5. Platform plane ↔ tenant data — MFA, purpose-bound JIT support access with separate approver.

## Highest-risk threats
| Threat | Control | Release test |
|---|---|---|
| IDOR / cross-tenant access | Object auth + RLS `USING`/`WITH CHECK`, composite FKs | Tenant A/B probes on every CRUD/export/job |
| Privilege escalation / mass assignment | Writable-field allowlist, RBAC + outlet scope in services | Cashier cannot change own role or protected price |
| Session theft | Managed auth, MFA for owner/admin, HttpOnly Secure SameSite cookies, revoke | Revoked token rejected |
| Offline device tamper/replay | Device grant + TTL, batch idempotency, server re-pricing, conflict inbox | Duplicate batch mutates once |
| Lost/stolen POS device | Revocation (bounded by TTL), local queue protection | Revoked device cannot sync new batches |
| Payment/webhook replay | Signature check, unique event IDs, monotonic transitions, amount match | 10 repeated/out-of-order events stay consistent |
| Malicious upload / SQLi | Parameterized SQL, schemas, MIME/size scan, private buckets | Malformed payload and upload rejected |
| Domain takeover / cache pollution | Domain ownership proof, host allowlist, tenant-aware cache key | Unverified host never routes to tenant |
| Report/export exfiltration | Per-row permission, short-lived signed URLs, CSV-injection escaping | Forbidden export fails end-to-end |
| Insider / support abuse | Least privilege, no direct prod DB, break-glass approval, audit | Support access has reason, scope, expiry, log |
| Secrets/PII in logs | Redaction of credentials/PII/location | Log scan finds no secrets |
| AI prompt injection / tool abuse | Tool allowlist, per-tool server auth, no SQL/URL tools | Injected FAQ cannot change actions |
| AI cross-tenant RAG leak | Tenant+brand filters on KB/memory/cache | Tenant A context never returns Tenant B |
| AI send after human handoff | Versioned owner state, pre-send check | No AI message after handoff commit |
| AI bill shock | Atomic credit reserve, token caps | Concurrent exhaustion enforced once |
| Unofficial WA session theft / protocol break | Encrypted auth material, isolated worker, feature flag, no anti-detection | Blocked state halts auto-send |

## Privacy
Indonesian PDP Law (UU No. 27/2022) review before go-live; data minimization; courier location only while working
with consent; retention numbers in PRD §12.2 are **proposals** pending legal review; no training on merchant
customer data.
