# Expenses, Financial Ledgers & Reporting — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Baseline FR: FR-12, FR-TXI, FR-L22; expense and reporting expansions. Primary crosswalk: [`handoff traceability`](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv).

## Canonical product requirements / proposed technical contract
**Data:** expense draft/submitted/approved/paid, attachment metadata, payment and cash movements, stock/cost snapshots, COD remittance, refund and loyalty ledger, operational reports with source timestamp and tenant/outlet restrictions.

**Control:** no unapproved self-approval; distinguish purchase inventory capitalization from operating expense; immutable posted movement and adjustment/reversal; separate financial totals from estimated margin until ledger fully reconciled.

## Acceptance Criteria (EARS)
- **RD09-01** (Ubiquitous): The system shall treat posted financial movements as immutable and correct them only with adjustment or reversal entries. Tests: `P23-ROLE-034`, `P23-X14`, `P23-UX-transaction-integrity`
- **RD09-02** (Ubiquitous): The system shall distinguish purchase inventory capitalization from operating expense. Tests: `P23-X20`
- **RD09-03** (Ubiquitous): The system shall label margin as estimated until the ledger is fully reconciled. Tests: `P23-UX-reports-deep`
- **RD09-04** (Event): When the report date or channel filter changes, the system shall make every KPI and detail row reflect the same immutable event set. Tests: `P23-X21`, `P23-UX-o22-reports`, `P23-UX-reports-deep`
- **RD09-05** (Event): When an expense is approved and paid, the system shall write the corresponding financial ledger entry. Tests: `P23-ROLE-011`, `P23-UX-expenses`
- **RD09-06** (Event): When a cashier closes a shift, the system shall reconcile cash against recorded movements. Tests: `P23-ROLE-006`, `P23-X13`
- **RD09-07** (State): While COD is only collected, the system shall not treat it as Finance verified. Tests: `P23-X28`, `P23-UX-o22-cod`
- **RD09-08** (Unwanted): If the approver is the expense creator and self-approval is prohibited, then the system shall reject the approval. Tests: `P23-ROLE-021`, `P23-X19`, `P23-UX-expenses`
- **RD09-09** (Unwanted): If a report user lacks the tenant or outlet scope, then the system shall exclude that data from the report. Tests: `P23-X02`, `P23-X42`, `P23-UX-reports`

## Primary workflow
Expense submit → approval matrix → pay → financial ledger; purchase receiving → inventory accrual; cashier close → cash reconciliation; report filter → drilldown → export.

## API, state and data handoff
- All proposed endpoints and schemas must be finalized via `architecture/api-contract.md`, `architecture/data-model.md`, and an ADR where architectural boundaries change.
- Include `tenant_id`, `outlet_id`/`brand_id` as relevant, actor identity, version/expected state, idempotency and immutable audit/correlation IDs.
- Unit, integration, negative and UI tests must be linked to actual `P23-*` IDs before development ticket is accepted.

## Open review gates
Full business E2E, server authorization, concurrent writes, migration/recovery and production integrations are not covered by the current browser-local prototype. Consult `rd-11-open-decisions.md` and `qa/2026-11-03-mvp-acceptance-spec.md`.
