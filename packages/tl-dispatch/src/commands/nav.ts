import type { CommandDefinition } from "./catalog";

/** A page the sidebar lists and a `G` chord jumps to. The row's key hint reads the same entry. */
export interface NavDestination {
  name: string;
  label: string;
  path: string;
  /** The letter after `G`; none where no letter is free and clear. */
  key?: string;
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { name: "inbox", label: "Inbox", path: "/", key: "i" },
  { name: "agents", label: "Agents", path: "/agents", key: "a" },
  { name: "priorities", label: "Priorities", path: "/priorities" },
  { name: "delivery", label: "Delivery", path: "/delivery" },
  { name: "pipeline", label: "Pipeline", path: "/pipeline" },
  { name: "machines", label: "Machines", path: "/machines", key: "m" },
  { name: "settings", label: "Settings", path: "/settings", key: "s" },
];

export function navCommandName(destination: NavDestination): string {
  return `go-${destination.name}`;
}

export function navCommandDefinitions(
  destinations: readonly NavDestination[] = NAV_DESTINATIONS
): CommandDefinition[] {
  return destinations.map((destination) => ({
    name: navCommandName(destination),
    label: `Go to ${destination.label}`,
    keys: destination.key === undefined ? [] : [`g ${destination.key}`],
  }));
}
