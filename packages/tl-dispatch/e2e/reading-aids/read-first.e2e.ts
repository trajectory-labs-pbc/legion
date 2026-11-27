// Read first on each host, and the upstream lines it hides or leaves.

import type { Locator } from "@playwright/test";
import { createIssueArtifact, editArtifact, getArtifact } from "../../../dispatch/e2e/api";
import { gotoIssue } from "../../../dispatch/e2e/issue-page";
import {
  expectIssuePageDrawn,
  expectOpeningLanded,
  nodeRow,
} from "../../../dispatch/e2e/issue-page-g";
import { caretInNode } from "../../../dispatch/e2e/issue-page-i";
import { withIssuePage } from "../../../dispatch/e2e/issue-page-option";
import { holdPosts, pasteFile } from "../../../dispatch/e2e/sends";
import { blockNodeId } from "../../../dispatch/web/src/features/issue-page/tree-drafts";
import { AGENT, personOf, writeAsPerson } from "../flows";
import { expect, type Page, test } from "../test";
import { openHost, PARTS, seedHost, shownParts, TEXT } from "./hosts";
import {
  DECISIONS,
  decisionBlock,
  decisionCard,
  decisionMarkdown,
  focusOnHost,
  focusParts,
  HOST_KINDS,
  readFirst,
  readFirstListed,
  seedDecided,
} from "./read-first-seed";

const navigator = "nav[aria-label='Open decisions']";
const editorSection = "section[aria-label='Document editor']";
/** Upstream's changed-since-read line, a child of the editor's section. */
const changedLine = (page: Page) =>
  page.locator(`${editorSection} > p[role='status']`, {
    hasText: /^Changed since you last read version 1: Rollout/,
  });

for (const kind of HOST_KINDS) {
  test(`read-first: on the ${kind} host, the request and the decisions in the document's order, and no navigator of upstream's`, async ({
    page,
  }) => {
    const { path } = await seedDecided(page, kind);
    await openHost(page, path);
    await readFirstListed(page);
    const rows = readFirst(page).getByRole("listitem");
    await expect(rows.first()).toContainText("Approval");
    // The page's own document is text, the other document of the request a link.
    if (kind === "spec") {
      await expect(rows.first().getByRole("link")).toHaveText(/^verification\.md v\d+$/);
    } else {
      await expect(rows.first().getByRole("link")).toHaveCount(0);
    }
    await expect(readFirst(page).getByRole("link", { name: /\?$/ })).toHaveText(
      DECISIONS.map(({ question }) => question)
    );
    await expect(page.locator(navigator)).toHaveCount(1);
    await expect(page.locator(navigator)).toBeHidden();

    // The editor's list and paragraph styles stay off the rows: no indent, no gap.
    const label = readFirst(page).getByText("Read first", { exact: true });
    const [labelBox, rowBox] = await Promise.all([label.boundingBox(), rows.first().boundingBox()]);
    expect(Math.abs((labelBox?.x ?? 0) - (rowBox?.x ?? -100))).toBeLessThanOrEqual(1);
    expect((rowBox?.y ?? 0) - ((labelBox?.y ?? 0) + (labelBox?.height ?? 0))).toBeLessThanOrEqual(
      8
    );
  });
}

/** Whether `link` takes the pointer 12 px above and below its middle, and is the thing hit there. */
const tallTarget = (link: Locator) =>
  link.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    const x = box.left + box.width / 2;
    return [middle - 11.5, middle + 11.5].every(
      (y) => document.elementFromPoint(x, y)?.closest("a") === node
    );
  });

/** The box that takes the pointer for `link`: its own, grown by its `::before`. */
const targetBox = (link: Locator) =>
  link.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const grown = getComputedStyle(node, "::before");
    return {
      bottom: box.bottom - (Number.parseFloat(grown.bottom) || 0),
      top: box.top + (Number.parseFloat(grown.top) || 0),
    };
  });

/** Whether the focused element draws the focus token's outline. */
const focusOutline = (page: Page) =>
  page.evaluate(() => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement)) return false;
    const probe = document.body.appendChild(document.createElement("span"));
    probe.style.color = "var(--focus)";
    const focus = getComputedStyle(probe).color;
    probe.remove();
    const style = getComputedStyle(focused);
    return (
      style.outlineStyle === "solid" &&
      style.outlineColor === focus &&
      Number.parseFloat(style.outlineWidth) > 0
    );
  });

test("read-first: each link is a pointer target 24 px tall, and each Tab stop draws the focus outline", async ({
  page,
}) => {
  const { path } = await seedDecided(page, "spec");
  await openHost(page, path);
  await readFirstListed(page);
  const links = await readFirst(page).getByRole("link").all();
  expect(links).toHaveLength(1 + DECISIONS.length);
  for (const link of links) expect(await tallTarget(link)).toBe(true);
  await focusParts(page);
  for (const link of links) {
    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    expect(await focusOutline(page)).toBe(true);
  }
});

