import { type CommandContext, createCatalog } from "./catalog";
import { navCommandDefinitions } from "./nav";

/** Every command of the app, declared once. Page contexts join as their pages are rebuilt. */
export const APP_CONTEXTS: readonly CommandContext[] = [
  {
    name: "global",
    parent: null,
    scope: "global",
    commands: [
      {
        name: "search",
        label: "Search and actions",
        keys: ["$mod+k", "/"],
        icon: "search",
        group: "other",
        hideFrom: ["palette"],
        // A slash typed into a document stays a slash.
        inEditable: ["$mod+k"],
      },
      {
        name: "shortcuts",
        label: "Keyboard shortcuts",
        keys: ["?"],
        icon: "keyboard",
        group: "other",
        keywords: ["help", "keys"],
      },
      {
        name: "create-issue",
        label: "Create issue",
        keys: ["c"],
        icon: "plus",
        group: "create",
        keywords: ["new"],
      },
      {
        name: "inbox-drawer",
        label: "Open the inbox",
        keys: ["i"],
        icon: "inbox",
        group: "other",
      },
      ...navCommandDefinitions(),
    ],
  },
];

/** Loading this module checks the whole catalog, so a clash fails every test that imports it. */
export const appCatalog = createCatalog(APP_CONTEXTS);
