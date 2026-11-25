import { describe, expect, test } from "bun:test";

import { fillPath, isParamsOf, pathSegments, pathUnder } from "./path";
import { routerPath } from "./router-path";

describe("navigation's path grammar", () => {
  test("reads text, :name params and a last *", () => {
    expect(pathSegments("/issues/:key/*")).toEqual([
      { kind: "text", text: "issues" },
      { kind: "param", name: "key" },
      { kind: "rest" },
    ]);
    expect(pathSegments("/")).toEqual([{ kind: "text", text: "" }]);
  });

  test("control: refuses a * before the end, a nameless param and a path without its /", () => {
    expect(() => pathSegments("/a/*/b")).toThrow("* comes last");
    expect(() => pathSegments("/a/:")).toThrow("a param needs a name");
    expect(() => pathSegments("a")).toThrow("does not start with /");
  });

  test("control: refuses a param name that is not a name, and a name bound twice", () => {
    expect(() => pathSegments("/issues/:id?")).toThrow('":id?" is not a param name');
    expect(() => pathSegments("/files/:name.:ext")).toThrow('":name.:ext" is not a param name');
    expect(() => pathSegments("/a/:1st")).toThrow('":1st" is not a param name');
    expect(() => pathSegments("/a/:key/b/:key")).toThrow('binds "key" twice');
    expect(pathSegments("/a/:_key/:key2")).toEqual([
      { kind: "text", text: "a" },
      { kind: "param", name: "_key" },
      { kind: "param", name: "key2" },
    ]);
  });

  test("fills params, encoded, and the rest segment by segment", () => {
    expect(fillPath("/machines/:machine", { machine: "box one" })).toBe("/machines/box%20one");
    expect(fillPath("/issues/:key/*", { key: "AB-1", "*": "plan/step 2" })).toBe(
      "/issues/AB-1/plan/step%202"
    );
    expect(fillPath("/issues/:key/*", { key: "AB-1" })).toBe("/issues/AB-1");
    expect(fillPath("/", {})).toBe("/");
    expect(() => fillPath("/machines/:machine", {})).toThrow('needs its "machine" param');
  });

  test("checks a match holds each param", () => {
    expect(isParamsOf("/projects/:key/documents/:slug", { key: "AB", slug: "spec" })).toBe(true);
    expect(isParamsOf("/projects/:key/documents/:slug", { key: "AB" })).toBe(false);
  });

  test("an address is under a path at it or below it; only / itself is under /", () => {
    expect(pathUnder("/agents", "/agents")).toBe(true);
    expect(pathUnder("/agents", "/agents/broadcasts")).toBe(true);
    expect(pathUnder("/agents", "/agentsx")).toBe(false);
    expect(pathUnder("/priorities", "/priorities/7")).toBe(true);
    expect(pathUnder("/projects/:key", "/projects/AB/issues")).toBe(true);
    expect(pathUnder("/", "/")).toBe(true);
    expect(pathUnder("/", "/agents")).toBe(false);
  });

  test("routerPath writes the grammar in the router's syntax", () => {
    expect(routerPath("/issues/:key/*")).toBe("/issues/:key/*");
    expect(routerPath("/")).toBe("/");
  });
});
