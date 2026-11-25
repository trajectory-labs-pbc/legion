import { cn } from "@legion/ui/lib/utils";
import { MountedLiveViews } from "@upstream-dispatch/features/agent-view/MountedLiveViews";
import { NO_HOVER_PREVIEW_ATTRIBUTE } from "@upstream-dispatch/features/refs/ref-preview-card";
import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import { type RefObject, Suspense } from "react";
import { PageRoutes } from "@/pages/index";
import { IssueFrameFallback, IssuePageFallback } from "./page-fallbacks";

/** Main: the page outlet, and the live views that outlive the route that opened them. */
export function MainRegion({
  fillsViewport,
  hasMargin,
  issueFrame,
  liveView,
  mainRef,
  marginHidden,
  pathname,
  sidebarHidden,
}: {
  fillsViewport: boolean;
  hasMargin: boolean;
  /** The outline issue page frames itself. */
  issueFrame: boolean;
  /** The session whose live view is in front. */
  liveView: string | undefined;
  mainRef: RefObject<HTMLElement | null>;
  marginHidden: boolean;
  pathname: string;
  sidebarHidden: boolean;
}) {
  const marginColumnShown = hasMargin && !marginHidden;
  return (
    <main
      className={
        issueFrame
          ? "min-h-dvh min-w-0 flex-1 bg-background outline-none md:pl-14"
          : cn(
              "min-w-0 flex-1 p-6 outline-none xl:order-2",
              fillsViewport ? "flex min-h-0 flex-col" : "pb-32 xl:pb-6",
              mainLayoutClass({ sidebarHidden, hasMargin, marginHidden })
            )
      }
      data-shell-layout={
        issueFrame || (sidebarHidden && !marginColumnShown) ? "full-width" : "standard"
      }
      {...(issueFrame ? { [NO_HOVER_PREVIEW_ATTRIBUTE]: "" } : {})}
      data-testid="main-content"
      id="main-content"
      ref={mainRef}
      tabIndex={-1}
    >
      <ErrorBoundary region="this page" resetKey={pathname}>
        <Suspense fallback={issueFrame ? <IssueFrameFallback /> : <IssuePageFallback />}>
          <PageRoutes />
        </Suspense>
      </ErrorBoundary>
      <MountedLiveViews front={liveView ?? null} />
    </main>
  );
}

/** The wide layout's room for the folded sidebar and margin rails beside main. */
function mainLayoutClass({
  sidebarHidden,
  hasMargin,
  marginHidden,
}: {
  sidebarHidden: boolean;
  hasMargin: boolean;
  marginHidden: boolean;
}): string {
  const marginRail = hasMargin && marginHidden;
  if (sidebarHidden && marginRail) return "xl:w-full xl:pl-20 xl:pr-20";
  if (sidebarHidden && !hasMargin) return "xl:w-full xl:pl-20";
  if (sidebarHidden) return "xl:pl-20";
  return marginRail ? "xl:pr-20" : "";
}
