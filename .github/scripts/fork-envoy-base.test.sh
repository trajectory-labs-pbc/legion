#!/usr/bin/env bash
# Tests .github/scripts/fork-envoy-base.sh against stub gh and docker commands and a real git
# history, and that release-envoy-listener.yaml runs for every input of the fork's envoy image.
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
# docker: prints $STUB/manifest when the case wrote one, and exits with $STUB/docker-exit.
cat >"$work/bin/docker" <<EOF
#!/usr/bin/env bash
echo "docker \$*" >>"\$STUB/calls"
if [ -f "\$STUB/manifest" ]; then cat "\$STUB/manifest"; else echo '{"digest":"$digest"}'; fi
exit "\$(cat "\$STUB/docker-exit")"
EOF
chmod +x "$work/bin/gh" "$work/bin/docker"

# The history holds this repository's listener, whose path list the script reads.
listener=.github/workflows/release-envoy-listener.yaml
commit() { git -C "$1" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "$2"; }
git init -q "$work/repo"
mkdir -p "$work/repo/.github/workflows"
cp "$(dirname "$script")/../workflows/release-envoy-listener.yaml" "$work/repo/$listener"
git -C "$work/repo" add .
for n in 1 2 3 4 5; do
  commit "$work/repo" "c$n"
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
  echo 0 >"$STUB/docker-exit"
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
check "ties the attestation to the commit and to a hosted runner" \
  'grep -q "attestation verify .*--source-digest $head " "$STUB/calls" && grep -q "attestation verify .*--deny-self-hosted-runners" "$STUB/calls"'

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

image_unread='[ "$status" = 1 ] && [ -z "$out" ] && grep -q "^::error::could not read the digest of ghcr.io/owner/legion/envoy:$head" <<<"$err" &&
  ! grep -q "attestation" "$STUB/calls"'

run no-image "$work/repo" "$head" "[{\"id\":21,$ok}]"
echo 1 >"$STUB/docker-exit"
go push
check "names the tag when the image cannot be read" "$image_unread"

run no-digest "$work/repo" "$head" "[{\"id\":22,$ok}]"
echo '{}' >"$STUB/manifest"
go push
check "names the tag when the image has no digest" "$image_unread"

run pr-walk "$work/repo" "$parent" "[{\"id\":15,$failed}]" "$grandparent" "[{\"id\":16,$cancelled},{\"id\":17,$ok}]"
go pull_request
check "a pull request walks past ancestors with no image" \
  "$image_printed"' && grep -q "^docker .*ghcr.io/owner/legion/envoy:$grandparent " "$STUB/calls"'
check "and ties the attestation to the ancestor" 'grep -q "attestation verify .*--source-digest $grandparent " "$STUB/calls"'
check "and does not wait on a run that has ended" '! grep -q "run watch" "$STUB/calls"'

# pull_request_of <name> <file>...: a clone whose HEAD changes the files on top of $head.
pull_request_of() {
  local clone="$work/$1" file
  shift
  git clone -q "$work/repo" "$clone"
  for file in "$@"; do
    mkdir -p "$clone/$(dirname "$file")"
    echo changed >>"$clone/$file"
  done
  git -C "$clone" add .
  commit "$clone" "pull request"
}

pull_request_of pr-app packages/tl-dispatch/src/a.ts packages/ui/src/b.ts packages/envoy/infra/c.go \
  .github/workflows/fork-envoy-image.yaml .github/scripts/fork-envoy-base.sh README.md
run pr-app "$work/pr-app" "$head" "[{\"id\":18,$ok}]"
go pull_request
check "a pull request that changes none of upstream's image inputs builds on main's image" \
  "$image_printed"' && grep -q "^docker .*ghcr.io/owner/legion/envoy:$head " "$STUB/calls"'

