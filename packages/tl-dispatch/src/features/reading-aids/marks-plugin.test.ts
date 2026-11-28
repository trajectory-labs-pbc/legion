import { afterEach, beforeAll, expect, test } from "bun:test";
import { blockIdOf } from "@legion/proof-editor/headless";
import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { waitFor, within } from "@testing-library/react";
import { quietConsoleError } from "@upstream-dispatch/__tests__/act-warnings";
import { BLOCK_ID_ATTRIBUTE } from "@upstream-dispatch/features/doc/block-id";
import type { ChangeBaseline } from "@upstream-dispatch/features/doc/change-marks";
import type { EditorHandle } from "@upstream-dispatch/features/doc/editor";
import { specBlockMarks } from "@upstream-dispatch/features/doc/spec-marks";
import { warmMarkdownRenderer } from "@upstream-dispatch/features/refs/markdown-engine";
import {
  APPROVED,
  CHANGED_ITEM,
  CHANGED_SECTIONS,
  foldOf,
  NEW_ITEMS,
  REVISED,
  said,
} from "./change-marks.fixture";

import { countsText } from "./change-summary";
import { against, inProcess } from "./comparer-fixtures";
import { blockIdsOf, destroyEditors, editorIn, linkedDocs, rootIn } from "./editor-fixtures";
import { CHANGE_ATTRIBUTE } from "./mark-drawing";
import {
  besideChangeMarks,
  changeMarksPlugin,
  compareWith,
  comparisonFailure,
  drawnChanges,
  retryComparison,
  watchChanges,
} from "./marks-plugin";
import { MARKS_MEASURE } from "./timing";

beforeAll(async () => {
  await warmMarkdownRenderer();
});

afterEach(destroyEditors);

const BASELINE = [
  "# Intro",
  "Kept paragraph that stays the same.",
  "## Design",
  "The design keeps most of its words today.",
  "## Rollout",
  "A paragraph that will be removed entirely.",
  "## Later",
  "Unchanged later text.",
].join("\n\n");

const LIVE = [
  "# Intro",
  "Kept paragraph that stays the same.",
  "## Design",
  "The design keeps most of its words now.",
  "## Rollout",
  "## Later",
  "Unchanged later text.",
  "A brand new closing paragraph appears here.",
].join("\n\n");

/** The counts drawn against `baseline`, once its comparison has drawn them. */
function summaryOf(view: EditorView, baseline: ChangeBaseline) {
  const drawn = drawnChanges(view);
  return drawn?.baseline === baseline ? drawn.summary : undefined;
}

/** `live` marked against `baseline`, with a peer whose edits reach it as whole-document steps. */
async function marked(baseline = BASELINE, live = LIVE) {
  const { browser, peer } = linkedDocs();
  const handle = await editorIn(rootIn(), undefined, browser);
  const other = await editorIn(rootIn(), undefined, peer);
  handle.setMarkdown(live);
  const { view } = handle;
  const started: ReturnType<typeof inProcess>[] = [];
  const start = () => {
    const each = inProcess();
    started.push(each);
    return each.comparer;
  };
  view.updateState(
    view.state.reconfigure({ plugins: [...view.state.plugins, changeMarksPlugin(start)] })
  );
  const text = { markdown: baseline, tree: undefined };
  compareWith(view, against(text));
  await waitFor(() => expect(summaryOf(view, text)).toBeDefined());
  const [worker] = started;
  if (worker === undefined) throw new Error("no comparer started");
  const summary = () => summaryOf(view, text);
  const counts = () => {
    const shown = summary();
    return shown === undefined ? undefined : countsText(shown);
  };
  return { browser, counts, handle, other, started, summary, text, view, worker };
}

