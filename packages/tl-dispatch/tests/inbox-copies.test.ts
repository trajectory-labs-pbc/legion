import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

import { filesUnder, PACKAGE_ROOT, type SourceFile, TEST } from "./source";
import { parseScript } from "./typescript";

// The page imports upstream's Inbox logic and copies none of it (spec R13): a fork function that
// takes the name of one of its exports is read as a copy, and the import is the fix.

const SEAM = "src/upstream/logic/inbox.ts";
const READERS = ["src/features/inbox", "src/parts", "src/data/inbox"];

/** The values the seam file gives, by name. */
function seamValues(text: string): Set<string> {
  const names = new Set<string>();
  for (const statement of parseScript(SEAM, text).statements) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue;
    const clause = statement.exportClause;
    if (clause === undefined || !ts.isNamedExports(clause)) continue;
    for (const element of clause.elements) if (!element.isTypeOnly) names.add(element.name.text);
  }
  return names;
}

/** Each function that `files` declare under one of `names`, as `path: name`. */
function copies(files: readonly SourceFile[], names: ReadonlySet<string>): string[] {
  const found: string[] = [];
  for (const file of files) {
    const visit = (node: ts.Node) => {
      const name =
        ts.isFunctionDeclaration(node) && node.name !== undefined
          ? node.name.text
          : ts.isVariableDeclaration(node) &&
              ts.isIdentifier(node.name) &&
              node.initializer !== undefined &&
              (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
            ? node.name.text
            : undefined;
      if (name !== undefined && names.has(name)) found.push(`${file.path}: ${name}`);
      ts.forEachChild(node, visit);
    };
    visit(parseScript(file.path, file.text));
  }
  return found;
}

describe("no copy of upstream's Inbox logic", () => {
  const names = seamValues(readFileSync(join(PACKAGE_ROOT, SEAM), "utf8"));

  test("the Inbox's files, the parts and the Inbox's data declare no function of the seam's", () => {
    const files = READERS.flatMap((dir) => filesUnder(PACKAGE_ROOT, dir)).filter(
      (file) => !TEST.test(file.path) && !file.path.endsWith(".css")
    );
    expect(copies(files, names)).toEqual([]);
  });

  test("names a copied function, as a declaration or an arrow, and leaves an import alone", () => {
    expect(names.has("sortRows")).toBe(true);
    const files = [
      { path: "src/features/inbox/list.tsx", text: "function sortRows() {}" },
      { path: "src/parts/x/x.ts", text: "export const sectionOf = (row) => row;" },
      { path: "src/data/inbox/x.ts", text: 'import { group } from "@/upstream/logic/inbox";' },
      { path: "src/features/inbox/y.tsx", text: "const SNOOZE_PRESETS = [];" },
    ];
    expect(copies(files, names)).toEqual([
      "src/features/inbox/list.tsx: sortRows",
      "src/parts/x/x.ts: sectionOf",
    ]);
  });

  test("reads the seam's values and leaves its types out", () => {
    const seam = [
      'export { a, type B } from "x";',
      'export type { C } from "y";',
      "export const d = 1;",
    ].join("\n");
    expect([...seamValues(seam)]).toEqual(["a"]);
  });
});
