// The marks' main-thread work stays short on a large plan, against a baseline with a tree or none.

import { documentEditor, placeCaret } from "../../../dispatch/e2e/editor";
import { expect, type Page, test } from "../test";
import { addedWords, seedEditedSpec } from "./baseline-seed";
import { openHost, partsRoot, SECOND } from "./hosts";
import { onlyChangesOn, onlyFolded } from "./only-changes-seed";

/** The name the marks' timings are measured under. */
const MARKS_MEASURE = "reading-aids-marks";

const SECTIONS = 9;
const PER_SECTION = 9;
/** The blocks typed in: long enough that 100 typed characters leave them over the word marks' bar. */
const TYPED_IN = new Set([1, 40]);
const KEPT = Array.from({ length: 80 }, (_, index) => `kept${index}`).join(" ");
const said = (block: number, last: string) =>
  `Block ${block} keeps ${TYPED_IN.has(block) ? KEPT : "most of its words"} from one version to the next, ${last}.`;
const unchanged = (section: number) =>
  `Section ${section} holds a paragraph that no version changes.`;
/** Unchanged paragraphs that double the plan, so the parse of a baseline with no tree is long on the main thread. */
const FILLER_PER_SECTION = 10;
const filler = (section: number, index: number) =>
  `Section ${section} keeps paragraph ${index} as it stands: ${Array.from({ length: 60 }, (_, word) => `s${section}p${index}w${word}`).join(" ")}.`;

/** 6,000 words, and the same with every 13th word replaced: past the limit of 800 word edits. */
const LONG = Array.from({ length: 6000 }, (_, index) => `w${index.toString().padStart(4, "0")}`);
const LONG_EDITED = LONG.map((word, index) => (index % 13 === 0 ? `x${word}` : word));

function plan(edited: boolean): string {
  const blocks = [SECOND];
  for (let section = 1; section <= SECTIONS; section += 1) {
    blocks.push(`## Section ${section}`);
    for (let index = 1; index <= PER_SECTION; index += 1) {
      const block = (section - 1) * PER_SECTION + index;
      blocks.push(said(block, edited ? "now" : "today"));
    }
    blocks.push(unchanged(section));
    for (let index = 1; index <= FILLER_PER_SECTION; index += 1)
      blocks.push(filler(section, index));
  }
  blocks.push("## Long", (edited ? LONG_EDITED : LONG).join(" "));
  return blocks.join("\n\n");
}

const CHANGED = SECTIONS * PER_SECTION;
/** 20 words of 5 characters: 100 typed characters. */
const TYPED = " word".repeat(20);

interface Timing {
  detail: string;
  duration: number;
  start: number;
}

const isTiming = (value: unknown): value is Timing =>
  typeof value === "object" &&
  value !== null &&
  "detail" in value &&
  typeof value.detail === "string" &&
  "duration" in value &&
  typeof value.duration === "number" &&
  "start" in value &&
  typeof value.start === "number";

/** Keeps each timing of the marks the page measures, from its first script on. */
async function collectTimings(page: Page): Promise<() => Promise<Timing[]>> {
  await page.addInitScript((name) => {
    const seen: unknown[] = [];
    const keep = (entries: readonly PerformanceEntry[]) => {
      for (const entry of entries) {
        if (entry.name === name && entry instanceof PerformanceMeasure) {
          seen.push({ detail: entry.detail, duration: entry.duration, start: entry.startTime });
        }
      }
    };
    const observer = new PerformanceObserver((list) => keep(list.getEntries()));
    observer.observe({ type: "measure" });
    // The observer's callback runs in a later task, so a read first takes the measures still queued.
    Reflect.set(window, "marksTimings", () => {
      keep(observer.takeRecords());
      return seen;
    });
  }, MARKS_MEASURE);
  return async () => {
    const seen: unknown = await page.evaluate(() => {
      const read: unknown = Reflect.get(window, "marksTimings");
      return typeof read === "function" ? read() : undefined;
    });
    if (!Array.isArray(seen) || !seen.every(isTiming)) throw new Error("no timings were kept");
    return seen;
  };
}

