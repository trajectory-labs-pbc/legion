import { beforeAll, describe, expect, test } from "bun:test";
import { EXEMPT } from "./design-config";
import {
  compiledDeclarations,
  type DesignViolation,
  designViolations,
  RULES,
  themeTokens,
} from "./design-rules";
import { sourceFiles } from "./source";

/** Each control is a file of its own; one compile checks them all, and each test reads its file. */
const REFUSED: readonly [string, string, string][] = [
  ["tsx", '<p className="bg-[red]">', "raw colour"],
  ["tsx", '<p className="bg-[color:#123456]">', "raw colour"],
  ["tsx", '<p className="shadow-[0_0_0_1px_#123456]">', "raw colour"],
  ["tsx", '<p className="text-sky-700">', "raw colour"],
  ["tsx", '<p className="hover:bg-slate-100/50">', "raw colour"],
  ["tsx", '<p className="text-white">', "raw colour"],
  ["tsx", '<p className="bg-page-paper">', "raw colour"],
  ["tsx", '<p className="shadow-sm">', "raw colour"],
  ["tsx", '<p className="bg-(--brand)">', "outside the theme"],
  ["tsx", '<p className="text-muted-foreground/40">', "reduced opacity"],
  ["tsx", '<a className="focus-visible:ring-ring/50">', "focus"],
  ["tsx", '<a className="focus-visible:outline-chart-5">', "focus"],
  ["tsx", '<a className="ring-chart-3">', "focus"],
  ["tsx", '<a className="outline-focus/60">', "focus"],
  ["tsx", '<p className="rounded-(--x)">', "radius"],
  ["tsx", '<p className="rounded-[6px]">', "radius"],
  ["tsx", '<p className="rounded-xs">', "radius"],
  ["tsx", '<span className="rounded-full px-2">', "only a dot or an avatar is round"],
  ["tsx", 'const BADGE = "md:rounded-full bg-card";', "only a dot or an avatar is round"],
  ["tsx", '<span className="rounded-full size-fit">', "only a dot or an avatar is round"],
  ["tsx", '<span className="rounded-full size-auto">', "only a dot or an avatar is round"],
  ["tsx", '<span className="rounded-full size-full">', "only a dot or an avatar is round"],
  ["tsx", '<span className="rounded-l-full rounded-r-full">', "radius"],
  ["tsx", '<span className="rounded-s-full rounded-e-full">', "radius"],
  ["tsx", '<span className="rounded-t-full rounded-b-full">', "radius"],
  ["tsx", '<span className="size-2 rounded-tl-full">', "radius"],
  ["tsx", '<p className="rounded-2xl">', "radius"],
  ["tsx", '<p className="rounded-3xl">', "radius"],
  ["tsx", '<p className="rounded-[calc(var(--radius)*2)]">', "radius"],
  ["css", ".x { border-radius: calc(var(--radius-lg) * 2); }", "radius"],
  ["css", ".x { --tw-shadow: var(--shadow-lg); }", "colour outside"],
  ["tsx", '<p className="rounded-[calc(infinity*1px)]">', "radius"],
  ["css", ".x { border-radius: calc(infinity * 1px); }", "radius"],
  ["tsx", '<div className="transition-all">', "motion"],
  ["tsx", '<div className="translate-x-1">', "motion"],
  ["tsx", '<div className="hover:scale-105">', "motion"],
  ["tsx", '<div className="animate-spin">', "motion"],
  ["tsx", '<button className="motion-safe:active:scale-[0.96]">', "nothing scales"],
  ["tsx", '<button className="motion-safe:active:not-disabled:scale-95">', "nothing scales"],
  ["tsx", '<button className="motion-safe:transition-[color,scale]">', "nothing scales"],
  ["tsx", '<button className="motion-safe:transition">', "nothing scales"],
  ["tsx", '<a className="motion-safe:transition-colors">', "opacity alone"],
  ["tsx", '<div className="z-50">', "a layer names its theme token"],
  ["css", ".x { z-index: 50; }", "a layer names its theme token"],
  ["tsx", "<p style={{ zIndex: 50 }} />", "a layer set in a style"],
  ["tsx", '<div className="z-(--layer-bogus)">', "a layer names its theme token"],
  [
    "tsx",
    '<div className="motion-safe:duration-(--duration-slow)">',
    "a fade's length names its theme token",
  ],
  [
    "css",
    "@media (prefers-reduced-motion: no-preference) { .x { transition-property: opacity; transition-duration: var(--duration-bogus); } }",
    "a fade's length names its theme token",
  ],
  ["tsx", '<div className="[--layer-overlay:9999] z-overlay">', "declared in the theme alone"],
  ["css", ":root { --layer-overlay: 9999; }", "declared in the theme alone"],
  ["css", ":root { --duration-popup: 2s; }", "declared in the theme alone"],
  ["css", ":root { --default-transition-duration: 2s; }", "declared in the theme alone"],
  [
    "tsx",
    '<div className="[--default-transition-duration:2s] motion-safe:transition-opacity">',
    "declared in the theme alone",
  ],
  [
    "css",
    '@property --duration-popup { syntax: "<time>"; inherits: false; initial-value: 2s; }',
    "declared in the theme alone",
  ],
  ["css", "@theme inline { --opacity-disabled: 1; }", "declared in the theme alone"],
  ["css", "@theme inline { --z-index-overlay: 9999; }", "declared in the theme alone"],
  ["css", "@theme { --transition-duration-popup: 2s; }", "declared in the theme alone"],
  ["css", "@theme inline { --z-index-top: 9999; }", "declared in the theme alone"],
  ["css", "@theme inline { --transition-duration-slow: 2s; }", "declared in the theme alone"],
  ["css", "@theme { --z-index-*: initial; }", "declared in the theme alone"],
  [
    "css",
    "@property --z-index-overlay { syntax: '*'; inherits: false; initial-value: 9999; }",
    "declared in the theme alone",
  ],
  [
    "css",
    "@layer properties { :root { --layer-overlay: 9999 !important; } }",
    "declared in the theme alone",
  ],
  ["css", "@keyframes k { to { --layer-overlay: 9999; } }", "declared in the theme alone"],
  ["css", ":root { --\\6c ayer-overlay: 9999; }", "declared in the theme alone"],
  [
    "tsx",
    '<div className="motion-safe:transition-opacity motion-safe:duration-150">',
    "a fade's length names its theme token",
  ],
  [
    "tsx",
    '<div className="motion-safe:[transition:opacity_1s]">',
    "a fade's length names its theme token",
  ],
  [
    "css",
    "@media (prefers-reduced-motion: no-preference) { .x { transition: opacity var(--duration-popup); } }",
    "a fade's length names its theme token",
  ],
  [
    "css",
    "@media (prefers-reduced-motion: no-preference) { .x { transition-duration: 150ms; } }",
    "a fade's length names its theme token",
  ],
  ["tsx", '<a className="transition-colors">', "opacity alone"],
  ["tsx", '<a className="motion-safe:transition-[background-color]">', "opacity alone"],
  [
    "css",
    "@media (prefers-reduced-motion: no-preference) { .x { transition: opacity 150ms, color 150ms; } }",
    "opacity alone",
  ],
  ["tsx", '<button className="cursor-pointer">', "default cursor"],
  ["tsx", '<a className="hover:cursor-pointer">', "default cursor"],
  ["tsx", "<p style={{ cursor: 'pointer' }} />", "a cursor set in a style"],
  ["tsx", "<p style={{ scale: 0.96 }} />", "a scale set in a style"],
  ["tsx", '<input accept="image/*" />;\n<p className="text-sky-700" />; // */', "raw colour"],
  ["tsx", "<p style={{ borderRadius: 3 }} />", "a radius set in a style"],
  ["tsx", '<p style={{ color: "var(--card)" }} />', "a colour set in a style"],
  ["tsx", '<p style={{ "--background": "#fff" }} />', "a custom property"],
  ["tsx", "<p style={{ transition: 'all 1s' }} />", "motion set in a style"],
  ["tsx", "<p style={{ minHeight: 30 }} />", "a height set in a style"],
  ["tsx", "<p style={styles} />", "object literal"],
  ["tsx", "const panelStyle = { backgroundColor: 'red' };", "a colour set in a style"],
  ["tsx", "element.style.borderRadius = '4px';", "a radius set in a style"],
  ["tsx", "element.style.setProperty('--card', 'red');", "a custom property"],
  ["tsx", "<style>{'.x { color: red }'}</style>", "inline stylesheet"],
  ["tsx", 'import { card } from "@upstream-dispatch/theme/classes";', "upstream's theme roles"],
  ["tsx", '<button className="h-10">', "control height"],
  ["tsx", '<button className="md:h-[30px]">', "control height"],
  ["tsx", '<input type="checkbox" className="size-5" />', "control height"],
  ["tsx", '<Button className="h-8">', "control height"],
  ["tsx", '<p className="text-sm">', "raw size, weight"],
  ["tsx", '<p className="md:text-xs/5">', "raw size, weight"],
  ["tsx", '<p className="font-medium">', "raw size, weight"],
  ["tsx", '<p className="leading-none">', "raw size, weight"],
  ["tsx", '<p className="tracking-widest">', "raw size, weight"],
  ["tsx", '<p className="uppercase">', "raw size, weight"],
  ["tsx", '<p className="lowercase">', "raw size, weight"],
  ["tsx", '<p className="text-[13px]">', "raw size, weight"],
  ["tsx", '<p className="md:font-[550]">', "raw size, weight"],
  ["tsx", '<p className="text-(length:--size)">', "raw size, weight"],
  ["tsx", '<p className="text-[length:var(--size)]">', "raw size, weight"],
  ["tsx", '<p className="text-[calc(1rem+1px)]">', "raw size, weight"],
  ["tsx", '<p className="font-(weight:--weight)">', "raw size, weight"],
  ["tsx", '<p className="[font-size:13px]">', "raw size, weight"],
  ["tsx", '<p className="md:[font-weight:550]">', "raw size, weight"],
  ["tsx", '<p className="[line-height:2]">', "raw size, weight"],
  ["tsx", '<p className="[letter-spacing:.1em]">', "raw size, weight"],
  ["tsx", '<p className="[text-transform:uppercase]">', "raw size, weight"],
  ["jsx", '<p className="text-sky-700">', "raw colour"],
  ["css", ".x { color: #123456; }", "raw colour"],
  ["css", ".x { color: rebeccapurple; }", "raw colour"],
  ["css", ".x { border-radius: 6px; }", "radius"],
  ["css", ".x { outline: 2px solid var(--chart-5); }", "focus"],
  ["css", ".x { animation: spin 1s; }", "motion"],
  ["css", ".x { @apply bg-sky-700; }", "@apply"],
];

