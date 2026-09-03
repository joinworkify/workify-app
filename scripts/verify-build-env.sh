#!/usr/bin/env bash
# Proves an EAS iOS build actually has the real EXPO_PUBLIC_* values compiled in, instead of
# trusting `eas build`'s log messages (which can be wrong if the build was queued right as env
# vars were being set on EAS -- the environment is snapshotted at build kickoff, not re-fetched
# at compile time). Downloads the built .ipa, unzips it, and greps the compiled Hermes bundle for
# each EXPO_PUBLIC_* value from the local .env. This is how build 4's missing-env-var bug (2026-09-02,
# every TestFlight launch crashing with EXC_BAD_ACCESS/SIGABRT on the turbomodule queue) was confirmed
# and then confirmed fixed on build 5.
#
# Usage:
#   ./scripts/verify-build-env.sh                  # checks the latest finished production build
#   ./scripts/verify-build-env.sh <build-id>        # checks a specific build by ID
#   ./scripts/verify-build-env.sh --profile preview # latest finished build on another profile

set -euo pipefail
cd "$(dirname "$0")/.."

PROFILE="production"
BUILD_ID=""

while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    *) BUILD_ID="$1"; shift ;;
  esac
done

if [ -z "$BUILD_ID" ]; then
  echo "No build ID given -- looking up the latest finished '$PROFILE' iOS build..."
  BUILD_ID=$(npx eas-cli build:list --platform ios --status finished --build-profile "$PROFILE" \
    --limit 1 --non-interactive --json | jq -r '.[0].id')
  if [ -z "$BUILD_ID" ] || [ "$BUILD_ID" = "null" ]; then
    echo "Couldn't find a finished build for profile '$PROFILE'." >&2
    exit 1
  fi
  echo "Using build $BUILD_ID"
fi

ARCHIVE_URL=$(npx eas-cli build:view "$BUILD_ID" --json | jq -r '.artifacts.buildUrl // .artifacts.applicationArchiveUrl // empty')
if [ -z "$ARCHIVE_URL" ]; then
  echo "Build $BUILD_ID has no downloadable archive (still running, or errored?)." >&2
  exit 1
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

echo "Downloading $ARCHIVE_URL ..."
curl -sL -o "$WORKDIR/build.ipa" "$ARCHIVE_URL"

cd "$WORKDIR"
unzip -q build.ipa
BUNDLE=$(find . -name main.jsbundle | head -1)
if [ -z "$BUNDLE" ]; then
  echo "Couldn't find main.jsbundle inside the archive -- is this an iOS build?" >&2
  exit 1
fi

cd - >/dev/null

# Using a temp file + while-read, not `mapfile`, since macOS ships bash 3.2 which lacks it.
VARS_FILE=$(mktemp)
grep -E '^EXPO_PUBLIC_[A-Z_]+=' .env | grep -v '^#' > "$VARS_FILE"

FAILED=0
echo ""
echo "Checking $BUNDLE for each EXPO_PUBLIC_* value from .env:"
while IFS= read -r LINE; do
  NAME="${LINE%%=*}"
  VALUE="${LINE#*=}"
  # Grep for a distinctive slice of the value rather than the whole thing -- keeps this robust to
  # values containing regex-special characters, and a partial match is enough to prove the real
  # value (not `undefined`) made it into the bundle.
  NEEDLE="${VALUE:0:24}"
  if grep -aq -- "$NEEDLE" "$WORKDIR/$BUNDLE"; then
    echo "  OK    $NAME"
  else
    echo "  MISSING $NAME (looked for: ${NEEDLE}...)"
    FAILED=1
  fi
done < "$VARS_FILE"
rm -f "$VARS_FILE"

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "All EXPO_PUBLIC_* vars are present in build $BUILD_ID -- safe to submit/test."
else
  echo "Some vars are missing from build $BUILD_ID -- do NOT ship this build. Run" \
    "./scripts/eas-sync-env.sh, then trigger a NEW build (this one was likely queued before" \
    "the vars were saved on EAS)."
  exit 1
fi
