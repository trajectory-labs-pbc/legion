#!/usr/bin/env bash
# Tests for `check-fork-allowlist.sh`: each file the fork changes against upstream's main is on the
# list, and each line of the list names a file the fork still changes.
#
# Each case builds a small repository under a temporary directory: one commit that stands for
# upstream's main, tagged `up`, and the fork's commits on top. The real script is symlinked into
# it, so the code under test is the file CI runs. The list is written to the working tree and not
# committed, so a case names only the files it changes.
#
# Run from anywhere: .github/scripts/check-fork-allowlist.test.sh
# CI runs it in fork-checks.yaml.
set -euo pipefail
shopt -s inherit_errexit

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
check_script="$script_dir/check-fork-allowlist.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# shellcheck source=.github/scripts/test-lib.sh
source "$script_dir/test-lib.sh"

# The cases' own commits read no configuration of the machine they run on.
export GIT_CONFIG_SYSTEM=/dev/null GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME=Person GIT_AUTHOR_EMAIL=person@example.com
export GIT_COMMITTER_NAME=Person GIT_COMMITTER_EMAIL=person@example.com

# change <root> <message> <path>...: write each file and commit them.
change() {
  local root=$1 message=$2 path
  shift 2
  for path in "$@"; do
    mkdir -p "$(dirname "$root/$path")"
    echo "$message" > "$root/$path"
    git -C "$root" add -- "$path"
  done
  git -C "$root" commit -q -m "$message"
}

# fixture <name>: a repository whose commit `up` holds upstream's files. Echoes its root.
fixture() {
  local root="$work/$1"
  if [ -e "$root" ]; then
    echo "  FAIL: the fixture name '$1' is already taken by an earlier case" >&2
    return 1
  fi
  git init -q -b main "$root"
  change "$root" upstream README.md packages/daemon/main.go packages/daemon/ghbranch/branch.go
  git -C "$root" tag up
  mkdir -p "$root/.github/scripts"
  ln -s "$check_script" "$root/.github/scripts/check-fork-allowlist.sh"
  echo "$root"
}

# list <root> <line>...: write the allowlist, one line for each argument.
list() {
  local root=$1
  shift
  printf '%s\n' "$@" > "$root/.github/fork-allowlist.txt"
}

run_check() {
  local root=$1
  set +e
  out=$("$root/.github/scripts/check-fork-allowlist.sh" up 2>&1)
  status=$?
  set -e
}

echo "case: each changed file is listed, by its name or by its directory"
root=$(fixture green)
change "$root" fork packages/daemon/ghbranch/branch.go packages/app/src/index.ts packages/app/README.md
list "$root" '# A comment.' '' 'packages/daemon/ghbranch/branch.go  # a fix' 'packages/app/'
run_check "$root"
check "exits 0" "$(is "$status" 0)"
check "counts the files and the lines" "$(is "$out" '3 changed files, 2 allowlist entries')"

echo "case: upstream's main moved on after the fork's last merge of it"
git -C "$root" checkout -q -b upstream-main up
change "$root" 'upstream moves on' packages/daemon/later.go
git -C "$root" tag -f up > /dev/null
git -C "$root" checkout -q main
run_check "$root"
check "upstream's own new file is not the fork's change" "$(is "$status" 0)"

echo "case: a changed file that is not listed"
root=$(fixture unlisted)
change "$root" fork packages/daemon/main.go packages/app/index.ts
list "$root" 'packages/app/'
run_check "$root"
check "fails" "$(is "$status" 1)"
check "names the file" \
  "$(contains "$out" "^::error file=packages/daemon/main.go::packages/daemon/main.go differs from upstream's main and is not on")"
check "names nothing else" "$(is "$(grep -c '^::error' <<< "$out")" 1)"

echo "case: a line the fork no longer changes"
root=$(fixture stale)
change "$root" fork packages/app/index.ts
list "$root" 'packages/app/' 'packages/daemon/main.go'
run_check "$root"
check "fails" "$(is "$status" 1)"
check "names the line" \
  "$(contains "$out" '^::error file=.github/fork-allowlist.txt::packages/daemon/main.go is on .*no longer changes it')"
check "names nothing else" "$(is "$(grep -c '^::error' <<< "$out")" 1)"

echo "case: a directory line does not match a sibling whose name starts the same"
root=$(fixture sibling)
change "$root" fork packages/appendix/index.ts
list "$root" 'packages/app/'
run_check "$root"
check "fails" "$(is "$status" 1)"
check "the sibling's file is not listed" "$(contains "$out" 'packages/appendix/index.ts differs')"
check "the line is not used" "$(contains "$out" 'packages/app/ is on ')"

echo "case: a directory line that names a directory of upstream's"
root=$(fixture upstream-directory)
change "$root" fork packages/daemon/ghbranch/branch.go
list "$root" 'packages/daemon/'
run_check "$root"
check "fails" "$(is "$status" 1)"
check "names the line" \
  "$(contains "$out" '^::error file=.github/fork-allowlist.txt::packages/daemon/ is on .*upstream has files in it')"
check "names nothing else" "$(is "$(grep -c '^::error' <<< "$out")" 1)"

echo "case: a file line under a directory line"
root=$(fixture overlap)
change "$root" fork packages/app/index.ts packages/app/README.md
list "$root" 'packages/app/' 'packages/app/index.ts'
run_check "$root"
check "both lines are in use" "$(is "$status" 0)"

echo "case: a path that git would quote"
root=$(fixture quoted)
accented=$'docs/caf\303\251.md'
change "$root" fork "$accented"
list "$root" "$accented"
run_check "$root"
check "matches its line as written" "$(is "$status" 0)"

echo "case: a list with no lines, and a fork that changes a file"
root=$(fixture empty-list)
change "$root" fork packages/app/index.ts
list "$root" "# Only a comment." ""
run_check "$root"
check "fails" "$(is "$status" 1)"
check "names the file" "$(contains "$out" "^::error file=packages/app/index.ts::")"
check "counts no line" "$(contains "$out" "^1 changed files, 0 allowlist entries$")"

echo "case: a fork that changes nothing"
root=$(fixture empty-diff)
list "$root" "# Only a comment."
run_check "$root"
check "passes" "$(is "$status" 0)"
check "counts no file" "$(is "$out" "0 changed files, 0 allowlist entries")"

echo "case: a path that holds a comma or a colon"
root=$(fixture property)
change "$root" fork "docs/a,b:c.md"
list "$root" "packages/app/index.ts"
change "$root" more packages/app/index.ts
run_check "$root"
check "fails" "$(is "$status" 1)"
check "the annotation's file property holds neither" \
  "$(contains "$out" "^::error file=docs/abc.md::docs/a,b:c.md differs")"

echo "case: a line with white space before the path"
root=$(fixture indented)
change "$root" fork packages/app/index.ts
list "$root" "  packages/app/index.ts"
run_check "$root"
check "matches the file" "$(is "$status" 0)"

summary "check-fork-allowlist.sh"
