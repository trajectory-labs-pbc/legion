#!/usr/bin/env bash
# Checks the fork's diff against upstream's main with the rules in .github/fork-allowlist.txt.
#
#   .github/scripts/check-fork-allowlist.sh <upstream main's commit>
set -euo pipefail

cd "$(dirname "$0")/../.."

base=${1:?usage: check-fork-allowlist.sh <upstream main commit>}
list=.github/fork-allowlist.txt

# escape_message <text>: text as a workflow command's message: %, CR, LF and `##[` encoded.
escape_message() {
  local text=${1//'%'/%25}
  text=${text//$'\r'/%0D}
  text=${text//$'\n'/%0A}
  printf '%s' "${text//'##['/%23%23%5B}"
}

# escape_property <text>: text as a property value: escaped as a message, and ":" and "," too,
# since the runner ends the properties at `::` and splits them on `,`.
escape_property() {
  local text
  text=$(escape_message "$1")
  text=${text//:/%3A}
  printf '%s' "${text//,/%2C}"
}

upstream=$(git merge-base "$base" HEAD)
entries_text=$(sed -e 's/#.*//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e '/^$/d' "$list")
# Without quotePath, git prints a path that holds a non-ASCII byte in quotes, and no line matches it.
changed_text=$(git -c core.quotePath=false diff --name-only --no-renames "$upstream" HEAD)
# A here-string of an empty text is one empty line, which is not an entry.
entries=()
changed=()
[ -z "$entries_text" ] || mapfile -t entries <<< "$entries_text"
[ -z "$changed_text" ] || mapfile -t changed <<< "$changed_text"

declare -A used=()
fail=0
for entry in "${entries[@]}"; do
  # A directory line admits every file under it, so it must not name a directory of upstream's.
  if [[ $entry == */ ]] && [ -n "$(git ls-tree -r --name-only "$upstream" -- "$entry")" ]; then
    echo "::error file=$list::$(escape_message "$entry is on $list as a directory the fork owns, and upstream has files in it")"
    fail=1
  fi
done
for file in "${changed[@]}"; do
  listed=false
  # Every line that matches is in use, so a file line under a directory line is not stale.
  for entry in "${entries[@]}"; do
    if [[ $entry == */ && $file == "$entry"* ]] || [[ $file == "$entry" ]]; then
      listed=true
      used[$entry]=1
    fi
  done
  if ! $listed; then
    echo "::error file=$(escape_property "$file")::$(escape_message "$file differs from upstream's main and is not on $list")"
    fail=1
  fi
done
for entry in "${entries[@]}"; do
  if [ -z "${used[$entry]:-}" ]; then
    echo "::error file=$list::$(escape_message "$entry is on $list, and the fork no longer changes it")"
    fail=1
  fi
done
echo "${#changed[@]} changed files, ${#entries[@]} allowlist entries"
exit "$fail"
