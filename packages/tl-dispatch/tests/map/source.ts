// Reads upstream's sources and this app's page files where the checks need code as written.
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";

import { PACKAGE_ROOT, UPSTREAM_WEB } from "../source";
import { parseScript } from "../typescript";

export const upstreamAppFile = join(UPSTREAM_WEB, "app.tsx");
export const forkSrc = join(PACKAGE_ROOT, "src");

/** The file of a page in the route map: `src/pages/<id>.tsx`. */
export const pageFile = (id: string) => join(forkSrc, "pages", `${id}.tsx`);

/** Upstream's scripts under `dir`, tests and fixtures (`__fixtures__/`, `*-fixture(s).ts`) aside. */
export function upstreamScripts(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .filter((entry) => !/(\.test|-fixtures?)\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(
      (file) =>
        !relative(dir, file)
          .split(sep)
          .some((part) => part === "__tests__" || part === "__fixtures__")
    )
    .sort();
}

/** Every view file under upstream's `features/`: each `.tsx` that is not a test or a fixture. */
export function featureViews(): string[] {
  return upstreamScripts(join(UPSTREAM_WEB, "features"))
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => relative(UPSTREAM_WEB, file));
}

export const tagName = (source: ts.SourceFile, node: ts.Node): string | undefined =>
  openingOf(node)?.tagName.getText(source);

/** A JSX element's opening tag, or the element itself when it closes itself. */
export function openingOf(
  node: ts.Node
): ts.JsxOpeningElement | ts.JsxSelfClosingElement | undefined {
  if (ts.isJsxElement(node)) return node.openingElement;
  return ts.isJsxSelfClosingElement(node) ? node : undefined;
}

/** A name that is the identifier itself, not a property or attribute name beside it. */
function isReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  return !(
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isJsxAttribute(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node)
  );
}

/** Each name a file declares or imports at the top level, with its declaration; an import has none. */
export function topLevelNames(source: ts.SourceFile): Map<string, ts.Statement | undefined> {
  const names = new Map<string, ts.Statement | undefined>();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause;
      // A type loads nothing, so no copy follows it.
      if (clause.isTypeOnly) continue;
      if (clause.name) names.set(clause.name.text, undefined);
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) names.set(bindings.name.text, undefined);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (!element.isTypeOnly) names.set(element.name.text, undefined);
        }
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.set(declaration.name.text, statement);
      }
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name
    ) {
      names.set(statement.name.text, statement);
    }
  }
  return names;
}

/** The initializer of a top-level `const <name>`, if the file has one. */
export function constantOf(source: ts.SourceFile, name: string): ts.Expression | undefined {
  const statement = topLevelNames(source).get(name);
  if (statement === undefined || !ts.isVariableStatement(statement)) return undefined;
  return statement.declarationList.declarations.find(
    (declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === name
  )?.initializer;
}

/** Each named import of a file: the name it binds, the module it names and the name it takes there. */
export function namedImports(
  source: ts.SourceFile
): { name: string; from: string; imported: string }[] {
  return source.statements.flatMap((statement) => {
    const bindings = ts.isImportDeclaration(statement)
      ? statement.importClause?.namedBindings
      : undefined;
    if (!ts.isImportDeclaration(statement) || !bindings || !ts.isNamedImports(bindings)) return [];
    const from = (statement.moduleSpecifier as ts.StringLiteral).text;
    return bindings.elements.map((element) => ({
      name: element.name.text,
      from,
      imported: (element.propertyName ?? element.name).text,
    }));
  });
}

/**
 * Each top-level name of app.tsx that a `<Route>`'s element refers to, such as a page's lazy, and
 * each one the declarations of those refer to in turn, such as the imports a page's body draws.
 */
export function routeTargets(): string[] {
  const source = parseScript(upstreamAppFile);
  const declared = topLevelNames(source);
  const found = new Set<string>();
  const collect = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && declared.has(node.text) && isReference(node)) {
      const fresh = !found.has(node.text);
      found.add(node.text);
      const declaration = declared.get(node.text);
      if (fresh && declaration) collect(declaration);
    }
    ts.forEachChild(node, collect);
  };
  const visit = (node: ts.Node): void => {
    if (tagName(source, node) === "Route") {
      for (const attribute of openingOf(node)?.attributes.properties ?? []) {
        if (ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "element") {
          collect(attribute);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...found].sort();
}
