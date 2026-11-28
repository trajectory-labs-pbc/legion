import { afterEach, beforeAll, expect, test } from "bun:test";
import { NodeSelection, TextSelection } from "@milkdown/kit/prose/state";
import { QueryClient } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react";
import type { EditorHandle } from "@upstream-dispatch/features/doc/editor";
import { warmMarkdownRenderer } from "@upstream-dispatch/features/refs/markdown-engine";
import { writesOf } from "@upstream-dispatch/features/writes/write-store";
import * as Y from "yjs";

import { HOST_ATTRIBUTE } from "./aided-editor";
import { blockFoldsOf } from "./block-folds";
import { against, inProcessEditorIn } from "./comparer-fixtures";
import {
  destroyEditors,
  editorIn,
  foldedIdsOf,
  linkedDocs,
  newDocumentRef,
  positionIn,
  positionOf,
  rootIn,
} from "./editor-fixtures";
import { FOLD_HEAD_ATTRIBUTE } from "./fold-head";
import { redrawFolds, revealBlock, setFoldQuery } from "./folds";
import { CHANGE_ATTRIBUTE } from "./mark-drawing";
import { compareWith } from "./marks-plugin";
import { recordReadMarks, visitOf } from "./visit";

beforeAll(async () => {
  await warmMarkdownRenderer();
});

afterEach(destroyEditors);

const SPEC = [
  "# Spec",
  "",
  ":::requirement{#r1}",
  "**R1.** The first requirement.",
  "",
  "Its second paragraph.",
  ":::",
  "",
  "Between the blocks.",
  "",
  ':::check{#c1 run="bun test probe"}',
  "The check, which names a needle.",
  ":::",
  "",
  ":::plan_task{#t1}",
  "**T1.** The task.",
  ":::",
  "",
  "A closing paragraph.",
  "",
].join("\n");

/** An aided editor of a document of its own, unless `documentRef` names one. */
async function editor(ydoc = new Y.Doc(), documentRef = newDocumentRef()): Promise<EditorHandle> {
  return editorIn(rootIn(HOST_ATTRIBUTE), documentRef, ydoc);
}

const folded = (handle: EditorHandle) => foldedIdsOf(handle.view);

const expanded = (handle: EditorHandle, blockId: string) =>
  handle.view.dom
    .querySelector(`[${FOLD_HEAD_ATTRIBUTE}="${blockId}"] button`)
    ?.getAttribute("aria-expanded");

test("each requirement, check and plan task folds to its head line, and nothing else folds", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
  for (const id of ["r1", "c1", "t1"]) expect(expanded(handle, id)).toBe("false");
  const head = handle.view.dom.querySelector(`[${FOLD_HEAD_ATTRIBUTE}="r1"]`);
  expect(head?.textContent).toContain("Requirement");
  expect(head?.textContent).toContain("R1. The first requirement.");
  expect(head?.hasAttribute("data-block-id")).toBe(false);
  expect(head?.nextElementSibling?.getAttribute("data-block-id")).toBe("r1");
  expect(handle.view.state.doc.textContent).toContain("Its second paragraph.");
});

test("a click on a head opens its block and a second click folds it, through the same button", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const button = handle.view.dom.querySelector<HTMLButtonElement>(
    `[${FOLD_HEAD_ATTRIBUTE}="r1"] button`
  );
  button?.click();
  expect(folded(handle)).toEqual(["c1", "t1"]);
  expect(expanded(handle, "r1")).toBe("true");
  const same = handle.view.dom.querySelector(`[${FOLD_HEAD_ATTRIBUTE}="r1"] button`);
  expect(same).toBe(button);
  button?.click();
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
  expect(expanded(handle, "r1")).toBe("false");
});

test("a move to a block inside a fold opens the fold, and it stays open", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const paragraph = handle.view.dom.querySelector('[data-block-id="r1"] p:nth-of-type(2)');
  const id = paragraph?.getAttribute("data-block-id");
  if (id == null) throw new Error("the paragraph has no block id");
  revealBlock(handle.view, id);
  expect(folded(handle)).toEqual(["c1", "t1"]);
  expect(expanded(handle, "r1")).toBe("true");
  handle.view.dispatch(
    handle.view.state.tr.insertText("x", positionIn(handle, "A closing paragraph."))
  );
  expect(folded(handle)).toEqual(["c1", "t1"]);
});