/** Each label the gutter shows, with the text of its block, or the earlier text of a fold. */
function labels(view: EditorView): string[] {
  const texts = new Map<string, string>();
  view.state.doc.descendants((node) => {
    const id = blockIdOf(node);
    if (id !== null) texts.set(id, node.textContent);
  });
  return [...view.dom.querySelectorAll(`[${CHANGE_ATTRIBUTE}]`)].map((element) => {
    const id = element.getAttribute(BLOCK_ID_ATTRIBUTE);
    const text = element.matches(".reading-aids-change-fold")
      ? element.querySelector(".reading-aids-earlier")?.textContent
      : id === null
        ? element.textContent
        : texts.get(id);
    return `${element.getAttribute(CHANGE_ATTRIBUTE)}: ${text}`;
  });
}

const words = (view: EditorView, selector: "ins" | "del") =>
  [...view.dom.querySelectorAll(selector)].map((element) => element.textContent);

/** The position just inside the end of the block whose text is `text`. */
function endOf(handle: EditorHandle, text: string): number {
  let found: number | undefined;
  handle.view.state.doc.forEach((node, offset) => {
    if (node.textContent === text) found = offset + node.nodeSize - 1;
  });
  if (found === undefined) throw new Error(`no block reads "${text}"`);
  return found;
}

const idOf = (handle: EditorHandle, text: string) =>
  blockIdOf(handle.view.state.doc.resolve(endOf(handle, text)).parent);

test("change-marks each block shows its label, the added words underlined and the removed struck, and the counts", async () => {
  const { counts, view } = await marked();
  expect(labels(view)).toEqual([
    "Changed: The design keeps most of its words now.",
    "Removed: A paragraph that will be removed entirely.",
    "New: A brand new closing paragraph appears here.",
  ]);
  expect(words(view, "ins")).toEqual(["now"]);
  expect(words(view, "del")).toEqual(["today", "A paragraph that will be removed entirely."]);
  expect(counts()).toBe("3 blocks, 1 changed, 1 added, 1 removed, in 3 of 4 sections");
  expect(view.dom.classList.contains("reading-aids-marked")).toBe(true);
  // The plugin's work is timed under its one name.
  expect(performance.getEntriesByName(MARKS_MEASURE).length).toBeGreaterThan(0);
});

test("change-marks the approval's 7 changed blocks in 5 of 7 sections, the list counted once with a label on each changed or new item", async () => {
  const { counts, summary, view } = await marked(APPROVED, REVISED);
  expect(labels(view)).toEqual([
    `Changed: ${said("goals", "now")}`,
    `Changed: ${CHANGED_ITEM}`,
    `New: ${NEW_ITEMS[0]}`,
    `New: ${NEW_ITEMS[1]}`,
    `Changed: ${said("first design", "now")}`,
    `Changed: ${said("second design", "for good")}`,
    `Changed: ${said("rollout", "in June")}`,
    "New: A rollout paragraph that the new version adds.",
    `Changed: ${said("risks", "largely")}`,
  ]);
  expect(words(view, "ins")).toEqual(["now", "again ", "now", "good", "June", "largely"]);
  expect(counts()).toBe("7 blocks, 6 changed, 1 added, in 5 of 7 sections");
  expect(summary()?.changedSections.map(({ title }) => title)).toEqual(CHANGED_SECTIONS);
});

test("change-marks the marks stay on their blocks across a step that replaces the whole document", async () => {
  const { handle, other, view } = await marked();
  const changed = idOf(handle, "The design keeps most of its words now.");
  const { schema } = other.view.state;
  const end = other.view.state.doc.content.size;
  other.view.dispatch(
    other.view.state.tr.insert(
      end,
      schema.nodes.paragraph.create(null, schema.text("A peer's line."))
    )
  );
  await waitFor(() => expect(view.state.doc.textContent).toEndWith("A peer's line."));
  expect(labels(view)).toEqual([
    "Changed: The design keeps most of its words now.",
    "Removed: A paragraph that will be removed entirely.",
    "New: A brand new closing paragraph appears here.",
    "New: A peer's line.",
  ]);
  expect(view.dom.querySelector(`[${BLOCK_ID_ATTRIBUTE}="${changed}"] ins`)?.textContent).toBe(
    "now"
  );
});

