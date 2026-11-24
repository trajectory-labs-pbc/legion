import { describe, expect, test } from "bun:test";

import { coverage, owners } from "./coverage";
import { featureViews } from "./source";

describe("the view map", () => {
  test("gives each upstream view file exactly one owner, with no dead glob", () => {
    const files = featureViews();
    expect(files.length).toBeGreaterThan(200);
    expect(coverage(files, owners())).toEqual({ unmapped: [], shared: [], unused: [] });
  });

  test("names a view file no owner maps", () => {
    const files = [...featureViews(), "features/new-folder/NewView.tsx"];
    expect(coverage(files, owners()).unmapped).toEqual(["features/new-folder/NewView.tsx"]);
  });

  test("names a view file two owners map", () => {
    const extra = { name: "page:extra", globs: ["features/agents/AgentsPage.tsx"] };
    expect(coverage(featureViews(), [...owners(), extra]).shared).toEqual([
      { file: "features/agents/AgentsPage.tsx", owners: ["page:agents", "page:extra"] },
    ]);
  });
});
