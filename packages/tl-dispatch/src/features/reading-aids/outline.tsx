import { Button } from "@legion/ui/components/button";
import { textVariants } from "@legion/ui/lib/typography";
import { BLOCK_ID_ATTRIBUTE } from "@upstream-dispatch/features/doc/block-id";
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AidActions } from "./aid-commands";
import { plural, shownCount } from "./change-summary";
import { useEditorDoc } from "./editor-doc";
import { moveToBlock } from "./moves";
import { type BlockCounts, type OutlineEntry, outlineEntries, stepEntry } from "./outline-entries";
import type { PartsEntry } from "./parts-slot";

/** The tokens whose sum is the room the outline needs beside the text. */
const ROOM_TOKENS = ["--reading-outline-width", "--reading-outline-gap", "--reading-measure"];

/** The indent of an entry by its level below the outline's top level. */
const INDENT = ["", "ms-3", "ms-6"] as const;

/** Whether the article's border box, which the outline's padding leaves as it is, has its room:
 *  measured before the first paint, then on each resize. */
function useRoom(article: HTMLElement | null): boolean {
  const [room, setRoom] = useState(false);
  useLayoutEffect(() => {
    if (article === null) return;
    const style = getComputedStyle(article);
    const needed = ROOM_TOKENS.reduce((sum, token) => {
      const value = style.getPropertyValue(token);
      if (!/^\s*-?[\d.]+px\s*$/.test(value)) {
        throw new Error(`the theme token ${token} is not a length in px: "${value}"`);
      }
      return sum + Number.parseFloat(value);
    }, 0);
    setRoom(article.getBoundingClientRect().width >= needed);
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.borderBoxSize[0]?.inlineSize;
      if (width !== undefined) setRoom(width >= needed);
    });
    observer.observe(article, { box: "border-box" });
    return () => observer.disconnect();
  }, [article]);
  return article !== null && room;
}

const sameEntry = (a: OutlineEntry, b: OutlineEntry | undefined) =>
  b !== undefined &&
  a.blockId === b.blockId &&
  a.level === b.level &&
  a.text === b.text &&
  a.changes === b.changes &&
  a.decisions === b.decisions;

/** The document's entries, the same array while no entry changes, as when a paragraph is typed. */
function useEntries(entry: PartsEntry, counts: ReadonlyMap<string, BlockCounts>): OutlineEntry[] {
  const doc = useEditorDoc(entry.editor.view);
  const next = useMemo(() => outlineEntries(doc, counts), [doc, counts]);
  const [kept, setKept] = useState(next);
  const same =
    next.length === kept.length &&
    next.every((outlineEntry, index) => sameEntry(outlineEntry, kept[index]));
  if (same) return kept;
  // A changed list replaces the kept one during this render, as React allows for derived state.
  setKept(next);
  return next;
}

/** The top of the view, below what stays over it: the document scrolls a host's article, and the
 *  page keeps its `scroll-padding-top` equal to the stuck row it draws there. */
function viewTop(): number {
  const stays = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
  return Number.isFinite(stays) ? stays : 0;
}

/** The heading the last move went to, which the next key steps from while it stays in the view. */
interface Cursor {
  readonly blockId: string;
  /** Whether it has been in the view since the move: it leaves the cursor only once it was. */
  seen: boolean;
}

/** An entry's heading element, found again when the editor drew it anew. */
interface Heading {
  readonly blockId: string;
  element: Element | null;
}

interface Spy {
  readonly marked: number | undefined;
  /** Holds `blockId` as the next step's origin, until its heading has been in the view and left it. */
  readonly hold: (blockId: string) => void;
  readonly heldId: () => string | undefined;
}

/** The index of the last heading above the top of the view, and the held heading, both following
 *  the scroll, whatever moved it. */
function useSpy(entry: PartsEntry, article: HTMLElement | null, entries: OutlineEntry[]): Spy {
  const [marked, setMarked] = useState<number>();
  const dom = entry.editor.view.dom;
  const cursor = useRef<Cursor | undefined>(undefined);
  // What a move calls to measure again at the next frame.
  const measureSoon = useRef(() => {});
  useEffect(() => {
    if (article === null) return;
    const headings: Heading[] = entries.map(({ blockId }) => ({ blockId, element: null }));
    const elementOf = (heading: Heading) => {
      if (heading.element?.isConnected !== true) {
        heading.element = dom.querySelector(
          `[${BLOCK_ID_ATTRIBUTE}="${CSS.escape(heading.blockId)}"]`
        );
      }
      return heading.element;
    };
    let frame = 0;
    const measure = () => {
      frame = 0;
      const top = viewTop();
      let last: number | undefined;
      for (const [index, heading] of headings.entries()) {
        const element = elementOf(heading);
        if (element === null) continue;
        if (element.getBoundingClientRect().top > top + 1) break;
        last = index;
      }
      setMarked(last);
      const held = cursor.current;
      const heading = headings.find(({ blockId }) => blockId === held?.blockId);
      if (held === undefined || heading === undefined) return;
      const box = elementOf(heading)?.getBoundingClientRect();
      if (box !== undefined && box.bottom > top && box.top < window.innerHeight) held.seen = true;
      else if (held.seen) cursor.current = undefined;
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };
    measureSoon.current = schedule;
    schedule();
    const resized = new ResizeObserver(schedule);
    resized.observe(dom);
    window.addEventListener("scroll", schedule, { passive: true });
    return () => {
      measureSoon.current = () => {};
      cancelAnimationFrame(frame);
      resized.disconnect();
      window.removeEventListener("scroll", schedule);
    };
  }, [dom, article, entries]);
  const hold = useCallback((blockId: string) => {
    cursor.current = { blockId, seen: false };
    measureSoon.current();
  }, []);
  const heldId = useCallback(() => cursor.current?.blockId, []);
  return { heldId, hold, marked };
}