test("change-marks an edit inside a marked block compares that block again, and no other", async () => {
  const { counts, handle, other, view, worker } = await marked();
  const at = endOf(other, "The design keeps most of its words now.") - 1;
  other.view.dispatch(other.view.state.tr.insertText(" here", at));
  const edited = "The design keeps most of its words now here.";
  await waitFor(() => expect(words(view, "ins")).toEqual(["now here"]));
  expect(worker.sent).toEqual([edited]);
  expect(labels(view)[0]).toBe(`Changed: ${edited}`);
  expect(counts()).toBe("3 blocks, 1 changed, 1 added, 1 removed, in 3 of 4 sections");
  expect(idOf(handle, edited)).toBeString();
});

test("change-marks a block compared again shows its words once its comparison ends", async () => {
  const { handle, view, worker } = await marked();
  worker.gate.held = true;
  handle.view.dispatch(
    handle.view.state.tr.insertText(
      " again",
      endOf(handle, "The design keeps most of its words now.") - 1
    )
  );
  await waitFor(() => expect(worker.sent).toHaveLength(1));
  expect(words(view, "ins")).toEqual([]);
  expect(labels(view)[0]).toBe("Changed: The design keeps most of its words now again.");
  worker.gate.release();
  await waitFor(() => expect(words(view, "ins")).toEqual(["now again"]));
});

test("change-marks a new set of plugins keeps the comparison, and the editor's end stops it", async () => {
  const { handle, view, worker } = await marked();
  let stopped = 0;
  worker.comparer.stop = () => {
    stopped += 1;
  };
  view.updateState(view.state.reconfigure({ plugins: [...view.state.plugins, new Plugin({})] }));
  await Promise.resolve();
  expect(stopped).toBe(0);
  handle.view.dispatch(
    handle.view.state.tr.insertText(
      " again",
      endOf(handle, "The design keeps most of its words now.") - 1
    )
  );
  await waitFor(() => expect(words(view, "ins")).toEqual(["now again"]));
  await handle.destroy();
  await Promise.resolve();
  expect(stopped).toBe(1);
});

test("change-marks a new editor on the same baseline keeps the visit's first pairing, so a block inserted above an edited block stays new", async () => {
  const { browser, handle, other, text, view } = await marked();
  const above = endOf(other, "The design keeps most of its words now.");
  const { schema } = other.view.state;
  other.view.dispatch(
    other.view.state.tr.insert(
      other.view.state.doc.resolve(above).before(),
      schema.nodes.paragraph.create(null, schema.text("Inserted above."))
    )
  );
  await waitFor(() => expect(labels(view)).toContain("New: Inserted above."));
  await handle.destroy();

  // A new editor on the same document, as a return to the page makes.
  const fresh = await editorIn(rootIn(), undefined, browser);
  fresh.view.updateState(
    fresh.view.state.reconfigure({
      plugins: [...fresh.view.state.plugins, changeMarksPlugin(() => inProcess().comparer)],
    })
  );
  compareWith(fresh.view, against(text));
  await waitFor(() => expect(summaryOf(fresh.view, text)).toBeDefined());
  expect(labels(fresh.view).slice(0, 2)).toEqual([
    "New: Inserted above.",
    "Changed: The design keeps most of its words now.",
  ]);
});

test("change-marks a block inserted directly above an edited block is new, and the edited block stays changed", async () => {
  const { counts, handle, other, view } = await marked();
  const above = endOf(other, "The design keeps most of its words now.");
  const { schema } = other.view.state;
  const start = other.view.state.doc.resolve(above).before();
  other.view.dispatch(
    other.view.state.tr.insert(
      start,
      schema.nodes.paragraph.create(null, schema.text("Inserted above."))
    )
  );
  await waitFor(() => expect(labels(view)).toContain("New: Inserted above."));
  expect(labels(view)).toEqual([
    "New: Inserted above.",
    "Changed: The design keeps most of its words now.",
    "Removed: A paragraph that will be removed entirely.",
    "New: A brand new closing paragraph appears here.",
  ]);
  expect(counts()).toBe("4 blocks, 1 changed, 2 added, 1 removed, in 3 of 4 sections");
  expect(idOf(handle, "Inserted above.")).toBeString();
});

