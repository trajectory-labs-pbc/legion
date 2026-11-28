import {
  BotIcon,
  InboxIcon,
  ListOrderedIcon,
  PackageCheckIcon,
  ServerIcon,
  SettingsIcon,
  WorkflowIcon,
} from "lucide-react";

import { type RoutePath, routes } from "@/navigation/routes";

import { COMMAND_GROUPS } from "./groups";
import type { CommandDefinition, CommandIcon } from "./schema";

/**
 * A page the sidebar lists and a `G` chord jumps to: the sidebar draws its row from the entry,
 * and the catalog makes its `go-*` command from it.
 */
interface NavDestination {
  route: RoutePath;
  label: string;
  icon: CommandIcon;
  /** The letter after `G`: upstream's where it binds one, else a letter of the label that no
   *  other `G` chord holds. */
  key: string;
}

/** The sidebar's destinations by name, in the sidebar's order. */
export const NAV_DESTINATIONS = {
  inbox: { route: routes.inbox.home, label: "Inbox", icon: InboxIcon, key: "i" },
  agents: { route: routes.agents.list, label: "Agents", icon: BotIcon, key: "a" },
  priorities: {
    route: routes.priorities.list,
    label: "Priorities",
    icon: ListOrderedIcon,
    key: "o",
  },
  delivery: {
    route: routes.delivery.delivery,
    label: "Delivery",
    icon: PackageCheckIcon,
    key: "e",
  },
  pipeline: { route: routes.delivery.pipeline, label: "Pipeline", icon: WorkflowIcon, key: "l" },
  machines: { route: routes.machines.list, label: "Machines", icon: ServerIcon, key: "m" },
  settings: { route: routes.settings.settings, label: "Settings", icon: SettingsIcon, key: "s" },
} as const satisfies Readonly<Record<string, NavDestination>>;

export type NavName = keyof typeof NAV_DESTINATIONS;

const isNavName = (name: string): name is NavName => Object.hasOwn(NAV_DESTINATIONS, name);

/** The destinations' names, in the sidebar's order. */
export const NAV_NAMES: readonly NavName[] = Object.keys(NAV_DESTINATIONS).filter(isNavName);

type NavCommandName = `go-${NavName}`;

export function navCommandName(name: NavName): NavCommandName {
  return `go-${name}`;
}

export function navCommandDefinitions(): readonly (CommandDefinition & {
  name: NavCommandName;
})[] {
  return NAV_NAMES.map((name) => {
    const destination: NavDestination = NAV_DESTINATIONS[name];
    return {
      name: navCommandName(name),
      label: `Go to ${destination.label}`,
      icon: destination.icon,
      group: COMMAND_GROUPS.navigation,
      keys: [`g ${destination.key}`],
    };
  });
}
