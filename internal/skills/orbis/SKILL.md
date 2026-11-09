---
name: orbis
description: >-
  Use when working on the Orbis Commerce project: multi-tenant POS SaaS for
  Indonesian merchants — tenancy/RBAC/RLS, catalog/SKU/inventory ledger,
  register/shift and offline-first cash POS (PWA + IndexedDB outbox + idempotent
  sync), orders/pricing/payments/refunds, storefront draft/publish, dispatch/
  courier/POD/COD, expenses/finance, promotions/loyalty, AI+CRM and channel
  adapters (official WhatsApp, experimental unofficial), platform super admin/
  billing, Phase 2.3 traceability, docs Source of Truth, or agent operations
  inside this repo.
---

# orbis

## Overview

Orbis Commerce (working name, not signed off) is a **multi-tenant commerce SaaS**: one tenant runs many brands
and outlets, sells through POS (online and **offline cash, P0**), a white-label storefront and its own couriers,
and tracks stock, expenses and COD through immutable movements. Optional AI/CRM and channel integrations come
after the stable core. Everything in this repo is **Draft for Review** — documentation, not implementation.
Use this skill to keep product, architecture, security and docs decisions aligned with `internal/docs/**`.

## Required Reading

Read only the docs the task needs:

- Source of Truth index: `internal/docs/README.md`
- Open decisions (read before any implementation): `internal/docs/requirements/rd-11-open-decisions.md` + `internal/docs/handoff/PHASE_2_3_BLOCKER_AND_DECISION_REGISTER.csv`
- One-page entrypoints: `internal/docs/entrypoints/{blueprint,brd,prd,frd,rd}.md`
- Product: `internal/docs/product/{blueprint,scope-principles,onboarding,objective-brief}.md`
- Requirements: `internal/docs/requirements/{prd,frd}.md` · domains `rd-01` … `rd-10` · EARS `acceptance-criteria-ears-standard.md`
- Architecture: `internal/docs/architecture/{stack,data-model,api-contract,nfr}.md`
- ADR: one line each in `internal/docs/README.md`, narrative in `internal/docs/adr/README.md` (0001–0010, all `proposed`)
- Security: `internal/docs/security/{security-standard,threat-model}.md` · dated audits
- UI: `internal/docs/design-system/design-system.md` · `internal/docs/frontend/frontend-implementation.md`
- Operations: `internal/docs/operations/{implementation-standard,agent-documentation-workflow,roadmap,runbook,scaffold-docs}.md`
- Baseline (read-only): `internal/docs/references/MASTER_PRD_SaaS_POS_MultiTenant_Delivery_AI_v1.4.5.md` · `internal/docs/handoff/**`
- Agent contract: `AGENTS.md` · `CLAUDE.md` (repo root)

## Sub-Skills

- `orbis-devops` (`internal/skills/orbis-devops/SKILL.md`) — deploy and operate the future Orbis stack: Docker/Nginx/Ubuntu pilot, PostgreSQL RLS roles and migrations, Redis/BullMQ worker, private object storage, backup/restore drills, offline POS and financial incident runbooks.

## Product Rules

- **Scope hierarchy:** Platform → Tenant → Brand → Outlet. One tenant = one SaaS customer; couriers serve outlets within **the same tenant** only.
- **P0 MVP slices:** S0 identity/RBAC/RLS/entitlements → S0A–C offline POS device/queue/sync → S1 catalog/stock → S2 POS pricing/promo/loyalty/refunds → S3 storefront/orders → S4 delivery/POD/COD → S5 finance → S7 platform → S8 QA gates. S6 AI/channels is MVP+ opt-in. Slices are not a timeline or authorization (`operations/roadmap.md`).
- **Offline POS P0** (ADR-0003, reverses PRD OD-09): only registered devices, cash-only tender, bounded TTL, receipt marked `PENDING_SYNC`, IndexedDB outbox that survives refresh/restart, idempotent replay, visible conflict inbox. Never show pending sync as paid. Gateway payments and global quotas need online validation.
- **AI assists, never mutates:** no direct SQL, refunds, cancellations, price or stock changes; read-only tools P0; draft orders P1 with explicit confirmation (OD-15). Stop auto-replies after human handoff.
- **Unofficial WhatsApp:** experimental, default OFF, explicit opt-in after Legal/Security/Product sign-off (OD-22). No blast, no anti-detection, no evasion.
- **Courier:** PWA foreground location only with consent; no background GPS promise (OD-08, ADR-0010).
- **Storefront:** public reads only the published version; builder preview is draft-only (ADR-0006).
- **Copy:** concise Indonesian; state chips never rely on color alone.

