import type { Catalog, CatalogCommand } from "@/commands/catalog";
import { type CommandSpecs, type CommandState, defineActions } from "@/commands/specs";

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
