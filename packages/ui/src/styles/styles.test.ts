import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { Glob } from "bun";
import postcss, { AtRule, type Node, type Root, Rule } from "postcss";
import ts from "typescript";

import { type HeadingSize, headingVariants, textVariants } from "../lib/typography";
import { cn } from "../lib/utils";

// The design rules, checked on the CSS Tailwind generates from the stylesheet and the sources.

const src = join(import.meta.dirname, "..");
const globals = join(src, "styles/globals.css");
// The entry with the theme it imports written in its place, so a test can change either.
const globalsText = readFileSync(globals, "utf8").replace(
  '@import "./theme.css";',
  readFileSync(join(src, "styles/theme.css"), "utf8")
);

type Mutation = { css?: string; extra?: readonly string[] };

async function tailwind(css: string) {
  return compile(css, { base: dirname(globals), from: globals, onDependency: () => {} });
}

// No mutation changes the sources, so they are scanned once.
const base = await tailwind(globalsText);
const candidates = new Scanner({ sources: base.sources }).scan();

/** The CSS Tailwind generates from the stylesheet over the sources, and `extra` classes. */
async function generate({ css = globalsText, extra = [] }: Mutation = {}): Promise<Root> {
  return postcss.parse((await tailwind(css)).build([...candidates, ...extra]));
}

/** The at-rules and selectors around a node, outermost first. */
function where(node: Node): string {
  const path: string[] = [];
  for (let at: Node | undefined = node; at !== undefined; at = at.parent) {
    if (at instanceof Rule) path.unshift(at.selector);
    else if (at instanceof AtRule) path.unshift(`@${at.name} ${at.params}`);
  }
  return path.join(" > ");
}

const unescapeClass = (name: string): string =>
  name
    .replace(/\\([0-9a-f]{1,6}) ?/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/\\(.)/g, "$1");

/** Where a class name's utility starts: after its last variant, outside brackets. */
function utilityStart(name: string): number {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < name.length; index += 1) {
    const char = name[index];
    if (char === "[" || char === "(") depth += 1;
    else if (char === "]" || char === ")") depth -= 1;
    else if (char === ":" && depth === 0) start = index + 1;
  }
  return start;
}
const utilityOf = (name: string): string => name.slice(utilityStart(name));
const variantsOf = (name: string): string => name.slice(0, utilityStart(name));

const NO_SHADOW = new Set(["none", "initial", "0 0 #0000"]);
const SHADOW_STACK =
  "var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)";
const INSET_EDGE = "inset 0 0 0 1px var(--tw-inset-ring-color, currentcolor)";
const DURATIONS = new Set([
  "150ms",
  "200ms",
  "initial",
  "var(--tw-duration, var(--default-transition-duration))",
]);
const MOTION_SAFE = "@media (prefers-reduced-motion: no-preference)";
// Round is calc(infinity * 1px); every other corner is --radius, one of its steps, or a role
// token that names a step (`--radius-badge` is `var(--radius-sm)`).
// The theme's four steps: 4, 6, 8 and 12 px at an 8 px --radius.
const FACTOR = String.raw`(0\.5|0\.75|1|1\.5)`;
// A corner step: --radius, or --radius times one of the steps' factors, or another step.
const STEPS = String.raw`var\(--radius(-(sm|md|lg|xl))?\)|calc\(var\(--radius\) \* ${FACTOR}\)`;
const STEP = new RegExp(`^(${STEPS})$`);
const RADIUS = new RegExp(String.raw`^(0|${STEPS}|calc\(infinity \* 1px\))$`);
// The theme's shadows. Each one's colour is the shadow tint, so a scheme sets how dark it is.
const THEME_SHADOW = /\.shadow-(popover|dialog)$/;
const TINT = "var(--tw-shadow-color, var(--shadow-tint))";
const THEME_BLOCKS = [":root", ".dark", "@media (prefers-color-scheme: dark) > :root:not(.light)"];

