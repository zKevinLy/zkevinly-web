#!/usr/bin/env bash
# Prints the next @zkevinly/ui release tag (ui-vX.Y.Z), or NOTHING when there is nothing to release.
#
# Same Conventional Commits rules as next-version.sh, but only commits that touch packages/ui
# count, and tags are prefixed `ui-v` so they never collide with the site's `v*` tags:
#   feat!: / BREAKING CHANGE:  -> major     feat: -> minor     anything else -> patch
#
# First release (no ui-v* tag yet): publishes packages/ui/package.json's version as is.
# The git tag is the source of truth afterwards; CI's `version` job stamps it into package.json
# and the lockfile (set-version.mjs) and tags that commit.
#
# Usage: next-ui-version.sh [commit-ish]   (default: HEAD)
# Needs full history and tags (actions/checkout: fetch-depth 0, fetch-tags true).
set -euo pipefail

SHA="${1:-HEAD}"
DIR="packages/ui"

LAST="$(git tag --list 'ui-v*' --sort=-v:refname | grep -E '^ui-v[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1 || true)"

if [ -z "$LAST" ]; then
  echo "ui-v$(node -p "require('./$DIR/package.json').version")"
  exit 0
fi

if [ -z "$(git log --format='%h' "$LAST..$SHA" -- "$DIR")" ]; then
  echo "No changes in $DIR since $LAST; nothing to release." >&2
  exit 0
fi

SUBJECTS="$(git log --format='%s' "$LAST..$SHA" -- "$DIR")"
BODIES="$(git log --format='%b' "$LAST..$SHA" -- "$DIR")"

if printf '%s\n' "$SUBJECTS" | grep -Eiq '^[[:alnum:]_-]+(\([^)]*\))?!:' ||
  printf '%s\n' "$BODIES" | grep -Eq '^[[:space:]]*BREAKING[ -]CHANGE:'; then
  BUMP=major
elif printf '%s\n' "$SUBJECTS" | grep -Eiq '^feat(\([^)]*\))?:'; then
  BUMP=minor
else
  BUMP=patch
fi

IFS=. read -r MAJOR MINOR PATCH <<<"${LAST#ui-v}"
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

TAG="ui-v${MAJOR}.${MINOR}.${PATCH}"
echo "Previous: ${LAST} -> Next: ${TAG} (${BUMP})" >&2
echo "$TAG"
