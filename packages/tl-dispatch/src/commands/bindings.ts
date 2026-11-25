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

/** The binding of a typing command's keys that type a character, which stay typing in a field. */
export const TYPED_KEYS = ":typed-keys";

/** A key that types a character: `/`, `?`, `Shift+A`. */
const typesCharacter = (keys: string) => /^(Shift\+)?.$/.test(keys);

/** The catalog id a binding of ours stands for. */
export function commandIdOf(bindingId: string): string {
  return bindingId.replace(UNDER_OVERLAY, "").replace(TYPED_KEYS, "");
}

/** A command's bindings: one, or for an `inEditable` command with a key a field types, two. */
function bindingsOf(spec: CommandSpec, gate: () => boolean): KeyBinding[] {
  const { command } = spec;
  const keys = command.keys ?? [];
  const binding = (id: string, own: readonly string[], inEditable: boolean): KeyBinding => ({
    id,
    keys: own,
    label: spec.label,
    run: () => {
      runCommand(spec);
    },
    when: () => spec.enabled && gate(),
    ...(inEditable ? { inEditable: true } : {}),
    ...(command.hideFrom?.includes("palette") === true ? { palette: false } : {}),
  });
  const typed = keys.filter(typesCharacter);
  if (command.inEditable !== true || typed.length === 0) {
    return [binding(command.id, keys, command.inEditable === true)];
  }
  return [
    binding(
      command.id,
      keys.filter((key) => !typesCharacter(key)),
      true
    ),
    { ...binding(`${command.id}${TYPED_KEYS}`, typed, false), palette: false },
  ];
}

/** The key engine's bindings for a set of specs; the gate is read on every press. */
export function toBindings(specs: CommandSpecs, gate: () => boolean = () => true): KeyBinding[] {
  return specs.flatMap((spec) => bindingsOf(spec, gate));
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
          .flatMap((spec) => {
            const reach = spec.command.overlays ?? "under-most";
            return bindingsOf(spec, () => stack.passes(reach)).map((binding) => ({
              reach,
              binding: { ...binding, id: `${binding.id}${UNDER_OVERLAY}`, palette: false },
            }));
          })
      : [];
  return { scope, own, underOverlays };
}
