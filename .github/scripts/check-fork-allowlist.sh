#!/usr/bin/env bash
# Each file this fork changes against upstream's main is on .github/fork-allowlist.txt, and each
# line there names a file the fork still changes. A line that ends in / names a directory the fork
# owns. A change to upstream's tree that is not on the list is a change the weekly sync can
# conflict on with no one having chosen it.
#
#   .github/scripts/check-fork-allowlist.sh <upstream main's commit>
#
# .github/workflows/fork-checks.yaml runs it on every pull request and push to main.
set -euo pipefail

cd "$(dirname "$0")/../.."

base=${1:?usage: check-fork-allowlist.sh <upstream main commit>}
list=.github/fork-allowlist.txt

entries_text=$(sed -e 's/#.*//' -e 's/[[:space:]]*$//' "$list" | grep -v '^$')
changed_text=$(git diff --name-only --no-renames "$base...HEAD")
mapfile -t entries <<< "$entries_text"
mapfile -t changed <<< "$changed_text"

declare -A used=()
fail=0
upstream=$(git merge-base "$base" HEAD)
for entry in "${entries[@]}"; do
  # A directory line admits every file under it, so it must not name a directory of upstream's.
  if [[ $entry == */ ]] && [ -n "$(git ls-tree -r --name-only "$upstream" -- "$entry")" ]; then
    echo "::error file=$list::$entry is on $list as a directory the fork owns, and upstream has files in it"
    fail=1
  fi
done
for file in "${changed[@]}"; do
  [ -n "$file" ] || continue
  listed=false
  # Every line that matches is in use, so a file line under a directory line is not stale.
  for entry in "${entries[@]}"; do
    if [[ $entry == */ && $file == "$entry"* ]] || [[ $file == "$entry" ]]; then
      listed=true
      used[$entry]=1
    fi
  done
  if ! $listed; then
    echo "::error file=$file::$file differs from upstream's main and is not on $list"
    fail=1
  fi
done
for entry in "${entries[@]}"; do
  if [ -z "${used[$entry]:-}" ]; then
    echo "::error file=$list::$entry is on $list, and the fork no longer changes it"
    fail=1
  fi
done
echo "${#changed[@]} changed files, ${#entries[@]} allowlist entries"
exit "$fail"
