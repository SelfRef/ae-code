#!/bin/sh
# Print the docs/CHANGELOG.md notes of a release tag: the section named after it, else [Unreleased].
# Fails when both are empty, so a release is stopped before anything is built.
#
#   scripts/release-notes-section.sh v2026.11.12
set -eu

changelog="$(dirname "$0")/../docs/CHANGELOG.md"

section() {
  awk -v h="## [$1]" 'index($0, h) == 1 { f = 1; next } f && /^## \[/ { exit } f' "$changelog"
}

for name in "$1" Unreleased; do
  body="$(section "$name")"
  if [ -n "$(printf %s "$body" | tr -d '[:space:]')" ]; then
    printf '%s\n' "$body" | sed '/./,$!d'
    exit 0
  fi
done

echo "docs/CHANGELOG.md has no notes for $1 or [Unreleased]" >&2
exit 1
