import { Button } from "@legion/ui/components/button";
import { StatusPill } from "@legion/ui/components/status-pill";
import { useLiveSocketPill } from "@upstream-dispatch/api/live-socket";
import { DraftsNotKept } from "@upstream-dispatch/features/inbox/DraftsNotKept";
import { PendingWritesIndicator } from "@upstream-dispatch/features/writes/PendingWritesIndicator";
import { FOOT_STATUS_INSET_PROPERTY, useFootInset } from "@upstream-dispatch/hooks/useFootInset";
import { useRef } from "react";

/** The corner that reports writes on their way and a live feed that stopped. */
export function StatusCorner() {
  const corner = useRef<HTMLDivElement>(null);
  useFootInset(corner, true, FOOT_STATUS_INSET_PROPERTY);
  const connection = useLiveSocketPill();
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-[max(5rem,calc(var(--foot-composer-inset,0px)_+_1rem))] z-50 flex w-[min(28rem,calc(100vw-2rem))] flex-col items-end gap-2 xl:bottom-[calc(var(--foot-composer-inset,0px)_+_1rem)] *:pointer-events-auto"
      ref={corner}
    >
      <PendingWritesIndicator />
      <DraftsNotKept />
      {connection === "stuck" ? (
        <StatusPill data-testid="connection-pill" tone="danger">
          Live updates are not reaching this page
          <Button onClick={() => window.location.reload()} size="xs" variant="link">
            Reload
          </Button>
        </StatusPill>
      ) : connection === "reconnecting" ? (
        <StatusPill data-testid="connection-pill" tone="warning">
          Reconnecting…
        </StatusPill>
      ) : null}
    </div>
  );
}
