# Functional Requirements (FRD)
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Functional workflow inventory
| ID | Actor | Preconditions | Action | Success evidence | Failure path |
|---|---|---|---|---|---|
| FLOW-01 | Platform | Identity + MFA | Provision tenant/outlet/entitlement | tenant and audit record | invalid owner/duplicate/revoked |
| FLOW-02 | Cashier | device authorization, opening cash | Offline cash checkout | local receipt+pending outbox | stale/revoked, overstock, restart |
| FLOW-03 | Sync worker | authenticated device, queue | Ingest transaction | exactly-one server order/movements | duplicate/conflict/partial failure |
| FLOW-04 | Owner/Manager | authorized SKU + PO | Receive inventory | one stock movement | overreceipt/duplicate |
| FLOW-05 | Cashier | valid price/promo/member | Checkout, split payment | snapshot and allocation ledger | tender mismatch/expired promo |
| FLOW-06 | Owner/Finance | paid order, authorized refund | Return/refund | per-line cumulative reversal | double refund/no cash |
| FLOW-07 | Customer | published storefront | Place order | customer-scoped order/token | stock/price change |
| FLOW-08 | Dispatcher/Courier | eligible delivery | Assign→POD→COD | status + COD ledger | reject/timeout/failed |
| FLOW-09 | Finance | remittance available | Verify COD and cash | reconciliation outcome | mismatch/dispute |
| FLOW-10 | CS/AI Manager | approved channel | Inbox, AI reply, handoff | ownership + budget audit | consent/limit/unauthorized |
| FLOW-11 | Platform Support | ticket + approval | Time-bound support grant | scoped access audit | self-approval/expiry |

## Orchestration
Use server-side state machine guards and transactions. UI widgets in prototype are UX references only. Every FLOW must map to RD, `P23-*` tests, API/data, permission and development slice before development starts.

## Acceptance Criteria (EARS)
- **FRD-01** (Ubiquitous): The system shall enforce every FLOW state transition with server-side state-machine guards inside a transaction. Tests: `P23-X25`, `P23-X47`
- **FRD-02** (Event, FLOW-01): When a platform admin with MFA provisions a tenant, outlet and entitlement, the system shall create the tenant and an audit record. Tests: `P23-ROLE-001`, `P23-UX-n22-tenants`
- **FRD-03** (Event, FLOW-02): When a cashier with device authorization and opening cash completes an offline cash checkout, the device shall store a local receipt and a pending outbox entry. Tests: `P23-X04`, `P23-X06`
- **FRD-04** (Event, FLOW-03): When an authenticated device syncs a queued transaction, the server shall create exactly one order and its movements. Tests: `P23-X05`
- **FRD-05** (Event, FLOW-04): When an authorized manager receives inventory against a PO, the system shall record one stock movement. Tests: `P23-ROLE-005`, `P23-X20`, `P23-UX-tenant-operations`
- **FRD-06** (Event, FLOW-05): When a cashier checks out with split payment, the system shall write a pricing snapshot and an allocation ledger. Tests: `P23-X11`, `P23-UX-pos`
- **FRD-07** (Event, FLOW-06): When an authorized refund is requested for a paid order, the system shall record a per-line cumulative reversal. Tests: `P23-X12`
- **FRD-08** (Event, FLOW-07): When a customer places an order on a published storefront, the system shall create a customer-scoped order and token. Tests: `P23-ROLE-012`, `P23-X23`, `P23-UX-public-checkout`
- **FRD-09** (Event, FLOW-08): When a dispatcher assigns an eligible delivery, the assigned courier shall be the only actor able to progress it through POD and COD. Tests: `P23-ROLE-007`, `P23-ROLE-008`, `P23-X25`, `P23-X26`
- **FRD-10** (Event, FLOW-09): When Finance verifies an available remittance, the system shall record the reconciliation outcome. Tests: `P23-ROLE-033`, `P23-X28`
- **FRD-11** (Event, FLOW-10): When CS or an AI manager hands off an approved-channel conversation, the system shall record ownership and budget audit. Tests: `P23-ROLE-010`, `P23-X32`
- **FRD-12** (Event, FLOW-11): When a time-bound support grant is approved on a ticket, the system shall grant scoped access and audit it. Tests: `P23-ROLE-002`, `P23-UX-n22-tickets`
- **FRD-13** (Unwanted, FLOW-01): If the owner is invalid, duplicate or revoked, then the system shall reject provisioning. Tests: NONE (gap)
- **FRD-14** (Unwanted, FLOW-02): If device authorization is stale or revoked, or stock is exceeded, then the device shall block the sale or flag it for conflict resolution. Tests: `P23-ROLE-024`, `P23-X07`, `P23-X08`
- **FRD-15** (Unwanted, FLOW-03): If a sync event is duplicate, conflicting or partially failed, then the server shall not create duplicate effects and shall surface the conflict. Tests: `P23-X05`, `P23-X08`
- **FRD-16** (Unwanted, FLOW-04): If receipt quantity exceeds order quantity or the receipt is duplicate, then the system shall reject it. Tests: `P23-ROLE-022`, `P23-UX-tenant-operations`
- **FRD-17** (Unwanted, FLOW-05): If tender does not match the total or a promotion is expired, then the system shall reject checkout. Tests: `P23-ROLE-036`, `P23-X11`
- **FRD-18** (Unwanted, FLOW-06): If a refund would be a double refund or no cash is available, then the system shall reject it. Tests: `P23-X12`
- **FRD-19** (Unwanted, FLOW-07): If stock or price changed since the cart was built, then the system shall block checkout and show the change. Tests: `P23-X23`, `P23-UX-public-checkout`
- **FRD-20** (Unwanted, FLOW-08): If a courier rejects, a timeout occurs or delivery fails, then the system shall record the exception and reassign, retry or return. Tests: `P23-X25`, `P23-X27`
- **FRD-21** (Unwanted, FLOW-09): If remitted cash mismatches collected COD, then the system shall open a dispute and shall not mark it verified. Tests: `P23-ROLE-033`, `P23-X28`
- **FRD-22** (Unwanted, FLOW-10): If consent is missing, a limit is reached or the actor is unauthorized, then the system shall block the AI reply. Tests: `P23-ROLE-029`, `P23-X32`, `P23-X34`
- **FRD-23** (Unwanted, FLOW-11): If the approver is the requester or the grant has expired, then the system shall deny access. Tests: `P23-ROLE-016`, `P23-X40`
- **FRD-24** (Unwanted): If a sensitive path ends in pending, failed or conflict, then the UI shall show that state with a recovery action and the system shall write an immutable audit entry. Tests: `P23-X47`

## Negative UX rule
Do not merely toast success: show pending/failed/conflict state, actionable recovery and immutable audit for each sensitive path.
