import { appCatalog } from "@/commands/app-catalog";
import { useRegisterCommands } from "@/commands/bindings";
import { defineActions } from "@/commands/specs";

const useAllGlobal = defineActions(appCatalog, "global", (fired: string[], _options: null) =>
  Object.fromEntries(
    appCatalog
      .commandsOf("global")
      .map((command) => [command.name, { run: () => fired.push(command.id) }])
  )
);

/** Mounts every global command, each recording its id when it runs. */
export function GlobalCommands({ fired = [] }: { fired?: string[] }) {
  useRegisterCommands(appCatalog, "global", useAllGlobal(fired, null));
  return null;
}
