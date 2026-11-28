import { afterEach, describe, expect, test } from "bun:test";

import { moveOlderFolds, setFolded, sidebarFolds } from "./sidebar-folds";

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
    window.localStorage.setItem(`${OLDER}Agents`, "true");
    window.localStorage.setItem(`${OLDER}Pinned`, "false");
    window.localStorage.setItem("tl-dispatch.other", "true");
    moveOlderFolds();
    void sidebarFolds.persist.rehydrate();
    expect(sidebarFolds.getState().folded).toEqual(["Agents"]);
    expect(window.localStorage.getItem(`${OLDER}Agents`)).toBeNull();
    expect(window.localStorage.getItem(`${OLDER}Pinned`)).toBeNull();
    expect(window.localStorage.getItem("tl-dispatch.other")).toBe("true");
  });

  test("the old keys stay when the store's key cannot be written", () => {
    const real = window.localStorage;
    real.setItem(`${OLDER}Agents`, "true");
    const full = {
      get length() {
        return real.length;
      },
      key: (index: number) => real.key(index),
      getItem: (key: string) => real.getItem(key),
      removeItem: (key: string) => real.removeItem(key),
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };
    const kept = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => full });
    try {
      expect(() => moveOlderFolds()).toThrow("full");
    } finally {
      if (kept === undefined) Reflect.deleteProperty(window, "localStorage");
      else Object.defineProperty(window, "localStorage", kept);
    }
    expect(window.localStorage.getItem(`${OLDER}Agents`)).toBe("true");
  });

  test("once the store has a key, the old keys are left alone", () => {
    setFolded("Projects", true);
    window.localStorage.setItem(`${OLDER}Agents`, "true");
    moveOlderFolds();
    expect(window.localStorage.getItem(`${OLDER}Agents`)).toBe("true");
    expect(sidebarFolds.getState().folded).toEqual(["Projects"]);
  });
});
