import { describe, expect, test } from "bun:test";

import {
  ASK_AT_RISK_DAYS,
  CHANGE_AT_RISK_DAYS,
  CHANGE_OFF_TRACK_DAYS,
  indexIssues,
  isClosed,
  isInFlight,
  moreThanDays,
  type ProgressIssue,
  STATE_ORDER,
  subtreeIssues,
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
