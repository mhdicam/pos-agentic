# Tenancy, Identity & Permissions — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Baseline FR: FR-01, FR-03, FR-13, FR-18; Phase 2.3 B-001/B-003/B-022. Primary crosswalk: [`handoff traceability`](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv).

## Canonical product requirements / proposed technical contract
**Model:** Platform → Tenant → Brand → Outlet → Staff/Customer/Device. `tenant_id` immutable for every business row. Active tenant comes from authenticated membership, not request body. Storefront host is verified brand/domain resolution.

**Rules:** RLS `USING` and `WITH CHECK`, composite tenant FK, no bypass DB role, explicit scope in cache/queue/object-store. Separate Platform Admin privilege boundary; support JIT grants require MFA/independent approval.

## Acceptance Criteria (EARS)
- **RD01-01** (Ubiquitous): The system shall derive the active `tenant_id` from the authenticated membership and never from the request body, query or header supplied by the client. Tests: `P23-X01`, `P23-X03`, `P23-ROLE-017`
- **RD01-02** (Ubiquitous): The system shall store an immutable `tenant_id` on every business row and enforce it with RLS `USING` and `WITH CHECK` policies plus composite tenant foreign keys. Tests: `P23-X01`
- **RD01-03** (Ubiquitous): The system shall run application and worker code under a database role that has no RLS bypass. Tests: `P23-X01`
- **RD01-04** (Ubiquitous): The system shall scope every cache key, queue job and object-store path by tenant. Tests: `P23-X01`, `P23-X02`
- **RD01-05** (Event): When a user of tenant A requests an object ID that belongs to tenant B, the API and the database shall deny the request without disclosing whether the object exists. Tests: `P23-X01`, `P23-ROLE-017`, `P23-ROLE-032`
- **RD01-06** (Event): When a member loses an outlet grant, the system shall fail that member's next action on that outlet, including actions from an already-open browser tab or an already-queued job. Tests: `P23-UX-team`, `P23-X02`, `P23-ROLE-019`
- **RD01-07** (Event): When a tenant export or background job runs, the system shall restrict it to the tenant context of the initiating authenticated scope. Tests: `P23-X01`, `P23-X42`
- **RD01-08** (Event): When a platform admin raises a suspension or re-activation request, the system shall apply it only after an independent checker approves. Tests: `P23-ROLE-001`, `P23-X40`, `P23-UX-n22-tenants`, `P23-UX-n22-tenant-detail`
- **RD01-09** (State): While a Platform Support just-in-time grant is active, the system shall limit access to the granted tenant and scope and shall record reason, scope and expiry in the audit log. Tests: `P23-ROLE-002`, `P23-ROLE-015`, `P23-ROLE-016`, `P23-UX-n22-tickets`
- **RD01-10** (Optional): Where support access is requested, the system shall require MFA and independent approval before the grant becomes active. Tests: `P23-X40`, `P23-UX-n22-security`, `P23-UX-n22-tickets`
- **RD01-11** (Unwanted): If the storefront host does not resolve to a verified brand or domain, then the system shall return no tenant data. Tests: NONE (gap)
- **RD01-12** (Unwanted): If the support grant requester and approver are the same identity, then the system shall reject the approval. Tests: `P23-X40`, `P23-ROLE-013`

## Primary workflow
Create tenant, invite member, switch tenant, assign outlet role, suspend/re-activate by maker/checker, deny cross-tenant export and background processing.

## API, state and data handoff
- All proposed endpoints and schemas must be finalized via `architecture/api-contract.md`, `architecture/data-model.md`, and an ADR where architectural boundaries change.
- Include `tenant_id`, `outlet_id`/`brand_id` as relevant, actor identity, version/expected state, idempotency and immutable audit/correlation IDs.
- Unit, integration, negative and UI tests must be linked to actual `P23-*` IDs before development ticket is accepted.

## Open review gates
Full business E2E, server authorization, concurrent writes, migration/recovery and production integrations are not covered by the current browser-local prototype. Consult `rd-11-open-decisions.md` and `qa/2026-11-03-mvp-acceptance-spec.md`.
