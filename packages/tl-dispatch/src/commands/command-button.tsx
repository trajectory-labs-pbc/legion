import { Button, type ButtonProps } from "@/ui/button";
import type { CommandId } from "./app-catalog";
import { type CommandView, commandStore } from "./command-store";
import { HotkeyTooltip, type HotkeyTooltipProps } from "./hotkey-tooltip";
import { useCommand } from "./use-command";

export interface CommandButtonProps extends Omit<ButtonProps, "onClick" | "children" | "render"> {
  commandId: CommandId;
  /** Shows the icon alone, named by `aria-label`. Defaults to true for an `icon*` size. */
  iconOnly?: boolean;
  /** Replaces the catalog's label; the icon, the key and the run stay the command's. */
  label?: string;
  /** A disabled command hides its button unless this is set: a greyed primary looks broken. */
  showIfDisabled?: boolean;
  /** Where the tooltip opens; the top unless the button sits on an edge, as the sidebar's do. */
  tooltipSide?: HotkeyTooltipProps["side"];
}

/** A destructive command draws as one; an icon-only button is ghost; any other is the default. */
export function commandButtonVariant(view: CommandView, iconOnly: boolean): ButtonProps["variant"] {
  if (view.command.destructive === true) return "destructive";
  return iconOnly ? "ghost" : "default";
}

/** A button for one command: its label, icon, key and gate come from the catalog, and a click runs what its key runs. */
export function CommandButton({
  commandId,
  iconOnly,
  label,
  size,
  variant,
  showIfDisabled = false,
  tooltipSide,
  ...rest
}: CommandButtonProps) {
  const view = useCommand(commandId);
  if (view === undefined || (!view.enabled && !showIfDisabled)) return null;
  const onlyIcon = iconOnly ?? size?.startsWith("icon") ?? false;
  const shown = label ?? view.label;
  const Icon = view.command.icon;
  return (
    <HotkeyTooltip commandId={commandId} label={shown} side={tooltipSide}>
      <Button
        {...rest}
        aria-label={onlyIcon ? shown : undefined}
        disabled={!view.enabled}
        onClick={() => commandStore.run(commandId)}
        size={size}
        variant={variant ?? commandButtonVariant(view, onlyIcon)}
      >
        {Icon === undefined ? null : <Icon aria-hidden />}
        {onlyIcon ? null : <span>{shown}</span>}
      </Button>
    </HotkeyTooltip>
  );
}