test("change-marks a split block keeps its id on one part, and the other part is new", async () => {
  const { counts, handle, view } = await marked();
  const at = endOf(handle, "The design keeps most of its words now.") - " its words now.".length;
  handle.view.dispatch(handle.view.state.tr.split(at));
  await waitFor(() =>
    expect(labels(view)).toEqual([
      "Changed: The design keeps most of",
      "New:  its words now.",
      "Removed: A paragraph that will be removed entirely.",
      "New: A brand new closing paragraph appears here.",
    ])
  );
  expect(counts()).toBe("4 blocks, 1 changed, 2 added, 1 removed, in 3 of 4 sections");
});

test("change-marks a block merged into the one above shows as removed, and the one above as changed", async () => {
  const baseline = "## Notes\n\nThe first note stays.\n\nThe second note stays too.";
  const { counts, handle, view } = await marked(baseline, baseline);
  expect(labels(view)).toEqual([]);
  expect(counts()).toBe("0 blocks, in 0 of 1 section");
  handle.view.dispatch(handle.view.state.tr.join(endOf(handle, "The first note stays.") + 1));
  await waitFor(() =>
    expect(labels(view)).toEqual([
      "Changed: The first note stays.The second note stays too.",
      "Removed: The second note stays too.",
    ])
  );
  expect(counts()).toBe("2 blocks, 1 changed, 1 removed, in 1 of 1 section");
});

test("change-marks a deleted paired block shows as removed after the paired block above it", async () => {
  const { counts, handle, view } = await marked();
  const end = endOf(handle, "Unchanged later text.");
  const start = handle.view.state.doc.resolve(end).before();
  handle.view.dispatch(handle.view.state.tr.delete(start, end + 1));
  await waitFor(() =>
    expect(labels(view)).toEqual([
      "Changed: The design keeps most of its words now.",
      "Removed: A paragraph that will be removed entirely.",
      "Removed: Unchanged later text.",
      "New: A brand new closing paragraph appears here.",
    ])
  );
  // After the "Later" heading, the nearest paired block above it that stays.
  const removed = view.dom.querySelectorAll(".reading-aids-change-fold")[1];
  expect(removed?.previousElementSibling?.textContent).toBe("Later");
  expect(counts()).toBe("4 blocks, 1 changed, 1 added, 2 removed, in 3 of 4 sections");
});

test("change-marks a block with no id draws as new, and the baseline text it matched shows as removed", async () => {
  const before = "The words of this paragraph stay where they were.";
  const handle = await editorIn(rootIn(), undefined);
  const { view } = handle;
  const { schema } = view.state;
  const unstamped = schema.nodes.paragraph.create({ blockId: null }, schema.text(`${before} Now.`));
  // A loaded document keeps the ids it came with, here none.
  view.dispatch(
    view.state.tr
      .replaceWith(0, view.state.doc.content.size, unstamped)
      .setMeta("document-load", true)
  );
  expect(blockIdsOf(view)).toEqual([]);
  view.updateState(
    view.state.reconfigure({
      plugins: [...view.state.plugins, changeMarksPlugin(() => inProcess().comparer)],
    })
  );
  const text = { markdown: before, tree: undefined };
  compareWith(view, against(text));
  await waitFor(() => expect(summaryOf(view, text)).toBeDefined());
  // With no paired block above it, the removed block folds before the first block.
  expect(labels(view)).toEqual([`Removed: ${before}`, `New: ${before} Now.`]);
  const summary = summaryOf(view, text);
  expect(summary && countsText(summary)).toBe("2 blocks, 1 added, 1 removed, in 1 of 1 section");
});

