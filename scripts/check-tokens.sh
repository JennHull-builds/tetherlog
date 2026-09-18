#!/usr/bin/env bash
#
# Runs inside `npm run build`, so it fails identically here and on Vercel, with
# no network and no sibling repository. Three checks:
#
#   1. tokens.generated.css matches tokens.json
#   2. no colour literal outside the generated file
#   3. no component reaching past the semantic layer into --tl-ref-*
#
# Deliberately not `set -e`: every check should report, not just the first.

set -uo pipefail

GENERATED="src/styles/tokens.generated.css"
fail=0

# ── 1. staleness ───────────────────────────────────────────────────────────
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cp "$GENERATED" "$tmp/committed.css" 2>/dev/null || {
  echo "✗ $GENERATED is missing. Run: npm run tokens" >&2
  exit 1
}

node scripts/build-tokens.mjs >/dev/null || {
  echo "✗ scripts/build-tokens.mjs failed." >&2
  exit 1
}

if ! diff -q "$tmp/committed.css" "$GENERATED" >/dev/null 2>&1; then
  echo "✗ $GENERATED is stale. Run: npm run tokens" >&2
  diff -u "$tmp/committed.css" "$GENERATED" | head -40 >&2
  # Leave the tree exactly as found so the check has no side effects.
  cp "$tmp/committed.css" "$GENERATED"
  fail=1
fi

# ── 2. colour literals ─────────────────────────────────────────────────────
# Hex is allowed in the generated file (it is the source of colour) and in
# tokens.json (it is the source of truth).
hex=$(grep -rnE '#[0-9a-fA-F]{3,8}\b' src \
        --include='*.ts' --include='*.tsx' --include='*.css' 2>/dev/null \
      | grep -v "^$GENERATED:" || true)

if [ -n "$hex" ]; then
  echo "✗ Colour literal outside $GENERATED." >&2
  echo "  Components read semantic tokens: var(--tl-<role>). See CLAUDE.md." >&2
  echo "$hex" | sed 's/^/    /' >&2
  fail=1
fi

# ── 3. primitive leaks ─────────────────────────────────────────────────────
# src/index.css is the ONE exemption, and only inside @theme, where Tailwind
# namespaces (--font-*, --text-*, --spacing) need a value and no role name
# exists. Nothing else may read --tl-ref-*.
prim=$(grep -rn -- '--tl-ref-' src \
         --include='*.ts' --include='*.tsx' --include='*.css' 2>/dev/null \
       | grep -v "^$GENERATED:" \
       | grep -v '^src/index.css:' || true)

if [ -n "$prim" ]; then
  echo "✗ Primitive token read outside $GENERATED." >&2
  echo "  Components read semantic roles only (--tl-<role>), never --tl-ref-*." >&2
  echo "$prim" | sed 's/^/    /' >&2
  fail=1
fi

# ── 4. the reset that ate the layout ───────────────────────────────────────
# See docs/UI-OVERHAUL.md 1.12. An unlayered universal reset outranks every
# Tailwind utility and silently zeroes all padding and margin in the app.
reset=$(grep -rn -E '^\s*\*\s*,|^\s*\*\s*\{' src --include='*.css' 2>/dev/null \
        | grep -v "^$GENERATED:" || true)

if [ -n "$reset" ]; then
  echo "✗ Universal selector in app CSS." >&2
  echo "  An unlayered '*' reset beats every @layer utility and zeroes all" >&2
  echo "  padding and margin app-wide. Tailwind preflight already handles this." >&2
  echo "$reset" | sed 's/^/    /' >&2
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "✓ tokens in sync; no colour literals, primitive leaks or global resets"
fi

exit "$fail"
