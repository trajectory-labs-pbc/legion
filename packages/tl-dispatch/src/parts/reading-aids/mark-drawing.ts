// How a verdict draws: its gutter label, its word marks, and its earlier text folded to one line.
import { buttonVariants } from "@legion/ui/components/button";
import { textVariants } from "@legion/ui/lib/typography";
import { cn } from "@legion/ui/lib/utils";
import type { Node } from "@milkdown/kit/prose/model";
import { Decoration } from "@milkdown/kit/prose/view";
import { blockIdOf, type WordPart } from "@/upstream/editor/engine";

import { type BlockVerdict, type ListVerdict, NEW, type Removed, type Verdict } from "./compare";

/** The attribute that names a block's gutter label, which the stylesheet draws. */
export const CHANGE_ATTRIBUTE = "data-reading-aids-change";

/** A decoration at a place relative to its block's start, so a block's drawing is kept by node. */
export type Piece = (start: number) => Decoration;

/** The keys of the folds the reader opened, which a redraw keeps open. */
export type OpenFolds = Set<string>;

/** Where each run of a block's text starts, in the block's text and relative to the block. */
interface Run {
  readonly offset: number;
  readonly length: number;
  readonly at: number;
}

// Copies proof-editor's unexported textRuns and positionAt, for one node, read forward.
function runsOf(node: Node): Run[] {
  const runs: Run[] = [];
  let offset = 0;
  node.descendants((child, pos) => {
    if (child.isText) {
      const length = child.text?.length ?? 0;
      runs.push({ offset, length, at: pos + 1 });
      offset += length;
      return false;
    }
    // `textContent` counts a leaf's own text, such as a hard break's newline.
    if (child.isLeaf) offset += child.type.spec.leafText?.(child).length ?? 0;
    return !child.isLeaf;
  });
  return runs;
}

/** The place `offset` characters in, for offsets that never go back; `to` closes at a run's end. */
function placer(runs: readonly Run[], side: "from" | "to") {
  let index = 0;
  return (offset: number): number | undefined => {
    for (; index < runs.length; index += 1) {
      const run = runs[index];
      const end = run.offset + run.length;
      if (side === "to" ? offset <= end : offset < end) {
        return run.at + Math.min(Math.max(offset - run.offset, 0), run.length);
      }
    }
    const last = runs.at(-1);
    return last !== undefined && offset === last.offset + last.length
      ? last.at + last.length
      : undefined;
  };
}

const hasWords = (text: string) => /\S/.test(text);

function struck(text: string): HTMLElement {
  const words = document.createElement("del");
  words.className = "reading-aids-removed";
  words.setAttribute("contenteditable", "false");
  words.textContent = text;
  return words;
}

/** The added words underlined, and the removed ones struck where they stood. */
function wordPieces(node: Node, words: readonly WordPart[], key: string): Piece[] {
  const runs = runsOf(node);
  const opens = placer(runs, "from");
  const closes = placer(runs, "to");
  const pieces: Piece[] = [];
  let offset = 0;
  for (const { kind, value } of words) {
    if (kind === "removed") {
      const at = opens(offset);
      if (at !== undefined && hasWords(value)) {
        pieces.push((start) =>
          Decoration.widget(start + at, () => struck(value), {
            ignoreSelection: true,
            key: `${key}:${offset}:${value}`,
            side: -1,
          })
        );
      }
      continue;
    }
    const end = offset + value.length;
    const from = opens(offset);
    const to = closes(end);
    if (kind === "added" && hasWords(value) && from !== undefined && to !== undefined) {
      pieces.push((start) =>
        Decoration.inline(start + from, start + to, {
          class: "reading-aids-added",
          nodeName: "ins",
        })
      );
    }
    offset = end;
  }
  return pieces;
}

const label =
  (node: Node, text: string): Piece =>
  (start) =>
    Decoration.node(start, start + node.nodeSize, { [CHANGE_ATTRIBUTE]: text });

/** A fold of earlier text: a head line whose button opens it, and the text below. */
interface Fold {
  readonly key: string;
  /** A list item's fold is an item of its list. */
  readonly tag: "div" | "li";
  readonly label?: string;
  /** The earlier text, struck where it was removed. */
  readonly earlier: string;
  readonly struck: boolean;
  /** The head line while folded. */
  readonly head: string;
  /** The button's name while folded: its head line's words, after what the line is. */
  readonly name?: string;
  readonly open: string;
}

const FOLD_BUTTON = cn(
  buttonVariants({ size: "sm", variant: "ghost" }),
  "max-w-full justify-start"
);
const FOLD_HEAD = cn(textVariants({ tone: "muted" }), "min-w-0 truncate");
const FOLD_EARLIER = cn("reading-aids-earlier", textVariants({ tone: "muted" }));

function foldElement(fold: Fold, opened: OpenFolds): HTMLElement {
  const root = document.createElement(fold.tag);
  root.className = "reading-aids-change-fold not-prose";
  root.setAttribute("contenteditable", "false");
  if (fold.label !== undefined) root.setAttribute(CHANGE_ATTRIBUTE, fold.label);
  const button = document.createElement("button");
  button.type = "button";
  button.className = FOLD_BUTTON;
  const head = document.createElement("span");
  head.className = FOLD_HEAD;
  button.append(head);
  const earlier = document.createElement(fold.struck ? "del" : "div");
  earlier.className = FOLD_EARLIER;
  earlier.textContent = fold.earlier;
  const show = (open: boolean) => {
    button.setAttribute("aria-expanded", String(open));
    if (!open && fold.name !== undefined) button.setAttribute("aria-label", fold.name);
    else button.removeAttribute("aria-label");
    earlier.hidden = !open;
    head.classList.toggle("line-through", !open && fold.struck);
    head.textContent = open ? fold.open : fold.head;
  };
  button.addEventListener("click", () => {
    const open = !opened.has(fold.key);
    if (open) opened.add(fold.key);
    else opened.delete(fold.key);
    show(open);
  });
  show(opened.has(fold.key));
  root.append(button, earlier);
  return root;
}

