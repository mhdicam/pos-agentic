# Decision Register & Blocking Issues
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Authority
Canonical source is [`Phase 2.3 blocker register`](../handoff/PHASE_2_3_BLOCKER_AND_DECISION_REGISTER.csv) with **26 OPEN** items. This file is an ownership/routing summary and must not silently change the CSV status.

## Mandatory decisions before engineering contract freeze
- **Offline POS P0:** explicit Product Owner direction; engineering policy still needs signed TTL/encryption/device-sync/revocation and cash-only offline payment contract.
- **Finance:** expected cash, refund line allocation and rounding, COGS/stock capitalization, loyalty reversal, COD verified vs paid, immutable after-close adjustments.
- **API/data:** canonical namespace/OpenAPI, tenant context, DDL/migrations, RLS policy testing, idempotency format and optimistic concurrency.
- **UX:** 12-role E2E, auth/guest checkout, accessible mobile/CDN-rendered validation, store publication behavior.
- **Providers/privacy:** official API credentials, unofficial pilot legal decision, consent/retention, private POD and device GPS permissions.

## Review table
| Decision | Current direction | Sign-off required |
|---|---|---|
| Offline POS | P0 mandatory; PWA/IndexedDB/outbox, cash-only offline tender | Product, Security, Backend, Finance |
| Stack | Next.js + Fastify + PostgreSQL/Drizzle + Redis/BullMQ recommended | Engineering/SRE |
| Inventory | One SKU/outlet authority | Engineering/Finance |
| AI | Tool guard, consent, hard budget; official channels first | Product/Security/Provider |
| WA unofficial | Experimental opt-in, conditional pilot only | Legal, Security, Product |
| Delivery | Internal courier, foreground location/POD/COD states | Operations, Privacy, Finance |
| Billing | Plan/entitlement/grace/suspension lifecycle | Product/Finance/Platform |

## Close process
For each source B-xxx: assign owner, record final decision or fix, link ADR/FR/API/ERD changes, attach reproducible evidence, update sign-off reviewer and only then change status to CLOSED. Reject 'passed' inferred from mock data.

## Acceptance Criteria (EARS)
- **RD11-01** (Ubiquitous): The system shall keep the Phase 2.3 blocker register CSV as the canonical source of decision status. Tests: NONE (gap)
- **RD11-02** (Event): When a blocker is closed, the owner shall record the final decision or fix, link the ADR, FR, API or ERD change, attach reproducible evidence and update the sign-off reviewer before status changes to CLOSED. Tests: NONE (gap)
- **RD11-03** (Unwanted): If evidence is inferred from mock data, then the blocker shall not be marked passed or closed. Tests: `P23-X41`, `P23-UX-n22-acceptance`
- **RD11-04** (Unwanted): If an RD conflicts with preserved source, then the author shall record the conflict here and shall not silently choose an incompatible contract. Tests: NONE (gap)
