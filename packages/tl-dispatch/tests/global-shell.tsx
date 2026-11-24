import { appCatalog } from "@/commands/app-catalog";
import { useRegisterCommands } from "@/commands/bindings";
import { specsFor } from "@/commands/specs";

/** Mounts every global command, each recording its id when it runs. */
export function GlobalCommands({ fired = [] }: { fired?: string[] }) {
  useRegisterCommands(
    appCatalog,
    "global",
    specsFor(appCatalog, "global", (command) => ({ run: () => fired.push(command.id) }))
  );
  return null;
}
