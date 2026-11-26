import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { compile, __unstable__loadDesignSystem as loadDesignSystem } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";

import { APP_STYLESHEET, PROOF_EDITOR_SRC, REPO_ROOT, SRC_DIR, UPSTREAM_WEB } from "./source";

// The app draws upstream's pages with one stylesheet, `src/styles.css`. This test compiles it as
// the build does and fails, naming the class and a file that writes it, when a class of
// upstream's sources that upstream's own stylesheet compiles has no rule in the app's CSS.

const stylesText = readFileSync(APP_STYLESHEET, "utf8");
const UPSTREAM_SOURCE_LINE = '@source "../../dispatch/web/src";';

const scanner = new Scanner({
  sources: [UPSTREAM_WEB, PROOF_EDITOR_SRC].map((base) => ({
    base,
    pattern: "**/*",
    negated: false,
  })),
});

/** The candidates the design system of `css` turns into CSS. */
async function compiled(css: string, base: string, candidates: readonly string[]) {
  const system = await loadDesignSystem(css, { base });
  const rules = system.candidatesToCss([...candidates]);
  return candidates.filter((_, index) => rules[index] != null);
}

/** Each class candidate of upstream's sources that upstream's own stylesheet compiles. */
const upstreamCompiled = await compiled(
  readFileSync(join(UPSTREAM_WEB, "styles.css"), "utf8"),
  UPSTREAM_WEB,
  scanner.scan()
);

/** Each candidate of upstream's sources with the files that write it. Read only on a failure:
 *  it scans every file again, about a second. */
function filesByCandidate(): Map<string, Set<string>> {
  const files = new Map<string, Set<string>>();
  for (const file of scanner.files) {
    const extension = extname(file).slice(1);
    for (const { candidate } of scanner.getCandidatesWithPositions({ file, extension })) {
      files.set(candidate, (files.get(candidate) ?? new Set()).add(file));
    }
  }
  return files;
}

/** Each class upstream compiles that the app's build, from `styles`, does not scan and compile,
 *  with a file of upstream's that writes it. */
async function missing(styles: string): Promise<string[]> {
  const compiler = await compile(styles, { base: SRC_DIR, onDependency: () => {} });
  const scanned = new Set(new Scanner({ sources: compiler.sources }).scan());
  const app = new Set(
    await compiled(
      styles,
      SRC_DIR,
      upstreamCompiled.filter((candidate) => scanned.has(candidate))
    )
  );
  const lost = upstreamCompiled.filter((candidate) => !app.has(candidate));
  if (lost.length === 0) return [];
  const files = filesByCandidate();
  return lost.map((candidate) => {
    const [first, ...others] = files.get(candidate) ?? [];
    const where = first === undefined ? "no file" : relative(REPO_ROOT, first);
    const more = others.length > 0 ? ` and ${others.length} more` : "";
    return `${candidate} (${where}${more}) has no rule in the app's CSS`;
  });
}

describe("upstream's classes", () => {
  // Two design systems and a scan of three trees: a few seconds, more on a loaded machine.
  test("each class upstream's stylesheet compiles has a rule in the app's CSS", async () => {
    expect(upstreamCompiled.length).toBeGreaterThan(500);
    expect(await missing(stylesText)).toEqual([]);
  }, 60_000);

  test("names each of upstream's classes, and its file, when the stylesheet stops reading upstream's sources", async () => {
    expect(stylesText).toContain(UPSTREAM_SOURCE_LINE);
    const lost = await missing(stylesText.replace(UPSTREAM_SOURCE_LINE, ""));
    expect(lost.length).toBeGreaterThan(100);
    const named =
      /^\S+ \(packages\/dispatch\/web\/src\/\S+( and \d+ more)?\) has no rule in the app's CSS$/;
    expect(lost.filter((line) => !named.test(line))).toEqual([]);
  }, 60_000);
});