test("read-first: two links of a request that wrap onto two lines keep their pointer targets apart", async ({
  page,
}) => {
  const { issueKey, path } = await seedDecided(page, "spec");
  const notes = await createIssueArtifact(
    issueKey ?? "",
    { content: "# Notes\n\nA third document.\n", name: "notes.md" },
    AGENT
  );
  // The server names two documents at most, so the read gives the request a third.
  await page.route(`**/api/v1/issues/${issueKey ?? ""}/asks*`, async (route) => {
    const response = await route.fetch();
    const asks = (await response.json()) as { approval?: { documents?: object[] } }[];
    for (const ask of asks) {
      const documents = ask.approval?.documents;
      const last = documents?.at(-1);
      if (last !== undefined)
        documents?.push({ ...last, artifact_id: notes.artifact.id, name: "notes.md" });
    }
    await route.fulfill({ json: asks, response });
  });
  await openHost(page, path);
  const request = readFirst(page).getByRole("listitem").first();
  const links = request.getByRole("link");
  await expect(links).toHaveCount(2);
  // One item to a line, so the two links sit one over the other.
  await request
    .locator("div")
    .first()
    .evaluate((line) => {
      if (line instanceof HTMLElement) line.style.width = "1px";
    });
  const [upper, lower] = [await targetBox(links.nth(0)), await targetBox(links.nth(1))];
  expect(upper.bottom).toBeLessThanOrEqual(lower.top);
});

test("read-first: a click on a decision moves to its block and sets its #b- address, and so does the same click after a scroll", async ({
  page,
}) => {
  const { decisions, path } = await seedDecided(page, "spec");
  await openHost(page, path);
  await readFirstListed(page);
  const last = decisions[2];
  const link = readFirst(page).getByRole("link", { name: last.question });
  const block = decisionBlock(page, last.id);
  await expect(block).not.toBeInViewport();

  await link.click();
  await expect(block).toBeInViewport();
  await expect(page).toHaveURL(new RegExp(`#b-${last.id}$`));
  await expect.poll(() => focusOnHost(page)).toBe(true);

  await readFirst(page).scrollIntoViewIfNeeded();
  await expect(block).not.toBeInViewport();
  await link.click();
  await expect(block).toBeInViewport();
  await expect.poll(() => focusOnHost(page)).toBe(true);
});

test("read-first: on a phone each decision's row is a 44 px tap target", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  const { path } = await seedDecided(page, "spec");
  await openHost(page, path);
  await readFirstListed(page);
  const heights = await readFirst(page)
    .getByRole("listitem")
    .filter({ hasText: "Decision" })
    .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
  expect(heights).toHaveLength(DECISIONS.length);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
});

test("DOC-6 read-first: at ?v= the parts do not show, and upstream draws no navigator there", async ({
  page,
}) => {
  const { issueKey, path } = await seedDecided(page, "spec");
  await openHost(page, path);
  await readFirstListed(page);
  // Upstream reads `?v=` on a document's artifacts address only.
  await page.goto(`/issues/${issueKey ?? ""}/artifacts/spec?v=1`);
  await expect(page.getByTestId("version-view")).toBeVisible();
  await expect(page.getByRole("region", { name: "Read first" })).toBeHidden();
  await expect.poll(() => shownParts(page)).toBe(0);
  await expect(page.locator(navigator)).toHaveCount(0);
});

test("DOC-8 read-first: the changed-since-read line hides on the spec host, the other status lines show, and the line shows in an outline row's editor", async ({
  context,
  page,
}) => {
  const text = [
    TEXT,
    decisionMarkdown({ id: "upload-decision", question: "Keep the plan?" }),
    "## Rollout\n\nThe plan.",
    "## Requirements\n\n:::requirement{#r-changed}\nA requirement the outline lists.\n:::\n",
  ].join("\n\n");
  const { artifactId, issueKey, path } = await seedHost(page, "spec", text);
  const readMark = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname === `/api/v1/me/documents/${artifactId}/read`
  );
  await openHost(page, path);
  expect((await readMark).ok()).toBe(true);
  await editArtifact(
    artifactId,
    { ops: [{ op: "replace", find: "The plan.", with: "The revised plan." }] },
    AGENT
  );
  await expect
    .poll(async () => ((await getArtifact(artifactId, AGENT)).versions ?? []).length)
    .toBeGreaterThan(1);

  await openHost(page, path);
  await expect(readFirst(page)).toBeVisible();
  await expect(changedLine(page)).toHaveCount(1);
  await expect(changedLine(page)).toBeHidden();

  // A version made whose answer was lost: upstream's line has a test id, so it shows.
  await page.route(`**/api/v1/artifacts/${artifactId}/versions`, (route) =>
    route.request().method() === "POST"
      ? route.fulfill({ json: { code: "KEY_COMMITTED", error: "committed" }, status: 409 })
      : route.fallback()
  );
  await page.getByRole("button", { name: "Name version" }).first().click();
  const naming = page.getByRole("dialog", { name: "Name this version" });
  await naming.getByLabel("What changed?").fill("The revised plan.");
  await naming.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("landed-without-answer")).toBeVisible();
  await page.unroute(`**/api/v1/artifacts/${artifactId}/versions`);

  // A card's upload line is no child of the section, so it shows.
  const upload = await holdPosts(page, `**/api/v1/issues/${issueKey ?? ""}/artifacts`);
  const card = decisionCard(page, "upload-decision");
  await card.getByRole("button", { name: "Add a note or answer in your own words" }).click();
  await pasteFile(card.getByRole("textbox", { name: "Your answer" }), "notes.md", "# Notes\n");
  await expect(card.getByText("Uploading file…")).toBeVisible();
  await expect(changedLine(page)).toBeHidden();
  upload.release();

  await writeAsPerson(page, `/api/v1/me/documents/${artifactId}/read`, { version: 1 });
  await withIssuePage(context, await personOf(page));
  await gotoIssue(page, `/issues/${issueKey ?? ""}`);
  await expectIssuePageDrawn(page);
  await expectOpeningLanded(page);
  await page.keyboard.press("End");
  await expect(nodeRow(page, blockNodeId("spec", "r-changed")).first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => caretInNode(page)).toBe(true);
  await expect(page.locator(PARTS)).toHaveCount(0);
  await expect(changedLine(page)).toBeVisible();
});