const ALLOWED: readonly [string, string][] = [
  ["tsx", '<p className="text-foreground bg-card border-border bg-card/50 hover:bg-muted">'],
  ["tsx", '<p className="rounded-md rounded-t-lg rounded-none">'],
  ["tsx", '<span className="size-2 rounded-full bg-primary">'],
  ["tsx", '<span className="size-2.5 rounded-full md:rounded-full">'],
  ["tsx", '<p className="rounded-none rounded-sm rounded-md rounded-lg rounded-xl rounded-t-md">'],
  ["tsx", '<span className="rounded-badge">'],
  ["css", ".x { border-radius: var(--radius-badge); }"],
  ["css", ".x { --tw-shadow: var(--shadow-popover); }"],
  ["tsx", '<button className="h-8 px-3">'],
  ["tsx", '<button className="min-h-11">'],
  ["tsx", '<input type="checkbox" className="size-4" />'],
  ["tsx", '<p className="text-danger text-right text-pretty font-mono tabular-nums capitalize">'],
  [
    "tsx",
    '<a className="outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">',
  ],
  ["tsx", '<div className="motion-safe:animate-spin motion-safe:transition-opacity">'],
  ["tsx", '<div className="motion-safe:transition-[opacity] motion-safe:transition-none">'],
  ["tsx", '<div className="z-raised focus:z-overlay">'],
  ["tsx", '<div className="!z-overlay">'],
  ["tsx", '<div className="!rounded-sm">'],
  ["tsx", '<div className="motion-safe:!transition-opacity">'],
  ["tsx", '<a className="outline-hidden focus-visible:outline-2 focus-visible:!outline-focus">'],
  [
    "tsx",
    '<div className="motion-safe:transition-opacity motion-safe:duration-popup md:motion-safe:duration-modal">',
  ],
  ["css", ".x { z-index: var(--layer-overlay); }"],
  [
    "css",
    "@media (prefers-reduced-motion: no-preference) { .x { transition-property: opacity; transition-duration: var(--duration-modal); } }",
  ],
  ["tsx", '<a href="#b-r1">'],
  ["tsx", "<p style={{ top: 4, width: '50%' }} />"],
  ["css", "@media (prefers-reduced-motion: no-preference) { .x { animation: spin 1s; } }"],
  ["css", ":root { --input: color-mix(in srgb, var(--foreground) 48%, var(--background)); }"],
  // A stylesheet answers upstream's markup, so it may set type; a class may not.
  ["css", ".x { font-size: 13px; font-weight: 500; }"],
];

