# AI Coding Agent Documentation Workflow
Status: draft (for review, not signed off)
Date: 2026-11-03
Baseline: Orbis Commerce PRD v1.4.5 + Phase 2.3 handoff
1. Read `internal/docs/README.md`, objective, blueprint, business, PRD/FRD, domain RD, ADR, architecture and QA.
2. Match task to actual Phase 2.3 `P23-TM` screen row, original FR and `P23-*` test ID.
3. Check `rd-11-open-decisions` and block implementation on unresolved high-risk policy decisions.
4. Propose change, review DB/API/security/UX ramifications, then implement only when slice authorized.
5. Generate tests for source-of-truth invariants and negative cases; save reproducible evidence.
6. Update details first, link registry and ADR, then hand off status with explicit `PASSED/FAILED/NOT_RUN`.

Never treat an AI-generated docs draft as approval, a route smoke as full E2E, or prototype localStorage data as server financial ledger.
