import { cloneElement, type ReactElement, type Ref, useEffect, useSyncExternalStore } from "react";

import { loadNamed } from "@/loading/lazy-named";
import type { CommandId } from "./app-catalog";
import type { HotkeyTooltipPopup } from "./hotkey-tooltip-popup";
import { ariaKeyShortcuts } from "./key-chips";
import { useCommand, useCommandShortcut } from "./use-command";
import { useKeptFocus } from "./use-kept-focus";

let popup: typeof HotkeyTooltipPopup | undefined;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

/**
 * Loads the tooltip's code once. The first tooltip mounted asks for it, after the first paint.
 * Offline it loads when the network returns; a failure online leaves every control working with
 * its keys and no tooltip, and the stale-chunk recovery reloads a page a deploy outdated.
 */
export function loadHotkeyTooltip(
  load: () => Promise<{ HotkeyTooltipPopup: typeof HotkeyTooltipPopup }> = () =>
    import("./hotkey-tooltip-popup")
): Promise<void> {
  loading ??= loadNamed(load, "HotkeyTooltipPopup").then(
    (loaded) => {
      popup = loaded;
      for (const listener of listeners) listener();
    },
    (error: unknown) => {
      console.error("Dispatch: the key tooltips failed to load", error);
    }
  );
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The tooltip's component once its code has loaded; the first caller starts the load. */
function useTooltipPopup(): typeof HotkeyTooltipPopup | undefined {
  const Popup = useSyncExternalStore(subscribe, () => popup);
  useEffect(() => {
    void loadHotkeyTooltip();
  }, []);
  return Popup;
}

type Trigger = ReactElement<{ "aria-keyshortcuts"?: string; ref?: Ref<HTMLElement> }>;

/** The app's tooltip for a control that runs no command: its label on hover and focus. */
export function LabelTooltip({
  children,
  label,
  side,
}: {
  children: Trigger;
  label: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const Popup = useTooltipPopup();
  const ref = useKeptFocus(children.props.ref);
  const trigger = cloneElement(children, { ref });
  if (Popup === undefined) return trigger;
  return (
    <Popup ariaKeyShortcuts={undefined} chips={null} label={label} side={side} trigger={trigger} />
  );
}

export interface HotkeyTooltipProps {
  commandId: CommandId;
  /** The control to wrap; it becomes the tooltip's trigger. */
  children: Trigger;
  /** The wrapped control's own label, when it says more than the catalog's. */
  label?: string;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Shows the command's label and key on hover and focus. The child stays as it is while the
 * command is not mounted, so the shell never flickers, and carries its keys alone until the
 * tooltip's code has loaded.
 */
export function HotkeyTooltip({ commandId, children, label, side }: HotkeyTooltipProps) {
  const view = useCommand(commandId);
  // No chips while the command is off or an overlay masks its keys: then no aria keys either.
  const chips = useCommandShortcut(commandId);
  const Popup = useTooltipPopup();
  const ref = useKeptFocus(children.props.ref);
  if (view === undefined) return cloneElement(children, { ref });
  const keys = chips === null ? undefined : ariaKeyShortcuts(view.command.keys ?? []);
  if (Popup === undefined) return cloneElement(children, { "aria-keyshortcuts": keys, ref });
  return (
    <Popup
      ariaKeyShortcuts={keys}
      chips={chips}
      label={label ?? view.label}
      side={side}
      trigger={cloneElement(children, { ref })}
    />
  );
}
