// Reads the route map and the view map from source, so the checks load no page module.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

import { PACKAGE_ROOT, UPSTREAM_WEB } from "../source";
import { parseScript } from "../typescript";

export const upstreamAppFile = join(UPSTREAM_WEB, "app.tsx");
export const forkSrc = join(PACKAGE_ROOT, "src");
export const pagesDir = join(forkSrc, "pages");
/** The route map: its `pages` list names every page file. */
export const routeMapFile = join(pagesDir, "index.ts");

const UPSTREAM_ALIAS = "@upstream-dispatch/";
const OWN_ALIAS = "@/";

export interface RouteEntry {
  path: string;
  /** The JSX the route renders, as written, with its spacing normalized. */
  element: string;
}

/** The query keys and fragment forms a page this app serves reads from its URL. */
export interface LinkForms {
  query: string[];
  /** `b-` for a block anchor (`#b-<id>`), else the whole fragment, such as `top`. */
  fragments: string[];
}

export interface PageEntry {
  file: string;
  id: string;
  server: "upstream" | "fork";
  routes: RouteEntry[];
  views: string[];
  linkForms?: LinkForms;
}

function resolveModule(from: string, specifier: string): string {
  let base: string;
  if (specifier.startsWith(UPSTREAM_ALIAS)) {
    base = join(UPSTREAM_WEB, specifier.slice(UPSTREAM_ALIAS.length));
  } else if (specifier.startsWith(OWN_ALIAS)) {
    base = join(forkSrc, specifier.slice(OWN_ALIAS.length));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(from), specifier);
  } else {
    throw new Error(`${from}: cannot read constants from package ${specifier}`);
  }
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  throw new Error(`${from}: cannot resolve ${specifier}`);
}

/** The string a constant holds, followed through named imports. */
function stringConstant(source: ts.SourceFile, name: string): string {
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === name &&
          declaration.initializer &&
          ts.isStringLiteralLike(declaration.initializer)
        ) {
          return declaration.initializer.text;
        }
      }
    }
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const element of statement.importClause.namedBindings.elements) {
        if (element.name.text === name) {
          const target = resolveModule(source.fileName, statement.moduleSpecifier.text);
          return stringConstant(parseScript(target), (element.propertyName ?? element.name).text);
        }
      }
    }
  }
  throw new Error(`${source.fileName}: ${name} is not a string constant`);
}

function stringValue(source: ts.SourceFile, node: ts.Expression): string {
  if (ts.isStringLiteralLike(node)) {
    return node.text;
  }
  if (ts.isIdentifier(node)) {
    return stringConstant(source, node.text);
  }
  throw new Error(`${source.fileName}: cannot read a path from ${node.getText(source)}`);
}

/** Source text with its spacing normalized, so a reformat compares equal. */
export function normalizeSource(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s*([{}()[\],:<>=/;])\s*/g, "$1")
    .replace(/,([}\])])/g, "$1");
}

function jsxText(source: ts.SourceFile, node: ts.Node): string {
  if (ts.isJsxExpression(node) && node.expression) {
    return jsxText(source, node.expression);
  }
  if (ts.isParenthesizedExpression(node)) {
    return jsxText(source, node.expression);
  }
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) {
    return normalizeSource(node.getText(source));
  }
  throw new Error(`${source.fileName}: a route element is not JSX: ${node.getText(source)}`);
}

const tagName = (source: ts.SourceFile, node: ts.Node): string | undefined =>
  ts.isJsxElement(node)
    ? node.openingElement.tagName.getText(source)
    : ts.isJsxSelfClosingElement(node)
      ? node.tagName.getText(source)
      : undefined;

/** Every `<Route>` of upstream's app, its path constants resolved. */
export function upstreamRoutes(file = upstreamAppFile, text?: string): RouteEntry[] {
  const source = parseScript(file, text);
  const routes: RouteEntry[] = [];
  const visit = (node: ts.Node): void => {
    if (tagName(source, node) === "Route") {
      const element = ts.isJsxElement(node)
        ? node.openingElement
        : (node as ts.JsxSelfClosingElement);
      let path: string | undefined;
      let drawn: string | undefined;
      for (const attribute of element.attributes.properties) {
        const name = ts.isJsxAttribute(attribute) ? attribute.name.getText(source) : "{...}";
        if (!ts.isJsxAttribute(attribute) || !attribute.initializer) {
          throw new Error(`${file}: a <Route> has ${name}, which the route map cannot hold`);
        }
        const value = attribute.initializer;
        if (name === "path") {
          path =
            ts.isJsxExpression(value) && value.expression
              ? stringValue(source, value.expression)
              : stringValue(source, value as ts.StringLiteral);
        } else if (name === "element") {
          drawn = jsxText(source, value);
        } else {
          throw new Error(`${file}: a <Route> has ${name}, which the route map cannot hold`);
        }
      }
      if (ts.isJsxElement(node) && node.children.some((child) => !isBlank(child))) {
        throw new Error(`${file}: a <Route> has child routes, which the route map cannot hold`);
      }
      if (path === undefined || drawn === undefined) {
        throw new Error(`${file}: a <Route> without a path or an element`);
      }
      routes.push({ path, element: drawn });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return routes;
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

/** The names a file declares or imports at the top level. */
export function topLevelNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause;
      if (clause.name) names.add(clause.name.text);
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) names.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) names.add(element.name.text);
      }
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    } else if (
      (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
      statement.name
    ) {
      names.add(statement.name.text);
    }
  }
  return names;
}

