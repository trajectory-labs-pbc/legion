import { readFileSync } from "node:fs";
import { relative } from "node:path";
import ts from "typescript";

import { firstMatch, routerPath } from "@/navigation/router-path";
import { pages } from "@/pages/index";
import type { Page } from "@/pages/page";
import { filesWith, importsOf, resolutionCache } from "../imports";
import { UPSTREAM_WEB } from "../source";
import { parseScript } from "../typescript";
import { canonical } from "./copies";
import {
  constantOf,
  namedImports,
  openingOf,
  pageFile,
  tagName,
  upstreamAppFile,
  upstreamScripts,
} from "./source";

export interface RouteEntry {
  path: string;
  /** The JSX the route renders, as written, in the form `canonical` gives. */
  element: string;
}

export interface ForkRoute extends RouteEntry {
  page: string;
  server: Page["server"];
}

/** The string a constant holds, followed through named imports. */
function stringConstant(source: ts.SourceFile, name: string): string {
  const value = constantOf(source, name);
  if (value !== undefined && ts.isStringLiteralLike(value)) return value.text;
  const binding = namedImports(source).find((entry) => entry.name === name);
  const target = binding && importsOf(source.fileName, filesWith(), resolutionCache());
  const file = target?.find((entry) => entry.specifier === binding?.from)?.file;
  if (binding && file) return stringConstant(parseScript(file), binding.imported);
  throw new Error(`${source.fileName}: ${name} is not a string constant`);
}

function stringValue(source: ts.SourceFile, node: ts.Expression): string {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isIdentifier(node)) return stringConstant(source, node.text);
  throw new Error(`${source.fileName}: cannot read a path from ${node.getText(source)}`);
}

function jsxText(source: ts.SourceFile, node: ts.Node): string {
  if (ts.isJsxExpression(node) && node.expression) return jsxText(source, node.expression);
  if (ts.isParenthesizedExpression(node)) return jsxText(source, node.expression);
  if (ts.isJsxSelfClosingElement(node) || ts.isJsxElement(node)) return canonical(node, source);
  throw new Error(`${source.fileName}: a route element is not JSX: ${node.getText(source)}`);
}

/** Whitespace, or a JSX comment. */
const isBlank = (child: ts.JsxChild): boolean =>
  (ts.isJsxText(child) && child.text.trim() === "") ||
  (ts.isJsxExpression(child) && child.expression === undefined);

