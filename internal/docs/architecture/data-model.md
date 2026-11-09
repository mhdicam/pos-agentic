# Data Model & Integrity Contracts
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Hierarchy
Platform → Tenant → Brand → Outlet. Staff can belong to several tenants/outlets, but permissions are derived from session membership. Customers can have tenant-scoped identities. Every transaction row has immutable tenant ownership.

## Key entities (proposed, review before migration)
| Domain | Entities | Core invariant |
|---|---|---|
| Identity | users, sessions, tenants, memberships, grants, roles | tenant isolation and MFA |
| Platform | plans, entitlements, subscriptions, invoices, audit, support_grants | admin maker/checker |
| Brands | brands, domains, themes, outlets, hours | draft/published versions distinct |
| Products | catalog_items, item_variants, prices, categories, modifiers | tenant/outlet SKU uniqueness |
| Stock | stock_balances, movements, reservations, POs, receipts | one movement per source event |
| POS | registers, shifts, cash_movements, offline_devices, sync_outbox | one open shift/register, local replay safety |
| Commerce | orders, order_items, price_allocations, payments, refunds | immutable snapshots and idempotency |
| Growth | promos, redemptions, members, points_ledger | no negative double-redeem |
| Delivery | jobs, assignments, POD, COD collections/remittances | active assignment version & distinct COD states |
| Operations | expenses, approvals, journal_events, report_views | immutable posted ledger |
| AI/Channels | connections, messages, KB, memory consent, usage_ledger | scoped brand/tenant, secret isolation |

## Data integrity
- All business-owned child FKs must guarantee same tenant, preferably composite references.
- DB app role cannot bypass RLS; set tenant context within a transaction, never pooled connection global.
- Use integer IDR, server timestamps and explicit timezone; check conservation across refund/stock/points/COD.
- `Idempotency-Key` scope includes tenant, action, source and unique client event ID.
- Audit/outbox within same DB transaction as mutation, not a best-effort asynchronous afterthought.

## Deliverables still pending
Canonical ERD, SQL DDL, index migration ordering, data retention/partition, PII classification, backfill and rollback. Browser demo data cannot be silently migrated as production truth.
