#!/usr/bin/env bash
#
# This repository is PUBLIC. This check runs inside `npm run build` so a
# personal identifier cannot reach a commit without someone seeing a failure.
# See the banner at the top of CLAUDE.md.
#
# It scans TRACKED files only. Add new patterns as they become relevant.

set -uo pipefail
fail=0

# Identifiers that must never appear in this repo. Kept as a pattern rather
# than a literal list so the file itself does not publish what it protects.
PATTERNS='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|/Users/[a-z]+|/home/[a-z]+|C:\\\\Users'

hits=$(git ls-files -z 2>/dev/null \
  | xargs -0 grep -nEI "$PATTERNS" 2>/dev/null \
  | grep -v '^scripts/check-privacy.sh:' \
  | grep -v 'noreply@anthropic.com' \
  | grep -v 'example\.com\|user@\|your-email\|name@' || true)

if [ -n "$hits" ]; then
  echo "✗ Personal identifier or absolute path in a tracked file." >&2
  echo "  This repo is public. See the banner at the top of CLAUDE.md." >&2
  echo "$hits" | sed 's/^/    /' >&2
  fail=1
fi

# Reference media must stay out: third-party, and often carrying captions.
media=$(git ls-files 'docs/references/*' | grep -vE '\.md$' || true)
if [ -n "$media" ]; then
  echo "✗ Reference media is tracked. docs/references/ is gitignored except *.md." >&2
  echo "$media" | sed 's/^/    /' >&2
  fail=1
fi

[ "$fail" -eq 0 ] && echo "✓ no personal identifiers, absolute paths or reference media tracked"
exit "$fail"
