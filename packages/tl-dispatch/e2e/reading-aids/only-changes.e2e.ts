// "Only changes" folds what no change touched, and the reader's moves open the part they reach.
import type { Locator } from "@playwright/test";
import { createComment, createIssueArtifact } from "../../../dispatch/e2e/api";
import { documentEditor, marginCard, placeCaret } from "../../../dispatch/e2e/editor";
import { navigateInApp } from "../../../dispatch/e2e/sends";
import { AGENT } from "../flows";
import { expect, type Page, test } from "../test";
import { pickVersion } from "./baseline-seed";
import { blockIdOf, HOST, openHost, partsRoot, SECOND } from "./hosts";
import {
  foldLines,
  LINE_TEXTS,
  ONLY_CHANGES_FOLD,
  onlyChangesControl,
  onlyChangesOn,
  onlyFolded,
  openComparedWithFirst,
  RUN_PARAGRAPH,
  seedChanged,
  seedLines,
} from "./only-changes-seed";

const NEEDLE = "The first quiet section's paragraph, which holds a needle.";
const HAYSTACK = "The second quiet section's paragraph, which holds a haystack.";
const QUOTE_THIRD =
  "Its third paragraph runs long enough to wrap over several lines of the text column, so " +
  "that the comment it holds sits on a line below the first one: it goes on with more words, " +
  "and more words again, until the thread's quote at its end.";
const THREAD_QUOTE = "until the thread's quote at its end";

/** Two quiet sections: the first of four blocks, a quote of three paragraphs among them. */
const QUIET = [
  "## First quiet",
  NEEDLE,
  SECOND,
  `> The quote's first paragraph.\n>\n> The quote's second paragraph.\n>\n> ${QUOTE_THIRD}`,
  "The first quiet section's last paragraph.",
  "## Second quiet",
  HAYSTACK,
  "The second quiet section's last paragraph.",
];

/** Both quiet sections fold: four blocks, then two. */
const ALL_FOLDED = 6;

async function seed(page: Page) {
  const seeded = await seedChanged(page, "spec", QUIET);
  const thread = await createComment(
    seeded.issueKey ?? "",
    { anchor: { artifact: "spec", quote: THREAD_QUOTE }, body: "A thread in a folded part." },
    AGENT
  );
  return { ...seeded, thread: thread.id };
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (found === null) throw new Error("the element has no box");
  return found;
}

const top = async (locator: Locator) => (await box(locator)).y;

const bottom = async (locator: Locator) => {
  const { height, y } = await box(locator);
  return y + height;
};

/** The Only changes folds of the next editor to show `text`, in each frame that paints it, until the test reads them. */
async function foldFrames(page: Page, text: string): Promise<() => Promise<number[]>> {
  await page.evaluate(
    ({ fold, text }) => {
      const before = new Set(document.querySelectorAll(".ProseMirror"));
      const frames: number[] = [];
      Reflect.set(window, "foldFrames", frames);
      // A frame's callbacks run after the tasks before it, just before the browser paints it.
      const sample = () => {
        for (const editor of document.querySelectorAll(".ProseMirror")) {
          if (before.has(editor) || !(editor.textContent ?? "").includes(text)) continue;
          frames.push(editor.querySelectorAll(`.${fold}`).length);
          break;
        }
        if (frames.length < 120) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    },
    { fold: ONLY_CHANGES_FOLD, text }
  );
  return () =>
    page.evaluate((): number[] => {
      const frames: unknown = Reflect.get(window, "foldFrames");
      return Array.isArray(frames) ? frames.filter((n) => typeof n === "number") : [];
    });
}

/** The background `locator` draws, the pointer away from it. */
async function fill(page: Page, locator: Locator): Promise<string> {
  await page.mouse.move(0, 0);
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor);
}

test("only-changes: each quiet section folds to its heading alone, a thread in a folded part sits below its heading, and the margin and a #b- link open their parts", async ({
  page,
}) => {
  const { artifactId, path, thread } = await seed(page);
  const haystack = await blockIdOf(artifactId, HAYSTACK);
  await openComparedWithFirst(page, path);
  await onlyChangesOn(page);
  await expect(onlyFolded(page)).toHaveCount(ALL_FOLDED);
  const editor = documentEditor(page);
  await expect(editor.getByRole("heading", { name: "First quiet" })).toBeVisible();
  await expect(editor.getByRole("heading", { name: "Second quiet" })).toBeVisible();
  await expect(editor.getByRole("button", { name: /unchanged/ })).toHaveCount(0);

  const card = marginCard(page, thread);
  const quote = editor.locator("blockquote.reading-aids-only-changes");
  // The second block's comment folds to the same line, so its card is first and the thread's stacks below it.
  const first = page
    .locator("[data-margin-item]")
    .filter({ hasText: "A comment on the second block." });
  // Upstream places a card a frame after a layout change.
  await expect(async () => {
    expect(Math.abs((await top(first)) - (await top(quote)))).toBeLessThanOrEqual(4);
    // Upstream's card stack leaves 8 px between two cards.
    expect(Math.abs((await top(card)) - (await bottom(first)) - 8)).toBeLessThanOrEqual(4);
  }).toPass();

  await card.click();
  await expect(onlyFolded(page)).toHaveCount(2);
  await expect(editor.getByText(NEEDLE)).toBeVisible();

  await navigateInApp(page, `${path}#b-${haystack}`);
  await expect(onlyFolded(page)).toHaveCount(0);
  await expect(editor.getByText(HAYSTACK)).toBeInViewport();
});

