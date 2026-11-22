#!/usr/bin/env bash
# Tests for `fork-sync.sh`, the weekly sync of this fork.
#
# Each case builds two bare repositories on disk, this fork and upstream, and runs the script as
# the workflow does, with git's https addresses for both rewritten to those directories and a stub
# gh that answers the script's reads and records each call. The cases cover a first sync, a rerun,
# an upstream that moved on, a commit a person pushed to the sync branch, a conflict, each spelling
# of the refused environment, the lists of the body, bad bases, a file that is not YAML, and a tree
# that asks for git lfs.
#
# Run from anywhere: .github/scripts/fork-sync.test.sh
# CI runs it in fork-sync-test.yaml.
set -euo pipefail
shopt -s inherit_errexit

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# shellcheck source=.github/scripts/test-lib.sh
source "$script_dir/test-lib.sh"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# The cases' own commits read no configuration of the machine they run on.
export GIT_CONFIG_SYSTEM=/dev/null GIT_CONFIG_GLOBAL=/dev/null
export GIT_AUTHOR_NAME=Person GIT_AUTHOR_EMAIL=person@example.com
export GIT_COMMITTER_NAME=Person GIT_COMMITTER_EMAIL=person@example.com

mkdir "$work/bin"
cat > "$work/bin/gh" << 'STUB'
#!/usr/bin/env bash
echo "gh $*" >> "$STUB_LOG"
case "$*" in
  "api repos/fork/legion --jq"*) echo up/legion ;;
  "api users/"*) echo 12345 ;;
  "pr list"*)
    # The open pull requests are $STUB_PR, a JSON list, or none; the call's own --jq reads them.
    while [ $# -gt 0 ] && [ "$1" != --jq ]; do shift; done
    if [ -e "$STUB_PR" ]; then jq -r "$2" "$STUB_PR"; else jq -r "$2" <<< '[]'; fi ;;
  "api -X POST"*) cat > "$STUB_DIR/post.json"; echo 7 ;;
  "api -X PATCH"*) cat > "$STUB_DIR/patch.json" ;;
  *) echo "unstubbed: $*" >&2; exit 9 ;;
esac
STUB
chmod +x "$work/bin/gh"

workflow='on: push
jobs:
  build:
    runs-on: ubuntu-24.04
    steps:
      - run: echo build
'

