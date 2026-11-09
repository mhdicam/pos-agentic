# Orbis Commerce - Internal Docs Registry
Status: draft (for review, not signed off)
Date: 2026-11-09

`internal/docs/` is the canonical documentation home for the future Orbis Commerce codebase. All docs are documentation only and are not evidence of code implementation. Domain RDs are derived summaries; the full PRD and Phase 2.3 evidence are retained unchanged under `references/` and `handoff/`.

## Reading Order
1. [Brainstorm foundation](brainstorm.md) - intent, product boundaries, anti-goals, accepted vs pending directions
2. [Project brief](project-brief.md) - problem, users, value proposition, MVP/non-MVP boundary
3. [MVP objective](objective-brief.md) - primary objective, foundation release gates, evidence rule
4. [Blueprint entrypoint](entrypoints/blueprint.md) - 1-page pointer to product blueprint
5. [Product blueprint](product/blueprint.md) - product promise, capabilities, journeys, core invariants
6. [Tenant onboarding](product/onboarding.md) - tenant and device onboarding sequence, empty state, recovery
7. [BRD entrypoint](entrypoints/brd.md) - 1-page pointer to business requirements
8. [Business requirements](business/brd.md) - market, objectives, commercial rules, KPI definitions
9. [PRD entrypoint](entrypoints/prd.md) - 1-page pointer to product requirements
10. [Product requirements](requirements/prd.md) - MVP priorities, baseline and release gates
11. [FRD entrypoint](entrypoints/frd.md) - 1-page pointer to functional workflows
12. [Functional workflows](requirements/frd.md) - journeys, state transitions, negative flows
13. [RD entrypoint](entrypoints/rd.md) - 1-page pointer to domain requirements
14. [RD-01 Tenancy, identity & permissions](requirements/rd-01-tenancy-identity.md) - tenant scope, roles, ABAC, RLS requirements
15. [RD-02 Catalog & inventory](requirements/rd-02-catalog-inventory.md) - product, SKU, procurement, inventory ledger
16. [RD-03 POS, registers & offline sync](requirements/rd-03-pos-offline-sync.md) - registers, shifts, offline cash outbox, reconciliation
17. [RD-04 Orders, payments & refunds](requirements/rd-04-orders-payments-refunds.md) - pricing snapshot, payment, returns, loyalty
18. [RD-05 Delivery & COD](requirements/rd-05-delivery-cod.md) - dispatch, courier, POD, COD settlement
19. [RD-06 Storefront & promos](requirements/rd-06-storefront-promos.md) - storefront builder, branding, promotions
20. [RD-07 AI, CRM & integrations](requirements/rd-07-ai-crm-integrations.md) - AI commerce, inbox, provider adapters
21. [RD-08 Platform & billing](requirements/rd-08-platform-billing.md) - super admin, subscription billing, fleet
22. [RD-09 Finance & analytics](requirements/rd-09-finance-analytics.md) - expenses, ledgers, reporting
23. [RD-10 UX acceptance](requirements/rd-10-ux-acceptance.md) - responsive UX, states, acceptance
24. [RD-11 Open decisions](requirements/rd-11-open-decisions.md) - unresolved decisions requiring Product Owner input
25. [Market research](research/market.md) - market context
26. [Competitor research](research/competitors.md) - competitor landscape
27. [Sizing research](research/sizing.md) - market sizing
28. [Brand strategy](brand/strategy.md) - positioning, design intent, voice
29. [Architecture stack](architecture/stack.md) - proposed stack and module boundaries
30. [Data model](architecture/data-model.md) - hierarchy, entities, integrity contracts
31. [API contract](architecture/api-contract.md) - API conventions and endpoint families
32. [Non-functional requirements](architecture/nfr.md) - measurable targets and evidence gates
33. [Frontend implementation](frontend/implementation.md) - app surfaces and UX implementation rules
34. [Design system](design-system/spec.md) - components, states, accessibility, tokens
35. [ADR-0001 Modular monolith](adr/0001-modular-monolith.md) - modular monolith with typed contracts
36. [ADR-0002 Tenant RLS](adr/0002-tenant-rls.md) - tenant isolation with RLS defense-in-depth
37. [ADR-0003 Offline POS P0](adr/0003-offline-pos-p0.md) - offline POS as mandatory MVP P0
38. [ADR-0004 Inventory ledger](adr/0004-sku-inventory-ledger.md) - variant/outlet inventory ledger authority
39. [ADR-0005 Pricing snapshot](adr/0005-financial-pricing-snapshot.md) - immutable checkout pricing and financial movements
40. [ADR-0006 Storefront publish](adr/0006-storefront-draft-publish.md) - storefront draft/publish version boundary
41. [ADR-0007 Channel & AI adapters](adr/0007-channel-ai-adapters.md) - provider adapters and AI tool controls
42. [ADR-0008 Platform approvals](adr/0008-privileged-platform-approvals.md) - privileged plane and maker/checker
43. [ADR-0009 API versioning](adr/0009-api-versioning-idempotency.md) - versioned API and replay-safe mutation
44. [ADR-0010 Courier location & COD](adr/0010-courier-location-cod.md) - foreground courier location and COD separation
45. [Security standard](security/standard.md) - security requirements
46. [Security baseline audit 2026-11-03](security/2026-11-03-baseline-audit.md) - dated baseline audit
47. [Implementation standard](operations/implementation-standard.md) - coding, testing, handoff rules
48. [Agent documentation workflow](operations/agent-documentation-workflow.md) - doc update order for agents
49. [Roadmap](operations/roadmap.md) - slice sequencing and ticket contract
50. [Runbook](operations/runbook.md) - deployment, incidents, backup, provider outage
51. [MVP acceptance spec 2026-11-03](qa/2026-11-03-mvp-acceptance-spec.md) - P0 suites and test record template
52. [E2E & security checklist 2026-11-03](qa/2026-11-03-e2e-security-checklist.md) - checklist by area
53. [Phase 2.3 evidence index](qa/phase-2-3-evidence.md) - verifiable historical evidence, what it does not prove
54. [Source PRD v1.4.5](references/MASTER_PRD_SaaS_POS_MultiTenant_Delivery_AI_v1.4.5.md) - full baseline PRD, retained unchanged
55. [Phase 2.2N super admin QA report](references/PHASE_2_2N_SUPERADMIN_UX_QA_REPORT.md) - scoped UX QA report, platform super admin
56. [Phase 2.2O dispatcher/courier QA report](references/PHASE_2_2O_DISPATCHER_COURIER_QA_REPORT.md) - scoped UX QA report, delivery operations
57. [Phase 2.2O prototype](references/posverse_phase_2_2o_delivery_operations.html) - single-file UI prototype, not production code
58. [Phase 2.3 handoff](handoff/PHASE_2_3_ENGINEERING_HANDOFF_DRAFT.md) - UX acceptance and engineering handoff
59. [Phase 2.3 regression & sign-off report](handoff/PHASE_2_3_REGRESSION_AND_SIGNOFF_REPORT.md) - route smoke evidence and pending gates
60. [Screen traceability](handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv) - Screen to FR to API to Data to Permission to Acceptance to Slice
61. [Acceptance case inventory](handoff/PHASE_2_3_UX_ACCEPTANCE_CASES.csv) - 109 UX acceptance cases
62. [12-role journeys](handoff/PHASE_2_3_12_ROLE_E2E_JOURNEYS.csv) - 36 cross-role E2E scenarios
63. [Blocker register](handoff/PHASE_2_3_BLOCKER_AND_DECISION_REGISTER.csv) - blockers and decisions
64. [Route regression evidence](handoff/PHASE_2_3_ROUTE_REGRESSION_EVIDENCE.json) - route smoke result data
65. [Compatibility index](INDEX.md) - pointer-only index, not canonical
66. [EARS to test traceability](handoff/EARS_TEST_TRACEABILITY.csv) - EARS criterion to P23 test ID map, gaps marked NO_TEST_DEFINED

