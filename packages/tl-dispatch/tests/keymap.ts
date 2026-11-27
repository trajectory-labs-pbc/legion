import {
  createKeymap,
  DIALOG_SCOPE,
  type Keymap,
  type KeymapOptions,
} from "@upstream-dispatch/features/shell/keymap";

import { contextBindings } from "@/commands/bindings";
import { trackEngineStack } from "@/commands/engine-stack";
import type { Catalog, CommandSpecs } from "@/commands/schema";
import { createLayerSource } from "./layers";
import { settle } from "./react";

/** A key engine for one test: not a Mac, and a chord waits until the next key. */
export function testKeymap(options: KeymapOptions = {}): Keymap {
  return createKeymap({ isMac: false, setTimeout: () => 0, clearTimeout: () => {}, ...options });
}

/**
 * A context's specs registered on a new key engine as `useRegisterCommands` registers them, with
 * every copy under overlays at once, over a stack of overlays the test opens.
 */
export function registerContext(catalog: Catalog, context: string, specs: CommandSpecs) {
  const keymap = testKeymap();
  const layers = createLayerSource();
  const stack = trackEngineStack(keymap, layers);
  const { scope, own, underOverlays } = contextBindings(catalog, context, specs, stack);
  keymap.register(scope, own);
  keymap.register(
    DIALOG_SCOPE,
    underOverlays.map(({ binding }) => binding)
  );
  return { keymap, layers, stack };
}

/** Presses one key on the engine, inside React's `act`, as a window listener hands it over. */
export function press(keymap: Keymap, key: string, init: KeyboardEventInit = {}): void {
  settle(() => {
    keymap.handleKeyDown(new KeyboardEvent("keydown", { key, cancelable: true, ...init }));
  });
}
