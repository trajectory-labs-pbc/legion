// Upstream's document still works on each host with the aids on; upstream's build is the baseline.
import type { Locator } from "@playwright/test";
import {
  barAction,
  composer,
  documentEditor,
  placeCaret,
  selectEditorText,
  typeAtEnd,
} from "../../../dispatch/e2e/editor";
import { gotoIssue } from "../../../dispatch/e2e/issue-page";
import {
  expectIssuePageDrawn,
  expectOpeningLanded,
  focusThePage,
  issuePage,
  nodeRow,
  nodeRows,
} from "../../../dispatch/e2e/issue-page-g";
import { withIssuePage } from "../../../dispatch/e2e/issue-page-option";
import { blockNodeId } from "../../../dispatch/web/src/features/issue-page/tree-drafts";
import type { App } from "../dists";
import { personOf } from "../flows";
import { test as appTest, expect, type Page } from "../test";
import { FIRST, HOST, openHost, PARTS, partsRoot, SECOND, seedHost, TEXT, THIRD } from "./hosts";
import {
  decisionCard,
  focusParts,
  HOST_KINDS,
  LAST,
  LINK,
  readFirst,
  seedDecided,
} from "./read-first-seed";

/** The build the server serves, which the baseline's config sets. */
const test = appTest.extend<{ app: App }>({ app: ["tl-dispatch", { option: true }] });

/** The block of the selection's focus, whether the selection is collapsed, and its text. */
const selectionNow = (page: Page) =>
  page.evaluate(() => {
    const selection = window.getSelection();
    const node = selection?.focusNode;
    const element = node instanceof Element ? node : node?.parentElement;
    return {
      block: element?.closest("[data-block-id]")?.textContent ?? null,
      collapsed: selection?.isCollapsed ?? false,
      text: selection?.toString() ?? "",
    };
  });

const CARET_IN_FIRST = { block: FIRST, collapsed: true, text: "" };

/** The text of each block of the document but its decisions, whose cards draw times. */
const blockTexts = (page: Page) =>
  documentEditor(page)
    .locator("[data-block-id]")
    .evaluateAll((blocks) =>
      blocks
        .filter(
          (block) =>
            block.closest("[data-dispatch-ask-block]") === null &&
            block.querySelector("[data-dispatch-ask-block]") === null
        )
        .map((block) => {
          // Upstream's widgets, such as another tab's caret and its name, hold no document text.
          const copy = block.cloneNode(true) as Element;
          for (const widget of copy.querySelectorAll(".ProseMirror-widget")) widget.remove();
          return copy.textContent;
        })
    );

