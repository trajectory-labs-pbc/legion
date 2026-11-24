import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { MountedLiveViews } from "@upstream-dispatch/features/agent-view/MountedLiveViews";
import { useAgentPinWrite } from "@upstream-dispatch/features/agents/pins";
import { InboxDrawer } from "@upstream-dispatch/features/inbox/InboxDrawer";
import { useInboxCount } from "@upstream-dispatch/features/inbox/useInboxCount";
import { CreateIssueDialog } from "@upstream-dispatch/features/issue/CreateIssueDialog";
import { useIssuePageChoice } from "@upstream-dispatch/features/issue-page/choice";
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
import {
  liveViewSessionOf,
  parseIssuePath,
  routeFillsViewport,
  routeHasMargin,
  routeIsInbox,
  routeProjectOf,
} from "@upstream-dispatch/features/refs/routes";
import { useRecordRecents } from "@upstream-dispatch/features/search/recents";
import { SearchPalette } from "@upstream-dispatch/features/search/SearchPalette";
import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import {
  COMPACT_VIEWPORT_QUERY,
  MD_VIEWPORT_QUERY,
  READING_PANE_QUERY,
  useDialog,
  useMediaQuery,
} from "@upstream-dispatch/features/shell/useDialog";
import { useKeyboardFit } from "@upstream-dispatch/features/shell/useKeyboardFit";
import { type ReactNode, Suspense, useMemo, useRef, useState } from "react";

import { CommandButton } from "@/commands/command-button";
import { ShortcutsSheet, useShortcutsSheet } from "@/commands/shortcuts-sheet";
import { useAddress, usePageNavigate } from "@/navigation/hooks";
import { PageRoutes } from "@/navigation/route-tree";
import { project } from "@/pages/project";
import { cn } from "@/ui/lib/utils";
import { CompactHeader } from "./compact-header";
import { type GlobalActions, useGlobalCommands } from "./global-commands";
import { NAV_PAGES } from "./nav-pages";
import { NavigationPanel } from "./navigation-panel";
import { IssueFrameFallback, IssuePageFallback } from "./states";
import { StatusCorner } from "./status-corner";
import { useLiveViewPins, usePinsMigration } from "./use-agent-pins";
import { useDetailsDrawer } from "./use-details-drawer";
import { useFocusMainOnPageChange } from "./use-focus-main";
import { mainLayoutClass, useShellPreferences } from "./use-shell-layout";
import { useSignOut } from "./use-sign-out";

const SIDEBAR = "border-sidebar-border bg-sidebar text-sidebar-foreground";

