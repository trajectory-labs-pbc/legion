// Under Bun, not Playwright: the route map loads upstream modules that Node cannot load.
import { expect, test } from "bun:test";

import { forkRoutes } from "../tests/map/links";
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
  const paths = forkRoutes().map((route) => route.path);
  const marks = Object.keys(routeMarks(SEEDED));
  expect(paths.filter((path) => !marks.includes(path))).toEqual([]);
  expect(marks.filter((path) => !paths.includes(path))).toEqual([]);
});
