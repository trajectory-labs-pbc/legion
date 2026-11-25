import { useSyncExternalStore } from "react";

import { appCatalog, type CommandId } from "./app-catalog";
import { type CommandView, commandStore } from "./command-store";
import { appStack, keysReach } from "./engine-stack";
import { chipsOf, type ShortcutChips } from "./key-chips";

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
