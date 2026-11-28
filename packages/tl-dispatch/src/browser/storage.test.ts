import { afterEach, describe, expect, test } from "bun:test";

import { upstreamKeys } from "./storage";

afterEach(() => {
  window.localStorage.clear();
});

describe("storage", () => {
  test("an upstream key reads back what it wrote, and nothing once removed", () => {
    const pins = upstreamKeys.legacyPinnedAgents;
    pins.set("reader", '["s-1"]');
    expect(window.localStorage.getItem(pins.name("reader"))).toBe('["s-1"]');
    expect(pins.get("reader")).toBe('["s-1"]');
    pins.remove("reader");
    expect(pins.get("reader")).toBeUndefined();
  });

  test("a browser that refuses storage keeps nothing, and nothing throws", () => {
    const kept = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("refused", "SecurityError");
      },
    });
    try {
      const pins = upstreamKeys.legacyPinnedAgents;
      expect(() => pins.set("reader", "[]")).not.toThrow();
      expect(pins.get("reader")).toBeUndefined();
      expect(() => pins.remove("reader")).not.toThrow();
    } finally {
      if (kept === undefined) Reflect.deleteProperty(window, "localStorage");
      else Object.defineProperty(window, "localStorage", kept);
    }
  });
});
