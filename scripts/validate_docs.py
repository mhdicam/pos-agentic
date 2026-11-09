#!/usr/bin/env python3
"""Validate Orbis internal documentation skeleton and local Markdown links."""
from pathlib import Path
import re,sys
root=Path(__file__).resolve().parents[1]
docs=root/'internal'/'docs'
errors=[]
required=['README.md','INDEX.md','requirements/prd.md','requirements/frd.md','requirements/rd-11-open-decisions.md','architecture/data-model.md','architecture/api-contract.md','handoff/PHASE_2_3_BLOCKER_AND_DECISION_REGISTER.csv']
for f in required:
 if not (docs/f).is_file():errors.append('missing '+str(f))
for p in docs.rglob('*.md'):
 s=p.read_text(encoding='utf-8')
 for link in re.findall(r'\[[^\]]+\]\(([^)]+)\)',s):
  link=link.split('#',1)[0].split('?',1)[0]
  if not link or '://' in link or link.startswith(('mailto:','#')):continue
  target=(p.parent/link).resolve()
  if not target.is_file():errors.append(f'{p.relative_to(root)} -> {link}')
print(f'Docs: {len(list(docs.rglob("*.md")))} Markdown files')
if errors:
 print('FAILED:',*errors,sep='\n- ');sys.exit(1)
print('PASS: required files and relative links')
