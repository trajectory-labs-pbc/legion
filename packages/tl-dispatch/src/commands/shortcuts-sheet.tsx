import { importWhenOnline } from "@upstream-dispatch/features/shell/DeploymentResilience";
import { ErrorBoundary } from "@upstream-dispatch/features/shell/ErrorBoundary";
import {
  appKeymap,
  type KeyBindingDescription,
  type Keymap,
  type KeymapScope,
} from "@upstream-dispatch/features/shell/keymap";
import { type ComponentType, lazy, Suspense, useCallback, useState } from "react";

import { appCatalog, DEFAULT_GROUP, UPSTREAM_LABELS, type UpstreamLabels } from "./catalog";
import { appStack, UNDER_OVERLAY } from "./engine";
import { clashes, keyChecker } from "./keys";
import type { Catalog, CommandGroup } from "./schema";
import type { ShortcutsSheetProps } from "./shortcuts-sheet-view";

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

/**
 * A component whose code is its own chunk, drawn as nothing until it arrives. A chunk that fails
 * offline loads again when the network returns; one that fails online shows the region's error
 * in its place, and the rest of the app stays.
 */
export function lazyRegion<Props extends object>(
  region: string,
  load: () => Promise<ComponentType<Props>>
): ComponentType<Props> {
  const View = lazy(() => importWhenOnline(load).then((component) => ({ default: component })));
  return function LazyRegion(props: Props) {
    return (
      <ErrorBoundary region={region}>
        <Suspense fallback={null}>
          <View {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

/** The keys that run now, below anything the sheet itself opens. */
export function readLiveShortcuts(): ShortcutSection[] {
  return liveShortcuts(appKeymap.describe(), appStack.liveScopes(), appCatalog, UPSTREAM_LABELS);
}

export interface ShortcutsSheetState {
  open: boolean;
  /** The keys read when the sheet last opened. */
  sections: readonly ShortcutSection[];
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

/**
 * The sheet's state. Opening reads the live keys at that moment, before the sheet's own layer
 * covers them: the engine evaluates each gate as it is read.
 */
export function useShortcutsSheet(
  read: () => readonly ShortcutSection[] = readLiveShortcuts
): ShortcutsSheetState {
  const [state, setState] = useState<{ open: boolean; sections: readonly ShortcutSection[] }>({
    open: false,
    sections: [],
  });
  const setOpen = useCallback(
    (open: boolean) => {
      if (open) setState({ open, sections: read() });
      else setState((current) => ({ ...current, open }));
    },
    [read]
  );
  // The key reads the last commit's toggle, so this open is the one on screen.
  const toggle = useCallback(() => setOpen(!state.open), [setOpen, state.open]);
  return { ...state, setOpen, toggle };
}

const ShortcutsSheetView = lazyRegion("the shortcuts sheet", () =>
  import("./shortcuts-sheet-view").then((module) => module.ShortcutsSheet)
);

/** The shortcuts sheet, whose code loads the first time it opens and stays for its close. */
export function ShortcutsSheet(props: ShortcutsSheetProps) {
  const [opened, setOpened] = useState(false);
  if (props.open && !opened) setOpened(true);
  return opened ? <ShortcutsSheetView {...props} /> : null;
}
