# Tenant & Device Onboarding
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## New tenant sequence
1. Create tenant as draft with owner identity, locale and subscription trial/entitlements.
2. Verify membership and establish brand/outlet identity, address, coordinates, operating hours, pickup/delivery rules.
3. Publish branded storefront config as a distinct version; preview is a draft-only UI.
4. Invite staff with role/outlet grants, MFA policy and action approvals.
5. Configure SKU, price, taxes/service charge, stock opening balance and supplier.
6. Provision POS register/device with revocable offline capability, TTL, catalog snapshot and sync limits.
7. Configure courier assignment and COD if enabled; test checkout, delivery and cash shift.
8. Optionally connect approved providers, messages, AI persona/knowledge, budgets and human handoff.

## Empty state
New tenants start with no real transaction/customer/invoice data. Fixtures and sample values must be demo-only and visibly labeled.

## Failure/recovery
Invalid domain verification, failed import, device loss, stale catalog, duplicate invite, sync conflict and revoked grant must not create partial tenant data. Provide retries, rollback/compensation and audit.
