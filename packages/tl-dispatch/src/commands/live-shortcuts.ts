import type { KeyBindingDescription, KeymapScope } from "@upstream-dispatch/features/shell/keymap";

import { commandIdOf } from "./bindings";
import { DEFAULT_GROUP } from "./groups";
import { clashChecker, keySteps } from "./keys";
import type { Catalog, CommandGroup } from "./schema";
import type { UpstreamLabels } from "./upstream-labels";

/** One command as the sheet lists it: each key that runs it, in the engine's syntax. */
interface ShortcutRow {
  id: string;
  label: string;
  keys: readonly string[];
}

export interface ShortcutSection {
  group: CommandGroup;
  rows: readonly ShortcutRow[];
}

/** Every reader knows Escape: the sheet leaves out a key that starts with it, which still runs. */
const startsWithEscape = (keys: string) => keySteps(keys)[0] === "Escape";

function scopeGroup(scope: KeymapScope): CommandGroup {
  return { id: `scope:${scope}`, label: scope.charAt(0).toUpperCase() + scope.slice(1) };
}

/**
 * The keys that run now, as the engine resolves them: the enabled bindings of the live scopes,
 * innermost first, less any key an inner scope or an earlier binding already takes. Our commands
 * come from the catalog, grouped as it says and listed once with all their keys; upstream's
 * bindings are grouped by their scope.
 */
export function liveShortcuts(
  described: readonly KeyBindingDescription[],
  liveScopes: readonly KeymapScope[],
  catalog: Catalog,
  upstreamLabels: UpstreamLabels = {}
): ShortcutSection[] {
  const clash = clashChecker();
  const clashesAny = (held: readonly string[], keys: string) =>
    held.some((other) => clash(other, keys));
  const taken: string[] = [];
  const sections = new Map<string, { group: CommandGroup; rows: Map<string, ShortcutRow> }>();
  for (const scope of [...liveScopes].reverse()) {
    const inScope = described.filter((binding) => binding.scope === scope && binding.enabled);
    const claimed: string[] = [];
    for (const binding of inScope) {
      const keys = binding.keys.filter(
        (keys) => !clashesAny(taken, keys) && !clashesAny(claimed, keys)
      );
      claimed.push(...keys);
      const shown = keys.filter((keys) => !startsWithEscape(keys));
      const own = catalog.find(commandIdOf(binding.id));
      if (shown.length === 0 || own?.hideFrom?.includes("sheet") === true) continue;
      const group = own === undefined ? scopeGroup(scope) : (own.group ?? DEFAULT_GROUP);
      const label = upstreamLabels[`${scope}:${binding.id}`]?.label ?? binding.label;
      const rowId = own?.id ?? `${scope}:${label}`;
      const section = sections.get(group.id) ?? { group, rows: new Map<string, ShortcutRow>() };
      sections.set(group.id, section);
      const row = section.rows.get(rowId);
      section.rows.set(rowId, {
        id: rowId,
        label: row?.label ?? label,
        keys: [...new Set([...(row?.keys ?? []), ...shown])],
      });
    }
    taken.push(...claimed);
  }
  return [...sections.values()].map(({ group, rows }) => ({ group, rows: [...rows.values()] }));
}
