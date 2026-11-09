# ADR — index & decision history
Status: draft (for review, not signed off)
Date: 2026-11-10

Sub-index of [internal/docs/README.md](../README.md). The main index keeps **one line per ADR**; this file keeps
the **narrative** — what each decision extends, amends or supersedes. Every new ADR is linked in **both**.

> Numbers are unique and immutable (4 digits, from `0001`). Obsolete ADRs are never deleted — their status is
> changed here and in their own header. All ADRs below are `proposed` until Engineering Lead and the relevant
> Product/Security/Finance reviewers sign off (AGENTS.md).

Format of each file `NNNN-<slug>.md`:

```
# ADR-NNNN Title
Status: proposed | accepted | superseded by ADR-NNNN
Date: YYYY-MM-DD
## Context
## Decision
## Rationale
## Consequences
## Sources
```

## Decisions
- [0001 — Modular monolith and typed contracts](0001-modular-monolith.md) — one deployable API + worker with domain modules, typed schemas and transactional outbox; no microservices at MVP.
- [0002 — Tenant isolation with RLS defense-in-depth](0002-tenant-rls.md) — app authorization **and** PostgreSQL RLS; tenant from server-side session; workers carry explicit tenant context.
- [0003 — Offline POS as mandatory MVP P0](0003-offline-pos-p0.md) — reverses PRD OD-09 ("post-MVP"); cash-only offline under device grant/TTL, IndexedDB outbox, idempotent sync.
- [0004 — Variant/outlet inventory ledger authority](0004-sku-inventory-ledger.md) — balances derive from movements/reservations; one movement per source event.
- [0005 — Immutable checkout pricing and financial movements](0005-financial-pricing-snapshot.md) — order snapshots of price/cost/discount/tax; refunds use cumulative per-line allocation.
- [0006 — Storefront draft/publish boundary](0006-storefront-draft-publish.md) — public reads only the published version; preview is draft-only.
- [0007 — Provider adapters and AI tool controls](0007-channel-ai-adapters.md) — transport-agnostic inbox; AI read-only tools, no SQL, secrets server-side; unofficial WA experimental.
- [0008 — Privileged platform plane and maker/checker](0008-privileged-platform-approvals.md) — MFA, JIT support grants, approver distinct from requester.
- [0009 — Versioned API and replay-safe mutation](0009-api-versioning-idempotency.md) — `/v1`, `Idempotency-Key`, `If-Match`, privacy-safe errors.
- [0010 — Foreground courier location and COD separation](0010-courier-location-cod.md) — consented foreground location only; COD collected/remitted/verified as distinct states.
