import {
  DIALOG_SCOPE,
  type KeyBinding,
  type KeymapScope,
} from "@upstream-dispatch/features/shell/keymap";

import type { OverlayLayer } from "@/ui/overlay-layer";
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
