import { type ReactNode, type RefObject, useRef } from "react";
import { PageFallback } from "@/loading/page-skeleton";
import { useAddress } from "@/navigation/hooks";
import type { MarginDrawer } from "@/upstream/shell";
import {
  MD_VIEWPORT_QUERY,
  READING_PANE_QUERY,
  COMPACT_VIEWPORT_QUERY as UNDER_1280_QUERY,
  useIssuePageChoice,
  useKeyboardFit,
  useMediaQuery,
} from "@/upstream/shell";
import { IssueFrameFallback, IssuePageFallback } from "./page-fallbacks";
import { useCurrentRoute } from "./page-layout";
import { useDetailsDrawer } from "./use-details-drawer";
import { pageIdentityOf, useFocusMainOnPageChange } from "./use-focus-main";
import { type ShellPreferences, useShellPreferences } from "./use-shell-preferences";

/** The frame the current page gets on this viewport, with the reader's choices. */
export interface ShellLayout {
  pathname: string;
  preferences: ShellPreferences;
  /** Below 768 px: a top bar, the navigation in a drawer, and no room for the issue frame's rail. */
  compact: boolean;
  /** 1280 px and wider: the margin is a column beside main, as upstream draws it. */
  marginBeside: boolean;
  /** The outline issue page frames itself. */
  issueFrame: boolean;
  /** What main shows while the page's code loads. */
  pageFallback: () => ReactNode;
  /** The navigation is a drawer, not a sidebar. */
  inDrawer: boolean;
  fillsViewport: boolean;
  flush: boolean;
  hasMargin: boolean;
  onInbox: boolean;
  project: string | undefined;
  liveView: string | undefined;
  /** The issue frame's Details drawer. */
  detailsDrawer: MarginDrawer | undefined;
  mainRef: RefObject<HTMLElement | null>;
}

/**
 * What main shows while a page's code loads: the issue frame's outline, an issue page's tabs, or,
 * on any other page, a skeleton with no issue tabs. Upstream shows an issue page's tabs on every
 * page that is not the frame.
 */
export function pageFallbackOf(issueFrame: boolean, issue: string | undefined): () => ReactNode {
  if (issueFrame) return IssueFrameFallback;
  return issue === undefined ? PageFallback : IssuePageFallback;
}

/**
 * The current page's layout on this viewport. It also fits main to the on-screen keyboard and
 * moves focus to main when another page opens.
 */
export function useShellLayout(): ShellLayout {
  const { pathname } = useAddress();
  const layout = useCurrentRoute()?.layout ?? {};
  const preferences = useShellPreferences();
  const [issuePageChoice] = useIssuePageChoice();
  const issueFrame = issuePageChoice === "outline" && layout.outlineFrame === true;
  const compact = !useMediaQuery(MD_VIEWPORT_QUERY);
  const marginBeside = !useMediaQuery(UNDER_1280_QUERY);
  const readingPaneShown = useMediaQuery(READING_PANE_QUERY);
  const detailsDrawer = useDetailsDrawer(issueFrame, layout.issue);
  const fillsViewport =
    layout.fillsViewport === true || (layout.fillsViewport === "reading-pane" && readingPaneShown);
  const mainRef = useRef<HTMLElement | null>(null);
  useKeyboardFit(mainRef, fillsViewport);
  useFocusMainOnPageChange(mainRef, pageIdentityOf(layout, pathname));
  return {
    pathname,
    preferences,
    compact,
    marginBeside,
    issueFrame,
    pageFallback: pageFallbackOf(issueFrame, layout.issue),
    inDrawer: compact || issueFrame,
    fillsViewport,
    flush: layout.flush === true,
    hasMargin: layout.margin === true,
    onInbox: layout.inbox === true,
    project: layout.project,
    liveView: layout.liveView,
    detailsDrawer,
    mainRef,
  };
}
