// The change marks follow the second tab's edits, each on its own block, with the counts after them.

import AxeBuilder from "@axe-core/playwright";
import { documentEditor, placeCaret, selectEditorText } from "../../../dispatch/e2e/editor";
import { expect, type Page, test } from "../test";
import { addedWords, seedEditedSpec } from "./baseline-seed";
import { FIRST, openHost, PARTS, partsRoot, SECOND } from "./hosts";

const DESIGN = "The design keeps most of its words from one version to the next, today.";
const SPLIT = "The second design paragraph stays exactly as it was written.";
const DELETED = "The third design paragraph stays exactly as it was written too.";
const LATER = "The later paragraph stays exactly as it was written here.";
const MERGED = "The last paragraph of the document stays as it is.";
const TEXT = [FIRST, SECOND, "## Design", DESIGN, SPLIT, DELETED, "## Later", LATER, MERGED].join(
  "\n\n"
);

/** Each label of the change marks, with its block's text, or the earlier text of a fold. */
const labels = (page: Page) =>
  documentEditor(page)
    .locator("[data-reading-aids-change]")
    .evaluateAll((marked) =>
      marked.map((element) => {
        const label = element.getAttribute("data-reading-aids-change");
        if (element.matches(".reading-aids-change-fold")) {
          return `${label}: ${element.querySelector(".reading-aids-earlier")?.textContent}`;
        }
        // The block's own text: no struck word, no fold drawn inside it, and no peer's caret.
        const own = element.cloneNode(true);
        if (!(own instanceof HTMLElement)) throw new Error("a label is on no element");
        const drawn = own.querySelectorAll(
          "del, .reading-aids-change-fold, .ProseMirror-yjs-cursor"
        );
        for (const each of drawn) each.remove();
        return `${label}: ${own.textContent}`;
      })
    );

const counts = (page: Page) => partsRoot(page).locator("[data-reading-aids-counts]");

/** The text of a removed block's fold, and of the block it stands after. */
const removedAfter = (page: Page) =>
  documentEditor(page)
    .locator(".reading-aids-change-fold[data-reading-aids-change='Removed']")
    .evaluateAll((folds) =>
      folds.map((fold) => {
        // The block before the fold, without a peer's caret.
        const before = fold.previousElementSibling?.cloneNode(true);
        if (before instanceof HTMLElement) {
          for (const caret of before.querySelectorAll(".ProseMirror-yjs-cursor")) caret.remove();
        }
        return [fold.querySelector(".reading-aids-earlier")?.textContent, before?.textContent];
      })
    );

test("change-marks: each edit from a second tab keeps every mark on its block, and the counts line follows", async ({
  context,
  page,
}) => {
  const { path } = await seedEditedSpec(page, TEXT, [
    { find: "next, today.", op: "replace", with: "next, now." },
  ]);
  const design = DESIGN.replace("today", "now");

  await openHost(page, path);
  await expect.poll(() => labels(page)).toEqual([`Changed: ${design}`]);
  await expect(counts(page)).toContainText(
    "Since v1, the version you last read: 1 block, 1 changed, in 1 of 3 sections"
  );
  const second = await context.newPage();
  await openHost(second, path);

  // A block the second tab adds before the server gives it an id, far above the marked block.
  await placeCaret(second, "after", FIRST);
  await second.keyboard.press("Enter");
  await second.keyboard.type("Added near the top.");
  await expect.poll(() => labels(page)).toEqual(["New: Added near the top.", `Changed: ${design}`]);
  await expect(counts(page)).toContainText("2 blocks, 1 changed, 1 added, in 2 of 3 sections");

  // The inserted-above case: the new block pairs with nothing, and the edited block stays changed.
  await placeCaret(second, "after", "Design");
  await second.keyboard.press("Enter");
  await second.keyboard.type("Inserted above the design.");
  await expect
    .poll(() => labels(page))
    .toEqual(["New: Added near the top.", "New: Inserted above the design.", `Changed: ${design}`]);
  await expect(counts(page)).toContainText("3 blocks, 1 changed, 2 added, in 2 of 3 sections");

  // An edit inside the marked block compares it again.
  await placeCaret(second, "after", "next, now");
  await second.keyboard.type(" and later");
  const edited = design.replace("now", "now and later");
  await expect.poll(() => addedWords(documentEditor(page))).toBe("now and later");
  await expect.poll(async () => (await labels(page))[2]).toBe(`Changed: ${edited}`);

  // A deleted paired block folds after the nearest paired block above it.
  await selectEditorText(second, DELETED);
  await second.keyboard.press("Backspace");
  await second.keyboard.press("Backspace");
  await expect.poll(() => removedAfter(page)).toEqual([[DELETED, SPLIT]]);
  await expect(counts(page)).toContainText(
    "4 blocks, 1 changed, 2 added, 1 removed, in 2 of 3 sections"
  );

  // A split block keeps its id on its first part, and the second part is new.
  await placeCaret(second, "before", "stays exactly as it was written.");
  await second.keyboard.press("Enter");
  await expect
    .poll(() => labels(page))
    .toEqual([
      "New: Added near the top.",
      "New: Inserted above the design.",
      `Changed: ${edited}`,
      "Changed: The second design paragraph ",
      `Removed: ${DELETED}`,
      "New: stays exactly as it was written.",
    ]);
  await expect(counts(page)).toContainText(
    "6 blocks, 2 changed, 3 added, 1 removed, in 2 of 3 sections"
  );

  // A block merged into the one above shows as removed after it, and the one above as changed.
  await placeCaret(second, "before", MERGED);
  await second.keyboard.press("Backspace");
  await expect
    .poll(async () => (await labels(page)).slice(-2))
    .toEqual([`Changed: ${LATER}${MERGED}`, `Removed: ${MERGED}`]);
  await expect(counts(page)).toContainText(
    "8 blocks, 3 changed, 3 added, 2 removed, in 3 of 3 sections"
  );
});

