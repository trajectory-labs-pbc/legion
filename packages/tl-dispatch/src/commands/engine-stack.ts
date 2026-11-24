import {
  appKeymap,
  DIALOG_SCOPE,
  type Keymap,
  type KeymapScope,
} from "@upstream-dispatch/features/shell/keymap";

import { type OverlayKind, type OverlayLayer, overlayStack } from "@/ui/overlay-layer";

/** The overlay kinds a global command still runs under. Under the shortcuts sheet only `?` acts. */
export const GLOBAL_COMMANDS_RUN_UNDER: Readonly<Record<OverlayKind, boolean>> = {
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

export type DialogOwner = OverlayLayer | typeof UPSTREAM;

/** How far a global command reaches under open overlays. */
export type OverlayReach = "under-most" | "under-all";

/** The open overlays, bottom first, as the registry's overlay stack holds them. */
export interface LayerSource {
  get(): readonly OverlayLayer[];
  subscribe(listener: () => void): () => void;
}

export interface EngineStack {
  /** The dialog on top of the key engine's stack, or undefined when none is open. */
  top(): DialogOwner | undefined;
  /**
   * Whether global commands of this reach run now: dialogs are open, each ours, and each lets
   * them through. `under-all` passes every kind but an alert dialog, which waits for a decision.
   */
  passes(reach: OverlayReach): boolean;
  /** The scopes whose bindings can fire now, innermost last: `dialog` alone while one is open. */
  liveScopes(): readonly KeymapScope[];
  subscribe(listener: () => void): () => void;
}

const tracked = new WeakSet<Keymap>();

/**
 * Follows the key engine's scope stack, in order. Each of our layers pushes one dialog scope;
 * every other push is upstream's, seen by wrapping the engine's `pushScope`, which upstream's
 * hooks call.
 */
export function trackEngineStack(keymap: Keymap, layers: LayerSource): EngineStack {
  if (tracked.has(keymap)) throw new Error("this key engine's stack is already tracked");
  tracked.add(keymap);
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

  const dialogs = () => stack.flatMap(({ owner }) => (owner === null ? [] : [owner]));
  return {
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
}

/** The app's key engine, followed from the first import of the commands, before any dialog opens. */
export const appStack = trackEngineStack(appKeymap, overlayStack);
