import {
  DIALOG_SCOPE,
  type KeyBinding,
  type KeymapScope,
  useKeymap,
} from "@upstream-dispatch/features/shell/keymap";
import { useSyncExternalStore } from "react";

import type { OverlayLayer } from "../ui/overlay-layer";
import type { Catalog } from "./catalog";
import { appDialogs, type EngineDialogs } from "./engine-dialogs";
import { type CommandSpecs, runCommand } from "./specs";

/** The key engine's bindings for a set of specs; the gate is read on every press. */
export function toBindings(specs: CommandSpecs, gate: () => boolean = () => true): KeyBinding[] {
  return Object.values(specs).map((spec) => ({
    id: spec.command.id,
    keys: spec.command.keys ?? [],
    label: spec.command.label,
    run: () => {
      runCommand(spec);
    },
    when: () => spec.enabled && gate(),
    ...(spec.command.inEditable === true ? { inEditable: true } : {}),
    ...(spec.command.palette === undefined ? {} : { palette: spec.command.palette }),
  }));
}

export interface ContextBindings {
  scope: KeymapScope;
  /** The context's own bindings, in its scope. */
  own: KeyBinding[];
  /** A global context's bindings again in the dialog scope, live while every open dialog passes them. */
  underOverlays: KeyBinding[];
}

/** What one context's specs register. An overlay's context runs only while its layer is on top. */
export function contextBindings(
  catalog: Catalog,
  context: string,
  specs: CommandSpecs,
  dialogs: EngineDialogs,
  layer?: OverlayLayer
): ContextBindings {
  const { scope } = catalog.context(context);
  if ((scope === DIALOG_SCOPE) !== (layer !== undefined)) {
    throw new Error(`context "${context}": an overlay's context takes its layer, and only it does`);
  }
  const own = toBindings(specs, layer === undefined ? undefined : () => dialogs.top() === layer);
  const underOverlays =
    scope === "global"
      ? toBindings(specs, dialogs.passesGlobals)
          .filter((binding) => binding.keys.length > 0)
          .map((binding) => ({ ...binding, id: `${binding.id}:under-overlay`, palette: false }))
      : [];
  return { scope, own, underOverlays };
}

/** Registers a context's specs with the app's key engine while the component is mounted. */
export function useCommandKeys(
  catalog: Catalog,
  context: string,
  specs: CommandSpecs,
  layer?: OverlayLayer
): void {
  const { scope, own, underOverlays } = contextBindings(catalog, context, specs, appDialogs, layer);
  const passes = useSyncExternalStore(appDialogs.subscribe, appDialogs.passesGlobals);
  useKeymap(scope, own);
  // Registered only while it can fire, so its chords never swallow a key under another dialog.
  useKeymap(DIALOG_SCOPE, passes ? underOverlays : []);
}