/** The aids' work for each transaction: the marks' step, then the folds' and the marks' sends after it; a redraw of the folds with no edit is its own. */
function perTransaction(seen: readonly Timing[]): number[] {
  const costs: number[] = [];
  let last = "";
  for (const { detail, duration } of [...seen].sort((a, b) => a.start - b.start)) {
    // Redraws in a row join into one, which can only raise the percentile.
    const joins =
      detail === "send" || detail === "folds" || (detail === "redraw" && last === "redraw");
    if (detail === "transaction" || detail === "redraw") last = detail;
    if (joins && costs.length > 0) costs.push((costs.pop() ?? 0) + duration);
    else if (detail === "transaction" || detail === "redraw") costs.push(duration);
  }
  return costs;
}

const over50 = ({ duration }: Timing) => duration > 50;

/** The 95th percentile of `values`. */
function p95(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

/** Three runs against a baseline with its tree, three without, and three with Only changes on. */
const RUNS = [
  ...[true, false].flatMap((tree) => [1, 2, 3].map((run) => ({ only: false, run, tree }))),
  ...[1, 2, 3].map((run) => ({ only: true, run, tree: true })),
];

for (const { only, run, tree } of RUNS) {
  test(`change-timing: run ${run}, a baseline ${tree ? "with" : "without"} its tree${only ? ", Only changes on" : ""}, no task of the marks over 50 ms and the plugin's 95th percentile at most 2 ms`, async ({
    context,
    page,
  }) => {
    test.setTimeout(180_000);
    const { artifactId, path } = await seedEditedSpec(page, plan(false), [
      ...Array.from({ length: CHANGED }, (_, index) => ({
        find: said(index + 1, "today"),
        op: "replace" as const,
        with: said(index + 1, "now"),
      })),
      { find: LONG.join(" "), op: "replace", with: LONG_EDITED.join(" ") },
    ]);

    if (!tree) {
      await page.route(`**/api/v1/artifacts/${artifactId}/versions/*`, async (route) => {
        const response = await route.fetch();
        const body: unknown = await response.json();
        if (typeof body === "object" && body !== null)
          Reflect.deleteProperty(body, "markdown_tree");
        await route.fulfill({ json: body, response });
      });
    }
    const timings = await collectTimings(page);
    await openHost(page, path);
    await expect(partsRoot(page).locator("[data-reading-aids-counts]")).toContainText(
      `${CHANGED + 2} blocks, ${CHANGED} changed, 1 added, 1 removed`
    );
    if (only) {
      await onlyChangesOn(page);
      await expect(onlyFolded(page)).not.toHaveCount(0);
    }

    // 100 characters in a marked block, then 100 in an unmarked one.
    await placeCaret(page, "after", said(1, "now").slice(0, -1));
    await page.keyboard.type(TYPED);
    await placeCaret(page, "after", unchanged(2).slice(0, -1));
    await page.keyboard.type(TYPED);

    // 200 edits from a second tab: half in a marked block, half in an unmarked one.
    const second = await context.newPage();
    await openHost(second, path);
    await placeCaret(second, "after", said(40, "now").slice(0, -1));
    await second.keyboard.type(TYPED);
    await placeCaret(second, "after", unchanged(5).slice(0, -1));
    await second.keyboard.type(TYPED);

    // The second tab's last edit has reached this tab, so each edit's work is measured.
    await expect(documentEditor(page)).toContainText(`${unchanged(5).slice(0, -1)}${TYPED}`);
    const edits = await timings();
    const transactions = perTransaction(edits);
    expect.soft(transactions.length, "transactions measured").toBeGreaterThan(400);
    expect.soft(edits.filter(over50), "tasks over 50 ms while editing").toEqual([]);
    expect.soft(p95(transactions), "the plugin's 95th percentile, ms").toBeLessThanOrEqual(2);
    expect(test.info().errors).toEqual([]);

    // The marks of each edited block show once its comparison ends.
    for (const block of TYPED_IN) {
      const marked = documentEditor(page).locator("[data-reading-aids-change]", {
        hasText: `Block ${block} keeps`,
      });
      await expect.poll(() => addedWords(marked)).toBe(`now${TYPED}`);
    }

    // The use of each answer runs as the marks draw.
    const seen = await timings();
    console.log(
      `change-timing run ${run}, tree ${tree}, only changes ${only}: largest task ${Math.max(...seen.map(({ duration }) => duration))} ms, 95th percentile ${p95(transactions)} ms of ${transactions.length} transactions`
    );
    expect(seen.filter(over50), "tasks over 50 ms").toEqual([]);
  });
}
