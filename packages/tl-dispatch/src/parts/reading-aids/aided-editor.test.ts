import { afterEach, beforeAll, expect, test } from "bun:test";
import { Plugin } from "@milkdown/kit/prose/state";
import { waitFor } from "@testing-library/react";
import * as Y from "yjs";
import {
  BLOCK_ID_ATTRIBUTE,
  EDITOR_BOX_ATTRIBUTE,
  type EditorHandle,
  specBlockMarks,
} from "@/upstream/editor/frame";
import { against, inProcessEditorIn } from "../../../tests/reading-aids/comparer-fixtures";
import {
  blockIdsOf,
  destroyEditors,
  editorIn,
  keep,
  linkedDocs,
  options,
  rootIn,
  SPEC,
} from "../../../tests/reading-aids/editor-fixtures";
import { warmMarkdownRenderer } from "../../../tests/upstream";
import { aidedEditor, HOST_ATTRIBUTE } from "./aided-editor";
import { installAids, PARTS_ATTRIBUTE, REVEAL_BLOCK } from "./editor-aids";
import { setMarksBaseline } from "./marks-plugin";
import { partsSlot } from "./parts-slot";

beforeAll(async () => {
  await warmMarkdownRenderer();
});

afterEach(destroyEditors);

const partsRoots = (handle: EditorHandle) =>
  handle.view.dom.querySelectorAll(`[${PARTS_ATTRIBUTE}]`);

test("an editor in a host that names a document gets one parts root, outside the text", async () => {
  const handle = await editorIn(rootIn(HOST_ATTRIBUTE), SPEC);
  handle.setMarkdown("First block.\n\nSecond block.");
  const roots = partsRoots(handle);
  expect(roots).toHaveLength(1);
  const root = roots[0];
  expect(root?.getAttribute("tabindex")).toBe("-1");
  expect(root?.getAttribute("contenteditable")).toBe("false");
  expect(root?.hasAttribute(BLOCK_ID_ATTRIBUTE)).toBe(false);
  expect(root?.hasAttribute("data-id")).toBe(false);
  // Outside the editor's prose styles, as upstream's own slots in the editor are.
  expect(root?.classList.contains("not-prose")).toBe(true);
  expect(handle.view.dom.firstElementChild).toBe(root ?? null);
  expect(handle.view.state.doc.textContent).toBe("First block.Second block.");
  expect(partsSlot.entries().map((entry) => entry.root)).toEqual([root as HTMLElement]);
});

test.each([
  ["with no documentRef", () => rootIn(HOST_ATTRIBUTE), undefined],
  ["in an outline row's box", () => rootIn(HOST_ATTRIBUTE, EDITOR_BOX_ATTRIBUTE), SPEC],
  ["outside a host", () => rootIn(), SPEC],
])("an editor %s gets no aids", async (_case, root, documentRef) => {
  const handle = await editorIn(root(), documentRef);
  expect(partsRoots(handle)).toHaveLength(0);
  expect(partsSlot.entries()).toEqual([]);
});

test("a failed load of the aids gives upstream's plain editor, the one editor in its root", async () => {
  const root = rootIn(HOST_ATTRIBUTE);
  const failed = aidedEditor(() => Promise.reject(new Error("The aids' chunk is gone.")));
  const handle = keep(await failed(root, options(new Y.Doc(), SPEC)));
  handle.setMarkdown("First block.");
  expect(handle.view.state.doc.textContent).toBe("First block.");
  expect(root.querySelectorAll(".ProseMirror")).toHaveLength(1);
  expect(partsRoots(handle)).toHaveLength(0);
  expect(partsSlot.entries()).toEqual([]);
});

test("a failed install of the aids gives upstream's plain editor, the one editor in its root", async () => {
  const root = rootIn(HOST_ATTRIBUTE);
  const aids = await import("./editor-aids");
  const refusing = aidedEditor(async () => ({
    ...aids,
    installAids: () => {
      throw new Error("The aids refused this editor.");
    },
  }));
  const handle = keep(await refusing(root, options(new Y.Doc(), SPEC)));
  handle.setMarkdown("First block.");
  expect(handle.view.state.doc.textContent).toBe("First block.");
  expect(root.querySelectorAll(".ProseMirror")).toHaveLength(1);
  expect(partsSlot.entries()).toEqual([]);
});

test("an install that fails after it reconfigured leaves upstream's plugins and no parts", async () => {
  const root = rootIn(HOST_ATTRIBUTE);
  const aids = await import("./editor-aids");
  let before: readonly Plugin[] = [];
  const halfway = aidedEditor(async () => ({
    ...aids,
    installAids: (editor, host, documentRef) => {
      before = editor.view.state.plugins;
      aids.installAids(editor, host, documentRef);
      throw new Error("The aids failed after their plugins went in.");
    },
  }));
  const handle = keep(await halfway(root, options(new Y.Doc(), SPEC)));
  expect(handle.view.state.plugins).toEqual(before);
  expect(partsRoots(handle)).toHaveLength(0);
  expect(partsSlot.entries()).toEqual([]);
});