export interface Outline {
  readonly entries: readonly OutlineEntry[];
  readonly marked: number | undefined;
  readonly shown: boolean;
  readonly moveTo: (index: number) => void;
  /** None without entries, which shuts their commands' gates. */
  readonly actions: Pick<AidActions, "nextHeading" | "previousHeading">;
}

/** The outline of an aided editor's document: its entries, the marked one, its room and its moves. */
export function useOutline(entry: PartsEntry, counts: ReadonlyMap<string, BlockCounts>): Outline {
  const entries = useEntries(entry, counts);
  const article = useMemo(() => entry.root.closest("article"), [entry]);
  const room = useRoom(article);
  const { heldId, hold, marked } = useSpy(entry, article, entries);
  return useMemo(() => {
    const moveTo = (index: number) => {
      const target = entries[index];
      if (target === undefined) return;
      // A move of the outline leaves the address as it is, whether by key or by click.
      moveToBlock(entry, target.blockId, "key");
      hold(target.blockId);
    };
    const from = () => {
      const at = entries.findIndex(({ blockId }) => blockId === heldId());
      return at === -1 ? marked : at;
    };
    const step = (by: 1 | -1) => () => {
      const to = stepEntry(entries.length, from(), by);
      if (to !== undefined) moveTo(to);
    };
    const some = entries.length > 0;
    return {
      actions: some ? { nextHeading: step(1), previousHeading: step(-1) } : {},
      entries,
      marked,
      moveTo,
      shown: room && some,
    };
  }, [entry, entries, marked, room, hold, heldId]);
}

/** The two counts of an entry: the word its name says, and the word of its caption. */
const COUNTS = [
  { key: "changes", named: "change", shown: ["change", "changes"] },
  { key: "decisions", named: "open decision", shown: ["open", "open"] },
] as const;

/** The counts an entry has, in the table's order. */
const nonzero = (counts: BlockCounts) => COUNTS.filter(({ key }) => counts[key] > 0);

/** The entry's name: its heading's text and what it counts, in full. */
const entryName = (outlineEntry: OutlineEntry) =>
  [
    outlineEntry.text,
    ...nonzero(outlineEntry).map(({ key, named }) => plural(outlineEntry[key], named)),
  ].join(", ");

/** The counts as a short muted caption, "2 changes · 1 open"; the entry's name says them in full. */
function EntryCounts({ counts }: { counts: BlockCounts }): ReactNode {
  const shown = nonzero(counts).map(
    ({ key, shown: [one, many] }) => `${shownCount(counts[key])} ${counts[key] === 1 ? one : many}`
  );
  if (shown.length === 0) return null;
  return (
    <span
      aria-hidden
      className={textVariants({
        className: "shrink-0 tabular-nums",
        size: "caption",
        tone: "muted",
      })}
      data-reading-aids-outline-counts=""
    >
      {shown.join(" · ")}
    </span>
  );
}

/** The outline at the left of the text, while the article has its room. */
export const OutlineNav = memo(function OutlineNav({ outline }: { outline: Outline }): ReactNode {
  if (!outline.shown) return null;
  const top = Math.min(...outline.entries.map(({ level }) => level));
  return (
    <nav aria-label="Outline" className="reading-aids-outline" data-reading-aids-outline="">
      <div className="reading-aids-outline-list">
        {outline.entries.map((outlineEntry, index) => {
          const current = index === outline.marked;
          return (
            <Button
              aria-current={current ? "location" : undefined}
              aria-label={entryName(outlineEntry)}
              className="w-full justify-start"
              key={outlineEntry.blockId}
              onClick={() => outline.moveTo(index)}
              size="sm"
              title={outlineEntry.text}
              variant="ghost"
            >
              <span
                className={textVariants({
                  className: `${INDENT[outlineEntry.level - top] ?? ""} min-w-0 flex-1 truncate text-start`,
                  tone: current ? "default" : "muted",
                })}
              >
                {outlineEntry.text}
              </span>
              <EntryCounts counts={outlineEntry} />
            </Button>
          );
        })}
      </div>
    </nav>
  );
});
