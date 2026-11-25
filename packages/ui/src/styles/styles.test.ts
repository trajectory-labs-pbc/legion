import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Style rules every component keeps, read from the sources' class strings and the stylesheet.
const src = join(import.meta.dirname, "..");
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
const utility = (token: string): string => token.slice(token.lastIndexOf(":") + 1);
const variants = (token: string): string => token.slice(0, token.lastIndexOf(":") + 1);
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

type Rgb = [number, number, number];

const stylesheet = readFileSync(join(src, "styles", "globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  ""
);
const block = (pattern: RegExp): string => {
  const body = stylesheet.match(pattern)?.[1];
  if (body === undefined) throw new Error(`globals.css has no block ${pattern}`);
  return body;
};
const THEMES = {
  light: block(/^:root\s*\{([^}]*)\}/m),
  dark: block(/^\.dark\s*\{([^}]*)\}/m),
};
const OS_DARK = block(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root\s*\{([^}]*)\}/);

const declarations = (body: string): string[] =>
  body
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean);

function hex(body: string, name: string): Rgb {
  const value = body.match(new RegExp(`--${name}:\\s*#([0-9a-f]{6});`))?.[1];
  if (value === undefined) throw new Error(`globals.css has no hex --${name}`);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as Rgb;
}

// color-mix(in srgb, var(--foreground) N%, var(--background)), the only form --input takes.
function input(body: string): Rgb {
  const share = body.match(
    /--input:\s*color-mix\(in srgb, var\(--foreground\) (\d+)%, var\(--background\)\);/
  )?.[1];
  if (share === undefined) throw new Error("--input is not a foreground mix");
  const [fg, bg, p] = [hex(body, "foreground"), hex(body, "background"), Number(share) / 100];
  return fg.map((channel, i) => channel * p + (bg[i] ?? 0) * (1 - p)) as Rgb;
}

function luminance(colour: Rgb): number {
  const [r, g, b] = colour.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe("the components", () => {
  it("draw focus as one solid outline in the focus colour, offset from the element", () => {
    expect(everyToken.filter(({ token }) => /ring-ring|outline-ring/.test(token))).toEqual([]);
    expect(
      everyToken.filter(
        ({ token }) =>
          variants(token).includes("focus") &&
          /^(ring-(?!0$)|opacity|border-ring)/.test(utility(token))
      )
    ).toEqual([]);
    const widths = everyToken.filter(({ token }) => utility(token) === "outline-2");
    expect(widths.length).toBeGreaterThan(10);
    for (const { path, token } of widths) {
      expect(tokensOf(path), `${path}: ${token}`).toContain(`${variants(token)}outline-offset-2`);
      expect(tokensOf(path), `${path}: ${token}`).toContain(`${variants(token)}outline-focus`);
    }
  });

  it("move only when the reader allows motion", () => {
    const moving = everyToken.filter(({ token }) => /^(transition|animate-)/.test(utility(token)));
    expect(moving.length).toBeGreaterThan(10);
    expect(moving.filter(({ token }) => !variants(token).includes("motion-safe:"))).toEqual([]);
    expect(everyToken.filter(({ token }) => token.includes("motion-reduce:"))).toEqual([]);
  });

  it("round only dots and avatars, and take every other corner from the radius token", () => {
    const round = SOURCES.flatMap(({ text }) =>
      [...text.matchAll(/rounded-full/g)].map((match) => {
        const before = text.slice(0, match.index);
        return [...before.matchAll(/data-slot="([^"]+)"/g)].at(-1)?.[1] ?? "none";
      })
    );
    expect(round.sort()).toEqual(ROUND_SLOTS);
    expect(everyToken.filter(({ token }) => /^rounded.*\[/.test(utility(token)))).toEqual([]);
  });

  it("mark a highlighted item and a pressed toggle with an edge, not a fill alone", () => {
    expect(
      everyToken.filter(({ token }) => /(highlighted|pressed)\]?:bg-accent/.test(token))
    ).toEqual([]);
    for (const [path, state] of [
      ["components/combobox.tsx", "data-highlighted:"],
      ["components/dropdown-menu.tsx", "data-highlighted:"],
      ["components/select.tsx", "data-highlighted:"],
      ["components/toggle.tsx", "data-pressed:"],
    ] as const) {
      expect(tokensOf(path), path).toContain(`${state}inset-ring`);
      expect(tokensOf(path), path).toContain(`${state}inset-ring-muted-foreground`);
    }
  });
});

describe("the theme", () => {
  it("gives the OS dark setting the same values as the .dark class", () => {
    expect(declarations(OS_DARK)).toEqual(declarations(THEMES.dark));
  });

  it.each(
    Object.entries(THEMES)
  )("keeps the focus outline and the state edge at 3:1 on every surface, %s", (_name, body) => {
    for (const surface of ["background", "card", "popover", "field", "muted", "accent"]) {
      const ground = hex(body, surface);
      expect(contrast(hex(body, "focus"), ground), `focus on ${surface}`).toBeGreaterThanOrEqual(3);
      expect(
        contrast(hex(body, "muted-foreground"), ground),
        `edge on ${surface}`
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(
    Object.entries(THEMES)
  )("keeps a field's edge at 3:1 on the page, a card and muted, %s", (_name, body) => {
    for (const surface of ["background", "card", "muted"]) {
      expect(
        contrast(input(body), hex(body, surface)),
        `input on ${surface}`
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
