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
| S9 | Tenant review gaps ([RD-17](../requirements/rd-17-tenant-review-gaps.md)) in waves W1 trust (G2, G9) → W2 recipes (G1, [ADR-0011](../adr/0011-recipe-ingredient-stock.md)) → W3 owner value (G3–G5) → W4 restaurant (G7, G6) → W5 local/polish (G8, G10–G12) | per-wave EARS frozen + tests mapped; D-RD17-* decided |

S9 is a recommendation from [review mining](../research/2026-11-11-tenant-gap-analysis.md); each wave needs Product Owner selection. S1 and S0A can proceed in parallel after S0 contract; S7 after S0; S6 optional after stable core S3. Slice definitions are not a timeline or implementation authorization.

## Ticket contract
`ticket; slice; screen; FR; permission; schema; API; state transition; idempotency; audit; happy+negative tests; mobile test; migration; reviewer; evidence`.
