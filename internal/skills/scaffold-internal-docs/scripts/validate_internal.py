#!/usr/bin/env python3
"""Validate an internal/ docs + skills scaffold against the scaffold-internal-docs skill.

Usage: python3 validate_internal.py [REPO_ROOT] [--no-ui] [--preserved DIR,DIR]
Exit 0 = PASS, 1 = FAILED (each error printed).
"""
from pathlib import Path
import json
import os
import re
import sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
root = Path(args[0] if args else '.').resolve()
no_ui = '--no-ui' in sys.argv
preserved = ('references', 'handoff')
if '--preserved' in sys.argv:
    preserved = tuple(sys.argv[sys.argv.index('--preserved') + 1].split(','))

docs = root / 'internal' / 'docs'
skills = root / 'internal' / 'skills'
errors = []

REQUIRED = [
    'README.md',
    'entrypoints/blueprint.md', 'entrypoints/brd.md', 'entrypoints/prd.md', 'entrypoints/frd.md', 'entrypoints/rd.md',
    'product/blueprint.md', 'product/scope-principles.md', 'product/onboarding.md',
    'business/brd.md', 'business/pricing-rationale.md',
    'requirements/prd.md', 'requirements/frd.md', 'requirements/acceptance-criteria-ears-standard.md',
    'research/market.md', 'research/competitor-analysis.md', 'research/market-sizing.md',
    'brand/README.md',
    'architecture/stack.md', 'architecture/data-model.md', 'architecture/api-contract.md', 'architecture/nfr.md',
    'adr/README.md',
    'operations/runbook.md', 'operations/roadmap.md', 'operations/implementation-standard.md',
    'operations/agent-documentation-workflow.md',
    'security/security-standard.md', 'security/threat-model.md',
]
if not no_ui:
    REQUIRED += ['design-system/design-system.md', 'frontend/frontend-implementation.md']
ADR_SECTIONS = ['## Context', '## Decision', '## Rationale', '## Consequences', '## Sources']
README_SECTIONS = ['## Reading Order', '## Canonical Files', '## Naming Standard', '## Source Discipline']
SKILL_SECTIONS = ['## Overview', '## Required Reading']

if not docs.is_dir():
    print(f'FAILED:\n- missing {docs}')
    sys.exit(1)

for f in REQUIRED:
    if not (docs / f).is_file():
        errors.append('missing internal/docs/' + f)
if not list((docs / 'requirements').glob('rd-[0-9][0-9]-*.md')):
    errors.append('missing internal/docs/requirements/rd-NN-<domain>.md (at least one)')
if not list((docs / 'adr').glob('[0-9][0-9][0-9][0-9]-*.md')):
    errors.append('missing internal/docs/adr/NNNN-<slug>.md (at least one)')

for f in ('AGENTS.md', 'CLAUDE.md'):
    if not (root / f).is_file():
        errors.append('missing ' + f)
    else:
        t = (root / f).read_text(encoding='utf-8').lower()
        for need in ('internal/docs/readme.md', 'definition of done'):
            if need not in t:
                errors.append(f'{f}: must mention "{need}"')
hook = root / '.claude' / 'hooks' / 'ensure-docs-updated.py'
settings = root / '.claude' / 'settings.json'
if not hook.is_file():
    errors.append('missing .claude/hooks/ensure-docs-updated.py')
elif not os.access(hook, os.X_OK):
    errors.append('.claude/hooks/ensure-docs-updated.py: not executable (chmod +x)')
if not settings.is_file():
    errors.append('missing .claude/settings.json')
else:
    try:
        stop = json.loads(settings.read_text(encoding='utf-8')).get('hooks', {}).get('Stop', [])
        if 'ensure-docs-updated.py' not in json.dumps(stop):
            errors.append('.claude/settings.json: Stop hook must run ensure-docs-updated.py')
    except ValueError:
        errors.append('.claude/settings.json: invalid JSON')

md_files = sorted(docs.rglob('*.md'))
readme_path = docs / 'README.md'
readme = readme_path.read_text(encoding='utf-8') if readme_path.is_file() else ''
adr_readme_path = docs / 'adr' / 'README.md'
adr_readme = adr_readme_path.read_text(encoding='utf-8') if adr_readme_path.is_file() else ''


def prose(text):
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    return re.sub(r'`[^`\n]*`', '', text)


