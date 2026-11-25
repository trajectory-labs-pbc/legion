import { useIssuePageChoice } from "@upstream-dispatch/features/issue-page/choice";
import type { MarginDrawer } from "@upstream-dispatch/features/issue-page/margin-slot";
import {
  COMPACT_VIEWPORT_QUERY,
  MD_VIEWPORT_QUERY,
  READING_PANE_QUERY,
  useMediaQuery,
} from "@upstream-dispatch/features/shell/useDialog";
import { useKeyboardFit } from "@upstream-dispatch/features/shell/useKeyboardFit";
import { type RefObject, useRef } from "react";
import { useAddress } from "@/navigation/hooks";
import { useCurrentPage } from "@/navigation/route-tree";
import { useDetailsDrawer } from "./use-details-drawer";
import { pageIdentityOf, useFocusMainOnPageChange } from "./use-focus-main";
import { type ShellPreferences, useShellPreferences } from "./use-shell-preferences";

/** The frame the current page gets on this viewport, with the reader's choices. */
export interface ShellLayout {
  pathname: string;
  preferences: ShellPreferences;
  /** A narrow viewport: a top bar, and the navigation in a drawer. */
  compact: boolean;
  /** The issue frame's icon rail fits beside the page. */
  railFits: boolean;
  /** The outline issue page frames itself. */
  issueFrame: boolean;
  /** The navigation is a drawer, not a sidebar. */
  inDrawer: boolean;
  fillsViewport: boolean;
  hasMargin: boolean;
  onInbox: boolean;
  project: string | undefined;
  liveView: string | undefined;
  /** The issue frame's Details drawer. */
  detailsDrawer: MarginDrawer | undefined;
  mainRef: RefObject<HTMLElement | null>;
}

/**
 * The current page's layout on this viewport. It also fits main to the on-screen keyboard and
 * moves focus to main when another page opens.
 */
export function useShellLayout(): ShellLayout {
  const { pathname } = useAddress();
  const layout = useCurrentPage()?.layout ?? {};
  const preferences = useShellPreferences();
  const [issuePageChoice] = useIssuePageChoice();
  const issueFrame = issuePageChoice === "outline" && layout.outlineFrame === true;
  const railFits = useMediaQuery(MD_VIEWPORT_QUERY);
  const compact = useMediaQuery(COMPACT_VIEWPORT_QUERY);
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
    railFits,
    issueFrame,
    inDrawer: compact || issueFrame,
    fillsViewport,
    hasMargin: layout.margin === true,
    onInbox: layout.inbox === true,
    project: layout.project,
    liveView: layout.liveView,
    detailsDrawer,
    mainRef,
  };
}
