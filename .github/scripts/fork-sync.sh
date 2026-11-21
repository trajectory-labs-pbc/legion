#!/usr/bin/env bash
# The weekly sync of this fork (.github/workflows/fork-sync.yaml runs it): merge upstream's main
# into the sync branch, scan the merged tree's workflow files, push, and open or update one pull
# request from the sync branch.
#
# Inputs, from the environment: GH_TOKEN (the sync App's token), APP_SLUG (the App's slug), BASE
# (the branch to merge into), REPOSITORY (<owner>/<name> of this fork) and GITHUB_STEP_SUMMARY.
# It works in the current directory: the merged tree goes to ./work, and the lists it builds sit
# beside it.
#
# Trust. The workflow runs this file from the commit the run is at, which is main, because the
# upstream-sync environment admits no other branch. It runs no script or action from the merged
# tree: it reads that tree's workflow files as data, with yq and jq, and it runs git with no
# system or user configuration and no hooks, so no filter or hook of the runner (git lfs among
# them) runs on that tree.
#
# Tests: .github/scripts/fork-sync.test.sh, which fork-sync-test.yaml runs.
set -euo pipefail
# A failure inside $(...) fails the assignment, so no list comes out empty by mistake.
shopt -s inherit_errexit

export GIT_CONFIG_SYSTEM=/dev/null GIT_CONFIG_GLOBAL=/dev/null
# A file of upstream's tree makes this job download nothing.
export GIT_LFS_SKIP_SMUDGE=1 LC_ALL=C

summary() { printf '%s\n' "$@" >> "$GITHUB_STEP_SUMMARY"; }
# The annotation goes to stderr, so it reaches the log from inside $(...) too.
fail() { echo "::error::$1" >&2; summary "**Failed:** $1"; exit 1; }
# Text from upstream's tree goes into the body inside backticks: drop what could end the span.
clean() { printf '%s' "$1" | tr -d '`<\r\n'; }

# The base reaches this script only through the environment. Refuse anything that is not a
# plain branch name before it names a ref or reaches the body.
if ! [[ $BASE =~ ^[A-Za-z0-9._/-]+$ ]] || [[ $BASE == -* ]] \
  || ! git check-ref-format --branch "$BASE" > /dev/null 2>&1; then
  fail "the base input is not a branch name"
fi
if [ "$BASE" = main ]; then sync=fork-sync; else sync="fork-sync-$BASE"; fi

upstream=$(gh api "repos/$REPOSITORY" --jq '.parent.full_name // empty')
[ -n "$upstream" ] || fail "this repository has no parent to sync from"

git init -q work
cd work
git config core.quotePath false
git config core.hooksPath /dev/null
auth=$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)
echo "::add-mask::$auth"
git config http.https://github.com/.extraheader "AUTHORIZATION: basic $auth"
git remote add origin "https://github.com/$REPOSITORY.git"
git remote add upstream "https://github.com/$upstream.git"
bot_id=$(gh api "users/${APP_SLUG}%5Bbot%5D" --jq .id)
git config user.name "${APP_SLUG}[bot]"
git config user.email "${bot_id}+${APP_SLUG}[bot]@users.noreply.github.com"

status=0
git ls-remote --exit-code --heads origin "refs/heads/$BASE" > /dev/null || status=$?
case $status in
  0) ;;
  2) fail "'$BASE' is not a branch of this repository" ;;
  *) fail "could not list this repository's branches (git exit $status)" ;;
esac
base_ref="refs/remotes/origin/$BASE"
git fetch -q --no-tags origin "+refs/heads/$BASE:$base_ref"
start=$base_ref
sync_head=$(git ls-remote --heads origin "refs/heads/$sync")
if [ -n "$sync_head" ]; then
  git fetch -q --no-tags origin "+refs/heads/$sync:refs/remotes/origin/$sync"
  start="refs/remotes/origin/$sync"
fi
git fetch -q --no-tags upstream '+refs/heads/main:refs/remotes/upstream/main'
up=$(git rev-parse refs/remotes/upstream/main)
short=$(git rev-parse --short=12 "$up")

# Only a pull request from this repository's own branch; another fork may hold a branch of
# the same name.
open_pr=$(gh pr list -R "$REPOSITORY" --head "$sync" --base "$BASE" --state open \
  --json number,isCrossRepository --jq '[.[] | select(.isCrossRepository | not)][0].number // empty')

