import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import {
  ASK_BLOCK_PILL_BLOCKING_BG,
  ASK_BLOCK_PILL_HIGH_BG,
  ASK_BLOCK_PILL_MED_BG,
  CALLOUT_DANGER_BG,
  CALLOUT_INFO_BG,
  CALLOUT_WARNING_BG,
  CONTRAST_CHECKS,
  type ColorPair,
} from "@upstream-dispatch/theme/classes";
import { contrastRatio, type Oklch } from "@upstream-dispatch/theme/contrast";

import { type CssDeclaration, parseCss } from "./css";
import { PACKAGE_ROOT } from "./source";

// `src/repaint.css` maps the palette upstream's pages paint with onto the theme's tokens. These
// tests compile the app's stylesheet as the build does, resolve each colour as the cascade does
// in light and in dark, and hold these things: nothing upstream paints with is blue, each text
// pair upstream registers keeps its contrast, each blue literal in a rule has a rule here, and a
// link in a document or a comment is underlined at rest.

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
/** The editor's own stylesheet. A document page loads it after the app's, outside every layer. */
const editorCss = parseCss(
  readFileSync(join(PACKAGE_ROOT, "../proof-editor/src/lib.css"), "utf8")
).declarations;
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

// ---- The cascade on an element ----

/** A selector's specificity as one number: ids, then classes, then elements. `:where()` adds
 *  nothing, and `:is()`, `:not()` and `:has()` add their heaviest argument. */
