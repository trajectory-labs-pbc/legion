import { defineActions, whenPresent } from "@/commands/actions";
import { appCatalog } from "@/commands/app-catalog";
import type { NavName } from "@/commands/destinations";
import { useRegisterCommands } from "@/commands/use-register-commands";

/** What the shell's global commands do here; an absent action shuts its command's gate. */
export interface GlobalActions {
  openSearch: () => void;
  toggleShortcuts: () => void;
  createIssue: () => void;
  goTo: (destination: NavName) => void;
  /** The route's project's documents; absent off a project. */
  openDocuments: (() => void) | undefined;
  openAnswers: () => void;
  openMachineLogins: () => void;
  /** Absent while a sign-out is under way. */
  signOut: (() => void) | undefined;
  /** Absent on the Inbox, which is the inbox already. */
  toggleInboxDrawer: (() => void) | undefined;
  /** Absent where the layout has no sidebar to fold. */
  toggleSidebar: (() => void) | undefined;
  /** The margin, or an issue's Details drawer with a label that says so; absent with neither. */
  toggleMargin: { label?: string; run: () => void } | undefined;
}

const useGlobalActions = defineActions(appCatalog, "global", (actions: GlobalActions) => ({
  search: { run: actions.openSearch },
  help: { run: actions.toggleShortcuts },
  create: { run: actions.createIssue },
  "go-inbox": { run: () => actions.goTo("inbox") },
  "go-agents": { run: () => actions.goTo("agents") },
  "go-priorities": { run: () => actions.goTo("priorities") },
  "go-delivery": { run: () => actions.goTo("delivery") },
  "go-pipeline": { run: () => actions.goTo("pipeline") },
  "go-machines": { run: () => actions.goTo("machines") },
  "go-settings": { run: () => actions.goTo("settings") },
  "go-documents": whenPresent(actions.openDocuments),
  "go-project": { run: actions.openSearch },
  "go-answered": { run: actions.openAnswers },
  "go-machine-logins": { run: actions.openMachineLogins },
  "inbox-drawer": whenPresent(actions.toggleInboxDrawer),
  "toggle-sidebar": whenPresent(actions.toggleSidebar),
  "toggle-margin": {
    ...whenPresent(actions.toggleMargin?.run),
    label: actions.toggleMargin?.label,
  },
  "sign-out": whenPresent(actions.signOut),
}));

/** Registers the catalog's global commands with what they do in the shell now. */
export function useGlobalCommands(actions: GlobalActions): void {
  useRegisterCommands(appCatalog, "global", useGlobalActions(actions));
}
