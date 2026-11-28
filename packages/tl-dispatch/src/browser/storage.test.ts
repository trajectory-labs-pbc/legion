import { afterEach, describe, expect, test } from "bun:test";

import { FORK_PREFIX, forkKeys } from "./storage";

afterEach(() => {
  window.localStorage.clear();
});

describe("storage", () => {
  test("each fork key is stored under the fork's prefix", () => {
    for (const key of Object.values(forkKeys)) {
      expect(key.name("x").startsWith(FORK_PREFIX)).toBe(true);
    }
  });

  test("a key reads back what it wrote, and nothing once removed", () => {
    const folded = forkKeys.sidebarFolded;
    folded.set("Agents", true);
    expect(window.localStorage.getItem(folded.name("Agents"))).toBe("true");
    expect(folded.get("Agents")).toBe(true);
    folded.remove("Agents");
    expect(folded.get("Agents")).toBeUndefined();
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
      const folded = forkKeys.sidebarFolded;
      expect(() => folded.set("Agents", true)).not.toThrow();
      expect(folded.get("Agents")).toBeUndefined();
      expect(() => folded.remove("Agents")).not.toThrow();
    } finally {
      if (kept === undefined) Reflect.deleteProperty(window, "localStorage");
      else Object.defineProperty(window, "localStorage", kept);
    }
  });
});
