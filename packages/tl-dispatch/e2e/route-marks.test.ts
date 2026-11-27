// Under Bun, not Playwright: the route map loads upstream modules that Node cannot load.
import { expect, test } from "bun:test";

import { pages } from "@/pages/index";
import { routeMarks, type Seeded } from "./route-marks";

// The keys of routeMarks do not depend on what the run seeds.
const SEEDED: Seeded = {
  person: "person",
  project: "PRJ",
  projectName: "Project",
  issue: "PRJ-1",
  issueTitle: "Issue",
  priority: "priority",
  document: "document",
  documentName: "Document",
  session: "session",
  artifact: "artifact",
  artifactName: "Artifact",
  machine: "machine",
  machineLogin: true,
  missingBroadcast: "broadcast",
  missingPage: "/missing",
};

test("each route of the route map has one mark, and each mark a route", () => {
  const paths = pages.flatMap((page) => Object.values(page.routes).map((route) => route.path));
  const marks = Object.keys(routeMarks(SEEDED));
  const unmarked = paths.filter((path) => !marks.includes(path));
  expect(unmarked, "routes with no mark in e2e/route-marks.ts").toEqual([]);
  const extra = marks.filter((path) => !paths.includes(path));
  expect(extra, "marks of routes the route map does not have").toEqual([]);
});
