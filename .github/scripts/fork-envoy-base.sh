#!/usr/bin/env bash
# Prints the upstream-built envoy image the fork's envoy image derives from, by digest: the image of
# the newest first-parent ancestor of <commit> (itself included) that release-envoy-listener.yaml
# ran for on a push, waiting for that run when it is still going. A commit that workflow did not
# run for changed none of its paths, so that image holds the same upstream files. The tag can move,
# so the digest is used only once its attestation shows that workflow built it on main.
#   fork-envoy-base.sh <commit> <image>     needs GH_TOKEN and GITHUB_REPOSITORY
set -euo pipefail
commit=$1
image=$2
listener=.github/workflows/release-envoy-listener.yaml

runs_for() {
  gh api "repos/$GITHUB_REPOSITORY/actions/workflows/release-envoy-listener.yaml/runs?head_sha=$1&event=push" \
    --jq '[.workflow_runs[] | {id, conclusion}]'
}

# GitHub creates every run of one push in the same second, before any of their jobs starts, so a
# commit with no listener run when this job runs never gets one.
for _ in $(seq 1 100); do
  runs=$(runs_for "$commit")
  if [ "$runs" != "[]" ]; then
    if ! jq -e 'any(.conclusion == "success")' <<<"$runs" >/dev/null; then
      id=$(jq -r 'max_by(.id).id' <<<"$runs")
      echo "waiting for release-envoy-listener.yaml run $id ($commit)" >&2
      if ! gh run watch "$id" --repo "$GITHUB_REPOSITORY" --exit-status --interval 60 >&2; then
        echo "::error::release-envoy-listener.yaml run $id for $commit did not succeed, so its image is not there to build on; rerun it (gh run rerun $id --failed --repo $GITHUB_REPOSITORY), then rerun this workflow" >&2
        exit 1
      fi
    fi
    digest=$(docker buildx imagetools inspect "$image:$commit" --format '{{json .Manifest}}' | jq -r .digest)
    if ! gh attestation verify "oci://$image@$digest" --repo "$GITHUB_REPOSITORY" \
      --signer-workflow "$GITHUB_REPOSITORY/$listener" --source-ref refs/heads/main >&2; then
      echo "::error::$image@$digest, tagged $commit, has no attestation from $listener on main, so this workflow will not build on it" >&2
      exit 1
    fi
    echo "$image@$digest"
    exit 0
  fi
  if ! commit=$(git rev-parse -q --verify "$commit^1^{commit}"); then
    echo "::error::the checkout's history ends before any commit release-envoy-listener.yaml ran for; raise the checkout's fetch-depth" >&2
    exit 1
  fi
done
echo "::error::no release-envoy-listener.yaml push run in 100 first-parent commits" >&2
exit 1
