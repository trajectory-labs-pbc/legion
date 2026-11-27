import { afterEach, describe, expect, test } from "bun:test";

import { upstreamKeys } from "@/browser/storage";
import { legacyPinnedAgentsKey } from "@/upstream/data-hooks";

// `src/browser` is above the seam, so the storage file spells upstream's keys itself. This test
// sits in `tests`, which reads both, and fails when a spelling is not the one upstream's code gives.

afterEach(() => {
  window.localStorage.clear();
});

/** Upstream's own namer of each upstream key, so a name upstream's code does not hold fails. */
const upstreamNames: Record<keyof typeof upstreamKeys, (param: string) => string> = {
  legacyPinnedAgents: legacyPinnedAgentsKey,
};

describe("upstream's storage keys", () => {
  test("each upstream key is the name upstream's code gives it", () => {
    for (const [id, key] of Object.entries(upstreamKeys)) {
      const name = upstreamNames[id as keyof typeof upstreamKeys];
      expect(key.name("reader")).toBe(name("reader"));
    }
  });

  test("an upstream key reads the text upstream wrote", () => {
    window.localStorage.setItem(legacyPinnedAgentsKey("reader"), '["s-1"]');
    expect(upstreamKeys.legacyPinnedAgents.get("reader")).toBe('["s-1"]');
  });
});
