// Check `answer-toast`, its rows that the server takes out: the row under the reader's hand keeps
// its place on screen while a row above it leaves, in the list and in the drawer.
import type { Locator } from "@playwright/test";

import { drawer } from "../../../dispatch/e2e/inbox-drawer";
import { centre, main, row, topOf } from "./page";
import { expect, type InboxSeed, type Seeded, test } from "./seed";

/** Puts the pointer on the 12th of the 20 `seeded` rows as the list draws them, newest first,
 *  withdraws the 5th, and checks that the held row does not move. */
async function holdWhileAboveLeaves(
  scope: Locator,
  seeded: Seeded[],
  inbox: InboxSeed
): Promise<void> {
  const order = [...seeded].reverse();
  const [above, held] = [order[4], order[11]];
  if (above === undefined || held === undefined) throw new Error("twenty rows were seeded");
  const heldRow = row(scope, held);
  await centre(heldRow);
  await heldRow.hover();
  const before = await topOf(heldRow);
  expect(await topOf(row(scope, above))).toBeLessThan(before);
  await inbox.retract(above.id);
  await expect(row(scope, above)).toHaveCount(0);
  expect(Math.abs((await topOf(heldRow)) - before)).toBeLessThanOrEqual(2);
}

test("INB-252 the row under the hand stays where it was when a row above it leaves", async ({
  inbox,
  page,
}) => {
  const asks = await inbox.asks(20, "Which ledger shard");
  await page.goto(await inbox.address());
  await holdWhileAboveLeaves(main(page), asks, inbox);
});

test("INB-285 in the drawer, the row under the hand stays and the window does not scroll", async ({
  inbox,
  page,
}) => {
  const asks = await inbox.asks(20, "Which mirror shard");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.keyboard.press("i");
  await expect(drawer(page)).toBeVisible();
  const scrolled = () => page.evaluate(() => window.scrollY);
  const before = await scrolled();
  await holdWhileAboveLeaves(drawer(page), asks, inbox);
  expect(await scrolled()).toBe(before);
});
