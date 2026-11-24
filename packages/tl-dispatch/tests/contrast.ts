/** A theme's custom properties in one scheme. */
export type Tokens = ReadonlyMap<string, string>;

export interface Schemes {
  light: Tokens;
  dark: Tokens;
}

const DARK = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/g;
const ROOT = /(^|\})\s*:root\s*\{([^}]*)\}/gm;
const DECLARATION = /(--[\w-]+)\s*:\s*([^;]+);/g;

function declarations(block: string): [string, string][] {
  return [...block.matchAll(DECLARATION)].map((match) => [
    match[1] as string,
    (match[2] as string).trim(),
  ]);
}

/** The tokens of one or more stylesheets read in order: bare `:root` is light, the dark media block is dark. */
export function readSchemes(...stylesheets: string[]): Schemes {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  for (const stylesheet of stylesheets) {
    const css = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
    const withoutDark = css.replace(DARK, (block) => {
      for (const [name, value] of declarations(block.slice(block.indexOf(":root"))))
        dark.set(name, value);
      return "}";
    });
    for (const match of withoutDark.matchAll(ROOT)) {
      for (const [name, value] of declarations(match[2] as string)) light.set(name, value);
    }
  }
  return { light, dark: new Map([...light, ...dark]) };
}

/** The token's colour as `[r, g, b]` in 0..255, following `var()` references. */
export function resolveColour(
  tokens: Tokens,
  name: string,
  seen: string[] = []
): [number, number, number] {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`no token ${name}`);
  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  if (reference !== null) {
    if (seen.includes(name)) throw new Error(`${name} refers to itself`);
    return resolveColour(tokens, reference[1] as string, [...seen, name]);
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
  if (hex === null) throw new Error(`${name} is "${value}", which this check cannot read`);
  const digits =
    (hex[1] as string).length === 3
      ? [...(hex[1] as string)].map((d) => d + d).join("")
      : (hex[1] as string);
  return [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export interface Pair {
  text: string;
  on: string;
  min: number;
  why: string;
}

const SURFACES = ["--background", "--card", "--popover", "--muted", "--secondary", "--accent"];

/** The pairs the theme declares, and the focus indicator on every surface. */
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
  return pairs;
}

export interface Failure extends Pair {
  scheme: "light" | "dark";
  measured: number;
}

export function contrastFailures(schemes: Schemes): Failure[] {
  const failures: Failure[] = [];
  for (const scheme of ["light", "dark"] as const) {
    const tokens = schemes[scheme];
    for (const pair of declaredPairs(tokens)) {
      const measured = ratio(resolveColour(tokens, pair.text), resolveColour(tokens, pair.on));
      if (measured < pair.min)
        failures.push({ ...pair, scheme, measured: Math.round(measured * 100) / 100 });
    }
  }
  return failures;
}
