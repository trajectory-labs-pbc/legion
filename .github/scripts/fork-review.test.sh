#!/usr/bin/env bash
# Tests for `fork-review.sh`, the steps of fork-review.yaml.
#
# Each case runs one function as the workflow does, with event payloads, model outputs and a stub
# gh written to a scratch directory.
#
# Run from anywhere: .github/scripts/fork-review.test.sh
# CI runs it in fork-review-test.yaml.
set -euo pipefail
shopt -s inherit_errexit

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
script="$script_dir/fork-review.sh"
workflow="$script_dir/../workflows/fork-review.yaml"

# shellcheck source=.github/scripts/test-lib.sh
source "$script_dir/test-lib.sh"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

mkdir "$work/bin"
cat > "$work/bin/gh" << 'STUB'
#!/usr/bin/env bash
echo "gh $*" >> "$STUB_LOG"
cat >> "$STUB_LOG"
# A permission read answers from access-<login>, and a login with no such file is not found.
if [[ $* =~ /collaborators/([^/]+)/permission ]]; then
  [ -e "$STUB_DIR/access-${BASH_REMATCH[1]}" ] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }
  cat "$STUB_DIR/access-${BASH_REMATCH[1]}"
  exit 0
fi
[ ! -e "$STUB_DIR/gh-answer" ] || cat "$STUB_DIR/gh-answer"
echo >> "$STUB_LOG"
if [ -e "$STUB_DIR/refuse-once" ]; then
  rm "$STUB_DIR/refuse-once"
  echo "gh: Unprocessable Entity (HTTP 422)" >&2
  exit 1
fi
STUB
chmod +x "$work/bin/gh"
export STUB_DIR=$work STUB_LOG=$work/gh.log PATH="$work/bin:$PATH"

# run <function> [VAR=value]...: run the function with fresh outputs; sets $status and $out.
run() {
  local function=$1
  shift
  : > "$work/output"
  : > "$work/gh.log"
  set +e
  out=$(env GITHUB_OUTPUT="$work/output" GITHUB_REPOSITORY=fork/legion "$@" "$script" "$function" < /dev/null 2>&1)
  status=$?
  set -e
}

# outvar <name>: a value the function wrote to its outputs.
outvar() { sed -n "s/^$1=//p" "$work/output"; }

# payload <author> <association> <head ref> <head repo> [state]: a pull_request_target payload.
payload() {
  jq -n --arg author "$1" --arg association "$2" --arg ref "$3" --arg repo "$4" --arg state "${5:-open}" \
    '{pull_request: {state: $state, user: {login: $author}, author_association: $association,
      head: {ref: $ref, repo: {full_name: $repo}}, base: {repo: {full_name: "fork/legion"}}}}' > "$work/event.json"
}

echo "gate"
echo admin > "$work/access-person"
echo read > "$work/access-outsider"
# The event shows a private member of the organization as CONTRIBUTOR.
payload person CONTRIBUTOR feat/x fork/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "a member's pull request is reviewed, whatever the event's association" "$(is "$status:$(outvar decision)" 0:review)"
payload outsider MEMBER feat/x outsider/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "an outside author's pull request is refused" "$(is "$status:$(outvar decision)" 0:fail)"
check "the refusal says what to do" "$(contains "$(outvar reason)" 'a maintainer takes the branch')"
payload ghost MEMBER feat/x fork/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "an author whose access cannot be read is refused" "$(is "$status:$(outvar decision):$(contains "$(outvar reason)" 'could not be read')" 0:fail:true)"
payload 'legion-upstream-sync[bot]' NONE fork-sync fork/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "the upstream sync passes" "$(is "$status:$(outvar decision)" 0:pass)"
payload person MEMBER fork-sync fork/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "a member's branch named fork-sync is reviewed" "$(is "$(outvar decision)" review)"
payload 'legion-upstream-sync[bot]' NONE fork-sync other/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "a fork-sync branch from another repository is refused" "$(is "$(outvar decision)" fail)"
payload person MEMBER feat/x fork/legion closed
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "a closed pull request passes with no review" "$(is "$(outvar decision)" pass)"
run gate GITHUB_EVENT_NAME=pull_request GITHUB_EVENT_PATH="$work/event.json"
check "another event fails" "$(is "$status" 1)"

