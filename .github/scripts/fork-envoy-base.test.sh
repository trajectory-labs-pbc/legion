#!/usr/bin/env bash
# Tests .github/scripts/fork-envoy-base.sh against stub gh and docker commands and a real git
# history. That release-envoy-listener.yaml runs for every input of the fork's envoy image is
# check-image-trigger-paths.sh's (BASE_IMAGE_TRIGGERS).
#   bash .github/scripts/fork-envoy-base.test.sh
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
script=$here/fork-envoy-base.sh
# shellcheck source=.github/scripts/test-lib.sh
source "$here/test-lib.sh"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
digest=sha256:$(printf 'a%.0s' $(seq 1 64))

mkdir -p "$work/bin"
# gh: a commit's listener runs come from $STUB/runs/<sha>, and main's runs, newest first, from
# $STUB/main-runs; an api call fails once while $STUB/refuse-once exists. `run watch` and
# `attestation verify` exit with the number in $STUB/watch-exit and $STUB/verify-exit, and the
# n-th `run watch` first replaces the runs with those in $STUB/after-watch/<n>, as a run that
# ends does.
cat >"$work/bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "gh $*" >>"$STUB/calls"
case "$1 $2" in
  "api "*)
    if [ -f "$STUB/refuse-once" ]; then
      rm "$STUB/refuse-once"
      echo "HTTP 502: Bad Gateway" >&2
      exit 1
    fi
    if [[ $2 != *head_sha=* ]]; then
      if [ -f "$STUB/main-runs" ]; then cat "$STUB/main-runs"; else echo '[]'; fi
      exit 0
    fi
    sha=$(sed -nE 's/.*head_sha=([0-9a-f]+).*/\1/p' <<<"$2")
    if [ -f "$STUB/runs/$sha" ]; then cat "$STUB/runs/$sha"; else echo '[]'; fi ;;
  "run watch")
    n=$(($(grep -c '^gh run watch' "$STUB/calls")))
    if [ -d "$STUB/after-watch/$n" ]; then cp "$STUB/after-watch/$n/"* "$STUB/runs/"; fi
    exit "$(cat "$STUB/watch-exit")" ;;
  "attestation verify") exit "$(cat "$STUB/verify-exit")" ;;
  *) echo "unexpected: gh $*" >&2; exit 99 ;;
esac
EOF
# docker: prints $STUB/manifest when the case wrote one, and exits with $STUB/docker-exit.
cat >"$work/bin/docker" <<EOF
#!/usr/bin/env bash
echo "docker \$*" >>"\$STUB/calls"
if [ -f "\$STUB/manifest" ]; then cat "\$STUB/manifest"; else echo '{"digest":"$digest"}'; fi
exit "\$(cat "\$STUB/docker-exit")"
EOF
chmod +x "$work/bin/gh" "$work/bin/docker"

commit() { git -C "$1" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "$2"; }
git init -q "$work/repo"
for n in 1 2 3 4 5; do
  commit "$work/repo" "c$n"
done
head=$(git -C "$work/repo" rev-parse HEAD)
parent=$(git -C "$work/repo" rev-parse HEAD^1)
grandparent=$(git -C "$work/repo" rev-parse HEAD~2)
elder=$(git -C "$work/repo" rev-parse HEAD~4)
offline=$(printf 'b%.0s' $(seq 1 40))
ok='"status":"completed","conclusion":"success"'
failed='"status":"completed","conclusion":"failure"'
cancelled='"status":"completed","conclusion":"cancelled"'
going='"status":"in_progress","conclusion":null'

