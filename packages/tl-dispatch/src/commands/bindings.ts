import type { KeyBinding, KeymapScope } from "@upstream-dispatch/features/shell/keymap";

import type { EngineStack } from "./engine-stack";
import {
  type Catalog,
  type CommandSpec,
  type CommandSpecs,
  type OverlayReach,
  runCommand,
} from "./schema";

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
    // Stated every time: the engine's own default drops a binding with two keys.
    palette: command.hideFrom?.includes("palette") !== true,
  };
}

/** The key engine's bindings for a set of specs; the gate is read on every press. */
export function toBindings(specs: CommandSpecs, gate: () => boolean = () => true): KeyBinding[] {
  return specs.map((spec) => toBinding(spec, gate));
}

interface ContextBindings {
  scope: KeymapScope;
  /** The context's own bindings, in its scope. */
  own: KeyBinding[];
  /** A global context's keyed bindings again in the dialog scope, each with its reach. */
  underOverlays: { reach: OverlayReach; binding: KeyBinding }[];
}

/** What one context's specs register. */
export function contextBindings(
  catalog: Catalog,
  context: string,
  specs: CommandSpecs,
  stack: EngineStack
): ContextBindings {
  const { scope } = catalog.context(context);
  const own = toBindings(specs);
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
