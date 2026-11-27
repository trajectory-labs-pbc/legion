import { type CatalogCommand, type CommandSpec, runCommand } from "./schema";

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
