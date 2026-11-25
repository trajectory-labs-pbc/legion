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

/**
 * One address of a page: its path in navigation's grammar (`path.ts`), what it draws, its search
 * keys and its first reads.
 */
export interface PageRoute<Path extends string = string, Search extends string = string> {
  readonly path: Path;
  readonly element: ReactNode;
  readonly search?: readonly Search[];
  prefetch?(params: PathParams<Path>): readonly Prefetch[];
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
