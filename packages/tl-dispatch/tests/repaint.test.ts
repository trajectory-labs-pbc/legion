import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { CONTRAST_CHECKS } from "@upstream-dispatch/theme/classes";
import { contrastRatio, type Oklch } from "@upstream-dispatch/theme/contrast";

import { type CssDeclaration, parseCss } from "./css";
import { PACKAGE_ROOT } from "./source";

// `src/repaint.css` maps the palette upstream's pages paint with onto the theme's tokens. These
// tests compile the app's stylesheet as the build does, resolve each colour as the cascade does
// in light and in dark, and hold three things: nothing upstream paints with is blue, each text
// pair upstream registers keeps its contrast, and each blue literal in a rule has a rule here.

type Scheme = "light" | "dark";
/** A colour in OKLab, with its opacity. */
type Colour = readonly [l: number, a: number, b: number, alpha: number];

const SCHEMES: readonly Scheme[] = ["light", "dark"];
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const NEUTRAL_FAMILIES = ["slate", "sky", "blue"];
const DARK_QUERY = "@media (prefers-color-scheme: dark)";
/** Tailwind's own fallback for a browser without `color-mix()`: the real rule is beside it. */
const MIX_SUPPORT = /^@supports \(color: ?color-mix\(in lab, ?red, ?red\)\)$/;

const srcDir = join(PACKAGE_ROOT, "src");
const stylesText = readFileSync(join(srcDir, "styles.css"), "utf8");
const repaintText = readFileSync(join(srcDir, "repaint.css"), "utf8");
const REPAINT_IMPORT = '@import "./repaint.css";';

/** The CSS Tailwind generates for the app, with every neutral shade's class added. */
async function generate(repaint = repaintText): Promise<CssDeclaration[]> {
  const compiler = await compile(stylesText.replace(REPAINT_IMPORT, repaint), {
    base: srcDir,
    onDependency: () => {},
  });
  const classes = new Scanner({ sources: compiler.sources }).scan();
  const forced = NEUTRAL_FAMILIES.flatMap((family) =>
    SHADES.map((shade) => `text-${family}-${shade}`)
  );
  return parseCss(compiler.build([...classes, ...forced])).declarations;
}

// ---- Colour arithmetic ----

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function srgbToLab(r: number, g: number, b: number, alpha = 1): Colour {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    alpha,
  ];
}

function labToSrgb([l, a, b]: Colour): [number, number, number] {
  const lc = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mc = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sc = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc),
    toGamma(-1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc),
    toGamma(-0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc),
  ];
}

const toOklch = ([l, a, b]: Colour): Oklch => ({
  c: Math.hypot(a, b),
  h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  l,
});

/** A blue, a cyan, an indigo or a violet: a hue between cyan and violet with visible chroma. The
 *  theme's own greys stay under 0.01. */
function isBlue(colour: Colour): boolean {
  const { c, h } = toOklch(colour);
  return colour[3] > 0 && c > 0.012 && h >= 190 && h <= 310;
}

/** `share` of `a` with the rest of `b`, on premultiplied channels, as `color-mix()` mixes. */
function mix(a: Colour, b: Colour, share: number, space: string): Colour {
  const channels = (colour: Colour) => (space === "srgb" ? labToSrgb(colour) : colour.slice(0, 3));
  const alpha = a[3] * share + b[3] * (1 - share);
  const [ca, cb] = [channels(a), channels(b)];
  const mixed = [0, 1, 2].map((at) =>
    alpha === 0
      ? 0
      : ((ca[at] as number) * a[3] * share + (cb[at] as number) * b[3] * (1 - share)) / alpha
  ) as [number, number, number];
  return space === "srgb" ? srgbToLab(...mixed, alpha) : [...mixed, alpha];
}

// ---- Values ----

/** The parts of `text` between top-level `separator`s. */
function split(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let part = "";
  for (const char of text) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === separator && depth === 0) {
      parts.push(part.trim());
      part = "";
    } else part += char;
  }
  parts.push(part.trim());
  return parts;
}

const number = (text: string, percentOf = 1) =>
  text.endsWith("%") ? (Number.parseFloat(text) / 100) * percentOf : Number.parseFloat(text);

