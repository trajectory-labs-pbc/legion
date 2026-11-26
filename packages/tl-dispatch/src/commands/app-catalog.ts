import {
  CheckCheckIcon,
  EyeIcon,
  FileTextIcon,
  FolderIcon,
  KeyboardIcon,
  KeyRoundIcon,
  LogOutIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";

import { COMMAND_GROUPS } from "./groups";
import { navCommandDefinitions } from "./nav";
import { type CommandContext, type CommandIdOf, createCatalog } from "./schema";

/**
 * Every command of the app, declared once. The global context holds every key upstream's shell
 * binds, and the frame's own: `[` for the sidebar and a `G` chord for each page upstream gives
 * none. The keys run as upstream's do, except that an open overlay of this app stops them unless
 * it lets them through. Page contexts join as their pages are rebuilt.
 */
export const APP_CONTEXTS = [
  {
    name: "global",
    parent: null,
    scope: "global",
    commands: [
      // Both keys open the same palette; a slash typed into a field stays a slash.
      {
        name: "search",
        label: "Search or run commands",
        keys: ["$mod+k", "/"],
        icon: SearchIcon,
        inEditable: true,
        // The palette does not list the key that opens it.
        hideFrom: ["palette"],
      },
      {
        name: "help",
        label: "Show keyboard shortcuts",
        keys: ["?"],
        icon: KeyboardIcon,
        group: COMMAND_GROUPS.help,
        overlays: "under-all",
      },
      { name: "create", label: "Create issue", keys: ["c"], icon: PlusIcon },
      ...navCommandDefinitions(),
      {
        name: "go-documents",
        label: "Go to Documents",
        keys: ["g d"],
        icon: FileTextIcon,
        group: COMMAND_GROUPS.navigation,
      },
      {
        name: "go-project",
        label: "Go to project…",
        keys: ["g p"],
        icon: FolderIcon,
        group: COMMAND_GROUPS.navigation,
        hideFrom: ["palette"],
      },
      {
        name: "go-answered",
        label: "Open Answered by you",
        icon: CheckCheckIcon,
        group: COMMAND_GROUPS.navigation,
      },
      {
        // Shut where no page is served, so its second press runs alone: a letter no key holds.
        name: "go-machine-logins",
        label: "Go to Machine logins",
        keys: ["g n"],
        icon: KeyRoundIcon,
        group: COMMAND_GROUPS.navigation,
      },
      {
        name: "inbox-drawer",
        label: "Peek inbox",
        keys: ["i"],
        icon: EyeIcon,
        group: COMMAND_GROUPS.layout,
      },
      {
        name: "toggle-sidebar",
        label: "Toggle sidebar",
        keys: ["Shift+S", "["],
        icon: PanelLeftIcon,
        group: COMMAND_GROUPS.layout,
      },
      {
        name: "toggle-margin",
        label: "Toggle margin",
        keys: ["Shift+M"],
        icon: PanelRightIcon,
        group: COMMAND_GROUPS.layout,
      },
      { name: "sign-out", label: "Sign out", icon: LogOutIcon },
    ],
  },
] as const satisfies readonly CommandContext[];

export type CommandId = CommandIdOf<typeof APP_CONTEXTS>;

/** Loading this module checks the whole catalog, so a clash fails every test that imports it. */
export const appCatalog = createCatalog(APP_CONTEXTS);
