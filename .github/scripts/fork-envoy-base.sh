#!/usr/bin/env bash
# Prints the upstream-built envoy image the fork's envoy image derives from, by digest.
#   fork-envoy-base.sh <event> <commit> <image>     needs GH_TOKEN and GITHUB_REPOSITORY
# On a push or a dispatch it is the image release-envoy-listener.yaml built for <commit> itself, so
# the fork's image serves the commit it names; the script waits until one of the commit's runs has
# succeeded or all have ended. A commit that workflow has no run for on main, or only cancelled ones, has no upstream
# image: the script says so in a notice and exits 3. A failed run fails the script. On a pull
# request, which that workflow does not run for, it is the image of the newest first-parent
# ancestor whose run on main succeeded: newer ancestors whose run failed, was cancelled or is still
# going are passed over, the last kind named in the notice that says the image is older than the
# pull request. The tag can move, so the digest is used only once its attestation shows that
# workflow built it on main from the commit the tag names.
set -euo pipefail
shopt -s inherit_errexit
# shellcheck source=.github/scripts/gh-read.sh
source "$(dirname "${BASH_SOURCE[0]}")/gh-read.sh"
event=$1
commit=$2
image=$3
listener=.github/workflows/release-envoy-listener.yaml
runs=repos/$GITHUB_REPOSITORY/actions/workflows/${listener##*/}/runs

# say <text>: a notice in the log and a line in the run's summary.
say() {
  echo "::notice::$1" >&2
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$1" >>"$GITHUB_STEP_SUMMARY"; fi
}

runs_for() {
  gh_read gh api "$runs?head_sha=$1&branch=main" --jq '[.workflow_runs[] | {id, status, conclusion}]'
}

# A commit's listener runs on main, of any event, once one succeeded or every one has ended.
# GitHub creates every run of one push in the same second, before any of their jobs starts, so a
# commit with no listener run when this job runs gets one only by hand. `gh run watch` exits 0
# however the run ends; it fails only when it cannot watch, and that fails the script.
settled_runs() {
  local found id
  while :; do
    found=$(runs_for "$1")
    if jq -e 'any(.conclusion == "success") or all(.status == "completed")' <<<"$found" >/dev/null; then
      echo "$found"
      return
    fi
    id=$(jq -r 'map(select(.status != "completed")) | max_by(.id).id' <<<"$found")
    echo "waiting for $listener run $id ($1)" >&2
    gh run watch "$id" --repo "$GITHUB_REPOSITORY" --interval 60 >&2
  done
}

if [ "$event" = pull_request ]; then
  # One read of main's newest runs. Then, along this commit's first-parent line, the first commit
  # with a successful run, and the newer ones whose run is still going.
  found=$(gh_read gh api "$runs?branch=main&per_page=100" \
    --jq '[.workflow_runs[] | {sha: .head_sha, status, conclusion}]')
  # Prints that commit, then the newer ones, on one line; nothing when no commit has one.
  # The line comes on stdin: a long history passes the kernel's limit on one argument.
  picked=$(git rev-list --first-parent "$commit" | jq -rRn --argjson runs "$found" '
    def ran(f): . as $sha | $runs | any(.sha == $sha and f);
    [inputs] as $line
    | (first($line | to_entries[] | select(.value | ran(.conclusion == "success")) | .key) // null) as $at
    | if $at == null then empty
      else [$line[$at]] + ($line[:$at] | map(select(ran(.status != "completed")))) | join(" ")
      end')
  if [ -z "$picked" ]; then
    echo "::error::no first-parent ancestor of $commit has a successful $listener run among the last 100 on main; rebase onto main, or raise the checkout's fetch-depth if its history ends first" >&2
    exit 1
  fi
  read -r commit still <<<"$picked"
  going=""
  if [ -n "$still" ]; then going=" Newer commits whose run is still going: $still."; fi
  say "The smoke build runs on the upstream image of $commit, the newest commit on main whose $listener run succeeded. That image is older than this pull request, so it holds none of the pull request's changes to upstream's image inputs; the push run on main builds on the merged commit's own image.$going"
else
  found=$(settled_runs "$commit")
  if ! jq -e 'any(.conclusion == "success")' <<<"$found" >/dev/null; then
    id=$(jq -r 'map(select(.conclusion != "cancelled")) | max_by(.id).id // empty' <<<"$found")
    if [ -n "$id" ]; then
      echo "::error::$listener run $id for $commit did not succeed, so its image is not there to build on; rerun it (gh run rerun $id --failed --repo $GITHUB_REPOSITORY), then rerun this workflow" >&2
      exit 1
    fi
    if [ "$found" = "[]" ]; then
      why="$listener has no run for it on main"
    else
      why="its $listener run was cancelled, usually because a later push replaced it"
    fi
    say "No -tl image for $commit: $why, so there is no upstream image of this commit to build on."
    exit 3
  fi
fi

if ! manifest=$(docker buildx imagetools inspect "$image:$commit" --format '{{json .Manifest}}') ||
  ! digest=$(jq -er '.digest | select(test("^sha256:[0-9a-f]{64}$"))' <<<"$manifest"); then
  echo "::error::could not read the digest of $image:$commit, the image $listener built for that commit" >&2
  exit 1
fi
if ! gh attestation verify "oci://$image@$digest" --repo "$GITHUB_REPOSITORY" \
  --signer-workflow "$GITHUB_REPOSITORY/$listener" --source-ref refs/heads/main \
  --source-digest "$commit" --deny-self-hosted-runners >&2; then
  echo "::error::$image@$digest, tagged $commit, has no attestation from $listener on main for that commit, so this workflow will not build on it" >&2
  exit 1
fi
echo "$image@$digest"
