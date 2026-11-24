import { useLiveSocketPill } from "@upstream-dispatch/api/live-socket";
import { DraftsNotKept } from "@upstream-dispatch/features/inbox/DraftsNotKept";
import { PendingWritesIndicator } from "@upstream-dispatch/features/writes/PendingWritesIndicator";
import { FOOT_STATUS_INSET_PROPERTY, useFootInset } from "@upstream-dispatch/hooks/useFootInset";
import { useRef } from "react";

import { Button } from "@/ui/button";
import { cn } from "@/ui/lib/utils";

const PILL = "flex items-center gap-2 rounded-md border px-3 py-1 text-xs font-medium";

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
        <p
          aria-live="polite"
          className={cn(PILL, "border-danger-border bg-danger-tint text-danger")}
          data-testid="connection-pill"
        >
          Live updates are not reaching this page
          <Button onClick={() => window.location.reload()} size="xs" variant="link">
            Reload
          </Button>
        </p>
      ) : connection === "reconnecting" ? (
        <p
          aria-live="polite"
          className={cn(PILL, "border-warning-border bg-warning-tint text-warning")}
          data-testid="connection-pill"
        >
          Reconnecting…
        </p>
      ) : null}
    </div>
  );
}