test("only-changes: the preamble, a run between two changes and a list's items each fold to a line that counts them, a thread in a run sits at its line, and Enter on a line opens it with the focus on the host", async ({
  page,
}) => {
  const { issueKey, path } = await seedLines(page, "spec");
  const thread = await createComment(
    issueKey ?? "",
    { anchor: { artifact: "spec", quote: RUN_PARAGRAPH(2) }, body: "A thread in a run." },
    AGENT
  );
  await openComparedWithFirst(page, path);
  const control = onlyChangesControl(page);
  const off = await fill(page, control);
  await onlyChangesOn(page);
  // The pressed control draws a fill of its own.
  expect(await fill(page, control)).not.toBe(off);
  await expect(foldLines(page)).toHaveText(LINE_TEXTS);
  const editor = documentEditor(page);
  await expect(editor.locator("li[data-reading-aids-fold-line]")).toHaveText(LINE_TEXTS[2] ?? "");

  const runLine = editor.locator("[data-reading-aids-fold-line]").nth(1);
  const card = marginCard(page, thread.id);
  // Upstream places a card a frame after a layout change.
  await expect(async () => {
    expect(Math.abs((await top(card)) - (await top(runLine)))).toBeLessThanOrEqual(4);
  }).toPass();

  // Tab from the document's host to the run's line.
  const button = foldLines(page).nth(1);
  for (let presses = 0; presses < 40; presses += 1) {
    if (await button.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(editor.getByText(RUN_PARAGRAPH(2))).toBeVisible();
  await expect(foldLines(page)).toHaveText([LINE_TEXTS[0] ?? "", LINE_TEXTS[2] ?? ""]);
  await expect(page.locator(HOST)).toBeFocused();
  // The next Tab goes on from the host, not from the top of the page.
  await page.keyboard.press("Tab");
  await expect(page.locator(`${HOST} :focus`)).toHaveCount(1);
});

test("only-changes: the part that holds the ?q= at the open stays open, and the part a changed ?q= matches in opens", async ({
  page,
}) => {
  const { path } = await seed(page);
  await openComparedWithFirst(page, `${path}?q=needle`);
  await onlyChangesOn(page);
  // The open-?q= case: the first quiet section's part holds the needle.
  await expect(onlyFolded(page)).toHaveCount(2);
  await navigateInApp(page, `${path}?q=haystack`);
  // The changed-?q= case.
  await expect(onlyFolded(page)).toHaveCount(0);
});

test("only-changes: the caret opens the part it enters, and a new Compare-with pick makes the folds again", async ({
  page,
}) => {
  const { path } = await seed(page);
  await openComparedWithFirst(page, path);
  await onlyChangesOn(page);
  await expect(onlyFolded(page)).toHaveCount(ALL_FOLDED);
  await placeCaret(page, "after", "Second quiet");
  await page.keyboard.press("ArrowRight");
  await expect(onlyFolded(page)).toHaveCount(4);

  // The re-compare case: against the live version nothing changed, so every section folds.
  await pickVersion(page, 2);
  await expect(partsRoot(page)).toContainText("No changes since v2");
  await expect(onlyFolded(page)).toHaveCount(ALL_FOLDED + 1);
});

test("only-changes: a second tab's change inside a part leaves it folded and counts, a return keeps the choice and its folds, and a reload ends them", async ({
  context,
  page,
}) => {
  const { issueKey, path } = await seed(page);
  const other = await createIssueArtifact(
    issueKey ?? "",
    { content: "Another document of the issue.\n", name: "notes.md" },
    AGENT
  );
  await openComparedWithFirst(page, path);
  await onlyChangesOn(page);
  await expect(onlyFolded(page)).toHaveCount(ALL_FOLDED);

  const second = await context.newPage();
  await openHost(second, path);
  await placeCaret(second, "after", "which holds a haystack.");
  await second.keyboard.type(" Typed in the second tab.");
  await expect(documentEditor(page)).toContainText("Typed in the second tab.");
  await expect(partsRoot(page)).toContainText("in 2 of 3 sections");
  await expect(onlyFolded(page)).toHaveCount(ALL_FOLDED);

  await navigateInApp(page, `/issues/${issueKey}/artifacts/${other.artifact.slug}`);
  await expect(documentEditor(page)).toContainText("Another document of the issue.");
  const frames = await foldFrames(page, SECOND);
  await navigateInApp(page, path);
  await expect(documentEditor(page)).toContainText(SECOND);
  await expect(onlyChangesControl(page)).toHaveAttribute("aria-pressed", "true");
  await expect(onlyFolded(page)).toHaveCount(ALL_FOLDED);
  // No frame of the new editor shows the whole document.
  const painted = await frames();
  expect(painted.length).toBeGreaterThan(0);
  expect(painted.filter((count) => count !== ALL_FOLDED)).toEqual([]);

  await page.reload();
  await expect(documentEditor(page)).toContainText(SECOND);
  await expect(onlyFolded(page)).toHaveCount(0);
  // The new visit compares with the read mark, and Only changes starts off.
  await expect(onlyChangesControl(page)).toHaveAttribute("aria-pressed", "false");
});