echo "prepare"
# A main and a pull request's head, the head with its own .claude directory and a symlink out.
git init --quiet --bare "$work/origin.git"
git init --quiet -b main "$work/main"
git -C "$work/main" -c user.name=t -c user.email=t@t commit --quiet --allow-empty -m base
git -C "$work/main" push --quiet "$work/origin.git" main
mkdir -p "$work/main/.claude/skills"
echo hello > "$work/main/a.txt"
non_ascii=$(printf 'caf\303\251.txt')
echo x > "$work/main/$non_ascii"
echo skill > "$work/main/.claude/skills/x.md"
ln -s /etc/hostname "$work/main/out"
git -C "$work/main" add -A
git -C "$work/main" -c user.name=t -c user.email=t@t commit --quiet -m change
git -C "$work/main" push --quiet "$work/origin.git" HEAD:refs/pull/7/head
pr_head=$(git -C "$work/main" rev-parse HEAD)
git clone --quiet -b main "$work/origin.git" "$work/ws/legion"
jq -n '{pull_request: {title: "Change", body: "Why."}}' > "$work/event.json"
echo write > "$work/access-a"
echo read > "$work/access-b"
jq -n '[{id: 1, author_association: "CONTRIBUTOR", user: {login: "a"}, body: "member"},
  {id: 2, author_association: "NONE", user: {login: "b"}, body: "outsider"},
  {id: 3, author_association: "NONE", user: {login: "github-actions[bot]"}, body: "workflow"}]' > "$work/gh-answer"
cd "$work/ws/legion"
run prepare PR_NUMBER=7 HEAD_SHA="$pr_head" GITHUB_WORKSPACE="$work/ws/legion" GITHUB_EVENT_PATH="$work/event.json"
cd "$script_dir"
rm "$work/gh-answer"
check "prepare writes the head beside the checkout" "$(is "$status:$(outvar dir):$(cat "$work/ws/fork-review/head/a.txt")" "0:$work/ws/fork-review:hello")"
check "the diff names a non-ASCII path unquoted" "$(is "$(grep -cxF "+++ b/$non_ascii" "$work/ws/fork-review/diff.patch")" 1)"
check "the head's .claude directory is removed" "$(is "$([ -e "$work/ws/fork-review/head/.claude" ] && echo kept)" "")"
check "a symlink in the head is a file holding its target" \
  "$(is "$([ -L "$work/ws/fork-review/head/out" ] && echo link):$(cat "$work/ws/fork-review/head/out")" ":/etc/hostname")"
check "the model reads only members' and this workflow's comments" \
  "$(is "$(jq -r .id "$work/ws/fork-review/review-comments.jsonl" | paste -sd,)" 1,3)"
check "the pull request's text comes from the event" "$(is "$(cat "$work/ws/fork-review/pull-request.md")" $'# Change\n\nWhy.')"
base_sha=$(git -C "$work/main" rev-parse HEAD~1)
prompt_text=$(sed -n '/^prompt<</,/^FORK_REVIEW_/p' "$work/output")
check "the prompt names the head, base, number and directory" \
  "$(is "$(contains "$prompt_text" "#7 of this repository at head \`$pr_head\`, against its merge base \`$base_sha\`"):$(contains "$prompt_text" "\`$work/ws/fork-review\`")" true:true)"
