import { KbdSequence } from "@legion/ui/components/kbd";
import { firstHighlightTerm } from "@upstream-dispatch/features/search/search-model";
import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from "react";

import { CommandButton } from "@/commands/command-button";
import { useCommandShortcut } from "@/commands/use-command";
import { useAddress } from "@/navigation/hooks";

import { blockFoldsOf } from "./block-folds";
import type { PartsEntry } from "./parts-slot";
import { useAidedDocument } from "./reads";
import { visitOf } from "./visit";

/** The page's `?q=` term, as upstream highlights it. */
function useHighlightTerm(): string | undefined {
  const { search } = useAddress();
  return useMemo(() => firstHighlightTerm(new URLSearchParams(search).get("q") ?? ""), [search]);
}

/** The `z` control, with its key. */
export function FoldsControl() {
  const chips = useCommandShortcut("reading-aids.toggle-folds");
  return (
    <span className="inline-flex items-center gap-1.5">
      <CommandButton commandId="reading-aids.toggle-folds" size="xs" variant="ghost" />
      {chips === null ? null : <KbdSequence steps={chips} />}
    </span>
  );
}

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
