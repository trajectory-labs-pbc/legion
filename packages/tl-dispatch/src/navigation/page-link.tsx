import {
  type ComponentProps,
  type FocusEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { Link, Navigate } from "react-router-dom";
import { usePrefetchClient } from "@/data/prefetch";

import { type PageSearch, type Prefetch, pageHref, type RoutePath } from "./page-route";
import { fillPath, isParamsOf, type ParamsProp } from "./path";
import { useRouteTree } from "./route-tree";

/** How long the pointer rests on a link before its page's reads start. */
export const PREFETCH_INTENT_MS = 100;

interface PrefetchIntent {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

/**
 * Starts a page's reads while the reader shows intent: the pointer rests, or focus arrives.
 * The pointer leaving and losing focus only stop the wait. A read that started runs to its
 * answer: upstream's reads ignore the abort signal, so a cancel would only discard it.
 */
function usePrefetchIntent(reads: (() => readonly Prefetch[]) | undefined): PrefetchIntent {
  const client = usePrefetchClient();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(reads);
  useLayoutEffect(() => {
    latest.current = reads;
  });
  const stopWaiting = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };
  const start = () => {
    stopWaiting();
    for (const prefetch of latest.current?.() ?? []) void prefetch.start(client);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    onPointerEnter: () => {
      if (latest.current === undefined || timer.current !== undefined) return;
      timer.current = setTimeout(start, PREFETCH_INTENT_MS);
    },
    onPointerLeave: stopWaiting,
    onFocus: start,
    onBlur: stopWaiting,
  };
}

type PageLinkProps<Path extends string, Search extends string> = Omit<ComponentProps<"a">, "href"> &
  ParamsProp<Path> & {
    page: RoutePath<Path, Search>;
    search?: PageSearch<Search>;
    replace?: boolean;
  };

/** The first reads of the route the router opens at `pathname`, or none when it declares none. */
function useReadsAt(pathname: string): (() => readonly Prefetch[]) | undefined {
  const tree = useRouteTree();
  return useMemo(() => {
    const found = tree.pageAt(pathname);
    const prefetch = found?.route.prefetch;
    if (found === undefined || prefetch === undefined) return undefined;
    const { route, params } = found;
    return () => (isParamsOf(route.path, params) ? prefetch.call(route, params) : []);
  }, [tree, pathname]);
}

/** A link to a page, typed from its route, which starts the reads of its route on intent. */
export function PageLink<Path extends string, Search extends string>({
  page,
  params,
  search,
  replace,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...rest
}: PageLinkProps<Path, Search>) {
  const intent = usePrefetchIntent(useReadsAt(fillPath(page.path, params ?? {})));
  return (
    <Link
      {...rest}
      onBlur={(event: FocusEvent<HTMLAnchorElement>) => {
        onBlur?.(event);
        intent.onBlur();
      }}
      onFocus={(event: FocusEvent<HTMLAnchorElement>) => {
        onFocus?.(event);
        intent.onFocus();
      }}
      onPointerEnter={(event: PointerEvent<HTMLAnchorElement>) => {
        onPointerEnter?.(event);
        intent.onPointerEnter();
      }}
      onPointerLeave={(event: PointerEvent<HTMLAnchorElement>) => {
        onPointerLeave?.(event);
        intent.onPointerLeave();
      }}
      replace={replace}
      to={pageHref(page, params, search)}
    />
  );
}

/** Replaces the address with the page's, as a route's element. */
export function Redirect<Path extends string, Search extends string>({
  page,
  params,
  search,
}: ParamsProp<Path> & { page: RoutePath<Path, Search>; search?: PageSearch<Search> }) {
  return <Navigate replace to={pageHref(page, params, search)} />;
}