/** Controls whose path decides: each file, its text, and the rules it breaks, none if allowed. */
const PLACED: readonly [string, string, readonly string[]][] = [
  ["src/features/inbox/fetch.tsx", 'fetch("/api/v1/inbox");', [RULES.network]],
  ["src/shell/socket.tsx", "new WebSocket(url);", [RULES.network]],
  ["src/parts/asks/events.tsx", "new window.EventSource(url);", [RULES.network]],
  ["src/shell/global-fetch.tsx", 'globalThis.fetch("/x");', [RULES.network]],
  ["src/shell/self-fetch.tsx", 'self.fetch("/x");', [RULES.network]],
  ["src/shell/window-window.tsx", 'globalThis.window.fetch("/x");', [RULES.network]],
  ["src/shell/keyed-fetch.tsx", 'window["fetch"]("/x");', [RULES.network]],
  ["src/data/inbox/fetch.ts", 'fetch("/api/v1/inbox");', []],
  ["src/upstream/fetch.ts", "new WebSocket(url);", []],
  [
    "src/shell/own-fetch.tsx",
    'const fetch = () => 1;\nfetch();\nclient.fetch("/x");',
    [RULES.network, RULES.network],
  ],
  [
    "src/shell/caught-fetch.tsx",
    "try {\n  go();\n} catch (fetch) {\n  log(fetch);\n}",
    [RULES.network, RULES.network],
  ],
  ["src/data/inbox/query.ts", "whoAmIQuery();", [RULES.session]],
  ["src/data/inbox/api.ts", "api.whoAmI();", [RULES.session]],
  ["src/data/inbox/key.ts", 'const key = ["whoami"];', [RULES.session]],
  [
    "src/data/inbox/alias.ts",
    'import { api as a } from "@/upstream/api";\na.whoAmI();',
    [RULES.session],
  ],
  ["src/data/inbox/taken.ts", "const { whoAmI } = api;\nwhoAmI();", [RULES.session, RULES.session]],
  ["src/data/inbox/keyed.ts", 'api["whoAmI"]();', [RULES.session]],
  ["src/data/session.ts", 'whoAmIQuery();\napi.whoAmI();\nconst key = ["whoami"];', []],
  ["src/shell/local.tsx", 'localStorage.getItem("k");', [RULES.storage]],
  ["src/stores/x.ts", 'window.localStorage.getItem("k");', []],
  ["src/stores.ts", 'window.localStorage.getItem("k");', [RULES.storage]],
  ["src/browser/storage.test-helper.ts", 'window.localStorage.getItem("k");', [RULES.storage]],
  ["src/shell/indexed.tsx", 'indexedDB.open("d");', [RULES.storage]],
  ["src/shell/session-storage.tsx", 'window.sessionStorage.setItem("k", "v");', [RULES.storage]],
  ["src/shell/global-storage.tsx", "globalThis.localStorage.clear();", [RULES.storage]],
  [
    "src/shell/view-storage.tsx",
    'document.defaultView?.localStorage.getItem("k");',
    [RULES.storage],
  ],
  ["src/shell/alias.tsx", 'const w = window;\nw.localStorage.getItem("k");', [RULES.globalAlias]],
  [
    "src/shell/default-alias.tsx",
    'function f(w = window) {\n  return w.fetch("/x");\n}',
    [RULES.globalAlias],
  ],
  [
    "src/shell/assigned-alias.tsx",
    'let w;\nw = window;\nw.localStorage.getItem("k");',
    [RULES.globalAlias],
  ],
  [
    "src/shell/taken-storage.tsx",
    'const { localStorage } = window;\nlocalStorage.getItem("k");',
    [RULES.globalAlias, RULES.storage, RULES.storage],
  ],
  ["src/shell/renamed-storage.tsx", "const { localStorage: kept } = self;", [RULES.globalAlias]],
  [
    "src/browser/unload.ts",
    'localStorage.getItem("k");\nwindow.addEventListener("beforeunload", ask);',
    [RULES.storage],
  ],
  [
    "src/browser/storage.ts",
    'window.localStorage.getItem("k");\nconfirm("?");\nalert("!");\nprompt("?");',
    [RULES.dialog, RULES.dialog, RULES.dialog],
  ],
  [
    "src/shell/dialogs.tsx",
    'confirm("?");\nalert("!");\nprompt("?");',
    [RULES.dialog, RULES.dialog, RULES.dialog],
  ],
  [
    "src/shell/window-dialogs.tsx",
    'window.confirm("?");\nwindow.alert("!");\nwindow.prompt("?");',
    [RULES.dialog, RULES.dialog, RULES.dialog],
  ],
  [
    "src/shell/global-dialogs.tsx",
    'globalThis.confirm("?");\nglobalThis.alert("!");\nglobalThis.prompt("?");',
    [RULES.dialog, RULES.dialog, RULES.dialog],
  ],
  [
    "src/shell/own-confirm.tsx",
    "function Menu({ confirm }) {\n  return confirm;\n}",
    [RULES.dialog, RULES.dialog],
  ],
  ["src/shell/confirm-member.tsx", "const out = { confirm: () => 1 };\nsignOut.confirm();", []],
  ["src/shell/unload.tsx", 'window.addEventListener("beforeunload", ask);', [RULES.unload]],
  ["src/shell/onunload.tsx", "window.onbeforeunload = ask;", [RULES.unload]],
  ["src/shell/bare-onunload.tsx", "onbeforeunload = ask;", [RULES.unload]],
  ["src/shell/frame-onunload.tsx", "frame.contentWindow.onbeforeunload = ask;", [RULES.unload]],
];

