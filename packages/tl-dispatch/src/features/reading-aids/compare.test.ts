import { describe, expect, test } from "bun:test";
import { changedWords } from "@upstream-dispatch/features/doc/change-set";

import {
  type BaselineBlock,
  type BaselineItem,
  type BlockVerdict,
  compareBlock,
  compareDocument,
} from "./compare";

function block(text: string, id?: string, kind = "paragraph"): BaselineBlock {
  return { kind, text, id, shown: text };
}

/** A list as the engine reads it: its text runs the items together, its shown text does not. */
function list(items: readonly BaselineItem[], id?: string, kind = "bullet_list"): BaselineBlock {
  const texts = items.map((item) => item.text);
  return { kind, text: texts.join(""), id, items, shown: texts.join(" ") };
}

function item(text: string, id?: string): BaselineItem {
  return { kind: "list_item", text, id, shown: text };
}

/** `count` distinct words joined by spaces. */
function words(count: number, prefix: string): string[] {
  return Array.from(
    { length: count },
    (_, index) => `${prefix}${index.toString().padStart(4, "0")}`
  );
}

/** A pair of 100 characters whose first `kept` characters are the same and the rest replaced. */
function pairKeeping(kept: number): [string, string] {
  const same = `${"s".repeat(kept - 1)} `;
  return [same + "r".repeat(100 - kept), same + "n".repeat(100 - kept)];
}

function keptShare(before: string, after: string): number {
  const same = changedWords(before, after)
    .filter((part) => part.kind === "same")
    .reduce((sum, part) => sum + part.value.length, 0);
  return same / Math.max(before.length, after.length);
}

/** One baseline block against one live block, through the whole comparison. */
function judged(before: BaselineBlock, after: BaselineBlock): BlockVerdict {
  const live = { ...after, id: after.id ?? "live" };
  const [result] = compareDocument([before], [live]).comparison.results;
  return result.verdict;
}

function verdictOf(before: string, after: string): BlockVerdict["kind"] {
  return judged(block(before), block(after)).kind;
}

describe("change-marks share kept", () => {
  test("change-marks a block that kept 30% shows as removed plus added", () => {
    const [before, after] = pairKeeping(30);
    expect(keptShare(before, after)).toBe(0.3);
    expect(judged(block(before), block(after))).toEqual({
      kind: "replaced",
      earlier: before,
    });
  });

  test("change-marks the 40% limit: 39% is removed plus added, 40% is rewritten", () => {
    expect(verdictOf(...pairKeeping(39))).toBe("replaced");
    expect(verdictOf(...pairKeeping(40))).toBe("rewritten");
  });

  test("change-marks a block that kept 70% shows its new text with the earlier one", () => {
    const [before, after] = pairKeeping(70);
    expect(keptShare(before, after)).toBe(0.7);
    expect(judged(block(before), block(after))).toEqual({
      kind: "rewritten",
      earlier: before,
    });
  });

  test("change-marks the 80% limit: 79% is rewritten, 80% has word marks", () => {
    expect(verdictOf(...pairKeeping(79))).toBe("rewritten");
    expect(verdictOf(...pairKeeping(80))).toBe("changed");
  });

  test("change-marks the grown block: 100 to 300 characters, its first 100 kept, divides by the longer", () => {
    const before = "g".repeat(100);
    const after = `${before} ${"h".repeat(199)}`;
    expect(after.length).toBe(300);
    expect(keptShare(before, after)).toBeCloseTo(1 / 3);
    expect(verdictOf(before, after)).toBe("replaced");
  });

  test("change-marks a pair at the limit of 800 word edits keeps 0% and shows as removed plus added", () => {
    const baseline = words(6000, "w");
    // Every 13th word replaced: 462 replacements, 924 word edits, past the limit.
    const live = baseline.map((word, index) => (index % 13 === 0 ? `x${word}` : word));
    const before = baseline.join(" ");
    const after = live.join(" ");
    expect(changedWords(before, after)).toEqual([
      { kind: "removed", value: before },
      { kind: "added", value: after },
    ]);
    expect(judged(block(before), block(after))).toEqual({
      kind: "replaced",
      earlier: before,
    });
  });
});

