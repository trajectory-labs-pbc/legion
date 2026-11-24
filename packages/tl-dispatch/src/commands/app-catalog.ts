import { type CommandContext, createCatalog } from "./catalog";
import { navCommandDefinitions } from "./nav";

/**
 * Every command of the app, declared once. The global context holds every key the shell binds
 * today, with the same behaviour; page contexts join as their pages are rebuilt.
 */
export const APP_CONTEXTS: readonly CommandContext[] = [
  {
    name: "global",
    parent: null,
    scope: "global",
    commands: [
      { name: "search", label: "Search and actions", keys: ["$mod+k"], inEditable: true },
      // A slash typed into a field stays a slash.
      { name: "search-only", label: "Search", keys: ["/"], palette: false },
      { name: "help", label: "Keyboard shortcuts", keys: ["?"] },
      { name: "create", label: "Create issue", keys: ["c"] },
      ...navCommandDefinitions(),
      { name: "go-documents", label: "Go to Documents", keys: ["g d"] },
      { name: "go-project", label: "Go to project…", keys: ["g p"], palette: false },
      { name: "inbox-drawer", label: "Open the inbox", keys: ["i"] },
      { name: "toggle-sidebar", label: "Toggle sidebar", keys: ["Shift+S"] },
      { name: "toggle-margin", label: "Toggle margin", keys: ["Shift+M"] },
    ],
  },
];

/** Loading this module checks the whole catalog, so a clash fails every test that imports it. */
export const appCatalog = createCatalog(APP_CONTEXTS);
