import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "../tests/git";
import { parseScript } from "../tests/typescript";
import {
  commitPlace,
  type Facts,
  type ParityList,
  parityProblems,
  parseList,
  testNames,
} from "./check-parity";

const LIST = `# Shell

| Region | Rebuilt |
| --- | --- |
| Sign-in | yes |
| Writes | no |

| ID | Region | Item | Mark | Note |
| --- | --- | --- | --- | --- |
| SHL-1 | Sign-in | The sign-in channel's listener | | |
| SHL-2 | Sign-in | Sign-out asks first | changed | The dialog is the UI package's |
| SHL-3 | Writes | The write store's resume | | |
| SHL-4 | Sign-in | A new key | After next sync | abc1234 |
| SHL-5 | Sign-in | Upstream's own test | inside | the channel answers |
| SHL-6 | Sign-in | The sign-in page | untested | No test draws it yet |
`;

const list = (text = LIST) => {
  const { parsed, problems } = parseList("tests/parity/shell.md", text);
  expect(problems).toEqual([]);
  return parsed;
};

const facts = (overrides: Partial<Facts> = {}): Facts => ({
  tests: [
    "SHL-1 listens while mounted",
    "SHL-2 asks first while a change is unsent",
    "a test with no ID",
  ],
  upstreamTests: new Set(["the channel answers"]),
  commit: () => "not yet",
  ...overrides,
});

const check = (lists: ParityList[], given: Facts) => parityProblems(lists, given);

