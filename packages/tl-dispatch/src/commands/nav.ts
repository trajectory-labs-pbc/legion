import {
  BotIcon,
  InboxIcon,
  ListOrderedIcon,
  PackageCheckIcon,
  ServerIcon,
  SettingsIcon,
  WorkflowIcon,
} from "lucide-react";

import type { CommandDefinition, CommandIcon } from "./catalog";
import { COMMAND_GROUPS } from "./groups";

/** A page the sidebar lists and a `G` chord jumps to. The row's key hint reads the same entry. */
export interface NavDestination {
  name: string;
  label: string;
  path: string;
  icon: CommandIcon;
  /** The letter after `G`; none where no letter is free and clear. */
  key?: string;
}

export const NAV_DESTINATIONS = [
  { name: "inbox", label: "Inbox", path: "/", icon: InboxIcon, key: "i" },
  { name: "agents", label: "Agents", path: "/agents", icon: BotIcon, key: "a" },
  { name: "priorities", label: "Priorities", path: "/priorities", icon: ListOrderedIcon },
  { name: "delivery", label: "Delivery", path: "/delivery", icon: PackageCheckIcon },
  { name: "pipeline", label: "Pipeline", path: "/pipeline", icon: WorkflowIcon },
  { name: "machines", label: "Machines", path: "/machines", icon: ServerIcon, key: "m" },
  { name: "settings", label: "Settings", path: "/settings", icon: SettingsIcon, key: "s" },
] as const satisfies readonly NavDestination[];

export type NavName = (typeof NAV_DESTINATIONS)[number]["name"];

export type NavCommandName = `go-${NavName}`;

export function navCommandName(name: NavName): NavCommandName {
  return `go-${name}`;
}

export function navCommandDefinitions(): readonly (CommandDefinition & {
  name: NavCommandName;
})[] {
  return NAV_DESTINATIONS.map((destination: NavDestination & { name: NavName }) => ({
    name: navCommandName(destination.name),
    label: `Go to ${destination.label}`,
    icon: destination.icon,
    group: COMMAND_GROUPS.navigation,
    keys: destination.key === undefined ? [] : [`g ${destination.key}`],
  }));
}
