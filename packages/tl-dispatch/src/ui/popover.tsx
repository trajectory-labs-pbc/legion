import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { type ComponentProps, useState } from "react";

import { OverlayOutline, SurfaceTitleElement } from "@/ui/heading";
import { useIsInsideModalSurface } from "@/ui/modal-surface-context";
import { OverlayLayerProvider, OverlayOpenProvider, useOverlayOpen } from "@/ui/overlay-layer";
import { headingVariants } from "@/ui/lib/typography";
import { cn } from "@/ui/lib/utils";

/** The open and close motion of a floating popup. */
const popupMotion =
  "origin-(--transform-origin) transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none";

function Popover<Payload = unknown>({
  modal,
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: PopoverPrimitive.Root.Props<Payload>) {
  const insideModalSurface = useIsInsideModalSurface();
  // A popover a hover opened is no layer, like a tooltip: page keys keep running.
  const [openedByHover, setOpenedByHover] = useState(false);
  const state = useOverlayOpen<PopoverPrimitive.Root.ChangeEventDetails>({
    open,
    defaultOpen,
    onOpenChange: (next, details) => {
      onOpenChange?.(next, details);
      if (!details.isCanceled) setOpenedByHover(next && details.reason === "trigger-hover");
    },
  });
  return (
    <OverlayOpenProvider open={state.open && !openedByHover}>
      <PopoverPrimitive.Root<Payload> modal={modal ?? insideModalSurface} {...props} {...state.rootProps} />
    </OverlayOpenProvider>
  );
}

function PopoverTrigger<Payload = unknown>(props: PopoverPrimitive.Trigger.Props<Payload>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  anchor,
  children,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset" | "anchor">) {
  // z-50 on the portal puts Base UI's modal backdrop over a sheet's scrim below.
  return (
    <PopoverPrimitive.Portal className="relative z-50">
      <PopoverPrimitive.Positioner
        className="isolate z-50"
        side={side}
        align={align}
        sideOffset={sideOffset}
        alignOffset={alignOffset}
        {...(anchor === undefined ? {} : { anchor })}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden",
            popupMotion,
            className,
          )}
          {...props}
        >
          <OverlayLayerProvider kind="popover">
            <OverlayOutline>{children}</OverlayOutline>
          </OverlayLayerProvider>
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="popover-header" className={cn("flex flex-col gap-1 text-sm", className)} {...props} />;
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      render={<SurfaceTitleElement />}
      data-slot="popover-title"
      className={cn(headingVariants({ size: "group" }), className)}
      {...props}
    />
  );
}

function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger, popupMotion };
