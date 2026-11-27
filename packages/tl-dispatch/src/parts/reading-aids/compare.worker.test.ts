import { expect, test } from "bun:test";
import { compiledBlockSchema, createHeadlessProof } from "@/upstream/editor/worker";
import { quietConsoleError } from "../../../tests/upstream";

import { type Block, readBlocks } from "./compare";
import { type CompareReply, createCompareSession } from "./compare.worker";

const engine = createHeadlessProof({ blockSchema: compiledBlockSchema, readOnly: true });

const BASELINE =
  "# Plan\n\nThe first paragraph stays.\n\n- one\n- two\n\nThis paragraph goes away.\n";
const LIVE =
  "# Plan\n\nThe first paragraph stays.\n\n- one\n- two\n- three\n\nA new closing line.\n";

async function liveBlocks(markdown = LIVE) {
  return readBlocks((await engine).parseMarkdown(markdown));
}

async function treeOf(markdown: string) {
  return (await engine).parseMarkdown(markdown).toJSON();
}

function comparisonOf(reply: CompareReply) {
  if (reply.kind === "refused") return undefined;
  if (reply.kind !== "pair" && reply.kind !== "compare") throw new Error("not a document reply");
  return reply.comparison;
}

test("change-marks a baseline with no tree is parsed, and reads as its tree does", async () => {
  const live = await liveBlocks();
  const fromMarkdown = comparisonOf(
    await createCompareSession(engine)({
      id: 1,
      kind: "pair",
      baseline: { markdown: BASELINE, tree: undefined },
      live,
    })
  );
  const fromTree = comparisonOf(
    await createCompareSession(engine)({
      id: 2,
      kind: "pair",
      baseline: { markdown: BASELINE, tree: await treeOf(BASELINE) },
      live,
    })
  );
  expect(fromTree).toEqual(fromMarkdown);
  const [heading, kept, list, added] = live;
  expect(fromMarkdown?.results).toEqual([
    { id: heading.id, verdict: { kind: "unchanged" } },
    { id: kept.id, verdict: { kind: "unchanged" } },
    {
      id: list.id,
      verdict: {
        kind: "list",
        results: [
          { id: list.items?.[0].id, verdict: { kind: "unchanged" } },
          { id: list.items?.[1].id, verdict: { kind: "unchanged" } },
          { id: list.items?.[2].id, verdict: { kind: "new" } },
        ],
        removed: [],
      },
    },
    { id: added.id, verdict: { kind: "replaced", earlier: "This paragraph goes away." } },
  ]);
  expect(fromMarkdown?.removed).toEqual([]);
});

const LIST =
  "- The first item stays as it is.\n- The second item, which a person edits later on.\n- The third item stays too.\n";

/** A session that has compared `LIST` with itself, and the live list it paired. */
async function pairedList() {
  const answer = createCompareSession(engine);
  const live = await liveBlocks(LIST);
  await answer({ id: 1, kind: "pair", baseline: { markdown: LIST, tree: undefined }, live });
  const [list] = live;
  const [first, second, third] = list.items ?? [];
  return { answer, list, first, second, third };
}

function itemVerdicts(reply: CompareReply) {
  if (reply.kind !== "block") throw new Error("not a block reply");
  const { verdict } = reply.result;
  if (verdict.kind !== "list") throw new Error(`the list is ${verdict.kind}`);
  return verdict.results.map((item) => [item.id, item.verdict.kind]);
}

test("change-marks an item inserted directly above an edited item is new, and the edited item stays changed", async () => {
  const { answer, list, first, second, third } = await pairedList();
  const inserted = { kind: "list_item", text: "An item from a second tab.", id: "inserted" };
  const edited = { ...second, text: `${second.text} Now.` };
  const items = [first, inserted, edited, third];
  const reply = await answer({ id: 2, kind: "block", block: { ...list, items } });
  expect(itemVerdicts(reply)).toEqual([
    [first.id, "unchanged"],
    ["inserted", "new"],
    [second.id, "changed"],
    [third.id, "unchanged"],
  ]);
});

test("change-marks an item split in two keeps its pair on the first part, which keeps its id, and the second part is new", async () => {
  const { answer, list, first, second, third } = await pairedList();
  const head = { ...second, text: "The second item, which a person" };
  const rest = { kind: "list_item", text: " edits later on.", id: "split" };
  const items = [first, head, rest, third];
  const reply = await answer({ id: 2, kind: "block", block: { ...list, items } });
  expect(itemVerdicts(reply)).toEqual([
    [first.id, "unchanged"],
    [second.id, "rewritten"],
    ["split", "new"],
    [third.id, "unchanged"],
  ]);
});

