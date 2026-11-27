import {
  changedWords,
  pairBlocks,
  type WordPart,
} from "@upstream-dispatch/features/doc/change-set";
import type { Node as ProseMirrorNode } from "prosemirror-model";

/** A block below a list: its kind, its text in the editor's units, and its id. */
export interface Item {
  readonly kind: string;
  readonly text: string;
  readonly id: string | undefined;
}

/** A top-level block; a list also carries its items. */
export interface Block extends Item {
  readonly items?: readonly Item[];
}

/** A baseline entry also carries the text a reader sees struck: its cells and nested blocks
 *  apart. */
export interface BaselineItem extends Item {
  readonly shown: string;
}

export interface BaselineBlock extends BaselineItem {
  readonly items?: readonly BaselineItem[];
}

/** How a block or an item stands against its baseline. "replaced" is removed plus added. */
export type Verdict =
  | { readonly kind: "unchanged" }
  | { readonly kind: "new" }
  | { readonly kind: "changed"; readonly words: readonly WordPart[] }
  | { readonly kind: "rewritten"; readonly earlier: string }
  | { readonly kind: "replaced"; readonly earlier: string };

export interface Result<V> {
  readonly id: string | undefined;
  readonly verdict: V;
}

/** A baseline block or item with no live partner, drawn after the live one whose id is `after`
 *  (`undefined`: before the first). */
export interface Removed {
  readonly kind: string;
  readonly text: string;
  readonly after: string | undefined;
}

/** One result for each live block or item, in order, and the baseline ones removed. */
export interface Run<V> {
  readonly results: readonly Result<V>[];
  readonly removed: readonly Removed[];
}

/** A changed list, compared item by item. */
export interface ListVerdict extends Run<Verdict> {
  readonly kind: "list";
}

export type BlockVerdict = Verdict | ListVerdict;

/** A paired block's baseline, by its live id: what shows if a person deletes it later. */
export interface Earlier {
  readonly kind: string;
  readonly text: string;
}

export interface Comparison extends Run<BlockVerdict> {
  readonly earlier: ReadonlyMap<string, Earlier>;
}

/** Each baseline entry beside the id of the live entry `pairBlocks` paired it with, once. */
interface Pairing<T> {
  readonly baseline: readonly T[];
  readonly partners: readonly (string | undefined)[];
}

/** The pairs the whole comparison made, which each later compare of one block reads. */
export interface Pairs {
  readonly blocks: Pairing<BaselineBlock>;
  /** The items' pairing of each paired list, by the list's live id. */
  readonly lists: ReadonlyMap<string, Pairing<BaselineItem>>;
}

/** The pairs before any comparison: every block is new. */
export const NO_PAIRS: Pairs = { blocks: { baseline: [], partners: [] }, lists: new Map() };

/** Below this share kept, a pair is two unrelated blocks. */
const PAIR_SHARE = 0.4;
/** Below this share kept, struck words make the new text hard to read. */
const WORD_MARKS_SHARE = 0.8;
/** The most runs of removed words that still read as word marks. */
const MOST_LOSS_PLACES = 6;

const LIST_KINDS = new Set(["bullet_list", "ordered_list"]);
const NEW: Verdict = { kind: "new" };
const UNCHANGED: Verdict = { kind: "unchanged" };

function itemOf(node: ProseMirrorNode): BaselineItem {
  const id: unknown = node.attrs.blockId;
  return {
    kind: node.type.name,
    text: node.textContent,
    id: typeof id === "string" && id !== "" ? id : undefined,
    shown: node.textBetween(0, node.content.size, " "),
  };
}

/** The top-level blocks of `doc`, each list with its items. */
export function readBlocks(doc: ProseMirrorNode): BaselineBlock[] {
  const blocks: BaselineBlock[] = [];
  doc.forEach((node) => {
    if (!LIST_KINDS.has(node.type.name)) {
      blocks.push(itemOf(node));
      return;
    }
    const items: BaselineItem[] = [];
    node.forEach((item) => {
      items.push(itemOf(item));
    });
    blocks.push({ ...itemOf(node), items });
  });
  return blocks;
}

/** A changed kind, or under PAIR_SHARE kept, is replaced; under WORD_MARKS_SHARE kept, or past
 *  MOST_LOSS_PLACES places of lost words, is rewritten; else changed. At `changedWords`' limit
 *  nothing is kept. */
function judge(before: BaselineItem, after: Item): Verdict {
  if (before.kind !== after.kind) return { kind: "replaced", earlier: before.shown };
  if (before.text === after.text) return UNCHANGED;
  const words = changedWords(before.text, after.text);
  let kept = 0;
  let lossPlaces = 0;
  for (const part of words) {
    if (part.kind === "same") kept += part.value.length;
    if (part.kind === "removed" && /\S/.test(part.value)) lossPlaces += 1;
  }
  const share = kept / Math.max(before.text.length, after.text.length);
  if (share < PAIR_SHARE) return { kind: "replaced", earlier: before.shown };
  if (share < WORD_MARKS_SHARE || lossPlaces > MOST_LOSS_PLACES) {
    return { kind: "rewritten", earlier: before.shown };
  }
  return { kind: "changed", words };
}

