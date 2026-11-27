import { expect, test } from "bun:test";
import { compiledBlockSchema, createHeadlessProof } from "@/upstream/editor/worker";
import { type ChangeSummary, countsText, sameSummary, summarize } from "./change-summary";
import { NEW } from "./compare";

test("change-marks a section with no words in its heading or its first line still gets a name for its link", async () => {
  const { schema } = await createHeadlessProof({
    blockSchema: compiledBlockSchema,
    readOnly: true,
  });
  const blocks = [
    schema.nodes.paragraph.create(),
    schema.nodes.heading.create({ level: 2 }),
    schema.nodes.paragraph.create(null, schema.text("More.")),
  ].map((node, index) => ({ id: `b${index}`, node, verdict: NEW }));
  expect(summarize(blocks, []).changedSections.map(({ title }) => title)).toEqual([
    "Before the first heading",
    "Untitled section",
  ]);
});

test("change-marks two summaries that say the same are the same whatever the order of their keys", () => {
  const summary: ChangeSummary = {
    added: 1,
    changed: 2,
    changedSections: [{ blockId: "h", title: "Design" }],
    removed: 0,
    sections: 3,
  };
  const reordered: ChangeSummary = {
    sections: 3,
    removed: 0,
    changedSections: [{ title: "Design", blockId: "h" }],
    changed: 2,
    added: 1,
  };
  expect(sameSummary(summary, reordered)).toBe(true);
  const renamed = { ...summary, changedSections: [{ blockId: "h", title: "Design notes" }] };
  expect(sameSummary(summary, renamed)).toBe(false);
  expect(sameSummary(summary, { ...summary, removed: 1 })).toBe(false);
});

test("change-marks with every block deleted, the counts name no sections", () => {
  expect(countsText(summarize([], [undefined, undefined]))).toBe("2 blocks, 2 removed");
});