# commit <clone> <message> <path> <text> [<path> <text>]...: write each file and commit them.
commit() {
  local clone=$1 message=$2
  shift 2
  while [ $# -gt 0 ]; do
    mkdir -p "$(dirname "$clone/$1")"
    printf '%s' "$2" > "$clone/$1"
    git -C "$clone" add -- "$1"
    shift 2
  done
  git -C "$clone" commit -q -m "$message"
}

# setup <dir>: upstream's main and this fork's main, which holds upstream's first commit and one
# commit of the fork's own, with a fork-sync.yaml that names upstream-sync as the real one does;
# then upstream moves on with a commit the fork lacks.
setup() {
  local dir=$1
  mkdir -p "$dir"
  git init -q --bare -b main "$dir/upstream.git"
  git init -q --bare -b main "$dir/origin.git"
  git init -q -b main "$dir/up"
  commit "$dir/up" "first" README.md $'upstream\n' .github/workflows/build.yaml "$workflow"
  git -C "$dir/up" push -q "$dir/upstream.git" main
  git clone -q "$dir/upstream.git" "$dir/fork"
  commit "$dir/fork" "fork only" FORK.md $'the fork\n' .github/workflows/fork-sync.yaml \
    $'on: workflow_dispatch\njobs:\n  sync:\n    runs-on: ubuntu-24.04\n    environment: upstream-sync\n    steps:\n      - run: echo\n'
  git -C "$dir/fork" push -q "$dir/origin.git" main
  commit "$dir/up" "second" docs/a.md $'a\n'
  git -C "$dir/up" push -q "$dir/upstream.git" main
}

# up_commit <dir> <message> <path> <text>...: upstream moves on.
up_commit() {
  local dir=$1
  shift
  commit "$dir/up" "$@"
  git -C "$dir/up" push -q "$dir/upstream.git" main
}

# pr_open <dir> [cross]: one pull request is open from the sync branch, from this repository's
# own branch, or with cross=true from another fork's branch of the same name.
pr_open() { printf '[{"number":7,"isCrossRepository":%s}]\n' "${2:-false}" > "$1/pr-open"; }

# run_sync <dir> <run> [base]: one run of the script, in <dir>/<run>. Sets status.
run_sync() {
  local dir=$1 run=$2 base=${3:-main}
  mkdir -p "$dir/$run"
  set +e
  (
    cd "$dir/$run"
    env -i PATH="$work/bin:$PATH" HOME="$dir/$run" GH_TOKEN=token APP_SLUG=syncer BASE="$base" \
      REPOSITORY=fork/legion GITHUB_STEP_SUMMARY="$dir/$run/summary.md" STUB_LOG="$dir/$run/gh.log" \
      STUB_DIR="$dir/$run" STUB_PR="$dir/pr-open" \
      GIT_CONFIG_COUNT=2 \
      GIT_CONFIG_KEY_0="url.$dir/origin.git.insteadOf" GIT_CONFIG_VALUE_0=https://github.com/fork/legion.git \
      GIT_CONFIG_KEY_1="url.$dir/upstream.git.insteadOf" GIT_CONFIG_VALUE_1=https://github.com/up/legion.git \
      timeout 120 "$script_dir/fork-sync.sh" > "$dir/$run/out.log" 2>&1
  )
  status=$?
  set -e
}

# sync_head <dir> [branch]: the sync branch's sha on this fork, or "none".
sync_head() { git --git-dir="$1/origin.git" rev-parse -q --verify "refs/heads/${2:-fork-sync}" || echo none; }
# up_head <dir>: upstream's main.
up_head() { git --git-dir="$1/upstream.git" rev-parse main; }
# has <file>: true/false for check.
has() { [ -e "$1" ] && echo true || echo false; }
# text <file>: the file, or nothing.
text() { cat "$1" 2> /dev/null || true; }
# body <json file>: the pull request body the script sent.
body() { jq -r .body "$1" 2> /dev/null || true; }
# lacks <text> <regex>: true when the text has no match, for check.
lacks() { grep -q -- "$2" <<< "$1" && echo false || echo true; }

echo "first sync, rerun, upstream moves on, merge"
d=$work/flow
setup "$d"
run_sync "$d" first
check "the first sync passes" "$(is "$status" 0)"
check "it pushes the sync branch" \
  "$([ "$(sync_head "$d")" != none ] && git --git-dir="$d/origin.git" merge-base --is-ancestor "$(up_head "$d")" fork-sync && echo true || echo false)"
check "the merge commit is the App's" \
  "$(is "$(git --git-dir="$d/origin.git" log -1 --format='%an <%ae>' fork-sync)" 'syncer[bot] <12345+syncer[bot]@users.noreply.github.com>')"
check "it opens a pull request from the sync branch to main" \
  "$(is "$(jq -r '.head + " " + .base' "$d/first/post.json")" 'fork-sync main')"
check "the title names upstream's commit" \
  "$(contains "$(jq -r .title "$d/first/post.json")" "^chore(sync): merge upstream main at $(git --git-dir="$d/upstream.git" rev-parse --short=12 main)$")"
first_head=$(sync_head "$d")
run_sync "$d" reopen
check "a run with no pull request open opens one and pushes nothing" \
  "$(is "$status $(sync_head "$d") $(has "$d/reopen/post.json")" "0 $first_head true")"
pr_open "$d"
run_sync "$d" rerun
check "a rerun with the pull request open passes" "$(is "$status" 0)"
check "it pushes nothing" "$(is "$(sync_head "$d")" "$first_head")"
check "it updates the pull request and opens none" \
  "$(is "$(has "$d/rerun/patch.json") $(has "$d/rerun/post.json")" 'true false')"
up_commit "$d" "third" docs/b.md $'b\n'
run_sync "$d" advance
check "a run after upstream moved on passes" "$(is "$status" 0)"
check "it fast-forwards the sync branch to upstream's new commit" \
  "$(git --git-dir="$d/origin.git" merge-base --is-ancestor "$first_head" fork-sync \
    && git --git-dir="$d/origin.git" merge-base --is-ancestor "$(up_head "$d")" fork-sync && echo true || echo false)"
check "it updates the open pull request" "$(has "$d/advance/patch.json")"
git --git-dir="$d/origin.git" update-ref refs/heads/main "$(sync_head "$d")"
rm "$d/pr-open"
run_sync "$d" merged
check "a run after the merge passes" "$(is "$status" 0)"
check "it neither opens nor updates a pull request" \
  "$(is "$(has "$d/merged/post.json") $(has "$d/merged/patch.json")" 'false false')"

echo "an open pull request from another fork's branch of the same name"
d=$work/cross
setup "$d"
pr_open "$d" true
run_sync "$d" run
check "the run opens a pull request of its own and updates none" \
  "$(is "$status $(has "$d/run/post.json") $(has "$d/run/patch.json")" '0 true false')"

echo "a commit a person pushed to the open sync branch"
d=$work/person
setup "$d"
run_sync "$d" first
pr_open "$d"
git clone -q "$d/origin.git" "$d/person"
git -C "$d/person" checkout -q fork-sync
commit "$d/person" "add a workflow" .github/workflows/evil.yaml $'on: push\njobs:\n  x:\n    runs-on: ubuntu-24.04\n    environment: upstream-sync\n    steps:\n      - run: echo\n'
git -C "$d/person" push -q origin fork-sync
person_head=$(sync_head "$d")
run_sync "$d" again
check "the run fails" "$(is "$status" 1)"
check "it refuses the file" "$(contains "$(text "$d/again/summary.md")" '^\*\*Refused:\*\*.*upstream-sync')"
check "it names the file" "$(contains "$(text "$d/again/summary.md")" 'evil.yaml')"
check "it pushes nothing and leaves the body as it was" \
  "$(is "$(sync_head "$d") $(has "$d/again/patch.json")" "$person_head false")"
git -C "$d/person" rm -q .github/workflows/evil.yaml
commit "$d/person" "read a secret" .github/workflows/okay.yaml $'on: push\njobs:\n  x:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: "true"\n        env:\n          K: ${{ secrets.NEWONE }}\n'
git -C "$d/person" push -q origin fork-sync
run_sync "$d" clean
check "with the file replaced, the run passes" "$(is "$status" 0)"
check "it rewrites the body, which lists the secret the new file reads" \
  "$(contains "$(body "$d/clean/patch.json")" 'okay.yaml.*secret secrets.newone')"

echo "a conflict"
d=$work/conflict
setup "$d"
commit "$d/fork" "fork readme" README.md $'the fork\n'
git -C "$d/fork" push -q "$d/origin.git" main
up_commit "$d" "upstream readme" README.md $'upstream, again\n'
run_sync "$d" run
check "the run fails" "$(is "$status" 1)"
check "it names the conflicting path" "$(contains "$(text "$d/run/summary.md")" 'README.md')"
check "it pushes nothing and opens nothing" \
  "$(is "$(sync_head "$d") $(has "$d/run/post.json")" 'none false')"

echo "each spelling of the refused environment"
n=0
while IFS='|' read -r path yaml; do
  n=$((n + 1))
  d=$work/refuse-$n
  setup "$d"
  up_commit "$d" "spelling $n" "$path" "$(printf '%b' "$yaml")"
  run_sync "$d" run
  check "refused, pushing nothing: $yaml" "$(is "$status $(sync_head "$d")" '1 none')"
  check "refuses it for the environment" "$(contains "$(text "$d/run/summary.md")" '^\*\*Refused:\*\*.*upstream-sync')"
  check "names $path" "$(contains "$(text "$d/run/summary.md")" "$(basename "$path")")"
done << 'CASES'
.github/workflows/a.yaml|jobs:\n  x:\n    environment: upstream-sync\n
.github/workflows/b.yml|jobs:\n  x:\n    "Environment": "Upstream-Sync"\n
.github/workflows/c.yaml|jobs:\n  x:\n    environment: {name: upstream-sync}\n
.github/workflows/d.yaml|jobs:\n  x:\n    environment:\n      name: ' upstream-sync '\n
.github/workflows/e.yaml|x: &e upstream-sync\njobs:\n  x:\n    environment: *e\n
.github/workflows/f.yaml|on: push\n---\njobs:\n  x:\n    environment: upstream-sync\n
.github/workflows/g.yaml|jobs:\n  x:\n    environment: "upstream\\x2dsync"\n
.github/workflows/h.yaml|jobs:\n  x:\n    "environment": {url: "https://example.com", "name": upstream-sync}\n
tools/x/action.yml|runs:\n  using: composite\n  environment: upstream-sync\n
CASES

echo "what the body lists"
d=$work/lists
setup "$d"
up_commit "$d" "workflows" \
  .github/workflows/expr.yaml $'jobs:\n  x:\n    environment: ${{ inputs.target }}\n' \
  .github/workflows/call.yaml $'jobs:\n  x:\n    uses: other/repo/.github/workflows/w.yaml@v1\n' \
  .github/workflows/build.yaml $'on: push\njobs:\n  build:\n    runs-on: ubuntu-24.04\n    environment: release\n    steps:\n      - run: "true"\n        env:\n          K: ${{ secrets.KEY }}\n'
run_sync "$d" run
b=$(body "$d/run/post.json")
check "the run passes" "$(is "$status" 0)"
check "the workflows it adds" "$(contains "$b" '^- `.github/workflows/expr.yaml`$')"
check "a file that newly names an environment and a secret" \
  "$(contains "$b" 'build.yaml`: `environment release` `secret secrets.key`')"
check "an environment written as an expression" "$(contains "$b" 'expr.yaml`: `${{ inputs.target }}`')"
check "a workflow called from another repository" "$(contains "$b" 'call.yaml`: `other/repo/.github/workflows/w.yaml@v1`')"
check "a shared build workflow this sync leaves alone is not listed" "$(lacks "$b" 'worker-image')"

echo "a renamed workflow, each spelling of a secret, and file names the body cannot hold"
d=$work/lists-more
setup "$d"
git -C "$d/up" mv .github/workflows/build.yaml .github/workflows/renamed.yaml
# shellcheck disable=SC2016 # each ${{ }} is workflow text, not an expansion
up_commit "$d" "more workflows" \
  .github/workflows/renamed.yaml "$workflow"$'    env:\n      K: ${{ secrets.MOVED }}\n' \
  .github/workflows/sec.yaml $'on: push\njobs:\n  x:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: "true"\n        env:\n          A: ${{ secrets.A }}\n          B: ${{ secrets[\'B\'] }}\n          C: ${{ secrets . C }}\n          D: ${{ toJSON(secrets) }}\n  y:\n    uses: ./.github/workflows/sec.yaml\n    secrets: inherit\n' \
  $'.github/workflows/caf\xc3\xa9.yaml' "$workflow" \
  '.github/workflows/a`<b.yaml' "$workflow"
run_sync "$d" run
b=$(body "$d/run/post.json")
check "the run passes" "$(is "$status" 0)"
check "a renamed workflow is listed as added" "$(contains "$b" '^- `.github/workflows/renamed.yaml`$')"
check "with the secret it gains" "$(contains "$b" 'renamed.yaml`: `secret secrets.moved`')"
for name in 'secrets.a' "secrets\\['b'\\]" 'secrets.c' 'secrets' 'secrets: inherit'; do
  check "a secret spelled $name" "$(contains "$b" "sec.yaml\`:.*\`secret $name\` ")"
done
check "a file name that is not ASCII" "$(contains "$b" $'^- `.github/workflows/caf\xc3\xa9.yaml`$')"
check "a file name with a backtick and a <, without them" "$(contains "$b" '^- `.github/workflows/ab.yaml`$')"

echo "bases"
d=$work/bases
setup "$d"
i=0
# shellcheck disable=SC2016 # '$(id)' is a base to refuse, not an expansion
for base in -x 'a b' 'a;b' 'a..b' $'a\nb' '$(id)' '@{-1}' HEAD; do
  i=$((i + 1))
  run_sync "$d" "bad-$i" "$base"
  check "refused as no branch name: $base" \
    "$(contains "$(text "$d/bad-$i/out.log")" 'the base input is not a branch name')"
done
run_sync "$d" missing nope
check "refused as no branch of this repository: nope" \
  "$(contains "$(text "$d/missing/out.log")" "'nope' is not a branch of this repository")"
check "no base pushed anything" "$(is "$(sync_head "$d") $(sync_head "$d" fork-sync-nope)" 'none none')"
git --git-dir="$d/origin.git" update-ref refs/heads/trial main
run_sync "$d" trial trial
check "another base keeps a sync branch of its own" \
  "$(is "$status $(jq -r '.head + " " + .base' "$d/trial/post.json")" '0 fork-sync-trial trial')"

echo "a file that is not YAML"
d=$work/yaml
setup "$d"
up_commit "$d" "broken" tools/y/action.yml $'runs: [\n'
run_sync "$d" run
check "the run fails, pushing nothing" "$(is "$status $(sync_head "$d")" '1 none')"
check "the log names the file" "$(contains "$(text "$d/run/out.log")" '::error::could not read tools/y/action.yml as YAML')"

echo "a tree that asks for git lfs"
d=$work/lfs
setup "$d"
up_commit "$d" "lfs" .gitattributes $'*.bin filter=lfs diff=lfs merge=lfs -text\n' \
  .lfsconfig $'[lfs]\n\turl = http://127.0.0.1:9/lfs\n' \
  a.bin $'version https://git-lfs.github.com/spec/v1\noid sha256:0000000000000000000000000000000000000000000000000000000000000000\nsize 1\n'
run_sync "$d" run
check "the run passes and pushes" "$(is "$status $([ "$(sync_head "$d")" != none ] && echo pushed)" '0 pushed')"
check "nothing asked the tree's lfs address" "$(lacks "$(text "$d/run/out.log")" '127.0.0.1')"
check "the body lists the .gitattributes file" "$(contains "$(body "$d/run/post.json")" '^- `.gitattributes`$')"

summary "the fork sync"
