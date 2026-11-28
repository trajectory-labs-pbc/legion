import { describe, expect, spyOn, test } from "bun:test";

import { refused, withLocalStorage } from "../../tests/local-storage";
import { useUiPreferences } from "./ui-preferences";

const KEY = "tl-dispatch.ui-preferences";
const keep = (sidebarFolds: Record<string, true>, version = 1) =>
  window.localStorage.setItem(KEY, JSON.stringify({ state: { sidebarFolds }, version }));
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "null");
const anotherTabWrote = (key = KEY) => window.dispatchEvent(new StorageEvent("storage", { key }));
const toggle = (heading: string) => useUiPreferences.getState().toggleSidebarFold(heading);

describe("UI preferences", () => {
  test("a fold is kept under the fork's prefix, with its version, and unfolding forgets it", () => {
    toggle("Agents");
    toggle("Projects");
    toggle("Agents");
    expect(stored()).toEqual({ state: { sidebarFolds: { Projects: true } }, version: 1 });
  });

  test("a change another tab makes shows in this one", () => {
    keep({ Agents: true });
    anotherTabWrote(`${KEY}.other`);
    expect(useUiPreferences.getState().sidebarFolds).toEqual({});
    anotherTabWrote();
    expect(useUiPreferences.getState().sidebarFolds).toEqual({ Agents: true });
  });

  test("a newer version is not read, and this tab's next change writes over it", () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    try {
      toggle("Agents");
      keep({ Projects: true }, 2);
      anotherTabWrote();
      expect(useUiPreferences.getState().sidebarFolds).toEqual({ Agents: true });
      expect(stored().version).toBe(2);
      toggle("Agents");
      expect(stored()).toEqual({ state: { sidebarFolds: {} }, version: 1 });
    } finally {
      error.mockRestore();
    }
  });

  test("a browser that refuses storage keeps the folds in memory, and nothing throws", () => {
    withLocalStorage(refused, () => {
      expect(() => toggle("Agents")).not.toThrow();
      expect(() => anotherTabWrote()).not.toThrow();
    });
    expect(useUiPreferences.getState().sidebarFolds).toEqual({ Agents: true });
  });

  test("a write the browser refuses is dropped, and the fold holds", () => {
    const real = window.localStorage;
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
      () => expect(() => toggle("Agents")).not.toThrow()
    );
    expect(useUiPreferences.getState().sidebarFolds).toEqual({ Agents: true });
    expect(stored()).toBeNull();
  });
});
