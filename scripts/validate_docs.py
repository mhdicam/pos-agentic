#!/usr/bin/env python3
"""Validate Orbis internal docs and skills against internal/docs/operations/scaffold-docs.md."""
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
docs = root / 'internal' / 'docs'
skills = root / 'internal' / 'skills'
errors = []

REQUIRED = [
    'README.md',
    'entrypoints/blueprint.md', 'entrypoints/brd.md', 'entrypoints/prd.md', 'entrypoints/frd.md', 'entrypoints/rd.md',
    'product/blueprint.md', 'product/scope-principles.md', 'product/onboarding.md',
    'business/brd.md', 'business/pricing-rationale.md',
    'requirements/prd.md', 'requirements/frd.md', 'requirements/rd-11-open-decisions.md',
    'requirements/acceptance-criteria-ears-standard.md',
    'research/market.md', 'research/competitor-analysis.md', 'research/market-sizing.md',
    'brand/README.md',
    'architecture/stack.md', 'architecture/data-model.md', 'architecture/api-contract.md', 'architecture/nfr.md',
    'adr/README.md',
    'design-system/design-system.md', 'frontend/frontend-implementation.md',
    'operations/runbook.md', 'operations/roadmap.md', 'operations/implementation-standard.md',
    'operations/agent-documentation-workflow.md', 'operations/scaffold-docs.md',
    'security/security-standard.md', 'security/threat-model.md',
    'handoff/PHASE_2_3_BLOCKER_AND_DECISION_REGISTER.csv',
]
ROOT_REQUIRED = ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.claude/hooks/ensure-docs-updated.py']
PRESERVED = ('references', 'handoff')  # original headers kept
ADR_SECTIONS = ['## Context', '## Decision', '## Rationale', '## Consequences', '## Sources']
README_SECTIONS = ['## Reading Order', '## Canonical Files', '## Naming Standard', '## Source Discipline']

for f in REQUIRED:
    if not (docs / f).is_file():
        errors.append('missing internal/docs/' + f)
for f in ROOT_REQUIRED:
    if not (root / f).is_file():
        errors.append('missing ' + f)

md_files = sorted(docs.rglob('*.md'))
for p in md_files:
    rel = p.relative_to(docs)
    s = p.read_text(encoding='utf-8')
    lines = s.splitlines()
    if rel.parts[0] not in PRESERVED:
        if s.startswith('---'):
            errors.append(f'{rel}: YAML frontmatter not allowed')
        if len(lines) < 3 or not lines[0].startswith('# ') or not lines[1].startswith('Status: ') \
                or not re.match(r'^Date: \d{4}-\d{2}-\d{2}$', lines[2]):
            errors.append(f'{rel}: header must be "# Title / Status: ... / Date: YYYY-MM-DD"')
    if rel.parts[0] == 'adr' and rel.name != 'README.md':
        if not re.match(r'^\d{4}-[a-z0-9-]+\.md$', rel.name):
            errors.append(f'{rel}: ADR filename must be NNNN-slug.md')
        if not lines[0].startswith('# ADR-' + rel.name[:4] + ' '):
            errors.append(f'{rel}: title must be "# ADR-{rel.name[:4]} ..."')
        pos = [s.find('\n' + h + '\n') for h in ADR_SECTIONS]
        if -1 in pos or pos != sorted(pos):
            errors.append(f'{rel}: ADR sections must be {", ".join(ADR_SECTIONS)} in order')
        if f'(adr/{rel.name})' not in (docs / 'README.md').read_text(encoding='utf-8'):
            errors.append(f'{rel}: not linked from README.md')
        if f'({rel.name})' not in (docs / 'adr' / 'README.md').read_text(encoding='utf-8'):
            errors.append(f'{rel}: not linked from adr/README.md')
    if rel.parts[0] in ('qa', 'security') and len(rel.parts) == 2 and re.match(r'^\d', rel.name):
        if not re.match(r'^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$', rel.name):
            errors.append(f'{rel}: dated doc must be YYYY-MM-DD-slug.md')
    if rel.parts[0] == 'qa' and len(rel.parts) == 2 and not rel.name.endswith('-spec.md'):
        errors.append(f'{rel}: QA doc must be YYYY-MM-DD-<slug>-spec.md')
    prose = re.sub(r'```.*?```', '', s, flags=re.S)
    prose = re.sub(r'`[^`\n]*`', '', prose)
    for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)', prose):
        link = link.split('#', 1)[0].split('?', 1)[0]
        if not link or '://' in link or link.startswith(('mailto:', '#')):
            continue
        if not (p.parent / link).resolve().is_file():
            errors.append(f'{p.relative_to(root)} -> {link}')

readme = (docs / 'README.md').read_text(encoding='utf-8')
for h in README_SECTIONS:
    if '\n' + h + '\n' not in readme:
        errors.append(f'README.md: missing section {h}')
linked = {(docs / l.split('#')[0]).resolve() for l in re.findall(r'\]\(([^)]+)\)', readme) if '://' not in l}
for p in md_files:
    if p.name == 'README.md' and p.parent == docs:
        continue
    if p.resolve() not in linked:
        errors.append(f'{p.relative_to(docs)}: not registered in README.md')

skill_dirs = [d for d in sorted(skills.iterdir()) if d.is_dir()] if skills.is_dir() else []
if not skill_dirs:
    errors.append('missing internal/skills/<name>/')
for d in skill_dirs:
    sk = d / 'SKILL.md'
    if not sk.is_file():
        errors.append(f'{d.relative_to(root)}: missing SKILL.md')
        continue
    s = sk.read_text(encoding='utf-8')
    m = re.match(r'^---\nname: ([a-z0-9-]+)\ndescription: >-\n(?:  .+\n)+---\n', s)
    if not m or m.group(1) != d.name:
        errors.append(f'{sk.relative_to(root)}: frontmatter must be name: {d.name} + folded description')
    if f'\n# {d.name}\n' not in s or '\n## Overview\n' not in s or '\n## Required Reading\n' not in s:
        errors.append(f'{sk.relative_to(root)}: needs "# {d.name}", "## Overview", "## Required Reading"')
    oy = d / 'agents' / 'openai.yaml'
    if not oy.is_file():
        errors.append(f'{d.relative_to(root)}: missing agents/openai.yaml')
    else:
        y = oy.read_text(encoding='utf-8')
        for key in ('interface:', 'display_name:', 'short_description:', 'default_prompt:'):
            if key not in y:
                errors.append(f'{oy.relative_to(root)}: missing {key}')
    for ref in re.findall(r'`(internal/[^`*{}<>]+\.md)`', s):
        if not (root / ref).is_file():
            errors.append(f'{sk.relative_to(root)}: dead path {ref}')

print(f'Docs: {len(md_files)} Markdown files; skills: {len(skill_dirs)}')
if errors:
    print('FAILED:', *errors, sep='\n- ')
    sys.exit(1)
print('PASS: required files, headers, ADR format, skills and relative links')
