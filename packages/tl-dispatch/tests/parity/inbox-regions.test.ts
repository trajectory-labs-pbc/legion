import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { inbox } from "@/features/inbox/route";
import type { Page } from "@/navigation/page";
import { replacedViews } from "@/views";
import { parseList } from "../../scripts/check-parity";
import { BREAKS } from "../layers.table";
import { type Copy, readPins, upstreamWeb } from "../map/copies";
import { PACKAGE_ROOT, SRC_DIR } from "../source";

// Holds the Inbox's parity file to the rebuild: a region marked rebuilt has its view files in
// replacedViews and its named units pinned, and the switch to the fork's page leaves nothing of
// upstream's page behind. The parity file's head says what each line of a region means.

const LIST = "tests/parity/inbox.md";
const ROUTE_FILE = "src/features/inbox/route.tsx";
const PAGE_VIEW = "features/inbox/Inbox.tsx";
const UPSTREAM_VIEWS = join(SRC_DIR, "upstream/views/inbox");
const LIST_TEXT = readFileSync(join(PACKAGE_ROOT, LIST), "utf8");

/** Whether `region` is the list's region `number`. */
const isRegion = (region: { heading: string }, number: number) =>
  region.heading.startsWith(`${number}. `);

interface Region {
  /** Its heading, as "7. Filter bar and View menu". */
  heading: string;
  rebuilt: boolean;
  /** Its upstream view files, under upstream's `web/src`. */
  views: string[];
  /** The units the fork pins by name, each with its file under upstream's `web/src`. */
  pinned: { part: string; file: string }[];
}

interface Facts {
  /** What the parity file itself gets wrong, so that no region's check is skipped. */
  listProblems: string[];
  regions: Region[];
  /** The files the list names as no region's view file. */
  noRegionViews: string[];
  /** The list's row IDs. */
  ids: string[];
  replaced: readonly string[];
  pins: readonly Copy[];
  /** Whether the route file says that the fork serves the page. */
  forkServes: boolean;
  /** The files left in src/upstream/views/inbox. */
  upstreamViews: string[];
  /** The files that tests/layers.table.ts lists as breaking a rule today. */
  breaks: string[];
}

const quoted = (line: string | undefined) =>
  [...(line ?? "").matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? "");
const lineAfter = (section: string, label: string) =>
  section.split("\n").find((line) => line.startsWith(`${label}:`));

const pinsOf = (line: string | undefined) =>
  [...(line ?? "").matchAll(/`([^`]+)` in `([^`]+)`/g)].map(([, part = "", file = ""]) => ({
    part,
    file,
  }));

/** A region's line names its files with backticks, or says none. */
const namesOrNone = (line: string | undefined) =>
  line !== undefined && (line.endsWith(": none.") || quoted(line).length > 0);

