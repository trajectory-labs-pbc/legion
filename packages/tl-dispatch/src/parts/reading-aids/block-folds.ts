// The block folds: each requirement, check and plan task folds to its head line.

import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { blockIdOf } from "@/upstream/editor/engine";

import { FOLDING_TYPES, foldHead, kindOf, startOf, syncHeads } from "./fold-head";
import {
  type Folds,
  type FoldsKey,
  foldedNow,
  foldsPlugin,
  redrawFolds,
  setFoldQuery,
} from "./folds";
import { onForget, type Visit } from "./visit";

type VisitFolds = Visit["blockFolds"];

/** The reader's folds of one editor's blocks, kept in the document's visit once it is known. */
export interface BlockFolds extends Folds {
  /** Takes the visit's folds, so a new editor of the document keeps them. */
  attach(visit: VisitFolds): void;
  /** Records the first comparison's touched blocks, once: they start open and `toggleAll` keeps them. */
  setTouched(blockIds: ReadonlySet<string>): void;
  /** Opens each fold that holds the page's `?q=` term, once for each new term of the visit. */
  query(term: string | undefined): void;
  toggle(blockId: string): void;
  /** Opens every folded block when one is, else folds each block no change touched. */
  toggleAll(): void;
  /** Whether the document has a foldable block. */
  hasBlocks(): boolean;
  subscribe(listener: () => void): () => void;
}

const byView = new WeakMap<EditorView, BlockFolds>();

/** Each document's last attached visit folds, which a new editor of it starts from. */
const byDocument = new Map<string, VisitFolds>();

/** The editors whose document is not known yet, each with the reset of its own choices. */
const unattached = new Map<EditorView, () => void>();

onForget(() => {
  byDocument.clear();
  for (const reset of unattached.values()) reset();
});

/** The block folds of an aided editor. */
export function blockFoldsOf(view: EditorView): BlockFolds {
  const folds = byView.get(view);
  if (folds === undefined) throw new Error("the editor has no block folds");
  return folds;
}

interface FoldingBlock {
  readonly id: string;
  readonly node: Node;
  readonly pos: number;
}

/** The foldable blocks of `doc`, in document order. */
function foldingBlocks(doc: Node): FoldingBlock[] {
  const blocks: FoldingBlock[] = [];
  doc.descendants((node, pos) => {
    const id = blockIdOf(node);
    if (id !== null && FOLDING_TYPES.has(node.type.name)) blocks.push({ id, node, pos });
    return !node.isTextblock;
  });
  return blocks;
}

function createBlockFolds(view: EditorView, documentRef: string) {
  let visit: VisitFolds = byDocument.get(documentRef) ?? { choices: new Map() };
  let hasBlocks = false;
  const listeners = new Set<() => void>();
  const isFolded = (id: string) => !(visit.choices.get(id) ?? visit.touched?.has(id) ?? false);
  const changed = () => redrawFolds(view);
  if (!byDocument.has(documentRef)) {
    unattached.set(view, () => {
      visit = { choices: new Map() };
      changed();
    });
  }
  const folds: BlockFolds = {
    folded: (doc) => new Set(foldingBlocks(doc).flatMap(({ id }) => (isFolded(id) ? [id] : []))),
    open: (blockIds) => {
      for (const id of blockIds) visit.choices.set(id, true);
    },
    attach: (next) => {
      byDocument.set(documentRef, next);
      if (next === visit) return;
      // What was chosen and compared before the visit was known joins it; a forgotten visit's does not.
      if (unattached.has(view)) {
        for (const [id, open] of visit.choices) {
          if (!next.choices.has(id)) next.choices.set(id, open);
        }
        next.touched ??= visit.touched;
      }
      visit = next;
      unattached.delete(view);
      changed();
    },
    setTouched: (blockIds) => {
      if (visit.touched !== undefined) return;
      visit.touched = blockIds;
      changed();
    },
    query: (term) => {
      if (term === visit.term) return;
      visit.term = term;
      if (term !== undefined) setFoldQuery(view, term);
    },
    toggle: (id) => {
      visit.choices.set(id, isFolded(id));
      changed();
    },
    toggleAll: () => {
      const ids = foldingBlocks(view.state.doc).map(({ id }) => id);
      if (ids.some(isFolded)) for (const id of ids) visit.choices.set(id, true);
      else for (const id of ids) if (!visit.touched?.has(id)) visit.choices.set(id, false);
      changed();
    },
    hasBlocks: () => hasBlocks,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const publish = (next: boolean) => {
    if (next === hasBlocks) return;
    hasBlocks = next;
    for (const listener of listeners) listener();
  };
  return { folds, publish };
}

/** A head widget before each foldable block, keyed by its id and kind, so an edit keeps it. */
function drawHeads(doc: Node, foldsKey: FoldsKey, toggle: (id: string) => void): DecorationSet {
  const heads = foldingBlocks(doc).map(({ id, node, pos }) =>
    Decoration.widget(
      pos,
      (view) => foldHead(node, id, foldedNow(foldsKey, view.state).has(id), toggle),
      { ignoreSelection: true, key: `fold-head:${id}:${kindOf(node)}`, stopEvent: () => true }
    )
  );
  return DecorationSet.create(doc, heads);
}

/** The heads, which show the folds' state and the start of each block's text. */
function headsPlugin(folds: BlockFolds, foldsKey: FoldsKey, publish: (has: boolean) => void) {
  const key = new PluginKey<DecorationSet>("reading-aids-fold-heads");
  const sync = (view: EditorView) => {
    const blocks = foldingBlocks(view.state.doc);
    const starts = new Map(blocks.map(({ id, node }) => [id, startOf(node)]));
    syncHeads(view.dom, foldedNow(foldsKey, view.state), starts);
    publish(blocks.length > 0);
  };
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: (_config, state) => drawHeads(state.doc, foldsKey, folds.toggle),
      apply: (transaction, set) =>
        transaction.docChanged ? drawHeads(transaction.doc, foldsKey, folds.toggle) : set,
    },
    props: { decorations: (state) => key.getState(state) },
    view: (view) => {
      sync(view);
      return {
        // Each new set of plugins destroys this view, so the drop waits for the editor's end.
        destroy: () =>
          queueMicrotask(() => {
            if (view.isDestroyed || key.get(view.state) === undefined) unattached.delete(view);
          }),
        update: (next, previous) => {
          const changed =
            key.getState(next.state) !== key.getState(previous) ||
            foldsKey.getState(next.state) !== foldsKey.getState(previous);
          if (changed) sync(next);
        },
      };
    },
  });
}

/** The block folds' plugins for `view`, whose folds `blockFoldsOf` then gives. */
export function blockFoldsPlugins(view: EditorView, documentRef: string): Plugin[] {
  const { folds, publish } = createBlockFolds(view, documentRef);
  byView.set(view, folds);
  const { key, plugin } = foldsPlugin("reading-aids-block-folds", folds);
  return [plugin, headsPlugin(folds, key, publish)];
}
