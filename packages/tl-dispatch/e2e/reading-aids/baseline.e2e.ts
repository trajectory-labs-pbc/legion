// The baseline is fixed for the visit: a new editor keeps it and the reader's pick; a reload ends both.
import { documentEditor } from "../../../dispatch/e2e/editor";
import { expect, type Page, test } from "../test";
import { compareWith, revisitSpec, seedReadThenRevised, sinceText } from "./baseline-seed";
import { openHost, SECOND, seedHost } from "./hosts";

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
  await expect(sinceText(page, `Since v${read}, the version you last read`)).toBeVisible();
  expect(latest).toBeGreaterThan(read + 1);

  await leaveAndReturn(page);
  await expect(sinceText(page, `Since v${read}, the version you last read`)).toBeVisible();

  const address = page.url();
  await compareWith(page).click();
  await compareOption(page, `Version ${read + 1}`).click();
  await expect(sinceText(page, `Since v${read + 1}`)).toBeVisible();
  expect(page.url()).toBe(address);

  await leaveAndReturn(page);
  await expect(sinceText(page, `Since v${read + 1}`)).toBeVisible();

  await page.reload();
  await expect(documentEditor(page)).toContainText(SECOND);
  await expect(sinceText(page, `Since v${latest}, the version you last read`)).toBeVisible();
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
  await expect(sinceText(page, "Since v1")).toBeVisible();
  await expect(trigger).toBeFocused();
});
