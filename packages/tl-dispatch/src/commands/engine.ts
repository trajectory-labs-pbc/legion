import {
  appKeymap,
  DIALOG_SCOPE,
  type KeyBinding,
  type Keymap,
  type KeymapScope,
} from "@upstream-dispatch/features/shell/keymap";

import { type OverlayKind, type OverlayLayer, overlayStack } from "@/ui/overlay-layer";
import {
  type Catalog,
  type CatalogCommand,
  type CommandSpec,
  type CommandSpecs,
  type OverlayReach,
  runCommand,
} from "./schema";

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

declare global {
  /** Each key engine's tracker, kept on the window so a hot reload of this module finds it. */
  var __tlDispatchEngineStacks: WeakMap<Keymap, EngineStack> | undefined;
}

globalThis.__tlDispatchEngineStacks ??= new WeakMap();
const trackers = globalThis.__tlDispatchEngineStacks;

/**
 * Follows the key engine's scope stack, in order. Each of our layers pushes one dialog scope;
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
export const appStack = trackEngineStack(appKeymap, overlayStack);

/** A global command's copy in the dialog scope ends in this, so the sheet shows it once. */
export const UNDER_OVERLAY = ":under-overlay";

function toBinding(spec: CommandSpec, gate: () => boolean): KeyBinding {
  const { command } = spec;
  return {
    id: command.id,
    keys: command.keys ?? [],
    label: spec.label,
    run: () => {
      runCommand(spec);
    },
    when: () => spec.enabled && gate(),
    ...(command.inEditable === true ? { inEditable: true } : {}),
    ...(command.hideFrom?.includes("palette") === true ? { palette: false } : {}),
  };
}

/** The key engine's bindings for a set of specs; the gate is read on every press. */
export function toBindings(specs: CommandSpecs, gate: () => boolean = () => true): KeyBinding[] {
  return specs.map((spec) => toBinding(spec, gate));
}

export interface ContextBindings {
  scope: KeymapScope;
  /** The context's own bindings, in its scope. */
  own: KeyBinding[];
  /** A global context's keyed bindings again in the dialog scope, each with its reach. */
  underOverlays: { reach: OverlayReach; binding: KeyBinding }[];
}

/** What one context's specs register. An overlay's context runs only while its layer is on top. */
export function contextBindings(
  catalog: Catalog,
  context: string,
  specs: CommandSpecs,
  stack: EngineStack,
  layer?: OverlayLayer
): ContextBindings {
  const { scope } = catalog.context(context);
  if ((scope === DIALOG_SCOPE) !== (layer !== undefined)) {
    throw new Error(`context "${context}": an overlay's context takes its layer, and only it does`);
  }
  const own = toBindings(specs, layer === undefined ? undefined : () => stack.top() === layer);
  const underOverlays =
    scope === "global"
      ? specs
          .filter((spec) => (spec.command.keys ?? []).length > 0)
          .map((spec) => {
            const reach = spec.command.overlays ?? "under-most";
            const binding = toBinding(spec, () => stack.passes(reach));
            return {
              reach,
              binding: { ...binding, id: `${binding.id}${UNDER_OVERLAY}`, palette: false },
            };
          })
      : [];
  return { scope, own, underOverlays };
}

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
