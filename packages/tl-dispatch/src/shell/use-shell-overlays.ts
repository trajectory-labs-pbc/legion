import type { ShellNavigation } from "@upstream-dispatch/features/issue-page/shell-navigation";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";

import { type ShortcutsSheetState, useShortcutsSheet } from "@/commands/use-shortcuts-sheet";
import { usePageNavigate } from "@/navigation/hooks";
import { project } from "@/pages/project";
import { useGlobalCommands } from "./global-commands";
import { NAV_PAGES } from "./nav-pages";
import type { ShellLayout } from "./use-shell-layout";

/** What opens over the page, and the global commands that open it. */
interface ShellOverlays {
  navigationOpen: boolean;
  openNavigation: () => void;
  closeNavigation: () => void;
  /** The control the navigation drawer focuses when it opens. */
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  /** The issue frame's way to the navigation, where its icon rail does not fit. */
  shellNavigation: ShellNavigation | undefined;
  searchOpen: boolean;
  closeSearch: () => void;
  createOpen: boolean;
  closeCreate: () => void;
  inboxDrawerOpen: boolean;
  closeInboxDrawer: () => void;
  shortcuts: ShortcutsSheetState;
  openShortcuts: () => void;
}

/** Holds the overlays' state and registers the global commands they feed. */
export function useShellOverlays(shell: ShellLayout): ShellOverlays {
  const navigate = usePageNavigate();
  const { preferences, detailsDrawer } = shell;
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [inboxDrawerOpen, setInboxDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const shortcuts = useShortcutsSheet();
  const { setOpen: setShortcutsOpen } = shortcuts;
  // A context value: a new function each render would redraw every reader.
  const openShortcuts = useCallback(() => setShortcutsOpen(true), [setShortcutsOpen]);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const shellNavigation = useMemo<ShellNavigation | undefined>(
    () =>
      shell.issueFrame && !shell.railFits
        ? { onOpen: () => setNavigationOpen(true), open: navigationOpen }
        : undefined,
    [shell.issueFrame, navigationOpen, shell.railFits]
  );
  const routeProject = shell.project;
  // The navigation drawer lets the global keys through, so each action closes it first.
  const closing =
    <Args extends unknown[]>(run: (...args: Args) => void) =>
    (...args: Args) => {
      setNavigationOpen(false);
      run(...args);
    };
  useGlobalCommands({
    openSearch: closing(() => setSearchOpen(true)),
    toggleShortcuts: shortcuts.toggle,
    createIssue: closing(() => setCreateOpen(true)),
    goTo: closing((destination) => navigate(NAV_PAGES[destination])),
    openDocuments:
      routeProject === undefined
        ? undefined
        : closing(() => navigate(project.routes.documents, { params: { key: routeProject } })),
    toggleInboxDrawer: shell.onInbox
      ? undefined
      : closing(() => setInboxDrawerOpen((open) => !open)),
    toggleSidebar: shell.inDrawer
      ? undefined
      : closing(() => preferences.setSidebarHidden(!preferences.sidebarHidden)),
    toggleMargin:
      detailsDrawer !== undefined
        ? {
            label: "Open or close Details",
            run: closing(() => detailsDrawer.setOpen(!detailsDrawer.open)),
          }
        : !shell.compact && shell.hasMargin
          ? { run: closing(() => preferences.setMarginHidden(!preferences.marginHidden)) }
          : undefined,
  });
  return {
    navigationOpen,
    openNavigation: () => setNavigationOpen(true),
    closeNavigation: () => setNavigationOpen(false),
    closeButtonRef,
    shellNavigation,
    searchOpen,
    closeSearch: () => setSearchOpen(false),
    createOpen,
    closeCreate: () => setCreateOpen(false),
    inboxDrawerOpen,
    closeInboxDrawer: () => setInboxDrawerOpen(false),
    shortcuts,
    openShortcuts,
  };
}
