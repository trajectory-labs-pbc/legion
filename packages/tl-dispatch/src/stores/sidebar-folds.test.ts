import { afterEach, describe, expect, test } from "bun:test";

import { withLocalStorage } from "../../tests/local-storage";
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
    const full: Storage = {
      get length() {
        return real.length;
      },
      key: (index) => real.key(index),
      getItem: (key) => real.getItem(key),
      removeItem: (key) => real.removeItem(key),
      clear: () => real.clear(),
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };
    withLocalStorage(
      () => full,
      () => expect(() => moveOlderFolds()).toThrow("full")
    );
    expect(window.localStorage.getItem(`${OLDER}Agents`)).toBe("true");
  });

  test("a page load moves the old folds before the store reads them", async () => {
    window.localStorage.setItem(`${OLDER}Agents`, "true");
    // A query makes the loader run the module afresh, as a page load does.
    const specifier = "./sidebar-folds?load";
    const loaded: typeof import("./sidebar-folds") = await import(specifier);
    expect(loaded.sidebarFolds.getState().folded).toEqual(["Agents"]);
    expect(window.localStorage.getItem(`${OLDER}Agents`)).toBeNull();
  });

  test("once the store has a key, the old keys are left alone", () => {
    setFolded("Projects", true);
    window.localStorage.setItem(`${OLDER}Agents`, "true");
    moveOlderFolds();
    expect(window.localStorage.getItem(`${OLDER}Agents`)).toBe("true");
    expect(sidebarFolds.getState().folded).toEqual(["Projects"]);
  });
});