test("the caret opens the fold it enters, and the fold stays open when it leaves", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const { view } = handle;
  const into = (text: string) =>
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, positionIn(handle, text)))
    );
  into("A closing paragraph.");
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
  into("The check, which names a needle.");
  expect(folded(handle)).toEqual(["r1", "t1"]);
  into("A closing paragraph.");
  expect(folded(handle)).toEqual(["r1", "t1"]);
  view.dispatch(view.state.tr.insertText("x", positionIn(handle, "A closing paragraph.")));
  expect(folded(handle)).toEqual(["r1", "t1"]);
});

test("the page's ?q= term opens each fold it matches in, at the open and after a change", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  setFoldQuery(handle.view, "NEEDLE");
  expect(folded(handle)).toEqual(["r1", "t1"]);
  setFoldQuery(handle.view, "second paragraph");
  expect(folded(handle)).toEqual(["t1"]);
  setFoldQuery(handle.view, "absent");
  expect(folded(handle)).toEqual(["t1"]);
});

test("the page's ?q= opens a fold whose only match is an attribute its header draws", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  setFoldQuery(handle.view, "PROBE");
  expect(folded(handle)).toEqual(["r1", "t1"]);
});

test("a remote edit above a block and inside a folded one leaves each fold as it was", async () => {
  const { browser, peer } = linkedDocs();
  const mine = await editor(browser);
  mine.setMarkdown(SPEC);
  const other = await editor(peer);
  blockFoldsOf(mine.view).toggle("c1");
  expect(folded(mine)).toEqual(["r1", "t1"]);

  const { view } = other;
  view.dispatch(
    view.state.tr.insertText("Above. ", positionIn(other, "R1. The first requirement."))
  );
  view.dispatch(view.state.tr.insertText("More. ", positionIn(other, "Its second paragraph.")));
  view.dispatch(
    view.state.tr.insertText("Edited. ", positionIn(other, "The check, which names a needle."))
  );
  expect(mine.view.state.doc.textContent).toContain("Edited. The check");
  expect(folded(mine)).toEqual(["r1", "t1"]);
  expect(expanded(mine, "c1")).toBe("true");
});

test("a remote edit that maps the caret inside a block the reader folded keeps it folded until the reader types there", async () => {
  const { browser, peer } = linkedDocs();
  const mine = await editor(browser);
  mine.setMarkdown(SPEC);
  const other = await editor(peer);
  const at = positionIn(mine, "The check, which names a needle.");
  mine.view.dispatch(
    mine.view.state.tr.setSelection(TextSelection.create(mine.view.state.doc, at + 4))
  );
  blockFoldsOf(mine.view).toggle("c1");
  expect(folded(mine)).toEqual(["r1", "c1", "t1"]);

  const { view } = other;
  view.dispatch(
    view.state.tr.insertText("Edited. ", positionIn(other, "The check, which names a needle."))
  );
  expect(mine.view.state.doc.textContent).toContain("Edited. The check");
  expect(folded(mine)).toEqual(["r1", "c1", "t1"]);

  // A change kept out of the undo history does not open it; the reader typing there does.
  const caret = mine.view.state.selection.head;
  mine.view.dispatch(
    mine.view.state.tr.setMeta("addToHistory", false).insertText("Stamped. ", caret)
  );
  expect(folded(mine)).toEqual(["r1", "c1", "t1"]);
  mine.view.dispatch(mine.view.state.tr.insertText("Typed. ", mine.view.state.selection.head));
  expect(folded(mine)).toEqual(["r1", "t1"]);
});

test("a load of the whole document that leaves the caret in its last block keeps that block folded, also for a new editor", async () => {
  const endsInTask = SPEC.replace("A closing paragraph.\n", "");
  const first = await editor(new Y.Doc(), "dispatch://FOLDS-0/ends-in-task");
  first.setMarkdown(endsInTask);
  blockFoldsOf(first.view).attach({ choices: new Map() });
  expect(first.view.state.selection.$head.parent.textContent).toBe("T1. The task.");
  expect(folded(first)).toEqual(["r1", "c1", "t1"]);
  await first.destroy();

  const second = await editor(new Y.Doc(), "dispatch://FOLDS-0/ends-in-task");
  second.setMarkdown(SPEC);
  expect(folded(second)).toEqual(["r1", "c1", "t1"]);
});