/** The earlier text drawn as its own block at `at`, relative to the block it stands beside. */
const foldPiece =
  (at: number, side: number, fold: Fold, opened: OpenFolds): Piece =>
  (start) =>
    Decoration.widget(start + at, () => foldElement(fold, opened), {
      ignoreSelection: true,
      key: fold.key,
      side,
      stopEvent: () => true,
    });

/** The most characters a folded head shows before it is cut at a word. */
const HEAD_LENGTH = 80;

/** `line` trimmed and cut at a word within HEAD_LENGTH characters, ending in "…". */
function cutHead(line: string): string {
  const words = line.trim();
  if (words.length <= HEAD_LENGTH) return words;
  const space = words.lastIndexOf(" ", HEAD_LENGTH);
  return `${words.slice(0, space > 0 ? space : HEAD_LENGTH).trimEnd()}…`;
}

/** A removed block or item: its first line with words, struck, which opens to its whole text. */
const removedFold = (key: string, text: string, tag: Fold["tag"]): Fold => {
  // A block with no words, such as a rule, still shows a line and a name.
  const line = text.split("\n").find(hasWords);
  const head = line === undefined ? "An empty block" : cutHead(line);
  return {
    earlier: text,
    head,
    key: `removed:${key}:${text}`,
    label: "Removed",
    name: `Removed: ${head}`,
    open: "Hide the removed text",
    struck: true,
    tag,
  };
};

const rewrittenFold = (key: string, text: string, tag: Fold["tag"]): Fold => ({
  earlier: text,
  head: "Rewritten: show the earlier text",
  key: `rewritten:${key}:${text}`,
  open: "Rewritten: hide the earlier text",
  struck: false,
  tag,
});

/** Widgets' order at one place: a rewrite's earlier text, the removed blocks, a replaced one's. */
const SIDES = { rewritten: -2, removed: 0, replaced: 1 } as const;

/** A removed entry's fold, `at` its place relative to the block or list it stands in. */
export const removedPiece = (
  at: number,
  key: string,
  text: string,
  tag: Fold["tag"],
  opened: OpenFolds
): Piece => foldPiece(at, SIDES.removed, removedFold(key, text, tag), opened);

/** What a block or a list item shows for `verdict`; `wordsShown` is false while its words wait. */
function verdictPieces(
  node: Node,
  verdict: Verdict,
  key: string,
  tag: Fold["tag"],
  wordsShown: boolean,
  opened: OpenFolds
): Piece[] {
  switch (verdict.kind) {
    case "unchanged":
      return [];
    case "new":
      return [label(node, "New")];
    case "changed":
      return [label(node, "Changed"), ...(wordsShown ? wordPieces(node, verdict.words, key) : [])];
    case "rewritten":
      return [
        label(node, "Changed"),
        foldPiece(node.nodeSize, SIDES.rewritten, rewrittenFold(key, verdict.earlier, tag), opened),
      ];
    case "replaced":
      return [
        label(node, "New"),
        foldPiece(0, SIDES.replaced, removedFold(key, verdict.earlier, tag), opened),
      ];
  }
}

/** Each removed entry, keyed by the entry above it and its place there, so its fold outlives edits. */
export function keyedRemoved(removed: readonly Removed[]) {
  const counts = new Map<string | undefined, number>();
  return removed.map(({ after, text }) => {
    const index = counts.get(after) ?? 0;
    counts.set(after, index + 1);
    return { after, key: `${after ?? "start"}/${index}`, text };
  });
}

/** A changed list: each item's own marks, and the items removed after the item above them. */
function listPieces(
  list: Node,
  verdict: ListVerdict,
  key: string,
  wordsShown: boolean,
  opened: OpenFolds
): Piece[] {
  const byId = new Map(verdict.results.flatMap(({ id, verdict }) => (id ? [[id, verdict]] : [])));
  const ends = new Map<string, number>();
  const pieces: Piece[] = [];
  list.forEach((item, offset) => {
    const at = offset + 1;
    const id = blockIdOf(item) ?? undefined;
    if (id !== undefined) ends.set(id, at + item.nodeSize);
    const own = (id === undefined ? undefined : byId.get(id)) ?? NEW;
    const itemKey = `${key}/${id ?? at}`;
    for (const piece of verdictPieces(item, own, itemKey, "li", wordsShown, opened)) {
      pieces.push((start) => piece(start + at));
    }
  });
  for (const removed of keyedRemoved(verdict.removed)) {
    const at = removed.after === undefined ? 1 : ends.get(removed.after);
    if (at !== undefined) {
      pieces.push(removedPiece(at, `${key}/${removed.key}`, removed.text, "li", opened));
    }
  }
  return pieces;
}

/** What a top-level block shows for its verdict, relative to its start. */
export function blockPieces(
  node: Node,
  verdict: BlockVerdict,
  key: string,
  wordsShown: boolean,
  opened: OpenFolds
): Piece[] {
  return verdict.kind === "list"
    ? listPieces(node, verdict, key, wordsShown, opened)
    : verdictPieces(node, verdict, key, "div", wordsShown, opened);
}
