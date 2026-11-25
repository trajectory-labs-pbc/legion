import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { entryChunk, measureEntry } from "../scripts/check-entry-budget";

describe("the entry chunk", () => {
  test("is the first /assets/index-*.js script, as the server reads it", () => {
    const html =
      '<script src="/theme.js"></script><script type="module" src="/assets/index-a1.js"></script>';
    expect(entryChunk(html)).toBe("/assets/index-a1.js");
  });

  test("a build with no entry script is refused", () => {
    expect(() => entryChunk('<script src="/assets/vendor-a1.js"></script>')).toThrow("names no");
  });

  describe("measured", () => {
    let dist = "";
    beforeEach(() => {
      dist = mkdtempSync(join(tmpdir(), "entry-"));
      mkdirSync(join(dist, "assets"));
      writeFileSync(join(dist, "assets/index-x.js"), "x".repeat(1000));
    });
    afterEach(() => rmSync(dist, { recursive: true }));

    test("is counted raw and gzipped", () => {
      writeFileSync(
        join(dist, "index.html"),
        '<script type="module" src="/assets/index-x.js"></script>'
      );
      const size = measureEntry(dist);
      expect(size.bytes).toBe(1000);
      expect(size.gzipBytes).toBeLessThan(100);
    });
  });
});
