import { describe, expect, test } from "bun:test";

import {
  coverage,
  effectiveOwners,
  importGraph,
  messages,
  type Owner,
  owners,
  viewMapMessages,
} from "./coverage";
import { featureViews, runtimeImports } from "./source";

const files = featureViews();
const all = owners();
const graph = importGraph();

/** A view file a page owns, and a page that does not own it. */
function pageFileAndOtherPage(): { file: string; owner: string; other: string } {
  const { owner } = effectiveOwners(files, all, graph);
  const pages = all.filter((entry) => entry.name.startsWith("page:")).map((entry) => entry.name);
  for (const [file, name] of owner) {
    const other = pages.find((page) => page !== name);
    if (name.startsWith("page:") && other) return { file, owner: name, other };
  }
  throw new Error("no page owns a view file");
}

describe("the view map", () => {
  test("gives each upstream view file one owner, which alone loads it", () => {
    expect(files.length).toBeGreaterThan(200);
    expect(viewMapMessages()).toEqual([]);
  });

  test("names a view file no owner maps", () => {
    expect(coverage([...files, "features/new-folder/NewView.tsx"], all).unmapped).toContain(
      "features/new-folder/NewView.tsx"
    );
  });

  test("names a view file two owners map", () => {
    const { file, owner, other } = pageFileAndOtherPage();
    const twice = all.map((entry) =>
      entry.name === owner || entry.name === other
        ? { ...entry, globs: [...entry.globs, file] }
        : entry
    );
    expect(coverage(files, twice, graph).shared).toContainEqual({
      file,
      owners: [owner, other].sort(),
    });
  });

  test("names a page's view another page loads", () => {
    const { file, owner, other } = pageFileAndOtherPage();
    const loaded = new Map(graph).set(file, [...(graph.get(file) ?? []), other]);
    const crossed = coverage(files, all, loaded).crossed.find((entry) => entry.file === file);
    expect(crossed?.owner).toBe(owner);
    expect(crossed?.importers).toContain(other);
  });

  test("a page's view that only shared files load is shared, and one the shell loads is not", () => {
    const synthetic: Owner[] = [
      { name: "page:a", globs: ["features/a/**"], list: "a" },
      { name: "page:b", globs: ["features/b/**"], list: "b" },
      { name: "shared:pages", globs: ["features/a/Shared.tsx"], list: "s" },
    ];
    const views = [
      "features/a/Shared.tsx",
      "features/a/Inner.tsx",
      "features/a/Own.tsx",
      "features/b/B.tsx",
    ];
    const loaded = new Map([
      ["features/a/Shared.tsx", ["page:a", "page:b"]],
      ["features/a/Inner.tsx", ["features/a/Shared.tsx"]],
      ["features/a/Own.tsx", ["page:a", "shell"]],
    ]);
    const result = coverage(views, synthetic, loaded);
    expect(result.crossed).toEqual([
      { file: "features/a/Own.tsx", owner: "page:a", importers: ["shell"] },
    ]);
    expect(effectiveOwners(views, synthetic, loaded).owner.get("features/a/Inner.tsx")).toBe(
      "shared:inferred"
    );
  });

  test("an exact path takes a file from its folder's owner", () => {
    const synthetic: Owner[] = [
      { name: "page:a", globs: ["features/a/**"], list: "a" },
      { name: "page:b", globs: ["features/a/Moved.tsx"], list: "b" },
    ];
    const result = coverage(["features/a/Moved.tsx", "features/a/Kept.tsx"], synthetic);
    expect(result.shared).toEqual([]);
    expect(
      effectiveOwners(["features/a/Moved.tsx"], synthetic, new Map()).owner.get(
        "features/a/Moved.tsx"
      )
    ).toBe("page:b");
  });

  test("says which list to update when upstream renames a listed file", () => {
    const renamed = all.map((entry) =>
      entry.name === "shared:pages"
        ? { ...entry, globs: [...entry.globs, "features/gone/Old.tsx"] }
        : entry
    );
    expect(messages(coverage(files, renamed, graph))).toContain(
      "src/views.ts sharedViews.pages names features/gone/Old.tsx, which matches no upstream view: upstream renamed or removed it; name the file that replaced it, or drop the entry"
    );
  });

  test("a page this app serves names files, not globs", () => {
    const served: Owner[] = [
      { name: "page:a", globs: ["features/a/**"], list: "src/pages/a.tsx views", server: "fork" },
    ];
    expect(messages(coverage(["features/a/A.tsx"], served))).toEqual([
      "src/pages/a.tsx views has the glob features/a/**: a page this app serves names each upstream file it replaces",
    ]);
  });

  test("a type-only import loads nothing", () => {
    const text = [
      'import type { A } from "./a";',
      'import { type B } from "./b";',
      'import { type C, D } from "./c";',
      'export type { E } from "./e";',
      'export { F } from "./f";',
      'const G = lazy(() => import("./g"));',
    ].join("\n");
    expect(runtimeImports("x.tsx", text)).toEqual(["./c", "./f", "./g"]);
  });
});
