import { useAgentPinWrite, useLiveViewPins, usePinsMigration } from "@/data/agent-pins";
import { useRecordRecents } from "@/data/recents";
import { AgentRegistryPoller } from "@/upstream/shell";
import { InboxDrawer } from "@/upstream/widgets/inbox-drawer";
import { RefPreviewHost } from "@/upstream/widgets/ref-preview";

/** What runs behind every page: the recents, the pinned agents, the registry read, the inbox
 *  drawer and the reference previews. */
export function ShellBackground({
  login,
  inboxDrawerOpen,
  closeInboxDrawer,
}: {
  login: string;
  inboxDrawerOpen: boolean;
  closeInboxDrawer: () => void;
}) {
  useRecordRecents();
  useLiveViewPins();
  usePinsMigration(login, useAgentPinWrite());
  return (
    <>
      <AgentRegistryPoller />
      <InboxDrawer onClose={closeInboxDrawer} open={inboxDrawerOpen} />
      <RefPreviewHost surface="reference-hover-card" />
    </>
  );
}
