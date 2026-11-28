import { BarsGlyph, type BarsLevel } from "@legion/ui/components/bars-glyph";
import type { ComponentProps, ReactNode } from "react";

import type { AskUrgency, IssuePriority } from "@/data/priority";

/** What the bars rank: an issue's priority, none of which is three dashes, or an ask's urgency. */
export type Rank = { priority: IssuePriority | null } | { urgency: AskUrgency };

const PRIORITY: Record<IssuePriority, BarsLevel> = { 0: 4, 1: 3, 2: 2, 3: 1 };
const URGENCY: Record<AskUrgency, BarsLevel> = { blocking: 4, high: 3, med: 2, low: 1 };

/** The one table from a priority or an urgency to a level: P0 and Blocking are the top level. */
export function barsLevel(rank: Rank): BarsLevel {
  if ("urgency" in rank) return URGENCY[rank.urgency];
  return rank.priority === null ? 0 : PRIORITY[rank.priority];
}

/** A priority or an urgency as bars; `label` is the name a reader hears. */
export function PriorityBars({
  rank,
  ...props
}: Omit<ComponentProps<typeof BarsGlyph>, "level"> & { rank: Rank }): ReactNode {
  return <BarsGlyph level={barsLevel(rank)} {...props} />;
}
