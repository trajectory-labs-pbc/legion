import { useSyncExternalStore } from "react";

import type { CommandId } from "./app-catalog";
import { chipsOf, type ShortcutChips } from "./chips";
import { type CommandView, commandStore } from "./registry";

/** The mounted command, or undefined until its context mounts. */
export function useCommand(id: CommandId): CommandView | undefined {
  return useSyncExternalStore(commandStore.subscribe, () => commandStore.view(id));
}

/** Runs a mounted command as its key does: through its gate. */
export function useRunCommand(): (id: CommandId) => boolean {
  return commandStore.run;
}

/**
 * The chips of the command's first key. None while it is not mounted or has no key, and none
 * while it is off unless asked: a chip for a dead key would mislead.
 */
export function useCommandShortcut(
  id: CommandId,
  { showIfDisabled = false }: { showIfDisabled?: boolean } = {}
): ShortcutChips | null {
  const view = useCommand(id);
  if (view === undefined || (!view.enabled && !showIfDisabled)) return null;
  const first = view.command.keys?.[0];
  return first === undefined ? null : chipsOf(first);
}
