import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { MountedLiveViews } from "@upstream-dispatch/features/agent-view/MountedLiveViews";
import { InboxDrawer } from "@upstream-dispatch/features/inbox/InboxDrawer";
import { useInboxCount } from "@upstream-dispatch/features/inbox/useInboxCount";
import { CreateIssueDialog } from "@upstream-dispatch/features/issue/CreateIssueDialog";
import { IconRail } from "@upstream-dispatch/features/issue-page/IconRail";
import {
  type MarginDrawer,
  MarginSlotProvider,
} from "@upstream-dispatch/features/issue-page/margin-slot";
import { ReferenceNamesProvider } from "@upstream-dispatch/features/issue-page/reference-names";
import {
  type ShellNavigation,
  ShellNavigationContext,
} from "@upstream-dispatch/features/issue-page/shell-navigation";
import { ShortcutHelpOpener } from "@upstream-dispatch/features/issue-page/shortcut-help-opener";
import { MarginColumn } from "@upstream-dispatch/features/margin/MarginColumn";
import { MarginProvider } from "@upstream-dispatch/features/margin/margin-context";
import { RefPreviewHost } from "@upstream-dispatch/features/refs/RefPreview";
import { NO_HOVER_PREVIEW_ATTRIBUTE } from "@upstream-dispatch/features/refs/ref-preview-card";
import { SearchPalette } from "@upstream-dispatch/features/search/SearchPalette";
import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import { type ReactNode, type RefObject, Suspense } from "react";

import { CommandButton } from "@/commands/command-button";
import { ShortcutsSheet } from "@/commands/shortcuts-sheet";
import { PageRoutes } from "@/navigation/route-tree";
import { cn } from "@/ui/lib/utils";
import { IssueFrameFallback, IssuePageFallback } from "./states";
import { mainLayoutClass, type ShellLayout } from "./use-shell-layout";
import type { ShellOverlays } from "./use-shell-overlays";

const SIDEBAR = "border-sidebar-border bg-sidebar text-sidebar-foreground";

/** The contexts upstream's pages read from the shell. */
export function ShellProviders({
  children,
  drawer,
  navigation,
  openShortcuts,
}: {
  children: ReactNode;
  drawer: MarginDrawer | undefined;
  navigation: ShellNavigation | undefined;
  openShortcuts: () => void;
}) {
  return (
    <MarginProvider>
      <ReferenceNamesProvider>
        <MarginSlotProvider drawer={drawer} drawsSlot={drawer !== undefined}>
          <ShellNavigationContext.Provider value={navigation}>
            <ShortcutHelpOpener.Provider value={openShortcuts}>
              {children}
            </ShortcutHelpOpener.Provider>
          </ShellNavigationContext.Provider>
        </MarginSlotProvider>
      </ReferenceNamesProvider>
    </MarginProvider>
  );
}

/** The frame's box, which a page that fills the viewport makes exactly the viewport. */
export function ShellFrame({
  children,
  fillsViewport,
}: {
  children: ReactNode;
  fillsViewport: boolean;
}) {
  return (
    <div
      className={cn(
        fillsViewport
          ? "flex h-screen flex-col supports-[height:100dvh]:h-dvh xl:flex-row"
          : "xl:flex",
        "text-foreground"
      )}
      data-testid="app-shell"
    >
      <a
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-sidebar focus:px-4 focus:py-2 focus:text-sidebar-foreground"
        href="#main-content"
      >
        Skip to content
      </a>
      {children}
    </div>
  );
}

/** The navigation as a modal drawer over a scrim. */
export function NavigationDrawer({
  children,
  containerRef,
  onClose,
}: {
  children: ReactNode;
  containerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-20 bg-scrim/50" onClick={onClose} />
      <aside
        aria-label="Navigation"
        aria-modal="true"
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto border-r p-5",
          SIDEBAR
        )}
        ref={containerRef}
        role="dialog"
      >
        {children}
      </aside>
    </>
  );
}

