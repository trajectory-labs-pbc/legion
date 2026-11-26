import {
  appKeymap,
  DIALOG_SCOPE,
  type KeyBinding,
  type KeymapScope,
} from "@upstream-dispatch/features/shell/keymap";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

import { contextBindings } from "./bindings";
import { type CommandStore, commandStore } from "./command-store";
import { appStack, passing } from "./engine-stack";
import type { Catalog, CommandSpecs } from "./schema";

/**
 * Registers bindings with the app's key engine while mounted. The engine copies a binding's
 * label when it registers, so a new label registers the bindings again; runs and gates are read
 * live, as upstream's `useKeymap` reads them.
 */
function useEngineBindings(scope: KeymapScope, bindings: readonly KeyBinding[]): void {
  const latest = useRef(bindings);
  // Before the registration below, which reads it when the signature moves.
  useLayoutEffect(() => {
    latest.current = bindings;
  });
  const signature = bindings
    .map((binding) => `${binding.id}=${[binding.keys].flat().join(",")}=${binding.label}`)
    .join("\n");
  // `signature` stands in for the bindings, read through `latest`
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
  const latest = useRef(specs);
  useLayoutEffect(() => {
    latest.current = specs;
  });
  const ids = specs.map((spec) => spec.command.id).join("\n");
  // `ids` stands in for the specs, read through `latest`
  useLayoutEffect(() => {
    const releases = latest.current.map((spec) => store.register(spec));
    return () => {
      for (const release of releases) release();
    };
  }, [store, ids]);
  useLayoutEffect(() => {
    for (const spec of specs) store.update(spec);
  });
}

/**
 * Registers a context's specs with the app's key engine and its command store while mounted, so
 * keys, buttons and the sheet read one spec.
 */
export function useRegisterCommands(catalog: Catalog, context: string, specs: CommandSpecs): void {
  const { scope, own, underOverlays } = contextBindings(catalog, context, specs, appStack);
  const passes = useSyncExternalStore(appStack.subscribe, () => passing(appStack));
  useEngineBindings(scope, own);
  // Registered only while it can fire, so its chords never swallow a key under another dialog.
  useEngineBindings(
    DIALOG_SCOPE,
    underOverlays.filter(({ reach }) => passes.split(" ").includes(reach)).map((u) => u.binding)
  );
  useStoredSpecs(commandStore, specs);
}
