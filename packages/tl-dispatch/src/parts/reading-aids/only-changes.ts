// "Only changes": folds what no change touched, with the fold primitive of the block folds.
import { textVariants } from "@legion/ui/lib/typography";
import { cn } from "@legion/ui/lib/utils";
import type { Node } from "@milkdown/kit/prose/model";
import { type EditorState, Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { blockIdOf } from "@/upstream/editor/engine";
import type { EditorHandle } from "@/upstream/editor/frame";

import { shownPlural } from "./change-summary";
import { foldRow } from "./fold-head";
import {
  type Folds,
  type FoldsKey,
  foldedNow,
  foldsMatching,
  foldsPlugin,
  redrawFolds,
} from "./folds";
import { drawnChanges, markedBlocks } from "./marks-plugin";
import { moveToBlock } from "./moves";
import { type FoldedPart, type OnlyChangesFolds, onlyChangesParts } from "./only-changes-parts";
import { measuredRedraw } from "./timing";
import type { Visit } from "./visit";
import { visitWiring } from "./visit-wiring";

/** The class each block that "Only changes" folds takes beside the fold's own. */
export const ONLY_CHANGES_FOLD = "reading-aids-only-changes";

/** The attribute of a fold line, which holds the id of the part's first block. */
export const FOLD_LINE_ATTRIBUTE = "data-reading-aids-fold-line";

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

const wiring = visitWiring<Visit["onlyChanges"], OnlyChanges>("Only changes");

const NONE: ReadonlySet<string> = new Set();

/** The "Only changes" of an aided editor. */
export const onlyChangesOf = (view: EditorView): OnlyChanges => wiring.of(view);

/** The folds of the marks drawn in `view`, less the parts that hold `term`. */
function foldsOf(view: EditorView, term: string | undefined): OnlyChangesFolds | undefined {
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

/** A part's fold line: a button that opens it; an item of the list in a list. */
function foldLine(firstId: string, count: number, inList: boolean, open: () => void) {
  const { button, row } = foldRow(inList ? "li" : "div", {
    attribute: FOLD_LINE_ATTRIBUTE,
    blockId: firstId,
    buttonClass: cn(textVariants({ tone: "muted" }), "tabular-nums"),
    className: "reading-aids-fold-line",
    expanded: false,
  });
  button.textContent = shownPlural(count, inList ? "unchanged item" : "unchanged block");
  button.addEventListener("click", open);
  return row;
}

interface Shown {
  readonly count: number;
  readonly end: number;
  readonly first: string;
  readonly inList: boolean;
}

/** A line after each lined part's last folded block still in `doc`, counting those, so its zero-height blocks and their cards sit at its top. */
function drawLines(
  doc: Node,
  folded: ReadonlySet<string>,
  parts: readonly FoldedPart[],
  open: (id: string) => void
) {
  const partOf = new Map<string, FoldedPart>();
  for (const part of parts) if (part.line) for (const id of part.ids) partOf.set(id, part);
  if (partOf.size === 0) return DecorationSet.empty;
  const shown = new Map<FoldedPart, Shown>();
  doc.descendants((node, pos, parent) => {
    const id = blockIdOf(node);
    const part = id === null ? undefined : partOf.get(id);
    if (id === null || part === undefined) return !node.isTextblock;
    if (folded.has(id)) {
      const before = shown.get(part);
      shown.set(part, {
        count: (before?.count ?? 0) + 1,
        end: pos + node.nodeSize,
        first: before?.first ?? id,
        inList: parent?.type.name.endsWith("_list") ?? false,
      });
    }
    return false;
  });
  const lines = [...shown.values()].map(({ count, end, first, inList }) =>
    Decoration.widget(end, () => foldLine(first, count, inList, () => open(first)), {
      ignoreSelection: true,
      key: `fold-line:${first}:${count}:${inList}`,
      // Before the next block's own head.
      side: -1,
      stopEvent: () => true,
    })
  );
  return DecorationSet.create(doc, lines);
}

/** "Only changes" of `view`, starting from the last visit choice of `documentRef`. */
function createOnlyChanges(view: EditorView, documentRef: string) {
  // visit.made is written in place, never through update(): each editor reads the folds from its
  // own plugin state, and no React reader subscribes to them.
  let visit: Visit["onlyChanges"] = wiring.start(documentRef) ?? {};
  const listeners = new Set<() => void>();
  const changed = () => {
    redrawFolds(view);
    for (const listener of listeners) listener();
  };
  /** Unfolds the parts that hold `blockIds`; true when it unfolded a block beyond them. */
  const unfold = (blockIds: ReadonlySet<string>) => {
    const folds = visit.made;
    if (folds === undefined) return false;
    const folded = new Set(folds.folded);
    let more = false;
    for (const { ids } of folds.parts) {
      if (!ids.some((id) => blockIds.has(id))) continue;
      for (const id of ids) {
        if (folded.delete(id) && !blockIds.has(id)) more = true;
      }
    }
    // A new set, so the lines know the folds changed.
    if (folded.size !== folds.folded.size) visit.made = { ...folds, folded };
    return more;
  };
  const only: OnlyChanges = {
    folded: () => visit.made?.folded ?? NONE,
    open: (blockIds) => {
      // The rest of a part the reader reached opens once this transaction is drawn.
      if (unfold(blockIds)) queueMicrotask(() => redrawFolds(view));
    },
    attach: (next) => {
      wiring.attached(documentRef, next);
      if (next === visit) return;
      visit = next;
      changed();
    },
    isOn: () => visit.made !== undefined,
    toggle: (term) => {
      visit.made = visit.made === undefined ? foldsOf(view, term) : undefined;
      changed();
    },
    follow: (term) => {
      const baseline = drawnChanges(view)?.baseline;
      if (visit.made === undefined || baseline === undefined || baseline === visit.made.baseline)
        return;
      visit.made = foldsOf(view, term);
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
    reset: () => {
      visit = {};
      changed();
    },
    openPart: (blockId: string) => {
      unfold(new Set([blockId]));
      redrawFolds(view);
    },
    parts: () => visit.made?.parts ?? [],
  };
}

interface LinesState {
  readonly folded: ReadonlySet<string>;
  readonly lines: DecorationSet;
}

/** The fold lines: drawn when the folded set changes, else mapped through each edit. */
function linesPlugin(
  foldsKey: FoldsKey,
  parts: () => readonly FoldedPart[],
  open: (id: string) => void
): Plugin<LinesState> {
  const key = new PluginKey<LinesState>("reading-aids-fold-lines");
  const drawn = (doc: Node, folded: ReadonlySet<string>): LinesState => ({
    folded,
    lines: drawLines(doc, folded, parts(), open),
  });
  return new Plugin<LinesState>({
    key,
    state: {
      init: (_config, state) => drawn(state.doc, foldedNow(foldsKey, state)),
      apply: (transaction, value, _old, state: EditorState) => {
        const folded = foldedNow(foldsKey, state);
        if (folded === value.folded && !transaction.docChanged) return value;
        return measuredRedraw(transaction, () => {
          if (folded !== value.folded) return drawn(state.doc, folded);
          // A remote edit replaces the whole document, which drops every line: they draw again.
          let dropped = false;
          const lines = value.lines.map(transaction.mapping, state.doc, {
            onRemove: () => {
              dropped = true;
            },
          });
          return dropped ? drawn(state.doc, folded) : { folded, lines };
        });
      },
    },
    props: { decorations: (state) => key.getState(state)?.lines },
  });
}

/** The plugins of "Only changes" for `editor` on `host`, which `onlyChangesOf` then gives. */
export function onlyChangesPlugins(
  editor: EditorHandle,
  host: HTMLElement,
  documentRef: string
): Plugin[] {
  const { only, openPart, parts, reset } = createOnlyChanges(editor.view, documentRef);
  const { key, plugin } = foldsPlugin("reading-aids-only-changes-folds", only, ONLY_CHANGES_FOLD);
  // A fold line's button goes as its part opens: the focus moves to the part's first block.
  const open = (blockId: string) => {
    openPart(blockId);
    moveToBlock({ editor, host }, blockId, "key");
  };
  return [wiring.add(editor.view, only, reset), plugin, linesPlugin(key, parts, open)];
}
