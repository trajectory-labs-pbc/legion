// What the Inbox's browser tests read on the page, each found by its role, its label or its
// text, never by an upstream class or test ID, so one test reads upstream's view and the fork's.
import type { Locator } from "@playwright/test";

import { expect, type Page } from "../test";
import type { Seeded } from "./seed";

export const inboxHeading = (page: Page): Locator =>
  page.getByRole("heading", { level: 1, name: "Inbox" });

/** How much of a question an ask's mark checkbox names before it cuts the rest with "…"
 *  (upstream's `controlName`, after the owner: `<issue key>[, ask N of M]: `). */
const ASK_NAME_CHARS = 48;

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** What the mark checkbox of `seeded`'s row is called. An ask's names its issue and the start of
 *  its question; a thread's names its whole line, which a test matches by its first line. */
function markName(seeded: Seeded): RegExp | string {
  if (seeded.kind === "thread") return seeded.text.split("\n", 1)[0] ?? "";
  const words = seeded.text.replace(/\s+/g, " ").trim();
  const question =
    words.length > ASK_NAME_CHARS
      ? `${literal(words.slice(0, ASK_NAME_CHARS).trimEnd())}…`
      : literal(words);
  return new RegExp(`^Select ${literal(seeded.issue)}(, ask \\d+ of \\d+)?: ${question}$`);
}

/** The row of `seeded`, in `scope`: the page's main region or the drawer. */
export function row(scope: Locator, seeded: Seeded): Locator {
  const mark = scope.page().getByRole("checkbox", { name: markName(seeded) });
  return scope.getByRole("listitem").filter({ has: mark });
}

/** The page's own list, beside the drawer's. */
export const main = (page: Page): Locator => page.getByRole("main");

/** Waits for the row of `seeded` to be the one the reading pane shows. */
export function expectOpen(page: Page, seeded: Seeded): Promise<void> {
  return expect(row(main(page), seeded)).toHaveAttribute("aria-current", "true");
}

/** The pane's one scroller. */
export const questionBody = (page: Page): Locator =>
  page.getByRole("region", { name: "Question body" });

/** The address's search parameters. */
export const search = (page: Page): URLSearchParams => new URL(page.url()).searchParams;

/** Takes the focus off whatever holds it, so the Inbox's keys act. */
export async function focusPage(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

const viewButton = (page: Page): Locator => page.getByRole("button", { exact: true, name: "View" });

/** Opens the View menu, unless it is open already, and answers it. */
export async function openView(page: Page): Promise<Locator> {
  const menu = page.getByRole("menu", { name: "View" });
  if ((await menu.count()) === 0) await viewButton(page).click();
  return menu;
}

/** Picks `choice` in the View menu's `section`. */
export async function chooseView(page: Page, section: string, choice: string): Promise<void> {
  const menu = await openView(page);
  await menu.getByRole("group", { name: section }).getByRole("radio", { name: choice }).check();
}

/** Closes the View menu with its own button. */
export async function closeView(page: Page): Promise<void> {
  await viewButton(page).click();
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