describe("the parity script", () => {
  test("passes a list whose rebuilt items each have a test", () => {
    expect(check([list()], facts())).toEqual([]);
  });

  test("names the item of a rebuilt region whose test is gone", () => {
    expect(check([list()], facts({ tests: ["SHL-2 asks first"] }))).toEqual([
      "tests/parity/shell.md: SHL-1 is in the rebuilt region Sign-in and no test name starts with SHL-1",
    ]);
  });

  test("an item of a region not yet rebuilt needs no test", () => {
    const problems = check([list()], facts());
    expect(problems.some((line) => line.includes("SHL-3"))).toBe(false);
  });

  test("names the test whose ID has no row", () => {
    const text = LIST.replace("| SHL-1 | Sign-in | The sign-in channel's listener | | |\n", "");
    expect(check([list(text)], facts())).toEqual([
      'the test "SHL-1 listens while mounted" names SHL-1, which no list in tests/parity has: add its row or rename the test',
    ]);
  });

  test("names a changed item with no reason", () => {
    const text = LIST.replace("| changed | The dialog is the UI package's |", "| changed | |");
    expect(parseList("tests/parity/shell.md", text).problems).toEqual([
      "tests/parity/shell.md: SHL-2 is marked changed with no reason: give the reason in its Note",
    ]);
  });

  test("fails an After next sync row whose commit is already in the branch", () => {
    expect(
      check([list()], facts({ commit: (sha) => (sha === "abc1234" ? "in branch" : "not yet") }))
    ).toEqual([
      "tests/parity/shell.md: SHL-4 is marked After next sync, but abc1234 is already in this branch: port it, test it and drop the mark",
    ]);
  });

  test("fails an After next sync row whose commit git does not know", () => {
    expect(check([list()], facts({ commit: () => "unknown" }))).toEqual([
      "tests/parity/shell.md: SHL-4 is marked After next sync, but git does not know abc1234: fetch upstream's main, or correct the commit",
    ]);
  });

  test("an untested row waits without a test, and fails once a test names it", () => {
    expect(check([list()], facts({ tests: [...facts().tests, "SHL-6 draws it"] }))).toEqual([
      "tests/parity/shell.md: SHL-6 is marked untested, but a test name starts with SHL-6: drop the mark",
    ]);
    const unmarked = LIST.replace("| untested | No test draws it yet |", "| | |");
    expect(check([list(unmarked)], facts())).toEqual([
      "tests/parity/shell.md: SHL-6 is in the rebuilt region Sign-in and no test name starts with SHL-6",
    ]);
  });

  test("reads an escaped pipe inside a cell", () => {
    const text = LIST.replace("| inside | the channel answers |", "| inside | a \\| b |");
    expect(list(text).items.find((item) => item.id === "SHL-5")?.note).toBe("a | b");
  });

  test("fails an inside row whose test upstream does not have", () => {
    expect(check([list()], facts({ upstreamTests: new Set() }))).toEqual([
      'tests/parity/shell.md: SHL-5 is marked inside, but upstream has no test named "the channel answers"',
    ]);
  });

  test("an ID is a prefix of the name, not part of another ID", () => {
    for (const name of ["SHL-10 something", "SHL-1.5 something", "SHL-1: something"]) {
      expect(check([list()], facts({ tests: [name, "SHL-2 asks first"] }))).toContain(
        "tests/parity/shell.md: SHL-1 is in the rebuilt region Sign-in and no test name starts with SHL-1"
      );
    }
  });

  test("refuses a row whose cells break the list's rules, and a list with no tables", () => {
    expect(parseList("x.md", LIST.replace("| changed |", "| moved |")).problems).toEqual([
      'x.md: SHL-2 has the mark "moved": write changed, After next sync, inside, untested or nothing',
    ]);
    expect(
      parseList("x.md", LIST.replace("| SHL-3 | Writes |", "| SHL-3 | Rail |")).problems
    ).toEqual(["x.md: SHL-3 names the region Rail, which the Region | Rebuilt table lacks"]);
    expect(parseList("x.md", LIST.replace("| SHL-1 |", "| shl-1 |")).problems).toEqual([
      "x.md: shl-1 is no ID: write capitals, a dash and a number",
    ]);
    expect(parseList("x.md", LIST.replace("| No test draws it yet |", "| |")).problems).toEqual([
      "x.md: SHL-6 is marked untested with no reason: give the reason in its Note",
    ]);
    expect(parseList("x.md", LIST.replace("| abc1234 |", "| soon |")).problems).toEqual([
      "x.md: SHL-4 is marked After next sync with no upstream commit in its Note",
    ]);
    expect(parseList("x.md", "# Empty\n").problems).toEqual([
      "x.md has no Region | Rebuilt table",
      "x.md has no ID | Region | Item | Mark | Note table",
    ]);
  });

  test("reads the title of each test and it call, under describe, and skips a skipped one", () => {
    const source = parseScript(
      "x.test.ts",
      [
        'describe("d", () => { test("SHL-1 a", () => {}); it(`SHL-2 b`, () => {}); test.skip("SHL-3 c", () => {}); });',
        'test.only("SHL-4 d", () => {}); describe.skip("e", () => { test("SHL-5 e", () => {}); });',
      ].join("\n")
    );
    expect(testNames(source)).toEqual(["SHL-1 a", "SHL-2 b", "SHL-4 d"]);
  });

  test("reads the title of each test.each and it.each call", () => {
    const source = parseScript(
      "x.test.ts",
      'test.each([1])("SHL-1 at %s", () => {}); it.each([2])("SHL-2 at %s", () => {}); describe.each([3])("SHL-3 %s", () => {});'
    );
    expect(testNames(source)).toEqual(["SHL-1 at %s", "SHL-2 at %s"]);
  });

  test("gives one name for each row when a title starts with the row's ID", () => {
    const source = parseScript(
      "x.test.ts",
      [
        'const ROWS = [["SHL-1", "a"], ["SHL-2", "b"]] as const;',
        'test.each(ROWS)("%s presses %s", () => {});',
        'it.each(["SHL-3"])("%s alone", () => {});',
        'for (const [id, word] of [["SHL-4", "c"], ["SHL-5", "d"]] as const) {',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the text is a test file's source, whose template the script reads
        "  test(`${id} says ${word}`, () => {});",
        "}",
      ].join("\n")
    );
    expect(testNames(source)).toEqual([
      "SHL-1 presses %s",
      "SHL-2 presses %s",
      "SHL-3 alone",
      "SHL-4 says …",
      "SHL-5 says …",
    ]);
  });

  test("names a second row with an ID another row has", () => {
    const other = parseList("tests/parity/other.md", LIST.replace("# Shell", "# Other")).parsed;
    expect(
      check([list(), other], facts()).filter((line) => line.includes("second row"))
    ).toHaveLength(6);
  });

  test("places a commit in this branch, after it, or outside this clone", () => {
    const repo = mkdtempSync(join(tmpdir(), "parity-"));
    try {
      // A repository of its own, so no hook or signing setting of the machine applies.
      const settings = [
        "user.name=parity",
        "user.email=parity@example.invalid",
        "commit.gpgsign=false",
        "core.hooksPath=/dev/null",
      ].flatMap((setting) => ["-c", setting]);
      const run = (...args: string[]) => git([...settings, ...args], repo).out.trim();
      run("init", "-q");
      run("commit", "-q", "--allow-empty", "-m", "the branch");
      const head = run("rev-parse", "HEAD");
      // A commit on top of HEAD that no branch holds: the clone knows it, HEAD's history does not.
      const later = run("commit-tree", "HEAD^{tree}", "-p", "HEAD", "-m", "a later commit");
      expect(commitPlace(head, repo)).toBe("in branch");
      expect(commitPlace(later, repo)).toBe("not yet");
      expect(commitPlace("0000000000000000000000000000000000000000", repo)).toBe("unknown");
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
