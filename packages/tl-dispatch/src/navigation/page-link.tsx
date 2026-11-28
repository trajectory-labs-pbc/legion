import {
  type ComponentProps,
  type FocusEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { Link, Navigate } from "react-router-dom";
import { usePrefetchClient } from "@/data/prefetch";

import { type PageRoute, type PageSearch, type Prefetch, pageHref } from "./page-route";
import { isParamsOf, type ParamsProp } from "./path";

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
    page: PageRoute<Path, Search>;
    search?: PageSearch<Search>;
    replace?: boolean;
  };

/** The page's first reads for these params, or none when it declares none. */
function readsOf<Path extends string>(
  page: PageRoute<Path, string>,
  params: Readonly<Record<string, string | undefined>> | undefined
): (() => readonly Prefetch[]) | undefined {
  const { prefetch } = page;
  if (prefetch === undefined) return undefined;
  return () => {
    const given = params ?? {};
    return isParamsOf(page.path, given) ? prefetch.call(page, given) : [];
  };
}

/** A link to a page, typed from its route, which starts the page's reads on intent. */
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
  const intent = usePrefetchIntent(readsOf(page, params));
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
}: ParamsProp<Path> & { page: PageRoute<Path, Search>; search?: PageSearch<Search> }) {
  return <Navigate replace to={pageHref(page, params, search)} />;
}
