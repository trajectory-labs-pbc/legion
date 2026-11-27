#!/usr/bin/env bash
# The steps of fork-review.yaml, the review this fork runs on each pull request with upstream's
# reviewer rules. That workflow's header says how the jobs fit together; each function below says
# what it reads and writes. Every function runs from main's copy of this file: the workflow runs on
# pull_request_target, which checks out main, and nothing here runs a file of the pull request.
# Run: .github/scripts/fork-review.sh gate|prepare|scan|post. Tests:
# .github/scripts/fork-review.test.sh, which fork-review-test.yaml runs.
set -euo pipefail
shopt -s inherit_errexit

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
review_dir_files="$script_dir/../fork-review"

fail() {
  echo "::error::$1" >&2
  exit 1
}

output() { # output NAME VALUE: one line of the step's outputs
  printf '%s=%s\n' "$1" "$2" >> "${GITHUB_OUTPUT:?}"
}

# The author associations whose pull requests, reviews and comments count as a member's.
members='["OWNER","MEMBER","COLLABORATOR"]'

# The sync pull request carries upstream's merged code, so it passes with no model call. Its
# author is the sync App, whose login no person can take, and its head is fork-sync here. A commit a
# person pushes there is read by the core approval, which main's ruleset requires from someone
# other than the last pusher.
gate() {
  local event=${GITHUB_EVENT_NAME:?} payload=${GITHUB_EVENT_PATH:?} decision reason
  local author head_ref head_repo base_repo
  [ "$event" = pull_request_target ] || fail "fork-review runs on pull_request_target, not on $event"
  author=$(jq -r '.pull_request.user.login' "$payload")
  head_ref=$(jq -r '.pull_request.head.ref' "$payload")
  head_repo=$(jq -r '.pull_request.head.repo.full_name // ""' "$payload")
  base_repo=$(jq -r '.pull_request.base.repo.full_name' "$payload")
  if [ "$author" = 'legion-upstream-sync[bot]' ] && [ "$head_ref" = fork-sync ] && [ "$head_repo" = "$base_repo" ]; then
    decision=pass
    reason="an upstream sync pull request: upstream reviewed its code before it merged"
  elif jq -e --argjson members "$members" '.pull_request.author_association as $a | $members | index($a)' "$payload" > /dev/null; then
    decision=review
    reason="the author is a member of the repository"
  else
    decision=refuse
    reason="the author is not a member of this repository, so no review runs: a maintainer takes the branch into this repository and opens the pull request from there"
  fi
  echo "$decision: $reason"
  output decision "$decision"
  output reason "$reason"
}

# REVIEW_DIR is outside the checkout, so nothing of the pull request lands in main's tree, which
# is the model's working directory.
prepare() {
  local dir pr=${PR_NUMBER:?} head=${HEAD_SHA:?} repository=${GITHUB_REPOSITORY:?} base
  dir=$(dirname "${GITHUB_WORKSPACE:?}")/fork-review
  mkdir -p "$dir"
  git fetch --no-tags --quiet origin "+refs/pull/$pr/head:refs/fork-review/head"
  git cat-file -e "$head^{commit}" 2> /dev/null || fail "the head $head is no longer on pull request $pr; the newer push's run reviews it"
  # A symlink is checked out as a file holding its target, so no path in the head leads outside it.
  git -c core.symlinks=false worktree add --detach --quiet "$dir/head" "$head"
  # Claude Code reads skills and commands from a .claude directory of an added directory, so the
  # head's own would reach the model as more than data. The diff still shows any change to them.
  find "$dir/head" -name .claude -prune -exec rm -rf {} +
  base=$(git merge-base HEAD "$head")
  git diff "$base" "$head" > "$dir/diff.patch"
  git log --format='%H %s' "$base..$head" > "$dir/commits.txt"
  jq -r '"# " + .pull_request.title + "\n\n" + (.pull_request.body // "")' "${GITHUB_EVENT_PATH:?}" > "$dir/pull-request.md"
  trusted "repos/$repository/pulls/$pr/reviews" '{user: .user.login, state, commit_id, body}' > "$dir/reviews.jsonl"
  trusted "repos/$repository/pulls/$pr/comments" '{id, in_reply_to_id, user: .user.login, path, line, body}' > "$dir/review-comments.jsonl"
  output dir "$dir"
  echo "prepared $dir: $(wc -l < "$dir/diff.patch") diff lines, $(wc -l < "$dir/commits.txt") commits"
  prompt "$dir" "$base" "$head" "$pr"
}

# trusted ENDPOINT FIELDS: the items of a paginated list whose author is a member or this
# workflow, as JSON lines of FIELDS. Anyone signed in can review a public pull request.
trusted() {
  gh api --paginate "$1" | jq -c --argjson members "$members" \
    ".[] | select((.author_association as \$a | \$members | index(\$a)) or .user.login == \"github-actions[bot]\") | $2"
}

