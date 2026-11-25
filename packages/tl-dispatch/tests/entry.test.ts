import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

import { filesWith, importsOf, resolutionCache, UPSTREAM_WEB } from "./imports";
import { PACKAGE_ROOT, sourceFiles } from "./source";

/** The names main.tsx calls in its top-level statements, in order. */
function topLevelCalls(): string[] {
  const path = join(PACKAGE_ROOT, "src/main.tsx");
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest);
  return file.statements.flatMap((statement) => {
    if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) {
      return [];
    }
    return [statement.expression.expression.getText(file)];
  });
}

describe("main.tsx", () => {
  test("installs the stale-chunk recovery when it loads, before the first render", () => {
    const calls = topLevelCalls();
    const render = calls.findIndex((call) => call.endsWith(".render"));
    expect(render).toBeGreaterThan(-1);
    expect(calls.slice(0, render)).toContain("installChunkFailureRecovery");
  });
});

describe("the shell", () => {
  // A palette still loading lets the next keys run global commands: Ctrl+K, then i, opened both.
  test("imports the search palette statically, so the key after $mod+k is the palette's", () => {
    const palette = join(UPSTREAM_WEB, "features/search/SearchPalette.tsx");
    const files = filesWith();
    const cache = resolutionCache();
    const kinds = sourceFiles()
      .filter((file) => /\.tsx?$/.test(file.path))
      .flatMap((file) => importsOf(join(PACKAGE_ROOT, file.path), files, cache))
      .filter((entry) => entry.file === palette)
      .map((entry) => entry.kind);
    expect(kinds).toEqual(["static"]);
  });
});
