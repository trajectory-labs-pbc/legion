#!/usr/bin/env bash
# Prints the upstream-built envoy image the fork's envoy image derives from, by digest.
#   fork-envoy-base.sh <event> <commit> <image>     needs GH_TOKEN and GITHUB_REPOSITORY
# On a push or a dispatch it is the image release-envoy-listener.yaml built for <commit> itself, so
# the fork's image serves the commit it names. A commit that workflow has no run for on main, or
# only cancelled ones, has no upstream image: the script says so in a notice and exits 3. On a pull
# request, which that workflow does not run for, it is the image of the newest first-parent
# ancestor that has one, and the script fails when upstream's inputs of that image differ between
# the ancestor and <commit>. A pull request that changes only the listener's own file gets a notice
# and exit 3 instead: the push run on main tests that change. The tag can move, so the digest is used only once its attestation
# shows that workflow built it on main from the commit the tag names.
set -euo pipefail
event=$1
commit=$2
image=$3
listener=.github/workflows/release-envoy-listener.yaml

runs_for() {
  gh api "repos/$GITHUB_REPOSITORY/actions/workflows/release-envoy-listener.yaml/runs?head_sha=$1&branch=main" \
    --jq '[.workflow_runs[] | {id, status, conclusion}]'
}

# A commit's listener runs on main, of any event, after the wait for one that is still going.
# GitHub creates every run of one push in the same second, before any of their jobs starts, so a
# commit with no listener run when this job runs gets one only by hand.
settled_runs() {
  local runs id
  runs=$(runs_for "$1")
  if jq -e 'any(.conclusion == "success") or all(.status == "completed")' <<<"$runs" >/dev/null; then
    echo "$runs"
    return
  fi
  id=$(jq -r 'map(select(.status != "completed")) | max_by(.id).id' <<<"$runs")
  echo "waiting for release-envoy-listener.yaml run $id ($1)" >&2
  # The runs read after the wait say how it ended; a later push cancels a run that still waits.
  gh run watch "$id" --repo "$GITHUB_REPOSITORY" --interval 60 >&2 || true
  runs_for "$1"
}
succeeded() { jq -e 'any(.conclusion == "success")' <<<"$1" >/dev/null; }

# The listener's on.push.paths as git pathspecs, up to the lines the fork added for its own image.
upstream_inputs() {
  awk '
    /^    paths:/ { on = 1; next }
    on && (/^      # The fork/ || !/^      /) { exit }
    on && $1 == "-" {
      path = $2
      gsub(/"/, "", path)
      print (sub(/^!/, "", path) ? ":(glob,exclude)" : ":(glob)") path
    }
  ' "$listener"
}

if [ "$event" = pull_request ]; then
  built=$commit
  while :; do
    runs=$(settled_runs "$commit")
    if succeeded "$runs"; then break; fi
    if ! commit=$(git rev-parse -q --verify "$commit^1^{commit}"); then
      echo "::error::the checkout's history ends before any commit release-envoy-listener.yaml built an image for; raise the checkout's fetch-depth" >&2
      exit 1
    fi
  done
  mapfile -t inputs < <(upstream_inputs)
  if [ "${#inputs[@]}" -eq 0 ]; then
    echo "::error::$listener has no on.push.paths list to compare $commit and $built with" >&2
    exit 1
  fi
  changed=$(git diff --name-only "$commit" "$built" -- "${inputs[@]}")
  if [ "$changed" = "$listener" ]; then
    notice="No smoke build: this pull request changes $listener and no other input of upstream's image, so main's image cannot show the change. The push run on main tests it after the merge."
    echo "::notice::$notice" >&2
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$notice" >>"$GITHUB_STEP_SUMMARY"; fi
    exit 3
  fi
  if [ -n "$changed" ]; then
    echo "::error::upstream's envoy image inputs differ between $commit, the newest commit on main with an upstream image, and this pull request's merge commit, so this smoke build cannot test the pull request's own upstream change; main builds that image after the merge. Changed: $(tr '\n' ' ' <<<"$changed")" >&2
    exit 1
  fi
else
  runs=$(settled_runs "$commit")
  if ! succeeded "$runs"; then
    id=$(jq -r 'map(select(.conclusion != "cancelled")) | max_by(.id).id // empty' <<<"$runs")
    if [ -n "$id" ]; then
      echo "::error::release-envoy-listener.yaml run $id for $commit did not succeed, so its image is not there to build on; rerun it (gh run rerun $id --failed --repo $GITHUB_REPOSITORY), then rerun this workflow" >&2
      exit 1
    fi
    if [ "$runs" = "[]" ]; then
      why="release-envoy-listener.yaml has no run for it on main"
    else
      why="a later push replaced its release-envoy-listener.yaml run, which was cancelled; that push's image holds this commit's change"
    fi
    notice="No -tl image for $commit: $why, so there is no upstream image of this commit to build on."
    echo "::notice::$notice" >&2
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$notice" >>"$GITHUB_STEP_SUMMARY"; fi
    exit 3
  fi
fi

if ! manifest=$(docker buildx imagetools inspect "$image:$commit" --format '{{json .Manifest}}') ||
  ! digest=$(jq -er '.digest | select(test("^sha256:[0-9a-f]{64}$"))' <<<"$manifest"); then
  echo "::error::could not read the digest of $image:$commit, the image release-envoy-listener.yaml built for that commit" >&2
  exit 1
fi
if ! gh attestation verify "oci://$image@$digest" --repo "$GITHUB_REPOSITORY" \
  --signer-workflow "$GITHUB_REPOSITORY/$listener" --source-ref refs/heads/main \
  --source-digest "$commit" --deny-self-hosted-runners >&2; then
  echo "::error::$image@$digest, tagged $commit, has no attestation from $listener on main for that commit, so this workflow will not build on it" >&2
  exit 1
fi
echo "$image@$digest"
