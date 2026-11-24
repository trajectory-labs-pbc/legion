import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { CONTRAST_CHECKS } from "../theme/classes";
import { contrastRatio, type Oklch } from "../theme/contrast";
import * as P from "../theme/palette";

// `palette.test.ts` checks the registered text pairs against Tailwind's own shades. These rows
// check the same pairs against the colours the page renders: the tokens in `theme.css` as
// `repaint.css` maps them onto each shade.

type Scheme = "light" | "dark";
type Lab = readonly [l: number, a: number, b: number];
type Declarations = Record<Scheme, Map<string, string>>;

const SCHEMES: readonly Scheme[] = ["light", "dark"];
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const read = (name: string): string => readFileSync(join(import.meta.dir, name), "utf8");

const SWATCHES = new Map(
  Object.values(P)
    .filter(
      (value): value is P.Swatch => typeof value === "object" && value !== null && "oklch" in value
    )
    .map((swatch) => [swatch.name, swatch])
);

function declarations(block: string): Map<string, string> {
  return new Map([...block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** The custom properties of `selector`'s top-level blocks (light) and of its block inside the
 *  `prefers-color-scheme: dark` query (dark). */
function schemes(css: string, selector: string): Declarations {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const name = selector.replace(/[.*+?^${}()|[\]\\:]/g, "\\$&");
  const light = new Map<string, string>();
  for (const m of text.matchAll(new RegExp(`^${name}\\s*\\{([^}]*)\\}`, "gm"))) {
    for (const [key, value] of declarations(m[1])) light.set(key, value);
  }
  const dark = text.match(
    new RegExp(`@media \\(prefers-color-scheme: dark\\)\\s*\\{\\s*${name}\\s*\\{([^}]*)\\}`)
  );
  return { dark: declarations(dark?.[1] ?? ""), light };
}

function hexToLab(hex: string): Lab {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const oklchToLab = ({ l, c, h }: Oklch): Lab => [
  l,
  c * Math.cos((h * Math.PI) / 180),
  c * Math.sin((h * Math.PI) / 180),
];

const labToOklch = ([l, a, b]: Lab): Oklch => ({
  c: Math.hypot(a, b),
  h: (Math.atan2(b, a) * 180) / Math.PI,
  l,
});

/** The colour `--name` holds in `scheme`: the repaint's value, else the theme token's, else the
 *  palette swatch a `--color-<swatch>` name stands for. */
function resolve(name: string, scheme: Scheme, theme: Declarations, repaint: Declarations): Lab {
  const value =
    repaint[scheme].get(name) ?? theme[scheme].get(name) ?? theme.light.get(name) ?? undefined;
  if (value !== undefined) return evaluate(value, scheme, theme, repaint);
  const swatch = name.startsWith("color-") ? SWATCHES.get(name.slice("color-".length)) : undefined;
  if (swatch === undefined) throw new Error(`no value for --${name} in ${scheme}`);
  return oklchToLab(swatch.oklch);
}

const KEYWORDS: Record<string, string> = { black: "#000000", white: "#ffffff" };

function evaluate(expr: string, scheme: Scheme, theme: Declarations, repaint: Declarations): Lab {
  const hex = KEYWORDS[expr] ?? expr;
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hexToLab(hex);
  const variable = expr.match(/^var\(--([\w-]+)\)$/);
  if (variable) return resolve(variable[1], scheme, theme, repaint);
  const mix = expr.match(
    /^color-mix\(in oklab,\s*(var\(--[\w-]+\))\s+([\d.]+)%,\s*(var\(--[\w-]+\)|white|black)\)$/
  );
  if (mix) {
    const share = Number(mix[2]) / 100;
    const a = evaluate(mix[1], scheme, theme, repaint);
    const b = evaluate(mix[3], scheme, theme, repaint);
    return [
      a[0] * share + b[0] * (1 - share),
      a[1] * share + b[1] * (1 - share),
      a[2] * share + b[2] * (1 - share),
    ];
  }
  throw new Error(`cannot read "${expr}" in ${scheme}`);
}

/** Each registered text pair below its ratio once `repaintCss` maps `themeCss` onto the shades. */
export function contrastFailures(themeCss: string, repaintCss: string): string[] {
  const theme = schemes(themeCss, ":root");
  const repaint = schemes(repaintCss, "html:root");
  const failures: string[] = [];
  for (const check of CONTRAST_CHECKS) {
    for (const scheme of SCHEMES) {
      const colour = (swatch: P.Swatch) =>
        labToOklch(resolve(`color-${swatch.name}`, scheme, theme, repaint));
      const ratio = contrastRatio(
        colour(check.foreground[scheme]),
        colour(check.background[scheme])
      );
      if (ratio < check.minRatio) {
        failures.push(`${check.description} (${scheme}): ${ratio.toFixed(2)} < ${check.minRatio}`);
      }
    }
  }
  return failures;
}

describe("the shared theme as repaint.css maps it", () => {
  const themeCss = read("theme.css");
  const repaintCss = read("repaint.css");

  test("clears every registered text pair's ratio in both schemes", () => {
    expect(CONTRAST_CHECKS.length).toBeGreaterThanOrEqual(20);
    expect(contrastFailures(themeCss, repaintCss)).toEqual([]);
  });

  test("fails when a sky shade is set to the page colour", () => {
    const linkShade =
      "--color-sky-700: color-mix(in oklab, var(--foreground) 55%, var(--muted-foreground));";
    expect(repaintCss).toContain(linkShade);
    const broken = repaintCss.replace(linkShade, "--color-sky-700: var(--background);");
    expect(contrastFailures(themeCss, broken)).toContainEqual(
      expect.stringContaining("rail link text (light)")
    );
  });

  test("sets every slate and sky shade in both schemes", () => {
    const repaint = schemes(repaintCss, "html:root");
    const missing = SCHEMES.flatMap((scheme) =>
      ["slate", "sky"].flatMap((hue) =>
        SHADES.map((shade) => `color-${hue}-${shade}`)
          .filter((name) => !repaint[scheme].has(name))
          .map((name) => `--${name} (${scheme})`)
      )
    );
    expect(missing).toEqual([]);
  });
});
