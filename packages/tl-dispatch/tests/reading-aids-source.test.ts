// The reading aids' own source rules, over every file of src/parts/reading-aids/.
import { describe, expect, test } from "bun:test";

import { type SourceFile, sourceFiles } from "./source";

const AIDS_DIR = "src/parts/reading-aids/";

/** The theme's surface tokens: the only backgrounds an aid paints. */
const SURFACES = new Set([
  "background",
  "sidebar",
  "card",
  "secondary",
  "muted",
  "accent",
  "sidebar-accent",
  "popover",
  "field",
  "scrim",
]);
const NO_PAINT = new Set(["transparent", "none", "inherit"]);

const isSurface = (name: string) => SURFACES.has(name.replace(/\/\d+$/, ""));

/** A painted value that is a surface token, or no paint. */
const paintsASurface = (value: string) => {
  const token = /^var\(--([\w-]+)\)$/.exec(value.trim());
  return NO_PAINT.has(value.trim()) || (token !== null && isSurface(token[1] ?? ""));
};

const RULES: readonly { name: string; breaks: (file: SourceFile) => boolean }[] = [
  {
    name: "a left border",
    breaks: ({ text }) =>
      /(?<![\w-])(?:[\w-]+:)*border-[ls](?:-[\w[\]().%#-]+)?(?![\w-])/.test(text) ||
      /border-(?:left|inline-start)(?:-color|-width|-style)?\s*:/.test(text),
  },
  {
    name: "a key handler (the keys are commands of the catalog)",
    breaks: ({ text }) =>
      /\bkeydown\b|\bkeyup\b|\bonKey(?:Down|Up)\b|\bhandleKey(?:Down|Up)?\b|keymap(?:\.\w+)*\(/i.test(
        text
      ),
  },
  {
    name: "a background that is not a surface token",
    breaks: ({ text }) =>
      [...text.matchAll(/(?<![\w-])(?:[\w-]+:)*bg-([\w-]+(?:\/\d+)?)/g)].some(
        ([, name = ""]) => !isSurface(name) && !NO_PAINT.has(name)
      ) ||
      [...text.matchAll(/(?<![\w-])(?:[\w-]+:)*bg-\[([^\]]*)\]/g)].some(
        ([, value = ""]) => !paintsASurface(value)
      ) ||
      [...text.matchAll(/background(?:-color)?\s*:\s*([^;}]+)/g)].some(
        ([, value = ""]) => !paintsASurface(value)
      ),
  },
];

/** Each rule each aid file breaks, as `<file>: <rule>`. */
function aidsSourceProblems(files: readonly SourceFile[]): string[] {
  return files
    .filter(({ path }) => path.startsWith(AIDS_DIR))
    .flatMap((file) =>
      RULES.filter((rule) => rule.breaks(file)).map(({ name }) => `${file.path}: ${name}`)
    );
}

const control = (name: string, text: string): SourceFile => ({ path: `${AIDS_DIR}${name}`, text });

describe("the reading aids' source rules", () => {
  test("the aids' files keep them", () => {
    const files = sourceFiles().filter(({ path }) => path.startsWith(AIDS_DIR));
    expect(files.map(({ path }) => path)).toContain(`${AIDS_DIR}hosts.tsx`);
    expect(aidsSourceProblems(files)).toEqual([]);
  });

  test.each([
    ["part.tsx", '<p className="border-l-2 border-primary">', "a left border"],
    ["part.tsx", '<p className="md:border-s-4">', "a left border"],
    ["part.css", ".x { border-inline-start: 2px solid var(--border); }", "a left border"],
    ["part.css", ".x { border-left-color: var(--primary); }", "a left border"],
    ["part.tsx", 'root.addEventListener("keydown", onKey);', "a key handler"],
    ["part.tsx", "<div onKeyDown={move} />", "a key handler"],
    ["plugin.ts", "new Plugin({ props: { handleKeyDown: () => true } });", "a key handler"],
    ["plugin.ts", "keymap({ d: next });", "a key handler"],
    ["part.tsx", 'useKeymap("d", next);', "a key handler"],
    ["part.tsx", "appKeymap.register(binding);", "a key handler"],
    ["part.tsx", '<p className="bg-primary/10">', "a background that is not a surface token"],
    ["part.tsx", '<p className="hover:bg-warning">', "a background that is not a surface token"],
    ["part.css", ".x { background: var(--primary); }", "a background that is not a surface token"],
    ["part.css", ".x { background-color: #fff; }", "a background that is not a surface token"],
    ["part.tsx", '<p className="bg-[var(--primary)]">', "a background that is not a surface token"],
  ])("refuses %s: %s", (name, text, rule) => {
    expect(aidsSourceProblems([control(name, text)])).toEqual([
      expect.stringContaining(`${AIDS_DIR}${name}: ${rule}`),
    ]);
  });

  test.each([
    ["part.tsx", '<p className="border-b border-border bg-card hover:bg-muted bg-accent/50">'],
    ["part.css", ".x { background: var(--card); border-bottom: 1px solid var(--border); }"],
    ["part.css", ".x { background-color: transparent; }"],
    ["part.tsx", '<p className="bg-[var(--card)]">'],
  ])("allows %s: %s", (name, text) => {
    expect(aidsSourceProblems([control(name, text)])).toEqual([]);
  });

  test("a file outside the aids' folder is not checked", () => {
    expect(
      aidsSourceProblems([{ path: "src/pages/x.tsx", text: '<p className="border-l-2">' }])
    ).toEqual([]);
  });
});