/** A literal colour: a hex, `oklch()`, `rgb()` or one of three keywords. */
function literal(text: string): Colour | undefined {
  if (text === "white") return srgbToLab(1, 1, 1);
  if (text === "black") return srgbToLab(0, 0, 0);
  if (text === "transparent") return [0, 0, 0, 0];
  const hex = /^#([0-9a-f]{3,8})$/i.exec(text)?.[1];
  if (hex !== undefined) {
    const digits = hex.length <= 4 ? [...hex].map((digit) => digit + digit).join("") : hex;
    const channel = (at: number) => Number.parseInt(digits.slice(at, at + 2), 16) / 255;
    return srgbToLab(channel(0), channel(2), channel(4), digits.length === 8 ? channel(6) : 1);
  }
  const call = /^(oklch|oklab|rgba?)\((.*)\)$/i.exec(text);
  if (call === null) return undefined;
  const [channels = "", alpha = "1"] = split(call[2] as string, "/");
  const [x = "", y = "", z = "", commaAlpha = alpha] = channels.split(/[\s,]+/).filter(Boolean);
  const kind = call[1]?.toLowerCase();
  if (kind === "oklab") return [number(x), number(y, 0.4), number(z, 0.4), number(alpha)];
  if (kind === "oklch") {
    const [chroma, hue] = [number(y, 0.4), (Number.parseFloat(z) * Math.PI) / 180];
    return [number(x), chroma * Math.cos(hue), chroma * Math.sin(hue), number(alpha)];
  }
  return srgbToLab(
    number(x, 255) / 255,
    number(y, 255) / 255,
    number(z, 255) / 255,
    number(commaAlpha)
  );
}

type Variables = ReadonlyMap<string, string>;

/** The colour `value` computes to in `scheme`, or undefined when it is not one this reads. */
function evaluate(
  value: string,
  scheme: Scheme,
  variables: Variables,
  depth = 0
): Colour | undefined {
  if (depth > 40) throw new Error(`a cycle through "${value}"`);
  const text = value.trim();
  const call = /^([\w-]+)\((.*)\)$/s.exec(text);
  const [name, body] = [call?.[1]?.toLowerCase(), call?.[2] ?? ""];
  const next = (part: string) => evaluate(part, scheme, variables, depth + 1);
  if (name === "var") {
    const [variable = "", ...fallback] = split(body, ",");
    const held = variables.get(variable);
    if (held !== undefined) return next(held);
    return fallback.length > 0 ? next(fallback.join(",")) : undefined;
  }
  if (name === "color-mix") {
    const [space = "", first = "", second = ""] = split(body, ",");
    // `A 55%`, or `A var(--share)` where the variable holds a percentage.
    const part = (text: string) => {
      const words = split(text, " ");
      const last = words.at(-1) ?? "";
      const held = /^var\((--[\w-]+)\)$/.exec(last)?.[1];
      const share = held === undefined ? last : (variables.get(held) ?? "");
      const given = words.length > 1 && /^[\d.]+%$/.test(share);
      return {
        colour: next(given ? words.slice(0, -1).join(" ") : text),
        share: given ? Number.parseFloat(share) / 100 : undefined,
      };
    };
    const [a, b] = [part(first), part(second)];
    if (a.colour === undefined || b.colour === undefined) return undefined;
    const share = a.share ?? (b.share === undefined ? 0.5 : 1 - b.share);
    return mix(a.colour, b.colour, share, space.replace(/^in\s+/, ""));
  }
  return literal(text);
}

// ---- The cascade on the root ----

/** A declaration's selector and the at-rules around it. Tailwind puts a `color-mix()` inside the
 *  rule, under `@supports`, after a fallback without it. */
function place(context: readonly string[]): { selector: string; around: string[] } {
  const at = context.map((rule) => !rule.startsWith("@")).lastIndexOf(true);
  return {
    around: context.filter((rule, index) => index !== at && !MIX_SUPPORT.test(rule)),
    selector: context[at] ?? "",
  };
}

/** Whether a rule at `context` applies to the root element in `scheme`, and how strongly. */
function rootRule(context: readonly string[], scheme: Scheme): number | undefined {
  const { selector, around } = place(context);
  if (around.some((rule) => rule.startsWith("@media") && rule !== DARK_QUERY)) return undefined;
  if (around.includes(DARK_QUERY) && scheme !== "dark") return undefined;
  const parts = split(selector, ",");
  const specificity = parts.includes(":root:not(.light)") ? 2 : parts.includes(":root") ? 1 : 0;
  if (specificity === 0) return undefined;
  // A rule outside every layer outranks a layered one; then specificity; then the later rule.
  return (around.some((rule) => rule.startsWith("@layer")) ? 0 : 10) + specificity;
}

