import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { contrastFailures, measure, ratio, readSchemes, resolveColour } from "./contrast";
import { EXEMPT } from "./design-config";
import { type DesignViolation, designViolations } from "./design-rules";
import { PACKAGE_ROOT, sourceFiles } from "./source";

const theme = readFileSync(join(PACKAGE_ROOT, "src/ui/theme.css"), "utf8");
const tokens = readFileSync(join(PACKAGE_ROOT, "src/ui/tokens.css"), "utf8");

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
  ["tsx", '<div className="transition-all">', "motion"],
  ["tsx", '<div className="translate-x-1">', "motion"],
  ["tsx", '<div className="hover:scale-105">', "motion"],
  ["tsx", '<div className="animate-spin">', "motion"],
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
  ["tsx", '<p className="rounded-md rounded-t-lg rounded-full rounded-none">'],
  ["tsx", '<button className="h-8 px-3">'],
  ["tsx", '<button className="min-h-11">'],
  ["tsx", '<input type="checkbox" className="size-4" />'],
  [
    "tsx",
    '<a className="outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">',
  ],
  [
    "tsx",
    '<div className="motion-safe:animate-spin motion-safe:hover:scale-105 motion-safe:transition-colors">',
  ],
  ["tsx", '<a href="#b-r1">'],
  ["tsx", "<p style={{ top: 4, width: '50%' }} />"],
  ["css", "@media (prefers-reduced-motion: no-preference) { .x { animation: spin 1s; } }"],
  ["css", ":root { --input: color-mix(in srgb, var(--foreground) 48%, var(--background)); }"],
];

const controlPath = (index: number, extension: string) =>
  `src/${extension === "css" ? "ui" : "pages"}/control-${index}.${extension}`;

let found: DesignViolation[] = [];
const rulesOf = (path: string) =>
  found.filter((violation) => violation.file === path).map((violation) => violation.rule);

beforeAll(async () => {
  const controls = [...REFUSED, ...ALLOWED].map(([extension, text], index) => ({
    path: controlPath(index, extension),
    text,
  }));
  found = await designViolations(controls);
});

describe("design rules", () => {
  test("the app's own files keep them, the exempt files aside", async () => {
    expect(await designViolations(sourceFiles())).toEqual([]);
  });

  test("each exempt file still breaks a rule, so a rebuilt one leaves the list", async () => {
    const files = sourceFiles();
    const clean: string[] = [];
    for (const path of Object.keys(EXEMPT)) {
      const file = files.find((candidate) => candidate.path === path);
      if (file === undefined || (await designViolations([file], { exempt: {} })).length === 0) {
        clean.push(path);
      }
    }
    expect(clean).toEqual([]);
  });

  test("a file is exempt only by the list: a file that says it maps upstream is checked", async () => {
    const text = 'export const page = { server: "upstream" };\n<p className="text-sky-700" />;';
    const violations = await designViolations([{ path: "src/pages/x.tsx", text }]);
    expect(violations.map((violation) => violation.rule).join()).toContain("raw colour");
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

describe("contrast", () => {
  const schemes = readSchemes(theme, tokens);

  test("every text pair, focus on every surface, and control borders", () => {
    expect(contrastFailures(schemes)).toEqual([]);
  });

  test("a token set to the page colour fails", () => {
    const broken = readSchemes(theme, tokens, ":root { --muted-foreground: var(--background); }");
    expect(
      contrastFailures(broken).map(
        (failure) => `${failure.scheme} ${failure.text} on ${failure.on}`
      )
    ).toContain("light --muted-foreground on --background");
  });

  test("the theme's light ring is below 3:1 on the page, which is why focus has its own token", () => {
    const light = schemes.light;
    expect(
      ratio(resolveColour(light, "--ring"), resolveColour(light, "--background"))
    ).toBeLessThan(3);
    expect(measure(light, "--focus", "--background")).toBeGreaterThanOrEqual(3);
  });

  const inputFailures = (extra: string) =>
    contrastFailures(readSchemes(theme, tokens, extra)).map(
      (failure) => `${failure.scheme} ${failure.text} on ${failure.on}`
    );
  const mix = (scheme: string, percent: number) =>
    `@media (prefers-color-scheme: ${scheme}) { :root { --input: color-mix(in srgb, var(--foreground) ${percent}%, var(--background)); } }`;

  test("the theme's --input is below 3:1, which is why tokens.css mixes a stronger one", () => {
    const themeOnly = readSchemes(theme);
    for (const on of ["--background", "--card", "--muted"]) {
      expect(measure(themeOnly.light, "--input", on)).toBeLessThan(3);
      expect(measure(schemes.light, "--input", on)).toBeGreaterThanOrEqual(3);
      expect(measure(schemes.dark, "--input", on)).toBeGreaterThanOrEqual(3);
    }
    expect(measure(themeOnly.dark, "--input", "--muted")).toBeLessThan(3);
    expect(
      inputFailures(
        "@media (prefers-color-scheme: light) { :root { --input: #e1e2e3; } } @media (prefers-color-scheme: dark) { :root { --input: #716d66; } }"
      )
    ).toEqual([
      "light --input on --background",
      "light --input on --card",
      "light --input on --muted",
      "dark --input on --muted",
    ]);
  });

  test("each scheme's mix is the least ink that reaches 3:1", () => {
    expect(inputFailures(mix("light", 46))).toContain("light --input on --background");
    expect(inputFailures(mix("dark", 42))).toEqual(["dark --input on --muted"]);
  });
});
