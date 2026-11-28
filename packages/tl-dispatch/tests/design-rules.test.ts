import { beforeAll, describe, expect, test } from "bun:test";
import { EXEMPT } from "./design-config";
import { type DesignViolation, designViolations, RULES, themeTokens } from "./design-rules";
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
  ["tsx", "<p style={{ textWrap: 'balance' }} />", "a style or a stylesheet"],
  ["tsx", "<p style={{ WebkitFontSmoothing: 'auto' }} />", "a style or a stylesheet"],
  ["tsx", "<p style={{ '--font-smoothing': 'auto' }} />", "a custom property"],
  ["tsx", "el.style.setProperty('Text-Wrap', 'balance');", "a style or a stylesheet"],
  ["tsx", "el.style.setProperty('-WEBKIT-FONT-SMOOTHING', 'auto');", "a style or a stylesheet"],
  ["tsx", "el.style.setProperty('HEIGHT', '30px');", "a height set in a style"],
  ["tsx", "el.style.setProperty('COLOR', 'red');", "a colour set in a style"],
  ["tsx", "<p style={{ textDecoration: 'underline red' }} />", "a colour set in a style"],
  ["tsx", "<p style={{ WebkitTransition: 'all 1s' }} />", "motion set in a style"],
  ["tsx", "<p style={{ msTransition: 'all 1s' }} />", "motion set in a style"],
  ["tsx", "<p style={{ webkitTransition: 'all 1s' }} />", "motion set in a style"],
  ["tsx", "<p style={{ 'webkit-transition': 'all 1s' }} />", "motion set in a style"],
  ["tsx", "<p style={{ WebkitLogicalHeight: 30 }} />", "a height set in a style"],
  ["tsx", "<p style={{ WebkitBorderStart: '1px solid red' }} />", "a colour set in a style"],
  ["tsx", "<p style={{ rowRule: '1px solid red' }} />", "a colour set in a style"],
  ["tsx", "<p style={{ minSize: 30 }} />", "a height set in a style"],
  ["tsx", "el.style.cssText += 'color: red';", "hides its properties"],
  ["tsx", "el.style.color ||= 'red';", "a colour set in a style"],
  ["tsx", "el.style.cssText &&= 'color: red';", "hides its properties"],
  ["tsx", "el.style['cssText'] = 'color: red';", "hides its properties"],
  ["tsx", "<p style={{ cssText: 'color: red' }} />", "hides its properties"],
  ["css", ".x { -webkit-border-start: 1px solid var(--nope); }", "colour outside"],
  ["css", ".x { -webkit-column-rule: 1px solid var(--nope); }", "colour outside"],
  ["tsx", "<p style={{ WebkitTextStroke: '1px red' }} />", "a colour set in a style"],
  [
    "tsx",
    "<p style={{ borderImage: 'linear-gradient(red, blue) 1' }} />",
    "a colour set in a style",
  ],
  ["tsx", "<p style={{ textEmphasis: 'dot red' }} />", "a colour set in a style"],
  ["tsx", "<p style={{ all: 'initial' }} />", "every property set in a style"],
  ["tsx", "(el.style).color = 'red';", "a colour set in a style"],
  ["tsx", "el.style!.color = 'red';", "a colour set in a style"],
  ["tsx", "(el.style).setProperty('color', 'red');", "a colour set in a style"],
  ["tsx", "el.style!.setProperty('color', 'red');", "a colour set in a style"],
  ["tsx", "Object.assign(el.style!, { color: 'red' });", "a colour set in a style"],
  ["tsx", "Object.assign((el.style), { color: 'red' });", "a colour set in a style"],
  ["tsx", "(el.style as CSSStyleDeclaration).color = 'red';", "a colour set in a style"],
  ["ts", "(<any>el.style).color = 'red';", "a colour set in a style"],
  ["tsx", "(el.style satisfies CSSStyleDeclaration).color = 'red';", "a colour set in a style"],
  ["tsx", "el['style'].color = 'red';", "a colour set in a style"],
  ["tsx", "(el.style.color) = 'red';", "a colour set in a style"],
  ["tsx", "(el.style.setProperty)('color', 'red');", "a colour set in a style"],
  ["tsx", "(el.attributeStyleMap).set('color', 'red');", "a colour set in a style"],
  ["tsx", "(Object.assign)(el.style, { color: 'red' });", "a colour set in a style"],
  [
    "css",
    ".x { -webkit-text-fill-color: color-mix(in oklab, var(--foreground) 40%, transparent); }",
    "reduced opacity",
  ],
  ["tsx", '<p className="[-epub-text-transform:uppercase]">', "raw size, weight"],
  ["css", ".x { -epub-text-emphasis: dot var(--nope); }", "colour outside"],
  ["tsx", "<p style={{ epubTextEmphasis: 'dot red' }} />", "a colour set in a style"],
  ["tsx", "<p style={{ EpubTextEmphasis: 'dot red' }} />", "a colour set in a style"],
  ["css", ".x { -webkit-transition: transform 1s; }", "motion only"],
  ["css", ".x { -webkit-animation: spin 1s; }", "motion only"],
  ["css", ".x { -webkit-transform: scale(1.1); }", "motion only"],
  ["css", ".x { -moz-transition: transform 1s; }", "motion only"],
  [
    "css",
    "@media (prefers-reduced-motion: no-preference) { .x { -webkit-transition: transform 1s; } }",
    "nothing scales",
  ],
  [
    "css",
    "@media (prefers-reduced-motion: no-preference) { .x { -webkit-transition: color 1s; } }",
    "opacity alone",
  ],
  ["tsx", "<p style={{ WebkitTransform: 'scale(1.1)' }} />", "motion set in a style"],
  ["tsx", "<p style={{ transform: 'translateX(4px)' }} />", "motion set in a style"],
  ["tsx", "<p style={{ listStyleImage: 'linear-gradient(red, blue)' }} />", "a colour set"],
  ["tsx", "<p style={{ listStyle: 'inside linear-gradient(red, blue)' }} />", "a colour set"],
  ["tsx", "<p style={{ colorScheme: 'dark' }} />", "a colour set in a style"],
  ["tsx", "<p style={{ zoom: 2 }} />", "a height set in a style"],
  ["tsx", "<p style={{ aspectRatio: '1' }} />", "a height set in a style"],
  ["tsx", "el.setAttribute('style', 'color: red');", "hides its properties"],
  ["tsx", "el.style.setProperty('cssText', 'color: red');", "hides its properties"],
  ["tsx", "el.attributeStyleMap.set('color', 'red');", "a colour set in a style"],
  ["tsx", "el.attributeStyleMap.append('transition', 'all 1s');", "motion set in a style"],
  ["tsx", "Object.assign(el.style, theme);", "so the rule can read it"],
  ["tsx", "Object.assign(el.style, { color: 'red' } as object);", "a colour set in a style"],
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
  ["tsx", '<h2 className="text-balance">', "`text-wrap*` property or font smoothing"],
  ["tsx", '<p className="wrap-pretty">', "`text-wrap*` property or font smoothing"],
  ["tsx", '<p className="[text-wrap-style:stable]">', "`text-wrap*` property or font smoothing"],
  ["tsx", '<p className="text-nowrap">', "`text-wrap*` property or font smoothing"],
  ["tsx", '<p className="subpixel-antialiased">', "`text-wrap*` property or font smoothing"],
  ["tsx", '<p className="[font-smooth:auto]">', "`text-wrap*` property or font smoothing"],
  ["jsx", '<p className="text-sky-700">', "raw colour"],
  ["css", ".x { color: #123456; }", "raw colour"],
  ["css", ".x { color: rebeccapurple; }", "raw colour"],
  ["css", ".x { border-radius: 6px; }", "radius"],
  ["css", ".x { outline: 2px solid var(--chart-5); }", "focus"],
  ["css", ".x { animation: spin 1s; }", "motion"],
  ["css", ".x { @apply bg-sky-700; }", "@apply"],
  ["css", ".x { text-wrap: balance; }", "`text-wrap*` property or font smoothing"],
  ["css", ".x { -webkit-font-smoothing: auto; }", "`text-wrap*` property or font smoothing"],
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
  ["tsx", '<p className="text-danger text-right truncate font-mono tabular-nums capitalize">'],
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
  ["tsx", "const lifestyle = { all: 1 };"],
  // Keys that set nothing: an odd-case dashed key, and a `setProperty` name with a vendor
  // prefix but no leading dash.
  ["tsx", "<p style={{ 'Box-Shadow': '0 0 1px red' }} />"],
  ["tsx", "<p style={{ '-Webkit-Transition': 'all 1s' }} />"],
  ["tsx", "el.style.setProperty('webkit-transition', 'all 1s');"],
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
