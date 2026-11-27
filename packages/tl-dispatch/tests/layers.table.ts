// The layers of the app as data. `tests/layering.ts` checks each import against this table, and
// `tests/layers.md` gives the reason for each rule and the questions that place a new file.

/** Each rule of the table. `tests/layers.md` has a heading that names each one. */
export const RULES = [
  "every-file-has-a-layer",
  "imports-only-above",
  "one-row",
  "only-the-seam-imports-upstream",
  "seam-readers",
  "library-owners",
  "no-own-index",
  "index-only-at-the-root",
  "through-the-index",
  "no-cycles",
  "imports-are-readable",
  "upstream-app-never-loads",
  "views-are-marked",
] as const;

export type Rule = (typeof RULES)[number];

/**
 * The layers, highest first; each inner list is one row. A path is a folder (`src/shell`), a file
 * (`src/start.tsx`) or a pattern whose `*` is one path segment, so `src/features/*` is each
 * feature's folder and not a loose file beside them; the most specific match wins. The UI
 * package counts as above every layer.
 */
export const ROWS = [
  [{ layer: "browser", paths: ["src/browser"] }],
  [{ layer: "upstream", paths: ["src/upstream"] }],
  // Until the data foundation moves them: src/writes and src/features/read-failure.tsx.
  [{ layer: "data", paths: ["src/data", "src/writes", "src/features/read-failure.tsx"] }],
  [
    { layer: "commands", paths: ["src/commands"] },
    { layer: "navigation", paths: ["src/navigation"] },
    { layer: "loading", paths: ["src/loading"] },
  ],
  [{ layer: "parts", paths: ["src/parts/*"] }],
  [{ layer: "features", paths: ["src/features/*"] }],
  [{ layer: "shell", paths: ["src/shell"] }],
  // Until the features move: each page file of src/pages, the parts in its folder included.
  [{ layer: "routes", paths: ["src/features/*/route.tsx", "src/pages"] }],
  // Until the features move: src/start.tsx.
  [{ layer: "app", paths: ["src/app", "src/start.tsx"] }],
] as const;

export type Layer = (typeof ROWS)[number][number]["layer"];

/** A reader in the table: a layer or a path. */
type Reader = Layer | `src/${string}` | `tests/${string}`;

/** Inside a row, what a layer may import of another layer of its row. */
export const ONE_ROW: Partial<Record<Layer, readonly string[]>> = {
  commands: ["src/loading", "src/navigation/routes.ts"],
};

/** Files directly under src/ that are in no layer: the entry, the view map and the stylesheets. */
export const ROOT_FILES: readonly string[] = ["src/main.tsx", "src/views.ts", "src/*.css"];

/** The readers of a page's view, a file or a folder. */
const PAGE_VIEW_READERS: readonly Reader[] = [
  "src/features/<page>/route.tsx",
  "src/features/<page>/page.tsx",
  // Until the features move.
  "src/pages/<page>.tsx",
];

/**
 * The readers of each seam file and each root file. A `<page>` in a reader stands for the
 * `<page>` of the file read. A seam file may read another, and a test may read each one; a seam
 * file or a root file that this table does not list has no other reader.
 */
export const READERS: Readonly<Record<string, readonly Reader[]>> = {
  "src/upstream/contract.ts": ["data", "app"],
  "src/upstream/api.ts": ["data", "app"],
  "src/upstream/queries.ts": ["data", "app"],
  "src/upstream/live.ts": ["data", "app"],
  "src/upstream/writes.ts": ["data", "app"],
  // Registers upstream's kinds of writes once, where the app starts.
  "src/upstream/write-kinds.ts": ["data", "app"],
  "src/upstream/data-hooks.ts": ["data", "app"],
  "src/upstream/logic/*.ts": ["data"],
  "src/upstream/routes.ts": ["navigation"],
  "src/upstream/keys.ts": ["commands"],
  "src/upstream/shell.tsx": ["shell", "parts", "features", "loading", "app", "src/main.tsx"],
  // `upstreamView` for the seam files, and `ForkView` for fork code inside a marked component.
  "src/upstream/mark.tsx": ["shell", "loading", "app", "parts", "features"],
  "src/upstream/widgets/*.tsx": ["parts", "features", "shell"],
  "src/upstream/views/<page>.tsx": PAGE_VIEW_READERS,
  "src/upstream/views/<page>": PAGE_VIEW_READERS,
  "src/views.ts": ["tests/map"],
  "src/*.css": ["src/main.tsx", "src/styles.css"],
};

