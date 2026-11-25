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

import { type CommandContext, type CommandIdOf, createCatalog } from "./catalog";
import { COMMAND_GROUPS } from "./groups";
import { navCommandDefinitions } from "./nav";
import type { UpstreamLabels } from "./shortcuts";

/**
 * Every command of the app, declared once. The global context holds every key upstream's shell
 * binds and no other, with the same behaviour; the pages with no letter are palette commands only.
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

/**
 * The sheet's labels for upstream's bindings whose own do not fit it, by `scope:id`, each beside
 * upstream's label as its source writes it, so a test notices when upstream's changes.
 */
export const UPSTREAM_LABELS: UpstreamLabels = {
  "inbox:arrows": {
    upstream: "Next / previous row while {arrowsWhen}",
    label: "Next / previous row",
  },
  "inbox:option": { upstream: "Select option 1–9 of the {acted} ask", label: "Select an option" },
  "inbox:snooze": {
    upstream: "Snooze the focused ask, or every selected ask",
    label: "Snooze the ask or the selection",
  },
  "architecture:arrows": {
    upstream: "Next / previous component while one is focused",
    label: "Next / previous component",
  },
  "architecture:open": {
    upstream: "Open the focused component: its children, else its details",
    label: "Open the focused component",
  },
  "board:arrows-horizontal": {
    upstream: "Next / previous column while one is focused",
    label: "Next / previous column",
  },
  "board:arrows-vertical": {
    upstream: "Next / previous card while one is focused",
    label: "Next / previous card",
  },
  "issue:request-changes": {
    upstream: "Request changes on the focused approval request",
    label: "Request changes",
  },
  "issue:tree-decision": {
    upstream: "Move into the decision behind the focused row",
    label: "Move into the row's decision",
  },
  "issue:tree-fold": {
    upstream: "Fold the focused row, or move to its parent",
    label: "Fold the row, or go to its parent",
  },
};
