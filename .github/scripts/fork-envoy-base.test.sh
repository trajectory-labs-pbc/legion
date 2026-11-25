#!/usr/bin/env bash
# Tests .github/scripts/fork-envoy-base.sh against stub gh and docker commands and a real git history.
#   bash .github/scripts/fork-envoy-base.test.sh
set -euo pipefail
script=$(cd "$(dirname "$0")" && pwd)/fork-envoy-base.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
digest=sha256:$(printf 'a%.0s' $(seq 1 64))
failures=0

mkdir -p "$work/bin"
# gh: a commit's listener runs come from $STUB/runs/<sha>; `run watch` and `attestation verify`
# exit with the number in $STUB/watch-exit and $STUB/verify-exit, and `run watch` then replaces
# the runs with those in $STUB/after-watch, as a run that ends does.
cat >"$work/bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "gh $*" >>"$STUB/calls"
case "$1 $2" in
  "api "*)
    sha=$(sed -nE 's/.*head_sha=([0-9a-f]+).*/\1/p' <<<"$2")
    if [ -f "$STUB/runs/$sha" ]; then cat "$STUB/runs/$sha"; else echo '[]'; fi ;;
  "run watch")
    if [ -d "$STUB/after-watch" ]; then cp "$STUB/after-watch/"* "$STUB/runs/"; fi
    exit "$(cat "$STUB/watch-exit")" ;;
  "attestation verify") exit "$(cat "$STUB/verify-exit")" ;;
  *) echo "unexpected: gh $*" >&2; exit 99 ;;
esac
EOF
cat >"$work/bin/docker" <<EOF
#!/usr/bin/env bash
echo "docker \$*" >>"\$STUB/calls"
echo '{"digest":"$digest"}'
EOF
chmod +x "$work/bin/gh" "$work/bin/docker"

git init -q "$work/repo"
for n in 1 2 3 4 5; do
  git -C "$work/repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "c$n"
done
head=$(git -C "$work/repo" rev-parse HEAD)
parent=$(git -C "$work/repo" rev-parse HEAD^1)
grandparent=$(git -C "$work/repo" rev-parse HEAD~2)
ok='"status":"completed","conclusion":"success"'
failed='"status":"completed","conclusion":"failure"'
cancelled='"status":"completed","conclusion":"cancelled"'
going='"status":"in_progress","conclusion":null'

# run <name> <repo> [<sha> <runs json>]...: sets the stubs for one case on <repo>'s HEAD.
run() {
  name=$1 repo=$2
  shift 2
  export STUB="$work/stub-$name"
  export GITHUB_STEP_SUMMARY="$STUB/summary"
  mkdir -p "$STUB/runs"
  : >"$STUB/calls"
  : >"$GITHUB_STEP_SUMMARY"
  echo 0 >"$STUB/watch-exit"
  echo 0 >"$STUB/verify-exit"
  while [ $# -gt 0 ]; do
    echo "$2" >"$STUB/runs/$1"
    shift 2
  done
}
# after_watch <sha> <runs json>: the commit's runs once `gh run watch` has returned.
after_watch() {
  mkdir -p "$STUB/after-watch"
  echo "$2" >"$STUB/after-watch/$1"
}
# go <event>: runs the script; sets out, err, status.
go() {
  status=0
  out=$(cd "$repo" && PATH="$work/bin:$PATH" GITHUB_REPOSITORY=owner/legion \
    bash "$script" "$1" "$(git rev-parse HEAD)" ghcr.io/owner/legion/envoy 2>"$STUB/err") || status=$?
  err=$(cat "$STUB/err")
}
check() {
  if eval "$2"; then
    echo "ok: $name: $1"
  else
    echo "FAIL: $name: $1 (status $status)"
    echo "  stdout: $out"
    echo "  stderr: $(head -c 600 <<<"$err")"
    failures=$((failures + 1))
  fi
}
image_printed='[ "$status" = 0 ] && [ "$out" = "ghcr.io/owner/legion/envoy@$digest" ]'
# The commit has no upstream image: a notice in the log and the summary, exit 3, no image read.
no_image='[ "$status" = 3 ] && [ -z "$out" ] && grep -q "^::notice::No -tl image for $head" <<<"$err" &&
  grep -q "No -tl image for $head" "$GITHUB_STEP_SUMMARY" && ! grep -q "^docker\|attestation" "$STUB/calls"'

run success "$work/repo" "$head" "[{\"id\":7,$ok}]"
go push
check "prints the image by digest" "$image_printed"
check "reads the built commit's image" 'grep -q "^docker .*ghcr.io/owner/legion/envoy:$head " "$STUB/calls"'
check "asks for the commit's runs on main, of any event" \
  'grep -q "head_sha=$head&branch=main" "$STUB/calls" && ! grep -q "event=" "$STUB/calls"'
check "verifies the attestation against the listener on main" \
  'grep -q "attestation verify oci://ghcr.io/owner/legion/envoy@$digest .*--signer-workflow owner/legion/.github/workflows/release-envoy-listener.yaml .*--source-ref refs/heads/main" "$STUB/calls"'

run waits "$work/repo" "$head" "[{\"id\":11,$going}]"
after_watch "$head" "[{\"id\":11,$ok}]"
go push
check "waits for the run, then prints only the image" "$image_printed"' && grep -q "^gh run watch 11 " "$STUB/calls"'

run no-run "$work/repo" "$parent" "[{\"id\":8,$ok}]"
go push
check "a push takes no ancestor's image" "$no_image"
check "says the commit has no run" 'grep -q "has no run for it on main" <<<"$err"'

run cancelled "$work/repo" "$head" "[{\"id\":12,$cancelled}]" "$parent" "[{\"id\":8,$ok}]"
go push
check "a cancelled run is a commit with no image" "$no_image"
check "says a later push replaced the run" 'grep -q "a later push replaced" <<<"$err"'

run replaced "$work/repo" "$head" "[{\"id\":13,$going}]"
after_watch "$head" "[{\"id\":13,$cancelled}]"
echo 1 >"$STUB/watch-exit"
go workflow_dispatch
check "a run cancelled during the wait is a commit with no image" "$no_image"

run failed "$work/repo" "$head" "[{\"id\":9,$failed}]"
go push
check "names the run to rerun" '[ "$status" = 1 ] && grep -q "::error::.*run 9 .*gh run rerun 9" <<<"$err"'

run rerun "$work/repo" "$head" "[{\"id\":9,$failed},{\"id\":14,$ok}]"
go workflow_dispatch
check "a later run of the commit that succeeded gives the image" "$image_printed"

run unverified "$work/repo" "$head" "[{\"id\":10,$ok}]"
echo 1 >"$STUB/verify-exit"
go push
check "refuses an image with no attestation" '[ "$status" = 1 ] && [ -z "$out" ] && grep -q "::error::.*$digest" <<<"$err"'

run pr-walk "$work/repo" "$parent" "[{\"id\":15,$failed}]" "$grandparent" "[{\"id\":16,$cancelled},{\"id\":17,$ok}]"
go pull_request
check "a pull request walks past ancestors with no image" \
  "$image_printed"' && grep -q "^docker .*ghcr.io/owner/legion/envoy:$grandparent " "$STUB/calls"'
check "and does not wait on a run that has ended" '! grep -q "run watch" "$STUB/calls"'

git clone -q --depth 2 "file://$work/repo" "$work/shallow"
run shallow "$work/shallow"
go pull_request
check "stops at the shallow boundary with an error line" \
  '[ "$status" = 1 ] && grep -q "::error::.*history" <<<"$err" && ! grep -q "^fatal:" <<<"$err"'

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