/** The regions of the list, the files it names as no region's, and what it gets wrong. */
function parseRegions(
  text: string
): Pick<Facts, "listProblems" | "regions" | "noRegionViews" | "ids"> {
  const { parsed, problems: listProblems } = parseList(LIST, text);
  const regions: Region[] = [];
  let noRegionViews: string[] = [];
  for (const section of text.split(/^## /m).slice(1)) {
    const [heading = ""] = section.split("\n", 1);
    if (heading === "No region's view file") {
      noRegionViews = quoted(section).filter((name) => name.endsWith(".tsx"));
      continue;
    }
    const name = /^\d+\. (.+)$/.exec(heading)?.[1];
    if (name === undefined) continue;
    if (!parsed.regions.has(name)) {
      listProblems.push(
        `${LIST}: the heading ${heading} names no region of its Region | Rebuilt table`
      );
    }
    const views = lineAfter(section, "View files");
    const pinned = lineAfter(section, "Pinned by name");
    for (const [label, line] of [
      ["View files", views],
      ["Pinned by name", pinned],
    ] as const) {
      if (!namesOrNone(line)) {
        listProblems.push(
          `${LIST}: region ${heading} needs a line "${label}:" with names in backticks, or none.`
        );
      }
    }
    if (quoted(pinned).length !== 2 * pinsOf(pinned).length) {
      listProblems.push(
        `${LIST}: region ${heading} names each unit it pins as \`part\` in \`file\`.`
      );
    }
    regions.push({
      heading,
      rebuilt: parsed.regions.get(name) === true,
      views: quoted(views),
      pinned: pinsOf(pinned),
    });
  }
  return { listProblems, regions, noRegionViews, ids: parsed.items.map((item) => item.id) };
}

/** A page's server as any page names it: the route's `satisfies` keeps its own literal. */
const serverOf = (page: Pick<Page, "server">): Page["server"] => page.server;

function readFacts(): Facts {
  return {
    ...parseRegions(LIST_TEXT),
    replaced: replacedViews,
    pins: readPins(),
    forkServes: serverOf(inbox) === "fork",
    upstreamViews: existsSync(UPSTREAM_VIEWS) ? readdirSync(UPSTREAM_VIEWS).sort() : [],
    breaks: Object.values(BREAKS).flatMap((files) => Object.keys(files ?? {})),
  };
}

const upstreamFile = (file: string) => `${upstreamWeb}/${file}`;

/** Each way the rebuild disagrees with the parity file. */
function regionProblems(facts: Facts): string[] {
  const problems = [...facts.listProblems];
  const replaced = new Set(facts.replaced);
  const numbers = facts.ids.flatMap((id) => /^INB-(\d+)$/.exec(id)?.[1] ?? []).map(Number);
  for (let n = 1; n <= Math.max(0, ...numbers); n++) {
    if (!numbers.includes(n)) {
      problems.push(`${LIST} has no row INB-${n}: a row that the page drops stays, with its mark`);
    }
  }
  for (const region of facts.regions.filter((r) => r.rebuilt)) {
    for (const view of region.views.filter((v) => !replaced.has(v))) {
      problems.push(
        `region ${region.heading} is rebuilt, and replacedViews in src/views.ts lacks ${view}`
      );
    }
    for (const { part, file } of region.pinned) {
      const pinned = facts.pins.some(
        (pin) => pin.file === upstreamFile(file) && (pin.part === part || pin.part === "*")
      );
      if (!pinned) {
        problems.push(
          `region ${region.heading} is rebuilt, and copies.json does not pin ${part} of ${file}`
        );
      }
    }
  }
  for (const view of facts.replaced) {
    if (facts.noRegionViews.includes(view)) {
      problems.push(`${view} is in replacedViews, and ${LIST} names it as no region's view file`);
    }
    if (!/^features\/.+\.tsx$/.test(view)) {
      problems.push(
        `${view} is in replacedViews, and it is no view file: logic files and app.tsx are not views`
      );
    }
  }
  if (!facts.forkServes) {
    if (replaced.has(PAGE_VIEW)) {
      problems.push(
        `${PAGE_VIEW} is in replacedViews while ${ROUTE_FILE} says that upstream serves the page`
      );
    }
    if (facts.regions.every((r) => r.rebuilt)) {
      problems.push(
        `every region is rebuilt, and ${ROUTE_FILE} says that upstream serves the page`
      );
    }
    return problems;
  }
  for (const region of facts.regions.filter((r) => !r.rebuilt)) {
    problems.push(
      `${ROUTE_FILE} says that the fork serves the page, and region ${region.heading} is not rebuilt`
    );
  }
  for (const file of facts.upstreamViews) {
    problems.push(
      `${ROUTE_FILE} says that the fork serves the page, and src/upstream/views/inbox holds ${file}`
    );
  }
  for (const file of facts.breaks.filter((f) => f.startsWith("src/features/inbox/"))) {
    problems.push(
      `${ROUTE_FILE} says that the fork serves the page, and tests/layers.table.ts lists ${file} as a break`
    );
  }
  return problems;
}

describe("the Inbox's regions", () => {
  const facts = readFacts();
  const region = (number: number) => {
    const found = facts.regions.find((r) => isRegion(r, number));
    if (found === undefined) throw new Error(`${LIST} has no region ${number}`);
    return found;
  };
  /** The facts with each region of `numbers` marked rebuilt. */
  const rebuilding = (...numbers: number[]): Region[] =>
    facts.regions.map((r) => (numbers.some((n) => isRegion(r, n)) ? { ...r, rebuilt: true } : r));
  /** copies.json's pins without those of `file`, so a control holds as the page's pins land. */
  const pinsWithout = (file: string) => facts.pins.filter((p) => p.file !== upstreamFile(file));

  test("the parity file, replacedViews, copies.json and the route file agree", () => {
    expect(facts.regions).toHaveLength(19);
    expect(facts.noRegionViews).toEqual(["features/inbox/PaneDocument.tsx"]);
    expect(regionProblems(facts)).toEqual([]);
  });

  test("a rebuilt region names each view file that replacedViews lacks", () => {
    const unplaced = facts.replaced.filter((view) => !region(7).views.includes(view));
    const problems = regionProblems({ ...facts, regions: rebuilding(7), replaced: unplaced });
    expect(problems).toEqual(
      region(7).views.map(
        (view) =>
          `region 7. Filter bar and View menu is rebuilt, and replacedViews in src/views.ts lacks ${view}`
      )
    );
    expect(problems.join("\n")).toContain("features/inbox/InboxBar.tsx");
    const placed = {
      ...facts,
      regions: rebuilding(7),
      replaced: [...unplaced, ...region(7).views],
    };
    expect(regionProblems(placed)).toEqual([]);
  });

  test("a rebuilt region names each unit it pins by name that copies.json lacks", () => {
    const paneFrame =
      "region 12. Reading pane: frame and question kinds is rebuilt, and copies.json does not pin PaneFrame of features/inbox/PaneDocument.tsx";
    const twelve = {
      ...facts,
      regions: rebuilding(12),
      replaced: [...facts.replaced, ...region(12).views],
      pins: pinsWithout("features/inbox/PaneDocument.tsx"),
    };
    expect(regionProblems(twelve)).toContain(paneFrame);
    const pin: Copy = {
      file: upstreamFile("features/inbox/PaneDocument.tsx"),
      part: "PaneFrame",
      copy: "src/features/inbox/pane.tsx",
      commit: "0000000",
      sha256: "0",
    };
    expect(regionProblems({ ...twelve, pins: [...twelve.pins, pin] })).not.toContain(paneFrame);
    // Region 3 pins emptyStateMessage, which copies.json holds, and has no view file.
    expect(regionProblems({ ...facts, regions: rebuilding(3) })).toEqual([]);
    const unpinned = pinsWithout("features/inbox/Inbox.tsx");
    expect(regionProblems({ ...facts, regions: rebuilding(3), pins: unpinned })).toEqual([
      "region 3. List states is rebuilt, and copies.json does not pin emptyStateMessage of features/inbox/Inbox.tsx",
    ]);
  });

  test("replacedViews takes no file that the list names as no region's, and no file that is not a view", () => {
    const replaced = [
      ...facts.replaced,
      "features/inbox/PaneDocument.tsx",
      "features/inbox/mark-all.ts",
      "app.tsx",
    ];
    expect(regionProblems({ ...facts, replaced })).toEqual([
      "features/inbox/PaneDocument.tsx is in replacedViews, and tests/parity/inbox.md names it as no region's view file",
      "features/inbox/mark-all.ts is in replacedViews, and it is no view file: logic files and app.tsx are not views",
      "app.tsx is in replacedViews, and it is no view file: logic files and app.tsx are not views",
    ]);
  });

  test("a region line without backticks, or a heading the table lacks, is named", () => {
    const bare = LIST_TEXT.replace(
      "View files: `features/inbox/BulkBar.tsx`.",
      "View files: features/inbox/BulkBar.tsx."
    );
    expect(bare).not.toBe(LIST_TEXT);
    expect(parseRegions(bare).listProblems).toEqual([
      'tests/parity/inbox.md: region 9. Selection and the bulk bar needs a line "View files:" with names in backticks, or none.',
    ]);
    const renamed = LIST_TEXT.replace(
      "## 9. Selection and the bulk bar\n",
      "## 9. Selection and bulk bars\n"
    );
    expect(renamed).not.toBe(LIST_TEXT);
    expect(parseRegions(renamed).listProblems).toEqual([
      "tests/parity/inbox.md: the heading 9. Selection and bulk bars names no region of its Region | Rebuilt table",
    ]);
  });

  test("a pin line whose names are not each `part` in `file` is named", () => {
    const loose = LIST_TEXT.replace(
      "`PaneFrame` in `features/inbox/PaneDocument.tsx`.",
      "`PaneFrame` (`features/inbox/PaneDocument.tsx`)."
    );
    expect(loose).not.toBe(LIST_TEXT);
    expect(parseRegions(loose).listProblems).toEqual([
      "tests/parity/inbox.md: region 12. Reading pane: frame and question kinds names each unit it pins as `part` in `file`.",
    ]);
  });

  test("a gap in the row IDs is named", () => {
    expect(regionProblems({ ...facts, ids: facts.ids.filter((id) => id !== "INB-3") })).toEqual([
      "tests/parity/inbox.md has no row INB-3: a row that the page drops stays, with its mark",
    ]);
  });

  test("while upstream serves the page, Inbox.tsx stays out of replacedViews and some region is not rebuilt", () => {
    expect(regionProblems({ ...facts, replaced: [...facts.replaced, PAGE_VIEW] })).toEqual([
      "features/inbox/Inbox.tsx is in replacedViews while src/features/inbox/route.tsx says that upstream serves the page",
    ]);
    const all = facts.regions.map((r) => ({ ...r, rebuilt: true }));
    expect(regionProblems({ ...facts, regions: all })).toContain(
      "every region is rebuilt, and src/features/inbox/route.tsx says that upstream serves the page"
    );
  });

  test("once the fork serves the page, every region is rebuilt and nothing of upstream's page is left", () => {
    const switched: Facts = {
      ...facts,
      forkServes: true,
      regions: facts.regions.map((r) => ({ ...r, rebuilt: true, views: [], pinned: [] })),
      upstreamViews: [],
      breaks: [],
    };
    expect(regionProblems(switched)).toEqual([]);
    const nineteen = switched.regions.map((r) => (isRegion(r, 19) ? { ...r, rebuilt: false } : r));
    expect(regionProblems({ ...switched, regions: nineteen })).toEqual([
      "src/features/inbox/route.tsx says that the fork serves the page, and region 19. Answered by you is not rebuilt",
    ]);
    expect(regionProblems({ ...switched, upstreamViews: ["inbox.tsx"] })).toEqual([
      "src/features/inbox/route.tsx says that the fork serves the page, and src/upstream/views/inbox holds inbox.tsx",
    ]);
    expect(
      regionProblems({
        ...switched,
        breaks: ["src/features/inbox/route.tsx", "src/features/agents/route.tsx"],
      })
    ).toEqual([
      "src/features/inbox/route.tsx says that the fork serves the page, and tests/layers.table.ts lists src/features/inbox/route.tsx as a break",
    ]);
  });
});
