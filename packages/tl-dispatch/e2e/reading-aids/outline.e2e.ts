// The outline: its room at two margin widths, its place beside the text, its marked entry and its
// clicks and its counts.
import type { Locator } from "@playwright/test";

import { documentEditor } from "../../../dispatch/e2e/editor";
import { marginShell } from "../../../dispatch/e2e/issue-page";
import { userPreferenceStorageKey } from "../../../dispatch/web/src/features/shell/userPreference";
import { personOf } from "../flows";
import { expect, type Page, test } from "../test";
import { counterOffset, HOST, openHost, seedHost, TEXT, topsApart } from "./hosts";
import {
  ENTRIES,
  expectMovedTo,
  heading,
  OUTLINE_TEXT,
  openCounted,
  openWide,
  outline,
  scrollHeadingTo,
  shortcutsSheet,
} from "./outline-fixture";
import { focusOnHost } from "./read-first-seed";

const article = (page: Page) => page.locator('article[aria-label="Document"]');

const marked = (page: Page) => outline(page).locator('[aria-current="location"]');

const box = async (locator: Locator) => {
  const found = await locator.first().boundingBox();
  if (found === null) throw new Error(`${locator} has no box`);
  return found;
};

/** The theme's outline tokens, as the page computes them. */
async function outlineTokens(page: Page): Promise<{ width: number; gap: number; room: number }> {
  const [width = 0, gap = 0, measure = 0] = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return ["--reading-outline-width", "--reading-outline-gap", "--reading-measure"].map((token) =>
      Number.parseFloat(style.getPropertyValue(token))
    );
  });
  return { gap, room: width + gap + measure, width };
}

/** Sets the viewport so the article's border box is `width` px wide, to the pixel. */
async function setArticleWidth(page: Page, width: number): Promise<void> {
  for (let tries = 0; tries < 4; tries += 1) {
    const now = await article(page).evaluate((element) => element.getBoundingClientRect().width);
    if (Math.abs(now - width) < 0.01) return;
    const viewport = page.viewportSize() ?? { height: 800, width: 1280 };
    await page.setViewportSize({ ...viewport, width: Math.round(viewport.width + width - now) });
  }
  throw new Error(`the article did not reach ${width} px`);
}

/** Whether the outline shows, in each of 10 frames. */
const tenFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<boolean[]>((resolve) => {
        const shown: boolean[] = [];
        const frame = () => {
          shown.push(document.querySelector("[data-reading-aids-outline]") !== null);
          if (shown.length === 10) resolve(shown);
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      })
  );

async function expectStable(page: Page, shown: boolean): Promise<void> {
  const frames = await tenFrames(page);
  expect(frames.slice(1), `the outline in each frame: ${frames.join(", ")}`).toEqual(
    Array.from({ length: 9 }, () => shown)
  );
}

/** The first heading's top below the text's top, which the parts above it decide. */
const titleOffset = (page: Page) =>
  heading(page, "Title").evaluate(
    (element) =>
      element.getBoundingClientRect().top -
      (element.closest(".ProseMirror")?.getBoundingClientRect().top ?? 0)
  );

/** The outline at the left of the text, in the article's padding, as high as the text; each
 *  counter and margin card beside its block. */
