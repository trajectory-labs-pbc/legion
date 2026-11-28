// Holds each parity list in tests/parity to the tests: an item of a rebuilt region has a test whose
// name starts with its ID, and a test that names an ID names an item of a list. The rules are in
// the package's README, "Checks".
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

import { git } from "../tests/git";
import { PACKAGE_ROOT, UPSTREAM_WEB } from "../tests/source";
import { literal, parseScript } from "../tests/typescript";

const PARITY_DIR = join(PACKAGE_ROOT, "tests/parity");
/** Upstream's browser tests, whose names an "inside" row may also give. */
const UPSTREAM_E2E = join(UPSTREAM_WEB, "../../e2e");

const MARKS = ["", "changed", "After next sync", "inside", "untested"] as const;
/**
 * An item's mark: none, a change on purpose, upstream's behaviour from a later commit, upstream's
 * own test, or an item of a rebuilt region with no test yet.
 */
export type Mark = (typeof MARKS)[number];
const isMark = (mark: string): mark is Mark => (MARKS as readonly string[]).includes(mark);

export interface Item {
  id: string;
  region: string;
  mark: Mark;
  /**
   * The reason of a "changed" item, the upstream commit of an "After next sync" item, the upstream
   * test of an "inside" item, and why an "untested" item has no test.
   */
  note: string;
}

export interface ParityList {
  /** The list's path from the package, for a message. */
  list: string;
  /** Each region of the page, rebuilt or not. */
  regions: Map<string, boolean>;
  items: Item[];
}

/** An ID: two to five capitals, a dash and a number. A test names one with its first word. */
const ID = /^[A-Z]{2,5}-\d+$/;

/** The cells of each row of each Markdown table of `text`, header and divider rows left out. */
function tableRows(text: string): string[][][] {
  const tables: string[][][] = [];
  let current: string[][] | undefined;
  for (const line of text.split("\n")) {
    if (!line.trim().startsWith("|")) {
      current = undefined;
      continue;
    }
    // A cell may hold an escaped `\|`.
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/(?<!\\)\|$/, "")
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replaceAll("\\|", "|"));
    if (current === undefined) {
      current = [cells];
      tables.push(current);
    } else if (!cells.every((cell) => /^:?-+:?$/.test(cell))) {
      current.push(cells);
    }
  }
  return tables;
}

const unquote = (cell: string) => cell.replace(/^`(.*)`$/, "$1");

/**
 * A parity list: a table whose header starts `Region | Rebuilt` (`yes` or `no` in each row), and a
 * table whose header starts `ID | Region | Item | Mark | Note`. The problems are those of each
 * row's own cells.
 */
export function parseList(list: string, text: string): { parsed: ParityList; problems: string[] } {
  const parsed: ParityList = { list, regions: new Map(), items: [] };
  const problems: string[] = [];
  for (const [header = [], ...rows] of tableRows(text)) {
    const head = header.join("|").toLowerCase();
    if (head.startsWith("region|rebuilt")) {
      for (const [region = "", rebuilt = ""] of rows) {
        if (rebuilt !== "yes" && rebuilt !== "no") {
          problems.push(`${list}: region ${region} says rebuilt "${rebuilt}": write yes or no`);
        }
        parsed.regions.set(region, rebuilt === "yes");
      }
    } else if (head.startsWith("id|region|item|mark|note")) {
      for (const [id = "", region = "", , mark = "", note = ""] of rows) {
        if (isMark(mark)) {
          parsed.items.push({ id, region, mark, note: unquote(note) });
        } else {
          problems.push(
            `${list}: ${id} has the mark "${mark}": write changed, After next sync, inside, untested or nothing`
          );
        }
      }
    }
  }
  if (parsed.regions.size === 0) problems.push(`${list} has no Region | Rebuilt table`);
  if (parsed.items.length === 0) {
    problems.push(`${list} has no ID | Region | Item | Mark | Note table`);
  }
  for (const { id, region, mark, note } of parsed.items) {
    const at = `${list}: ${id}`;
    if (!ID.test(id)) problems.push(`${at} is no ID: write capitals, a dash and a number`);
    if (!parsed.regions.has(region)) {
      problems.push(`${at} names the region ${region}, which the Region | Rebuilt table lacks`);
    }
    if ((mark === "changed" || mark === "untested") && note === "") {
      problems.push(`${at} is marked ${mark} with no reason: give the reason in its Note`);
    }
    if (mark === "After next sync" && !/^[0-9a-f]{7,40}$/.test(note)) {
      problems.push(`${at} is marked After next sync with no upstream commit in its Note`);
    }
  }
  return { parsed, problems };
}

/** The node under `as const`, `satisfies` and parentheses. */
function bare(node: ts.Expression): ts.Expression {
  return ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node)
    ? bare(node.expression)
    : node;
}

