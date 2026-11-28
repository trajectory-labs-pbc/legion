// "Only changes": folds what no change touched, with the fold primitive of the block folds.
import { blockIdOf } from "@legion/proof-editor/headless";
import { textVariants } from "@legion/ui/lib/typography";
import { cn } from "@legion/ui/lib/utils";
import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import type { EditorHandle } from "@upstream-dispatch/features/doc/editor";

import { type MarkedBlock, plural, sectionsOf, startsSection } from "./change-summary";
import { foldRow } from "./fold-head";
import {
  type Folds,
  type FoldsKey,
  foldedNow,
  foldsMatching,
  foldsPlugin,
  redrawFolds,
} from "./folds";
import { drawnChanges, type Marked, markedBlocks } from "./marks-plugin";
import { moveToBlock } from "./moves";
import { measured } from "./timing";
import { type FoldedPart, type OnlyChangesFolds, onForget, type Visit } from "./visit";

/** The class each block that "Only changes" folds takes beside the fold's own. */
export const ONLY_CHANGES_FOLD = "reading-aids-only-changes";

/** The attribute of a fold line, which holds the id of the part's first block. */
export const FOLD_LINE_ATTRIBUTE = "data-reading-aids-fold-line";

interface ChangeEntry {
  /** "unchanged", or the change. */
  readonly kind: string;
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

/** The runs of `entries` that fold, each as its blocks' ids: every entry, or `foldedEntries`'. */
function foldedRuns(entries: readonly ChangeEntry[], whole: boolean): string[][] {
  const folded = whole ? entries.map(() => true) : foldedEntries(entries);
  const runs: string[][] = [];
  let run: string[] = [];
  entries.forEach(({ id }, index) => {
    if (folded[index] && id !== undefined) {
      run.push(id);
      return;
    }
    if (run.length > 0) runs.push(run);
    run = [];
  });
  if (run.length > 0) runs.push(run);
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
  return foldedRuns(entries, false).map((ids) => ({ ids, line: true }));
}

/** The parts that "Only changes" folds in the document the marks drew. */
function onlyChangesParts({ blocks, removedAfter }: Marked): FoldedPart[] {
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
    const changed = entries.some(({ kind }) => kind !== "unchanged");
    // A section with no change folds to its heading alone; a preamble has none, so it takes a line.
    const line = changed || heading === undefined;
    const runs = foldedRuns(entries, !changed).map((ids) => ({ ids, line }));
    return changed ? [...runs, ...body.flatMap(itemRuns)] : runs;
  });
}

/** "Only changes" of one editor, kept in the document's visit. */
export interface OnlyChanges extends Folds {
  /** Takes the visit's choice, so a new editor of the document keeps it and its folds. */
  attach(visit: Visit["onlyChanges"]): void;
  isOn(): boolean;
  /** Turns it on, folding by the marks drawn, the parts that hold `term` left open; or off. */
  toggle(term: string | undefined): void;
  /** Makes the folds again while it is on, once the marks drawn compare with a new baseline. */
  follow(term: string | undefined): void;
  /** Turns it off: the marks it folded by are gone. */
  clear(): void;
  subscribe(listener: () => void): () => void;
}

const byView = new WeakMap<EditorView, OnlyChanges>();

/** Each document's last attached visit choice, which a new editor of it starts from. */
const byDocument = new Map<string, Visit["onlyChanges"]>();

/** Each live editor's reset to no choice. */
const resets = new Map<EditorView, () => void>();

// A forgotten visit's choice ends in every editor; a drawn part then attaches the new visit.
onForget(() => {
  byDocument.clear();
  for (const reset of resets.values()) reset();
});

/** The "Only changes" of an aided editor. */
export function onlyChangesOf(view: EditorView): OnlyChanges {
  const only = byView.get(view);
  if (only === undefined) throw new Error("the editor has no Only changes");
  return only;
}

/** The folds of the marks drawn in `view`, less the parts that hold `term`. */
function made(view: EditorView, term: string | undefined): OnlyChangesFolds | undefined {
  const marked = markedBlocks(view);
  const drawn = drawnChanges(view);
  if (marked === undefined || drawn === undefined) return undefined;
  let parts = onlyChangesParts(marked);
  if (term !== undefined && term !== "") {
    const all = new Set(parts.flatMap(({ ids }) => ids));
    const matching = new Set(foldsMatching(view.state.doc, all, term));
    parts = parts.filter(({ ids }) => !ids.some((id) => matching.has(id)));
  }
  return { baseline: drawn.baseline, folded: new Set(parts.flatMap(({ ids }) => ids)), parts };
}

const lineText = (count: number, inList: boolean) => {
  const one = inList ? "unchanged item" : "unchanged block";
  return count > 99 ? `99+ ${one}s` : plural(count, one);
};

/** A part's fold line: a button that opens it; an item of the list in a list. */
function foldLine(firstId: string, count: number, inList: boolean, open: () => void) {
  const { button, row } = foldRow(inList ? "li" : "div", {
    attribute: FOLD_LINE_ATTRIBUTE,
    blockId: firstId,
    buttonClass: cn(textVariants({ tone: "muted" }), "tabular-nums"),
    className: "reading-aids-fold-line",
    expanded: false,
  });
  button.textContent = lineText(count, inList);
  button.addEventListener("click", open);
  return row;
}

