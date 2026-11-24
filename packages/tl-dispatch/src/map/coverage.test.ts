import { describe, expect, test } from "bun:test";

import { coverage, importerOwners, owners } from "./coverage";
import { featureViews } from "./source";

describe("the view map", () => {
  test("gives each upstream view file exactly one owner, which alone renders it", () => {
    const files = featureViews();
    expect(files.length).toBeGreaterThan(200);
    expect(coverage(files, owners(), importerOwners())).toEqual({
      unmapped: [],
      shared: [],
      unused: [],
      crossed: [],
    });
  });

  test("names a view file no owner maps", () => {
    const files = [...featureViews(), "features/new-folder/NewView.tsx"];
    expect(coverage(files, owners()).unmapped).toContain("features/new-folder/NewView.tsx");
  });

  test("names a view file two owners map", () => {
    const extra = { name: "page:extra", globs: ["features/agents/**"] };
    expect(coverage(featureViews(), [...owners(), extra]).shared).toContainEqual({
      file: "features/agents/AgentsPage.tsx",
      owners: ["page:agents", "page:extra"],
    });
  });

  test("names a page's view another page renders", () => {
    const importers = new Map(importerOwners());
    importers.set("features/agents/AgentsPage.tsx", ["page:agents", "page:settings"]);
    expect(coverage(featureViews(), owners(), importers).crossed).toContainEqual({
      file: "features/agents/AgentsPage.tsx",
      owner: "page:agents",
      importers: ["page:settings"],
    });
  });

  test("an exact path takes a file from its folder's owner", () => {
    const result = coverage(["features/credentials/GrantsSection.tsx"], owners());
    expect(result.shared).toEqual([]);
    expect(result.unmapped).toEqual([]);
  });
});