/** How far apart the tops of two elements are, once both are drawn. */
async function topsApart(first: Locator, second: Locator): Promise<number | null> {
  const [a, b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
  return a === null || b === null ? null : Math.abs(a.y - b.y);
}

const FAR = "A block far below the others.";
const SPACER = Array.from({ length: 12 }, (_, at) => `A paragraph between, number ${at + 1}.`).join(
  "\n\n"
);

/** On the aided build, holds that each page still draws its parts; upstream's draws none. */
async function partsStay(app: App, ...pages: Page[]): Promise<void> {
  if (app !== "tl-dispatch") return;
  for (const each of pages) await expect(partsRoot(each)).toHaveCount(1);
}

/** The ranges of upstream's `?q=` highlight: all of them, and those in the aids' parts. */
const searchHighlights = (page: Page) =>
  page.evaluate((parts) => {
    // Playwright's TypeScript context lacks CSS Highlight API declarations.
    const css = CSS as unknown as { highlights?: Map<string, Iterable<Range>> };
    const ranges = [...(css.highlights?.get("dispatch-search") ?? [])];
    const inParts = ranges.filter(
      (range) => range.startContainer.parentElement?.closest(parts) != null
    );
    return { all: ranges.length, inParts: inParts.length };
  }, PARTS);

/** The farthest any element of the page is scrolled. */
const farthestScroll = (page: Page) =>
  page.evaluate(() =>
    Math.max(0, ...[...document.querySelectorAll("*")].map((element) => element.scrollTop))
  );

for (const kind of HOST_KINDS) {
  test(`upstream-still-works: on the ${kind} host, the counters, the keys at the first block and the live sync`, async ({
    app,
    context,
    page,
  }) => {
    const { path } = await seedHost(page, kind);
    await openHost(page, path);
    const editor = documentEditor(page);
    await partsStay(app, page);

    // Upstream places a counter from the top of the editable element, so the parts inside it
    // leave each counter beside its block, as the parts grow after the document has loaded.
    const counter = page.locator("[data-block-references]");
    await expect(counter).toHaveCount(1);
    const blockId = await counter.getAttribute("data-block-references");
    const block = editor.locator(`[data-block-id="${blockId}"]`).first();
    await expect(block).toContainText(SECOND);
    const counterBeside = () => expect.poll(() => topsApart(counter, block)).toBeLessThanOrEqual(1);
    await counterBeside();
    for (const height of app === "tl-dispatch" ? [200, 100] : []) {
      await partsStay(app, page);
      await partsRoot(page).evaluate((root, grown) => {
        const filler = document.createElement("div");
        filler.style.height = `${grown}px`;
        root.append(filler);
      }, height);
      await counterBeside();
    }

    await editor.getByText(FIRST).click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await expect(editor).not.toContainText(FIRST);
    await expect(editor).not.toContainText(SECOND);
    await partsStay(app, page);
    await page.keyboard.press("ControlOrMeta+Z");
    await expect(editor).toContainText(FIRST);
    await expect(editor).toContainText(SECOND);

    // The aids draw text above the first block: the keys must neither stop at it nor enter it.
    await partsStay(app, page);
    if (app === "tl-dispatch") {
      await partsRoot(page).evaluate((root) => {
        const part = root.appendChild(document.createElement("div"));
        part.textContent = "A part above the text.";
      });
    }
    await placeCaret(page, "after", THIRD);
    await page.keyboard.press("Control+Home");
    await expect.poll(() => selectionNow(page)).toEqual(CARET_IN_FIRST);
    await placeCaret(page, "after", THIRD);
    await page.keyboard.press("Control+Shift+Home");
    await expect.poll(async () => (await selectionNow(page)).text.startsWith(FIRST)).toBe(true);
    await placeCaret(page, "after", FIRST);
    await page.keyboard.press("ArrowUp");
    await expect.poll(() => selectionNow(page)).toEqual(CARET_IN_FIRST);

    const second = await context.newPage();
    await openHost(second, path);
    await typeAtEnd(page, "Typed in the first tab.");
    await expect(documentEditor(second)).toContainText("Typed in the first tab.");
    await typeAtEnd(second, "Typed in the second tab.");
    await expect(editor).toContainText("Typed in the second tab.");
    await partsStay(app, page, second);
  });

  test(`upstream-still-works: on the ${kind} host, a comment's card and the selection bar's sit beside their marks`, async ({
    app,
    page,
  }) => {
    // No open ask, and the bar's block far down: upstream stacks each card below those above it.
    const { path } = await seedHost(page, kind, `${TEXT}\n${SPACER}\n\n${FAR}\n`);
    await openHost(page, path);
    const editor = documentEditor(page);
    if (app === "tl-dispatch") await expect(readFirst(page)).toBeVisible();

    const seededCard = page.locator('[data-testid^="margin-comment-"]', {
      hasText: "A comment on the second block.",
    });
    const seededMark = editor.locator("[data-id]", { hasText: "which a comment names" }).first();
    await expect.poll(() => topsApart(seededCard, seededMark)).toBeLessThanOrEqual(4);
    // A click puts ProseMirror's selection there, so the focus in selectEditorText scrolls nowhere.
    await editor.getByText(FAR).click();
    await selectEditorText(page, FAR);
    await barAction(page, "Comment");
    await composer(page).getByLabel("Comment").fill("A comment from the bar.");
    await composer(page).getByRole("button", { exact: true, name: "Send" }).click();
    const barCard = page.locator('[data-testid^="margin-comment-"]', {
      hasText: "A comment from the bar.",
    });
    await expect(barCard).toBeVisible();
    const farBlock = editor.locator("[data-block-id]", { hasText: FAR }).first();
    await expect.poll(() => topsApart(barCard, farBlock)).toBeLessThanOrEqual(4);
  });

  test(`upstream-still-works: on the ${kind} host, the counter's margin filter, a #b- link, a ?q= address, the approval chip, a decision's answer and a hover card`, async ({
    app,
    context,
    page,
  }) => {
    const { decisions, path, targetTitle } = await seedDecided(page, kind);
    await openHost(page, path);
    const editor = documentEditor(page);

    // The counter filters the margin to its block.
    await page.getByRole("button", { name: "1 references on block" }).first().click();
    await expect(page.getByText("References for this block")).toBeVisible();

    // A `#b-` address opens the page at its paragraph.
    const lastBlock = editor.locator("[data-block-id]", { hasText: LAST }).first();
    const paragraphId = await lastBlock.getAttribute("data-block-id");
    const linked = await context.newPage();
    await linked.goto(`${path}#b-${paragraphId}`);
    await expect(
      documentEditor(linked).locator(`[data-block-id="${paragraphId}"]`).first()
    ).toBeInViewport();
    await linked.close();

    // A `?q=` address highlights the matches, the parts' text too, and scrolls to none.
    await page.goto(`${path}?q=region`);
    await expect(editor).toContainText(decisions[0].question);
    await expect.poll(async () => (await searchHighlights(page)).all).toBeGreaterThan(0);
    if (app === "tl-dispatch") {
      await expect(readFirst(page)).toBeVisible();
      await expect.poll(async () => (await searchHighlights(page)).inParts).toBeGreaterThan(0);
    }
    expect(await farthestScroll(page)).toBe(0);

    // The approval chip opens its reviews.
    await openHost(page, path);
    await page.getByRole("button", { name: "Awaiting approval" }).first().click();
    await expect(page.getByRole("dialog", { name: "Reviews" })).toBeVisible();
    await page.keyboard.press("Escape");

    // A decision is answered in its card, and leaves Read first.
    const card = decisionCard(page, decisions[1].id);
    await card.getByRole("radio", { name: /^Yes/ }).check();
    await card.getByRole("button", { exact: true, name: "Answer" }).click();
    await expect(card.getByRole("radio")).toHaveCount(0);
    if (app === "tl-dispatch") {
      await expect(readFirst(page)).toBeVisible();
      await expect(readFirst(page).getByRole("link", { name: decisions[1].question })).toHaveCount(
        0
      );
    }

    // A reference's hover card names its target.
    await editor.getByRole("link", { name: LINK }).hover();
    await expect(page.getByRole("tooltip")).toContainText(targetTitle);
  });
}

test("upstream-still-works: after a click in Read first and the second tab's edit, a typed letter and Backspace change nothing", async ({
  app,
  context,
  page,
}) => {
  test.skip(app === "upstream", "Upstream's build draws no Read first");
  const { path } = await seedDecided(page, "spec");
  await openHost(page, path);
  await focusParts(page);
  const second = await context.newPage();
  await openHost(second, path);
  await typeAtEnd(second, "Typed in the second tab.");
  await expect(documentEditor(page)).toContainText("Typed in the second tab.");
  const before = await blockTexts(page);

  await page.keyboard.press("m");
  // A second edit that reaches this tab after the key, so the key has been handled.
  await typeAtEnd(second, "Typed after the letter.");
  await expect(documentEditor(page)).toContainText("Typed after the letter.");
  expect(await blockTexts(page)).toEqual([...before, "Typed after the letter."]);
  await page.keyboard.press("Backspace");
  await typeAtEnd(second, "Typed after Backspace.");
  await expect(documentEditor(page)).toContainText("Typed after Backspace.");
  expect(await blockTexts(page)).toEqual([
    ...before,
    "Typed after the letter.",
    "Typed after Backspace.",
  ]);
});

/** A point of the issue page that no control, row or editor covers: a click there focuses the
 *  nearest focusable element around it, which upstream makes the shell's main region. */
const blankPoint = (page: Page) =>
  issuePage(page).evaluate((root) => {
    const taken = "a,button,input,select,textarea,[contenteditable],[role=tree],[data-node-row]";
    const box = root.getBoundingClientRect();
    for (let y = box.bottom - 4; y > box.top; y -= 16) {
      for (let x = box.left + 4; x < box.right; x += 16) {
        const at = document.elementFromPoint(x, y);
        if (at !== null && root.contains(at) && at.closest(taken) === null) return { x, y };
      }
    }
    return null;
  });

test("upstream-still-works: on the outline, a click on the blank page leaves the focus where upstream does, and j from the page moves to the first row", async ({
  context,
  page,
}) => {
  const { issueKey } = await seedHost(
    page,
    "spec",
    `${TEXT}\n## Requirements\n\n:::requirement{#r-one}\nThe first requirement.\n:::\n\n:::requirement{#r-two}\nThe second requirement.\n:::\n`
  );
  await withIssuePage(context, await personOf(page));
  await gotoIssue(page, `/issues/${issueKey ?? ""}`);
  await expectIssuePageDrawn(page);
  await expectOpeningLanded(page);
  await page.keyboard.press("End");
  await expect(nodeRow(page, blockNodeId("spec", "r-two")).first()).toBeFocused();

  const point = await blankPoint(page);
  expect(point, "the issue page has no blank point").not.toBeNull();
  await page.mouse.click(point?.x ?? 0, point?.y ?? 0);
  await expect(page.getByTestId("main-content")).toBeFocused();

  await focusThePage(page);
  await page.keyboard.press("j");
  await expect(nodeRows(page).first()).toBeFocused();
});

test("upstream-still-works: the global keys act with the focus on the host, as a move leaves it", async ({
  app,
  page,
}) => {
  test.skip(app === "upstream", "Upstream's build has no host element");
  const { path } = await seedHost(page, "spec");
  await openHost(page, path);
  await expect(page.locator(HOST)).toHaveCount(1);
  await page.locator(HOST).evaluate((host) => {
    if (!(host instanceof HTMLElement)) return;
    host.tabIndex = -1;
    host.focus();
  });
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
});

for (const kind of HOST_KINDS) {
  for (const width of [1024, 1440]) {
    test(`upstream-still-works: on the ${kind} host at ${width} px, undo takes back the reader's typing`, async ({
      app,
      page,
    }) => {
      // Upstream adds its cursors' plugin only from 1280 px; the aids add theirs at every width.
      await page.setViewportSize({ height: 900, width });
      const { path } = await seedHost(page, kind);
      await openHost(page, path);
      await partsStay(app, page);
      const editor = documentEditor(page);
      await typeAtEnd(page, "Typed here.");
      await expect(editor).toContainText("Typed here.");

      await page.keyboard.press("ControlOrMeta+Z");
      await expect(editor).not.toContainText("Typed here.");
      await expect(editor).toContainText(SECOND);
    });
  }
}