test("the last block, made a requirement in one step with the caret in it, opens", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const { view } = handle;
  const at = positionIn(handle, "A closing paragraph.");
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at + 3)));
  const paragraph = view.state.doc.nodeAt(at - 1);
  const requirement = view.state.schema.nodes.requirement?.createAndFill(
    { blockId: "r2" },
    paragraph
  );
  if (paragraph === null || requirement == null) throw new Error("no requirement to make");
  view.dispatch(view.state.tr.replaceWith(at - 1, at - 1 + paragraph.nodeSize, requirement));
  expect(view.state.selection.$head.parent.textContent).toBe("A closing paragraph.");
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
});

test("z opens every fold while one is folded, then folds each block no change touched", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const folds = blockFoldsOf(handle.view);
  folds.setTouched(new Set(["c1"]));
  expect(folded(handle)).toEqual(["r1", "t1"]);
  folds.toggleAll();
  expect(folded(handle)).toEqual([]);
  folds.toggleAll();
  expect(folded(handle)).toEqual(["r1", "t1"]);
  expect(folds.hasBlocks()).toBe(true);
});

test("the visit keeps each fold for a new editor of the same document, from its first frame", async () => {
  const visit = { choices: new Map<string, boolean>() };
  const first = await editor(new Y.Doc(), "dispatch://FOLDS-0/spec");
  first.setMarkdown(SPEC);
  blockFoldsOf(first.view).attach(visit);
  blockFoldsOf(first.view).toggle("t1");
  await first.destroy();

  const second = await editor(new Y.Doc(), "dispatch://FOLDS-0/spec");
  second.setMarkdown(SPEC);
  expect(folded(second)).toEqual(["r1", "c1"]);
  blockFoldsOf(second.view).attach(visit);
  expect(folded(second)).toEqual(["r1", "c1"]);

  const other = await editor();
  other.setMarkdown(SPEC);
  blockFoldsOf(other.view).attach({ choices: new Map() });
  expect(folded(other)).toEqual(["r1", "c1", "t1"]);
});

test("a sign-out ends the reader's fold choices in a live editor, and a new editor keeps none of them", async () => {
  const documentRef = newDocumentRef();
  const first = await editor(new Y.Doc(), documentRef);
  first.setMarkdown(SPEC);
  blockFoldsOf(first.view).attach({ choices: new Map() });
  blockFoldsOf(first.view).toggle("t1");
  expect(folded(first)).toEqual(["r1", "c1"]);
  const queryClient = new QueryClient();
  const stop = recordReadMarks(queryClient);
  try {
    writesOf(queryClient).signedOut("ada");
    expect(folded(first)).toEqual(["r1", "c1", "t1"]);
    const second = await editor(new Y.Doc(), documentRef);
    second.setMarkdown(SPEC);
    expect(folded(second)).toEqual(["r1", "c1", "t1"]);
  } finally {
    stop();
  }
});

/** Whether the caret, or the block a node selection holds, is inside a folded block. */
function caretInFold(handle: EditorHandle): boolean {
  const { selection } = handle.view.state;
  const { $head } = selection;
  const reached = Array.from({ length: $head.depth }, (_, depth) => $head.node(depth + 1));
  if (selection instanceof NodeSelection) reached.push(selection.node);
  const ids = new Set(folded(handle));
  return reached.some((node) => ids.has(node.attrs.blockId as string));
}

const key = (handle: EditorHandle, name: string) =>
  handle.view.someProp("handleKeyDown", (handler) =>
    handler(handle.view, new KeyboardEvent("keydown", { key: name }))
  );

/** Puts the caret at `offset` in the paragraph that reads `text`. */
function caretAt(handle: EditorHandle, text: string, offset = 0): void {
  const { view } = handle;
  const at = positionIn(handle, text) + offset;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
}

test("Backspace in an empty paragraph after a folded plan task leaves no caret in a fold", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const { view } = handle;
  const after = positionIn(handle, "A closing paragraph.") - 1;
  view.dispatch(view.state.tr.insert(after, view.state.schema.nodes.paragraph.create()));
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, after + 1)));
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
  key(handle, "Backspace");
  expect(caretInFold(handle)).toBe(false);
  expect(folded(handle)).toEqual(["r1", "c1"]);
});

test("Delete at the end of the paragraph before a folded check leaves no caret in a fold", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  caretAt(handle, "Between the blocks.", "Between the blocks.".length);
  key(handle, "Delete");
  expect(caretInFold(handle)).toBe(false);
});

