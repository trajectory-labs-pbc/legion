// Reads the route map and the view map from source, so the checks load no page module.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

export const packageRoot = resolve(import.meta.dir, "../..");
export const upstreamWebSrc = resolve(packageRoot, "../dispatch/web/src");
export const upstreamAppFile = join(upstreamWebSrc, "app.tsx");
export const pagesDir = join(packageRoot, "src/pages");

const UPSTREAM_ALIAS = "@upstream-dispatch/";

export interface RouteEntry {
  path: string;
  /** The JSX tag the route renders, as written. */
  element: string;
}

export interface PageEntry {
  file: string;
  id: string;
  server: "upstream" | "fork";
  routes: RouteEntry[];
  views: string[];
}

function parse(file: string, text?: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    text ?? readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

function resolveModule(from: string, specifier: string): string {
  let base: string;
  if (specifier.startsWith(UPSTREAM_ALIAS)) {
    base = join(upstreamWebSrc, specifier.slice(UPSTREAM_ALIAS.length));
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
          return stringConstant(parse(target), (element.propertyName ?? element.name).text);
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

function jsxTag(source: ts.SourceFile, node: ts.Node): string {
  if (ts.isJsxExpression(node) && node.expression) {
    return jsxTag(source, node.expression);
  }
  if (ts.isParenthesizedExpression(node)) {
    return jsxTag(source, node.expression);
  }
  if (ts.isJsxSelfClosingElement(node)) {
    return node.tagName.getText(source);
  }
  if (ts.isJsxElement(node)) {
    return node.openingElement.tagName.getText(source);
  }
  throw new Error(`${source.fileName}: a route element is not JSX: ${node.getText(source)}`);
}

/** Every `<Route>` of upstream's app, its path constants resolved. */
export function upstreamRoutes(file = upstreamAppFile, text?: string): RouteEntry[] {
  const source = parse(file, text);
  const routes: RouteEntry[] = [];
  const visit = (node: ts.Node): void => {
    const element = ts.isJsxElement(node) ? node.openingElement : node;
    if (
      (ts.isJsxSelfClosingElement(element) || ts.isJsxOpeningElement(element)) &&
      element.tagName.getText(source) === "Route"
    ) {
      let path: string | undefined;
      let tag: string | undefined;
      for (const attribute of element.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || !attribute.initializer) {
          continue;
        }
        const name = attribute.name.getText(source);
        if (name === "path") {
          const value = attribute.initializer;
          path =
            ts.isJsxExpression(value) && value.expression
              ? stringValue(source, value.expression)
              : stringValue(source, value as ts.StringLiteral);
        } else if (name === "element") {
          tag = jsxTag(source, attribute.initializer);
        }
      }
      if (path === undefined || tag === undefined) {
        throw new Error(`${file}: a <Route> without a path or an element`);
      }
      routes.push({ path, element: tag });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return routes;
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

function readPage(file: string): PageEntry {
  const source = parse(file);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        declaration.type?.getText(source) !== "Page" ||
        !declaration.initializer ||
        !ts.isObjectLiteralExpression(declaration.initializer)
      ) {
        continue;
      }
      const object = declaration.initializer;
      const server = stringValue(source, property(source, object, "server"));
      if (server !== "upstream" && server !== "fork") {
        throw new Error(`${file}: server is ${server}`);
      }
      return {
        file,
        id: stringValue(source, property(source, object, "id")),
        server,
        routes: arrayOf(source, property(source, object, "routes")).map((route) => {
          if (!ts.isObjectLiteralExpression(route)) {
            throw new Error(`${file}: a route is not an object literal`);
          }
          return {
            path: stringValue(source, property(source, route, "path")),
            element: jsxTag(source, property(source, route, "element")),
          };
        }),
        views: arrayOf(source, property(source, object, "views")).map((view) =>
          stringValue(source, view)
        ),
      };
    }
  }
  throw new Error(`${file}: no \`const <name>: Page = {...}\``);
}

/** Every page file: each file in `src/pages` but the route map and the `Page` type. */
export function pageFiles(dir = pagesDir): string[] {
  return readdirSync(dir)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .filter((name) => name !== "index.tsx" && name !== "page.ts")
    .sort()
    .map((name) => join(dir, name));
}

export function readPages(dir = pagesDir): PageEntry[] {
  return pageFiles(dir).map(readPage);
}

/** The page files the route map (`src/pages/index.tsx`) lists in `pages`. */
export function routeMapFiles(dir = pagesDir): string[] {
  const source = parse(join(dir, "index.tsx"));
  const imports = new Map<string, string>();
  let listed: string[] | undefined;
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
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "pages" &&
          declaration.initializer
        ) {
          listed = arrayOf(source, declaration.initializer).map((entry) => entry.getText(source));
        }
      }
    }
  }
  if (!listed) {
    throw new Error(`${source.fileName}: no pages list`);
  }
  return listed
    .map((name) => {
      const file = imports.get(name);
      if (!file) {
        throw new Error(`${source.fileName}: ${name} is not imported`);
      }
      return file;
    })
    .sort();
}

/** Every view file under upstream's `features/`: each `.tsx` that is not a test or a fixture. */
export function featureViews(webSrc = upstreamWebSrc): string[] {
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
