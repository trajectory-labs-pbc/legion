import { cloneElement, type ReactElement, useEffect, useSyncExternalStore } from "react";

import type { CommandId } from "./app-catalog";
import { ariaKeyShortcuts } from "./chips";
import { useCommand, useCommandShortcut, useKeysReach } from "./hooks";
import type { HotkeyTooltipPopup } from "./hotkey-tooltip-popup";

let popup: typeof HotkeyTooltipPopup | undefined;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

/** Loads the tooltip's code once. The first tooltip mounted asks for it, after the first paint. */
export function loadHotkeyTooltip(): Promise<void> {
  loading ??= import("./hotkey-tooltip-popup").then((module) => {
    popup = module.HotkeyTooltipPopup;
    for (const listener of listeners) listener();
  });
  return loading;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface HotkeyTooltipProps {
  commandId: CommandId;
  /** The control to wrap; it becomes the tooltip's trigger. */
  children: ReactElement<{ "aria-keyshortcuts"?: string }>;
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
  const chips = useCommandShortcut(commandId);
  const reaches = useKeysReach(commandId);
  const Popup = useSyncExternalStore(subscribe, () => popup);
  useEffect(() => {
    void loadHotkeyTooltip();
  }, []);
  if (view === undefined) return children;
  const keys = view.enabled && reaches ? ariaKeyShortcuts(view.command.keys ?? []) : undefined;
  if (Popup === undefined) return cloneElement(children, { "aria-keyshortcuts": keys });
  return (
    <Popup
      ariaKeyShortcuts={keys}
      chips={chips}
      label={label ?? view.label}
      side={side}
      trigger={children}
    />
  );
}