test("a second install on an editor that has the aids is refused", async () => {
  const host = rootIn(HOST_ATTRIBUTE);
  const handle = await editorIn(host, SPEC);
  expect(() => installAids(handle, host, SPEC)).toThrow("This editor has the aids already.");
  expect(partsRoots(handle)).toHaveLength(1);
});

test("destroy leaves no parts", async () => {
  const handle = await editorIn(rootIn(HOST_ATTRIBUTE), SPEC);
  const roots = () => partsSlot.entries().map((entry) => entry.root);
  const [root] = partsRoots(handle);
  expect(roots()).toContain(root as HTMLElement);
  await handle.destroy();
  expect(roots()).not.toContain(root as HTMLElement);
  expect(handle.view.isDestroyed).toBe(true);
});

/** An aided editor with two blocks, the second block's element and id, and the reveals its
 *  transactions ask for, in order. */
async function revealing() {
  const handle = await editorIn(rootIn(HOST_ATTRIBUTE), SPEC);
  handle.setMarkdown("First block.\n\nSecond block.");
  const steps: string[] = [];
  const probe = new Plugin({
    filterTransaction: (transaction) => {
      const revealed: unknown = transaction.getMeta(REVEAL_BLOCK);
      if (typeof revealed === "string") steps.push(`reveal ${revealed}`);
      return true;
    },
  });
  const { view } = handle;
  view.updateState(view.state.reconfigure({ plugins: [...view.state.plugins, probe] }));
  const block = view.dom.querySelectorAll<HTMLElement>(`[${BLOCK_ID_ATTRIBUTE}]`)[1];
  const blockId = block?.getAttribute(BLOCK_ID_ATTRIBUTE);
  if (block === undefined || blockId == null) throw new Error("the document has no block id");
  return { block, blockId, handle, steps };
}

test("focusBlock dispatches revealBlock before upstream's focus", async () => {
  const { block, blockId, handle, steps } = await revealing();
  block.scrollIntoView = () => steps.push("focus");
  handle.focusBlock(blockId);
  expect(steps).toEqual([`reveal ${blockId}`, "focus"]);
});

test("focusMark reveals the block that holds the mark's first span", async () => {
  const { block, blockId, handle, steps } = await revealing();
  const span = block.appendChild(document.createElement("span"));
  span.dataset.id = "mark-1";
  handle.focusMark("mark-1");
  handle.focusMark("no-such-mark");
  expect(steps).toEqual([`reveal ${blockId}`]);
});

test("the aided editor keeps the live sync both ways, and its one parts root", async () => {
  const { browser, peer } = linkedDocs();
  const aided = await editorIn(rootIn(HOST_ATTRIBUTE), SPEC, browser);
  const other = await editorIn(rootIn(), undefined, peer);
  aided.setMarkdown("Typed here.");
  expect(other.view.state.doc.textContent).toBe("Typed here.");

  other.view.dispatch(
    other.view.state.tr.insertText(" And there.", other.view.state.doc.content.size - 1)
  );
  expect(aided.view.state.doc.textContent).toBe("Typed here. And there.");
  expect(partsRoots(aided)).toHaveLength(1);
  expect(partsSlot.entries()).toHaveLength(1);
});

test("change-marks the handle's block marks leave out upstream's changed-since-read mark while the change marks show, and keep the stale-decision mark", async () => {
  const handle = await inProcessEditorIn(rootIn(HOST_ATTRIBUTE), SPEC);
  handle.setMarkdown("First block.\n\nSecond block.");
  const [first = "", second = ""] = blockIdsOf(handle.view);
  const marks = specBlockMarks([first], [second]);
  handle.setBlockMarks(marks);
  /** Whether the block `blockId` draws every class of the mark whose classes are `className`. */
  const draws = (blockId: string, className: string | undefined) => {
    const block = handle.view.dom.querySelector(`[${BLOCK_ID_ATTRIBUTE}="${blockId}"]`);
    const classes = className?.split(" ") ?? [];
    return classes.length > 0 && classes.every((each) => block?.classList.contains(each));
  };
  const [stale, changed] = marks.map(({ className }) => className);
  expect(draws(second, changed)).toBe(true);

  setMarksBaseline(handle.view, against({ markdown: "First block.\n\nSecond.", tree: undefined }));
  await waitFor(() => expect(draws(second, changed)).toBe(false));
  expect(draws(first, stale)).toBe(true);

  setMarksBaseline(handle.view, undefined);
  await waitFor(() => expect(draws(second, changed)).toBe(true));
});