/** The rows of a table a test loops over: an array written there, or a top-level `const` that holds one. */
function tableOf(node: ts.Expression, source: ts.SourceFile): readonly ts.Expression[] {
  const table = bare(node);
  if (ts.isArrayLiteralExpression(table)) return table.elements;
  if (!ts.isIdentifier(table)) return [];
  const declaration = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((found) => ts.isIdentifier(found.name) && found.name.text === table.text);
  const rows = declaration?.initializer && bare(declaration.initializer);
  return rows && ts.isArrayLiteralExpression(rows) ? rows.elements : [];
}

/** The string a row starts with: the row itself, or its first element. */
function firstOf(row: ts.Expression): string | undefined {
  const value = bare(row);
  return ts.isArrayLiteralExpression(value) ? literal(value.elements[0]) : literal(value);
}

/** Each value of `name` in the `for (const [name, ...] of rows)` loop around `node`. */
function loopValues(node: ts.Node, name: string, source: ts.SourceFile): string[] {
  for (let at: ts.Node | undefined = node.parent; at !== undefined; at = at.parent) {
    if (!ts.isForOfStatement(at) || !ts.isVariableDeclarationList(at.initializer)) continue;
    const binding = at.initializer.declarations[0]?.name;
    const first = binding && ts.isArrayBindingPattern(binding) ? binding.elements[0] : binding;
    const bound = first && ts.isBindingElement(first) ? first.name : first;
    if (bound && ts.isIdentifier(bound) && bound.text === name) {
      return tableOf(at.expression, source).flatMap((row) => firstOf(row) ?? []);
    }
  }
  return [];
}

/** The names a title gives: its text, or one for each value of a loop it starts with. */
function titlesOf(title: ts.Expression, source: ts.SourceFile): string[] {
  const text = literal(title);
  if (text !== undefined) return [text];
  if (!ts.isTemplateExpression(title) || title.head.text !== "") return [];
  const [first, ...rest] = title.templateSpans;
  if (first === undefined || !ts.isIdentifier(first.expression)) return [];
  const tail = [first.literal.text, ...rest.map((span) => `…${span.literal.text}`)].join("");
  return loopValues(title, first.expression.text, source).map((value) => value + tail);
}

const isTestName = (node: ts.Node) =>
  ts.isIdentifier(node) && (node.text === "test" || node.text === "it");

/** Whether `callee` runs a test: `test(`, `it(` and their `only` and `concurrent` forms. */
function runsTest(callee: ts.Expression): boolean {
  return (
    isTestName(callee) ||
    (ts.isPropertyAccessExpression(callee) &&
      isTestName(callee.expression) &&
      ["only", "concurrent"].includes(callee.name.text))
  );
}

/** The table of a `test.each(table)` or `it.each(table)` call, or undefined for another call. */
function eachTable(callee: ts.Expression): ts.Expression | undefined {
  return ts.isCallExpression(callee) &&
    ts.isPropertyAccessExpression(callee.expression) &&
    isTestName(callee.expression.expression) &&
    callee.expression.name.text === "each"
    ? callee.arguments[0]
    : undefined;
}

/** A `describe.skip(` or `describe.todo(` call, whose tests do not run. */
const skipsGroup = (callee: ts.Expression) =>
  ts.isPropertyAccessExpression(callee) &&
  ts.isIdentifier(callee.expression) &&
  callee.expression.text === "describe" &&
  ["skip", "todo"].includes(callee.name.text);

/** The names one call gives: a test's, or a `.each` test's for each row of its table. */
function callNames(call: ts.CallExpression, source: ts.SourceFile): string[] {
  const [title] = call.arguments;
  if (title === undefined) return [];
  if (runsTest(call.expression)) return titlesOf(title, source);
  const table = eachTable(call.expression);
  const text = literal(title);
  if (table === undefined || text === undefined) return [];
  if (!text.startsWith("%s")) return [text];
  return tableOf(table, source)
    .flatMap((row) => firstOf(row) ?? [])
    .map((id) => id + text.slice(2));
}

/**
 * The name of each test of a file that runs, including those under `describe`. A title that
 * starts with the first value of each row of a `.each` table (`%s`), or with the first value of
 * each row of a `for...of` loop (`${id}`), gives one name for each row.
 */
