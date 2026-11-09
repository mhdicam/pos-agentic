# Scaffold docs — document format standard and skills
Status: operating standard (draft for review, not signed off)
Date: 2026-11-10

Format contract for every file in `internal/docs/**` and `internal/skills/**`. Adopted from the reference
workspace convention (`internal-referensi/docs/operations/scaffold-docs.md` §5). If this doc and a file
disagree, fix the file — or change this doc in the same commit with a reason.

## 1. Principles
- Repo root holds only agent config (`AGENTS.md`, `CLAUDE.md`, `.claude/`) and implementation folders; **all** documents live in `internal/docs/`.
- `internal/docs/README.md` = index + Source of Truth registry; every doc is registered there, one line, numbered order.
- Detailed docs are canonical; `entrypoints/` are short pointers only. On conflict, fix the detail doc first.
- Behavior changes are written first as **EARS** acceptance criteria ([standard](../requirements/acceptance-criteria-ears-standard.md)).
- Touched docs are updated in the same commit as the code (or the commit says "no docs update needed").

## 2. Folder structure of `internal/docs/`
| Folder | Contents |
|---|---|
| `entrypoints/` | `blueprint.md`, `brd.md`, `prd.md`, `frd.md`, `rd.md` — short, point to detail docs |
| `product/` | `blueprint.md`, `scope-principles.md`, `onboarding.md`, plus brainstorm / project brief / MVP objective |
| `business/` | `brd.md` (model, market, KPI) and `pricing-rationale.md` |
| `requirements/` | `prd.md`, `frd.md`, `rd-NN-<domain>.md`, `acceptance-criteria-ears-standard.md` |
| `research/` | `market.md`, `competitor-analysis.md`, `market-sizing.md`; audits `audit-<id>-<slug>.md` |
| `brand/` | `README.md` brand book (positioning, color, voice) |
| `architecture/` | `stack.md`, `data-model.md`, `api-contract.md`, `nfr.md` |
| `adr/` | `README.md` narrative sub-index + `NNNN-<slug>.md` (4 digits, from `0001`) |
| `design-system/`, `frontend/` | `design-system.md`, `frontend-implementation.md` |
| `operations/` | `runbook.md`, `roadmap.md`, `implementation-standard.md`, `agent-documentation-workflow.md`, this file |
| `security/` | `security-standard.md`, `threat-model.md`, dated audits `YYYY-MM-DD-<slug>.md` |
| `qa/` | `YYYY-MM-DD-<slug>-spec.md`; finished → `qa/done/` |
| `references/`, `handoff/` | Orbis-specific: preserved baseline PRD, prototype, Phase 2.3 CSV/JSON evidence — **read-only**, original names kept |

## 3. Doc header
Plain header, **not** YAML frontmatter:

```
# Title
Status: <draft | proposed | accepted | operating standard | ...>
Date: YYYY-MM-DD
```

Orbis docs may add `Baseline: ...` as the fourth line. Files under `references/` and `handoff/` keep their original header.

## 4. ADR format (`internal/docs/adr/NNNN-<slug>.md`)
```
# ADR-NNNN Title
Status: proposed
Date: YYYY-MM-DD
## Context
## Decision
## Rationale
## Consequences
## Sources
```
Orbis ADRs stay `proposed` until sign-off (AGENTS.md); link each new ADR in both `README.md` and `adr/README.md`.

## 5. EARS — five measurable patterns
Ubiquitous · Event-driven · State-driven · Optional · Unwanted. See [EARS standard](../requirements/acceptance-criteria-ears-standard.md).

## 6. `internal/docs/README.md` (required)
Four sections: **Reading Order** (`N. [title](path) - description`), **Canonical Files**, **Naming Standard**
(domain glossary), **Source Discipline**. Orbis adds **Review Gates**.

## 7. `internal/skills/<name>/` (required)
```
internal/skills/<name>/
  SKILL.md            # YAML frontmatter: name, description (">-" folded, "Use when ...")
  agents/openai.yaml  # interface: display_name, short_description, default_prompt
```
`SKILL.md` sections in order: `# <name>`, `## Overview`, `## Required Reading`, `## Sub-Skills`,
`## Product Rules`, `## Architecture Rules`, `## Security Rules`, `## Data & Schema Rules`,
`## Documentation & Flow Rules`. Sub-skills (e.g. `orbis-devops`) use `## Overview`, `## Required Reading`,
`## Principles`, task sections, `## Do Not`. Skills summarize docs — they never contradict them; on conflict the doc wins.

## 8. `CLAUDE.md` + `AGENTS.md` at repo root (both)
Minimum: *Start here* (AGENTS.md → README index → relevant doc), *Documentation-First Rule*, update docs in the
same commit (or "no docs update needed"), and *Definition of Done*.

## 9. Stop hook
`.claude/settings.json` registers a `Stop` hook to `.claude/hooks/ensure-docs-updated.py` (`chmod +x`), which blocks
when implementation files are staged without changes in `internal/docs/`, `AGENTS.md` or `CLAUDE.md`.
`IMPLEMENTATION_PREFIXES` = `apps/`, `packages/`, `infra/` (from [stack](../architecture/stack.md)).

## 10. Validation
`python3 scripts/validate_docs.py` checks required files, headers, ADR sections, skill layout and relative links.

## 11. Reusable skill
`internal/skills/scaffold-internal-docs/` packages this standard for any project: `SKILL.md` (layout + format contract + steps),
`templates.md` (exact file templates), `scripts/validate_internal.py` (project-agnostic acceptance test, `--no-ui`, `--preserved`)
and `scripts/ensure-docs-updated.py` (Stop hook). Run `python3 -I internal/skills/scaffold-internal-docs/scripts/validate_internal.py .`.
