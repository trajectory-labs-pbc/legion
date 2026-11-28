import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { pages } from "@/pages/index";
import { SRC_DIR } from "../source";
import { parseScript } from "../typescript";
import { DISPATCH_HREF_REFERENCES } from "../upstream";
import {
  forkRoutes,
  linkFormProblems,
  OWN_ELEMENTS,
  routeParity,
  routingProblems,
  SERVER_HREFS,
  upstreamRoutes,
} from "./links";
import { tagName, upstreamAppFile } from "./source";

const upstream = upstreamRoutes();
const fork = forkRoutes();
const appText = readFileSync(upstreamAppFile, "utf8");
const hrefs = [...DISPATCH_HREF_REFERENCES.map((row) => row.href), ...SERVER_HREFS];

/** Upstream's app.tsx with `jsx` added as the last child of its `<Routes>`. */
function withRoutesChild(jsx: string): string {
  const source = parseScript(upstreamAppFile, appText);
  let end: number | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) && tagName(source, node) === "Routes") {
      end = node.closingElement.getStart(source);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (end === undefined) throw new Error("upstream's app.tsx has no <Routes>");
  return `${appText.slice(0, end)}${jsx}\n${appText.slice(end)}`;
}

/** The route map with the page that serves `path` served by this app. */
function servedHere(path: string) {
  return pages.map((page) =>
    Object.values(page.routes).some((route) => route.path === path)
      ? { ...page, server: "fork" as const }
      : page
  );
}

describe("links", () => {
  test("upstream's app routes only through the <Route> list the route map reads", () => {
    expect(upstream.length).toBeGreaterThan(20);
    expect(routingProblems()).toEqual([]);
  });

  test("each page file is in the route map, named by its page's id", () => {
    const files = readdirSync(join(SRC_DIR, "pages"))
      .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
      .filter((name) => name !== "index.ts" && name !== "page.ts");
    expect(pages.map((page) => `${page.id}.tsx`).sort()).toEqual(files.sort());
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
      "/new-page -> < NewPage / >"
    );
  });

  test("names a route whose element's props upstream changed", () => {
    const [first] = upstream;
    if (!first) throw new Error("no upstream route");
    const changed = [{ ...first, element: first.element.replace("/ >", "changed / >") }];
    expect(changed[0]?.element).not.toBe(first.element);
    expect(routeParity(changed, fork).missing).toEqual([`${first.path} -> ${changed[0]?.element}`]);
  });

  test("names a redirect upstream changed, which this app writes with its own part", () => {
    const changed = upstream.map((route) =>
      route.path === "/replies" ? { ...route, element: "<Navigate to={elsewhere}/>" } : route
    );
    expect(routeParity(changed, fork)).toEqual({
      missing: ["/replies -> <Navigate to={elsewhere}/>"],
      extra: [OWN_ELEMENTS["/replies"]?.upstream].map((element) => `/replies -> ${element}`),
    });
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

  test("names a query key and a fragment Dispatch writes to a page this app serves", () => {
    const served = forkRoutes(servedHere("/projects/:key/documents/:slug"));
    const problems = linkFormProblems(served, hrefs);
    expect(problems).toContain(
      "/projects/CORE/documents/handbook-md?comment=88888888-8888-4888-8888-888888888888: page document, which this app serves, does not read ?comment="
    );
    expect(problems).toContain(
      "/projects/CORE/documents/handbook-md?q=ship#b-ship-it: page document, which this app serves, does not read #b-"
    );
    expect(linkFormProblems(fork, hrefs)).toEqual([]);
  });
});
