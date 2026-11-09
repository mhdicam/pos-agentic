# AI Commerce, CRM, Inbox & Provider Integrations — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Baseline FR: FR-14, FR-15, FR-16, FR-17, FR-19; MVP+ with official provider. Primary crosswalk: [`handoff traceability`](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv).

## Canonical product requirements / proposed technical contract
**Shared inbox:** official WhatsApp/BSP as approved production path; email, social messaging, shipping, payments and marketplace adapters as candidate modules subject to provider access. Unofficial linked-device WA is **opt-in experimental pilot**, no guaranteed continuity, independent legal/security review.

**AI:** tenant+brand-scoped knowledge, memory consent, contact CRM, budgets and credit ledger. AI tools call authorized read-only domain APIs; risky mutation requires policy and human approval; takeover must stop AI auto-replies. Provider credentials encrypted with managed secret access and never returned to browser.

## Acceptance Criteria (EARS)
- **RD07-01** (Ubiquitous): The system shall scope knowledge, memory and CRM data by tenant and brand. Tests: `P23-ROLE-032`, `P23-UX-crm`, `P23-UX-knowledge`
- **RD07-02** (Ubiquitous): The system shall encrypt provider credentials with managed secret access and never return them to the browser. Tests: `P23-ROLE-014`, `P23-X37`, `P23-UX-integrations`
- **RD07-03** (Ubiquitous): The system shall let AI tools call only authorized read-only domain APIs. Tests: `P23-ROLE-030`, `P23-X33`, `P23-UX-ai-settings`
- **RD07-04** (Event): When CS performs human takeover, the system shall stop AI auto-replies before acknowledging the ownership transition. Tests: `P23-ROLE-010`, `P23-ROLE-031`, `P23-X32`, `P23-UX-inbox`
- **RD07-05** (Event): When an AI action would mutate data, the system shall require policy approval and human approval before execution. Tests: `P23-X33`, `P23-UX-ai-settings`
- **RD07-06** (Event): When AI credits reach the hard limit, the system shall block provider invocation and log the block. Tests: `P23-ROLE-029`, `P23-X34`, `P23-UX-ai-settings`
- **RD07-07** (Optional): Where unofficial linked-device WhatsApp is enabled, the system shall require explicit opt-in and Legal/Security approval, and shall not add anti-detection or evasion behavior. Tests: `P23-X36`, `P23-UX-channels`, `P23-UX-n22-providers`
- **RD07-08** (Optional): Where a channel is official WhatsApp/BSP, the system shall use it as the approved production path. Tests: `P23-X35`, `P23-UX-channels`
- **RD07-09** (Unwanted): If a caller asks for another tenant's order using only a phone number, then the system shall not disclose private order details. Tests: NONE (gap)
- **RD07-10** (Unwanted): If AI requests direct SQL, refund or stock change, then the system shall refuse and route to an authorized domain API with approval. Tests: `P23-ROLE-030`, `P23-X33`, `P23-UX-ai-settings`

## Primary workflow
Connect channel → verify ownership → ingest message → AI answer based on KB/product → escalate → CS respond → close/follow-up → privacy retention.

## API, state and data handoff
- All proposed endpoints and schemas must be finalized via `architecture/api-contract.md`, `architecture/data-model.md`, and an ADR where architectural boundaries change.
- Include `tenant_id`, `outlet_id`/`brand_id` as relevant, actor identity, version/expected state, idempotency and immutable audit/correlation IDs.
- Unit, integration, negative and UI tests must be linked to actual `P23-*` IDs before development ticket is accepted.

## Open review gates
Full business E2E, server authorization, concurrent writes, migration/recovery and production integrations are not covered by the current browser-local prototype. Consult `rd-11-open-decisions.md` and `qa/2026-11-03-mvp-acceptance-spec.md`.