conflict() {
  local what=$1 paths
  paths=$(git diff --name-only --diff-filter=U)
  git merge --abort
  summary "**Conflict** merging $what into \`$sync\`; nothing was pushed. Conflicting paths:" ''
  while IFS= read -r path; do
    echo "::error file=$(clean "$path" | tr -d ',:')::conflict merging $what into $sync"
    summary "- \`$(clean "$path")\`"
  done <<< "$paths"
  summary '' "Fix it with a commit on \`$sync\`: merge by hand, push, and start this workflow again."
  exit 1
}

git checkout -q -B "$sync" "$start"
if git merge-base --is-ancestor "$up" "$start"; then
  push=false
  echo "upstream main $short is already in $start"
  summary "Upstream's main at \`$short\` is already in \`${start#refs/remotes/origin/}\`; nothing to push."
  if git merge-base --is-ancestor "$up" "$base_ref"; then
    exit 0
  fi
  # The sync branch holds upstream commits the base lacks. Scan it again, since a person
  # may have pushed to it, then rewrite the open pull request's body or open one below.
else
  push=true
  git merge -q -m "chore(sync): merge $BASE into $sync" "$base_ref" || conflict "$BASE"
  git merge -q --no-ff -m "chore(sync): merge upstream main at $short" "$up" \
    || conflict "upstream main at $short"
fi

# Workflow and action files, read as YAML. envs_jq prints each environment a file names
# (a job's `environment:` value, or its `name:`); secrets_jq each secret it reads, a bare
# `secrets` (toJSON(secrets)) and each `secrets:` value (inherit) included. Keys are matched
# in any case, and both print lowercase.
workflow_specs=(':(glob).github/workflows/*.yml' ':(glob).github/workflows/*.yaml')
yaml_specs=("${workflow_specs[@]}" ':(glob)**/action.yml' ':(glob)**/action.yaml')
envs_jq='[.. | objects | to_entries[] | select(.key | ascii_downcase == "environment") | .value
  | if type == "object" then (to_entries[] | select(.key | ascii_downcase == "name") | .value) else . end
  | tostring | gsub("^\\s+|\\s+$"; "") | ascii_downcase] | unique[]'
secrets_jq='[(.. | strings | match("(?<![a-z0-9_])secrets(?![a-z0-9_])(\\s*\\.\\s*[a-z_][a-z0-9_-]*|\\s*\\[[^\\]]*\\])?"; "gi")
    | .string | gsub("\\s"; "") | ascii_downcase),
  (.. | objects | to_entries[] | select(.key | ascii_downcase == "secrets") | select(.value | type == "string")
    | "secrets: " + (.value | ascii_downcase))] | unique[]'
# A file of several YAML documents is read as one array of them.
as_json() { git show "$1:$2" | yq -p=yaml -o=json 'explode(.)' | jq -s .; }
names_of() {
  # Each environment and secret the file <path> names at <rev>; nothing where it is absent.
  git cat-file -e "$1:$2" 2> /dev/null || return 0
  local json
  json=$(as_json "$1" "$2") || fail "could not read $(clean "$2") at $1 as YAML"
  { jq -r "$envs_jq"' | "environment " + .' <<< "$json"; jq -r "$secrets_jq"' | "secret " + .' <<< "$json"; } | sort -u
}

# No other workflow file may name the environment that holds this job's key, in any case
# or spelling; an environment written as an expression is listed for the reviewer.
# Each list of paths is written to a file first, so a git failure stops the run here
# rather than leaving a loop with nothing to read.
git ls-files -z -- "${yaml_specs[@]}" > ../yaml-files
# A job's `uses:` that names another repository's workflow runs that workflow here, with
# this repository's environments.
remote_jq='[.. | objects | select(has("jobs")) | .jobs | objects | to_entries[] | .value
  | objects | .uses | strings | select(startswith("./") | not)] | unique[]'
named='' expressions='' remote=''
while IFS= read -r -d '' path; do
  [ "$path" != .github/workflows/fork-sync.yaml ] || continue
  json=$(as_json HEAD "$path") || fail "could not read $(clean "$path") as YAML"
  if jq -e "any($envs_jq; . == \"upstream-sync\")" <<< "$json" > /dev/null; then
    named+="- \`$(clean "$path")\`"$'\n'
  fi
  values=$(jq -r "$envs_jq"' | select(contains("${{"))' <<< "$json")
  while IFS= read -r value; do
    [ -z "$value" ] || expressions+="- \`$(clean "$path")\`: \`$(clean "$value")\`"$'\n'
  done <<< "$values"
  values=$(jq -r "$remote_jq" <<< "$json")
  while IFS= read -r value; do
    [ -z "$value" ] || remote+="- \`$(clean "$path")\`: \`$(clean "$value")\`"$'\n'
  done <<< "$values"
