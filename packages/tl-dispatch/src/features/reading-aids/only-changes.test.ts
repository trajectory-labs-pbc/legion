import { afterEach, beforeAll, expect, test } from "bun:test";
import { TextSelection } from "@milkdown/kit/prose/state";
import { waitFor } from "@testing-library/react";
import type { EditorHandle } from "@upstream-dispatch/features/doc/editor";
import { warmMarkdownRenderer } from "@upstream-dispatch/features/refs/markdown-engine";
import * as Y from "yjs";

import { HOST_ATTRIBUTE } from "./aided-editor";
import { APPROVED, CHANGED_ITEM, NEW_ITEMS, REVISED, said } from "./change-marks.fixture";
import { against, inProcessEditorIn } from "./comparer-fixtures";
import { destroyEditors, editorIn, idOf, linkedDocs, positionIn, rootIn } from "./editor-fixtures";
import { FOLD_HEAD_ATTRIBUTE } from "./fold-head";
import { revealBlock, setFoldQuery } from "./folds";
import { compareWith, drawnChanges } from "./marks-plugin";
import { FOLD_LINE_ATTRIBUTE, ONLY_CHANGES_FOLD, onlyChangesOf } from "./only-changes";
import { visitOf } from "./visit";

beforeAll(async () => {
  await warmMarkdownRenderer();
});

afterEach(destroyEditors);

/** An unchanged paragraph, distinct by `name`. */
const kept = (name: string) => `The ${name} paragraph stays exactly as it was written.`;

/** A section's changed paragraph, as the baseline and as the live document write it. */
const was = (name: string) => said(name, "today");
const now = (name: string) => said(name, "now");

let documents = 0;

/** `live` marked against `baseline` in an aided editor, its Only changes in a visit of its own. */
async function marked(baseline: string, live: string, ydoc = new Y.Doc()) {
  documents += 1;
  const documentRef = `dispatch://CORE-${documents}/spec`;
  const handle = await inProcessEditorIn(rootIn(HOST_ATTRIBUTE), documentRef, ydoc);
  handle.setMarkdown(live);
  const text = { markdown: baseline, tree: undefined };
  compareWith(handle.view, against(text));
  await waitFor(() => expect(drawnChanges(handle.view)?.baseline).toBe(text));
  const only = onlyChangesOf(handle.view);
  const visit = visitOf(`only-changes-${documents}`).onlyChanges;
  only.attach(visit);
  return { documentRef, handle, only, text, visit };
}

/** The text of each block Only changes folds, in document order. */
const folded = (handle: EditorHandle) =>
  [...handle.view.dom.querySelectorAll(`.${ONLY_CHANGES_FOLD}`)].map((element) =>
    element.textContent?.trim()
  );

/** Each fold line's words, in document order. */
const lines = (handle: EditorHandle) =>
  [...handle.view.dom.querySelectorAll(`[${FOLD_LINE_ATTRIBUTE}] button`)].map(
    (button) => button.textContent
  );

const RUNS = (changed: boolean) =>
  [
    "## Runs",
    changed ? now("first") : was("first"),
    kept("a1"),
    kept("a2"),
    changed ? now("second") : was("second"),
    kept("b1"),
    kept("b2"),
    kept("b3"),
    changed ? now("third") : was("third"),
    kept("c1"),
    kept("c2"),
    kept("c3"),
    "## Quiet",
    kept("q1"),
    kept("q2"),
  ].join("\n\n");

test("only-changes: a run of two stays open, a run of three between two changes folds one block", async () => {
  const { handle, only } = await marked(RUNS(false), RUNS(true));
  only.toggle(undefined);
  const shown = folded(handle);
  expect(shown).not.toContain(kept("a1"));
  expect(shown).not.toContain(kept("a2"));
  expect(shown.filter((text) => text?.startsWith("The b"))).toEqual([kept("b2")]);
});

test("only-changes: a run of two at the end of a changed section stays open", async () => {
  const doc = (changed: boolean) =>
    ["## Two", changed ? now("x") : was("x"), kept("x1"), kept("x2")].join("\n\n");
  const { handle, only } = await marked(doc(false), doc(true));
  only.toggle(undefined);
  expect(folded(handle)).toEqual([]);
  expect(lines(handle)).toEqual([]);
});

test("only-changes: a run at the end of a section keeps one block after the change and none at the end", async () => {
  const { handle, only } = await marked(RUNS(false), RUNS(true));
  only.toggle(undefined);
  expect(folded(handle).filter((text) => text?.startsWith("The c"))).toEqual([
    kept("c2"),
    kept("c3"),
  ]);
});

test("only-changes: a section with no change folds to its heading alone, with no line under it", async () => {
  const { handle, only } = await marked(RUNS(false), RUNS(true));
  only.toggle(undefined);
  expect(folded(handle)).toEqual([kept("b2"), kept("c2"), kept("c3"), kept("q1"), kept("q2")]);
  expect(lines(handle)).toEqual(["1 unchanged block", "2 unchanged blocks"]);
  expect(handle.view.dom.textContent).toContain("Quiet");
});

