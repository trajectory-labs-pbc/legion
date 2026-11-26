import type { ShellNavigation } from "@upstream-dispatch/features/issue-page/shell-navigation";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { type ShortcutsSheetState, useShortcutsSheet } from "@/commands/use-shortcuts-sheet";
import { usePageNavigate } from "@/navigation/hooks";
import { inbox } from "@/pages/inbox";
import { machineLogin } from "@/pages/machine-login";
import { project } from "@/pages/project";
import { useGlobalCommands } from "./global-commands";
import { NAV_PAGES } from "./nav-pages";
import type { ShellLayout } from "./use-shell-layout";

/** What opens over the page, and the global commands that open it. */
interface ShellOverlays {
  navigationOpen: boolean;
  openNavigation: () => void;
  closeNavigation: () => void;
  /** The control that puts the navigation away: the drawer focuses it when it opens. */
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  sidebarRef: RefObject<HTMLElement | null>;
  /** The folded sidebar's Show sidebar button. */
  openerRef: RefObject<HTMLButtonElement | null>;
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
export function useShellOverlays(
  shell: ShellLayout,
  signOut: (() => void) | undefined
): ShellOverlays {
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
  const sidebarRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const shellNavigation = useMemo<ShellNavigation | undefined>(
    () =>
      shell.issueFrame && shell.compact
        ? { onOpen: () => setNavigationOpen(true), open: navigationOpen }
        : undefined,
    [shell.issueFrame, navigationOpen, shell.compact]
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
    openAnswers: closing(() => navigate(inbox.routes.answers)),
    // The page itself says when this deployment does not serve it.
    openMachineLogins: closing(() => navigate(machineLogin.routes.machine)),
    signOut: signOut && closing(signOut),
    toggleInboxDrawer: shell.onInbox
      ? undefined
      : closing(() => setInboxDrawerOpen((open) => !open)),
    toggleSidebar: shell.inDrawer
      ? undefined
      : closing(() => {
          const folding = !preferences.sidebarHidden;
          // When the toggle removes the focused element, the focus moves to the toggle button it draws.
          const leaving = folding ? sidebarRef.current : openerRef.current;
          const handOff = leaving?.contains(document.activeElement) === true;
          flushSync(() => preferences.setSidebarHidden(folding));
          if (handOff) (folding ? openerRef : closeButtonRef).current?.focus();
        }),
    toggleMargin:
      detailsDrawer !== undefined
        ? {
            label: "Open or close Details",
            run: closing(() => detailsDrawer.setOpen(!detailsDrawer.open)),
          }
        : shell.marginBeside && shell.hasMargin
          ? { run: closing(() => preferences.setMarginHidden(!preferences.marginHidden)) }
          : undefined,
  });
  return {
    navigationOpen,
    openNavigation: () => setNavigationOpen(true),
    closeNavigation: () => setNavigationOpen(false),
    closeButtonRef,
    sidebarRef,
    openerRef,
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