done < ../yaml-files
if [ -n "$named" ]; then
  summary '**Refused:** these files name the `upstream-sync` environment, which holds the key of this job. This run pushed nothing.' '' "$named"
  echo "::error::a workflow file names the upstream-sync environment; the run summary lists it"
  exit 1
fi

# What a reviewer reads before approving: workflow changes that could reach a secret.
git diff --no-renames -z --name-only --diff-filter=A "$base_ref" HEAD -- "${workflow_specs[@]}" > ../added-files
git diff --no-renames -z --name-only --diff-filter=AM "$base_ref" HEAD -- "${yaml_specs[@]}" > ../changed-yaml-files
added=''
while IFS= read -r -d '' path; do
  added+="- \`$(clean "$path")\`"$'\n'
done < ../added-files
newly_named=''
while IFS= read -r -d '' path; do
  old=$(names_of "$base_ref" "$path")
  new=$(names_of HEAD "$path")
  new=$(comm -13 <(printf '%s\n' "$old") <(printf '%s\n' "$new") | sed '/^$/d')
  [ -n "$new" ] || continue
  newly_named+="- \`$(clean "$path")\`: $(while IFS= read -r n; do printf '`%s` ' "$(clean "$n")"; done <<< "$new")"$'\n'
done < ../changed-yaml-files
# The fork's own changes: what the base changed since the last upstream commit it holds.
# A .gitattributes file can change how later merges resolve, so it is listed too.
fork_changed=$(git diff --no-renames --name-only "$(git merge-base "$base_ref" "$up")" "$base_ref")
changed=$(git diff --no-renames --name-only "$base_ref" HEAD)
watched=$(comm -12 <(printf '%s\n' "$changed" | sort -u) <({
  printf '%s\n' .github/workflows/worker-image.yaml .github/workflows/release-envoy-listener.yaml "$fork_changed"
  printf '%s\n' "$changed" | awk '/(^|\/)\.gitattributes$/'
} | sort -u) | sed '/^$/d' | while IFS= read -r path; do printf -- '- `%s`\n' "$(clean "$path")"; done)

list() { if [ -n "$1" ]; then printf '%s\n' "${1%$'\n'}"; else echo '- none'; fi; }
{
  echo "Merges upstream's \`main\` at $short into \`$BASE\`."
  echo
  echo "Approve it after reading its CI and the lists below, and merge it with a **merge commit**. A squash or a rebase leaves \`$BASE\` without upstream's commits, and the next sync cannot fast-forward \`$sync\`."
  echo
  echo '## Workflow changes to read'
  echo
  echo '### Workflows this sync adds'
  list "$added"
  echo
  echo '### Workflow and action files that newly name an environment or a secret'
  list "$newly_named"
  echo
  echo '### Environments written as an expression'
  list "$expressions"
  echo
  echo '### Workflows called from another repository or ref'
  echo
  echo 'Each runs with the environments of this repository, and this run cannot read it. Check that none names `upstream-sync`.'
  echo
  list "$remote"
  echo
  echo '### Shared build workflows, .gitattributes files and files the fork changed, which this sync changes too'
  list "$watched"
  echo
  echo '## Commits that upstream did not write'
  echo
  echo "The \`pr-title\` check reads every commit of this pull request, so it reports upstream's own commit text under \`commits:\`. Before merging, check the commits that are on neither upstream's \`main\` nor \`$BASE\`, from a checkout of \`origin/$sync\`:"
  echo
  echo '```bash'
  echo "git fetch origin $BASE $sync"
  echo "git fetch https://github.com/$upstream.git main:refs/remotes/upstream/main"
  echo 'commits=$(mktemp)'
  echo "git log --format='%H%n%an <%ae>%n%cn <%ce>%n%B' origin/$BASE..origin/$sync --not upstream/main > \"\$commits\""
  echo '.github/scripts/check-private-names.sh "$commits"'
  echo '```'
} > ../body.md

if $push; then
  git push -q origin "HEAD:refs/heads/$sync"
  summary "Pushed \`$sync\`."
fi
title="chore(sync): merge upstream main at $short"
if [ -n "$open_pr" ]; then
  jq -n --arg title "$title" --rawfile body ../body.md '{title: $title, body: $body}' \
    | gh api -X PATCH "repos/$REPOSITORY/pulls/$open_pr" --input - > /dev/null
  summary "Updated pull request #$open_pr."
else
  number=$(jq -n --arg title "$title" --arg head "$sync" --arg base "$BASE" --rawfile body ../body.md \
    '{title: $title, head: $head, base: $base, body: $body}' \
    | gh api -X POST "repos/$REPOSITORY/pulls" --input - --jq .number)
  summary "Opened pull request #$number."
fi
