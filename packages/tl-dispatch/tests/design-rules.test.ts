import { beforeAll, describe, expect, test } from "bun:test";
import { EXEMPT } from "./design-config";
import { type DesignViolation, designViolations, themeTokens } from "./design-rules";
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
  [
    "tsx",
    '<a className="outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">',
  ],
  [
    "tsx",
    '<div className="motion-safe:animate-spin motion-safe:transition-colors motion-safe:transition-opacity">',
  ],
  ["tsx", '<a href="#b-r1">'],
  ["tsx", "<p style={{ top: 4, width: '50%' }} />"],
  ["css", "@media (prefers-reduced-motion: no-preference) { .x { animation: spin 1s; } }"],
  ["css", ":root { --input: color-mix(in srgb, var(--foreground) 48%, var(--background)); }"],
];

const controlPath = (index: number, extension: string) =>
  `src/${extension === "css" ? "shell" : "pages"}/control-${index}.${extension}`;

let found: DesignViolation[] = [];
const rulesOf = (path: string) =>
  found.filter((violation) => violation.file === path).map((violation) => violation.rule);

const MAPS_UPSTREAM = {
  path: "src/pages/x.tsx",
  text: 'export const page = { server: "upstream" };\n<p className="text-sky-700" />;',
};
const LINES = {
  path: "src/pages/lines.tsx",
  text: '"é ü — ✓";\n\n<p className="text-sky-700" />;',
};

beforeAll(async () => {
  const controls = [...REFUSED, ...ALLOWED].map(([extension, text], index) => ({
    path: controlPath(index, extension),
    text,
  }));
  found = await designViolations([...controls, MAPS_UPSTREAM, LINES]);
});

describe("design rules", () => {
  test("the app's own files keep them, the exempt files aside", async () => {
    expect(await designViolations(sourceFiles())).toEqual([]);
  });

  test("each exempt file still breaks a rule, so a rebuilt one leaves the list", async () => {
    const exempt = sourceFiles().filter((file) => EXEMPT[file.path] !== undefined);
    const breaking = new Set(
      (await designViolations(exempt, { exempt: {} })).map((violation) => violation.file)
    );
    expect(Object.keys(EXEMPT).filter((path) => !breaking.has(path))).toEqual([]);
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
    expect(line).toBe(3);
  });

  test.each(
    REFUSED.map((control, index) => [index, ...control] as const)
  )("refuses control %d (%s): %s", (index, extension, _text, rule) => {
    expect(rulesOf(controlPath(index, extension)).join("\n")).toContain(rule);
  });

  test.each(
    ALLOWED.map((control, index) => [REFUSED.length + index, ...control] as const)
  )("allows control %d (%s): %s", (index, extension) => {
    expect(rulesOf(controlPath(index, extension))).toEqual([]);
  });
});
