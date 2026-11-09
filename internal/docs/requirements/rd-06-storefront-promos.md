# Storefront Builder, Branding & Promotions — Domain Requirements (RD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Source and traceability
Baseline FR: FR-02, FR-07, storefront builder/Phase 2.2H, promo/Phase 2.2F. Primary crosswalk: [`handoff traceability`](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv).

## Canonical product requirements / proposed technical contract
**Brand scope:** tenant brand and outlet profiles; logo/hero, banners, sections, social links, WA/share toggle, ratings/sold count visibility, trust indicators (address, hours, estimated delivery, checkout). Draft/preview and published storefront versions MUST be distinct.

**Promotion engine:** voucher, fixed/% discount, quotas, date windows, channel limits, SKU/customer eligibility. Evaluate server-side in transaction, reserve/redeem atomically, allocate line discount for refunds. Time-dependent promotions cannot be trusted offline unless a signed approved policy explicitly allows it.

## Acceptance Criteria (EARS)
- **RD06-01** (Ubiquitous): The system shall keep a draft or preview storefront version distinct from the published version. Tests: `P23-ROLE-004`, `P23-ROLE-020`, `P23-UX-storefront`
- **RD06-02** (Ubiquitous): The system shall evaluate promotions on the server inside a transaction. Tests: `P23-UX-promotions`
- **RD06-03** (Event): When a tenant previews unpublished changes, the public storefront shall remain unchanged. Tests: `P23-ROLE-020`, `P23-UX-storefront`
- **RD06-04** (Event): When a tenant publishes, the system shall switch the public storefront to the new version atomically. Tests: `P23-ROLE-004`
- **RD06-05** (Event): When a promotion is redeemed, the system shall reserve and redeem its quota atomically and allocate the line discount for later refunds. Tests: `P23-X12`, `P23-X16`, `P23-UX-promotions`
- **RD06-06** (Event): When promotion quota runs out during concurrent checkouts, the system shall redeem at most the remaining valid slots and return an actionable state to the others. Tests: `P23-X16`
- **RD06-07** (Optional): Where a signed approved policy explicitly allows it, the POS shall apply time-dependent promotions offline. Tests: NONE (gap)
- **RD06-08** (Unwanted): If a voucher is outside its date window, channel limit or SKU/customer eligibility, then the system shall reject it. Tests: `P23-ROLE-036`, `P23-UX-promotions`
- **RD06-09** (Unwanted): If no signed policy allows it, then the POS shall not trust time-dependent promotions offline. Tests: NONE (gap)

## Primary workflow
Upload asset → configure/publish builder → customer SKU selection → eligible coupon apply → checkout → discount attribution/usage report.

## API, state and data handoff
- All proposed endpoints and schemas must be finalized via `architecture/api-contract.md`, `architecture/data-model.md`, and an ADR where architectural boundaries change.
- Include `tenant_id`, `outlet_id`/`brand_id` as relevant, actor identity, version/expected state, idempotency and immutable audit/correlation IDs.
- Unit, integration, negative and UI tests must be linked to actual `P23-*` IDs before development ticket is accepted.

## Open review gates
Full business E2E, server authorization, concurrent writes, migration/recovery and production integrations are not covered by the current browser-local prototype. Consult `rd-11-open-decisions.md` and `qa/2026-11-03-mvp-acceptance-spec.md`.
