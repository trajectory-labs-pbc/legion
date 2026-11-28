import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";

import { useHighlightTerm } from "./aid-control";
import { blockFoldsOf } from "./block-folds";
import type { PartsEntry } from "./parts-slot";
import { useAidedDocument } from "./reads";
import { visitOf } from "./visit";

/** Keeps an editor's folds for the visit, opens the `?q=` matches, and gives `z` while it can. */
export function useBlockFolds(entry: PartsEntry): { toggleFolds?: () => void } {
  const folds = blockFoldsOf(entry.editor.view);
  const artifactId = useAidedDocument(entry.documentRef)?.artifactId;
  useLayoutEffect(() => {
    if (artifactId !== undefined) folds.attach(visitOf(artifactId).blockFolds);
  }, [folds, artifactId]);

  const term = useHighlightTerm();
  useEffect(() => {
    if (artifactId !== undefined) folds.query(term);
  }, [folds, artifactId, term]);

  const hasBlocks = useSyncExternalStore(folds.subscribe, folds.hasBlocks);
  return hasBlocks ? { toggleFolds: folds.toggleAll } : {};
}
