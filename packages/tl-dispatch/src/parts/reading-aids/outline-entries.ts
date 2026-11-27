import type { Node as ProseMirrorNode } from "@milkdown/kit/prose/model";
import { blockIdOf } from "@/upstream/editor/engine";

import { headingLevel } from "./change-summary";

/** The outline lists the headings to this level. */
const OUTLINE_DEPTH = 3;

/** What the aids count on one block: its changes and its open decisions. */
export interface BlockCounts {
  changes: number;
  decisions: number;
}

/** Each block's counts: its changes from the marks, and one for each open decision in it. */
export function blockCounts(
  changes: ReadonlyMap<string, number> | undefined,
  decisions: readonly { readonly blockId: string }[]
): ReadonlyMap<string, BlockCounts> {
  const counts = new Map<string, BlockCounts>();
  const of = (blockId: string) => {
    const counted = counts.get(blockId) ?? { changes: 0, decisions: 0 };
    counts.set(blockId, counted);
    return counted;
  };
  for (const [blockId, count] of changes ?? []) of(blockId).changes += count;
  for (const { blockId } of decisions) of(blockId).decisions += 1;
  return counts;
}

/** One heading of the outline, with the counts of its range. */
export interface OutlineEntry extends BlockCounts {
  blockId: string;
  level: number;
  text: string;
}

/**
 * The headings to `OUTLINE_DEPTH` that have text, in document order. An entry's range runs from its
 * heading to the next heading of the same or a higher level, so its counts sum each block id in it.
 */
export function outlineEntries(
  doc: ProseMirrorNode,
  counts: ReadonlyMap<string, BlockCounts>
): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  const open: OutlineEntry[] = [];
  doc.descendants((node) => {
    const blockId = blockIdOf(node);
    if (blockId === null) return !node.isTextblock;
    const level = headingLevel(node);
    if (level !== undefined && level <= OUTLINE_DEPTH) {
      // An empty heading is no entry, but it still ends the ranges it would end.
      while ((open.at(-1)?.level ?? 0) >= level) open.pop();
      const text = node.textContent;
      if (text !== "") {
        const entry = { blockId, changes: 0, decisions: 0, level, text };
        entries.push(entry);
        open.push(entry);
      }
    }
    const counted = counts.get(blockId);
    if (counted !== undefined) {
      for (const entry of open) {
        entry.changes += counted.changes;
        entry.decisions += counted.decisions;
      }
    }
    return !node.isTextblock;
  });
  return entries;
}

/** Where a move of `step` from `from` lands: none past an end, nor back from before the first. */
export function stepEntry(
  length: number,
  from: number | undefined,
  step: 1 | -1
): number | undefined {
  const to = (from ?? -1) + step;
  return to >= 0 && to < length ? to : undefined;
}
