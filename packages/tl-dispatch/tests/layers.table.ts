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
  "only-the-app-imports-routes",
  "pages-load-lazily",
  "routes-draw-nothing",
] as const;

export type Rule = (typeof RULES)[number];

/**
 * The layers, highest first; each inner list is one row. A path is a folder (`src/shell`), a file
 * (`src/app/start.tsx`) or a pattern whose `*` is one path segment, so `src/features/*` is each
 * feature's folder and not a loose file beside them; the most specific match wins. The UI
 * package counts as above every layer.
 */
export const ROWS = [
  [{ layer: "browser", paths: ["src/browser"] }],
  [
    { layer: "upstream", paths: ["src/upstream"] },
    { layer: "stores", paths: ["src/stores"] },
  ],
  [{ layer: "data", paths: ["src/data"] }],
  [
    { layer: "commands", paths: ["src/commands"] },
    { layer: "navigation", paths: ["src/navigation"] },
    { layer: "loading", paths: ["src/loading"] },
  ],
  [{ layer: "parts", paths: ["src/parts/*"] }],
  [{ layer: "features", paths: ["src/features/*"] }],
  [{ layer: "shell", paths: ["src/shell"] }],
  [{ layer: "routes", paths: ["src/features/*/route.tsx", "src/features/*/route.ts"] }],
  [{ layer: "app", paths: ["src/app"] }],
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
];

/**
 * The readers of each seam file and each root file. A `<page>` in a reader stands for the
 * `<page>` of the file read. A seam file may read another, and a test may read each one; a seam
 * file or a root file that this table does not list has no other reader. A file of no layer reads
 * `src/app` only as its entry here says.
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
  // The entry runs once a process, so one test loads it.
  "src/main.tsx": ["tests/main.test.tsx"],
  // The composition root: only the entry starts it, and a test may draw it.
  "src/app": ["src/main.tsx"],
  "src/*.css": ["src/main.tsx", "src/styles.css"],
};

/**
 * The page modules that load before first paint, each with its reason: a page is eager because
 * its route imports its `page.tsx` statically, and a feature's other file or an upstream view
 * because an eager page imports it. Every other page and upstream view loads with `import()`.
 * `scripts/check-entry-modules.ts` reads this table too. A new entry is refused in review.
 */
export const EAGER: Readonly<Record<string, string>> = {
  "src/features/inbox/page.tsx": "the home page draws at first paint, with no loading fallback",
  "src/features/machine-login/page.tsx":
    "upstream draws it at first paint; a lazy page would show the skeleton first",
  "src/features/not-found/page.tsx":
    "upstream draws it at first paint; a lazy page would show the skeleton first",
  "src/features/not-found/not-found.tsx": "the not-found and machine login pages draw it",
  "src/upstream/views/inbox/inbox.tsx": "the home page draws it at first paint",
};

/**
 * What a route file may import for its values, each with its reason; it may also import the pages
 * `EAGER` names. A folder covers the files under it.
 */
export const ROUTE_IMPORTS: Readonly<Record<string, string>> = {
  "src/navigation": "the route's addresses, pageRoute and Redirect",
  "src/data/prefetch.ts": "prefetchOf, which starts the page's first reads",
  "src/loading/lazy-named.ts": "the lazy element of the page",
  "src/upstream/queries.ts": "the page's first reads",
  "src/upstream/widgets/live-views.tsx": "LiveViewRoute draws nothing: the shell mounts live views",
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
    owners: ["navigation", "app"],
    tests: true,
    reason:
      "only src/navigation and src/app import the router, so a router move changes two folders",
  },
  {
    name: /^@tanstack\/react-query$/,
    owners: ["data", "app"],
    tests: true,
    reason: "a fork view reads and writes through src/data, never through the query library",
  },
  {
    name: /^zustand(\/|$)/,
    owners: ["stores"],
    tests: false,
    reason: "what the browser keeps is in src/stores; the app reads it through each store",
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
  "library-owners": {
    "src/features/machine-login/page.tsx": ["@tanstack/react-query"],
    "src/features/machine-login/machine-logins.tsx": ["@tanstack/react-query"],
    "src/features/machine-login/use-machine-login.ts": ["@tanstack/react-query"],
    "src/features/machine-login/use-revoke.ts": ["@tanstack/react-query"],
  },
  "seam-readers": {
    "src/features/agents/route.tsx": ["@/upstream/queries", "@/upstream/widgets/live-views"],
    "src/features/inbox/route.tsx": ["@/upstream/queries"],
    "src/features/issue/route.tsx": ["@/upstream/queries"],
    "src/features/priorities/route.tsx": ["@/upstream/queries"],
    "src/features/machine-login/decision-buttons.tsx": [
      "@/upstream/api",
      "@/upstream/contract",
      "@/upstream/writes",
    ],
    "src/features/machine-login/machine-login-page.tsx": [
      "@/upstream/api",
      "@/upstream/logic/machine-login",
    ],
    "src/features/machine-login/page.tsx": ["@/upstream/queries"],
    "src/features/machine-login/machine-logins.tsx": [
      "@/upstream/contract",
      "@/upstream/logic/machine-login",
      "@/upstream/queries",
      "@/upstream/writes",
    ],
    "src/features/machine-login/record-facts.tsx": ["@/upstream/contract"],
    "src/features/machine-login/use-machine-login.ts": [
      "@/upstream/api",
      "@/upstream/contract",
      "@/upstream/queries",
      "@/upstream/writes",
    ],
    "src/features/machine-login/use-revoke.ts": [
      "@/upstream/api",
      "@/upstream/contract",
      "@/upstream/queries",
      "@/upstream/writes",
    ],
  },
};
