import type { PageAddress, PageRoute } from "@/navigation/page-route";
import type { PageLayout } from "@/shell/page-layout";
import {
  liveViewSessionOf,
  parseIssuePath,
  routeFillsViewport,
  routeHasMargin,
  routeIsInbox,
  routeProjectOf,
} from "@/upstream/routes";

/** Upstream's rules for the frame an address gets: a page upstream draws takes them. */
export function upstreamLayout({ pathname, search }: PageAddress): PageLayout {
  const inbox = routeIsInbox(pathname);
  return {
    fillsViewport: routeFillsViewport(pathname) ? true : inbox && "reading-pane",
    margin: routeHasMargin(pathname, search),
    outlineFrame: parseIssuePath(pathname, search) !== undefined,
    issue: parseIssuePath(pathname)?.key,
    project: routeProjectOf(pathname),
    inbox,
    liveView: liveViewSessionOf(pathname),
  };
}

/** One page of the app: its routes, which app's code draws it, and the upstream view files it maps. */
export interface Page {
  id: string;
  server: "upstream" | "fork";
  /** Named, so a link names the route it opens and is typed from its path. */
  routes: Readonly<Record<string, PageRoute<string, string, PageLayout>>>;
  /** Files or globs under upstream's `web/src`; a page this app serves names files. */
  views: readonly string[];
}
