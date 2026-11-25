import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cn } from "cn";
import type { ComponentProps } from "react";
import { coveredClass, modalPopupMotion } from "#registry/legion/lib/overlay-styles";
import { headingVariants, textVariants } from "#registry/legion/lib/typography";
import { OverlayOutline, SurfaceTitleElement } from "#registry/legion/ui/heading";
import { ModalSurfaceProvider } from "#registry/legion/ui/modal-surface-context";
import {
  OverlayLayerScope,
  OverlayOpenProvider,
  useModalLayer,
  useOverlayOpen,
} from "#registry/legion/ui/overlay-layer";

function Drawer<Payload = unknown>({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: DrawerPrimitive.Root.Props<Payload>) {
  const state = useOverlayOpen({ open, defaultOpen, onOpenChange });
  return (
    <OverlayOpenProvider open={state.open}>
      <DrawerPrimitive.Root<Payload> {...props} {...state.rootProps} />
    </OverlayOpenProvider>
  );
}

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;

function DrawerOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      forceRender
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 min-h-dvh bg-scrim/50 opacity-[calc(1-var(--drawer-swipe-progress))] motion-safe:transition-opacity motion-safe:duration-200 data-[stacked]:bg-transparent data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0",
        className
      )}
      {...props}
    />
  );
}

function DrawerContent({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
  const modal = useModalLayer("drawer");
  return (
    <DrawerPortal>
      <DrawerOverlay {...modal.backdropProps} />
      <DrawerPrimitive.Viewport data-slot="drawer-viewport" className="fixed inset-0 z-50">
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          {...modal.popupProps}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-xl border-t bg-background pb-[env(safe-area-inset-bottom)] outline-hidden",
            "transform-[translateY(var(--drawer-swipe-movement-y))] data-swiping:duration-0 data-swiping:select-none",
            modalPopupMotion,
            coveredClass,
            className
          )}
          {...props}
        >
          <OverlayLayerScope layer={modal.layer}>
            <ModalSurfaceProvider>
              <OverlayOutline>{children}</OverlayOutline>
            </ModalSurfaceProvider>
          </OverlayLayerScope>
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

function DrawerBody({ className, ...props }: DrawerPrimitive.Content.Props) {
  return (
    <DrawerPrimitive.Content
      data-slot="drawer-body"
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4", className)}
      {...props}
    />
  );
}

function DrawerHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-1.5 p-4 pb-0", className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      render={<SurfaceTitleElement />}
      data-slot="drawer-title"
      className={cn(headingVariants({ size: "section" }), "text-foreground", className)}
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn(textVariants({ tone: "muted" }), className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