/** The files outside src/upstream that may import upstream's code, each with its reason. */
export const UPSTREAM_DOORS: Readonly<Record<string, string>> = {
  "tests/upstream.ts": "the one door for the tests: upstream's test helpers and test-only modules",
  "src/styles.css": "a stylesheet re-exports nothing; it compiles upstream's classes into the app",
};

/** The names a `views/` or `widgets/` file gives unmarked, each with its reason (tests/layers.md). */
export const UNMARKED: Readonly<Record<string, string>> = {
  LiveViewRoute: "renders null; the live view draws in MountedLiveViews",
};

/** The libraries that only their owners import. A test may import one that `tests` marks. */
export const LIBRARIES: readonly {
  name: RegExp;
  owners: readonly Layer[];
  tests: boolean;
  reason: string;
}[] = [
  {
    name: /^(react-router(-dom)?|@tanstack\/[a-z-]*router[a-z-]*)$/,
    // The features move adds src/app.
    owners: ["navigation"],
    tests: true,
    reason: "only src/navigation imports the router, so a router move changes one folder",
  },
  {
    name: /^@tanstack\/react-query$/,
    owners: ["data", "app"],
    tests: true,
    reason: "a fork view reads and writes through src/data, never through the query library",
  },
  {
    name: /^@base-ui\//,
    owners: [],
    tests: false,
    reason: "Base UI comes through packages/ui: import its component, or add one there",
  },
];

/**
 * Each import that breaks a rule today: rule, then file, then the specifier of each import, once
 * for each time the file writes it. A file that moves keeps its entries under its new path. An
 * entry that breaks no rule fails the test, and a new entry is refused in review.
 */
