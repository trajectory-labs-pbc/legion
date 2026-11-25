import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { Glob } from "bun";
import postcss, { AtRule, type Node, type Root, Rule } from "postcss";
import ts from "typescript";

// The design rules, checked on the CSS Tailwind generates from the stylesheet and the sources.

const src = join(import.meta.dirname, "..");
const globals = join(src, "styles/globals.css");
const globalsText = readFileSync(globals, "utf8");

type Mutation = { css?: string; extra?: readonly string[] };

async function tailwind(css: string) {
  return compile(css, { base: dirname(globals), from: globals, onDependency: () => {} });
}

/** The CSS Tailwind generates from the stylesheet over the sources it names, and `extra` classes. */
async function generate({ css = globalsText, extra = [] }: Mutation = {}): Promise<Root> {
  const compiler = await tailwind(css);
  const candidates = new Scanner({ sources: compiler.sources }).scan();
  return postcss.parse(compiler.build([...candidates, ...extra]));
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
// Round is calc(infinity * 1px); every other corner is a multiple of --radius, which is 0.
const RADIUS = /^(0|var\(--radius\)|calc\(var\(--radius\) \* [\d.]+\)|calc\(infinity \* 1px\))$/;
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
    if (/shadow/.test(prop) && !/-(color|alpha)$/.test(prop)) {
      const allowed =
        NO_SHADOW.has(value) ||
        (prop === "box-shadow" && value === SHADOW_STACK) ||
        (prop === "--tw-inset-ring-shadow" && value === INSET_EDGE);
      if (!allowed) say(decl, text, "a shadow other than the 1px inset edge");
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
    if (/radius$/.test(prop) && !RADIUS.test(value)) say(decl, text, "a radius other than 0");
    if (prop === "--radius" && value !== "0") say(decl, text, "a radius other than 0");
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
  ...readdirSync(join(src, "components"))
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"))
    .map((file) => `components/${file}`),
  ...readdirSync(join(src, "lib"))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => `lib/${file}`),
].map((path) => ({ path, text: readFileSync(join(src, path), "utf8") }));

const classTokens = (text: string): string[] =>
  [...text.matchAll(/"([^"\n]*)"/g)]
    .flatMap((match) => (match[1] ?? "").split(/\s+/))
    .filter(Boolean);
const everyToken = SOURCES.flatMap(({ path, text }) =>
  classTokens(text).map((token) => ({ path, token }))
);
const tokensOf = (path: string): string[] =>
  classTokens(SOURCES.find((source) => source.path === path)?.text ?? "");

// The parts drawn round: dots and avatars. Everything else is square.
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
  it("is built from every source directory and every stylesheet", async () => {
    const { sources } = await tailwind(globalsText);
    const sourced = sources.map((source) => relative(src, resolve(source.base, source.pattern)));
    const directories = readdirSync(src, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !["styles", "test"].includes(entry.name))
      .map((entry) => entry.name);
    expect(sourced.sort()).toEqual(directories.sort());
    expect([...new Glob("**/*.css").scanSync(src)]).toEqual(["styles/globals.css"]);
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
  ["a shadow", { extra: ["shadow-sm"] }, "a shadow other than the 1px inset edge"],
  ["an inset shadow", { extra: ["inset-shadow-sm"] }, "a shadow other than the 1px inset edge"],
  ["a ring halo", { extra: ["focus:ring-2"] }, "a shadow other than the 1px inset edge"],
  ["a wider inset edge", { extra: ["inset-ring-2"] }, "a shadow other than the 1px inset edge"],
  ["an arbitrary shadow", { extra: ["shadow-[0_0_0_1px_red]"] }, "a shadow other than"],
  ["a text shadow", { extra: ["text-shadow-sm"] }, "a shadow other than the 1px inset edge"],
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
  ["a corner from the default theme", { extra: ["rounded-2xl"] }, "a radius other than 0"],
  ["an arbitrary corner", { extra: ["rounded-[4px]"] }, "a radius other than 0"],
  [
    "a radius token",
    { css: globalsText.replace("--radius: 0;", "--radius: 0.5rem;") },
    "a radius other than 0",
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
        /(:root:not\(\.light\) \{\s*color-scheme: dark;\s*--background: )#1b1a18/,
        "$1#000000"
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

// Each part that takes the highlight step, and each part an edge alone marks, with its state.
const HIGHLIGHTS: readonly (readonly [string, string])[] = [
  ["components/combobox.tsx", "data-highlighted:"],
  ["components/dropdown-menu.tsx", "data-highlighted:"],
  ["components/dropdown-menu.tsx", "data-popup-open:"],
  ["components/select.tsx", "data-highlighted:"],
];
const MARKED: readonly (readonly [string, string])[] = [
  ["components/tabs.tsx", "group-data-[variant=default]/tabs-list:data-active:"],
  ["components/toggle.tsx", "data-pressed:"],
];

describe("the components", () => {
  it("draw focus as one solid outline in the focus colour, offset from the element", () => {
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
      expect(tokensOf(path), `${path}: ${token}`).toContain(`${variantsOf(token)}outline-offset-2`);
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
    for (const [path, state] of HIGHLIGHTS) {
      expect(tokensOf(path), path).toContain(`${state}bg-accent`);
      expect(tokensOf(path), path).toContain(`${state}text-accent-foreground`);
    }
    for (const [path, state] of [...HIGHLIGHTS, ...MARKED]) {
      expect(tokensOf(path), path).toContain(`${state}inset-ring`);
      expect(tokensOf(path), path).toContain(`${state}inset-ring-muted-foreground`);
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
  ["accent-foreground", "accent"],
  ["foreground", "accent"],
  ["muted-foreground", "accent"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary/90 background"],
  ["secondary-foreground", "secondary"],
  ["secondary-foreground", "secondary/80 background"],
  ["secondary-foreground", "secondary/90 background"],
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
  ["danger", "card"],
];

describe("the theme", () => {
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

  it.each(
    Object.entries(THEMES)
  )("keeps text at 4.5:1 on every surface it sits on, %s", (_name, tokens) => {
    for (const [text, ground] of TEXT_PAIRS) {
      expect(
        contrast(colour(tokens, text), colour(tokens, ground)),
        `${text} on ${ground}`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(
    Object.entries(THEMES)
  )("keeps the focus outline, the state edge and an invalid edge at 3:1 on every surface, %s", (_name, tokens) => {
    for (const ground of ["background", "card", "popover", "field", "muted", "accent"]) {
      for (const edge of ["focus", "muted-foreground", "danger"]) {
        expect(
          contrast(colour(tokens, edge), colour(tokens, ground)),
          `${edge} on ${ground}`
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it.each(
    Object.entries(THEMES)
  )("keeps a field's edge at 3:1 on the page, a card and muted, %s", (_name, tokens) => {
    for (const ground of ["background", "card", "muted"]) {
      expect(
        contrast(colour(tokens, "input"), colour(tokens, ground)),
        `input on ${ground}`
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(
    Object.entries(THEMES)
  )("makes the highlight step visible on a popover, %s", (_name, tokens) => {
    expect(
      contrast(colour(tokens, "accent"), colour(tokens, "popover")),
      "accent on popover"
    ).toBeGreaterThanOrEqual(1.3);
  });
});
