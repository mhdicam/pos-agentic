# MVP Objective — Orbis Commerce
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Primary objective
A merchant with at least one registered offline POS device can open a register, make a cash sale during internet loss, print/issue a receipt clearly marked **PENDING_SYNC**, reconnect and reconcile exactly one server-side transaction without leaking tenant data or duplicating stock/cash/loyalty effects. Online operations must support orders, fulfillment/COD and auditable finance.

## Foundation release gates
1. A tenant is provisioned with RBAC, module entitlement and DB-enforced isolation; cross-tenant probes are denied.
2. A cashier device is authorized for a bounded offline window, and its cash-only shift/cart survive refresh/restart.
3. Local queue replay with duplicate payloads mutates inventory/payment/cash exactly once; conflicts are visible and recoverable.
4. SKU variant and outlet stock balances derive from movements/reservations, not silently overwritten totals.
5. Checkout snapshots include SKU, price, cost, discount allocations, tax and service settings; refund uses cumulative per-line allocation, audit and authorized tender reversal.
6. Customer storefront publication is separate from drafts; delivery status and courier actions enforce assignment ownership, POD privacy and COD separation.
7. Finance can reconcile expense approvals, shift expected cash and remittances with immutable events.
8. Super Admin support access uses MFA, purpose, separate approval and expiry; platform billing/entitlement state is enforced at API.
9. 12-role positive and negative journeys and mobile/accessibility suites are executed with evidence, not only navigation smoke.

## Evidence rule
These are **targets**, not claims of tested production behavior. See `handoff/PHASE_2_3_REGRESSION_AND_SIGNOFF_REPORT.md`.