test("only-changes: a run at the start of a section keeps one block before the change only", async () => {
  const doc = (changed: boolean) =>
    ["## Start", kept("s1"), kept("s2"), kept("s3"), changed ? now("end") : was("end")].join(
      "\n\n"
    );
  const { handle, only } = await marked(doc(false), doc(true));
  only.toggle(undefined);
  expect(folded(handle)).toEqual([kept("s1"), kept("s2")]);
});

test("only-changes: the text before the first heading, with no change, folds to one line", async () => {
  const doc = (changed: boolean) =>
    [kept("p1"), kept("p2"), "## Changed", changed ? now("body") : was("body")].join("\n\n");
  const { handle, only } = await marked(doc(false), doc(true));
  only.toggle(undefined);
  expect(folded(handle)).toEqual([kept("p1"), kept("p2")]);
  expect(lines(handle)).toEqual(["2 unchanged blocks"]);
});

test("only-changes: a removed block is a change, and a changed heading keeps the block below it", async () => {
  const before = [
    "## Old title",
    kept("h1"),
    kept("h2"),
    kept("h3"),
    "## Gone",
    kept("g1"),
    kept("g2"),
    kept("g3"),
    kept("lost"),
  ].join("\n\n");
  const after = [
    "## New title",
    kept("h1"),
    kept("h2"),
    kept("h3"),
    "## Gone",
    kept("g1"),
    kept("g2"),
    kept("g3"),
  ].join("\n\n");
  const { handle, only } = await marked(before, after);
  only.toggle(undefined);
  expect(folded(handle)).toEqual([kept("h2"), kept("h3"), kept("g1"), kept("g2")]);
});

test("only-changes: on the approval's plan, the changed list folds its unchanged items and the quiet sections fold", async () => {
  const { handle, only } = await marked(APPROVED, REVISED);
  only.toggle(undefined);
  const items = folded(handle).filter((text) => text?.startsWith("i"));
  expect(items.map((text) => text?.slice(0, 7))).toEqual(["i0w0000", "i1w0000", "i5w0000"]);
  expect(folded(handle)).toContain(said("testing", "unchanged"));
  expect(folded(handle)).toContain(said("later", "unchanged"));
  expect(folded(handle)).not.toContain(CHANGED_ITEM);
  for (const item of NEW_ITEMS) expect(folded(handle)).not.toContain(item);
  expect(lines(handle)).toEqual(["2 unchanged items", "1 unchanged item"]);
  const list = handle.view.dom.querySelector(`[${FOLD_LINE_ATTRIBUTE}]`);
  expect(list?.tagName).toBe("LI");
});

test("only-changes: a second press shows everything again", async () => {
  const { handle, only } = await marked(RUNS(false), RUNS(true));
  only.toggle(undefined);
  expect(only.isOn()).toBe(true);
  only.toggle(undefined);
  expect(only.isOn()).toBe(false);
  expect(folded(handle)).toEqual([]);
  expect(lines(handle)).toEqual([]);
});

test("only-changes: a fold line's button opens its part, and only that part", async () => {
  const { handle, only } = await marked(RUNS(false), RUNS(true));
  only.toggle(undefined);
  const [, end] = handle.view.dom.querySelectorAll<HTMLButtonElement>(
    `[${FOLD_LINE_ATTRIBUTE}] button`
  );
  end?.click();
  expect(folded(handle)).toEqual([kept("b2"), kept("q1"), kept("q2")]);
});

test("only-changes: a fold line's button gives the focus to the host as its part opens", async () => {
  const { handle, only } = await marked(RUNS(false), RUNS(true));
  only.toggle(undefined);
  const [, end] = handle.view.dom.querySelectorAll<HTMLButtonElement>(
    `[${FOLD_LINE_ATTRIBUTE}] button`
  );
  end?.focus();
  end?.click();
  expect(document.activeElement).toBe(handle.view.dom.closest(`[${HOST_ATTRIBUTE}]`));
});

test("only-changes: a fold line counts its blocks up to 99, in figures of one width", async () => {
  const quiet = Array.from({ length: 101 }, (_, index) => kept(`p${index}`));
  const doc = (changed: boolean) =>
    [...quiet, "## Changed", changed ? now("body") : was("body")].join("\n\n");
  const { handle, only } = await marked(doc(false), doc(true));
  only.toggle(undefined);
  expect(lines(handle)).toEqual(["99+ unchanged blocks"]);
  const button = handle.view.dom.querySelector(`[${FOLD_LINE_ATTRIBUTE}] button`);
  expect(button?.classList.contains("tabular-nums")).toBe(true);
});

