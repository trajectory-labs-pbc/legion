import { appKeymap, DIALOG_SCOPE, type Keymap } from "@upstream-dispatch/features/shell/keymap";

import {
  type OverlayKind,
  type OverlayLayer,
  type OverlayLayers,
  overlayLayers,
} from "../ui/overlay-layer";

/** The overlay kinds a global command still runs under; any other open dialog stops it. */
export const GLOBAL_COMMANDS_RUN_UNDER: Readonly<Record<OverlayKind, boolean>> = {
  dialog: false,
  "alert-dialog": false,
  sheet: true,
  drawer: true,
  menu: false,
  "context-menu": false,
  popover: false,
  select: false,
};

/** A dialog that upstream's code opened (its palette, a `useDialog` sheet), not one of our layers. */
export const UPSTREAM = "upstream";

export interface EngineDialogs {
  /** The dialog on top of the key engine's stack, or undefined when none is open. */
  top(): OverlayLayer | typeof UPSTREAM | undefined;
  /** Whether global commands run now: dialogs are open, each ours, and each lets them through. */
  passesGlobals(): boolean;
  subscribe(listener: () => void): () => void;
}

const tracked = new WeakSet<Keymap>();

/**
 * Follows the key engine's dialog scopes, in order. Each of our layers pushes one; every other
 * push is upstream's, seen by wrapping the engine's `pushScope`, which upstream's hooks call.
 */
export function trackEngineDialogs(keymap: Keymap, layers: OverlayLayers): EngineDialogs {
  if (tracked.has(keymap)) throw new Error("this key engine's dialogs are already tracked");
  tracked.add(keymap);
  const stack: { layer: OverlayLayer | typeof UPSTREAM }[] = [];
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const push = keymap.pushScope;
  const pushDialog = (layer: OverlayLayer | typeof UPSTREAM) => {
    const pop = push(DIALOG_SCOPE);
    const entry = { layer };
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
  keymap.pushScope = (scope) => (scope === DIALOG_SCOPE ? pushDialog(UPSTREAM) : push(scope));

  const pops = new Map<OverlayLayer, () => void>();
  const sync = () => {
    const open = layers.list();
    for (const [layer, pop] of pops) {
      if (!open.includes(layer)) {
        pops.delete(layer);
        pop();
      }
    }
    for (const layer of open) {
      if (!pops.has(layer)) pops.set(layer, pushDialog(layer));
    }
  };
  sync();
  layers.subscribe(sync);

  return {
    top: () => stack.at(-1)?.layer,
    passesGlobals: () =>
      stack.length > 0 &&
      stack.every(({ layer }) => layer !== UPSTREAM && GLOBAL_COMMANDS_RUN_UNDER[layer.kind]),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app's key engine, followed from the first import of the commands, before any dialog opens. */
export const appDialogs = trackEngineDialogs(appKeymap, overlayLayers);
