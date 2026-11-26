import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { LabelPill, StatusPill } from "@upstream-dispatch/components/Pill";
import { UnreadDot } from "@upstream-dispatch/features/project/UnreadDot";
import {
  ASK_BLOCK_PILL_BLOCKING_BG,
  ASK_BLOCK_PILL_HIGH_BG,
  ASK_BLOCK_PILL_MED_BG,
  askBlockTint,
  askUrgencyAccent,
  borderDefault,
  CALLOUT_DANGER_BG,
  CALLOUT_INFO_BG,
  CALLOUT_WARNING_BG,
  CONTRAST_CHECKS,
  type ColorPair,
  card,
  decisionUnsureBorder,
  issueStatusScale,
  PAGE_COLORS,
  pageLineBorder,
  primaryButtonBg,
  primaryButtonDisabled,
  selectedCardBg,
  selectedCardBorder,
} from "@upstream-dispatch/theme/classes";
import { contrastRatio, type Oklch } from "@upstream-dispatch/theme/contrast";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { type CssDeclaration, parseCss } from "./css";
import { PACKAGE_ROOT } from "./source";

// `src/repaint.css` maps the palette upstream's pages paint with onto the theme's tokens. These
// tests compile the app's stylesheet as the build does, resolve each colour as the cascade does
// in light and in dark, and hold these things: nothing upstream paints with is blue, each text
// pair upstream registers keeps its contrast, each blue literal in a rule of the app's stylesheet
// or the editor's has a rule here, each hover state and each urgency pill is a step from the
// colour it must differ from, a link in a document or a comment is underlined at rest, a pill
// takes the Badge's corner and type, and a card has no stripe down its left edge.

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

/** The classes the app's sources write. No test changes a source, so one scan serves them all. */
let classes: string[] | undefined;

/** The CSS Tailwind generates for the app, with every neutral shade's class added. */
async function generate(repaint = repaintText): Promise<CssDeclaration[]> {
  const compiler = await compile(stylesText.replace(REPAINT_IMPORT, repaint), {
    base: srcDir,
    onDependency: () => {},
  });
  classes ??= new Scanner({ sources: compiler.sources }).scan();
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
  const marks = attributes + take(/[.:](?:\\.|[\w-])+/g);
  return total + ids * 1e6 + marks * 1e3 + elements + take(/[a-z][\w-]*/gi);
}

/** The link `html` holds. */
function link(html: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.querySelector("a") as Element;
}

const UNDERLINE = {
  "text-decoration-color": "currentcolor",
  "text-decoration-line": "none",
  "text-decoration-thickness": "auto",
  "text-underline-offset": "auto",
};

/** Each declaration of `declarations` whose property `wanted` takes and whose rule matches
 *  `target`, in the order the cascade applies them: a rule outside every layer outranks a layered
 *  one, then specificity, then the later rule. A rule inside a media query is left out, unless
 *  it is `media`, the query a test views the page at. */