export function testNames(source: ts.SourceFile): string[] {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      if (skipsGroup(node.expression)) return;
      names.push(...callNames(node, source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

/**
 * The test names of the unit and browser test files under `root`, none when it does not exist.
 * Given `wanted`, it parses only the files whose text holds the start of one of those names.
 */
function namesUnder(root: string, wanted?: readonly string[]): string[] {
  if (!existsSync(root)) return [];
  // A title written with an escaped quote differs from its text up to the quote.
  const starts = wanted?.map((name) => name.split(/['"`\\]/, 1)[0] ?? name);
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(test|e2e)\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.includes("/node_modules/"))
    .map((path) => ({ path, text: readFileSync(path, "utf8") }))
    .filter(({ text }) => starts === undefined || starts.some((start) => text.includes(start)))
    .flatMap(({ path, text }) => testNames(parseScript(path, text)));
}

/** The names of a package's tests: its unit tests and its browser tests. */
export const packageTestNames = (root: string): string[] =>
  ["src", "tests", "scripts", "e2e"].flatMap((dir) => namesUnder(join(root, dir)));

export interface Facts {
  /** The names of this package's tests. */
  tests: readonly string[];
  /** The names of upstream's tests. */
  upstreamTests: ReadonlySet<string>;
  /** Whether HEAD's history holds the commit; a commit this clone does not have is not in it. */
  inBranch: (sha: string) => boolean;
}

/** The ID a test names: its first word, when that is an ID. */
const idOf = (name: string) => {
  const [word = ""] = name.split(" ", 1);
  return ID.test(word) ? word : undefined;
};

/** Each way the lists disagree with the tests, with upstream's tests and with git. */
export function parityProblems(lists: readonly ParityList[], facts: Facts): string[] {
  const problems: string[] = [];
  const tested = new Set(facts.tests.flatMap((name) => idOf(name) ?? []));
  /** The list of each ID. */
  const listOf = new Map<string, string>();
  for (const { list, regions, items } of lists) {
    for (const { id, region, mark, note } of items) {
      const at = `${list}: ${id}`;
      const first = listOf.get(id);
      if (first !== undefined) {
        problems.push(`${at} is a second row with this ID; the first is in ${first}`);
      }
      listOf.set(id, first ?? list);
      if (mark === "After next sync" && facts.inBranch(note)) {
        problems.push(
          `${at} is marked After next sync, but ${note} is already in this branch: port it, test it and drop the mark`
        );
      }
      if (mark === "inside" && !facts.upstreamTests.has(note)) {
        problems.push(`${at} is marked inside, but upstream has no test named "${note}"`);
      }
      if (mark === "untested" && tested.has(id)) {
        problems.push(`${at} is marked untested, but a test name starts with ${id}: drop the mark`);
      }
      const exempt = mark === "After next sync" || mark === "inside" || mark === "untested";
      if (regions.get(region) === true && !exempt && !tested.has(id)) {
        problems.push(
          `${at} is in the rebuilt region ${region} and no test name starts with ${id}`
        );
      }
    }
  }
  for (const name of facts.tests) {
    const id = idOf(name);
    if (id !== undefined && !listOf.has(id)) {
      problems.push(
        `the test "${name}" names ${id}, which no list in tests/parity has: add its row or rename the test`
      );
    }
  }
  return problems;
}

/** Whether HEAD's history holds `sha`. */
export const inBranch = (sha: string) => git(["merge-base", "--is-ancestor", sha, "HEAD"]).ok;

/** The package's lists, with the problems of their own cells. */
function readLists(): { lists: ParityList[]; problems: string[] } {
  const parsed = readdirSync(PARITY_DIR)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) =>
      parseList(
        relative(PACKAGE_ROOT, join(PARITY_DIR, name)),
        readFileSync(join(PARITY_DIR, name), "utf8")
      )
    );
  return {
    lists: parsed.map((entry) => entry.parsed),
    problems: parsed.flatMap((entry) => entry.problems),
  };
}

/** The notes of the rows marked `mark`. */
const notesOf = (lists: readonly ParityList[], mark: Mark) =>
  lists.flatMap((list) => list.items.filter((item) => item.mark === mark).map((item) => item.note));

/** The package's lists against its tests, upstream's tests and this clone's history. */
function checkPackage(): { lists: ParityList[]; problems: string[] } {
  const { lists, problems } = readLists();
  const inside = notesOf(lists, "inside");
  const facts: Facts = {
    tests: packageTestNames(PACKAGE_ROOT),
    // Upstream has thousands of tests: read only the files that may hold an "inside" row's.
    upstreamTests: new Set(
      inside.length > 0
        ? [...namesUnder(UPSTREAM_WEB, inside), ...namesUnder(UPSTREAM_E2E, inside)]
        : []
    ),
    inBranch,
  };
  return { lists, problems: [...problems, ...parityProblems(lists, facts)] };
}

if (import.meta.main) {
  const { lists, problems } = checkPackage();
  for (const line of problems) console.error(line);
  if (problems.length > 0) process.exit(1);
  for (const list of lists) {
    const untested = notesOf([list], "untested").length;
    console.log(`parity: ${list.list} ${list.items.length} items, ${untested} untested`);
  }
}
