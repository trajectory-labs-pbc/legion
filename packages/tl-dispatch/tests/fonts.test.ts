import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseCss } from "./css";
import { PACKAGE_ROOT } from "./source";

const read = (path: string) => readFileSync(join(PACKAGE_ROOT, path), "utf8");

describe("the root's font", () => {
  // Upstream's stylesheet sets Inter on :root outside any layer, which beats every layered rule.
  test("is the theme's, set on :root outside any layer, in a file loaded after upstream's", () => {
    const rootFont = parseCss(read("src/tokens.css")).declarations.filter(
      ({ property, context }) =>
        property === "font-family" && context.length === 1 && context[0] === ":root"
    );
    expect(rootFont.map(({ value }) => value)).toEqual(["var(--font-sans)"]);
    const imports = [...read("src/styles.css").matchAll(/@import\s+"([^"]+)"/g)].map(
      (match) => match[1]
    );
    expect(imports.indexOf("./tokens.css")).toBeGreaterThan(
      imports.indexOf("../../dispatch/web/src/styles.css")
    );
  });
});
