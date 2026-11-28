// Blocks folded by id, which the reader's moves open.

import type { Node, ResolvedPos } from "@milkdown/kit/prose/model";
import {
  type EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
  type Transaction,
} from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import { blockIdOf } from "@/upstream/editor/engine";
import { BLOCK_ID_ATTRIBUTE } from "@/upstream/editor/frame";

import { textOf } from "./compare";

/** The meta of a transaction that asks each fold to open the block it names, by id. */
export const REVEAL_BLOCK = "revealBlock";

/** The meta that gives the folds the page's `?q=` term, which opens each fold it matches in. */
const FOLD_QUERY = "readingAidsFoldQuery";

/** The meta that draws the folds again after their owner changed its set. */
const FOLDS_CHANGED = "readingAidsFoldsChanged";

/** y-prosemirror's sync key, read by name as the app does not depend on y-prosemirror; block-folds.test.ts's two-editor remote-edit case fails if it is renamed. */
const Y_SYNC = "y-sync$";

/** The class of a folded block: a zero-height box at its fold line (`aids.css`). */
export const FOLDED_CLASS = "reading-aids-folded";

/** One owner's set of folded blocks. */
export interface Folds {
  /** The ids of the blocks of `doc` that are folded now. */
  folded(doc: Node): ReadonlySet<string>;
  /** Records that the reader reached these folded blocks, so they stay open. */
  open(blockIds: ReadonlySet<string>): void;
}

interface FoldsState {
  readonly decorations: DecorationSet;
  /** The blocks drawn folded. */
  readonly folded: ReadonlySet<string>;
  /** The blocks opened by the transactions that made this state since the owner last recorded. */
  readonly opened: ReadonlySet<string>;
}

/** Asks each fold of the aids to open the block `blockId` and each fold around it. */
export function revealBlock(view: EditorView, blockId: string): void {
  if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(REVEAL_BLOCK, blockId));
}

/** Opens each fold that holds the page's `?q=` term, as upstream highlights it. */
export function setFoldQuery(view: EditorView, term: string): void {
  if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(FOLD_QUERY, term));
}

/** Draws each fold again from its owner's set. */
export function redrawFolds(view: EditorView): void {
  if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(FOLDS_CHANGED, true));
}

/** A block's text, its paragraphs joined by a space. */

/** The blocks around `$pos`, outermost first. */
const ancestors = ($pos: ResolvedPos): Node[] =>
  Array.from({ length: $pos.depth }, (_, depth) => $pos.node(depth + 1));

/** The folded blocks among `nodes`. */
function foldedOf(nodes: readonly Node[], folded: ReadonlySet<string>): string[] {
  return nodes.flatMap((node) => {
    const id = blockIdOf(node);
    return id !== null && folded.has(id) ? [id] : [];
  });
}

/** The folds that hide the block `blockId`: its own and each around it. */
function foldsHiding(doc: Node, folded: ReadonlySet<string>, blockId: string): string[] {
  let hiding: string[] = [];
  doc.descendants((node, pos) => {
    if (hiding.length > 0) return false;
    if (blockIdOf(node) === blockId) {
      hiding = foldedOf([...ancestors(doc.resolve(pos)), node], folded);
    }
    return !node.isTextblock;
  });
  return hiding;
}

/** The texts of `node` upstream's highlight finds: its text, and each attribute's name and value. */
function* searchedTexts(node: Node): Generator<string> {
  for (const [name, value] of Object.entries(node.attrs)) {
    const text = Array.isArray(value) ? value.join(" ") : value;
    if (name === "blockId" || typeof text !== "string" || text === "") continue;
    yield name;
    yield text;
  }
  yield textOf(node);
}

/** The folded blocks that hold `term`, in any case. */
function foldsMatching(doc: Node, folded: ReadonlySet<string>, term: string): string[] {
  const lower = term.toLowerCase();
  const matching: string[] = [];
  doc.descendants((node) => {
    const id = blockIdOf(node);
    if (id !== null && folded.has(id)) {
      for (const text of searchedTexts(node)) {
        if (!text.toLowerCase().includes(lower)) continue;
        matching.push(id);
        break;
      }
    }
    return !node.isTextblock;
  });
  return matching;
}

/** Whether a step of `transaction` replaces content within `from`..`to` of its new doc. */
function edits(transaction: Transaction, from: number, to: number): boolean {
  const { mapping } = transaction;
  return mapping.maps.some((map, index) => {
    const rest = mapping.slice(index + 1);
    let touched = false;
    const before = transaction.docs[index]?.content.size;
    map.forEach((oldFrom, oldTo, newFrom, newTo) => {
      // A step that replaces the whole document, as a load does, edits no block of it.
      if (oldFrom === 0 && oldTo === before) return;
      if (rest.map(newFrom, -1) <= to && rest.map(newTo, 1) >= from) touched = true;
    });
    return touched;
  });
}

function isRemote(transaction: Transaction): boolean {
  const meta: unknown = transaction.getMeta(Y_SYNC);
  return (
    typeof meta === "object" &&
    meta !== null &&
    "isChangeOrigin" in meta &&
    meta.isChangeOrigin === true
  );
}

