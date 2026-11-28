import { describe, expect, test } from "bun:test";
import { pageAt } from "@/pages/index";
import { liveViewSessionOf, parseIssuePath, parseProjectPath } from "@/upstream/routes";
import { openOf, priorityFaults } from "./sidebar-data";

describe("openOf", () => {
  test.each([
    "/",
    "/agents/s-1/live",
    "/issues/AB-1/plan",
    "/issues/ab-1",
    "/projects/AB",
    "/projects/AB/documents/spec",
    "/projects/ab",
    "/machines",
  ])("at %s, lights the rows upstream's parsers name", (pathname) => {
    expect(openOf(pageAt(pathname)?.layout ?? {})).toEqual({
      liveView: liveViewSessionOf(pathname),
      issue: parseIssuePath(pathname)?.key,
      project: parseProjectPath(pathname)?.project,
    });
  });
});

describe("priorityFaults", () => {
  const summary = (under: number, parked: number, empty?: string) => ({
    empty,
    work_under_no_priority: { count: under },
    priority_work_parked: { count: parked },
  });

  test("adds the work under no priority to the work parked under one", () => {
    expect(priorityFaults(summary(2, 3))).toBe(5);
    expect(priorityFaults(summary(0, 0, ""))).toBe(0);
  });

  test("counts nothing before the summary answers, or where no priority exists yet", () => {
    expect(priorityFaults(undefined)).toBeUndefined();
    expect(priorityFaults(summary(2, 3, "No priorities yet."))).toBeUndefined();
  });
});