test("a node selection of a folded block opens it", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const { view } = handle;
  const at = positionOf(view, "c1");
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, at)));
  expect(folded(handle)).toEqual(["r1", "t1"]);
});

test("a paste with the caret in a block the reader folded opens it", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  caretAt(handle, "The check, which names a needle.", 4);
  blockFoldsOf(handle.view).toggle("c1");
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
  handle.view.pasteText("Pasted. ");
  expect(handle.view.state.doc.textContent).toContain("Pasted.");
  expect(folded(handle)).toEqual(["r1", "t1"]);
});

test("the focus coming back to the text opens the fold the caret is in, and a focus inside a fold opens it", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const { view } = handle;
  caretAt(handle, "The check, which names a needle.", 4);
  blockFoldsOf(view).toggle("c1");
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
  view.dom.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  expect(folded(handle)).toEqual(["r1", "t1"]);

  const inside = view.dom.querySelector('[data-block-id="t1"] p');
  inside?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  expect(folded(handle)).toEqual(["r1"]);
});

test("a folded block is hidden from the accessibility tree, and an open one is not", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const block = (id: string) => handle.view.dom.querySelector(`[data-block-id="${id}"]`);
  expect(block("r1")?.getAttribute("aria-hidden")).toBe("true");
  blockFoldsOf(handle.view).toggle("r1");
  expect(block("r1")?.hasAttribute("aria-hidden")).toBe(false);
});

test("an edit of a folded block keeps its head's button and writes the head's new start", async () => {
  const { browser, peer } = linkedDocs();
  const mine = await editor(browser);
  mine.setMarkdown(SPEC);
  const other = await editor(peer);
  const button = mine.view.dom.querySelector(`[${FOLD_HEAD_ATTRIBUTE}="c1"] button`);
  const { view } = other;
  view.dispatch(
    view.state.tr.insertText("Edited. ", positionIn(other, "The check, which names a needle."))
  );
  const now = mine.view.dom.querySelector(`[${FOLD_HEAD_ATTRIBUTE}="c1"] button`);
  expect(now).toBe(button);
  expect(now?.textContent).toContain("Edited. The check");
  expect(folded(mine)).toEqual(["r1", "c1", "t1"]);
});

test("the page's ?q= opens each fold once for each new term of the visit", async () => {
  const visit = { choices: new Map<string, boolean>() };
  const first = await editor();
  first.setMarkdown(SPEC);
  blockFoldsOf(first.view).attach(visit);
  blockFoldsOf(first.view).query("needle");
  expect(folded(first)).toEqual(["r1", "t1"]);
  blockFoldsOf(first.view).toggle("c1");
  await first.destroy();

  const second = await editor();
  second.setMarkdown(SPEC);
  blockFoldsOf(second.view).attach(visit);
  blockFoldsOf(second.view).query("needle");
  expect(folded(second)).toEqual(["r1", "c1", "t1"]);
  blockFoldsOf(second.view).query(undefined);
  blockFoldsOf(second.view).query("needle");
  expect(folded(second)).toEqual(["r1", "t1"]);
});

test("a click into the text after its fold reads no caret before the click sets one", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const { view } = handle;
  caretAt(handle, "Its second paragraph.", 2);
  blockFoldsOf(view).toggle("r1");
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
  view.dom.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
  view.dom.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  view.dom.dispatchEvent(new Event("pointerup", { bubbles: true }));
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
});

test("a local edit elsewhere, or a mark's removal, leaves the fold the caret sits in folded", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const { view } = handle;
  caretAt(handle, "Its second paragraph.", 2);
  blockFoldsOf(view).toggle("r1");
  const closing = positionIn(handle, "A closing paragraph.");
  view.dispatch(view.state.tr.insertText("x", closing));
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
  const inside = positionIn(handle, "Its second paragraph.");
  const strong = view.state.schema.marks.strong;
  if (strong === undefined) throw new Error("no strong mark");
  view.dispatch(view.state.tr.addMark(inside, inside + 3, strong.create()));
  view.dispatch(view.state.tr.removeMark(inside, inside + 3, strong));
  expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
});

test("a fold the caret opens stays open when a transaction with no change follows it in one update", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const { view } = handle;
  const moved = view.state.apply(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, positionIn(handle, "The check, which names a needle."))
    )
  );
  view.updateState(moved.apply(moved.tr.setMeta("unrelated", true)));
  expect(folded(handle)).toEqual(["r1", "t1"]);
  redrawFolds(view);
  expect(folded(handle)).toEqual(["r1", "t1"]);
});

