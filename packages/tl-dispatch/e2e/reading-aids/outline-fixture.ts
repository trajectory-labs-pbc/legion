// A synthetic spec with headings to level 4, long enough that each section scrolls, and the block
// a comment names (`SECOND`).
import { randomUUID } from "node:crypto";

import { documentEditor } from "../../../dispatch/e2e/editor";
import { expect, type Page } from "../test";
import { seedEditedSpec } from "./baseline-seed";
import { openHost, SECOND, seedHost } from "./hosts";
import { decisionMarkdown } from "./read-first-seed";

const paragraphs = (topic: string, count: number) =>
  Array.from(
    { length: count },
    (_, index) =>
      `The ${topic} part, paragraph ${index + 1}: a reader reads this text to follow the outline as the page scrolls past it.`
  );

/** The outline's entries, in order: the level-4 heading is not one. */
export const ENTRIES = ["Title", "Design", "Parts", "Order", "Later"] as const;

export const OUTLINE_TEXT = [
  "# Title",
  SECOND,
  ...paragraphs("title", 2),
  "## Design",
  ...paragraphs("design", 8),
  "### Parts",
  ...paragraphs("parts", 6),
  "#### Detail",
  ...paragraphs("detail", 3),
  "### Order",
  ...paragraphs("order", 6),
  "## Later",
  ...paragraphs("later", 20),
].join("\n\n");

export const outline = (page: Page) => page.locator("[data-reading-aids-outline]");

export const heading = (page: Page, text: string) =>
  documentEditor(page).locator(":is(h1, h2, h3, h4)", { hasText: text });

/** The keyboard shortcuts sheet, which lists only the commands whose gate is open. */
export const shortcutsSheet = (page: Page) =>
  page.getByRole("dialog", { name: "Keyboard shortcuts" });

/** The blocks a move pulses: upstream's `focusBlock` marks its target for a moment. */
export const pulsed = (page: Page) => documentEditor(page).locator(".dispatch-mark-pulse");

/** Waits until a move pulsed the heading `text` alone, then until the pulse ends, so the next
 *  move's pulse is the only one. */
export async function expectMovedTo(page: Page, text: string): Promise<void> {
  await expect(pulsed(page)).toHaveText(text);
  await expect(pulsed(page)).toHaveCount(0);
}

/** Waits until the window's scroll has held still for two frames, so the outline measured it. */
export async function scrollSettled(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        let last = Number.NaN;
        let still = 0;
        const frame = () => {
          still = window.scrollY === last ? still + 1 : 0;
          last = window.scrollY;
          if (still >= 2) done();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      })
  );
}

/** Presses `key` and holds that it moved nothing: two frames later, no pulse and no scroll. */
export async function expectNoMove(page: Page, key: string): Promise<void> {
  await scrollSettled(page);
  const scrolled = () => page.evaluate(() => window.scrollY);
  const before = await scrolled();
  await page.keyboard.press(key);
  await page.evaluate(
    () =>
      new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())))
  );
  // Read once, not retried: a retry would wait out a pulse that is there.
  expect(await pulsed(page).count()).toBe(0);
  expect(await scrolled()).toBe(before);
}

/** Opens `text` as a spec on a page wide enough for the outline. */
export async function openWide(page: Page, text = OUTLINE_TEXT): Promise<void> {
  const { path } = await seedHost(page, "spec", text);
  await page.setViewportSize({ height: 800, width: 1600 });
  await openHost(page, path);
}

/** Opens the spec, wide, after the agent changed a paragraph in Parts and one in Order, with an
 *  open decision in Parts, so each entry has counts. */
export async function openCounted(page: Page): Promise<void> {
  const decision = { id: `outline-decision-${randomUUID().slice(0, 8)}`, question: "Which part?" };
  const text = OUTLINE_TEXT.replace("#### Detail", `${decisionMarkdown(decision)}\n\n#### Detail`);
  const { path } = await seedEditedSpec(page, text, [
    { find: "The parts part, paragraph 2:", op: "replace", with: "The parts part, paragraph two:" },
    { find: "The order part, paragraph 1:", op: "replace", with: "The order part, paragraph one:" },
  ]);
  await page.setViewportSize({ height: 800, width: 1600 });
  await openHost(page, path);
}

/** Scrolls the heading `text` to the top of the view, below what stays over it there, and then
 *  `by` px further, as a reader's wheel does. */
export async function scrollHeadingTo(page: Page, text: string, by: number): Promise<void> {
  await heading(page, text).evaluate((element) => element.scrollIntoView({ block: "start" }));
  await page.mouse.move(800, 400);
  await page.mouse.wheel(0, by);
}
