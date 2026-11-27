import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

import { PACKAGE_ROOT, UPSTREAM_WEB } from "./source";
import { parseScript } from "./typescript";

/** A key binding written in source: an object literal with `keys` beside a `label` or a `run`. */
export interface KeyRegistration {
  file: string;
  line: number;
  /** The engine scope of the `useKeymap` or `register` call it is passed to, when that is a literal. */
  scope: string | undefined;
  /** The binding's `id`, when it is a literal. */
  id: string | undefined;
  /** The label as written: a template's expressions read `{name}`, other expressions their source. */
  label: string | undefined;
  keys: string;
  /** `inEditable` and `palette`, when each is written as `true` or `false`. */
  inEditable?: boolean | undefined;
  palette?: boolean | undefined;
}

function literalText(node: ts.Expression): string | undefined {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : undefined;
}

function property(node: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const member of node.properties) {
    if (ts.isPropertyAssignment(member) && member.name.getText() === name)
      return member.initializer;
    if (ts.isShorthandPropertyAssignment(member) && member.name.text === name) return member.name;
  }
  return undefined;
}

function literalBoolean(node: ts.Expression | undefined): boolean | undefined {
  if (node?.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node?.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function hasMember(node: ts.ObjectLiteralExpression, name: string): boolean {
  return node.properties.some((member) => member.name?.getText() === name);
}

/** The label's words as written; a template's expressions read `{expression}`. */
function labelText(node: ts.Expression | undefined): string | undefined {
  if (node === undefined) return undefined;
  const literal = literalText(node);
  if (literal !== undefined) return literal;
  if (ts.isTemplateExpression(node)) {
    return (
      node.head.text +
      node.templateSpans
        .map((span) => `{${span.expression.getText()}}${span.literal.text}`)
        .join("")
    );
  }
  return node.getText();
}

/** The string literal a name is declared with in its file, such as a parameter's default. */
function declaredLiteral(name: ts.Identifier): string | undefined {
  let found: string | undefined;
  const visit = (node: ts.Node) => {
    if (found !== undefined) return;
    if (
      (ts.isBindingElement(node) || ts.isParameter(node) || ts.isVariableDeclaration(node)) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name.text &&
      node.initializer !== undefined
    ) {
      found = literalText(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(name.getSourceFile());
  return found;
}

/**
 * The scope argument of the registering call the object sits in: a literal, `DIALOG_SCOPE`, or a
 * name declared with a literal, such as the inbox's `keymapScope = "inbox"`.
 */
function scopeOf(node: ts.Node): string | undefined {
  for (let at: ts.Node | undefined = node.parent; at !== undefined; at = at.parent) {
    if (!ts.isCallExpression(at)) continue;
    const callee = at.expression;
    const name = ts.isIdentifier(callee)
      ? callee.text
      : ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : undefined;
    if (name !== "useKeymap" && name !== "register") continue;
    const scope = at.arguments[0];
    if (scope === undefined) return undefined;
    if (ts.isIdentifier(scope) && scope.text === "DIALOG_SCOPE") return "dialog";
    if (ts.isIdentifier(scope)) return declaredLiteral(scope);
    return literalText(scope);
  }
  return undefined;
}

/** Every key binding with literal keys in one file. */
export function keyRegistrations(
  path: string,
  text = readFileSync(path, "utf8")
): KeyRegistration[] {
  const source = parseScript(path, text);
  const file = relative(PACKAGE_ROOT, path).split(sep).join("/");
  const found: KeyRegistration[] = [];
  const visit = (node: ts.Node) => {
    if (
      ts.isObjectLiteralExpression(node) &&
      (hasMember(node, "label") || hasMember(node, "run"))
    ) {
      const keys = property(node, "keys");
      const texts =
        keys === undefined
          ? []
          : ts.isArrayLiteralExpression(keys)
            ? keys.elements.map((element) => literalText(element as ts.Expression))
            : [literalText(keys)];
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const idNode = property(node, "id");
      const id = idNode === undefined ? undefined : literalText(idNode);
      const label = labelText(property(node, "label"));
      const inEditable = literalBoolean(property(node, "inEditable"));
      const palette = literalBoolean(property(node, "palette"));
      for (const text of texts) {
        if (text !== undefined) {
          found.push({
            file,
            line,
            scope: scopeOf(node),
            id,
            label,
            keys: text,
            inEditable,
            palette,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/** Upstream's files tl-dispatch can mount: its app and entry never load here. */
const NEVER_MOUNTED = new Set(["app.tsx", "main.tsx"]);

/** Every key binding with literal keys in upstream's web source, tests left out. */
export function upstreamKeyRegistrations(root = UPSTREAM_WEB): KeyRegistration[] {
  const found: KeyRegistration[] = [];
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name))
      continue;
    const path = join(entry.parentPath, entry.name);
    if (NEVER_MOUNTED.has(relative(root, path))) continue;
    found.push(...keyRegistrations(path));
  }
  return found;
}
