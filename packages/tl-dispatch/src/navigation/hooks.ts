import { useMemo } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";

import { type PageRoute, type PageSearch, type PathParams, pageHref } from "./page-route";

export interface PageNavigateOptions<Search extends string> {
  search?: PageSearch<Search>;
  replace?: boolean;
}

export type PageNavigate = <Path extends string, Search extends string>(
  page: PageRoute<Path, Search>,
  params: PathParams<Path>,
  options?: PageNavigateOptions<Search>
) => void;

/** Moves to a page, typed from its route. */
export function usePageNavigate(): PageNavigate {
  const navigate = useNavigate();
  return useMemo<PageNavigate>(
    () =>
      (page, params, options = {}) =>
        navigate(pageHref(page, params, options.search), { replace: options.replace }),
    [navigate]
  );
}

/** The params of the page the address is on. Called on another page, it throws. */
export function usePageParams<Path extends string>(
  page: PageRoute<Path, string>
): PathParams<Path> {
  const match = useMatch(page.path);
  if (match === null) throw new Error(`usePageParams: the address is not on ${page.path}`);
  // The router's match has exactly the path's params.
  return match.params as PathParams<Path>;
}

/** The search keys the page reads, from the address. Called on another page, it throws. */
export function usePageSearch<Search extends string>(
  page: PageRoute<string, Search>
): PageSearch<Search> {
  const match = useMatch(page.path);
  const { search } = useLocation();
  const values = useMemo(() => {
    const query = new URLSearchParams(search);
    const values: Partial<Record<Search, string>> = {};
    for (const key of page.search ?? []) {
      const value = query.get(key);
      if (value !== null) values[key] = value;
    }
    return values;
  }, [page, search]);
  if (match === null) throw new Error(`usePageSearch: the address is not on ${page.path}`);
  return values;
}

/** The address as text, for upstream's helpers that read it. */
export function useAddress(): { pathname: string; search: string } {
  const { pathname, search } = useLocation();
  return useMemo(() => ({ pathname, search }), [pathname, search]);
}