describe("change-marks places of lost words", () => {
  const baseline = words(80, "p");
  const dropping = (count: number) =>
    baseline.filter((_, index) => !(index % 10 === 5 && index / 10 < count)).join(" ");

  test("change-marks a block that kept 90% but lost words in 7 places is rewritten", () => {
    const before = baseline.join(" ");
    const after = dropping(7);
    expect(changedWords(before, after).filter((part) => part.kind === "removed")).toHaveLength(7);
    expect(keptShare(before, after)).toBeGreaterThanOrEqual(0.9);
    expect(judged(block(before), block(after))).toEqual({
      kind: "rewritten",
      earlier: before,
    });
  });

  test("change-marks a block that lost words in 6 places has word marks", () => {
    const before = baseline.join(" ");
    const after = dropping(6);
    expect(judged(block(before), block(after))).toEqual({
      kind: "changed",
      words: changedWords(before, after),
    });
  });

  test("change-marks removed runs of spaces alone are no places of lost words", () => {
    const before = baseline
      .map((word, index) => (index % 10 === 0 ? `${word}  ` : `${word} `))
      .join("");
    const after = baseline.join(" ");
    const removed = changedWords(before, after).filter((part) => part.kind === "removed");
    expect(removed.length).toBeGreaterThan(6);
    expect(removed.every((part) => part.value.trim() === "")).toBe(true);
    expect(judged(block(before), block(after)).kind).toBe("changed");
  });
});

describe("change-marks kinds and lists", () => {
  test("change-marks a paragraph that became a code block shows as removed plus added", () => {
    const text = "the same words in another kind";
    expect(judged(block(text), block(text, "b1", "code_block"))).toEqual({
      kind: "replaced",
      earlier: text,
    });
  });

  test("change-marks a list that changed its kind shows as removed plus added", () => {
    const items = [item("one"), item("two")];
    expect(judged(list(items), list(items, "l1", "ordered_list")).kind).toBe("replaced");
  });

  test("change-marks the long list is compared item by item", () => {
    const itemTexts = Array.from({ length: 7 }, (_, index) => words(71, `i${index}w`).join(" "));
    const before = list(itemTexts.map((text) => item(text)));
    const changedText = itemTexts[3].replace("i3w0030", "i3w0030 again");
    const added = [words(150, "na").join(" "), words(150, "nb").join(" ")];
    const live = list([
      ...itemTexts.slice(0, 3).map((text, index) => item(text, `it${index}`)),
      item(changedText, "it3"),
      ...itemTexts.slice(4).map((text, index) => item(text, `it${index + 4}`)),
      item(added[0], "it7"),
      item(added[1], "it8"),
    ]);
    expect(before.text.length).toBeGreaterThan(3900);
    expect(before.text.length).toBeLessThan(4100);
    expect(live.text.length).toBeGreaterThan(6000);
    expect(live.text.length).toBeLessThan(6200);

    expect(judged(before, live)).toEqual({
      kind: "list",
      results: [
        { id: "it0", verdict: { kind: "unchanged" } },
        { id: "it1", verdict: { kind: "unchanged" } },
        { id: "it2", verdict: { kind: "unchanged" } },
        { id: "it3", verdict: { kind: "changed", words: changedWords(itemTexts[3], changedText) } },
        { id: "it4", verdict: { kind: "unchanged" } },
        { id: "it5", verdict: { kind: "unchanged" } },
        { id: "it6", verdict: { kind: "unchanged" } },
        { id: "it7", verdict: { kind: "new" } },
        { id: "it8", verdict: { kind: "new" } },
      ],
      removed: [],
    });
  });

  test("change-marks a removed item folds after the item above it", () => {
    const before = list([item("first"), item("second"), item("third")]);
    const live = list([item("first", "a"), item("third", "c")], "l");
    expect(judged(before, live)).toEqual({
      kind: "list",
      results: [
        { id: "a", verdict: { kind: "unchanged" } },
        { id: "c", verdict: { kind: "unchanged" } },
      ],
      removed: [{ kind: "list_item", text: "second", after: "a" }],
    });
  });

  test("change-marks a list with the same items is unchanged", () => {
    const before = list([item("one"), item("two")]);
    expect(judged(before, list([item("one", "a"), item("two", "b")], "l"))).toEqual({
      kind: "unchanged",
    });
  });

  test("change-marks a list paired while it had another kind is compared item by item when its kind comes back", () => {
    const [one, two] = ["The first item of the list.", "The second item of the list."];
    const baseline = [list([item(one), item(two)])];
    const ordered = list([item(one, "i1"), item(two, "i2")], "l", "ordered_list");
    const { comparison, pairs } = compareDocument(baseline, [ordered]);
    expect(comparison.results[0].verdict.kind).toBe("replaced");
    const edited = `${two} Now.`;
    expect(compareBlock(pairs, list([item(one, "i1"), item(edited, "i2")], "l"))).toEqual({
      kind: "list",
      results: [
        { id: "i1", verdict: { kind: "unchanged" } },
        { id: "i2", verdict: { kind: "changed", words: changedWords(two, edited) } },
      ],
      removed: [],
    });
  });
});

