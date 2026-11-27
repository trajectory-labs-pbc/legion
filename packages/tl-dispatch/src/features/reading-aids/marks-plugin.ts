// The change marks, drawn by block id after each transaction, so a whole-document step keeps them.
import { blockIdOf } from "@legion/proof-editor/headless";
import type { Node } from "@milkdown/kit/prose/model";
import { type EditorState, Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { type Decoration, DecorationSet, type EditorView } from "@milkdown/kit/prose/view";
import type { ChangeBaseline } from "@upstream-dispatch/features/doc/change-marks";
import { specBlockMarks } from "@upstream-dispatch/features/doc/spec-marks";
import { sameChoice } from "./baseline";
import { type ChangeSummary, type MarkedBlock, sameSummary, summarize } from "./change-summary";
import { type BlockVerdict, NEW, UNCHANGED } from "./compare";
import { type Comparer, startComparer } from "./comparer";
import { viewListeners } from "./editor-doc";
import { blockPieces, type OpenFolds, type Piece, removedPiece } from "./mark-drawing";
import {
  type Against,
  type Compared,
  type ComparisonFailure,
  comparing,
  type Judged,
  newSession,
  type Session,
  type SessionMeta,
} from "./marks-session";
import { measured } from "./timing";

/** The counts of the marks drawn, and the baseline they compare with. */
export interface DrawnChanges extends Against {
  readonly summary: ChangeSummary;
}

interface MarksState {
  readonly against: Against | undefined;
  readonly compared: Compared | undefined;
  readonly decorations: DecorationSet;
  readonly drawn: DrawnChanges | undefined;
  readonly failed: ComparisonFailure | undefined;
  /** Each Retry compares the baseline again. */
  readonly attempt: number;
}

type MarksMeta =
  | SessionMeta
  | { readonly kind: "baseline"; readonly against: Against | undefined }
  | { readonly kind: "retry" };

const marksKey = new PluginKey<MarksState>("reading-aids-marks");

const EMPTY: MarksState = {
  against: undefined,
  attempt: 0,
  compared: undefined,
  decorations: DecorationSet.empty,
  drawn: undefined,
  failed: undefined,
};

function reduce(state: MarksState, meta: MarksMeta): MarksState {
  switch (meta.kind) {
    case "baseline": {
      const { against } = meta;
      if (against === undefined) return EMPTY;
      const { compared } = state;
      // Another choice of the same version names the marks drawn, with no new comparison.
      if (against.baseline === state.against?.baseline) {
        const { choice } = against;
        const named = compared?.baseline === against.baseline;
        return { ...state, against, compared: named ? { ...compared, choice } : compared };
      }
      // The marks of the last baseline stay until the new one's comparison ends.
      return { ...state, against, failed: undefined };
    }
    case "failed":
      // No marks of an earlier baseline stay under the new one's name.
      return meta.failed.baseline === state.against?.baseline && state.failed === undefined
        ? { ...state, compared: undefined, failed: meta.failed }
        : state;
    case "retry":
      return state.failed === undefined
        ? state
        : { ...state, attempt: state.attempt + 1, failed: undefined };
    case "compared":
      return meta.compared.baseline === state.against?.baseline
        ? { ...state, compared: meta.compared }
        : state;
    case "block": {
      const { compared } = state;
      if (compared?.baseline !== meta.baseline) return state;
      const judged = new Map(compared.judged).set(meta.id, meta.judged);
      return { ...state, compared: { ...compared, judged } };
    }
  }
}

/** Each removed baseline block after the nearest paired block above it that stays. */
function removedBlocks(compared: Compared, present: ReadonlySet<string>) {
  const drawn: { after: string | undefined; key: string; text: string }[] = [];
  let after: string | undefined;
  const add = (anchor: string | undefined) => {
    for (const { key, text } of compared.removed.get(anchor) ?? [])
      drawn.push({ after, key, text });
  };
  add(undefined);
  // `earlier` is in the baseline's order, so each removed block follows the one above it.
  for (const [id, { text }] of compared.earlier) {
    if (present.has(id)) after = id;
    else drawn.push({ after, key: `id:${id}`, text });
    add(id);
  }
  return drawn;
}

/** A paired block whose kind changed since its verdict reads as changed until it is compared. */
const KIND_CHANGED: BlockVerdict = { kind: "changed", words: [] };

/** A block's verdict while it has none of its own kind. */
function waitingVerdict(id: string | undefined, judged: Judged | undefined, compared: Compared) {
  if (id === undefined || !compared.earlier.has(id)) return NEW;
  return judged === undefined ? UNCHANGED : KIND_CHANGED;
}

/** One block's drawing, kept while its node and its verdict stay the same. */
interface Drawn {
  readonly earlier: Compared["earlier"];
  readonly judged: Judged | undefined;
  readonly verdict: BlockVerdict;
  readonly pieces: readonly Piece[];
}

function draw(
  state: MarksState,
  doc: Node,
  drawings: WeakMap<Node, Drawn>,
  opened: OpenFolds
): MarksState {
  const { compared } = state;
  if (compared === undefined)
    return { ...state, decorations: DecorationSet.empty, drawn: undefined };
  const decorations: Decoration[] = [];
  const blocks: MarkedBlock[] = [];
  const present = new Set<string>();
  const ends = new Map<string, number>();
  doc.forEach((node, start) => {
    const id = blockIdOf(node) ?? undefined;
    // A verdict on a block of another kind waits for the block's own comparison.
    const judged = id === undefined ? undefined : compared.judged.get(id);
    const fits = judged?.kind === node.type.name ? judged : undefined;
    let drawn = drawings.get(node);
    if (drawn === undefined || drawn.judged !== fits || drawn.earlier !== compared.earlier) {
      const verdict = fits?.verdict ?? waitingVerdict(id, judged, compared);
      const wordsShown = fits === undefined || fits.text === node.textContent;
      const pieces = blockPieces(node, verdict, id ?? `at-${start}`, wordsShown, opened);
      drawn = { earlier: compared.earlier, judged: fits, pieces, verdict };
      drawings.set(node, drawn);
    }
    for (const piece of drawn.pieces) decorations.push(piece(start));
    blocks.push({ id, node, verdict: drawn.verdict });
    if (id !== undefined) {
      present.add(id);
      ends.set(id, start + node.nodeSize);
    }
  });
  const removed = removedBlocks(compared, present);
  for (const { after, key, text } of removed) {
    const at = after === undefined ? 0 : (ends.get(after) ?? 0);
    decorations.push(removedPiece(0, key, text, "div", opened)(at));
  }
  const summary = summarize(
    blocks,
    removed.map(({ after }) => after)
  );
  const { baseline, choice } = compared;
  const last = state.drawn;
  const kept =
    last?.baseline === baseline &&
    sameChoice(last.choice, choice) &&
    sameSummary(last.summary, summary);
  return {
    ...state,
    decorations: DecorationSet.create(doc, decorations),
    drawn: kept ? last : { baseline, choice, summary },
  };
}

const listeners = viewListeners();

/** Calls `listener` after each change of the baseline, the counts or the failure, until the stop. */
export const watchChanges = listeners.subscribe;

function dispatchMeta(view: EditorView, meta: MarksMeta): void {
  if (!view.isDestroyed) {
    view.dispatch(view.state.tr.setMeta(marksKey, meta).setMeta("addToHistory", false));
  }
}

function notify(view: EditorView): void {
  // After the transaction, so a listener may dispatch one of its own.
  queueMicrotask(() => {
    if (!view.isDestroyed) listeners.call(view);
  });
}

/** Compares the document with `against`'s baseline, named by its choice; none shows no marks. */
export function compareWith(view: EditorView, against: Against | undefined): void {
  const shown = marksKey.getState(view.state)?.against;
  const same =
    shown === against ||
    (shown !== undefined &&
      against !== undefined &&
      shown.baseline === against.baseline &&
      sameChoice(shown.choice, against.choice));
  if (!same) dispatchMeta(view, { against, kind: "baseline" });
}

/** The counts of the marks drawn and their baseline: the last one's while a new one compares. */
export const drawnChanges = (view: EditorView): DrawnChanges | undefined =>
  marksKey.getState(view.state)?.drawn;

/** Why the comparison against `baseline` drew no marks, if it failed. */
export function comparisonFailure(
  view: EditorView,
  baseline: ChangeBaseline
): ComparisonFailure | undefined {
  const failed = marksKey.getState(view.state)?.failed;
  return failed?.baseline === baseline ? failed : undefined;
}

/** Compares the baseline again after a failure, on a new comparer. */
export function retryComparison(view: EditorView): void {
  dispatchMeta(view, { kind: "retry" });
}

/** Whether the change marks show, in place of upstream's mark of a block changed since a read. */
export function showsChangeMarks(view: EditorView): boolean {
  const state = marksKey.getState(view.state);
  return state?.against !== undefined && state.compared !== undefined && state.failed === undefined;
}

/** The class of upstream's mark of a block changed since the read mark, as its spec writes it. */
const CHANGED_SINCE_READ = specBlockMarks([], ["block"])[0]?.className;

/** Upstream's block marks, less its changed-since-read mark while the change marks show. */
export function besideChangeMarks<Mark extends { readonly className: string }>(
  view: EditorView,
  marks: readonly Mark[]
): readonly Mark[] {
  return showsChangeMarks(view)
    ? marks.filter((mark) => mark.className !== CHANGED_SINCE_READ)
    : marks;
}

/** The marks' session for `view`, driven by the plugin's state after each transaction. */
function sessionView(view: EditorView, start: () => Comparer, session: Session) {
  const current = () => marksKey.getState(view.state);
  const { compareDocument, sendChanged } = comparing(view, start, session, {
    against: () => current()?.against,
    compared: () => current()?.compared,
    dispatch: (meta) => dispatchMeta(view, meta),
  });
  return {
    update(_view: EditorView, previous: EditorState) {
      const state = current();
      const before = marksKey.getState(previous);
      if (state === undefined) return;
      const baseline = state.against?.baseline;
      if (
        baseline !== undefined &&
        (baseline !== before?.against?.baseline || state.attempt !== before?.attempt)
      ) {
        compareDocument(baseline);
      } else if (
        state.compared !== undefined &&
        state.compared.baseline === baseline &&
        view.state.doc !== previous.doc
      ) {
        sendChanged(state.compared);
      }
      if (
        state.drawn !== before?.drawn ||
        state.failed !== before?.failed ||
        baseline !== before?.against?.baseline
      ) {
        notify(view);
      }
    },
    destroy() {
      // Stopped once the editor ends; a new set of plugins keeps the session.
      queueMicrotask(() => {
        if (view.isDestroyed) session.comparer?.stop();
      });
    },
  };
}

/** The change marks' plugin; `start` makes the comparer, a worker's by default. */
export function changeMarksPlugin(start: () => Comparer = startComparer): Plugin<MarksState> {
  const drawings = new WeakMap<Node, Drawn>();
  const opened: OpenFolds = new Set();
  const sessions = new WeakMap<EditorView, Session>();
  const sessionOf = (view: EditorView) => {
    const session = sessions.get(view) ?? newSession();
    sessions.set(view, session);
    return session;
  };
  return new Plugin<MarksState>({
    key: marksKey,
    state: {
      init: () => EMPTY,
      apply(transaction, state) {
        const meta: MarksMeta | undefined = transaction.getMeta(marksKey);
        if (meta === undefined && !transaction.docChanged) return state;
        return measured("transaction", () => {
          const next = meta === undefined ? state : reduce(state, meta);
          if (next === state && next.compared === undefined) return state;
          return draw(next, transaction.doc, drawings, opened);
        });
      },
    },
    view: (view) => sessionView(view, start, sessionOf(view)),
    props: {
      // The gutter stays while a comparison may draw, so the first mark does not move the text.
      attributes: (state): Record<string, string> => {
        const marks = marksKey.getState(state);
        return marks?.against === undefined || marks.failed !== undefined
          ? {}
          : { class: "reading-aids-marked" };
      },
      decorations: (state) => marksKey.getState(state)?.decorations,
    },
  });
}
