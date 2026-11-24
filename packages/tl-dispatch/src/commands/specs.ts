import type { Catalog, CatalogCommand } from "./catalog";

/** What a feature gives for one command, read afresh on every render. */
export interface CommandState {
  /** The one gate, honoured by keys, buttons, the palette and the sheet. Default `true`. */
  enabled?: boolean;
  /** A label that follows the state, such as a toggle naming what it opens; default the catalog's. */
  label?: string;
  run: () => void;
}

/** A command with its live state: what keys, buttons, the palette and the sheet all read. */
export interface CommandSpec {
  command: CatalogCommand;
  label: string;
  enabled: boolean;
  run: () => void;
}

/** A context's specs: each of its commands once, in the catalog's order. */
export interface CommandSpecs<Name extends string = string> {
  readonly list: readonly CommandSpec[];
  /** One command's spec, by its name in the context. */
  get(name: Name): CommandSpec;
}

/** The names of a context's commands, read from the catalog's ids. */
export type CommandNamesIn<
  Id extends string,
  Context extends string,
> = Id extends `${Context}.${infer Name}` ? Name : never;

function specsOf(
  context: string,
  commands: readonly CatalogCommand[],
  stateOf: (command: CatalogCommand) => CommandState | undefined
): CommandSpecs {
  const list = commands.map((command): CommandSpec => {
    const state = stateOf(command);
    if (state === undefined) throw new Error(`actions of "${context}" lost "${command.name}"`);
    return {
      command,
      label: state.label ?? command.label,
      enabled: state.enabled ?? true,
      run: state.run,
    };
  });
  const byName = new Map(list.map((spec) => [spec.command.name, spec]));
  return {
    list,
    get(name) {
      const spec = byName.get(name);
      if (spec === undefined) throw new Error(`"${context}" has no command "${name}"`);
      return spec;
    },
  };
}

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
): (record: Record_, options: Options) => CommandSpecs<CommandNamesIn<Id, Context>> {
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
    return specsOf(context, commands, (command) => states[command.name]);
  };
}

/** A context's specs from one function of the command, for states that follow a rule. */
export function specsFor(
  catalog: Catalog,
  context: string,
  stateOf: (command: CatalogCommand) => CommandState
): CommandSpecs {
  return specsOf(context, catalog.commandsOf(context), stateOf);
}

/** Runs the command unless its gate is shut. Every surface runs a command through this. */
export function runCommand(spec: CommandSpec): boolean {
  if (!spec.enabled) return false;
  spec.run();
  return true;
}
