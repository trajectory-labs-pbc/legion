import { describe, expect, test } from "bun:test";
import type { AgentState } from "@upstream-dispatch/features/refs/agent-registry";

import {
  ASK_AT_RISK_DAYS,
  agentsOf,
  bareSessionId,
  CHANGE_AT_RISK_DAYS,
  CHANGE_OFF_TRACK_DAYS,
  figuresFor,
  indexIssues,
  isClosed,
  isInFlight,
  moreThanDays,
  notRunningClaims,
  type ProgressAgents,
  type ProgressAsk,
  type ProgressIssue,
  progressModel,
  STATE_ORDER,
  staleIssues,
  subtreeIssues,
  waitingAsks,
  workedIssueOf,
} from "./progress-model";

const NOW = Date.parse("2026-03-11T12:00:00Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

interface IssueFields {
  parent?: string;
  status?: string;
  updated?: number;
  created?: number;
  closed?: number;
  claim?: string;
  claimKind?: string;
}

/** An issue of project ALPHA; times are how long before NOW. */
function issue(key: string, fields: IssueFields = {}): ProgressIssue {
  const status = fields.status ?? "todo";
  return {
    key,
    project: "ALPHA",
    parent: fields.parent ?? null,
    status,
    title: `Title of ${key}`,
    assignee: "ada@example.test",
    priority: null,
    claim:
      fields.claim === undefined
        ? null
        : {
            actor: { id: fields.claim, kind: fields.claimKind ?? "session" },
            at: ago(DAY),
          },
    created_at: ago(fields.created ?? 30 * DAY),
    updated_at: ago(fields.updated ?? DAY),
    closed_at: fields.closed === undefined ? null : ago(fields.closed),
    advances: null,
  };
}

const keys = (issues: readonly ProgressIssue[]) => issues.map((each) => each.key);

/** An open ask on an issue, or on a project document when `on` is null; `age` is before NOW. */
function ask(id: string, on: string | null, age: number, waitingOn = "human"): ProgressAsk {
  return {
    id,
    ref: `dispatch://ask/${id}`,
    created_at: ago(age),
    urgency: "med",
    waiting_on: waitingOn,
    waiting_on_person: "ada@example.test",
    owner:
      on === null
        ? { document: { name: "notes.md", project: "ALPHA", slug: "notes-md" } }
        : { issue: { key: on, title: `Title of ${on}`, assignee: null } },
  };
}

/** The registry before its first read: every state is unknown. */
const UNKNOWN: ProgressAgents = { known: false, state: () => "unknown", titles: new Map() };

function model(
  issues: readonly ProgressIssue[],
  asks: readonly ProgressAsk[] = [],
  agents: ProgressAgents = UNKNOWN
) {
  return progressModel({ issues, asks, agents }, NOW);
}

/** A read registry that lists the named sessions; every other id is not running. */
function registry(
  states: Readonly<Record<string, AgentState>>,
  titles: Readonly<Record<string, string>> = {}
): ProgressAgents {
  return {
    known: true,
    state: (id) => states[id] ?? "not-running",
    titles: new Map(Object.entries(titles)),
  };
}

function figuresOf(issues: readonly ProgressIssue[], key: string, asks?: readonly ProgressAsk[]) {
  const figures = model(issues, asks).figures.get(key);
  if (figures === undefined) throw new Error(`no figures for ${key}`);
  return figures;
}

describe("progress terms", () => {
  test("only done closes an issue", () => {
    expect(isClosed("done")).toBe(true);
    for (const status of ["todo", "backlog", "in_progress", "testing", "needs_review", "retro"]) {
      expect(isClosed(status)).toBe(false);
    }
  });

  test("four statuses are in flight", () => {
    for (const status of ["in_progress", "testing", "needs_review", "retro"]) {
      expect(isInFlight(status)).toBe(true);
    }
    for (const status of ["todo", "backlog", "done"]) {
      expect(isInFlight(status)).toBe(false);
    }
  });

  test("more than N days is false at exactly N days and true 1 minute later", () => {
    expect(moreThanDays(NOW - 7 * DAY, NOW, 7)).toBe(false);
    expect(moreThanDays(NOW - 7 * DAY - MINUTE, NOW, 7)).toBe(true);
    expect(moreThanDays(NOW - 2 * DAY, NOW, 2)).toBe(false);
    expect(moreThanDays(NOW - 2 * DAY - MINUTE, NOW, 2)).toBe(true);
  });

  test("the limits and the state order", () => {
    expect([ASK_AT_RISK_DAYS, CHANGE_AT_RISK_DAYS, CHANGE_OFF_TRACK_DAYS]).toEqual([2, 7, 14]);
    expect(STATE_ORDER).toEqual([
      "off-track",
      "at-risk",
      "on-track",
      "parked",
      "ready-to-close",
      "closed",
    ]);
  });
});

describe("progress trees", () => {
  test("an issue with children and no parent, or a parent outside the reads, is a root", () => {
    const index = indexIssues([
      issue("ALPHA-1"),
      issue("ALPHA-2", { parent: "ALPHA-1" }),
      issue("ALPHA-3", { parent: "ALPHA-99" }),
      issue("ALPHA-4", { parent: "ALPHA-3" }),
      issue("ALPHA-5"),
    ]);
    expect(keys(index.roots)).toEqual(["ALPHA-1", "ALPHA-3"]);
    expect(keys(index.children.get("ALPHA-1") ?? [])).toEqual(["ALPHA-2"]);
  });

  test("an issue with no children is not a root", () => {
    expect(indexIssues([issue("ALPHA-5")]).roots).toEqual([]);
  });

  test("a walk from an issue of a parent cycle ends, and the list has no tree for it", () => {
    const index = indexIssues([
      issue("ALPHA-1", { parent: "ALPHA-2" }),
      issue("ALPHA-2", { parent: "ALPHA-1" }),
    ]);
    expect(index.roots).toEqual([]);
    expect(keys(subtreeIssues(index, "ALPHA-1"))).toEqual(["ALPHA-1", "ALPHA-2"]);
  });

  test("a subtree holds its issue and every descendant", () => {
    const index = indexIssues([
      issue("ALPHA-1"),
      issue("ALPHA-2", { parent: "ALPHA-1" }),
      issue("ALPHA-3", { parent: "ALPHA-2" }),
      issue("ALPHA-4", { parent: "ALPHA-1" }),
    ]);
    expect(keys(subtreeIssues(index, "ALPHA-1")).sort()).toEqual([
      "ALPHA-1",
      "ALPHA-2",
      "ALPHA-3",
      "ALPHA-4",
    ]);
    expect(keys(subtreeIssues(index, "ALPHA-2"))).toEqual(["ALPHA-2", "ALPHA-3"]);
    expect(subtreeIssues(index, "ALPHA-404")).toEqual([]);
  });
});

describe("progress figures", () => {
  test("descendants closed out of all descendants, and the in-flight count", () => {
    const figures = figuresOf(
      [
        issue("ALPHA-1", { status: "in_progress" }),
        issue("ALPHA-2", { parent: "ALPHA-1", status: "done" }),
        issue("ALPHA-3", { parent: "ALPHA-1", status: "testing" }),
        issue("ALPHA-4", { parent: "ALPHA-3", status: "done" }),
        issue("ALPHA-5", { parent: "ALPHA-3" }),
      ],
      "ALPHA-1"
    );
    expect(figures.descendants).toBe(4);
    expect(figures.descendantsClosed).toBe(2);
    expect(figures.percentClosed).toBe(50);
    expect(figures.inFlight).toBe(2);
  });

  test("each subtree has its own figures, which add to its parent's", () => {
    const { figures } = model([
      issue("ALPHA-1"),
      issue("ALPHA-2", { parent: "ALPHA-1", status: "retro" }),
      issue("ALPHA-3", { parent: "ALPHA-2", status: "done" }),
      issue("ALPHA-4", { parent: "ALPHA-2", status: "needs_review" }),
    ]);
    expect(figures.get("ALPHA-2")).toMatchObject({
      descendants: 2,
      descendantsClosed: 1,
      inFlight: 2,
    });
    expect(figures.get("ALPHA-1")).toMatchObject({
      descendants: 3,
      descendantsClosed: 1,
      inFlight: 2,
    });
    expect(figures.has("ALPHA-3")).toBe(false);
  });

  test("the percentage shows 100 only when every descendant is closed", () => {
    const issues = [issue("ALPHA-1")];
    for (let n = 2; n <= 201; n += 1) {
      issues.push(issue(`ALPHA-${n}`, { parent: "ALPHA-1", status: n === 2 ? "todo" : "done" }));
    }
    expect(figuresOf(issues, "ALPHA-1").percentClosed).toBe(99);
  });

  test("the closed-issue-change test: a closed descendant's newer change does not move the last change", () => {
    const figures = figuresOf(
      [
        issue("ALPHA-1", { updated: 10 * DAY }),
        issue("ALPHA-2", { parent: "ALPHA-1", status: "done", updated: MINUTE }),
        issue("ALPHA-3", { parent: "ALPHA-1", updated: 9 * DAY }),
      ],
      "ALPHA-1"
    );
    expect(figures.lastChange).toBe(NOW - 9 * DAY);
  });

  test("a newer change on the open root moves the last change", () => {
    const figures = figuresOf(
      [
        issue("ALPHA-1", { updated: DAY }),
        issue("ALPHA-2", { parent: "ALPHA-1", updated: 9 * DAY }),
      ],
      "ALPHA-1"
    );
    expect(figures.lastChange).toBe(NOW - DAY);
  });

  test("a tree with no open issue has no last change", () => {
    const figures = figuresOf(
      [
        issue("ALPHA-1", { status: "done" }),
        issue("ALPHA-2", { parent: "ALPHA-1", status: "done" }),
      ],
      "ALPHA-1"
    );
    expect(figures.lastChange).toBeNull();
    expect(figures.open).toBe(0);
  });

  test("stale issues are in-flight issues changed more than 7 days ago, oldest first", () => {
    const issues = [
      issue("ALPHA-1", { status: "in_progress", updated: 8 * DAY }),
      issue("ALPHA-2", { parent: "ALPHA-1", status: "testing", updated: 7 * DAY }),
      issue("ALPHA-3", { parent: "ALPHA-1", status: "needs_review", updated: 7 * DAY + MINUTE }),
      issue("ALPHA-4", { parent: "ALPHA-1", status: "todo", updated: 30 * DAY }),
      issue("ALPHA-5", { parent: "ALPHA-1", status: "retro", updated: 20 * DAY }),
    ];
    const built = model(issues);
    expect(built.figures.get("ALPHA-1")?.stale).toBe(3);
    expect(keys(staleIssues(built, "ALPHA-1"))).toEqual(["ALPHA-5", "ALPHA-1", "ALPHA-3"]);
  });

  test("waiting asks wait on a person, on an open issue of the tree; the oldest gives the age", () => {
    const issues = [
      issue("ALPHA-1"),
      issue("ALPHA-2", { parent: "ALPHA-1" }),
      issue("ALPHA-3", { parent: "ALPHA-1", status: "done" }),
    ];
    const asks = [
      ask("a1", "ALPHA-2", 3 * DAY),
      ask("a2", "ALPHA-1", 5 * DAY),
      ask("a3", "ALPHA-2", 9 * DAY, "agent"),
      ask("a4", "ALPHA-3", 9 * DAY),
      ask("a5", null, 9 * DAY),
      ask("a6", "BETA-1", 9 * DAY),
    ];
    const built = model(issues, asks);
    expect(built.figures.get("ALPHA-1")).toMatchObject({
      waitingAsks: 2,
      oldestAsk: NOW - 5 * DAY,
    });
    expect(waitingAsks(built, "ALPHA-1").map((each) => each.id)).toEqual(["a2", "a1"]);
  });

  test("a tree with no waiting ask has no oldest age", () => {
    const figures = figuresOf(
      [issue("ALPHA-1"), issue("ALPHA-2", { parent: "ALPHA-1" })],
      "ALPHA-1"
    );
    expect(figures).toMatchObject({ waitingAsks: 0, oldestAsk: null });
  });

  test("a tree page opened on an issue of a parent cycle gets figures", () => {
    const built = model([
      issue("ALPHA-1", { parent: "ALPHA-2", status: "in_progress" }),
      issue("ALPHA-2", { parent: "ALPHA-1" }),
    ]);
    expect(built.figures.has("ALPHA-1")).toBe(false);
    expect(figuresFor(built, "ALPHA-1")).toMatchObject({ descendants: 1, inFlight: 1 });
    expect(figuresFor(built, "ALPHA-404")).toBeUndefined();
  });
});

/** The state of a root ALPHA-1 with one child ALPHA-2, and asks on either. */
function stateOfTree(root: IssueFields, child: IssueFields, asks: readonly ProgressAsk[] = []) {
  return figuresOf(
    [issue("ALPHA-1", root), issue("ALPHA-2", { ...child, parent: "ALPHA-1" })],
    "ALPHA-1",
    asks
  ).state;
}

describe("progress states", () => {
  test("one tree of each state", () => {
    const working = { status: "in_progress", updated: DAY };
    expect(stateOfTree({}, working)).toBe("on-track");
    expect(stateOfTree({ updated: 10 * DAY }, { ...working, updated: 10 * DAY })).toBe("at-risk");
    expect(stateOfTree({ updated: 20 * DAY }, { ...working, updated: 20 * DAY })).toBe("off-track");
    expect(stateOfTree({}, { status: "todo" })).toBe("parked");
    expect(stateOfTree({}, { status: "done" })).toBe("ready-to-close");
    expect(stateOfTree({ status: "done" }, { status: "done" })).toBe("closed");
  });

  test("a waiting ask is At risk only when more than 2 days old", () => {
    const working = { status: "in_progress" };
    expect(stateOfTree({}, working, [ask("a1", "ALPHA-2", 2 * DAY)])).toBe("on-track");
    expect(stateOfTree({}, working, [ask("a1", "ALPHA-2", 2 * DAY + MINUTE)])).toBe("at-risk");
  });

  test("the off-track-limit test: a last change is At risk past 7 days and Off track past 14", () => {
    const at = (age: number) =>
      stateOfTree({ updated: age }, { status: "in_progress", updated: age });
    expect(at(7 * DAY)).toBe("on-track");
    expect(at(7 * DAY + MINUTE)).toBe("at-risk");
    expect(at(14 * DAY)).toBe("at-risk");
    expect(at(14 * DAY + MINUTE)).toBe("off-track");
  });

  test("the parked-and-old test: no work in flight is Parked, however old", () => {
    expect(
      stateOfTree({ updated: 20 * DAY }, { status: "todo", updated: 20 * DAY }, [
        ask("a1", "ALPHA-2", 3 * DAY),
      ])
    ).toBe("parked");
  });

  test("every descendant closed with the root in flight is Ready to close, however old", () => {
    expect(
      stateOfTree({ status: "in_progress", updated: 20 * DAY }, { status: "done" }, [
        ask("a1", "ALPHA-1", 3 * DAY),
      ])
    ).toBe("ready-to-close");
  });

  test("an old last change and an old ask give Off track", () => {
    expect(
      stateOfTree({ updated: 20 * DAY }, { status: "in_progress", updated: 20 * DAY }, [
        ask("a1", "ALPHA-2", 3 * DAY),
      ])
    ).toBe("off-track");
  });

  test("the closed-root test: a closed root with old work in flight below it is Off track", () => {
    expect(stateOfTree({ status: "done" }, { status: "in_progress", updated: 20 * DAY })).toBe(
      "off-track"
    );
  });

  test("a closed root with every descendant closed is Closed", () => {
    expect(stateOfTree({ status: "done", updated: 40 * DAY }, { status: "done" })).toBe("closed");
  });
});

describe("progress agents", () => {
  const tree = (...below: ProgressIssue[]) => [issue("ALPHA-1"), ...below];
  const child = (key: string, fields: IssueFields = {}) =>
    issue(key, { parent: "ALPHA-1", ...fields });

  test("a running or unresponsive holder is an agent; a not-running holder's claim is listed", () => {
    const built = model(
      tree(
        child("ALPHA-2", { claim: "s1" }),
        child("ALPHA-3", { claim: "s2" }),
        child("ALPHA-4", { claim: "s3" })
      ),
      [],
      registry({ s1: "running", s2: "unresponsive" })
    );
    expect(built.figures.get("ALPHA-1")).toMatchObject({ agents: 2, notRunningClaims: 1 });
    expect(
      agentsOf(built, "ALPHA-1")
        .map((agent) => agent.sessionId)
        .sort()
    ).toEqual(["s1", "s2"]);
    expect(keys(notRunningClaims(built, "ALPHA-1"))).toEqual(["ALPHA-4"]);
  });

  test("the prefixed-claim test: a claude-code: claim matches the bare id the registry lists", () => {
    expect(bareSessionId("claude-code:s1")).toBe("s1");
    expect(bareSessionId("s1")).toBe("s1");
    const built = model(
      tree(child("ALPHA-2", { claim: "claude-code:s1" })),
      [],
      registry({ s1: "running" })
    );
    expect(built.figures.get("ALPHA-1")).toMatchObject({ agents: 1, notRunningClaims: 0 });
  });

  test("a session titled for an open issue of the tree is an agent", () => {
    const built = model(
      tree(child("ALPHA-2"), child("ALPHA-3", { status: "done" })),
      [],
      registry(
        { s1: "running", s2: "running", s3: "running", s4: "running" },
        {
          s1: "Legion implementer · ALPHA-2",
          s2: "Legion implementer · ALPHA-3",
          s3: "Legion controller · ALPHA",
          s4: "Legion painter · ALPHA-2",
        }
      )
    );
    expect(agentsOf(built, "ALPHA-1")).toEqual([{ sessionId: "s1", issues: [child("ALPHA-2")] }]);
  });

  test("the title is read as Legion writes it", () => {
    expect(workedIssueOf("  Legion reviewer · ALPHA-7  ")).toBe("ALPHA-7");
    expect(workedIssueOf("Legion controller · ALPHA")).toBeUndefined();
    expect(workedIssueOf("Legion painter · ALPHA-7")).toBeUndefined();
    expect(workedIssueOf("Legion reviewer · ")).toBeUndefined();
    expect(workedIssueOf("Reviewer · ALPHA-7")).toBeUndefined();
  });

  test("a session linked to two open issues of a tree is one agent", () => {
    const built = model(
      tree(child("ALPHA-2", { claim: "s1" }), child("ALPHA-3", { claim: "s1" }), child("ALPHA-4")),
      [],
      registry({ s1: "running" }, { s1: "Legion tester · ALPHA-4" })
    );
    expect(built.figures.get("ALPHA-1")?.agents).toBe(1);
    expect(keys(agentsOf(built, "ALPHA-1")[0]?.issues ?? []).sort()).toEqual([
      "ALPHA-2",
      "ALPHA-3",
      "ALPHA-4",
    ]);
  });

  test("a claim on a closed issue, or held by a person, is neither an agent nor listed", () => {
    const built = model(
      tree(
        child("ALPHA-2", { status: "done", claim: "s1" }),
        child("ALPHA-3", { status: "done", claim: "s2" }),
        child("ALPHA-4", { claim: "ada@example.test", claimKind: "user" })
      ),
      [],
      registry({ s1: "running" })
    );
    expect(built.figures.get("ALPHA-1")).toMatchObject({ agents: 0, notRunningClaims: 0 });
  });

  test("with the registry unknown the model gives no agent figures", () => {
    const unknown = model(
      tree(child("ALPHA-2", { claim: "s1" }), child("ALPHA-3", { claim: "s2" })),
      [],
      { ...registry({ s1: "running" }, { s2: "Legion tester · ALPHA-3" }), known: false }
    );
    expect(unknown.figures.get("ALPHA-1")).toMatchObject({ agents: null, notRunningClaims: null });
    expect(agentsOf(unknown, "ALPHA-1")).toEqual([]);
    expect(notRunningClaims(unknown, "ALPHA-1")).toEqual([]);
  });

  test("agents add up the tree as a set of sessions", () => {
    const built = model(
      [
        issue("ALPHA-1"),
        issue("ALPHA-2", { parent: "ALPHA-1", claim: "s1" }),
        issue("ALPHA-3", { parent: "ALPHA-2", claim: "s2" }),
        issue("ALPHA-4", { parent: "ALPHA-1" }),
        issue("ALPHA-5", { parent: "ALPHA-4", claim: "s1" }),
      ],
      [],
      registry({ s1: "running", s2: "running" })
    );
    expect(built.figures.get("ALPHA-2")?.agents).toBe(2);
    expect(built.figures.get("ALPHA-4")?.agents).toBe(1);
    expect(built.figures.get("ALPHA-1")?.agents).toBe(2);
  });
});