const STEPS = [
  "The alpha step stays as it is.",
  "The beta step goes away.",
  "The gamma step stays as it is.",
];
const LISTED = [
  FIRST,
  SECOND,
  "## Rollout",
  STEPS.map((step, index) => `${index + 1}. ${step}`).join("\n"),
].join("\n\n");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("change-marks: a removed item keeps an ordered list's numbers, a label joins its block's name with a separator, and no mark has a serious axe finding in light or dark", async ({
  page,
}) => {
  const { path } = await seedEditedSpec(page, LISTED, [
    { find: "## Rollout", op: "replace", with: "## Rollout plan" },
    // A quote's list marker selects that one item.
    { find: `2. ${STEPS[1]}`, op: "delete" },
  ]);
  await openHost(page, path);
  const editor = documentEditor(page);
  const removed = editor.locator("ol > li.reading-aids-change-fold");
  await expect(removed).toContainText(STEPS[1] ?? "");
  // The fold stands between alpha and gamma, drawn as a block, so only those two take a number.
  const items = await editor.locator("ol > li").evaluateAll(
    (all, steps) =>
      all.map((item) => ({
        display: getComputedStyle(item).display,
        fold: item.classList.contains("reading-aids-change-fold"),
        step: steps.findIndex((step) => item.textContent?.includes(step)),
      })),
    STEPS
  );
  expect(items).toEqual([
    { display: "list-item", fold: false, step: 0 },
    { display: "block", fold: true, step: 1 },
    { display: "list-item", fold: false, step: 2 },
  ]);
  // So the two items read 1 and 2.
  expect(
    await editor.locator("ol").evaluate((list) => list instanceof HTMLOListElement && list.start)
  ).toBe(1);
  await expect(editor.getByRole("heading", { level: 2 })).toHaveAccessibleName(
    "Changed: Rollout plan"
  );

  // No colour is read part-way through a transition after the scheme changes.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" });
  const backgrounds = new Set<string>();
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    backgrounds.add(
      await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
    );
    const results = await new AxeBuilder({ page })
      .include(PARTS)
      .include("[data-reading-aids-change]")
      .withTags(AXE_TAGS)
      .analyze();
    expect(results.passes.length, `${scheme}: rules that read something`).toBeGreaterThan(0);
    const serious = results.violations.flatMap((violation) =>
      violation.nodes
        .filter((node) => ["serious", "critical"].includes(node.impact ?? violation.impact ?? ""))
        .map((node) => `${violation.id} ${node.target.join(" ")}`)
    );
    expect(serious, `${scheme}: serious or critical findings`).toEqual([]);
  }
  expect(backgrounds.size, "light and dark draw different backgrounds").toBe(2);
});
