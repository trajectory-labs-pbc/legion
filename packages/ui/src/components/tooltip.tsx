import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "cn";
import { popupMotion } from "#registry/legion/lib/overlay-styles";

// The trigger's own delay wins over a provider's, so the provider takes none.
function TooltipProvider(props: Omit<TooltipPrimitive.Provider.Props, "delay">) {
  return <TooltipPrimitive.Provider {...props} />;
}

function Tooltip(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props} />;
}

// The pointer rests half a second before a tooltip shows (KB6); focus shows it at once.
function TooltipTrigger({ delay = 500, ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" delay={delay} {...props} />;
}

// No arrow: on a bordered surface an arrow's seam shows the border; the offset and the motion
// already tie the tooltip to its trigger.
function TooltipContent({
  className,
  side = "top",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        className="isolate z-50"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 w-fit rounded-md border bg-popover shadow-popover px-2.5 py-1.5 text-xs text-balance text-popover-foreground",
            popupMotion,
            className
          )}
          {...props}
        />
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
