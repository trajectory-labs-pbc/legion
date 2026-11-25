import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "cn";
import { type ComponentProps, createContext, type RefObject, useContext, useRef } from "react";
import { coveredClass, modalPopupMotion, scrimClass } from "#registry/legion/lib/overlay-styles";
import { headingVariants, textVariants } from "#registry/legion/lib/typography";
import { Button, type ButtonVariants } from "#registry/legion/ui/button";
import { OverlayOutline, SurfaceTitleElement } from "#registry/legion/ui/heading";

const AlertDialog = AlertDialogPrimitive.Root;

// One dialog for many triggers: each trigger hands the dialog its own payload.
const createAlertDialogHandle = AlertDialogPrimitive.createHandle;

function AlertDialogTrigger<Payload>(props: AlertDialogPrimitive.Trigger.Props<Payload>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal(props: AlertDialogPrimitive.Portal.Props) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(scrimClass, className)}
      {...props}
    />
  );
}

// The dialog opens with the focus on Cancel, the choice that changes nothing.
const CancelRefContext = createContext<RefObject<HTMLButtonElement | null> | null>(null);

function AlertDialogContent({ className, children, ...props }: AlertDialogPrimitive.Popup.Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Viewport
        data-slot="alert-dialog-viewport"
        className="fixed inset-0 z-50 flex overflow-y-auto overscroll-contain p-4"
      >
        <AlertDialogPrimitive.Popup
          data-slot="alert-dialog-content"
          initialFocus={() => cancelRef.current}
          className={cn(
            "relative m-auto grid w-full gap-4 rounded-lg border bg-background p-6 outline-hidden sm:max-w-lg",
            modalPopupMotion,
            coveredClass,
            className
          )}
          {...props}
        >
          <CancelRefContext.Provider value={cancelRef}>
            <OverlayOutline>{children}</OverlayOutline>
          </CancelRefContext.Provider>
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

// The caller's ref goes on the rendered button, so it does not replace the one focus starts from.
function AlertDialogCancel({
  variant = "outline",
  size = "default",
  ref,
  ...props
}: AlertDialogPrimitive.Close.Props & ButtonVariants) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      ref={useContext(CancelRefContext)}
      render={<Button ref={ref} variant={variant} size={size} />}
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
  createAlertDialogHandle,
};