# prompt DIR BASE HEAD PR: the prompt and the answer's schema, as step outputs.
prompt() {
  local text delimiter
  text=$(< "$review_dir_files/prompt.md")
  text=${text//@REVIEW_DIR@/$1}
  text=${text//@BASE_SHA@/$2}
  text=${text//@HEAD_SHA@/$3}
  text=${text//@PR_NUMBER@/$4}
  delimiter="FORK_REVIEW_$(openssl rand -hex 16)"
  printf 'prompt<<%s\n%s\n%s\n' "$delimiter" "$text" "$delimiter" >> "${GITHUB_OUTPUT:?}"
  output schema "$(jq -c . "$review_dir_files/review.schema.json")"
}

# The credentials the model's job holds: a JSON web token (its first two parts start with `eyJ`,
# an encoded `{"`), an Anthropic token and a GitHub token. A review never needs to quote one.
token_pattern='eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}|sk-ant-[A-Za-z0-9_-]{8,}|gh[opsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}'

# EXECUTION_FILE is the action's record of the model's session; its last result message holds
# the review and the cost.
scan() {
  local execution=${EXECUTION_FILE:?} head=${HEAD_SHA:?} work review usage
  work=$(mktemp -d)
  trap 'rm -rf "$work"' RETURN
  [ -f "$execution" ] || fail "the model's session left no execution file"
  jq '[.[]? | select(.type? == "result")] | last // {}' "$execution" > "$work/result.json"
  review=$(jq -c '.structured_output // null' "$work/result.json")
  usage=$(jq -r '"model cost: \(.total_cost_usd // "unknown") USD over \(.num_turns // "unknown") turns"' "$work/result.json")
  echo "$usage" | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
  # The action holds the answer to the schema. This holds the severities the verdict is read from
  # to the schema's own list, so an answer outside it never reads as APPROVE.
  jq -en --slurpfile schema "$review_dir_files/review.schema.json" --argjson review "$review" '
    $schema[0].properties as $p
    | ($review.findings | type == "array")
      and all($review.findings[]; . as $f | ($p.findings.items.properties.severity.enum | index($f.severity)) and ($f.line | type == "number"))
  ' > /dev/null 2>&1 || fail "the model returned no review in the schema's shape"
  # Main's ruleset requires every review thread resolved before a merge, so only a new Medium or
  # High finding opens a thread. A Minor finding, and one an earlier comment of this workflow
  # already raised, is a line of the body. `folded` is the body with every finding in it, for when
  # GitHub refuses an inline comment.
  # The check fails on any Medium or High finding.
  jq -c --arg head "$head" '
    def blocking: .severity != "Minor";
    (if any(.findings[]; blocking) then "CHANGES" else "APPROVE" end) as $verdict
    | def inline: blocking and .earlier_comment_id == null;
    def item: "- **\(.severity)** `\(.path):\(.line)`\(if .earlier_comment_id then " (still stands, comment \(.earlier_comment_id))" else "" end): \(.body)";
    . as $r
    | def body($findings): [
        "Verdict: \($verdict) at \($head)", $r.summary,
        (if $findings == [] then empty else "Findings without a thread:\n\n" + ($findings | map(item) | join("\n")) end),
        "---\nUpstream'"'"'s reviewer rules, run by `.github/workflows/fork-review.yaml`. A Medium or High finding fails the `review` check."
      ] | join("\n\n");
    {
      verdict: $verdict,
      body: body([.findings[] | select(inline | not)]),
      folded: body(.findings),
      comments: [.findings[] | select(inline) | {path, line, side: "RIGHT", body: "**\(.severity)**: \(.body)"}]
    }' <<< "$review" > "$work/review.json"
  # `folded` holds every word the review can post.
  jq -r .folded "$work/review.json" > "$work/text"
  if grep -Eq "$token_pattern" "$work/text"; then
    fail "the review's text holds a token, so it is not posted"
  fi
  # The pr-title check reads every review on the pull request with these rules, and a posted
  # review cannot be deleted, so the text passes them first. A hit prints its line, never its text.
  if ! PRIVATE_NAME_BARE_HOSTS=yes "$script_dir/check-private-names.sh" "$work/text" > /dev/null 2>&1 \
    || ! PRIVATE_NAME_RULES=keys "$script_dir/check-private-names.sh" "$work/text" > /dev/null 2>&1; then
    fail "the review's text names a private name, so it is not posted"
  fi
  output review "$(< "$work/review.json")"
  jq -r --arg head "$head" '"verdict \(.verdict) at \($head), \(.comments | length) inline comments"' "$work/review.json"
}

post() {
  local decision=${DECISION:-} pr head repository=${GITHUB_REPOSITORY:?} review err verdict
  case $decision in
    pass) echo "pass: ${REASON:?}"; return 0 ;;
    refuse) fail "${REASON:?}" ;;
    review) ;;
    *) fail "the model job decided nothing (its result: ${MODEL_RESULT:-none})" ;;
  esac
  [ "${MODEL_RESULT:-}" = success ] || fail "the model job ended with ${MODEL_RESULT:-no result}, so no review is posted; its log names why"
  pr=${PR_NUMBER:?} head=${HEAD_SHA:?} review=${REVIEW:?}
  err=$(mktemp)
  if ! jq -c --arg head "$head" '{commit_id: $head, event: "COMMENT", body, comments}' <<< "$review" \
    | gh api -X POST "repos/$repository/pulls/$pr/reviews" --input - > /dev/null 2> "$err"; then
    # GitHub refuses the whole review when one comment's line is outside the diff, so the
    # findings go into the body instead, which the scan read whole.
    grep -q 'HTTP 422' "$err" || { cat "$err" >&2; fail "GitHub refused the review"; }
    echo "GitHub refused an inline comment; posting the comments in the body"
    jq -c --arg head "$head" '{commit_id: $head, event: "COMMENT", body: .folded}' <<< "$review" \
      | gh api -X POST "repos/$repository/pulls/$pr/reviews" --input - > /dev/null
  fi
  verdict=$(jq -r .verdict <<< "$review")
  [ "$verdict" = APPROVE ] || fail "the review at $head has a Medium or High finding (verdict $verdict)"
  echo "APPROVE at $head"
}

case ${1:-} in
  gate | prepare | scan | post) "$1" ;;
  *) fail "usage: fork-review.sh gate|prepare|scan|post" ;;
esac
