import {
  appKeymap,
  DIALOG_SCOPE,
  type KeyBinding,
  type KeymapScope,
} from "@upstream-dispatch/features/shell/keymap";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

import type { OverlayLayer } from "@/ui/overlay-layer";
import type { Catalog, CatalogCommand } from "./catalog";
import { appStack, type EngineStack, type OverlayReach } from "./engine-stack";
import { type CommandStore, commandStore } from "./registry";
import { type CommandSpec, type CommandSpecs, runCommand } from "./specs";

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
  return Object.values(specs).map((spec) => toBinding(spec, gate));
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
      ? Object.values(specs)
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
function passing(stack: EngineStack): string {
  return (["under-most", "under-all"] as const).filter((reach) => stack.passes(reach)).join(" ");
}

/**
 * Registers bindings with the app's key engine while mounted. The engine copies a binding's
 * label when it registers, so a new label registers the bindings again; runs and gates are read
 * live, as upstream's `useKeymap` reads them.
 */
function useEngineBindings(scope: KeymapScope, bindings: readonly KeyBinding[]): void {
  const latest = useRef(bindings);
  latest.current = bindings;
  const signature = bindings
    .map((binding) => `${binding.id}=${[binding.keys].flat().join(",")}=${binding.label}`)
    .join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `signature` stands in for the bindings, read through `latest`
  useLayoutEffect(() => {
    const proxies = latest.current.map((binding, index) => ({
      ...binding,
      run: (event: KeyboardEvent) => latest.current[index]?.run(event),
      when: () => latest.current[index]?.when?.() !== false,
    }));
    return appKeymap.register(scope, proxies);
  }, [scope, signature]);
}

/** Holds the specs in the store while mounted, with the last commit's state. */
function useStoredSpecs(store: CommandStore, specs: CommandSpecs): void {
  const list = Object.values(specs);
  const latest = useRef(list);
  latest.current = list;
  const ids = list.map((spec) => spec.command.id).join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `ids` stands in for the specs, read through `latest`
  useLayoutEffect(() => {
    const releases = latest.current.map((spec) => store.register(spec));
    return () => {
      for (const release of releases) release();
    };
  }, [store, ids]);
  useLayoutEffect(() => {
    for (const spec of list) store.update(spec);
  });
}

/**
 * Registers a context's specs with the app's key engine and its command store while mounted, so
 * keys, buttons and the sheet read one spec.
 */
export function useRegisterCommands(
  catalog: Catalog,
  context: string,
  specs: CommandSpecs,
  layer?: OverlayLayer
): void {
  const { scope, own, underOverlays } = contextBindings(catalog, context, specs, appStack, layer);
  const passes = useSyncExternalStore(appStack.subscribe, () => passing(appStack));
  useEngineBindings(scope, own);
  // Registered only while it can fire, so its chords never swallow a key under another dialog.
  useEngineBindings(
    DIALOG_SCOPE,
    underOverlays.filter(({ reach }) => passes.split(" ").includes(reach)).map((u) => u.binding)
  );
  useStoredSpecs(commandStore, specs);
}