check "the prompt keeps no placeholder" "$(is "$(contains "$prompt_text" '@[A-Z_]*@')" false)"
check "the schema is one line of JSON" "$(jq -e .properties.findings <<< "$(outvar schema)" > /dev/null && echo true || echo false)"
key=$(outvar key)
check "the key names the pull request and a hash" "$(is "$(grep -cE '^fork-review-7-[0-9a-f]{64}$' <<< "$key")" 1)"
# prepare_at <head>: run prepare again for pull request 7 at the head.
prepare_at() {
  rm -rf "$work/ws/fork-review"
  git -C "$work/ws/legion" worktree prune
  cd "$work/ws/legion"
  run prepare PR_NUMBER=7 HEAD_SHA="$1" GITHUB_WORKSPACE="$work/ws/legion" GITHUB_EVENT_PATH="$work/event.json"
  cd "$script_dir"
}
# key_after <commit message> <path>: the key once main gains a file at the path.
key_after() {
  mkdir -p "$(dirname "$work/ws/legion/$2")"
  echo "$1" > "$work/ws/legion/$2"
  git -C "$work/ws/legion" add -A
  git -C "$work/ws/legion" -c user.name=t -c user.email=t@t commit --quiet -m "$1"
  prepare_at "$pr_head"
  outvar key
}
check "a change to main elsewhere keeps the key" "$(is "$(key_after other docs/other.md)" "$key")"
# rebase_head: the pull request's commit replayed on main's tip, pushed as pull request 7's head.
rebase_head() {
  git -C "$work/ws/legion" worktree add --quiet --detach "$work/rebased" HEAD
  git -C "$work/rebased" -c user.name=t -c user.email=t@t cherry-pick --quiet "$pr_head" > /dev/null
  git -C "$work/rebased" push --quiet --force "$work/origin.git" HEAD:refs/pull/7/head
  git -C "$work/rebased" rev-parse HEAD
  git -C "$work/ws/legion" worktree remove --force "$work/rebased"
}
prepare_at "$(rebase_head)"
check "a rebase over commits that touch none of its files keeps the key" "$(is "$(outvar key)" "$key")"
key_after "hello" a.txt > /dev/null
prepare_at "$(rebase_head)"
check "a rebase over a change to one of its files makes a new key" "$(is "$([ "$(outvar key)" = "$key" ] && echo same)" "")"
git -C "$work/main" push --quiet --force "$work/origin.git" "$pr_head:refs/pull/7/head"
new_key=$(key_after rules packages/daemon/internal/prompts/roles/reviewer.md)
check "a change to the reviewer rules makes a new key" \
  "$(is "$(grep -c '^fork-review-7-' <<< "$new_key"):$([ "$new_key" = "$key" ] && echo same)" 1:)"