/** The issue frame's icon rail, the folded sidebar's rail, or the sidebar; none in a drawer. */
export function SidebarRegion({
  children,
  overlays,
  shell,
  user,
}: {
  children: ReactNode;
  overlays: ShellOverlays;
  shell: ShellLayout;
  user: AuthenticatedUser;
}) {
  const inboxCount = useInboxCount();
  if (shell.issueFrame && shell.railFits) {
    return (
      <IconRail
        inboxCount={inboxCount}
        navigationOpen={overlays.navigationOpen}
        onOpenNavigation={overlays.openNavigation}
        project={shell.project}
        user={user}
      />
    );
  }
  if (shell.inDrawer) return null;
  return shell.preferences.sidebarHidden ? (
    <aside
      aria-label="Collapsed sidebar"
      className={cn("fixed inset-y-0 left-0 z-10 flex w-14 justify-center border-r p-2", SIDEBAR)}
      data-testid="sidebar-rail"
    >
      <CommandButton commandId="global.toggle-sidebar" label="Show sidebar" size="icon" />
    </aside>
  ) : (
    <aside
      aria-label="Navigation"
      className={cn("relative order-1 w-72 border-r [overflow-anchor:none]", SIDEBAR)}
    >
      <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto p-4">{children}</div>
    </aside>
  );
}

/** Main: the page outlet, and the live views that outlive the route that opened them. */
export function MainRegion({ shell }: { shell: ShellLayout }) {
  const { issueFrame, fillsViewport, hasMargin, preferences, pathname } = shell;
  const marginColumnShown = hasMargin && !preferences.marginHidden;
  return (
    <main
      className={
        issueFrame
          ? "min-h-dvh min-w-0 flex-1 bg-background outline-none md:pl-14"
          : cn(
              "min-w-0 flex-1 p-6 outline-none xl:order-2",
              fillsViewport ? "flex min-h-0 flex-col" : "pb-32 xl:pb-6",
              mainLayoutClass({
                sidebarHidden: preferences.sidebarHidden,
                hasMargin,
                marginHidden: preferences.marginHidden,
              })
            )
      }
      data-shell-layout={
        issueFrame || (preferences.sidebarHidden && !marginColumnShown) ? "full-width" : "standard"
      }
      {...(issueFrame ? { [NO_HOVER_PREVIEW_ATTRIBUTE]: "" } : {})}
      data-testid="main-content"
      id="main-content"
      ref={shell.mainRef}
      tabIndex={-1}
    >
      <ErrorBoundary region="this page" resetKey={pathname}>
        <Suspense fallback={issueFrame ? <IssueFrameFallback /> : <IssuePageFallback />}>
          <PageRoutes />
        </Suspense>
      </ErrorBoundary>
      <MountedLiveViews front={shell.liveView ?? null} />
    </main>
  );
}

/** The margin column, which an upstream page fills. */
export function MarginRegion({ shell }: { shell: ShellLayout }) {
  const { preferences } = shell;
  return (
    <ErrorBoundary region="the margin" resetKey={shell.pathname}>
      <MarginColumn
        collapsed={preferences.marginHidden}
        onCollapsedChange={preferences.setMarginHidden}
        onWidthChange={preferences.setMarginWidth}
        width={preferences.marginWidth}
      />
    </ErrorBoundary>
  );
}

/** Search, the inbox drawer, the shortcuts sheet, a new issue and the reference previews. */
export function ShellDialogs({ overlays }: { overlays: ShellOverlays }) {
  const { shortcuts } = overlays;
  return (
    <>
      <SearchPalette onClose={overlays.closeSearch} open={overlays.searchOpen} />
      <InboxDrawer onClose={overlays.closeInboxDrawer} open={overlays.inboxDrawerOpen} />
      <ShortcutsSheet
        onOpenChange={shortcuts.setOpen}
        open={shortcuts.open}
        sections={shortcuts.sections}
      />
      {overlays.createOpen ? <CreateIssueDialog onClose={overlays.closeCreate} /> : null}
      <RefPreviewHost />
    </>
  );
}
