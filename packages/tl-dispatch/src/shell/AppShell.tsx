import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isNoIdentity } from "@upstream-dispatch/api/client";
import { useLiveSocketPill } from "@upstream-dispatch/api/live-socket";
import { userAgentStateQuery } from "@upstream-dispatch/api/queries";
import type { AuthenticatedUser } from "@upstream-dispatch/api/types";
import { useLiveViews } from "@upstream-dispatch/features/agent-view/live-views";
import { MountedLiveViews } from "@upstream-dispatch/features/agent-view/MountedLiveViews";
import {
  legacyPinnedIds,
  useAgentPinWrite,
  usePinnedAgents,
} from "@upstream-dispatch/features/agents/pins";
import { totalUnreadReplies, unreadRepliesLabel } from "@upstream-dispatch/features/agents/unread";
import { DraftsNotKept } from "@upstream-dispatch/features/inbox/DraftsNotKept";
import { InboxDrawer } from "@upstream-dispatch/features/inbox/InboxDrawer";
import { useInboxCount } from "@upstream-dispatch/features/inbox/useInboxCount";
import { CreateIssueDialog } from "@upstream-dispatch/features/issue/CreateIssueDialog";
import { useIssuePageChoice } from "@upstream-dispatch/features/issue-page/choice";
import { IconRail } from "@upstream-dispatch/features/issue-page/IconRail";
import {
  type MarginDrawer,
  type MarginDrawerPage,
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
import { DEFAULT_MARGIN_WIDTH } from "@upstream-dispatch/features/margin/margin-width";
import { RefPreviewHost } from "@upstream-dispatch/features/refs/RefPreview";
import { NO_HOVER_PREVIEW_ATTRIBUTE } from "@upstream-dispatch/features/refs/ref-preview-card";
import {
  buildProjectPath,
  liveViewSessionOf,
  parseIssuePath,
  parseProjectPath,
  routeFillsViewport,
  routeHasMargin,
  routeIsInbox,
  routeProjectOf,
} from "@upstream-dispatch/features/refs/routes";
import { useRecordRecents } from "@upstream-dispatch/features/search/recents";
import { SearchPalette } from "@upstream-dispatch/features/search/SearchPalette";
import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import {
  appKeymap,
  type KeyBindingDescription,
  MOD_KEY_LABEL,
  useKeymap,
} from "@upstream-dispatch/features/shell/keymap";
import { RailButton } from "@upstream-dispatch/features/shell/RailButton";
import { ShortcutHelp } from "@upstream-dispatch/features/shell/ShortcutHelp";
import {
  COMPACT_VIEWPORT_QUERY,
  MD_VIEWPORT_QUERY,
  READING_PANE_QUERY,
  useDialog,
  useMediaQuery,
} from "@upstream-dispatch/features/shell/useDialog";
import { useKeyboardFit } from "@upstream-dispatch/features/shell/useKeyboardFit";
import {
  legacyPinnedAgentsKey,
  useUserPreference,
} from "@upstream-dispatch/features/shell/userPreference";
import { Sidebar } from "@upstream-dispatch/features/sidebar/Sidebar";
import { SendStoppedError, stoppedWriteNote } from "@upstream-dispatch/features/writes/keyed-write";
import { PendingWritesIndicator } from "@upstream-dispatch/features/writes/PendingWritesIndicator";
import {
  useKeyedWrite,
  useRefusalOfSubject,
} from "@upstream-dispatch/features/writes/useKeyedWrite";
import { writesOf } from "@upstream-dispatch/features/writes/write-store";
import { FOOT_STATUS_INSET_PROPERTY, useFootInset } from "@upstream-dispatch/hooks/useFootInset";
import {
  backdrop50,
  badgeBlocking,
  calloutDangerBg,
  calloutDangerBorder,
  calloutWarningBorder,
  canvasText,
  pagePaperBg,
  railAccentHoverText,
  railAccentText,
  railBg,
  railBorder,
  railDangerText,
  railFocusOverlayBg,
  railFocusOverlayText,
  railHoverBg,
  railMutedText,
  railNeedsYouBadgeBg,
  railNeedsYouBadgeText,
  railText,
  statusConnecting,
} from "@upstream-dispatch/theme/classes";
import {
  type ReactNode,
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { AppRoutes } from "../pages";
import { signIns, signOutQuestion, unsentChanges } from "./sign-ins";
import { IssueFrameFallback, IssuePageFallback } from "./states";

function signOutFailure(error: Error): string {
  return error instanceof SendStoppedError
    ? stoppedWriteNote("the sign-out", "made", {
        anew: "Every change is still here. Retry ends your session, or finds it ended, and signs you out here.",
      })
    : "The sign-out did not go through. You are still signed in, with every change.";
}

function NavigationContents({
  closeButtonRef,
  compact,
  onClose,
  onCreateIssue,
  onHideSidebar,
  onOpenInboxDrawer,
  onSearch,
  onSignOut,
  signOutError,
  signOutPending,
  user,
}: {
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  compact: boolean;
  onClose: () => void;
  onCreateIssue: () => void;
  onHideSidebar: () => void;
  onOpenInboxDrawer: () => void;
  onSearch: () => void;
  onSignOut: () => void;
  signOutError: string | undefined;
  signOutPending: boolean;
  user: AuthenticatedUser;
}): ReactNode {
  return (
    <>
      <div className="flex items-center justify-between">
        <Link className="text-lg font-semibold" onClick={onClose} to="/">
          Dispatch
        </Link>
        {compact ? (
          <button
            aria-label="Close navigation"
            className={`rounded-lg px-3 py-2 text-sm font-medium ${railHoverBg}`}
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            Close
          </button>
        ) : null}
      </div>
      <RailButton
        ariaKeyshortcuts="Control+K Meta+K"
        className="mt-4"
        label="Search"
        onOpen={() => {
          onClose();
          onSearch();
        }}
        shortcut={MOD_KEY_LABEL === "⌘" ? "⌘K" : "Ctrl K"}
      />
      <RailButton
        ariaKeyshortcuts="C"
        className="mt-1"
        label="New issue"
        onOpen={() => {
          onClose();
          onCreateIssue();
        }}
        shortcut="c"
      />
      <Sidebar
        onHide={compact ? undefined : onHideSidebar}
        onNavigate={onClose}
        onOpenInboxDrawer={compact ? undefined : onOpenInboxDrawer}
        user={user}
      />
      <div className={`mt-auto border-t pt-4 ${railBorder}`}>
        <p className={`px-2 text-sm ${railMutedText}`}>Signed in as {user.login}</p>
        <button
          className={`mt-1 px-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${railAccentText} ${railAccentHoverText}`}
          disabled={signOutPending}
          onClick={onSignOut}
          type="button"
        >
          Sign out
        </button>
        {signOutError === undefined ? null : (
          <p className={`mt-1 px-2 text-sm ${railDangerText}`} role="alert">
            {signOutError}{" "}
            <button className="font-medium underline" onClick={onSignOut} type="button">
              Retry
            </button>
          </p>
        )}
      </div>
    </>
  );
}

function ShellProviders({
  children,
  drawer,
  navigation,
  openHelp,
}: {
  children: ReactNode;
  drawer: MarginDrawer | undefined;
  navigation: ShellNavigation | undefined;
  openHelp: () => void;
}): ReactNode {
  return (
    <MarginProvider>
      <ReferenceNamesProvider>
        <MarginSlotProvider drawer={drawer} drawsSlot={drawer !== undefined}>
          <ShellNavigationContext.Provider value={navigation}>
            <ShortcutHelpOpener.Provider value={openHelp}>{children}</ShortcutHelpOpener.Provider>
          </ShellNavigationContext.Provider>
        </MarginSlotProvider>
      </ReferenceNamesProvider>
    </MarginProvider>
  );
}

export function AppShell({ user }: { user: AuthenticatedUser }): ReactNode {
  const queryClient = useQueryClient();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [inboxDrawerOpen, setInboxDrawerOpen] = useState(false);
  const [barOpen, setBarOpen] = useState(false);
  useRecordRecents();
  const [sidebarHidden, setSidebarHidden] = useUserPreference(
    "shell.sidebar",
    (stored) => stored === "hidden",
    (hidden) => (hidden ? "hidden" : "shown")
  );
  const [marginHidden, setMarginHidden] = useUserPreference(
    "shell.margin",
    (stored) => stored === "hidden",
    (hidden) => (hidden ? "hidden" : "shown")
  );
  const [marginWidth, setMarginWidth] = useUserPreference(
    "shell.margin-width",
    (storedWidth) => {
      const parsedWidth = Number(storedWidth);
      return storedWidth !== null && Number.isInteger(parsedWidth)
        ? parsedWidth
        : DEFAULT_MARGIN_WIDTH;
    },
    String
  );
  const location = useLocation();
  const [issuePageChoice] = useIssuePageChoice();
  const issueFrame =
    issuePageChoice === "outline" &&
    parseIssuePath(location.pathname, location.search) !== undefined;
  const railFits = useMediaQuery(MD_VIEWPORT_QUERY);
  const iconRailShown = issueFrame && railFits;
  const detailsIssue = parseIssuePath(location.pathname)?.key;
  const [detailsFor, setDetailsFor] = useState<string | undefined>(undefined);
  if (detailsFor !== undefined && detailsFor !== detailsIssue) setDetailsFor(undefined);
  const [drawerPage, setDrawerPage] = useState<MarginDrawerPage | undefined>(undefined);
  const detailsDrawer = useMemo<MarginDrawer | undefined>(
    () =>
      issueFrame
        ? {
            open: detailsFor !== undefined && detailsFor === detailsIssue,
            page: drawerPage,
            setOpen: (open: boolean) => setDetailsFor(open ? detailsIssue : undefined),
            setPage: setDrawerPage,
          }
        : undefined,
    [detailsFor, detailsIssue, drawerPage, issueFrame]
  );
  const hasMargin = routeHasMargin(location.pathname, location.search);
  const marginRailShown = hasMargin && marginHidden;
  const marginColumnShown = hasMargin && !marginHidden;
  const fullWidth = sidebarHidden && !marginColumnShown;
  const mainLayoutClass =
    sidebarHidden && marginRailShown
      ? "xl:w-full xl:pl-20 xl:pr-20"
      : sidebarHidden && !hasMargin
        ? "xl:w-full xl:pl-20"
        : sidebarHidden
          ? "xl:pl-20"
          : marginRailShown
            ? "xl:pr-20"
            : "";
  const readingPaneShown = useMediaQuery(READING_PANE_QUERY);
  const fillsViewport =
    routeFillsViewport(location.pathname) || (routeIsInbox(location.pathname) && readingPaneShown);
  const frontLiveView = liveViewSessionOf(location.pathname) ?? null;
  const liveViews = useLiveViews();
  const pinnedAgents = usePinnedAgents();
  useEffect(() => {
    liveViews.setPinned(pinnedAgents);
  }, [liveViews, pinnedAgents]);
  // Moves pins from the old per-browser key to Dispatch, one write at a time, once.
  const writePin = useAgentPinWrite();
  const migrated = useRef<string | null>(null);
  useEffect(() => {
    const key = legacyPinnedAgentsKey(user.login);
    if (migrated.current === key) return;
    const kept = window.localStorage.getItem(key);
    if (kept === null) return;
    migrated.current = key;
    void (async () => {
      for (const sessionId of legacyPinnedIds(kept)) {
        if (!(await writePin(sessionId, true))) return;
      }
      window.localStorage.removeItem(key);
    })();
  }, [user.login, writePin]);
  const connection = useLiveSocketPill();
  const inboxCount = useInboxCount();
  const unreadReplies = totalUnreadReplies(useQuery(userAgentStateQuery()).data);

  const mainRef = useRef<HTMLElement | null>(null);
  useKeyboardFit(mainRef, fillsViewport);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const statusCornerRef = useRef<HTMLDivElement>(null);
  useFootInset(statusCornerRef, true, FOOT_STATUS_INSET_PROPERTY);
  const isFirstRender = useRef(true);
  const isCompactViewport = useMediaQuery(COMPACT_VIEWPORT_QUERY);
  const drawer = useDialog<HTMLElement>({
    initialFocusRef: closeButtonRef,
    onClose: () => setNavigationOpen(false),
    open: navigationOpen && (isCompactViewport || issueFrame),
  });
  const shellNavigation = useMemo<ShellNavigation | undefined>(
    () =>
      issueFrame && !railFits
        ? { onOpen: () => setNavigationOpen(true), open: navigationOpen }
        : undefined,
    [issueFrame, navigationOpen, railFits]
  );
  const navigate = useNavigate();
  const [helpSnapshot, setHelpSnapshot] = useState<readonly KeyBindingDescription[] | null>(null);
  const openHelp = useCallback(() => setHelpSnapshot(appKeymap.describe()), []);
  const [createOpen, setCreateOpen] = useState(false);
  const routeProject = routeProjectOf(location.pathname);
  useKeymap("global", [
    {
      id: "search",
      inEditable: true,
      keys: "$mod+k",
      label: "Search and actions",
      run: () => setBarOpen(true),
    },
    {
      id: "search-only",
      keys: "/",
      label: "Search",
      palette: false,
      run: () => setBarOpen(true),
    },
    {
      id: "help",
      keys: "?",
      label: "Keyboard shortcuts",
      run: () => setHelpSnapshot(appKeymap.describe()),
    },
    { id: "create", keys: "c", label: "Create issue", run: () => setCreateOpen(true) },
    { id: "go-inbox", keys: "g i", label: "Go to Inbox", run: () => navigate("/") },
    { id: "go-agents", keys: "g a", label: "Go to Agents", run: () => navigate("/agents") },
    { id: "go-settings", keys: "g s", label: "Go to Settings", run: () => navigate("/settings") },
    {
      id: "go-documents",
      keys: "g d",
      label: "Go to Documents",
      run: () => {
        if (routeProject !== undefined) {
          navigate(buildProjectPath({ kind: "documents", project: routeProject }));
        }
      },
      when: () => routeProject !== undefined,
    },
    {
      id: "go-project",
      keys: "g p",
      label: "Go to project…",
      palette: false,
      run: () => setBarOpen(true),
    },
    {
      id: "inbox-drawer",
      keys: "i",
      label: "Open the inbox",
      run: () => setInboxDrawerOpen((open) => !open),
      when: () => !routeIsInbox(location.pathname),
    },
    {
      id: "toggle-sidebar",
      keys: "Shift+S",
      label: "Toggle sidebar",
      run: () => setSidebarHidden(!sidebarHidden),
      when: () => !isCompactViewport && !issueFrame,
    },
    {
      id: detailsDrawer === undefined ? "toggle-margin" : "toggle-details",
      keys: "Shift+M",
      label: detailsDrawer === undefined ? "Toggle margin" : "Open or close Details",
      run: () =>
        detailsDrawer === undefined
          ? setMarginHidden(!marginHidden)
          : detailsDrawer.setOpen(!detailsDrawer.open),
      when: () => detailsDrawer !== undefined || (!isCompactViewport && hasMargin),
    },
  ]);
  const login = user.login;
  const signOut = useKeyedWrite({
    endsWithSession: true,
    inline: true,
    keyed: false,
    label: (_signingOut: string) => "Sign out",
    onError: (_error, signingOut) => signIns.stillSignedIn(signingOut),
    onSuccess: (_answer, signingOut) => {
      void queryClient.resetQueries({ queryKey: ["whoami"] });
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "whoami" });
      writesOf(queryClient).signedOut(signingOut);
      signIns.signedOut(signingOut);
    },
    method: "POST",
    write: () =>
      api
        .logout()
        .catch((error: unknown) =>
          isNoIdentity(error) ? { ok: true as const } : Promise.reject(error)
        ),
  });
  // A refusal belongs to the person who pressed sign-out.
  const signOutRefused = useRefusalOfSubject(signOut, (signingOut) => signingOut === login);
  const [askingTabs, setAskingTabs] = useState(false);
  // Focus moves to <main> only on a new page, not a new tab of one issue.
  const pageIdentity =
    parseIssuePath(location.pathname)?.key ??
    parseProjectPath(location.pathname)?.project ??
    location.pathname;

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only to move focus to main on a real page change
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pageIdentity]);

  const navigation = (
    <NavigationContents
      closeButtonRef={closeButtonRef}
      compact={isCompactViewport || issueFrame}
      onClose={() => setNavigationOpen(false)}
      onCreateIssue={() => setCreateOpen(true)}
      onHideSidebar={() => setSidebarHidden(true)}
      onOpenInboxDrawer={() => setInboxDrawerOpen(true)}
      onSearch={() => setBarOpen(true)}
      onSignOut={() => {
        // Asks first while this tab or another holds unsent changes.
        if (askingTabs) return;
        setAskingTabs(true);
        void signIns.unsentElsewhere(login).then((elsewhere) => {
          setAskingTabs(false);
          const unsent = new Map<string, string>();
          for (const { key, label } of [
            ...unsentChanges(writesOf(queryClient).rows(), login),
            ...elsewhere.unsent,
          ]) {
            if (!unsent.has(key)) unsent.set(key, label);
          }
          const ask = unsent.size > 0 || elsewhere.unanswered;
          const question = signOutQuestion([...unsent.values()], elsewhere.unanswered);
          if (ask && !window.confirm(question)) return;
          signIns.signingOut(login);
          signOut.mutate(login);
        });
      }}
      signOutError={
        signOutRefused && signOut.error !== null ? signOutFailure(signOut.error) : undefined
      }
      signOutPending={signOut.isPending || askingTabs}
      user={user}
    />
  );

  const inboxLabel = inboxCount === 0 ? "Inbox" : `Inbox ${inboxCount}`;
  const inboxBadgeClass = `whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${
    inboxCount === 0 ? railHoverBg : `${railNeedsYouBadgeBg} ${railNeedsYouBadgeText}`
  }`;

  return (
    <ShellProviders drawer={detailsDrawer} navigation={shellNavigation} openHelp={openHelp}>
      <div
        className={`${fillsViewport ? "flex h-screen flex-col supports-[height:100dvh]:h-dvh xl:flex-row" : "xl:flex"} ${canvasText}`}
        data-testid="app-shell"
      >
        <a
          className={`sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 ${railFocusOverlayBg} ${railFocusOverlayText}`}
          href="#main-content"
        >
          Skip to content
        </a>
        <div
          className="pointer-events-none fixed right-4 bottom-[max(5rem,calc(var(--foot-composer-inset,0px)_+_1rem))] z-50 flex w-[min(28rem,calc(100vw-2rem))] flex-col items-end gap-2 xl:bottom-[calc(var(--foot-composer-inset,0px)_+_1rem)] *:pointer-events-auto"
          ref={statusCornerRef}
        >
          <PendingWritesIndicator />
          <DraftsNotKept />
          {connection === "stuck" ? (
            <p
              aria-live="polite"
              className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium shadow-lg ${calloutDangerBorder} ${calloutDangerBg} ${badgeBlocking.text}`}
              data-testid="connection-pill"
            >
              Live updates are not reaching this page
              <button className="underline" onClick={() => window.location.reload()} type="button">
                Reload
              </button>
            </p>
          ) : connection === "reconnecting" ? (
            <p
              aria-live="polite"
              className={`rounded-full border px-3 py-1 text-xs font-medium shadow-lg ${calloutWarningBorder} ${statusConnecting.bg} ${statusConnecting.text}`}
              data-testid="connection-pill"
            >
              Reconnecting…
            </p>
          ) : null}
        </div>
        {isCompactViewport && !issueFrame ? (
          <header
            className={`flex items-center justify-between border-b px-3 ${railBorder} ${railBg} ${railText}`}
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <Link className="shrink-0 text-lg font-semibold" to="/">
                Dispatch
              </Link>
              {routeIsInbox(location.pathname) ? (
                <span className={inboxBadgeClass}>{inboxLabel}</span>
              ) : (
                <>
                  <button
                    aria-label="Peek at the inbox without leaving this page"
                    className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${railHoverBg}`}
                    onClick={() => setInboxDrawerOpen(true)}
                    type="button"
                  >
                    Peek
                  </button>
                  <Link className={inboxBadgeClass} to="/">
                    {inboxLabel}
                  </Link>
                </>
              )}
              {unreadReplies === 0 ? null : (
                <Link
                  className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${railNeedsYouBadgeBg} ${railNeedsYouBadgeText}`}
                  to="/agents"
                >
                  {unreadRepliesLabel(unreadReplies)}
                </Link>
              )}
            </div>
            <button
              aria-expanded={navigationOpen}
              aria-label="Open navigation"
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${railHoverBg}`}
              onClick={() => setNavigationOpen(true)}
              type="button"
            >
              Menu
            </button>
          </header>
        ) : null}
        {(isCompactViewport || issueFrame) && navigationOpen ? (
          <>
            <div
              aria-hidden="true"
              className={`fixed inset-0 z-20 ${backdrop50}`}
              onClick={() => setNavigationOpen(false)}
            />
            <aside
              aria-label="Navigation"
              aria-modal="true"
              className={`fixed inset-y-0 left-0 z-30 flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto border-b p-5 shadow-2xl ${railBorder} ${railBg} ${railText}`}
              ref={drawer.containerRef}
              role="dialog"
            >
              {navigation}
            </aside>
          </>
        ) : null}
        {iconRailShown ? (
          <IconRail
            inboxCount={inboxCount}
            navigationOpen={navigationOpen}
            onOpenNavigation={() => setNavigationOpen(true)}
            project={routeProject}
            user={user}
          />
        ) : isCompactViewport || issueFrame ? null : sidebarHidden ? (
          <aside
            aria-label="Collapsed sidebar"
            className={`fixed inset-y-0 left-0 z-10 flex w-14 justify-center border-r p-2 ${railBorder} ${railBg} ${railText}`}
            data-testid="sidebar-rail"
          >
            <button
              aria-label="Show sidebar"
              className={`min-h-11 min-w-11 rounded-lg text-sm font-medium ${railHoverBg}`}
              onClick={() => setSidebarHidden(false)}
              type="button"
            >
              <span aria-hidden="true">›</span>
            </button>
          </aside>
        ) : (
          <aside
            aria-label="Navigation"
            className={`relative order-1 w-80 max-w-none border-r [overflow-anchor:none] ${railBorder} ${railBg} ${railText}`}
          >
            <div className="sticky top-0 flex h-dvh flex-col overflow-y-auto p-5">{navigation}</div>
          </aside>
        )}
        <main
          className={
            issueFrame
              ? `min-h-dvh min-w-0 flex-1 outline-none md:pl-14 ${pagePaperBg}`
              : `min-w-0 flex-1 p-6 outline-none xl:order-2 ${fillsViewport ? "flex min-h-0 flex-col" : "pb-32 xl:pb-6"} ${mainLayoutClass}`
          }
          data-shell-layout={issueFrame || fullWidth ? "full-width" : "standard"}
          {...(issueFrame ? { [NO_HOVER_PREVIEW_ATTRIBUTE]: "" } : {})}
          data-testid="main-content"
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
        >
          <ErrorBoundary region="this page" resetKey={location.pathname}>
            <Suspense fallback={issueFrame ? <IssueFrameFallback /> : <IssuePageFallback />}>
              <AppRoutes />
            </Suspense>
          </ErrorBoundary>
          {/* Live views outlive the route that opened them. */}
          <MountedLiveViews front={frontLiveView} />
        </main>
        <ErrorBoundary region="the margin" resetKey={location.pathname}>
          <MarginColumn
            collapsed={marginHidden}
            onCollapsedChange={setMarginHidden}
            onWidthChange={setMarginWidth}
            width={marginWidth}
          />
        </ErrorBoundary>
        <SearchPalette onClose={() => setBarOpen(false)} open={barOpen} />
        <InboxDrawer onClose={() => setInboxDrawerOpen(false)} open={inboxDrawerOpen} />
        <ShortcutHelp onClose={() => setHelpSnapshot(null)} snapshot={helpSnapshot} />
        {createOpen ? <CreateIssueDialog onClose={() => setCreateOpen(false)} /> : null}
        <RefPreviewHost />
      </div>
    </ShellProviders>
  );
}
