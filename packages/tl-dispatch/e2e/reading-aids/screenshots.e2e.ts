// The aids' states as light and dark pictures, which CI keeps as an artifact.
import { fileURLToPath } from "node:url";

import { documentEditor, selectEditorText, typeAtEnd } from "../../../dispatch/e2e/editor";
import { expect, test } from "../test";
import {
  compareWith,
  pickVersion,
  revisitSpec,
  seedReadThenRevised,
  sinceText,
} from "./baseline-seed";
import { probeFill } from "./fill-probe";
import { head, openHost, SECOND, seedHost } from "./hosts";
import {
  foldLines,
  LINE_TEXTS,
  onlyChangesControl,
  onlyChangesOn,
  onlyFolded,
  openComparedWithFirst,
  seedChanged,
  seedLines,
} from "./only-changes-seed";
import { openCounted, outline } from "./outline-fixture";
import { readFirst, readFirstListed, seedDecided } from "./read-first-seed";

const SCREENSHOTS = fileURLToPath(new URL("../screenshots/", import.meta.url));

const REWRITTEN = "We ask every team to read the decisions before they open the plan.";
const REMOVED = "A paragraph about the old rollout, which the new version drops.";
/** A plan with a word to change, a paragraph to rewrite, and one to remove. */
const MARKED = [
  "## Plan",
  SECOND,
  "The reading aids ship to every team in the spring, after a short pilot.",
  "## Rollout",
  REWRITTEN,
  REMOVED,
  "The last paragraph stays too.",
].join("\n\n");

/** A spec with a requirement, a check and a plan task, each folded to its head at the open. */
const FOLDS = [
  "# Release checklist",
  "",
  "What the release must hold before it ships.",
  "",
  ":::requirement{#r1}",
  "**R1.** Each upload keeps its original file name.",
  "",
  "A renamed file is stored under the name the reader gave it, and the original name stays in its record.",
  ":::",
  "",
  ":::check{#c1}",
  "Upload a file, rename it, and read its record: the original name is there.",
  ":::",
  "",
  ":::plan_task{#t1}",
  "**T1.** Store the original name beside each upload.",
  "",
  "Add the column, fill it on upload, and show it in the record.",
  ":::",
  "",
  SECOND,
  "",
].join("\n");

