// The marks' side that talks to the comparer: a document's comparison, then each changed block.
import { blockIdOf } from "@legion/proof-editor/headless";
import type { Node } from "@milkdown/kit/prose/model";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { ChangeBaseline } from "@upstream-dispatch/features/doc/change-marks";

import type { BaselineChoice } from "./baseline";
import {
  type Block,
  type BlockVerdict,
  type Comparison,
  type Earlier,
  type Pairs,
  type Removed,
  readBlock,
} from "./compare";
import type { Comparer } from "./comparer";
import { keyedRemoved } from "./mark-drawing";
import { measured } from "./timing";

/** A verdict, with the kind and the text of the block it judged. */
export interface Judged {
  readonly verdict: BlockVerdict;
  readonly kind: string;
  readonly text: string;
}

/** A baseline, and the choice that names it. */
export interface Against {
  readonly baseline: ChangeBaseline;
  readonly choice: BaselineChoice;
}

/** A removed baseline block's fold key and text. */
export interface RemovedFold {
  readonly key: string;
  readonly text: string;
}

/** The first comparison against one baseline, and each block compared again since. */
export interface Compared extends Against {
  /** Each paired block's baseline by its live id, in the baseline's order. */
  readonly earlier: ReadonlyMap<string, Earlier>;
  /** The unpaired baseline blocks, by the id of the live block they stand after. */
  readonly removed: ReadonlyMap<string | undefined, readonly RemovedFold[]>;
  readonly judged: ReadonlyMap<string, Judged>;
}

/** A comparison that drew no marks: the engine refused the baseline's text, or it failed. */
export interface ComparisonFailure {
  readonly baseline: ChangeBaseline;
  readonly refused: boolean;
}

/** What the session tells the marks' state. */
export type SessionMeta =
  | { readonly kind: "compared"; readonly compared: Compared }
  | {
      readonly kind: "block";
      readonly baseline: ChangeBaseline;
      readonly id: string;
      readonly judged: Judged;
    }
  | { readonly kind: "failed"; readonly failed: ComparisonFailure };

/** The marks' state the session reads, and its way to change it. */
export interface SessionPort {
  readonly against: () => Against | undefined;
  readonly compared: () => Compared | undefined;
  readonly dispatch: (meta: SessionMeta) => void;
}

/** One editor's comparer, kept while a new set of plugins replaces the plugins' views. */
export interface Session {
  comparer: Comparer | undefined;
  /** What each paired block was last sent as, and the nodes known to match it. */
  sent: Map<string, string>;
  checked: WeakSet<Node>;
}

export const newSession = (): Session => ({
  checked: new WeakSet(),
  comparer: undefined,
  sent: new Map(),
});

/** The first pairing against each baseline in the visit, so a new editor pairs as it did. */
const visitPairs = new WeakMap<ChangeBaseline, Pairs>();

/** What a block was sent as, so a block sent unchanged is not sent again. */
const signatureOf = (block: Block) => JSON.stringify(block);

/** The comparison of each live block's id, with the block it was sent as. */
function judgedOf(comparison: Comparison, sent: ReadonlyMap<string, Block>) {
  const judged = new Map<string, Judged>();
  for (const { id, verdict } of comparison.results) {
    if (id === undefined) continue;
    const block = sent.get(id);
    if (block !== undefined) judged.set(id, { kind: block.kind, text: block.text, verdict });
  }
  return judged;
}

/** The removed blocks' folds, by the id of the block each stands after. */
function removedByAnchor(removed: readonly Removed[]) {
  const groups = new Map<string | undefined, RemovedFold[]>();
  for (const { after, key, text } of keyedRemoved(removed)) {
    const group = groups.get(after);
    if (group === undefined) groups.set(after, [{ key, text }]);
    else group.push({ key, text });
  }
  return groups;
}

/** Compares the document with each baseline, then each paired block whose text changed. */
export function comparing(
  view: EditorView,
  start: () => Comparer,
  session: Session,
  port: SessionPort
) {
  /** Ends the comparison against `baseline`; only a failed worker drops the comparer. */
  const failed = (baseline: ChangeBaseline, what: string) => (error: unknown) => {
    // An editor's end stops its comparison.
    if (view.isDestroyed) return;
    console.error(`Dispatch: ${what}`, error);
    const running = session.comparer;
    if (running?.ended() === true) {
      session.comparer = undefined;
      running.stop();
    }
    port.dispatch({ failed: { baseline, refused: false }, kind: "failed" });
  };

  function sendChanged(compared: Compared): void {
    measured("send", () => {
      view.state.doc.forEach((node) => {
        if (session.checked.has(node)) return;
        session.checked.add(node);
        const id = blockIdOf(node) ?? undefined;
        if (id === undefined || !compared.earlier.has(id)) return;
        const block = readBlock(node);
        const signature = signatureOf(block);
        if (session.sent.get(id) === signature) return;
        session.sent.set(id, signature);
        void session.comparer?.compareBlock(block).then(
          ({ verdict }) =>
            measured("answer", () =>
              port.dispatch({
                baseline: compared.baseline,
                id,
                judged: { kind: block.kind, text: block.text, verdict },
                kind: "block",
              })
            ),
          failed(compared.baseline, "a block's comparison failed")
        );
      });
    });
  }

  function compareDocument(baseline: ChangeBaseline): void {
    let running: Comparer;
    try {
      running = session.comparer ??= start();
    } catch (error) {
      failed(baseline, "the comparison could not start")(error);
      return;
    }
    const byId = new Map<string, Block>();
    const answer = measured("send", () => {
      const blocks: Block[] = [];
      session.sent = new Map();
      session.checked = new WeakSet();
      view.state.doc.forEach((node) => {
        const block = readBlock(node);
        blocks.push(block);
        // Sent now, so the first check after the answer skips it.
        session.checked.add(node);
        if (block.id === undefined) return;
        session.sent.set(block.id, signatureOf(block));
        byId.set(block.id, block);
      });
      const kept = visitPairs.get(baseline);
      if (kept !== undefined) return running.compareDocument(kept, blocks);
      return running.pairDocument(baseline, blocks).then((paired) => {
        if (paired !== undefined && !visitPairs.has(baseline)) {
          visitPairs.set(baseline, paired.pairs);
        }
        return paired?.comparison;
      });
    });
    void answer.then(
      (comparison) => {
        const against = port.against();
        if (against?.baseline !== baseline) return;
        if (comparison === undefined) {
          // A baseline the engine refuses shows no marks, as upstream's change view does.
          port.dispatch({ failed: { baseline, refused: true }, kind: "failed" });
          return;
        }
        measured("answer", () =>
          port.dispatch({
            compared: {
              baseline,
              choice: against.choice,
              earlier: comparison.earlier,
              judged: judgedOf(comparison, byId),
              removed: removedByAnchor(comparison.removed),
            },
            kind: "compared",
          })
        );
        const compared = port.compared();
        if (compared?.baseline === baseline) sendChanged(compared);
      },
      failed(baseline, "the comparison failed")
    );
  }

  return { compareDocument, sendChanged };
}
