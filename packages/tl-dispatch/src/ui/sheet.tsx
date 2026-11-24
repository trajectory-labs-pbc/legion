import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { closeButtonClass } from "@/ui/dialog";
import { OverlayOutline, SurfaceTitleElement } from "@/ui/heading";
import { ModalSurfaceProvider } from "@/ui/modal-surface-context";
import {
  coveredClass,
  OverlayLayerScope,
  OverlayOpenProvider,
  scrimClass,
  useModalLayer,
  useOverlayOpen,
} from "@/ui/overlay-layer";
import { headingVariants, textVariants } from "@/ui/lib/typography";
import { cn } from "@/ui/lib/utils";

function Sheet({ open, defaultOpen, onOpenChange, ...props }: SheetPrimitive.Root.Props) {
  const state = useOverlayOpen({ open, defaultOpen, onOpenChange });
  return (
    <OverlayOpenProvider open={state.open}>
      <SheetPrimitive.Root {...props} {...state.rootProps} />
    </OverlayOpenProvider>
  );
}

function SheetTrigger(props: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose(props: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop forceRender data-slot="sheet-overlay" className={cn(scrimClass, className)} {...props} />
  );
}

const SIDE_CLASS = {
  right:
    "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm data-ending-style:translate-x-full data-starting-style:translate-x-full",
  left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm data-ending-style:-translate-x-full data-starting-style:-translate-x-full",
  top: "inset-x-0 top-0 h-auto border-b data-ending-style:-translate-y-full data-starting-style:-translate-y-full",
  bottom: "inset-x-0 bottom-0 h-auto border-t data-ending-style:translate-y-full data-starting-style:translate-y-full",
} as const;

// Arrow keys, Home and End scroll the sheet's own content instead of moving focus.
const DOCUMENT_KEYS = new Set(["ArrowUp", "ArrowDown", "Home", "End"]);

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  closeLabel = "Close",
  onKeyDown,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: keyof typeof SIDE_CLASS;
  showCloseButton?: boolean;
  closeLabel?: string;
}) {
  const modal = useModalLayer("sheet");
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetOverlay {...modal.backdropProps} />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        {...modal.popupProps}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg outline-hidden transition-transform duration-200 ease-in-out motion-reduce:transition-none",
          SIDE_CLASS[side],
          coveredClass,
          className,
        )}
        onKeyDown={event => {
          onKeyDown?.(event);
          if (DOCUMENT_KEYS.has(event.key)) event.preventBaseUIHandler();
        }}
        {...props}
      >
        <OverlayLayerScope layer={modal.layer}>
          <ModalSurfaceProvider>
            <OverlayOutline>{children}</OverlayOutline>
          </ModalSurfaceProvider>
        </OverlayLayerScope>
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" aria-label={closeLabel} className={closeButtonClass}>
            <XIcon aria-hidden="true" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function SheetHeader({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5 p-4", className)} {...props} />;
}

function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      render={<SurfaceTitleElement />}
      data-slot="sheet-title"
      className={cn(headingVariants({ size: "section" }), "text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(textVariants({ tone: "muted" }), className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger };
