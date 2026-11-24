import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DISPATCH_HREF_REFERENCES } from "@legion/contracts";

import {
  envoyRoot,
  forkRoutes,
  GO_HREF_READERS,
  GO_HREF_WRITERS,
  goFilesNamingPagePaths,
  resolveHref,
  routeParity,
  samplePaths,
} from "./links";
import { pageFiles, routeMapFiles, upstreamAppFile, upstreamRoutes } from "./source";

const upstream = upstreamRoutes();
const fork = forkRoutes();

function hrefs(): string[] {
  const all = [
    ...DISPATCH_HREF_REFERENCES.map((row) => row.href),
    ...GO_HREF_WRITERS.flatMap((writer) => writer.hrefs),
  ];
  for (const path of samplePaths(upstream)) {
    all.push(path, `${path}?q=ship`, `${path}#b-ship-it`);
  }
  return [...new Set(all)];
}

describe("links", () => {
  test("upstream's app has the routes this test reads", () => {
    expect(upstream.length).toBeGreaterThan(20);
    expect(upstream.at(-1)).toEqual({ path: "*", element: "NotFoundPage" });
  });

  test("the route map lists every page file", () => {
    expect(routeMapFiles()).toEqual(pageFiles());
  });

  test("the fork serves each upstream route, and no other", () => {
    expect(routeParity(upstream, fork)).toEqual({ missing: [], extra: [] });
  });

  test("each href Dispatch writes opens the page upstream's app opens", () => {
    const wrong: string[] = [];
    for (const href of hrefs()) {
      const theirs = resolveHref(upstream, href);
      const ours = resolveHref(fork, href);
      if (!theirs || !ours || theirs.path !== ours.path) {
        wrong.push(`${href}: upstream ${theirs?.path ?? "none"}, fork ${ours?.path ?? "none"}`);
      } else if (ours.server === "upstream" && theirs.element !== ours.element) {
        wrong.push(`${href}: upstream draws ${theirs.element}, fork ${ours.element}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  test("every Go file naming a dashboard path is listed, and each listed function exists", () => {
    const listed = [
      ...new Set([...GO_HREF_WRITERS.map((writer) => writer.file), ...GO_HREF_READERS]),
    ];
    expect(goFilesNamingPagePaths()).toEqual(listed.sort());
    for (const writer of GO_HREF_WRITERS) {
      const text = readFileSync(join(envoyRoot, writer.file), "utf8");
      expect(text).toMatch(new RegExp(`\\nfunc (\\([^)]*\\) )?${writer.func}\\(`));
    }
  });

  test("names an upstream route the fork does not serve", () => {
    const text = readFileSync(upstreamAppFile, "utf8")
      .replace(
        '<Route element={<NotFoundPage />} path="*" />',
        '<Route element={<NewPage />} path={NEW_PAGE_PATH} />\n<Route element={<NotFoundPage />} path="*" />'
      )
      .concat('\nconst NEW_PAGE_PATH = "/new-page";\n');
    expect(routeParity(upstreamRoutes(upstreamAppFile, text), fork).missing).toContain(
      "/new-page -> NewPage"
    );
  });
});
