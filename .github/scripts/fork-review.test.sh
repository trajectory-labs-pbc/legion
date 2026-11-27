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

# payload <author> <association> <head ref> <head repo>: a pull_request_target payload.
payload() {
  jq -n --arg author "$1" --arg association "$2" --arg ref "$3" --arg repo "$4" \
    '{pull_request: {user: {login: $author}, author_association: $association,
      head: {ref: $ref, repo: {full_name: $repo}}, base: {repo: {full_name: "fork/legion"}}}}' > "$work/event.json"
}

echo "gate"
payload person MEMBER feat/x fork/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "a member's pull request is reviewed" "$(is "$status:$(outvar decision)" 0:review)"
payload person CONTRIBUTOR feat/x person/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "an outside author's pull request is refused" "$(is "$status:$(outvar decision)" 0:refuse)"
check "the refusal says what to do" "$(contains "$(outvar reason)" 'a maintainer takes the branch')"
payload 'legion-upstream-sync[bot]' NONE fork-sync fork/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "the upstream sync passes" "$(is "$status:$(outvar decision)" 0:pass)"
payload person MEMBER fork-sync fork/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "a member's branch named fork-sync is reviewed" "$(is "$(outvar decision)" review)"
payload 'legion-upstream-sync[bot]' NONE fork-sync other/legion
run gate GITHUB_EVENT_NAME=pull_request_target GITHUB_EVENT_PATH="$work/event.json"
check "a fork-sync branch from another repository is refused" "$(is "$(outvar decision)" refuse)"
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
echo skill > "$work/main/.claude/skills/x.md"
ln -s /etc/hostname "$work/main/out"
git -C "$work/main" add -A
git -C "$work/main" -c user.name=t -c user.email=t@t commit --quiet -m change
git -C "$work/main" push --quiet "$work/origin.git" HEAD:refs/pull/7/head
pr_head=$(git -C "$work/main" rev-parse HEAD)
git clone --quiet -b main "$work/origin.git" "$work/ws/legion"
jq -n '{pull_request: {title: "Change", body: "Why."}}' > "$work/event.json"
jq -n '[{id: 1, author_association: "MEMBER", user: {login: "a"}, body: "member"},
  {id: 2, author_association: "NONE", user: {login: "b"}, body: "outsider"},
  {id: 3, author_association: "NONE", user: {login: "github-actions[bot]"}, body: "workflow"}]' > "$work/gh-answer"
cd "$work/ws/legion"
run prepare PR_NUMBER=7 HEAD_SHA="$pr_head" GITHUB_WORKSPACE="$work/ws/legion" GITHUB_EVENT_PATH="$work/event.json"
cd "$script_dir"
rm "$work/gh-answer"
check "prepare writes the head beside the checkout" "$(is "$status:$(outvar dir):$(cat "$work/ws/fork-review/head/a.txt")" "0:$work/ws/fork-review:hello")"
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

echo "scan"
terms=$'acmecorp\nkey:ACME'
# scan_with <review JSON>: run scan over an execution file whose result holds it.
scan_with() {
  jq -n --argjson review "$1" '[{type: "system"}, {type: "result", total_cost_usd: 0.5, structured_output: $review}]' > "$work/execution.json"
  run scan EXECUTION_FILE="$work/execution.json" HEAD_SHA=abc PRIVATE_NAME_TERMS="$terms"
  review_out=$(outvar review)
}
scan_with '{"summary":"Fine.","findings":[{"path":"a.go","line":3,"severity":"Minor","body":"Rename x."}]}'
check "a clean review passes on" "$(is "$status:$([ -n "$review_out" ] && echo set)" 0:set)"
check "the body starts with the verdict at the head" "$(is "$(jq -r '.body | split("\n")[0]' <<< "$review_out")" 'Verdict: APPROVE at abc')"
check "a Minor finding is a line of the body, not a thread" \
  "$(is "$(jq -r '.comments | length' <<< "$review_out"):$(contains "$(jq -r .body <<< "$review_out")" 'Minor\*\* `a.go:3`')" 0:true)"
