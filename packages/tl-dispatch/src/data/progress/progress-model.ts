import type { Issue, OpenAsk } from "@upstream-dispatch/api/types";

/** The fields of an issue read that the model uses. */
export type ProgressIssue = Pick<
  Issue,
  | "key"
  | "project"
  | "parent"
  | "status"
  | "title"
  | "assignee"
  | "priority"
  | "claim"
  | "created_at"
  | "updated_at"
  | "closed_at"
  | "advances"
>;

/** The fields of an open-ask read that the model uses. */
export type ProgressAsk = Pick<
  OpenAsk,
  "id" | "ref" | "created_at" | "urgency" | "waiting_on" | "waiting_on_person" | "owner"
>;

/** A tree's state, in sort order. The ids are the `?state=` values. */
export const STATE_ORDER = [
  "off-track",
  "at-risk",
  "on-track",
  "parked",
  "ready-to-close",
  "closed",
] as const;

export type ProgressState = (typeof STATE_ORDER)[number];

export const STATE_LABELS = {
  "off-track": "Off track",
  "at-risk": "At risk",
  "on-track": "On track",
  parked: "Parked",
  "ready-to-close": "Ready to close",
  closed: "Closed",
} as const satisfies Readonly<Record<ProgressState, string>>;

export const ASK_AT_RISK_DAYS = 2;
export const CHANGE_AT_RISK_DAYS = 7;
export const CHANGE_OFF_TRACK_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const IN_FLIGHT: ReadonlySet<string> = new Set(["in_progress", "testing", "needs_review", "retro"]);

export function isClosed(status: string): boolean {
  return status === "done";
}

export function isInFlight(status: string): boolean {
  return IN_FLIGHT.has(status);
}

/** Exactly N days is not more than N days. Times are epoch milliseconds. */
export function moreThanDays(from: number, now: number, days: number): boolean {
  return now - from > days * DAY_MS;
}

export interface ProgressIndex {
  readonly byKey: ReadonlyMap<string, ProgressIssue>;
  /** Each issue that has children, with its children in read order. */
  readonly children: ReadonlyMap<string, readonly ProgressIssue[]>;
  /** The issues with children whose parent is none or outside the reads, in read order. */
  readonly roots: readonly ProgressIssue[];
}

const NO_ISSUES: readonly ProgressIssue[] = [];

export function indexIssues(issues: readonly ProgressIssue[]): ProgressIndex {
  const byKey = new Map(issues.map((issue) => [issue.key, issue]));
  const children = new Map<string, ProgressIssue[]>();
  for (const issue of issues) {
    if (issue.parent === null) continue;
    const siblings = children.get(issue.parent);
    if (siblings === undefined) children.set(issue.parent, [issue]);
    else siblings.push(issue);
  }
  const roots = issues.filter(
    (issue) => children.has(issue.key) && (issue.parent === null || !byKey.has(issue.parent))
  );
  return { byKey, children, roots };
}

export function childrenOf(index: ProgressIndex, key: string): readonly ProgressIssue[] {
  return index.children.get(key) ?? NO_ISSUES;
}

/** The issue and its descendants, the issue first. A merged cache can hold a parent cycle, so
 *  the walk keeps the issues it has met. */
export function subtreeIssues(index: ProgressIndex, key: string): readonly ProgressIssue[] {
  const top = index.byKey.get(key);
  if (top === undefined) return NO_ISSUES;
  const found: ProgressIssue[] = [];
  const met = new Set([key]);
  const pending = [top];
  for (let issue = pending.pop(); issue !== undefined; issue = pending.pop()) {
    found.push(issue);
    for (const child of childrenOf(index, issue.key)) {
      if (met.has(child.key)) continue;
      met.add(child.key);
      pending.push(child);
    }
  }
  return found;
}