test("change-marks a pair request that throws leaves no pairs of the baseline before it", async () => {
  quietConsoleError();
  const { answer, list } = await pairedList();
  const unreadable: Block = {
    kind: "paragraph",
    id: "u",
    get text(): string {
      throw new Error("unreadable");
    },
  };
  const baseline = { markdown: LIST, tree: undefined };
  expect(await answer({ id: 2, kind: "pair", baseline, live: [unreadable] })).toEqual({
    id: 2,
    kind: "failed",
  });
  expect(await answer({ id: 3, kind: "block", block: list })).toEqual({
    id: 3,
    kind: "block",
    result: { id: list.id, verdict: { kind: "new" } },
  });
});

/** `live` parsed, and its document compare with `baseline`. */
async function comparedWith(baseline: string, live: string) {
  const blocks = await liveBlocks(live);
  const comparison = comparisonOf(
    await createCompareSession(engine)({
      id: 1,
      kind: "pair",
      baseline: { markdown: baseline, tree: undefined },
      live: blocks,
    })
  );
  return { blocks, comparison };
}

test("change-marks a removed table shows its cells apart", async () => {
  const intro = "The introduction stays.\n";
  const { blocks, comparison } = await comparedWith(
    `${intro}\n| Name | Age |\n| --- | --- |\n| Alice | 30 |\n`,
    intro
  );
  expect(comparison?.removed).toEqual([
    { kind: "table", text: "Name Age Alice 30", after: blocks[0].id },
  ]);
});

test("change-marks a removed item with nested items shows each apart", async () => {
  const kept = "- The first kept item stays as it is.\n- The second kept item stays too.\n";
  const { blocks, comparison } = await comparedWith(`- Parent\n  - one\n  - two\n${kept}`, kept);
  const [list] = blocks;
  expect(comparison?.results).toEqual([
    {
      id: list.id,
      verdict: {
        kind: "list",
        results: (list.items ?? []).map((item) => ({
          id: item.id,
          verdict: { kind: "unchanged" },
        })),
        removed: [{ kind: "list_item", text: "Parent one two", after: undefined }],
      },
    },
  ]);
});

test("change-marks a request that throws is answered as a failure of that request alone", async () => {
  const errors = quietConsoleError();
  const answer = createCompareSession(Promise.reject(new Error("no engine")));
  const document = answer({
    id: 1,
    kind: "pair",
    baseline: { markdown: LIST, tree: undefined },
    live: [],
  });
  const block = answer({ id: 2, kind: "block", block: { kind: "paragraph", text: "x", id: "x" } });
  expect(await document).toEqual({ id: 1, kind: "failed" });
  expect(errors).toHaveBeenCalledWith("Comparing with the baseline failed", expect.any(Error));
  expect(await block).toEqual({
    id: 2,
    kind: "block",
    result: { id: "x", verdict: { kind: "new" } },
  });
});

test("change-marks an empty baseline holds no block, so every block is new", async () => {
  const live = await liveBlocks("One paragraph.\n");
  const comparison = comparisonOf(
    await createCompareSession(engine)({
      id: 1,
      kind: "pair",
      baseline: { markdown: "", tree: undefined },
      live,
    })
  );
  expect(comparison?.results).toEqual([{ id: live[0].id, verdict: { kind: "new" } }]);
  expect(comparison?.removed).toEqual([]);
});

test("change-marks a tree the schema refuses compares nothing, and its reply carries no pairs", async () => {
  const reply = await createCompareSession(engine)({
    id: 1,
    kind: "pair",
    baseline: { markdown: BASELINE, tree: { type: "doc", content: [{ type: "no_such_node" }] } },
    live: await liveBlocks(),
  });
  expect(reply).toEqual({ id: 1, kind: "refused" });
});

test("change-marks a tree whose top node is not a document compares nothing", async () => {
  const comparison = comparisonOf(
    await createCompareSession(engine)({
      id: 1,
      kind: "pair",
      baseline: {
        markdown: BASELINE,
        tree: { type: "paragraph", content: [{ type: "text", text: "A paragraph." }] },
      },
      live: await liveBlocks(),
    })
  );
  expect(comparison).toBeUndefined();
});

test("change-marks a pair reply carries its pairs, and a compare request with them keeps them without parsing the baseline", async () => {
  const baseline = { markdown: "The design keeps most of its words today.\n", tree: undefined };
  const [edited] = await liveBlocks("The design keeps most of its words now.\n");
  if (edited === undefined) throw new Error("no block");
  const answer = createCompareSession(engine);
  const first = await answer({ id: 1, kind: "pair", baseline, live: [edited] });
  if (first.kind !== "pair") throw new Error("no pairs");
  const inserted = { id: "inserted", kind: "paragraph", text: "Inserted above." };
  // A session with no engine: the earlier pairs need no parse.
  const reply = await createCompareSession(new Promise<never>(() => {}))({
    id: 2,
    kind: "compare",
    live: [inserted, edited],
    pairs: first.pairs,
  });
  expect(reply.kind).toBe("compare");
  const again = comparisonOf(reply);
  expect(again?.results.map(({ id, verdict }) => [id, verdict.kind])).toEqual([
    ["inserted", "new"],
    [edited.id, "changed"],
  ]);
});
