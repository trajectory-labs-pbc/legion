// The reading aids' own source rules, over every file of src/features/reading-aids/.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { type SourceFile, sourceFiles, UPSTREAM_WEB } from "./source";

const AIDS_DIR = "src/features/reading-aids/";
const READS = `${AIDS_DIR}reads.ts`;

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

/** Upstream's module `specifier` names, read from upstream's web app, or "" if none. */
function upstreamModule(specifier: string): string {
  const base = join(UPSTREAM_WEB, specifier);
  const found = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]
    .map((ending) => `${base}${ending}`)
    .find((path) => /\.tsx?$/.test(path) && existsSync(path));
  return found === undefined ? "" : readFileSync(found, "utf8");
}

const QUERY_CALLS = [
  "useQuery",
  "useQueries",
  "useSuspenseQuery",
  "useInfiniteQuery",
  "queryOptions",
];
const callOf = (names: readonly string[]) => new RegExp(`\\b(?:${names.join("|")})\\(`);
const READS_A_QUERY = callOf(QUERY_CALLS);
const TAKES_A_READ = callOf([...QUERY_CALLS, "ensureQueryData", "fetchQuery", "prefetchQuery"]);

/** Whether `text` imports upstream's client, or a query hook or options of an upstream module that
 *  reads one. */
function importsUpstreamReads(text: string): boolean {
  return [
    ...text.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*"@upstream-dispatch\/([^"]+)"/g),
  ].some(([, typeOnly, names = "", specifier = ""]) => {
    if (typeOnly !== undefined) return false;
    if (specifier.startsWith("api/")) return true;
    const values = names
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "" && !name.startsWith("type "));
    return (
      values.some((name) => /^use[A-Z]|Query$/.test(name)) &&
      READS_A_QUERY.test(upstreamModule(specifier))
    );
  });
}

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
  {
    name: "upstream's reads outside reads.ts",
    breaks: ({ path, text }) =>
      path !== READS && (importsUpstreamReads(text) || TAKES_A_READ.test(text)),
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
    expect(files.map(({ path }) => path)).toContain(READS);
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
    [
      "part.tsx",
      'import { issueQuery } from "@upstream-dispatch/api/queries";',
      "upstream's reads",
    ],
    ["part.tsx", 'import { api } from "@upstream-dispatch/api/client";', "upstream's reads"],
    [
      "part.tsx",
      'import { issueAsksQuery } from "@upstream-dispatch/features/issue-page/useIssueTree";',
      "upstream's reads",
    ],
    [
      "part.tsx",
      'import { useProjectArtifact } from "@upstream-dispatch/features/document/useProjectArtifact";',
      "upstream's reads",
    ],
    ["part.tsx", "const asks = useQuery(asksQuery(document));", "upstream's reads"],
    ["part.tsx", "const pages = useInfiniteQuery(pagesQuery);", "upstream's reads"],
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
    [
      "part.ts",
      'import { blockFragment } from "@upstream-dispatch/features/refs/block-reference";',
    ],
    ["part.ts", 'import type { Artifact } from "@upstream-dispatch/api/types";'],
    ["reads.ts", "export const asks = () => useQuery(asksQuery(document));"],
  ])("allows %s: %s", (name, text) => {
    expect(aidsSourceProblems([control(name, text)])).toEqual([]);
  });

  test("a file outside the aids' folder is not checked", () => {
    expect(
      aidsSourceProblems([{ path: "src/pages/x.tsx", text: '<p className="border-l-2">' }])
    ).toEqual([]);
  });
});
