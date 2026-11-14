#!/bin/sh
# Print the unreleased notes, docs/changes/*.md (one change per file), as Keep a Changelog bullets
# in the order their commits added them. Fails when there are none, so a release is stopped
# before anything is built.
#
#   scripts/changelog-fragments.sh
set -eu
cd "$(dirname "$0")/.."

dir=docs/changes
found=
# Files a shallow history misses still come last, by name.
for f in $({ git log --reverse --diff-filter=A --format= --name-only -- "$dir"; ls "$dir"/*.md 2>/dev/null || true; } | awk '!seen[$0]++'); do
  [ -f "$f" ] || continue
  printf -- '- %s\n' "$(cat "$f")"
  found=1
done

[ -n "$found" ] || { echo "$dir has no notes for the release" >&2; exit 1; }