export const BREAKS: Partial<Record<Rule, Readonly<Record<string, readonly string[]>>>> = {
  "imports-are-readable": {
    "src/commands/engine-stack.test.ts": ["(not a literal)"],
    "src/commands/hotkey-tooltip.test.tsx": ["(not a literal)"],
  },
  "imports-only-above": {
    "src/shell/account-menu.tsx": ["@/pages/people"],
    "src/shell/app-name.tsx": ["@/pages/inbox"],
    "src/shell/compact-header.tsx": ["@/pages/agents", "@/pages/inbox"],
    "src/shell/main-region.tsx": ["@/pages/index"],
    "src/shell/nav-pages.ts": [
      "@/pages/agents",
      "@/pages/delivery",
      "@/pages/inbox",
      "@/pages/machines",
      "@/pages/priorities",
      "@/pages/settings",
    ],
    "src/shell/sidebar-data.test.ts": ["@/pages/index"],
    "src/shell/sidebar-data.ts": ["@/pages/index", "@/pages/page"],
    "src/shell/sidebar.tsx": ["@/pages/agents", "@/pages/issue", "@/pages/project"],
    "src/shell/use-focus-main.test.tsx": ["@/pages/index"],
    "src/shell/use-focus-main.ts": ["@/pages/page"],
    "src/shell/use-shell-layout.ts": ["@/pages/index"],
    "src/shell/use-shell-overlays.ts": [
      "@/pages/inbox",
      "@/pages/machine-login",
      "@/pages/project",
    ],
  },
  "library-owners": {
    "src/navigation/page-link.tsx": ["@tanstack/react-query"],
    "src/navigation/page-route.ts": ["@tanstack/react-query"],
    "src/pages/machine-login/machine-login-route.tsx": ["@tanstack/react-query"],
    "src/pages/machine-login/machine-logins.tsx": ["@tanstack/react-query"],
    "src/pages/machine-login/use-machine-login.ts": ["@tanstack/react-query"],
    "src/pages/machine-login/use-revoke.ts": ["@tanstack/react-query"],
    "src/shell/auth-gate.tsx": ["@tanstack/react-query"],
    "src/shell/forget-reads.ts": ["@tanstack/react-query"],
    "src/shell/inbox-count.ts": ["@tanstack/react-query"],
    "src/shell/providers.tsx": ["@tanstack/react-query"],
    "src/shell/sidebar-data.ts": ["@tanstack/react-query"],
    "src/shell/sign-in-page.tsx": ["@tanstack/react-query"],
    "src/shell/sign-ins.ts": ["@tanstack/react-query"],
    "src/shell/use-sign-in-channel.ts": ["@tanstack/react-query"],
    "src/shell/use-sign-out.ts": ["@tanstack/react-query"],
  },
  "only-the-seam-imports-upstream": {
    "src/commands/bindings.test.tsx": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/bindings.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/command-button.test.tsx": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/engine-stack.test.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/engine-stack.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/hotkey-tooltip.test.tsx": ["@upstream-dispatch/__tests__/fake-clock"],
    "src/commands/key-chips.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/key-engine.test.tsx": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/keys.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/live-shortcuts.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/schema.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/shortcuts-sheet.rows.test.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/shortcuts-sheet.test.tsx": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/upstream-labels.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/use-register-commands.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/commands/use-shortcuts-sheet.ts": ["@upstream-dispatch/features/shell/keymap"],
    "src/frame.test.tsx": [
      "@upstream-dispatch/features/delivery/DeliverySettingsForm",
      "@upstream-dispatch/theme/classes",
    ],
    "src/loading/lazy-named.ts": ["@upstream-dispatch/features/shell/DeploymentResilience"],
    "src/loading/lazy-region.test.tsx": ["@upstream-dispatch/__tests__/act-warnings"],
    "src/loading/lazy-region.tsx": ["@upstream-dispatch/features/shell/ErrorBoundary"],
    "src/loading/page-skeleton.test.tsx": ["@upstream-dispatch/__tests__/fake-clock"],
    "src/navigation/page-link.test.tsx": [
      "@upstream-dispatch/__tests__/act-warnings",
      "@upstream-dispatch/__tests__/query-provider",
    ],
    "src/pages/agents.tsx": [
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/features/agent-view/MountedLiveViews",
      "@upstream-dispatch/features/agents/AgentsPage",
      "@upstream-dispatch/features/agents/BroadcastPage",
      "@upstream-dispatch/features/agents/BroadcastsPage",
      "@upstream-dispatch/features/artifacts/AgentArtifactPage",
      "@upstream-dispatch/features/refs/routes",
    ],
    "src/pages/delivery.tsx": [
      "@upstream-dispatch/features/delivery/DeliveryPage",
      "@upstream-dispatch/features/delivery/PipelinePage",
    ],
    "src/pages/document.tsx": ["@upstream-dispatch/features/document/DocumentPage"],
    "src/pages/inbox.tsx": [
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/features/answers/AnswersPage",
      "@upstream-dispatch/features/inbox/Inbox",
      "@upstream-dispatch/features/refs/routes",
      "@upstream-dispatch/features/shell/useDialog",
      "@upstream-dispatch/features/shell/useDocumentTitle",
    ],
    "src/pages/index.test.ts": ["@upstream-dispatch/features/refs/routes"],
    "src/pages/issue.tsx": [
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/features/issue-page/IssuePage",
    ],
    "src/pages/machine-login/machine-login-page.layout.test.tsx": ["@upstream-dispatch/api/client"],
    "src/pages/machine-login/machine-login-page.shell.test.tsx": [
      "@upstream-dispatch/features/shell/KeymapProvider",
    ],
    "src/pages/machine-login/machine-login-page.test.tsx": [
      "@upstream-dispatch/__tests__/fake-clock",
      "@upstream-dispatch/__tests__/keyed-attempt",
      "@upstream-dispatch/__tests__/stop-late-write",
      "@upstream-dispatch/__tests__/user",
      "@upstream-dispatch/api/client",
    ],
    "src/pages/machine-login/machine-logins.revoke.test.tsx": [
      "@upstream-dispatch/__tests__/fake-clock",
      "@upstream-dispatch/__tests__/keyed-attempt",
      "@upstream-dispatch/__tests__/stop-late-write",
      "@upstream-dispatch/__tests__/user",
      "@upstream-dispatch/api/client",
    ],
    "src/pages/machine-login/machine-logins.test.tsx": [
      "@upstream-dispatch/__tests__/fake-clock",
      "@upstream-dispatch/__tests__/keyed-attempt",
      "@upstream-dispatch/__tests__/user",
      "@upstream-dispatch/api/types",
      "@upstream-dispatch/features/credentials/GrantsSection",
    ],
    "src/pages/machine-login/upstream.ts": [
      "@upstream-dispatch/api/client",
      "@upstream-dispatch/api/types",
      "@upstream-dispatch/features/credentials/capabilities",
      "@upstream-dispatch/features/credentials/grants",
      "@upstream-dispatch/features/credentials/machineLogins",
      "@upstream-dispatch/features/credentials/pending",
      "@upstream-dispatch/features/issue-page/focus-keeper",
      "@upstream-dispatch/features/issue-page/usable-control",
      "@upstream-dispatch/features/refs/Timestamp",
      "@upstream-dispatch/features/shell/useDocumentTitle",
      "@upstream-dispatch/features/writes/keyed-write",
      "@upstream-dispatch/features/writes/useKeyedWrite",
      "@upstream-dispatch/features/writes/useKeyedWrite",
      "@upstream-dispatch/hooks/useSubmitGuard",
    ],
    "src/pages/machines.tsx": [
      "@upstream-dispatch/features/machines/MachinePage",
      "@upstream-dispatch/features/machines/MachinesPage",
    ],
    "src/pages/not-found/not-found.tsx": ["@upstream-dispatch/features/shell/useDocumentTitle"],
    "src/pages/page.ts": ["@upstream-dispatch/features/refs/routes"],
    "src/pages/people.tsx": [
      "@upstream-dispatch/features/people/PersonPage",
      "@upstream-dispatch/features/refs/routes",
    ],
    "src/pages/priorities.tsx": [
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/features/priorities/PrioritiesPage",
      "@upstream-dispatch/features/priorities/PriorityPage",
    ],
    "src/pages/project.tsx": ["@upstream-dispatch/features/project/ProjectPage"],
    "src/pages/settings.tsx": ["@upstream-dispatch/features/settings/SettingsPage"],
    "src/shell/app-shell.test.tsx": [
      "@upstream-dispatch/__tests__/act-warnings",
      "@upstream-dispatch/__tests__/network",
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/features/agent-view/live-views",
      "@upstream-dispatch/features/issue-page/IssuePage",
      "@upstream-dispatch/features/search/recents",
      "@upstream-dispatch/features/shell/userPreference",
    ],
    "src/shell/app-shell.tsx": [
      "@upstream-dispatch/api/types",
      "@upstream-dispatch/features/agents/pins",
      "@upstream-dispatch/features/search/recents",
    ],
    "src/shell/auth-gate.test.tsx": [
      "@upstream-dispatch/__tests__/live-socket-harness",
      "@upstream-dispatch/__tests__/network",
      "@upstream-dispatch/api/event-feed",
      "@upstream-dispatch/api/live-socket",
      "@upstream-dispatch/api/types",
      "@upstream-dispatch/features/inbox/answer-drafts",
      "@upstream-dispatch/features/writes/write-store",
    ],
    "src/shell/auth-gate.tsx": [
      "@upstream-dispatch/api/client",
      "@upstream-dispatch/api/event-feed",
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/api/types",
      "@upstream-dispatch/features/conversation/unsent-drafts",
      "@upstream-dispatch/features/writes/kinds",
      "@upstream-dispatch/features/writes/write-store",
    ],
    "src/shell/global-commands.test.tsx": ["@upstream-dispatch/features/shell/keymap"],
    "src/shell/inbox-count.ts": [
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/features/credentials/pending",
      "@upstream-dispatch/features/inbox/BlockedOnYou",
    ],
    "src/shell/main-region.tsx": [
      "@upstream-dispatch/features/agent-view/MountedLiveViews",
      "@upstream-dispatch/features/refs/ref-preview-card",
      "@upstream-dispatch/features/shell/ErrorBoundary",
      "@upstream-dispatch/hooks/useFootInset",
    ],
    "src/shell/margin-region.tsx": [
      "@upstream-dispatch/features/margin/MarginColumn",
      "@upstream-dispatch/features/shell/ErrorBoundary",
    ],
    "src/shell/navigation-panel.tsx": ["@upstream-dispatch/api/types"],
    "src/shell/page-fallbacks.tsx": ["@upstream-dispatch/features/issue/issue-tab-list"],
    "src/shell/providers.test.tsx": ["@upstream-dispatch/__tests__/network"],
    "src/shell/providers.tsx": ["@upstream-dispatch/features/shell/DeploymentResilience"],
    "src/shell/shell-dialogs.test.tsx": [
      "@upstream-dispatch/features/issue/CreateIssueDialog",
      "@upstream-dispatch/features/refs/RefPreview",
    ],
    "src/shell/shell-dialogs.tsx": [
      "@upstream-dispatch/features/inbox/InboxDrawer",
      "@upstream-dispatch/features/issue/CreateIssueDialog",
      "@upstream-dispatch/features/refs/RefPreview",
      "@upstream-dispatch/features/search/SearchPalette",
    ],
    "src/shell/shell-providers.test.tsx": [
      "@upstream-dispatch/features/issue-page/margin-slot",
      "@upstream-dispatch/features/issue-page/shell-navigation",
      "@upstream-dispatch/features/issue-page/shortcut-help-opener",
      "@upstream-dispatch/features/margin/margin-context",
      "@upstream-dispatch/features/refs/reference-names",
    ],
    "src/shell/shell-providers.tsx": [
      "@upstream-dispatch/features/issue-page/margin-slot",
      "@upstream-dispatch/features/issue-page/shell-navigation",
      "@upstream-dispatch/features/issue-page/shortcut-help-opener",
      "@upstream-dispatch/features/margin/margin-context",
      "@upstream-dispatch/features/refs/reference-names",
    ],
    "src/shell/sidebar-data.test.ts": ["@upstream-dispatch/features/refs/routes"],
    "src/shell/sidebar-data.ts": [
      "@upstream-dispatch/api/client",
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/api/types",
      "@upstream-dispatch/features/agent-view/live-views",
      "@upstream-dispatch/features/agents/pins",
      "@upstream-dispatch/features/agents/unread",
      "@upstream-dispatch/features/refs/AgentName",
    ],
    "src/shell/sidebar-region.tsx": [
      "@upstream-dispatch/api/types",
      "@upstream-dispatch/features/issue-page/IconRail",
    ],
    "src/shell/sidebar.test.tsx": ["@upstream-dispatch/api/types"],
    "src/shell/sidebar.tsx": [
      "@upstream-dispatch/api/types",
      "@upstream-dispatch/features/agents/unread",
      "@upstream-dispatch/features/refs/AgentName",
    ],
    "src/shell/sign-in-page.tsx": [
      "@upstream-dispatch/features/writes/KeptWrites",
      "@upstream-dispatch/features/writes/write-store",
    ],
    "src/shell/sign-ins.ts": [
      "@upstream-dispatch/api/client",
      "@upstream-dispatch/api/query-client",
      "@upstream-dispatch/features/shell/sign-in-channel",
      "@upstream-dispatch/features/writes/write-store",
    ],
    "src/shell/signed-in-parts.test.tsx": [
      "@upstream-dispatch/features/doc/AskBlockCard",
      "@upstream-dispatch/features/refs/agent-registry",
      "@upstream-dispatch/features/refs/markdown-cards",
    ],
    "src/shell/signed-in-parts.tsx": [
      "@upstream-dispatch/features/doc/AskBlockCard",
      "@upstream-dispatch/features/refs/agent-registry",
      "@upstream-dispatch/features/refs/markdown-cards",
      "@upstream-dispatch/features/shell/KeymapProvider",
    ],
    "src/shell/status-corner.test.tsx": [
      "@upstream-dispatch/__tests__/fake-clock",
      "@upstream-dispatch/__tests__/live-socket-harness",
      "@upstream-dispatch/api/live-socket",
      "@upstream-dispatch/features/inbox/draft-store",
    ],
    "src/shell/status-corner.tsx": [
      "@upstream-dispatch/api/live-socket",
      "@upstream-dispatch/features/inbox/DraftsNotKept",
      "@upstream-dispatch/features/writes/PendingWritesIndicator",
      "@upstream-dispatch/hooks/useFootInset",
    ],
    "src/shell/use-agent-pins.test.tsx": [
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/features/agent-view/live-views",
      "@upstream-dispatch/features/shell/userPreference",
    ],
    "src/shell/use-agent-pins.ts": [
      "@upstream-dispatch/features/agent-view/live-views",
      "@upstream-dispatch/features/agents/pins",
      "@upstream-dispatch/features/shell/userPreference",
    ],
    "src/shell/use-details-drawer.test.tsx": ["@upstream-dispatch/features/issue-page/margin-slot"],
    "src/shell/use-details-drawer.ts": ["@upstream-dispatch/features/issue-page/margin-slot"],
    "src/shell/use-focus-main.test.tsx": ["@upstream-dispatch/features/refs/routes"],
    "src/shell/use-shell-layout.ts": [
      "@upstream-dispatch/features/issue-page/choice",
      "@upstream-dispatch/features/issue-page/margin-slot",
      "@upstream-dispatch/features/shell/useDialog",
      "@upstream-dispatch/features/shell/useKeyboardFit",
    ],
    "src/shell/use-shell-overlays.ts": ["@upstream-dispatch/features/issue-page/shell-navigation"],
    "src/shell/use-shell-preferences.test.tsx": [
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/features/margin/margin-width",
    ],
    "src/shell/use-shell-preferences.ts": [
      "@upstream-dispatch/features/margin/margin-width",
      "@upstream-dispatch/features/shell/userPreference",
    ],
    "src/shell/use-sign-in-channel.test.tsx": [
      "@upstream-dispatch/__tests__/network",
      "@upstream-dispatch/features/shell/sign-in-channel",
    ],
    "src/shell/use-sign-in-channel.ts": [
      "@upstream-dispatch/api/query-client",
      "@upstream-dispatch/features/shell/sign-in-channel",
      "@upstream-dispatch/features/writes/write-store",
    ],
    "src/shell/use-sign-out.test.tsx": [
      "@upstream-dispatch/__tests__/network",
      "@upstream-dispatch/features/writes/keyed-write",
    ],
    "src/shell/use-sign-out.ts": [
      "@upstream-dispatch/api/client",
      "@upstream-dispatch/features/shell/sign-in-channel",
      "@upstream-dispatch/features/writes/useKeyedWrite",
      "@upstream-dispatch/features/writes/write-store",
    ],
    "src/start.tsx": [
      "@upstream-dispatch/api/query-client",
      "@upstream-dispatch/features/shell/DeploymentResilience",
      "@upstream-dispatch/features/shell/ErrorBoundary",
    ],
    "src/writes/write-failure-note.test.ts": ["@upstream-dispatch/features/writes/keyed-write"],
    "src/writes/write-failure-note.ts": ["@upstream-dispatch/features/writes/keyed-write"],
    "tests/keymap.ts": ["@upstream-dispatch/features/shell/keymap"],
    "tests/machine-logins.tsx": ["@upstream-dispatch/api/types"],
    "tests/map/links.test.ts": ["@legion/contracts"],
    "tests/network.ts": ["@upstream-dispatch/__tests__/network"],
    "tests/repaint.test.ts": [
      "@upstream-dispatch/components/Pill",
      "@upstream-dispatch/features/project/UnreadDot",
      "@upstream-dispatch/theme/classes",
      "@upstream-dispatch/theme/contrast",
    ],
    "tests/shell-chunks.ts": ["@upstream-dispatch/features/margin/Margin"],
    "tests/writes.ts": [
      "@upstream-dispatch/__tests__/fake-clock",
      "@upstream-dispatch/api/client",
      "@upstream-dispatch/api/queries",
      "@upstream-dispatch/features/writes/write-store",
    ],
  },
};