async function expectBesideText(page: Page): Promise<void> {
  const { gap, width } = await outlineTokens(page);
  const [articleBox, nav, text] = await Promise.all([
    box(article(page)),
    box(outline(page)),
    box(documentEditor(page)),
  ]);
  expect(nav.x).toBeGreaterThanOrEqual(articleBox.x - 0.5);
  expect(nav.x + nav.width + gap).toBeLessThanOrEqual(text.x + 0.5);
  expect(text.x - articleBox.x).toBeCloseTo(width + gap, 0);
  expect(Math.abs(nav.y - text.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(nav.height - text.height)).toBeLessThanOrEqual(1);

  const mark = documentEditor(page).locator(".mark-comment").first();
  const card = page.locator("[data-margin-item]").first();
  await expect.poll(() => counterOffset(page)).toBeLessThanOrEqual(4);
  await expect.poll(() => topsApart(card, mark)).toBeLessThanOrEqual(4);
}

for (const margin of [384, 280]) {
  test(`outline: with a ${margin} px margin, it shows at the threshold beside the text, hides 1 px below it, and j still moves`, async ({
    page,
  }) => {
    const { path } = await seedHost(page, "spec", OUTLINE_TEXT);
    await page.goto(path);
    const login = await personOf(page);
    await page.evaluate(([key, width]) => window.localStorage.setItem(key, width), [
      userPreferenceStorageKey(login, "shell.margin-width"),
      String(margin),
    ] as const);
    await page.setViewportSize({ height: 800, width: 1600 });
    await openHost(page, path);
    await expect(marginShell(page)).toBeVisible();
    expect((await box(marginShell(page))).width).toBeCloseTo(margin, 0);
    const { room } = await outlineTokens(page);

    await setArticleWidth(page, room);
    await expectStable(page, true);
    await expect(outline(page).getByRole("button")).toHaveText([...ENTRIES]);
    await expectBesideText(page);
    const shownOffset = await titleOffset(page);

    await setArticleWidth(page, room - 1);
    await expectStable(page, false);
    // The outline is out of the parts' flow: the text starts where it did.
    expect(await titleOffset(page)).toBeCloseTo(shownOffset, 0);
    await page.locator(HOST).focus();
    await page.keyboard.press("j");
    await expectMovedTo(page, "Title");

    await setArticleWidth(page, room);
    await expectStable(page, true);
    await expectBesideText(page);
  });
}

test("outline: the first frame that draws the text beside its room draws the outline too", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const late: number[] = [];
    Object.assign(window, { outlineLateFrames: late });
    const frame = (time: number) => {
      const text = document.querySelector(".ProseMirror")?.textContent ?? "";
      const drawn = document.querySelector("[data-reading-aids-outline]") !== null;
      if (text.includes("The title part") && !drawn) late.push(time);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  // The aids' chunk arrives late, so the text must wait for it rather than paint without it.
  let delayed = 0;
  await page.route("**/assets/editor-aids-*.js", async (route) => {
    delayed += 1;
    await new Promise((done) => setTimeout(done, 200));
    await route.continue();
  });
  await openWide(page);
  await expect(outline(page)).toBeVisible();
  expect(delayed).toBeGreaterThan(0);
  expect(await page.evaluate(() => Reflect.get(window, "outlineLateFrames"))).toEqual([]);
});

test("outline: the marked entry is the last heading above the top of the view, and the outline is in view at the end", async ({
  page,
}) => {
  await openWide(page);
  await expect(outline(page)).toBeVisible();

  // Just past the top: Design is above the view, and Parts, the first heading in it, is not marked.
  await scrollHeadingTo(page, "Design", 40);
  await expect(marked(page)).toHaveText("Design");

  await documentEditor(page)
    .getByText("The later part, paragraph 20")
    .evaluate((element) => element.scrollIntoView({ block: "end" }));
  await expect(marked(page)).toHaveText("Later");
  const list = await box(page.locator(".reading-aids-outline-list"));
  expect(list.y).toBeGreaterThanOrEqual(0);
  expect(list.y + list.height).toBeLessThanOrEqual(800);
});

test("outline: with the sidebar folded, the list keeps clear of the panel's top row, under which a heading is above the view", async ({
  page,
}) => {
  await openWide(page);
  await expect(outline(page)).toBeVisible();
  await page.getByRole("button", { name: "Hide sidebar" }).click();
  const row = page.getByTestId("panel-header");
  await expect(row).toBeVisible();

  // Parts' heading 4 px under the row's bottom edge, where the row hides it.
  await scrollHeadingTo(page, "Parts", 4);
  await expect(marked(page)).toHaveText("Parts");
  const rowBox = await box(row);
  expect((await box(page.locator(".reading-aids-outline-list"))).y).toBeGreaterThanOrEqual(
    rowBox.y + rowBox.height
  );
  await outline(page).getByRole("button", { name: "Title" }).click({ timeout: 5000 });
  await expectMovedTo(page, "Title");
});

test("outline: a document with no heading draws no outline and gives j and k no command", async ({
  page,
}) => {
  await openWide(page, TEXT);
  await setArticleWidth(page, (await outlineTokens(page)).room);
  await expectStable(page, false);
  await page.locator(HOST).focus();
  await page.keyboard.press("?");
  await expect(shortcutsSheet(page)).toBeVisible();
  await expect(shortcutsSheet(page)).not.toContainText("Next heading");
});

test("outline: a click on an entry moves to its heading and leaves the address as it was", async ({
  page,
}) => {
  await openWide(page);
  const address = page.url();
  await outline(page).getByRole("button", { name: "Order" }).click();
  await expectMovedTo(page, "Order");
  await expect.poll(() => focusOnHost(page)).toBe(true);
  expect(page.url()).toBe(address);
  // With headings, the sheet lists the outline's keys.
  await page.keyboard.press("?");
  await expect(shortcutsSheet(page)).toContainText("Next heading");
});

test("outline: each entry counts the changes and the open decisions in its range, an h2's with its subsections", async ({
  page,
}) => {
  await openCounted(page);
  const entries = outline(page).getByRole("button");
  await expect(entries).toHaveCount(ENTRIES.length);
  const names = [
    "Title, 2 changes, 1 open decision",
    "Design, 2 changes, 1 open decision",
    "Parts, 1 change, 1 open decision",
    "Order, 1 change",
    "Later",
  ];
  for (const [index, name] of names.entries()) {
    await expect(entries.nth(index)).toHaveAccessibleName(name);
  }
  await expect(outline(page).locator("[data-reading-aids-outline-counts]")).toHaveText([
    "2 changes · 1 open",
    "2 changes · 1 open",
    "1 change · 1 open",
    "1 change",
  ]);
});