## Canonical Files
- Product direction: `product/blueprint.md`, `objective-brief.md`, latest Product Owner requirements (offline POS is mandatory MVP P0).
- Business: `business/brd.md`.
- Requirements: `requirements/prd.md`, `requirements/frd.md`, `requirements/rd-NN-<domain>.md`; unresolved items live only in `requirements/rd-11-open-decisions.md`.
- Architecture: `architecture/stack.md`, `architecture/data-model.md`, `architecture/api-contract.md`, `architecture/nfr.md`; decisions in `adr/`.
- Security: `security/standard.md`; audits are dated `security/YYYY-MM-DD-<slug>.md`.
- QA: dated specs in `qa/YYYY-MM-DD-<slug>.md`; spec and evidence are never conflated.
- Traceability: `handoff/EARS_TEST_TRACEABILITY.csv` (EARS to test IDs), `handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv`.
- Baseline sources (read-only): `references/`, `handoff/`.
- `entrypoints/*.md` and `INDEX.md` are navigation only, never canonical.

## Naming Standard
- **Tenant**: customer organization; `tenant_id` is derived from authenticated server-side scope.
- **Platform -> Tenant -> Brand -> Outlet**: scope hierarchy.
- **Offline POS P0**: registered cashier device queueing cash-only transactions in an IndexedDB outbox, status `PENDING_SYNC`.
- **FR / RD / ADR**: functional requirement ID / domain requirement document / architecture decision record.
- **P23-TM / P23-***: Phase 2.3 traceability row and test ID prefixes.
- **Slice**: engineering delivery unit in `operations/roadmap.md`.
- **COD**: cash on delivery, tracked separately from courier location (ADR-0010).
- **Maker/checker**: two-person approval for privileged platform actions (ADR-0008).
- **Money**: integer IDR; stock, payment, refund, points and COD movements are immutable and idempotent.

## Source Discipline
- Fix the detailed doc first, then sync the entrypoint, then the registry above, in the same change.
- Behavior change: write EARS acceptance criteria first; changed domain rules need FR mapping, negative tests and migration/API review.
- Architecture decision: new ADR `adr/NNNN-<slug>.md` (4 digits).
- If an RD conflicts with preserved source, record it in `requirements/rd-11-open-decisions.md`; never silently pick an incompatible contract.
- Never mark a test passed from a mockup; evidence must be real execution output.
- Every new doc must be linked from this registry.

## Review Gates
UX acceptance 109 cases; 12-role E2E 36 scenarios; security, financial and offline release tests; sign-off by Product, UX, Engineering, Security, QA and Finance/Ops. Not completed by generating these files.
