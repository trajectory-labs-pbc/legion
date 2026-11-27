// Check `one-row-every-width`: the list and the split view. From 1280 px the list and the pane
// each scroll in themselves under a header that stays, the walked row stays in view, the pane's
// scroller takes the scrolling keys, and a thread opens at its first unread reply.
import {
  chooseView,
  closeView,
  expectOpen,
  focusPage,
  inboxHeading,
  main,
  questionBody,
  row,
} from "./page";
import { expect, test } from "./seed";

test("INB-23 from 1280 px the list scrolls under a header that stays; below, the document scrolls", async ({
  inbox,
  page,
}) => {
  const asks = await inbox.asks(24, "Which shard replays");
  const [last, first] = [asks[0], asks.at(-1)];
  if (last === undefined || first === undefined) throw new Error("the asks were seeded");
  await page.goto(await inbox.address());
  await expect(row(main(page), first.text)).toBeVisible();
  await row(main(page), first.text).hover();
  await page.mouse.wheel(0, 4000);
  await expect(row(main(page), last.text)).toBeInViewport();
  await expect(inboxHeading(page)).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);

  await page.setViewportSize({ height: 720, width: 1024 });
  await page.goto(await inbox.address());
  await row(main(page), first.text).hover();
  await page.mouse.wheel(0, 1000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("INB-130 j past the fold keeps the selected row in view", async ({ inbox, page }) => {
  const asks = await inbox.asks(24, "Which lease expires");
  await page.goto(await inbox.address());
  await expectOpen(page, asks.at(-1)?.text ?? "");
  await focusPage(page);
  for (let step = 0; step < 20; step += 1) await page.keyboard.press("j");
  const walked = asks.at(-21)?.text ?? "";
  await expectOpen(page, walked);
  await expect(row(main(page), walked)).toBeInViewport();
});

test("INB-139 the pane's Question body is a focus stop that Page Down scrolls", async ({
  inbox,
  page,
}) => {
  const lines = Array.from({ length: 60 }, (_, index) => `Window ${index + 1} replays the ledger.`);
  const ask = await inbox.ask("noOptions", `Which window comes first?\n\n${lines.join("\n\n")}`);
  await page.goto(await inbox.address({ item: ask.id }));
  await expectOpen(page, "Which window comes first?");
  const body = questionBody(page);
  await body.focus();
  await expect(body).toBeFocused();
  expect(await body.evaluate((element) => element.scrollTop)).toBe(0);
  await page.keyboard.press("PageDown");
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("INB-185 under Oldest first, the pane opens a long thread at its first unread reply", async ({
  inbox,
  page,
}) => {
  const root = [
    "How far back does a cold start replay?",
    ...Array.from({ length: 50 }, (_, index) => `Replay note ${index + 1}.`),
  ].join("\n\n");
  const replies = ["One hour.", "Then a day.", "Unread: the whole ledger, window by window."];
  await inbox.unreadThread(root, replies, 1);
  await page.goto(await inbox.address());
  await chooseView(page, "Thread order", "Oldest first");
  await closeView(page);
  await row(main(page), "How far back does a cold start replay?").getByRole("time").first().click();
  await expectOpen(page, "How far back does a cold start replay?");
  const unread = questionBody(page).getByText(replies[2] ?? "");
  await expect(unread).toBeInViewport();
  // The root's own lines are above it, out of the scroller's view.
  await expect(
    questionBody(page).getByText("Replay note 1.", { exact: true })
  ).not.toBeInViewport();
});
