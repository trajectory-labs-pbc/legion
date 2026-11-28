import { describe, expect, test } from "bun:test";

import { useInboxPreview } from "./inbox-preview";

const KEY = "tl-dispatch.inbox-preview";
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? "null");

describe("the Inbox preview", () => {
  test("is off until turned on, and the choice is kept for this browser with its version", () => {
    expect(useInboxPreview.getState().on).toBe(false);
    useInboxPreview.getState().turn(true);
    expect(stored()).toEqual({ state: { on: true }, version: 1 });
    useInboxPreview.getState().turn(false);
    expect(stored()).toEqual({ state: { on: false }, version: 1 });
  });

  test("a choice another tab makes shows in this one", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ state: { on: true }, version: 1 }));
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    expect(useInboxPreview.getState().on).toBe(true);
  });
});
