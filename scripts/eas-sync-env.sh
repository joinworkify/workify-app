#!/usr/bin/env bash
# Pushes every EXPO_PUBLIC_* var from the local .env file to EAS, so cloud builds (EAS Build)
# actually have them -- EAS Build runs on remote servers with no access to the local, gitignored
# .env file, so without this, EXPO_PUBLIC_* references get inlined as `undefined` at build time.
# That's what caused the app to crash on every launch in TestFlight builds 1-4 (2026-09-02).
#
# Usage:
#   ./scripts/eas-sync-env.sh                        # sync to production, preview, development
#   ./scripts/eas-sync-env.sh production preview     # sync to only the environments listed
#
# `eas env:set` creates or updates, so this is safe to re-run any time .env changes.

set -euo pipefail
cd "$(dirname "$0")/.."

ENVIRONMENTS=("$@")
if [ ${#ENVIRONMENTS[@]} -eq 0 ]; then
  ENVIRONMENTS=(production preview development)
fi

if [ ! -f .env ]; then
  echo "No .env file found in $(pwd)" >&2
  exit 1
fi

# Only EXPO_PUBLIC_* vars are relevant here -- anything else in .env (DB URLs, server secrets)
# either isn't read by the client bundle or belongs in Supabase secrets instead, not EAS.
# (Using a temp file + while-read, not `mapfile`, since macOS ships bash 3.2 which lacks it.)
VARS_FILE=$(mktemp)
trap 'rm -f "$VARS_FILE"' EXIT
grep -E '^EXPO_PUBLIC_[A-Z_]+=' .env | grep -v '^#' > "$VARS_FILE"

if [ ! -s "$VARS_FILE" ]; then
  echo "No EXPO_PUBLIC_* vars found (uncommented) in .env" >&2
  exit 1
fi

for ENV in "${ENVIRONMENTS[@]}"; do
  echo "=== $ENV ==="
  while IFS= read -r LINE; do
    NAME="${LINE%%=*}"
    VALUE="${LINE#*=}"
    npx eas-cli env:set \
      --environment "$ENV" \
      --name "$NAME" \
      --value "$VALUE" \
      --visibility plaintext \
      --non-interactive < /dev/null
  done < "$VARS_FILE"
done

echo ""
echo "Done. Verify with: npx eas-cli env:list production"