test("change-marks a long removed paragraph folds to its words cut near 80 characters, its name the same words, and its panel the whole text", async () => {
  const long =
    "This removed paragraph runs on for a long while, well past the length that one folded line can show, so its head is cut short at a word.";
  const { view } = await marked(
    BASELINE.replace("A paragraph that will be removed entirely.", long)
  );
  const fold = foldOf(view, long);
  const head = "This removed paragraph runs on for a long while, well past the length that one…";
  const button = within(fold).getByRole("button", { name: `Removed: ${head}` });
  expect(button.textContent).toBe(head);
});

test("change-marks a removed line indented before one word longer than 80 characters folds to that word cut at 80, with no indent", async () => {
  const word = `https://example.com/${"a".repeat(90)}`;
  const removed = `    ${word}`;
  const { view } = await marked(`${BASELINE}\n\n\`\`\`\n${removed}\n\`\`\``);
  const fold = foldOf(view, removed);
  const head = `${word.slice(0, 80)}…`;
  const button = within(fold).getByRole("button", { name: `Removed: ${head}` });
  expect(button.textContent).toBe(head);
});

test("change-marks a removed block with no words folds to a line that names it as empty", async () => {
  const { view } = await marked(`${BASELINE}\n\n---`);
  const fold = foldOf(view, "");
  const button = within(fold).getByRole("button", { name: "Removed: An empty block" });
  expect(button.textContent).toBe("An empty block");
});

test("change-marks a removed block folds to its first line, named by it, and opens to its whole text", async () => {
  const removed = "The first line of the code.\nThe second line of the code.";
  const { view } = await marked(`${BASELINE}\n\n\`\`\`\n${removed}\n\`\`\``);
  const fold = foldOf(view, removed);
  const button = within(fold).getByRole("button", {
    name: "Removed: The first line of the code.",
  });
  const earlier = fold.querySelector<HTMLElement>(".reading-aids-earlier");
  expect(button.textContent).toBe("The first line of the code.");
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(earlier?.hidden).toBe(true);
  button.click();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(within(fold).getByRole("button", { name: "Hide the removed text" })).toBe(button);
  expect(earlier?.hidden).toBe(false);
  expect(earlier?.textContent).toBe(removed);
});

test("change-marks a rewritten block shows its new text, with its earlier text folded under it", async () => {
  const { view } = await marked(
    "## Plan\n\nWe ship the reader to every team in the spring of next year.",
    "## Plan\n\nWe ship the reader to every team in the autumn instead, after a pilot."
  );
  expect(labels(view)).toEqual([
    "Changed: We ship the reader to every team in the autumn instead, after a pilot.",
  ]);
  expect(words(view, "ins")).toEqual([]);
  const button = view.dom.querySelector(".reading-aids-change-fold button");
  expect(button?.textContent).toBe("Rewritten: show the earlier text");
  expect(view.dom.querySelector(".reading-aids-earlier")?.textContent).toBe(
    "We ship the reader to every team in the spring of next year."
  );
});

test("change-marks no change gives no label, and the gutter stays while a baseline is set, so the first mark does not move the text", async () => {
  const { counts, handle, view } = await marked(LIVE, LIVE);
  expect(labels(view)).toEqual([]);
  expect(counts()).toBe("0 blocks, in 0 of 4 sections");
  expect(view.dom.classList.contains("reading-aids-marked")).toBe(true);
  handle.view.dispatch(
    handle.view.state.tr.insertText(" more", endOf(handle, "Unchanged later text.") - 1)
  );
  await waitFor(() => expect(labels(view)).toEqual(["Changed: Unchanged later text more."]));
  expect(view.dom.classList.contains("reading-aids-marked")).toBe(true);
  compareWith(view, undefined);
  expect(view.dom.classList.contains("reading-aids-marked")).toBe(false);
});

test("change-marks a new baseline with the same counts tells its watchers once its counts are drawn", async () => {
  const { view } = await marked();
  const picked = { markdown: BASELINE, tree: undefined };
  const seen: (string | undefined)[] = [];
  watchChanges(view, () => {
    const summary = summaryOf(view, picked);
    seen.push(summary === undefined ? undefined : countsText(summary));
  });
  compareWith(view, against(picked));
  await waitFor(() =>
    expect(seen.at(-1)).toBe("3 blocks, 1 changed, 1 added, 1 removed, in 3 of 4 sections")
  );
});

