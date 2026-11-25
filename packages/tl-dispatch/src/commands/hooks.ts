import {
  appKeymap,
  DIALOG_SCOPE,
  type KeyBinding,
  type KeymapScope,
} from "@upstream-dispatch/features/shell/keymap";
import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

import type { OverlayLayer } from "@/ui/overlay-layer";
import { appCatalog, type CommandId } from "./catalog";
import { appStack, contextBindings, keysReach, passing } from "./engine";
import { chipsOf, type ShortcutChips } from "./keys";
import {
  type Catalog,
  type CatalogCommand,
  type CommandSpec,
  type CommandSpecs,
  runCommand,
} from "./schema";

/** What a feature gives for one command, read afresh on every render. */
export interface CommandState {
  /** The one gate, honoured by keys, buttons, the palette and the sheet. Default `true`. */
  enabled?: boolean;
  /** A label that follows the state, such as a toggle naming what it opens; default the catalog's. */
  label?: string;
  run: () => void;
}

/** The names of a context's commands, read from the catalog's ids. */
export type CommandNamesIn<
  Id extends string,
  Context extends string,
> = Id extends `${Context}.${infer Name}` ? Name : never;

/**
 * Declares a feature's actions hook for one context, `useXActions(record, opts)`. `build` returns
 * a state for every command of the context, by name: the type check refuses a missing or an
 * unknown name, and the first call checks again for a catalog the type check cannot see.
 */
export function defineActions<Id extends string, const Context extends string, Record_, Options>(
  catalog: Catalog<Id>,
  context: Context,
  build: (
    record: Record_,
    options: Options
  ) => { readonly [Name in CommandNamesIn<Id, Context>]: CommandState }
): (record: Record_, options: Options) => CommandSpecs {
  const commands = catalog.commandsOf(context);
  const names = new Set(commands.map((command) => command.name));
  let checked = false;
  return (record, options) => {
    const states: Readonly<Partial<Record<string, CommandState>>> = build(record, options);
    if (!checked) {
      const missing = [...names].filter((name) => states[name] === undefined);
      const extra = Object.keys(states).filter((name) => !names.has(name));
      if (missing.length > 0 || extra.length > 0) {
        throw new Error(
          `actions of "${context}": missing [${missing.join(", ")}], not in the catalog [${extra.join(", ")}]`
        );
      }
      checked = true;
    }
    return commands.map((command): CommandSpec => {
      const state = states[command.name];
      if (state === undefined) throw new Error(`actions of "${context}" lost "${command.name}"`);
      return {
        command,
        label: state.label ?? command.label,
        enabled: state.enabled ?? true,
        run: state.run,
      };
    });
  };
}

/** A mounted command as a surface shows it. A new object only when the label or the gate moves. */
export interface CommandView {
  readonly command: CatalogCommand;
  readonly label: string;
  readonly enabled: boolean;
}

export interface CommandStore {
  /** Holds the command while its context is mounted; a second holder of one id throws. */
  register(spec: CommandSpec): () => void;
  /** Takes the spec of the last commit, so a run sees the state it was drawn with. */
  update(spec: CommandSpec): void;
  view(id: string): CommandView | undefined;
  /** Runs a mounted command through its gate, as its key does. */
  run(id: string): boolean;
  subscribe(listener: () => void): () => void;
}

export function createCommandStore(): CommandStore {
  const entries = new Map<string, { latest: CommandSpec; view: CommandView }>();
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const viewOf = (spec: CommandSpec): CommandView => ({
    command: spec.command,
    label: spec.label,
    enabled: spec.enabled,
  });
  return {
    register(spec) {
      const { id } = spec.command;
      if (entries.has(id)) throw new Error(`command "${id}" is already mounted`);
      const entry = { latest: spec, view: viewOf(spec) };
      entries.set(id, entry);
      notify();
      return () => {
        if (entries.get(id) !== entry) return;
        entries.delete(id);
        notify();
      };
    },
    update(spec) {
      const entry = entries.get(spec.command.id);
      if (entry === undefined) return;
      entry.latest = spec;
      if (entry.view.label === spec.label && entry.view.enabled === spec.enabled) return;
      entry.view = viewOf(spec);
      notify();
    },
    view: (id) => entries.get(id)?.view,
    run(id) {
      const entry = entries.get(id);
      if (entry === undefined) throw new Error(`command "${id}" is not mounted`);
      return runCommand(entry.latest);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The app's mounted commands. */
export const commandStore = createCommandStore();

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
  const latest = useRef(specs);
  useLayoutEffect(() => {
    latest.current = specs;
  });
  const ids = specs.map((spec) => spec.command.id).join("\n");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `ids` stands in for the specs, read through `latest`
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

/** The mounted command, or undefined until its context mounts. */
export function useCommand(id: CommandId): CommandView | undefined {
  return useSyncExternalStore(commandStore.subscribe, () => commandStore.view(id));
}

/** Whether the command's keys run under the overlays open now. */
export function useKeysReach(id: CommandId): boolean {
  return useSyncExternalStore(appStack.subscribe, () =>
    keysReach(appCatalog, appCatalog.command(id), appStack)
  );
}

/**
 * The chips of the command's first key. None while it is not mounted or has no key, none while
 * an overlay masks its keys, and none while it is off unless asked: a chip for a dead key would
 * mislead.
 */
export function useCommandShortcut(
  id: CommandId,
  { showIfDisabled = false }: { showIfDisabled?: boolean } = {}
): ShortcutChips | null {
  const view = useCommand(id);
  const reaches = useKeysReach(id);
  if (view === undefined || !reaches || (!view.enabled && !showIfDisabled)) return null;
  const first = view.command.keys?.[0];
  return first === undefined ? null : chipsOf(first);
}