pull_request_of pr-upstream packages/tl-dispatch/src/a.ts packages/envoy/cmd/dispatch/main.go
run pr-upstream "$work/pr-upstream" "$head" "[{\"id\":19,$ok}]"
go pull_request
check "a pull request that changes upstream's image inputs gets a notice and no smoke build" \
  '[ "$status" = 3 ] && [ -z "$out" ] && grep -q "^::notice::No smoke build: the listener.s inputs changed since .*the push run on main tests this image.*packages/envoy/cmd/dispatch/main.go" <<<"$err" && ! grep -q "tl-dispatch/src" <<<"$err" && grep -q "the push run on main tests this image" "$GITHUB_STEP_SUMMARY" && ! grep -q "^docker \|attestation" "$STUB/calls"'

pull_request_of pr-listener packages/tl-dispatch/src/a.ts "$listener"
run pr-listener "$work/pr-listener" "$head" "[{\"id\":21,$ok}]"
go pull_request
check "so does one that changes only the listener's own file" \
  '[ "$status" = 3 ] && [ -z "$out" ] && grep -q "^::notice::No smoke build: .*Changed: $listener" <<<"$err"'

mkdir "$work/no-paths" && git -C "$work/no-paths" init -q
commit "$work/no-paths" c1
mkdir -p "$work/no-paths/.github/workflows" && echo "on: push" >"$work/no-paths/$listener"
run no-paths "$work/no-paths" "$(git -C "$work/no-paths" rev-parse HEAD)" "[{\"id\":20,$ok}]"
go pull_request
check "a listener with no path list fails" '[ "$status" = 1 ] && grep -q "^::error::.*has no on.push.paths list" <<<"$err"'

git clone -q --depth 2 "file://$work/repo" "$work/shallow"
run shallow "$work/shallow"
go pull_request
check "stops at the shallow boundary with an error line" \
  '[ "$status" = 1 ] && grep -q "::error::.*history" <<<"$err" && ! grep -q "^fatal:" <<<"$err"'

# The fork image is built only for a commit the listener ran for, so the listener's path list must
# hold every file the fork image's build reads: the app, the UI package, what the app's build takes
# from upstream's packages, the files the Dockerfile copies by name, and the workflow's own inputs.
name=inputs repo=$(cd "$(dirname "$script")/../.." && pwd)
mapfile -t patterns < <(awk '
  /^    paths:/ { on = 1; next }
  on && !/^      / { exit }
  on && $1 == "-" { gsub(/"/, "", $2); print $2 }' "$repo/$listener")
# shellcheck disable=SC2053 # the right side is a glob
covered() {
  local pattern hit=1
  for pattern in "${patterns[@]}"; do
    if [[ $pattern == '!'* ]]; then
      if [[ $1 == ${pattern#!} ]]; then return 1; fi
    elif [[ $1 == $pattern ]]; then
      hit=0
    fi
  done
  return "$hit"
}
inputs=(
  packages/tl-dispatch/src/main.tsx packages/ui/package.json
  .github/workflows/fork-envoy-image.yaml .github/scripts/fork-envoy-base.sh
  packages/envoy/docker/Dockerfile scripts/third-party-notices.ts .dockerignore
  packages/dispatch/web/src/main.tsx packages/contracts/src/index.ts packages/proof-editor/src/lib-headless.ts
)
while read -r source; do
  if [ -d "$repo/$source" ]; then source=$source/file; fi
  inputs+=("$source")
done < <(awk '$1 == "COPY" && $2 !~ /^--from/ { for (i = 2; i < NF; i++) if ($i !~ /^--/ && $i != ".") print $i }' \
  "$repo/packages/tl-dispatch/docker/Dockerfile")
status=0 err="" out=""
for input in "${inputs[@]}"; do
  if ! covered "$input"; then out+="$input "; fi
done
check "the listener's path list holds every input of the fork image (stdout names those it lacks)" '[ -z "$out" ]'
check "and the check reads that list" \
  '[ "${#inputs[@]}" -gt 20 ] && covered packages/envoy/go.mod && ! covered packages/envoy/infra/go.mod && ! covered packages/daemon/go.mod'

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
