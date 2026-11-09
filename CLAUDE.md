# CLAUDE.md — Orbis Commerce

## Start here
1. Read `AGENTS.md` (operating rules, security non-negotiables, evidence protocol).
2. Read `internal/docs/README.md` (Source of Truth index) and `internal/docs/requirements/rd-11-open-decisions.md`.
3. Load the project skill `internal/skills/orbis/SKILL.md` (deploy/ops work: `internal/skills/orbis-devops/SKILL.md`).
4. Read only the detail docs relevant to the task.

## Documentation-First Rule
- `internal/docs/**` is the Source of Truth. Behavior changes start as EARS criteria (`internal/docs/requirements/acceptance-criteria-ears-standard.md`).
- Doc format, folder layout, ADR and skill structure: `internal/docs/operations/scaffold-docs.md`.
- Every doc is linked from `internal/docs/README.md`; every ADR also from `internal/docs/adr/README.md`.
- All docs are **Draft for Review** — a doc is not authorization to implement.

## Same-commit docs
Update touched docs in the same commit as the code, or state "no docs update needed" in the commit message.
The `Stop` hook `.claude/hooks/ensure-docs-updated.py` blocks staged implementation changes without docs changes.

## Definition of Done
- Touched tests run with exact results recorded (`PASSED/FAILED/NOT_RUN`); no pass claimed from a mockup.
- Touched docs updated and linked; traceability `Screen → FR → API → Data → Permission → Acceptance → Slice` kept.
- `python3 scripts/validate_docs.py` passes.
- Handoff lists modified paths, FR/route mappings, unsatisfied gates and decision requests.
