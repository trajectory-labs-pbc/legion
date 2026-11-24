#!/usr/bin/env bash
# Prints the upstream-built envoy image the fork's envoy image derives from, by digest: the image of
# the newest first-parent ancestor of <commit> (itself included) that release-envoy-listener.yaml
# ran for on a push, waiting for that run when it is still going. A commit that workflow did not
# run for changed none of its paths, so that image holds the same upstream files.
#   fork-envoy-base.sh <commit> <image>     needs GH_TOKEN and GITHUB_REPOSITORY
set -euo pipefail
commit=$1
image=$2

runs_for() {
  gh api "repos/$GITHUB_REPOSITORY/actions/workflows/release-envoy-listener.yaml/runs?head_sha=$1&event=push" \
    --jq '[.workflow_runs[] | {id, conclusion}]'
}

# The push that started this run started release-envoy-listener.yaml's too, if its paths matched;
# a minute covers the gap between the two runs' creation.
runs=$(runs_for "$commit")
if [ "$runs" = "[]" ]; then
  sleep 60
  runs=$(runs_for "$commit")
fi
for _ in $(seq 1 100); do
  if [ "$runs" != "[]" ]; then
    if ! jq -e 'any(.conclusion == "success")' <<<"$runs" >/dev/null; then
      id=$(jq -r 'max_by(.id).id' <<<"$runs")
      echo "waiting for release-envoy-listener.yaml run $id ($commit)" >&2
      gh run watch "$id" --repo "$GITHUB_REPOSITORY" --exit-status --interval 60 >&2
    fi
    digest=$(docker buildx imagetools inspect "$image:$commit" --format '{{json .Manifest}}' | jq -r .digest)
    echo "$image@$digest"
    exit 0
  fi
  commit=$(git rev-parse "$commit^1")
  runs=$(runs_for "$commit")
done
echo "::error::no release-envoy-listener.yaml push run in 100 first-parent commits" >&2
exit 1
