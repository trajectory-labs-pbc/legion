import { afterEach, describe, expect, spyOn, test } from "bun:test";

import { useUiPreferences } from "./ui-preferences";

afterEach(() => {
  window.localStorage.clear();
});

const KEY = "tl-dispatch.ui-preferences";
const keep = (sidebarFolds: Record<string, boolean>, version = 1) =>
  window.localStorage.setItem(KEY, JSON.stringify({ state: { sidebarFolds }, version }));
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "null");
const anotherTabWrote = (key = KEY) => window.dispatchEvent(new StorageEvent("storage", { key }));

describe("UI preferences", () => {
  test("a fold is kept under the fork's prefix, with its version", () => {
    useUiPreferences.getState().setSidebarFold("Agents", true);
    useUiPreferences.getState().setSidebarFold("Projects", true);
    useUiPreferences.getState().setSidebarFold("Agents", false);
    expect(stored()).toEqual({
      state: { sidebarFolds: { Agents: false, Projects: true } },
      version: 1,
    });
  });

  test("setting a fold it already has changes nothing", () => {
    useUiPreferences.getState().setSidebarFold("Agents", true);
    const before = useUiPreferences.getState().sidebarFolds;
    useUiPreferences.getState().setSidebarFold("Agents", true);
    expect(useUiPreferences.getState().sidebarFolds).toBe(before);
  });

  test("a change another tab makes shows in this one", () => {
    keep({ Agents: true });
    anotherTabWrote(`${KEY}.other`);
    expect(useUiPreferences.getState().sidebarFolds).toEqual({});
    anotherTabWrote();
    expect(useUiPreferences.getState().sidebarFolds).toEqual({ Agents: true });
  });

  test("a newer version, from a tab on a newer build, is neither read nor written over", () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    try {
      useUiPreferences.getState().setSidebarFold("Agents", true);
      keep({ Projects: true }, 2);
      anotherTabWrote();
      expect(useUiPreferences.getState().sidebarFolds).toEqual({ Agents: true });
      expect(stored()).toEqual({ state: { sidebarFolds: { Projects: true } }, version: 2 });
    } finally {
      error.mockRestore();
    }
  });
});
