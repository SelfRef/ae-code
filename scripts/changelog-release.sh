#!/bin/sh
# Move the [Unreleased] notes of docs/CHANGELOG.md under a heading for a release tag.
# Does nothing when the tag already has a section.
#
#   scripts/changelog-release.sh v2026.11.12
set -eu

changelog="$(dirname "$0")/../docs/CHANGELOG.md"
tag="$1"

grep -qF "## [$tag]" "$changelog" && exit 0
date="$(printf %s "$tag" | sed -E 's/^v([0-9]{4})\.([0-9]{2})\.([0-9]{2}).*/\1-\2-\3/')"
sed -i "s/^## \[Unreleased\]\$/&\n\n## [$tag] - $date/" "$changelog"
