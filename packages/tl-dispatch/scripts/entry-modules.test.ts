import { describe, expect, test } from "bun:test";

import { type Chunk, entryModules } from "./entry-modules";

const chunk = (moduleIds: string[], imports: string[] = [], isEntry = false): Chunk => ({
  type: "chunk",
  isEntry,
  imports,
  moduleIds,
});

describe("the modules that load before first paint", () => {
  test("are the entry's and those of each chunk it imports statically, relative to the root", () => {
    const bundle = {
      "index.js": chunk(["/repo/a.ts", "/repo/b.ts"], ["shared.js"], true),
      "shared.js": chunk(["/repo/c.ts", "/repo/a.ts"], ["index.js"]),
      "page.js": chunk(["/repo/page.ts"]),
      "index.css": { type: "asset" as const },
    };
    expect(entryModules(bundle, "/repo")).toEqual({ modules: ["a.ts", "b.ts", "c.ts"] });
  });

  test("keep a virtual module's id", () => {
    const bundle = { "index.js": chunk(["\0vite/preload-helper.js"], [], true) };
    expect(entryModules(bundle, "/repo").modules).toEqual(["\0vite/preload-helper.js"]);
  });

  test("refuse a build with no entry, or with two", () => {
    expect(() => entryModules({ "a.js": chunk([]) }, "/repo")).toThrow("0 entry chunks");
    const two = { "a.js": chunk([], [], true), "b.js": chunk([], [], true) };
    expect(() => entryModules(two, "/repo")).toThrow("2 entry chunks");
  });
});
