// Check `answer-toast`, its rows that the server takes out: the row under the reader's hand keeps
// its place on screen while a row above it leaves, in the list and in the drawer.
import type { Locator } from "@playwright/test";

import { centre, main, row, topOf } from "./page";
import { expect, type Seeded, test } from "./seed";

/** The seeded rows in the order `scope` draws them, top first. */
async function drawnOrder(scope: Locator, seeded: Seeded[]): Promise<Seeded[]> {
  const placed = await Promise.all(
    seeded.map(async (ask) => ({ ask, top: await topOf(row(scope, ask.text)) }))
  );
  return placed.sort((left, right) => left.top - right.top).map(({ ask }) => ask);
}

/** Puts the pointer on the 12th of the `seeded` rows that `scope` draws, withdraws the 5th, and
 *  checks that the held row does not move. */
async function holdWhileAboveLeaves(
  scope: Locator,
  seeded: Seeded[],
  retract: (id: string) => Promise<void>
): Promise<void> {
  for (const ask of seeded) await expect(row(scope, ask.text)).toBeAttached();
  const order = await drawnOrder(scope, seeded);
  const [above, held] = [order[4], order[11]];
  if (above === undefined || held === undefined) throw new Error("twelve rows were seeded");
  const heldRow = row(scope, held.text);
  await centre(heldRow);
  await heldRow.hover();
  const before = await topOf(heldRow);
  await retract(above.id);
  await expect(row(scope, above.text)).toHaveCount(0);
  expect(Math.abs((await topOf(heldRow)) - before)).toBeLessThanOrEqual(2);
}

test("INB-252 the row under the hand stays where it was when a row above it leaves", async ({
  inbox,
  page,
}) => {
  const asks = await inbox.asks(20, "Which ledger shard");
  await page.goto(await inbox.address());
  await holdWhileAboveLeaves(main(page), asks, (id) => inbox.retract(id));
});

test("INB-285 in the drawer, the row under the hand stays when a row above it leaves", async ({
  inbox,
  page,
}) => {
  const asks = await inbox.asks(20, "Which mirror shard");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await page.keyboard.press("i");
  const drawer = page.getByRole("dialog", { name: "Inbox" });
  await expect(drawer).toBeVisible();
  await holdWhileAboveLeaves(drawer, asks, (id) => inbox.retract(id));
});
