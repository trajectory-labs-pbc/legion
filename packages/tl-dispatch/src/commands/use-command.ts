import type { KeySteps } from "@legion/ui/components/kbd";
import { useSyncExternalStore } from "react";

import { appCatalog, type CommandId } from "./app-catalog";
import { type CommandView, commandStore } from "./command-store";
import { appStack, keysReach } from "./engine-stack";
import { chipsOf } from "./key-chips";

/** The mounted command, or undefined until its context mounts. */
export function useCommand(id: CommandId): CommandView | undefined {
  return useSyncExternalStore(commandStore.subscribe, () => commandStore.view(id));
}

/** Whether the command's keys run under the overlays open now. */
function useKeysReach(id: CommandId): boolean {
  return useSyncExternalStore(appStack.subscribe, () =>
    keysReach(appCatalog, appCatalog.command(id), appStack)
  );
}

/**
 * The chips of the command's first key. None while it is not mounted, is off or has no key, and
 * none while an overlay masks its keys: a chip for a dead key would mislead.
 */
export function useCommandShortcut(id: CommandId): KeySteps | null {
  const view = useCommand(id);
  const reaches = useKeysReach(id);
  if (view === undefined || !reaches || !view.enabled) return null;
  const first = view.command.keys?.[0];
  return first === undefined ? null : chipsOf(first);
}
