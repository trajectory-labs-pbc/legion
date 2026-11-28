import type { EditorView } from "@milkdown/kit/prose/view";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import {
  comparisonFailure,
  type DrawnChanges,
  drawnChanges,
  retryComparison,
  setMarksBaseline,
  watchChanges,
} from "./marks-plugin";
import type { Baseline } from "./use-baseline";

/** What the marks show against the ready baseline. */
export type ChangeMarks =
  /** The marks drawn: the last baseline's while its comparison runs, none before the first. */
  | { readonly state: "shown"; readonly shown: DrawnChanges | undefined }
  /** The engine refused its text. */
  | { readonly state: "refused" }
  | { readonly state: "failed"; readonly retry: () => void };

/** Hands the editor the baseline its marks compare with, and gives back what they show. */
export function useChangeMarks(view: EditorView, baseline: Baseline): ChangeMarks | undefined {
  const ready = baseline.state === "ready" ? baseline : undefined;
  // While a new pick loads, the marks of the last one stay.
  const loading = baseline.state === "loading";
  useEffect(() => {
    if (!loading) setMarksBaseline(view, ready);
  }, [loading, ready, view]);
  const subscribe = useCallback((listener: () => void) => watchChanges(view, listener), [view]);
  const drawn = useSyncExternalStore(subscribe, () => drawnChanges(view));
  const failure = useSyncExternalStore(subscribe, () =>
    ready === undefined ? undefined : comparisonFailure(view, ready.baseline)
  );
  return useMemo((): ChangeMarks | undefined => {
    if (ready === undefined) return undefined;
    if (failure !== undefined) {
      return failure.refused
        ? { state: "refused" }
        : { retry: () => retryComparison(view), state: "failed" };
    }
    return { shown: drawn, state: "shown" };
  }, [drawn, failure, ready, view]);
}
