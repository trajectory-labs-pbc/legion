import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_ROOT, REPO_ROOT } from "../source";
import {
  type Copy,
  copyFiles,
  copyProblems,
  hash,
  parseUpdate,
  partText,
  readPins,
  repin,
  unexplainedPins,
  unpinnedReplacedViews,
  unpinnedRouteTargets,
  upstreamDiff,
} from "./copies";
import { routeTargets } from "./source";

const APP = "packages/dispatch/web/src/app.tsx";
const appText = () => readFileSync(join(REPO_ROOT, APP), "utf8");
const pin = (part: string) => {
  const found = readPins().find((entry) => entry.file === APP && entry.part === part);
  if (!found) throw new Error(`no pin for ${part}`);
  return found;
};
const problemsWith = (text: string, part: string) =>
  copyProblems([pin(part)], (file, name) => partText(file, name, text));

describe("copied upstream code", () => {
  test("upstream has not changed a part this app copies", () => {
    const pins = readPins();
    expect(pins.length).toBeGreaterThan(20);
    const problems = pins.flatMap((entry) => {
      const found = copyProblems([entry]);
      if (found.length > 0) console.error(upstreamDiff(entry));
      return found;
    });
    expect(problems).toEqual([]);
  });

  test("each pin names files of this app that hold the copy", () => {
    const missing = readPins()
      .flatMap(copyFiles)
      .filter((copy) => !existsSync(join(PACKAGE_ROOT, copy)));
    expect(missing).toEqual([]);
  });

  test("names a part upstream changed, one it removed, and a file it removed", () => {
    const [first] = readPins();
    if (!first) throw new Error("no pins");
    const changed = { ...first, sha256: "0".repeat(64) };
    const removed = { ...first, part: "NoSuchPart" };
    const gone = { ...first, file: "packages/dispatch/web/src/features/gone/Gone.tsx", part: "*" };
    const since = (file: string) =>
      `since ${first.commit.slice(0, 12)}, which ${first.copy} copies: port the change (git diff ${first.commit.slice(0, 12)} -- ${file})`;
    expect(copyProblems([changed, removed, gone])).toEqual([
      `${first.file} changed ${first.part} ${since(first.file)}, or close it, then run \`bun tests/map/copies.ts --update ${first.file} '${first.part}' --outcome ported --reason '<why>'\`, or \`--outcome closed\` for a change not ported`,
      `${first.file} no longer has NoSuchPart ${since(first.file)}, then remove or rename its entry in copies.json, and give the pin that replaces it an outcome and a reason`,
      `${gone.file} no longer has * ${since(gone.file)}, then remove or rename its entry in copies.json, and give the pin that replaces it an outcome and a reason`,
    ]);
  });

  test("a problem names every file of this app that holds the copy", () => {
    const [first] = readPins();
    if (!first) throw new Error("no pins");
    const spread = { ...first, sha256: "0".repeat(64), also: ["src/shell/sidebar-data.ts"] };
    expect(copyProblems([spread])[0]).toContain(
      `which ${first.copy} and src/shell/sidebar-data.ts copies`
    );
  });

  test("an update pins the one part it names and leaves the others stale", () => {
    const stale = readPins()
      .filter((entry) => entry.file === APP)
      .slice(0, 2)
      .map((entry) => ({ ...entry, commit: "old", sha256: "0".repeat(64) }));
    const [first, second] = stale;
    if (!first || !second) throw new Error("fewer than two pins");
    const pinned = repin(stale, APP, first.part, {}, partText, () => "new");
    expect(pinned).toEqual([
      { ...first, commit: "new", sha256: hash(partText(APP, first.part) ?? "") },
      second,
    ]);
    expect(copyProblems(pinned)).toHaveLength(1);
    expect(() => repin(stale, APP, "NoSuchPart")).toThrow("no pin for NoSuchPart");
  });

  test("a reformat of upstream's file trips no pin", () => {
    const reformatted = appText()
      .replace(/from "([^"]+)"/g, "from '$1'")
      .replace(/\n(const|function|export) /g, "\n// moved\n$1 ")
      .replace(/;\n/g, "\n")
      .replace(/\n/g, "\n  ")
      .replace(/\(\) =>\n\s*import/g, "() => import");
    expect(reformatted).not.toEqual(appText());
    const pins = readPins().filter((entry) => entry.file === APP);
    expect(copyProblems(pins, (file, part) => partText(file, part, reformatted))).toEqual([]);
  });

  test("pins every name a route element of app.tsx refers to", () => {
    expect(unpinnedRouteTargets()).toEqual([]);
  });

  test("names a route target no pin covers", () => {
    expect(unpinnedRouteTargets([], ["IssuePage"])).toEqual([
      `${APP}: a route element refers to IssuePage, itself or through a part it names, which copies.json does not pin: add {"file": "${APP}", "part": "IssuePage", "copy": <the file of this app that holds its copy>} and run \`bun tests/map/copies.ts --update ${APP} IssuePage\``,
    ]);
  });

  test("an import a copied page's body draws is a route target, and moving it trips its pin", () => {
    expect(routeTargets()).toContain("Inbox");
    const moved = appText().replace(
      'import { Inbox } from "./features/inbox/Inbox"',
      'import { Inbox } from "./features/inbox/InboxV2"'
    );
    expect(moved).not.toEqual(appText());
    expect(problemsWith(moved, "InboxPage")).toEqual([]);
    expect(problemsWith(moved, "Inbox")).toHaveLength(1);
  });

  test("a type a copied page names is no route target", () => {
    expect(routeTargets()).not.toContain("ReactNode");
  });

  test("a page's lazy that loads another module trips its pin", () => {
    const moved = appText().replace(
      '"./features/issue-page/IssuePage"',
      '"./features/issue-page/IssuePageV2"'
    );
    expect(moved).not.toEqual(appText());
    expect(problemsWith(moved, "IssuePage")).toHaveLength(1);
  });

  test("a route import from another module trips its pin", () => {
    const moved = appText().replace(
      'import { NotFoundPage } from "./features/shell/NotFoundPage"',
      'import { NotFoundPage } from "./features/shell/Missing"'
    );
    expect(moved).not.toEqual(appText());
    expect(problemsWith(moved, "NotFoundPage")).toHaveLength(1);
  });
});

