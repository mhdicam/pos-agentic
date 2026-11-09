# Platform Super Admin, Billing & Fleet — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Baseline FR: FR-01, FR-13, FR-PLT (Phase 2.2N). Primary crosswalk: [`handoff traceability`](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv).

## Canonical product requirements / proposed technical contract
**Platform control plane:** tenant 360, lifecycle approvals, plan catalog, invoices/subscription, entitlements/quotas, provider status, device fleet, background job health, support tickets, incident tracking, backups.

**Security:** high-privilege MFA; sensitive changes have maker/checker; per-tenant support grant requires reason/scope/expiry. Platform roles do not get unrestricted PII/content read by default. Revocation has online and bounded offline device semantics.

## Acceptance Criteria (EARS)
- **RD08-01** (Ubiquitous): The system shall require MFA for high-privilege platform roles. Tests: `P23-ROLE-001`, `P23-UX-n22-security`
- **RD08-02** (Ubiquitous): The system shall deny platform roles unrestricted PII or content read by default. Tests: `P23-ROLE-002`, `P23-ROLE-015`
- **RD08-03** (Event): When an admin creates a suspension request, the tenant shall stay active until an independent reviewer approves. Tests: `P23-ROLE-001`, `P23-ROLE-013`, `P23-X40`
- **RD08-04** (Event): When an invoice is settled, the system shall update subscription and entitlement state. Tests: `P23-X38`, `P23-UX-n22-billing`
- **RD08-05** (Event): When revocation is issued, the system shall apply it online immediately and to offline devices within the bounded policy defined in `rd-11-open-decisions.md`. Tests: `P23-X07`, `P23-UX-n22-fleet`
- **RD08-06** (State): While a tenant is in grace or suspended state, the system shall apply the approved plan lifecycle restrictions. Tests: `P23-UX-subscription`
- **RD08-07** (Optional): Where a support grant is requested, the system shall require reason, scope and expiry. Tests: `P23-ROLE-002`, `P23-ROLE-016`
- **RD08-08** (Unwanted): If a plan excludes a module, then the API shall deny direct requests to it even when client navigation shows an old link. Tests: `P23-ROLE-018`, `P23-X39`, `P23-UX-n22-entitlements`
- **RD08-09** (Unwanted): If a maker and checker are the same identity, then the system shall reject the approval. Tests: `P23-ROLE-013`, `P23-X40`

## Primary workflow
Plan/entitlement edit → invoice issue/settle → tenant state → monitor fleet sync conflicts → support access approval → audit/recovery.

## API, state and data handoff
- All proposed endpoints and schemas must be finalized via `architecture/api-contract.md`, `architecture/data-model.md`, and an ADR where architectural boundaries change.
- Include `tenant_id`, `outlet_id`/`brand_id` as relevant, actor identity, version/expected state, idempotency and immutable audit/correlation IDs.
- Unit, integration, negative and UI tests must be linked to actual `P23-*` IDs before development ticket is accepted.

## Open review gates
Full business E2E, server authorization, concurrent writes, migration/recovery and production integrations are not covered by the current browser-local prototype. Consult `rd-11-open-decisions.md` and `qa/2026-11-03-mvp-acceptance-spec.md`.