/** The sections after the changed one: a quiet one with a requirement, and a long one. */
const QUIET = [
  "## Release",
  SECOND,
  ":::requirement{#r1}",
  "**R1.** Each upload keeps its original file name.",
  ":::",
  "The release section's last paragraph.",
  "## Notes",
  "The notes section's first paragraph.",
  "The notes section's second paragraph.",
];

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    test(`screenshots: Read first with a request over two documents and three decisions, ${colorScheme}`, async ({
      page,
    }) => {
      const { path } = await seedDecided(page, "spec");
      await openHost(page, path);
      await readFirstListed(page);
      await expect(readFirst(page)).toBeInViewport();
      await page.screenshot({ path: `${SCREENSHOTS}read-first-${colorScheme}.png` });
    });

    test(`screenshots: the counts line since the version last read, and Compare with open, ${colorScheme}`, async ({
      page,
    }) => {
      const seeded = await seedReadThenRevised(page);
      await revisitSpec(page, seeded);
      const since = sinceText(
        page,
        `Since v${seeded.read}, the version you last read: 1 block, 1 changed, in 1 of 1 section`
      );
      await expect(since).toBeInViewport();
      await page.screenshot({
        animations: "disabled",
        path: `${SCREENSHOTS}baseline-since-${colorScheme}.png`,
      });
      await compareWith(page).click();
      await expect(page.getByRole("listbox")).toBeInViewport();
      await page.screenshot({
        animations: "disabled",
        path: `${SCREENSHOTS}baseline-compare-with-${colorScheme}.png`,
      });
    });

    test(`screenshots: the change marks against version 1, folded and then open, ${colorScheme}`, async ({
      page,
    }) => {
      const { path } = await seedHost(page, "spec", MARKED);
      await openHost(page, path);
      await selectEditorText(page, "in the spring");
      await page.keyboard.type("in the autumn");
      await selectEditorText(page, REWRITTEN);
      await page.keyboard.type(
        "We ask every team to read the open decisions first, and then the plan."
      );
      await selectEditorText(page, REMOVED);
      await page.keyboard.press("Backspace");
      await page.keyboard.press("Backspace");
      await typeAtEnd(page, "A closing paragraph that the new version adds.");
      await pickVersion(page, 1);
      const editor = documentEditor(page);
      await expect(editor.locator("[data-reading-aids-change]")).toHaveCount(4);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${SCREENSHOTS}change-marks-${colorScheme}.png` });

      for (const fold of await editor.locator(".reading-aids-change-fold button").all()) {
        await fold.click();
      }
      await expect(editor.getByText("Rewritten: hide the earlier text")).toBeVisible();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${SCREENSHOTS}change-marks-open-${colorScheme}.png` });
    });

    for (const kind of ["spec", "document"] as const) {
      test(`screenshots: Only changes on the ${kind} host, against version 1, ${colorScheme}`, async ({
        page,
      }) => {
        const { path } = await seedChanged(page, kind, QUIET);
        await openComparedWithFirst(page, path);
        await page.screenshot({
          path: `${SCREENSHOTS}only-changes-off-${kind}-${colorScheme}.png`,
        });
        await onlyChangesOn(page);
        await expect(onlyFolded(page)).toHaveCount(5);
        await page.mouse.move(0, 0);
        await probeFill(page, onlyChangesControl(page), `shot-${kind}-${colorScheme}`);
        await page.screenshot({ path: `${SCREENSHOTS}only-changes-on-${kind}-${colorScheme}.png` });
      });
    }

    test(`screenshots: Only changes' fold lines for the preamble, a run and a list's items, ${colorScheme}`, async ({
      page,
    }) => {
      const { path } = await seedLines(page, "spec");
      await openComparedWithFirst(page, path);
      await onlyChangesOn(page);
      await expect(foldLines(page)).toHaveText(LINE_TEXTS);
      await page.mouse.move(0, 0);
      await page.screenshot({ path: `${SCREENSHOTS}only-changes-lines-${colorScheme}.png` });
    });

    test(`screenshots: folded heads, an open block and a head at a Tab stop, ${colorScheme}`, async ({
      page,
    }) => {
      const { path } = await seedHost(page, "spec", FOLDS);
      await openHost(page, path);
      await expect(head(page, "t1")).toHaveAttribute("aria-expanded", "false");
      await page.screenshot({
        animations: "disabled",
        path: `${SCREENSHOTS}folds-folded-${colorScheme}.png`,
      });
      await head(page, "r1").click();
      await expect(head(page, "r1")).toHaveAttribute("aria-expanded", "true");
      await page.mouse.move(0, 0);
      await page.screenshot({
        animations: "disabled",
        path: `${SCREENSHOTS}folds-open-${colorScheme}.png`,
      });
      // A key moves the focus, so the head shows its focus outline.
      await head(page, "r1").focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(head(page, "r1")).toBeFocused();
      const original = await head(page, "r1").elementHandle();
      if (original === null) throw new Error("the head has no button");
      // Hiding the caret writes a style on upstream's block header, whose redraw takes the head.
      await page.screenshot({
        animations: "disabled",
        caret: "initial",
        path: `${SCREENSHOTS}folds-focus-${colorScheme}.png`,
      });
      await expect(head(page, "r1")).toBeFocused();
      expect(await original.evaluate((button) => button.isConnected)).toBe(true);
    });

    test(`screenshots: the outline with each entry's changes and open decisions, ${colorScheme}`, async ({
      page,
    }) => {
      await openCounted(page);
      await expect(outline(page).locator("[data-reading-aids-outline-counts]")).toHaveCount(4);
      await page.mouse.move(0, 0);
      await page.screenshot({
        animations: "disabled",
        path: `${SCREENSHOTS}outline-counts-${colorScheme}.png`,
      });
    });
  });
}
