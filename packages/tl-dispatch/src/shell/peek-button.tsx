import { CommandButton, type CommandButtonProps } from "@/commands/command-button";

/** Opens the inbox drawer over the page: "Peek" in its tooltip, upstream's fuller name for a screen reader. */
export function PeekButton(props: Omit<CommandButtonProps, "commandId" | "label" | "size">) {
  return (
    <CommandButton
      aria-label="Peek at the inbox without leaving this page"
      commandId="global.inbox-drawer"
      label="Peek"
      size="icon-sm"
      {...props}
    />
  );
}
