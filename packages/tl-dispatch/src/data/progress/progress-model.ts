import type { Issue, OpenAsk } from "@legion/contracts";
import { isLegionRole } from "@legion/contracts";
import type { AgentState } from "@upstream-dispatch/features/refs/agent-registry";

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
/** R1's stale term, apart from R2's limits. */
export const STALE_DAYS = 7;

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

/** The agent registry as the model reads it, by bare session id. */
export interface ProgressAgents {
  /** False before the first read lands and after a failed read: no agent figures then. */
  readonly known: boolean;
  state(sessionId: string): AgentState;
  readonly titles: ReadonlyMap<string, string>;
}

export interface ProgressInput {
  readonly issues: readonly ProgressIssue[];
  readonly asks: readonly ProgressAsk[];
  readonly agents: ProgressAgents;
}

const CLAUDE_CODE_PREFIX = "claude-code:";
const LEGION_TITLE_PREFIX = "Legion ";
const LEGION_TITLE_SEPARATOR = " · ";

/** The agents read lists bare ids, and a claim can carry Claude Code's prefix. */
export function bareSessionId(id: string): string {
  return id.startsWith(CLAUDE_CODE_PREFIX) ? id.slice(CLAUDE_CODE_PREFIX.length) : id;
}

/** The issue a Legion role's title `Legion <role> · <KEY>` names; a controller's names none. */
export function workedIssueOf(title: string): string | undefined {
  const trimmed = title.trim();
  if (!trimmed.startsWith(LEGION_TITLE_PREFIX)) return undefined;
  const rest = trimmed.slice(LEGION_TITLE_PREFIX.length);
  const at = rest.indexOf(LEGION_TITLE_SEPARATOR);
  if (at < 0) return undefined;
  const role = rest.slice(0, at).trim();
  const subject = rest.slice(at + LEGION_TITLE_SEPARATOR.length).trim();
  return subject !== "" && isLegionRole(role) ? subject : undefined;
}

const isRunning = (state: AgentState) => state === "running" || state === "unresponsive";

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
  /** Distinct running sessions linked to an open issue; null while the registry is unknown. */
  readonly agents: number | null;
  /** Claims on open issues that sessions not running hold; null while the registry is unknown. */
  readonly notRunningClaims: number | null;
  readonly state: ProgressState;
}

export type SubtreeCounts = Omit<ProgressFigures, "issue" | "state"> & {
  readonly issue: Pick<ProgressIssue, "status">;
};

/** The first rule that applies gives the state. */
export function stateOf(counts: SubtreeCounts, now: number): ProgressState {
  const allBelowClosed = counts.descendantsClosed === counts.descendants;
  if (allBelowClosed) return isClosed(counts.issue.status) ? "closed" : "ready-to-close";
  if (counts.inFlight === 0) return "parked";
  const { lastChange, oldestAsk } = counts;
  if (lastChange !== null && moreThanDays(lastChange, now, CHANGE_OFF_TRACK_DAYS)) {
    return "off-track";
  }
  const changeLate = lastChange !== null && moreThanDays(lastChange, now, CHANGE_AT_RISK_DAYS);
  const askLate = oldestAsk !== null && moreThanDays(oldestAsk, now, ASK_AT_RISK_DAYS);
  return changeLate || askLate ? "at-risk" : "on-track";
}

export interface ProgressModel {
  readonly now: number;
  readonly index: ProgressIndex;
  /** Null while the registry is unknown. */
  readonly agents: ProgressAgents | null;
  /** The running sessions whose title names each issue. */
  readonly titledSessions: ReadonlyMap<string, readonly string[]>;
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
  readonly agents: ReadonlySet<string>;
  readonly notRunningClaims: number;
}

const NO_SESSIONS: ReadonlySet<string> = new Set();

const NO_TOTALS: Totals = {
  size: 0,
  closed: 0,
  open: 0,
  inFlight: 0,
  lastChange: null,
  stale: 0,
  waitingAsks: 0,
  oldestAsk: null,
  agents: NO_SESSIONS,
  notRunningClaims: 0,
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

/** Shares a set when the other adds nothing, so a tree with few agents copies few sets. */
function union(a: ReadonlySet<string>, b: ReadonlySet<string>): ReadonlySet<string> {
  const [large, small] = a.size >= b.size ? [a, b] : [b, a];
  let merged: Set<string> | undefined;
  for (const id of small) {
    if (large.has(id)) continue;
    merged ??= new Set(large);
    merged.add(id);
  }
  return merged ?? large;
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
    agents: union(a.agents, b.agents),
    notRunningClaims: a.notRunningClaims + b.notRunningClaims,
  };
}

interface IssueLinks {
  readonly agents: readonly string[];
  readonly notRunningClaim: boolean;
}

const NO_LINKS: IssueLinks = { agents: [], notRunningClaim: false };

/** The running sessions an open issue's claim or a title links to it, and a not-running claim. */
function linksOf(model: ProgressModel, issue: ProgressIssue): IssueLinks {
  const registry = model.agents;
  if (registry === null || isClosed(issue.status)) return NO_LINKS;
  const titled = model.titledSessions.get(issue.key) ?? [];
  const claim = issue.claim;
  if (claim === null || claim.actor.kind !== "session") {
    return titled.length === 0 ? NO_LINKS : { agents: titled, notRunningClaim: false };
  }
  const holder = bareSessionId(claim.actor.id);
  const state = registry.state(holder);
  if (isRunning(state)) return { agents: [holder, ...titled], notRunningClaim: false };
  return { agents: titled, notRunningClaim: state === "not-running" };
}

