#!/usr/bin/env python3
"""Stop hook: block when implementation files are staged without a docs change.

See internal/docs/operations/scaffold-docs.md (Stop hook section).
"""
import json
import subprocess
import sys

IMPLEMENTATION_PREFIXES = ("apps/", "packages/", "infra/")
DOC_PREFIXES = ("internal/docs/", "internal/skills/", "AGENTS.md", "CLAUDE.md")


def staged_files():
    try:
        out = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            capture_output=True, text=True, check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return []
    return [line for line in out.splitlines() if line]


def main():
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        payload = {}
    if payload.get("stop_hook_active"):
        return 0
    files = staged_files()
    impl = [f for f in files if f.startswith(IMPLEMENTATION_PREFIXES)]
    docs = [f for f in files if f.startswith(DOC_PREFIXES)]
    if impl and not docs:
        print(json.dumps({
            "decision": "block",
            "reason": (
                "Implementation files are staged without changes in internal/docs/, "
                "AGENTS.md or CLAUDE.md. Update the touched docs (and the README index) "
                "or state 'no docs update needed' explicitly. Staged: " + ", ".join(impl[:10])
            ),
        }))
    return 0


if __name__ == "__main__":
    sys.exit(main())
