import { cn } from "cn";
import type { ReactNode } from "react";

import { textVariants } from "#registry/legion/lib/typography";
import { isDrawn } from "#registry/legion/lib/utils";
import { Button } from "#registry/legion/ui/button";
import { KbdSequence } from "#registry/legion/ui/kbd";

interface ToastAction {
  label: string;
  onPress: () => void;
  /** The key that also presses it, as caps by step (`[["⇧", "Z"]]`). */
  shortcut?: readonly (readonly string[])[];
}

interface ToastProps {
  /** One line. */
  text: string;
  /** The rest of the message, in the text's tooltip. */
  detail?: string;
  icon?: ReactNode;
  /** A failure is announced at once (`alert`); any other toast politely (`status`). */
  tone?: "default" | "failure";
  action?: ToastAction;
}

/** A one-line notice: an icon, the text and at most one action (TO1, TO3). It takes no focus. */
function Toast({ text, detail, icon, tone = "default", action }: ToastProps) {
  return (
    <div
      aria-description={detail}
      className="flex min-w-0 max-w-sm items-center gap-2 rounded-lg border border-border bg-popover py-1.5 pr-1.5 pl-3 text-popover-foreground"
      data-slot="toast"
      data-tone={tone}
      role={tone === "failure" ? "alert" : "status"}
    >
      {isDrawn(icon) ? (
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 [&>svg]:size-4",
            tone === "failure" ? "text-danger" : "text-muted-foreground"
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className={cn(textVariants(), "min-w-0 flex-1 truncate")} title={detail}>
        {text}
      </span>
      {action === undefined ? null : (
        <Button className="shrink-0" onClick={action.onPress} size="xs" variant="ghost">
          {action.label}
          {action.shortcut === undefined ? null : <KbdSequence steps={action.shortcut} />}
        </Button>
      )}
    </div>
  );
}

interface ToastEntry extends ToastProps {
  id: string;
}

/** The toasts its caller holds, oldest first. It reports the pointer on each, so its caller keeps
 *  that toast while the pointer stays (TO2). */
function ToastHost({
  toasts,
  onHoverChange,
}: {
  toasts: readonly ToastEntry[];
  onHoverChange: (id: string, hovered: boolean) => void;
}) {
  return (
    <ol className="flex flex-col items-end gap-2" data-slot="toast-host">
      {toasts.map(({ id, ...toast }) => (
        <li
          className="flex max-w-full"
          key={id}
          onPointerEnter={() => onHoverChange(id, true)}
          onPointerLeave={() => onHoverChange(id, false)}
        >
          <Toast {...toast} />
        </li>
      ))}
    </ol>
  );
}

export { Toast, type ToastAction, type ToastEntry, ToastHost, type ToastProps };
