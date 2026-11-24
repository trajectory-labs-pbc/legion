import type { Catalog, CatalogCommand } from "./catalog";

/** What a feature gives for one command, read afresh on every render. */
export interface CommandState {
  /** The one gate, honoured by keys, menus, the palette and buttons. Default `true`. */
  enabled?: boolean;
  run: () => void;
}

/** A command with its live state: what keys, menus and the palette all read. */
export interface CommandSpec {
  command: CatalogCommand;
  enabled: boolean;
  run: () => void;
}

export type CommandSpecs<Name extends string = string> = Readonly<Record<Name, CommandSpec>>;

/**
 * Declares a feature's actions hook for one context, `useXActions(record, opts)`. `build` returns
 * a state for every command of the context, so every surface gets the same list, of one length.
 */
export function defineActions<Record_, Options, Name extends string = string>(
  catalog: Catalog,
  context: string,
  build: (record: Record_, options: Options) => { readonly [N in Name]: CommandState }
): (record: Record_, options: Options) => CommandSpecs<Name> {
  const commands = catalog.commandsOf(context);
  const names = new Set(commands.map((command) => command.name));
  let checked = false;
  return (record, options) => {
    const states = build(record, options) as Readonly<Record<string, CommandState>>;
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
    const specs: Record<string, CommandSpec> = {};
    for (const command of commands) {
      const state = states[command.name] as CommandState;
      specs[command.name] = { command, enabled: state.enabled ?? true, run: state.run };
    }
    return specs as CommandSpecs<Name>;
  };
}

/** Runs the command unless its gate is shut. Every surface runs a command through this. */
export function runCommand(spec: CommandSpec): boolean {
  if (!spec.enabled) return false;
  spec.run();
  return true;
}