test("change-marks a baseline the engine refuses draws no marks and no gutter, says so, and keeps upstream's changed-since-read mark", async () => {
  const { view } = await marked();
  const refused = { markdown: "Text.", tree: { type: "not-a-document" } };
  compareWith(view, against(refused));
  await waitFor(() => expect(comparisonFailure(view, refused)?.refused).toBe(true));
  expect(labels(view)).toEqual([]);
  expect(drawnChanges(view)).toBeUndefined();
  // No marks will draw, so the text leaves no gutter for them.
  expect(view.dom.classList.contains("reading-aids-marked")).toBe(false);
  const marks = specBlockMarks([], ["changed"]);
  expect(besideChangeMarks(view, marks)).toEqual(marks);
});

test("change-marks a failed pick drops the last baseline's marks and the gutter, and Retry compares again on the same comparer", async () => {
  quietConsoleError();
  const { started, view, worker } = await marked();
  const { pairDocument } = worker.comparer;
  worker.comparer.pairDocument = () => Promise.reject(new Error("the comparison failed"));
  const picked = { markdown: BASELINE, tree: undefined };
  compareWith(view, against(picked));
  await waitFor(() => expect(comparisonFailure(view, picked)?.refused).toBe(false));
  expect(labels(view)).toEqual([]);
  expect(view.dom.classList.contains("reading-aids-marked")).toBe(false);
  worker.comparer.pairDocument = pairDocument;
  retryComparison(view);
  await waitFor(() => expect(summaryOf(view, picked)).toBeDefined());
  expect(comparisonFailure(view, picked)).toBeUndefined();
  expect(labels(view)).toHaveLength(3);
  expect(view.dom.classList.contains("reading-aids-marked")).toBe(true);
  // A request's failure leaves the worker running, so Retry asks it again.
  expect(worker.worker.terminated).toBe(false);
  expect(started).toHaveLength(1);
});

test("change-marks a block's comparison that fails after a new pick leaves the comparer to the new pick's comparison", async () => {
  quietConsoleError();
  const { handle, started, view, worker } = await marked();
  let fail: ((error: Error) => void) | undefined;
  worker.comparer.compareBlock = () =>
    new Promise((_, reject) => {
      fail = reject;
    });
  handle.view.dispatch(
    handle.view.state.tr.insertText(
      " again",
      endOf(handle, "The design keeps most of its words now.") - 1
    )
  );
  await waitFor(() => expect(fail).toBeDefined());
  const picked = { markdown: BASELINE, tree: undefined };
  compareWith(view, against(picked));
  fail?.(new Error("the block's comparison failed"));
  await waitFor(() => expect(summaryOf(view, picked)).toBeDefined());
  expect(comparisonFailure(view, picked)).toBeUndefined();
  expect(worker.worker.terminated).toBe(false);
  expect(started).toHaveLength(1);
});

test("change-marks a worker that fails during the edits drops the marks, and Retry starts a new comparer", async () => {
  quietConsoleError();
  const { handle, started, view, worker } = await marked();
  worker.worker.crash();
  handle.view.dispatch(
    handle.view.state.tr.insertText(
      " again",
      endOf(handle, "The design keeps most of its words now.") - 1
    )
  );
  await waitFor(() => expect(labels(view)).toEqual([]));
  retryComparison(view);
  await waitFor(() => expect(words(view, "ins")).toEqual(["now again"]));
  expect(started).toHaveLength(2);
});

