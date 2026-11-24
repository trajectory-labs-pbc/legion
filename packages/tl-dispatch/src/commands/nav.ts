import type { CommandDefinition } from "./catalog";

/** A page the sidebar lists and a `G` chord jumps to. The row's key hint reads the same entry. */
export interface NavDestination {
  name: string;
  label: string;
  path: string;
  icon: string;
  /** The letter after `G`; none where no letter is free and clear. */
  key?: string;
}

export const NAV_DESTINATIONS: readonly NavDestination[] = [
  { name: "inbox", label: "Inbox", path: "/", icon: "inbox", key: "i" },
  { name: "agents", label: "Agents", path: "/agents", icon: "bot", key: "a" },
  { name: "priorities", label: "Priorities", path: "/priorities", icon: "list-ordered" },
  { name: "delivery", label: "Delivery", path: "/delivery", icon: "chart-line" },
  { name: "pipeline", label: "Pipeline", path: "/pipeline", icon: "workflow" },
  { name: "machines", label: "Machines", path: "/machines", icon: "server", key: "m" },
  { name: "settings", label: "Settings", path: "/settings", icon: "settings", key: "s" },
];

/** The keys of a destination's command; the sidebar row shows the first as its hint. */
export function navKeys(destination: NavDestination): string[] {
  return destination.key === undefined ? [] : [`g ${destination.key}`];
}

export function navCommandName(destination: NavDestination): string {
  return `go-${destination.name}`;
}

export function navCommandDefinitions(
  destinations: readonly NavDestination[] = NAV_DESTINATIONS
): CommandDefinition[] {
  return destinations.map((destination) => ({
    name: navCommandName(destination),
    label: `Go to ${destination.label}`,
    keys: navKeys(destination),
    icon: destination.icon,
    group: "other",
    keywords: [destination.label.toLowerCase()],
  }));
}
