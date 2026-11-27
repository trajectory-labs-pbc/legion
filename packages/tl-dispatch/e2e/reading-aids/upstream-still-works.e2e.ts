// Upstream's document still works on each host with the aids on: the live sync, the keys at the
// first block, undo, the block reference counters and the outline's keys.
import { documentEditor, placeCaret, typeAtEnd } from "../../../dispatch/e2e/editor";
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
import { signedInLogin } from "../read-as-person";
import { expect, type Page, test } from "../test";
import { FIRST, type HostKind, openHost, partsRoot, SECOND, seedHost, TEXT, THIRD } from "./hosts";

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

for (const kind of ["spec", "document"] as const satisfies readonly HostKind[]) {
  test(`upstream-still-works: on the ${kind} host, the counters, the keys at the first block and the live sync`, async ({
    context,
    page,
  }) => {
    const { path } = await seedHost(page, kind);
    await openHost(page, path);
    const editor = documentEditor(page);
    await expect(partsRoot(page)).toHaveCount(1);

    // Upstream places a counter from the top of the editable element, so the parts inside it
    // leave each counter beside its block, as the parts grow after the document has loaded.
    const counter = page.locator("[data-block-references]");
    await expect(counter).toHaveCount(1);
    const blockId = await counter.getAttribute("data-block-references");
    const block = editor.locator(`[data-block-id="${blockId}"]`).first();
    await expect(block).toContainText(SECOND);
    for (const height of [200, 100]) {
      await partsRoot(page).evaluate((root, grown) => {
        const filler = document.createElement("div");
        filler.style.height = `${grown}px`;
        root.append(filler);
      }, height);
      await expect
        .poll(async () => {
          const [counterBox, blockBox] = await Promise.all([
            counter.boundingBox(),
            block.boundingBox(),
          ]);
          return counterBox === null || blockBox === null
            ? null
            : Math.abs(counterBox.y - blockBox.y);
        })
        .toBeLessThanOrEqual(1);
    }

    await editor.getByText(FIRST).click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await expect(editor).not.toContainText(FIRST);
    await expect(editor).not.toContainText(SECOND);
    await expect(partsRoot(page)).toHaveCount(1);
    await page.keyboard.press("ControlOrMeta+Z");
    await expect(editor).toContainText(FIRST);
    await expect(editor).toContainText(SECOND);

    // The aids draw text above the first block: the keys must neither stop at it nor enter it.
    await partsRoot(page).evaluate((root) => {
      const part = root.appendChild(document.createElement("div"));
      part.textContent = "A part above the text.";
    });
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
    await expect(partsRoot(page)).toHaveCount(1);
    await expect(partsRoot(second)).toHaveCount(1);
  });
}

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
  await withIssuePage(context, await signedInLogin(page));
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
  page,
}) => {
  const { path } = await seedHost(page, "spec");
  await openHost(page, path);
  await page.locator("[data-reading-aids-host]").evaluate((host) => {
    if (!(host instanceof HTMLElement)) return;
    host.tabIndex = -1;
    host.focus();
  });
  await page.keyboard.press("?");
  await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
});

for (const kind of ["spec", "document"] as const satisfies readonly HostKind[]) {
  for (const width of [1024, 1440]) {
    test(`upstream-still-works: on the ${kind} host at ${width} px, undo takes back the reader's typing`, async ({
      page,
    }) => {
      // Upstream adds its cursors' plugin only from 1280 px; the aids add theirs at every width.
      await page.setViewportSize({ height: 900, width });
      const { path } = await seedHost(page, kind);
      await openHost(page, path);
      const editor = documentEditor(page);
      await typeAtEnd(page, "Typed here.");
      await expect(editor).toContainText("Typed here.");

      await page.keyboard.press("ControlOrMeta+Z");
      await expect(editor).not.toContainText("Typed here.");
      await expect(editor).toContainText(SECOND);
    });
  }
}
