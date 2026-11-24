import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

import { PACKAGE_ROOT } from "./source";

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
