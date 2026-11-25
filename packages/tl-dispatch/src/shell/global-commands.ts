import { appCatalog, type NavName } from "@/commands/catalog";
import { type CommandState, defineActions, useRegisterCommands } from "@/commands/hooks";

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
  "go-inbox": { run: () => actions.goTo("inbox") },
  "go-agents": { run: () => actions.goTo("agents") },
  "go-priorities": { run: () => actions.goTo("priorities") },
  "go-delivery": { run: () => actions.goTo("delivery") },
  "go-pipeline": { run: () => actions.goTo("pipeline") },
  "go-machines": { run: () => actions.goTo("machines") },
  "go-settings": { run: () => actions.goTo("settings") },
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
