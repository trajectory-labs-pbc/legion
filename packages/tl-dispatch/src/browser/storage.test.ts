import { describe, expect, test } from "bun:test";

import { refused, withLocalStorage } from "../../tests/local-storage";
import { upstreamKeys } from "./storage";

// tests/upstream-keys.test.ts holds each key's name and its read.
describe("storage", () => {
  test("an upstream key removes its value", () => {
    const pins = upstreamKeys.legacyPinnedAgents;
    window.localStorage.setItem(pins.name("reader"), '["s-1"]');
    pins.remove("reader");
    expect(window.localStorage.getItem(pins.name("reader"))).toBeNull();
  });

  test("a browser that refuses storage keeps nothing, and nothing throws", () => {
    withLocalStorage(refused, () => {
      const pins = upstreamKeys.legacyPinnedAgents;
      expect(pins.get("reader")).toBeUndefined();
      expect(() => pins.remove("reader")).not.toThrow();
    });
  });
});
