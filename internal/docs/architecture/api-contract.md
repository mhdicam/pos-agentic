# API Contract — Draft Proposal
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## API conventions
- Candidate namespace: `/v1/*`; final routes must be signed and reconciled with historical `/v1/tenants/{id}` variants.
- Authenticated tenant resolved from membership, not arbitrary client `tenant_id`; Platform Admin plane `/v1/platform/*` remains distinct.
- Mutation headers: `Idempotency-Key` where retryable and `If-Match` where versioned. Response includes immutable resource ID, state/version and correlation ID.
- Standard status: 401, 403, 404 privacy-safe, 409 stale/conflict, 422 validation, 429 quota, 503 unavailable. Never return 200 fake success on pending offline/gateway confirmation.

## Proposed endpoint family examples (not OpenAPI)
| Domain | Example actions | Critical guards |
|---|---|---|
| Identity | `POST /v1/auth/login`, `GET /v1/me` | session, MFA, tenant switch |
| Catalog | `GET /v1/catalog/items`, `POST /v1/catalog/variants` | outlet scope, SKU unique |
| Inventory | `POST /v1/inventory/receipts`, `POST /v1/inventory/adjustments` | version, source key, audit |
| Offline POS | `POST /v1/pos/devices/provision`, `POST /v1/pos/sync-batches` | device grant, TTL, batch idempotency |
| Checkout | `POST /v1/orders`, `POST /v1/payments` | server pricing, cash/gateway verification |
| Refunds | `POST /v1/refunds` | permission, cumulative line allocation |
| Storefront | `GET /v1/storefront/public`, `POST /v1/storefront/publish` | host binding, publish auth |
| Delivery | `POST /v1/deliveries/{id}/assign`, `POST /v1/deliveries/{id}/complete` | assignment version/POD/COD |
| Finance | `POST /v1/expenses`, `POST /v1/cod-remittances/{id}/verify` | approval and immutable journal |
| Platform | `GET /v1/platform/tenants`, `POST /v1/platform/approvals` | platform privilege/MFA |
| AI/Channels | `POST /v1/channels/connect`, `POST /v1/inbox/handoff` | provider/tenant/budget/handoff |

## Contract freeze gate
Turn proposal into OpenAPI with request/response/error schema, auth scopes, sequence/Idempotency guarantees, examples and contract tests. Reconcile names with the Phase 2.3 CSV, then generate client contracts. Do not implement parallel incompatible path aliases without an ADR.
