// The block folds: each requirement, check and plan task folds to its head line.
import { blockIdOf } from "@legion/proof-editor/headless";
import type { Node } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";

import { FOLDING_TYPES, foldHead, kindOf, startOf, syncHeads } from "./fold-head";
import {
  type Folds,
  type FoldsKey,
  foldedNow,
  foldsPlugin,
  redrawFolds,
  setFoldQuery,
} from "./folds";
import type { Visit } from "./visit";
import { visitWiring } from "./visit-wiring";

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

const wiring = visitWiring<VisitFolds, BlockFolds>("block folds");

/** The block folds of an aided editor. */
export const blockFoldsOf = (view: EditorView): BlockFolds => wiring.of(view);

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
  const known = wiring.start(documentRef);
  let visit: VisitFolds = known ?? { choices: new Map() };
  // Until the visit is known, the reader's choices and the first comparison join it at its attach.
  let joins = known === undefined;
  let hasBlocks = false;
  const listeners = new Set<() => void>();
  const isFolded = (id: string) => !(visit.choices.get(id) ?? visit.touched?.has(id) ?? false);
  const changed = () => redrawFolds(view);
  const folds: BlockFolds = {
    folded: (doc) => new Set(foldingBlocks(doc).flatMap(({ id }) => (isFolded(id) ? [id] : []))),
    open: (blockIds) => {
      for (const id of blockIds) visit.choices.set(id, true);
    },
    attach: (next) => {
      wiring.attached(documentRef, next);
      if (next === visit) return;
      if (joins) {
        for (const [id, open] of visit.choices) {
          if (!next.choices.has(id)) next.choices.set(id, open);
        }
        next.touched ??= visit.touched;
      }
      visit = next;
      joins = false;
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
  const reset = () => {
    visit = { choices: new Map() };
    joins = true;
    changed();
  };
  return { folds, publish, reset };
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
  const { folds, publish, reset } = createBlockFolds(view, documentRef);
  const { key, plugin } = foldsPlugin("reading-aids-block-folds", folds);
  return [wiring.add(view, folds, reset), plugin, headsPlugin(folds, key, publish)];
}
