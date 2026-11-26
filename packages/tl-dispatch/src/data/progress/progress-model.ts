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

export interface ProgressInput {
  readonly issues: readonly ProgressIssue[];
  readonly asks: readonly ProgressAsk[];
}

/** The figures of one subtree: the issue's own counts, then its descendants'. */
export interface ProgressFigures {
  readonly issue: ProgressIssue;
  readonly descendants: number;
  readonly descendantsClosed: number;
  /** Rounded down, so 100 means every descendant is closed. */
  readonly percentClosed: number;
  /** The open issues of the subtree, the issue included. */
  readonly open: number;
  readonly inFlight: number;
  /** The newest `updated_at` of an open issue, or null when none is open. */
  readonly lastChange: number | null;
  readonly stale: number;
  readonly waitingAsks: number;
  /** The `created_at` of the oldest waiting ask, or null when none waits. */
  readonly oldestAsk: number | null;
}

export interface ProgressModel {
  readonly now: number;
  readonly index: ProgressIndex;
  /** The waiting asks of each open issue that has one. */
  readonly asksByIssue: ReadonlyMap<string, readonly ProgressAsk[]>;
  /** The figures of every issue with children that a walk from a root meets. */
  readonly figures: ReadonlyMap<string, ProgressFigures>;
}

interface Totals {
  readonly size: number;
  readonly closed: number;
  readonly open: number;
  readonly inFlight: number;
  readonly lastChange: number | null;
  readonly stale: number;
  readonly waitingAsks: number;
  readonly oldestAsk: number | null;
}

const NO_TOTALS: Totals = {
  size: 0,
  closed: 0,
  open: 0,
  inFlight: 0,
  lastChange: null,
  stale: 0,
  waitingAsks: 0,
  oldestAsk: null,
};

const NO_ASKS: readonly ProgressAsk[] = [];

function newer(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  return b === null ? a : Math.max(a, b);
}

function older(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  return b === null ? a : Math.min(a, b);
}

function addTotals(a: Totals, b: Totals): Totals {
  return {
    size: a.size + b.size,
    closed: a.closed + b.closed,
    open: a.open + b.open,
    inFlight: a.inFlight + b.inFlight,
    lastChange: newer(a.lastChange, b.lastChange),
    stale: a.stale + b.stale,
    waitingAsks: a.waitingAsks + b.waitingAsks,
    oldestAsk: older(a.oldestAsk, b.oldestAsk),
  };
}

function isStale(issue: ProgressIssue, now: number): boolean {
  return (
    isInFlight(issue.status) && moreThanDays(Date.parse(issue.updated_at), now, CHANGE_AT_RISK_DAYS)
  );
}

function ownTotals(model: ProgressModel, issue: ProgressIssue): Totals {
  const open = !isClosed(issue.status);
  const asks = model.asksByIssue.get(issue.key) ?? NO_ASKS;
  let oldestAsk: number | null = null;
  for (const each of asks) oldestAsk = older(oldestAsk, Date.parse(each.created_at));
  return {
    size: 1,
    closed: open ? 0 : 1,
    open: open ? 1 : 0,
    inFlight: isInFlight(issue.status) ? 1 : 0,
    lastChange: open ? Date.parse(issue.updated_at) : null,
    stale: isStale(issue, model.now) ? 1 : 0,
    waitingAsks: asks.length,
    oldestAsk,
  };
}

function figuresFrom(issue: ProgressIssue, own: Totals, below: Totals): ProgressFigures {
  const all = addTotals(own, below);
  return {
    issue,
    descendants: below.size,
    descendantsClosed: below.closed,
    percentClosed: below.size === 0 ? 0 : Math.floor((below.closed * 100) / below.size),
    open: all.open,
    inFlight: all.inFlight,
    lastChange: all.lastChange,
    stale: all.stale,
    waitingAsks: all.waitingAsks,
    oldestAsk: all.oldestAsk,
  };
}

/** Walks children before their parent, so each issue's totals add to its parent's. */
function foldSubtree(
  model: ProgressModel,
  issue: ProgressIssue,
  met: Set<string>,
  figures: Map<string, ProgressFigures>
): Totals {
  met.add(issue.key);
  let below = NO_TOTALS;
  const children = childrenOf(model.index, issue.key);
  for (const child of children) {
    if (!met.has(child.key)) below = addTotals(below, foldSubtree(model, child, met, figures));
  }
  const own = ownTotals(model, issue);
  if (children.length > 0) figures.set(issue.key, figuresFrom(issue, own, below));
  return addTotals(own, below);
}

function asksOfOpenIssues(
  index: ProgressIndex,
  asks: readonly ProgressAsk[]
): Map<string, ProgressAsk[]> {
  const byIssue = new Map<string, ProgressAsk[]>();
  for (const each of asks) {
    const key = each.owner.issue?.key;
    if (each.waiting_on !== "human" || key === undefined) continue;
    const issue = index.byKey.get(key);
    if (issue === undefined || isClosed(issue.status)) continue;
    const held = byIssue.get(key);
    if (held === undefined) byIssue.set(key, [each]);
    else held.push(each);
  }
  return byIssue;
}

export function progressModel(input: ProgressInput, now: number): ProgressModel {
  const index = indexIssues(input.issues);
  const figures = new Map<string, ProgressFigures>();
  const model: ProgressModel = {
    now,
    index,
    asksByIssue: asksOfOpenIssues(index, input.asks),
    figures,
  };
  const met = new Set<string>();
  for (const root of index.roots) foldSubtree(model, root, met, figures);
  return model;
}

/** The figures of any issue with children, a member of a parent cycle included. */
export function figuresFor(model: ProgressModel, key: string): ProgressFigures | undefined {
  const known = model.figures.get(key);
  if (known !== undefined) return known;
  const issue = model.index.byKey.get(key);
  if (issue === undefined) return undefined;
  const figures = new Map<string, ProgressFigures>();
  foldSubtree(model, issue, new Set(), figures);
  return figures.get(key);
}

const byTime =
  <T>(time: (item: T) => string) =>
  (a: T, b: T) =>
    Date.parse(time(a)) - Date.parse(time(b));

/** The stale issues of a subtree, oldest change first. */
export function staleIssues(model: ProgressModel, key: string): ProgressIssue[] {
  return subtreeIssues(model.index, key)
    .filter((issue) => isStale(issue, model.now))
    .sort(byTime((issue) => issue.updated_at));
}

/** The waiting asks of a subtree, oldest first. */
export function waitingAsks(model: ProgressModel, key: string): ProgressAsk[] {
  return subtreeIssues(model.index, key)
    .flatMap((issue) => model.asksByIssue.get(issue.key) ?? NO_ASKS)
    .sort(byTime((each) => each.created_at));
}