function ShellProviders({
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

/** The frame around every page: its providers, the layout's regions and the page outlet. */
export function AppShell({ user }: { user: AuthenticatedUser }) {
  const { pathname, search } = useAddress();
  const navigate = usePageNavigate();
  const preferences = useShellPreferences();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [inboxDrawerOpen, setInboxDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const shortcuts = useShortcutsSheet();
  useRecordRecents();
  useLiveViewPins();
  usePinsMigration(user.login, useAgentPinWrite());
  const signOut = useSignOut(user.login);

  const [issuePageChoice] = useIssuePageChoice();
  const issueFrame =
    issuePageChoice === "outline" && parseIssuePath(pathname, search) !== undefined;
  const railFits = useMediaQuery(MD_VIEWPORT_QUERY);
  const compact = useMediaQuery(COMPACT_VIEWPORT_QUERY);
  const readingPaneShown = useMediaQuery(READING_PANE_QUERY);
  const detailsDrawer = useDetailsDrawer(issueFrame, parseIssuePath(pathname)?.key);
  const hasMargin = routeHasMargin(pathname, search);
  const onInbox = routeIsInbox(pathname);
  const routeProject = routeProjectOf(pathname);
  const fillsViewport = routeFillsViewport(pathname) || (onInbox && readingPaneShown);
  // Narrow screens and the issue frame hold the navigation in a drawer.
  const inDrawer = compact || issueFrame;

  const mainRef = useRef<HTMLElement | null>(null);
  useKeyboardFit(mainRef, fillsViewport);
  useFocusMainOnPageChange(mainRef, pathname);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawer = useDialog<HTMLElement>({
    initialFocusRef: closeButtonRef,
    onClose: () => setNavigationOpen(false),
    open: navigationOpen && inDrawer,
  });
  const shellNavigation = useMemo<ShellNavigation | undefined>(
    () =>
      issueFrame && !railFits
        ? { onOpen: () => setNavigationOpen(true), open: navigationOpen }
        : undefined,
    [issueFrame, navigationOpen, railFits]
  );

  const actions: GlobalActions = {
    openSearch: () => {
      setNavigationOpen(false);
      setSearchOpen(true);
    },
    toggleShortcuts: shortcuts.toggle,
    createIssue: () => {
      setNavigationOpen(false);
      setCreateOpen(true);
    },
    goTo: (destination) => navigate(NAV_PAGES[destination], {}),
    openDocuments:
      routeProject === undefined
        ? undefined
        : () => navigate(project.routes.documents, { key: routeProject }),
    toggleInboxDrawer: onInbox ? undefined : () => setInboxDrawerOpen((open) => !open),
    toggleSidebar: inDrawer
      ? undefined
      : () => preferences.setSidebarHidden(!preferences.sidebarHidden),
    toggleMargin:
      detailsDrawer !== undefined
        ? { label: "Open or close Details", run: () => detailsDrawer.setOpen(!detailsDrawer.open) }
        : !compact && hasMargin
          ? { run: () => preferences.setMarginHidden(!preferences.marginHidden) }
          : undefined,
  };
  useGlobalCommands(actions);

  const inboxCount = useInboxCount();
  const marginColumnShown = hasMargin && !preferences.marginHidden;
  const panel = (
    <NavigationPanel
      closeButtonRef={closeButtonRef}
      compact={inDrawer}
      onClose={() => setNavigationOpen(false)}
      signOut={signOut}
      user={user}
    />
  );

  return (
    <ShellProviders
      drawer={detailsDrawer}
      navigation={shellNavigation}
      openShortcuts={() => shortcuts.setOpen(true)}
    >
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
        <StatusCorner />
        {compact && !issueFrame ? (
          <CompactHeader
            navigationOpen={navigationOpen}
            onInbox={onInbox}
            onOpenNavigation={() => setNavigationOpen(true)}
          />
        ) : null}
        {inDrawer && navigationOpen ? (
          <>
            <div
              aria-hidden="true"
              className="fixed inset-0 z-20 bg-scrim/50"
              onClick={() => setNavigationOpen(false)}
            />
            <aside
              aria-label="Navigation"
              aria-modal="true"
              className={cn(
                "fixed inset-y-0 left-0 z-30 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto border-r p-5",
                SIDEBAR
              )}
              ref={drawer.containerRef}
              role="dialog"
            >
              {panel}
            </aside>
          </>
        ) : null}
        {issueFrame && railFits ? (
          <IconRail
            inboxCount={inboxCount}
            navigationOpen={navigationOpen}
            onOpenNavigation={() => setNavigationOpen(true)}
            project={routeProject}
            user={user}
          />
        ) : inDrawer ? null : preferences.sidebarHidden ? (
          <aside
            aria-label="Collapsed sidebar"
            className={cn(
              "fixed inset-y-0 left-0 z-10 flex w-14 justify-center border-r p-2",
              SIDEBAR
            )}
            data-testid="sidebar-rail"
          >
            <CommandButton commandId="global.toggle-sidebar" label="Show sidebar" size="icon" />
          </aside>
        ) : (
          <aside
            aria-label="Navigation"
            className={cn("relative order-1 w-72 border-r [overflow-anchor:none]", SIDEBAR)}
          >
            <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto p-4">{panel}</div>
          </aside>
        )}
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
            issueFrame || (preferences.sidebarHidden && !marginColumnShown)
              ? "full-width"
              : "standard"
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
          {/* Live views outlive the route that opened them. */}
          <MountedLiveViews front={liveViewSessionOf(pathname) ?? null} />
        </main>
        <ErrorBoundary region="the margin" resetKey={pathname}>
          <MarginColumn
            collapsed={preferences.marginHidden}
            onCollapsedChange={preferences.setMarginHidden}
            onWidthChange={preferences.setMarginWidth}
            width={preferences.marginWidth}
          />
        </ErrorBoundary>
        <SearchPalette onClose={() => setSearchOpen(false)} open={searchOpen} />
        <InboxDrawer onClose={() => setInboxDrawerOpen(false)} open={inboxDrawerOpen} />
        <ShortcutsSheet
          onOpenChange={shortcuts.setOpen}
          open={shortcuts.open}
          sections={shortcuts.sections}
        />
        {createOpen ? <CreateIssueDialog onClose={() => setCreateOpen(false)} /> : null}
        <RefPreviewHost />
      </div>
    </ShellProviders>
  );
}
