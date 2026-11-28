// The counts line's numbers: the blocks that changed, and the sections they are in.
import type { Node } from "@milkdown/kit/prose/model";

import type { BlockVerdict } from "./compare";

/** A section that holds a change, as its link names it. */
export interface ChangedSection {
  /** The block the link moves to: the heading, or the first block of the text before one. */
  readonly blockId: string | undefined;
  readonly title: string;
}

export interface ChangeSummary {
  readonly changed: number;
  readonly added: number;
  readonly removed: number;
  /** How many sections the document holds. */
  readonly sections: number;
  readonly changedSections: readonly ChangedSection[];
}

/** One top-level block of the live document, as the marks judged it. */
export interface MarkedBlock {
  readonly node: Node;
  readonly id: string | undefined;
  readonly verdict: BlockVerdict;
}

/** A heading of level 1 or 2 starts a section. */
const startsSection = (node: Node) =>
  node.type.name === "heading" && typeof node.attrs.level === "number" && node.attrs.level <= 2;

const firstLine = (node: Node) => node.textContent.split("\n", 1)[0]?.trim() ?? "";

/** A section's link text: its heading, else the first line of the text before the first one. */
function titleOf(node: Node): string {
  const heading = startsSection(node);
  const title = heading ? node.textContent.trim() : firstLine(node);
  if (title !== "") return title;
  return heading ? "Untitled section" : "Before the first heading";
}

/** The counts of `blocks` and of the removed blocks after the ids named; replaced is both. */
export function summarize(
  blocks: readonly MarkedBlock[],
  removedAfter: readonly (string | undefined)[]
): ChangeSummary {
  let changed = 0;
  let added = 0;
  let removed = 0;
  // Each section's first block; only a changed one is named.
  const sections: { blockId: string | undefined; node: Node }[] = [];
  const touched = new Set<number>();
  const sectionOf = new Map<string | undefined, number>();
  for (const { id, node, verdict } of blocks) {
    if (startsSection(node) || sections.length === 0) sections.push({ blockId: id, node });
    const section = sections.length - 1;
    if (id !== undefined) sectionOf.set(id, section);
    if (verdict.kind === "unchanged") continue;
    touched.add(section);
    if (verdict.kind === "new") added += 1;
    else if (verdict.kind === "replaced") {
      added += 1;
      removed += 1;
    } else changed += 1;
  }
  for (const after of removedAfter) {
    removed += 1;
    touched.add(sectionOf.get(after) ?? 0);
  }
  return {
    added,
    changed,
    changedSections: sections.flatMap(({ blockId, node }, index) =>
      touched.has(index) ? [{ blockId, title: titleOf(node) }] : []
    ),
    removed,
    sections: sections.length,
  };
}

/** Whether two summaries say the same, so a redraw keeps the one the line shows. */
export const sameSummary = (left: ChangeSummary, right: ChangeSummary) =>
  left.added === right.added &&
  left.changed === right.changed &&
  left.removed === right.removed &&
  left.sections === right.sections &&
  left.changedSections.length === right.changedSections.length &&
  left.changedSections.every(
    (section, index) =>
      section.blockId === right.changedSections[index]?.blockId &&
      section.title === right.changedSections[index]?.title
  );

export const changedBlocks = ({ added, changed, removed }: ChangeSummary) =>
  added + changed + removed;

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

/** The counts as the line says them: "7 blocks, 6 changed, 1 added, in 5 of 7 sections". */
export function countsText(summary: ChangeSummary): string {
  const parts = [
    plural(changedBlocks(summary), "block"),
    ...(
      [
        [summary.changed, "changed"],
        [summary.added, "added"],
        [summary.removed, "removed"],
      ] as const
    ).flatMap(([count, what]) => (count === 0 ? [] : [`${count} ${what}`])),
  ];
  // With no section left, the line has no sections to count.
  const sections = `in ${summary.changedSections.length} of ${plural(summary.sections, "section")}`;
  return [...parts, ...(summary.sections === 0 ? [] : [sections])].join(", ");
}
