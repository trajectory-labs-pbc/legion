import { Badge } from "@legion/ui/components/badge";
import { Button } from "@legion/ui/components/button";
import { useLiveSocketPill } from "@upstream-dispatch/api/live-socket";
import { DraftsNotKept } from "@upstream-dispatch/features/inbox/DraftsNotKept";
import { PendingWritesIndicator } from "@upstream-dispatch/features/writes/PendingWritesIndicator";
import { useFootInset } from "@upstream-dispatch/hooks/useFootInset";
import { useRef } from "react";

/**
 * The corner that reports writes on their way and a live feed that stopped: the one float of the
 * foot's status layer, 1rem above the banner layer and never under its floor.
 */
export function StatusCorner() {
  const corner = useRef<HTMLDivElement>(null);
  useFootInset(corner, true, "status");
  const connection = useLiveSocketPill();
  return (
    <div
      className="pointer-events-none fixed right-4 bottom-[max(var(--foot-floor),calc(var(--foot-banner-inset,0px)_+_1rem))] z-50 flex w-[min(28rem,calc(100vw-2rem))] flex-col items-end gap-2 [--foot-floor:5rem] xl:[--foot-floor:0px] *:pointer-events-auto"
      ref={corner}
    >
      <PendingWritesIndicator />
      <DraftsNotKept />
      {/* Never hidden, so a screen reader announces the line when it appears; empty, it takes no room. */}
      <div className="empty:-mt-2" data-testid="connection-status" role="status">
        {connection === "stuck" ? (
          <Badge className="gap-2 px-3 py-1" data-testid="connection-pill" variant="danger">
            Live updates are not reaching this page
            <Button onClick={() => window.location.reload()} size="xs" variant="outline">
              Reload
            </Button>
          </Badge>
        ) : connection === "reconnecting" ? (
          <Badge className="px-3 py-1" data-testid="connection-pill" variant="muted">
            Reconnecting…
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