/** What each property of the root holds in `scheme`. */
function rootValues(declarations: readonly CssDeclaration[], scheme: Scheme): Map<string, string> {
  const values = new Map<string, string>();
  const strength = new Map<string, number>();
  for (const { property, value, context } of declarations) {
    const rank = rootRule(context, scheme);
    if (rank === undefined || rank < (strength.get(property) ?? 0)) continue;
    values.set(property, value);
    strength.set(property, rank);
  }
  return values;
}

/** Whether the root's own rule for `property` is outside every layer. */
function repainted(declarations: readonly CssDeclaration[], property: string): boolean {
  return declarations.some(
    (declaration) =>
      declaration.property === property &&
      (rootRule(declaration.context, "light") ?? 0) >= 10 &&
      !declaration.context.includes(DARK_QUERY)
  );
}

// ---- The three checks ----

/** Each colour variable upstream's pages read that the theme does not hold, or that is blue. */
function paletteProblems(declarations: readonly CssDeclaration[]): string[] {
  const names = new Set(
    declarations
      .map(({ property }) => property)
      .filter((property) => /^--color-([a-z]+-\d+|page-[\w-]+|icon-rail[\w-]*)$/.test(property))
  );
  const problems: string[] = [];
  for (const name of [...names].sort()) {
    if (!repainted(declarations, name)) problems.push(`${name}: src/repaint.css does not set it`);
    for (const scheme of SCHEMES) {
      const variables = rootValues(declarations, scheme);
      const colour = evaluate(`var(${name})`, scheme, variables);
      if (colour === undefined) problems.push(`${name} (${scheme}): not a colour this test reads`);
      else if (isBlue(colour)) problems.push(`${name} (${scheme}): a blue`);
    }
  }
  return problems;
}

/** Each text pair upstream registers that falls below its ratio on the repainted shades. */
function contrastProblems(declarations: readonly CssDeclaration[]): string[] {
  const problems: string[] = [];
  for (const scheme of SCHEMES) {
    const variables = rootValues(declarations, scheme);
    const colour = (swatch: { name: string; oklch: Oklch }) => {
      const held = evaluate(`var(--color-${swatch.name})`, scheme, variables);
      return held === undefined ? swatch.oklch : toOklch(held);
    };
    for (const check of CONTRAST_CHECKS) {
      const ratio = contrastRatio(
        colour(check.foreground[scheme]),
        colour(check.background[scheme])
      );
      if (ratio < check.minRatio) {
        problems.push(`${check.description} (${scheme}): ${ratio.toFixed(2)} < ${check.minRatio}`);
      }
    }
  }
  return problems;
}

