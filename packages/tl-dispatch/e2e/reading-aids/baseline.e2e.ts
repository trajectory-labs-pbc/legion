// The baseline is fixed for the visit: a new editor keeps it and the reader's pick; a reload ends both.
import { documentEditor } from "../../../dispatch/e2e/editor";
import { expect, type Page, test } from "../test";
import { compareWith, revisitSpec, seedReadThenRevised, sinceText } from "./baseline-seed";
import { FIRST, openHost, SECOND, seedHost, THIRD } from "./hosts";

/** The counts of one changed block in a document with no heading, one section. */
const ONE_CHANGED = "1 block, 1 changed, in 1 of 1 section";

/** The change marks' labels in the document's text. */
const changeLabels = (page: Page) => documentEditor(page).locator("[data-reading-aids-change]");

/** A Compare-with option: upstream's own version picker offers the same names. */
const compareOption = (page: Page, name: string) =>
  page.getByRole("listbox").getByRole("option", { exact: true, name });

/** Goes to the other document and back in the app, so upstream makes a new editor. */
async function leaveAndReturn(page: Page): Promise<void> {
  await documentEditor(page).evaluate((editor) => editor.setAttribute("data-e2e-before", ""));
  await page.goBack();
  await expect(documentEditor(page)).not.toHaveAttribute("data-e2e-before", "");
  await page.goForward();
  await expect(documentEditor(page)).toContainText(SECOND);
  await expect(documentEditor(page)).not.toHaveAttribute("data-e2e-before", "");
}

test("baseline: a return to the spec keeps the visit's read mark and Compare-with pick, and a reload ends both", async ({
  page,
}) => {
  const seeded = await seedReadThenRevised(page);
  const { read } = seeded;

  // A new visit opens on the other document, and the app goes to the spec from there.
  const latest = await revisitSpec(page, seeded);
  const sinceRead = `Since v${read}, the version you last read: ${ONE_CHANGED}`;
  await expect(sinceText(page, sinceRead)).toBeVisible();
  expect(latest).toBeGreaterThan(read + 1);

  await leaveAndReturn(page);
  await expect(sinceText(page, sinceRead)).toBeVisible();

  const address = page.url();
  await compareWith(page).click();
  await compareOption(page, `Version ${read + 1}`).click();
  // A pick with the same counts still shows them.
  await expect(sinceText(page, `Since v${read + 1}: ${ONE_CHANGED}`)).toBeVisible();
  expect(page.url()).toBe(address);

  await leaveAndReturn(page);
  await expect(sinceText(page, `Since v${read + 1}: ${ONE_CHANGED}`)).toBeVisible();

  await page.reload();
  await expect(documentEditor(page)).toContainText(SECOND);
  await expect(sinceText(page, `No changes since v${latest}`)).toBeVisible();
});

test("baseline: a Compare-with pick changes the marks and not the address, a return keeps them, and a reload ends them", async ({
  page,
}) => {
  const seeded = await seedReadThenRevised(page, [
    [FIRST, "The first block, revised."],
    [THIRD, "The third block, revised."],
  ]);
  const latest = await revisitSpec(page, seeded);
  await expect(changeLabels(page)).toHaveText([
    "The first block, revised.",
    "The third block, revised.",
  ]);
  await expect(
    sinceText(
      page,
      `Since v${seeded.read}, the version you last read: 2 blocks, 2 changed, in 1 of 1 section`
    )
  ).toBeVisible();

  const address = page.url();
  await compareWith(page).click();
  await compareOption(page, `Version ${latest - 1}`).click();
  await expect(changeLabels(page)).toHaveText(["The third block, revised."]);
  await expect(sinceText(page, `Since v${latest - 1}: ${ONE_CHANGED}`)).toBeVisible();
  expect(page.url()).toBe(address);

  await leaveAndReturn(page);
  await expect(changeLabels(page)).toHaveText(["The third block, revised."]);

  await page.reload();
  await expect(documentEditor(page)).toContainText(SECOND);
  await expect(sinceText(page, `No changes since v${latest}`)).toBeVisible();
  await expect(changeLabels(page)).toHaveCount(0);
});

test("baseline: Tab reaches Compare with in the parts, and a pick from the keyboard keeps the focus there", async ({
  page,
}) => {
  const spec = await seedHost(page, "spec");
  await openHost(page, spec.path);
  const trigger = compareWith(page);
  await expect(sinceText(page, "No earlier version to compare")).toBeVisible();

  await page.getByRole("tab", { name: "Spec" }).focus();
  for (let presses = 0; presses < 40; presses += 1) {
    if (await trigger.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(trigger).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(compareOption(page, "Version 1")).toBeVisible();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(sinceText(page, "No changes since v1")).toBeVisible();
  await expect(trigger).toBeFocused();
});
