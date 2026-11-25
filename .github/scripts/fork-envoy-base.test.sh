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
# exit with the number in $STUB/watch-exit and $STUB/verify-exit.
cat >"$work/bin/gh" <<'EOF'
#!/usr/bin/env bash
echo "gh $*" >>"$STUB/calls"
case "$1 $2" in
  "api "*)
    sha=$(sed -nE 's/.*head_sha=([0-9a-f]+).*/\1/p' <<<"$2")
    if [ -f "$STUB/runs/$sha" ]; then cat "$STUB/runs/$sha"; else echo '[]'; fi ;;
  "run watch") exit "$(cat "$STUB/watch-exit")" ;;
  "attestation verify") exit "$(cat "$STUB/verify-exit")" ;;
  *) echo "unexpected: gh $*" >&2; exit 99 ;;
esac
EOF
cat >"$work/bin/docker" <<EOF
#!/usr/bin/env bash
echo '{"digest":"$digest"}'
EOF
chmod +x "$work/bin/gh" "$work/bin/docker"

git init -q "$work/repo"
for n in 1 2 3 4 5; do
  git -C "$work/repo" -c user.name=t -c user.email=t@t commit -q --allow-empty -m "c$n"
done
head=$(git -C "$work/repo" rev-parse HEAD)
parent=$(git -C "$work/repo" rev-parse HEAD^1)

# run <name> <repo> [<sha> <runs json>]...: runs the script on <repo>'s HEAD; sets out, err, status, seconds.
run() {
  name=$1 repo=$2
  shift 2
  export STUB="$work/stub-$name"
  mkdir -p "$STUB/runs"
  echo 0 >"$STUB/watch-exit"
  echo 0 >"$STUB/verify-exit"
  while [ $# -gt 0 ]; do
    echo "$2" >"$STUB/runs/$1"
    shift 2
  done
}
go() {
  local start=$SECONDS
  status=0
  out=$(cd "$repo" && PATH="$work/bin:$PATH" GITHUB_REPOSITORY=owner/legion \
    bash "$script" "$(git rev-parse HEAD)" ghcr.io/owner/legion/envoy 2>"$STUB/err") || status=$?
  err=$(cat "$STUB/err")
  seconds=$((SECONDS - start))
}
check() {
  if eval "$2"; then
    echo "ok: $name: $1"
  else
    echo "FAIL: $name: $1 (status $status, ${seconds}s)"
    echo "  stdout: $out"
    echo "  stderr: $(head -c 600 <<<"$err")"
    failures=$((failures + 1))
  fi
}

run success "$work/repo" "$head" '[{"id":7,"status":"completed","conclusion":"success"}]'
go
check "prints the image by digest" '[ "$status" = 0 ] && [ "$out" = "ghcr.io/owner/legion/envoy@$digest" ]'
check "verifies the attestation against the listener on main" \
  'grep -q "attestation verify oci://ghcr.io/owner/legion/envoy@$digest .*--signer-workflow owner/legion/.github/workflows/release-envoy-listener.yaml .*--source-ref refs/heads/main" "$STUB/calls"'

run parent "$work/repo" "$parent" '[{"id":8,"status":"completed","conclusion":"success"}]'
go
check "walks to the parent without waiting" '[ "$status" = 0 ] && [ "$seconds" -lt 10 ]'

run failed "$work/repo" "$head" '[{"id":9,"status":"completed","conclusion":"failure"}]'
echo 1 >"$STUB/watch-exit"
go
check "names the run to rerun" '[ "$status" = 1 ] && grep -q "::error::.*run 9 .*gh run rerun 9" <<<"$err"'

run unverified "$work/repo" "$head" '[{"id":10,"status":"completed","conclusion":"success"}]'
echo 1 >"$STUB/verify-exit"
go
check "refuses an image with no attestation" '[ "$status" = 1 ] && [ -z "$out" ] && grep -q "::error::.*$digest" <<<"$err"'

git clone -q --depth 2 "file://$work/repo" "$work/shallow"
run shallow "$work/shallow"
go
check "stops at the shallow boundary with an error line" \
  '[ "$status" = 1 ] && grep -q "::error::.*history" <<<"$err" && ! grep -q "^fatal:" <<<"$err"'

if [ "$failures" -gt 0 ]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