/** Each top-level name of app.tsx that a `<Route>`'s element refers to, such as a page's lazy. */
export function routeTargets(file = upstreamAppFile, text?: string): string[] {
  const source = parseScript(file, text);
  const declared = topLevelNames(source);
  const found = new Set<string>();
  const collect = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && declared.has(node.text) && isReference(node)) found.add(node.text);
    ts.forEachChild(node, collect);
  };
  const visit = (node: ts.Node): void => {
    if (tagName(source, node) === "Route") {
      const opening = ts.isJsxElement(node)
        ? node.openingElement
        : (node as ts.JsxSelfClosingElement);
      for (const attribute of opening.attributes.properties) {
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

/** Whitespace, or a JSX comment. */
const isBlank = (child: ts.JsxChild): boolean =>
  (ts.isJsxText(child) && child.text.trim() === "") ||
  (ts.isJsxExpression(child) && child.expression === undefined);

/**
 * Ways upstream's web app could route that `upstreamRoutes` would not read: a `useRoutes` call, a
 * child of `<Routes>` that is not a `<Route>`, or a `<Routes>` outside app.tsx.
 */
export function routingProblems(
  files: readonly { file: string; text: string }[] = upstreamSources()
): string[] {
  const problems: string[] = [];
  for (const { file, text } of files) {
    const source = parseScript(file, text);
    const where = relative(UPSTREAM_WEB, file);
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "useRoutes"
      ) {
        problems.push(`${where}: routes through useRoutes, which the route map does not read`);
      }
      if (tagName(source, node) === "Routes") {
        if (file !== upstreamAppFile) {
          problems.push(`${where}: has a <Routes>, and the route map reads only app.tsx's`);
        }
        if (ts.isJsxElement(node)) {
          for (const child of node.children) {
            if (!isBlank(child) && tagName(source, child) !== "Route") {
              problems.push(
                `${where}: a child of <Routes> is not a <Route>: ${normalizeSource(child.getText(source)).slice(0, 80)}`
              );
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return problems;
}

/** Upstream's web sources, tests and fixtures aside. */
function upstreamSources(): { file: string; text: string }[] {
  return sourceFiles(UPSTREAM_WEB, ["__tests__", "__fixtures__"]).map((file) => ({
    file,
    text: readFileSync(file, "utf8"),
  }));
}

function property(
  source: ts.SourceFile,
  object: ts.ObjectLiteralExpression,
  name: string
): ts.Expression {
  for (const entry of object.properties) {
    if (ts.isPropertyAssignment(entry) && entry.name.getText(source) === name) {
      return entry.initializer;
    }
  }
  throw new Error(`${source.fileName}: no ${name} in ${object.getText(source).slice(0, 60)}`);
}

function arrayOf(source: ts.SourceFile, node: ts.Expression): ts.NodeArray<ts.Expression> {
  if (!ts.isArrayLiteralExpression(node)) {
    throw new Error(`${source.fileName}: not an array literal: ${node.getText(source)}`);
  }
  return node.elements;
}

function linkForms(
  source: ts.SourceFile,
  object: ts.ObjectLiteralExpression
): LinkForms | undefined {
  const declared = object.properties.some(
    (entry) => ts.isPropertyAssignment(entry) && entry.name.getText(source) === "linkForms"
  );
  if (!declared) return undefined;
  const forms = property(source, object, "linkForms");
  if (!ts.isObjectLiteralExpression(forms)) {
    throw new Error(`${source.fileName}: linkForms is not an object literal`);
  }
  const list = (name: string) =>
    arrayOf(source, property(source, forms, name)).map((entry) => stringValue(source, entry));
  return { query: list("query"), fragments: list("fragments") };
}

/** The initializer of a top-level `const <name>`. */
function constant(source: ts.SourceFile, name: string): ts.Expression {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === name &&
        declaration.initializer
      ) {
        return declaration.initializer;
      }
    }
  }
  throw new Error(`${source.fileName}: no top-level const ${name}`);
}

/** A route: `pageRoute({ path, element, ... })`, written in place or as a top-level constant. */
function readRoute(source: ts.SourceFile, node: ts.Expression): RouteEntry {
  const call = ts.isIdentifier(node) ? constant(source, node.text) : node;
  const [route] = ts.isCallExpression(call) ? call.arguments : [];
  if (
    !ts.isCallExpression(call) ||
    call.expression.getText(source) !== "pageRoute" ||
    route === undefined ||
    !ts.isObjectLiteralExpression(route)
  ) {
    throw new Error(`${source.fileName}: a route is not pageRoute({...}): ${node.getText(source)}`);
  }
  return {
    path: stringValue(source, property(source, route, "path")),
    element: jsxText(source, property(source, route, "element")),
  };
}

/** The routes of a page: an object literal of named routes. */
function readRoutes(source: ts.SourceFile, node: ts.Expression): RouteEntry[] {
  if (!ts.isObjectLiteralExpression(node)) {
    throw new Error(`${source.fileName}: routes is not an object literal`);
  }
  return node.properties.map((entry) => {
    if (ts.isShorthandPropertyAssignment(entry)) return readRoute(source, entry.name);
    if (ts.isPropertyAssignment(entry)) return readRoute(source, entry.initializer);
    throw new Error(`${source.fileName}: routes holds ${entry.getText(source)}`);
  });
}

function readPage(file: string): PageEntry {
  const source = parseScript(file);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      const value = declaration.initializer;
      if (
        !value ||
        !ts.isSatisfiesExpression(value) ||
        value.type.getText(source) !== "Page" ||
        !ts.isObjectLiteralExpression(value.expression)
      ) {
        continue;
      }
      const object = value.expression;
      const server = stringValue(source, property(source, object, "server"));
      if (server !== "upstream" && server !== "fork") {
        throw new Error(`${file}: server is ${server}`);
      }
      return {
        file,
        id: stringValue(source, property(source, object, "id")),
        server,
        routes: readRoutes(source, property(source, object, "routes")),
        views: arrayOf(source, property(source, object, "views")).map((view) =>
          stringValue(source, view)
        ),
        linkForms: linkForms(source, object),
      };
    }
  }
  throw new Error(`${file}: no \`const <name> = {...} satisfies Page\``);
}

/** Every page file: each file in `src/pages` but the route map and the `Page` type. */
export function pageFiles(dir = pagesDir): string[] {
  return readdirSync(dir)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .filter((name) => name !== "index.ts" && name !== "page.ts")
    .sort()
    .map((name) => join(dir, name));
}

export function readPages(dir = pagesDir): PageEntry[] {
  return pageFiles(dir).map(readPage);
}

/** The list a `[...] as const satisfies ...` holds. */
function listOf(source: ts.SourceFile, node: ts.Expression): ts.NodeArray<ts.Expression> {
  return ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
    ? listOf(source, node.expression)
    : arrayOf(source, node);
}

/** The page files the route map (`src/pages/index.ts`) lists in `pages`. */
export function routeMapFiles(file = routeMapFile): string[] {
  const source = parseScript(file);
  const imports = new Map<string, string>();
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.startsWith("./") &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings)
    ) {
      for (const element of statement.importClause.namedBindings.elements) {
        imports.set(
          element.name.text,
          resolveModule(source.fileName, statement.moduleSpecifier.text)
        );
      }
    }
  }
  return listOf(source, constant(source, "pages"))
    .map((entry) => {
      const found = imports.get(entry.getText(source));
      if (!found) {
        throw new Error(`${source.fileName}: ${entry.getText(source)} is not imported`);
      }
      return found;
    })
    .sort();
}

