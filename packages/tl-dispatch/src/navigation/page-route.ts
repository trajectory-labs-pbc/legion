import type { FetchQueryOptions, QueryClient, QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { fillPath, type PathParams } from "./path";

/** The search keys a page reads, each optional. */
export type PageSearch<Search extends string> = { readonly [Key in Search]?: string };

/** A read a page makes first, which a link may start before the page opens. */
export interface Prefetch {
  queryKey: QueryKey;
  start(client: QueryClient): Promise<void>;
}

export function prefetchOf<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  options: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): Prefetch {
  return { queryKey: options.queryKey, start: (client) => client.prefetchQuery(options) };
}

/** How the shell frames a page. Every field is off when left out. */
export interface PageLayout {
  /**
   * The page owns its scroller and gets exactly the viewport; `"reading-pane"`: only while the
   * Inbox's reading pane shows.
   */
  readonly fillsViewport?: boolean | "reading-pane";
  /** The page has the margin column. */
  readonly margin?: boolean;
  /** Drawn as the outline issue page, the page frames itself: the navigation goes into a drawer. */
  readonly outlineFrame?: boolean;
  /** The issue the page shows, whose Details drawer it holds in its own frame. */
  readonly issue?: string;
  /** The project the page belongs to. */
  readonly project?: string;
  /** The page is the Inbox, so the inbox drawer has nothing to add. */
  readonly inbox?: boolean;
  /** The session whose live view the page brings to the front. */
  readonly liveView?: string;
}

/** The address a route is open at, as text: upstream's parsers read it. */
export interface PageAddress {
  readonly pathname: string;
  readonly search: string;
}

/**
 * One address of a page: its path in navigation's grammar (`path.ts`), what it draws, its search
 * keys, its first reads and its layout.
 */
export interface PageRoute<Path extends string = string, Search extends string = string> {
  readonly path: Path;
  readonly element: ReactNode;
  readonly search?: readonly Search[];
  prefetch?(params: PathParams<Path>): readonly Prefetch[];
  readonly layout?: PageLayout | ((address: PageAddress) => PageLayout);
}

/** The layout a route declares for the address. */
export function layoutAt(route: PageRoute, address: PageAddress): PageLayout {
  return typeof route.layout === "function" ? route.layout(address) : (route.layout ?? {});
}

/** Keeps the path and the search keys as literals, so links to the route are typed. */
export function pageRoute<const Path extends string, const Search extends string = never>(
  route: PageRoute<Path, Search>
): PageRoute<Path, Search> {
  return route;
}

/**
 * The address of a route: its params filled, encoded, and its search keys in the route's order.
 * The keys are typed from the route; a param its path binds and the call leaves out throws.
 */
export function pageHref<Path extends string, Search extends string>(
  page: PageRoute<Path, Search>,
  params?: PathParams<Path>,
  search?: PageSearch<Search>
): string {
  const path = fillPath(page.path, params ?? {});
  const query = new URLSearchParams();
  for (const key of page.search ?? []) {
    const value = search?.[key];
    if (value !== undefined) query.set(key, value);
  }
  const text = query.toString();
  return text === "" ? path : `${path}?${text}`;
}