function isStale(issue: ProgressIssue, now: number): boolean {
  return isInFlight(issue.status) && moreThanDays(Date.parse(issue.updated_at), now, STALE_DAYS);
}

function ownTotals(model: ProgressModel, issue: ProgressIssue): Totals {
  const open = !isClosed(issue.status);
  const asks = model.asksByIssue.get(issue.key) ?? NO_ASKS;
  let oldestAsk: number | null = null;
  for (const each of asks) oldestAsk = older(oldestAsk, Date.parse(each.created_at));
  const links = linksOf(model, issue);
  return {
    size: 1,
    closed: open ? 0 : 1,
    open: open ? 1 : 0,
    inFlight: isInFlight(issue.status) ? 1 : 0,
    lastChange: open ? Date.parse(issue.updated_at) : null,
    stale: isStale(issue, model.now) ? 1 : 0,
    waitingAsks: asks.length,
    oldestAsk,
    agents: links.agents.length === 0 ? NO_SESSIONS : new Set(links.agents),
    notRunningClaims: links.notRunningClaim ? 1 : 0,
  };
}

function figuresFrom(
  issue: ProgressIssue,
  all: Totals,
  below: Totals,
  now: number,
  known: boolean
): ProgressFigures {
  const counts = {
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
    agents: known ? all.agents.size : null,
    notRunningClaims: known ? all.notRunningClaims : null,
  };
  return { ...counts, state: stateOf(counts, now) };
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
  const all = addTotals(ownTotals(model, issue), below);
  if (children.length > 0) {
    figures.set(issue.key, figuresFrom(issue, all, below, model.now, model.agents !== null));
  }
  return all;
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

function sessionsByTitle(agents: ProgressAgents | null): Map<string, string[]> {
  const byIssue = new Map<string, string[]>();
  if (agents === null) return byIssue;
  for (const [sessionId, title] of agents.titles) {
    const key = workedIssueOf(title);
    if (key === undefined || !isRunning(agents.state(sessionId))) continue;
    const held = byIssue.get(key);
    if (held === undefined) byIssue.set(key, [sessionId]);
    else held.push(sessionId);
  }
  return byIssue;
}

export function progressModel(input: ProgressInput, now: number): ProgressModel {
  const index = indexIssues(input.issues);
  const figures = new Map<string, ProgressFigures>();
  const agents = input.agents.known ? input.agents : null;
  const model: ProgressModel = {
    now,
    index,
    agents,
    titledSessions: sessionsByTitle(agents),
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

export interface ProgressAgent {
  readonly sessionId: string;
  /** The open issues of the subtree that it holds or works on. */
  readonly issues: readonly ProgressIssue[];
}

/** The agents of a subtree, each with its issues; none while the registry is unknown. */
export function agentsOf(model: ProgressModel, key: string): ProgressAgent[] {
  const bySession = new Map<string, ProgressIssue[]>();
  for (const issue of subtreeIssues(model.index, key)) {
    for (const sessionId of new Set(linksOf(model, issue).agents)) {
      const held = bySession.get(sessionId);
      if (held === undefined) bySession.set(sessionId, [issue]);
      else held.push(issue);
    }
  }
  return [...bySession].map(([sessionId, issues]) => ({ sessionId, issues }));
}

/** The open issues of a subtree whose claim a session not running holds. */
export function notRunningClaims(model: ProgressModel, key: string): ProgressIssue[] {
  return subtreeIssues(model.index, key).filter((issue) => linksOf(model, issue).notRunningClaim);
}

export const CHART_WEEKS = 8;

const WEEK_MS = 7 * DAY_MS;

export interface WeekFigures {
  /** Monday 00:00 UTC, epoch milliseconds. */
  readonly start: number;
  /** The current week, which runs only up to now. */
  readonly partial: boolean;
  readonly created: number;
  readonly closed: number;
  /** The median of `closed_at` minus `created_at` over the week's closes; null with none. */
  readonly medianLeadDays: number | null;
}

/** The start of the UTC week, from Monday 00:00, that holds `time`. */
export function weekStart(time: number): number {
  const day = new Date(time);
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  return Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - sinceMonday);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2;
}

/** The current week and the 7 full weeks before it, oldest first. */
export function weeklyFigures(
  issues: readonly Pick<ProgressIssue, "status" | "created_at" | "closed_at">[],
  now: number
): WeekFigures[] {
  const first = weekStart(now) - (CHART_WEEKS - 1) * WEEK_MS;
  const weekOf = (time: number) => {
    if (!Number.isFinite(time)) return undefined;
    const week = Math.floor((time - first) / WEEK_MS);
    return time > now || week < 0 || week >= CHART_WEEKS ? undefined : week;
  };
  const created = new Array<number>(CHART_WEEKS).fill(0);
  const leads = Array.from({ length: CHART_WEEKS }, (): number[] => []);
  for (const issue of issues) {
    const opened = Date.parse(issue.created_at);
    const openedWeek = weekOf(opened);
    if (openedWeek !== undefined) created[openedWeek] = (created[openedWeek] ?? 0) + 1;
    if (issue.closed_at === null || !isClosed(issue.status)) continue;
    const closed = Date.parse(issue.closed_at);
    const closedWeek = weekOf(closed);
    if (closedWeek !== undefined) leads[closedWeek]?.push((closed - opened) / DAY_MS);
  }
  return leads.map((weekLeads, week) => ({
    start: first + week * WEEK_MS,
    partial: week === CHART_WEEKS - 1,
    created: created[week] ?? 0,
    closed: weekLeads.length,
    medianLeadDays: median(weekLeads),
  }));
}
