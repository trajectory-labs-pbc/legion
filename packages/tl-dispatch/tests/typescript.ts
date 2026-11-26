import { readFileSync } from "node:fs";
import ts from "typescript";

/** A script parsed for reading, with parents set: `.ts` as TypeScript, `.js` and `.jsx` as JSX, any other as TSX. */
export function parseScript(path: string, text = readFileSync(path, "utf8")): ts.SourceFile {
  const kind = /\.[cm]?ts$/.test(path)
    ? ts.ScriptKind.TS
    : /\.[cm]?jsx?$/.test(path)
      ? ts.ScriptKind.JSX
      : ts.ScriptKind.TSX;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
}

/** The text of a string literal, or of a template with no substitution. */
export function literal(node: ts.Node | undefined): string | undefined {
  return node !== undefined &&
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? node.text
    : undefined;
}
