#!/usr/bin/env bash
# Vendors nil-ds's tokens and core CSS into ./src/nil-ds/ so the build does
# not depend on a sibling ../nil-ds checkout.
#
# WHY: vite.config.ts used to alias "nil-ds" -> "../nil-ds/src". That works
# locally because both repos sit side by side, but Vercel only checks out
# this repo, so ../nil-ds does not exist there and the preview build fails
# with no signal from a local `npm run build`, which succeeds regardless.
#
# WHY THIS IS A SCRIPT AND NOT A ONE-LINER: guard the destructive step
# behind an existence check (precedent: jenniferhull-portfolio's
# scripts/sync-foundations.sh). An inlined `rm -rf ... && cp ...` deletes
# the vendored copy before checking the source is still there.
set -euo pipefail

SRC="../nil-ds/src"
DEST="src/nil-ds"

if [ ! -f "$SRC/tokens/tokens.css" ] || [ ! -f "$SRC/core/core.css" ]; then
  echo "ERROR: $SRC is missing tokens/tokens.css or core/core.css." >&2
  echo "       Has nil-ds been renamed or moved? Nothing was deleted." >&2
  exit 1
fi

echo "Syncing nil-ds tokens & core -> tetherlog..."
rm -rf "$DEST"
mkdir -p "$DEST/tokens" "$DEST/core"
cp "$SRC/tokens/tokens.css" "$DEST/tokens/tokens.css"
cp "$SRC/core/core.css" "$DEST/core/core.css"
echo "✓ Done. Copied tokens.css & core.css"
