// The aids' keys act where R8 says, on each host, and nowhere else.
import { createNamedVersion } from "../../../dispatch/e2e/api";
import { documentEditor, placeCaret } from "../../../dispatch/e2e/editor";
import { navigateInApp } from "../../../dispatch/e2e/sends";
import { AGENT } from "../flows";
import { expect, type Page, test } from "../test";
import {
  FIRST,
  HOST,
  type HostKind,
  head,
  openHost,
  PARTS,
  partsRoot,
  SECOND,
  seedHost,
  shownParts,
} from "./hosts";
import {
  type Decision,
  decisionBlock,
  focusOnHost,
  focusParts,
  HOST_KINDS,
  readFirstListed,
  seedDecided,
} from "./read-first-seed";

/** A document with a requirement and a check, and the text `seedHost` comments on. */
const TYPED = [
  FIRST,
  "",
  SECOND,
  "",
  ":::requirement{#r1}",
  "The requirement.",
  ":::",
  "",
  ":::check{#c1}",
  "The check.",
  ":::",
  "",
].join("\n");

/** Whether each foldable block is open, in document order. */
const opened = (page: Page) =>
  Promise.all(["r1", "c1"].map((id) => head(page, id).getAttribute("aria-expanded")));

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

for (const kind of ["spec", "document"] as const satisfies readonly HostKind[]) {
  test(`aids-keys: z on the ${kind} host acts twice in a row from the host element, a part and a fold head, and types in the text`, async ({
    page,
  }) => {
    const { path } = await seedHost(page, kind, TYPED);
    await openHost(page, path);
    await expect.poll(() => opened(page)).toEqual(["false", "false"]);
    const control = partsRoot(page).getByRole("button", { name: "Fold or open blocks" });
    await expect(control).toBeVisible();
    await expect(partsRoot(page).locator("kbd")).toHaveText(/^z$/i);

    await page.locator(HOST).focus();
    await page.keyboard.press("z");
    await expect.poll(() => opened(page)).toEqual(["true", "true"]);
    await page.keyboard.press("z");
    await expect.poll(() => opened(page)).toEqual(["false", "false"]);

    // The part case: a click on a part's own room, beside its control.
    const box = await partsRoot(page).boundingBox();
    if (box === null) throw new Error("the parts have no box");
    await page.mouse.click(box.x + box.width - 2, box.y + box.height / 2);
    await page.keyboard.press("z");
    await expect.poll(() => opened(page)).toEqual(["true", "true"]);

    // The fold-head case.
    await head(page, "c1").focus();
    await page.keyboard.press("z");
    await expect.poll(() => opened(page)).toEqual(["false", "false"]);
    await expect(head(page, "c1")).toBeFocused();

    await placeCaret(page, "after", FIRST);
    await page.keyboard.press("z");
    await expect(documentEditor(page)).toContainText(`${FIRST}z`);
    expect(await opened(page)).toEqual(["false", "false"]);
  });
}

test("aids-keys: the shortcuts sheet lists z, and z acts neither under the sheet nor under ?v=", async ({
  page,
}) => {
  const { artifactId, path } = await seedHost(page, "spec", TYPED);
  await createNamedVersion(artifactId, "The first version.", AGENT);
  await openHost(page, path);
  await page.locator(HOST).focus();
  await page.keyboard.press("?");
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Fold or open blocks");
  await page.keyboard.press("z");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  expect(await opened(page)).toEqual(["false", "false"]);

  await page.getByRole("combobox", { name: "Version" }).selectOption("1");
  await expect(page.getByTestId("version-view")).toContainText(FIRST);
  await expect.poll(() => shownParts(page)).toBe(0);
  await page.keyboard.press("z");
  await navigateInApp(page, path);
  await expect.poll(() => shownParts(page)).toBe(1);
  expect(await opened(page)).toEqual(["false", "false"]);
});

test("aids-keys: z types in a text field and folds nothing", async ({ page }) => {
  const { path } = await seedHost(page, "spec", TYPED);
  await openHost(page, path);
  const card = page.locator("[data-margin-item]").first();
  await card.getByRole("button", { expanded: false }).click();
  const composer = card.getByRole("form", { name: "Comment composer" });
  const field = composer.getByRole("textbox", { name: "Reply" });
  await field.click();
  await page.keyboard.press("z");
  await expect(field).toHaveValue("z");
  expect(await opened(page)).toEqual(["false", "false"]);
});

test("aids-keys: the palette lists the fold action, and picking it folds as z does", async ({
  page,
}) => {
  const { path } = await seedHost(page, "spec", TYPED);
  await openHost(page, path);
  await page.locator(HOST).focus();
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("combobox", { name: "Search" }).fill("Fold or open");
  const option = page.getByRole("dialog", { name: "Search" }).getByRole("option", {
    name: /Fold or open blocks/,
  });
  await expect(option).toHaveCount(1);
  await option.click();
  await expect.poll(() => opened(page)).toEqual(["true", "true"]);
});
