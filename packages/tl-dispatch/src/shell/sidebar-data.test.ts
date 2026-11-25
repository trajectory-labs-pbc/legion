import { describe, expect, test } from "bun:test";
import {
  liveViewSessionOf,
  parseIssuePath,
  parseProjectPath,
} from "@upstream-dispatch/features/refs/routes";

import { pageAt } from "@/navigation/route-tree";
import { openOf } from "./sidebar-data";

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