test("change-marks an open removed fold stays open when a block above it is deleted", async () => {
  const { handle, view } = await marked();
  const removedText = "A paragraph that will be removed entirely.";
  foldOf(view, removedText).querySelector("button")?.click();
  const end = endOf(handle, "Kept paragraph that stays the same.");
  const start = handle.view.state.doc.resolve(end).before();
  handle.view.dispatch(handle.view.state.tr.delete(start, end + 1));
  await waitFor(() =>
    expect(labels(view)).toContain("Removed: Kept paragraph that stays the same.")
  );
  expect(foldOf(view, removedText).querySelector("button")?.getAttribute("aria-expanded")).toBe(
    "true"
  );
});

test("change-marks a list replaced by a paragraph with its id draws as changed, with no list marks, while its comparison waits", async () => {
  const kept = ["The second item stays the same here.", "The third item stays the same too."];
  const { handle, view, worker } = await marked(
    [
      "## List",
      "- The first item goes away entirely now.",
      ...kept.map((item) => `- ${item}`),
    ].join("\n"),
    ["## List", ...kept.map((item) => `- ${item}`)].join("\n")
  );
  expect(labels(view)).toEqual(["Removed: The first item goes away entirely now."]);
  let list: { start: number; end: number; id: string | null } | undefined;
  handle.view.state.doc.forEach((node, offset) => {
    if (node.type.name === "bullet_list") {
      list = { end: offset + node.nodeSize, id: blockIdOf(node), start: offset };
    }
  });
  if (list === undefined) throw new Error("no list");
  const { schema } = handle.view.state;
  worker.gate.held = true;
  handle.view.dispatch(
    handle.view.state.tr.replaceWith(
      list.start,
      list.end,
      schema.nodes.paragraph.create({ blockId: list.id }, schema.text("A paragraph now."))
    )
  );
  await waitFor(() => expect(worker.sent).toEqual(["A paragraph now."]));
  const paragraph = view.dom.querySelector(`[${BLOCK_ID_ATTRIBUTE}="${list.id}"]`);
  expect(paragraph?.tagName).toBe("P");
  expect(labels(view)).toContain("Changed: A paragraph now.");
  expect(paragraph?.querySelector(`[${CHANGE_ATTRIBUTE}]`)).toBeNull();
  expect(view.dom.querySelector("li.reading-aids-change-fold")).toBeNull();
  worker.gate.release();
  await waitFor(() => expect(labels(view)).toContain("New: A paragraph now."));
});

test("change-marks upstream's changed-since-read mark is dropped once the marks have drawn, and its other marks stay", async () => {
  const handle = await editorIn(rootIn(), undefined);
  handle.setMarkdown(LIVE);
  const { view } = handle;
  view.updateState(
    view.state.reconfigure({
      plugins: [...view.state.plugins, changeMarksPlugin(() => inProcess().comparer)],
    })
  );
  const marks = specBlockMarks(["stale"], ["changed"]);
  expect(besideChangeMarks(view, marks)).toEqual(marks);
  const text = { markdown: BASELINE, tree: undefined };
  compareWith(view, against(text));
  // Upstream's mark stays until the change marks have drawn.
  expect(besideChangeMarks(view, marks)).toEqual(marks);
  await waitFor(() => expect(summaryOf(view, text)).toBeDefined());
  expect(besideChangeMarks(view, marks).map(({ blockId }) => blockId)).toEqual(["stale"]);
  compareWith(view, undefined);
  expect(besideChangeMarks(view, marks)).toEqual(marks);
});

test("change-marks word marks in a block of several runs stand in the runs that changed", async () => {
  const before =
    "Ship the **bold words** first, then [the linked page](https://example.com/a) and `the code` here today.";
  const after =
    "Ship the **bold terms** first, then [the linked page](https://example.com/a) and `the code` there now.";
  const { view } = await marked(before, after);
  const placed = (selector: "ins" | "del") =>
    [...view.dom.querySelectorAll(selector)].map(
      (element) => `${element.parentElement?.tagName}:${element.textContent}`
    );
  expect({ del: placed("del"), ins: placed("ins") }).toEqual({
    del: ["STRONG:words", "P:here", "P:today"],
    ins: ["STRONG:terms", "P:there", "P:now"],
  });
});
