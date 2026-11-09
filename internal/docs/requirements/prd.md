# Product Requirements (PRD) — Canonical Entry
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
## Product release priorities
**P0 MVP (core):** S0 Identity+RLS+entitlements, S0A–C Offline POS/Device/Sync, S1 catalog/SKU/stock/procurement, S2 POS shift/pricing/promo/loyalty, S3 storefront/orders, S4 delivery/POD/COD, S5 finance/expenses/reports, S7 platform administration and S8 QA gates.

**MVP+ (after stable core, opt-in):** S6 official channel integrations/AI Inbox/CRM/knowledge/credits where provider access and quality gates allow. **Experimental:** unofficial linked-device WA (legal/security reviewed pilot). **P1+:** service verticals, native courier background location, route optimization, large-scale marketplaces.

## Requirements source control
The preserved full detailed baseline is [`MASTER_PRD_SaaS_POS_MultiTenant_Delivery_AI_v1.4.5.md`](../references/MASTER_PRD_SaaS_POS_MultiTenant_Delivery_AI_v1.4.5.md). It retains historical amendments and **DRAFT FOR REVIEW** status.

For operational review, canonical domain details live in `rd-01` through `rd-10`; FR identifiers must remain from the baseline and [traceability CSV](../handoff/PHASE_2_3_SCREEN_FR_API_DATA_PERMISSION_TRACEABILITY.csv). Do not invent a new FR numbering system without crosswalk.

## Release acceptance
A route that renders is not a delivered feature. Gate requires negative role E2E, API/database isolation, offline device durability/sync, financial reconciliation, provider sandbox and security/ops evidence. 109 acceptance cases remain designed/not fully executed.

## Acceptance Criteria (EARS)
- **PRD-01** (Ubiquitous): The system shall deliver P0 MVP scope S0, S0A-C, S1, S2, S3, S4, S5, S7 and S8 before any MVP+ scope is released. Tests: NONE (gap)
- **PRD-02** (Ubiquitous): The system shall keep FR identifiers from the baseline PRD and map each one in the traceability CSV. Tests: NONE (gap)
- **PRD-03** (Event): When a product decision changes, the owner shall update the RD, screen matrix and tests and obtain owner sign-off before implementation. Tests: NONE (gap)
- **PRD-04** (Event): When an engineering decision changes, the author shall add an ADR and complete API and data review before implementation. Tests: NONE (gap)
- **PRD-05** (Optional): Where a provider grants official channel access and quality gates pass, the system shall enable S6 channel integrations, AI Inbox, CRM, knowledge and credits as MVP+. Tests: `P23-X35`
- **PRD-06** (Optional): Where Legal and Security approve a pilot, the system shall offer unofficial linked-device WhatsApp as experimental and opt-in only. Tests: `P23-X36`
- **PRD-07** (Unwanted): If a route renders but negative role E2E, API and database isolation, offline durability and sync, financial reconciliation, provider sandbox or security and operations evidence is missing, then the release gate shall not count the feature as delivered. Tests: `P23-X45`, `P23-UX-n22-acceptance`
- **PRD-08** (Unwanted): If a new FR numbering scheme is introduced without a crosswalk to baseline FR IDs, then the review shall reject it. Tests: NONE (gap)

## Change policy
Product decision changes require updated RD, screen matrix, tests and owner sign-off. Engineering decision changes require an ADR and API/data review before implementation.
