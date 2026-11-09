# Mapping from Uploaded `internal.zip` to Orbis Scaffold

**Reference archive inspected:** 66 entries, containing `internal/docs` and 51 Markdown files (project Personal Cash Flow). We reused the **documentation conventions and folder taxonomy**, not the cash-flow business logic.

| Uploaded reference | Orbis counterpart |
|---|---|
| `internal/docs/README.md`, `INDEX.md` | same paths, regenerated source-of-truth registry |
| `internal/docs/entrypoints/{blueprint,brd,prd,frd,rd}.md` | same paths, oriented to Orbis |
| `internal/docs/requirements/rd-01..rd-09` | `rd-01..rd-11` redesigned by commerce domain |
| `internal/docs/architecture/{stack,data-model,api-contract,nfr}.md` | same paths with SaaS/POS-specific contracts |
| `internal/docs/adr/0001..0009` | `0001..0010` proposed ADRs; unapproved until review |
| `internal/docs/security`, `qa`, `operations` | same topic areas with Orbis risks/tests |
| Local product implementation notes | Orbis blueprint/onboarding/frontend/design system and preserved Phase 2.3 source handoff |

## Added to preserve current Orbis decisions
- `internal/docs/references`: full PRD v1.4.5, latest 2.2O prototype, scoped QA reports.
- `internal/docs/handoff`: original Phase 2.3 handoff, screen matrix, 109 acceptance case registry, 36 E2E role journey cases, 26 blockers, route smoke JSON.
- `scripts/validate_docs.py`: link/manifest sanity check.

## Intentionally not copied
Reference project-specific ledger, investment, local-only browser finance and Laravel backend decisions were **not** transferred as facts about Orbis. Orbis uses a separately proposed Next.js/Fastify/PostgreSQL architecture and offline-first POS P0.