test("only-changes: a peer's block inside a folded part leaves the part one line with its count", async () => {
  const { browser, peer } = linkedDocs();
  const other = await editorIn(rootIn(), undefined, peer);
  const { handle, only } = await marked(RUNS(false), RUNS(true), browser);
  only.toggle(undefined);
  const { schema } = other.view.state;
  other.view.dispatch(
    other.view.state.tr.insert(
      positionIn(other, kept("c3")) - 1,
      schema.nodes.paragraph.create(null, schema.text(kept("peer")))
    )
  );
  await waitFor(() => expect(handle.view.state.doc.textContent).toContain(kept("peer")));
  expect(lines(handle)).toEqual(["1 unchanged block", "2 unchanged blocks"]);
});

test("only-changes: a #b- link into a part opens the whole part", async () => {
  const { handle, only } = await marked(RUNS(false), RUNS(true));
  only.toggle(undefined);
  revealBlock(handle.view, idOf(handle, kept("q2")));
  await waitFor(() => expect(folded(handle)).toEqual([kept("b2"), kept("c2"), kept("c3")]));
});

test("only-changes: the caret opens the part it enters", async () => {
  const { handle, only } = await marked(RUNS(false), RUNS(true));
  only.toggle(undefined);
  const { view } = handle;
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, positionIn(handle, kept("c3"))))
  );
  await waitFor(() => expect(folded(handle)).toEqual([kept("b2"), kept("q1"), kept("q2")]));
});

test("only-changes: the part that holds the ?q= at the press stays open, and a changed ?q= opens its part", async () => {
  const { handle, only } = await marked(RUNS(false), RUNS(true));
  only.toggle("q1 paragraph");
  expect(folded(handle)).toEqual([kept("b2"), kept("c2"), kept("c3")]);
  setFoldQuery(handle.view, "b2 paragraph");
  await waitFor(() => expect(folded(handle)).toEqual([kept("c2"), kept("c3")]));
});

test("only-changes: a later edit neither folds nor opens a part, a peer's inside one included", async () => {
  const { browser, peer } = linkedDocs();
  const other = await editorIn(rootIn(), undefined, peer);
  const { handle, only } = await marked(RUNS(false), RUNS(true), browser);
  only.toggle(undefined);
  const before = folded(handle);
  const end = other.view.state.doc.content.size - 1;
  other.view.dispatch(other.view.state.tr.insertText(" More.", end));
  await waitFor(() => expect(handle.view.state.doc.textContent).toEndWith("written. More."));
  expect(folded(handle)).toEqual([...before.slice(0, -1), `${kept("q2")} More.`]);
  const { schema } = handle.view.state;
  const at = handle.view.state.doc.content.size;
  handle.view.dispatch(
    handle.view.state.tr.insert(at, schema.nodes.paragraph.create(null, schema.text(kept("x"))))
  );
  expect(folded(handle)).not.toContain(kept("x"));
});

test("only-changes: a new editor of the document starts with the choice and its folds for the visit", async () => {
  const ydoc = new Y.Doc();
  const { documentRef, handle, only } = await marked(RUNS(false), RUNS(true), ydoc);
  only.toggle(undefined);
  const shown = folded(handle);
  const shownLines = lines(handle);
  const again = await inProcessEditorIn(rootIn(HOST_ATTRIBUTE), documentRef, ydoc);
  // Its first state, before its parts attach the visit: no frame shows the whole document.
  expect(onlyChangesOf(again.view).isOn()).toBe(true);
  expect(folded(again)).toEqual(shown);
  expect(lines(again)).toEqual(shownLines);
});

test("only-changes: a new baseline makes the folds again, and the old ones go", async () => {
  const { handle, only } = await marked(RUNS(false), RUNS(true));
  only.toggle(undefined);
  revealBlock(handle.view, idOf(handle, kept("q1")));
  await waitFor(() => expect(folded(handle)).not.toContain(kept("q1")));
  const live = RUNS(true);
  const next = { markdown: live, tree: undefined };
  compareWith(handle.view, against(next));
  await waitFor(() => expect(drawnChanges(handle.view)?.baseline).toBe(next));
  only.follow(undefined);
  expect(only.isOn()).toBe(true);
  // Against itself, the document holds no change: every section folds to its heading.
  expect(folded(handle)).toContain(kept("q1"));
  expect(folded(handle)).toContain(kept("a1"));
});

test("only-changes: a requirement's head folds with the part that holds the requirement", async () => {
  const doc = (changed: boolean) =>
    [
      "## Changed",
      changed ? now("body") : was("body"),
      "## Quiet",
      ":::requirement{#r1}",
      "**R1.** A requirement no change touched.",
      ":::",
    ].join("\n\n");
  const { handle, only } = await marked(doc(false), doc(true));
  only.toggle(undefined);
  const head = handle.view.dom.querySelector(`[${FOLD_HEAD_ATTRIBUTE}="r1"]`);
  expect(head?.nextElementSibling?.classList.contains(ONLY_CHANGES_FOLD)).toBe(true);
});
