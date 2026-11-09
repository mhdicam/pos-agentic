# Templates — scaffold-internal-docs

Replace `<...>`. Keep headings and order exactly.

## Doc header (every file in internal/docs except references/ handoff/)
```
# <Title>
Status: draft
Date: <YYYY-MM-DD>

<body>
```

## Entrypoint (`entrypoints/prd.md`, same shape for blueprint/brd/frd; `rd.md` links `rd-01-*.md` plus every other rd-NN)
```
# PRD Entrypoint
Status: draft
Date: <YYYY-MM-DD>

**Purpose:** <one line>.

## Primary document
[PRD detailed source](../requirements/prd.md)
```

## ADR (`adr/NNNN-<slug>.md`)
```
# ADR-0001 <Title>
Status: proposed
Date: <YYYY-MM-DD>

## Context
<problem and forces>

## Decision
<what is decided>

## Rationale
<why this over alternatives>

## Consequences
<positive / negative / follow-up docs to update>

## Sources
- [<doc>](../requirements/prd.md)
```

## `adr/README.md`
```
# ADR — index & decision history
Status: draft
Date: <YYYY-MM-DD>

Sub-index of [internal/docs/README.md](../README.md). Numbers unique and immutable; obsolete ADRs are marked, never deleted.

## Decisions
- [0001 — <Title>](0001-<slug>.md) — <one-line narrative: what it decides, amends or supersedes>
```

## EARS standard (`requirements/acceptance-criteria-ears-standard.md`)
```
# Acceptance criteria — EARS standard
Status: operating standard
Date: <YYYY-MM-DD>

| Pattern | Template |
|---|---|
| Ubiquitous | The system shall <response> |
| Event-driven | When <trigger>, the system shall <response> |
| State-driven | While <state>, the system shall <response> |
| Optional | Where <feature is present>, the system shall <response> |
| Unwanted | If <condition>, then the system shall <response> |

No unmeasurable adjectives without a number. Each criterion: `- **<ID>** (<Pattern>): ... Tests: <id> | NONE (gap)`.
```

## `internal/docs/README.md`
```
# <Project> - Internal Docs Registry
Status: draft
Date: <YYYY-MM-DD>

`internal/docs/` is the Source of Truth for <project>.

## Reading Order
1. [Blueprint entrypoint](entrypoints/blueprint.md) - one-page pointer
2. [Product blueprint](product/blueprint.md) - promise, capabilities, journeys
(one numbered line for EVERY remaining .md under internal/docs — none missing)
N. [ADR-0001 <title>](adr/0001-<slug>.md) - <one line>

## Canonical Files
- Product: `product/blueprint.md`, `product/scope-principles.md`
- Requirements: `requirements/prd.md`, `requirements/frd.md`, `requirements/rd-NN-<domain>.md`
- Architecture: `architecture/*.md`; decisions in `adr/` (narrative `adr/README.md`)
- `entrypoints/*.md` are navigation only, never canonical.

## Naming Standard
- **<Domain term>**: <definition>

## Source Discipline
- Fix the detail doc first, then the entrypoint, then this registry, in the same change.
- Behavior change: write EARS criteria first. Architecture decision: new ADR linked here and in `adr/README.md`.
- Every new doc is linked from this registry.
```

## Skill (`internal/skills/<project>/SKILL.md`)
```
---
name: <project>
description: >-
  Use when working on <project>: <domains, stack, key flows, docs Source of
  Truth, agent operations in this repo>.
---

# <project>

## Overview
<what the product is, current status, why this skill exists>

## Required Reading
- Index: `internal/docs/README.md`
- Entrypoints: `internal/docs/entrypoints/{brd,prd,frd,rd}.md`
- <only paths that exist>

## Sub-Skills
- `<project>-devops` (`internal/skills/<project>-devops/SKILL.md`) — <deploy/ops scope>

## Product Rules
## Architecture Rules
## Security Rules
## Data & Schema Rules
## Documentation & Flow Rules
```
`## Sub-Skills` is needed only when a sub-skill exists. Devops sub-skill sections: `# <project>-devops`, `## Overview`, `## Required Reading`, `## Principles`, task sections (Deploy, Incidents, Backup), `## Do Not`.

## `internal/skills/<name>/agents/openai.yaml`
```
interface:
  display_name: "<name>"
  short_description: "<one line>"
  default_prompt: "Use the <name> skill to <what it aligns or operates>."
```

## `CLAUDE.md` (and the same sections inside `AGENTS.md`)
```
# CLAUDE.md — <Project>

## Start here
1. Read `AGENTS.md`.
2. Read `internal/docs/README.md`, then only the docs relevant to the task.
3. Load `internal/skills/<project>/SKILL.md`.

## Documentation-First Rule
`internal/docs/**` is the Source of Truth; behavior changes start as EARS criteria; format in `internal/docs/operations/scaffold-docs.md`.

## Same-commit docs
Update touched docs in the same commit, or write "no docs update needed".

## Definition of Done
Touched tests pass with exact output recorded · touched docs updated and linked from `internal/docs/README.md` · `python3 scripts/validate_docs.py` passes.
```

## `.claude/settings.json`
```
{
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command",
        "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/hooks/ensure-docs-updated.py\"" } ] }
    ]
  }
}
```
Copy `scripts/ensure-docs-updated.py` to `.claude/hooks/`, `chmod +x`, set `IMPLEMENTATION_PREFIXES` to the project's code folders.

## `operations/scaffold-docs.md`
Use numbered sections (`## 9. Stop hook`, `## 10. Validation`). Record this layout and format contract for the project (folder table, header, ADR, EARS, README sections, skill layout, Stop hook, validator command), so the standard lives in the repo's own docs.
