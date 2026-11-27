import { CommandButton, type CommandButtonProps } from "@/commands/command-button";

/** Opens the inbox drawer over the page; its name, icon and key are the catalog's. */
export function PeekButton(
  props: Omit<CommandButtonProps, "aria-label" | "commandId" | "label" | "size">
) {
  return <CommandButton commandId="global.inbox-drawer" size="icon-sm" {...props} />;
}
