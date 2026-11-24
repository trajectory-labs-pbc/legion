import { parseCss } from "./css";

/** A theme's custom properties in one scheme. */
export type Tokens = ReadonlyMap<string, string>;

export interface Schemes {
  light: Tokens;
  dark: Tokens;
}

type Rgb = [number, number, number];

/**
 * The `:root` tokens of stylesheets read in order. A block under `prefers-color-scheme: dark`
 * holds only in dark, one under `light` only in light, and any other in both.
 */
export function readSchemes(...stylesheets: string[]): Schemes {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  for (const stylesheet of stylesheets) {
    for (const { property, value, context } of parseCss(stylesheet).declarations) {
      if (!property.startsWith("--") || context.at(-1) !== ":root") continue;
      const scheme = context.join(" ").match(/prefers-color-scheme:\s*(light|dark)/)?.[1];
      if (scheme !== "dark") light.set(property, value);
      if (scheme !== "light") dark.set(property, value);
    }
  }
  return { light, dark };
}

function hexColour(text: string): Rgb | undefined {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex === null) return undefined;
  const digits =
    (hex[1] as string).length === 3
      ? [...(hex[1] as string)].map((d) => d + d).join("")
      : (hex[1] as string);
  return [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16)) as Rgb;
}

/** The colour a value names, as `[r, g, b]` in 0..255: hex, `var()`, or `color-mix(in srgb, …)`. */
function colourOf(tokens: Tokens, value: string, seen: readonly string[]): Rgb {
  const text = value.trim();
  const hex = hexColour(text);
  if (hex !== undefined) return hex;
  const reference = /^var\((--[\w-]+)\)$/.exec(text);
  if (reference !== null) return resolveColour(tokens, reference[1] as string, seen);
  const mix = /^color-mix\(\s*in srgb\s*,\s*(.+?)\s*(\d+(?:\.\d+)?)%\s*,\s*(.+?)\s*\)$/.exec(text);
  if (mix !== null) {
    const share = Number(mix[2]) / 100;
    const a = colourOf(tokens, mix[1] as string, seen);
    const b = colourOf(tokens, mix[3] as string, seen);
    // `in srgb` mixes the gamma-encoded channels.
    return a.map((channel, at) => channel * share + (b[at] as number) * (1 - share)) as Rgb;
  }
  throw new Error(`"${value}" is a colour this check cannot read`);
}

/** The token's colour as `[r, g, b]` in 0..255, following `var()` references. */
export function resolveColour(tokens: Tokens, name: string, seen: readonly string[] = []): Rgb {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`no token ${name}`);
  if (seen.includes(name)) throw new Error(`${name} refers to itself`);
  return colourOf(tokens, value, [...seen, name]);
}

function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export interface Pair {
  text: string;
  on: string;
  min: number;
  why: string;
  /** The one scheme the pair is held in; both when unset. */
  scheme?: "light" | "dark";
}

const SURFACES = ["--background", "--card", "--popover", "--muted", "--secondary", "--accent"];

/** The pairs the theme declares, focus on every surface, and control borders in light. */
export function declaredPairs(tokens: Tokens): Pair[] {
  const pairs: Pair[] = [];
  for (const name of tokens.keys()) {
    const surface = name.replace(/-foreground$/, "");
    if (name.endsWith("-foreground") && tokens.has(surface)) {
      pairs.push({ text: name, on: surface, min: 4.5, why: "text" });
    }
  }
  for (const on of SURFACES) {
    for (const text of ["--foreground", "--muted-foreground", "--destructive"]) {
      if (!pairs.some((pair) => pair.text === text && pair.on === on)) {
        pairs.push({ text, on, min: 4.5, why: "text" });
      }
    }
    pairs.push({ text: "--focus", on, min: 3, why: "focus indicator" });
  }
  for (const on of ["--sidebar", "--sidebar-accent"]) {
    pairs.push({ text: "--focus", on, min: 3, why: "focus indicator" });
  }
  for (const on of ["--background", "--card", "--muted"]) {
    pairs.push({ text: "--input", on, min: 3, why: "control border", scheme: "light" });
  }
  return pairs;
}

export interface Failure extends Pair {
  scheme: "light" | "dark";
  measured: number;
}

export function measure(tokens: Tokens, text: string, on: string): number {
  return Math.round(ratio(resolveColour(tokens, text), resolveColour(tokens, on)) * 100) / 100;
}

export function contrastFailures(schemes: Schemes): Failure[] {
  const failures: Failure[] = [];
  for (const scheme of ["light", "dark"] as const) {
    const tokens = schemes[scheme];
    for (const pair of declaredPairs(tokens)) {
      if (pair.scheme !== undefined && pair.scheme !== scheme) continue;
      const measured = measure(tokens, pair.text, pair.on);
      if (measured < pair.min) failures.push({ ...pair, scheme, measured });
    }
  }
  return failures;
}
