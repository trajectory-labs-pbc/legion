import { cn } from "@legion/ui/lib/utils";
import { Suspense } from "react";
import { PageRoutes } from "@/navigation/route-tree";
import { ForkView } from "@/upstream/mark";
import {
  DOCUMENT_SCROLL_ATTRIBUTE,
  ErrorBoundary,
  NO_HOVER_PREVIEW_ATTRIBUTE,
} from "@/upstream/shell";
import { MountedLiveViews } from "@/upstream/widgets/live-views";

import type { ShellLayout } from "./use-shell-layout";

/** Main: the page outlet, and the live views that outlive the route that opened them. */
export function MainRegion({ shell }: { shell: ShellLayout }) {
  const {
    fillsViewport,
    flush,
    issueFrame,
    liveView,
    mainRef,
    pageFallback: Fallback,
    pathname,
  } = shell;
  const { marginHidden, sidebarHidden } = shell.preferences;
  // The page takes the width of the frame: no sidebar and no margin column beside it.
  const fullWidth = issueFrame || (sidebarHidden && !(shell.hasMargin && !marginHidden));
  return (
    <main
      className={
        issueFrame
          ? "min-h-dvh min-w-0 flex-1 bg-background outline-none md:pl-14"
          : cn(
              "min-w-0 flex-1 outline-none",
              flush ? undefined : "p-6",
              fillsViewport ? "flex min-h-0 flex-col" : flush ? "pb-32 xl:pb-0" : "pb-32 xl:pb-6"
            )
      }
      data-shell-layout={fullWidth ? "full-width" : "standard"}
      {...(issueFrame ? { [NO_HOVER_PREVIEW_ATTRIBUTE]: "" } : {})}
      {...(!issueFrame && !fillsViewport ? { [DOCUMENT_SCROLL_ATTRIBUTE]: "" } : {})}
      data-testid="main-content"
      id="main-content"
      ref={mainRef}
      tabIndex={-1}
    >
      <ErrorBoundary region="this page" resetKey={pathname}>
        <ForkView>
          <Suspense fallback={<Fallback />}>
            <PageRoutes />
          </Suspense>
        </ForkView>
      </ErrorBoundary>
      <MountedLiveViews front={liveView ?? null} />
    </main>
  );
}
