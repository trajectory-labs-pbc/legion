import type {
  KeyBindingDescription,
  Keymap,
  KeymapScope,
} from "@upstream-dispatch/features/shell/keymap";

import { UNDER_OVERLAY } from "./bindings";
import type { Catalog } from "./catalog";
import { type CommandGroup, DEFAULT_GROUP } from "./groups";
import { clashes, keyChecker } from "./keys";

/** One command as the sheet lists it: each key that runs it, in the engine's syntax. */
export interface ShortcutRow {
  id: string;
  label: string;
  keys: readonly string[];
}

export interface ShortcutSection {
  group: CommandGroup;
  rows: readonly ShortcutRow[];
}

/** Our labels for upstream's bindings, by `scope:id`, where theirs do not fit the sheet. */
export type UpstreamLabels = Readonly<Partial<Record<`${KeymapScope}:${string}`, string>>>;

/** Keys every reader knows; the sheet leaves them out, and they still run. */
export const UNIVERSAL_KEYS = ["Escape"] as const;

const UNIVERSAL = keyChecker(UNIVERSAL_KEYS);

/** Checks against single held keys, so held keys that clash among themselves never throw. */
function clashChecker(): (held: readonly string[], keys: string) => boolean {
  const checkers = new Map<string, Keymap>();
  return (held, keys) =>
    held.some((other) => {
      let checker = checkers.get(other);
      if (checker === undefined) {
        checker = keyChecker([other]);
        checkers.set(other, checker);
      }
      return clashes(checker, keys);
    });
}

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
  const taken: string[] = [];
  const sections = new Map<string, { group: CommandGroup; rows: Map<string, ShortcutRow> }>();
  for (const scope of [...liveScopes].reverse()) {
    const inScope = described.filter((binding) => binding.scope === scope && binding.enabled);
    const claimed: string[] = [];
    for (const binding of inScope) {
      const keys = binding.keys.filter((keys) => !clash(taken, keys) && !clash(claimed, keys));
      claimed.push(...keys);
      const shown = keys.filter((keys) => !clashes(UNIVERSAL, keys));
      const own = catalog.find(binding.id.replace(UNDER_OVERLAY, ""));
      if (shown.length === 0 || own?.hideFrom?.includes("sheet") === true) continue;
      const group = own === undefined ? scopeGroup(scope) : (own.group ?? DEFAULT_GROUP);
      const label = upstreamLabels[`${scope}:${binding.id}`] ?? binding.label;
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

/** The rows whose label holds the query, any case; a section left empty goes. */
export function filterShortcuts(
  sections: readonly ShortcutSection[],
  query: string
): ShortcutSection[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...sections];
  return sections
    .map(({ group, rows }) => ({
      group,
      rows: rows.filter((row) => row.label.toLowerCase().includes(needle)),
    }))
    .filter(({ rows }) => rows.length > 0);
}
