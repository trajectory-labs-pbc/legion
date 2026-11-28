import { expect, test } from "bun:test";
import { Schema } from "@milkdown/kit/prose/model";

import type { Verdict } from "./compare";
import { onlyChangesParts } from "./only-changes-parts";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    bullet_list: { content: "paragraph+", group: "block" },
    paragraph: { content: "text*", group: "block" },
    text: {},
  },
});

const UNCHANGED: Verdict = { kind: "unchanged" };
const NEW: Verdict = { kind: "new" };

test("only-changes: an item with no id inside a run of unchanged items leaves the run one part", () => {
  const items = [
    { id: "new-1", verdict: NEW },
    { id: "a", verdict: UNCHANGED },
    { id: "b", verdict: UNCHANGED },
    { id: undefined, verdict: UNCHANGED },
    { id: "c", verdict: UNCHANGED },
    { id: "d", verdict: UNCHANGED },
    { id: "new-2", verdict: NEW },
  ];
  const list = schema.node("bullet_list", null, [schema.node("paragraph")]);
  const parts = onlyChangesParts({
    blocks: [{ id: "list", node: list, verdict: { kind: "list", removed: [], results: items } }],
    removedAfter: [],
  });
  expect(parts).toEqual([{ ids: ["b", "c"], line: true }]);
});
