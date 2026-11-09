# ADR-0004 Variant/Outlet Inventory Ledger Authority
Status: proposed (draft for review, not signed off)
Date: 2026-11-03

## Context
Orbis Commerce combines multi-tenant SaaS, offline-first cash POS and stateful order/delivery/financial workflows. The prototype documents behavior but does not prove production implementation.

## Decision
All stock updates through reservation, receipt, sale, restock/quarantine or adjustment movements; canonical authority per tenant/outlet/SKU.

## Rationale
Do not rely solely on UI role guards, browser localStorage for production, unverified live integrations, blind status updates, or loose eventual reconciliation of financial effects. More complex alternatives may be revisited with measured evidence.

## Consequences
Schema/API/service ownership and acceptance tests must be signed before code. Record migrations and recovery paths; update relevant `requirements/rd-*.md`, traceability IDs, security tests and operations runbook.

## Sources
- Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
- [Open decisions](../requirements/rd-11-open-decisions.md)
- Review state: Engineering Lead + appropriate Product/Security/Finance stakeholders: **PENDING**. This ADR is a proposal, not an accepted architectural decision.
