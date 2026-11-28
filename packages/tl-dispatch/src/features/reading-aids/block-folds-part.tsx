import { useLayoutEffect, useSyncExternalStore } from "react";

import { useHighlightTerm } from "./aid-control";
import { blockFoldsOf } from "./block-folds";
import type { PartsEntry } from "./parts-slot";
import { useVisit } from "./visit";

/** Keeps an editor's folds for the visit, opens the `?q=` matches, and gives `z` while it can. */
export function useBlockFolds(entry: PartsEntry, artifactId: string): { toggleFolds?: () => void } {
  const folds = blockFoldsOf(entry.editor.view);
  // The visit's folds are new ones once the visits are forgotten.
  const visit = useVisit(artifactId).blockFolds;
  const term = useHighlightTerm();
  useLayoutEffect(() => {
    folds.attach(visit);
    folds.query(term);
  }, [folds, visit, term]);

  const hasBlocks = useSyncExternalStore(folds.subscribe, folds.hasBlocks);
  return hasBlocks ? { toggleFolds: folds.toggleAll } : {};
}
