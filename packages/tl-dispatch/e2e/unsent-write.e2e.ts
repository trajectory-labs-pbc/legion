// An unsent write stays after a reload: a status change held in the browser, as upstream's rows in
// e2e/keyed-writes.e2e.ts hold one, is still in the pending-writes indicator once the page loads
// again, and lands once it is let go. The write sets to todo the status of an issue the test made
// in the run's project, so in the deployed mode it changes only a record the run made and named.
import { getIssue } from "../../dispatch/e2e/api";
import { pendingWrites } from "../../dispatch/e2e/keyed-writes";
import { AGENT, HELD_STATUS, heldStatusChange } from "./flows";
import { expect, test } from "./test";

test("a write held in the browser stays after a reload, and lands once let go", async ({
  page,
}) => {
  const { held, issue } = await heldStatusChange(page, "unsent write");

  await page.reload();
  await expect(pendingWrites(page)).toContainText("1 change");

  held.release();
  await expect(pendingWrites(page)).toHaveCount(0);
  expect(await getIssue(issue, AGENT)).toMatchObject({ status: HELD_STATUS });
});
