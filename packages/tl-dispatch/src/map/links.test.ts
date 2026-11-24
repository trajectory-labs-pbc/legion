import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { DISPATCH_HREF_REFERENCES } from "@legion/contracts";
import ts from "typescript";

import { forkRoutes, linkFormProblems, routeParity, SERVER_HREFS } from "./links";
import {
  type PageEntry,
  pageFiles,
  readPages,
  routeMapFiles,
  routingProblems,
  upstreamAppFile,
  upstreamRoutes,
} from "./source";

const upstream = upstreamRoutes();
const fork = forkRoutes();
const appText = readFileSync(upstreamAppFile, "utf8");
const hrefs = [...DISPATCH_HREF_REFERENCES.map((row) => row.href), ...SERVER_HREFS];

/** Upstream's app.tsx with `jsx` added as the last child of its `<Routes>`. */
function withRoutesChild(jsx: string): string {
  const source = ts.createSourceFile("app.tsx", appText, ts.ScriptTarget.Latest, true);
  let end: number | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "Routes") {
      end = node.closingElement.getStart(source);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (end === undefined) throw new Error("upstream's app.tsx has no <Routes>");
  return `${appText.slice(0, end)}${jsx}\n${appText.slice(end)}`;
}

/** A copy of the page that serves `path`, served by this app with the given link forms. */
function servedHere(path: string, linkForms: PageEntry["linkForms"]): PageEntry[] {
  return readPages().map((page) =>
    page.routes.some((route) => route.path === path) ? { ...page, server: "fork", linkForms } : page
  );
}

describe("links", () => {
  test("upstream's app routes only through the <Route> list the route map reads", () => {
    expect(upstream.length).toBeGreaterThan(20);
    expect(routingProblems()).toEqual([]);
  });

  test("the route map lists every page file", () => {
    expect(routeMapFiles()).toEqual(pageFiles());
  });

  test("the fork serves each upstream route, drawing upstream's element as written", () => {
    expect(routeParity(upstream, fork)).toEqual({ missing: [], extra: [] });
  });

  test("each page this app serves reads every query key and fragment Dispatch writes to it", () => {
    expect(linkFormProblems(fork, hrefs)).toEqual([]);
  });

  test("names an upstream route the fork does not serve", () => {
    const text = withRoutesChild('<Route element={<NewPage />} path="/new-page" />');
    expect(routeParity(upstreamRoutes(upstreamAppFile, text), fork).missing).toContain(
      "/new-page -> <NewPage/>"
    );
  });

  test("names a route whose element's props upstream changed", () => {
    const [first] = upstream;
    if (!first) throw new Error("no upstream route");
    const changed = [{ ...first, element: first.element.replace("/>", " changed/>") }];
    expect(routeParity(changed, fork).missing).toEqual([`${first.path} -> ${changed[0]?.element}`]);
  });

  test("names routing the route map cannot read", () => {
    const text = withRoutesChild("{extraRoutes}");
    const problems = routingProblems([
      { file: upstreamAppFile, text },
      { file: `${upstreamAppFile}.extra.tsx`, text: "const routes = useRoutes([]);" },
    ]);
    expect(problems.some((line) => line.includes("a child of <Routes> is not a <Route>"))).toBe(
      true
    );
    expect(problems.some((line) => line.includes("useRoutes"))).toBe(true);
    expect(() =>
      upstreamRoutes(upstreamAppFile, withRoutesChild('<Route index element={<X />} path="/x" />'))
    ).toThrow("index");
  });

  test("names a link form a page this app serves does not read", () => {
    const path = "/projects/:key/documents/:slug";
    const served = forkRoutes(servedHere(path, { query: ["ask"], fragments: ["b-"] }));
    const problems = linkFormProblems(served, hrefs);
    expect(problems).toContain(
      "/projects/CORE/documents/handbook-md?comment=88888888-8888-4888-8888-888888888888: page document does not read ?comment= (its linkForms.query)"
    );
    expect(problems.some((line) => line.includes("?ask="))).toBe(false);
  });
});