test("a press that is cancelled, or released outside the editor, lets the next focus open the caret's fold", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const { view } = handle;
  caretAt(handle, "The check, which names a needle.", 4);
  for (const release of [
    () => document.dispatchEvent(new Event("pointercancel", { bubbles: true })),
    () => document.body.dispatchEvent(new Event("pointerup", { bubbles: true })),
  ]) {
    blockFoldsOf(view).toggle("c1");
    expect(folded(handle)).toEqual(["r1", "c1", "t1"]);
    view.dom.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
    release();
    view.dom.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(folded(handle)).toEqual(["r1", "t1"]);
  }
  // A press of another button, whose context menu may take the release, is no press.
  blockFoldsOf(view).toggle("c1");
  view.dom.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 2 }));
  view.dom.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  expect(folded(handle)).toEqual(["r1", "t1"]);
});

test("a fold the caret opens stays open when a doc change elsewhere follows it in one update", async () => {
  const handle = await editor();
  handle.setMarkdown(SPEC);
  const { view } = handle;
  const moved = view.state.apply(
    view.state.tr.setSelection(
      TextSelection.create(view.state.doc, positionIn(handle, "The check, which names a needle."))
    )
  );
  view.updateState(
    moved.apply(moved.tr.insertText("x", positionIn(handle, "A closing paragraph.")))
  );
  expect(folded(handle)).toEqual(["r1", "t1"]);
  redrawFolds(view);
  expect(folded(handle)).toEqual(["r1", "t1"]);
});

const CHECK = "The check, which names a needle.";
/** The spec with its requirement changed since `SPEC`, the baseline. */
const REVISED = SPEC.replace("Its second paragraph.", "Its second paragraph, revised since then.");

/** An aided editor of `live`, its folds in the visit `visitId`, its marks compared with `SPEC`. */
async function compared(visitId: string, live: string): Promise<EditorHandle> {
  const handle = await inProcessEditorIn(rootIn(HOST_ATTRIBUTE), newDocumentRef());
  blockFoldsOf(handle.view).attach(visitOf(visitId).blockFolds);
  handle.setMarkdown(live);
  compareWith(handle.view, against({ markdown: SPEC, tree: undefined }));
  return handle;
}

/** Whether the marks draw the block `blockId` as changed. */
const markedChanged = (handle: EditorHandle, blockId: string) =>
  handle.view.dom.querySelector(`[${CHANGE_ATTRIBUTE}][data-block-id="${blockId}"]`) !== null;

test("a block the first comparison touched starts open, a later change neither folds nor opens one, and z folds none of the touched", async () => {
  const handle = await compared(newDocumentRef(), REVISED);
  const { view } = handle;
  await waitFor(() => expect(folded(handle)).toEqual(["c1", "t1"]));
  expect(expanded(handle, "r1")).toBe("true");

  view.dispatch(view.state.tr.insertText("Later. ", positionIn(handle, CHECK)));
  await waitFor(() => expect(markedChanged(handle, "c1")).toBe(true));
  expect(folded(handle)).toEqual(["c1", "t1"]);

  const folds = blockFoldsOf(view);
  folds.toggleAll();
  expect(folded(handle)).toEqual([]);
  folds.toggleAll();
  expect(folded(handle)).toEqual(["c1", "t1"]);
});

test("a new editor in the visit keeps the blocks the visit's first comparison touched", async () => {
  const visitId = newDocumentRef();
  const first = await compared(visitId, REVISED);
  await waitFor(() => expect(folded(first)).toEqual(["c1", "t1"]));

  const second = await compared(visitId, REVISED.replace(CHECK, "The check, edited since then."));
  await waitFor(() => expect(markedChanged(second, "c1")).toBe(true));
  expect(folded(second)).toEqual(["c1", "t1"]);
});

test("a block whose kind changed while the first comparison ran starts open", async () => {
  const handle = await compared(newDocumentRef(), SPEC);
  const { view } = handle;
  const { requirement } = view.state.schema.nodes;
  if (requirement === undefined) throw new Error("the schema has no requirement");
  view.dispatch(
    view.state.tr.setNodeMarkup(positionOf(view, "c1"), requirement, { blockId: "c1" })
  );
  await waitFor(() => expect(markedChanged(handle, "c1")).toBe(true));
  await waitFor(() => expect(folded(handle)).toEqual(["r1", "t1"]));
});