# run <name> <repo> [<sha> <runs json>]...: sets the stubs for one case on <repo>'s HEAD.
run() {
  name=$1 repo=$2
  shift 2
  echo "case: $name"
  export STUB="$work/stub-$name"
  export GITHUB_STEP_SUMMARY="$STUB/summary"
  mkdir -p "$STUB/runs"
  : >"$STUB/calls"
  : >"$GITHUB_STEP_SUMMARY"
  echo 0 >"$STUB/watch-exit"
  echo 0 >"$STUB/verify-exit"
  echo 0 >"$STUB/docker-exit"
  while [ $# -gt 0 ]; do
    echo "$2" >"$STUB/runs/$1"
    shift 2
  done
}
# after_watch <n> <sha> <runs json>: the commit's runs once the n-th `gh run watch` has returned.
after_watch() {
  mkdir -p "$STUB/after-watch/$1"
  echo "$3" >"$STUB/after-watch/$1/$2"
}
# main_runs <sha> <run fields>...: main's runs, newest first, as the script's --jq shapes them.
main_runs() {
  local rows=()
  while [ $# -gt 0 ]; do
    rows+=("{\"sha\":\"$1\",$2}")
    shift 2
  done
  local IFS=,
  echo "[${rows[*]}]" >"$STUB/main-runs"
}
# go <event>: runs the script; sets out, err, status.
go() {
  status=0
  out=$(cd "$repo" && PATH="$work/bin:$PATH" GITHUB_REPOSITORY=owner/legion GH_RETRY_SECONDS=0 \
    bash "$script" "$1" "$(git rev-parse HEAD)" ghcr.io/owner/legion/envoy 2>"$STUB/err") || status=$?
  err=$(cat "$STUB/err")
}
calls() { cat "$STUB/calls"; }
summary_text() { cat "$GITHUB_STEP_SUMMARY"; }
image_printed() { is "$status/$out" "0/ghcr.io/owner/legion/envoy@$digest"; }
# The commit has no upstream image: a notice in the log and the summary, exit 3, no image read.
no_image() {
  if [ "$status" = 3 ] && [ -z "$out" ] && [ "$(contains "$err" "^::notice::No -tl image for $head")" = true ] &&
    [ "$(contains "$(summary_text)" "No -tl image for $head")" = true ] &&
    [ "$(contains "$(calls)" "^docker\|attestation")" = false ]; then
    echo true
  else
    echo false
  fi
}

run success "$work/repo" "$head" "[{\"id\":7,$ok}]"
go push
check "prints the image by digest" "$(image_printed)"
check "reads the built commit's image" "$(contains "$(calls)" "^docker .*ghcr.io/owner/legion/envoy:$head ")"
check "asks for the commit's runs on main, of any event" "$(contains "$(calls)" "head_sha=$head&branch=main")"
check "  and of no one event" "$(is "$(contains "$(calls)" "event=")" false)"
check "verifies the attestation against the listener on main" \
  "$(contains "$(calls)" "attestation verify oci://ghcr.io/owner/legion/envoy@$digest .*--signer-workflow owner/legion/.github/workflows/release-envoy-listener.yaml .*--source-ref refs/heads/main")"
check "ties the attestation to the commit" "$(contains "$(calls)" "attestation verify .*--source-digest $head ")"
check "  and to a hosted runner" "$(contains "$(calls)" "attestation verify .*--deny-self-hosted-runners")"

run refused "$work/repo" "$head" "[{\"id\":7,$ok}]"
touch "$STUB/refuse-once"
go push
check "a refused API call is tried again" "$(image_printed)"

run waits "$work/repo" "$head" "[{\"id\":11,$going}]"
after_watch 1 "$head" "[{\"id\":11,$ok}]"
go push
check "waits for the run, then prints only the image" "$(image_printed)"
check "  after watching that run" "$(contains "$(calls)" "^gh run watch 11 ")"

run waits-for-each "$work/repo" "$head" "[{\"id\":11,$going},{\"id\":12,$going}]"
after_watch 1 "$head" "[{\"id\":11,$going},{\"id\":12,$cancelled}]"
after_watch 2 "$head" "[{\"id\":11,$ok},{\"id\":12,$cancelled}]"
go push
check "watches until a run has succeeded" "$(image_printed)"
check "  watching the newest run, then the one still going" \
  "$(is "$(grep '^gh run watch' "$STUB/calls" | cut -d' ' -f4 | tr '\n' ' ')" "12 11 ")"

run watch-error "$work/repo" "$head" "[{\"id\":13,$going}]"
echo 1 >"$STUB/watch-exit"
go push
check "a watch that fails fails the script" "$(is "$status/$out" 1/)"
check "  and says nothing of a cancelled run" "$(is "$(contains "$err" "cancelled")" false)"

run no-run "$work/repo" "$parent" "[{\"id\":8,$ok}]"
go push
check "a push takes no ancestor's image" "$(no_image)"
check "  and says the commit has no run" "$(contains "$err" "has no run for it on main")"

run cancelled "$work/repo" "$head" "[{\"id\":12,$cancelled}]" "$parent" "[{\"id\":8,$ok}]"
go push
check "a cancelled run is a commit with no image" "$(no_image)"
check "  and says it was cancelled, usually by a later push" \
  "$(contains "$err" "run was cancelled, usually because a later push replaced it")"

run replaced "$work/repo" "$head" "[{\"id\":13,$going}]"
after_watch 1 "$head" "[{\"id\":13,$cancelled}]"
go workflow_dispatch
check "a run cancelled during the wait is a commit with no image" "$(no_image)"

run failed "$work/repo" "$head" "[{\"id\":9,$failed}]"
go push
check "a failed run fails a push" "$(is "$status" 1)"
check "  naming the run to rerun" "$(contains "$err" "::error::.*run 9 .*gh run rerun 9")"

run rerun "$work/repo" "$head" "[{\"id\":9,$failed},{\"id\":14,$ok}]"
go workflow_dispatch
check "a later run of the commit that succeeded gives the image" "$(image_printed)"

run unverified "$work/repo" "$head" "[{\"id\":10,$ok}]"
echo 1 >"$STUB/verify-exit"
go push
check "refuses an image with no attestation" "$(is "$status/$out" 1/)"
check "  naming its digest" "$(contains "$err" "::error::.*$digest")"

run no-image "$work/repo" "$head" "[{\"id\":21,$ok}]"
echo 1 >"$STUB/docker-exit"
go push
check "fails when the image cannot be read" "$(is "$status/$out" 1/)"
check "  naming the tag" "$(contains "$err" "^::error::could not read the digest of ghcr.io/owner/legion/envoy:$head")"
check "  and verifies nothing" "$(is "$(contains "$(calls)" attestation)" false)"

run no-digest "$work/repo" "$head" "[{\"id\":22,$ok}]"
echo '{}' >"$STUB/manifest"
go push
check "fails when the image has no digest" "$(is "$status/$out" 1/)"
check "  naming the tag" "$(contains "$err" "^::error::could not read the digest of ghcr.io/owner/legion/envoy:$head")"

# A pull request: main's runs, newest first, hold a commit off this line, the parent's failed run
# and the grandparent's successful one.
run pr-walk "$work/repo"
main_runs "$offline" "$ok" "$parent" "$failed" "$grandparent" "$ok" "$elder" "$ok"
go pull_request
check "a pull request builds on the newest ancestor with a successful run" "$(image_printed)"
check "  reading that ancestor's image" "$(contains "$(calls)" "^docker .*ghcr.io/owner/legion/envoy:$grandparent ")"
check "  and tying the attestation to it" "$(contains "$(calls)" "attestation verify .*--source-digest $grandparent ")"
check "  in one read of main's runs" "$(is "$(grep -c '^gh api' "$STUB/calls")" 1)"
check "  waiting on no run" "$(is "$(contains "$(calls)" "run watch")" false)"
check "  and saying in a notice that the base is older" \
  "$(contains "$err" "^::notice::The smoke build runs on the upstream image of $grandparent.*older than this pull request")"
check "  and in the summary" "$(contains "$(summary_text)" "older than this pull request")"
check "  naming no run still going" "$(is "$(contains "$err" "still going")" false)"

run pr-going "$work/repo"
main_runs "$parent" "$going" "$grandparent" "$ok"
go pull_request
check "a pull request passes over an ancestor whose run is still going" \
  "$(contains "$(calls)" "^docker .*ghcr.io/owner/legion/envoy:$grandparent ")"
check "  and names it in the notice" "$(contains "$err" "^::notice::.*Newer commits whose run is still going: $parent\.")"

run pr-none "$work/repo"
main_runs "$offline" "$ok" "$parent" "$failed"
go pull_request
check "a pull request with no imaged ancestor fails" "$(is "$status/$out" 1/)"
check "  with an error line" "$(contains "$err" "^::error::no first-parent ancestor of $head")"

# 4000 commits: their ids passed as one argument would exceed the kernel's 128 KiB limit on one.
git init -q -b main "$work/long"
for n in $(seq 1 4000); do
  printf 'commit refs/heads/main\nmark :%s\ncommitter t <t@t> 0 +0000\ndata 0\n' "$n"
  if [ "$n" -gt 1 ]; then printf 'from :%s\n' $((n - 1)); fi
done | git -C "$work/long" fast-import --quiet
root=$(git -C "$work/long" rev-list --max-parents=0 HEAD)
run pr-long "$work/long"
main_runs "$root" "$ok"
go pull_request
check "a pull request on a history longer than one argument holds finds its imaged ancestor" \
  "$(contains "$(calls)" "^docker .*ghcr.io/owner/legion/envoy:$root ")"

git clone -q --depth 2 "file://$work/repo" "$work/shallow"
run shallow "$work/shallow"
main_runs "$grandparent" "$ok"
go pull_request
check "a history that ends before the imaged ancestor fails with an error line" \
  "$(is "$status/$(contains "$err" "::error::.*fetch-depth")/$(contains "$err" "^fatal:")" 1/true/false)"

summary "fork-envoy-base.sh"