const controlPath = (index: number, extension: string) =>
  `src/${extension === "css" ? "shell" : "features/x"}/control-${index}.${extension}`;

let found: DesignViolation[] = [];
const rulesOf = (path: string) =>
  found.filter((violation) => violation.file === path).map((violation) => violation.rule);

const MAPS_UPSTREAM = {
  path: "src/features/x/x.tsx",
  text: 'export const page = { server: "upstream" };\n<p className="text-sky-700" />;',
};
const LINES = {
  path: "src/features/x/lines.tsx",
  text: `"${"✓".repeat(10)}";\n<p className="text-sky-700" />\n;`,
};

beforeAll(async () => {
  const controls = [...REFUSED, ...ALLOWED].map(([extension, text], index) => ({
    path: controlPath(index, extension),
    text,
  }));
  const placed = PLACED.map(([path, text]) => ({ path, text }));
  found = await designViolations([...controls, ...placed, MAPS_UPSTREAM, LINES]);
});

describe("design rules", () => {
  test("the app's own files keep them, the exempt files aside", async () => {
    expect(await designViolations(sourceFiles())).toEqual([]);
  });

  test("each exempt file still breaks a rule, so a rebuilt one leaves the list", async () => {
    // One compile per file: a compiled class can name another file's class as its source.
    const files = new Map(sourceFiles().map((file) => [file.path, file]));
    const clean: string[] = [];
    for (const path of Object.keys(EXEMPT)) {
      const file = files.get(path);
      if (file === undefined || (await designViolations([file], { exempt: {} })).length === 0)
        clean.push(path);
    }
    expect(clean).toEqual([]);
  });

  test("compiles each layer, fade and the disabled look to its theme token", async () => {
    const classes = [
      "z-raised",
      "z-overlay",
      "duration-popup",
      "duration-modal",
      "opacity-disabled",
    ];
    const compiled = (await compiledDeclarations(classes))
      .filter(({ property }) => ["z-index", "transition-duration", "opacity"].includes(property))
      .map(({ property, value }) => `${property}: ${value}`);
    expect(compiled.sort()).toEqual([
      "opacity: var(--disabled-opacity)",
      "transition-duration: var(--duration-modal)",
      "transition-duration: var(--duration-popup)",
      "z-index: var(--layer-overlay)",
      "z-index: var(--layer-raised)",
    ]);
  });

  test("takes corners, layers and fades from the theme alone: one the app declares is none", () => {
    const tokens = themeTokens(
      ":root { --radius: 8px; --radius-sm: calc(var(--radius) * 0.5); --layer-top: 10; --duration-quick: 150ms; } @theme inline { --z-index-top: var(--layer-top); --color-x: var(--brand); }",
      ":root { --radius-card: 3px; --brand: var(--primary); --layer-app: 20; --duration-app: 1s; } @theme inline { --z-index-app: var(--layer-top); }"
    );
    expect([...tokens.radii]).toEqual(["--radius", "--radius-sm"]);
    expect([...tokens.radiusValues]).toEqual(["var(--radius)", "calc(var(--radius) * 0.5)"]);
    expect([...tokens.layers]).toEqual(["--layer-top"]);
    expect([...tokens.durations]).toEqual(["--duration-quick"]);
    expect(tokens.colours.has("--brand")).toBe(true);
  });

  test("a file is exempt only by the list: a file that says it maps upstream is checked", () => {
    expect(rulesOf(MAPS_UPSTREAM.path).join()).toContain("raw colour");
  });

  test("a class's violation names the line it is on, past multi-byte text", () => {
    const line = found.find(
      (violation) => violation.file === LINES.path && violation.text === "text-sky-700"
    )?.line;
    expect(line).toBe(2);
  });

  test.each(
    REFUSED.map((control, index) => [index, ...control] as const)
  )("refuses control %d (%s): %s", (index, extension, _text, rule) => {
    expect(rulesOf(controlPath(index, extension)).join("\n")).toContain(rule);
  });

  test.each(PLACED)("%s: %s", (path, _text, rules) => {
    expect(rulesOf(path)).toEqual([...rules]);
  });

  test.each(
    ALLOWED.map((control, index) => [REFUSED.length + index, ...control] as const)
  )("allows control %d (%s): %s", (index, extension) => {
    expect(rulesOf(controlPath(index, extension))).toEqual([]);
  });
});
