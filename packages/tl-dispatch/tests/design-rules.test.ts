import { beforeAll, describe, expect, test } from "bun:test";
import { EXEMPT } from "./design-config";
import { type DesignViolation, designViolations, RULES, themeTokens } from "./design-rules";
import { sourceFiles, uiSourceFiles } from "./source";

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
  ["tsx", '<p className="border-l border-l-primary">', "coloured left border"],
  ["tsx", '<p className="border-s-2 border-s-danger">', "coloured left border"],
  ["tsx", '<p className="border-x border-x-primary">', "coloured left border"],
  ["tsx", '<p className="border-l-4 border-primary">', "coloured left border"],
  ["tsx", 'const ROW = "md:border-l-2 rounded-md md:border-danger";', "coloured left border"],
  [
    "tsx",
    '<p className={cn("border-l-4 pl-2", on && "border-primary")} />',
    "coloured left border",
  ],
  [
    "tsx",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the text is a control file's source, whose template the rule reads
    'const ACCENT = "border-primary";\n<p className={`border-l-2 pl-2 ${ACCENT}`} />;',
    "coloured left border",
  ],
  [
    "tsx",
    'const row = cva("border-l-4", { variants: { tone: { danger: "border-danger" } } });',
    "coloured left border",
  ],
  ["tsx", '<p className="[border-left:3px_solid_var(--primary)]">', "coloured left border"],
  ["css", ".row { border-left: 3px solid var(--primary); }", "coloured left border"],
  // A left width alone takes the text's colour; a neutral colour of another variant leaves it.
  ["tsx", '<p className="border-l-4 pl-3">', "coloured left border"],
  ["tsx", '<p className="border-l-4 border-primary dark:border-l-border">', "coloured left border"],
  ["tsx", '<p className="has-[>svg]:border-l-4 border-primary">', "coloured left border"],
  ["tsx", 'const row = clsx("border-l-2", on && "border-primary");', "coloured left border"],
  [
    "tsx",
    'const TONE = { danger: "border-danger" };\n<p className={cn("border-l-4", TONE.danger)} />;',
    "coloured left border",
  ],
  [
    "tsx",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the text is a control file's source, whose template the rule reads
    'const ACCENT = "border-primary";\nconst x = textVariants({ className: `border-l-2 ${ACCENT}` });',
    "coloured left border",
  ],
  ["css", ".row { border-left-width: 4px; border-color: var(--primary); }", "coloured left border"],
  [
    "css",
    ".row { border: solid var(--primary); border-width: 0 0 0 4px; }",
    "coloured left border",
  ],
  ["css", ".row { border-inline-start-color: var(--danger); }", "coloured left border"],
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
  ["css", "@media (prefers-reduced-motion: no-preference) { .x { transition: opacity 150ms; } }"],
  [
    "css",
    "@media (prefers-reduced-motion: no-preference) { .x { transition: opacity 150ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms var(--ease, ease-in); } }",
  ],
  ["tsx", '<a href="#b-r1">'],
  ["tsx", "<p style={{ top: 4, width: '50%' }} />"],
  ["css", "@media (prefers-reduced-motion: no-preference) { .x { animation: spin 1s; } }"],
  ["css", ":root { --input: color-mix(in srgb, var(--foreground) 48%, var(--background)); }"],
  // A stylesheet answers upstream's markup, so it may set type; a class may not.
  ["css", ".x { font-size: 13px; font-weight: 500; }"],
  // A left edge in the neutral colour, a whole box in a colour, and a left edge of no width.
  ["tsx", '<p className="border-l-2 border-border border-l-transparent">'],
  ["tsx", '<p className="border border-primary">'],
  ["tsx", '<p className="border-l-0 border-primary">'],
  // Dividers between children, a coloured box whose left edge is neutral, a neutral shorthand.
  ["tsx", '<div className="flex divide-x border border-primary">'],
  ["tsx", '<div className="flex divide-y divide-primary border-l-2 border-border">'],
  ["tsx", '<p className="border-l-4 border-primary border-l-border">'],
  ["tsx", '<p className={cn("border-l-2", on && "border-border")} />'],
  ["css", ".row { border-left: 1px solid var(--border); }"],
  // A neutral left edge, half of an element's classes in a constant, the theme's width token in a
  // shorthand, a coloured whole box, and a neutral left colour of the width's own variant.
  ["tsx", '<p className="border-l-2 border-border">'],
  ["tsx", 'const EDGE = "border-l-2";'],
  ["css", ".row { border-left: var(--border-width) solid var(--border); }"],
  ["css", ".box { border-width: var(--border-width); border-color: var(--primary); }"],
  ["tsx", '<p className="md:border-l-4 md:border-l-border border-primary">'],
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
  // A list row's height is one of the two row tokens, on the row and on each of its parts.
  ["src/shell/row-tall.tsx", '<ListRow className="h-[56px]" title="t" />;', [RULES.rowHeight]],
  [
    "src/shell/row-part.tsx",
    '<ListRow leading={<span className="h-14" />} title="t" />;\n<div className="h-14" />;',
    [RULES.rowHeight],
  ],
  ["src/features/x/row.tsx", '<span className="min-h-10" />;', [RULES.rowHeight]],
  [
    "src/shell/row-tokens.tsx",
    '<ListRow className="h-list-row-2" title="t" />;\n<GroupHeader className="h-list-row-1" />;',
    [],
  ],
  // The stripe rule reads the UI package's files too.
  [
    "../ui/src/components/stripe.tsx",
    '<p className="border-l border-l-primary" />;',
    [RULES.stripe],
  ],
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
  // One compile reads both packages; of the UI package's files, the suite checks the stripe rule.
  test("the app's own files keep them, the exempt files aside, and the UI draws no stripe", async () => {
    const found = await designViolations([...sourceFiles(), ...uiSourceFiles()]);
    const ui = (violation: DesignViolation) => violation.file.startsWith("../ui/");
    expect(found.filter((violation) => !ui(violation))).toEqual([]);
    expect(found.filter((violation) => ui(violation) && violation.rule === RULES.stripe)).toEqual(
      []
    );
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

  test("takes corners from the theme alone: a corner token the app declares is none", () => {
    const tokens = themeTokens(
      ":root { --radius: 8px; --radius-sm: calc(var(--radius) * 0.5); }",
      ":root { --radius-card: 3px; --brand: var(--primary); }"
    );
    expect([...tokens.radii]).toEqual(["--radius", "--radius-sm"]);
    expect([...tokens.radiusValues]).toEqual(["var(--radius)", "calc(var(--radius) * 0.5)"]);
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
