import type { PageAddress, PageRoute } from "@/navigation/page-route";
import {
  liveViewSessionOf,
  parseIssuePath,
  routeFillsViewport,
  routeHasMargin,
  routeIsInbox,
  routeProjectOf,
} from "@/upstream/routes";

/** How the shell frames a page. Every field is off when left out. */
export interface PageLayout {
  /**
   * The page owns its scroller and gets exactly the viewport; `"reading-pane"`: only while the
   * Inbox's reading pane shows.
   */
  readonly fillsViewport?: boolean | "reading-pane";
  /** The page has the margin column. */
  readonly margin?: boolean;
  /**
   * The address can take the outline issue page's frame, where the page frames itself and the
   * navigation goes into a drawer. The shell applies it only when the reader chose the outline page.
   */
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
