import { KbdSequence, type KeySteps } from "@legion/ui/components/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@legion/ui/components/tooltip";
import type { ReactElement } from "react";

/** Where a tooltip opens beside its control. */
export type TooltipSide = "top" | "right" | "bottom" | "left";

interface HotkeyTooltipPopupProps {
  trigger: ReactElement;
  label: string;
  chips: KeySteps | null;
  side: TooltipSide | undefined;
}

/** The tooltip itself, in its own chunk: Base UI's tooltip and its positioning load after first paint. */
export function HotkeyTooltipPopup({ trigger, label, chips, side }: HotkeyTooltipPopupProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={trigger} />
      <TooltipContent className="flex items-center gap-2" side={side}>
        <span>{label}</span>
        {chips === null ? null : <KbdSequence steps={chips} />}
      </TooltipContent>
    </Tooltip>
  );
}
