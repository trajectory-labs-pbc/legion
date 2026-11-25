import {
  FileTextIcon,
  FolderIcon,
  InboxIcon,
  KeyboardIcon,
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
 * binds and no other; the pages with no letter are palette commands only. The keys run as
 * upstream's do, except that an open overlay of this app stops them unless it lets them through.
 * Page contexts join as their pages are rebuilt.
 */
export const APP_CONTEXTS = [
  {
    name: "global",
    parent: null,
    scope: "global",
    commands: [
      {
        name: "search",
        label: "Search and actions",
        keys: ["$mod+k"],
        icon: SearchIcon,
        inEditable: true,
        // The palette does not list the key that opens it.
        hideFrom: ["palette"],
      },
      // A slash typed into a field stays a slash.
      {
        name: "search-only",
        label: "Search",
        keys: ["/"],
        icon: SearchIcon,
        hideFrom: ["palette"],
      },
      {
        name: "help",
        label: "Keyboard shortcuts",
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
        name: "inbox-drawer",
        label: "Open the inbox",
        keys: ["i"],
        icon: InboxIcon,
        group: COMMAND_GROUPS.layout,
      },
      {
        name: "toggle-sidebar",
        label: "Toggle sidebar",
        keys: ["Shift+S"],
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
    ],
  },
] as const satisfies readonly CommandContext[];

export type CommandId = CommandIdOf<typeof APP_CONTEXTS>;

/** Loading this module checks the whole catalog, so a clash fails every test that imports it. */
export const appCatalog = createCatalog(APP_CONTEXTS);