/** The folds a transaction opens: a reveal, the reader's caret or edit in a fold, or a `?q=`. */
function foldsOpenedBy(transaction: Transaction, folded: ReadonlySet<string>): Set<string> {
  const opened = new Set<string>();
  if (folded.size === 0) return opened;
  const { doc, selection } = transaction;
  const revealed: unknown = transaction.getMeta(REVEAL_BLOCK);
  if (typeof revealed === "string") {
    for (const id of foldsHiding(doc, folded, revealed)) opened.add(id);
  }
  // A remote edit maps the caret, which opens nothing; a local one opens only the folds it edits.
  if ((transaction.selectionSet || transaction.docChanged) && !isRemote(transaction)) {
    const { $head } = selection;
    // A change kept out of the undo history, such as a stamp of block ids, is not the reader's.
    const edited = transaction.docChanged && transaction.getMeta("addToHistory") !== false;
    for (let depth = 1; depth <= $head.depth; depth++) {
      const id = blockIdOf($head.node(depth));
      if (id === null || !folded.has(id)) continue;
      if (
        transaction.selectionSet ||
        (edited && edits(transaction, $head.before(depth), $head.after(depth)))
      ) {
        opened.add(id);
      }
    }
    if (selection instanceof NodeSelection) {
      for (const id of foldedOf([selection.node], folded)) opened.add(id);
    }
  }
  const term: unknown = transaction.getMeta(FOLD_QUERY);
  if (typeof term === "string" && term !== "") {
    for (const id of foldsMatching(doc, folded, term)) opened.add(id);
  }
  return opened;
}

function draw(doc: Node, folded: ReadonlySet<string>): DecorationSet {
  if (folded.size === 0) return DecorationSet.empty;
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    const id = blockIdOf(node);
    if (id === null || !folded.has(id)) return !node.isTextblock;
    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, { "aria-hidden": "true", class: FOLDED_CLASS })
    );
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

function stateOf(doc: Node, folded: ReadonlySet<string>, opened: ReadonlySet<string>): FoldsState {
  const shown = opened.size === 0 ? folded : new Set([...folded].filter((id) => !opened.has(id)));
  return { decorations: draw(doc, shown), folded: shown, opened };
}

const NONE: ReadonlySet<string> = new Set();

export type FoldsKey = PluginKey<FoldsState>;

/** The fold a focus at `target` reaches: the fold around it, or around the caret on the text. */
function foldFocused(
  view: EditorView,
  target: EventTarget | null,
  folded: ReadonlySet<string>,
  pointing: boolean
) {
  if (target === view.dom) {
    return pointing ? undefined : foldedOf(ancestors(view.state.selection.$head), folded).at(-1);
  }
  const element = target instanceof Element ? target.closest(`.${FOLDED_CLASS}`) : null;
  return element?.getAttribute(BLOCK_ID_ATTRIBUTE) ?? undefined;
}

/** Folds the blocks `folds` names, by block id; a move, the caret, an edit, a focus or `?q=` opens one. */
export function foldsPlugin(name: string, folds: Folds): { key: FoldsKey; plugin: Plugin } {
  const key = new PluginKey<FoldsState>(name);
  // A click's focus comes before the caret it sets, which opens a fold itself; the press ends
  // wherever the main button is released or cancelled, a head's button too.
  let press: AbortController | undefined;
  // The opened set the owner recorded last; a newer one, from earlier in a dispatch, stays open.
  let recorded = NONE;
  const plugin = new Plugin<FoldsState>({
    key,
    state: {
      init: (_config, state) => stateOf(state.doc, folds.folded(state.doc), NONE),
      apply: (transaction, value, _old, state: EditorState) => {
        const redraw = transaction.docChanged || transaction.getMeta(FOLDS_CHANGED) === true;
        const folded = redraw ? folds.folded(state.doc) : value.folded;
        const opened = foldsOpenedBy(transaction, folded);
        if (!redraw && opened.size === 0) return value;
        const pending = value.opened === recorded ? NONE : value.opened;
        return stateOf(
          state.doc,
          folded,
          pending.size === 0 ? opened : new Set([...pending, ...opened])
        );
      },
    },
    props: {
      decorations: (state) => key.getState(state)?.decorations,
      handleDOMEvents: {
        pointerdown: (view, event) => {
          if (event.button !== 0) return false;
          press?.abort();
          const ended = new AbortController();
          press = ended;
          const end = () => ended.abort();
          for (const type of ["pointerup", "pointercancel"]) {
            view.root.addEventListener(type, end, { capture: true, signal: ended.signal });
          }
          return false;
        },
        // A hidden link or field that takes the focus opens its fold, so no focus is lost in one.
        focusin: (view, event) => {
          const folded = foldedNow(key, view.state);
          const id = foldFocused(view, event.target, folded, press?.signal.aborted === false);
          if (id !== undefined) revealBlock(view, id);
          return false;
        },
      },
    },
    view: () => ({
      update: (view) => {
        const now = key.getState(view.state);
        if (now === undefined || now.opened === recorded) return;
        recorded = now.opened;
        if (now.opened.size > 0) folds.open(now.opened);
      },
      destroy: () => press?.abort(),
    }),
  });
  return { key, plugin };
}

/** The blocks a folds plugin draws folded now. */
export function foldedNow(key: FoldsKey, state: EditorState): ReadonlySet<string> {
  return key.getState(state)?.folded ?? NONE;
}
