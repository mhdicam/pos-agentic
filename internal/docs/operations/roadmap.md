# Roadmap & Engineering Slices
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Sequencing (Phase 2.3 proposal)
| Slice | Delivery | Exit gate |
|---|---|---|
| S0 | Identity, RBAC/ABAC, tenant RLS, entitlement, audit | cross-tenant API/DB tests |
| S0A | POS PWA/install, device provision + revocation policy | install and TTL tests |
| S0B | Offline cash shift/cart/receipt in IndexedDB | restart/crash tests |
| S0C | Sync queue, idempotent ingest and conflict inbox | replay/ordering tests |
| S1 | SKU/catalog/stock movements/PO/receiving | stock invariant tests |
| S2 | POS pricing/shift/promo/loyalty and refunds | golden checkout/reversal tests |
| S3 | Storefront, brand publish, guest checkout | scoping and publication tests |
| S4 | Dispatcher/Courier/POD/COD | assignment/state/COD tests |
| S5 | Expense, ledger, reconciliation and analytics | finance ledger matches reports |
| S6 | Official integrations, AI/CRM MVP+ | provider sandbox, privacy and budget |
| S7 | SaaS billing, support, fleet and governance | MFA/JIT/entitlement/restore |
| S8 | Complete QA, accessibility, load and sign-off | all P0 release gates closed |

S1 and S0A can proceed in parallel after S0 contract; S7 after S0; S6 optional after stable core S3. Slice definitions are not a timeline or implementation authorization.

## Ticket contract
`ticket; slice; screen; FR; permission; schema; API; state transition; idempotency; audit; happy+negative tests; mobile test; migration; reviewer; evidence`.