/**
 * A fold line after the last block of each folded part that a line names, so the part's
 * zero-height blocks, and the margin cards placed at them, sit at the line's top.
 */
function drawLines(
  doc: Node,
  folded: ReadonlySet<string>,
  parts: readonly FoldedPart[],
  open: (id: string) => void
) {
  const byLast = new Map<string, { count: number; first: string }>();
  for (const { ids, line } of parts) {
    const [first] = ids;
    const last = ids.at(-1);
    if (line && first !== undefined && last !== undefined && folded.has(first)) {
      byLast.set(last, { count: ids.length, first });
    }
  }
  if (byLast.size === 0) return DecorationSet.empty;
  const lines: Decoration[] = [];
  doc.descendants((node, pos, parent) => {
    const id = blockIdOf(node);
    const part = id === null ? undefined : byLast.get(id);
    if (part === undefined) return !node.isTextblock;
    const { count, first } = part;
    const inList = parent?.type.name.endsWith("_list") ?? false;
    lines.push(
      Decoration.widget(
        pos + node.nodeSize,
        () => foldLine(first, count, inList, () => open(first)),
        {
          ignoreSelection: true,
          key: `fold-line:${first}:${count}:${inList}`,
          // Before the next block's own head.
          side: -1,
          stopEvent: () => true,
        }
      )
    );
    return false;
  });
  return DecorationSet.create(doc, lines);
}

/** "Only changes" of `view`, starting from the last visit choice of `documentRef`. */
function createOnlyChanges(view: EditorView, documentRef: string) {
  let visit: Visit["onlyChanges"] = byDocument.get(documentRef) ?? {};
  const listeners = new Set<() => void>();
  const changed = () => {
    redrawFolds(view);
    for (const listener of listeners) listener();
  };
  /** Unfolds the parts that hold `blockIds`; true when it unfolded a block beyond them. */
  const unfold = (blockIds: ReadonlySet<string>) => {
    const folds = visit.made;
    if (folds === undefined) return false;
    let more = false;
    for (const { ids } of folds.parts) {
      if (!ids.some((id) => blockIds.has(id))) continue;
      for (const id of ids) {
        if (folds.folded.delete(id) && !blockIds.has(id)) more = true;
      }
    }
    return more;
  };
  resets.set(view, () => {
    visit = {};
    changed();
  });
  const only: OnlyChanges = {
    folded: () => new Set(visit.made?.folded),
    open: (blockIds) => {
      // The rest of a part the reader reached opens once this transaction is drawn.
      if (unfold(blockIds)) queueMicrotask(() => redrawFolds(view));
    },
    attach: (next) => {
      byDocument.set(documentRef, next);
      if (next === visit) return;
      visit = next;
      changed();
    },
    isOn: () => visit.made !== undefined,
    toggle: (term) => {
      visit.made = visit.made === undefined ? made(view, term) : undefined;
      changed();
    },
    follow: (term) => {
      const baseline = drawnChanges(view)?.baseline;
      if (visit.made === undefined || baseline === undefined || baseline === visit.made.baseline)
        return;
      visit.made = made(view, term);
      changed();
    },
    clear: () => {
      if (visit.made === undefined) return;
      visit.made = undefined;
      changed();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    only,
    openPart: (blockId: string) => {
      unfold(new Set([blockId]));
      redrawFolds(view);
    },
    parts: () => visit.made?.parts ?? [],
  };
}

/** The fold lines, drawn from the folds' state and the parts they fold. */
function linesPlugin(
  foldsKey: FoldsKey,
  parts: () => readonly FoldedPart[],
  open: (id: string) => void
): Plugin {
  let last: { doc: Node; folded: ReadonlySet<string>; lines: DecorationSet } | undefined;
  return new Plugin({
    key: new PluginKey("reading-aids-fold-lines"),
    // A reconfigure also destroys a plugin's view, so only an editor's own end drops its reset.
    view: (view) => ({
      destroy: () =>
        queueMicrotask(() => {
          if (view.isDestroyed) resets.delete(view);
        }),
    }),
    props: {
      decorations: (state) => {
        const folded = foldedNow(foldsKey, state);
        if (last?.doc !== state.doc || last.folded !== folded) {
          const lines = measured("folds", () => drawLines(state.doc, folded, parts(), open));
          last = { doc: state.doc, folded, lines };
        }
        return last.lines;
      },
    },
  });
}

/** The plugins of "Only changes" for `editor` on `host`, which `onlyChangesOf` then gives. */
export function onlyChangesPlugins(
  editor: EditorHandle,
  host: HTMLElement,
  documentRef: string
): Plugin[] {
  const { only, openPart, parts } = createOnlyChanges(editor.view, documentRef);
  byView.set(editor.view, only);
  const { key, plugin } = foldsPlugin(ONLY_CHANGES_FOLD, only);
  // A fold line's button goes as its part opens: the focus moves to the part's first block.
  const open = (blockId: string) => {
    openPart(blockId);
    moveToBlock({ editor, host }, blockId, "key");
  };
  return [plugin, linesPlugin(key, parts, open)];
}
