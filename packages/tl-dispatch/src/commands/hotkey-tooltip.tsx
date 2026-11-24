import type { ReactElement } from "react";

import { KbdSequence } from "@/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import type { CommandId } from "./app-catalog";
import { ariaKeyShortcuts } from "./chips";
import { useCommand, useCommandShortcut } from "./hooks";

export interface HotkeyTooltipProps {
  commandId: CommandId;
  /** The control to wrap; it becomes the tooltip's trigger. */
  children: ReactElement;
  /** The wrapped control's own label, when it says more than the catalog's. */
  label?: string;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Shows the command's label and key on hover and focus. The child stays as it is while the
 * command is not mounted, so the shell never flickers.
 */
export function HotkeyTooltip({ commandId, children, label, side }: HotkeyTooltipProps) {
  const view = useCommand(commandId);
  const chips = useCommandShortcut(commandId);
  if (view === undefined) return children;
  return (
    <Tooltip>
      <TooltipTrigger
        render={children}
        aria-keyshortcuts={view.enabled ? ariaKeyShortcuts(view.command.keys ?? []) : undefined}
      />
      <TooltipContent className="flex items-center gap-2" side={side}>
        <span>{label ?? view.label}</span>
        {chips === null ? null : <KbdSequence chips={chips} />}
      </TooltipContent>
    </Tooltip>
  );
}
