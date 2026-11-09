# Brainstorm Foundation — Orbis Commerce
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Core intent
A light, secure, extensible, multi-tenant commerce SaaS for Indonesian merchants. Integrate merchant operations in one system while allowing each tenant to brand its own stores, run multiple outlets, and add service capabilities without forking the codebase.

## Product boundaries
**Core MVP P0:** identity/RBAC/RLS, merchant setup, catalog/variants/inventory/purchasing, cashier/register/shift, offline-first cash POS with device provisioning and sync, storefront/ordering, delivery dispatch/courier/COD, expenses, membership/promotions, operational reporting, subscriptions/entitlements, platform monitoring and security. Scope must be reconciled against Phase 2.3 release gates.

**MVP+ after core:** official WhatsApp AI customer support, CRM/knowledge/channel adapters, subject to provider readiness. **Experimental:** unofficial linked-device WhatsApp only under explicit opt-in and legal/security gates. **Later:** laundry/booking verticals, route optimization, native background courier tracking.

## Anti-goals
No initial microservices or global courier marketplace; no direct database access from AI; no hidden cross-tenant support access; no pseudo-offline mode that merely caches the screen; no unverified production claims based on localStorage demo.

## Accepted product directions vs pending technical contracts
- Product direction: **Offline POS P0**, white-label multi-brand, per-tenant AI, multi-channel integration hub, internal courier.
- Pending: offline permission TTL, cash/promo/refund allocation, canonical OpenAPI/schema ownership, DR targets, finance policy, full role UX acceptance.

## Success hypotheses (not measured)
- Cashier can complete a transaction while connectivity drops and recover without duplicates.
- Owner can reconcile physical stock, expenses, sales and cash shifts using traceable snapshots.
- Dispatcher and Courier can complete delivery and COD through auditable workflow.
- Different tenant data cannot be accessed across API, DB RLS, cache, worker, export, and AI.
