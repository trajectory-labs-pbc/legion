import { describe, expect, test } from "bun:test";

import { pageAt, pages } from "./route-tree";

describe("the route tree", () => {
  test("holds each path once", () => {
    const paths = pages.flatMap((page) => Object.values(page.routes).map((route) => route.path));
    expect(paths.filter((path, index) => paths.indexOf(path) !== index)).toEqual([]);
  });

  test("finds the page an address opens, with its params, as the router ranks routes", () => {
    const at = (path: string) => {
      const found = pageAt(path);
      return found && [found.page.id, found.route.path, found.params];
    };
    expect(at("/")).toEqual(["inbox", "/", {}]);
    expect(at("/issues/AB-1/plan")).toEqual([
      "issue",
      "/issues/:key/*",
      { key: "AB-1", "*": "plan" },
    ]);
    expect(at("/agents/broadcasts")).toEqual(["agents", "/agents/broadcasts", {}]);
    expect(at("/projects/AB/documents/spec")).toEqual([
      "document",
      "/projects/:key/documents/:slug",
      { key: "AB", slug: "spec" },
    ]);
    expect(at("/nowhere/at/all")?.[0]).toBe("not-found");
  });
});