## Architecture Rules

- **Modular monolith** (ADR-0001): `apps/web` (Next.js: landing, tenant admin, POS PWA, storefront, courier), `apps/api` (Fastify), `apps/worker` (outbox/webhook/sync/AI), `packages/{contracts,ui,config}`, `infra/`. No microservices/Kafka/K8s at MVP.
- Stack proposal (not approved): TypeScript, Next.js + Tailwind/shadcn, Fastify + JSON Schema/TypeBox, Better Auth, PostgreSQL + Drizzle/SQL migrations, Redis + BullMQ, S3-compatible private storage, Service Worker + IndexedDB.
- **API** (ADR-0009): `/v1/*` proposal until OpenAPI is signed; platform plane `/v1/platform/*` separate. Retryable mutations take `Idempotency-Key`; versioned resources take `If-Match`. Status: 401/403/404 privacy-safe/409/422/429/503. Never return 200 for pending offline or gateway confirmation.
- Audit and outbox are written **in the same DB transaction** as the mutation.
- Provider adapters isolate payment, WhatsApp (official/unofficial), LLM; inbox/CRM/AI are transport-agnostic (ADR-0007).

## Security Rules

- `tenant_id` comes from the authenticated server-side session/membership, **never** from client input.
- Authorization in the service layer **and** PostgreSQL RLS (`USING` + `WITH CHECK`) on every tenant row; app DB role cannot bypass RLS; tenant context set per transaction (never on a pooled connection globally); background jobs carry explicit tenant context (ADR-0002).
- Platform staff: MFA, least privilege, JIT support grants with purpose/scope/expiry and an approver distinct from the requester (ADR-0008).
- Webhooks: signature verification, event dedupe, monotonic transitions, amount match. Secrets in a secret store, never in logs, client or repo.
- Private buckets; POD/attachments via signed URLs only after tenant + action authorization.
- Threat list and release tests: `internal/docs/security/threat-model.md`.

## Data & Schema Rules

- Money is **integer IDR**; server timestamps with explicit timezone (WIB/WITA/WIT per outlet).
- Stock, payment, refund, points and COD are **immutable, idempotent movements**; balances derive from movements/reservations, one movement per source event (ADR-0004).
- Checkout snapshots SKU, price, cost, discount allocation, tax and service charge; refunds use cumulative per-line allocation (ADR-0005).
- Business child FKs guarantee the same tenant (composite references preferred).
- `Idempotency-Key` scope = tenant + action + source + client event ID.
- No schema change without migration + rollback + ADR when architectural. Browser demo/localStorage data is never migrated as production truth.

## Documentation & Flow Rules

- `internal/docs/**` is the Source of Truth; update it in the same commit; every doc linked from `internal/docs/README.md`. Format: `internal/docs/operations/scaffold-docs.md`.
- Traceability chain per change: `Screen → FR → API → Data → Permission → Acceptance → Slice` (`handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv`). Keep baseline FR IDs; no new numbering without a crosswalk.
- Changed domain rule ⇒ EARS criteria + FR mapping + negative tests + migration/API review (+ ADR for architecture).
- Unresolved conflict ⇒ record in `rd-11-open-decisions.md`; never silently pick an incompatible contract.
- **Evidence protocol** (AGENTS.md): handoff lists modified paths, FR/route mappings, exact test commands and results (`PASSED/FAILED/NOT_RUN`), unsatisfied gates, docs updated and decision requests. Route smoke ≠ E2E; mockup ≠ test pass.
- Definition of done: touched tests green · touched docs updated and linked · `python3 scripts/validate_docs.py` passes · evidence recorded.