/** `pairBlocks`' partner of each live entry, by index, and the pairing kept by id. */
function pairOnce<T extends Item>(
  baseline: readonly T[],
  live: readonly Item[]
): { pairing: Pairing<T>; at: readonly (number | undefined)[] } {
  const partners = new Array<string | undefined>(baseline.length).fill(undefined);
  const at = new Array<number | undefined>(live.length).fill(undefined);
  for (const pair of pairBlocks(
    baseline.map((entry) => entry.text),
    live.map((entry) => entry.text)
  )) {
    if (pair.before !== undefined && pair.after !== undefined) {
      partners[pair.before] = live[pair.after].id;
      at[pair.after] = pair.before;
    }
  }
  return { pairing: { baseline, partners }, at };
}

/** The baseline index paired with `id`; no id or no pair is none. */
function partnerIndex(pairing: Pairing<unknown>, id: string | undefined): number | undefined {
  const index = id === undefined ? -1 : pairing.partners.indexOf(id);
  return index === -1 ? undefined : index;
}

/** Judges each live entry against the baseline entry at its index in `at`, and removes each
 *  baseline entry no live one took, after the nearest one above it that a live one took. */
function compareRun<B extends BaselineItem, L extends Item, V>(
  baseline: readonly B[],
  live: readonly L[],
  at: readonly (number | undefined)[],
  compare: (baseline: B | undefined, live: L) => V
): Run<V> {
  const takenBy = new Map<number, string | undefined>();
  const results = live.map((entry, index) => {
    const partner = at[index];
    if (partner !== undefined) takenBy.set(partner, entry.id);
    return {
      id: entry.id,
      verdict: compare(partner === undefined ? undefined : baseline[partner], entry),
    };
  });
  const removed: Removed[] = [];
  let after: string | undefined;
  baseline.forEach((entry, index) => {
    if (takenBy.has(index)) {
      // Marks are tied to ids, so a partner with no id anchors nothing.
      after = takenBy.get(index) ?? after;
      return;
    }
    removed.push({ kind: entry.kind, text: entry.shown, after });
  });
  return { results, removed };
}

function judgeItem(baseline: BaselineItem | undefined, live: Item): Verdict {
  return baseline === undefined ? NEW : judge(baseline, live);
}

function listVerdict(run: Run<Verdict>): BlockVerdict {
  const same =
    run.removed.length === 0 && run.results.every((item) => item.verdict.kind === "unchanged");
  return same ? UNCHANGED : { kind: "list", ...run };
}

/** A paired block: two lists of one kind whose items are paired compare item by item. */
function verdictOf(
  before: BaselineBlock,
  live: Block,
  itemPartners: readonly (number | undefined)[] | undefined
): BlockVerdict {
  if (!before.items || !live.items || !itemPartners || before.kind !== live.kind) {
    return judge(before, live);
  }
  return listVerdict(compareRun(before.items, live.items, itemPartners, judgeItem));
}

/** One live block against the baseline block the whole comparison paired with its id. */
export function compareBlock(pairs: Pairs, live: Block): BlockVerdict {
  const index = partnerIndex(pairs.blocks, live.id);
  if (live.id === undefined || index === undefined) return NEW;
  const items = pairs.lists.get(live.id);
  return verdictOf(
    pairs.blocks.baseline[index],
    live,
    items && live.items?.map((item) => partnerIndex(items, item.id))
  );
}

function earlierOf({ blocks }: Pairs): Map<string, Earlier> {
  const earlier = new Map<string, Earlier>();
  blocks.partners.forEach((id, index) => {
    const { kind, shown } = blocks.baseline[index];
    if (id !== undefined) earlier.set(id, { kind, text: shown });
  });
  return earlier;
}

/** Pairs the blocks, and the items of each paired pair of lists, once, and compares each with its
 *  pair. A live entry with no id is compared here, but kept in no pair. */
export function compareDocument(
  baseline: readonly BaselineBlock[],
  live: readonly Block[]
): { comparison: Comparison; pairs: Pairs } {
  const blocks = pairOnce(baseline, live);
  const lists = new Map<string, Pairing<BaselineItem>>();
  const run = compareRun(baseline, live, blocks.at, (before, block) => {
    if (before === undefined) return NEW;
    if (!before.items || !block.items) return judge(before, block);
    // Lists of two kinds pair their items too: a later compare may see the kind come back.
    const items = pairOnce(before.items, block.items);
    if (block.id !== undefined) lists.set(block.id, items.pairing);
    return verdictOf(before, block, items.at);
  });
  const pairs: Pairs = { blocks: blocks.pairing, lists };
  return { comparison: { ...run, earlier: earlierOf(pairs) }, pairs };
}