function sourceFiles(root: string, skip: readonly string[]): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skip.includes(entry.name)) walk(path);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found;
}

function importTarget(from: string, specifier: string, webSrc: string): string | undefined {
  let base: string;
  if (specifier.startsWith(UPSTREAM_ALIAS)) {
    base = join(webSrc, specifier.slice(UPSTREAM_ALIAS.length));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(from), specifier);
  } else {
    return undefined;
  }
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

/** The modules a file loads at run time: its imports and re-exports, type-only ones aside, and each `import()`. */
export function runtimeImports(file: string, text: string): string[] {
  const source = parseScript(file, text);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        clause !== undefined &&
        (clause.isTypeOnly ||
          (clause.name === undefined &&
            bindings !== undefined &&
            ts.isNamedImports(bindings) &&
            bindings.elements.length > 0 &&
            bindings.elements.every((element) => element.isTypeOnly)));
      if (!typeOnly) found.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      found.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

/**
 * For each view file under upstream's `features/`, the files that load it at run time: upstream's
 * own feature files and this app's sources.
 */
export function viewImporters(webSrc = UPSTREAM_WEB): Map<string, string[]> {
  const importers = new Map<string, string[]>();
  const files = [
    ...sourceFiles(join(webSrc, "features"), ["__tests__", "__fixtures__"]),
    ...sourceFiles(forkSrc, []),
  ];
  for (const file of files) {
    for (const specifier of runtimeImports(file, readFileSync(file, "utf8"))) {
      const target = importTarget(file, specifier, webSrc);
      if (!target) continue;
      const view = relative(webSrc, target);
      if (view.startsWith("features/") && view.endsWith(".tsx")) {
        importers.set(view, [...(importers.get(view) ?? []), file]);
      }
    }
  }
  return importers;
}

/** Every view file under upstream's `features/`: each `.tsx` that is not a test or a fixture. */
export function featureViews(webSrc = UPSTREAM_WEB): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__" && entry.name !== "__fixtures__") {
          walk(path);
        }
      } else if (entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx")) {
        found.push(relative(webSrc, path));
      }
    }
  };
  walk(join(webSrc, "features"));
  return found.sort();
}
