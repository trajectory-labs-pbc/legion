/** A section of the shortcuts sheet. Declare each once, here: the sheet compares groups by id. */
export interface CommandGroup {
  readonly id: string;
  readonly label: string;
}

export const COMMAND_GROUPS = {
  general: { id: "general", label: "General" },
  navigation: { id: "navigation", label: "Navigation" },
  layout: { id: "layout", label: "Layout" },
  help: { id: "help", label: "Help" },
} as const satisfies Record<string, CommandGroup>;

/** The section of a command declared without a group. */
export const DEFAULT_GROUP: CommandGroup = COMMAND_GROUPS.general;
