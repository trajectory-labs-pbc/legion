import type { ReactElement } from "react";
import { KbdSequence } from "#registry/legion/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "#registry/legion/ui/tooltip";

interface KeyTooltipProps {
  /** The control the tooltip names; it becomes the tooltip's trigger. */
  trigger: ReactElement;
  label: string;
  /** The key that runs the control, one chip per step; none shows no key. */
  chips: readonly string[] | null;
  /** The control's `aria-keyshortcuts`. */
  ariaKeyShortcuts?: string;
  side?: "top" | "right" | "bottom" | "left";
}

/** A tooltip that names a control and shows the key that runs it. */
function KeyTooltip({ trigger, label, chips, ariaKeyShortcuts, side }: KeyTooltipProps) {
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

export { KeyTooltip, type KeyTooltipProps };
