import {
  liveViewSessionOf,
  parseIssuePath,
  routeFillsViewport,
  routeHasMargin,
  routeIsInbox,
  routeProjectOf,
} from "@/upstream/routes";

import type { PageAddress, PageRoute } from "./page-route";

/** Upstream's rules for the frame an address gets: a page upstream draws takes them. */
export function upstreamLayout({ pathname, search }: PageAddress) {
  const inbox = routeIsInbox(pathname);
  return {
    fillsViewport: routeFillsViewport(pathname) ? true : inbox && ("reading-pane" as const),
    margin: routeHasMargin(pathname, search),
    outlineFrame: parseIssuePath(pathname, search) !== undefined,
    issue: parseIssuePath(pathname)?.key,
    project: routeProjectOf(pathname),
    inbox,
    liveView: liveViewSessionOf(pathname),
  };
}

/**
 * One page of the app: its routes, which app's code draws it, and the upstream view files it maps.
 * `Layout` is the app's frame options, which navigation carries and reads none of.
 */
export interface Page<Layout = unknown> {
  id: string;
  server: "upstream" | "fork";
  /** Named, so a link names the route it opens and is typed from its path. */
  routes: Readonly<Record<string, PageRoute<string, string, Layout>>>;
  /** Files or globs under upstream's `web/src`; a page this app serves names files. */
  views: readonly string[];
}
