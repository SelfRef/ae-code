#!/bin/sh
# Write the docs/changes/*.md notes into docs/CHANGELOG.md under a heading for a release tag,
# above the previous release, and stage that with the removal of the fragments.
#
#   scripts/changelog-release.sh v2026.11.12
set -eu
cd "$(dirname "$0")/.."

changelog=docs/CHANGELOG.md
tag="$1"
date="$(printf %s "$tag" | sed -E 's/^v([0-9]{4})\.([0-9]{2})\.([0-9]{2}).*/\1-\2-\3/')"
NOTES="$(printf '## [%s] - %s\n\n%s\n' "$tag" "$date" "$(scripts/changelog-fragments.sh)")"
export NOTES

awk '
  !done && /^## \[/ && !/^## \[Unreleased\]/ { print ENVIRON["NOTES"]; print ""; done = 1 }
  { print }
  END { if (!done) { print ""; print ENVIRON["NOTES"] } }
' "$changelog" > "$changelog.tmp"
mv "$changelog.tmp" "$changelog"
git rm -q docs/changes/*.md
git add "$changelog"