scan_with '{"summary":"Fine.","findings":[{"path":"a.go","line":3,"severity":"Medium","body":"The error is dropped."}]}'
check "the folded body carries the finding that has a thread" "$(contains "$(jq -r .folded <<< "$review_out")" 'Medium\*\* `a.go:3`: The error is dropped.')"
check "a Medium finding makes the verdict CHANGES" "$(is "$(jq -r .verdict <<< "$review_out")" CHANGES)"
check "a new Medium finding opens a thread on its line" \
  "$(is "$(jq -c '.comments[0] | [.path, .line, .side]' <<< "$review_out")" '["a.go",3,"RIGHT"]')"
scan_with '{"summary":"Still.","findings":[{"path":"a.go","line":3,"severity":"High","body":"Still dropped.","earlier_comment_id":42}]}'
check "a finding an earlier comment raised opens no second thread" \
  "$(is "$(jq -r '.comments | length' <<< "$review_out"):$(contains "$(jq -r .body <<< "$review_out")" 'still stands, comment 42')" 0:true)"
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
approve='{"verdict":"APPROVE","body":"Verdict: APPROVE at abc","folded":"Verdict: APPROVE at abc","comments":[]}'
changes='{"verdict":"CHANGES","body":"Verdict: CHANGES at abc","folded":"Verdict: CHANGES at abc folded a.go:3","comments":[{"path":"a.go","line":3,"side":"RIGHT","body":"x"}]}'
run post DECISION=pass REASON=sync
check "a pass posts nothing and passes" "$(is "$status:$(wc -c < "$work/gh.log")" 0:0)"
run post DECISION=refuse REASON='not a member'
check "a refusal posts nothing and fails" "$(is "$status:$(wc -c < "$work/gh.log")" 1:0)"
run post DECISION= MODEL_RESULT=failure
check "a model job that decided nothing fails" "$(is "$status" 1)"
run post DECISION=review MODEL_RESULT=failure PR_NUMBER=7 HEAD_SHA=abc
check "a failed or withheld review posts nothing and fails" "$(is "$status:$(wc -c < "$work/gh.log")" 1:0)"
run post DECISION=review MODEL_RESULT=success REVIEW="$approve" PR_NUMBER=7 HEAD_SHA=abc
check "an APPROVE posts one COMMENT review at the head and passes" \
  "$(is "$status:$(grep -c '^gh api -X POST repos/fork/legion/pulls/7/reviews' "$work/gh.log"):$(contains "$(cat "$work/gh.log")" '"commit_id":"abc","event":"COMMENT"')" 0:1:true)"
run post DECISION=review MODEL_RESULT=success REVIEW="$changes" PR_NUMBER=7 HEAD_SHA=abc
check "a CHANGES posts its review and fails" "$(is "$status:$(grep -c '^gh api' "$work/gh.log")" 1:1)"
touch "$work/refuse-once"
run post DECISION=review MODEL_RESULT=success REVIEW="$changes" PR_NUMBER=7 HEAD_SHA=abc
check "a refused inline comment is posted again in the body" \
  "$(is "$(grep -c '^gh api' "$work/gh.log"):$(contains "$(tail -n 2 "$work/gh.log")" '"body":"Verdict: CHANGES at abc folded a.go:3"}')" 2:true)"

echo "workflow"
wf=$(< "$workflow")
check "the action prints no transcript" "$(is "$(contains "$wf" "show_full_output: 'false'"):$(contains "$wf" "display_report: 'false'")" true:true)"
check "no other workflow can call this one" "$(is "$(contains "$wf" 'workflow_call:')" false)"
check "the workflow runs main's copy, not the pull request's" \
  "$(is "$(contains "$wf" '^  pull_request_target:'):$(contains "$wf" '^  pull_request:')" true:false)"
check "the review job runs whatever the model job did" "$(contains "$wf" 'if: \${{ !cancelled() }}')"
check "the model has no shell, no skill and cannot write" "$(contains "$wf" '--disallowedTools "Bash,Skill,Edit,Write,')"
check "the model reads only the two directories it is given" \
  "$(is "$(contains "$wf" 'allowedTools "Agent,Read(/[$][{][{] github.workspace [}][}]/[*][*]),Read(/[$][{][{] steps.prepare.outputs.dir [}][}]/[*][*])"'):$(contains "$wf" 'Read,Grep')" true:false)"
check "the model's review never passes through env" "$(is "$(contains "$wf" 'outputs.structured_output')" false)"

summary "fork-review.sh"
