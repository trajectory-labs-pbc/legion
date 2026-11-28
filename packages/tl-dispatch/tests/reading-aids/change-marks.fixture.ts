// An approval's two versions: 7 blocks changed in 5 of 7 sections, one a list of 6,100 characters.
import type { EditorView } from "@milkdown/kit/prose/view";

/** `count` distinct words joined by spaces. */
const words = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => `${prefix}${index.toString().padStart(4, "0")}`).join(
    " "
  );

const ITEMS = Array.from({ length: 7 }, (_, index) => words(71, `i${index}w`));
export const CHANGED_ITEM = ITEMS[3]?.replace("i3w0030", "i3w0030 again") ?? "";
export const NEW_ITEMS = [words(150, "na"), words(150, "nb")];

/** A paragraph long enough that one word changed keeps its word marks. */
export const said = (subject: string, last: string) =>
  `The ${subject} paragraph keeps nearly all of its words from one version to the next, ${last}.`;

function plan(changed: boolean): string {
  const now = (before: string, after: string) => (changed ? after : before);
  const items = changed
    ? [...ITEMS.slice(0, 3), CHANGED_ITEM, ...ITEMS.slice(4), ...NEW_ITEMS]
    : ITEMS;
  return [
    "## Goals",
    said("goals", now("today", "now")),
    "## Problem",
    items.map((text) => `- ${text}`).join("\n"),
    "## Design",
    said("first design", now("today", "now")),
    said("second design", now("for now", "for good")),
    "## Rollout",
    said("rollout", now("in May", "in June")),
    ...(changed ? ["A rollout paragraph that the new version adds."] : []),
    "## Risks",
    said("risks", now("mostly", "largely")),
    "## Testing",
    said("testing", "unchanged"),
    "## Later",
    said("later", "unchanged"),
  ].join("\n\n");
}

export const APPROVED = plan(false);
export const REVISED = plan(true);
/** The titles of the sections that changed, in the document's order. */
export const CHANGED_SECTIONS = ["Goals", "Problem", "Design", "Rollout", "Risks"];

/** The removed or rewritten fold whose earlier text is `earlier`. */
export function foldOf(view: EditorView, earlier: string): HTMLElement {
  const fold = [...view.dom.querySelectorAll<HTMLElement>(".reading-aids-change-fold")].find(
    (each) => each.querySelector(".reading-aids-earlier")?.textContent === earlier
  );
  if (fold === undefined) throw new Error(`no fold for ${earlier}`);
  return fold;
}
