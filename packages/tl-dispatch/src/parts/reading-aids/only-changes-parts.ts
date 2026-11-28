// The parts "Only changes" folds: upstream's rule for a change view, over the marks drawn.

import type { ChangeBaseline } from "@/upstream/editor/engine";

import { type MarkedBlock, sectionsOf, startsSection } from "./change-summary";
import type { BlockVerdict } from "./compare";
import type { Marked } from "./marks-plugin";

/** A part "Only changes" folds: its blocks, and whether a line names it. */
export interface FoldedPart {
  readonly ids: readonly string[];
  /** False for a section's body, which folds to its heading alone. */
  readonly line: boolean;
}

/** The folds of "Only changes" against one baseline: its parts, and the blocks still folded. */
export interface OnlyChangesFolds {
  readonly baseline: ChangeBaseline;
  readonly parts: readonly FoldedPart[];
  readonly folded: ReadonlySet<string>;
}

interface ChangeEntry {
  /** "unchanged", or the change. */
  readonly kind: BlockVerdict["kind"];
  /** The block or item it folds; none for a removed one, which no fold hides. */
  readonly id: string | undefined;
}

// Upstream's unexported foldedEntries (features/doc/ChangeView.tsx), word for word.
function foldedEntries(entries: readonly ChangeEntry[]): boolean[] {
  const folded = entries.map(() => false);
  if (entries.every((entry) => entry.kind === "unchanged")) return folded;
  let i = 0;
  while (i < entries.length) {
    if (entries[i].kind !== "unchanged") {
      i += 1;
      continue;
    }
    let end = i;
    while (end < entries.length && entries[end].kind === "unchanged") end += 1;
    const leading = i > 0 ? 1 : 0;
    const trailing = end < entries.length ? 1 : 0;
    if (end - i > 2) {
      for (let k = i + leading; k < end - trailing; k += 1) folded[k] = true;
    }
    i = end;
  }
  return folded;
}

/** The runs of `entries` that `foldedEntries` folds, each a lined part of its blocks' ids. */
function foldedRuns(entries: readonly ChangeEntry[]): FoldedPart[] {
  const folded = foldedEntries(entries);
  const runs: FoldedPart[] = [];
  let run: string[] = [];
  entries.forEach(({ id }, index) => {
    if (folded[index]) {
      // An entry with no id has no fold to take, and the run goes on past it.
      if (id !== undefined) run.push(id);
      return;
    }
    if (run.length > 0) runs.push({ ids: run, line: true });
    run = [];
  });
  if (run.length > 0) runs.push({ ids: run, line: true });
  return runs;
}

/** Each removed entry's count by the id of the entry it stands after. */
function removedBy(after: readonly (string | undefined)[]): Map<string | undefined, number> {
  const counts = new Map<string | undefined, number>();
  for (const id of after) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** A change no fold hides: a removed block, or a changed heading above its section's body. */
const CHANGE: ChangeEntry = { id: undefined, kind: "changed" };

/** `count` removed entries. */
const removedEntries = (count = 0): ChangeEntry[] => Array.from({ length: count }, () => CHANGE);

/** Each entry, then the removed entries that stand after it. */
const withRemoved = (entries: readonly ChangeEntry[], removed: Map<string | undefined, number>) =>
  entries.flatMap((entry) => [
    entry,
    ...removedEntries(entry.id === undefined ? 0 : removed.get(entry.id)),
  ]);

/** The folds of a changed list's items. */
function itemRuns(block: MarkedBlock): FoldedPart[] {
  if (block.verdict.kind !== "list") return [];
  const removed = removedBy(block.verdict.removed.map(({ after }) => after));
  const items = block.verdict.results.map(({ id, verdict }) => ({ id, kind: verdict.kind }));
  const entries = [...removedEntries(removed.get(undefined)), ...withRemoved(items, removed)];
  return foldedRuns(entries);
}

/** The parts that "Only changes" folds in the document the marks drew. */
export function onlyChangesParts({ blocks, removedAfter }: Marked): FoldedPart[] {
  const removed = removedBy(removedAfter);
  return sectionsOf(blocks).flatMap((section, index) => {
    const [first] = section;
    const heading = first !== undefined && startsSection(first.node) ? first : undefined;
    const body = heading === undefined ? section : section.slice(1);
    // A change of the heading is a change above the body; the heading itself never folds.
    const entries: ChangeEntry[] = [
      ...(heading !== undefined && heading.verdict.kind !== "unchanged" ? [CHANGE] : []),
      ...removedEntries(index === 0 ? removed.get(undefined) : 0),
      ...removedEntries(heading?.id === undefined ? 0 : removed.get(heading.id)),
      ...withRemoved(
        body.map(({ id, verdict }) => ({ id, kind: verdict.kind })),
        removed
      ),
    ];
    if (entries.some(({ kind }) => kind !== "unchanged")) {
      return [...foldedRuns(entries), ...body.flatMap(itemRuns)];
    }
    // A section with no change folds to its heading alone; a preamble has none, so it takes a line.
    const ids = body.flatMap(({ id }) => (id === undefined ? [] : [id]));
    return ids.length === 0 ? [] : [{ ids, line: heading === undefined }];
  });
}
