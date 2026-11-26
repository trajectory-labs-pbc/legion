import { describe, expect, test } from "bun:test";

import {
  indexIssues,
  type ProgressIssue,
  subtreeIssues,
  weeklyFigures,
  weekStart,
} from "@/data/progress/progress-model";

import { formatLeadDays } from "./weekly-chart";

// A Wednesday.
const NOW = Date.parse("2026-03-11T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function issue(
  key: string,
  created: string,
  closed: string | null = null,
  parent: string | null = null
): ProgressIssue {
  return {
    key,
    project: "ALPHA",
    parent,
    status: closed === null ? "todo" : "done",
    title: `Title of ${key}`,
    assignee: null,
    priority: null,
    claim: null,
    created_at: created,
    updated_at: closed ?? created,
    closed_at: closed,
    advances: null,
  };
}

describe("weekly figures", () => {
  test("8 weeks from Monday 00:00 UTC, oldest first, the current one partial", () => {
    const weeks = weeklyFigures([], NOW);
    expect(weeks).toHaveLength(8);
    expect(new Date(weeks[7]?.start ?? 0).toISOString()).toBe("2026-03-09T00:00:00.000Z");
    expect(new Date(weeks[0]?.start ?? 0).toISOString()).toBe("2026-01-19T00:00:00.000Z");
    expect(weeks.map((week) => week.partial)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  test("a week starts on Monday", () => {
    expect(new Date(weekStart(Date.parse("2026-03-08T23:59:00Z"))).toISOString()).toBe(
      "2026-03-02T00:00:00.000Z"
    );
    expect(new Date(weekStart(Date.parse("2026-03-09T00:00:00Z"))).toISOString()).toBe(
      "2026-03-09T00:00:00.000Z"
    );
  });

  test("the boundary test: an issue closed on Sunday 23:59 UTC is in the week before", () => {
    const weeks = weeklyFigures(
      [issue("ALPHA-2", "2026-02-20T10:00:00Z", "2026-03-08T23:59:00Z")],
      NOW
    );
    expect(weeks[6]?.closed).toBe(1);
    expect(weeks[7]?.closed).toBe(0);
  });

  test("the root's own creation and close count", () => {
    const index = indexIssues([
      issue("ALPHA-1", "2026-03-09T08:00:00Z", "2026-03-10T08:00:00Z"),
      issue("ALPHA-2", "2026-03-10T09:00:00Z", null, "ALPHA-1"),
    ]);
    const current = weeklyFigures(subtreeIssues(index, "ALPHA-1"), NOW)[7];
    expect(current).toMatchObject({ created: 2, closed: 1 });
  });

  test("the median lead time for an odd and an even count, in days", () => {
    const monday = Date.parse("2026-03-02T00:00:00Z");
    const closedAfter = (key: string, days: number) =>
      issue(
        key,
        new Date(monday + HOUR - days * DAY).toISOString(),
        new Date(monday + HOUR).toISOString()
      );
    const odd = weeklyFigures(
      [closedAfter("ALPHA-1", 1), closedAfter("ALPHA-2", 2), closedAfter("ALPHA-3", 4)],
      NOW
    );
    expect(odd[6]?.medianLeadDays).toBe(2);
    const even = weeklyFigures(
      [
        closedAfter("ALPHA-1", 1),
        closedAfter("ALPHA-2", 2),
        closedAfter("ALPHA-3", 3),
        closedAfter("ALPHA-4", 10),
      ],
      NOW
    );
    expect(even[6]?.medianLeadDays).toBe(2.5);
    expect(formatLeadDays(2.5)).toBe("2.5");
    expect(formatLeadDays(2)).toBe("2.0");
  });

  test("a week with no close shows a dash", () => {
    const weeks = weeklyFigures([issue("ALPHA-1", "2026-03-03T10:00:00Z")], NOW);
    expect(weeks[6]).toMatchObject({ created: 1, closed: 0, medianLeadDays: null });
    expect(formatLeadDays(weeks[6]?.medianLeadDays ?? null)).toBe("—");
  });

  test("an issue outside the 8 weeks, or not closed, adds no close", () => {
    const reopened = {
      ...issue("ALPHA-2", "2026-03-03T10:00:00Z", "2026-03-04T10:00:00Z"),
      status: "todo",
    };
    const weeks = weeklyFigures(
      [issue("ALPHA-1", "2025-12-01T10:00:00Z", "2026-01-05T10:00:00Z"), reopened],
      NOW
    );
    expect(weeks.reduce((sum, week) => sum + week.closed, 0)).toBe(0);
    expect(weeks.reduce((sum, week) => sum + week.created, 0)).toBe(1);
  });
});
