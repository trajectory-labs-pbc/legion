import {
  DIALOG_SCOPE,
  type KeyBinding,
  type Keymap,
  type KeymapScope,
  useKeymap,
} from "@upstream-dispatch/features/shell/keymap";
import type { OverlayKind, OverlayLayers } from "../ui/overlay-layer";
import { overlayLayers } from "../ui/overlay-layer";
import type { Catalog, CatalogCommand } from "./catalog";
import { holdsAny, PALETTE_KEYS } from "./keys";
import { type CommandSpecs, runCommand } from "./specs";

/**
 * The overlay kinds a global command still runs under. The key engine masks every scope but its
 * own `dialog` scope while an overlay is open, so a global command that one of these lets
 * through is registered a second time in that scope.
 */
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

function editableKeys(command: CatalogCommand): readonly string[] {
  const keys = command.keys ?? [];
  if (command.inEditable === true) return keys;
  if (command.inEditable === undefined || command.inEditable === false) return [];
  return keys.filter((key) => (command.inEditable as readonly string[]).includes(key));
}

function inPalette(command: CatalogCommand, keys: readonly string[]): boolean {
  return (
    command.hideFrom?.includes("palette") !== true &&
    command.perKey !== true &&
    !holdsAny(keys, PALETTE_KEYS)
  );
}

/**
 * The key engine's bindings for a set of specs. A command whose keys differ in whether they fire
 * while typing becomes two bindings, `<id>` and `<id>:typing`; the gate is read on every press.
 */
export function toBindings(
  specs: CommandSpecs,
  layers: OverlayLayers = overlayLayers,
  extraGate: () => boolean = () => true
): KeyBinding[] {
  const bindings: KeyBinding[] = [];
  for (const spec of Object.values(specs)) {
    const { command } = spec;
    const keys = command.keys ?? [];
    const typing = editableKeys(command);
    const rest = keys.filter((key) => !typing.includes(key));
    const when = () =>
      spec.enabled && extraGate() && !(command.onlyWithoutOverlay === true && layers.depth() > 0);
    const run = () => {
      runCommand(spec);
    };
    const shared = { label: command.label, run, when };
    if (rest.length > 0 || typing.length === 0) {
      bindings.push({ ...shared, id: command.id, keys: rest, palette: inPalette(command, rest) });
    }
    if (typing.length > 0) {
      bindings.push({
        ...shared,
        id: rest.length > 0 ? `${command.id}:typing` : command.id,
        keys: typing,
        inEditable: true,
        palette: rest.length === 0 && inPalette(command, typing),
      });
    }
  }
  return bindings;
}

/** The bindings a global command adds in the dialog scope, live only under a kind that lets it through. */
export function passThroughBindings(
  specs: CommandSpecs,
  layers: OverlayLayers = overlayLayers
): KeyBinding[] {
  const gate = () => {
    const top = layers.top();
    return top !== undefined && GLOBAL_COMMANDS_RUN_UNDER[top];
  };
  return toBindings(specs, layers, gate)
    .filter((binding) => (typeof binding.keys === "string" ? 1 : binding.keys.length) > 0)
    .map((binding) => ({ ...binding, id: `${binding.id}:under-overlay`, palette: false }));
}

/** Registers a context's specs with the key engine while the component is mounted. */
export function useCommandKeys(catalog: Catalog, context: string, specs: CommandSpecs): void {
  const scope: KeymapScope = catalog.context(context).scope;
  useKeymap(scope, toBindings(specs));
  useKeymap(DIALOG_SCOPE, scope === "global" ? passThroughBindings(specs) : []);
}

/** Keeps one dialog scope on the engine's stack while any of tl-dispatch's overlays is open. */
export function bindOverlaysToKeymap(layers: OverlayLayers, keymap: Keymap): () => void {
  let pop: (() => void) | undefined;
  const sync = () => {
    if (layers.depth() > 0 && pop === undefined) pop = keymap.pushScope(DIALOG_SCOPE);
    if (layers.depth() === 0 && pop !== undefined) {
      pop();
      pop = undefined;
    }
  };
  sync();
  const unsubscribe = layers.subscribe(sync);
  return () => {
    unsubscribe();
    pop?.();
    pop = undefined;
  };
}