function specificity(selector: string): number {
  let rest = selector;
  let total = 0;
  for (let call = /:(where|is|not|has)\(/.exec(rest); call !== null; ) {
    const start = call.index + call[0].length;
    let end = start;
    for (let depth = 1; depth > 0; end += 1) {
      if (rest[end] === "(") depth += 1;
      if (rest[end] === ")") depth -= 1;
    }
    if (call[1] !== "where") {
      total += Math.max(...split(rest.slice(start, end - 1), ",").map(specificity));
    }
    rest = `${rest.slice(0, call.index)} ${rest.slice(end)}`;
    call = /:(where|is|not|has)\(/.exec(rest);
  }
  const take = (pattern: RegExp) => {
    const found = rest.match(pattern)?.length ?? 0;
    rest = rest.replace(pattern, " ");
    return found;
  };
  const attributes = take(/\[[^\]]*\]/g);
  const elements = take(/::[\w-]+/g);
  const ids = take(/#(?:\\.|[\w-])+/g);
  const classes = take(/[.:](?:\\.|[\w-])+/g);
  return total + ids * 1e6 + (classes + attributes) * 1e3 + elements + take(/[a-z][\w-]*/gi);
}

/** The first element `html` holds that matches `selector`. */
function element(html: string, selector: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.querySelector(selector) as Element;
}

const UNDERLINE = {
  "text-decoration-color": "currentcolor",
  "text-decoration-line": "none",
  "text-decoration-thickness": "auto",
  "text-underline-offset": "auto",
};

/** The underline `target` computes at rest, from each rule of `declarations` that matches it: a
 *  rule outside every layer outranks a layered one, then specificity, then the later rule. */
function underline(declarations: readonly CssDeclaration[], target: Element): typeof UNDERLINE {
  const matches = (selector: string) => {
    try {
      return target.matches(selector);
    } catch {
      // The DOM here does not read every selector; one it cannot read is not a plain link's.
      return false;
    }
  };
  const applied = declarations
    .flatMap(({ property, value, context }, index) => {
      if (!/^text-(decoration|underline)/.test(property)) return [];
      const around = context.filter((rule) => rule.startsWith("@") && !MIX_SUPPORT.test(rule));
      if (around.some((rule) => !rule.startsWith("@layer"))) return [];
      // A nested rule's selector is a descendant of its parent's.
      const rules = context.filter((rule) => !rule.startsWith("@"));
      const parents = rules.slice(0, -1).map((rule) => `:is(${rule}) `);
      const matched = split(rules.at(-1) ?? "", ",")
        .map((part) => parents.join("") + part)
        .filter(matches);
      if (matched.length === 0) return [];
      const rank = (around.length === 0 ? 1e9 : 0) + Math.max(...matched.map(specificity));
      return [{ index, property, rank, value }];
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index);
  const computed = { ...UNDERLINE };
  for (const { property, value } of applied) {
    // The shorthand sets the line and puts the colour and the thickness back.
    if (property === "text-decoration") {
      Object.assign(computed, UNDERLINE, {
        "text-decoration-line": /underline|line-through|overline|none/.exec(value)?.[0] ?? value,
        "text-underline-offset": computed["text-underline-offset"],
      });
    } else if (property in computed) Object.assign(computed, { [property]: value });
  }
  return computed;
}

/** A link in a document, and one in a comment, as the editor and `MarkdownBody` draw them. */
const DOCUMENT_LINK = `<div class="dispatch-doc"><div class="proof-editor"><div class="milkdown">
  <div class="editor ProseMirror prose"><p><a href="https://example.test/">a link</a></p></div>
</div></div></div>`;
const COMMENT_LINK = `<div class="dispatch-markdown prose prose-sm prose-slate">
  <p><a href="https://example.test/">a link</a></p>
</div>`;

// ---- The checks ----

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

/** The least OKLab distance between a colour and the one that must differ from it. The theme's
 *  own smallest step between two grounds, a card to `muted`, is 0.048 in light and 0.045 in dark. */
const STEP = 0.035;
const distance = (a: Colour, b: Colour) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

type Shades = readonly [light: string, dark: string];
/** Two shades that must differ, and the rule whose element they are drawn inside, where that
 *  rule sets a shade of its own. */
interface Step {
  from: Shades;
  to: Shades;
  inside?: string;
}

/** Upstream's hover states (`theme/classes.ts`): from the shade at rest to the one under the
 *  pointer. */
const HOVERS: Record<string, Step> = {
  "card border": { from: ["slate-200", "slate-800"], to: ["sky-400", "sky-300"] },
  "close button text": { from: ["slate-700", "slate-300"], to: ["slate-900", "slate-100"] },
  "danger text": { from: ["rose-700", "rose-400"], to: ["rose-900", "rose-300"] },
  "disclosure chevron": { from: ["slate-400", "slate-600"], to: ["slate-700", "slate-300"] },
  "field border": { from: ["slate-200", "slate-800"], to: ["slate-300", "slate-700"] },
  "icon rail entry": {
    from: ["icon-rail", "icon-rail"],
    to: ["icon-rail-active", "icon-rail-active"],
  },
  "issue page row": { from: ["page-paper", "page-paper"], to: ["page-mark", "page-mark"] },
  link: { from: ["sky-700", "sky-400"], to: ["sky-900", "sky-300"] },
  "muted surface": { from: ["white", "slate-900"], to: ["slate-100", "slate-800"] },
  "muted text": { from: ["slate-500", "slate-400"], to: ["slate-700", "slate-300"] },
  "primary button": { from: ["sky-700", "sky-700"], to: ["sky-800", "sky-800"] },
  "rail entry": {
    from: ["slate-950", "slate-950"],
    inside: ".bg-slate-950",
    to: ["slate-800", "slate-800"],
  },
  "secondary button border": { from: ["slate-300", "slate-700"], to: ["sky-500", "sky-400"] },
  "success text": { from: ["emerald-700", "emerald-400"], to: ["emerald-900", "emerald-300"] },
};

const shades = (pair: ColorPair): Shades => [pair.light.name, pair.dark.name];
/** A decision card's urgency pill (`askBlockPill`): from the card's tint to the pill's ground. */
const PILLS: Record<string, Step> = {
  "blocking pill": { from: shades(CALLOUT_DANGER_BG), to: shades(ASK_BLOCK_PILL_BLOCKING_BG) },
  "high pill": { from: shades(CALLOUT_WARNING_BG), to: shades(ASK_BLOCK_PILL_HIGH_BG) },
  "med pill": { from: shades(CALLOUT_INFO_BG), to: shades(ASK_BLOCK_PILL_MED_BG) },
};

/** Each of `steps` whose two shades are less than a step apart. */
function stepProblems(
  declarations: readonly CssDeclaration[],
  steps: Record<string, Step>
): string[] {
  const problems: string[] = [];
  SCHEMES.forEach((scheme, at) => {
    const root = rootValues(declarations, scheme);
    for (const [name, { from, to, inside }] of Object.entries(steps)) {
      // What the rule at `inside` sets on its own element, over what the root holds.
      const variables = new Map(root);
      for (const { property, value, context } of declarations) {
        if (context.join() === inside) variables.set(property, value);
      }
      const [a, b] = [from, to].map((pair) =>
        evaluate(`var(--color-${pair[at]})`, scheme, variables)
      );
      if (a === undefined || b === undefined) problems.push(`${name} (${scheme}): no colour`);
      else if (distance(a, b) < STEP) {
        problems.push(`${name} (${scheme}): ${distance(a, b).toFixed(3)} from ${from[at]}`);
      }
    }
  });
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
  /** Every rule a document page holds, in the order it loads them. */
  const documentPage = [...declarations, ...editorCss];

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

  test("moves every hover state a step from its resting colour", () => {
    expect(stepProblems(declarations, HOVERS)).toEqual([]);
  });

  test("fails when a hover shade is its resting one", async () => {
    const shade = /--color-rose-900:[^;]*;/;
    expect(repaintText).toMatch(shade);
    const broken = repaintText.replace(shade, "--color-rose-900: var(--color-rose-700);");
    expect(stepProblems(await generate(broken), HOVERS)).toEqual([
      "danger text (light): 0.000 from rose-700",
    ]);
  });

  test("lifts a decision card's urgency pill a step above the card's tint", () => {
    expect(stepProblems(declarations, PILLS)).toEqual([]);
  });

  test("underlines a link in a document and in a comment at rest", () => {
    for (const html of [DOCUMENT_LINK, COMMENT_LINK]) {
      expect(underline(documentPage, element(html, "a"))).toEqual({
        "text-decoration-color": "var(--muted-foreground)",
        "text-decoration-line": "underline",
        "text-decoration-thickness": "1px",
        "text-underline-offset": "3px",
      });
    }
    // The line is no text, so it takes the 3:1 of a mark on the document's ground.
    for (const scheme of SCHEMES) {
      const variables = rootValues(declarations, scheme);
      const [line, ground] = ["--muted-foreground", "--card"].map((token) =>
        toOklch(evaluate(`var(${token})`, scheme, variables) as Colour)
      ) as [Oklch, Oklch];
      expect(contrastRatio(line, ground)).toBeGreaterThanOrEqual(3);
    }
  });

  test("fails when the document link's rule draws no line", () => {
    const own = (declaration: CssDeclaration) =>
      declaration.context.join() === ".dispatch-doc .milkdown a" &&
      declaration.property === "text-decoration-line";
    expect(documentPage.filter(own)).toHaveLength(1);
    const without = documentPage.filter((declaration) => !own(declaration));
    expect(underline(without, element(DOCUMENT_LINK, "a"))["text-decoration-line"]).toBe("none");
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
