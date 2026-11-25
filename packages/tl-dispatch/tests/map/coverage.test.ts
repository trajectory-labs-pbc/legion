import { describe, expect, test } from "bun:test";

import {
  coverage,
  effectiveOwners,
  importGraph,
  messages,
  notes,
  type Owner,
  owners,
  ownOwner,
  viewMap,
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
  // It reads every upstream file: about 2.4 s, and past bun's 5 s default on a loaded machine.
  test("leaves nothing to port on a page this app serves", () => {
    expect(files.length).toBeGreaterThan(200);
    const map = viewMap();
    const tidy = notes(map);
    if (tidy.length > 0) console.info(`view map notes, nothing to port:\n${tidy.join("\n")}`);
    expect(messages(map)).toEqual([]);
  }, 30_000);

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
    expect(notes(coverage(files, renamed, graph))).toContain(
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

  test("a file in a page's folder is the page's, and any other file of the app the shell's", () => {
    const pages = [{ file: "/app/src/pages/sign-in.tsx", id: "credentials" }];
    expect(ownOwner("/app/src/pages/sign-in.tsx", pages)).toBe("page:credentials");
    expect(ownOwner("/app/src/pages/sign-in/form.tsx", pages)).toBe("page:credentials");
    expect(ownOwner("/app/src/pages/sign-in-help/form.tsx", pages)).toBe("shell");
    expect(ownOwner("/app/src/shell/frame.tsx", pages)).toBe("shell");
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

describe("the view map on ordinary upstream churn", () => {
  // Page a is upstream's and page b is this app's; each loads its own folder.
  const map: Owner[] = [
    { name: "page:a", globs: ["features/a/**"], list: "src/pages/a.tsx views", server: "upstream" },
    { name: "page:b", globs: ["features/b/B.tsx"], list: "src/pages/b.tsx views", server: "fork" },
    { name: "shell", globs: ["features/shell/**"], list: "src/views.ts shellViews" },
  ];
  const views = ["features/a/A.tsx", "features/b/B.tsx", "features/shell/Shell.tsx"];
  const loads = new Map([
    ["features/a/A.tsx", ["page:a"]],
    ["features/b/B.tsx", ["page:b"]],
    ["features/shell/Shell.tsx", ["shell"]],
  ]);
  const failing = (more: string[], graph: [string, string[]][], owners = map) =>
    messages(coverage([...views, ...more], owners, new Map([...loads, ...graph])));

  test("a new folder that only an upstream page loads fails nothing", () => {
    expect(
      failing(["features/new/New.tsx"], [["features/new/New.tsx", ["features/a/A.tsx"]]])
    ).toEqual([]);
  });

  test("a new file two owners load is shared", () => {
    const owner = effectiveOwners(
      [...views, "features/new/New.tsx"],
      map,
      new Map([
        ...loads,
        ["features/new/New.tsx", ["features/a/A.tsx", "features/shell/Shell.tsx"]],
      ])
    ).owner.get("features/new/New.tsx");
    expect(owner).toBe("shared:inferred");
  });

  test("a cross-page import between upstream pages fails nothing", () => {
    expect(failing([], [["features/a/A.tsx", ["page:a", "features/shell/Shell.tsx"]]])).toEqual([]);
  });

  test("a renamed entry of an upstream page fails nothing", () => {
    const renamed = map.map((entry) =>
      entry.name === "page:a" ? { ...entry, globs: [...entry.globs, "features/a/Old.tsx"] } : entry
    );
    expect(failing([], [], renamed)).toEqual([]);
  });

  test("a file upstream adds to a page this app serves is named", () => {
    expect(
      failing(["features/b/Added.tsx"], [["features/b/Added.tsx", ["features/b/B.tsx"]]])
    ).toEqual([
      "features/b/Added.tsx is new upstream, and only page:b's files load it, which this app serves: port what it adds, then name it in src/pages/b.tsx views",
    ]);
  });

  test("a file upstream adds under a view of that page a shared file also loads is named", () => {
    const shared: Owner[] = [
      ...map,
      { name: "shared:refs", globs: ["features/refs/**"], list: "src/views.ts sharedViews.refs" },
    ];
    const graph: [string, string[]][] = [
      ["features/b/B.tsx", ["page:b", "features/refs/Ref.tsx"]],
      ["features/refs/Ref.tsx", ["shell"]],
      ["features/b/Panel.tsx", ["features/b/B.tsx"]],
      ["features/b/Row.tsx", ["features/b/Panel.tsx"]],
    ];
    const more = ["features/refs/Ref.tsx", "features/b/Panel.tsx", "features/b/Row.tsx"];
    expect(failing(more, graph, shared)).toEqual([
      "features/b/Panel.tsx is new upstream, and only page:b's files load it, which this app serves: port what it adds, then name it in src/pages/b.tsx views",
      "features/b/Row.tsx is new upstream, and only page:b's files load it, which this app serves: port what it adds, then name it in src/pages/b.tsx views",
    ]);
  });

  test("a new file a page this app serves and another owner both load is not that page's", () => {
    const graph: [string, string[]][] = [
      ["features/new/New.tsx", ["features/b/B.tsx", "features/shell/Shell.tsx"]],
    ];
    expect(failing(["features/new/New.tsx"], graph)).toEqual([]);
  });

  test("a renamed file of a page this app serves is named", () => {
    const renamed = map.map((entry) =>
      entry.name === "page:b" ? { ...entry, globs: [...entry.globs, "features/b/Old.tsx"] } : entry
    );
    expect(failing([], [], renamed)).toEqual([
      "src/pages/b.tsx views names features/b/Old.tsx, which matches no upstream view: upstream renamed or removed it; name the file that replaced it, or drop the entry",
    ]);
  });

  test("another owner loading a file of a page this app serves is named", () => {
    expect(failing([], [["features/b/B.tsx", ["page:b", "features/shell/Shell.tsx"]]])).toEqual([
      "features/b/B.tsx is page:b's, and shell also load it: name it in src/views.ts sharedViews.pages, or in the list of the one owner that loads it",
    ]);
  });
});