check "the key reads a binary file's whole blob id" "$(contains "$(< "$script")" 'git diff --binary --full-index "$base" "$head"')"
prepare_at "$base_sha"
check "a head the pull request moved past is not reviewed" "$(is "$status:$(contains "$out" 'moved past')" 1:true)"
# Every rule file the prompt names is on main, under a path the key reads.
key_paths=$(sed -n '/^reviewer_paths=(/,/)$/p' "$script" | tr -d '()' | sed 's/^reviewer_paths=//')
prompt_paths=$(grep -oE '`(packages|skills)/[^`]+`' "$script_dir/../fork-review/prompt.md" | tr -d '`' | sort -u)
missing=$(for p in $prompt_paths; do
  [ -e "$script_dir/../../$p" ] || echo "absent:$p"
  covered=false
  for k in $key_paths; do case $p in "$k"/* | "$k") covered=true ;; esac; done
  [ "$covered" = true ] || echo "unkeyed:$p"
done)
check "the key reads each rule file the prompt names" "$(is "$(wc -l <<< "$prompt_paths"):$missing" 4:)"

echo "decide"
mkdir "$work/cwd"
cd "$work/cwd"
run decide GATE_DECISION=fail GATE_REASON='not a member'
check "with no lookup, the gate's decision stands" "$(is "$status:$(outvar decision)" 0:fail)"
run decide GATE_DECISION=review GATE_REASON=member CACHE_HIT=false
check "with no earlier verdict, the model reviews" "$(is "$(outvar decision)" review)"
echo APPROVE > fork-review-verdict
run decide GATE_DECISION=review GATE_REASON=member CACHE_HIT=true KEY=k
check "an earlier APPROVE of the same diff passes" "$(is "$(outvar decision)" pass)"
echo CHANGES > fork-review-verdict
run decide GATE_DECISION=review GATE_REASON=member CACHE_HIT=true KEY=k
check "an earlier CHANGES of the same diff fails and says how to review again" \
  "$(is "$(outvar decision):$(contains "$(outvar reason)" 'delete the cache entry k')" fail:true)"
echo pwned > fork-review-verdict
run decide GATE_DECISION=review GATE_REASON=member CACHE_HIT=true KEY=k
check "a record that is no verdict fails" "$(is "$status:$(outvar decision)" 1:)"
rm fork-review-verdict
cd "$script_dir"

echo "scan"
terms=$'acmecorp\nkey:ACME'
# scan_with <review JSON>: run scan over an execution file whose result holds it.
scan_with() {
  jq -n --argjson review "$1" '[{type: "system"}, {type: "result", total_cost_usd: 0.5, structured_output: $review}]' > "$work/execution.json"
  run scan EXECUTION_FILE="$work/execution.json" HEAD_SHA=abc PRIVATE_NAME_TERMS="$terms" REVIEW_DIR="$work/rd"
  review_out=$(outvar review)
}
mkdir "$work/rd"
printf '%s\n' '{"id":42,"user":"github-actions[bot]"}' '{"id":43,"user":"a"}' > "$work/rd/review-comments.jsonl"
# a.go's first hunk adds a line that reads like a file header.
cat > "$work/rd/diff.patch" << 'EOF'
diff --git a/a.go b/a.go
--- a/a.go
+++ b/a.go
@@ -1,8 +1,10 @@ package a
+++ b/z.go
@@ -18,2 +20,2 @@ func f() {
diff --git a/b.go b/b.go
--- a/b.go
+++ b/b.go
@@ -40,2 +40,3 @@
@@ -99,2 +100,2 @@
EOF
scan_with '{"summary":"Fine.","findings":[{"path":"a.go","line":3,"severity":"Minor","body":"Rename x."}]}'
check "a clean review passes on" "$(is "$status:$([ -n "$review_out" ] && echo set)" 0:set)"
check "the body starts with the verdict at the head" "$(is "$(jq -r '.body | split("\n")[0]' <<< "$review_out")" 'Verdict: APPROVE at abc')"
check "a Minor finding is a line of the body, not a thread" \
  "$(is "$(jq -r '.comments | length' <<< "$review_out"):$(contains "$(jq -r .body <<< "$review_out")" 'Minor\*\* `a.go:3`')" 0:true)"
scan_with '{"summary":"Fine.","findings":[{"path":"a.go","line":3,"severity":"Medium","body":"The error is dropped."}]}'
check "the folded body carries the finding that has a thread" "$(contains "$(jq -r .folded <<< "$review_out")" 'Medium\*\* `a.go:3`: The error is dropped.')"
check "a Medium finding keeps the verdict APPROVE" "$(is "$(jq -r .verdict <<< "$review_out")" APPROVE)"
check "a new Medium finding opens a thread on its line" \
  "$(is "$(jq -c '.comments[0] | [.path, .line, .side]' <<< "$review_out")" '["a.go",3,"RIGHT"]')"
scan_with '{"summary":"Bad.","findings":[{"path":"a.go","line":3,"severity":"High","body":"The token leaks."}]}'
check "a High finding makes the verdict CHANGES and opens a thread" \
  "$(is "$(jq -r '"\(.verdict):\(.comments | length)"' <<< "$review_out")" CHANGES:1)"
scan_with '{"summary":"Still.","findings":[{"path":"a.go","line":3,"severity":"High","body":"Still dropped.","earlier_comment_id":42}]}'
check "a finding an earlier comment raised opens no second thread" \
  "$(is "$(jq -r '.comments | length' <<< "$review_out"):$(contains "$(jq -r .body <<< "$review_out")" 'still stands, comment 42')" 0:true)"
scan_with '{"summary":"Still.","findings":[{"path":"a.go","line":3,"severity":"Medium","body":"x","earlier_comment_id":43},{"path":"a.go","line":4,"severity":"Medium","body":"y","earlier_comment_id":99}]}'
check "an id that names no comment of this workflow opens a thread" "$(is "$(jq -r '.comments | length' <<< "$review_out")" 2)"
scan_with '{"summary":"Fine.","findings":[{"path":"b.go","line":60,"severity":"Medium","body":"x"},{"path":"a.go","line":21,"severity":"Medium","body":"y"}]}'
check "a finding on a line no hunk shows opens its thread on the nearest hunk line" \
  "$(is "$(jq -c '.comments[0] | [.line, .body]' <<< "$review_out")" '[42,"**Medium** (line 60, which the diff does not show): x"]')"
check "a line in a later hunk keeps its line after a line that reads like a header" "$(is "$(jq -r '.comments[1].line' <<< "$review_out")" 21)"
scan_with '{"summary":"Fine.","findings":[{"path":"c.go","line":5,"severity":"Medium","body":"x"}]}'
check "a finding on a file the diff does not change keeps its line" "$(is "$(jq -c '.comments[0] | [.path, .line]' <<< "$review_out")" '["c.go",5]')"
scan_with '{"summary":"Made by acmecorp.","findings":[]}'
check "a private term withholds the review" "$(is "$status:$review_out" 1:)"
check "the refusal prints no term" "$(is "$(contains "$out" acmecorp)" false)"
scan_with '{"summary":"Fine.","findings":[{"path":"a.go","line":1,"severity":"Minor","body":"See ACME-12."}]}'
check "a private issue key withholds the review" "$(is "$status:$review_out" 1:)"
# The token fixtures are put together at run time, so this file holds no token-shaped text.
jwt_part() { printf 'ey%s' "J$1"; }
scan_with "{\"summary\":\"Token $(jwt_part hbGciOiJSUzI1NiJ9).$(jwt_part zdWIiOiJyZXBvOmZvcmsifQ).sig\",\"findings\":[]}"
check "a JSON web token withholds the review" "$(is "$status:$review_out" 1:)"
scan_with "{\"summary\":\"Token $(printf 'sk-%s-oat01-abcdefghijkl' ant)\",\"findings\":[]}"
check "an Anthropic token withholds the review" "$(is "$status:$review_out" 1:)"
scan_with '{"summary":"?","findings":"none"}'
check "an answer outside the schema fails" "$(is "$status:$(outvar review)" 1:)"
scan_with '{"summary":"?","findings":[{"path":"a.go","line":1,"severity":"Critical","body":"x"}]}'
check "a severity outside the schema fails" "$(is "$status:$(outvar review)" 1:)"
scan_with null
check "a session with no review fails" "$(is "$status:$(outvar review)" 1:)"
run scan EXECUTION_FILE="$work/missing.json" HEAD_SHA=abc PRIVATE_NAME_TERMS="$terms"
check "no execution file fails" "$(is "$status" 1)"

echo "post"
cd "$work/cwd"
approve='{"verdict":"APPROVE","body":"Verdict: APPROVE at abc","folded":"Verdict: APPROVE at abc","comments":[]}'
changes='{"verdict":"CHANGES","body":"Verdict: CHANGES at abc","folded":"Verdict: CHANGES at abc folded a.go:3","comments":[{"path":"a.go","line":3,"side":"RIGHT","body":"x"}]}'
run post DECISION=pass REASON=sync
check "a pass posts nothing and passes" "$(is "$status:$(wc -c < "$work/gh.log")" 0:0)"
run post DECISION=fail REASON='not a member'
check "a refusal posts nothing and fails" "$(is "$status:$(wc -c < "$work/gh.log")" 1:0)"
run post DECISION= MODEL_RESULT=failure
check "a model job that decided nothing fails" "$(is "$status" 1)"
run post DECISION=review MODEL_RESULT=failure PR_NUMBER=7 HEAD_SHA=abc
check "a failed or withheld review posts nothing and fails" "$(is "$status:$(wc -c < "$work/gh.log")" 1:0)"
run post DECISION=review MODEL_RESULT=success REVIEW="$approve" PR_NUMBER=7 HEAD_SHA=abc
check "an APPROVE posts one COMMENT review at the head and passes" \
  "$(is "$status:$(grep -c '^gh api -X POST repos/fork/legion/pulls/7/reviews' "$work/gh.log"):$(contains "$(cat "$work/gh.log")" '"commit_id":"abc","event":"COMMENT"')" 0:1:true)"
check "a posted APPROVE is recorded for the same diff" "$(is "$(cat fork-review-verdict)" APPROVE)"
run post DECISION=review MODEL_RESULT=success REVIEW="$changes" PR_NUMBER=7 HEAD_SHA=abc
check "a CHANGES posts its review, is recorded and fails" "$(is "$status:$(grep -c '^gh api' "$work/gh.log"):$(cat fork-review-verdict)" 1:1:CHANGES)"
rm fork-review-verdict
medium=$(jq -c '.verdict = "APPROVE"' <<< "$changes")
touch "$work/refuse-once"
run post DECISION=review MODEL_RESULT=success REVIEW="$medium" PR_NUMBER=7 HEAD_SHA=abc
check "a refused inline comment is posted in the body, fails and is not recorded" \
  "$(is "$status:$(grep -c '^gh api' "$work/gh.log"):$(contains "$(tail -n 2 "$work/gh.log")" '"body":"Verdict: CHANGES at abc folded a.go:3"}'):$([ -e fork-review-verdict ] && echo recorded)" 1:2:true:)"
cd "$script_dir"

echo "workflow"
wf=$(< "$workflow")
check "the action prints no transcript" "$(is "$(contains "$wf" "show_full_output: 'false'"):$(contains "$wf" "display_report: 'false'")" true:true)"
check "no other workflow can call this one" "$(is "$(contains "$wf" 'workflow_call:')" false)"
check "the workflow runs main's copy, not the pull request's" \
  "$(is "$(contains "$wf" '^  pull_request_target:'):$(contains "$wf" '^  pull_request:')" true:false)"
check "the review job runs whatever the model job did" "$(contains "$wf" 'if: \${{ !cancelled() }}')"
check "a pull request retargeted to main is reviewed" "$(contains "$wf" 'types: \[opened, synchronize, reopened, edited\]')"
check "an edit waits for the review in flight" "$(contains "$wf" "cancel-in-progress: .{{ github.event.action != 'edited' }}")"
check "the model runs only when decide says review" \
  "$(is "$(grep -c "if: steps.decide.outputs.decision == 'review'" "$workflow")" 2)"
check "only the review job may write the cache" \
  "$(is "$(grep -c '^    cache-mode: read$' "$workflow"):$(grep -c '^    cache-mode: write-only$' "$workflow")" 1:1)"
check "only a posted review saves its verdict" "$(contains "$wf" "if: .{{ !cancelled() && hashFiles('fork-review-verdict') != '' }}")"
check "the model has no shell, no skill and cannot write" "$(contains "$wf" '--disallowedTools "Bash,Skill,Edit,Write,')"
check "the model reads only the two directories it is given" \
  "$(is "$(contains "$wf" 'allowedTools "Agent,Read(/[$][{][{] github.workspace [}][}]/[*][*]),Read(/[$][{][{] steps.prepare.outputs.dir [}][}]/[*][*])"'):$(contains "$wf" 'Read,Grep')" true:false)"
check "the model's review never passes through env" "$(is "$(contains "$wf" 'outputs.structured_output')" false)"

summary "fork-review.sh"