for p in md_files:
    rel = p.relative_to(docs)
    s = p.read_text(encoding='utf-8')
    lines = s.splitlines()
    if rel.parts[0] not in preserved:
        if s.startswith('---'):
            errors.append(f'{rel}: YAML frontmatter not allowed in docs')
        if len(lines) < 3 or not lines[0].startswith('# ') or not lines[1].startswith('Status: ') \
                or not re.match(r'^Date: \d{4}-\d{2}-\d{2}$', lines[2]):
            errors.append(f'{rel}: header must be lines "# Title" / "Status: ..." / "Date: YYYY-MM-DD"')
    if rel.parts[0] == 'adr' and rel.name != 'README.md':
        if not re.match(r'^\d{4}-[a-z0-9-]+\.md$', rel.name):
            errors.append(f'{rel}: ADR filename must be NNNN-slug.md')
        elif not lines or not lines[0].startswith('# ADR-' + rel.name[:4] + ' '):
            errors.append(f'{rel}: title must be "# ADR-{rel.name[:4]} <Title>"')
        pos = [s.find('\n' + h + '\n') for h in ADR_SECTIONS]
        if -1 in pos or pos != sorted(pos):
            errors.append(f'{rel}: ADR sections must be {", ".join(ADR_SECTIONS)} in this order')
        if f'(adr/{rel.name})' not in readme:
            errors.append(f'{rel}: not linked from internal/docs/README.md')
        if f'({rel.name})' not in adr_readme:
            errors.append(f'{rel}: not linked from internal/docs/adr/README.md')
    if rel.parts[0] in ('qa', 'security') and len(rel.parts) == 2 and re.match(r'^\d', rel.name) \
            and not re.match(r'^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$', rel.name):
        errors.append(f'{rel}: dated doc must be YYYY-MM-DD-slug.md')
    if rel.parts[0] == 'qa' and len(rel.parts) == 2 and not re.match(r'^\d{4}-\d{2}-\d{2}-[a-z0-9-]+-spec\.md$', rel.name):
        errors.append(f'{rel}: QA doc must be YYYY-MM-DD-<slug>-spec.md')
    for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)', prose(s)):
        link = link.split('#', 1)[0].split('?', 1)[0]
        if not link or '://' in link or link.startswith('mailto:'):
            continue
        if not (p.parent / link).resolve().exists():
            errors.append(f'{rel}: dead link {link}')

for h in README_SECTIONS:
    if '\n' + h + '\n' not in readme:
        errors.append(f'README.md: missing section {h}')
if not re.search(r'\n1\. \[[^\]]+\]\([^)]+\) - ', readme):
    errors.append('README.md: Reading Order lines must be "N. [title](path) - description"')
linked = {(docs / l.split('#')[0]).resolve() for l in re.findall(r'\]\(([^)]+)\)', prose(readme)) if '://' not in l}
for p in md_files:
    if p != readme_path and p.resolve() not in linked:
        errors.append(f'{p.relative_to(docs)}: not registered in internal/docs/README.md')

skill_dirs = [d for d in sorted(skills.iterdir()) if d.is_dir()] if skills.is_dir() else []
if not skill_dirs:
    errors.append('missing internal/skills/<project>/SKILL.md')
for d in skill_dirs:
    sk = d / 'SKILL.md'
    if not sk.is_file():
        errors.append(f'internal/skills/{d.name}: missing SKILL.md')
        continue
    s = sk.read_text(encoding='utf-8')
    m = re.match(r'^---\nname: ([a-z0-9-]+)\ndescription: >-\n(?:  .+\n)+---\n', s)
    if not m or m.group(1) != d.name:
        errors.append(f'internal/skills/{d.name}/SKILL.md: frontmatter must be "name: {d.name}" + "description: >-" folded block')
    elif 'use when' not in s[:m.end()].lower():
        errors.append(f'internal/skills/{d.name}/SKILL.md: description must start with "Use when ..."')
    if f'\n# {d.name}\n' not in s:
        errors.append(f'internal/skills/{d.name}/SKILL.md: missing title "# {d.name}"')
    for h in SKILL_SECTIONS:
        if '\n' + h + '\n' not in s:
            errors.append(f'internal/skills/{d.name}/SKILL.md: missing section {h}')
    oy = d / 'agents' / 'openai.yaml'
    if not oy.is_file():
        errors.append(f'internal/skills/{d.name}: missing agents/openai.yaml')
    else:
        y = oy.read_text(encoding='utf-8')
        for key in ('interface:', 'display_name:', 'short_description:', 'default_prompt:'):
            if key not in y:
                errors.append(f'internal/skills/{d.name}/agents/openai.yaml: missing {key}')
    for ref in re.findall(r'`(internal/[^`*{}<>\s]+\.md)`', s):
        if not (root / ref).is_file():
            errors.append(f'internal/skills/{d.name}/SKILL.md: dead path {ref}')

print(f'Docs: {len(md_files)} Markdown files; skills: {len(skill_dirs)}')
if errors:
    print('FAILED:', *errors, sep='\n- ')
    sys.exit(1)
print('PASS: structure, headers, ADRs, README registry, skills, agent config, links')