const SIDEBAR = "packages/dispatch/web/src/features/sidebar/Sidebar.tsx";
const sidebarPin = () => {
  const found = readPins().find((entry) => entry.file === SIDEBAR && entry.part === "*");
  if (!found) throw new Error("no whole-file pin for the sidebar");
  return found;
};

describe("upstream view files the fork replaced", () => {
  test("each one has a whole-file pin", () => {
    expect(unpinnedReplacedViews()).toEqual([]);
  });

  test("names a replaced view file with no whole-file pin", () => {
    const inbox = "packages/dispatch/web/src/features/inbox/Inbox.tsx";
    const problems = unpinnedReplacedViews(readPins(), {
      "features/sidebar/Sidebar.tsx": "src/shell/sidebar.tsx",
      "features/inbox/Inbox.tsx": "src/pages/inbox.tsx",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toStartWith(`${inbox} is in src/views.ts replacedViews`);
  });

  test("a part pin of a replaced view file is not enough", () => {
    const pins = readPins().filter((entry) => entry.file !== SIDEBAR);
    expect(unpinnedReplacedViews([...pins, { ...sidebarPin(), part: "Sidebar" }])).toEqual([
      expect.stringContaining(`${SIDEBAR} is in src/views.ts replacedViews`),
    ]);
  });

  test("names a replaced view whose pin gives it to another file of this app", () => {
    expect(
      unpinnedReplacedViews(readPins(), { "features/sidebar/Sidebar.tsx": "src/shell/rail.tsx" })
    ).toEqual([
      `${SIDEBAR}: src/views.ts replacedViews gives it to src/shell/rail.tsx, and its pin in copies.json to src/shell/sidebar.tsx: make them agree`,
    ]);
  });

  test("a change to the sidebar's file outside its part Sidebar trips the whole-file pin", () => {
    const text = readFileSync(join(REPO_ROOT, SIDEBAR), "utf8");
    const changed = `${text}\nexport const added = 1;\n`;
    expect(partText(SIDEBAR, "Sidebar", changed)).toEqual(partText(SIDEBAR, "Sidebar", text));
    const problems = copyProblems([sidebarPin()], (file, part) => partText(file, part, changed));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toStartWith(`${SIDEBAR} changed *`);
  });
});

describe("a pin the sync changed names its outcome and reason", () => {
  const base = readPins();
  const [first] = base;
  if (!first) throw new Error("no pins");
  const changedTo = (why: Partial<Copy>): Copy[] =>
    base.map((entry) => (entry === first ? { ...entry, sha256: "0".repeat(64), ...why } : entry));

  test("a new hash with no reason fails and names the file", () => {
    const problems = unexplainedPins(changedTo({}), base);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toStartWith(`${first.file} '${first.part}' was pinned again`);
    expect(unexplainedPins(changedTo({ outcome: "closed" }), base)).toHaveLength(1);
  });

  test("a new commit with no reason fails", () => {
    const moved = base.map((entry) =>
      entry === first ? { ...entry, commit: "f".repeat(40) } : entry
    );
    expect(unexplainedPins(moved, base)).toHaveLength(1);
  });

  test("an outcome and a reason pass", () => {
    expect(unexplainedPins(changedTo({ outcome: "ported", reason: "the new key" }), base)).toEqual(
      []
    );
  });

  test("an empty reason, an unknown outcome and the base's own reason fail", () => {
    expect(unexplainedPins(changedTo({ outcome: "ported", reason: " " }), base)).toEqual([
      `${first.file} '${first.part}' has an empty reason`,
      expect.stringContaining("with no outcome or reason"),
    ]);
    const unknown = { ...first, outcome: "skipped", reason: "why" } as unknown as Copy;
    expect(unexplainedPins([unknown], [])).toEqual([
      `${first.file} '${first.part}' has the outcome skipped: it is ported or closed`,
    ]);
    const explained = [{ ...first, outcome: "closed" as const, reason: "a restyle" }];
    const again = [
      { ...first, sha256: "1".repeat(64), outcome: "closed" as const, reason: "a restyle" },
    ];
    expect(unexplainedPins(again, explained)).toEqual([
      expect.stringContaining("keeps the base's reason"),
    ]);
  });

  test("a pin the base does not have needs neither", () => {
    expect(unexplainedPins(changedTo({}), [])).toEqual([]);
  });

  test("a pin gone since the base needs a new or changed pin of its file or copy that says why", () => {
    const rest = base.filter((entry) => entry !== first);
    expect(unexplainedPins(rest, base)).toEqual([
      `${first.file} '${first.part}' is gone since the base, and no new or changed pin of ${first.file} or ${first.copy} gives an outcome and a reason: give the pin that replaces it both`,
    ]);
    const renamed = { ...first, part: "Renamed" };
    expect(unexplainedPins([...rest, renamed], base)).toHaveLength(1);
    const why = { outcome: "ported" as const, reason: "upstream renamed the part" };
    expect(unexplainedPins([...rest, { ...renamed, ...why }], base)).toEqual([]);
    const moved = { ...first, file: "packages/dispatch/web/src/moved.tsx", ...why };
    expect(unexplainedPins([...rest, moved], base)).toEqual([]);
  });

  test("a pin whose copy this app dropped may go with no record", () => {
    const rest = base.filter((entry) => entry !== first);
    expect(unexplainedPins(rest, base, (copy) => copy !== first.copy)).toEqual([]);
  });

  test("the update command takes an outcome with its reason, or neither", () => {
    expect(parseUpdate(["--update", SIDEBAR, "*"])).toEqual({ file: SIDEBAR, part: "*", why: {} });
    expect(
      parseUpdate(["--update", SIDEBAR, "*", "--outcome", "closed", "--reason", "a restyle"])
    ).toEqual({ file: SIDEBAR, part: "*", why: { outcome: "closed", reason: "a restyle" } });
    expect(parseUpdate(["--update", SIDEBAR, "*", "--outcome", "closed"])).toBeUndefined();
    expect(
      parseUpdate(["--update", SIDEBAR, "*", "--outcome", "kept", "--reason", "x"])
    ).toBeUndefined();
    expect(parseUpdate(["--update", SIDEBAR, "*", "--reason", " "])).toBeUndefined();
  });
});