const LITERAL = /#[0-9a-f]{3,8}\b|\b(?:oklch|oklab|rgba?)\([^()]*\)/gi;
const SHORTHANDS = new Set(["background", "border", "outline"]);
const withoutWhere = (selector: string) => /^:where\((.*)\)$/.exec(selector)?.[1] ?? selector;
const selectorKey = (selector: string) => selector.replace(/\s+/g, " ").replace(/"/g, "'");

/** Blue literals this stylesheet cannot reach, each with why it stays. */
const UNREACHED: Record<string, string> = {
  ".bg-\\[color\\:\\#123456\\]": "a class upstream's own tests write; no page draws it",
  ".shadow-\\[0_0_0_1px_\\#123456\\]": "a class upstream's own tests write; no page draws it",
  ".shadow-\\[0_-8px_24px_rgba\\(15\\,23\\,42\\,0\\.08\\)\\]":
    "the margin sheet's shadow, a slate at 8%, written in upstream's component",
};

/** Each blue literal in a rule that no rule of `src/repaint.css` replaces. */
function literalProblems(declarations: readonly CssDeclaration[], repaint: string): string[] {
  const own = new Set(
    parseCss(repaint).declarations.flatMap(({ property, context }) =>
      split(withoutWhere(place(context).selector), ",").map(
        (selector) => `${selectorKey(selector)} { ${property} }`
      )
    )
  );
  const replaced = (selector: string, property: string) =>
    own.has(`${selectorKey(selector)} { ${property} }`) ||
    (SHORTHANDS.has(property) && own.has(`${selectorKey(selector)} { ${property}-color }`));
  // Tailwind writes a `color-mix()` under `@supports`, after a fallback in the same rule.
  const fallbacks = new Set<CssDeclaration>();
  declarations.forEach(({ property, context }, index) => {
    if (!MIX_SUPPORT.test(context.at(-1) ?? "")) return;
    const rule = context.slice(0, -1).join(" > ");
    for (let at = index - 1; at >= 0; at -= 1) {
      const before = declarations[at] as CssDeclaration;
      if (before.context.join(" > ") !== rule) break;
      if (before.property === property) fallbacks.add(before);
    }
  });
  const problems = new Set<string>();
  for (const declaration of declarations) {
    const { property, value, context } = declaration;
    const { selector } = place(context);
    if (fallbacks.has(declaration)) continue;
    const blue = (value.replace(/url\([^)]*\)/g, "").match(LITERAL) ?? []).filter((text) => {
      const colour = literal(text);
      return colour !== undefined && isBlue(colour);
    });
    if (blue.length === 0) continue;
    for (const part of split(selector, ",")) {
      if (part === ":host" || UNREACHED[part] !== undefined || replaced(part, property)) continue;
      problems.add(`${part} { ${property}: ${blue.join(" ")} }`);
    }
  }
  return [...problems];
}

describe("the repaint of upstream's pages", async () => {
  const declarations = await generate();

  test("the scheme switch is set in each rule that sets the theme's tokens", () => {
    const rulesSetting = (property: string) =>
      declarations
        .filter((declaration) => declaration.property === property)
        .map(({ context }) => context.filter((rule) => !rule.startsWith("@layer")).join(" > "))
        .sort();
    expect(rulesSetting("--repaint-light")).toEqual(rulesSetting("--background"));
    expect(rootValues(declarations, "light").get("--repaint-light")).toBe("100%");
    expect(rootValues(declarations, "dark").get("--repaint-light")).toBe("0%");
  });

  test("leaves no slate, sky or blue shade, and no other palette colour, a blue", () => {
    const shades = NEUTRAL_FAMILIES.flatMap((family) =>
      SHADES.map((shade) => `--color-${family}-${shade}`)
    );
    const emitted = new Set(declarations.map(({ property }) => property));
    expect(shades.filter((shade) => !emitted.has(shade))).toEqual([]);
    expect(paletteProblems(declarations)).toEqual([]);
  });

  test("fails when a shade is left as Tailwind declares it", async () => {
    const shade = /--color-sky-950:[^;]*;/;
    expect(repaintText).toMatch(shade);
    const problems = paletteProblems(await generate(repaintText.replace(shade, "")));
    expect(problems).toContain("--color-sky-950: src/repaint.css does not set it");
    expect(problems).toContain("--color-sky-950 (light): a blue");
    expect(problems).toContain("--color-sky-950 (dark): a blue");
  });

  test("keeps every text pair upstream registers at its ratio, links included", () => {
    expect(CONTRAST_CHECKS.length).toBeGreaterThanOrEqual(20);
    expect(CONTRAST_CHECKS.map((check) => check.description)).toContain("link on canvas");
    expect(contrastProblems(declarations)).toEqual([]);
  });

  test("fails when the link shade is set to the page's colour", async () => {
    const shade = /--color-sky-700:[^;]*;/;
    expect(repaintText).toMatch(shade);
    const broken = repaintText.replace(shade, "--color-sky-700: var(--background);");
    expect(contrastProblems(await generate(broken))).toContainEqual(
      expect.stringContaining("link on canvas (light)")
    );
  });

  test("replaces every blue literal a rule of the compiled stylesheet holds", () => {
    expect(literalProblems(declarations, repaintText)).toEqual([]);
  });

  test("fails when a rule for one of upstream's literals is removed", () => {
    const rule = /\.dispatch-doc \.milkdown a \{[^}]*\}/;
    expect(repaintText).toMatch(rule);
    expect(literalProblems(declarations, repaintText.replace(rule, ""))).toEqual([
      ".dispatch-doc .milkdown a { color: #0069a8 }",
      ".dispatch-doc .milkdown a { color: #00bcff }",
    ]);
  });
});
