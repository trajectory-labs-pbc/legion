import type { ReactElement } from "react";

import { KbdSequence } from "@/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import type { ShortcutChips } from "./keys";

export interface HotkeyTooltipPopupProps {
  trigger: ReactElement;
  label: string;
  chips: ShortcutChips | null;
  ariaKeyShortcuts: string | undefined;
  side: "top" | "right" | "bottom" | "left" | undefined;
}

/** The tooltip itself, in its own chunk: Base UI's tooltip and its positioning load after first paint. */
export function HotkeyTooltipPopup({
  trigger,
  label,
  chips,
  ariaKeyShortcuts,
  side,
}: HotkeyTooltipPopupProps) {
  return (
    <Tooltip>
      <TooltipTrigger aria-keyshortcuts={ariaKeyShortcuts} render={trigger} />
      <TooltipContent className="flex items-center gap-2" side={side}>
        <span>{label}</span>
        {chips === null ? null : <KbdSequence chips={chips} />}
      </TooltipContent>
    </Tooltip>
  );
}
