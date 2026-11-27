import type { Catalog, CommandSpec, CommandSpecs } from "./schema";

/** What a feature gives for one command, read afresh on every render. */
export interface CommandState {
  /** The one gate, honoured by keys, buttons, the palette and the sheet. Default `true`. */
  enabled?: boolean;
  /** A label that follows the state, such as a toggle naming what it opens; default the catalog's. */
  label?: string;
  run: () => void;
}

/** The state of a command whose action may be absent: an absent action shuts its gate. */
export const whenPresent = (run: (() => void) | undefined): CommandState => ({
  enabled: run !== undefined,
  run: () => run?.(),
});

/** The names of a context's commands, read from the catalog's ids. */
type CommandNamesIn<
  Id extends string,
  Context extends string,
> = Id extends `${Context}.${infer Name}` ? Name : never;

/**
 * Declares a feature's actions hook for one context, `useXActions(record, opts)`; a `build`
 * that takes no options gives `useXActions(record)`. `build` returns
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
): (record: Record_, ...rest: unknown extends Options ? [] : [options: Options]) => CommandSpecs {
  const commands = catalog.commandsOf(context);
  const names = new Set(commands.map((command) => command.name));
  let checked = false;
  return (record, ...rest) => {
    const states: Readonly<Partial<Record<string, CommandState>>> = build(
      record,
      rest[0] as Options
    );
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
