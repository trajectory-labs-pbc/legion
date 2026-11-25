import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "cn";
import { type ComponentProps, createContext, type RefObject, useContext, useRef } from "react";
import { coveredClass, modalPopupMotion, scrimClass } from "#registry/legion/lib/overlay-styles";
import { headingVariants, textVariants } from "#registry/legion/lib/typography";
import { Button, type ButtonVariants } from "#registry/legion/ui/button";
import { OverlayOutline, SurfaceTitleElement } from "#registry/legion/ui/heading";
import {
  OverlayLayerScope,
  OverlayOpenProvider,
  useModalLayer,
  useOverlayOpen,
} from "#registry/legion/ui/overlay-layer";

function AlertDialog({
  open,
  defaultOpen,
  onOpenChange,
  ...props
}: AlertDialogPrimitive.Root.Props) {
  const state = useOverlayOpen({ open, defaultOpen, onOpenChange });
  return (
    <OverlayOpenProvider open={state.open}>
      <AlertDialogPrimitive.Root {...props} {...state.rootProps} />
    </OverlayOpenProvider>
  );
}

function AlertDialogTrigger(props: AlertDialogPrimitive.Trigger.Props) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal(props: AlertDialogPrimitive.Portal.Props) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      forceRender
      data-slot="alert-dialog-overlay"
      className={cn(scrimClass, className)}
      {...props}
    />
  );
}

// The dialog opens with the focus on Cancel, the choice that changes nothing.
const CancelRefContext = createContext<RefObject<HTMLButtonElement | null> | null>(null);

function AlertDialogContent({ className, children, ...props }: AlertDialogPrimitive.Popup.Props) {
  const modal = useModalLayer("alert-dialog");
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay {...modal.backdropProps} />
      <AlertDialogPrimitive.Viewport
        data-slot="alert-dialog-viewport"
        className="fixed inset-0 z-50 flex overflow-y-auto overscroll-contain p-4"
      >
        <AlertDialogPrimitive.Popup
          data-slot="alert-dialog-content"
          initialFocus={() => cancelRef.current}
          {...modal.popupProps}
          className={cn(
            "relative m-auto grid w-full gap-4 rounded-lg border bg-background p-6 outline-hidden sm:max-w-lg",
            modalPopupMotion,
            coveredClass,
            className
          )}
          {...props}
        >
          <OverlayLayerScope layer={modal.layer}>
            <CancelRefContext.Provider value={cancelRef}>
              <OverlayOutline>{children}</OverlayOutline>
            </CancelRefContext.Provider>
          </OverlayLayerScope>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Viewport>
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      render={<SurfaceTitleElement />}
      data-slot="alert-dialog-title"
      className={cn(headingVariants({ size: "section" }), className)}
      {...props}
    />
  );
}

function AlertDialogDescription({ className, ...props }: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(textVariants({ tone: "muted" }), className)}
      {...props}
    />
  );
}

/** Closes the dialog after its `onClick`, unless that calls `event.preventDefault()`. */
function AlertDialogAction({
  variant = "default",
  size = "default",
  onClick,
  ...props
}: AlertDialogPrimitive.Close.Props & ButtonVariants) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-action"
      render={<Button variant={variant} size={size} />}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) event.preventBaseUIHandler();
      }}
      {...props}
    />
  );
}

function AlertDialogCancel({
  variant = "outline",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props & ButtonVariants) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      ref={useContext(CancelRefContext)}
      render={<Button variant={variant} size={size} />}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
};