/** Every `<Route>` of upstream's app, its path constants resolved. */
export function upstreamRoutes(file = upstreamAppFile, text?: string): RouteEntry[] {
  const source = parseScript(file, text);
  const routes: RouteEntry[] = [];
  const visit = (node: ts.Node): void => {
    const opening = tagName(source, node) === "Route" ? openingOf(node) : undefined;
    if (opening) {
      let path: string | undefined;
      let drawn: string | undefined;
      for (const attribute of opening.attributes.properties) {
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

/**
 * Ways upstream's web app could route that `upstreamRoutes` would not read: a `useRoutes` call, a
 * child of `<Routes>` that is not a `<Route>`, or a `<Routes>` outside app.tsx.
 */
export function routingProblems(
  files: readonly { file: string; text: string }[] = upstreamScripts(UPSTREAM_WEB).map((file) => ({
    file,
    text: readFileSync(file, "utf8"),
  }))
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
                `${where}: a child of <Routes> is not a <Route>: ${canonical(child, source).slice(0, 80)}`
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

/** The element a route draws: `pageRoute({ element, ... })`, in place or as a top-level constant. */
function routeElement(source: ts.SourceFile, node: ts.Expression): string {
  const call = ts.isIdentifier(node) ? constantOf(source, node.text) : node;
  const [route] = call && ts.isCallExpression(call) ? call.arguments : [];
  if (
    !call ||
    !ts.isCallExpression(call) ||
    call.expression.getText(source) !== "pageRoute" ||
    route === undefined ||
    !ts.isObjectLiteralExpression(route)
  ) {
    throw new Error(`${source.fileName}: a route is not pageRoute({...}): ${node.getText(source)}`);
  }
  return jsxText(source, property(source, route, "element"));
}

/**
 * The element each route of a page draws, by route name, as its file writes it: the router holds
 * the element as a React node, and the parity check compares upstream's JSX as written.
 */
export function routeElements(file: string): Map<string, string> {
  const source = parseScript(file);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const value = declaration.initializer;
      if (
        value &&
        ts.isSatisfiesExpression(value) &&
        value.type.getText(source) === "Page" &&
        ts.isObjectLiteralExpression(value.expression)
      ) {
        const routes = property(source, value.expression, "routes");
        if (!ts.isObjectLiteralExpression(routes)) {
          throw new Error(`${file}: routes is not an object literal`);
        }
        return new Map(
          routes.properties.map((entry) => {
            if (ts.isShorthandPropertyAssignment(entry)) {
              return [entry.name.text, routeElement(source, entry.name)];
            }
            if (ts.isPropertyAssignment(entry)) {
              return [entry.name.getText(source), routeElement(source, entry.initializer)];
            }
            throw new Error(`${file}: routes holds ${entry.getText(source)}`);
          })
        );
      }
    }
  }
  throw new Error(`${file}: no \`const <name> = {...} satisfies Page\``);
}

/** The routes of every page of the route map. */
export function forkRoutes(list: readonly Page[] = pages): ForkRoute[] {
  return list.flatMap((page) => {
    const file = pageFile(page.id);
    const elements = routeElements(file);
    return Object.entries(page.routes).map(([name, route]) => {
      const element = elements.get(name);
      if (element === undefined) throw new Error(`${file}: no element for the route ${name}`);
      return { path: route.path, element, page: page.id, server: page.server };
    });
  });
}

/** The route an href opens: the one the router ranks first. */
function resolveHref(routes: readonly ForkRoute[], href: string): ForkRoute | undefined {
  const url = new URL(href, "https://dispatch.invalid");
  const index = firstMatch(
    routes.map((route) => routerPath(route.path)),
    url.pathname
  );
  return index === undefined ? undefined : routes[index];
}

/**
 * Routes this app writes with its own typed parts, by upstream's path: the element this app
 * writes, and upstream's element it stands for, as upstream writes it, both in the form
 * `canonical` gives. A change to upstream's element reports the route.
 */
export const OWN_ELEMENTS: Readonly<Record<string, { own: string; upstream: string }>> = {
  "/replies": {
    own: '< Redirect page = { home } search = { { type : "reply" } } / >',
    upstream:
      '< Navigate replace to = { buildInboxPath ( { filters : { type : [ "reply" ] } } ) } / >',
  },
  // The reading aids' hosts: upstream's page inside the element that holds the aids.
  "/issues/:key/*": { own: "< AidedIssuePage / >", upstream: "< IssuePage / >" },
  "/projects/:key/documents/:slug": {
    own: "< AidedDocumentPage / >",
    upstream: "< DocumentPage / >",
  },
};

/** A path from the root: upstream writes its last route `*`, and navigation's grammar `/*`. */
const rooted = (path: string) => (path.startsWith("/") ? path : `/${path}`);

const key = (route: RouteEntry) => {
  const path = rooted(route.path);
  const translated = OWN_ELEMENTS[path];
  const element = translated?.own === route.element ? translated.upstream : route.element;
  return `${path} -> ${element}`;
};

/**
 * Upstream routes the fork does not serve, and fork routes upstream has not got. A page upstream's
 * code draws must draw exactly upstream's element, props included; a page this app serves keeps
 * only the path.
 */
export function routeParity(
  upstream: readonly RouteEntry[],
  fork: readonly ForkRoute[]
): { missing: string[]; extra: string[] } {
  const served = new Set(
    fork.filter((route) => route.server === "fork").map((route) => rooted(route.path))
  );
  const forkKeys = new Set(fork.filter((route) => route.server === "upstream").map(key));
  const upstreamKeys = new Set(upstream.map(key));
  const upstreamPaths = new Set(upstream.map((route) => rooted(route.path)));
  return {
    missing: upstream
      .filter((route) => !served.has(rooted(route.path)) && !forkKeys.has(key(route)))
      .map(key),
    extra: fork
      .filter((route) =>
        route.server === "fork"
          ? !upstreamPaths.has(rooted(route.path))
          : !upstreamKeys.has(key(route))
      )
      .map(key),
  };
}

/** The query keys of an href, and its fragment's form: `b-` for a block anchor, else the fragment. */
export function linkForm(href: string): { query: string[]; fragment?: string } {
  const url = new URL(href, "https://dispatch.invalid");
  const fragment = decodeURIComponent(url.hash.slice(1));
  return {
    query: [...new Set(url.searchParams.keys())].sort(),
    fragment: fragment === "" ? undefined : fragment.startsWith("b-") ? "b-" : fragment,
  };
}

/**
 * Each query key and fragment form an href sets on a page this app serves. No page this app serves
 * reads one yet, so each is a link the page would drop.
 */
export function linkFormProblems(fork: readonly ForkRoute[], hrefs: readonly string[]): string[] {
  const problems: string[] = [];
  for (const href of hrefs) {
    const route = resolveHref(fork, href);
    if (!route || route.server !== "fork") continue;
    const { query, fragment } = linkForm(href);
    for (const name of query) {
      problems.push(`${href}: page ${route.page}, which this app serves, does not read ?${name}=`);
    }
    if (fragment !== undefined) {
      problems.push(
        `${href}: page ${route.page}, which this app serves, does not read #${fragment}`
      );
    }
  }
  return problems;
}

/**
 * Hrefs Dispatch's server writes that @legion/contracts' list does not hold: a search result's,
 * which carries the query and the block it matched (`searchHref` in search.go), a session's live view
 * (sessionanswers.go) and the machine sign-in page a device grant names.
 */
export const SERVER_HREFS: readonly string[] = [
  "/issues/CORE-1/spec?q=ship",
  "/issues/CORE-1/artifacts/notes-md?q=ship#b-ship-it",
  "/projects/CORE/documents/handbook-md?q=ship#b-ship-it",
  "/agents/session-1/live",
  "/credentials/machine",
];
