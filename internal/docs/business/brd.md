# Business Requirements (BRD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Market and customers
Initial segment: Indonesian UMKM retail/F&B and multi-outlet businesses needing cash POS continuity, branded web storefront and internal courier. Expansion to service verticals follows module capability readiness.

## Business objectives
- Merchant retention from stable sales/inventory/finance rather than AI novelty alone.
- Monetize via tenant subscription, outlet/register/user entitlements and optional AI/channel add-ons.
- Control platform cost through quotas and separate AI token usage from provider messaging charges.
- Avoid imposing high operational cost of premature microservices.

## Commercial rules requiring approval
Subscription lifecycle, trials, grace period, suspension impact on offline registers and pending orders, plan limits, proration, refund policy and credit packages. No price points or revenue forecasts are approved by this document.

## Business KPI definitions (proposed)
MRR, ARR, paid tenants, activation, churn, ARPU, weekly checkout success, offline reconciliation failure rate, delivery completion, COD discrepancy, refund rate, AI handoff success. Each KPI needs named event source and denominator before it is presented as production truth.

## Constraints
Payment gateways, messaging platforms and marketplaces require provider access; unofficial WhatsApp linked-device is a high-risk experimental pathway only. Merchant/consumer privacy, audit and compliance require review.
