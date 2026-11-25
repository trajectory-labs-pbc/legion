import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import {
  type ComponentProps,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { Link, Navigate } from "react-router-dom";

import { addressOf, type PageRoute, type PageSearch, type Prefetch } from "./page-route";
import { isParamsOf, type ParamsProp } from "./path";

/** How long the pointer rests on a link before its page's reads start. */
export const PREFETCH_INTENT_MS = 100;

export interface PrefetchIntent {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onClick: () => void;
}

/**
 * Starts a page's reads while the reader shows intent: the pointer rests, or focus arrives.
 * The pointer leaving with no click stops the wait, and stops a read nothing else watches.
 * Losing focus and a click cancel nothing: after a click the shell moves focus to the page,
 * whose lazy code may not read yet.
 */
export function usePrefetchIntent(reads: (() => readonly Prefetch[]) | undefined): PrefetchIntent {
  const client = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const started = useRef<readonly QueryKey[]>([]);
  const clicked = useRef(false);
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
    started.current = (latest.current?.() ?? []).map((prefetch) => {
      void prefetch.start(client);
      return prefetch.queryKey;
    });
  };
  const leave = () => {
    stopWaiting();
    if (!clicked.current) {
      for (const queryKey of started.current) {
        const query = client.getQueryCache().find({ queryKey, exact: true });
        if (query?.state.fetchStatus === "fetching" && query.getObserversCount() === 0) {
          void client.cancelQueries({ queryKey, exact: true });
        }
      }
    }
    started.current = [];
  };
  // Unmounting only stops the wait: a click unmounts the link before its page's reads attach.
  useEffect(() => () => clearTimeout(timer.current), []);
  return {
    onPointerEnter: () => {
      // A visit starts unclicked; a click before the wait ends still keeps the read it starts.
      clicked.current = false;
      if (latest.current === undefined || timer.current !== undefined) return;
      timer.current = setTimeout(start, PREFETCH_INTENT_MS);
    },
    onPointerLeave: leave,
    onFocus: start,
    onBlur: stopWaiting,
    onClick: () => {
      clicked.current = true;
    },
  };
}

export type PageLinkProps<Path extends string, Search extends string> = Omit<
  ComponentProps<"a">,
  "href"
> &
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
  onClick,
  ...rest
}: PageLinkProps<Path, Search>) {
  const intent = usePrefetchIntent(readsOf(page, params));
  return (
    <Link
      {...rest}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        intent.onClick();
      }}
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
      to={addressOf(page, params, search)}
    />
  );
}

/** Replaces the address with the page's, as a route's element. */
export function Redirect<Path extends string, Search extends string>({
  page,
  params,
  search,
}: ParamsProp<Path> & { page: PageRoute<Path, Search>; search?: PageSearch<Search> }) {
  return <Navigate replace to={addressOf(page, params, search)} />;
}
