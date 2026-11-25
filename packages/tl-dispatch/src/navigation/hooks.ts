import { useMemo } from "react";
import { useLocation, useMatch, useNavigate } from "react-router-dom";

import { type PageRoute, type PageSearch, pageHref } from "./page-route";
import { isParamsOf, type ParamsProp, type PathParamName, type PathParams } from "./path";
import { routerPath } from "./router-path";

/** Where a move goes on a page: its params, required where its path binds any, and search. */
type PageTarget<Path extends string, Search extends string> = ParamsProp<Path> & {
  search?: PageSearch<Search>;
  replace?: boolean;
};

type PageNavigate = <Path extends string, Search extends string>(
  page: PageRoute<Path, Search>,
  ...target: [PathParamName<Path>] extends [never]
    ? [target?: PageTarget<Path, Search>]
    : [target: PageTarget<Path, Search>]
) => void;

/** Moves to a page, typed from its route. */
export function usePageNavigate(): PageNavigate {
  const navigate = useNavigate();
  return useMemo<PageNavigate>(
    () =>
      (page, ...[target]) =>
        navigate(pageHref(page, target?.params, target?.search), { replace: target?.replace }),
    [navigate]
  );
}

/** The params of the page the address is on. Called on another page, it throws. */
export function usePageParams<Path extends string>(
  page: PageRoute<Path, string>
): PathParams<Path> {
  const match = useMatch(routerPath(page.path));
  if (match === null || !isParamsOf(page.path, match.params)) {
    throw new Error(`usePageParams: the address is not on ${page.path}`);
  }
  return match.params;
}

/** The search keys the page reads, from the address. Called on another page, it throws. */
export function usePageSearch<Search extends string>(
  page: PageRoute<string, Search>
): PageSearch<Search> {
  const match = useMatch(routerPath(page.path));
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
