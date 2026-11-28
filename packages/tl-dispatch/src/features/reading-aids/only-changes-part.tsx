import { useCallback, useEffect, useLayoutEffect, useSyncExternalStore } from "react";

import { useHighlightTerm } from "./aid-control";
import { onlyChangesOf } from "./only-changes";
import type { PartsEntry } from "./parts-slot";
import type { Baseline } from "./use-baseline";
import type { ChangeMarks } from "./use-change-marks";
import { useVisit } from "./visit";

/** Keeps "Only changes" for the visit, and gives `u` while marks are drawn. */
export function useOnlyChanges(
  entry: PartsEntry,
  artifactId: string,
  read: Baseline,
  marks: ChangeMarks | undefined
): { on: boolean; toggleOnlyChanges?: () => void } {
  const only = onlyChangesOf(entry.editor.view);
  // A new visit, after a sign-out, takes its choice too.
  const visit = useVisit(artifactId).onlyChanges;
  useLayoutEffect(() => {
    only.attach(visit);
  }, [only, visit]);

  const term = useHighlightTerm();
  const baseline = marks?.state === "shown" ? marks.shown?.baseline : undefined;
  // No marks to fold by once the baseline is settled with none, or its comparison failed.
  const markless =
    marks === undefined
      ? read.state !== "loading" && read.state !== "ready"
      : marks.state !== "shown";
  useEffect(() => {
    if (markless) only.clear();
    else if (baseline !== undefined) only.follow(term);
  }, [only, baseline, markless, term]);

  const on = useSyncExternalStore(only.subscribe, only.isOn);
  const toggleOnlyChanges = useCallback(() => only.toggle(term), [only, term]);
  return baseline === undefined && !on ? { on } : { on, toggleOnlyChanges };
}
