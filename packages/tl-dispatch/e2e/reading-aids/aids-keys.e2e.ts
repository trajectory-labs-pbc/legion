// The decision keys on each host: they wrap, keep the address and leave the focus where keys act.
import { expect, type Page, test } from "../test";
import { openHost, PARTS, shownParts } from "./hosts";
import {
  type Decision,
  decisionBlock,
  focusOnHost,
  focusParts,
  HOST_KINDS,
  readFirstListed,
  seedDecided,
} from "./read-first-seed";

/** Presses `key` and waits until `decision` is in view with the focus on the host. */
async function pressTo(page: Page, key: string, decision: Decision): Promise<void> {
  await page.keyboard.press(key);
  await expect(decisionBlock(page, decision.id)).toBeInViewport();
  await expect.poll(() => focusOnHost(page)).toBe(true);
}

for (const kind of HOST_KINDS) {
  test(`aids-keys: on the ${kind} host, d and Shift+D walk the decisions, wrap at both ends and keep the address`, async ({
    page,
  }) => {
    const { decisions, path } = await seedDecided(page, kind);
    await openHost(page, path);
    await readFirstListed(page);
    await focusParts(page);
    const address = page.url();

    await pressTo(page, "d", decisions[0]);
    await pressTo(page, "d", decisions[1]);
    await pressTo(page, "d", decisions[2]);
    await pressTo(page, "d", decisions[0]);
    await pressTo(page, "Shift+D", decisions[2]);
    await pressTo(page, "Shift+D", decisions[1]);
    expect(page.url()).toBe(address);
  });
}

test("aids-keys: t d toggles upstream's Decisions view and makes no move", async ({ page }) => {
  const { decisions, path } = await seedDecided(page, "spec");
  await openHost(page, path);
  await readFirstListed(page);
  await focusParts(page);
  await page.keyboard.press("t");
  await page.keyboard.press("d");
  await expect(decisionBlock(page, decisions[2].id)).not.toBeInViewport();
  expect(await focusOnHost(page)).toBe(false);
  expect(page.url()).not.toContain("#b-");
});

test("aids-keys: with the spec's and the verification's panels both mounted, d moves in the shown spec", async ({
  page,
}) => {
  const { decisions, path } = await seedDecided(page, "spec");
  await openHost(page, path);
  await readFirstListed(page);
  await focusParts(page);
  // Upstream's `t k` shows the verification and keeps the spec's panel mounted, hidden.
  await page.keyboard.press("t");
  await page.keyboard.press("k");
  await expect(page.locator(PARTS)).toHaveCount(2);
  await expect.poll(() => shownParts(page)).toBe(1);
  await page.keyboard.press("t");
  await page.keyboard.press("s");
  await expect(page.locator(PARTS)).toHaveCount(2);
  await readFirstListed(page);
  await focusParts(page);
  await pressTo(page, "d", decisions[0]);
  await pressTo(page, "d", decisions[1]);
});

test("aids-keys: Next and Previous decision are in the ? sheet and in the palette, whose row moves", async ({
  page,
}) => {
  const { decisions, path } = await seedDecided(page, "spec");
  await openHost(page, path);
  await readFirstListed(page);
  await focusParts(page);
  await page.keyboard.press("?");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(sheet.getByText("Next decision", { exact: true })).toBeVisible();
  await expect(sheet.getByText("Previous decision", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Search" });
  await palette.getByRole("combobox", { name: "Search" }).fill("decision");
  await expect(palette.getByRole("option", { name: /Previous decision/ })).toBeVisible();
  await palette.getByRole("option", { name: /Next decision/ }).click();
  await expect(decisionBlock(page, decisions[0].id)).toBeInViewport();
  await expect.poll(() => focusOnHost(page)).toBe(true);
});
