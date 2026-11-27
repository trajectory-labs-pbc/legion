import { afterEach, expect, test } from "bun:test";
import type { EditorView } from "@milkdown/kit/prose/view";
import { act, cleanup, renderHook } from "@testing-library/react";

import { HOST_ATTRIBUTE } from "./aided-editor";
import { useBlocksInOrder } from "./editor-doc";
import { blockIdsOf, destroyEditors, editorIn, rootIn, SPEC } from "./editor-fixtures";

afterEach(async () => {
  cleanup();
  await destroyEditors();
});

/** Deletes the document's top-level block at `index`. */
const deleteBlock = (view: EditorView, index: number) => {
  const { doc } = view.state;
  const from = doc.resolve(0).posAtIndex(index);
  view.dispatch(view.state.tr.delete(from, from + doc.child(index).nodeSize));
};

test("editor-doc: a block with no decision, added or removed, draws nothing again; a decision's block removed does", async () => {
  const handle = await editorIn(rootIn(HOST_ATTRIBUTE), SPEC);
  handle.setMarkdown("First.\n\nSecond.");
  const { view } = handle;
  const [, decided] = blockIdsOf(view);
  if (decided === undefined) throw new Error("the document has no second block");
  const open = new Map([[decided, "the decision"]]);
  const { result } = renderHook(() => useBlocksInOrder(view, open));
  const before = result.current;
  expect(before).toEqual([decided]);

  act(() => {
    const { paragraph } = view.state.schema.nodes;
    const third = paragraph?.create(null, view.state.schema.text("Third."));
    if (third === undefined) throw new Error("the schema has no paragraph");
    view.dispatch(view.state.tr.insert(view.state.doc.content.size, third));
  });
  expect(blockIdsOf(view)).toHaveLength(3);
  expect(result.current).toBe(before);

  act(() => deleteBlock(view, 2));
  expect(blockIdsOf(view)).toHaveLength(2);
  expect(result.current).toBe(before);

  act(() => deleteBlock(view, 1));
  expect(result.current).toEqual([]);
});
