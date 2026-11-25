import { Badge } from "@legion/ui/components/badge";
import { Button } from "@legion/ui/components/button";
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
      {/* Always in the page, so a screen reader announces the line when it appears in it. */}
      <div className="empty:hidden" data-testid="connection-status" role="status">
        {connection === "stuck" ? (
          <Badge className="gap-2 px-3 py-1" data-testid="connection-pill" variant="danger">
            Live updates are not reaching this page
            <Button onClick={() => window.location.reload()} size="xs" variant="link">
              Reload
            </Button>
          </Badge>
        ) : connection === "reconnecting" ? (
          <Badge className="px-3 py-1" data-testid="connection-pill" variant="warning">
            Reconnecting…
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
