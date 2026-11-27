// CX6 in Chromium: which rows lead with an icon. happy-dom keeps only the first compound of a
// `:has()` argument, so packages/ui's unit test cannot tell which menus keep the icon's room.
import { expect, type Page, test } from "./test";

type Row = { role?: string; html: string };

const svg = '<svg viewBox="0 0 16 16"></svg>';
const PLAIN: Row = { html: "Plain" };
const ICON: Row = { html: `${svg}Icon` };
const MARKED: Row = { html: '<span data-icon="inline-start"></span>Marked' };
const WRAPPED: Row = { html: `<span>${svg}</span>Wrapped` };
const TRAILING: Row = { html: `Trailing<svg data-icon="inline-end" viewBox="0 0 16 16"></svg>` };
const BADGE: Row = { html: `Badge<span class="ml-auto">${svg}</span>` };
const CHECKBOX: Row = { role: "menuitemcheckbox", html: "Checkbox" };
const RADIO: Row = { role: "menuitemradio", html: `${svg}Radio` };

/** Opens the account menu, only a host for the rows, puts copies of its first row holding `rows`
 *  in place of its rows, and says which keep an icon's room: a start padding wider than the end. */
async function keepsRoom(page: Page, rows: readonly Row[]): Promise<boolean[]> {
  await page.goto("/");
  await page.getByRole("button", { name: /^Signed in as / }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem").first()).toBeVisible();
  return menu.evaluate((element, rows) => {
    const first = element.querySelector('[role="menuitem"]');
    if (first === null) throw new Error("the menu has no row");
    const copies = rows.map(({ role, html }) => {
      const copy = first.cloneNode(false);
      if (!(copy instanceof Element)) throw new Error("the row is not an element");
      if (role !== undefined) copy.setAttribute("role", role);
      copy.innerHTML = html;
      return copy;
    });
    element.replaceChildren(...copies);
    return copies.map((copy) => {
      const style = getComputedStyle(copy);
      return parseFloat(style.paddingInlineStart) > parseFloat(style.paddingInlineEnd);
    });
  }, rows);
}

test("a row whose first child is an svg, or that has a child marked inline-start, gives every other row the room", async ({
  page,
}) => {
  expect(await keepsRoom(page, [ICON, PLAIN])).toEqual([false, true]);
  expect(await keepsRoom(page, [MARKED, PLAIN])).toEqual([false, true]);
  expect(await keepsRoom(page, [RADIO, PLAIN])).toEqual([false, true]);
});

test("a wrapped, a trailing or a nested svg leads with no icon, so no row keeps the room", async ({
  page,
}) => {
  expect(await keepsRoom(page, [PLAIN, WRAPPED, TRAILING, BADGE])).toEqual([
    false,
    false,
    false,
    false,
  ]);
});

test("a checkbox row keeps the room for its check, and so does every row beside it", async ({
  page,
}) => {
  expect(await keepsRoom(page, [CHECKBOX, PLAIN])).toEqual([true, true]);
});
