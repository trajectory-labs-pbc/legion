// An aid's control in the counts line, and the page's `?q=` term the aids open folds by.
import { KbdSequence } from "@legion/ui/components/kbd";
import { firstHighlightTerm } from "@upstream-dispatch/features/search/search-model";
import { useMemo } from "react";

import type { CommandId } from "@/commands/app-catalog";
import { CommandButton } from "@/commands/command-button";
import { useCommandShortcut } from "@/commands/use-command";
import { useAddress } from "@/navigation/hooks";

/** The page's `?q=` term, as upstream highlights it. */
export function useHighlightTerm(): string | undefined {
  const { search } = useAddress();
  return useMemo(() => firstHighlightTerm(new URLSearchParams(search).get("q") ?? ""), [search]);
}

/** An aid's control, with its key; a toggle names whether it is on. */
export function AidControl({
  commandId,
  label,
  pressed,
}: {
  commandId: CommandId;
  label?: string;
  pressed?: boolean;
}) {
  const chips = useCommandShortcut(commandId);
  return (
    <span className="inline-flex items-center gap-1.5">
      <CommandButton
        aria-pressed={pressed}
        // Pressed: the muted fill and text alone, since a ring is the focus token's.
        className="aria-pressed:bg-muted aria-pressed:text-foreground"
        commandId={commandId}
        label={label}
        size="xs"
        variant="ghost"
      />
      {chips === null ? null : <KbdSequence steps={chips} />}
    </span>
  );
}
