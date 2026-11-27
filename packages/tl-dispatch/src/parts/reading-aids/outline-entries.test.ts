import { afterEach, beforeAll, expect, test } from "bun:test";
import { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import * as Y from "yjs";

import { blockIdOf } from "@/upstream/editor/engine";
import { createEditor } from "@/upstream/editor/frame";
import { destroyEditors, keep, options, rootIn } from "../../../tests/reading-aids/editor-fixtures";
import { warmMarkdownRenderer } from "../../../tests/upstream";
import { type BlockCounts, blockCounts, outlineEntries, stepEntry } from "./outline-entries";

beforeAll(async () => {
  await warmMarkdownRenderer();
});

afterEach(destroyEditors);

async function docOf(markdown: string): Promise<ProseMirrorNode> {
  const handle = keep(await createEditor(rootIn(), options(new Y.Doc(), undefined)));
  handle.setMarkdown(markdown);
  return handle.view.state.doc;
}

/** The id of the block whose own text is `text`. */
function idOf(doc: ProseMirrorNode, text: string): string {
  let found: string | undefined;
  doc.descendants((node) => {
    const blockId = blockIdOf(node);
    if (node.isTextblock && node.textContent === text && blockId !== null) {
      found = blockId;
    }
    return found === undefined;
  });
  if (found === undefined) throw new Error(`no block "${text}"`);
  return found;
}

const DOCUMENT = [
  "Before any heading.",
  "# Title",
  "Under the title.",
  "## Design",
  "Under design.",
  "### Parts",
  "Under parts.",
  "#### Detail",
  "Under the detail.",
  "### Order",
  "Under order.",
  "## Later",
  "Under later.",
].join("\n\n");

const counted = (changes: number, decisions: number): BlockCounts => ({ changes, decisions });

test("the outline lists the headings to level 3 in document order, and no level-4 heading", async () => {
  const doc = await docOf(DOCUMENT);
  const entries = outlineEntries(doc, new Map());
  expect(entries.map(({ level, text }) => [level, text])).toEqual([
    [1, "Title"],
    [2, "Design"],
    [3, "Parts"],
    [3, "Order"],
    [2, "Later"],
  ]);
  expect(entries.map((entry) => entry.blockId)).toEqual(
    ["Title", "Design", "Parts", "Order", "Later"].map((text) => idOf(doc, text))
  );
});

test("an empty heading is no entry, and it still ends the range of the heading above it", async () => {
  const doc = await docOf(
    ["# Title", "## Design", "Under design.", "##", "Under nothing.", "## Later"].join("\n\n")
  );
  const counts = new Map([[idOf(doc, "Under nothing."), counted(1, 1)]]);
  const byText = outlineEntries(doc, counts).map(({ changes, decisions, text }) => [
    text,
    changes,
    decisions,
  ]);
  expect(byText).toEqual([
    ["Title", 1, 1],
    ["Design", 0, 0],
    ["Later", 0, 0],
  ]);
});

test("a heading whose id is empty is no entry, as a block with no id is in the other aids", async () => {
  const doc = await docOf(DOCUMENT);
  const json = doc.toJSON() as { content: { attrs?: Record<string, unknown> }[] };
  const design = json.content.find((block) => block.attrs?.blockId === idOf(doc, "Design"));
  if (design?.attrs === undefined) throw new Error("no Design heading");
  design.attrs.blockId = "";
  const emptied = ProseMirrorNode.fromJSON(doc.type.schema, json);
  expect(outlineEntries(emptied, new Map()).map(({ text }) => text)).toEqual([
    "Title",
    "Parts",
    "Order",
    "Later",
  ]);
});

test("an entry's counts sum its range, to the next heading of the same or a higher level", async () => {
  const doc = await docOf(DOCUMENT);
  const counts = new Map([
    [idOf(doc, "Before any heading."), counted(5, 5)],
    [idOf(doc, "Under design."), counted(1, 0)],
    [idOf(doc, "Under parts."), counted(1, 1)],
    // Under a level-4 heading, which ends no range: it stays in Parts.
    [idOf(doc, "Under the detail."), counted(2, 0)],
    [idOf(doc, "Order"), counted(1, 0)],
    [idOf(doc, "Under later."), counted(0, 1)],
  ]);
  const byText = new Map(
    outlineEntries(doc, counts).map((entry) => [entry.text, [entry.changes, entry.decisions]])
  );
  expect(Object.fromEntries(byText)).toEqual({
    Design: [5, 1],
    Later: [0, 1],
    Order: [1, 0],
    Parts: [3, 1],
    Title: [5, 2],
  });
});

test("a block's counts are its changes and one for each open decision in it", () => {
  const counts = blockCounts(
    new Map([
      ["a", 2],
      ["b", 1],
    ]),
    [{ blockId: "b" }, { blockId: "b" }, { blockId: "c" }]
  );
  expect(Object.fromEntries(counts)).toEqual({
    a: counted(2, 0),
    b: counted(1, 2),
    c: counted(0, 1),
  });
  expect(blockCounts(undefined, [])).toEqual(new Map());
});

test("a move starts at the first entry, and at either end there is no move at all", () => {
  expect(stepEntry(3, undefined, 1)).toBe(0);
  expect(stepEntry(3, undefined, -1)).toBeUndefined();
  expect(stepEntry(3, 0, 1)).toBe(1);
  expect(stepEntry(3, 1, -1)).toBe(0);
  expect(stepEntry(3, 2, 1)).toBeUndefined();
  expect(stepEntry(3, 0, -1)).toBeUndefined();
});
