import {
  appKeymap,
  DIALOG_SCOPE,
  type Keymap,
  type KeymapScope,
} from "@upstream-dispatch/features/shell/keymap";

import {
  focusedOverlays,
  type LayerSource,
  type OverlayKind,
  type OverlayLayer,
} from "./focused-overlay";
import type { Catalog, CatalogCommand, OverlayReach } from "./schema";

/** The overlay kinds a global command still runs under. Under the shortcuts sheet only `?` acts. */
const GLOBAL_COMMANDS_RUN_UNDER: Readonly<Record<OverlayKind, boolean>> = {
  dialog: false,
  "alert-dialog": false,
  sheet: false,
  drawer: true,
  menu: false,
  popover: false,
  select: false,
};

/** A dialog that upstream's code opened (its palette, a `useDialog` sheet), not one of our layers. */
export const UPSTREAM = "upstream";

type DialogOwner = OverlayLayer | typeof UPSTREAM;

export interface EngineStack {
  /** The dialog on top of the key engine's stack, or undefined when none is open. */
  top(): DialogOwner | undefined;
  /**
   * Whether global commands of this reach run now: dialogs are open, each ours, and each lets
   * them through. One of ours is open while it holds the focus. `under-all` passes every kind but an alert dialog, which waits for a decision.
   */
  passes(reach: OverlayReach): boolean;
  /** The scopes whose bindings can fire now, innermost last: `dialog` alone while one is open. */
  liveScopes(): readonly KeymapScope[];
  subscribe(listener: () => void): () => void;
}

declare global {
  /** Each key engine's tracker, kept on the window so a hot reload of this module finds it. */
  var __tlDispatchEngineStacks: WeakMap<Keymap, EngineStack> | undefined;
}

globalThis.__tlDispatchEngineStacks ??= new WeakMap();
const trackers = globalThis.__tlDispatchEngineStacks;

/**
 * Follows the key engine's scope stack, in order. Each overlay of ours that holds the focus
 * pushes one dialog scope, so the page's keys and the global ones stop under it;
 * every other push is upstream's, seen by wrapping the engine's `pushScope`, which upstream's
 * hooks call. The wrap happens once per engine: a second call returns the first tracker.
 */
export function trackEngineStack(keymap: Keymap, layers: LayerSource): EngineStack {
  const existing = trackers.get(keymap);
  if (existing !== undefined) return existing;
  const stack: { scope: KeymapScope; owner: DialogOwner | null }[] = [];
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const push = keymap.pushScope;
  const pushEntry = (scope: KeymapScope, owner: DialogOwner | null) => {
    const pop = push(scope);
    const entry = { scope, owner };
    stack.push(entry);
    notify();
    return () => {
      pop();
      const index = stack.indexOf(entry);
      if (index === -1) return;
      stack.splice(index, 1);
      notify();
    };
  };
  keymap.pushScope = (scope) => pushEntry(scope, scope === DIALOG_SCOPE ? UPSTREAM : null);

  const pops = new Map<OverlayLayer, () => void>();
  const sync = () => {
    const open = layers.get();
    if (open.length === pops.size && open.every((layer) => pops.has(layer))) return;
    for (const [layer, pop] of pops) {
      if (!open.includes(layer)) {
        pops.delete(layer);
        pop();
      }
    }
    for (const layer of open) {
      if (!pops.has(layer)) pops.set(layer, pushEntry(DIALOG_SCOPE, layer));
    }
  };
  sync();
  layers.subscribe(sync);
  // Removing the focused element fires no focus event, so each key press reads the focus again
  // before the engine picks the scopes it consults.
  const handleKeyDown = keymap.handleKeyDown;
  keymap.handleKeyDown = (event) => {
    sync();
    return handleKeyDown(event);
  };

  const dialogs = () => stack.flatMap(({ owner }) => (owner === null ? [] : [owner]));
  const tracker: EngineStack = {
    top: () => dialogs().at(-1),
    passes(reach) {
      const open = dialogs();
      return (
        open.length > 0 &&
        open.every(
          (owner) =>
            owner !== UPSTREAM &&
            (reach === "under-all"
              ? owner.kind !== "alert-dialog"
              : GLOBAL_COMMANDS_RUN_UNDER[owner.kind])
        )
      );
    },
    liveScopes() {
      if (stack.some(({ scope }) => scope === DIALOG_SCOPE)) return [DIALOG_SCOPE];
      return [...new Set<KeymapScope>(["global", ...stack.map(({ scope }) => scope)])];
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  trackers.set(keymap, tracker);
  return tracker;
}

/** The app's key engine, followed from the first import of the commands, before any dialog opens. */
export const appStack = trackEngineStack(appKeymap, focusedOverlays);

/**
 * Whether a command's keys run with the overlays open now: its scope is live, or it is a global
 * command whose copy reaches under them. An overlay's own context is live while it is drawn.
 */
export function keysReach(catalog: Catalog, command: CatalogCommand, stack: EngineStack): boolean {
  const { scope } = catalog.context(command.context);
  if (scope === DIALOG_SCOPE || stack.liveScopes().includes(scope)) return true;
  return scope === "global" && stack.passes(command.overlays ?? "under-most");
}

/** The reaches that pass now, as one string, so a change re-renders and nothing else does. */
export function passing(stack: EngineStack): string {
  return (["under-most", "under-all"] as const).filter((reach) => stack.passes(reach)).join(" ");
}
