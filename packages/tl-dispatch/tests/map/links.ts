import { firstMatch, routerPath } from "@/navigation/router-path";
import { type PageEntry, type RouteEntry, readPages, routeMapFiles } from "./source";

export interface ForkRoute extends RouteEntry {
  page: string;
  server: PageEntry["server"];
  linkForms?: PageEntry["linkForms"];
}

/** The routes of every page the route map lists. */
export function forkRoutes(pages: readonly PageEntry[] = readPages()): ForkRoute[] {
  const listed = new Set(routeMapFiles());
  return pages
    .filter((page) => listed.has(page.file))
    .flatMap((page) =>
      page.routes.map((route) => ({
        ...route,
        page: page.id,
        server: page.server,
        linkForms: page.linkForms,
      }))
    );
}

/** The route an href opens: the one the router ranks first. */
export function resolveHref<T extends RouteEntry>(
  routes: readonly T[],
  href: string
): T | undefined {
  const url = new URL(href, "https://dispatch.invalid");
  const index = firstMatch(
    routes.map((route) => routerPath(route.path)),
    url.pathname
  );
  return index === undefined ? undefined : routes[index];
}

/**
 * Routes this app writes with its own typed parts, by upstream's path: the element this app
 * writes, and upstream's element it stands for, as upstream writes it. A change to upstream's
 * element reports the route.
 */
export const OWN_ELEMENTS: Readonly<Record<string, { own: string; upstream: string }>> = {
  "/replies": {
    own: '<Redirect page={home}search={{type:"reply"}}/>',
    upstream: '<Navigate replace to={buildInboxPath({filters:{type:["reply"]}})}/>',
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

/** Each href that opens a page this app serves with a query key or fragment form the page does not read. */
export function linkFormProblems(fork: readonly ForkRoute[], hrefs: readonly string[]): string[] {
  const problems: string[] = [];
  for (const href of hrefs) {
    const route = resolveHref(fork, href);
    if (!route || route.server !== "fork") continue;
    const { query, fragment } = linkForm(href);
    const reads = route.linkForms ?? { query: [], fragments: [] };
    for (const name of query.filter((name) => !reads.query.includes(name))) {
      problems.push(`${href}: page ${route.page} does not read ?${name}= (its linkForms.query)`);
    }
    if (fragment !== undefined && !reads.fragments.includes(fragment)) {
      problems.push(
        `${href}: page ${route.page} does not read #${fragment} (its linkForms.fragments)`
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
