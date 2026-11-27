import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { cn } from "cn";
import type { ReactNode } from "react";

import { popupMotion } from "#registry/legion/lib/overlay-styles";
import { textVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";
import { Button } from "#registry/legion/ui/button";
import { KbdSequence } from "#registry/legion/ui/kbd";

/** A toast's own fields beside Base UI's. The caller binds the shortcut's key; the toast only
 *  shows its caps and names it in `aria-keyshortcuts`. */
interface ToastData {
  icon?: ReactNode;
  /** The caps by step (`[["⇧", "Z"]]`) and the `aria-keyshortcuts` value (`"Shift+Z"`). */
  shortcut?: { caps: readonly (readonly string[])[]; keys: string };
}

type ToastObject = ToastPrimitive.Root.ToastObject<ToastData>;

/** One toast: an icon, its `title` on one line and at most one action, with no focus
 *  taken (TO1, TO3). Its `description` is its tooltip. `type: "danger"` is a failure, which the
 *  caller adds with `priority: "high"` so that it is announced at once. */
function Toast({ toast }: { toast: ToastObject }) {
  const { icon, shortcut } = toast.data ?? {};
  return (
    <ToastPrimitive.Root
      className={cn(
        "group/toast flex min-w-0 max-w-sm items-center gap-2 rounded-lg border border-border bg-popover py-1.5 pr-1.5 pl-3 text-popover-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus data-limited:hidden",
        popupMotion
      )}
      data-slot="toast"
      // Escape belongs to the page under the toast (TO2).
      onKeyDown={(event) => {
        if (event.key === "Escape") event.preventBaseUIHandler();
      }}
      swipeDirection={[]}
      title={typeof toast.description === "string" ? toast.description : undefined}
      toast={toast}
    >
      {isDrawn(icon) ? (
        <span
          aria-hidden
          className="flex shrink-0 text-muted-foreground group-data-[type=danger]/toast:text-danger [&>svg]:size-4"
        >
          {icon}
        </span>
      ) : null}
      <ToastPrimitive.Title className={cn(textVariants(), "min-w-0 flex-1 truncate")} />
      <ToastPrimitive.Action
        aria-keyshortcuts={shortcut?.keys}
        render={(props) => (
          <Button {...props} className={cn(props.className, "shrink-0")} size="xs" variant="ghost">
            {props.children}
            {shortcut === undefined ? null : (
              <span aria-hidden>
                <KbdSequence steps={shortcut.caps} />
              </span>
            )}
          </Button>
        )}
      />
    </ToastPrimitive.Root>
  );
}

/** The store's toasts, oldest first, in one always-mounted polite region for the status corner to
 *  place. Base UI's provider holds the store: its timer pauses while the pointer or the focus is on
 *  the toasts, and a toast past its `limit` is hidden. */
function ToastViewport({ className }: { className?: string }) {
  const { toasts } = ToastPrimitive.useToastManager<ToastData>();
  return (
    <ToastPrimitive.Viewport
      className={cn("flex flex-col items-end gap-2", className)}
      data-slot="toast-viewport"
    >
      {[...toasts].reverse().map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </ToastPrimitive.Viewport>
  );
}

const { Provider: ToastProvider, createToastManager, useToastManager } = ToastPrimitive;

export {
  createToastManager,
  Toast,
  type ToastData,
  type ToastObject,
  ToastProvider,
  ToastViewport,
  useToastManager,
};
