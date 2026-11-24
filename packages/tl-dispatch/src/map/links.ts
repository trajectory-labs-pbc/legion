import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { matchRoutes } from "react-router-dom";

import { type PageEntry, packageRoot, type RouteEntry, readPages, routeMapFiles } from "./source";

export const envoyRoot = resolve(packageRoot, "../envoy");

const ASK = "22222222-2222-4222-8222-222222222222";
const COMMENT = "11111111-1111-4111-8111-111111111111";
const MESSAGE = "33333333-3333-4333-8333-333333333333";

/** The Go functions in packages/envoy that write a dashboard path, with paths of each shape. */
export const GO_HREF_WRITERS: readonly { file: string; func: string; hrefs: readonly string[] }[] =
  [
    {
      file: "internal/dispatch/api/search.go",
      func: "searchHref",
      hrefs: [
        "/issues/CORE-1",
        "/issues/CORE-1/spec?q=ship",
        "/issues/CORE-1/artifacts/notes-md?q=ship#b-ship-it",
        "/projects/CORE/documents/handbook-md?q=ship#b-ship-it",
        `/issues/CORE-1/comments/${COMMENT}`,
        `/issues/CORE-1/spec?comment=${COMMENT}`,
        `/issues/CORE-1/asks/${ASK}`,
        "/issues/CORE-1/spec#b-ship-it",
        `/projects/CORE/documents/handbook-md?ask=${ASK}`,
        `/issues/CORE-1/messages/${MESSAGE}`,
      ],
    },
    {
      file: "internal/dispatch/api/search.go",
      func: "issueDocumentHref",
      hrefs: ["/issues/CORE-1/spec", "/issues/CORE-1/artifacts/notes-md"],
    },
    {
      file: "internal/dispatch/api/duplicates.go",
      func: "scanDuplicateCandidates",
      hrefs: ["/issues/CORE-2"],
    },
    {
      file: "internal/dispatch/api/replies_agent.go",
      func: "readMyAgentRows",
      hrefs: ["/agents/session-1/live"],
    },
    {
      file: "internal/dispatch/sessionanswers/sessionanswers.go",
      func: "place",
      hrefs: [
        `/issues/CORE-1/asks/${ASK}`,
        `/issues/CORE-1/comments/${COMMENT}`,
        `/issues/CORE-1/messages/${MESSAGE}`,
        `/projects/CORE/documents/handbook-md?ask=${ASK}`,
        `/projects/CORE/documents/handbook-md?comment=${COMMENT}`,
        "/agents/session-1/live",
      ],
    },
    {
      file: "cmd/cipher/machine.go",
      func: "cmdMachineLogin",
      hrefs: ["/credentials/machine"],
    },
  ];

/** Go files that name a dashboard path and write none: the router's check, a test stand's own paths. */
export const GO_HREF_READERS: readonly string[] = [
  "internal/dispatch/routes/router.go",
  "cmd/dev-proxy-stands/main.go",
];

const PAGE_PATH =
  /"(%s)?\/(issues|projects|agents|machines|priorities|credentials|settings|delivery|pipeline|answers|replies|people)(\/|"|\?|%)/;

/** Every Go source file of packages/envoy, tests aside, that holds a dashboard path literal. */
export function goFilesNamingPagePaths(root = envoyRoot): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && entry.name !== "vendor") walk(path);
      } else if (entry.name.endsWith(".go") && !entry.name.endsWith("_test.go")) {
        const lines = readFileSync(path, "utf8").split("\n");
        if (lines.some((line) => PAGE_PATH.test(line) && !line.includes("github.com/"))) {
          found.push(relative(root, path));
        }
      }
    }
  };
  walk(root);
  return found.sort();
}

export interface ForkRoute extends RouteEntry {
  page: string;
  server: PageEntry["server"];
}

/** The routes of every page the route map lists. */
export function forkRoutes(): ForkRoute[] {
  const listed = new Set(routeMapFiles());
  return readPages()
    .filter((page) => listed.has(page.file))
    .flatMap((page) =>
      page.routes.map((route) => ({ ...route, page: page.id, server: page.server }))
    );
}

/** The route an href opens: the one react-router ranks first. */
export function resolveHref<T extends RouteEntry>(
  routes: readonly T[],
  href: string
): T | undefined {
  const url = new URL(href, "https://dispatch.invalid");
  const matches = matchRoutes(
    routes.map((route, index) => ({ path: route.path, id: String(index) })),
    url.pathname
  );
  const leaf = matches?.at(-1);
  return leaf ? routes[Number(leaf.route.id)] : undefined;
}

const key = (route: RouteEntry) => `${route.path} -> ${route.element}`;

/**
 * Upstream routes the fork does not serve, and fork routes upstream has not got. A fork-built
 * page may draw another element; an upstream page must draw upstream's.
 */
export function routeParity(
  upstream: readonly RouteEntry[],
  fork: readonly ForkRoute[]
): { missing: string[]; extra: string[] } {
  const forkKeys = new Set(
    fork.map((route) => (route.server === "fork" ? `${route.path} -> *` : key(route)))
  );
  const upstreamPaths = new Set(upstream.map((route) => route.path));
  const missing = upstream
    .filter((route) => !forkKeys.has(key(route)) && !forkKeys.has(`${route.path} -> *`))
    .map(key);
  const upstreamKeys = new Set(upstream.map(key));
  const extra = fork
    .filter((route) =>
      route.server === "fork" ? !upstreamPaths.has(route.path) : !upstreamKeys.has(key(route))
    )
    .map(key);
  return { missing, extra };
}

/** One path each route of `routes` serves, with its parameters filled. */
export function samplePaths(routes: readonly RouteEntry[]): string[] {
  return routes.map((route) =>
    route.path === "*"
      ? "/no-such-page"
      : route.path.replace(/:[A-Za-z]+/g, "x1").replace(/\*$/, "spec")
  );
}