/** Each place the generated CSS breaks a design rule. */
function designProblems(css: Root): string[] {
  const problems: string[] = [];
  const say = (node: Node, text: string, why: string) => {
    problems.push(`${where(node)} { ${text} }: ${why}`);
  };

  css.walkDecls((decl) => {
    const { prop, value } = decl;
    const text = `${prop}: ${value}`;
    if (/shadow/.test(prop) && !/-(color|alpha|tint)$/.test(prop)) {
      const themeShadow =
        prop === "--tw-shadow" &&
        THEME_SHADOW.test(where(decl)) &&
        value.includes(TINT) &&
        !/#|\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(/.test(value.replaceAll(TINT, ""));
      const allowed =
        NO_SHADOW.has(value) ||
        themeShadow ||
        (prop === "box-shadow" && value === SHADOW_STACK) ||
        (prop === "--tw-inset-ring-shadow" && value === INSET_EDGE);
      if (!allowed)
        say(decl, text, "a shadow other than the theme's shadows and the 1px inset edge");
    }
    if (value.includes("drop-shadow(")) say(decl, text, "a drop shadow");
    if (prop === "transition") say(decl, text, "a transition shorthand");
    if (prop === "transition-property" && value !== "opacity") {
      say(decl, text, "a transition of something other than opacity");
    }
    if (prop === "transition-duration" || prop === "--tw-duration") {
      // A swipe moves with the finger, so nothing fades while it lasts.
      const swipe = value === "0ms" && where(decl).includes("[data-swiping]");
      if (!DURATIONS.has(value) && !swipe) say(decl, text, "a duration outside 150 to 200 ms");
    }
    if (prop === "--default-transition-duration" && value !== "150ms") {
      say(decl, text, "a duration outside 150 to 200 ms");
    }
    if (/delay$/.test(prop) && value !== "initial") say(decl, text, "a delay");
    if (
      (prop === "transition-property" || prop === "animation") &&
      !where(decl).includes(MOTION_SAFE)
    ) {
      say(decl, text, "motion the reduced-motion setting does not stop");
    }
    // A spinner turns because it says work is under way; nothing else animates.
    if (prop === "animation" && value !== "var(--animate-spin)") say(decl, text, "an animation");
    if (/radius$/.test(prop) && prop !== "--radius" && !RADIUS.test(value)) {
      say(decl, text, "a corner outside the theme");
    }
    if (/^--radius-/.test(prop) && !STEP.test(value)) {
      say(decl, text, "a corner step that is not --radius times 0.5 to 1.5");
    }
    if (prop === "--radius" && !/^\d+(\.\d+)?(px|rem)$/.test(value)) {
      say(decl, text, "a --radius that is not one length");
    }
    if (prop === "cursor" && value === "pointer") {
      say(decl, text, "a pointer cursor, which only an external link takes");
    }
  });

  css.walkAtRules("keyframes", (rule) => {
    if (rule.params !== "spin") say(rule, rule.params, "an animation");
  });

  css.walkRules((rule) => {
    for (const [, escaped] of rule.selector.matchAll(/\.((?:\\[0-9a-f]{1,6} ?|\\.|[\w-])+)/gi)) {
      if (escaped !== undefined && /^!?\[/.test(utilityOf(unescapeClass(escaped)))) {
        say(rule, rule.selector, "an arbitrary property");
      }
    }
  });

  // The light block, .dark and the OS dark block alone set the theme's tokens, and the two dark
  // blocks agree.
  const tokenBlocks = new Map<string, string>();
  css.walkRules((rule) => {
    const declarations = rule.nodes.flatMap((node) =>
      node.type === "decl" && (node.prop.startsWith("--") || node.prop === "color-scheme")
        ? [`${node.prop}: ${node.value}`]
        : []
    );
    if (declarations.some((declaration) => declaration.startsWith("--background:"))) {
      tokenBlocks.set(where(rule), declarations.join("; "));
    }
  });
  const blocks = [...tokenBlocks.keys()];
  if (blocks.join(" | ") !== THEME_BLOCKS.join(" | ")) {
    problems.push(`theme tokens set in ${blocks.join(" | ")}`);
  }
  if (tokenBlocks.get(THEME_BLOCKS[1] ?? "") !== tokenBlocks.get(THEME_BLOCKS[2] ?? "")) {
    problems.push("the OS dark block differs from .dark");
  }
  css.walkRules((rule) => {
    const path = where(rule);
    if (!tokenBlocks.has(path) && /\.(dark|light)\b|prefers-color-scheme/.test(path)) {
      say(rule, path, "a second dark block");
    }
  });
  return problems;
}

/** Each `style` prop in a component's source. */
function styleProps(path: string, text: string): string[] {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === "style") {
      found.push(`${path}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const SOURCES = [
  ...["blocks", "components"].flatMap((dir) =>
    readdirSync(join(src, dir))
      .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
      .map((file) => `${dir}/${file}`)
  ),
  ...readdirSync(join(src, "lib"))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => `lib/${file}`),
].map((path) => ({ path, text: readFileSync(join(src, path), "utf8") }));

// Class strings: double-quoted, or template literals without their `${...}` parts.
const classTokens = (text: string): string[] =>
  [...text.matchAll(/"([^"\n]*)"|`([^`]*)`/g)]
    .flatMap((match) => (match[1] ?? match[2] ?? "").replace(/\$\{[^}]*\}/g, " ").split(/\s+/))
    .filter(Boolean);
const everyToken = SOURCES.flatMap(({ path, text }) =>
  classTokens(text).map((token) => ({ path, token }))
);
const tokensOf = (path: string): string[] =>
  classTokens(SOURCES.find((source) => source.path === path)?.text ?? "");

// The parts drawn round: dots and avatars. Everything else takes a corner step.
const ROUND_SLOTS = [
  "avatar",
  "avatar-group-count",
  "radio-group-indicator",
  "radio-group-item",
  "slider-thumb",
  "switch",
  "switch-thumb",
];

const generated = await generate();

describe("the generated CSS", () => {
  it("is built from every source directory and every stylesheet", () => {
    const sourced = base.sources.map((source) =>
      relative(src, resolve(source.base, source.pattern))
    );
    const directories = readdirSync(src, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !["styles", "test"].includes(entry.name))
      .map((entry) => entry.name);
    expect(sourced.sort()).toEqual(directories.sort());
    expect([...new Glob("**/*.css").scanSync(src)].sort()).toEqual([
      "styles/globals.css",
      "styles/theme.css",
    ]);
    expect(generated.toString()).toContain(".motion-safe\\:duration-150");
    expect(generated.toString()).toContain(".data-highlighted\\:inset-ring");
  });

  it("keeps every design rule", () => {
    expect(designProblems(generated)).toEqual([]);
  });

  it("comes from components with no style prop", () => {
    expect(SOURCES.flatMap(({ path, text }) => styleProps(path, text))).toEqual([]);
    expect(styleProps("x.tsx", 'const x = <div style={{ color: "red" }} />;')).toEqual(["x.tsx:1"]);
  });
});

const MUTATIONS: readonly (readonly [string, Mutation, string])[] = [
  ["a shadow", { extra: ["shadow-sm"] }, "a shadow other than the theme's"],
  ["an inset shadow", { extra: ["inset-shadow-sm"] }, "a shadow other than the theme's"],
  ["a ring halo", { extra: ["focus:ring-2"] }, "a shadow other than the theme's"],
  ["a wider inset edge", { extra: ["inset-ring-2"] }, "a shadow other than the theme's"],
  ["an arbitrary shadow", { extra: ["shadow-[0_0_0_1px_red]"] }, "a shadow other than"],
  ["a text shadow", { extra: ["text-shadow-sm"] }, "a shadow other than the theme's"],
  [
    "a theme shadow with a literal colour",
    {
      css: globalsText.replace(
        /--shadow-popover: [^;]+;/,
        "--shadow-popover: 0 0 1px rgb(0 0 0 / 0.2);"
      ),
    },
    "a shadow other than the theme's",
  ],
  ["a drop shadow", { extra: ["drop-shadow-sm"] }, "a drop shadow"],
  ["a shadow in CSS", { css: `${globalsText}\n.x { box-shadow: 0 0 1px red; }` }, "a shadow"],
  ["a fade of everything", { extra: ["motion-safe:transition-all"] }, "other than opacity"],
  ["a transform transition", { extra: ["motion-safe:transition-transform"] }, "other than opacity"],
  ["the default transition", { extra: ["motion-safe:transition"] }, "other than opacity"],
  ["a transition in CSS", { css: `${globalsText}\n.x { transition: opacity 1s; }` }, "shorthand"],
  ["a long fade", { extra: ["duration-300"] }, "a duration outside 150 to 200 ms"],
  ["a short fade", { extra: ["duration-100"] }, "a duration outside 150 to 200 ms"],
  ["a delay", { extra: ["delay-75"] }, "a delay"],
  ["a fade that ignores reduced motion", { extra: ["transition-opacity"] }, "reduced-motion"],
  ["an animation", { extra: ["motion-safe:animate-pulse"] }, "an animation"],
  ["a corner from the default theme", { extra: ["rounded-2xl"] }, "a corner outside the theme"],
  ["an arbitrary corner", { extra: ["rounded-[4px]"] }, "a corner outside the theme"],
  [
    "a corner step written as a length",
    {
      css: globalsText.replace(/--radius-sm: [^;]+;/, "--radius-sm: 4px;"),
    },
    "a corner",
  ],
  [
    "a corner step past the scale",
    {
      css: globalsText.replace(/--radius-xl: [^;]+;/, "--radius-xl: calc(var(--radius) * 2);"),
    },
    "a corner",
  ],
  [
    "a --radius that is not a length",
    { css: globalsText.replace(/--radius: [^;]+;/, "--radius: var(--x);") },
    "a --radius that is not one length",
  ],
  ["a pointer cursor", { extra: ["hover:cursor-pointer"] }, "a pointer cursor"],
  ["an arbitrary property", { extra: ["[mask-type:luminance]"] }, "an arbitrary property"],
  ["a dark variant", { extra: ["dark:bg-muted"] }, "a second dark block"],
  [
    "a second dark block",
    { css: `${globalsText}\n[data-theme="dark"] { --background: #000; }` },
    "theme tokens set in",
  ],
  [
    "an OS dark block that differs from .dark",
    {
      css: globalsText.replace(
        /(:root:not\(\.light\) \{\s*color-scheme: dark;\s*--background: )[^;]+/,
        "$1#010203"
      ),
    },
    "the OS dark block differs from .dark",
  ],
];

describe("the design-rule check fails", () => {
  it.each(MUTATIONS)("on %s", async (_name, mutation, reason) => {
    const problems = designProblems(await generate(mutation));
    expect(
      problems.some((problem) => problem.includes(reason)),
      problems.join("\n")
    ).toBe(true);
  });
});

// Each part an edge marks, with its state: a list's highlighted item, an open submenu, an active
// tab and a pressed toggle.
const MARKED: readonly (readonly [string, string])[] = [
  ["lib/overlay-styles.ts", "data-highlighted:"],
  ["components/dropdown-menu.tsx", "data-popup-open:"],
  ["components/tabs.tsx", "group-data-[variant=default]/tabs-list:data-active:"],
  ["components/toggle.tsx", "data-pressed:"],
];

// A list row draws its focus outline inside itself, so its list does not clip it (FO2).
const INSET_FOCUS_PATHS = ["blocks/list-row.tsx"];

// The list parts that take the highlight from the shared class strings.
const HIGHLIGHTED = [
  "components/combobox.tsx",
  "components/dropdown-menu.tsx",
  "components/select.tsx",
];

describe("the components", () => {
  it("draw focus as one solid outline in the focus colour, offset from the element, or inside a list row", () => {
    expect(everyToken.filter(({ token }) => /ring-ring|outline-ring/.test(token))).toEqual([]);
    expect(
      everyToken.filter(
        ({ token }) =>
          variantsOf(token).includes("focus") &&
          /^(ring-|opacity|border-ring)/.test(utilityOf(token))
      )
    ).toEqual([]);
    const widths = everyToken.filter(({ token }) => utilityOf(token) === "outline-2");
    expect(widths.length).toBeGreaterThan(10);
    for (const { path, token } of widths) {
      // A scroll container draws its ring inside its own edge.
      const inside = `${variantsOf(token)}-outline-offset-2`;
      const outside = `${variantsOf(token)}outline-offset-2`;
      const offsets = INSET_FOCUS_PATHS.includes(path) ? [inside] : [outside, inside];
      expect(
        tokensOf(path).some((each) => offsets.includes(each)),
        `${path}: ${token}`
      ).toBe(true);
      expect(tokensOf(path), `${path}: ${token}`).toContain(`${variantsOf(token)}outline-focus`);
    }
  });

  it("round only dots and avatars", () => {
    const round = SOURCES.flatMap(({ text }) =>
      [...text.matchAll(/rounded-full/g)].map((match) => {
        const before = text.slice(0, match.index);
        return [...before.matchAll(/data-slot="([^"]+)"/g)].at(-1)?.[1] ?? "none";
      })
    );
    expect(round.sort()).toEqual(ROUND_SLOTS);
  });

  it("mark a highlighted item, an open submenu, an active tab and a pressed toggle with an edge", () => {
    for (const [path, state] of MARKED) {
      expect(tokensOf(path), path).toContain(`${state}inset-ring`);
      expect(tokensOf(path), path).toContain(`${state}inset-ring-muted-foreground`);
    }
    for (const path of HIGHLIGHTED) {
      const text = SOURCES.find((source) => source.path === path)?.text ?? "";
      expect(text.replace(/^import .*$/gm, ""), path).toMatch(/\b(highlightClass|listItemClass)\b/);
    }
  });
});

type Rgb = readonly [number, number, number];

function themeTokens(block: string): Map<string, string> {
  const tokens = new Map<string, string>();
  generated.walkRules((rule) => {
    if (where(rule) !== block) return;
    rule.walkDecls(/^--/, (decl) => {
      tokens.set(decl.prop.slice(2), decl.value);
    });
  });
  return tokens;
}
const THEMES = { light: themeTokens(":root"), dark: themeTokens(".dark") };

/** `top` at `alpha` over `under`. */
const over = (top: Rgb, alpha: number, under: Rgb): Rgb => [
  top[0] * alpha + under[0] * (1 - alpha),
  top[1] * alpha + under[1] * (1 - alpha),
  top[2] * alpha + under[2] * (1 - alpha),
];

/** A token's colour, or a token at a percentage over another: `primary/90 background`. */
function colour(tokens: Map<string, string>, name: string): Rgb {
  const layered = name.match(/^([\w-]+)\/(\d+) ([\w-]+)$/);
  if (layered?.[1] !== undefined && layered[3] !== undefined) {
    return over(colour(tokens, layered[1]), Number(layered[2]) / 100, colour(tokens, layered[3]));
  }
  const value = tokens.get(name) ?? "";
  // A field's edge is the one mixed token.
  const mix = value.match(/^color-mix\(in srgb, var\(--([\w-]+)\) (\d+)%, var\(--([\w-]+)\)\)$/);
  if (mix?.[1] !== undefined && mix[3] !== undefined) {
    return over(colour(tokens, mix[1]), Number(mix[2]) / 100, colour(tokens, mix[3]));
  }
  const hex = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (hex?.[1] === undefined || hex[2] === undefined || hex[3] === undefined) {
    throw new Error(`--${name} is not a #rrggbb colour: ${value}`);
  }
  return [Number.parseInt(hex[1], 16), Number.parseInt(hex[2], 16), Number.parseInt(hex[3], 16)];
}

function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Each text colour on each surface a component draws it on. Status text sits only on its own
// tint: no component draws warning text on the page, where it is 4.44:1 in light.
const TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ["foreground", "background"],
  ["muted-foreground", "background"],
  ["foreground", "muted"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "muted/50 background"],
  ["muted-foreground", "muted/80 background"],
  ["foreground", "field"],
  ["muted-foreground", "field"],
  ["card-foreground", "card"],
  ["muted-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "popover"],
  ["danger", "popover"],
  ["danger", "background"],
  // Danger text on a card, and the count's quiet-danger Retry on a sidebar row at rest, hovered
  // and current; its own hover is danger-tint, below.
  ["danger", "card"],
  ["danger", "sidebar"],
  ["danger", "sidebar-accent/50 sidebar"],
  ["danger", "sidebar-accent"],
  ["accent-foreground", "accent"],
  ["foreground", "accent"],
  ["muted-foreground", "accent"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary/90 background"],
  ["secondary-foreground", "secondary"],
  ["secondary-foreground", "secondary/80 background"],
  ["secondary-foreground", "secondary/90 background"],
  // A hovered table row's cells.
  ["foreground", "secondary"],
  ["muted-foreground", "secondary"],
  ["destructive-foreground", "destructive"],
  ["destructive-foreground", "destructive/90 background"],
  ["foreground", "danger-tint"],
  ["muted-foreground", "danger-tint"],
  ["danger", "danger-tint"],
  ["foreground", "warning-tint"],
  ["muted-foreground", "warning-tint"],
  ["warning", "warning-tint"],
  ["foreground", "success-tint"],
  ["muted-foreground", "success-tint"],
  ["success", "success-tint"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["sidebar-accent-foreground", "sidebar-accent/50 background"],
  // Faint text: a count, a time, a placeholder, on the panels.
  ["faint-foreground", "card"],
  ["faint-foreground", "popover"],
  ["faint-foreground", "sidebar"],
  ["faint-foreground", "background"],
  ["muted-foreground", "sidebar-accent"],
];

// Each colour, the surface under it and the contrast it keeps there: text 4.5:1; the focus
// outline, the state edge, an invalid edge and a field's edge 3:1; the highlight step 1.3:1.
const CONTRASTS: readonly (readonly [string, string, number])[] = [
  ...TEXT_PAIRS.map(([text, ground]) => [text, ground, 4.5] as const),
  ...["background", "card", "popover", "field", "muted", "accent"].flatMap((ground) =>
    ["focus", "muted-foreground", "danger"].map((edge) => [edge, ground, 3] as const)
  ),
  ...["background", "card", "popover", "muted"].map((ground) => ["input", ground, 3] as const),
  ["accent", "popover", 1.3],
];

// The theme's heights, in steps of --spacing (4 px): a table row (a property row too), a small
// control, and a list row of one line (a group header too) and of two lines. A list row takes one of
// the two, never a third.
const HEIGHTS = { row: 8, "control-sm": 7, "list-row-1": 9, "list-row-2": 14 };

/** Each `--spacing-*` token of the stylesheet's theme, as its steps of --spacing. */
function heightTokens(css: string): Record<string, number | string> {
  const found: Record<string, number | string> = {};
  postcss.parse(css).walkAtRules("theme", (theme) => {
    theme.walkDecls(/^--spacing-/, (decl) => {
      const steps = decl.value.match(/^calc\(var\(--spacing\) \* (\d+)\)$/)?.[1];
      found[decl.prop.slice("--spacing-".length)] =
        steps === undefined ? decl.value : Number(steps);
    });
  });
  return found;
}

describe("the theme's heights", () => {
  it("are a table row, a small control, and a list row of 36 px and of 56 px", async () => {
    expect(heightTokens(globalsText)).toEqual(HEIGHTS);
    const css = (await tailwind(globalsText)).build(["h-list-row-1", "h-list-row-2"]);
    expect(css).toContain("height: calc(var(--spacing) * 9)");
    expect(css).toContain("height: calc(var(--spacing) * 14)");
  });

  it("fail the check without the two-line row, or with a third list row", () => {
    const without = globalsText.replace(/\s*--spacing-list-row-2: [^;]+;/, "");
    expect(heightTokens(without)).not.toEqual(HEIGHTS);
    const third = globalsText.replace(
      "--spacing-list-row-2:",
      "--spacing-list-row-3: calc(var(--spacing) * 18);\n  --spacing-list-row-2:"
    );
    expect(heightTokens(third)).not.toEqual(HEIGHTS);
  });
});

describe("the theme", () => {
  it("fills a row both selected and highlighted with a step unlike either alone", () => {
    expect(generated.toString()).toContain(".data-selected\\:data-highlighted\\:bg-accent");
    for (const tokens of Object.values(THEMES)) {
      const fills = ["secondary", "muted", "accent"].map((token) => tokens.get(token));
      expect(new Set(fills).size).toBe(3);
    }
  });

  it("has a pair for every text colour the components use", () => {
    const texts = new Set<string>();
    generated.walkDecls("color", (decl) => {
      const token = decl.value.match(/^var\(--([\w-]+)\)$/)?.[1];
      if (token !== undefined && THEMES.light.has(token)) texts.add(token);
    });
    expect(texts.size).toBeGreaterThan(5);
    expect([...texts].filter((text) => !TEXT_PAIRS.some(([pair]) => pair === text))).toEqual([]);
  });

  it("fills a destructive button with one colour in every theme, and dims dark's page less", () => {
    for (const tokens of Object.values(THEMES)) {
      expect(tokens.get("destructive")).toBe(THEMES.light.get("destructive"));
      expect(tokens.get("destructive-foreground")).toBe(THEMES.light.get("destructive-foreground"));
    }
    expect(THEMES.light.get("scrim")).toBe("#000");
    expect(THEMES.dark.get("scrim")).toBe("rgb(0 0 0 / 0.6)");
  });

  it("smooths text once, on the root", () => {
    const smoothing: string[] = [];
    generated.walkDecls(/font-smoothing$/, (decl) => {
      smoothing.push(`${where(decl)} { ${decl.prop}: ${decl.value} }`);
    });
    expect(smoothing).toEqual([
      "@layer base > html { -webkit-font-smoothing: antialiased }",
      "@layer base > html { -moz-osx-font-smoothing: grayscale }",
    ]);
  });

  it.each(
    Object.entries(THEMES)
  )("keeps each colour at its contrast on every surface it sits on, %s", (_name, tokens) => {
    for (const [fore, ground, min] of CONTRASTS) {
      expect(
        contrast(colour(tokens, fore), colour(tokens, ground)),
        `${fore} on ${ground}`
      ).toBeGreaterThanOrEqual(min);
    }
  });

  it.each(
    Object.entries(THEMES)
  )("keeps a priority's filled bars apart from its track, and the track visible on each row fill, %s", (_name, tokens) => {
    expect(generated.toString()).toMatch(/\.fill-track\s*\{\s*fill: var\(--track\)/);
    expect(
      contrast(colour(tokens, "foreground"), colour(tokens, "track")),
      "foreground on track"
    ).toBeGreaterThanOrEqual(4.5);
    for (const ground of ["background", "card", "popover", "secondary", "muted", "accent"]) {
      expect(
        contrast(colour(tokens, "track"), colour(tokens, ground)),
        `track on ${ground}`
      ).toBeGreaterThanOrEqual(1.8);
    }
  });

  it.each(
    Object.entries(THEMES)
  )("keeps a bar's faint second value apart from its bar, and visible on each row fill, %s", (_name, tokens) => {
    for (const state of ["success", "danger"]) {
      const faint = `${state}-faint`;
      expect(generated.toString()).toMatch(
        new RegExp(`\\.fill-${faint}\\s*\\{\\s*fill: var\\(--${faint}\\)`)
      );
      expect(
        contrast(colour(tokens, state), colour(tokens, faint)),
        `${state} on ${faint}`
      ).toBeGreaterThanOrEqual(1.8);
      for (const ground of ["background", "card", "popover", "secondary", "muted", "accent"]) {
        expect(
          contrast(colour(tokens, faint), colour(tokens, ground)),
          `${faint} on ${ground}`
        ).toBeGreaterThanOrEqual(1.8);
      }
    }
  });

  it.each(
    Object.entries(THEMES)
  )("keeps a neutral bar apart from its faint track, at 3:1 on the card, and quieter than the status colours, %s", (_name, tokens) => {
    expect(generated.toString()).toMatch(
      /\.fill-faint-foreground\s*\{\s*fill: var\(--faint-foreground\)/
    );
    const onCard = (name: string) => contrast(colour(tokens, name), colour(tokens, "card"));
    expect(
      contrast(colour(tokens, "faint-foreground"), colour(tokens, "track")),
      "faint-foreground on track"
    ).toBeGreaterThanOrEqual(1.8);
    expect(onCard("faint-foreground"), "faint-foreground on card").toBeGreaterThanOrEqual(3);
    for (const state of ["success", "danger"]) {
      expect(onCard("faint-foreground"), `faint-foreground quieter than ${state}`).toBeLessThan(
        onCard(state)
      );
    }
  });
});

const HEADING_SIZES = ["page", "section", "group", "label"] as const satisfies HeadingSize[];

describe("the type recipes", () => {
  it.each([
    ...HEADING_SIZES.map((size) => [
      `heading ${size}`,
      headingVariants({ size, tone: "muted" }),
      "balance",
    ]),
    ...(["body", "caption"] as const).map((size) => [
      `text ${size}`,
      textVariants({ size, tone: "muted" }),
      "pretty",
    ]),
  ])("wrap %s by style alone, so a `truncate` beside it holds", async (_name, recipe, style) => {
    const classes = cn(recipe, "truncate").split(" ");
    const css = postcss.parse((await tailwind(globalsText)).build(classes));
    const wraps: string[] = [];
    css.walkDecls(/^(text-wrap|white-space)/, (decl) => {
      if (where(decl).startsWith("@layer utilities")) wraps.push(`${decl.prop}: ${decl.value}`);
    });
    expect(wraps.sort()).toEqual([`text-wrap-style: ${style}`, "white-space: nowrap"]);
  });
});
