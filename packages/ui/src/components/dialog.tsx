import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import type { ComponentProps } from "react";
import {
  closeButtonClass,
  coveredClass,
  modalPopupMotion,
  scrimClass,
} from "#registry/legion/lib/overlay-styles";
import { headingVariants, textVariants } from "#registry/legion/lib/typography";
import { OverlayOutline, SurfaceTitleElement } from "#registry/legion/ui/heading";
import { ModalSurfaceProvider } from "#registry/legion/ui/modal-surface-context";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(scrimClass, className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel = "Close",
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean; closeLabel?: string }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Viewport
        data-slot="dialog-viewport"
        className="fixed inset-0 z-50 flex overflow-y-auto overscroll-contain p-4"
      >
        <DialogPrimitive.Popup
          data-slot="dialog-content"
          className={cn(
            "relative m-auto grid w-full gap-4 rounded-lg border bg-background p-6 outline-hidden sm:max-w-lg",
            modalPopupMotion,
            coveredClass,
            className
          )}
          {...props}
        >
          <ModalSurfaceProvider>
            <OverlayOutline>{children}</OverlayOutline>
          </ModalSurfaceProvider>
          {showCloseButton && <DialogCloseButton label={closeLabel} />}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Viewport>
    </DialogPortal>
  );
}

function DialogCloseButton({
  className,
  label = "Close",
  ...props
}: DialogPrimitive.Close.Props & { label?: string }) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      aria-label={label}
      className={cn(closeButtonClass, className)}
      {...props}
    >
      <XIcon aria-hidden="true" />
    </DialogPrimitive.Close>
  );
}

function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      render={<SurfaceTitleElement />}
      data-slot="dialog-title"
      className={cn(headingVariants({ size: "section" }), className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(textVariants({ tone: "muted" }), className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
