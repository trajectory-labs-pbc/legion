// Check `inbox-preview`, the page's part: upstream's Inbox until the palette's command turns the
// preview on, the new Inbox at once and after a reload, and upstream's again after the command
// that leaves it. The test also keeps the new list's screenshots, light and dark, at each width
// the pull request's design review reads (test-results, which CI uploads).
import type { Locator, Page } from "@playwright/test";

import { main } from "./page";
import { expect, test } from "./seed";

const WIDTHS = [1440, 1024, 390] as const;
const SCHEMES = ["light", "dark"] as const;

const upstreamView = (page: Page) => page.locator("[data-upstream-view]");
const newView = (page: Page) => page.getByRole("navigation", { name: "Inbox views" });

/** The palette's Actions, after typing `words` into its search. */
async function paletteActions(page: Page, words: string) {
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search" });
  await page.getByRole("combobox", { name: "Search" }).fill(words);
  return dialog.getByRole("group", { name: "Actions" });
}

/** Runs `option` with the keyboard: arrows down to it, then Enter. */
async function runWithKeys(page: Page, option: Locator) {
  const input = page.getByRole("combobox", { name: "Search" });
  const id = await option.getAttribute("id");
  expect(id).not.toBeNull();
  for (let step = 0; step < 40; step += 1) {
    if ((await input.getAttribute("aria-activedescendant")) === id) break;
    await input.press("ArrowDown");
  }
  await expect(input).toHaveAttribute("aria-activedescendant", id as string);
  await input.press("Enter");
}

test("the palette turns the new Inbox on, which stays after a reload, and off again", async ({
  inbox,
  page,
}, testInfo) => {
  const release = await inbox.ask("withOptions", "Which release path for the train?");
  await inbox.ask("noOptions", "Who reviews the migration notes?");
  const later = await inbox.ask("oneChoice", "Where does the canary run first?");
  await inbox.snooze(later.id);
  await inbox.unreadThread("Is the retry fix in?", ["Looking now.", "Done: the retry is in."]);

  await inbox.open();
  await expect(upstreamView(page)).toBeVisible();
  await expect(newView(page)).toHaveCount(0);

  let actions = await paletteActions(page, "Inbox preview");
  await expect(actions.getByRole("option", { name: "Leave the Inbox preview" })).toHaveCount(0);
  await actions.getByRole("option", { name: "Preview the new Inbox" }).click();
  await expect(newView(page)).toBeVisible();
  await expect(upstreamView(page)).toHaveCount(0);
  await expect(page.getByText(release.text).first()).toBeVisible();

  await page.reload();
  await expect(newView(page)).toBeVisible();

  // Later starts folded; the pointer and the keyboard each open and close it.
  const fold = main(page).getByRole("button", { name: /^Later/ });
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await fold.click();
  await expect(main(page).getByText(later.text).first()).toBeVisible();
  await fold.press("Enter");
  await expect(fold).toHaveAttribute("aria-expanded", "false");

  for (const width of WIDTHS) {
    await page.setViewportSize({ height: 900, width });
    for (const colorScheme of SCHEMES) {
      await page.emulateMedia({ colorScheme });
      await page.screenshot({
        path: testInfo.outputPath(`inbox-preview-${width}-${colorScheme}.png`),
      });
    }
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ height: 900, width: 1440 });

  actions = await paletteActions(page, "Inbox preview");
  await expect(actions.getByRole("option", { name: "Preview the new Inbox" })).toHaveCount(0);
  await runWithKeys(page, actions.getByRole("option", { name: "Leave the Inbox preview" }));
  await expect(upstreamView(page)).toBeVisible();
  await expect(newView(page)).toHaveCount(0);
});