function cascade(
  declarations: readonly CssDeclaration[],
  target: Element,
  wanted: (property: string) => boolean,
  media?: string
): { property: string; value: string }[] {
  const matches = (selector: string) => {
    try {
      return target.matches(selector);
    } catch {
      // The DOM here does not read every selector; one it cannot read is not a plain element's.
      return false;
    }
  };
  return declarations
    .flatMap(({ property, value, context }, index) => {
      if (!wanted(property)) return [];
      const around = context.filter((rule) => rule.startsWith("@") && !MIX_SUPPORT.test(rule));
      if (around.some((rule) => !rule.startsWith("@layer") && rule !== media)) return [];
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
}

/** The value `target` computes for `property`, or undefined when no rule sets it. */
const computed = (declarations: readonly CssDeclaration[], target: Element, property: string) =>
  cascade(declarations, target, (wanted) => wanted === property).at(-1)?.value;

/** The underline `target` computes at rest. */
function underline(declarations: readonly CssDeclaration[], target: Element): typeof UNDERLINE {
  const applied = cascade(declarations, target, (property) =>
    /^text-(decoration|underline)/.test(property)
  );
  const line = { ...UNDERLINE };
  for (const { property, value } of applied) {
    // The shorthand sets the line and puts the colour and the thickness back.
    if (property === "text-decoration") {
      Object.assign(line, UNDERLINE, {
        "text-decoration-line": /underline|line-through|overline|none/.exec(value)?.[0] ?? value,
        "text-underline-offset": line["text-underline-offset"],
      });
    } else if (property in line) Object.assign(line, { [property]: value });
  }
  return line;
}

/** A link in a document, and one in a comment, as the editor and `MarkdownBody` draw them. */
const DOCUMENT_LINK = `<div class="dispatch-doc"><div class="proof-editor"><div class="milkdown">
  <div class="editor ProseMirror prose"><p><a href="https://example.test/">a link</a></p></div>
</div></div></div>`;
const COMMENT_LINK = `<div class="dispatch-markdown prose prose-sm prose-slate">
  <p><a href="https://example.test/">a link</a></p>
</div>`;

// ---- Pills and cards ----

const upstreamSrc = join(PACKAGE_ROOT, "../dispatch/web/src");
const badgeText = readFileSync(join(PACKAGE_ROOT, "../ui/src/components/badge.tsx"), "utf8");

/** What a pill takes from the Badge, whose classes are `rounded-badge text-xs font-medium`. */
const BADGE = {
  "border-radius": "var(--radius-badge)",
  "font-size": "var(--text-xs)",
  "font-weight": "var(--font-weight-medium)",
  "letter-spacing": "normal",
  "text-transform": "none",
};
/** Tailwind's `rounded-full`, which a dot or an avatar keeps. */
const ROUND = "calc(infinity * 1px)";

/** An element with `classes`. */
function withClasses(classes: string, tag = "span"): Element {
  const element = document.createElement(tag);
  element.className = classes;
  return element;
}

/** The first element `html` holds that matches `selector`. */
function sample(html: string, selector: string): Element {
  const host = document.createElement("div");
  host.innerHTML = html;
  return host.querySelector(selector) as Element;
}

/** The class list of the string or template in upstream's `file` that holds `anchor`, its `${}`
 *  taken out, so a sample follows upstream's markup. */
function upstreamClasses(file: string, anchor: string): string {
  const text = readFileSync(join(upstreamSrc, file), "utf8");
  const body = [...text.matchAll(/(["`])([^"`]*)\1/g)]
    .map(([, , found]) => found ?? "")
    .find((found) => found.includes(anchor));
  if (body === undefined) throw new Error(`${file}: no class list holds "${anchor}"`);
  return body
    .replace(/\$\{[^}]*\}/g, " ")
    .trim()
    .split(/\s+/)
    .join(" ");
}

/** Upstream's round and pill-shaped parts, as it renders them, with the shape each must take. */
const SHAPES: Record<string, [() => Element, Record<string, string>]> = {
  "a status pill": [
    () => sample(renderToStaticMarkup(createElement(StatusPill, null, "In progress")), "span"),
    BADGE,
  ],
  "a status pill's dot": [
    () => sample(renderToStaticMarkup(createElement(StatusPill, null, "In progress")), "span span"),
    { "border-radius": ROUND },
  ],
  "an unread dot": [
    () => sample(renderToStaticMarkup(createElement(UnreadDot)), "span"),
    { "border-radius": ROUND },
  ],
  "an avatar": [
    () =>
      withClasses(
        upstreamClasses("features/issue/AssigneeControl.tsx", "before:content-[attr(data-initial)]")
      ),
    { "border-radius": ROUND },
  ],
  "a floating button": [
    () =>
      withClasses(
        upstreamClasses("features/agent-view/AgentThread.tsx", "-translate-x-1/2 rounded-full"),
        "button"
      ),
    { "border-radius": ROUND },
  ],
  "a status control in the issue header": [
    () =>
      withClasses(
        upstreamClasses("features/issue/IssueHeader.tsx", "rounded-full border px-2 text-sm"),
        "button"
      ),
    {
      "border-radius": BADGE["border-radius"],
      "font-size": "var(--text-sm)",
      "letter-spacing": "normal",
      "text-transform": "none",
    },
  ],
  "a label link": [
    () =>
      sample(
        `<a class="${upstreamClasses("features/agents/AgentsPage.tsx", "items-center rounded-full")}">${renderToStaticMarkup(createElement(LabelPill, null, "dispatch"))}</a>`,
        "a"
      ),
    { "border-radius": BADGE["border-radius"] },
  ],
  "a block's badge in a document": [
    () => sample('<div class="dispatch-doc"><span data-proof-block-badge>ask</span></div>', "span"),
    {
      "border-radius": BADGE["border-radius"],
      "font-size": BADGE["font-size"],
      "font-weight": BADGE["font-weight"],
    },
  ],
};

/** Each sample whose corner or type is not what it should be. */
function shapeProblems(declarations: readonly CssDeclaration[]): string[] {
  return Object.entries(SHAPES).flatMap(([name, [render, want]]) => {
    const element = render();
    return Object.entries(want).flatMap(([property, value]) => {
      const got = computed(declarations, element, property);
      return got === value ? [] : [`${name}: ${property} ${got}`];
    });
  });
}

/** Each rule of upstream's stylesheet, outside the layers, that draws an element round, with no
 *  rule of the repaint giving the same selector the Badge's corner. */
function roundRuleProblems(declarations: readonly CssDeclaration[]): string[] {
  const outside = declarations.filter(
    ({ context }) => !context.some((at) => at.startsWith("@layer"))
  );
  const selector = ({ context }: CssDeclaration) => selectorKey(context.join(" "));
  return outside
    .filter(({ property, value }) => property === "border-radius" && /9999px|infinity/.test(value))
    .filter(
      (round) =>
        !outside.some(
          (rule) =>
            rule.property === "border-radius" &&
            rule.value === BADGE["border-radius"] &&
            selector(rule) === selector(round)
        )
    )
    .map((round) => `${selector(round)}: border-radius ${round.value}`);
}

/** The cards and rows upstream marks with a stripe down the left edge, with their classes. The ask
 *  on the issue page takes that page's colours; the plan's and the verification's rows are cards
 *  under 761 px. */
const STRIPED_CARDS: Record<string, string> = {
  "an ask in the margin": `relative rounded-xl border-l-4 shadow-sm ${card} ${askUrgencyAccent.high}`,
  "an ask on the issue page":
    "relative rounded-xl border-l-4 shadow-sm border-page-hair bg-page-paper border-l-page-waiting",
  "a decision its asker is unsure of": `rounded-xl border p-3 text-sm shadow-sm ${card} border-l-4 ${decisionUnsureBorder}`,
  "a selected decision its asker is unsure of": `rounded-xl border p-3 text-sm shadow-sm ${selectedCardBorder} ${selectedCardBg} border-l-4 ${decisionUnsureBorder}`,
  "a decision in a document": `proof-typed-block my-5 rounded-xl border border-l-4 px-4 pt-3 pb-4 shadow-sm ${borderDefault} ${askUrgencyAccent.high} ${askBlockTint.high}`,
  "a statement in the verification view": `grid rounded-[8px] border ${pageLineBorder} min-[761px]:rounded-none min-[761px]:border-x-0 border-l-4 border-l-page-statement`,
  "a step in the plan": `border-t max-[761px]:rounded-lg max-[761px]:border max-[761px]:border-l-4 max-[761px]:border-l-page-step ${pageLineBorder}`,
};

/** The width 761 px and up, where the plan's and the verification's rows are a table's, and under
 *  it, where they are cards. */
const VIEWS = { narrow: "@media (width < 761px)", wide: "@media (width >= 761px)" } as const;

/** Each striped card whose left side is not drawn as its right one, in light, at `media`. */
function stripeProblems(declarations: readonly CssDeclaration[], media?: string): string[] {
  const held = rootValues(declarations, "light");
  return Object.entries(STRIPED_CARDS).flatMap(([name, classes]) => {
    const element = withClasses(classes, "div");
    const side = (edge: "left" | "right") => {
      const last = (part: string) =>
        cascade(
          declarations,
          element,
          (p) => [`border-${part}`, `border-inline-${part}`, `border-${edge}-${part}`].includes(p),
          media
        ).at(-1)?.value;
      // A colour the card names through a variable it sets itself is that variable's value.
      const colour = (last("color") ?? "").replace(
        /var\((--[\w-]+)\)/g,
        (whole, variable: string) => computed(declarations, element, variable) ?? whole
      );
      const drawn = evaluate(colour, "light", held);
      return {
        colour: drawn === undefined ? colour : drawn.map((c) => c.toFixed(3)).join(" "),
        width: last("width"),
      };
    };
    const [left, right] = [side("left"), side("right")];
    // A side with no width draws no colour.
    const same =
      left.width === right.width &&
      (/^0(px)?$/.test(left.width ?? "") || left.colour === right.colour);
    return same
      ? []
      : [`${name}: left ${left.width} ${left.colour}, right ${right.width} ${right.colour}`];
  });
}

/** The sizes, weights and widths a rule here sets, which the design rules do not read (they hold
 *  the corners, the colours and the shadows), as anything but a theme token: a length or a number
 *  written out, or a size keyword. A `var()`, a token's multiple and `0` are tokens. */
const SHAPE_PROPERTY =
  /^(font-size|font-weight|line-height|min-height|height|border(-(top|right|bottom|left))?-width)$/;
const SIZE_KEYWORD =
  /\b(thin|medium|thick|bold|bolder|lighter|smaller|larger|(x{1,3}-)?(small|large))\b/;
function shapeLiterals(repaint: string): string[] {
  return parseCss(repaint).declarations.flatMap(({ property, value, context }) => {
    if (!SHAPE_PROPERTY.test(property)) return [];
    let rest = value;
    for (let last = ""; last !== rest; ) {
      last = rest;
      rest = rest.replace(/var\(--[\w-]+(?:,\s*)?\)/g, "");
    }
    rest = rest.replace(/\*\s*[\d.]+/g, "").replace(/\b0\b/g, "");
    const selector = context.filter((rule) => !rule.startsWith("@")).join(" ");
    return /\d/.test(rest) || SIZE_KEYWORD.test(rest)
      ? [`${selector} { ${property}: ${value} }`]
      : [];
  });
}

// ---- The checks ----

/** Each colour variable upstream's pages read that the theme does not hold, or that is blue. */
function paletteProblems(declarations: readonly CssDeclaration[]): string[] {
  const names = new Set(
    declarations
      .map(({ property }) => property)
      .filter((property) => /^--color-([a-z]+-\d+|page-[\w-]+|icon-rail[\w-]*)$/.test(property))
  );
  const problems: string[] = [];
  const variables = SCHEMES.map((scheme) => [scheme, rootValues(declarations, scheme)] as const);
  for (const name of [...names].sort()) {
    if (!repainted(declarations, name)) problems.push(`${name}: src/repaint.css does not set it`);
    for (const [scheme, held] of variables) {
      const colour = evaluate(`var(${name})`, scheme, held);
      if (colour === undefined) problems.push(`${name} (${scheme}): not a colour this test reads`);
      else if (isBlue(colour)) problems.push(`${name} (${scheme}): a blue`);
    }
  }
  return problems;
}

/** The name of each colour of the issue page and the icon rail. Upstream names a page colour's
 *  dark side by a Tailwind shade, but the page draws `--color-<its name>` in both schemes. */
const PAGE_NAMES = new Map<ColorPair, string>(
  Object.entries(PAGE_COLORS).map(([name, pair]) => [pair, name])
);

/** Text a rule of `src/repaint.css` colours, the ground it is drawn on and its ratio. Each side is
 *  a token or `selector { property }`. */
const RULE_PAIRS: readonly (readonly [text: string, ground: string, minRatio: number])[] = [
  [".dispatch-doc .milkdown a { color }", "--card", 4.5],
  [".dispatch-markdown { --tw-prose-links }", "--card", 4.5],
  [".dispatch-markdown { --tw-prose-links }", "--muted", 4.5],
  [
    "::highlight(dispatch-search) { color }",
    "::highlight(dispatch-search) { background-color }",
    4.5,
  ],
  [
    ":is(.dispatch-doc, .dispatch-markdown) [data-proof-block-badge] { color }",
    ":is(.dispatch-doc, .dispatch-markdown) [data-proof-block-badge] { background-color }",
    4.5,
  ],
  [":is(.dispatch-doc, .dispatch-markdown) [data-proof-block-name] { color }", "--card", 4.5],
  [":is(.dispatch-doc, .dispatch-markdown) [data-proof-block-title] { color }", "--card", 4.5],
  [
    ".dispatch-doc .milkdown .editor.ProseMirror > p.is-editor-empty:first-child::before { color }",
    "--card",
    4.5,
  ],
  [
    ".prose { --tw-prose-body }",
    ".dispatch-doc span[data-dispatch='ask'] { background-color }",
    4.5,
  ],
  [".prose { --tw-prose-pre-code }", ".prose { --tw-prose-pre-bg }", 4.5],
  [".dispatch-doc .proof-editor { --pre-color }", ".dispatch-doc .proof-editor { --pre-bg }", 4.5],
  ...[
    "body",
    "headings",
    "lead",
    "links",
    "bold",
    "counters",
    "quotes",
    "captions",
    "kbd",
    "code",
  ].map((name) => [`.prose { --tw-prose-${name} }`, "--card", 4.5] as const),
];

/** The value the rule at `selector` gives `property`: the last such rule outside every layer. */
function ruleValue(
  declarations: readonly CssDeclaration[],
  selector: string,
  property: string
): string | undefined {
  return declarations
    .filter((declaration) => {
      const { selector: rule, around } = place(declaration.context);
      return (
        declaration.property === property &&
        around.length === 0 &&
        split(withoutWhere(rule), ",").some((part) => selectorKey(part) === selectorKey(selector))
      );
    })
    .at(-1)?.value;
}

/** Each text pair that falls below its ratio: the pairs upstream registers, on the variable the
 *  page draws each from, and the pairs of `RULE_PAIRS`. A colour that does not resolve is one. */
function contrastProblems(declarations: readonly CssDeclaration[]): string[] {
  const problems: string[] = [];
  for (const scheme of SCHEMES) {
    const variables = rootValues(declarations, scheme);
    const shade = (pair: ColorPair) =>
      evaluate(`var(--color-${PAGE_NAMES.get(pair) ?? pair[scheme].name})`, scheme, variables);
    const drawn = (colour: string) => {
      const rule = /^(.*) \{ (.*) \}$/.exec(colour);
      const value =
        rule === null
          ? `var(${colour})`
          : ruleValue(declarations, rule[1] as string, rule[2] as string);
      return value === undefined ? undefined : evaluate(value, scheme, variables);
    };
    const pairs = [
      ...CONTRAST_CHECKS.map(
        (check) =>
          [
            check.description,
            shade(check.foreground),
            shade(check.background),
            check.minRatio,
          ] as const
      ),
      ...RULE_PAIRS.map(
        ([text, ground, minRatio]) =>
          [`${text} on ${ground}`, drawn(text), drawn(ground), minRatio] as const
      ),
    ];
    for (const [description, text, ground, minRatio] of pairs) {
      if (text === undefined || ground === undefined) {
        problems.push(`${description} (${scheme}): not a colour this test reads`);
        continue;
      }
      const ratio = contrastRatio(toOklch(text), toOklch(ground));
      if (ratio < minRatio) {
        problems.push(`${description} (${scheme}): ${ratio.toFixed(2)} < ${minRatio}`);
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

/** The grounds of upstream's issue status chips, one scale from triage to done, the same in both
 *  schemes: from each status's ground to the next one's. */
const STATUS_GROUNDS = Object.values(issueStatusScale).map(
  (classes) => /bg-([a-z]+-\d+)/.exec(classes)?.[1] ?? ""
);
const STATUSES: Record<string, Step> = Object.fromEntries(
  STATUS_GROUNDS.slice(1).map((ground, at) => {
    const before = STATUS_GROUNDS[at] as string;
    return [`status chip ${ground}`, { from: [before, before], to: [ground, ground] }];
  })
);

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
      for (const { property, value, context } of inside === undefined ? [] : declarations) {
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
const SHORTHANDS = new Set(["background", "border", "border-bottom", "outline"]);
const withoutWhere = (selector: string) => /^:where\((.*)\)$/.exec(selector)?.[1] ?? selector;
const selectorKey = (selector: string) => selector.replace(/\s+/g, " ").replace(/"/g, "'");

/** Blue literals this stylesheet does not replace, each with why it stays. A key is the start of
 *  a rule's selector, or of `selector { property }`. */
const UNREACHED: Record<string, string> = {
  ".bg-\\[color\\:\\#123456\\]": "a class upstream's own tests write; no page draws it",
  ".markdown-link-action-card": "a card of the editor's library that no code makes",
  ".milkdown pre code .token.":
    "the editor's code theme, kept whole: its hues mark syntax, on a ground dark in both schemes",
  ".proof-editor { --a4-color }": "a provenance colour; the editor Dispatch mounts draws none",
  ".proof-editor { --ai-color }": "a provenance colour; the editor Dispatch mounts draws none",
  ".shadow-\\[0_0_0_1px_\\#123456\\]": "a class upstream's own tests write; no page draws it",
  ".shadow-\\[0_-8px_24px_rgba\\(15\\,23\\,42\\,0\\.08\\)\\]":
    "the margin sheet's shadow, a slate at 8%, written in upstream's component",
};

/** Each blue literal in a rule of `declarations` that no rule of `src/repaint.css` replaces. A
 *  rule there replaces one when it has the same selector after `scope`, and the same property. */
function literalProblems(
  declarations: readonly CssDeclaration[],
  repaint: string,
  scope = ""
): string[] {
  const own = new Set(
    parseCss(repaint).declarations.flatMap(({ property, context }) =>
      split(withoutWhere(place(context).selector), ",").map(
        (selector) => `${selectorKey(selector)} { ${property} }`
      )
    )
  );
  const replaced = (selector: string, property: string) =>
    own.has(`${selectorKey(scope + selector)} { ${property} }`) ||
    (SHORTHANDS.has(property) && own.has(`${selectorKey(scope + selector)} { ${property}-color }`));
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
  /** The rules that run the animation `name`: a keyframe's colour is theirs to replace. */
  const animated = (name: string) =>
    declarations
      .filter(
        ({ property, value }) =>
          /^animation(-name)?$/.test(property) && value.split(/\s+/).includes(name)
      )
      .map(({ context }) => place(context).selector);
  const problems = new Set<string>();
  for (const declaration of declarations) {
    const { value, context } = declaration;
    if (fallbacks.has(declaration)) continue;
    const blue = (value.replace(/url\([^)]*\)/g, "").match(LITERAL) ?? []).filter((text) => {
      const colour = literal(text);
      return colour !== undefined && isBlue(colour);
    });
    if (blue.length === 0) continue;
    const keyframes = /^@keyframes (.*)$/.exec(context[0] ?? "")?.[1];
    const property = keyframes === undefined ? declaration.property : "animation-name";
    const selectors = keyframes === undefined ? [place(context).selector] : animated(keyframes);
    for (const part of selectors.flatMap((selector) => split(selector, ","))) {
      const rule = `${selectorKey(part)} { ${property} }`;
      const stays = Object.keys(UNREACHED).some((key) => rule.startsWith(key));
      if (part === ":host" || stays || replaced(part, property)) continue;
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

  test("keeps every text pair upstream registers, and the text a rule colours, at its ratio", () => {
    expect(CONTRAST_CHECKS.length).toBeGreaterThanOrEqual(20);
    expect(CONTRAST_CHECKS.map((check) => check.description)).toContain("link on canvas");
    expect(contrastProblems(declarations)).toEqual([]);
  });

  test("fails when a shade, a page colour or a rule's colour is the ground's", async () => {
    const broken = [
      [/--color-sky-700:[^;]*;/, "--color-sky-700: var(--background);"],
      // Dark only: upstream names this side by a Tailwind shade the page does not draw.
      [
        /--color-page-check:[^;]*;/,
        "--color-page-check: color-mix(in oklab, var(--muted-foreground) var(--repaint-light), var(--background));",
      ],
      [/(\.dispatch-doc \.milkdown a \{\s*color:)[^;]*;/, "$1 var(--card);"],
    ].reduce((text, [rule, replacement]) => {
      expect(text).toMatch(rule as RegExp);
      return text.replace(rule as RegExp, replacement as string);
    }, repaintText);
    const problems = contrastProblems(await generate(broken));
    for (const problem of [
      "link on canvas (light)",
      "page-check text on page-paper (dark)",
      ".dispatch-doc .milkdown a { color } on --card (light)",
    ]) {
      expect(problems).toContainEqual(expect.stringContaining(problem));
    }
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

  test("keeps each issue status chip a step from the next status's", () => {
    expect(Object.keys(STATUSES)).toHaveLength(8);
    expect(stepProblems(declarations, STATUSES)).toEqual([]);
  });

  test("underlines a link in a document and in a comment at rest", () => {
    for (const html of [DOCUMENT_LINK, COMMENT_LINK]) {
      expect(underline(documentPage, link(html))).toEqual({
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
    expect(underline(without, link(DOCUMENT_LINK))["text-decoration-line"]).toBe("none");
  });

  test("replaces every blue literal a rule of the compiled stylesheet holds", () => {
    expect(literalProblems(declarations, repaintText)).toEqual([]);
  });

  test("replaces every blue literal a rule of the editor's stylesheet holds", () => {
    expect(literalProblems(editorCss, repaintText, ".dispatch-doc ")).toEqual([]);
  });

  test("fails when a rule for one of the editor's literals is removed", () => {
    const rule = /\.dispatch-doc span\[data-dispatch="ask"\] \{[^}]*\}/;
    expect(repaintText).toMatch(rule);
    expect(literalProblems(editorCss, repaintText.replace(rule, ""), ".dispatch-doc ")).toEqual([
      'span[data-dispatch="ask"] { background-color: rgba(168, 85, 247, 0.18) }',
      'span[data-dispatch="ask"] { border-bottom: #a855f7 }',
    ]);
    const pulse = /\.dispatch-doc \.dispatch-mark-pulse \{\s*animation-name:[^}]*\}/;
    expect(repaintText).toMatch(pulse);
    expect(literalProblems(editorCss, repaintText.replace(pulse, ""), ".dispatch-doc ")).toEqual([
      ".dispatch-mark-pulse { animation-name: rgba(168, 85, 247, 0.45) }",
    ]);
  });

  test("fails when a rule for one of upstream's literals is removed", () => {
    const rule = /\.dispatch-doc \.milkdown a \{[^}]*\}/;
    expect(repaintText).toMatch(rule);
    expect(literalProblems(declarations, repaintText.replace(rule, ""))).toEqual([
      ".dispatch-doc .milkdown a { color: #0069a8 }",
      ".dispatch-doc .milkdown a { color: #00bcff }",
    ]);
  });
  test("edges a card, a button and a field upstream draws with its faint border at the theme's", () => {
    const search = document.createElement("input");
    search.className = `rounded-lg border px-3 py-1.5 text-sm ${borderDefault}`;
    expect(computed(declarations, search, "border-color")).toBe("var(--input)");
    for (const classes of [
      `rounded-xl border p-3 ${card}`,
      `rounded-lg border px-3 ${borderDefault}`,
    ]) {
      expect(computed(declarations, withClasses(classes), "border-color")).toBe("var(--border)");
    }
  });

  test("keeps a disabled pager button's edge, and a refused primary button quieter than its neighbour", () => {
    const pager = document.createElement("button");
    pager.className = `rounded-lg border px-3 py-1 text-sm disabled:opacity-40 ${borderDefault}`;
    pager.disabled = true;
    expect(computed(declarations, pager, "opacity")).toBe("1");
    expect(computed(declarations, pager, "color")).toBe("var(--faint-foreground)");
    const create = document.createElement("button");
    create.className = `rounded-lg px-3 py-2 text-sm font-semibold ${primaryButtonBg} ${primaryButtonDisabled}`;
    create.disabled = true;
    expect(computed(declarations, create, "background-color")).toBe("var(--muted)");
    expect(computed(declarations, create, "color")).toBe("var(--muted-foreground)");
  });

  test("draws each pill upstream renders with the Badge's corner and type, and a dot round", () => {
    for (const badgeClass of ["rounded-badge", "text-xs", "font-medium"]) {
      expect(badgeText).toContain(badgeClass);
    }
    expect(shapeProblems(declarations)).toEqual([]);
    expect(roundRuleProblems(declarations)).toEqual([]);
  });

  test("fails when the pill rule reaches a dot, or a stylesheet pill keeps its circle", async () => {
    const pill = '.rounded-full[class*="px-"]:not(.shadow-lg) {';
    expect(repaintText).toContain(pill);
    expect(shapeProblems(await generate(repaintText.replace(pill, ".rounded-full {")))).toEqual(
      expect.arrayContaining(["an unread dot: border-radius var(--radius-badge)"])
    );
    const badge = /(\[data-proof-block-badge\] \{\s*\/\*[^*]*\*\/\s*)border-radius: [^;]+;/;
    expect(repaintText).toMatch(badge);
    const kept = await generate(repaintText.replace(badge, "$1"));
    expect(roundRuleProblems(kept)).toHaveLength(1);
  });

  test.each(
    Object.entries(VIEWS)
  )("draws a striped card's left side as its right, %s", (_view, media) => {
    expect(stripeProblems(declarations, media)).toEqual([]);
  });

  test("fails when a card's stripe comes back, or a selected card's left side keeps the theme's edge", async () => {
    const stripe = /\.rounded-xl\.border-l-4 \{[^}]*\}/;
    expect(repaintText).toMatch(stripe);
    expect(
      stripeProblems(await generate(repaintText.replace(stripe, "")), VIEWS.narrow).map((problem) =>
        problem.replace(/:.*/, "")
      )
    ).toEqual([
      "a decision its asker is unsure of",
      "a selected decision its asker is unsure of",
      "a decision in a document",
    ]);
    const selected = /\.rounded-xl\.border\.border-l-4\[class~="border-sky-500"\][^{]*\{[^}]*\}/;
    expect(repaintText).toMatch(selected);
    expect(
      stripeProblems(await generate(repaintText.replace(selected, "")), VIEWS.narrow).map(
        (problem) => problem.replace(/:.*/, "")
      )
    ).toEqual(["a selected decision its asker is unsure of"]);
  });

  test("sizes pills and cards with theme tokens only", () => {
    expect(shapeLiterals(repaintText)).toEqual([]);
  });

  test.each([
    ["font-size: var(--text-xs);", "font-size: 12px;"],
    ["font-weight: var(--font-weight-medium);", "font-weight: 500;"],
    ["min-height: var(--spacing-control-sm);", "min-height: 1.75rem;"],
    ["border-left-width: var(--border-width);", "border-left-width: thin;"],
    ["border-width: var(--border-width);", "border-width: thick;"],
  ])("fails when a size names a literal: %s", (token, literal) => {
    expect(repaintText).toContain(token);
    expect(shapeLiterals(repaintText.replace(token, literal))).toHaveLength(1);
  });
});
