import { afterEach, describe, expect, test } from "bun:test";

import { refused, withLocalStorage } from "../../tests/local-storage";
import { upstreamKeys } from "./storage";

afterEach(() => {
  window.localStorage.clear();
});

// tests/upstream-keys.test.ts holds each key's name and its read.
describe("storage", () => {
  test("an upstream key writes its value, and removes it", () => {
    const pins = upstreamKeys.legacyPinnedAgents;
    pins.set("reader", '["s-1"]');
    expect(window.localStorage.getItem(pins.name("reader"))).toBe('["s-1"]');
    pins.remove("reader");
    expect(window.localStorage.getItem(pins.name("reader"))).toBeNull();
  });

  test("a browser that refuses storage keeps nothing, and nothing throws", () => {
    withLocalStorage(refused, () => {
      const pins = upstreamKeys.legacyPinnedAgents;
      expect(() => pins.set("reader", "[]")).not.toThrow();
      expect(pins.get("reader")).toBeUndefined();
      expect(() => pins.remove("reader")).not.toThrow();
    });
  });
});
