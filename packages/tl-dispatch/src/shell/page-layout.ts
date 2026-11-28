import { useCurrentRoute as useRoute } from "@/navigation/route-tree";

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

/** The page and route the address opens, with the shell's frame options. */
export const useCurrentRoute = () => useRoute<PageLayout>();
