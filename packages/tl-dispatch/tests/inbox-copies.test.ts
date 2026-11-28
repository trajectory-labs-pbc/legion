import { describe, expect, test } from "bun:test";
import ts from "typescript";

import * as seam from "@/upstream/logic/inbox";

import { type SourceFile, sourceFiles } from "./source";
import { parseScript } from "./typescript";

// The page imports upstream's Inbox logic and copies none of it (spec R13): a fork function,
// constant or method that takes the name of one of its exports is read as a copy, and the import
// is the fix. A copy under another name is for copies.json, which pins what the fork does again.

const READERS = ["src/features/inbox", "src/parts", "src/data/inbox"];

/** The name a node declares as a function, a constant or a method, if any. */
function declaredName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node)) return node.name?.text;
  if (ts.isVariableDeclaration(node) || ts.isMethodDeclaration(node)) {
    return ts.isIdentifier(node.name) ? node.name.text : undefined;
  }
  if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
    const value = node.initializer;
    return ts.isArrowFunction(value) || ts.isFunctionExpression(value) ? node.name.text : undefined;
  }
  return undefined;
}

/** Each name of `names` that `files` declare, as `path: name`. */
function copies(files: readonly SourceFile[], names: ReadonlySet<string>): string[] {
  const found: string[] = [];
  for (const file of files) {
    const visit = (node: ts.Node) => {
      const name = declaredName(node);
      if (name !== undefined && names.has(name)) found.push(`${file.path}: ${name}`);
      ts.forEachChild(node, visit);
    };
    visit(parseScript(file.path, file.text));
  }
  return found;
}

describe("no copy of upstream's Inbox logic", () => {
  // A module's keys are its values: the seam's types are not among them.
  const names = new Set(Object.keys(seam));

  test("the Inbox's files, the parts and the Inbox's data declare no name of the seam's", () => {
    const files = sourceFiles().filter(
      (file) =>
        READERS.some((dir) => file.path.startsWith(`${dir}/`)) && !file.path.endsWith(".css")
    );
    expect(copies(files, names)).toEqual([]);
  });

  test("names a copied function, arrow, constant or method, and leaves an import alone", () => {
    expect(names.has("sortRows")).toBe(true);
    const files = [
      { path: "src/features/inbox/list.tsx", text: "function sortRows() {}" },
      { path: "src/parts/x/x.ts", text: "export const sectionOf = (row) => row;" },
      { path: "src/data/inbox/x.ts", text: 'import { group } from "@/upstream/logic/inbox";' },
      { path: "src/features/inbox/y.tsx", text: "const SNOOZE_PRESETS = [];" },
      {
        path: "src/parts/y/y.ts",
        text: "const rows = { sortRows() {}, group: () => 1, other: 0 };",
      },
    ];
    expect(copies(files, names)).toEqual([
      "src/features/inbox/list.tsx: sortRows",
      "src/parts/x/x.ts: sectionOf",
      "src/features/inbox/y.tsx: SNOOZE_PRESETS",
      "src/parts/y/y.ts: sortRows",
      "src/parts/y/y.ts: group",
    ]);
  });
});
