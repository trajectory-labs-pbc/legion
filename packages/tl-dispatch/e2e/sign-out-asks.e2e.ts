// Sign-out with an unsent change asks first (src/shell/use-sign-out.ts), names the change, and
// Cancel keeps the session and the change. Only the local mode confirms: a confirmed sign-out ends
// every session of the signed-in person, and the deployed mode's is the operator's.
import { keptWrites, pendingWrites } from "../../dispatch/e2e/keyed-writes";
import {
  FIRST_BACKOFF_MS,
  KEYED_SEND_ATTEMPT_MS,
} from "../../dispatch/web/src/features/writes/keyed-write";
import { HELD_STATUS, heldStatusChange, whoamiStatus } from "./flows";
import { deployed, expect, test } from "./test";

test("a sign-out with an unsent change asks first, and Cancel keeps the session", async ({
  page,
}) => {
  const { held, issue } = await heldStatusChange(page, "sign-out question");
  // With nothing unsent the sign-out asks no question, so the change must be in the indicator.
  await expect(pendingWrites(page)).toContainText("1 change");

  const signOut = async () => {
    await page.getByRole("button", { name: /^Signed in as / }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
  };
  const question = page.getByRole("alertdialog", { name: "Sign out?" });
  await signOut();
  await expect(question).toContainText("Sign out and discard 1 unsent change?");
  // The list of the unsent changes, each by its write's label.
  await expect(question).toContainText(`• ${issue} set to ${HELD_STATUS}`);
  await question.getByRole("button", { name: "Cancel" }).click();

  await expect(question).toHaveCount(0);
  await expect(pendingWrites(page)).toContainText("1 change");
  expect(await whoamiStatus(page)).toBe(200);
  if (deployed) return;

  await signOut();
  // The page gives up an attempt the hold keeps silent for KEYED_SEND_ATTEMPT_MS and makes it
  // again after a backoff that doubles from FIRST_BACKOFF_MS: past that, the next would have come.
  const sent = held.sent.length;
  const againAt =
    (held.sent.at(-1)?.arrivedAt ?? Date.now()) +
    KEYED_SEND_ATTEMPT_MS +
    FIRST_BACKOFF_MS * 2 ** (sent - 1) +
    2_000;
  await question.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in with Google" })).toBeVisible();
  expect(await whoamiStatus(page)).toBe(401);
  // The sign-in page lists no kept change, and the tab keeps none.
  await expect(page.getByRole("region", { name: "Kept changes" })).toHaveCount(0);
  expect(await keptWrites(page)).toBe(0);
  // The discarded change is never made again, and the hold let none of it reach Dispatch.
  await page.waitForTimeout(Math.max(0, againAt - Date.now()));
  expect(held.sent).toHaveLength(sent);
  expect(held.forwarded).toHaveLength(0);
});
