// What the Inbox's browser tests read on the page, each found by its role, its label or its
// text, never by an upstream class or test ID, so one test reads upstream's view and the fork's.
import type { Locator } from "@playwright/test";

import { type Traffic, watchTraffic } from "../../../dispatch/e2e/traffic";
import { expect, type Page } from "../test";

/** How long the page has no request in flight before a test reads what it did not draw. */
const QUIET_MS = 500;

export const inboxHeading = (page: Page): Locator =>
  page.getByRole("heading", { level: 1, name: "Inbox" });

/** How much of a question a row's mark checkbox names before it cuts the rest. */
const MARK_NAMES = 40;

/** The row whose mark checkbox names `text`, in `scope`: the page's main region or the drawer. */
export function row(scope: Locator, text: string): Locator {
  const mark = scope.page().getByRole("checkbox", { name: text.slice(0, MARK_NAMES) });
  return scope.getByRole("listitem").filter({ has: mark });
}

/** The page's own list, beside the drawer's. */
export const main = (page: Page): Locator => page.getByRole("main");

/** The row the reading pane shows. */
export const openRow = (page: Page): Locator =>
  main(page).getByRole("listitem").and(page.locator('[aria-current="true"]'));

/** Waits for the row of `text` to be the one the reading pane shows. */
export function expectOpen(page: Page, text: string): Promise<void> {
  return expect(row(main(page), text)).toHaveAttribute("aria-current", "true");
}

/** The pane's one scroller. */
export const questionBody = (page: Page): Locator =>
  page.getByRole("region", { name: "Question body" });

/** The address's search parameters. */
export const search = (page: Page): URLSearchParams => new URL(page.url()).searchParams;

/** Watches the page's requests from before it opens, so a test can wait for them to settle. */
export function watch(page: Page): () => Promise<void> {
  const traffic: Traffic = watchTraffic(page);
  return () =>
    expect
      .poll(() => traffic.quietFor(QUIET_MS), {
        intervals: [50],
        message: "the page's requests settle",
      })
      .toBe(true);
}

/** Takes the focus off whatever holds it, so the Inbox's keys act. */
export async function focusPage(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** Picks `choice` in the View menu's `section`. */
export async function chooseView(page: Page, section: string, choice: string): Promise<void> {
  const menu = page.getByRole("menu", { name: "View" });
  if ((await menu.count()) === 0) await page.getByRole("button", { name: "View" }).click();
  await menu.getByRole("group", { name: section }).getByRole("radio", { name: choice }).check();
}

/** Closes the View menu with its own button. */
export async function closeView(page: Page): Promise<void> {
  await page.getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("menu", { name: "View" })).toHaveCount(0);
}

/** The top of `locator`'s box, which must be drawn. */
export async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("the element has no box");
  return box.y;
}

/** Scrolls whatever holds `locator` so that it sits at the middle of what shows. */
export function centre(locator: Locator): Promise<void> {
  return locator.evaluate((element) => element.scrollIntoView({ block: "center" }));
}
