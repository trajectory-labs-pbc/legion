// The parent's check `events-refresh`, on the Inbox: a change on the server shows with no reload.
import { main, row } from "./page";
import { expect, test } from "./seed";

test("INB-248 an ask an agent opens shows in the open Inbox", async ({ inbox, page }) => {
  const first = await inbox.ask("withOptions", "Open before the page?");
  await page.goto(await inbox.address());
  await expect(row(main(page), first)).toBeVisible();
  const arrived = await inbox.ask("withOptions", "Opened while the page is open?");
  await expect(row(main(page), arrived)).toBeVisible();
});