describe("change-marks the whole document", () => {
  test("change-marks a pair with no change marks nothing", () => {
    const blocks = [block("Title", undefined, "heading"), block("A paragraph.")];
    const live = [block("Title", "h", "heading"), block("A paragraph.", "p")];
    const { comparison } = compareDocument(blocks, live);
    expect(comparison.results).toEqual([
      { id: "h", verdict: { kind: "unchanged" } },
      { id: "p", verdict: { kind: "unchanged" } },
    ]);
    expect(comparison.removed).toEqual([]);
  });

  test("change-marks a removed block folds after the nearest paired block above it", () => {
    const baseline = [block("Intro"), block("Gone"), block("Kept"), block("Last")];
    const live = [block("Intro", "a"), block("Kept", "b"), block("Added", "n"), block("Last", "c")];
    const { comparison } = compareDocument(baseline, live);
    expect(comparison.results).toEqual([
      { id: "a", verdict: { kind: "unchanged" } },
      { id: "b", verdict: { kind: "unchanged" } },
      { id: "n", verdict: { kind: "new" } },
      { id: "c", verdict: { kind: "unchanged" } },
    ]);
    expect(comparison.removed).toEqual([{ kind: "paragraph", text: "Gone", after: "a" }]);
  });

  test("change-marks a removed first block folds before the first block", () => {
    const { comparison } = compareDocument([block("Gone"), block("Kept")], [block("Kept", "k")]);
    expect(comparison.removed).toEqual([{ kind: "paragraph", text: "Gone", after: undefined }]);
  });

  test("change-marks each paired block's baseline is in the comparison, by its live id", () => {
    const baseline = [block("Intro"), list([item("one"), item("two")]), block("Gone")];
    const live = [block("Intro", "a"), list([item("one", "i1"), item("two", "i2")], "l")];
    expect(compareDocument(baseline, live).comparison.earlier).toEqual(
      new Map([
        ["a", { kind: "paragraph", text: "Intro" }],
        ["l", { kind: "bullet_list", text: "one two" }],
      ])
    );
  });

  test("change-marks a block with no id is judged against its pair at the first comparison, and is new after it", () => {
    const before = "The words of this paragraph stay where they were.";
    const after = `${before} Now.`;
    const { comparison, pairs } = compareDocument([block(before)], [block(after)]);
    expect(comparison.results).toEqual([
      { id: undefined, verdict: { kind: "changed", words: changedWords(before, after) } },
    ]);
    expect(comparison.removed).toEqual([]);
    expect(compareBlock(pairs, block(after))).toEqual({ kind: "new" });
  });

  test("change-marks a later compare of one block reads the pairs the whole comparison made", () => {
    const baseline = [block("alpha beta gamma delta epsilon zeta"), block("unrelated text")];
    const live = [block("alpha beta gamma delta epsilon zeta", "x"), block("unrelated text", "y")];
    const { pairs } = compareDocument(baseline, live);
    // A block inserted directly above "x" with the text "x" had does not take its pair.
    expect(compareBlock(pairs, block("alpha beta gamma delta epsilon zeta", "inserted"))).toEqual({
      kind: "new",
    });
    expect(compareBlock(pairs, block("alpha beta gamma delta epsilon zeta eta", "x")).kind).toBe(
      "changed"
    );
  });
});
