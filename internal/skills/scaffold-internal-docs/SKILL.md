---
name: scaffold-internal-docs
description: >-
  Use when creating, scaffolding, restructuring or auditing a project's
  internal/ documentation folder (internal/docs Source of Truth, BRD/PRD/FRD/RD,
  ADRs, EARS acceptance criteria, security/ops docs) and its coding-agent skills
  (internal/skills/<name>/SKILL.md, agents/openai.yaml), or when root AGENTS.md /
  CLAUDE.md / .claude Stop hook for docs-first work must be set up.
---

# scaffold-internal-docs

## Overview

Builds the `internal/` tree in the reference format (`internal-referensi`): every document in `internal/docs/`,
agent skills in `internal/skills/`, agent config at the repo root. The output is fixed by the layout below and
checked by `scripts/validate_internal.py` — a scaffold is done only when that script prints `PASS`.

## Required Reading

- [templates.md](templates.md) — exact text of every header, ADR, README index, skill, `openai.yaml`, `CLAUDE.md`, settings.
- `scripts/validate_internal.py` — the acceptance test. `scripts/ensure-docs-updated.py` — the Stop hook to copy.
- Project sources the user gives (PRD, brief, prototype, CSV evidence). Read them before writing.

## Output layout (create exactly these paths)

```
AGENTS.md                         # rules + Start here + Documentation-first + Definition of Done
CLAUDE.md                         # same four sections, standalone (not only "@AGENTS.md")
.claude/settings.json             # Stop hook -> ensure-docs-updated.py
.claude/hooks/ensure-docs-updated.py   # chmod +x; IMPLEMENTATION_PREFIXES = project code folders
scripts/validate_docs.py          # REQUIRED copy of validate_internal.py (Definition of Done runs it)
internal/docs/
  README.md                       # index: Reading Order, Canonical Files, Naming Standard, Source Discipline
  entrypoints/  blueprint.md brd.md prd.md frd.md rd.md        # short pointers to detail docs
  product/      blueprint.md scope-principles.md onboarding.md # + brainstorm/brief/objective if any
  business/     brd.md pricing-rationale.md
  requirements/ prd.md frd.md rd-NN-<domain>.md acceptance-criteria-ears-standard.md
  research/     market.md competitor-analysis.md market-sizing.md   # audits: audit-<id>-<slug>.md
  brand/        README.md
  architecture/ stack.md data-model.md api-contract.md nfr.md
  adr/          README.md NNNN-<slug>.md                       # 4 digits from 0001
  design-system/design-system.md  frontend/frontend-implementation.md   # only if the project has UI
  operations/   runbook.md roadmap.md implementation-standard.md agent-documentation-workflow.md scaffold-docs.md
  security/     security-standard.md threat-model.md YYYY-MM-DD-<slug>.md
  qa/           YYYY-MM-DD-<slug>-spec.md   # optional folder; suffix -spec is mandatory; finished -> qa/done/
  references/ handoff/            # optional: preserved source files, original names and headers
internal/skills/<project>/SKILL.md + agents/openai.yaml
internal/skills/<project>-devops/SKILL.md + agents/openai.yaml   # only if the user supplied deploy/ops info or operations/runbook.md has real content
```

## Format contract

| Item | Shape |
|---|---|
| Doc header | Line 1 `# Title`, line 2 `Status: draft` (or `proposed`, `accepted`, `operating standard` for standards), line 3 `Date: YYYY-MM-DD`. Plain text, no YAML frontmatter. Optional line 4 `Baseline: ...` |
| ADR | `# ADR-NNNN Title` + header, then `## Context`, `## Decision`, `## Rationale`, `## Consequences`, `## Sources` in that order. Linked from `internal/docs/README.md` **and** `adr/README.md` |
| Acceptance criteria | EARS, one per line: `- **PRD-01** (Event): When <trigger>, the system shall <response>. Tests: <id> \| NONE (gap)` |
| README Reading Order | `N. [Title](path) - description`, numbered 1..N. **Every** `.md` under `internal/docs/` (except README.md itself) appears exactly once; the validator fails otherwise |
| Skill | YAML `name` = folder name, `description: >-` starting "Use when"; body `# <name>`, `## Overview`, `## Required Reading`, then rules sections (templates.md) |
| `openai.yaml` | `interface:` with `display_name`, `short_description`, `default_prompt` |
| Content | Specific to the project idea; unknowns go to an open-decisions doc as questions, never invented facts or numbers |

## Steps

1. Read sources; list domains (for `rd-NN-<domain>.md`), decisions (ADRs), open questions.
2. Create the layout above using [templates.md](templates.md); fill each file with project-specific content.
3. Write `internal/docs/README.md` last, registering every doc; write `adr/README.md` with one line per ADR.
4. Write skills; every `internal/**/*.md` path a skill names must exist.
5. Root config: `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, hook (`chmod +x`), validator copy.
6. Run `python3 -I <skill-dir>/scripts/validate_internal.py <repo-root>` (add `--no-ui` for no UI). Fix every error, rerun until `PASS`. Report the exact output.

## Restructuring an existing internal/

Use `git mv` to the names above (e.g. `design-system/spec.md` -> `design-system/design-system.md`,
`security/standard.md` -> `security/security-standard.md`, `research/competitors.md` -> `research/competitor-analysis.md`),
then fix every link, the README registry and any manifest. Keep preserved source files under `references/`/`handoff/` unchanged.
Record the old -> new mapping in the handoff.

## Content of the fixed-name docs

| Doc | Write |
|---|---|
| `entrypoints/rd.md` | Purpose + links to `requirements/rd-01-*.md` and every other `rd-NN` domain doc |
| `product/onboarding.md` | First-use setup sequence; empty state; failure/recovery |
| `research/market.md` | Hypotheses to validate + validation plan; no fabricated numbers |
| `research/market-sizing.md` | Sizing assumptions marked unapproved + measurements needed |
| `research/competitor-analysis.md` | Comparison criteria table; mark "research backlog" if not done |
| `business/pricing-rationale.md` | Pricing mechanics and principles; no invented prices |

## Common Mistakes

| Mistake | Fix |
|---|---|
| Docs at `internal/*.md` instead of `internal/docs/` | Move under `internal/docs/<folder>/` |
| YAML frontmatter on docs (id/owner/related) | Three-line plain header; put relations as links in the body |
| Own file names (`functional.md`, `api.md`, `standard.md`) | Use the exact names in the layout |
| ADR with only Context/Decision/Consequences | Add `## Rationale` and `## Sources` |
| `CLAUDE.md` = `@AGENTS.md` only | Write Start here, Documentation-First Rule, same-commit docs, Definition of Done |
| Skill without `agents/openai.yaml` | Add it |
| Validator mentioned but never written or run | Copy `validate_internal.py`, run it, paste the result |
