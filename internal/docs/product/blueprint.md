# Product Blueprint — Orbis Commerce
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Product promise
Operate sales, inventory, marketing, customer service, deliveries, finance and platform controls from one tenant-scoped commerce environment.

## Product architecture of capabilities
- **Identity/platform:** tenant/subscription/entitlement, brand, outlet, role, device.
- **Commerce:** catalog/variant/price, inventory/PO/receiving, POS/offline, storefront, order.
- **Growth:** promotions, membership/loyalty, CRM and tenant branding.
- **Operations:** dispatch, courier, POD, COD, expenses, finance/reports.
- **Extensions:** integrations hub, official messaging and optional AI; multi-service vertical modules later.

## Journeys
- J1: platform onboarding → owner config → storefront publish → employee invitation.
- J2: cashier register → opening cash → scanner/cart → promo/loyalty pricing → cash/split tender → receipt → shift close.
- J3: device offline → queue → reconnect → idempotent sync → conflict resolve.
- J4: customer storefront → SKU/cart → order → dispatcher assign → courier pickup/POD → COD remit → finance verify.
- J5: tenant AI answers permitted product queries, escalates to CS and observes consent, budget and role restrictions.

## Core invariants
Tenant/brand/outlet ownership immutable; payments and stock cannot be reconstructed from mutable current product values; refunds/COD are distinct financial lifecycles; offline status is explicit; no success state without confirmed server authority where required.
