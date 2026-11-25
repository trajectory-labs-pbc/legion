import { type CommandState, defineActions } from "@/commands/hooks";
import type { Catalog, CatalogCommand, CommandSpecs } from "@/commands/schema";

/** A context's specs from one function of the command. */
export function specsFor(
  catalog: Catalog,
  context: string,
  stateOf: (command: CatalogCommand) => CommandState
): CommandSpecs {
  const commands = catalog.commandsOf(context);
  const specsOf = defineActions(catalog, context, () =>
    Object.fromEntries(commands.map((command) => [command.name, stateOf(command)]))
  );
  return specsOf(undefined, undefined);
}
