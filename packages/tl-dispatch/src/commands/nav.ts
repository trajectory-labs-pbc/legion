import {
  BotIcon,
  InboxIcon,
  ListOrderedIcon,
  PackageCheckIcon,
  ServerIcon,
  SettingsIcon,
  WorkflowIcon,
} from "lucide-react";

import { COMMAND_GROUPS } from "./groups";
import type { CommandDefinition, CommandIcon } from "./schema";

/**
 * A page the sidebar lists and a `G` chord jumps to. The row's key hint reads the same entry;
 * its address is its page route's (`NAV_PAGES` in the shell).
 */
interface NavDestination {
  name: string;
  label: string;
  icon: CommandIcon;
  /** The letter after `G`: upstream's where it binds one, else a letter of the label that no
   *  other `G` chord holds. */
  key: string;
}

export const NAV_DESTINATIONS = [
  { name: "inbox", label: "Inbox", icon: InboxIcon, key: "i" },
  { name: "agents", label: "Agents", icon: BotIcon, key: "a" },
  { name: "priorities", label: "Priorities", icon: ListOrderedIcon, key: "o" },
  { name: "delivery", label: "Delivery", icon: PackageCheckIcon, key: "e" },
  { name: "pipeline", label: "Pipeline", icon: WorkflowIcon, key: "l" },
  { name: "machines", label: "Machines", icon: ServerIcon, key: "m" },
  { name: "settings", label: "Settings", icon: SettingsIcon, key: "s" },
] as const satisfies readonly NavDestination[];

export type NavName = (typeof NAV_DESTINATIONS)[number]["name"];

type NavCommandName = `go-${NavName}`;

export function navCommandName(name: NavName): NavCommandName {
  return `go-${name}`;
}

/** Each destination's `go-*` action: it runs `goTo` with its own destination. */
export function navActions(goTo: (destination: NavName) => void): {
  readonly [Name in NavCommandName]: { run: () => void };
} {
  // One entry per destination; defineActions refuses a missing or extra name when it first runs.
  return Object.fromEntries(
    NAV_DESTINATIONS.map(({ name }) => [navCommandName(name), { run: () => goTo(name) }])
  ) as { readonly [Name in NavCommandName]: { run: () => void } };
}

export function navCommandDefinitions(): readonly (CommandDefinition & {
  name: NavCommandName;
})[] {
  return NAV_DESTINATIONS.map((destination: NavDestination & { name: NavName }) => ({
    name: navCommandName(destination.name),
    label: `Go to ${destination.label}`,
    icon: destination.icon,
    group: COMMAND_GROUPS.navigation,
    keys: [`g ${destination.key}`],
  }));
}
