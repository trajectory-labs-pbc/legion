import { appCatalog } from "@/commands/app-catalog";
import { useRegisterCommands } from "@/commands/bindings";
import { NAV_DESTINATIONS, type NavName, navCommandName } from "@/commands/nav";
import { type CommandState, defineActions } from "@/commands/specs";

/** What the shell's global commands do here; an absent action shuts its command's gate. */
export interface GlobalActions {
  openSearch: () => void;
  toggleShortcuts: () => void;
  createIssue: () => void;
  goTo: (destination: NavName) => void;
  /** The route's project's documents; absent off a project. */
  openDocuments: (() => void) | undefined;
  /** Absent on the Inbox, which is the inbox already. */
  toggleInboxDrawer: (() => void) | undefined;
  /** Absent where the layout has no sidebar to fold. */
  toggleSidebar: (() => void) | undefined;
  /** The margin, or an issue's Details drawer with a label that says so; absent with neither. */
  toggleMargin: { label?: string; run: () => void } | undefined;
}

const off = (run: (() => void) | undefined): CommandState => ({
  enabled: run !== undefined,
  run: () => run?.(),
});

const useGlobalActions = defineActions(appCatalog, "global", (actions: GlobalActions, _: null) => ({
  search: { run: actions.openSearch },
  "search-only": { run: actions.openSearch },
  help: { run: actions.toggleShortcuts },
  create: { run: actions.createIssue },
  ...Object.fromEntries(
    NAV_DESTINATIONS.map(({ name }) => [navCommandName(name), { run: () => actions.goTo(name) }])
  ),
  "go-documents": off(actions.openDocuments),
  "go-project": { run: actions.openSearch },
  "inbox-drawer": off(actions.toggleInboxDrawer),
  "toggle-sidebar": off(actions.toggleSidebar),
  "toggle-margin": { ...off(actions.toggleMargin?.run), label: actions.toggleMargin?.label },
}));

/** Registers the catalog's global commands with what they do in the shell now. */
export function useGlobalCommands(actions: GlobalActions): void {
  useRegisterCommands(appCatalog, "global", useGlobalActions(actions, null));
}
