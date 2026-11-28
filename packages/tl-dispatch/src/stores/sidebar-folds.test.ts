import { afterEach, describe, expect, test } from "bun:test";

import { setFolded, sidebarFolds } from "./sidebar-folds";

afterEach(() => {
  window.localStorage.clear();
});

const KEY = "tl-dispatch.sidebar.folds";
const OLDER = "tl-dispatch.sidebar.folded.";

describe("sidebar folds", () => {
  test("a fold is kept, and opening the section forgets it", () => {
    setFolded("Agents", true);
    setFolded("Projects", true);
    setFolded("Agents", true);
    expect([...sidebarFolds.getState().folded].sort()).toEqual(["Agents", "Projects"]);
    setFolded("Agents", false);
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? "null")).toEqual({
      state: { folded: ["Projects"] },
      version: 1,
    });
  });

  test("the folds the app kept before this store still fold, and their old keys go", () => {
    window.localStorage.clear();
    window.localStorage.setItem(`${OLDER}Agents`, "true");
    window.localStorage.setItem(`${OLDER}Pinned`, "false");
    window.localStorage.setItem("tl-dispatch.other", "true");
    void sidebarFolds.persist.rehydrate();
    expect(sidebarFolds.getState().folded).toEqual(["Agents"]);
    expect(window.localStorage.getItem(`${OLDER}Agents`)).toBeNull();
    expect(window.localStorage.getItem(`${OLDER}Pinned`)).toBeNull();
    expect(window.localStorage.getItem("tl-dispatch.other")).toBe("true");
  });
});
